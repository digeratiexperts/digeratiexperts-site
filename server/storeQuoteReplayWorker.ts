/**
 * Recovery for store quote requests saved outside the database (#240).
 *
 * At boot and every minute, while Postgres is reachable, each quote spool
 * entry is written into store_quote_requests (insert, ignored if the id is
 * already there), the CRM record is created if it was not at submit, and
 * QUOTE_REQUESTED goes out so the Hub outbox gets the quote. The spool file is
 * updated after each step and deleted only once the row is committed and the
 * follow-ups are done, so a crash mid-way repeats a step at most.
 */
import { eventBus, EventTypes } from "./eventBus";
import { listSpoolEntries, quoteSpoolDir, removeSpoolEntry, updateSpoolEntry } from "./publicSolutionSpool";
import {
  defaultQuoteFallbackDeps,
  quoteRequestedEvent,
  type QuoteSpoolEntry,
  type SpooledQuote,
} from "./storeQuoteFallback";
import { persistSpooledQuoteRequest } from "./storeQuoteStore";

const TICK_MS = 60_000;
const STALE_MS = 60 * 60_000;

export type QuoteReplayDeps = {
  persist: (quote: SpooledQuote["quote"]) => Promise<boolean>;
  syncCrm: (record: SpooledQuote) => Promise<boolean>;
  emitQuote: (payload: ReturnType<typeof quoteRequestedEvent>) => void;
  list: () => QuoteSpoolEntry[];
  update: (entry: QuoteSpoolEntry) => boolean;
  remove: (id: string) => void;
  now: () => number;
};

const defaultDeps: QuoteReplayDeps = {
  persist: persistSpooledQuoteRequest,
  syncCrm: defaultQuoteFallbackDeps.syncCrm,
  emitQuote: (payload) => void eventBus.emit(EventTypes.QUOTE_REQUESTED, payload),
  list: () => listSpoolEntries<SpooledQuote>(quoteSpoolDir()),
  update: (entry) => updateSpoolEntry(entry, quoteSpoolDir()),
  remove: (id) => removeSpoolEntry(id, quoteSpoolDir()),
  now: () => Date.now(),
};

type ProgressEntry = QuoteSpoolEntry & { recoveredAt?: string; eventSentAt?: string };

export async function replaySpooledQuoteRequests(
  deps: QuoteReplayDeps = defaultDeps,
): Promise<{ recovered: number; waiting: number }> {
  const entries = deps.list() as ProgressEntry[];
  if (entries.length === 0) return { recovered: 0, waiting: 0 };

  for (const entry of entries) {
    if (deps.now() - Date.parse(entry.spooledAt) > STALE_MS && !entry.recoveredAt) {
      console.error("[quote-replay] spooled quote request waiting over an hour", {
        id: entry.record.id,
        quoteNumber: entry.record.quote.quoteNumber,
      });
    }
  }

  let recovered = 0;
  for (const original of entries) {
    let entry: ProgressEntry = original;
    // False when the database is still down (or went away again): try next tick.
    if (!(await deps.persist(entry.record.quote))) break;
    entry = { ...entry, recoveredAt: entry.recoveredAt ?? new Date(deps.now()).toISOString() };
    deps.update(entry);

    if (!entry.record.crmRecorded) {
      try {
        if (await deps.syncCrm(entry.record)) {
          entry = { ...entry, record: { ...entry.record, crmRecorded: true } };
          deps.update(entry);
        }
      } catch (error: any) {
        console.warn("[quote-replay] CRM sync skipped:", error?.message || error);
      }
    }

    if (!entry.eventSentAt) {
      deps.emitQuote(
        quoteRequestedEvent(entry.record.quote, {
          canonicalAccountId: entry.record.canonicalAccountId,
          portalClientId: entry.record.portalClientId,
        }),
      );
      entry = { ...entry, eventSentAt: new Date(deps.now()).toISOString() };
      deps.update(entry);
    }

    deps.remove(entry.record.id);
    recovered += 1;
  }
  return { recovered, waiting: entries.length - recovered };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startQuoteReplayWorker(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void replaySpooledQuoteRequests()
      .then(({ recovered, waiting }) => {
        if (recovered) console.info("[quote-replay] recovered spooled quote requests", { recovered, waiting });
      })
      .catch((error) => console.error("[quote-replay] tick failed:", error?.message || error))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
