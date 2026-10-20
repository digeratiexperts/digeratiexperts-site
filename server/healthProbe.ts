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

type ProbeClient = {
  release(error?: Error): void;
  query(text: string): Promise<unknown>;
};

type DbProbeModule = {
  pool: { connect(): Promise<ProbeClient> } | null;
  reconnectDatabase(): Promise<boolean>;
  markDatabaseDown?(reason: string): void;
};

/** A probe that never answers is an outage nobody can see; bound it. */
export const PROBE_TIMEOUT_MS = 5_000;

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`database probe timed out after ${ms}ms`)), ms);
    work.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * One connection, one round trip, one deadline for both. pg-pool hands an idle
 * client back with no socket I/O, so a connect alone can "succeed" on a socket
 * the server has already dropped; SELECT 1 proves the link (#657). A client
 * that fails, or that only arrives after the probe stopped waiting, is
 * released with an error so pg-pool destroys it instead of handing a dead
 * socket to the next caller.
 */
async function connectOnce(pool: NonNullable<DbProbeModule["pool"]>, timeoutMs: number): Promise<boolean> {
  let client: ProbeClient | undefined;
  let gaveUp = false;
  const asError = (error: unknown) => (error instanceof Error ? error : new Error(String(error)));
  const work = (async () => {
    const connected = await pool.connect();
    if (gaveUp) {
      connected.release(new Error(`database probe: connection arrived after the ${timeoutMs}ms deadline`));
      return;
    }
    client = connected;
    await connected.query("SELECT 1");
  })();
  try {
    await withTimeout(work, timeoutMs);
  } catch (error) {
    gaveUp = true;
    client?.release(asError(error));
    throw error;
  }
  client?.release();
  return true;
}

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
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<boolean> {
  try {
    const dbModule = await load();
    if (!dbModule.pool && !(await dbModule.reconnectDatabase())) return false;
    // Read through the module so a pool created by the reconnect is seen.
    const pool = dbModule.pool;
    if (!pool) return false;
    try {
      return await connectOnce(pool, timeoutMs);
    } catch (error) {
      // The pool existed and could not hand out a connection: Postgres went
      // away after boot. Drop the dead pool so the (throttled) reconnect can
      // rebuild it, and try that once now rather than leaving the process at
      // 503 until a restart (2026-10-20, nine hours).
      const message = error instanceof Error ? error.message : String(error);
      dbModule.markDatabaseDown?.(message);
      if (!(await dbModule.reconnectDatabase())) return false;
      const rebuilt = dbModule.pool;
      if (!rebuilt) return false;
      return await connectOnce(rebuilt, timeoutMs);
    }
  } catch {
    return false;
  }
}
