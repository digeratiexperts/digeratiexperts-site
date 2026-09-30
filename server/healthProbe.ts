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

export async function databaseAcceptsConnections(): Promise<boolean> {
  try {
    const { pool } = await import("./db");
    if (!pool) return false;
    const client = await pool.connect();
    client.release();
    return true;
  } catch {
    return false;
  }
}
