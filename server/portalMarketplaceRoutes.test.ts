import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPortalMarketplaceRoutes, WAREHOUSE_PATH } from "./portalMarketplaceRoutes";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";

type TestUser = { role?: string; clientId?: string | null };

async function withMarketplaceServer(user: TestUser, run: (baseUrl: string) => Promise<void>) {
  const app = express();
  const auth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user?: TestUser }).user = user;
    next();
  };
  registerPortalMarketplaceRoutes(app, auth);
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

describe("portal marketplace fail-safe", () => {
  it("returns AUTHORITY_UNAVAILABLE for a mapped tenant without Hub catalog, empty and fail-closed", async () => {
    await withMarketplaceServer({ clientId: "client-1" }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/portal/marketplace`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
      expect(body.items).toEqual([]);
      expect(body.status).toBe("AUTHORITY_UNAVAILABLE");
      expect(body.trustedClientIds).toEqual(["client-1"]);
      expect(body.failClosed).toBe(true);
      expect(body.status).not.toBe("AUTHORIZED_GLOBAL");
      const raw = JSON.stringify(body).toLowerCase();
      expect(raw).not.toContain("sku");
      expect(raw).not.toContain("margin");
      expect(raw).not.toContain("ninjaone");
      expect(raw).not.toContain("pay_now");
    });
  });

  it("fail-closes UNMAPPED and does not grant unrestricted marketplace access", async () => {
    await withMarketplaceServer({ clientId: null }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/portal/marketplace`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("UNMAPPED");
      expect(body.trustedClientIds).toEqual([]);
      expect(body.items).toEqual([]);
      expect(body.failClosed).toBe(true);
      expect(body.status).not.toBe("AUTHORIZED_GLOBAL");
      expect(body.trustedClientIds).not.toBeNull();
    });
  });

  it("does not point non-staff accounts at the warehouse", async () => {
    for (const user of [
      { role: "user", clientId: "client-1" },
      { role: "user", clientId: null },
    ] satisfies TestUser[]) {
      await withMarketplaceServer(user, async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/portal/marketplace`);
        expect(response.status).toBe(200);
        const body = await response.json();
        expect(body.status).toBe(user.clientId ? "AUTHORITY_UNAVAILABLE" : "UNMAPPED");
        expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
        expect(body.warehouseUrl).toBeUndefined();
        const raw = JSON.stringify(body).toLowerCase();
        expect(raw).not.toContain("warehouse");
        expect(raw).not.toContain("pay_now");
      });
    }
  });
});

describe("portal marketplace staff account", () => {
  it("identifies live admin as staff and points at the warehouse without exposing catalog data", async () => {
    await withMarketplaceServer({ role: "admin", clientId: null }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/portal/marketplace`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("staff");
      expect(body.warehouseUrl).toBe(WAREHOUSE_PATH);
      expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
      expect(body.items).toEqual([]);
      // Staff get no tenant scope on this surface: the allow-list stays empty and
      // the enum is never widened to AUTHORIZED_GLOBAL.
      expect(body.trustedClientIds).toEqual([]);
      expect(body.failClosed).toBe(true);
      expect(body.status).not.toBe("AUTHORIZED_GLOBAL");
      const raw = JSON.stringify(body).toLowerCase();
      expect(raw).not.toContain("sku");
      expect(raw).not.toContain("margin");
      expect(raw).not.toContain("ninjaone");
      expect(raw).not.toContain("pay_now");
    });
  });

  it("recognises staff even when the admin record carries a tenant mapping", async () => {
    await withMarketplaceServer({ role: "admin", clientId: "client-1" }, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/portal/marketplace`);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe("staff");
      expect(body.warehouseUrl).toBe(WAREHOUSE_PATH);
      expect(body.items).toEqual([]);
      expect(body.trustedClientIds).toEqual([]);
      expect(body.failClosed).toBe(true);
    });
  });
});
