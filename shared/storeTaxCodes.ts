import type { StoreProduct } from "./schema";

/**
 * Stripe Tax product tax codes for the staff Pay Now path (2026-10-03).
 *
 * Stripe Tax decides taxability and rates from the code; this file only says
 * what each Store category is. A code appears here only when a published Stripe
 * source confirmed it: txcd_20030000 is "General - Services".
 *
 * Categories without a confirmed code stay quote-only for Pay Now: the server
 * answers TAX_RATE_UNAVAILABLE and checkout steps aside to Request Quote. A
 * confirmed code can be added without a deploy through STRIPE_TAX_CODES, a JSON
 * object of category -> code in the server environment.
 */

export type StoreCategory = StoreProduct["category"];

export const STRIPE_GENERAL_SERVICES = "txcd_20030000";

/** People-delivered services: engineering, onboarding, setup and consulting labour. */
export const STORE_TAX_CODES: Partial<Record<StoreCategory, string>> = {
  contract_services: STRIPE_GENERAL_SERVICES,
  comanaged_onboarding: STRIPE_GENERAL_SERVICES,
  networking_projects: STRIPE_GENERAL_SERVICES,
  ucaas_setup: STRIPE_GENERAL_SERVICES,
  hardware_provisioning: STRIPE_GENERAL_SERVICES,
  professional_services: STRIPE_GENERAL_SERVICES,
};

/**
 * No confirmed code yet, so no guess: self-serve digital products, downloadable
 * templates, online training, and handling fees tied to shipped hardware.
 */
export const STORE_TAX_CODE_PENDING: ReadonlySet<StoreCategory> = new Set<StoreCategory>([
  "digital_assessments",
  "digital_templates",
  "digital_training",
  "hardware_handling",
]);

const TAX_CODE_PATTERN = /^txcd_\d{8}$/;

/** Parses STRIPE_TAX_CODES. Malformed JSON or codes are ignored, never guessed. */
export function parseTaxCodeOverrides(raw: string | undefined): Partial<Record<StoreCategory, string>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const overrides: Partial<Record<StoreCategory, string>> = {};
    for (const [category, code] of Object.entries(parsed)) {
      if (typeof code === "string" && TAX_CODE_PATTERN.test(code)) {
        overrides[category as StoreCategory] = code;
      }
    }
    return overrides;
  } catch {
    return {};
  }
}

export function storeTaxCode(
  category: StoreCategory,
  overrides: Partial<Record<StoreCategory, string>> = {},
): string | null {
  return overrides[category] ?? STORE_TAX_CODES[category] ?? null;
}
