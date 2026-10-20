import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * db.ts owns one pool for the process. These tests drive its boot connect,
 * the probe's mark-down and the reconnect with a controllable fake pg Pool,
 * because the 2026-10-20 review found a race no unit of healthProbe.ts can
 * show: a markDatabaseDown() during a connect attempt ended the pool that
 * attempt was building, and the late success then set dbReady on nothing.
 */
const pg = vi.hoisted(() => {
  type Waiter = { resolve: (client: unknown) => void; reject: (error: Error) => void };
  class Pool {
    static created: Pool[] = [];
    ended = false;
    endCalls = 0;
    private waiters: Waiter[] = [];
    constructor(public readonly options: unknown) {
      Pool.created.push(this);
    }
    on() {
      return this;
    }
    connect() {
      return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
    }
    end() {
      this.endCalls += 1;
      this.ended = true;
      return this.endCalls === 1 ? Promise.resolve() : Promise.reject(new Error("Called end on pool more than once"));
    }
    /** Test hook: settle the oldest pending connect. */
    settleConnect(ok = true) {
      const waiter = this.waiters.shift();
      if (!waiter) throw new Error("no pending connect");
      if (ok) waiter.resolve({ query: async () => ({ rows: [] }), release() {} });
      else waiter.reject(new Error("connect ECONNREFUSED 127.0.0.1:5432"));
    }
    /** Test hook: hand the oldest pending connect a client of the test's choosing. */
    settleConnectWith(client: unknown) {
      const waiter = this.waiters.shift();
      if (!waiter) throw new Error("no pending connect");
      waiter.resolve(client);
    }
  }
  return { Pool };
});

vi.mock("pg", () => ({ Pool: pg.Pool }));
vi.mock("@neondatabase/serverless", () => ({ Pool: class {}, neonConfig: {} }));
vi.mock("ws", () => ({ default: class {} }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: (opts: { client: unknown }) => ({ client: opts.client }) }));
vi.mock("drizzle-orm/neon-serverless", () => ({ drizzle: (opts: { client: unknown }) => ({ client: opts.client }) }));

async function loadDb() {
  vi.resetModules();
  process.env.DATABASE_URL = "postgres://fake-test-only/db";
  return await import("./db");
}

describe("db.ts pool lifecycle", () => {
  beforeEach(() => {
    pg.Pool.created.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.DATABASE_URL;
  });

  it("connects at boot on the pool it created", async () => {
    const dbm = await loadDb();
    expect(pg.Pool.created).toHaveLength(1);
    pg.Pool.created[0].settleConnect(true);
    expect(await dbm.initPromise).toBe(true);
    expect(dbm.dbReady).toBe(true);
    expect(dbm.pool).toBe(pg.Pool.created[0]);
    expect((dbm.db as { client: unknown }).client).toBe(pg.Pool.created[0]);
  });

  it("ignores a mark-down while the boot connect is in flight, so that connect lands on its own pool", async () => {
    const dbm = await loadDb();
    dbm.markDatabaseDown("zoho token store read: late deadline");
    expect(pg.Pool.created[0].ended).toBe(false);
    expect(dbm.pool).toBe(pg.Pool.created[0]);
    pg.Pool.created[0].settleConnect(true);
    expect(await dbm.initPromise).toBe(true);
    expect(dbm.dbReady).toBe(true);
    expect((dbm.db as { client: unknown }).client).toBe(pg.Pool.created[0]);
  });

  it("does not flip dbReady when a connect succeeds after its attempt timed out and dropped the pool", async () => {
    vi.useFakeTimers();
    const dbm = await loadDb();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await dbm.initPromise).toBe(false);
    expect(dbm.pool).toBeNull();
    expect(pg.Pool.created[0].ended).toBe(true);
    pg.Pool.created[0].settleConnect(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(dbm.dbReady).toBe(false);
    expect(dbm.db).toBeNull();
    expect(dbm.pool).toBeNull();
  });

  it("joins the boot connect from reconnectDatabase instead of opening a second pool beside it", async () => {
    const dbm = await loadDb();
    const joined = dbm.reconnectDatabase();
    expect(pg.Pool.created).toHaveLength(1);
    pg.Pool.created[0].settleConnect(true);
    expect(await joined).toBe(true);
    expect(await dbm.initPromise).toBe(true);
  });

  it("drops a pool marked down after boot and rebuilds it on reconnect", async () => {
    const dbm = await loadDb();
    pg.Pool.created[0].settleConnect(true);
    await dbm.initPromise;
    dbm.markDatabaseDown("Connection terminated unexpectedly");
    expect(dbm.pool).toBeNull();
    expect(dbm.dbReady).toBe(false);
    expect(dbm.db).toBeNull();
    expect(pg.Pool.created[0].ended).toBe(true);
    const again = dbm.reconnectDatabase();
    expect(pg.Pool.created).toHaveLength(2);
    pg.Pool.created[1].settleConnect(true);
    expect(await again).toBe(true);
    expect(dbm.pool).toBe(pg.Pool.created[1]);
    expect((dbm.db as { client: unknown }).client).toBe(pg.Pool.created[1]);
  });

  it("ignores a mark-down from a caller that saw an earlier pool, once the reconnect has settled", async () => {
    // Review of 1629b209: a token-store read issued on pool A keeps waiting
    // through the outage; its deadline fires after pool B is up and must not
    // end B. The caller passes the generation it captured before the read.
    const dbm = await loadDb();
    pg.Pool.created[0].settleConnect(true);
    await dbm.initPromise;
    const seenOnA = dbm.dbGeneration;
    dbm.markDatabaseDown("probe: Connection terminated unexpectedly");
    const again = dbm.reconnectDatabase();
    pg.Pool.created[1].settleConnect(true);
    expect(await again).toBe(true);
    dbm.markDatabaseDown("zoho token store read: did not answer within 8000 ms", seenOnA);
    expect(dbm.dbReady).toBe(true);
    expect(dbm.pool).toBe(pg.Pool.created[1]);
    expect(pg.Pool.created[1].ended).toBe(false);
    // A caller on the current pool still can.
    dbm.markDatabaseDown("probe: endpoint has been disabled", dbm.dbGeneration);
    expect(dbm.dbReady).toBe(false);
    expect(pg.Pool.created[1].ended).toBe(true);
  });

  it("releases the boot client with the error when SELECT 1 fails, so the pool can end", async () => {
    const dbm = await loadDb();
    const releasedWith: unknown[] = [];
    pg.Pool.created[0].settleConnectWith({
      query: async () => { throw new Error("Connection terminated unexpectedly"); },
      release: (error?: Error) => releasedWith.push(error),
    });
    expect(await dbm.initPromise).toBe(false);
    expect(releasedWith).toHaveLength(1);
    expect(releasedWith[0]).toBeInstanceOf(Error);
    expect(pg.Pool.created[0].ended).toBe(true);
    expect(dbm.pool).toBeNull();
  });

  it("leaves the replacement's dbType alone when an abandoned attempt's connect fails late, and ends the abandoned pool once", async () => {
    vi.useFakeTimers();
    const dbm = await loadDb();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await dbm.initPromise).toBe(false);
    const again = dbm.reconnectDatabase();
    pg.Pool.created[1].settleConnect(true);
    expect(await again).toBe(true);
    expect(dbm.getDatabaseStatus()).toEqual({ connected: true, type: "postgresql" });
    // Attempt A's pg connect now hits connectionTimeoutMillis.
    pg.Pool.created[0].settleConnect(false);
    await vi.advanceTimersByTimeAsync(10);
    expect(dbm.getDatabaseStatus()).toEqual({ connected: true, type: "postgresql" });
    expect(dbm.pool).toBe(pg.Pool.created[1]);
    expect(pg.Pool.created[0].endCalls).toBe(1);
  });

  it("ends a pool abandoned by the timer exactly once when its connect lands late", async () => {
    vi.useFakeTimers();
    const dbm = await loadDb();
    await vi.advanceTimersByTimeAsync(8_000);
    expect(await dbm.initPromise).toBe(false);
    expect(pg.Pool.created[0].endCalls).toBe(1);
    pg.Pool.created[0].settleConnect(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(pg.Pool.created[0].endCalls).toBe(1);
    expect(dbm.dbReady).toBe(false);
  });

  it("ignores a mark-down while the reconnect is in flight, so the rebuilt pool is kept", async () => {
    const dbm = await loadDb();
    pg.Pool.created[0].settleConnect(true);
    await dbm.initPromise;
    dbm.markDatabaseDown("probe: endpoint has been disabled");
    const again = dbm.reconnectDatabase();
    expect(pg.Pool.created).toHaveLength(2);
    // A stalled token-store read from before the outage times out now.
    dbm.markDatabaseDown("zoho token store read: did not answer within 8000 ms");
    expect(pg.Pool.created[1].ended).toBe(false);
    pg.Pool.created[1].settleConnect(true);
    expect(await again).toBe(true);
    expect(dbm.dbReady).toBe(true);
    expect(dbm.pool).toBe(pg.Pool.created[1]);
  });
});
