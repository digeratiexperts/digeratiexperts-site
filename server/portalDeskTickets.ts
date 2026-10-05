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
 * Tenant safety: a company's Desk scope is its account — found through its own
 * contact email, else a single exact (normalized) account-name match — plus
 * the Desk contacts under that account and the contacts whose email is
 * exactly one of the company's own. Fuzzy names, ambiguous names, email
 * domains and loose search hits never widen the scope.
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
  /** Emails of the company's portal users. Exact matches only. */
  memberEmails?: string[];
}

export interface DeskTicketApi {
  searchAccountsByName(name: string): Promise<ZohoDeskAccount[]>;
  getContactByEmail(email: string): Promise<ZohoDeskContact | null>;
  getTicketsByAccount(accountId: string): Promise<ZohoTicket[]>;
  getAccountContacts(accountId: string): Promise<ZohoDeskContact[]>;
  getAllTicketsForContact(contactId: string): Promise<ZohoTicket[]>;
}

/**
 * Where a company's tickets live in Desk: its account (if one exists) and the
 * Desk contacts that belong to it — the account's contacts plus any contact
 * whose email is exactly one of the company's own (contact email or a portal
 * user's). Contacts matter because Desk only stamps an account on a ticket
 * when the contact was already linked to one; plenty of real tickets carry
 * no account at all.
 */
export interface DeskScope {
  accountId: string | null;
  contactIds: string[];
  /** Lower-cased email → Desk contact id, for the company's own emails. */
  contactIdsByEmail: Record<string, string>;
}

const EMPTY_SCOPE: DeskScope = { accountId: null, contactIds: [], contactIdsByEmail: {} };
/** Upper bound on per-contact ticket reads for one company per refresh. */
const MAX_SCOPE_CONTACTS = 50;

export function isScopeLinked(scope: DeskScope): boolean {
  return !!scope.accountId || scope.contactIds.length > 0;
}

/** Whether a Desk ticket belongs to the company described by `scope`. */
export function ticketInScope(ticket: Pick<ZohoTicket, "accountId" | "contactId">, scope: DeskScope): boolean {
  if (scope.accountId && ticket.accountId === scope.accountId) return true;
  return !!ticket.contactId && scope.contactIds.includes(ticket.contactId);
}

export interface DeskTicketsResult {
  accountId: string | null;
  /** True when the company maps to a Desk account or at least one Desk contact. */
  linked: boolean;
  scope: DeskScope;
  tickets: ZohoTicket[];
  /** When the tickets were last read from Desk (epoch ms), null if never. */
  syncedAt: number | null;
  /** Set when Desk could not be reached; `tickets` is then the last good copy (possibly empty). */
  error: string | null;
}

interface ScopeEntry {
  scope: DeskScope;
  resolvedAt: number;
}

interface TicketEntry {
  scope: DeskScope;
  tickets: ZohoTicket[];
  syncedAt: number;
}

export interface DeskTicketSyncOptions {
  api: DeskTicketApi;
  isConfigured: () => boolean;
  now?: () => number;
  /** How long a company's ticket list is served from cache. */
  ticketTtlMs?: number;
  /** How long a found company → Desk scope is trusted. */
  accountTtlMs?: number;
  /** How long "nothing in Desk for this company" is trusted. */
  missingAccountTtlMs?: number;
  /** Companies not viewed for this long drop out of the background refresh. */
  watchWindowMs?: number;
  log?: (message: string, meta?: Record<string, unknown>) => void;
}

function companyEmails(client: DeskClientSnapshot): string[] {
  const all = [client.contactEmail, ...(client.memberEmails ?? [])]
    .map((e) => (e || "").trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return Array.from(new Set(all));
}

function sortByActivity(list: ZohoTicket[]): ZohoTicket[] {
  return list.sort(
    (a, b) => new Date(b.modifiedTime || b.createdTime).getTime() - new Date(a.modifiedTime || a.createdTime).getTime(),
  );
}

export function createDeskTicketSync(options: DeskTicketSyncOptions) {
  const now = options.now ?? Date.now;
  const ticketTtlMs = options.ticketTtlMs ?? 60_000;
  const accountTtlMs = options.accountTtlMs ?? 6 * 60 * 60_000;
  const missingAccountTtlMs = options.missingAccountTtlMs ?? 15 * 60_000;
  const watchWindowMs = options.watchWindowMs ?? 24 * 60 * 60_000;
  const log = options.log ?? (() => {});

  const scopes = new Map<string, ScopeEntry>();
  const tickets = new Map<string, TicketEntry>();
  const inflight = new Map<string, Promise<DeskTicketsResult>>();
  const watched = new Map<string, { client: DeskClientSnapshot; lastViewedAt: number }>();

  async function resolveScope(client: DeskClientSnapshot): Promise<DeskScope> {
    const cached = scopes.get(client.id);
    if (cached) {
      const ttl = isScopeLinked(cached.scope) ? accountTtlMs : missingAccountTtlMs;
      if (now() - cached.resolvedAt < ttl) return cached.scope;
    }

    const contactIdsByEmail: Record<string, string> = {};
    const contactIds = new Set<string>();
    let accountId: string | null = null;

    // The company's own emails, contact email first so its account wins.
    for (const email of companyEmails(client)) {
      const contact = await options.api.getContactByEmail(email);
      // Desk search can be loose; only an exact email match counts.
      if (!contact?.id || (contact.email || "").trim().toLowerCase() !== email) continue;
      contactIdsByEmail[email] = contact.id;
      contactIds.add(contact.id);
      if (!accountId && contact.accountId) accountId = contact.accountId;
    }
    if (!accountId && client.companyName?.trim()) {
      const found = await options.api.searchAccountsByName(client.companyName.trim());
      accountId = pickDeskAccount(client.companyName, found)?.id ?? null;
    }
    if (accountId) {
      for (const c of await options.api.getAccountContacts(accountId)) {
        if (c?.id) contactIds.add(c.id);
      }
    }

    const scope: DeskScope = {
      accountId,
      contactIds: Array.from(contactIds).slice(0, MAX_SCOPE_CONTACTS),
      contactIdsByEmail,
    };
    scopes.set(client.id, { scope, resolvedAt: now() });
    if (!isScopeLinked(scope)) log("portal desk sync: nothing in Desk matched", { clientId: client.id });
    return scope;
  }

  async function fetchFor(client: DeskClientSnapshot): Promise<DeskTicketsResult> {
    const previous = tickets.get(client.id);
    try {
      const scope = await resolveScope(client);
      if (!isScopeLinked(scope)) {
        tickets.delete(client.id);
        return { accountId: null, linked: false, scope, tickets: [], syncedAt: now(), error: null };
      }
      const byId = new Map<string, ZohoTicket>();
      if (scope.accountId) {
        for (const t of await options.api.getTicketsByAccount(scope.accountId)) byId.set(t.id, t);
      }
      for (const contactId of scope.contactIds) {
        for (const t of await options.api.getAllTicketsForContact(contactId)) {
          if (!byId.has(t.id)) byId.set(t.id, t);
        }
      }
      const entry: TicketEntry = { scope, tickets: sortByActivity(Array.from(byId.values())), syncedAt: now() };
      tickets.set(client.id, entry);
      return { ...entry, accountId: scope.accountId, linked: true, error: null };
    } catch (error: any) {
      const message = error?.response?.data?.message || error?.message || String(error);
      log("portal desk sync: Desk read failed", { clientId: client.id, message });
      const scope = previous?.scope ?? EMPTY_SCOPE;
      return {
        accountId: scope.accountId,
        linked: isScopeLinked(scope),
        scope,
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
      return { accountId: null, linked: false, scope: EMPTY_SCOPE, tickets: [], syncedAt: null, error: null };
    }
    const cached = tickets.get(client.id);
    if (!opts.force && cached && now() - cached.syncedAt < ticketTtlMs) {
      return { ...cached, accountId: cached.scope.accountId, linked: true, error: null };
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

  /** The Desk scope a company maps to (cached). Used to authorize single-ticket reads. */
  async function scopeFor(client: DeskClientSnapshot): Promise<DeskScope> {
    if (!options.isConfigured()) return EMPTY_SCOPE;
    return resolveScope(client);
  }

  return {
    getTicketsForClient,
    refreshWatched,
    scopeFor,
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
  ticket: Pick<ZohoTicket, "email" | "contactId">,
  scope?: Pick<DeskScope, "contactIdsByEmail">,
): boolean {
  if (!actor) return false;
  if (actor.isCompanyItContact === true || actor.orgRole === "company_it_contact") return true;
  const mine = actor.email?.trim().toLowerCase();
  if (!mine) return false;
  if (ticket.email && ticket.email.trim().toLowerCase() === mine) return true;
  // Desk leaves `email` empty on some tickets; the raising contact still identifies the person.
  const myContactId = scope?.contactIdsByEmail[mine];
  return !!myContactId && ticket.contactId === myContactId;
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
