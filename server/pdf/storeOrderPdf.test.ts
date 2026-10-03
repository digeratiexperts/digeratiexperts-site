import { describe, expect, it } from "vitest";
import { buildOrderPdfHtml, orderPdfFileBase, usd } from "./storeOrderPdf";
import { brandFontFaceCss } from "./dePdfBrand";
import { accountTeamFor } from "@shared/accountManagers";

const order = {
  orderNumber: "ORD-9K2F-2208",
  status: "paid",
  paymentMethod: "zoho",
  subtotal: "3484.00",
  tax: "0",
  total: "3484.00",
  billingName: "Jane Buyer",
  billingEmail: "accounts@meridian.com",
  billingCompany: "Meridian Dental",
  billingAddress: { street: "100 Main St", city: "Chandler", state: "AZ", zipCode: "85225" },
  paidAt: "2026-10-01T18:00:00Z",
  createdAt: "2026-10-01T17:55:00Z",
  lineItems: [
    { name: "Managed endpoint protection", sku: "MEP-EDR-SOC", quantity: 22, unitPrice: 47, total: 1034, pricingType: "per_endpoint" },
    { name: "Onboarding", sku: "ONB-3SITE", quantity: 1, unitPrice: 2450, total: 2450, pricingType: "one_time" },
  ],
};

describe("buildOrderPdfHtml", () => {
  it("renders the order's identity, lines, cadence labels and totals", () => {
    const html = buildOrderPdfHtml(order);
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("ORD-9K2F-2208");
    expect(html).toContain("Order confirmed");
    expect(html).toContain("Managed endpoint protection");
    expect(html).toContain("Per endpoint / month");
    expect(html).toContain("One-time");
    expect(html).toContain("$3,484.00");
    expect(html).toContain("Zoho Payments");
    expect(html).toContain('<table class="items">');
  });

  it("labels the portal variant as a receipt", () => {
    const html = buildOrderPdfHtml(order, { variant: "receipt" });
    expect(html).toContain("Order receipt");
    expect(html).toContain("<title>Receipt ORD-9K2F-2208");
  });

  it("says 'received' and promises confirmation for an unpaid order", () => {
    const html = buildOrderPdfHtml({ ...order, status: "awaiting_payment", paidAt: null });
    expect(html).toContain("Order received");
    expect(html).toContain("Awaiting Payment");
    expect(html).not.toContain("provisioning has begun");
  });

  it("omits the billing address for confirmation-token access", () => {
    const full = buildOrderPdfHtml(order);
    expect(full).toContain("100 Main St");
    expect(full).toContain("Chandler, AZ 85225");
    const redacted = buildOrderPdfHtml(order, { redactBillingAddress: true });
    expect(redacted).not.toContain("100 Main St");
    expect(redacted).not.toContain("Chandler");
    expect(redacted).toContain("accounts@meridian.com");
  });

  it("HTML-escapes every user-supplied field", () => {
    const html = buildOrderPdfHtml({
      ...order,
      billingCompany: `<img src=x onerror=alert(1)>`,
      lineItems: [{ name: `<script>bad()</script>`, sku: `"><b>`, quantity: 1, unitPrice: 1, total: 1 }],
    });
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>bad()");
    expect(html).toContain("&lt;script&gt;bad()");
    expect(html).not.toContain('"><b>');
  });

  it("tolerates missing lines, unknown pricing types and nullish money", () => {
    const html = buildOrderPdfHtml({ orderNumber: "ORD-1", lineItems: undefined, total: null });
    expect(html).toContain("No line items are recorded on this order.");
    expect(html).toContain("$0.00");
    const unknown = buildOrderPdfHtml({ ...order, lineItems: [{ name: "Legacy", pricingType: "weird" }] });
    expect(unknown).toContain("Legacy");
    expect(unknown).not.toContain('class="chip');
  });
});

describe("account team", () => {
  it("shows the assigned account manager and the sales department", () => {
    const html = buildOrderPdfHtml(order, { accountTeam: accountTeamFor("joe-petro") });
    expect(html).toContain("Your account manager");
    expect(html).toContain("Joseph Petro");
    expect(html).toContain("Founder &amp; Account Manager");
    expect(html).toContain("Sales department");
    expect(html).toContain("sales@digerati-experts.com");
  });

  it("falls back to the default team when none is passed", () => {
    expect(buildOrderPdfHtml(order)).toContain("Joseph Petro");
  });
});

describe("helpers", () => {
  it("formats money with grouping and two decimals", () => {
    expect(usd(1234.5)).toBe("$1,234.50");
    expect(usd("2450")).toBe("$2,450.00");
    expect(usd(undefined)).toBe("$0.00");
  });

  it("builds a filesystem-safe file base", () => {
    expect(orderPdfFileBase({ orderNumber: "ORD-9K2F/2208" }, "receipt")).toBe("DE-receipt-ORD-9K2F2208");
    expect(orderPdfFileBase({ id: "abc" }, "confirmation")).toBe("DE-order-abc");
  });

  it("embeds the self-hosted brand fonts", () => {
    const css = brandFontFaceCss();
    expect(css).toContain('font-family:"Inter"');
    expect(css).toContain('font-family:"Space Grotesk"');
    expect(css).toContain('font-family:"Plex Mono"');
    // Static TTF instances: variable fonts embed as Type 3 in Chromium.
    expect(css).toContain("data:font/ttf;base64,");
    expect(css).not.toContain("woff2");
  });
});
