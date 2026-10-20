/**
 * Pool settings shared by the Neon and node-postgres pools in db.ts, in one
 * place so a test can read them without importing db.ts (which connects on
 * import).
 */
export const DB_CONNECT_TIMEOUT_MS = 10_000;
export const DB_POOL_MAX = 5;

/**
 * Client-side cap on one query. node-postgres has none by default, so a query
 * sent on a socket the server silently dropped waits forever, and pg-pool
 * keeps that client checked out. 2026-10-19/20 (#657): after Postgres dropped
 * out from under the running process, the reads behind /api/health and
 * /api/zoho/desk/status hung for nine hours.
 *
 * What the cap does: pg rejects the query with "Query read timeout" and swaps
 * its callback for a no-op, but leaves the client wedged on that statement.
 * On the pool.query path (every drizzle db.execute, including the
 * zoho_oauth_tokens reads and writes) pg-pool releases with the error and
 * destroys the client, so the next query opens a fresh connection. A client
 * checked out with pool.connect() (drizzle db.transaction, ensureDeSyncSchema)
 * is released by its caller; released without the error it goes back to the
 * pool wedged, and the next query that draws it waits one more cap before
 * destroying it. Bounded either way: a minute or two, not hours. The Neon
 * bundle behaves the same. Migrations (scripts/run-migrations.mjs) and
 * scripts/ensure-de-sync-schema.mjs open their own clients and are not capped.
 */
export const DB_QUERY_TIMEOUT_MS = 30_000;

export function poolOptions(connectionString: string, kind: "neon" | "postgresql") {
  const shared = {
    connectionString,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
    max: DB_POOL_MAX,
    query_timeout: DB_QUERY_TIMEOUT_MS,
  };
  return kind === "neon" ? shared : { ...shared, idleTimeoutMillis: 30_000 };
}
