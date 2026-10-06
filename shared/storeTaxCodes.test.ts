import { describe, expect, it } from "vitest";
import { storeProductCategoryEnum } from "./schema";
import {
  parseTaxItemOverrides,
  STORE_SERVICE_TAX_CATEGORIES,
  STORE_TAX_CODE_PENDING,
  storeTaxItem,
} from "./storeTaxCodes";

// Recurring and shipped categories never reach Pay Now (server/secureStoreCheckout.ts).
const QUOTE_ONLY = new Set(["comanaged_subscriptions", "networking_managed", "ucaas_subscriptions", "hardware_physical"]);
const SERVICE_ITEM = "1957016000000123456";

describe("Zoho Books tax items for Store categories", () => {
  it("decides every Pay Now category: the Books service item, or quote until an item is confirmed", () => {
    for (const category of storeProductCategoryEnum.enumValues) {
      if (QUOTE_ONLY.has(category)) continue;
      const service = STORE_SERVICE_TAX_CATEGORIES.has(category);
      const pending = STORE_TAX_CODE_PENDING.has(category);
      expect({ category, decided: service !== pending }).toEqual({ category, decided: true });
    }
  });

  it("maps services to the Books service item and nothing without one", () => {
    expect(storeTaxItem("professional_services", SERVICE_ITEM)).toBe(SERVICE_ITEM);
    expect(storeTaxItem("professional_services", null)).toBeNull();
    expect(storeTaxItem("digital_templates", SERVICE_ITEM)).toBeNull();
  });

  it("lets ZOHO_BOOKS_TAX_ITEMS add an item without a deploy, and ignores anything malformed", () => {
    expect(parseTaxItemOverrides(undefined)).toEqual({});
    expect(parseTaxItemOverrides("{not json")).toEqual({});
    expect(parseTaxItemOverrides('["1957016000000999999"]')).toEqual({});
    const overrides = parseTaxItemOverrides('{"digital_templates":"1957016000000999999","digital_training":"abc"}');
    expect(storeTaxItem("digital_templates", SERVICE_ITEM, overrides)).toBe("1957016000000999999");
    expect(storeTaxItem("digital_training", SERVICE_ITEM, overrides)).toBeNull();
    expect(storeTaxItem("professional_services", SERVICE_ITEM, overrides)).toBe(SERVICE_ITEM);
  });
});
