import { describe, expect, it, vi } from "vitest";

const crm = vi.hoisted(() => ({
  searchAccounts: vi.fn().mockResolvedValue([]),
  createAccount: vi.fn().mockResolvedValue({ id: "acc-1" }),
  getContactByEmail: vi.fn().mockResolvedValue(null),
  createContact: vi.fn().mockResolvedValue({ id: "con-1" }),
  getLeadByEmail: vi.fn().mockResolvedValue(null),
  createLead: vi.fn().mockResolvedValue({ id: "lead-1" }),
  createQuote: vi.fn().mockResolvedValue({ id: "quote-1" }),
  searchDeals: vi.fn(),
  createDeal: vi.fn(),
}));

vi.mock("./zoho/zohoClient", () => ({ zohoClient: { isConfigured: () => true } }));
vi.mock("./zoho/zohoCRM", () => ({ zohoCRMService: crm }));

import { syncStoreQuoteToCrm } from "./storeQuoteCrm";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";

// Issue 206 / ADR-MAP-004: a store quote creates the Account, Contact, Lead
// and Quote, never a Deal. A person opens the Deal once it is qualified.
describe("store quote CRM sync", () => {
  it("never searches for or creates a Deal", async () => {
    const result = await syncStoreQuoteToCrm({
      quoteNumber: "QR-20261014-TEST",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      companyName: "Example Medical",
      requestedItems: canonicalizeQuoteItems([
        { productId: "prod-010", sku: "DE-SVC-CM-ENDPOINT-CORE-MO", quantity: 1 },
      ]),
    });

    expect(crm.searchDeals).not.toHaveBeenCalled();
    expect(crm.createDeal).not.toHaveBeenCalled();
    expect(crm.createLead).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ accountId: "acc-1", contactId: "con-1", leadId: "lead-1", quoteId: "quote-1" });
    expect(result).not.toHaveProperty("dealId");
  });
});
