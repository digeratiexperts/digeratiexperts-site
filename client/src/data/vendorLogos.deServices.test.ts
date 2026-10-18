import { describe, expect, it } from "vitest";
import { storeProducts } from "./storeProducts";
import { getProductVendorMarkUrl, getProductVisual } from "./productImages";
import { getProductVendorName, getProductVendorSlug, listVendorsForProducts } from "./storeMerchandising";
import {
  deOwnedServiceSkus,
  getVendorForSku,
  internalSecurityProviderSlugs,
  resolveVendorSlug,
  skuVendorMap,
} from "./vendorLogos";

/**
 * #226: DE-owned managed security is sold as DE Security Foundation / Managed
 * Threat Protection. Guardz (primary) and Blackpoint (alternate) are internal
 * providers and must not appear as a Store mark, logo, alt text or vendor badge.
 */
const providerPattern = /guardz|blackpoint/i;

describe("DE-owned Store services carry no third-party provider mark (#226)", () => {
  it("covers the managed security tiers", () => {
    for (const sku of ["DE-SVC-MGD-BUSINESS-MO", "DE-SVC-MGD-ENTERPRISE-MO", "DE-SVC-MGD-CYBER-MO"]) {
      expect(deOwnedServiceSkus.has(sku), sku).toBe(true);
    }
  });

  it("every DE-owned SKU is a real catalog product", () => {
    const catalogSkus = new Set(storeProducts.map((p) => p.sku));
    for (const sku of Array.from(deOwnedServiceSkus)) expect(catalogSkus.has(sku), sku).toBe(true);
  });

  it("DE-owned services fall back to the DE mark (no vendor, no logo)", () => {
    for (const product of storeProducts.filter((p) => deOwnedServiceSkus.has(p.sku))) {
      expect(getVendorForSku(product.sku, product.category), product.sku).toBeNull();
      expect(resolveVendorSlug(product.sku, product.category), product.sku).toBeNull();
      expect(getProductVendorMarkUrl(product.sku, product.category), product.sku).toBeNull();
      expect(getProductVendorSlug(product), product.sku).toBeNull();
      expect(getProductVendorName(product), product.sku).toBeNull();
      const visual = getProductVisual(product);
      expect(visual.vendor, product.sku).toBeNull();
      expect(visual.logoUrl, product.sku).toBeNull();
      expect(visual.alt).toBe(`${product.name} — Digerati Experts`);
    }
  });

  it("does not infer a provider from DE-owned service copy", () => {
    const product = storeProducts.find((p) => p.sku === "DE-SVC-MGD-CYBER-MO")!;
    const polluted = { ...product, description: `${product.description} Blackpoint Guardz Huntress` };
    expect(getProductVisual(polluted).vendor).toBeNull();
  });

  it("no Store product resolves to a Guardz or Blackpoint mark", () => {
    for (const product of storeProducts) {
      const visual = getProductVisual(product);
      const slug = visual.vendor?.slug ?? "";
      expect(internalSecurityProviderSlugs.has(slug), product.sku).toBe(false);
      expect(`${visual.vendor?.name ?? ""} ${visual.logoUrl ?? ""} ${visual.alt}`, product.sku).not.toMatch(providerPattern);
      expect(getProductVendorMarkUrl(product.sku, product.category) ?? "", product.sku).not.toMatch(providerPattern);
    }
    expect(listVendorsForProducts(storeProducts).map((v) => v.slug)).not.toEqual(
      expect.arrayContaining(["guardz"]),
    );
    expect(listVendorsForProducts(storeProducts).map((v) => v.slug)).not.toEqual(
      expect.arrayContaining(["blackpoint"]),
    );
  });

  it("the SKU map assigns no internal security provider", () => {
    for (const [sku, slug] of Object.entries(skuVendorMap)) {
      expect(internalSecurityProviderSlugs.has(slug), sku).toBe(false);
    }
  });
});
