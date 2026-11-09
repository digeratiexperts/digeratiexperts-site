/**
 * Automatic retention for store and solution submissions that never became a
 * sale (Joe, 2026-11-09: "Keep PII from store submissions that never became a
 * sale for 2 years, then delete it automatically, with every deletion logged").
 *
 * This is an AUTOMATIC deletion path, so it is DE's action, not a person's
 * manual move (AGENTS.md, storage provisioning). It is:
 *  - deny-by-default: rows are deleted only when STORE_PII_RETENTION_DELETE_ENABLED
 *    is exactly "true". Any other value, or no value, is dry-run and deletes nothing.
 *  - classify-before-act: a row is deleted only when every sale signal is
 *    positively "no" and the submission is older than two years (see classifyForRetention).
 *    Any unknown signal keeps the row (fail closed).
 *  - re-checked in SQL at delete time, so a row that gained an order or a
 *    client link after it was listed is not deleted.
 *  - audited: one log line per deletion, with the record id, table, class, age and
 *    time. Logs never carry contact fields, names, notes or references.
 *  - never throwing: every failure is logged and the run continues.
 *
 * Scope: public_solution_requests (submitted solutions) and store_quote_requests.
 * Solution spool files (publicSolutionSpool) are replayed within minutes and are
 * not covered here.
 */
import { initPromise, pool } from "./db";

export const RETENTION_FLAG = "STORE_PII_RETENTION_DELETE_ENABLED";
export const RETENTION_YEARS = 2;

const TICK_MS = 60 * 60_000;
const FIRST_RUN_MS = 5 * 60_000;
const BATCH_LIMIT = 500;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RetentionTable = "public_solution_requests" | "store_quote_requests";
export const RETENTION_TABLES: readonly RetentionTable[] = ["public_solution_requests", "store_quote_requests"];

/**
 * Statuses that may be eligible, per table. Anything else (for example a quote
 * "converted" to an order) is kept. A solution's "submitted" status is every
 * submitted solution, so it says nothing about a sale on its own; the sale
 * evidence below decides.
 */
const ELIGIBLE_STATUSES: Record<RetentionTable, readonly string[]> = {
  public_solution_requests: ["submitted"],
  store_quote_requests: ["pending", "contacted", "quoted", "declined"],
};

/**
 * Tri-state sale evidence. Only `false` is a positive "no". `true` means a sale
 * signal is present. `null` means the data cannot tell (for example, no column
 * links the record to an order), and null keeps the record.
 */
export type SaleEvidence = {
  /** A client or portal account is tied to the record. */
  clientLinked: boolean | null;
  /** An order exists for the record (a converted quote, or an order with the same billing email). */
  orderLinked: boolean | null;
  /** A payment is recorded against that order. */
  paymentRecorded: boolean | null;
  /** A Zoho deal closed as won. Not checked by this job unless a checker is injected. */
  zohoDealWon: boolean | null;
};

export type RetentionCandidate = {
  table: RetentionTable;
  id: string;
  status: string;
  /** The submission timestamp used for age. Null when the database value cannot be read. */
  submittedAt: Date | null;
  evidence: SaleEvidence;
};

export type KeepReason =
  | "status_not_eligible"
  | "sale_recorded"
  | "sale_unknown"
  | "no_submission_time"
  | "too_recent";

export type Classification = { eligible: true } | { eligible: false; reason: KeepReason };

/** The cutoff: a submission is eligible only when strictly older than this instant. */
export function retentionCutoff(now: Date): Date {
  const cutoff = new Date(now.getTime());
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - RETENTION_YEARS);
  return cutoff;
}

/**
 * Eligible only when ALL of these hold, otherwise the record is kept:
 *  1. its status is one that never meant a sale for that table;
 *  2. every sale signal is positively false (clientLinked, orderLinked,
 *     paymentRecorded, zohoDealWon). A true signal is a sale; a null signal is unproven;
 *  3. the submission time is readable and strictly before the two-year cutoff.
 */
export function classifyForRetention(candidate: RetentionCandidate, cutoff: Date): Classification {
  if (!ELIGIBLE_STATUSES[candidate.table].includes(candidate.status)) {
    return { eligible: false, reason: "status_not_eligible" };
  }
  const signals = Object.values(candidate.evidence);
  if (signals.some((signal) => signal === true)) return { eligible: false, reason: "sale_recorded" };
  if (signals.some((signal) => signal !== false)) return { eligible: false, reason: "sale_unknown" };
  const at = candidate.submittedAt;
  if (!at || Number.isNaN(at.getTime())) return { eligible: false, reason: "no_submission_time" };
  if (at.getTime() >= cutoff.getTime()) return { eligible: false, reason: "too_recent" };
  return { eligible: true };
}

/** Deny-by-default: only the exact value "true" enables deletion. */
export function retentionDeleteEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[RETENTION_FLAG] === "true";
}

export type RetentionLogLine = Record<string, string | number | boolean | null>;

export type RetentionDeps = {
  enabled: () => boolean;
  available: () => Promise<boolean>;
  listCandidates: (table: RetentionTable, cutoff: Date) => Promise<RetentionCandidate[]>;
  /** Looks for a Zoho deal closed as won. Default: unknown (null), because this job makes no Zoho call. */
  zohoDealWon: (candidate: RetentionCandidate) => Promise<boolean | null>;
  /** Deletes the row only if it still matches the eligibility guard. Returns true when a row was deleted. */
  deleteRecord: (table: RetentionTable, id: string, cutoff: Date) => Promise<boolean>;
  log: (line: RetentionLogLine) => void;
  now: () => Date;
};

export type RetentionRunSummary = {
  mode: "dry_run" | "delete";
  skipped: boolean;
  scanned: number;
  eligible: number;
  deleted: number;
  errors: number;
  kept: Partial<Record<KeepReason | "changed_since_scan", number>>;
};

const defaultDeps: RetentionDeps = {
  enabled: () => retentionDeleteEnabled(),
  available: async () => {
    const ready = await initPromise;
    return Boolean(ready && pool);
  },
  listCandidates: (table, cutoff) => listRetentionCandidates(table, cutoff),
  zohoDealWon: async () => null,
  deleteRecord: (table, id, cutoff) => deleteRetentionRecord(table, id, cutoff),
  log: (line) => console.info(`[store-retention] ${JSON.stringify(line)}`),
  now: () => new Date(),
};

function ageDays(at: Date | null, now: Date): number | null {
  if (!at || Number.isNaN(at.getTime())) return null;
  return Math.floor((now.getTime() - at.getTime()) / DAY_MS);
}

/**
 * One pass over both tables. Never throws. Returns a summary and logs one line
 * per deletion (or per would-be deletion in dry-run), plus one run summary line.
 */
export async function runStoreRetention(deps: RetentionDeps = defaultDeps): Promise<RetentionRunSummary> {
  const summary: RetentionRunSummary = {
    mode: "dry_run",
    skipped: false,
    scanned: 0,
    eligible: 0,
    deleted: 0,
    errors: 0,
    kept: {},
  };
  try {
    summary.mode = deps.enabled() ? "delete" : "dry_run";
    if (!(await deps.available())) {
      summary.skipped = true;
      deps.log({ event: "store_retention_skipped", reason: "database_unavailable", mode: summary.mode });
      return summary;
    }
    const now = deps.now();
    const cutoff = retentionCutoff(now);

    for (const table of RETENTION_TABLES) {
      let candidates: RetentionCandidate[];
      try {
        candidates = await deps.listCandidates(table, cutoff);
      } catch (error: any) {
        summary.errors += 1;
        deps.log({ event: "store_retention_error", table, stage: "list", code: error?.code ?? null });
        continue;
      }

      for (const candidate of candidates) {
        summary.scanned += 1;
        try {
          candidate.evidence.zohoDealWon = await Promise.resolve()
            .then(() => deps.zohoDealWon(candidate))
            .catch(() => null);

          const verdict = classifyForRetention(candidate, cutoff);
          if (!verdict.eligible) {
            summary.kept[verdict.reason] = (summary.kept[verdict.reason] ?? 0) + 1;
            continue;
          }
          summary.eligible += 1;
          const base = {
            table,
            id: candidate.id,
            class: `${table}:non_sale`,
            age_days: ageDays(candidate.submittedAt, now),
          };

          if (summary.mode === "dry_run") {
            deps.log({ event: "store_retention_would_delete", dry_run: true, at: now.toISOString(), ...base });
            continue;
          }

          const deleted = await deps.deleteRecord(table, candidate.id, cutoff);
          if (!deleted) {
            summary.kept.changed_since_scan = (summary.kept.changed_since_scan ?? 0) + 1;
            continue;
          }
          summary.deleted += 1;
          deps.log({ event: "store_retention_deleted", at: deps.now().toISOString(), ...base });
        } catch (error: any) {
          summary.errors += 1;
          deps.log({ event: "store_retention_error", table, id: candidate.id, stage: "record", code: error?.code ?? null });
        }
      }
    }
  } catch (error: any) {
    summary.errors += 1;
    deps.log({ event: "store_retention_error", stage: "run", code: error?.code ?? null });
  }
  deps.log({
    event: "store_retention_run",
    mode: summary.mode,
    scanned: summary.scanned,
    eligible: summary.eligible,
    deleted: summary.deleted,
    errors: summary.errors,
    kept_status: summary.kept.status_not_eligible ?? 0,
    kept_sale_recorded: summary.kept.sale_recorded ?? 0,
    kept_sale_unknown: summary.kept.sale_unknown ?? 0,
    kept_recent: summary.kept.too_recent ?? 0,
    skipped: summary.skipped,
  });
  return summary;
}

/* ----------------------------- Postgres adapter ----------------------------- */

/**
 * Candidate rows, filtered by status and age in SQL. The classifier re-checks
 * everything, so this filter only narrows the scan.
 *
 * public_solution_requests has no column that links a submission to an order,
 * payment or client, so its sale evidence is always unknown (null) and nothing
 * in it is eligible until a link is defined. Its age is updated_at, which is set
 * at submit and moves later on any CRM update. That makes the age a lower
 * bound, so it deletes later, never earlier.
 *
 * store_quote_requests carries client_id, user_id and converted_order_id. Its
 * orders are matched by billing email, because store_orders has no quote link
 * other than converted_order_id.
 */
async function listRetentionCandidates(table: RetentionTable, cutoff: Date): Promise<RetentionCandidate[]> {
  if (!pool) return [];
  const statuses = ELIGIBLE_STATUSES[table];
  if (table === "public_solution_requests") {
    const result = await pool.query(
      `SELECT id, status, updated_at AS submitted_at
         FROM public_solution_requests
        WHERE status = ANY($1::text[]) AND updated_at < $2::timestamptz
        ORDER BY updated_at
        LIMIT ${BATCH_LIMIT}`,
      [statuses, cutoff.toISOString()],
    );
    return result.rows.map((row: any) => ({
      table,
      id: String(row.id),
      status: String(row.status),
      submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
      evidence: { clientLinked: null, orderLinked: null, paymentRecorded: null, zohoDealWon: null },
    }));
  }
  const result = await pool.query(
    `SELECT q.id, q.status, q.created_at AS submitted_at,
            (q.client_id IS NOT NULL OR q.user_id IS NOT NULL) AS client_linked,
            (q.converted_order_id IS NOT NULL OR EXISTS (
               SELECT 1 FROM store_orders o WHERE lower(o.billing_email) = lower(q.contact_email))) AS order_linked,
            EXISTS (
               SELECT 1 FROM store_orders o
                WHERE lower(o.billing_email) = lower(q.contact_email)
                  AND (o.paid_at IS NOT NULL OR o.zoho_payment_id IS NOT NULL)) AS payment_recorded
       FROM store_quote_requests q
      WHERE q.status = ANY($1::text[]) AND q.created_at < $2::timestamptz
      ORDER BY q.created_at
      LIMIT ${BATCH_LIMIT}`,
    [statuses, cutoff.toISOString()],
  );
  return result.rows.map((row: any) => ({
    table,
    id: String(row.id),
    status: String(row.status),
    submittedAt: row.submitted_at ? new Date(row.submitted_at) : null,
    evidence: {
      clientLinked: Boolean(row.client_linked),
      orderLinked: Boolean(row.order_linked),
      paymentRecorded: Boolean(row.payment_recorded),
      zohoDealWon: null,
    },
  }));
}

/** The same eligibility guard as the classifier, repeated in SQL so a row that changed since the scan is kept. */
async function deleteRetentionRecord(table: RetentionTable, id: string, cutoff: Date): Promise<boolean> {
  if (!pool) return false;
  const statuses = ELIGIBLE_STATUSES[table];
  if (table === "public_solution_requests") {
    const result = await pool.query(
      `DELETE FROM public_solution_requests
        WHERE id = $1 AND status = ANY($2::text[]) AND updated_at < $3::timestamptz`,
      [id, statuses, cutoff.toISOString()],
    );
    return (result.rowCount ?? 0) > 0;
  }
  const result = await pool.query(
    `DELETE FROM store_quote_requests q
      WHERE q.id = $1 AND q.status = ANY($2::text[]) AND q.created_at < $3::timestamptz
        AND q.client_id IS NULL AND q.user_id IS NULL AND q.converted_order_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM store_orders o WHERE lower(o.billing_email) = lower(q.contact_email))`,
    [id, statuses, cutoff.toISOString()],
  );
  return (result.rowCount ?? 0) > 0;
}

/* -------------------------------- Scheduler -------------------------------- */

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/** Hourly, after a short delay on boot. Reads the flag on every run. Never throws. */
export function startStoreRetentionWorker(deps: RetentionDeps = defaultDeps): void {
  if (timer) return;
  const tick = () => {
    if (running) return;
    running = true;
    void runStoreRetention(deps)
      .catch((error) => console.error("[store-retention] tick failed:", error?.message || error))
      .finally(() => {
        running = false;
      });
  };
  const first = setTimeout(tick, FIRST_RUN_MS);
  first.unref?.();
  timer = setInterval(tick, TICK_MS);
  timer.unref?.();
}
