import {
  categoryLabels,
  formatPrice,
  storeProducts as rawStoreProducts,
  type ProductCategory,
  type StoreProduct,
} from "./storeProducts";
import { pricingTiers, type ProActiveTierKey } from "./pricing";
import { isGcchStoreItem } from "@shared/gcchPricingHold";

const PROACTIVE_SKUS: Record<ProActiveTierKey, { id: string; sku: string }> = {
  it: { id: "prod-000", sku: "DE-SVC-MGD-IT-MO" },
  office: { id: "prod-001", sku: "DE-SVC-MGD-OFFICE-MO" },
  business: { id: "prod-002", sku: "DE-SVC-MGD-BUSINESS-MO" },
  enterprise: { id: "prod-003", sku: "DE-SVC-MGD-ENTERPRISE-MO" },
};

const proactiveProducts: StoreProduct[] = pricingTiers.map((tier, index) => holdGcchCheckout({
  id: PROACTIVE_SKUS[tier.id].id,
  sku: PROACTIVE_SKUS[tier.id].sku,
  name: `ProActive Ecosystem - ${tier.name}`,
  shortDescription: tier.idealBuyer,
  description: tier.note,
  category: "contract_services",
  pricingType: "per_user",
  basePrice: tier.user,
  pricingUnit: "user",
  isContractOnly: true,
  isCheckoutEnabled: false,
  isClientOnly: false,
  requiredClientType: "public",
  minimumQuantity: 1,
  features: [...tier.inclusions],
  sortOrder: index,
}));

function holdGcchCheckout(product: StoreProduct): StoreProduct {
  if (!isGcchStoreItem(product)) return product;
  return {
    ...product,
    isCheckoutEnabled: false,
    isContractOnly: true,
  };
}

function sanitizePublicPromises(product: StoreProduct): StoreProduct {
  if (product.sku !== "DE-SVC-MGD-BCDR-MO") return product;

  return {
    ...product,
    description:
      "Managed business continuity and disaster recovery services designed to improve recovery readiness and reduce disruption risk.",
    features: product.features.map((feature) =>
      feature === "RTO/RPO Guarantees" ? "Contract-Defined RTO/RPO Objectives" : feature,
    ),
  };
}

const nonProactiveProducts = rawStoreProducts
  .filter((product) => !product.name.startsWith("ProActive Ecosystem"))
  .map(sanitizePublicPromises)
  .map(holdGcchCheckout);

/**
 * Public Store catalog view.
 *
 * ProActive managed tiers are derived from the canonical pricing module rather
 * than duplicated Store numbers. Other products retain their existing Store
 * definitions, with public-facing promise language normalized here.
 */
export const storeCatalogProducts: StoreProduct[] = [
  ...proactiveProducts,
  ...nonProactiveProducts,
].sort((a, b) => a.sortOrder - b.sortOrder);

export const getStoreProductBySku = (sku: string | undefined): StoreProduct | undefined =>
  storeCatalogProducts.find((product) => product.sku === sku);

export const getContractOnlyStoreProducts = (): StoreProduct[] =>
  storeCatalogProducts.filter((product) => product.isContractOnly);

export const getRelatedStoreProducts = (
  product: StoreProduct,
  includeClientOnly: boolean,
  limit = 4,
): StoreProduct[] =>
  storeCatalogProducts
    .filter(
      (candidate) =>
        candidate.category === product.category &&
        candidate.id !== product.id &&
        (includeClientOnly || !candidate.isClientOnly),
    )
    .slice(0, limit);

export { categoryLabels, formatPrice };
export type { ProductCategory, StoreProduct };