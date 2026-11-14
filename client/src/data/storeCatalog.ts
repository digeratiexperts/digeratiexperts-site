import {
  categoryLabels,
  formatPrice,
  storeProducts,
  type ProductCategory,
  type StoreProduct,
} from "./storeProducts";

/**
 * Public Store catalog view.
 *
 * ProActive managed tiers are derived from the canonical pricing module rather
 * than duplicated Store numbers. Raw Store data contains only non-ProActive
 * products, so public promises are defined once at their source.
 */
export const storeCatalogProducts = storeProducts;

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
