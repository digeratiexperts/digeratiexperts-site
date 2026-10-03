import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import shipstationFixture from "./fixtures/shipstation-list-shipments.json";
import easypostFixture from "./fixtures/easypost-list-shipments.json";
import easypostKeysFixture from "./fixtures/easypost-api-keys.json";

// Memory mode for the manual records store.
vi.mock("../../db", () => ({ db: null, dbReady: false }));

/**
 * GET /api/portal/shipping over HTTP: every mode of the contract, and that a
 * company only ever receives its own mapped scope.
 */

const ACME_USER = { id: "u-acme", role: "user", clientId: "acme" };
const GLOBEX_USER = { id: "u-globex", role: "user", clientId: "globex" };
const UNMAPPED_USER = { id: "u-initech", role: "user", clientId: "initech" };
const DE_ADMIN = { id: "u-admin", role: "admin", clientId: null };
const ADMIN_AS_GLOBEX = { id: "u-admin", role: "admin", clientId: null, impersonatingCompanyId: "globex" };

const signedInAs: express.RequestHandler = (req, _res, next) => {
  const raw = req.header("x-test-user");
  (req as express.Request & { user?: unknown }).user = raw ? JSON.parse(raw) : undefined;
  next();
};

const env: Record<string, string | undefined> = {};
const vendorCalls: { url: string; headers: Record<string, string> }[] = [];
let vendorFails = false;

/** Vendor stand-in: ShipStation answers each store with only that store's rows. */
const vendorFetch = (async (input: any, init?: RequestInit) => {
  const url = new URL(String(input));
  vendorCalls.push({ url: url.toString(), headers: (init?.headers ?? {}) as Record<string, string> });
  if (vendorFails) return new Response("upstream says: invalid key abc123", { status: 500 });
  if (url.host === "ssapi.shipstation.com") {
    const store = url.searchParams.get("storeId");
    const base = shipstationFixture.response.shipments[0];
    const rows = store === "111" ? [{ ...base, shipmentId: 1, orderNumber: "ACME-1", advancedOptions: { storeId: 111 } }]
      : store === "222" ? [{ ...base, shipmentId: 2, orderNumber: "GLOBEX-1", advancedOptions: { storeId: 222 } }]
      : [];
    return Response.json({ shipments: rows, total: rows.length, page: 1, pages: 1 });
  }
  if (url.host === "api.easypost.com") {
    if (url.pathname === "/v2/api_keys") return Response.json(easypostKeysFixture.response);
    return Response.json(easypostFixture.response);
  }
  return new Response("not found", { status: 404 });
}) as unknown as typeof fetch;

describe("GET /api/portal/shipping", () => {
  let server: Server;
  let base = "";

  beforeAll(async () => {
    const { registerPortalShippingRoutes } = await import("./routes");
    const app = express();
    app.use(express.json());
    registerPortalShippingRoutes(app, { guards: [signedInAs], env, fetchImpl: vendorFetch });
    server = createServer(app);
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const addr = server.address();
    base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
  });

  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  beforeEach(async () => {
    for (const k of Object.keys(env)) delete env[k];
    vendorCalls.length = 0;
    vendorFails = false;
    (await import("../../portalManualRecords"))._resetManualRecordsMemory();
    (await import("./easypost"))._resetEasyPostKeyCache();
    (await import("./carriers/index"))._resetCarrierCache();
    (await import("./carriers/common"))._resetCarrierTokens();
  });

  const get = async (user: unknown) => {
    const res = await fetch(`${base}/api/portal/shipping`, { headers: { "x-test-user": JSON.stringify(user) } });
    return { status: res.status, body: await res.json() };
  };

  it("sample mode (unset) answers the status only", async () => {
    const r = await get(ACME_USER);
    expect(r.body).toEqual({ success: true, status: { mode: "sample", provider: null } });
    expect(vendorCalls).toHaveLength(0);
  });

  it("hidden mode answers the status only", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "hidden";
    const r = await get(ACME_USER);
    expect(r.body).toEqual({ success: true, status: { mode: "hidden", provider: null } });
  });

  it("live with no company in view asks for one", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "shipstation";
    const r = await get(DE_ADMIN);
    expect(r.body).toMatchObject({ success: true, needsCompany: true });
    expect(vendorCalls).toHaveLength(0);
  });

  it("live with an unmapped company answers notMapped and never calls the vendor", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "shipstation";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "111" });
    env.PORTAL_SHIPPING_SHIPSTATION_API_KEY = "k";
    env.PORTAL_SHIPPING_SHIPSTATION_API_SECRET = "s";
    const r = await get(UNMAPPED_USER);
    expect(r.body).toMatchObject({ success: true, notMapped: true });
    expect(r.body.data).toBeUndefined();
    expect(vendorCalls).toHaveLength(0);
  });

  it("each company receives only its own mapped ShipStation store", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "shipstation";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "111", globex: "222" });
    env.PORTAL_SHIPPING_SHIPSTATION_API_KEY = "k";
    env.PORTAL_SHIPPING_SHIPSTATION_API_SECRET = "s";

    const acme = await get(ACME_USER);
    expect(acme.status).toBe(200);
    expect(acme.body.data.shipments.map((s: any) => s.reference)).toEqual(["ACME-1"]);
    expect(new URL(vendorCalls[0].url).searchParams.get("storeId")).toBe("111");

    const globex = await get(GLOBEX_USER);
    expect(globex.body.data.shipments.map((s: any) => s.reference)).toEqual(["GLOBEX-1"]);
    expect(new URL(vendorCalls[1].url).searchParams.get("storeId")).toBe("222");

    // A DE admin viewing as Globex gets Globex's store, not their own (none) or Acme's.
    const viewing = await get(ADMIN_AS_GLOBEX);
    expect(viewing.body.data.shipments.map((s: any) => s.reference)).toEqual(["GLOBEX-1"]);
    expect(viewing.body.manage).toBeUndefined();
    expect(new URL(vendorCalls[2].url).searchParams.get("storeId")).toBe("222");
  });

  it("EasyPost child users: each company is read with its own child key", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "easypost";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "user_acme", globex: "user_globex" });
    env.PORTAL_SHIPPING_EASYPOST_API_KEY = "PARENT_PROD_KEY";
    await get(GLOBEX_USER);
    const listCall = vendorCalls.find((c) => c.url.includes("/v2/shipments"));
    expect(listCall?.headers.Authorization).toBe(`Basic ${Buffer.from("GLOBEX_PROD_KEY:").toString("base64")}`);
  });

  it("EasyPost reference scope never leaks another company's shipments", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "easypost";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "reference:ACME-", globex: "reference:GLOBEX-" });
    env.PORTAL_SHIPPING_EASYPOST_API_KEY = "P";
    const acme = await get(ACME_USER);
    expect(acme.body.data.shipments.every((s: any) => s.reference.startsWith("ACME-"))).toBe(true);
    const globex = await get(GLOBEX_USER);
    expect(globex.body.data.shipments.map((s: any) => s.reference)).toEqual(["GLOBEX-77"]);
  });

  it("vendor failure answers 502 with a generic message and no vendor text", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "shipstation";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "111" });
    env.PORTAL_SHIPPING_SHIPSTATION_API_KEY = "k";
    env.PORTAL_SHIPPING_SHIPSTATION_API_SECRET = "s";
    vendorFails = true;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await get(ACME_USER);
    spy.mockRestore();
    expect(r.status).toBe(502);
    expect(r.body.success).toBe(false);
    expect(r.body.error).toMatch(/unavailable/i);
    expect(JSON.stringify(r.body)).not.toContain("abc123");
    expect(r.body.data).toBeUndefined();
  });

  it("a configuration fault (missing credentials) is also a generic 502", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "shippo";
    env.PORTAL_SHIPPING_CLIENT_MAP = JSON.stringify({ acme: "account:acc1" });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const r = await get(ACME_USER);
    spy.mockRestore();
    expect(r.status).toBe(502);
    expect(JSON.stringify(r.body)).not.toContain("PORTAL_SHIPPING_SHIPPO_API_TOKEN");
  });

  it("manual provider serves the company's own staff-entered records", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "manual";
    const m = await import("../../portalManualRecords");
    await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { trackingNumber: "1ZACME", status: "in_transit" } });
    await m.createManualRecord({ clientId: "globex", kind: "shipment", data: { trackingNumber: "1ZGLOBEX", status: "delivered" } });
    await m.createManualRecord({ clientId: "acme", kind: "vpn_device", data: { name: "Laptop" } });

    const acme = await get(ACME_USER);
    expect(acme.body.data.provider).toBe("manual");
    expect(acme.body.data.shipments.map((s: any) => s.trackingNumber)).toEqual(["1ZACME"]);
    expect(acme.body.data.counts).toEqual({ active: 1, total: 1 });

    expect(acme.body.manage).toBeUndefined();

    const globex = await get(ADMIN_AS_GLOBEX);
    expect(globex.body.data.shipments.map((s: any) => s.trackingNumber)).toEqual(["1ZGLOBEX"]);
    expect(globex.body.manage).toEqual({ clientId: "globex" });
    expect(vendorCalls).toHaveLength(0);
    expect(acme.body.data.shipments[0].carrierStatus).toBeNull();
  });

  it("manual provider keeps the staff status (no 502) when a configured carrier fails", async () => {
    env.PORTAL_SHIPPING_PROVIDER = "manual";
    env.PORTAL_CARRIER_UPS_CLIENT_ID = "ups-id";
    env.PORTAL_CARRIER_UPS_CLIENT_SECRET = "ups-secret-value";
    vendorFails = true;
    const m = await import("../../portalManualRecords");
    await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { carrier: "UPS", trackingNumber: "1Z023E2X0214323462", status: "in_transit" } });
    await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { carrier: "FedEx", trackingNumber: "123456789012", status: "processing" } });
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const r = await get(ACME_USER);
    const logged = spy.mock.calls.map((c) => String(c[0])).join("\n");
    spy.mockRestore();
    expect(r.status).toBe(200);
    expect(r.body.data.shipments.map((s: any) => [s.status, s.carrierStatus])).toEqual(
      expect.arrayContaining([["in_transit", null], ["processing", null]]),
    );
    // UPS (configured) was tried; FedEx (no keys) never was.
    expect(vendorCalls.some((c) => c.url.startsWith("https://onlinetools.ups.com/"))).toBe(true);
    expect(vendorCalls.some((c) => c.url.includes("fedex.com"))).toBe(false);
    expect(logged).toContain("ups token answered HTTP 500");
    expect(logged).not.toContain("ups-secret-value");
    expect(JSON.stringify(r.body)).not.toContain("upstream says");
  });
});
