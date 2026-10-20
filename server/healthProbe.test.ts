import { afterEach, describe, expect, it, vi } from "vitest";
import { databaseAcceptsConnections, memoryOnlySmokeAllowed, probeStatus } from "./healthProbe";

const ORIGINAL = process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;

afterEach(() => {
  vi.useRealTimers();
  if (ORIGINAL === undefined) delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
  else process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = ORIGINAL;
});

const okQuery = async () => ({ rows: [{ "?column?": 1 }] });

describe("health probes", () => {
  it("fails when Postgres is down", () => {
    delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    expect(memoryOnlySmokeAllowed()).toBe(false);
    expect(probeStatus(false)).toBe(503);
  });

  it("passes when Postgres accepts a connection", () => {
    delete process.env.DE_SMOKE_ALLOW_MEMORY_ONLY;
    expect(probeStatus(true)).toBe(200);
  });

  it("passes a memory-only CI smoke only when that flag is exactly 1", () => {
    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "1";
    expect(probeStatus(false)).toBe(200);

    process.env.DE_SMOKE_ALLOW_MEMORY_ONLY = "true";
    expect(probeStatus(false)).toBe(503);
  });

  it("retries the database connection when the boot-time connect left no pool", async () => {
    const released: string[] = [];
    const mod: any = {
      pool: null,
      reconnectDatabase: async () => {
        mod.pool = { connect: async () => ({ release: () => released.push("ok"), query: okQuery }) };
        return true;
      },
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(released).toEqual(["ok"]);
  });

  it("stays down when the reconnect also fails", async () => {
    let attempts = 0;
    const mod = { pool: null, reconnectDatabase: async () => (attempts++, false) };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(attempts).toBe(1);
  });

  it("drops a pool that died after boot and rebuilds it, instead of staying at 503 until a restart", async () => {
    // 2026-10-20: the live pool lost Neon; dbReady stayed true, reconnect
    // short-circuited, /healthz read 503 for nine hours.
    const log: string[] = [];
    const mod: any = {
      pool: { connect: async () => { throw new Error("Connection terminated unexpectedly"); } },
      markDatabaseDown: (reason: string) => { log.push(`down:${reason}`); mod.pool = null; },
      reconnectDatabase: async () => {
        log.push("reconnect");
        mod.pool = { connect: async () => ({ release: () => log.push("released"), query: okQuery }) };
        return true;
      },
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(log).toEqual(["down:Connection terminated unexpectedly", "reconnect", "released"]);
  });

  it("stays down, pool dropped, when the rebuild also fails", async () => {
    const mod: any = {
      pool: { connect: async () => { throw new Error("endpoint has been disabled"); } },
      markDatabaseDown: () => { mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(mod.pool).toBeNull();
  });

  it("answers false within the timeout when a connect never settles, so /healthz cannot hang", async () => {
    let marked = false;
    const mod: any = {
      pool: { connect: () => new Promise(() => {}) },
      markDatabaseDown: () => { marked = true; mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    const started = Date.now();
    expect(await databaseAcceptsConnections(async () => mod, 50)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(marked).toBe(true);
  });

  // 2026-10-20 (#657, ported from PR 659): a pooled client that connected before
  // the database went away is handed back with no socket I/O, so the probe
  // must run a query, and must destroy the client when that query fails.
  it("runs a query on the pooled client and releases a failing one with the error", async () => {
    const releasedWith: unknown[] = [];
    const downReasons: string[] = [];
    const mod = {
      pool: {
        connect: async () => ({
          release: (error?: Error) => releasedWith.push(error),
          query: async () => { throw new Error("Connection terminated unexpectedly"); },
        }),
      },
      // The rebuilt pool is the same failing mock, so the second attempt fails too.
      reconnectDatabase: async () => true,
      markDatabaseDown: (reason: string) => downReasons.push(reason),
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(false);
    expect(releasedWith).toHaveLength(2);
    expect(releasedWith[0]).toBeInstanceOf(Error);
    expect(downReasons).toEqual(["Connection terminated unexpectedly"]);
  });

  it("marks the database down when the probe query stalls past its deadline", async () => {
    const downReasons: string[] = [];
    const mod: any = {
      pool: { connect: async () => ({ release() {}, query: () => new Promise<never>(() => {}) }) },
      reconnectDatabase: async () => false,
      markDatabaseDown: (reason: string) => { downReasons.push(reason); mod.pool = null; },
    };
    const started = Date.now();
    expect(await databaseAcceptsConnections(async () => mod, 20)).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(downReasons).toEqual(["database probe timed out after 20ms"]);
  });

  it("releases, with an error, a connection that arrives after the probe gave up", async () => {
    // Nobody is waiting for that client any more; released silently it would
    // sit in the pool as a live checkout, or come back as a socket nobody proved.
    const releasedWith: unknown[] = [];
    let resolveConnect!: (client: unknown) => void;
    const mod: any = {
      pool: { connect: () => new Promise((resolve) => { resolveConnect = resolve; }) },
      markDatabaseDown: () => { mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    expect(await databaseAcceptsConnections(async () => mod, 20)).toBe(false);
    resolveConnect({ release: (error?: Error) => releasedWith.push(error), query: okQuery });
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(releasedWith).toHaveLength(1);
    expect(releasedWith[0]).toBeInstanceOf(Error);
    expect((releasedWith[0] as Error).message).toMatch(/after the 20ms deadline/);
  });

  it("gives the connect and the query one deadline between them, not one each", async () => {
    // Connect answers at 30 ms, the query never does, deadline 50 ms: the
    // probe must be settled by 55 ms, not at 80 ms (30 + a fresh 50).
    vi.useFakeTimers();
    const mod: any = {
      pool: {
        connect: () => new Promise((resolve) => {
          setTimeout(() => resolve({ release() {}, query: () => new Promise<never>(() => {}) }), 30);
        }),
      },
      markDatabaseDown: () => { mod.pool = null; },
      reconnectDatabase: async () => false,
    };
    let settled: boolean | null = null;
    const probe = databaseAcceptsConnections(async () => mod, 50).then((value) => { settled = value; return value; });
    await vi.advanceTimersByTimeAsync(55);
    expect(settled).toBe(false);
    await probe;
  });

  it("does not reconnect when a pool already exists", async () => {
    let attempts = 0;
    const mod = {
      pool: { connect: async () => ({ release() {}, query: okQuery }) },
      reconnectDatabase: async () => (attempts++, true),
    };
    expect(await databaseAcceptsConnections(async () => mod)).toBe(true);
    expect(attempts).toBe(0);
  });
});
