import express from "express";
import { createServer, type Server } from "http";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import tailscaleFixture from "./fixtures/tailscale.devices.json";
import twingateFixture from "./fixtures/twingate.group-users.json";

// Memory mode: the manual-records store uses its in-process map.
vi.mock("../../db", () => ({ db: null, dbReady: false }));

type Caller = { id: string; role: string; clientId?: string | null; impersonatingCompanyId?: string | null };

const CALLERS: Record<string, Caller> = {
  acmeUser: { id: "u1", role: "client", clientId: "acme" },
  globexUser: { id: "u2", role: "client", clientId: "globex" },
  initechUser: { id: "u3", role: "client", clientId: "initech" },
  admin: { id: "a1", role: "admin", clientId: null },
  adminAsAcme: { id: "a1", role: "admin", clientId: null, impersonatingCompanyId: "acme" },
};

const docDevice = tailscaleFixture.devices[0];
const TAILNET = {
  devices: [
    { ...docDevice, isExternal: false, nodeId: "acme-1", hostname: "acme-laptop", tags: ["tag:acme"], connectedToControl: true },
    { ...docDevice, isExternal: false, nodeId: "acme-2", hostname: "acme-desk", tags: ["tag:acme"] },
    { ...docDevice, isExternal: false, nodeId: "globex-1", hostname: "globex-pc", tags: ["tag:globex"] },
    { ...docDevice, isExternal: false, nodeId: "de-1", hostname: "de-server", tags: [] },
  ],
};

let env: Record<string, string | undefined> = {};
const fetchImpl = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

let server: Server;
let base = "";

beforeAll(async () => {
  const { registerPortalVpnRoutes } = await import("./routes");
  const app = express();
  const as: express.RequestHandler = (req, _res, next) => {
    const who = String(req.headers["x-test-caller"] || "");
    (req as any).user = CALLERS[who];
    next();
  };
  registerPortalVpnRoutes(app, {
    guards: [as],
    get env() {
      return env;
    },
    fetchImpl: fetchImpl as unknown as typeof fetch,
  } as any);
  server = createServer(app);
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

beforeEach(async () => {
  env = {};
  fetchImpl.mockReset();
  (await import("./index"))._resetVpnCache();
  (await import("./tailscale"))._resetTailscaleTokenCache();
  (await import("../../portalManualRecords"))._resetManualRecordsMemory();
});

async function get(caller: keyof typeof CALLERS) {
  const res = await fetch(`${base}/api/portal/vpn`, { headers: { "x-test-caller": caller } });
  return { status: res.status, body: await res.json() };
}

describe("GET /api/portal/vpn", () => {
  it("sample by default: no data, no vendor call", async () => {
    const r = await get("acmeUser");
    expect(r.body).toEqual({ success: true, status: { mode: "sample", provider: null } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("hidden", async () => {
    env.PORTAL_VPN_PROVIDER = "hidden";
    const r = await get("acmeUser");
    expect(r.body).toEqual({ success: true, status: { mode: "hidden", provider: null } });
  });

  it("live without a company in view asks for one", async () => {
    env = { PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}', PORTAL_VPN_TAILSCALE_API_KEY: "k" };
    const r = await get("admin");
    expect(r.body).toMatchObject({ success: true, needsCompany: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("an unmapped company gets notMapped and no vendor data", async () => {
    env = { PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}', PORTAL_VPN_TAILSCALE_API_KEY: "k" };
    const r = await get("initechUser");
    expect(r.body).toEqual({ success: true, status: { mode: "live", provider: "tailscale" }, notMapped: true });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("tailscale: each company only ever receives its own tag's devices", async () => {
    env = {
      PORTAL_VPN_PROVIDER: "tailscale",
      PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme","globex":"tag:globex"}',
      PORTAL_VPN_TAILSCALE_API_KEY: "tskey-api-k",
    };
    fetchImpl.mockImplementation(async () => json(TAILNET));
    const acme = await get("acmeUser");
    expect(acme.status).toBe(200);
    expect(acme.body.data.devices.map((d: any) => d.id)).toEqual(["acme-2", "acme-1"]);
    expect(acme.body.data.devices.find((d: any) => d.id === "acme-1").status).toBe("online");
    expect(acme.body.manage).toBeUndefined();

    const globex = await get("globexUser");
    expect(globex.body.data.devices.map((d: any) => d.id)).toEqual(["globex-1"]);

    const viewingAcme = await get("adminAsAcme");
    expect(viewingAcme.body.data.devices.map((d: any) => d.id)).toEqual(["acme-2", "acme-1"]);
    const text = JSON.stringify([acme.body, globex.body, viewingAcme.body]);
    expect(text).not.toContain("de-server");
    expect(text).not.toContain("tskey-api-k");
  });

  it("vendor failure answers a generic 502 and keeps vendor text server-side", async () => {
    env = { PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}', PORTAL_VPN_TAILSCALE_API_KEY: "k" };
    fetchImpl.mockImplementation(async () => json({ message: "internal vendor detail" }, 500));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await get("acmeUser");
    expect(r.status).toBe(502);
    expect(r.body).toEqual({ success: false, status: { mode: "live", provider: "tailscale" }, error: "VPN data isn't available right now." });
    expect(JSON.stringify(r.body)).not.toContain("internal vendor detail");
    expect(String(warn.mock.calls[0][0])).toContain("[portal-vpn] tailscale failed for client acme");
    warn.mockRestore();
  });

  it("a malformed client map fails closed with 502", async () => {
    env = { PORTAL_VPN_PROVIDER: "tailscale", PORTAL_VPN_CLIENT_MAP: "{oops", PORTAL_VPN_TAILSCALE_API_KEY: "k" };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await get("acmeUser");
    expect(r.status).toBe(502);
    expect(fetchImpl).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("twingate: sends the company's own group id and returns its users' devices", async () => {
    env = {
      PORTAL_VPN_PROVIDER: "twingate",
      PORTAL_VPN_CLIENT_MAP: '{"acme":"R3JvdXA6MTIz","globex":"R3JvdXA6NDU2"}',
      PORTAL_VPN_TWINGATE_NETWORK: "denet",
      PORTAL_VPN_TWINGATE_API_KEY: "tg-key",
    };
    fetchImpl.mockImplementation(async () => json(twingateFixture));
    const r = await get("acmeUser");
    expect(r.body.data).toMatchObject({ provider: "twingate", reportsLiveStatus: false });
    expect(r.body.data.devices.map((d: any) => d.id)).toEqual(["dev-1"]);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0][1]?.body));
    expect(sent.variables.groupId).toBe("R3JvdXA6MTIz");

    // globex's group id is sent for globex; a vendor answer for another group is refused.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const g = await get("globexUser");
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).variables.groupId).toBe("R3JvdXA6NDU2");
    expect(g.status).toBe(502);
    warn.mockRestore();
  });

  it("perimeter81: 502 not available with a server log line, no vendor call", async () => {
    env = { PORTAL_VPN_PROVIDER: "perimeter81", PORTAL_VPN_CLIENT_MAP: '{"acme":"x"}' };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = await get("acmeUser");
    expect(r.status).toBe(502);
    expect(r.body.error).toBe("VPN data isn't available right now.");
    expect(String(warn.mock.calls[0][0])).toMatch(/perimeter81.*no devices endpoint/);
    expect(fetchImpl).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("timus: answers the generic 502 for every caller with a company, never leaks, makes no vendor call", async () => {
    env = {
      PORTAL_VPN_PROVIDER: "timus",
      PORTAL_VPN_CLIENT_MAP: '{"acme":"timus-tenant-acme"}',
      // Reserved names: set here to prove they are neither read out nor used.
      PORTAL_VPN_TIMUS_API_KEY: "timus-secret-key",
      PORTAL_VPN_TIMUS_BASE_URL: "https://timus.example.invalid",
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const caller of ["acmeUser", "initechUser", "adminAsAcme"] as const) {
      const r = await get(caller);
      expect(r.status).toBe(502);
      expect(r.body).toEqual({ success: false, status: { mode: "live", provider: "timus" }, error: "VPN data isn't available right now." });
      const text = JSON.stringify(r.body);
      expect(text).not.toContain("timus-secret-key");
      expect(text).not.toContain("timus-tenant-acme");
      expect(text).not.toContain("example.invalid");
      expect(text).not.toContain("not documented");
    }
    expect(String(warn.mock.calls[0][0])).toBe(
      "[portal-vpn] timus failed for client acme: VpnProviderUnavailableError: Timus API not documented yet",
    );
    expect(fetchImpl).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("timus: an admin with no company in view is asked to pick one first", async () => {
    env = { PORTAL_VPN_PROVIDER: "timus" };
    const r = await get("admin");
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, status: { mode: "live", provider: "timus" }, needsCompany: true });
  });

  it("timus is an accepted value: case-insensitive, not sample", async () => {
    const { readIntegrationStatus } = await import("../../portalIntegrations");
    expect(readIntegrationStatus("vpn", { PORTAL_VPN_PROVIDER: " Timus " })).toEqual({ mode: "live", provider: "timus" });
  });

  it("manual: a company reads only its own records; an admin viewing as it can manage them", async () => {
    const m = await import("../../portalManualRecords");
    await m.createManualRecord({ clientId: "acme", kind: "vpn_device", data: { name: "Acme laptop", status: "active", protocol: "wireguard" } });
    await m.createManualRecord({ clientId: "globex", kind: "vpn_device", data: { name: "Globex desk" } });
    await m.createManualRecord({ clientId: "acme", kind: "shipment", data: { name: "not a device" } });
    env = { PORTAL_VPN_PROVIDER: "manual" };

    const acme = await get("acmeUser");
    expect(acme.body.data.devices.map((d: any) => d.name)).toEqual(["Acme laptop"]);
    expect(acme.body.data.service.status).toBe("staff_managed");
    expect(acme.body.manage).toBeUndefined();

    const admin = await get("adminAsAcme");
    expect(admin.body.data.devices.map((d: any) => d.name)).toEqual(["Acme laptop"]);
    expect(admin.body.manage).toEqual({ clientId: "acme" });

    const initech = await get("initechUser");
    expect(initech.body.data.devices).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
