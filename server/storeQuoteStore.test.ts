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
});
