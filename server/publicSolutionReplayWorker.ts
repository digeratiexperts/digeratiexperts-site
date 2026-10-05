/**
 * Recovery for solution requests saved outside the database (#243).
 *
 * At boot and every minute, while Postgres is reachable, each spool entry is
 * written into the database (upsert by id), the CRM lead is created if it was
 * not recorded at submit, and the lead event goes out: the full LEAD_CREATED
 * (admin email + Hub outbox) when the fallback email never reached sales, or
 * the Hub outbox alone when it did. The spool file is updated after each step
 * and deleted only once the row is committed and the follow-ups are done, so a
 * crash mid-way repeats a step at most, never loses the request.
 */
import { eventBus, EventTypes } from "./eventBus";
import { enqueueWebsiteCommand } from "./integrations/enqueueWebsiteCommand";
import { solutionLeadEvent } from "./publicSolutionFallback";
import { syncPublicSolutionRequestToCrm } from "./publicSolutionRequestCrm";
import { durablePersistenceAvailable, persistPublicSolutionRequest } from "./publicSolutionRequestPersistence";
import { listSpoolEntries, removeSpoolEntry, updateSpoolEntry, type SpoolEntry } from "./publicSolutionSpool";

const TICK_MS = 60_000;
const STALE_MS = 60 * 60_000;

export type ReplayDeps = {
  dbAvailable: () => Promise<boolean>;
  persist: typeof persistPublicSolutionRequest;
  syncCrm: typeof syncPublicSolutionRequestToCrm;
  emitLead: (payload: ReturnType<typeof solutionLeadEvent>) => void;
  queueHub: (payload: ReturnType<typeof solutionLeadEvent>) => Promise<unknown>;
  list: () => SpoolEntry[];
  update: (entry: SpoolEntry) => boolean;
  remove: (id: string) => void;
  now: () => number;
};

const defaultDeps: ReplayDeps = {
  dbAvailable: durablePersistenceAvailable,
  persist: persistPublicSolutionRequest,
  syncCrm: syncPublicSolutionRequestToCrm,
  emitLead: (payload) => void eventBus.emit(EventTypes.LEAD_CREATED, payload),
  queueHub: (payload) => enqueueWebsiteCommand(payload),
  list: () => listSpoolEntries(),
  update: (entry) => updateSpoolEntry(entry),
  remove: (id) => removeSpoolEntry(id),
  now: () => Date.now(),
};

type ProgressEntry = SpoolEntry & { recoveredAt?: string; leadSentAt?: string };

export async function replaySpooledSolutionRequests(
  deps: ReplayDeps = defaultDeps,
): Promise<{ recovered: number; waiting: number }> {
  const entries = deps.list() as ProgressEntry[];
  if (entries.length === 0) return { recovered: 0, waiting: 0 };

  for (const entry of entries) {
    if (deps.now() - Date.parse(entry.spooledAt) > STALE_MS && !entry.recoveredAt) {
      console.error("[solution-replay] spooled request waiting over an hour", {
        id: entry.record.id,
        reference: entry.record.reference,
      });
    }
  }
  if (!(await deps.dbAvailable())) return { recovered: 0, waiting: entries.length };

  let recovered = 0;
  for (const original of entries) {
    let entry: ProgressEntry = { ...original, record: { ...original.record, durable: original.record.durable ?? "spool" } };
    if (!(await deps.persist(entry.record))) break; // The database went away again; try next tick.

    if (entry.record.crmStatus !== "recorded") {
      if ((await deps.syncCrm(entry.record)) === "recorded") {
        entry = { ...entry, record: { ...entry.record, crmStatus: "recorded" } };
        await deps.persist(entry.record);
      }
    }
    entry = { ...entry, recoveredAt: entry.recoveredAt ?? new Date(deps.now()).toISOString() };
    deps.update(entry);

    if (!entry.leadSentAt) {
      const payload = solutionLeadEvent(entry.record);
      if (entry.salesEmailedAt) await deps.queueHub(payload);
      else deps.emitLead(payload);
      entry = { ...entry, leadSentAt: new Date(deps.now()).toISOString() };
      deps.update(entry);
    }

    deps.remove(entry.record.id);
    recovered += 1;
  }
  return { recovered, waiting: entries.length - recovered };
}

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

export function startSolutionReplayWorker(): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void replaySpooledSolutionRequests()
      .then(({ recovered, waiting }) => {
        if (recovered) console.info("[solution-replay] recovered spooled requests", { recovered, waiting });
      })
      .catch((error) => console.error("[solution-replay] tick failed:", error?.message || error))
      .finally(() => {
        running = false;
      });
  };
  tick();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
