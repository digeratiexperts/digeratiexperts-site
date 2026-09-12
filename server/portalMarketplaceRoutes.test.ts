import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerPortalMarketplaceRoutes, WAREHOUSE_PATH } from "./portalMarketplaceRoutes";
import { MARKETPLACE_ELIGIBILITY } from "@shared/checkoutEligibility";

type TestUser = { role?: string; clientId?: string | null };

async function startApp(user: TestUser): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  const auth = (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    (req as express.Request & { user?: TestUser }).user = user;
    next();
  };
  registerPortalMarketplaceRoutes(app, auth);
  const server = createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

function stopServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

describe("portal marketplace fail-safe (client)", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp({ role: "user", clientId: "client-1" }));
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it("returns an empty Request Approval catalog without warehouse fields", async () => {
    const response = await fetch(`${baseUrl}/api/portal/marketplace`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
    expect(body.items).toEqual([]);
    expect(body.status).toBe("unavailable");
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("sku");
    expect(raw).not.toContain("margin");
    expect(raw).not.toContain("ninjaone");
    expect(raw).not.toContain("pay_now");
    expect(raw).not.toContain("warehouse");
  });
});

describe("portal marketplace unmapped account", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp({ role: "user", clientId: null }));
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it("does not point unmapped non-staff accounts at the warehouse", async () => {
    const response = await fetch(`${baseUrl}/api/portal/marketplace`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("unmapped");
    expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("warehouse");
    expect(raw).not.toContain("pay_now");
  });
});

describe("portal marketplace staff account", () => {
  let server: Server;
  let baseUrl = "";

  beforeAll(async () => {
    ({ server, baseUrl } = await startApp({ role: "admin", clientId: null }));
  });

  afterAll(async () => {
    await stopServer(server);
  });

  it("identifies staff and points at the warehouse without exposing catalog data", async () => {
    const response = await fetch(`${baseUrl}/api/portal/marketplace`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("staff");
    expect(body.warehouseUrl).toBe(WAREHOUSE_PATH);
    expect(body.eligibility).toBe(MARKETPLACE_ELIGIBILITY);
    expect(body.items).toEqual([]);
    const raw = JSON.stringify(body).toLowerCase();
    expect(raw).not.toContain("sku");
    expect(raw).not.toContain("margin");
    expect(raw).not.toContain("ninjaone");
    expect(raw).not.toContain("pay_now");
  });
});
