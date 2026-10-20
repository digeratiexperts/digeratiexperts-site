import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The token store must never hang the caller on a dead database (#657,
 * 2026-10-20: /api/health and /api/zoho/desk/status both read it and
 * answered nothing for hours). The database module is mocked so the store's
 * fallback and its "mark the database down" call can be observed.
 */
const dbMock = vi.hoisted(() => ({
  execute: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  dbReady: true,
  markDatabaseDown: vi.fn<(reason: string) => void>(),
}));

vi.mock("../../db", () => ({
  get db() {
    return { execute: dbMock.execute };
  },
  get dbReady() {
    return dbMock.dbReady;
  },
  markDatabaseDown: dbMock.markDatabaseDown,
}));

const tablePresent = { rows: [{ present: "zoho_oauth_tokens" }] };
const never = () => new Promise<never>(() => {});

describe("ResilientZohoTokenStore deadlines", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    dbMock.dbReady = true;
    const { setZohoTokenStoreTimeoutForTests } = await import("./db-store");
    setZohoTokenStoreTimeoutForTests(30);
  });

  afterEach(async () => {
    const { setZohoTokenStoreTimeoutForTests } = await import("./db-store");
    setZohoTokenStoreTimeoutForTests();
  });

  it("reads through the database when it answers", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    dbMock.execute.mockResolvedValueOnce(tablePresent).mockResolvedValueOnce({ rows: [] });
    const store = new ResilientZohoTokenStore();
    expect(await store.read("unified")).toBeNull();
    expect(dbMock.execute).toHaveBeenCalledTimes(2);
    expect(dbMock.markDatabaseDown).not.toHaveBeenCalled();
  });

  it("answers from memory and marks the database down when a read stalls", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    dbMock.execute.mockResolvedValueOnce(tablePresent).mockImplementationOnce(never);
    const store = new ResilientZohoTokenStore();
    const started = Date.now();
    expect(await store.read("unified")).toBeNull();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(dbMock.markDatabaseDown).toHaveBeenCalledTimes(1);
    expect(dbMock.markDatabaseDown.mock.calls[0][0]).toMatch(/zoho token store read did not finish within 30ms/);
  });

  it("marks the database down when the table check itself stalls", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    dbMock.execute.mockImplementationOnce(never);
    const store = new ResilientZohoTokenStore();
    expect(await store.readState("fp")).toBeNull();
    expect(dbMock.markDatabaseDown).toHaveBeenCalledTimes(1);
    expect(dbMock.markDatabaseDown.mock.calls[0][0]).toMatch(/table check/);
  });

  it("falls back to memory on a dropped connection but surfaces other database errors", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    const store = new ResilientZohoTokenStore();
    dbMock.execute.mockResolvedValueOnce(tablePresent).mockRejectedValueOnce(new Error("Connection terminated unexpectedly"));
    expect(await store.read("unified")).toBeNull();
    expect(dbMock.markDatabaseDown).toHaveBeenCalledTimes(1);

    dbMock.markDatabaseDown.mockClear();
    dbMock.execute.mockRejectedValueOnce(new Error('column "nope" does not exist'));
    await expect(store.read("unified")).rejects.toThrow(/column "nope"/);
    expect(dbMock.markDatabaseDown).not.toHaveBeenCalled();
  });

  it("writes to memory while the database is marked down, so the process keeps a consistent state", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    const store = new ResilientZohoTokenStore();
    dbMock.dbReady = false;
    await store.writeState("fp", { authStatus: "degraded", lastError: "throttled" });
    expect(dbMock.execute).not.toHaveBeenCalled();
    expect(await store.readState("fp")).toMatchObject({ authStatus: "degraded", lastError: "throttled" });
  });

  it("classifies outages by message", async () => {
    const { looksLikeDatabaseOutage } = await import("./db-store");
    expect(looksLikeDatabaseOutage(new Error("connect ECONNREFUSED 127.0.0.1:5432"))).toBe(true);
    expect(looksLikeDatabaseOutage(new Error("The endpoint has been disabled. Enable it using Neon API and retry."))).toBe(true);
    expect(looksLikeDatabaseOutage(new Error("Query read timeout"))).toBe(true);
    expect(looksLikeDatabaseOutage(new Error("Cannot use a pool after calling end on the pool"))).toBe(true);
    expect(looksLikeDatabaseOutage(new Error('relation "zoho_oauth_tokens" does not exist'))).toBe(false);
    expect(looksLikeDatabaseOutage(new Error("duplicate key value violates unique constraint"))).toBe(false);
  });
});
