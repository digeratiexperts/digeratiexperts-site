import { describe, expect, it } from "vitest";
import { buildPendingStoreOrderValues } from "./storePendingOrder";

describe("pending Store order canonicalization", () => {
  it("ignores browser prices, totals, and paid status", () => {
    const values = buildPendingStoreOrderValues({
      orderNumber: "ORD-TEST",
      userId: "user-live",
      clientId: "client-live",
      role: "comanaged",
      body: {
        status: "paid",
        subtotal: 0.01,
        total: 0.01,
        paymentMethod: "quote_request",
        billing: {
          name: "Buyer",
          email: "BUYER@example.com",
          company: "Example Co",
        },
        lineItems: [
          {
            productId: "prod-020",
            sku: "DE-SVC-CM-ONBOARD-S-OT",
            quantity: 1,
            unitPrice: 0.01,
            total: 0.01,
          },
        ],
      },
    });

    expect(values.status).toBe("pending");
    expect(values.userId).toBe("user-live");
    expect(values.clientId).toBe("client-live");
    expect(values.billingEmail).toBe("buyer@example.com");
    expect(values.lineItems[0].unitPrice).toBe(750);
    expect(values.lineItems[0].total).toBe(750);
    expect(values.subtotal).toBe("750.00");
    expect(values.total).toBe("750.00");
    expect(values.tax).toBeNull();
  });

  it("applies the same server-side client override model as paid checkout", () => {
    const values = buildPendingStoreOrderValues({
      orderNumber: "ORD-OVERRIDE",
      role: "comanaged",
      priceOverrides: { "prod-020": 600 },
      body: {
        billing: { name: "Buyer", email: "buyer@example.com" },
        lineItems: [
          {
            productId: "prod-020",
            sku: "DE-SVC-CM-ONBOARD-S-OT",
            quantity: 2,
            unitPrice: 1,
          },
        ],
      },
    });

    expect(values.lineItems[0].unitPrice).toBe(600);
    expect(values.lineItems[0].total).toBe(1200);
    expect(values.total).toBe("1200.00");
  });

  it("rejects mismatched catalog identity instead of trusting the browser", () => {
    expect(() =>
      buildPendingStoreOrderValues({
        orderNumber: "ORD-BAD",
        role: "comanaged",
        body: {
          billing: { name: "Buyer", email: "buyer@example.com" },
          lineItems: [
            {
              productId: "prod-020",
              sku: "FAKE-SKU",
              quantity: 1,
            },
          ],
        },
      }),
    ).toThrow(/Unknown or mismatched store product/);
  });
});
