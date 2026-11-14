/**
 * Site-side auto-renew contract helpers shared by the store checkout UI and
 * the server. Keep this module free of Node-only APIs.
 *
 * Hub endpoints live behind AUTORENEW_CONTRACT_ENABLED (disabled by default)
 * until Joseph approves going live. See /workspace/contracts/hub-autorenew-contract.md
 * (copied into server/integrations/hubSubscriptionsContract.ts).
 */

export const AUTORENEW_CONTRACT_ENV = "AUTORENEW_CONTRACT_ENABLED";

/** Terms copy version stored on the consent snapshot. Bump when the text changes. */
export const AUTORENEW_TERMS_VERSION = "autorenew-v1";

/**
 * Subscription SKUs that must never be charged as an unconsented one-time
 * Pay Now payment. When the feature flag is off they route to a quote; when
 * it is on they require explicit auto-renew consent and a Hub subscription.
 */
export const AUTORENEW_GATED_SKUS = [
  "DE-DIG-ASMT-PHISH-MO",
  "DE-DIG-TRN-AWARE-BASIC-YR",
  "DE-DIG-TRN-AWARE-PRO-YR",
] as const;

export type AutoRenewGatedSku = (typeof AUTORENEW_GATED_SKUS)[number];

export const AUTORENEW_GATED_SKU_SET: ReadonlySet<string> = new Set(AUTORENEW_GATED_SKUS);

export type AutoRenewFrequency = "month" | "year";
export type AutoRenewCustomerType = "consumer" | "business";

export function isAutoRenewGatedSku(sku: string | null | undefined): sku is AutoRenewGatedSku {
  return !!sku && AUTORENEW_GATED_SKU_SET.has(sku);
}

export function autoRenewConsentRequiredSkus(items: Array<{ sku: string }>): string[] {
  return items.filter((item) => isAutoRenewGatedSku(item.sku)).map((item) => item.sku);
}

export function frequencyFromPricingType(pricingType: string): AutoRenewFrequency | null {
  if (pricingType === "monthly" || pricingType === "month" || pricingType === "per_month") return "month";
  if (pricingType === "yearly" || pricingType === "year" || pricingType === "per_year" || pricingType === "annual") {
    return "year";
  }
  return null;
}

export function termMonthsForFrequency(frequency: AutoRenewFrequency): number {
  return frequency === "year" ? 12 : 1;
}

export function formatAutoRenewPrice(priceCents: number, currency = "USD"): string {
  const amount = (Math.round(priceCents) / 100).toFixed(2);
  const code = currency.trim().toUpperCase() || "USD";
  return code === "USD" ? `$${amount}` : `${amount} ${code}`;
}

export function frequencyLabel(frequency: AutoRenewFrequency): string {
  return frequency === "year" ? "yearly" : "monthly";
}

export const AUTO_RENEW_CANCEL_POLICY_TEXT =
  "You can cancel this subscription at any time with one click in the Digerati Experts Client Portal under Billing. No phone call is required, and canceling is not gated on a retention offer. Access continues through the end of the current paid term unless a later cancel-effective date is confirmed to you. California consumers can cancel immediately online.";

export const AUTO_RENEW_CHECKBOX_LABEL_TEXT =
  "I agree to automatic renewal of this subscription and the cancellation terms shown above.";

export function buildAutoRenewTermsText(input: {
  priceCents: number;
  currency?: string;
  frequency: AutoRenewFrequency;
  termMonths: number;
  cancelPolicyText?: string;
  termsVersion?: string;
}): string {
  const currency = input.currency ?? "USD";
  const price = formatAutoRenewPrice(input.priceCents, currency);
  const cadence = frequencyLabel(input.frequency);
  const cancel = input.cancelPolicyText ?? AUTO_RENEW_CANCEL_POLICY_TEXT;
  const version = input.termsVersion ?? AUTORENEW_TERMS_VERSION;
  const termLabel = input.termMonths === 1 ? "1 month" : `${input.termMonths} months`;
  return [
    `Digerati Experts Auto-Renewal Terms (version ${version})`,
    "",
    "This subscription renews automatically at the end of each term unless you cancel first.",
    "",
    `Price: ${price} ${currency.toUpperCase()}`,
    `Frequency: ${cadence}`,
    `Term: ${termLabel}`,
    "",
    `Cancellation: ${cancel}`,
    "",
    "Questions: email billing@digeratiexperts.com. Digerati Experts is based in Chandler, Arizona.",
  ].join("\n");
}

export function snapshotIncludesRequiredTerms(
  snapshot: string,
  input: { priceCents: number; currency?: string; frequency: AutoRenewFrequency; cancelPolicyText?: string },
): boolean {
  const text = snapshot ?? "";
  if (!text.trim()) return false;
  const price = formatAutoRenewPrice(input.priceCents, input.currency ?? "USD");
  const cadence = frequencyLabel(input.frequency);
  const cancel = input.cancelPolicyText ?? AUTO_RENEW_CANCEL_POLICY_TEXT;
  const lower = text.toLowerCase();
  return (
    text.includes(price) &&
    lower.includes(cadence) &&
    (text.includes(cancel) || (lower.includes("cancel") && lower.includes("client portal") && lower.includes("one click")))
  );
}

export type AutoRenewClientConsent = {
  autoRenewConsentAt: string;
  termsVersion: string;
  termsTextSnapshot: string;
  cancelPolicyText: string;
  checkboxLabelText: string;
  pageUrl: string;
};

export function missingAutoRenewConsentFields(
  consent: Partial<AutoRenewClientConsent> | null | undefined,
): string[] {
  if (!consent || typeof consent !== "object") {
    return [
      "autoRenewConsentAt",
      "termsVersion",
      "termsTextSnapshot",
      "cancelPolicyText",
      "checkboxLabelText",
      "pageUrl",
    ];
  }
  const required: Array<keyof AutoRenewClientConsent> = [
    "autoRenewConsentAt",
    "termsVersion",
    "termsTextSnapshot",
    "cancelPolicyText",
    "checkboxLabelText",
    "pageUrl",
  ];
  return required.filter((key) => {
    const value = consent[key];
    return typeof value !== "string" || !value.trim();
  });
}
