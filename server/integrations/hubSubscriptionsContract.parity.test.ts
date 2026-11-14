import { describe, expect, it } from "vitest";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  buildAutoRenewTermsText,
  missingAutoRenewConsentFields,
  snapshotIncludesRequiredTerms,
} from "@shared/autoRenewContract";
import { signDeSyncRequest } from "./deSyncAuth";
import {
  AUTO_RENEW_CUSTOMER_TYPES,
  AUTO_RENEW_FREQUENCIES,
  AUTO_RENEW_STATUSES,
  AutoRenewConsentError,
  HUB_PORTAL_SUBSCRIPTIONS_PATH,
  HUB_SUBSCRIPTIONS_CONTRACT,
  HUB_WEBSITE_SUBSCRIPTIONS_PATH,
  assertValidAutoRenewConsent,
  hubCancelSubscriptionBodySchema,
  hubCreateSubscriptionBodySchema,
  hubCreateSubscriptionResponseSchema,
  hubListSubscriptionsResponseSchema,
  hubPortalSubscriptionCancelPath,
  websiteCreateSubscriptionRequestSchema,
} from "./hubSubscriptionsContract";

const validConsent = {
  autoRenewConsentAt: new Date().toISOString(),
  termsVersion: AUTORENEW_TERMS_VERSION,
  termsTextSnapshot: buildAutoRenewTermsText({
    priceCents: 19900,
    currency: "USD",
    frequency: "month",
    termMonths: 1,
  }),
  cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
  checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  pageUrl: "https://digeratiexperts.com/internal/warehouse/checkout",
};

describe("de-sync contract parity: Hub auto-renew subscriptions", () => {
  it("pins the routes, auth directions and vocabularies from the Hub contract", () => {
    expect(HUB_SUBSCRIPTIONS_CONTRACT).toBe("de.hub.website-subscriptions/v1");
    expect(HUB_WEBSITE_SUBSCRIPTIONS_PATH).toBe("/api/integrations/v1/website/subscriptions");
    expect(HUB_PORTAL_SUBSCRIPTIONS_PATH).toBe("/api/integrations/v1/portal/subscriptions");
    expect(hubPortalSubscriptionCancelPath("sub_123")).toBe(
      "/api/integrations/v1/portal/subscriptions/sub_123/cancel",
    );
    expect([...AUTO_RENEW_STATUSES]).toEqual([
      "pending",
      "active",
      "cancel_scheduled",
      "cancelled",
      "suspended",
    ]);
    expect([...AUTO_RENEW_FREQUENCIES]).toEqual(["month", "year"]);
    expect([...AUTO_RENEW_CUSTOMER_TYPES]).toEqual(["consumer", "business"]);
    expect(Object.keys(websiteCreateSubscriptionRequestSchema.shape).sort()).toEqual([
      "consent",
      "currency",
      "customerState",
      "customerType",
      "frequency",
      "portalClientId",
      "priceCents",
      "skuIds",
      "termMonths",
    ]);
    expect(Object.keys(hubCancelSubscriptionBodySchema.shape).sort()).toEqual([
      "portalClientId",
      "portalUserId",
      "reason",
      "requestedAt",
    ]);
  });

  it("rejects missing consent and snapshot fields required by the Hub contract", () => {
    expect(missingAutoRenewConsentFields(null)).toEqual([
      "autoRenewConsentAt",
      "termsVersion",
      "termsTextSnapshot",
      "cancelPolicyText",
      "checkboxLabelText",
      "pageUrl",
    ]);
    expect(missingAutoRenewConsentFields({ ...validConsent, termsTextSnapshot: "   " })).toEqual([
      "termsTextSnapshot",
    ]);

    expect(() =>
      assertValidAutoRenewConsent({
        priceCents: 19900,
        currency: "USD",
        frequency: "month",
        termMonths: 1,
        consent: null,
      }),
    ).toThrow(AutoRenewConsentError);

    expect(() =>
      assertValidAutoRenewConsent({
        priceCents: 19900,
        currency: "USD",
        frequency: "month",
        termMonths: 1,
        consent: { ...validConsent, termsTextSnapshot: "I agree, somehow." },
      }),
    ).toThrow(/price, billing frequency, and cancellation method/);

    expect(() =>
      assertValidAutoRenewConsent({
        priceCents: 19900,
        currency: "USD",
        frequency: "month",
        termMonths: 1,
        consent: { ...validConsent, termsVersion: "old-v0" },
      }),
    ).toThrow(/termsVersion/);

    const ok = assertValidAutoRenewConsent({
      priceCents: 19900,
      currency: "USD",
      frequency: "month",
      termMonths: 1,
      consent: validConsent,
    });
    expect(ok.termsVersion).toBe(AUTORENEW_TERMS_VERSION);
    expect(
      snapshotIncludesRequiredTerms(ok.termsTextSnapshot, {
        priceCents: 19900,
        currency: "USD",
        frequency: "month",
        cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
      }),
    ).toBe(true);
  });

  it("requires the Hub create body to include server-attached ip and userAgent", () => {
    const withoutNetwork = {
      portalClientId: "client-1",
      skuIds: ["DE-DIG-ASMT-PHISH-MO"],
      priceCents: 19900,
      currency: "USD",
      frequency: "month" as const,
      termMonths: 1,
      customerType: "business" as const,
      customerState: "AZ",
      consent: validConsent,
    };
    expect(websiteCreateSubscriptionRequestSchema.safeParse(withoutNetwork).success).toBe(true);
    expect(hubCreateSubscriptionBodySchema.safeParse(withoutNetwork).success).toBe(false);
    expect(
      hubCreateSubscriptionBodySchema.safeParse({
        ...withoutNetwork,
        consent: { ...validConsent, ip: "203.0.113.10", userAgent: "Mozilla/5.0" },
      }).success,
    ).toBe(true);
  });

  it("accepts a contract-shaped create and list response", () => {
    expect(
      hubCreateSubscriptionResponseSchema.safeParse({
        subscriptionId: "sub_1",
        status: "pending",
        renewsAt: "2027-01-01T00:00:00.000Z",
        confirmation: { id: "cnf_1", url: "https://hub.example/c/1", termsVersion: AUTORENEW_TERMS_VERSION },
      }).success,
    ).toBe(true);
    expect(hubListSubscriptionsResponseSchema.safeParse({ subscriptions: [] }).success).toBe(true);
  });

  it("signs the same canonical string the Hub verifies", () => {
    const sample = {
      method: "POST",
      path: HUB_WEBSITE_SUBSCRIPTIONS_PATH,
      timestamp: "2026-11-13T16:00:00.000Z",
      eventId: "evt-autorenew-sample",
      body: "{}",
      secret: "test-website-to-hub-secret",
    };
    expect(signDeSyncRequest(sample)).toBe(signDeSyncRequest(sample));
    expect(signDeSyncRequest(sample)).toMatch(/^[a-f0-9]{64}$/);
    expect(signDeSyncRequest({ ...sample, path: `${HUB_PORTAL_SUBSCRIPTIONS_PATH}?accountId=41` })).not.toBe(
      signDeSyncRequest(sample),
    );
  });
});
