import type { StoreProduct } from "./schema";

/**
 * Which Zoho Books item carries each Store category's sales tax for staff Pay
 * Now (2026-10-05, Joe: "yes switch to zoho books").
 *
 * Zoho Books Sales Tax Automation decides taxability and rates from the tax
 * category on a Books item; this file only says which Store categories are
 * people-delivered services. Those use one Books service item, named on the
 * server in ZOHO_BOOKS_SERVICE_ITEM_ID, whose tax category Joe sets in Books.
 *
 * Categories with no confirmed Books item stay quote-only for Pay Now: the
 * server answers TAX_RATE_UNAVAILABLE and checkout steps aside to Request
 * Quote. A category can be given its own Books item without a deploy through
 * ZOHO_BOOKS_TAX_ITEMS, a JSON object of category -> Books item id.
 */

export type StoreCategory = StoreProduct["category"];

/** People-delivered services: engineering, onboarding, setup and consulting labour. */
export const STORE_SERVICE_TAX_CATEGORIES: ReadonlySet<StoreCategory> = new Set<StoreCategory>([
  "contract_services",
  "comanaged_onboarding",
  "networking_projects",
  "ucaas_setup",
  "hardware_provisioning",
  "professional_services",
]);

/**
 * No confirmed Books item yet, so no guess: self-serve digital products,
 * downloadable templates, online training, and handling fees tied to shipped
 * hardware.
 */
export const STORE_TAX_CODE_PENDING: ReadonlySet<StoreCategory> = new Set<StoreCategory>([
  "digital_assessments",
  "digital_templates",
  "digital_training",
  "hardware_handling",
]);

/** Zoho Books record ids are long runs of digits. */
export const BOOKS_ID_PATTERN = /^\d{6,25}$/;

/** Parses ZOHO_BOOKS_TAX_ITEMS. Malformed JSON or ids are ignored, never guessed. */
export function parseTaxItemOverrides(raw: string | undefined): Partial<Record<StoreCategory, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const overrides: Partial<Record<StoreCategory, string>> = {};
    for (const [category, itemId] of Object.entries(parsed)) {
      if (typeof itemId === "string" && BOOKS_ID_PATTERN.test(itemId)) {
        overrides[category as StoreCategory] = itemId;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

/** The Books item whose tax category applies to this Store category, or null (quote-only). */
export function storeTaxItem(
  category: StoreCategory,
  serviceItemId: string | null,
  overrides: Partial<Record<StoreCategory, string>> = {},
): string | null {
  if (overrides[category]) return overrides[category]!;
  if (serviceItemId && STORE_SERVICE_TAX_CATEGORIES.has(category)) return serviceItemId;
  return null;
}
