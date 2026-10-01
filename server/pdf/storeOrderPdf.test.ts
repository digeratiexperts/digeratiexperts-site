import { describe, expect, it } from "vitest";
import { buildOrderPdfHtml } from "./storeOrderPdf";

const baseOrder = {
  orderNumber: "ORD-9K2F-2208",
  status: "paid",
  paymentMethod: "zoho",
  subtotal: "1955.00",
  tax: "0",
  total: "2450.00",
  billingName: "Jane Buyer",
  billingEmail: "accounts@meridian.com",
  billingCompany: "Meridian Dental",
  billingAddress: { city: "Chandler", state: "AZ" },
  createdAt: "2026-10-01T00:00:00Z",
  lineItems: [
    { name: "Managed endpoint protection", sku: "MEP-EDR-SOC", quantity: 22, unitPrice: 47, total: 1034, pricingType: "monthly" },
    { name: "Onboarding", sku: "ONB-3SITE", quantity: 1, unitPrice: 2450, total: 2450, pricingType: "one_time" },
  ],
};

describe("buildOrderPdfHtml", () => {
  it("renders a full HTML document with the order's data", () => {
    const html = buildOrderPdfHtml(baseOrder);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("ORD-9K2F-2208");
    expect(html).toContain("Managed endpoint protection");
    expect(html).toContain("Meridian Dental");
    expect(html).toContain("$2,450.00");
    expect(html).toContain("Order <span class=\"g\">confirmed.</span>");
    expect(html).toContain("Monthly");
    expect(html).toContain("One-time");
  });

  it("shows 'received.' and a pending pill for an unpaid order", () => {
    const html = buildOrderPdfHtml({ ...baseOrder, status: "pending" });
    expect(html).toContain("Order <span class=\"g\">received.</span>");
    expect(html).toContain("status pending");
  });

  it("HTML-escapes user-supplied billing fields (no XSS in the document)", () => {
    const html = buildOrderPdfHtml({
      ...baseOrder,
      billingCompany: `<img src=x onerror=alert(1)>`,
      lineItems: [{ name: `<script>bad()</script>`, sku: "X", quantity: 1, unitPrice: 1, total: 1 }],
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>bad()");
    expect(html).toContain("&lt;img src=x");
    expect(html).toContain("&lt;script&gt;bad()");
  });

  it("tolerates missing line items and nullish money fields", () => {
    const html = buildOrderPdfHtml({ orderNumber: "ORD-1", lineItems: undefined, total: null });
    expect(html).toContain("No line items.");
    expect(html).toContain("$0.00");
  });
});
