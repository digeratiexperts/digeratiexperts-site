import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { StoreClientPricingUnavailableError } from "./storeClientPricing";
import { createStoreQuoteRequestHandler } from "./storeQuoteRequestRoute";

describe("store quote request pricing outage", () => {
  let server: Server;
  let baseUrl: string;
  const insertQuoteRequest = vi.fn();
  const onCreated = vi.fn();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).userId = "user-1";
      (req as any).user = {
        id: "user-1",
        email: "buyer@example.test",
        clientId: "client-1",
      };
      next();
    });
    app.post("/api/store/quote-requests", createStoreQuoteRequestHandler({
      resolveClientPricingRows: async () => {
        throw new StoreClientPricingUnavailableError();
      },
      insertQuoteRequest,
      onCreated,
    }));

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

  it("returns retryable 503 without inserting or emitting a quote", async () => {
    const response = await fetch(`${baseUrl}/api/store/quote-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: "Store Buyer",
        contactEmail: "buyer@example.test",
        companyName: "Acme",
        requestedItems: [{
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 1,
        }],
      }),
    });

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual({
      error: "Quote pricing is temporarily unavailable. Please retry shortly.",
      retryable: true,
    });
    expect(insertQuoteRequest).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});

describe("store quote request impersonation context", () => {
  let server: Server;
  let baseUrl: string;
  const resolveClientPricingRows = vi.fn(async () => ([{
    productId: "prod-010",
    customPrice: 35,
    discountPercent: 10,
  }]));
  const insertQuoteRequest = vi.fn(async (values: Record<string, any>) => ({
    ...values,
    id: "target-quote",
    quoteNumber: "QR-TARGET-1",
    status: "pending",
    assignedTo: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  const onCreated = vi.fn();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).userId = "admin-user";
      (req as any).user = {
        id: "admin-user",
        email: "admin@example.test",
        clientId: "admin-client",
      };
      (req as any).portalClientContext = {
        clientId: "target-client",
        companyName: "Target Company",
        contactEmail: req.headers["x-incomplete-target"]
          ? null
          : "buyer@target.example.test",
        contactPhone: "480-555-0100",
        primaryContact: "Target Buyer",
        impersonating: true,
      };
      next();
    });
    app.post("/api/store/quote-requests", createStoreQuoteRequestHandler({
      resolveClientPricingRows,
      insertQuoteRequest: insertQuoteRequest as any,
      onCreated,
    }));

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

  it("prices and attributes an impersonated quote only to the active target client", async () => {
    resolveClientPricingRows.mockClear();
    insertQuoteRequest.mockClear();
    onCreated.mockClear();

    const response = await fetch(`${baseUrl}/api/store/quote-requests`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactName: "Forged Admin",
        contactEmail: "admin@example.test",
        contactPhone: "480-555-9999",
        companyName: "Admin Company",
        requestedItems: [{
          productId: "prod-010",
          sku: "DE-SVC-CM-ENDPOINT-CORE-MO",
          quantity: 1,
        }],
      }),
    });

    expect(response.status).toBe(200);
    expect(resolveClientPricingRows).toHaveBeenCalledWith("target-client");
    expect(insertQuoteRequest).toHaveBeenCalledWith(expect.objectContaining({
      userId: "admin-user",
      clientId: "target-client",
      contactName: "Target Buyer",
      contactEmail: "buyer@target.example.test",
      contactPhone: "480-555-0100",
      companyName: "Target Company",
      requestedItems: [expect.objectContaining({ unitPrice: 35 })],
    }));
    expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      contactName: "Target Buyer",
      contactEmail: "buyer@target.example.test",
      companyName: "Target Company",
    }));
  });

  it("fails closed before pricing or persistence when target contact data is incomplete", async () => {
    resolveClientPricingRows.mockClear();
    insertQuoteRequest.mockClear();
    onCreated.mockClear();

    const response = await fetch(`${baseUrl}/api/store/quote-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Incomplete-Target": "true",
      },
      body: JSON.stringify({
        contactName: "Forged Admin",
        contactEmail: "admin@example.test",
        companyName: "Admin Company",
        requestedItems: [],
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "The active client must have authoritative company and contact details before a quote can be submitted",
    });
    expect(resolveClientPricingRows).not.toHaveBeenCalled();
    expect(insertQuoteRequest).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });
});
