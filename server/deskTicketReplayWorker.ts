/**
 * Replays DE Desk tickets that were saved outside the Desk API
 * (server/deskTicketFallback.ts) once the API takes tickets again.
 *
 * Every minute in production:
 * - an entry that never reached the Desk inbox by email is created in Desk by
 *   API, then its spool file is deleted. The first refusal ends the tick: the
 *   API is still down, try again next minute.
 * - an entry that did reach the Desk inbox is already a Desk ticket. It is
 *   kept for a week as a record, then deleted, and never created again.
 * An entry waiting more than an hour is logged loudly.
 */
import { listSpoolEntries, deskTicketSpoolDir, removeSpoolEntry } from "./publicSolutionSpool";
import type { DeskTicketSpoolEntry, FallbackTicket } from "./deskTicketFallback";

const TICK_MS = 60_000;
const STALE_MS = 60 * 60_000;
const KEEP_EMAILED_MS = 7 * 24 * 60 * 60_000;

export type DeskReplayDeps = {
  list: () => DeskTicketSpoolEntry[];
  remove: (id: string) => void;
  /** Creates the ticket in Desk by API; throws when Desk refuses. Returns the Desk ticket number. */
  createInDesk: (ticket: FallbackTicket) => Promise<string>;
  now: () => number;
};

function splitName(name: string | undefined, email: string): { firstName?: string; lastName: string } {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { lastName: email.split("@")[0] || "Website visitor" };
  if (parts.length === 1) return { lastName: parts[0] };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

const defaultDeps: DeskReplayDeps = {
  list: () => listSpoolEntries<FallbackTicket>(deskTicketSpoolDir()),
  remove: (id) => removeSpoolEntry(id, deskTicketSpoolDir()),
  createInDesk: async (ticket) => {
    const { zohoClient, zohoDeskService } = await import("./zoho");
    if (!zohoClient.isDeskConfigured()) throw new Error("Zoho Desk not configured");
    const created = await zohoDeskService.createTicket({
      source: ticket.source,
      subject: ticket.subject,
      description: `${ticket.description}\n\n---\nWebsite reference ${ticket.reference} (received ${ticket.createdAt}, replayed after a Desk API outage).`,
      email: ticket.email,
      ...splitName(ticket.name, ticket.email),
      priority: ticket.priority,
    });
    if (typeof created?.id !== "string" || !created.id) throw new Error("Zoho Desk returned no ticket id");
    return created.ticketNumber || created.id;
  },
  now: () => Date.now(),
};

export async function replaySpooledDeskTickets(
  deps: DeskReplayDeps = defaultDeps,
): Promise<{ replayed: number; expired: number; waiting: number }> {
  const entries = deps.list();
  let replayed = 0;
  let expired = 0;
  let waiting = 0;

  for (const entry of entries) {
    const ticket = entry.record;
    if (ticket.deskEmailedAt) {
      if (deps.now() - Date.parse(entry.spooledAt) > KEEP_EMAILED_MS) {
        deps.remove(ticket.id);
        expired += 1;
      }
      continue;
    }
    try {
      const number = await deps.createInDesk(ticket);
      deps.remove(ticket.id);
      replayed += 1;
      console.info("[desk-replay] ticket created in Zoho Desk", { reference: ticket.reference, ticketNumber: number });
    } catch (error: any) {
      // Desk is still refusing: stop here and try again next tick.
      waiting = entries.filter((e) => !e.record.deskEmailedAt).length - replayed;
      if (deps.now() - Date.parse(entry.spooledAt) > STALE_MS) {
        console.error("[desk-replay] ticket waiting over an hour for the Desk API", {
          reference: ticket.reference,
          reason: error?.message ? "desk_refused" : "unknown",
        });
      }
      break;
    }
  }
  return { replayed, expired, waiting };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startDeskTicketReplayWorker(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void replaySpooledDeskTickets()
      .then(({ replayed, waiting }) => {
        if (replayed) console.info("[desk-replay] replayed spooled tickets", { replayed, waiting });
      })
      .catch((error) => console.error("[desk-replay] tick failed:", error?.message || error))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
