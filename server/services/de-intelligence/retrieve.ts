import { DE_KNOWLEDGE_CATALOG } from "./catalog";
import { recordKnowledgeGap, searchStoredKnowledge } from "./storage";
import type {
  KnowledgeRecord,
  KnowledgeRetrievalHit,
  KnowledgeRetrievalRequest,
  KnowledgeScope,
} from "./types";

const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from", "how", "i", "in",
  "is", "it", "my", "of", "on", "or", "our", "that", "the", "this", "to", "was", "we", "what",
  "when", "where", "which", "who", "why", "with", "you", "your",
]);

let publicStorageSnapshot: KnowledgeRecord[] = [];
let publicSnapshotRefresh: Promise<void> | null = null;

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+.#-]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string): string[] {
  return Array.from(new Set(normalize(value).split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token))));
}

function scopeAllowed(record: KnowledgeRecord, scope: KnowledgeScope, clientId?: string): boolean {
  if (record.status !== "active") return false;
  if (scope === "public") return record.scope === "public";
  if (scope === "internal") return record.scope === "public" || record.scope === "internal";
  if (record.scope === "public") return true;
  if (record.scope === "client") return !!clientId && record.clientId === clientId;
  return false;
}

function scoreRecord(record: KnowledgeRecord, request: KnowledgeRetrievalRequest): KnowledgeRetrievalHit {
  const query = normalize(request.query);
  const queryTokens = tokens(query);
  const searchable = normalize([
    record.title,
    record.summary,
    record.content,
    record.vendor,
    record.product,
    record.service,
    ...record.tags,
  ].filter(Boolean).join(" "));
  const searchableTokens = new Set(tokens(searchable));

  let score = record.authority / 100;
  const reasons: string[] = [`authority:${record.authority}`];

  let lexicalMatches = 0;
  for (const token of queryTokens) {
    if (searchableTokens.has(token)) lexicalMatches += 1;
  }
  if (queryTokens.length && lexicalMatches) {
    const lexical = lexicalMatches / queryTokens.length;
    score += lexical * 4;
    reasons.push(`lexical:${lexicalMatches}/${queryTokens.length}`);
  }

  for (const tag of record.tags) {
    const tagNorm = normalize(tag);
    if (tagNorm && query.includes(tagNorm)) {
      score += tagNorm.includes(" ") ? 1.4 : 0.65;
      reasons.push(`tag:${tag}`);
    }
  }

  if (request.mode && record.modes?.includes(request.mode)) {
    score += 1.75;
    reasons.push(`mode:${request.mode}`);
  }
  if (request.pageType && record.pageTypes?.includes(request.pageType)) {
    score += 1.1;
    reasons.push(`page:${request.pageType}`);
  }
  if (record.scope === "client" && request.clientId && record.clientId === request.clientId) {
    score += 3;
    reasons.push("client-match");
  }
  if (record.sourceDocumentId) {
    score += 0.08;
    reasons.push("durable-source");
  }
  if (record.confidence != null) {
    score += Math.max(0, Math.min(record.confidence, 1)) * 0.2;
    reasons.push(`confidence:${record.confidence.toFixed(2)}`);
  }

  return { record, score, reasons };
}

export function retrieveKnowledge(
  request: KnowledgeRetrievalRequest,
  catalog: KnowledgeRecord[] = DE_KNOWLEDGE_CATALOG,
): KnowledgeRetrievalHit[] {
  const limit = Math.max(1, Math.min(request.limit ?? 6, 12));
  return catalog
    .filter((record) => scopeAllowed(record, request.scope, request.clientId))
    .map((record) => scoreRecord(record, request))
    .sort((a, b) => b.score - a.score || b.record.authority - a.record.authority || a.record.id.localeCompare(b.record.id))
    .slice(0, limit);
}

export async function retrieveKnowledgeStorageBacked(
  request: KnowledgeRetrievalRequest,
): Promise<KnowledgeRetrievalHit[]> {
  // Authorization filtering occurs in the durable store before records are
  // returned here. We then apply the exact same governed reranker used by the
  // bootstrap corpus, preserving one retrieval contract across both sources.
  const storedCandidates = await searchStoredKnowledge(request, 50);
  const merged = new Map<string, KnowledgeRecord>();
  for (const record of DE_KNOWLEDGE_CATALOG) merged.set(record.id, record);
  for (const record of storedCandidates) merged.set(record.id, record);

  const hits = retrieveKnowledge(request, Array.from(merged.values()));
  const queryTokens = tokens(request.query);
  const hasMeaningfulMatch = hits.some((hit) =>
    hit.reasons.some((reason) => reason.startsWith("lexical:") || reason.startsWith("tag:"))
  );
  if (queryTokens.length >= 2 && !hasMeaningfulMatch) {
    void recordKnowledgeGap({
      query: request.query,
      scope: request.scope,
      clientId: request.clientId,
      mode: request.mode,
      pageType: request.pageType,
      reason: "No meaningful governed lexical/tag match after storage-backed retrieval",
    });
  }
  return hits;
}

export async function refreshPublicStoredKnowledgeSnapshot(): Promise<void> {
  if (publicSnapshotRefresh) return publicSnapshotRefresh;
  publicSnapshotRefresh = (async () => {
    try {
      publicStorageSnapshot = await searchStoredKnowledge(
        { query: "", scope: "public", limit: 12 },
        100,
      );
    } catch (error: any) {
      console.warn("[de-intelligence] public storage snapshot refresh failed:", error?.message || error);
    } finally {
      publicSnapshotRefresh = null;
    }
  })();
  return publicSnapshotRefresh;
}

// Start hydrating durable public knowledge as soon as the retriever module is
// loaded. Public DE Desk remains fully functional on the bootstrap corpus while
// the database initializes.
void refreshPublicStoredKnowledgeSnapshot();

/**
 * Merge hits from several public queries, keeping the best score per record.
 * Used by DE Desk so a sales or support question can search the visitor's
 * wording and a mode expansion without leaking non-public scopes.
 */
export function mergeKnowledgeHits(
  hitSets: KnowledgeRetrievalHit[][],
  limit = 6,
): KnowledgeRetrievalHit[] {
  const cap = Math.max(1, Math.min(limit, 12));
  const best = new Map<string, KnowledgeRetrievalHit>();
  for (const hits of hitSets) {
    for (const hit of hits) {
      const prev = best.get(hit.record.id);
      if (!prev || hit.score > prev.score) {
        const reasons = Array.from(
          new Set([...(prev?.reasons || []), ...hit.reasons]),
        );
        best.set(hit.record.id, { ...hit, reasons });
      } else if (prev) {
        prev.reasons = Array.from(new Set([...prev.reasons, ...hit.reasons]));
      }
    }
  }
  return Array.from(best.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.record.authority - a.record.authority ||
        a.record.id.localeCompare(b.record.id),
    )
    .slice(0, cap);
}

export function formatKnowledgeForPrompt(hits: KnowledgeRetrievalHit[]): string {
  if (!hits.length) return "No governed DE knowledge matched this turn. Do not invent DE-specific facts; ask one clarifying question or route to support.";

  return hits
    .map(({ record }, index) => [
      `[DE SOURCE ${index + 1}: ${record.id}]`,
      `Title: ${record.title}`,
      `Type: ${record.type}; authority=${record.authority}; scope=${record.scope}; effective=${record.effectiveDate || "unspecified"}`,
      `Source: ${record.source.label}${record.sourceDocumentId ? `; document=${record.sourceDocumentId}` : ""}${record.chunkIndex == null ? "" : `; chunk=${record.chunkIndex}`}`,
      record.content,
    ].join("\n"))
    .join("\n\n");
}

export function retrievePublicKnowledge(params: {
  query: string;
  mode?: string;
  pageType?: string;
  limit?: number;
}): KnowledgeRetrievalHit[] {
  // The public snapshot is hydrated only from a store query whose SQL scope
  // predicate is public-only. Re-check scope here as defense in depth.
  const catalog = [...DE_KNOWLEDGE_CATALOG, ...publicStorageSnapshot].filter(
    (record) => record.scope === "public",
  );

  // Keep the snapshot fresh without blocking a visitor turn. Newly ingested
  // durable records become visible on the next turn/process refresh.
  void refreshPublicStoredKnowledgeSnapshot();

  return retrieveKnowledge({
    query: params.query,
    scope: "public",
    mode: params.mode,
    pageType: params.pageType,
    limit: params.limit,
  }, catalog);
}

export async function retrievePublicKnowledgeStorageBacked(params: {
  query: string;
  mode?: string;
  pageType?: string;
  limit?: number;
}): Promise<KnowledgeRetrievalHit[]> {
  return retrieveKnowledgeStorageBacked({
    query: params.query,
    scope: "public",
    mode: params.mode,
    pageType: params.pageType,
    limit: params.limit,
  });
}
