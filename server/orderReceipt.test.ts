import { describe, expect, it } from "vitest";

import {
  orderReceiptFilename,
  renderOrderReceiptHtml,
} from "./orderReceipt";

describe("order receipt rendering", () => {
  it("escapes all order-controlled HTML and includes a restrictive CSP", () => {
    const html = renderOrderReceiptHtml({
      orderNumber: '\"><script>alert(1)</script>',
      createdAt: "2026-08-23T00:00:00.000Z",
      status: '<img src=x onerror="alert(2)">',
      lineItems: [{
        name: "<svg onload=alert(3)>",
        sku: "</td><script>alert(4)</script>",
        quantity: "<b>9</b>",
        unitPrice: "not-money",
        total: 12.5,
      }],
      subtotal: 12.5,
      tax: 0,
      total: 12.5,
      billingName: "<script>alert(5)</script>",
      billingCompany: '<img src=x onerror="alert(6)">',
      billingEmail: "customer@example.com<script>alert(7)</script>",
      billingAddress: { street: "<iframe src=x>", city: "Mesa<script>", state: "AZ", zipCode: "85201" },
    }, "(325) 480-9870");

    expect(html).toContain("default-src 'none'");
    expect(html).not.toMatch(/<(?:script|img|svg|iframe)\b/i);
    expect(html).toContain("&lt;script&gt;alert(5)&lt;/script&gt;");
    expect(html).toContain("$0.00");
  });

  it("makes a header-safe, bounded receipt filename", () => {
    const filename = orderReceiptFilename('DE-123\r\nContent-Type: text/html/../../evil');
    expect(filename).toBe("receipt-DE-123_Content-Type_text_html_.._.._evil.html");
    expect(filename).not.toMatch(/[\r\n"/\\]/);
    expect(orderReceiptFilename("x".repeat(200)).length).toBeLessThanOrEqual(93);
  });
});
