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
    expect(dbMock.markDatabaseDown.mock.calls[0][0]).toMatch(/zoho token store read did not answer within 30 ms/);
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

  it("sees an outage through drizzle's DrizzleQueryError wrapper, which hides the driver message", async () => {
    // drizzle 0.44+ rethrows every driver error as "Failed query: …" with the
    // pg error as `cause`; the first cut only read the outer message.
    const { looksLikeDatabaseOutage } = await import("./db-store");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { sql } = await import("drizzle-orm");
    const throwing = (error: Error) => drizzle({ client: { query: async () => { throw error; } } as any });
    const refused = await throwing(Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" }))
      .execute(sql`select 1`).catch((error: unknown) => error);
    expect((refused as Error).message).toMatch(/^Failed query/);
    expect(looksLikeDatabaseOutage(refused)).toBe(true);

    const schemaBug = await throwing(Object.assign(new Error('relation "zoho_oauth_tokens" does not exist'), { code: "42P01" }))
      .execute(sql`select 1`).catch((error: unknown) => error);
    expect(looksLikeDatabaseOutage(schemaBug)).toBe(false);

    // pg reports a refused connect on several addresses as an AggregateError.
    const aggregate = new AggregateError([Object.assign(new Error("connect ECONNREFUSED ::1:5432"), { code: "ECONNREFUSED" })], "");
    expect(looksLikeDatabaseOutage(aggregate)).toBe(true);
    // Postgres' own codes for "the server went away", with messages the regex does not list.
    expect(looksLikeDatabaseOutage(Object.assign(new Error("administrator command"), { code: "57P01" }))).toBe(true);
    expect(looksLikeDatabaseOutage(Object.assign(new Error("server closed the connection unexpectedly"), { code: "08006" }))).toBe(true);
    // A cycle in `cause` must not loop.
    const loop: any = new Error("Failed query: select 1");
    loop.cause = loop;
    expect(looksLikeDatabaseOutage(loop)).toBe(false);
  });

  it("answers from memory and marks the database down on a wrapped dropped connection", async () => {
    const { ResilientZohoTokenStore } = await import("./db-store");
    const wrapped = Object.assign(new Error("Failed query: select * from zoho_oauth_tokens\nparams: unified"), {
      cause: Object.assign(new Error("Connection terminated unexpectedly"), { code: "ECONNRESET" }),
    });
    dbMock.execute.mockResolvedValueOnce(tablePresent).mockRejectedValueOnce(wrapped);
    const store = new ResilientZohoTokenStore();
    expect(await store.read("unified")).toBeNull();
    expect(dbMock.markDatabaseDown).toHaveBeenCalledTimes(1);
    expect(dbMock.markDatabaseDown.mock.calls[0][0]).toBe(
      "zoho token store read: Failed query: select * from zoho_oauth_tokens <- Connection terminated unexpectedly",
    );
  });
});
