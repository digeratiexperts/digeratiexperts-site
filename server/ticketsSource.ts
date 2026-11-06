/**
 * Where portal and widget tickets go: TICKETS_SOURCE=desk|hub (default desk).
 *
 * Cross-repo review step 3, "Tickets". Joe, 2026-11-05: "Hub first then sync
 * with desk but if desk is first then sync with hub". With `hub`, the Client
 * Portal and the website "Get Support" widget create, list and comment through
 * the Hub ticket API (de.hub.portal-tickets/v1, server/integrations/
 * hubTicketClient.ts); Zoho Desk sees those tickets through the Hub's own
 * two-way sync. With `desk` (the default, and any value that is not exactly
 * `hub`) nothing changes: the site writes to Desk as before.
 *
 * Fallback: when the Hub cannot take a ticket (not configured, unreachable,
 * a 5xx, a refusal such as "this account has no Hub client"), the ticket goes
 * down the existing Desk path, including its email/spool failover, and a
 * reconciliation note is written so DE can see every ticket that missed the
 * Hub. Nothing is dropped.
 *
 * Switch-on order and the week of watching: docs/TICKETS-SOURCE-SWITCH.md.
 */
import { randomBytes } from "crypto";
import { ticketReconciliationSpoolDir, writeSpoolEntry, type SpoolEntry } from "./publicSolutionSpool";
import { mapDeskPriority, type ListedPortalTicket } from "./portalDeskTickets";
import type { HubTicketFailure } from "./integrations/hubTicketClient";
import type { HubTicket, HubTicketChannel } from "./integrations/hubTicketsContract";

export type TicketsSource = "desk" | "hub";

let warnedUnknown = false;

export function ticketsSource(env: NodeJS.ProcessEnv = process.env): TicketsSource {
  const raw = (env.TICKETS_SOURCE || "").trim().toLowerCase();
  if (raw === "hub") return "hub";
  if (raw && raw !== "desk" && !warnedUnknown) {
    warnedUnknown = true;
    console.warn(`[TICKETS-SOURCE] Unknown TICKETS_SOURCE value; using desk. Expected desk or hub.`);
  }
  return "desk";
}

// ----- ids -----

/** A Hub ticket with no portal row is listed as `hub-<id>`. */
export const HUB_TICKET_ID_PREFIX = "hub-";

export function hubPortalTicketId(hubTicketId: number): string {
  return `${HUB_TICKET_ID_PREFIX}${hubTicketId}`;
}

export function parseHubPortalTicketId(id: string | null | undefined): number | null {
  if (!id || !id.startsWith(HUB_TICKET_ID_PREFIX)) return null;
  const rest = id.slice(HUB_TICKET_ID_PREFIX.length);
  return /^\d{1,10}$/.test(rest) ? Number(rest) : null;
}

/** A portal row created through the Hub carries `hub:<id>` where Desk rows carry `zoho:<id>`. */
export function hubAssignedTo(hubTicketId: number): string {
  return `hub:${hubTicketId}`;
}

export function parseHubAssignedTo(assignedTo: string | null | undefined): number | null {
  const match = String(assignedTo || "").match(/^hub:(\d{1,10})$/);
  return match ? Number(match[1]) : null;
}

/** Retry-safe keys for the Hub: one per portal ticket, per widget submission, per reply. */
export function hubIdempotencyKey(kind: "portal" | "widget" | "reply", seed?: string | null): string {
  const clean = String(seed || "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 80);
  return `${kind}-${clean || randomBytes(9).toString("hex")}`;
}

// ----- reconciliation notes -----

export type TicketReconciliationNote = {
  /** Spool file id. */
  id: string;
  at: string;
  /** What missed the Hub: a new ticket or a client's reply. */
  kind: "create" | "reply";
  channel: HubTicketChannel;
  /** Why: not_configured, unreachable, refused, invalid, no_account. */
  hubReason: HubTicketFailure["reason"] | "no_account";
  hubStatus: number | null;
  hubCode: string | null;
  /** Where the ticket went instead. */
  handedTo: "desk" | "portal_only";
  /** The portal's own number (TKT-…) or the widget reference, when there is one. */
  reference: string | null;
  portalClientId: string | null;
  hubAccountId: string | null;
  /** The Desk ticket id when the Desk API took it; null when it went to the Desk failover (email/spool) or nowhere. */
  deskTicketId: string | null;
  requesterEmail: string;
  subject: string | null;
  /** For a reply that only the portal holds: the Hub ticket it was meant for. */
  hubTicketId: number | null;
};

export type TicketReconciliationEntry = SpoolEntry<TicketReconciliationNote>;

export interface ReconciliationDeps {
  write: (entry: TicketReconciliationEntry) => boolean;
  now: () => Date;
}

export const defaultReconciliationDeps: ReconciliationDeps = {
  write: (entry) => writeSpoolEntry(entry as unknown as SpoolEntry<{ id: string }>, ticketReconciliationSpoolDir()),
  now: () => new Date(),
};

/**
 * Write one reconciliation note (disk, outside the release folders in
 * production) and log it. Returns whether the note was stored. Never throws.
 */
export function recordTicketReconciliation(
  note: Omit<TicketReconciliationNote, "id" | "at">,
  deps: ReconciliationDeps = defaultReconciliationDeps,
): TicketReconciliationNote {
  const now = deps.now();
  const full: TicketReconciliationNote = {
    ...note,
    id: `rec-${now.getTime().toString(36)}-${randomBytes(4).toString("hex")}`,
    at: now.toISOString(),
  };
  let stored = false;
  try {
    stored = deps.write({ version: 1, spooledAt: full.at, salesEmailedAt: null, record: full });
  } catch {
    stored = false;
  }
  // Identifiers only in the log; the subject and email stay in the note file.
  console.warn("[TICKETS-SOURCE] Ticket missed the Hub; reconciliation note", {
    id: full.id,
    kind: full.kind,
    channel: full.channel,
    hubReason: full.hubReason,
    hubStatus: full.hubStatus,
    hubCode: full.hubCode,
    handedTo: full.handedTo,
    reference: full.reference,
    deskTicketId: full.deskTicketId,
    stored,
  });
  return full;
}

/** A failure result → the reconciliation fields it fills. */
export function hubFailureFields(failure: HubTicketFailure | { reason: "no_account" }) {
  return {
    hubReason: failure.reason,
    hubStatus: "status" in failure && typeof failure.status === "number" ? failure.status : null,
    hubCode: "code" in failure && typeof failure.code === "string" ? failure.code : null,
  } as const;
}

// ----- shaping for the portal API -----

export function hubTicketToListed(
  t: HubTicket,
  ctx: { clientId: string | null; companyName: string | null },
): ListedPortalTicket {
  return {
    id: hubPortalTicketId(t.id),
    ticketNumber: t.number,
    subject: t.subject || "(no subject)",
    description: t.description,
    status: t.status,
    priority: mapDeskPriority(t.priority),
    category: "General",
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    clientId: ctx.clientId,
    companyName: ctx.companyName,
    isInternal: false,
    source: "hub",
  };
}

/**
 * One list from the portal's own rows and the account's Hub tickets. A portal
 * row linked to a Hub ticket (`hub:<id>`), or an older row whose Desk ticket
 * the Hub sync has since linked (`zoho:<deskId>` = the Hub ticket's
 * deskTicketId), appears once, under its portal id, with the Hub's live
 * status. Every other Hub ticket is listed as `hub-<id>`.
 */
export function mergePortalAndHubTickets(
  local: Array<ListedPortalTicket & { zohoTicketId?: string | null; hubTicketId?: number | null }>,
  hub: HubTicket[],
  ctx: { clientId: string | null; companyName: string | null },
): ListedPortalTicket[] {
  const byHubId = new Map(hub.map((t) => [t.id, t]));
  const byDeskId = new Map(hub.filter((t) => t.deskTicketId).map((t) => [t.deskTicketId as string, t]));
  const linked = new Set<number>();
  const merged: ListedPortalTicket[] = local.map(({ zohoTicketId, hubTicketId, ...ticket }) => {
    const live = (hubTicketId != null ? byHubId.get(hubTicketId) : undefined) ?? (zohoTicketId ? byDeskId.get(zohoTicketId) : undefined);
    if (!live) return { ...ticket, source: "portal" as const };
    linked.add(live.id);
    return { ...ticket, status: live.status, priority: live.priority, updatedAt: live.updatedAt || ticket.updatedAt, source: "portal" as const };
  });
  for (const t of hub) {
    if (!linked.has(t.id)) merged.push(hubTicketToListed(t, ctx));
  }
  return merged.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/**
 * Whether a non-admin may see a Hub ticket of their own company. Mirrors the
 * Desk rule (canSeeDeskTicket): the person who raised it, or the Company IT
 * Contact. DE admins are handled by the caller.
 */
export function canSeeHubTicket(
  actor: { email?: string | null; orgRole?: string | null; isCompanyItContact?: boolean | null } | undefined,
  ticket: Pick<HubTicket, "requesterEmail">,
): boolean {
  if (!actor) return false;
  if (actor.isCompanyItContact === true || actor.orgRole === "company_it_contact") return true;
  const mine = actor.email?.trim().toLowerCase();
  return !!mine && !!ticket.requesterEmail && ticket.requesterEmail.trim().toLowerCase() === mine;
}
