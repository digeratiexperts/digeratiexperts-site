/**
 * Liveness and readiness for the public site.
 *
 * /healthz and /ready are what deploy and uptime checks treat as pass/fail.
 * A process that is up but cannot open Postgres must fail those probes.
 * /api/health stays a 200 diagnostic so the services map is still readable.
 *
 * CI's production smoke boots without a database and sets
 * DE_SMOKE_ALLOW_MEMORY_ONLY=1. That flag is the only pass. Production deploy
 * does not set it.
 */
import { withDeadline } from "./withDeadline";

export function memoryOnlySmokeAllowed(): boolean {
  return process.env.DE_SMOKE_ALLOW_MEMORY_ONLY === "1";
}

/** 200 only when Postgres accepted a connection, or the CI memory-only smoke is explicit. */
export function probeStatus(databaseUp: boolean): 200 | 503 {
  if (memoryOnlySmokeAllowed() || databaseUp) return 200;
  return 503;
}

type ProbeClient = {
  release(error?: Error): void;
  query?(text: string): Promise<unknown>;
};

type DbProbeModule = {
  pool: { connect(): Promise<ProbeClient> } | null;
  reconnectDatabase(): Promise<boolean>;
  markDatabaseDown?(reason: string): void;
};

/**
 * The whole probe (connect, SELECT 1) must finish inside this. deploy.sh
 * polls /healthz with a 5 s curl, the health workflow with 20 s; a probe that
 * takes longer than this is a failure, not a slow success.
 */
export const DB_PROBE_TIMEOUT_MS = 8_000;

/**
 * True when Postgres accepts a connection and answers a query. A process
 * whose boot-time connect failed (or whose pool was dropped) has no pool;
 * retry the connection here (throttled in db.ts) so a recovered database
 * turns the probe green without a restart. Before this, a brief database
 * stall during a deploy left /healthz at 503 for good, and both the release
 * and its rollback failed verification (2026-10-15, 00:38 UTC).
 *
 * A pool that exists but cannot answer within the deadline is worse than no
 * pool: it is marked down (db.ts) so the next probe reconnects instead of
 * handing out dead sockets. On 2026-10-20 the database dropped out from
 * under the running process and nothing ever retried (#657).
 */
export async function databaseAcceptsConnections(
  load: () => Promise<DbProbeModule> = () => import("./db") as unknown as Promise<DbProbeModule>,
  timeoutMs: number = DB_PROBE_TIMEOUT_MS,
): Promise<boolean> {
  let dbModule: DbProbeModule;
  try {
    dbModule = await load();
  } catch {
    return false;
  }
  try {
    if (!dbModule.pool && !(await dbModule.reconnectDatabase())) return false;
    // Read through the module so a pool created by the reconnect is seen.
    const pool = dbModule.pool;
    if (!pool) return false;
    const client = await withDeadline(pool.connect(), timeoutMs, "database connect");
    try {
      if (typeof client.query === "function") {
        await withDeadline(client.query("SELECT 1"), timeoutMs, "database probe query");
      }
    } catch (error) {
      // Release with the error so the pool destroys this client instead of
      // returning a dead socket to the next caller.
      client.release(error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
    client.release();
    return true;
  } catch (error) {
    if (dbModule.pool && typeof dbModule.markDatabaseDown === "function") {
      dbModule.markDatabaseDown(`health probe: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}
