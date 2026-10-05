import { describe, expect, it, vi } from "vitest";
import type { QuoteSpoolEntry } from "./storeQuoteFallback";
import { replaySpooledQuoteRequests, type QuoteReplayDeps } from "./storeQuoteReplayWorker";

vi.mock("./services/notificationService", () => ({ notificationService: { sendQuoteRequestFallback: vi.fn() } }));
vi.mock("./storeQuoteCrm", () => ({ syncStoreQuoteToCrm: vi.fn() }));
vi.mock("./storeQuoteStore", () => ({ persistSpooledQuoteRequest: vi.fn() }));

const NOW = Date.parse("2026-10-04T12:00:00.000Z");
const spooled = (id: string, crmRecorded = false, extra: Record<string, unknown> = {}): QuoteSpoolEntry =>
  ({
    version: 1,
    spooledAt: "2026-10-04T11:59:00.000Z",
    salesEmailedAt: null,
    record: {
      id,
      canonicalAccountId: "hub-1",
      portalClientId: "client-a",
      crmRecorded,
      quote: {
        id,
        quoteNumber: `QR-20261004-${id.slice(-4).toUpperCase()}`,
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        contactPhone: null,
        companyName: "Jordan Co",
        message: null,
        requestedItems: [],
        createdAt: "2026-10-04T11:59:00.000Z",
      },
    },
    ...extra,
  }) as any;

function deps(entries: QuoteSpoolEntry[], overrides: Partial<QuoteReplayDeps> = {}) {
  const d: QuoteReplayDeps = {
    persist: vi.fn(async () => true),
    syncCrm: vi.fn(async () => true),
    emitQuote: vi.fn(),
    list: () => entries,
    update: vi.fn(() => true),
    remove: vi.fn(),
    now: () => NOW,
    ...overrides,
  };
  return d;
}

describe("recovering spooled store quote requests into the database (#240)", () => {
  it("waits, sending and deleting nothing, while the database is still down", async () => {
    const d = deps([spooled("quote-0001")], { persist: vi.fn(async () => false) });
    expect(await replaySpooledQuoteRequests(d)).toEqual({ recovered: 0, waiting: 1 });
    expect(d.syncCrm).not.toHaveBeenCalled();
    expect(d.emitQuote).not.toHaveBeenCalled();
    expect(d.remove).not.toHaveBeenCalled();
  });

  it("writes the row, creates the missing CRM record, sends QUOTE_REQUESTED, then deletes the file", async () => {
    const d = deps([spooled("quote-0001")]);
    expect(await replaySpooledQuoteRequests(d)).toEqual({ recovered: 1, waiting: 0 });
    expect(d.persist).toHaveBeenCalledWith(expect.objectContaining({ id: "quote-0001" }));
    expect(d.syncCrm).toHaveBeenCalledTimes(1);
    expect(d.emitQuote).toHaveBeenCalledWith(
      expect.objectContaining({ quoteId: "quote-0001", source: "store_quote", canonicalAccountId: "hub-1" }),
    );
    expect(d.remove).toHaveBeenCalledWith("quote-0001");
  });

  it("does not create a second CRM record or resend an event a crashed tick already sent", async () => {
    const d = deps([spooled("quote-0001", true, { eventSentAt: "2026-10-04T11:59:30.000Z" })]);
    await replaySpooledQuoteRequests(d);
    expect(d.syncCrm).not.toHaveBeenCalled();
    expect(d.emitQuote).not.toHaveBeenCalled();
    expect(d.remove).toHaveBeenCalledWith("quote-0001");
  });

  it("stops at the first failed write and keeps the rest for the next tick", async () => {
    const persist = vi.fn(async () => true).mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    const d = deps([spooled("quote-0001"), spooled("quote-0002"), spooled("quote-0003")], { persist });
    expect(await replaySpooledQuoteRequests(d)).toEqual({ recovered: 1, waiting: 2 });
    expect(d.remove).toHaveBeenCalledTimes(1);
  });

  it("still finishes recovery when the CRM is unreachable", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const d = deps([spooled("quote-0001")], {
      syncCrm: vi.fn(async () => {
        throw new Error("zoho down");
      }),
    });
    expect(await replaySpooledQuoteRequests(d)).toEqual({ recovered: 1, waiting: 0 });
    expect(d.emitQuote).toHaveBeenCalledTimes(1);
  });

  it("logs a request still waiting after an hour", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const d = deps([spooled("quote-0001", false, { spooledAt: "2026-10-04T10:00:00.000Z" })], {
      persist: vi.fn(async () => false),
    });
    await replaySpooledQuoteRequests(d);
    expect(error).toHaveBeenCalledWith(
      "[quote-replay] spooled quote request waiting over an hour",
      expect.objectContaining({ id: "quote-0001" }),
    );
  });
});
