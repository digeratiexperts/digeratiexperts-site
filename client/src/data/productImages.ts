/**
 * Store / site product imagery resolver.
 *
 * Assets:
 * - Meshy heroes: /images/meshy/{categories,outcomes,site}/ (preferred when present)
 * - Branded PNG fallbacks: /images/store/{categories,outcomes,site}/
 * Category PNG heroes + vendor logos. MESHY_API_KEY stays server-side only.
 * Populate skuImageOverrides when richer product art arrives.
 */

import type { ProductCategory, StoreProduct } from "./storeProducts";
import {
  getVendorForSku,
  inferVendorFromText,
  vendorLogoUrl,
} from "./vendorLogos";
import type { StoreOutcomeId } from "./storeMerchandising";

export const STORE_IMAGE_BASE = "/images/store";
export const MESHY_IMAGE_BASE = "/images/meshy";

/**
 * Every PNG under images/meshy and images/store has a same-name .webp sibling
 * (generated 2026-09-13 with sharp, q80, heroes ≤1600 px, cards ≤960 px):
 * 38.6 MB of PNG → 1.2 MB. The PNGs stay on disk for the SEO/og image and
 * as the source of truth; the UI loads the WebP.
 */
export const STORE_IMAGE_EXT = ".webp";
/** Social crawlers still prefer PNG/JPEG for og:image. */
export const STORE_OG_IMAGE_EXT = ".png";

export function toOgImageUrl(url: string): string {
  return url.endsWith(STORE_IMAGE_EXT) ? url.slice(0, -STORE_IMAGE_EXT.length) + STORE_OG_IMAGE_EXT : url;
}

export type ProductVisualSource =
  | "product"
  | "sku_override"
  | "meshy"
  | "category";

export type ProductVendorMark = {
  slug: string;
  name: string;
  logoUrl: string;
};

/** Shape consumed by ProductMedia + product detail SEO image. */
export type ProductVisual = {
  heroUrl: string;
  cardUrl: string;
  logoUrl: string | null;
  vendor: ProductVendorMark | null;
  source: ProductVisualSource;
  alt: string;
};

/** Slots successfully generated via Meshy text-to-image (see images/meshy/manifest.json). */
const MESHY_CATEGORY_IDS = new Set<ProductCategory>([
  "contract_services",
  "comanaged_subscriptions",
  "comanaged_onboarding",
  "networking_managed",
  "networking_projects",
  "ucaas_subscriptions",
  "ucaas_setup",
  "hardware_provisioning",
  "hardware_physical",
  "hardware_handling",
  "digital_assessments",
  "digital_templates",
  "digital_training",
  "professional_services",
]);

const MESHY_OUTCOME_IDS = new Set<string>([
  "protect",
  "modernize",
  "compliance",
  "recover",
  "support_it",
  "outsource",
  "secure_remote",
]);

/** New taxonomy ids reuse existing Meshy art until dedicated assets exist. */
const OUTCOME_IMAGE_ALIAS: Partial<Record<StoreOutcomeId, string>> = {
  communicate: "modernize",
  operate: "support_it",
};

function outcomeImageId(outcomeId: StoreOutcomeId): string {
  return OUTCOME_IMAGE_ALIAS[outcomeId] ?? outcomeId;
}

const MESHY_SITE_IDS = new Set<string>([
  "trust-security",
  "trust-microsoft",
  "trust-audit",
  "pricing-ecosystem",
]);

function meshyHero(dir: string, id: string): string {
  return `${MESHY_IMAGE_BASE}/${dir}/${id}${STORE_IMAGE_EXT}`;
}

function meshyCard(dir: string, id: string): string {
  return `${MESHY_IMAGE_BASE}/${dir}/${id}-card${STORE_IMAGE_EXT}`;
}

export function categoryHeroUrl(category: ProductCategory): string {
  if (MESHY_CATEGORY_IDS.has(category)) {
    return meshyHero("categories", category);
  }
  return `${STORE_IMAGE_BASE}/categories/${category}${STORE_IMAGE_EXT}`;
}

export function categoryCardUrl(category: ProductCategory): string {
  if (MESHY_CATEGORY_IDS.has(category)) {
    return meshyCard("categories", category);
  }
  return `${STORE_IMAGE_BASE}/categories/${category}-card${STORE_IMAGE_EXT}`;
}

export function outcomeIconUrl(outcomeId: StoreOutcomeId): string {
  const imageId = outcomeImageId(outcomeId);
  if (MESHY_OUTCOME_IDS.has(imageId)) {
    return meshyHero("outcomes", imageId);
  }
  return `${STORE_IMAGE_BASE}/outcomes/${imageId}${STORE_IMAGE_EXT}`;
}

export function outcomeCardUrl(outcomeId: StoreOutcomeId): string {
  const imageId = outcomeImageId(outcomeId);
  if (MESHY_OUTCOME_IDS.has(imageId)) {
    return meshyCard("outcomes", imageId);
  }
  return `${STORE_IMAGE_BASE}/outcomes/${imageId}-card${STORE_IMAGE_EXT}`;
}

function siteAccentUrl(id: string): string {
  if (MESHY_SITE_IDS.has(id)) {
    return meshyHero("site", id);
  }
  return `${STORE_IMAGE_BASE}/site/${id}${STORE_IMAGE_EXT}`;
}

export const siteAccentImages = {
  trustSecurity: siteAccentUrl("trust-security"),
  trustMicrosoft: siteAccentUrl("trust-microsoft"),
  trustAudit: siteAccentUrl("trust-audit"),
  pricingEcosystem: siteAccentUrl("pricing-ecosystem"),
} as const;

/** Optional per-SKU hero overrides when Meshy/custom art ships. */
export const skuImageOverrides: Partial<Record<string, string>> = {};

type ProductImageInput = Pick<
  StoreProduct,
  "sku" | "category" | "name" | "shortDescription" | "description" | "features"
> & { imageUrl?: string };

function resolveVendor(product: ProductImageInput): ProductVendorMark | null {
  return (
    getVendorForSku(product.sku, product.category) ||
    inferVendorFromText(
      `${product.name} ${product.shortDescription} ${product.description} ${product.features.join(" ")}`
    )
  );
}

/** Primary resolver — never blank; every product gets branded category media. */
export function getProductVisual(product: ProductImageInput): ProductVisual {
  const vendor = resolveVendor(product);
  const override = skuImageOverrides[product.sku];
  const custom = product.imageUrl;
  const usesMeshy = MESHY_CATEGORY_IDS.has(product.category);

  if (custom) {
    return {
      heroUrl: custom,
      cardUrl: custom,
      logoUrl: vendor?.logoUrl ?? null,
      vendor,
      source: "product",
      alt: `${product.name} product image`,
    };
  }

  if (override) {
    return {
      heroUrl: override,
      cardUrl: override,
      logoUrl: vendor?.logoUrl ?? null,
      vendor,
      source: "sku_override",
      alt: vendor
        ? `${product.name} — ${vendor.name}`
        : `${product.name} — Digerati Experts`,
    };
  }

  return {
    heroUrl: categoryHeroUrl(product.category),
    cardUrl: categoryCardUrl(product.category),
    logoUrl: vendor?.logoUrl ?? null,
    vendor,
    source: usesMeshy ? "meshy" : "category",
    alt: vendor
      ? `${product.name} — ${vendor.name}`
      : `${product.name} — Digerati Experts`,
  };
}

/** Alias used by cards/detail — same as getProductVisual. */
export function getProductImage(product: ProductImageInput): ProductVisual {
  return getProductVisual(product);
}

export function getProductVendorMarkUrl(
  sku: string,
  category?: ProductCategory
): string | null {
  const v = getVendorForSku(sku, category);
  return v ? vendorLogoUrl(v.slug) : null;
}
