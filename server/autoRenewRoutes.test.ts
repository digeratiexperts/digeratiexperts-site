import express, { type NextFunction, type Request, type Response } from "express";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_RENEW_CANCEL_POLICY_TEXT,
  AUTO_RENEW_CHECKBOX_LABEL_TEXT,
  AUTORENEW_TERMS_VERSION,
  buildAutoRenewTermsText,
} from "@shared/autoRenewContract";
import { registerAutoRenewRoutes, subscriptionPlanFromLines, type AutoRenewRouteDeps } from "./autoRenewRoutes";
import type { HubSubscriptionsClient } from "./integrations/hubSubscriptionsClient";
import { AUTORENEW_CONTRACT_ENV } from "./config/autoRenewContract";

const originalFlag = process.env[AUTORENEW_CONTRACT_ENV];

afterEach(() => {
  if (originalFlag === undefined) delete process.env[AUTORENEW_CONTRACT_ENV];
  else process.env[AUTORENEW_CONTRACT_ENV] = originalFlag;
});

const consent = {
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

const phishingLine = {
  productId: "prod-073",
  sku: "DE-DIG-ASMT-PHISH-MO",
  quantity: 1,
};

function authAs(
  user: { id: string; email: string; fullName?: string; role?: string; storeRole?: string; clientId?: string | null },
) {
  return (req: Request, _res: Response, next: NextFunction) => {
    (req as any).userId = user.id;
    (req as any).user = user;
    next();
  };
}

const allowRole = () => (req: Request, _res: Response, next: NextFunction) => next();

function mockHub(overrides: Partial<HubSubscriptionsClient> = {}): HubSubscriptionsClient {
  return {
    create: vi.fn(async () => ({
      ok: true as const,
      status: 201,
      data: {
        subscriptionId: "sub_1",
        status: "pending" as const,
        renewsAt: "2026-12-13T00:00:00.000Z",
        confirmation: { id: "cnf_1", url: "https://hub.example/c/1", termsVersion: AUTORENEW_TERMS_VERSION },
      },
    })),
    list: vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: {
        subscriptions: [
          {
            subscriptionId: "sub_1",
            status: "active" as const,
            plan: "Phishing Simulation Starter",
            termsVersion: AUTORENEW_TERMS_VERSION,
            renewsAt: "2026-12-13T00:00:00.000Z",
            terms: buildAutoRenewTermsText({
              priceCents: 19900,
              currency: "USD",
              frequency: "month",
              termMonths: 1,
            }),
          },
        ],
      },
    })),
    cancel: vi.fn(async () => ({
      ok: true as const,
      status: 200,
      data: {
        subscriptionId: "sub_1",
        status: "cancelled" as const,
        cancelledAt: "2026-11-13T17:00:00.000Z",
        cancelEffectiveAt: "2026-12-13T00:00:00.000Z",
        accessThrough: "2026-12-13T00:00:00.000Z",
        confirmation: { id: "cnf_c", url: "https://hub.example/c/c" },
      },
    })),
    ...overrides,
  };
}

function appWith(options?: {
  enabled?: boolean;
  user?: Parameters<typeof authAs>[0];
  hub?: HubSubscriptionsClient;
  send?: AutoRenewRouteDeps["sendSubscriptionConfirmation"];
}) {
  const hub = options?.hub || mockHub();
  const send = options?.send || vi.fn(async () => true);
  const app = express();
  app.use(express.json());
  const user = options?.user || {
    id: "user-1",
    email: "alex@example.com",
    fullName: "Alex Rivera",
    role: "admin",
    storeRole: "admin",
    clientId: "client-1",
  };
  registerAutoRenewRoutes(app, authAs(user), allowRole as any, {
    isEnabled: () => options?.enabled ?? true,
    getClient: (id) =>
      id === "client-1" ? { id: "client-1", companyName: "Example Co", contactEmail: "alex@example.com", hubAccountId: "41" } : undefined,
    hub,
    sendSubscriptionConfirmation: send,
    resolvePricing: async () => ({}),
  });
  return { app, hub, send };
}

async function invoke(
  app: express.Express,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  try {
    const res = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

describe("auto-renew routes", () => {
  it("exposes the flag as disabled by default on the public capabilities endpoint", async () => {
    delete process.env[AUTORENEW_CONTRACT_ENV];
    const { app } = appWith({ enabled: false });
    const res = await invoke(app, "GET", "/api/public/capabilities");
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ autoRenewContractEnabled: false });
  });

  it("returns 404 and does not call the Hub when the flag is disabled", async () => {
    const { app, hub } = appWith({ enabled: false });
    const create = await invoke(app, "POST", "/api/store/subscriptions", {
      portalClientId: "client-1",
      skuIds: ["DE-DIG-ASMT-PHISH-MO"],
      priceCents: 19900,
      currency: "USD",
      frequency: "month",
      termMonths: 1,
      customerType: "business",
      customerState: "AZ",
      consent,
      lineItems: [phishingLine],
    });
    expect(create.status).toBe(404);
    expect(create.json.code).toBe("AUTORENEW_CONTRACT_DISABLED");
    expect(hub.create).not.toHaveBeenCalled();

    const listed = await invoke(app, "GET", "/api/portal/subscriptions");
    expect(listed.status).toBe(200);
    expect(listed.json).toEqual({ autoRenewContractEnabled: false, subscriptions: [] });
    expect(hub.list).not.toHaveBeenCalled();

    const cancelled = await invoke(app, "POST", "/api/portal/subscriptions/sub_1/cancel", { requestedAt: new Date().toISOString() });
    expect(cancelled.status).toBe(404);
    expect(hub.cancel).not.toHaveBeenCalled();
  });

  it("rejects a create with missing consent fields and does not call the Hub", async () => {
    const { app, hub } = appWith({ enabled: true });
    const res = await invoke(app, "POST", "/api/store/subscriptions", {
      portalClientId: "client-1",
      skuIds: ["DE-DIG-ASMT-PHISH-MO"],
      priceCents: 19900,
      currency: "USD",
      frequency: "month",
      termMonths: 1,
      customerType: "business",
      customerState: "AZ",
      lineItems: [phishingLine],
    });
    expect(res.status).toBe(400);
    expect(res.json.code).toBe("AUTORENEW_CONSENT_INVALID");
    expect(hub.create).not.toHaveBeenCalled();

    const incomplete = await invoke(app, "POST", "/api/store/subscriptions", {
      portalClientId: "client-1",
      skuIds: ["DE-DIG-ASMT-PHISH-MO"],
      priceCents: 19900,
      currency: "USD",
      frequency: "month",
      termMonths: 1,
      customerType: "business",
      customerState: "AZ",
      consent: { ...consent, termsTextSnapshot: "no price or cancel method here" },
      lineItems: [phishingLine],
    });
    expect(incomplete.status).toBe(400);
    expect(incomplete.json.fields).toContain("termsTextSnapshot");
    expect(hub.create).not.toHaveBeenCalled();
  });

  it("creates a Hub subscription with server-attached ip and userAgent, never a browser accountId", async () => {
    const { app, hub, send } = appWith({ enabled: true });
    const res = await invoke(
      app,
      "POST",
      "/api/store/subscriptions",
      {
        portalClientId: "client-1",
        skuIds: ["DE-DIG-ASMT-PHISH-MO"],
        priceCents: 19900,
        currency: "USD",
        frequency: "month",
        termMonths: 1,
        customerType: "business",
        customerState: "AZ",
        consent,
        lineItems: [phishingLine],
        billing: { name: "Alex Rivera", email: "alex@example.com" },
      },
      { "Idempotency-Key": "idem-create-1", "User-Agent": "CheckoutTest/1.0" },
    );
    expect(res.status).toBe(201);
    expect(res.json.subscriptionId).toBe("sub_1");
    expect(hub.create).toHaveBeenCalledTimes(1);
    const [body, key] = (hub.create as any).mock.calls[0];
    expect(key).toBe("idem-create-1");
    expect(body.accountId).toBeUndefined();
    expect(body.portalClientId).toBe("client-1");
    expect(body.consent.ip).toBeTruthy();
    expect(body.consent.userAgent).toBe("CheckoutTest/1.0");
    expect(body.consent.termsTextSnapshot).toContain("$199.00");
    expect(send).toHaveBeenCalledTimes(1);
    expect((send as any).mock.calls[0][0].termsText).toContain("Cancellation:");
  });

  it("lists Hub subscriptions and cancels with one request when the flag is on", async () => {
    const { app, hub } = appWith({ enabled: true });
    const listed = await invoke(app, "GET", "/api/portal/subscriptions");
    expect(listed.status).toBe(200);
    expect(listed.json.autoRenewContractEnabled).toBe(true);
    expect(listed.json.subscriptions[0].subscriptionId).toBe("sub_1");
    expect(hub.list).toHaveBeenCalledWith("41");

    const cancelled = await invoke(app, "POST", "/api/portal/subscriptions/sub_1/cancel", {
      requestedAt: "2026-11-13T17:00:00.000Z",
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.status).toBe("cancelled");
    expect(hub.cancel).toHaveBeenCalledTimes(1);
    const [id, body] = (hub.cancel as any).mock.calls[0];
    expect(id).toBe("sub_1");
    expect(body.portalClientId).toBe("client-1");
    expect(body.portalUserId).toBe("user-1");
    expect(body.requestedAt).toBe("2026-11-13T17:00:00.000Z");
  });
});

describe("subscriptionPlanFromLines", () => {
  it("accepts a single gated SKU and rejects mixed carts", () => {
    const ok = subscriptionPlanFromLines([
      {
        productId: "prod-073",
        sku: "DE-DIG-ASMT-PHISH-MO",
        name: "Phishing Simulation Starter",
        quantity: 1,
        unitPrice: 199,
        pricingType: "monthly",
        total: 199,
      },
    ]);
    expect(ok).toEqual({
      skuIds: ["DE-DIG-ASMT-PHISH-MO"],
      priceCents: 19900,
      frequency: "month",
      termMonths: 1,
    });

    const mixed = subscriptionPlanFromLines([
      {
        productId: "prod-073",
        sku: "DE-DIG-ASMT-PHISH-MO",
        name: "Phishing Simulation Starter",
        quantity: 1,
        unitPrice: 199,
        pricingType: "monthly",
        total: 199,
      },
      {
        productId: "prod-070",
        sku: "DE-DIG-ASMT-QUICK-OT",
        name: "Quick Assessment",
        quantity: 1,
        unitPrice: 249,
        pricingType: "one_time",
        total: 249,
      },
    ]);
    expect("error" in mixed).toBe(true);
  });
});
