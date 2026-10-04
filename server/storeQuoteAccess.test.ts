import { describe, expect, it } from "vitest";
import { canAccessQuote, toClientQuote } from "./storeQuoteAccess";
import type { StoredQuoteRequest } from "./storeQuoteStore";

const QUOTE: StoredQuoteRequest = {
  id: "q-1",
  quoteNumber: "Q-20261003-0001",
  userId: "u-alice",
  clientId: "client-a",
  contactName: "Alice",
  contactEmail: "Alice@Acme.test",
  contactPhone: "555-0100",
  companyName: "Acme",
  requestedItems: [{ sku: "DE-MDR", name: "MDR", quantity: 10, unitPrice: 12.5 } as any],
  message: "internal context",
  status: "requested",
  assignedTo: "rep-7",
  meetingScheduled: null,
  quoteSentAt: null,
  convertedOrderId: "order-9",
  createdAt: new Date("2026-10-03T12:00:00Z"),
  updatedAt: new Date("2026-10-03T12:00:00Z"),
};

describe("canAccessQuote (#257)", () => {
  it("lets the requesting user, their company, the contact email and an admin read it", () => {
    expect(canAccessQuote({ userId: "u-alice", user: { role: "user" } }, QUOTE).ownsQuote).toBe(true);
    expect(canAccessQuote({ userId: "u-carol", user: { role: "user", clientId: "client-a" } }, QUOTE).ownsQuote).toBe(true);
    expect(canAccessQuote({ userId: "u-x", user: { role: "user", email: "alice@acme.test" } }, QUOTE).ownsQuote).toBe(true);
    expect(canAccessQuote({ userId: "u-admin", user: { role: "admin" } }, QUOTE)).toEqual({ isAdmin: true, ownsQuote: true });
  });

  it("refuses a user from another company", () => {
    const bob = { userId: "u-bob", user: { role: "user", clientId: "client-b", email: "bob@globex.test" } };
    expect(canAccessQuote(bob, QUOTE)).toEqual({ isAdmin: false, ownsQuote: false });
  });

  it("does not match on empty identity fields", () => {
    const anonymousQuote = { userId: null, clientId: null, contactEmail: null };
    expect(canAccessQuote({ user: { role: "user", clientId: null, email: null } }, anonymousQuote).ownsQuote).toBe(false);
    expect(canAccessQuote({}, QUOTE).ownsQuote).toBe(false);
  });
});

describe("toClientQuote (#257)", () => {
  it("returns only the confirmation fields, never lines, prices, assignment or conversion", () => {
    const view = toClientQuote(QUOTE, { manager: "Account team" });
    expect(Object.keys(view).sort()).toEqual(
      ["accountTeam", "companyName", "contactEmail", "createdAt", "id", "pdfUrl", "quoteNumber", "status"].sort(),
    );
    expect(view.pdfUrl).toBe("/api/store/quote-requests/q-1/pdf");
    const serialized = JSON.stringify(view);
    for (const leak of ["requestedItems", "unitPrice", "rep-7", "order-9", "internal context", "u-alice"]) {
      expect(serialized).not.toContain(leak);
    }
  });
});
