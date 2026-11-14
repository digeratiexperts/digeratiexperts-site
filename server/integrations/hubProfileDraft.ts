/**
 * IT & Security Profile drafts (Hub contract, Hub Builder 2026-11-13).
 *
 *  1. Draft:  the site server proxies an anonymous draft to the Hub's
 *             POST /api/public/desk/profile-draft, keyed to the DE Desk sessionId.
 *             Body: visitor words (8 KB cap), situation_ids, service_ids, it_plan JSON,
 *             consent_text_version. Never email, phone, name or company.
 *             Returns { draftId, claimToken, expiresAt }.
 *  2. Claim:  after /api/portal/register creates the prospect client, the server calls
 *             POST /api/integrations/v1/website/profile-claim, signed with the
 *             website_to_hub scoped HMAC (never the legacy lead secret), and keeps the
 *             returned canonicalAccountId as portal_clients.hub_account_id.
 *
 * Both are OFF until the Hub ships them: HUB_PROFILE_DRAFTS_ENABLED=1 turns them on,
 * and the Hub origin comes from the existing TECHSALES_HUB_URL / TECHSALES_SYNC_URL.
 * Unset, nothing is sent and the page never offers to save.
 * Matched services are recommendations only; nothing here writes entitlements.
 */
import { logger } from "../logger";
import { buildSignedHeaders, newEventId, outboundSecret } from "./deSyncAuth";
import { hubOrigin, persistHubAccountId } from "./techSalesClient";
import { assertMutationAllowed } from "../stagingReviewGuard";
import { PROFILE_DRAFT_CONSENT_VERSION, SITUATION_DRAFT_WORDS_MAX_BYTES } from "@shared/situationMatch";

export const PROFILE_DRAFT_PATH = "/api/public/desk/profile-draft";
export const PROFILE_CLAIM_PATH = "/api/integrations/v1/website/profile-claim";
const TIMEOUT_MS = 5000;

export function profileDraftsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const on = /^(1|true|yes|on)$/i.test(String(env.HUB_PROFILE_DRAFTS_ENABLED || "").trim());
  return on && Boolean(hubOrigin());
}

/** Cut a string to at most `max` UTF-8 bytes without splitting a character. */
export function capUtf8(text: string, max = SITUATION_DRAFT_WORDS_MAX_BYTES): string {
  if (Buffer.byteLength(text, "utf8") <= max) return text;
  let out = "";
  for (const ch of text) {
    if (Buffer.byteLength(out + ch, "utf8") > max) break;
    out += ch;
  }
  return out;
}

export type ProfileDraftInput = {
  sessionId: string;
  words: string;
  situationIds: string[];
  serviceIds: string[];
  itPlan: Record<string, unknown>;
};
export type ProfileDraftResult = { draftId: string; claimToken: string; expiresAt: string };

const TOKEN_RE = /^[A-Za-z0-9._~-]{16,256}$/;
export function isPlausibleClaimToken(v: unknown): v is string {
  return typeof v === "string" && TOKEN_RE.test(v);
}


/** Anonymous draft through the site server. Returns null when off or when the Hub refuses. */
export async function createProfileDraft(input: ProfileDraftInput, fetchImpl: typeof fetch = fetch): Promise<ProfileDraftResult | null> {
  if (!profileDraftsEnabled()) return null;
  const origin = hubOrigin();
  if (!origin) return null;
  assertMutationAllowed("Hub profile draft");
  const body = JSON.stringify({
    sessionId: input.sessionId,
    source: "website_describe_your_situation",
    words: capUtf8(input.words),
    situation_ids: input.situationIds,
    service_ids: input.serviceIds,
    it_plan: input.itPlan,
    consent_text_version: PROFILE_DRAFT_CONSENT_VERSION,
  });
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${origin}${PROFILE_DRAFT_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      signal: ctl.signal,
    });
    if (!res.ok) {
      logger.warn("Hub profile draft refused", { status: res.status });
      return null;
    }
    const j = (await res.json()) as Partial<ProfileDraftResult>;
    if (!j || typeof j.draftId !== "string" || !isPlausibleClaimToken(j.claimToken) || typeof j.expiresAt !== "string") return null;
    return { draftId: j.draftId, claimToken: j.claimToken, expiresAt: j.expiresAt };
  } catch (error) {
    logger.warn("Hub profile draft failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Claim a draft for a new portal client. Never throws: registration must not depend on the Hub.
 * The canonical account id comes only from the Hub's signed answer, never from the browser.
 */
export async function claimProfileDraft(
  input: { claimToken: string; portalClientId: string; company?: string | null; email: string },
  deps: { fetchImpl?: typeof fetch; persist?: (clientId: string, accountId: string) => Promise<void> } = {},
): Promise<{ canonicalAccountId: string } | null> {
  try {
    if (!profileDraftsEnabled() || !isPlausibleClaimToken(input.claimToken) || !input.portalClientId) return null;
    const origin = hubOrigin();
    const secret = origin ? outboundSecret("website_to_hub", PROFILE_CLAIM_PATH) : "";
    if (!origin || !secret) return null;
    assertMutationAllowed("Hub profile claim");
    const body = JSON.stringify({
      claimToken: input.claimToken,
      portalClientId: input.portalClientId,
      company: input.company || null,
      email: input.email,
    });
    const headers = buildSignedHeaders({ method: "POST", path: PROFILE_CLAIM_PATH, eventId: newEventId(), source: "website", body, secret });
    const doFetch = deps.fetchImpl || fetch;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await doFetch(`${origin}${PROFILE_CLAIM_PATH}`, { method: "POST", headers: { ...headers, Accept: "application/json" }, body, signal: ctl.signal });
    } finally {
      clearTimeout(t);
    }
    if (!res.ok) {
      logger.warn("Hub profile claim refused", { status: res.status, portalClientId: input.portalClientId });
      return null;
    }
    const j = (await res.json()) as { canonicalAccountId?: unknown };
    const id = String(j?.canonicalAccountId ?? "").trim();
    if (!/^[1-9]\d*$/.test(id)) return null;
    await (deps.persist || persistHubAccountId)(input.portalClientId, id);
    return { canonicalAccountId: id };
  } catch (error) {
    logger.warn("Hub profile claim failed", { message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}
