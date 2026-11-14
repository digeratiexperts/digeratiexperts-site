import { afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import type { Server } from "node:http";
import { AddressInfo } from "node:net";
import { DE_STORE_PLACE_ORDER_BUTTON, type TaxQuoteResponse } from "@shared/deStoreContract";
import { blockedStateMessage } from "@shared/deStoreLegalCopy";
import { registerDeStoreRoutes, type DeStoreRouteDeps } from "./deStoreRoutes";
import type { HubStoreClient } from "./integrations/hubStoreClient";

function quote(): TaxQuoteResponse {
  return {
    calculationId: "calc_route",
    quotedAt: "2026-11-13T18:00:00Z",
    expiresAt: "2026-11-13T19:00:00Z",
    currency: "USD",
    lines: [],
    fees: [],
    subtotalCents: 1000,
    taxCents: 0,
    feeCents: 0,
    totalCents: 1000,
    destination: { region: "AZ", country: "US", sourcedFrom: "ship_to" },
  };
}

function listen(app: express.Express): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const port = (server.address() as AddressInfo).port;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

const addresses = {
  billTo: {
    street1: "1 N Arizona Ave",
    city: "Chandler",
    region: "AZ",
    postalCode: "85225",
    country: "US",
  },
  shipTo: {
    street1: "200 E Chicago St",
    city: "Chandler",
    region: "AZ",
    postalCode: "85225",
    country: "US",
  },
};

const lines = [
  {
    lineId: "l1",
    sku: "DE-STORE-TEST-SAAS",
    description: "Dashboard",
    taxCategory: "saas",
    quantity: 1,
    unitAmountCents: 1000,
  },
];

describe("de store routes", () => {
  const servers: Server[] = [];
  afterAll(async () => {
    await Promise.all(servers.map((server) => new Promise<void>((resolve) => server.close(() => resolve()))));
  });

  async function start(overrides: Partial<DeStoreRouteDeps> = {}) {
    const capturePayment = overrides.capturePayment ?? vi.fn(async () => ({
      ok: true as const,
      paymentRef: "pay_route",
      capturedAt: "2026-11-13T18:00:30Z",
    }));
    const quoteTax = vi.fn(async () => ({ ok: true as const, status: 200, data: quote() }));
    const hub = {
      quoteTax,
      commitTax: vi.fn(async () => ({
        ok: true as const,
        status: 200,
        data: { calculationId: "calc_route", committedAt: "2026-11-13T18:01:00Z", currency: "USD", taxCents: 0, feeCents: 0, totalCents: 1000 },
      })),
      voidTax: vi.fn(async () => ({ ok: true as const, status: 200, data: { calculationId: "calc_route", voidedAt: "2026-11-13T18:01:00Z" } })),
      submitEvent: vi.fn(async () => ({ ok: true as const, status: 200, data: {} })),
    } as unknown as HubStoreClient;
    const app = express();
    app.use(express.json());
    registerDeStoreRoutes(app, {
      isEnabled: () => true,
      consumerCheckout: () => false,
      previewCatalog: () => false,
      stateList: () => ({ enabled: false, mode: "deny", regions: [] }),
      hub,
      capturePayment,
      autoRenewContractEnabled: () => false,
      now: () => new Date("2026-11-13T18:00:10Z"),
      ...overrides,
    });
    const started = await listen(app);
    servers.push(started.server);
    return { ...started, capturePayment, quoteTax };
  }

  it("returns 404 while the store flag is off", async () => {
    const { url } = await start({ isEnabled: () => false });
    const status = await fetch(`${url}/api/store/v1/status`);
    const checkout = await fetch(`${url}/api/store/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-csrf-token": "test", host: new URL(url).host, origin: url },
      body: "{}",
    });
    expect(status.status).toBe(404);
    expect(checkout.status).toBe(404);
  });

  it("rejects checkout without a CSRF header", async () => {
    const { url } = await start();
    const res = await fetch(`${url}/api/store/v1/checkout`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.code).toBe("CSRF_FORBIDDEN");
  });

  it("surfaces a site state block over HTTP and does not capture payment", async () => {
    const { url, capturePayment, quoteTax } = await start({
      stateList: () => ({ enabled: true, mode: "deny", regions: ["NY"] }),
    });
    const res = await fetch(`${url}/api/store/v1/checkout`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-csrf-token": "test-token",
        origin: url,
      },
      body: JSON.stringify({
        email: "buyer@example.com",
        buyerRole: "self_managed",
        billTo: { ...addresses.billTo, region: "NY", city: "New York", postalCode: "10001" },
        shipTo: addresses.shipTo,
        lines,
        clickwrap: {
          box1Accepted: true,
          box2Accepted: true,
          businessName: "Example Business LLC",
          buttonText: DE_STORE_PLACE_ORDER_BUTTON,
        },
      }),
    });
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe("state_not_served");
    expect(body.error).toBe(blockedStateMessage(["NY"]));
    expect(capturePayment).not.toHaveBeenCalled();
    expect(quoteTax).not.toHaveBeenCalled();
  });
});
