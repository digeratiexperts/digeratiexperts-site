import { describe, expect, it, vi } from "vitest";
import { hashBody, signDeSyncRequest } from "./deSyncAuth";
import { createHubSubscriptionsClient, type HubSubscriptionsClientDeps } from "./hubSubscriptionsClient";
import {
  HUB_PORTAL_SUBSCRIPTIONS_PATH,
  HUB_WEBSITE_SUBSCRIPTIONS_PATH,
  hubPortalSubscriptionCancelPath,
} from "./hubSubscriptionsContract";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  buildAutoRenewTermsText,
} from "@shared/autoRenewContract";

const consent = {
  autoRenewConsentAt: "2026-11-13T16:00:00.000Z",
  termsVersion: AUTORENEW_TERMS_VERSION,
  termsTextSnapshot: buildAutoRenewTermsText({
    priceCents: 19900,
    currency: "USD",
    frequency: "month" as const,
    termMonths: 1,
  }),
  cancelPolicyText: AUTO_RENEW_CANCEL_POLICY_TEXT,
  checkboxLabelText: AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  pageUrl: "https://digeratiexperts.com/internal/warehouse/checkout",
  ip: "203.0.113.10",
  userAgent: "Vitest",
};

const createBody = {
  portalClientId: "client-1",
  skuIds: ["DE-DIG-ASMT-PHISH-MO"],
  priceCents: 19900,
  currency: "USD",
  frequency: "month" as const,
  termMonths: 1,
  customerType: "business" as const,
  customerState: "AZ",
  consent,
};

function depsWith(fetchImpl: HubSubscriptionsClientDeps["fetch"]): HubSubscriptionsClientDeps {
  return {
    fetch: fetchImpl,
    base: () => "https://hub.example/api",
    websiteSecret: () => "website-secret",
    portalSecret: () => "portal-secret",
    timeoutMs: 1000,
    newIdempotencyKey: () => "idem-fixed-0001",
  };
}

function capture(fetchImpl: (url: string, init: RequestInit) => Promise<Response>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetch: HubSubscriptionsClientDeps["fetch"] = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : String(input);
    calls.push({ url, init: (init || {}) as RequestInit });
    return fetchImpl(url, (init || {}) as RequestInit);
  };
  return { fetch, calls };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function header(init: RequestInit, name: string): string {
  const headers = new Headers(init.headers as HeadersInit);
  return headers.get(name) || "";
}

describe("hubSubscriptionsClient", () => {
  it("signs create with website_to_hub, sends Idempotency-Key, and never puts accountId in the body", async () => {
    const { fetch, calls } = capture(async () =>
      jsonResponse(200, {
        subscriptionId: "sub_1",
        status: "pending",
        renewsAt: "2026-12-13T00:00:00.000Z",
        confirmation: { id: "cnf_1", url: "https://hub.example/c/1", termsVersion: AUTORENEW_TERMS_VERSION },
      }),
    );
    const client = createHubSubscriptionsClient(depsWith(fetch));
    const result = await client.create(createBody, "idem-from-caller");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.subscriptionId).toBe("sub_1");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://hub.example${HUB_WEBSITE_SUBSCRIPTIONS_PATH}`);
    expect(header(calls[0].init, "Idempotency-Key")).toBe("idem-from-caller");
    expect(header(calls[0].init, "X-DE-Source")).toBe("website");
    const body = String(calls[0].init.body);
    expect(JSON.parse(body).accountId).toBeUndefined();
    const signature = header(calls[0].init, "X-DE-Signature");
    const timestamp = header(calls[0].init, "X-DE-Timestamp");
    const eventId = header(calls[0].init, "X-DE-Event-ID");
    expect(
      signDeSyncRequest({
        method: "POST",
        path: HUB_WEBSITE_SUBSCRIPTIONS_PATH,
        timestamp,
        eventId,
        body,
        secret: "website-secret",
      }),
    ).toBe(signature);
    // A portal secret must not verify a website-signed create.
    expect(
      signDeSyncRequest({
        method: "POST",
        path: HUB_WEBSITE_SUBSCRIPTIONS_PATH,
        timestamp,
        eventId,
        body,
        secret: "portal-secret",
      }),
    ).not.toBe(signature);
    expect(hashBody(body)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("signs list and cancel with portal_to_hub and includes Idempotency-Key on cancel", async () => {
    const { fetch, calls } = capture(async (url, init) => {
      if (String(init.method) === "GET") {
        return jsonResponse(200, {
          subscriptions: [
            {
              subscriptionId: "sub_1",
              status: "active",
              plan: "Phishing Simulation Starter",
              termsVersion: AUTORENEW_TERMS_VERSION,
              renewsAt: "2026-12-13T00:00:00.000Z",
            },
          ],
        });
      }
      return jsonResponse(200, {
        subscriptionId: "sub_1",
        status: "cancelled",
        cancelledAt: "2026-11-13T17:00:00.000Z",
        cancelEffectiveAt: "2026-12-13T00:00:00.000Z",
        accessThrough: "2026-12-13T00:00:00.000Z",
        confirmation: { id: "cnf_cancel", url: "https://hub.example/c/cancel" },
      });
    });
    const client = createHubSubscriptionsClient(depsWith(fetch));
    const listed = await client.list("41");
    expect(listed.ok).toBe(true);
    if (listed.ok) expect(listed.data.subscriptions[0]?.subscriptionId).toBe("sub_1");

    const cancelled = await client.cancel(
      "sub_1",
      {
        portalClientId: "client-1",
        portalUserId: "user-1",
        requestedAt: "2026-11-13T17:00:00.000Z",
      },
      "idem-cancel-1",
    );
    expect(cancelled.ok).toBe(true);

    expect(calls[0].url).toBe(`https://hub.example${HUB_PORTAL_SUBSCRIPTIONS_PATH}?accountId=41`);
    expect(header(calls[0].init, "X-DE-Source")).toBe("portal");
    expect(header(calls[0].init, "Idempotency-Key")).toBe("");
    const listSig = header(calls[0].init, "X-DE-Signature");
    expect(
      signDeSyncRequest({
        method: "GET",
        path: `${HUB_PORTAL_SUBSCRIPTIONS_PATH}?accountId=41`,
        timestamp: header(calls[0].init, "X-DE-Timestamp"),
        eventId: header(calls[0].init, "X-DE-Event-ID"),
        body: "{}",
        secret: "portal-secret",
      }),
    ).toBe(listSig);

    expect(calls[1].url).toBe(`https://hub.example${hubPortalSubscriptionCancelPath("sub_1")}`);
    expect(header(calls[1].init, "Idempotency-Key")).toBe("idem-cancel-1");
    expect(header(calls[1].init, "X-DE-Source")).toBe("portal");
    const cancelBody = String(calls[1].init.body);
    expect(
      signDeSyncRequest({
        method: "POST",
        path: hubPortalSubscriptionCancelPath("sub_1"),
        timestamp: header(calls[1].init, "X-DE-Timestamp"),
        eventId: header(calls[1].init, "X-DE-Event-ID"),
        body: cancelBody,
        secret: "portal-secret",
      }),
    ).toBe(header(calls[1].init, "X-DE-Signature"));
  });

  it("returns not_configured when the Hub URL or secret is missing, without calling fetch", async () => {
    const fetch = vi.fn();
    const client = createHubSubscriptionsClient({
      fetch,
      base: () => null,
      websiteSecret: () => "website-secret",
      portalSecret: () => "portal-secret",
      timeoutMs: 1000,
      newIdempotencyKey: () => "idem",
    });
    const result = await client.create(createBody);
    expect(result).toEqual({ ok: false, reason: "not_configured" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
