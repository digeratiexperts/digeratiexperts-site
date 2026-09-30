import { describe, expect, it } from "vitest";
import { buildCrmQuoteDescription, crmAccountAction } from "./storeQuoteCrm";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";

describe("store quote CRM payload", () => {
  it("includes the quote number and line SKUs without inventing contract value", () => {
    const requestedItems = canonicalizeQuoteItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        quantity: 2,
      },
    ]);
    const description = buildCrmQuoteDescription({
      quoteNumber: "QR-20260818-TEST",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      companyName: "Example Medical",
      requestedItems,
      message: "Need coverage for two clinics.",
    });
    expect(description).toContain("website.syncStoreQuoteToCrm");
    expect(description).toContain("QR-20260818-TEST");
    expect(description).toContain("DE-SVC-CM-ENDPOINT-CORE-MO");
    expect(description).toContain("Example Medical");
    expect(description).not.toMatch(/password|token|secret/i);
  });

  it("stops company-name CRM matching once a Hub account id exists", () => {
    expect(crmAccountAction({ canonicalAccountId: "41" })).toBe("skip_name_match");
    expect(crmAccountAction({ zohoAccountId: "zoho-1", canonicalAccountId: "41" })).toBe("use_zoho");
    expect(crmAccountAction({})).toBe("name_match");
  });
});
