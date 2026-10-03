import { describe, expect, it } from "vitest";
import { canonicalizeQuoteItems } from "./storeQuoteCommerce";
import { buildQuotePdf, buildQuotePdfHtml } from "./storeQuotePdf";

describe("store quote PDF", () => {
  it("builds branded HTML that restates the quote number and catalog totals", () => {
    const items = canonicalizeQuoteItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        quantity: 2,
      },
    ]);
    const html = buildQuotePdfHtml({
      quoteNumber: "QR-20260818-TEST",
      contactName: "Jordan Buyer",
      contactEmail: "jordan@example.com",
      companyName: "Example Medical",
      createdAt: new Date("2026-08-18T12:00:00.000Z"),
      requestedItems: items,
      message: "Need endpoint coverage for two clinics.",
    });

    expect(html).toContain("QR-20260818-TEST");
    expect(html).toContain("Jordan Buyer");
    expect(html).toContain("#D3126A");
    expect(html).toContain("78.00");
    expect(html).toContain("Need endpoint coverage for two clinics.");
  });

  it(
    "renders a real PDF buffer when a local renderer is available",
    async () => {
      const items = canonicalizeQuoteItems([
        {
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 2,
        },
      ]);
      const pdf = await buildQuotePdf({
        quoteNumber: "QR-20260818-TEST",
        contactName: "Jordan Buyer",
        contactEmail: "jordan@example.com",
        companyName: "Example Medical",
        createdAt: new Date("2026-08-18T12:00:00.000Z"),
        requestedItems: items,
        message: "Need endpoint coverage for two clinics.",
      });

      expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(pdf.byteLength).toBeGreaterThan(1500);
    },
    90_000,
  );
});
