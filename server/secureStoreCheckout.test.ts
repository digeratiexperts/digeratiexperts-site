import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  canonicalCheckoutTotal,
  canonicalizeCheckoutLineItems,
} from "./secureStoreCheckout";

describe("secure store checkout canonicalization", () => {
  it("uses trusted catalog price even when the browser supplies a cheaper price", () => {
    const items = canonicalizeCheckoutLineItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        name: "Fake browser name",
        quantity: 2,
        unitPrice: 0.01,
        total: 0.02,
      },
    ], "comanaged");

    expect(items).toEqual([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        name: "Co-Managed Endpoint Management",
        quantity: 2,
        unitPrice: 39,
        pricingType: "per_endpoint",
        total: 78,
      },
    ]);
    expect(canonicalCheckoutTotal(items)).toBe(78);
  });

  it("rejects contract-only managed products from online checkout", () => {
    expect(() => canonicalizeCheckoutLineItems([
      {
        productId: "prod-001",
        sku: "DE-SVC-MGD-OFFICE-MO",
        quantity: 1,
      },
    ], "admin")).toThrow(/not eligible for online checkout/i);
  });

  it("rejects a product ID and SKU mismatch", () => {
    expect(() => canonicalizeCheckoutLineItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-EDR-MO",
        quantity: 1,
      },
    ], "comanaged")).toThrow(/unknown or mismatched store product/i);
  });

  it("honors a server-side client list price below catalog", () => {
    const items = canonicalizeCheckoutLineItems(
      [
        {
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 2,
          unitPrice: 0.01,
        },
      ],
      "comanaged",
      { "prod-010": 30 },
    );

    expect(items[0].unitPrice).toBe(30);
    expect(items[0].total).toBe(60);
    expect(canonicalCheckoutTotal(items)).toBe(60);
  });

  it("keeps catalog price when no client override is present", () => {
    const items = canonicalizeCheckoutLineItems(
      [
        {
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 1,
        },
      ],
      "comanaged",
    );
    expect(items[0].unitPrice).toBe(39);
  });

  it("rejects invalid quantities", () => {
    expect(() => canonicalizeCheckoutLineItems([
      {
        productId: "prod-010",
        sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
        quantity: 0,
      },
    ], "comanaged")).toThrow(/invalid quantity/i);
  });
});

describe("secure store checkout cancel target", () => {
  it("cancels to the staff checkout, never the public Door 2 alias (§1, §5.3)", () => {
    // The Zoho hosted checkout is started only by the staff checkout page (role-gated). A cancel must return there.
    const src = readFileSync(path.resolve(import.meta.dirname, "secureStoreCheckout.ts"), "utf8");
    expect(src).toContain("cancelUrl: `${baseUrl}/internal/warehouse/checkout`");
    expect(src).not.toMatch(/cancelUrl:\s*`\$\{baseUrl\}\/store\/checkout`/);
  });
});
