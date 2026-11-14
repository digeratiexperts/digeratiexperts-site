import { describe, expect, it, vi } from "vitest";
import type { OrderLineInput, PostalAddress, TaxQuoteResponse } from "@shared/deStoreContract";
import { DE_STORE_PLACE_ORDER_BUTTON } from "@shared/deStoreContract";
import { blockedStateMessage } from "@shared/deStoreLegalCopy";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  buildAutoRenewTermsText,
} from "@shared/autoRenewContract";
import { placeStoreOrder, quoteStoreOrder, type StoreCheckoutDeps } from "./deStoreCheckout";
import type { HubStoreClient } from "./integrations/hubStoreClient";

const billTo: PostalAddress = {
  name: "Jordan Lee",
  company: "Example Business LLC",
  street1: "1 N Arizona Ave",
  city: "Chandler",
  region: "AZ",
  postalCode: "85225",
  country: "US",
};
const shipTo: PostalAddress = { ...billTo, street1: "200 E Chicago St", city: "Chandler" };
const nyBill: PostalAddress = { ...billTo, region: "NY", city: "New York", postalCode: "10001" };

const serviceLine: OrderLineInput = {
  lineId: "line-saas",
  sku: "DE-STORE-TEST-SAAS",
  description: "Standalone dashboard",
  taxCategory: "saas",
  quantity: 1,
  unitAmountCents: 10000,
};

const hardwareLines: OrderLineInput[] = [
  {
    lineId: "line-laptop",
    sku: "DE-STORE-TEST-LAPTOP",
    description: "Refurbished laptop (used)",
    taxCategory: "hardware",
    quantity: 1,
    unitAmountCents: 50000,
    deviceClass: "laptop",
    kitId: "kit_test",
    parentLineId: "kit-parent",
  },
];

const clickwrap = {
  box1Accepted: true,
  box2Accepted: true,
  box4Accepted: true,
  businessName: "Example Business LLC",
  buttonText: DE_STORE_PLACE_ORDER_BUTTON,
  acceptedAt: "1999-01-01T00:00:00Z",
  ip: "1.2.3.4",
};

function quoteResponse(overrides: Partial<TaxQuoteResponse> = {}): TaxQuoteResponse {
  return {
    calculationId: "calc_test123",
    quotedAt: "2026-11-13T18:00:00Z",
    expiresAt: "2026-11-13T19:00:00Z",
    currency: "USD",
    lines: [
      {
        lineId: "line-saas",
        taxCategory: "saas",
        taxableAmountCents: 10000,
        taxCents: 800,
        feeCents: 0,
        description: "Standalone dashboard",
      },
    ],
    fees: [
      {
        lineId: "fee-co-delivery",
        taxCategory: "shipping",
        taxableAmountCents: 31,
        taxCents: 0,
        feeCents: 31,
        description: "Colorado retail delivery fee",
      },
    ],
    subtotalCents: 10000,
    taxCents: 800,
    feeCents: 31,
    totalCents: 10831,
    destination: { region: "AZ", country: "US", sourcedFrom: "ship_to" },
    ...overrides,
  };
}

function hubStub(options?: {
  quote?: HubStoreClient["quoteTax"];
}): { hub: HubStoreClient; quote: ReturnType<typeof vi.fn>; commit: ReturnType<typeof vi.fn>; voidTax: ReturnType<typeof vi.fn>; submit: ReturnType<typeof vi.fn> } {
  const quote = options?.quote ?? vi.fn(async () => ({ ok: true as const, status: 200, data: quoteResponse() }));
  const commit = vi.fn(async () => ({
    ok: true as const,
    status: 200,
    data: {
      calculationId: "calc_test123",
      committedAt: "2026-11-13T18:01:00Z",
      currency: "USD" as const,
      taxCents: 800,
      feeCents: 31,
      totalCents: 10831,
    },
  }));
  const voidTax = vi.fn(async () => ({
    ok: true as const,
    status: 200,
    data: { calculationId: "calc_test123", voidedAt: "2026-11-13T18:01:00Z" },
  }));
  const submit = vi.fn(async () => ({ ok: true as const, status: 200, data: {} }));
  return {
    quote,
    commit,
    voidTax,
    submit,
    hub: {
      quoteTax: quote,
      commitTax: commit,
      voidTax,
      submitEvent: submit,
    },
  };
}

function deps(overrides: Partial<StoreCheckoutDeps> & { hub?: HubStoreClient } = {}) {
  const stub = overrides.hub ? null : hubStub();
  const capturePayment = overrides.capturePayment ?? vi.fn(async () => ({
    ok: true as const,
    paymentRef: "pay_test",
    capturedAt: "2026-11-13T18:00:30Z",
  }));
  return {
    capturePayment,
    stub,
    deps: {
      now: () => new Date("2026-11-13T18:00:10Z"),
      ip: "203.0.113.50",
      userAgent: "DE-Store-Test",
      stateList: { enabled: false, mode: "deny" as const, regions: [] },
      consumerCheckout: false,
      autoRenewContractEnabled: false,
      hub: overrides.hub ?? stub!.hub,
      capturePayment,
      newSiteOrderId: () => "siteord_test1",
      ...overrides,
    } satisfies StoreCheckoutDeps,
  };
}

describe("quoteStoreOrder", () => {
  it("blocks a listed billing or shipping state before calling the Hub or taking payment", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps({
      stateList: { enabled: true, mode: "deny", regions: ["NY"] },
    });
    const result = await quoteStoreOrder(
      { email: "buyer@example.com", buyerRole: "self_managed", addresses: { billTo: nyBill, shipTo }, lines: [serviceLine] },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe("state_not_served");
    expect(result.error).toBe(blockedStateMessage(["NY"]));
    expect(result.paymentAttempted).toBe(false);
    expect(stub?.quote).not.toHaveBeenCalled();
    expect(capturePayment).not.toHaveBeenCalled();
  });

  it("returns the Hub 409 error string exactly and does not capture payment", async () => {
    const hubError = "Digerati Experts does not currently sell into New York.";
    const { hub, quote } = hubStub({
      quote: vi.fn(async () => ({
        ok: false as const,
        reason: "state_not_served" as const,
        status: 409,
        code: "state_not_served",
        error: hubError,
        stateNotServed: {
          error: hubError,
          code: "state_not_served" as const,
          blockedRegions: ["NY"],
          blockedAddressUses: [{ path: "billTo.region" as const, use: "bill_to" as const, region: "NY" }],
          issues: [{ path: "billTo.region" as const, code: "state_not_served" as const }],
        },
      })),
    });
    const capturePayment = vi.fn();
    const result = await quoteStoreOrder(
      { email: "buyer@example.com", buyerRole: "comanaged", addresses: { billTo, shipTo }, lines: [serviceLine] },
      deps({ hub, capturePayment }).deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected 409");
    expect(result.status).toBe(409);
    expect(result.code).toBe("state_not_served");
    expect(result.error).toBe(hubError);
    expect(result.error.endsWith(".")).toBe(true);
    expect(quote).toHaveBeenCalledOnce();
    expect(capturePayment).not.toHaveBeenCalled();
  });

  it("fails closed when the Hub cannot quote tax", async () => {
    const { hub } = hubStub({
      quote: vi.fn(async () => ({
        ok: false as const,
        reason: "tax_unavailable" as const,
        status: 503,
        code: "tax_engine_disabled",
      })),
    });
    const capturePayment = vi.fn();
    const result = await quoteStoreOrder(
      { email: "buyer@example.com", buyerRole: "managed", addresses: { billTo, shipTo }, lines: [serviceLine] },
      deps({ hub, capturePayment }).deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected fail closed");
    expect(result.status).toBe(503);
    expect(result.code).toBe("tax_engine_disabled");
    expect(result.error).toContain("No payment has been taken");
    expect(capturePayment).not.toHaveBeenCalled();
  });
});

describe("placeStoreOrder", () => {
  it("records clickwrap with the server IP and timestamp, ignoring client-supplied values", async () => {
    const { deps: checkoutDeps, stub } = deps();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: hardwareLines,
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(true);
    const event = stub?.submit.mock.calls[0]?.[0];
    const acceptances = event.payload.acceptances;
    expect(acceptances.length).toBeGreaterThan(0);
    for (const acceptance of acceptances) {
      expect(acceptance.ip).toBe("203.0.113.50");
      expect(acceptance.acceptedAt).toBe("2026-11-13T18:00:10.000Z");
      expect(acceptance.buttonText).toBe(DE_STORE_PLACE_ORDER_BUTTON);
      expect(acceptance.version).toBe("2026.10-store");
      expect(acceptance.ip).not.toBe("1.2.3.4");
      expect(acceptance.acceptedAt).not.toBe("1999-01-01T00:00:00Z");
    }
    expect(acceptances.some((item: { documentKey: string }) => item.documentKey === "preinstalled-software")).toBe(true);
  });

  it("does not capture payment when required acknowledgements are missing", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "managed",
        addresses: { billTo, shipTo },
        lines: hardwareLines,
        clickwrap: { box1Accepted: true, buttonText: DE_STORE_PLACE_ORDER_BUTTON },
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected clickwrap failure");
    expect(result.code).toBe("clickwrap_required");
    expect(result.missing).toEqual(expect.arrayContaining(["box2", "box4"]));
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
  });

  it("does not capture payment when the site state list blocks the order", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps({
      stateList: { enabled: true, mode: "deny", regions: ["NY"] },
    });
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "comanaged",
        addresses: { billTo: nyBill, shipTo },
        lines: [serviceLine],
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected block");
    expect(result.code).toBe("state_not_served");
    expect(result.paymentAttempted).toBe(false);
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
    expect(stub?.commit).not.toHaveBeenCalled();
  });

  it("does not capture payment after a Hub state_not_served response", async () => {
    const hubError = "Digerati Experts does not currently sell into New York or New Jersey.";
    const { hub } = hubStub({
      quote: vi.fn(async () => ({
        ok: false as const,
        reason: "state_not_served" as const,
        status: 409,
        code: "state_not_served",
        error: hubError,
        stateNotServed: {
          error: hubError,
          code: "state_not_served" as const,
          blockedRegions: ["NY", "NJ"],
          blockedAddressUses: [],
          issues: [],
        },
      })),
    });
    const capturePayment = vi.fn();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [serviceLine],
        clickwrap,
      },
      deps({ hub, capturePayment }).deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected hub 409");
    expect(result.error).toBe(hubError);
    expect(capturePayment).not.toHaveBeenCalled();
  });

  it("does not capture payment when tax cannot be quoted", async () => {
    const { hub } = hubStub({
      quote: vi.fn(async () => ({ ok: false as const, reason: "not_configured" as const })),
    });
    const capturePayment = vi.fn();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "managed",
        addresses: { billTo, shipTo },
        lines: [serviceLine],
        clickwrap,
      },
      deps({ hub, capturePayment }).deps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected tax failure");
    expect(result.code).toBe("tax_unavailable");
    expect(capturePayment).not.toHaveBeenCalled();
  });

  it("rejects a combined shipping-and-handling line and does not capture payment", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "managed",
        addresses: { billTo, shipTo },
        lines: [
          serviceLine,
          {
            lineId: "ship",
            sku: "SHIP-HANDLE",
            description: "Shipping and handling",
            taxCategory: "shipping",
            quantity: 1,
            unitAmountCents: 1500,
          },
        ],
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected bundled shipping rejection");
    expect(result.code).toBe("combined_shipping_line");
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
  });

  it("captures payment only after a successful, unexpired tax quote", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [serviceLine],
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected success");
    expect(capturePayment).toHaveBeenCalledOnce();
    expect(capturePayment).toHaveBeenCalledWith(
      expect.objectContaining({ calculationId: "calc_test123", totalCents: 10831 }),
    );
    expect(stub?.quote).toHaveBeenCalledOnce();
    expect(stub?.commit).toHaveBeenCalledOnce();
    expect(stub?.submit).toHaveBeenCalledOnce();
    expect(result.siteOrderId).toBe("siteord_test1");
  });
});

const gatedLine: OrderLineInput = {
  lineId: "line-phish",
  sku: "DE-DIG-ASMT-PHISH-MO",
  description: "Phishing simulation (test fixture, not a live listing)",
  taxCategory: "saas",
  quantity: 1,
  unitAmountCents: 10000,
};

function autoRenewConsent(priceCents = 10000) {
  return {
    autoRenewConsentAt: "2026-11-13T18:00:00Z",
    termsVersion: AUTORENEW_TERMS_VERSION,
    termsTextSnapshot: buildAutoRenewTermsText({
      priceCents,
      currency: "USD",
      frequency: "month" as const,
      termMonths: 1,
    }),
    cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
    checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
    pageUrl: "https://www.digeratiexperts.com/store/order",
  };
}

describe("auto-renew gated store checkout", () => {
  it("does not capture payment when the auto-renew contract is off", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps();
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [gatedLine],
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTORENEW_CONTRACT_DISABLED");
    expect(result.paymentAttempted).toBe(false);
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
  });

  it("does not capture payment when auto-renew consent is missing", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps({ autoRenewContractEnabled: true });
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [gatedLine],
        clickwrap,
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTORENEW_CONSENT_INVALID");
    expect(result.paymentAttempted).toBe(false);
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
  });

  it("does not capture a one-time payment for auto-renew gated SKUs after valid consent", async () => {
    const { deps: checkoutDeps, capturePayment, stub } = deps({ autoRenewContractEnabled: true });
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [gatedLine],
        clickwrap,
        autoRenewConsent: autoRenewConsent(),
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTORENEW_SUBSCRIPTION_REQUIRED");
    expect(result.paymentAttempted).toBe(false);
    expect(capturePayment).not.toHaveBeenCalled();
    expect(stub?.quote).not.toHaveBeenCalled();
  });

  it("does not capture payment for a mixed cart of gated and one-time items", async () => {
    const { deps: checkoutDeps, capturePayment } = deps({ autoRenewContractEnabled: true });
    const result = await placeStoreOrder(
      {
        email: "buyer@example.com",
        buyerRole: "self_managed",
        addresses: { billTo, shipTo },
        lines: [gatedLine, serviceLine],
        clickwrap,
        autoRenewConsent: autoRenewConsent(),
      },
      checkoutDeps,
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("AUTORENEW_CART_INVALID");
    expect(result.paymentAttempted).toBe(false);
    expect(capturePayment).not.toHaveBeenCalled();
  });
});
