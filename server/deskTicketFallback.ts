/**
 * DE Desk ticket failover (Joe, 2026-10-07: "make sure you have a fail over
 * for this DE Desk ticketing. Clients cannot see this at all.").
 *
 * Zoho Desk is the system of record, reached through the server's own OAuth
 * token. When that token is refused, Desk is down, or Desk rejects the
 * request, a client's ticket must still land with DE. Three independent
 * layers, each tried whatever the others did:
 *   1. the local disk spool (replayed into Desk by API once the token works:
 *      server/deskTicketReplayWorker.ts);
 *   2. an email of the full ticket to Desk's own incoming address, which Desk
 *      turns into a ticket (reply-to = the client, so a reply from Desk
 *      reaches them);
 *   3. an acknowledgement to the client with a reference.
 * The ticket is accepted when the spool or the Desk email held. Only when both
 * fail does the client see the retry message, and their draft is kept.
 *
 * An entry that reached the Desk inbox by email is never replayed by API, so
 * Desk never holds the same ticket twice.
 */
import { randomBytes } from "crypto";
import { COMPANY, PRIMARY_PHONE } from "@shared/companyContact";
import { deskTicketSpoolDir, updateSpoolEntry, writeSpoolEntry, type SpoolEntry } from "./publicSolutionSpool";
import { baseEmailTemplate, sendEmail } from "./services/notificationService";

export type FallbackTicketSource = "website-widget" | "client-portal";

export type FallbackTicket = {
  /** Spool file id: letters, digits, dash and underscore only. */
  id: string;
  /** What the client sees and staff search for, e.g. DE-W-MGA1B2-7K3Q. */
  reference: string;
  source: FallbackTicketSource;
  email: string;
  name?: string;
  subject: string;
  description: string;
  priority: string;
  createdAt: string;
  /** Why the Desk API did not take it: auth_failed, unavailable, rejected, not_configured. */
  reason: string;
  /** Set once the ticket was emailed into the Desk inbox; such entries are never replayed by API. */
  deskEmailedAt: string | null;
};

export type DeskTicketSpoolEntry = SpoolEntry<FallbackTicket>;

export type DeskFallbackOutcome = {
  accepted: boolean;
  spooled: boolean;
  deskEmailed: boolean;
  clientAcknowledged: boolean;
};

export type DeskFallbackDeps = {
  spool: (entry: DeskTicketSpoolEntry) => boolean;
  updateSpool: (entry: DeskTicketSpoolEntry) => boolean;
  emailDesk: (ticket: FallbackTicket) => Promise<boolean>;
  acknowledgeClient: (ticket: FallbackTicket) => Promise<boolean>;
  alertStaff: (ticket: FallbackTicket) => Promise<boolean>;
  now: () => Date;
};

/**
 * Zoho Desk's own incoming address for the Digerati Experts department. Mail
 * to it always becomes a Desk ticket. support@digerati-experts.com is only a
 * reply-from address in Desk: mail sent there reaches Desk only if that mailbox
 * forwards to Desk, and no Desk ticket had ever arrived by email (checked
 * 2026-10-07, tickets 104 to 132).
 */
export const DESK_INBOUND_ADDRESS = "support@thatsmytech.zohosupport.com";

/** The Desk inbox that Desk's email channel turns into tickets. */
export function deskFallbackInbox(env: NodeJS.ProcessEnv = process.env): string {
  return env.DESK_FALLBACK_EMAIL?.trim() || DESK_INBOUND_ADDRESS;
}

/** A reference the client can quote: DE-W- for the website widget, DE-P- for the portal. */
export function fallbackReference(source: FallbackTicketSource, now: Date = new Date()): string {
  const stamp = now.getTime().toString(36).toUpperCase();
  const tail = randomBytes(3).toString("hex").toUpperCase();
  return `DE-${source === "client-portal" ? "P" : "W"}-${stamp}-${tail}`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function deskEmailText(ticket: FallbackTicket): string {
  return [
    `Website support request ${ticket.reference}`,
    `From: ${ticket.name ? `${ticket.name} <${ticket.email}>` : ticket.email}`,
    `Priority: ${ticket.priority}`,
    `Source: ${ticket.source === "client-portal" ? "Client portal" : "DE Desk widget (Get Support)"}`,
    `Received: ${ticket.createdAt}`,
    "",
    ticket.description,
    "",
    "---",
    `The website could not open this ticket through the Zoho Desk API (${ticket.reason}), so it arrived by email.`,
    `Reply to this ticket to answer the client at ${ticket.email}.`,
  ].join("\n");
}

/** Staff alerts about the Desk API itself, at most one per six hours per process. */
const ALERT_EVERY_MS = 6 * 60 * 60 * 1000;
let lastAlertAt = 0;

/** Test seam. */
export function resetDeskFallbackAlertsForTests(): void {
  lastAlertAt = 0;
}

export const defaultDeskFallbackDeps: DeskFallbackDeps = {
  spool: (entry) => writeSpoolEntry(entry, deskTicketSpoolDir()),
  updateSpool: (entry) => updateSpoolEntry(entry, deskTicketSpoolDir()),
  emailDesk: (ticket) =>
    sendEmail({
      to: deskFallbackInbox(),
      ...(ticket.email ? { replyTo: { address: ticket.email, ...(ticket.name ? { name: ticket.name } : {}) } } : {}),
      subject: `[${ticket.reference}] ${ticket.subject}`,
      htmlBody: baseEmailTemplate(
        `<h2>${escapeHtml(ticket.subject)}</h2><p style="white-space: pre-wrap;">${escapeHtml(deskEmailText(ticket))}</p>`,
        "Website support request",
      ),
      textBody: deskEmailText(ticket),
    }),
  acknowledgeClient: (ticket) =>
    sendEmail({
      to: ticket.email,
      subject: `We received your support request (${ticket.reference})`,
      htmlBody: baseEmailTemplate(
        `<h2>We received your support request</h2>
         <p>Hi ${escapeHtml((ticket.name || "").trim().split(/\s+/)[0] || "there")},</p>
         <p>Your request "${escapeHtml(ticket.subject)}" is with the Digerati Experts desk. Your reference is <span class="highlight">${escapeHtml(ticket.reference)}</span>.</p>
         <p>An engineer will reply by email. If it is urgent, call ${escapeHtml(PRIMARY_PHONE.display)}.</p>`,
        "Support request received",
      ),
      textBody: [
        "We received your support request.",
        `Request: ${ticket.subject}`,
        `Reference: ${ticket.reference}`,
        `An engineer will reply by email. If it is urgent, call ${PRIMARY_PHONE.display}.`,
      ].join("\n"),
    }),
  alertStaff: async (ticket) => {
    if (Date.now() - lastAlertAt < ALERT_EVERY_MS) return false;
    lastAlertAt = Date.now();
    return sendEmail({
      to: process.env.ADMIN_EMAIL || COMPANY.email,
      subject: "DE Desk: the website cannot reach the Zoho Desk API",
      htmlBody: baseEmailTemplate(
        `<h2>The website's Zoho Desk connection is failing (${escapeHtml(ticket.reason)})</h2>
         <p>Client tickets are still arriving: each one goes into the Desk inbox by email and is kept on the server until the API works again.</p>
         <p>To restore the API: generate a new Zoho Desk refresh token (scopes in deploy/vps/env.production.example), set ZOHO_DESK_REFRESH_TOKEN on the server, restart, and check /api/zoho/desk/status reads connected.</p>`,
        "DE Desk API failing",
      ),
    });
  },
  now: () => new Date(),
};

/** Builds the record for a ticket the Desk API did not take. */
export function fallbackTicket(input: {
  source: FallbackTicketSource;
  email: string;
  name?: string;
  subject: string;
  description: string;
  priority: string;
  reason: string;
  reference?: string;
  now?: Date;
}): FallbackTicket {
  const now = input.now ?? new Date();
  const reference = input.reference ?? fallbackReference(input.source, now);
  return {
    id: reference.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80),
    reference,
    source: input.source,
    email: input.email,
    ...(input.name ? { name: input.name } : {}),
    subject: input.subject,
    description: input.description,
    priority: input.priority,
    createdAt: now.toISOString(),
    reason: input.reason,
    deskEmailedAt: null,
  };
}

/**
 * Saves a ticket the Desk API did not take. Never throws.
 * `acknowledge` is false when the client already sees the ticket elsewhere (the portal).
 */
export async function saveTicketOutsideDesk(
  ticket: FallbackTicket,
  options: { acknowledge?: boolean } = {},
  deps: DeskFallbackDeps = defaultDeskFallbackDeps,
): Promise<DeskFallbackOutcome> {
  const entry: DeskTicketSpoolEntry = { version: 1, spooledAt: deps.now().toISOString(), salesEmailedAt: null, record: ticket };
  let spooled = false;
  try {
    spooled = deps.spool(entry);
  } catch {
    spooled = false;
  }

  let deskEmailed = false;
  try {
    deskEmailed = await deps.emailDesk(ticket);
  } catch (error: any) {
    console.warn("[desk-fallback] Desk inbox email failed:", error?.message || error);
  }
  if (spooled && deskEmailed) {
    // Desk has it by email now: the replay worker must not create it again by API.
    deps.updateSpool({ ...entry, record: { ...ticket, deskEmailedAt: deps.now().toISOString() } });
  }

  const accepted = spooled || deskEmailed;
  let clientAcknowledged = false;
  if (accepted && options.acknowledge !== false) {
    try {
      clientAcknowledged = await deps.acknowledgeClient(ticket);
    } catch (error: any) {
      console.warn("[desk-fallback] client acknowledgement failed:", error?.message || error);
    }
  }
  try {
    await deps.alertStaff(ticket);
  } catch {
    // The alert is a courtesy; the ticket is what matters.
  }

  console.warn("[desk-fallback] ticket saved outside the Desk API", {
    reference: ticket.reference,
    source: ticket.source,
    reason: ticket.reason,
    spooled,
    deskEmailed,
    clientAcknowledged,
  });
  return { accepted, spooled, deskEmailed, clientAcknowledged };
}
