import { once } from "node:events";
import type { Server } from "node:http";
import express from "express";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createStoreClientInfoHandler,
  createStoreClientPricingHandler,
  requireDemoClientPricingAdministration,
} from "./storeClientPricingHttp";

describe("store client pricing HTTP behavior", () => {
  let server: Server;
  let baseUrl: string;
  const unavailable = new Error("authoritative store unavailable");
  const demoMutation = vi.fn();

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as any).user = {
        id: "user-1",
        clientId: "client-1",
        role: "admin",
      };
      next();
    });

    app.get("/api/store/client-info", createStoreClientInfoHandler({
      resolveAuthenticatedStoreClient: async () => {
        throw unavailable;
      },
      loadClient: async () => undefined,
      isUnavailableError: (error) => error === unavailable,
    }));

    app.get("/api/store/client-pricing", createStoreClientPricingHandler({
      resolveAuthenticatedStoreClient: async () => ({
        id: "client-1",
        companyName: "Acme",
        serviceType: "comanaged",
      }),
      loadClient: async () => undefined,
      resolveClientPricingRows: async () => {
        throw unavailable;
      },
      isUnavailableError: (error) => error === unavailable,
    }));

    const demoAdminGuard = requireDemoClientPricingAdministration(() => false);
    const mutateDemoPricing = (_req: express.Request, res: express.Response) => {
      demoMutation();
      res.json({ success: true });
    };
    app.post("/api/admin/client-pricing/set", demoAdminGuard, mutateDemoPricing);
    app.delete("/api/admin/client-pricing/:clientId/:productId", demoAdminGuard, mutateDemoPricing);

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

  it.each([
    ["client info", "/api/store/client-info", "Client information is temporarily unavailable"],
    ["client pricing", "/api/store/client-pricing", "Client pricing is temporarily unavailable"],
  ])("returns a retryable 503 when %s cannot load authoritative data", async (_label, path, message) => {
    const response = await fetch(`${baseUrl}${path}`);

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    await expect(response.json()).resolves.toEqual({
      error: message,
      retryable: true,
    });
  });

  it.each([
    ["POST", "/api/admin/client-pricing/set"],
    ["DELETE", "/api/admin/client-pricing/client-1/prod-010"],
  ])("returns 409 before a disabled demo admin %s mutation", async (method, path) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({ clientId: "client-1", productId: "prod-010" }) : undefined,
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "Demo client pricing administration is disabled in this environment",
    });
    expect(demoMutation).not.toHaveBeenCalled();
  });
});

describe("store client pricing impersonation context", () => {
  let server: Server;
  let baseUrl: string;
  const resolvedClientIds: Array<string | null | undefined> = [];
  const pricedClientIds: string[] = [];

  beforeAll(async () => {
    const app = express();
    app.use((req, _res, next) => {
      (req as any).user = { clientId: "admin-client" };
      (req as any).portalClientContext = {
        clientId: "target-client",
        impersonating: true,
      };
      next();
    });
    const resolveAuthenticatedStoreClient = async (user: { clientId?: string | null } | undefined) => {
      resolvedClientIds.push(user?.clientId);
      return {
        id: user?.clientId || "missing",
        companyName: "Target Company",
        serviceType: "comanaged",
      };
    };
    app.get("/api/store/client-info", createStoreClientInfoHandler({
      resolveAuthenticatedStoreClient,
      loadClient: async () => undefined,
      isUnavailableError: () => false,
    }));
    app.get("/api/store/client-pricing", createStoreClientPricingHandler({
      resolveAuthenticatedStoreClient,
      loadClient: async () => undefined,
      resolveClientPricingRows: async (clientId) => {
        pricedClientIds.push(clientId);
        return [{ productId: "prod-010", customPrice: 35 }];
      },
      isUnavailableError: () => false,
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

  it("returns the active target client and its pricing without falling back to the admin tenant", async () => {
    const info = await fetch(`${baseUrl}/api/store/client-info`);
    const pricing = await fetch(`${baseUrl}/api/store/client-pricing`);

    expect(info.status).toBe(200);
    await expect(info.json()).resolves.toMatchObject({
      clientId: "target-client",
      companyName: "Target Company",
    });
    expect(pricing.status).toBe(200);
    await expect(pricing.json()).resolves.toEqual({
      pricing: [{ productId: "prod-010", customPrice: 35 }],
    });
    expect(resolvedClientIds).toEqual(["target-client", "target-client"]);
    expect(pricedClientIds).toEqual(["target-client"]);
    expect(resolvedClientIds).not.toContain("admin-client");
  });
});
