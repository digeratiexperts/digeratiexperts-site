import { describe, expect, it } from "vitest";
import { getPricingFooterText, pricingTiers } from "./pricing";
import {
  getContractOnlyStoreProducts,
  getRelatedStoreProducts,
  getStoreProductBySku,
  storeCatalogProducts,
} from "./storeCatalog";
import { rawStoreProducts } from "./storeProducts";
import { getProductBySku, getRelatedProducts } from "./storeMerchandising";

const PROACTIVE_SKUS = [
  "DE-SVC-MGD-IT-MO",
  "DE-SVC-MGD-OFFICE-MO",
  "DE-SVC-MGD-BUSINESS-MO",
  "DE-SVC-MGD-ENTERPRISE-MO",
] as const;

describe("public Store catalog", () => {
  it("publishes all four ProActive tiers from canonical pricing", () => {
    const proactive = getContractOnlyStoreProducts().filter((product) =>
      product.name.startsWith("ProActive Ecosystem"),
    );

    expect(proactive.map((product) => product.sku)).toEqual(PROACTIVE_SKUS);
    expect(proactive.map((product) => product.basePrice)).toEqual(
      pricingTiers.map((tier) => tier.user),
    );
    expect(
      proactive.filter((product) => product.isRecommended).map((product) => product.sku),
    ).toEqual(["DE-SVC-MGD-OFFICE-MO"]);
    expect(getPricingFooterText()).toContain("IT $1,600");
    expect(getPricingFooterText()).toContain("Office $2,400");
    expect(getPricingFooterText()).toContain("Business $5,400");
    expect(getPricingFooterText()).toContain("Enterprise $9,000");
  });

  it("keeps managed tiers contract-only and non-checkout", () => {
    const proactive = storeCatalogProducts.filter((product) =>
      product.name.startsWith("ProActive Ecosystem"),
    );

    expect(proactive).toHaveLength(4);
    for (const product of proactive) {
      expect(product.isContractOnly).toBe(true);
      expect(product.isCheckoutEnabled).toBe(false);
    }
  });

  it("uses defensible recovery-objective language for public BCDR", () => {
    const bcdr = getStoreProductBySku("DE-SVC-MGD-BCDR-MO");
    expect(bcdr).toBeDefined();
    expect(bcdr?.features).toContain("Contract-Defined RTO/RPO Objectives");
    expect(bcdr?.features.join(" ")).not.toMatch(/RTO\/RPO Guarantees/i);
    expect(bcdr?.description).not.toMatch(/ensuring your business can recover from any disruption/i);
  });

  it("removes superseded ProActive entries and guarantee copy from raw product data", () => {
    expect(rawStoreProducts.some((product) => product.name.startsWith("ProActive Ecosystem"))).toBe(
      false,
    );
    expect(JSON.stringify(rawStoreProducts)).not.toMatch(/RTO\/RPO Guarantees/i);
  });

  it("resolves every managed tier through detail and related-product lookups", () => {
    for (const sku of PROACTIVE_SKUS) {
      const product = getStoreProductBySku(sku);
      expect(product, sku).toBeDefined();
      expect(getProductBySku(sku), sku).toEqual(product);

      const catalogRelated = getRelatedStoreProducts(product!, false);
      const merchandisingRelated = getRelatedProducts(product!, {
        limit: 4,
        excludeClientOnly: true,
      });
      expect(catalogRelated.length, sku).toBeGreaterThan(0);
      expect(merchandisingRelated.length, sku).toBeGreaterThan(0);
      for (const related of [...catalogRelated, ...merchandisingRelated]) {
        expect(getStoreProductBySku(related.sku), related.sku).toBeDefined();
      }
    }
  });
});
