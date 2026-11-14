import { z } from "zod";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  frequencyLabel,
  missingAutoRenewConsentFields,
  snapshotIncludesRequiredTerms,
  type AutoRenewCustomerType,
  type AutoRenewFrequency,
  type AutoRenewClientConsent,
} from "@shared/autoRenewContract";

/**
 * Website/portal contract for Hub auto-renew subscriptions. Paths, auth,
 * and payloads match the Hub auto-renew contract. The site calls these only
 * when AUTORENEW_CONTRACT_ENABLED=true.
 */
export const HUB_SUBSCRIPTIONS_CONTRACT = "de.hub.website-subscriptions/v1";

export const HUB_WEBSITE_SUBSCRIPTIONS_PATH = "/api/integrations/v1/website/subscriptions";
export const HUB_PORTAL_SUBSCRIPTIONS_PATH = "/api/integrations/v1/portal/subscriptions";

export function hubPortalSubscriptionCancelPath(subscriptionId: string): string {
  return `${HUB_PORTAL_SUBSCRIPTIONS_PATH}/${encodeURIComponent(subscriptionId)}/cancel`;
}

export const AUTO_RENEW_STATUSES = [
  "pending",
  "active",
  "cancel_scheduled",
  "cancelled",
  "suspended",
] as const;
export type AutoRenewStatus = (typeof AUTO_RENEW_STATUSES)[number];

export const AUTO_RENEW_FREQUENCIES = ["month", "year"] as const;
export const AUTO_RENEW_CUSTOMER_TYPES = ["consumer", "business"] as const;

export const autoRenewConsentSchema = z
  .object({
    autoRenewConsentAt: z.string().min(1).max(80),
    termsVersion: z.string().min(1).max(80),
    termsTextSnapshot: z.string().min(1).max(20000),
    cancelPolicyText: z.string().min(1).max(8000),
    checkboxLabelText: z.string().min(1).max(500),
    pageUrl: z.string().min(1).max(2000),
  })
  .strict();

export const websiteCreateSubscriptionRequestSchema = z
  .object({
    portalClientId: z.string().trim().min(1).max(100),
    skuIds: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
    priceCents: z.number().int().positive(),
    currency: z.string().trim().min(1).max(8),
    frequency: z.enum(AUTO_RENEW_FREQUENCIES),
    termMonths: z.number().int().positive().max(120),
    customerType: z.enum(AUTO_RENEW_CUSTOMER_TYPES),
    customerState: z.string().trim().min(2).max(2),
    consent: autoRenewConsentSchema,
  })
  .strict();

export type WebsiteCreateSubscriptionRequest = z.infer<typeof websiteCreateSubscriptionRequestSchema>;

export const hubCreateSubscriptionBodySchema = websiteCreateSubscriptionRequestSchema.extend({
  consent: autoRenewConsentSchema.extend({
    ip: z.string().min(1).max(200),
    userAgent: z.string().min(1).max(1000),
  }),
});
export type HubCreateSubscriptionBody = z.infer<typeof hubCreateSubscriptionBodySchema>;

export const hubCreateSubscriptionResponseSchema = z.object({
  subscriptionId: z.string().min(1),
  status: z.enum(AUTO_RENEW_STATUSES),
  renewsAt: z.string().nullable().optional(),
  confirmation: z.object({
    id: z.string().min(1),
    url: z.string().min(1),
    termsVersion: z.string().min(1),
  }),
});
export type HubCreateSubscriptionResponse = z.infer<typeof hubCreateSubscriptionResponseSchema>;

export const hubCancelSubscriptionBodySchema = z
  .object({
    portalClientId: z.string().trim().min(1).max(100),
    portalUserId: z.string().trim().min(1).max(100),
    reason: z.string().trim().max(2000).optional(),
    requestedAt: z.string().min(1).max(80),
  })
  .strict();
export type HubCancelSubscriptionBody = z.infer<typeof hubCancelSubscriptionBodySchema>;

export const hubCancelSubscriptionResponseSchema = z.object({
  subscriptionId: z.string().min(1),
  status: z.enum(AUTO_RENEW_STATUSES),
  cancelledAt: z.string().min(1),
  cancelEffectiveAt: z.string().min(1),
  accessThrough: z.string().min(1),
  confirmation: z.object({
    id: z.string().min(1),
    url: z.string().min(1),
  }),
});
export type HubCancelSubscriptionResponse = z.infer<typeof hubCancelSubscriptionResponseSchema>;

export const hubPortalSubscriptionSchema = z.object({
  subscriptionId: z.string().min(1),
  status: z.enum(AUTO_RENEW_STATUSES),
  plan: z.string().min(1).optional(),
  skuIds: z.array(z.string()).optional(),
  priceCents: z.number().int().optional(),
  currency: z.string().optional(),
  frequency: z.enum(AUTO_RENEW_FREQUENCIES).optional(),
  termMonths: z.number().int().optional(),
  terms: z.string().optional(),
  termsVersion: z.string().optional(),
  renewsAt: z.string().nullable().optional(),
  currentTermEnd: z.string().nullable().optional(),
  cancelUrl: z.string().optional(),
});
export type HubPortalSubscription = z.infer<typeof hubPortalSubscriptionSchema>;

export const hubListSubscriptionsResponseSchema = z.object({
  subscriptions: z.array(hubPortalSubscriptionSchema),
});
export type HubListSubscriptionsResponse = z.infer<typeof hubListSubscriptionsResponseSchema>;

export class AutoRenewConsentError extends Error {
  readonly code = "AUTORENEW_CONSENT_INVALID";
  readonly fields: string[];
  constructor(message: string, fields: string[] = []) {
    super(message);
    this.name = "AutoRenewConsentError";
    this.fields = fields;
  }
}

export function assertValidAutoRenewConsent(
  input: {
    priceCents: number;
    currency: string;
    frequency: AutoRenewFrequency;
    termMonths: number;
    consent?: Partial<AutoRenewClientConsent> | null;
  },
): AutoRenewClientConsent {
  const missing = missingAutoRenewConsentFields(input.consent);
  if (missing.length > 0) {
    throw new AutoRenewConsentError(
      `Auto-renew consent is incomplete. Missing: ${missing.join(", ")}`,
      missing,
    );
  }
  const consent = input.consent as AutoRenewClientConsent;
  const consentedAt = Date.parse(consent.autoRenewConsentAt);
  if (!Number.isFinite(consentedAt)) {
    throw new AutoRenewConsentError("autoRenewConsentAt must be a valid timestamp", ["autoRenewConsentAt"]);
  }
  const skewMs = consentedAt - Date.now();
  if (skewMs > 5 * 60 * 1000) {
    throw new AutoRenewConsentError("autoRenewConsentAt cannot be in the future", ["autoRenewConsentAt"]);
  }
  if (Date.now() - consentedAt > 24 * 60 * 60 * 1000) {
    throw new AutoRenewConsentError("autoRenewConsentAt is too old; confirm the terms again", ["autoRenewConsentAt"]);
  }
  if (consent.termsVersion !== AUTORENEW_TERMS_VERSION) {
    throw new AutoRenewConsentError("termsVersion does not match the current auto-renew terms", ["termsVersion"]);
  }
  if (consent.checkboxLabelText.trim() !== AUTO_RENEW_CHECKBOX_LABEL_TEXT) {
    throw new AutoRenewConsentError("checkboxLabelText does not match the current label", ["checkboxLabelText"]);
  }
  if (consent.cancelPolicyText.trim() !== AUTO_RENEW_CANCEL_POLICY_TEXT) {
    throw new AutoRenewConsentError("cancelPolicyText does not match the current cancellation policy", [
      "cancelPolicyText",
    ]);
  }
  if (
    !snapshotIncludesRequiredTerms(consent.termsTextSnapshot, {
      priceCents: input.priceCents,
      currency: input.currency,
      frequency: input.frequency,
      cancelPolicyText: consent.cancelPolicyText,
    })
  ) {
    throw new AutoRenewConsentError(
      "termsTextSnapshot must include the price, billing frequency, and cancellation method",
      ["termsTextSnapshot"],
    );
  }
  const termLabel = input.termMonths === 1 ? "1 month" : `${input.termMonths} months`;
  if (!consent.termsTextSnapshot.includes(termLabel) && !consent.termsTextSnapshot.includes(String(input.termMonths))) {
    throw new AutoRenewConsentError("termsTextSnapshot must include the subscription term", ["termsTextSnapshot"]);
  }
  if (!consent.termsTextSnapshot.toLowerCase().includes(frequencyLabel(input.frequency))) {
    throw new AutoRenewConsentError("termsTextSnapshot must include the billing frequency", ["termsTextSnapshot"]);
  }
  return {
    autoRenewConsentAt: consent.autoRenewConsentAt,
    termsVersion: consent.termsVersion,
    termsTextSnapshot: consent.termsTextSnapshot,
    cancelPolicyText: consent.cancelPolicyText,
    checkboxLabelText: consent.checkboxLabelText,
    pageUrl: consent.pageUrl,
  };
}

export const AUTO_RENEW_DEFAULTS = {
  termsVersion: AUTORENEW_TERMS_VERSION,
  cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
  checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
} as const;

export type { AutoRenewCustomerType, AutoRenewFrequency };
