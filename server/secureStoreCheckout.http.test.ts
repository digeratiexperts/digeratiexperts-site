import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { registerSecureZohoStoreCheckout } from "./secureStoreCheckout";
import { StoreClientPricingUnavailableError } from "./storeClientPricing";

const checkoutDoubles = vi.hoisted(() => {
  const insertedOrders: Array<Record<string, any>> = [];
  const createPaymentSession = vi.fn(async () => ({
    payment_session_id: "target-payment-session",
    url: "https://payments.example.test/target-session",
  }));
  const returning = vi.fn(async () => [{ id: "target-order" }]);
  const values = vi.fn((order: Record<string, any>) => {
    insertedOrders.push(order);
    return { returning };
  });
  const insert = vi.fn(() => ({ values }));
  const where = vi.fn(async () => undefined);
  const set = vi.fn(() => ({ where }));
  const update = vi.fn(() => ({ set }));
  return {
    insertedOrders,
    createPaymentSession,
    insert,
    update,
    values,
    returning,
    set,
    where,
  };
});

vi.mock("./db", () => ({
  db: {
    insert: checkoutDoubles.insert,
    update: checkoutDoubles.update,
  },
  dbReady: true,
  initPromise: Promise.resolve(),
}));

vi.mock("./zohoPayments", () => ({
  zohoPayments: {
    isConfigured: vi.fn(() => true),
    createPaymentSession: checkoutDoubles.createPaymentSession,
  },
}));

describe("secure store checkout pricing outage", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    registerSecureZohoStoreCheckout(
      app,
      (req, _res, next) => {
        req.userId = "user-1";
        req.user = {
          id: "user-1",
          email: "buyer@example.test",
          role: "user",
          storeRole: "comanaged",
          clientId: "client-1",
        };
        next();
      },
      () => (_req, _res, next) => next(),
      {
        resolveClientPricingRows: async () => {
          throw new StoreClientPricingUnavailableError();
        },
      },
    );

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) return;
    server.close();
    await once(server, "close");
  });

  it("returns retryable 503 before checkout persistence is loaded", async () => {
    const response = await fetch(`${baseUrl}/api/store/checkout/zoho`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billing: {
          name: "Store Buyer",
          email: "buyer@example.test",
          company: "Acme",
        },
        lineItems: [{
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 1,
        }],
      }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual({
      error: "Checkout pricing is temporarily unavailable. Please retry shortly.",
      retryable: true,
    });
  });
});

describe("secure store checkout impersonation context", () => {
  let server: Server;
  let baseUrl: string;
  const resolveClientPricingRows = vi.fn(async () => ([{
    productId: "prod-010",
    customPrice: 35,
    discountPercent: 10,
  }]));

  beforeAll(async () => {
    const app = express();
    app.use(express.json());

    registerSecureZohoStoreCheckout(
      app,
      (req, _res, next) => {
        req.userId = "admin-user";
        req.user = {
          id: "admin-user",
          email: "admin@example.test",
          role: "admin",
          storeRole: "admin",
          clientId: "admin-client",
        };
        req.portalClientContext = {
          clientId: "target-client",
          companyName: "Target Company",
          contactEmail: req.headers["x-incomplete-target"]
            ? null
            : "buyer@target.example.test",
          primaryContact: "Target Buyer",
          serviceType: "comanaged",
          impersonating: true,
        };
        next();
      },
      () => (_req, _res, next) => next(),
      { resolveClientPricingRows },
    );

    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    if (!server) return;
    server.close();
    await once(server, "close");
  });

  it("uses target pricing and target contact attribution for an impersonated checkout", async () => {
    checkoutDoubles.insertedOrders.length = 0;
    checkoutDoubles.createPaymentSession.mockClear();
    resolveClientPricingRows.mockClear();

    const response = await fetch(`${baseUrl}/api/store/checkout/zoho`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        billing: {
          name: "Forged Admin",
          email: "admin@example.test",
          company: "Admin Company",
        },
        lineItems: [{
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 1,
        }],
        subtotal: 35,
        total: 35,
      }),
    });

    expect(response.status).toBe(200);
    expect(resolveClientPricingRows).toHaveBeenCalledWith("target-client");
    expect(checkoutDoubles.insertedOrders).toEqual([
      expect.objectContaining({
        userId: "admin-user",
        clientId: "target-client",
        billingName: "Target Buyer",
        billingEmail: "buyer@target.example.test",
        billingCompany: "Target Company",
        subtotal: "35.00",
        total: "35.00",
        lineItems: [expect.objectContaining({ unitPrice: 35 })],
      }),
    ]);
    expect(checkoutDoubles.createPaymentSession).toHaveBeenCalledWith(expect.objectContaining({
      customerName: "Target Buyer",
      customerEmail: "buyer@target.example.test",
      totalAmount: 35,
    }));
  });

  it("fails closed before pricing or persistence when target context is incomplete", async () => {
    checkoutDoubles.insertedOrders.length = 0;
    resolveClientPricingRows.mockClear();

    const response = await fetch(`${baseUrl}/api/store/checkout/zoho`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Incomplete-Target": "true",
      },
      body: JSON.stringify({
        billing: {
          name: "Forged Admin",
          email: "admin@example.test",
          company: "Admin Company",
        },
        lineItems: [],
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The active client must have authoritative company, contact, and service details before checkout",
    });
    expect(resolveClientPricingRows).not.toHaveBeenCalled();
    expect(checkoutDoubles.insertedOrders).toEqual([]);
  });
});
