import type { PublicSolutionRequest } from "./publicSolutionRequestStore";
import { initPromise, pool } from "./db";

/**
 * Durable Save Progress for the public Solution Builder (#120).
 *
 * Schema is owned by migrations/0003_public_solution_requests.sql (#253),
 * applied by `npm run db:migrate` before a release is activated. This module
 * only *verifies* the table exists; it never issues DDL, so the runtime
 * credentials need no CREATE privilege and the migration ledger stays the
 * single record of what exists. If the table is missing the feature reports
 * durable persistence unavailable rather than creating schema behind the
 * ledger's back. The whole record is stored as one JSONB payload (not
 * normalized columns) so adding
 * fields to PublicSolutionRequest later (as already happened twice this
 * project — selectedNeeds, then fulfillment) never requires a migration.
 *
 * Drafts expire after DRAFT_TTL_DAYS of inactivity. Submitted requests never
 * expire — they are the CRM handoff record of a real request DE received.
 */

const DRAFT_TTL_DAYS = 30;
const TABLE = "public_solution_requests";
let schemaVerified = false;
let schemaPromise: Promise<boolean> | null = null;

/** Verify (never create) the migrated table. Success is cached; failure is retried on the next call. */
async function ensureSchema(): Promise<boolean> {
  if (!process.env.DATABASE_URL) return false;
  const ready = await initPromise;
  if (!ready || !pool) return false;
  if (schemaVerified) return true;
  if (!schemaPromise) {
    const activePool = pool;
    schemaPromise = (async () => {
      const result = await activePool.query(`SELECT to_regclass($1) AS present`, [`public.${TABLE}`]);
      const present = Boolean(result.rows[0]?.present);
      if (!present) {
        console.error(
          `[solution-request] required table ${TABLE} is missing; run \`npm run db:migrate\` (migrations/0003_public_solution_requests.sql). Durable persistence disabled.`,
        );
      }
      schemaVerified = present;
      return present;
    })()
      .catch((error: any) => {
        console.warn("[solution-request] durable persistence unavailable:", error?.message || error);
        return false;
      })
      .finally(() => {
        schemaPromise = null;
      });
  }
  return schemaPromise;
}

function expiryFor(record: PublicSolutionRequest): Date | null {
  if (record.status === "submitted") return null;
  const base = new Date(record.updatedAt).getTime();
  return new Date(base + DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function parseRecord(value: unknown): PublicSolutionRequest | null {
  if (!value || typeof value !== "object") return null;
  const record = value as PublicSolutionRequest;
  if (!record.id || !record.sessionId || !record.updatedAt || !record.status) return null;
  // Rows written before references existed.
  if (typeof record.reference !== "string") record.reference = null;
  if (record.durable !== "database" && record.durable !== "crm" && record.durable !== "memory") record.durable = null;
  if (record.suggestion === undefined) record.suggestion = null;
  return record;
}

/** Whether Postgres is available for public drafts right now; what "Saved to DE" may honestly claim. */
export async function durablePersistenceAvailable(): Promise<boolean> {
  return ensureSchema();
}

/** Write-through. Never throws — a persistence failure must not break the in-memory save. */
export async function persistPublicSolutionRequest(record: PublicSolutionRequest): Promise<boolean> {
  const enabled = await ensureSchema();
  if (!enabled || !pool) return false;
  try {
    await pool.query(
      `INSERT INTO public_solution_requests
        (id, session_id, status, payload, created_at, updated_at, expires_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET
         session_id = EXCLUDED.session_id,
         status = EXCLUDED.status,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at,
         expires_at = EXCLUDED.expires_at`,
      [
        record.id,
        record.sessionId,
        record.status,
        JSON.stringify(record),
        record.createdAt,
        record.updatedAt,
        expiryFor(record),
      ],
    );
    return true;
  } catch (error: any) {
    console.warn("[solution-request] durable persist skipped:", error?.message || error);
    return false;
  }
}

async function deleteExpiredDrafts(): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(`DELETE FROM public_solution_requests WHERE status = 'draft' AND expires_at < now()`);
  } catch (error: any) {
    console.warn("[solution-request] expired-draft cleanup skipped:", error?.message || error);
  }
}

/** Cross-device / restart continuation for an anonymous visitor's session cookie. */
export async function loadPublicSolutionRequestBySession(sessionId: string): Promise<PublicSolutionRequest | null> {
  const enabled = await ensureSchema();
  if (!enabled || !pool) return null;
  await deleteExpiredDrafts();
  try {
    const result = await pool.query(
      `SELECT payload
         FROM public_solution_requests
        WHERE session_id = $1
          AND (status = 'submitted' OR expires_at >= now())
        ORDER BY updated_at DESC
        LIMIT 1`,
      [sessionId],
    );
    return parseRecord(result.rows[0]?.payload);
  } catch (error: any) {
    console.warn("[solution-request] durable load skipped:", error?.message || error);
    return null;
  }
}

/**
 * Continuation by the draft's own id — the "safe anonymous draft identifier"
 * required by #120. The id is a random UUID (unguessable), so possession of
 * it is the same trust model as a Stripe Checkout link or a Calendly
 * reschedule link: whoever has the id/link can resume that one draft, and
 * nothing else. This is what lets a visitor pick up a saved draft from a
 * different browser or device without an account.
 */
export async function loadPublicSolutionRequestById(id: string): Promise<PublicSolutionRequest | null> {
  const enabled = await ensureSchema();
  if (!enabled || !pool) return null;
  await deleteExpiredDrafts();
  try {
    const result = await pool.query(
      `SELECT payload
         FROM public_solution_requests
        WHERE id = $1
          AND (status = 'submitted' OR expires_at >= now())
        LIMIT 1`,
      [id],
    );
    return parseRecord(result.rows[0]?.payload);
  } catch (error: any) {
    console.warn("[solution-request] durable load-by-id skipped:", error?.message || error);
    return null;
  }
}

/** A submitted solution by its short human reference. */
export async function loadPublicSolutionRequestByReference(reference: string): Promise<PublicSolutionRequest | null> {
  const enabled = await ensureSchema();
  if (!enabled || !pool) return null;
  try {
    const result = await pool.query(
      `SELECT payload
         FROM public_solution_requests
        WHERE status = 'submitted'
          AND payload->>'reference' = $1
        ORDER BY updated_at DESC
        LIMIT 1`,
      [reference],
    );
    return parseRecord(result.rows[0]?.payload);
  } catch (error: any) {
    console.warn("[solution-request] durable load-by-reference skipped:", error?.message || error);
    return null;
  }
}

/** Test helper only — not used by routes. */
export async function deletePublicSolutionRequestForTests(id: string): Promise<void> {
  if (!process.env.DATABASE_URL || !pool) return;
  const enabled = await ensureSchema();
  if (!enabled) return;
  try {
    await pool.query(`DELETE FROM public_solution_requests WHERE id = $1`, [id]);
  } catch {
    /* best-effort cleanup */
  }
}
