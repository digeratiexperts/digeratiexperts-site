import { initPromise, pool } from "../db";

const statements = [
  `ALTER TABLE portal_clients ADD COLUMN IF NOT EXISTS hub_account_id varchar`,
  `CREATE TABLE IF NOT EXISTS sync_outbox (
    id varchar PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    event_id varchar NOT NULL UNIQUE,
    event_type text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    source text NOT NULL,
    destination text NOT NULL,
    occurred_at timestamp NOT NULL,
    correlation_id varchar,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    canonical_account_id varchar,
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    attempt_count integer NOT NULL DEFAULT 0,
    next_attempt_at timestamp NOT NULL,
    last_error text,
    locked_at timestamp,
    created_at timestamp NOT NULL DEFAULT now(),
    delivered_at timestamp
  )`,
  `CREATE INDEX IF NOT EXISTS sync_outbox_delivery_idx
    ON sync_outbox (status, next_attempt_at)`,
  `CREATE INDEX IF NOT EXISTS sync_outbox_locked_idx
    ON sync_outbox (status, locked_at)`,
  `CREATE TABLE IF NOT EXISTS sync_inbox (
    id varchar PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    event_id varchar NOT NULL UNIQUE,
    event_type text NOT NULL,
    source text NOT NULL,
    canonical_account_id varchar,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamp NOT NULL DEFAULT now(),
    applied_at timestamp
  )`,
  `CREATE TABLE IF NOT EXISTS sync_failures (
    id varchar PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    event_id varchar NOT NULL,
    direction text NOT NULL,
    event_type text NOT NULL,
    last_error text NOT NULL,
    attempt_count integer NOT NULL DEFAULT 0,
    payload jsonb,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS sync_failures_event_idx
    ON sync_failures (event_id)`,
  `CREATE TABLE IF NOT EXISTS sync_conflicts (
    id varchar PRIMARY KEY DEFAULT (gen_random_uuid()::text),
    canonical_account_id varchar,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    field text NOT NULL,
    hub_value jsonb,
    peer_value jsonb,
    resolution text NOT NULL DEFAULT 'hub_wins',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS public_catalog_snapshots (
    id varchar PRIMARY KEY,
    snapshot jsonb NOT NULL,
    source_version text,
    published_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sync_projections (
    id varchar PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id text NOT NULL,
    canonical_account_id varchar,
    event_type text NOT NULL,
    event_id varchar NOT NULL,
    payload jsonb NOT NULL,
    updated_at timestamp NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sync_projections_account_idx
    ON sync_projections (canonical_account_id)`,
];

let schemaPromise: Promise<void> | null = null;

async function runBootstrap(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  const ready = await initPromise;
  if (!ready || !pool) {
    throw new Error("DATABASE_URL is configured but the database is unavailable for DE sync bootstrap");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const statement of statements) {
      await client.query(statement);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Narrow, additive bootstrap for the Site side of the DE integration bus.
 *
 * This deliberately does NOT run drizzle-kit push. It creates only the tables
 * and column owned by the integration bus. The promise is shared by all inbound
 * routes and the outbound worker so no request can race table creation.
 */
export function ensureDeSyncSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = runBootstrap().catch((error) => {
      // Allow a later request/worker tick to retry after a transient DB outage.
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}
