import { describe, expect, it } from "vitest";
import { storeProductCategoryEnum } from "./schema";
import {
  parseTaxCodeOverrides,
  STORE_TAX_CODE_PENDING,
  STORE_TAX_CODES,
  STRIPE_GENERAL_SERVICES,
  storeTaxCode,
} from "./storeTaxCodes";

// Recurring and shipped categories never reach Pay Now (server/secureStoreCheckout.ts).
const QUOTE_ONLY = new Set(["comanaged_subscriptions", "networking_managed", "ucaas_subscriptions", "hardware_physical"]);

describe("Stripe Tax codes for Store categories", () => {
  it("decides every Pay Now category: a confirmed code, or quote until one is confirmed", () => {
    for (const category of storeProductCategoryEnum.enumValues) {
      if (QUOTE_ONLY.has(category)) continue;
      const coded = !!STORE_TAX_CODES[category];
      const pending = STORE_TAX_CODE_PENDING.has(category);
      expect({ category, decided: coded !== pending }).toEqual({ category, decided: true });
    }
  });

  it("uses only Stripe-shaped codes", () => {
    for (const code of Object.values(STORE_TAX_CODES)) expect(code).toMatch(/^txcd_\d{8}$/);
    expect(STRIPE_GENERAL_SERVICES).toBe("txcd_20030000");
  });

  it("lets STRIPE_TAX_CODES add a code without a deploy, and ignores anything malformed", () => {
    expect(parseTaxCodeOverrides(undefined)).toEqual({});
    expect(parseTaxCodeOverrides("{not json")).toEqual({});
    expect(parseTaxCodeOverrides('["txcd_12345678"]')).toEqual({});
    const overrides = parseTaxCodeOverrides('{"digital_templates":"txcd_12345678","digital_training":"txcd_1"}');
    expect(storeTaxCode("digital_templates", overrides)).toBe("txcd_12345678");
    expect(storeTaxCode("digital_training", overrides)).toBeNull();
    expect(storeTaxCode("professional_services", overrides)).toBe(STRIPE_GENERAL_SERVICES);
  });
});
