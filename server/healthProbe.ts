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

export function memoryOnlySmokeAllowed(): boolean {
  return process.env.DE_SMOKE_ALLOW_MEMORY_ONLY === "1";
}

/** 200 only when Postgres accepted a connection, or the CI memory-only smoke is explicit. */
export function probeStatus(databaseUp: boolean): 200 | 503 {
  if (memoryOnlySmokeAllowed() || databaseUp) return 200;
  return 503;
}

type DbProbeModule = {
  pool: { connect(): Promise<{ release(): void }> } | null;
  reconnectDatabase(): Promise<boolean>;
};

/**
 * True when Postgres accepts a connection. A process whose boot-time connect
 * failed (or whose pool was dropped) has no pool; retry the connection here
 * (throttled in db.ts) so a recovered database turns the probe green without
 * a restart. Before this, a brief database stall during a deploy left /healthz
 * at 503 for good, and both the release and its rollback failed verification
 * (2026-10-15, 00:38 UTC).
 */
export async function databaseAcceptsConnections(
  load: () => Promise<DbProbeModule> = () => import("./db") as unknown as Promise<DbProbeModule>,
): Promise<boolean> {
  try {
    const dbModule = await load();
    if (!dbModule.pool && !(await dbModule.reconnectDatabase())) return false;
    // Read through the module so a pool created by the reconnect is seen.
    const pool = dbModule.pool;
    if (!pool) return false;
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}
