/**
 * Zoho Desk is where a company's support tickets actually live: most arrive by
 * email, phone or an engineer filing them, never through the portal form. The
 * portal ticket list used to read only the portal's own table, so a company
 * with open Desk tickets saw "No tickets yet" — including a DE admin viewing as
 * that company.
 *
 * This module pulls each company's tickets from its Desk account, keeps a
 * short-lived per-company cache so page loads stay fast, and refreshes the
 * companies people have been looking at on a timer so the list is already
 * current when someone comes back.
 *
 * Tenant safety: a company is matched to exactly one Desk account, by its own
 * contact email first and then by an exact (normalized) account-name match. An
 * ambiguous or fuzzy name match returns nothing rather than risk showing one
 * company another company's tickets.
 */
import type { ZohoDeskAccount, ZohoDeskContact, ZohoDeskConversation, ZohoTicket } from "./zoho/zohoDesk";

export type PortalTicketStatus = "open" | "in_progress" | "pending_client" | "resolved" | "closed";
export type PortalTicketPriority = "low" | "medium" | "high" | "critical";

export const DESK_TICKET_ID_PREFIX = "desk-";

export function deskPortalTicketId(deskTicketId: string): string {
  return `${DESK_TICKET_ID_PREFIX}${deskTicketId}`;
}

/** The Desk ticket id behind a portal ticket id, or null for a local ticket. */
export function parseDeskPortalTicketId(id: string | null | undefined): string | null {
  if (!id || !id.startsWith(DESK_TICKET_ID_PREFIX)) return null;
  const rest = id.slice(DESK_TICKET_ID_PREFIX.length);
  return /^\d+$/.test(rest) ? rest : null;
}

/**
 * Map a Desk status onto the portal's five filters. Desk orgs rename and add
 * statuses freely, so match on wording first and fall back to Desk's fixed
 * `statusType` (Open / On Hold / Closed).
 */
export function mapDeskStatus(status?: string | null, statusType?: string | null): PortalTicketStatus {
  const s = (status || "").trim().toLowerCase();
  if (/(waiting|awaiting|pending)\s+(on\s+|for\s+)?(customer|client|you|reply|response|requester)/.test(s)) {
    return "pending_client";
  }
  if (/resolved|solved/.test(s)) return "resolved";
  if (/closed|cancel/.test(s)) return "closed";
  if (/progress|working|escalat|assigned|investigat/.test(s)) return "in_progress";
  const t = (statusType || "").trim().toLowerCase();
  if (t === "closed") return "closed";
  if (t === "on hold" || s === "on hold") return "in_progress";
  return "open";
}

export function mapDeskPriority(priority?: string | null): PortalTicketPriority {
  const p = (priority || "").trim().toLowerCase();
  if (p === "urgent" || p === "critical") return "critical";
  if (p === "high") return "high";
  if (p === "low") return "low";
  return "medium";
}

const COMPANY_SUFFIXES = new Set([
  "inc", "incorporated", "llc", "ltd", "limited", "corp", "corporation", "co", "company", "plc", "lp", "llp", "pllc",
]);

/** "Alamo Industries, Inc." and "alamo industries" compare equal. */
export function normalizeCompanyName(name: string | null | undefined): string {
  const words = (name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  while (words.length > 1 && COMPANY_SUFFIXES.has(words[words.length - 1])) words.pop();
  return words.join(" ");
}

/** The single Desk account whose name matches exactly; null when none or ambiguous. */
export function pickDeskAccount(companyName: string, accounts: ZohoDeskAccount[]): ZohoDeskAccount | null {
  const want = normalizeCompanyName(companyName);
  if (!want) return null;
  const matches = accounts.filter((a) => normalizeCompanyName(a.accountName) === want);
  const unique = new Map(matches.map((a) => [a.id, a]));
  return unique.size === 1 ? Array.from(unique.values())[0] : null;
}

export interface DeskClientSnapshot {
  id: string;
  companyName: string;
  contactEmail?: string | null;
}

export interface DeskTicketApi {
  searchAccountsByName(name: string): Promise<ZohoDeskAccount[]>;
  getContactByEmail(email: string): Promise<ZohoDeskContact | null>;
  getTicketsByAccount(accountId: string): Promise<ZohoTicket[]>;
}

export interface DeskTicketsResult {
  accountId: string | null;
  tickets: ZohoTicket[];
  /** When the tickets were last read from Desk (epoch ms), null if never. */
  syncedAt: number | null;
  /** Set when Desk could not be reached; `tickets` is then the last good copy (possibly empty). */
  error: string | null;
}

interface AccountEntry {
  accountId: string | null;
  resolvedAt: number;
}

interface TicketEntry {
  accountId: string;
  tickets: ZohoTicket[];
  syncedAt: number;
}

export interface DeskTicketSyncOptions {
  api: DeskTicketApi;
  isConfigured: () => boolean;
  now?: () => number;
  /** How long a company's ticket list is served from cache. */
  ticketTtlMs?: number;
  /** How long a found company → account match is trusted. */
  accountTtlMs?: number;
  /** How long "no Desk account for this company" is trusted. */
  missingAccountTtlMs?: number;
  /** Companies not viewed for this long drop out of the background refresh. */
  watchWindowMs?: number;
  log?: (message: string, meta?: Record<string, unknown>) => void;
}

export function createDeskTicketSync(options: DeskTicketSyncOptions) {
  const now = options.now ?? Date.now;
  const ticketTtlMs = options.ticketTtlMs ?? 60_000;
  const accountTtlMs = options.accountTtlMs ?? 6 * 60 * 60_000;
  const missingAccountTtlMs = options.missingAccountTtlMs ?? 15 * 60_000;
  const watchWindowMs = options.watchWindowMs ?? 24 * 60 * 60_000;
  const log = options.log ?? (() => {});

  const accounts = new Map<string, AccountEntry>();
  const tickets = new Map<string, TicketEntry>();
  const inflight = new Map<string, Promise<DeskTicketsResult>>();
  const watched = new Map<string, { client: DeskClientSnapshot; lastViewedAt: number }>();

  async function resolveAccountId(client: DeskClientSnapshot): Promise<string | null> {
    const cached = accounts.get(client.id);
    if (cached) {
      const ttl = cached.accountId ? accountTtlMs : missingAccountTtlMs;
      if (now() - cached.resolvedAt < ttl) return cached.accountId;
    }

    let accountId: string | null = null;
    const email = client.contactEmail?.trim();
    if (email) {
      const contact = await options.api.getContactByEmail(email);
      if (contact?.accountId) accountId = contact.accountId;
    }
    if (!accountId && client.companyName?.trim()) {
      const found = await options.api.searchAccountsByName(client.companyName.trim());
      accountId = pickDeskAccount(client.companyName, found)?.id ?? null;
    }

    accounts.set(client.id, { accountId, resolvedAt: now() });
    if (!accountId) log("portal desk sync: no Desk account matched", { clientId: client.id });
    return accountId;
  }

  async function fetchFor(client: DeskClientSnapshot): Promise<DeskTicketsResult> {
    const previous = tickets.get(client.id);
    try {
      const accountId = await resolveAccountId(client);
      if (!accountId) {
        tickets.delete(client.id);
        return { accountId: null, tickets: [], syncedAt: now(), error: null };
      }
      const list = await options.api.getTicketsByAccount(accountId);
      const entry: TicketEntry = { accountId, tickets: list, syncedAt: now() };
      tickets.set(client.id, entry);
      return { ...entry, error: null };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || String(error);
      log("portal desk sync: Desk read failed", { clientId: client.id, message });
      return {
        accountId: previous?.accountId ?? null,
        tickets: previous?.tickets ?? [],
        syncedAt: previous?.syncedAt ?? null,
        error: "Live ticket sync with DE Desk is unavailable right now.",
      };
    }
  }

  /** Tickets for a company, from cache when fresh. Also marks the company as watched. */
  async function getTicketsForClient(
    client: DeskClientSnapshot,
    opts: { force?: boolean } = {},
  ): Promise<DeskTicketsResult> {
    watched.set(client.id, { client, lastViewedAt: now() });
    if (!options.isConfigured()) {
      return { accountId: null, tickets: [], syncedAt: null, error: null };
    }
    const cached = tickets.get(client.id);
    if (!opts.force && cached && now() - cached.syncedAt < ticketTtlMs) {
      return { ...cached, error: null };
    }
    const running = inflight.get(client.id);
    if (running) return running;
    const promise = fetchFor(client).finally(() => inflight.delete(client.id));
    inflight.set(client.id, promise);
    return promise;
  }

  /** Background pass: refresh every company someone has viewed recently. */
  async function refreshWatched(): Promise<{ refreshed: number; failed: number; dropped: number }> {
    if (!options.isConfigured()) return { refreshed: 0, failed: 0, dropped: 0 };
    let refreshed = 0;
    let failed = 0;
    let dropped = 0;
    for (const [clientId, entry] of Array.from(watched.entries())) {
      if (now() - entry.lastViewedAt > watchWindowMs) {
        watched.delete(clientId);
        tickets.delete(clientId);
        dropped += 1;
        continue;
      }
      const running = inflight.get(clientId);
      const result = await (running ??
        (() => {
          const p = fetchFor(entry.client).finally(() => inflight.delete(clientId));
          inflight.set(clientId, p);
          return p;
        })());
      if (result.error) failed += 1;
      else refreshed += 1;
    }
    return { refreshed, failed, dropped };
  }

  /** The Desk account a company maps to (cached). Used to authorize single-ticket reads. */
  async function accountIdFor(client: DeskClientSnapshot): Promise<string | null> {
    if (!options.isConfigured()) return null;
    return resolveAccountId(client);
  }

  return {
    getTicketsForClient,
    refreshWatched,
    accountIdFor,
    watchedCount: () => watched.size,
  };
}

export type DeskTicketSync = ReturnType<typeof createDeskTicketSync>;

let timer: ReturnType<typeof setInterval> | null = null;

/** Run `sync.refreshWatched()` on an interval. Idempotent. */
export function startDeskTicketSyncWorker(
  sync: DeskTicketSync,
  intervalMs: number,
  log: (message: string, meta?: Record<string, unknown>) => void = () => {},
): void {
  if (timer || intervalMs <= 0) return;
  let running = false;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    void sync
      .refreshWatched()
      .then((r) => {
        if (r.refreshed || r.failed) log("portal desk sync tick", r);
      })
      .catch((error) => log("portal desk sync tick failed", { message: error?.message || String(error) }))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  timer.unref?.();
}

export function stopDeskTicketSyncWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// ----- shaping for the portal API -----

export interface ListedPortalTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  clientId: string | null;
  companyName: string | null;
  isInternal: boolean;
  source?: "portal" | "desk";
}

export function deskTicketToListed(
  t: ZohoTicket,
  ctx: { clientId: string | null; companyName: string | null },
): ListedPortalTicket {
  return {
    id: deskPortalTicketId(t.id),
    ticketNumber: t.ticketNumber ? `#${t.ticketNumber}` : `#${t.id}`,
    subject: t.subject || "(no subject)",
    description: t.description || "",
    status: mapDeskStatus(t.status, t.statusType),
    priority: mapDeskPriority(t.priority),
    category: "General",
    createdAt: t.createdTime,
    updatedAt: t.modifiedTime || t.createdTime,
    clientId: ctx.clientId,
    companyName: ctx.companyName,
    isInternal: false,
    source: "desk",
  };
}

/**
 * One list from local portal tickets and Desk tickets. A portal ticket already
 * pushed to Desk (linked by `zohoTicketId`) appears once, under its portal id so
 * the detail page and comments keep working, with Desk's live status.
 */
export function mergePortalAndDeskTickets(
  local: Array<ListedPortalTicket & { zohoTicketId?: string | null }>,
  desk: ZohoTicket[],
  ctx: { clientId: string | null; companyName: string | null },
): ListedPortalTicket[] {
  const deskById = new Map(desk.map((t) => [t.id, t]));
  const linked = new Set<string>();
  const merged: ListedPortalTicket[] = local.map(({ zohoTicketId, ...ticket }) => {
    const live = zohoTicketId ? deskById.get(zohoTicketId) : undefined;
    if (!live) return { ...ticket, source: "portal" as const };
    linked.add(live.id);
    return {
      ...ticket,
      status: mapDeskStatus(live.status, live.statusType),
      priority: mapDeskPriority(live.priority),
      updatedAt: live.modifiedTime || ticket.updatedAt,
      source: "portal" as const,
    };
  });
  for (const t of desk) {
    if (!linked.has(t.id)) merged.push(deskTicketToListed(t, ctx));
  }
  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Whether a non-admin may see a Desk ticket from their own company's account.
 * Mirrors portal ticket access: the person who raised it, or the Company IT
 * Contact. DE admins are handled by the caller.
 */
export function canSeeDeskTicket(
  actor: { email?: string | null; orgRole?: string | null; isCompanyItContact?: boolean | null } | undefined,
  ticket: Pick<ZohoTicket, "email">,
): boolean {
  if (!actor) return false;
  if (actor.isCompanyItContact === true || actor.orgRole === "company_it_contact") return true;
  const mine = actor.email?.trim().toLowerCase();
  return !!mine && !!ticket.email && ticket.email.trim().toLowerCase() === mine;
}

/** Desk bodies are HTML; the portal renders plain text. */
export function deskHtmlToText(html: string | null | undefined): string {
  return (html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface PortalTicketComment {
  id: string;
  author: string;
  role: string;
  content: string;
  timestamp: string | undefined;
  isInternal?: boolean;
}

/** Desk conversation → portal comments. Private comments only reach admins. */
export function deskConversationsToComments(
  conversations: ZohoDeskConversation[],
  opts: { isAdmin: boolean; viewerEmail?: string | null },
): PortalTicketComment[] {
  const viewer = opts.viewerEmail?.trim().toLowerCase() || null;
  const out: PortalTicketComment[] = [];
  for (const c of conversations) {
    const isComment = c.type === "comment";
    const isPrivate = isComment ? c.isPublic === false : c.visibility === "private";
    if (isPrivate && !opts.isAdmin) continue;
    const person = (isComment ? c.commenter : c.author) || null;
    const fromCustomer = isComment ? person?.type === "END_USER" : c.direction === "in";
    const isViewer = !!viewer && person?.email?.trim().toLowerCase() === viewer;
    const content = deskHtmlToText(isComment ? c.content : c.summary || c.content);
    if (!content) continue;
    out.push({
      id: deskPortalTicketId(c.id),
      author: isViewer ? "You" : fromCustomer ? person?.name || "Client" : "Support",
      role: fromCustomer ? "Client" : isPrivate ? "Support Engineer" : "Support",
      content,
      timestamp: isComment ? c.commentedTime || c.createdTime : c.createdTime,
      ...(opts.isAdmin ? { isInternal: isPrivate } : {}),
    });
  }
  return out.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
}
