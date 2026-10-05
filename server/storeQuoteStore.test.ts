import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";

const requestedItems = canonicalizeQuoteItems([
  {
    productId: "prod-010",
    sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
    quantity: 1,
  },
]);

async function loadStoreWithDb(mock: { dbReady: boolean; db: unknown }) {
  vi.resetModules();
  vi.doMock("./db", () => ({
    db: mock.db,
    dbReady: mock.dbReady,
    initPromise: Promise.resolve(),
    initAttempted: true,
    pool: null,
    dbType: mock.dbReady ? "postgres" : "memory",
    getDatabaseStatus: () => ({ connected: mock.dbReady, type: mock.dbReady ? "postgres" : "memory" }),
  }));
  return import("./storeQuoteStore");
}

describe("store quote store (issue #240: a quote request must be durable or fail)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("./db");
  });

  it("refuses to record a quote without Postgres instead of keeping it in memory", async () => {
    const { insertQuoteRequest, getQuoteRequest, QuoteDurabilityError } = await loadStoreWithDb({
      dbReady: false,
      db: null,
    });
    await expect(
      insertQuoteRequest({ contactName: "Jordan Buyer", contactEmail: "jordan@example.com", requestedItems }),
    ).rejects.toMatchObject({ code: "DURABLE_DATABASE_REQUIRED" });
    await expect(
      insertQuoteRequest({ contactName: "Jordan Buyer", contactEmail: "jordan@example.com", requestedItems }),
    ).rejects.toBeInstanceOf(QuoteDurabilityError);
    // Nothing was remembered, so nothing can be looked up and no quote number was minted.
    expect(await getQuoteRequest("QR-00000000-NONE")).toBeUndefined();
  });

  it("hands the route the built request so it can be saved outside the database (#240)", async () => {
    const { insertQuoteRequest, getQuoteRequest, rememberQuoteRequest } = await loadStoreWithDb({
      dbReady: false,
      db: null,
    });
    const error: any = await insertQuoteRequest({
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      requestedItems,
    }).catch((caught) => caught);
    expect(error.record).toMatchObject({ contactEmail: "jordan@example.com", status: "pending" });
    expect(error.record.quoteNumber).toMatch(/^QR-\d{8}-[A-Z0-9]{4}$/);
    // Not remembered until the route says a fallback layer held.
    expect(await getQuoteRequest(error.record.id)).toBeUndefined();
    rememberQuoteRequest(error.record);
    expect((await getQuoteRequest(error.record.quoteNumber))?.id).toBe(error.record.id);
  });

  it("writes a spooled request back idempotently, and reports false while the database is down", async () => {
    let values: Record<string, unknown> | null = null;
    let conflictTarget: unknown = null;
    const db = {
      insert: () => ({
        values: (row: Record<string, unknown>) => {
          values = row;
          return {
            onConflictDoNothing: async (options: { target: unknown }) => {
              conflictTarget = options.target;
            },
          };
        },
      }),
    };
    const { persistSpooledQuoteRequest } = await loadStoreWithDb({ dbReady: true, db });
    const spooled = JSON.parse(
      JSON.stringify({
        id: "6f2c1a1e-0000-4000-8000-000000000002",
        quoteNumber: "QR-20261004-CD34",
        userId: null,
        clientId: null,
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        contactPhone: null,
        companyName: null,
        requestedItems,
        message: null,
        status: "pending",
        quoteSentAt: "2026-10-04T12:00:00.000Z",
        createdAt: "2026-10-04T12:00:00.000Z",
        updatedAt: "2026-10-04T12:00:00.000Z",
      }),
    );
    expect(await persistSpooledQuoteRequest(spooled)).toBe(true);
    expect(conflictTarget).not.toBeNull();
    expect(values).toMatchObject({ id: spooled.id, quoteNumber: spooled.quoteNumber });
    expect((values as any).createdAt).toEqual(new Date("2026-10-04T12:00:00.000Z"));

    const down = await loadStoreWithDb({ dbReady: false, db: null });
    expect(await down.persistSpooledQuoteRequest(spooled)).toBe(false);
  });

  it("fails closed when the insert itself throws", async () => {
    const db = {
      insert: () => ({
        values: () => ({
          returning: async () => {
            throw new Error("connection reset");
          },
        }),
      }),
    };
    const { insertQuoteRequest } = await loadStoreWithDb({ dbReady: true, db });
    await expect(
      insertQuoteRequest({ contactName: "Jordan Buyer", contactEmail: "jordan@example.com", requestedItems }),
    ).rejects.toMatchObject({ code: "DURABLE_DATABASE_REQUIRED", message: expect.stringContaining("connection reset") });
  });

  it("remembers only the row the database returned, then serves it by id and quote number", async () => {
    let inserted: Record<string, unknown> | null = null;
    const db = {
      insert: () => ({
        values: (row: Record<string, unknown>) => ({
          returning: async () => {
            inserted = row;
            return [{ ...row, createdAt: new Date("2026-09-28T00:00:00Z"), updatedAt: new Date("2026-09-28T00:00:00Z") }];
          },
        }),
      }),
    };
    const { insertQuoteRequest, getQuoteRequest } = await loadStoreWithDb({ dbReady: true, db });
    const created = await insertQuoteRequest({
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      requestedItems,
    });
    expect(inserted).not.toBeNull();
    expect(created.quoteNumber).toMatch(/^QR-\d{8}-[A-Z0-9]{4}$/);
    const byId = await getQuoteRequest(created.id);
    const byNumber = await getQuoteRequest(created.quoteNumber);
    expect(byId?.quoteNumber).toBe(created.quoteNumber);
    expect(byNumber?.id).toBe(created.id);
    expect(byId?.requestedItems[0].unitPrice).toBe(39);
  });

  it("reads a stored quote back from the database after a restart empties the cache", async () => {
    const stored = {
      id: "6f2c1a1e-0000-4000-8000-000000000001",
      quoteNumber: "QR-20260928-AB12",
      userId: "u-jordan",
      clientId: "client-a",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      requestedItems,
      status: "pending",
      createdAt: "2026-09-28T00:00:00.000Z",
      updatedAt: "2026-09-28T00:00:00.000Z",
    };
    let lookups = 0;
    let failNext = false;
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              lookups += 1;
              if (failNext) throw new Error("connection reset");
              return lookups === 1 ? [stored] : [];
            },
          }),
        }),
      }),
    };
    // A fresh module is a fresh process: nothing is cached, so both lookups go to the database.
    const { getQuoteRequest } = await loadStoreWithDb({ dbReady: true, db });

    const byNumber = await getQuoteRequest(stored.quoteNumber);
    expect(byNumber).toMatchObject({ id: stored.id, clientId: "client-a", contactEmail: "jordan@example.com" });
    expect(byNumber?.createdAt).toBeInstanceOf(Date);
    expect(byNumber?.requestedItems[0].unitPrice).toBe(39);
    expect(lookups).toBe(1);

    // Remembered by both keys once read, so the id does not hit the database again.
    expect((await getQuoteRequest(stored.id))?.quoteNumber).toBe(stored.quoteNumber);
    expect(lookups).toBe(1);

    expect(await getQuoteRequest("QR-00000000-NONE")).toBeUndefined();
    failNext = true;
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect(await getQuoteRequest("QR-00000000-FAIL")).toBeUndefined();
  });
});
