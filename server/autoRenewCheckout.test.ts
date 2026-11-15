import { afterEach, describe, expect, it } from "vitest";
import { storeProducts } from "../client/src/data/storeProducts";
import {
  AUTORENEW_GATED_SKUS,
  autoRenewConsentRequiredSkus,
  isAutoRenewGatedSku,
} from "@shared/autoRenewContract";
import { AUTORENEW_CONTRACT_ENV } from "./config/autoRenewContract";
import {
  autoRenewPayNowDecision,
  canonicalizeCheckoutLineItems,
} from "./secureStoreCheckout";

const original = process.env[AUTORENEW_CONTRACT_ENV];

afterEach(() => {
  if (original === undefined) delete process.env[AUTORENEW_CONTRACT_ENV];
  else process.env[AUTORENEW_CONTRACT_ENV] = original;
});

describe("auto-renew Pay Now gate", () => {
  it("names the phishing and training SKUs in the catalog and leaves one-time onboarding out", () => {
    expect(AUTORENEW_GATED_SKUS).toEqual([
      "DE-DIG-ASMT-PHISH-MO",
      "DE-DIG-TRN-AWARE-BASIC-YR",
      "DE-DIG-TRN-AWARE-PRO-YR",
    ]);
    for (const sku of AUTORENEW_GATED_SKUS) {
      const product = storeProducts.find((item) => item.sku === sku);
      expect(product, sku).toBeDefined();
      expect(isAutoRenewGatedSku(sku)).toBe(true);
    }
    expect(isAutoRenewGatedSku("DE-DIG-TRN-ONBOARD-OT")).toBe(false);
  });

  it("blocks gated SKUs from one-time Pay Now when the flag is off and routes them to a quote", () => {
    delete process.env[AUTORENEW_CONTRACT_ENV];
    const lines = canonicalizeCheckoutLineItems(
      [{ productId: "prod-073", sku: "DE-DIG-ASMT-PHISH-MO", quantity: 1 }],
      "admin",
    );
    expect(autoRenewConsentRequiredSkus(lines)).toEqual(["DE-DIG-ASMT-PHISH-MO"]);
    const decision = autoRenewPayNowDecision(lines);
    expect(decision).toMatchObject({
      blocked: true,
      quoteRequired: true,
      subscriptionRequired: false,
      code: "SUBSCRIPTION_BILLING_REQUIRED",
      skus: ["DE-DIG-ASMT-PHISH-MO"],
    });
  });

  it("still refuses a one-time Pay Now charge when the flag is on, and asks for auto-renew consent instead", () => {
    process.env[AUTORENEW_CONTRACT_ENV] = "true";
    const lines = canonicalizeCheckoutLineItems(
      [{ productId: "prod-080", sku: "DE-DIG-TRN-AWARE-BASIC-YR", quantity: 3 }],
      "admin",
    );
    const decision = autoRenewPayNowDecision(lines);
    expect(decision).toMatchObject({
      blocked: true,
      quoteRequired: false,
      subscriptionRequired: true,
      code: "AUTORENEW_SUBSCRIPTION_REQUIRED",
      skus: ["DE-DIG-TRN-AWARE-BASIC-YR"],
    });
  });

  it("does not block a one-time training onboarding SKU", () => {
    process.env[AUTORENEW_CONTRACT_ENV] = "true";
    const lines = canonicalizeCheckoutLineItems(
      [{ productId: "prod-082", sku: "DE-DIG-TRN-ONBOARD-OT", quantity: 1 }],
      "admin",
    );
    expect(autoRenewPayNowDecision(lines)).toEqual({ blocked: false });
  });
});
