import { describe, expect, it } from "vitest";
import { storeCatalogProducts } from "../client/src/data/storeCatalog";
import { storeProducts } from "../client/src/data/storeProducts";
import { pricing, pricingTiers } from "../client/src/data/pricing";
import {
  GCCH_CHECKOUT_BLOCKED_MESSAGE,
  GCCH_PRICING_HOLD_HREF,
  GCCH_PRICING_HOLD_LABEL,
  containsHeldGcchDollarPrice,
  findHeldGcchPricingViolations,
  isGcchOfferingText,
  isGcchStoreItem,
} from "./gcchPricingHold";

describe("GCC High pricing hold", () => {
  it("keeps the public hold label and contact path", () => {
    expect(GCCH_PRICING_HOLD_LABEL).toBe("Pricing after eligibility review");
    expect(GCCH_PRICING_HOLD_HREF).toBe("/contact");
    expect(GCCH_CHECKOUT_BLOCKED_MESSAGE).toMatch(/not available for online purchase/i);
    expect(GCCH_CHECKOUT_BLOCKED_MESSAGE).not.toMatch(/resell/i);
  });

  it("recognizes GCC High offering text and SKUs", () => {
    expect(isGcchOfferingText("ProActive Business GCC High")).toBe(true);
    expect(isGcchOfferingText("Enterprise GCC High")).toBe(true);
    expect(isGcchStoreItem({ sku: "DE-SVC-MGD-BUSINESS-GCCH-MO" })).toBe(true);
    expect(isGcchStoreItem({ sku: "DE-SVC-MGD-ENTERPRISE-GCC-HIGH-MO" })).toBe(true);
    expect(isGcchStoreItem({ sku: "DE-SVC-MGD-OFFICE-MO", name: "ProActive Office" })).toBe(false);
  });

  it("detects held dollar prices only in GCC High context", () => {
    expect(
      containsHeldGcchDollarPrice("Regulated GCC High paths start at $425 and $575."),
    ).toBe(true);
    expect(containsHeldGcchDollarPrice("Business GCCH | $425/user | $7,500")).toBe(true);
    expect(containsHeldGcchDollarPrice("Enterprise GCCH | $575/user | $12,500")).toBe(true);
    expect(containsHeldGcchDollarPrice("Office is $165/user and Business is $245/user")).toBe(false);
    expect(containsHeldGcchDollarPrice("OCR Settlement Includes $112,500 Payment")).toBe(false);

    expect(
      findHeldGcchPricingViolations(
        "Four ProActive tiers. Office $165. Regulated GCC High paths start at $425 and $575.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      findHeldGcchPricingViolations("Office is $165/user and Business is $245/user."),
    ).toEqual([]);
  });

  it("does not publish a numeric GCC High price on canonical pricing or store catalogs", () => {
    const offerings = [
      ...pricingTiers,
      ...Object.values(pricing),
      ...storeCatalogProducts,
      ...storeProducts,
    ];

    for (const offering of offerings) {
      const record = offering as Record<string, unknown>;
      const text = [record.id, record.sku, record.name, record.label, record.fullName, record.description, record.shortDescription]
        .filter((value) => typeof value === "string")
        .join(" ");
      if (!isGcchOfferingText(text)) continue;

      expect(record.isCheckoutEnabled, text).not.toBe(true);
      const amounts = [record.user, record.basePrice, record.monthlyMinimum, record.siteMin];
      for (const amount of amounts) {
        if (typeof amount === "number" && amount > 0) {
          throw new Error(`GCC High offering still carries a published price (${amount}): ${text}`);
        }
      }
    }
  });
});
