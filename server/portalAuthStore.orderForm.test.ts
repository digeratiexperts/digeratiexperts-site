import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * #246: a submitted order form is a commercial record. saveOrderForm must throw
 * when the database did not confirm the insert, in production must refuse to
 * run without a database, and a retry with the same key must not duplicate.
 */

type Row = { id: string; userId: string | null };

function fakeDb(opts: { failInsert?: boolean } = {}) {
  const rows = new Map<string, Row>();
  const db = {
    insert: () => ({
      values: (v: any) => ({
        onConflictDoNothing: () => ({
          returning: async () => {
            if (opts.failInsert) throw new Error("connection terminated");
            if (rows.has(v.id)) return [];
            rows.set(v.id, { id: v.id, userId: v.userId });
            return [{ id: v.id }];
          },
        }),
      }),
    }),
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [...rows.values()].slice(-1),
        }),
      }),
    }),
  };
  return { db, rows };
}

async function loadStore(mock: { dbReady: boolean; db: unknown }) {
  vi.resetModules();
  vi.doMock("./db", () => ({ db: mock.db, dbReady: mock.dbReady, initPromise: Promise.resolve(mock.dbReady) }));
  return import("./portalAuthStore");
}

describe("saveOrderForm durability (#246)", () => {
  const env = { ...process.env };
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    process.env = { ...env };
    vi.restoreAllMocks();
  });

  it("throws instead of returning an id when the insert fails", async () => {
    const { db, rows } = fakeDb({ failInsert: true });
    const store = await loadStore({ dbReady: true, db });
    await expect(store.saveOrderForm({ userId: "u1", payload: { a: 1 } })).rejects.toBeInstanceOf(
      store.PortalPersistenceError,
    );
    expect(rows.size).toBe(0);
  });

  it("production without a database refuses the submission", async () => {
    process.env.NODE_ENV = "production";
    const store = await loadStore({ dbReady: false, db: null });
    await expect(store.saveOrderForm({ userId: "u1", payload: {} })).rejects.toMatchObject({
      code: "PERSISTENCE_UNAVAILABLE",
    });
  });

  it("dev/test without a database keeps working", async () => {
    process.env.NODE_ENV = "test";
    const store = await loadStore({ dbReady: false, db: null });
    const saved = await store.saveOrderForm({ userId: "u1", payload: {} });
    expect(saved.id).toMatch(/^order-/);
  });

  it("returns the database row and reports a retry with the same key as a replay, once", async () => {
    const { db, rows } = fakeDb();
    const store = await loadStore({ dbReady: true, db });
    const first = await store.saveOrderForm({ userId: "u1", payload: {}, idempotencyKey: "k-1" });
    const retry = await store.saveOrderForm({ userId: "u1", payload: {}, idempotencyKey: "k-1" });
    expect(retry.id).toBe(first.id);
    expect(first.replayed).toBeUndefined();
    expect(retry.replayed).toBe(true);
    expect(rows.size).toBe(1);
  });

  it("does not let another user replay someone else's key into their own success", async () => {
    const { db } = fakeDb();
    const store = await loadStore({ dbReady: true, db });
    const a = await store.saveOrderForm({ userId: "u1", payload: {}, idempotencyKey: "same" });
    const b = await store.saveOrderForm({ userId: "u2", payload: {}, idempotencyKey: "same" });
    expect(b.id).not.toBe(a.id);
  });
});
