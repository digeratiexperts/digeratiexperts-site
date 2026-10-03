import express from "express";
import { createServer, type Server } from "http";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CYTRACOM_DATA_USERS_EXAMPLE } from "./integrations/phone/cytracom.fixtures";

// Memory mode: no database, so manual records use the in-process map.
vi.mock("./db", () => ({ db: null, dbReady: false, initPromise: Promise.resolve() }));
// The company list comes from the route's listCompanies seam; keep the real store out.
vi.mock("./portalAuthStore", () => ({ listClients: () => [] }));

const COMPANIES = [
  { id: "acme", companyName: "Acme Ltd", type: "client" },
  { id: "globex", companyName: "Globex", type: "client" },
  { id: "msp-digerati", companyName: "Digerati Experts", type: "msp" },
];

const SECRET = "tskey-api-SUPERSECRET-123";
const PHONE_TOKEN = "cytracom-token-DO-NOT-LEAK";

// The route reads this object on every request; setEnv swaps its contents per test.
const liveEnv: Record<string, string | undefined> = {};
function setEnv(next: Record<string, string>) {
  for (const k of Object.keys(liveEnv)) delete liveEnv[k];
  Object.assign(liveEnv, next);
}
const vendorFetch = vi.fn();
let role = "admin";
let userId = "u-admin";

let server: Server;
let base = "";

beforeAll(async () => {
  const { registerPortalDataSourceRoutes } = await import("./portalDataSources");
  const app = express();
  app.use(express.json());
  const auth: express.RequestHandler = (req, _res, next) => {
    (req as any).user = { id: userId, role };
    next();
  };
  // Mirrors routes.ts requireAdmin: 403 for anyone but a DE admin.
  const requireAdmin: express.RequestHandler = (req, res, next) => {
    if ((req as any).user?.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    next();
  };
  registerPortalDataSourceRoutes(app, {
    guards: [auth, requireAdmin],
    env: liveEnv,
    fetchImpl: vendorFetch as any,
    listCompanies: () => COMPANIES,
  });
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(async () => {
  setEnv({});
  role = "admin";
  userId = `u-admin-${Math.random().toString(36).slice(2)}`;
  vendorFetch.mockReset();
  (await import("./portalManualRecords"))._resetManualRecordsMemory();
  (await import("./portalDataSources"))._resetDataSourceCheckLimit();
  (await import("./integrations/vpn/index"))._resetVpnCache();
});

afterEach(() => vi.restoreAllMocks());

const get = () => fetch(`${base}/api/portal/admin/data-sources`);
const check = (body: unknown) =>
  fetch(`${base}/api/portal/admin/data-sources/check`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

describe("GET /api/portal/admin/data-sources", () => {
  it("is DE-admin only", async () => {
    role = "user";
    expect((await get()).status).toBe(403);
    expect((await check({ area: "vpn", clientId: "acme" })).status).toBe(403);
  });

  it("never returns a secret value, only names and booleans", async () => {
    setEnv({
      PORTAL_VPN_PROVIDER: "tailscale",
      PORTAL_VPN_TAILSCALE_API_KEY: SECRET,
      PORTAL_VPN_CLIENT_MAP: JSON.stringify({ acme: "tag:acme-secret-scope" }),
      PORTAL_PHONE_PROVIDER: "cytracom",
      PORTAL_PHONE_CLIENT_MAP: JSON.stringify({ acme: "ACME" }),
      PORTAL_PHONE_CYTRACOM_TOKEN_ACME: PHONE_TOKEN,
      PORTAL_QA_EMAIL: "qa-login@example.test",
      PORTAL_QA_PASSWORD: "qa-password-DO-NOT-LEAK",
    });
    const res = await get();
    expect(res.status).toBe(200);
    const text = await res.text();
    for (const value of [SECRET, PHONE_TOKEN, "tag:acme-secret-scope", "qa-login@example.test", "qa-password-DO-NOT-LEAK"]) {
      expect(text).not.toContain(value);
    }
    const body = JSON.parse(text);
    expect(body.qaLogin).toEqual({
      emailEnv: "PORTAL_QA_EMAIL",
      passwordEnv: "PORTAL_QA_PASSWORD",
      emailSet: true,
      passwordSet: true,
    });
    const vpn = body.areas.find((a: any) => a.area === "vpn");
    expect(vpn.status).toEqual({ mode: "live", provider: "tailscale" });
    const tailscale = vpn.providers.find((p: any) => p.provider === "tailscale");
    expect(tailscale.active).toBe(true);
    expect(tailscale.ready).toBe(true);
    const vars = tailscale.groups.flatMap((g: any) => g.options.flatMap((o: any) => o.vars));
    expect(vars.find((v: any) => v.name === "PORTAL_VPN_TAILSCALE_API_KEY")).toMatchObject({ set: true });
    expect(vars.find((v: any) => v.name === "PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID")).toMatchObject({ set: false });
    for (const v of vars) expect(Object.keys(v).sort()).toEqual(["name", "purpose", "set"]);
  });

  it("lists allowed values and reserved providers per area", async () => {
    const body = await (await get()).json();
    const byArea = Object.fromEntries(body.areas.map((a: any) => [a.area, a]));
    const { INTEGRATION_PROVIDERS } = await import("./portalIntegrations");
    expect(byArea.vpn.allowedValues).toEqual(["sample", "hidden", ...INTEGRATION_PROVIDERS.vpn]);
    expect(byArea.phone.allowedValues).toEqual(["sample", "hidden", "cytracom"]);
    expect(byArea.shipping.allowedValues).toEqual(["sample", "hidden", "shipstation", "easypost", "shippo", "manual"]);
    expect(byArea.vpn.status.mode).toBe("sample");
    // Timus is listed either way: "notBuilt" once PORTAL_VPN_PROVIDER accepts it, "reserved" before.
    const timus = byArea.vpn.providers.find((p: any) => p.provider === "timus");
    expect(timus).toMatchObject({ ready: false, active: false, needsClientMap: false });
    expect(timus.groups[0]).toMatchObject({ rule: "optional", reserved: true });
    expect(timus.status).toBe(INTEGRATION_PROVIDERS.vpn.includes("timus") ? "notBuilt" : "reserved");
    expect(timus.groups[0].options[0].vars.map((v: any) => v.name)).toContain("PORTAL_VPN_TIMUS_API_KEY");
    const manualShipping = byArea.shipping.providers.find((p: any) => p.provider === "manual");
    expect(manualShipping.groups[0]).toMatchObject({ id: "carrier-tracking", reserved: false, satisfied: true });
  });

  it("flags a provider value the page does not accept", async () => {
    setEnv({ PORTAL_VPN_PROVIDER: "wireguard" });
    const vpn = (await (await get()).json()).areas.find((a: any) => a.area === "vpn");
    expect(vpn.status.mode).toBe("sample");
    expect(vpn.providerValueUnrecognized).toBe(true);
  });

  it("reports mapping coverage per company", async () => {
    setEnv({
      PORTAL_VPN_PROVIDER: "twingate",
      PORTAL_VPN_CLIENT_MAP: JSON.stringify({ acme: "R3JvdXA6MQ==" }),
      PORTAL_PHONE_PROVIDER: "cytracom",
      PORTAL_PHONE_CLIENT_MAP: JSON.stringify({ acme: "ACME", globex: "GLOBEX" }),
      PORTAL_PHONE_CYTRACOM_TOKEN_ACME: PHONE_TOKEN,
      PORTAL_SHIPPING_PROVIDER: "manual",
    });
    const m = await import("./portalManualRecords");
    await m.createManualRecord({ clientId: "globex", kind: "shipment", data: { trackingNumber: "1Z" } });
    await m.createManualRecord({ clientId: "globex", kind: "shipment", data: { trackingNumber: "1Y" } });

    const body = await (await get()).json();
    const company = (id: string) => body.companies.find((c: any) => c.id === id);
    expect(company("acme").name).toBe("Acme Ltd");
    expect(company("acme").areas.vpn).toMatchObject({ mapped: true, noMapNeeded: false });
    expect(company("globex").areas.vpn).toMatchObject({ mapped: false });
    expect(company("acme").areas.phone).toMatchObject({
      mapped: true,
      tokenSet: true,
      tokenEnvName: "PORTAL_PHONE_CYTRACOM_TOKEN_ACME",
    });
    expect(company("globex").areas.phone).toMatchObject({ mapped: true, tokenSet: false });
    expect(company("msp-digerati").areas.phone).toMatchObject({ mapped: false, tokenSet: false });
    expect(company("globex").areas.shipping).toMatchObject({ noMapNeeded: true, records: 2 });
    expect(company("acme").areas.shipping).toMatchObject({ noMapNeeded: true, records: 0 });

    const phone = body.areas.find((a: any) => a.area === "phone");
    const cytracom = phone.providers.find((p: any) => p.provider === "cytracom");
    expect(cytracom.perCompanyEnv).toMatchObject({ pattern: "PORTAL_PHONE_CYTRACOM_TOKEN_<KEY>", mapped: 2, set: 1 });
    expect(cytracom.ready).toBe(false);
    const twingate = body.areas.find((a: any) => a.area === "vpn").providers.find((p: any) => p.provider === "twingate");
    expect(twingate.ready).toBe(false);
    expect(twingate.groups[0].options[0].vars.map((v: any) => v.set)).toEqual([false, false]);
  });

  it("reports invalid map JSON as mapError instead of failing", async () => {
    setEnv({
      PORTAL_VPN_PROVIDER: "tailscale",
      PORTAL_VPN_TAILSCALE_API_KEY: SECRET,
      PORTAL_VPN_CLIENT_MAP: "{not json",
      PORTAL_SHIPPING_CLIENT_MAP: "[1,2]",
    });
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    const vpn = body.areas.find((a: any) => a.area === "vpn");
    expect(vpn.mapError).toBe(true);
    expect(vpn.providers.find((p: any) => p.provider === "tailscale").ready).toBe(false);
    expect(body.areas.find((a: any) => a.area === "shipping").mapError).toBe(true);
    expect(body.areas.find((a: any) => a.area === "phone").mapError).toBe(false);
    expect(body.companies.every((c: any) => c.areas.vpn.mapped === false)).toBe(true);
  });
});

describe("POST /api/portal/admin/data-sources/check", () => {
  it("rejects a bad area, a missing company and an unknown company", async () => {
    expect((await check({ area: "email", clientId: "acme" })).status).toBe(400);
    expect((await check({ area: "vpn" })).status).toBe(400);
    expect((await check({ area: "vpn", clientId: "nobody" })).status).toBe(404);
  });

  it("answers notLive when the page shows sample data or is hidden", async () => {
    setEnv({ PORTAL_PHONE_PROVIDER: "hidden" });
    expect(await (await check({ area: "vpn", clientId: "acme" })).json()).toMatchObject({ result: "notLive" });
    expect(await (await check({ area: "phone", clientId: "acme" })).json()).toMatchObject({ result: "notLive" });
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("answers notMapped without calling the vendor", async () => {
    setEnv({ PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_TAILSCALE_API_KEY: SECRET, PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}' });
    expect(await (await check({ area: "vpn", clientId: "globex" })).json()).toMatchObject({ result: "notMapped" });
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("answers ok with counts only", async () => {
    setEnv({
      PORTAL_PHONE_PROVIDER: "cytracom",
      PORTAL_PHONE_CLIENT_MAP: '{"acme":"ACME"}',
      PORTAL_PHONE_CYTRACOM_TOKEN_ACME: PHONE_TOKEN,
      PORTAL_VPN_PROVIDER: "manual",
    });
    vendorFetch.mockResolvedValue(new Response(JSON.stringify(CYTRACOM_DATA_USERS_EXAMPLE), { status: 200 }));
    const res = await check({ area: "phone", clientId: "acme" });
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ success: true, result: "ok", summary: "4 extensions" });
    expect(text).not.toContain("Bob Dylan");

    const m = await import("./portalManualRecords");
    await m.createManualRecord({ clientId: "acme", kind: "vpn_device", data: { name: "Laptop" } });
    expect(await (await check({ area: "vpn", clientId: "acme" })).json()).toMatchObject({ result: "ok", summary: "1 device" });
  });

  it("answers a generic error and logs the reason server-side", async () => {
    setEnv({ PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_TAILSCALE_API_KEY: SECRET, PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}' });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vendorFetch.mockResolvedValue(new Response("vendor says: invalid key xyz", { status: 401 }));
    const res = await check({ area: "vpn", clientId: "acme" });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(JSON.parse(text)).toMatchObject({ result: "error" });
    expect(text).not.toContain("invalid key");
    expect(text).not.toContain(SECRET);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls.at(-1)?.[0])).toContain("[portal-data-sources] check vpn/tailscale failed for client acme");
  });

  it("answers notBuilt for an accepted provider without an adapter, without a vendor call", async () => {
    const { INTEGRATION_PROVIDERS } = await import("./portalIntegrations");
    const provider = INTEGRATION_PROVIDERS.vpn.includes("timus") ? "timus" : "perimeter81";
    setEnv({ PORTAL_VPN_PROVIDER: provider, PORTAL_VPN_CLIENT_MAP: '{"acme":"x"}' });
    const body = await (await check({ area: "vpn", clientId: "acme" })).json();
    expect(body.result).toBe("notBuilt");
    expect(body.summary).toMatch(/not built yet/);
    expect(vendorFetch).not.toHaveBeenCalled();
  });

  it("answers error for a malformed map", async () => {
    setEnv({ PORTAL_SHIPPING_PROVIDER: "shippo", PORTAL_SHIPPING_SHIPPO_API_TOKEN: "x", PORTAL_SHIPPING_CLIENT_MAP: "{bad" });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await (await check({ area: "shipping", clientId: "acme" })).json()).toMatchObject({ result: "error" });
  });

  it("rate limits checks per admin", async () => {
    for (let i = 0; i < 10; i++) expect((await check({ area: "vpn", clientId: "acme" })).status).toBe(200);
    expect((await check({ area: "vpn", clientId: "acme" })).status).toBe(429);
  });
});
