import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #665 made db.ts drop its pool after boot (markDatabaseDown). storage.ts
 * had only ever seen a database that was there or not at boot, so after a
 * drop it kept handing out DatabaseStorage on a null client: every durable
 * route answered a 500 TypeError instead of the 503 the fail-closed policy
 * (#248) promises, until a reconnect happened to succeed.
 */
const dbState = vi.hoisted(() => ({
  db: null as unknown,
  dbReady: false,
  reconnect: async () => false,
}));

async function load(nodeEnv: string) {
  vi.resetModules();
  process.env.NODE_ENV = nodeEnv;
  vi.doMock("./db", () => ({
    get db() {
      return dbState.db;
    },
    get dbReady() {
      return dbState.dbReady;
    },
    initPromise: Promise.resolve(true),
    getDatabaseStatus: () => ({ connected: dbState.dbReady, type: dbState.dbReady ? "postgresql" : "memory" }),
    reconnectDatabase: () => dbState.reconnect(),
  }));
  return import("./storage");
}

function fakeRes() {
  const out: { status?: number; body?: any } = {};
  const res: any = {
    status(code: number) {
      out.status = code;
      return res;
    },
    json(body: any) {
      out.body = body;
      return res;
    },
  };
  return { res, out };
}

describe("storage after the database drops out post-boot", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbState.db = { select: () => ({ from: () => ({ where: async () => [] }) }) };
    dbState.dbReady = true;
    dbState.reconnect = async () => false;
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("answers 503 at the durable gate in production once the pool is dropped, and recovers on reconnect", async () => {
    const mod = await load("production");
    const first = fakeRes();
    let passed = 0;
    await mod.requireDurableStorage({}, first.res, () => { passed += 1; });
    expect(passed).toBe(1);
    expect(mod.getStorageMode()).toBe("database");

    // markDatabaseDown(): pool and db gone, dbReady false.
    dbState.db = null;
    dbState.dbReady = false;
    const dropped = fakeRes();
    await mod.requireDurableStorage({}, dropped.res, () => { passed += 1; });
    expect(passed).toBe(1);
    expect(dropped.out.status).toBe(503);
    expect(dropped.out.body.code).toBe("STORAGE_UNAVAILABLE");
    expect(mod.getStorageMode()).toBe("unavailable");

    // The probe's reconnect rebuilt the pool.
    dbState.reconnect = async () => {
      dbState.db = { select: () => ({ from: () => ({ where: async () => [] }) }) };
      dbState.dbReady = true;
      return true;
    };
    const back = fakeRes();
    await mod.requireDurableStorage({}, back.res, () => { passed += 1; });
    expect(passed).toBe(2);
    expect(mod.getStorageMode()).toBe("database");
  });

  it("throws StorageUnavailableError, not a TypeError, from DatabaseStorage on a null client", async () => {
    const mod = await load("production");
    dbState.db = null;
    dbState.dbReady = false;
    const store = new mod.DatabaseStorage();
    await expect(store.getUser("u1")).rejects.toBeInstanceOf(mod.StorageUnavailableError);
  });
});
