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
 * /api/zoho/desk/status hung for nine hours. On timeout pg rejects the query
 * and pg-pool destroys the client, so the next query opens a fresh connection
 * instead of inheriting the dead one. Migrations run on their own client
 * (scripts/run-migrations.mjs) and are not capped here.
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
