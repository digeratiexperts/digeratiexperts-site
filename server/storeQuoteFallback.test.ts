import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { listSpoolEntries, writeSpoolEntry } from "./publicSolutionSpool";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";
import {
  describeQuoteRequest,
  quoteRequestedEvent,
  saveQuoteOutsideDatabase,
  type QuoteFallbackDeps,
  type SpooledQuote,
} from "./storeQuoteFallback";
import type { StoredQuoteRequest } from "./storeQuoteStore";

vi.mock("./services/notificationService", () => ({ notificationService: { sendQuoteRequestFallback: vi.fn() } }));
vi.mock("./storeQuoteCrm", () => ({ syncStoreQuoteToCrm: vi.fn() }));

const NOW = new Date("2026-10-04T12:00:00.000Z");
const quote: StoredQuoteRequest = {
  id: "6f2c1a1e-0000-4000-8000-000000000001",
  quoteNumber: "QR-20261004-AB12",
  userId: "u-jordan",
  clientId: "client-a",
  contactName: "Jordan Buyer",
  contactEmail: "jordan@example.com",
  contactPhone: null,
  companyName: "Jordan Co",
  requestedItems: canonicalizeQuoteItems([{ productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 2 }]),
  message: "Need it <b>soon</b>",
  status: "pending",
  assignedTo: null,
  meetingScheduled: null,
  quoteSentAt: NOW,
  convertedOrderId: null,
  createdAt: NOW,
  updatedAt: NOW,
};
const record: SpooledQuote = {
  id: quote.id,
  quote,
  canonicalAccountId: "hub-1",
  portalClientId: "client-a",
  crmRecorded: false,
};

function deps(overrides: Partial<QuoteFallbackDeps> = {}) {
  const d: QuoteFallbackDeps = {
    spool: vi.fn(() => true),
    updateSpool: vi.fn(() => true),
    syncCrm: vi.fn(async () => false),
    emailSales: vi.fn(async () => false),
    now: () => NOW,
    ...overrides,
  };
  return d;
}

let dir: string | null = null;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("saving a store quote request outside the database (#240)", () => {
  it("accepts on the spool alone and tries every other layer anyway", async () => {
    const d = deps();
    expect(await saveQuoteOutsideDatabase(record, d)).toEqual({
      durable: "spool",
      spooled: true,
      crmRecorded: false,
      salesEmailed: false,
    });
    expect(d.syncCrm).toHaveBeenCalledWith(record);
    expect(d.emailSales).toHaveBeenCalledWith(quote);
    expect(d.updateSpool).not.toHaveBeenCalled();
  });

  it("marks the spool entry so recovery does not create a second CRM record", async () => {
    const d = deps({ syncCrm: vi.fn(async () => true), emailSales: vi.fn(async () => true) });
    await saveQuoteOutsideDatabase(record, d);
    expect(d.updateSpool).toHaveBeenCalledWith(
      expect.objectContaining({
        salesEmailedAt: NOW.toISOString(),
        record: expect.objectContaining({ crmRecorded: true }),
      }),
    );
  });

  it("accepts on the CRM or the email when the disk refuses", async () => {
    expect((await saveQuoteOutsideDatabase(record, deps({ spool: () => false, syncCrm: async () => true }))).durable).toBe("crm");
    expect((await saveQuoteOutsideDatabase(record, deps({ spool: () => false, emailSales: async () => true }))).durable).toBe(
      "email",
    );
  });

  it("reports nothing durable only when every layer failed or threw", async () => {
    const d = deps({
      spool: () => {
        throw new Error("EROFS");
      },
      syncCrm: async () => {
        throw new Error("zoho down");
      },
      emailSales: async () => {
        throw new Error("zepto down");
      },
    });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    expect((await saveQuoteOutsideDatabase(record, d)).durable).toBeNull();
  });

  it("round-trips a quote through the shared spool in its own directory", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "quote-spool-"));
    expect(
      writeSpoolEntry({ version: 1, spooledAt: NOW.toISOString(), salesEmailedAt: null, record }, dir),
    ).toBe(true);
    const [entry] = listSpoolEntries<SpooledQuote>(dir);
    expect(entry.record.quote.quoteNumber).toBe(quote.quoteNumber);
    expect(entry.record.quote.requestedItems).toEqual(quote.requestedItems);
    expect((fs.statSync(path.join(dir, `${quote.id}.json`)).mode & 0o777).toString(8)).toBe("600");
  });
});

describe("quote request payloads", () => {
  it("builds one QUOTE_REQUESTED shape for the route and recovery, even from spooled JSON", () => {
    const fromJson = JSON.parse(JSON.stringify(quote));
    const event = quoteRequestedEvent(fromJson, { canonicalAccountId: "hub-1", portalClientId: "client-a" });
    expect(event).toMatchObject({
      id: quote.id,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      source: "store_quote",
      canonicalAccountId: "hub-1",
      portalClientId: "client-a",
      commercial: expect.objectContaining({ reference: quote.quoteNumber, occurredAt: NOW.toISOString() }),
    });
  });

  it("puts every line, the totals and the message in the fallback email text", () => {
    const text = describeQuoteRequest(quote);
    expect(text).toContain("2 x");
    expect(text).toContain("DE-SVC-CM-ENDPOINT-CORE-MO");
    expect(text).toContain("Monthly: $78.00");
    expect(text).toContain("Need it <b>soon</b>");
  });
});
