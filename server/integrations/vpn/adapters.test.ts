import { beforeEach, describe, expect, it, vi } from "vitest";
import tailscaleFixture from "./fixtures/tailscale.devices.json";
import twingateFixture from "./fixtures/twingate.group-users.json";

vi.mock("../../db", () => ({ db: null, dbReady: false }));

const docDevice = tailscaleFixture.devices[0];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("tailscale adapter", () => {
  beforeEach(async () => (await import("./tailscale"))._resetTailscaleTokenCache());

  it("leaves out the docs example device: it is external (shared in) and untagged for the company", async () => {
    const { mapTailscaleDevices } = await import("./tailscale");
    expect(mapTailscaleDevices(tailscaleFixture.devices, "tag:golink")).toEqual([]);
  });

  it("maps a member device carrying the company tag", async () => {
    const { mapTailscaleDevices } = await import("./tailscale");
    const devices = mapTailscaleDevices([{ ...docDevice, isExternal: false }], "tag:golink");
    expect(devices).toEqual([
      {
        id: "n5SUKe8CNTRL",
        name: "pangolin",
        os: "linux",
        status: "offline",
        lastSeen: "2022-12-01T05:23:30.000Z",
        user: "amelie@example.com",
      },
    ]);
  });

  it("reads online, pending and unknown states and requires an exact tag match", async () => {
    const { mapTailscaleDevices } = await import("./tailscale");
    const base = { ...docDevice, isExternal: false };
    const devices = mapTailscaleDevices(
      [
        { ...base, nodeId: "a", hostname: "a", tags: ["tag:acme"], connectedToControl: true, lastSeen: undefined },
        { ...base, nodeId: "b", hostname: "b", tags: ["tag:acme"], authorized: false },
        { ...base, nodeId: "c", hostname: "c", tags: ["tag:acme"], connectedToControl: undefined },
        { ...base, nodeId: "d", hostname: "d", tags: ["tag:acme-two"] },
        { ...base, nodeId: "e", hostname: "e", tags: [] },
        { ...base, nodeId: "f", hostname: "f", tags: null },
      ],
      "tag:acme",
    );
    expect(devices.map((d) => [d.id, d.status, d.lastSeen])).toEqual([
      ["a", "online", null],
      ["b", "pending", "2022-12-01T05:23:30.000Z"],
      ["c", "unknown", "2022-12-01T05:23:30.000Z"],
    ]);
  });

  it("calls the documented devices endpoint with a bearer token and filters by tag", async () => {
    const { loadTailscaleVpnData } = await import("./tailscale");
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        devices: [
          { ...docDevice, isExternal: false, tags: ["tag:acme"], connectedToControl: true },
          { ...docDevice, isExternal: false, nodeId: "other", hostname: "globex-pc", tags: ["tag:globex"] },
        ],
      }),
    );
    const data = await loadTailscaleVpnData({
      tag: "tag:acme",
      env: { PORTAL_VPN_TAILSCALE_API_KEY: "tskey-api-test" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.tailscale.com/api/v2/tailnet/-/devices");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer tskey-api-test");
    expect(data.devices.map((d) => d.id)).toEqual(["n5SUKe8CNTRL"]);
    expect(data.reportsLiveStatus).toBe(true);
  });

  it("gets an OAuth token first when only an OAuth client is configured", async () => {
    const { loadTailscaleVpnData } = await import("./tailscale");
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith("/oauth/token") ? jsonResponse({ access_token: "tok-1", expires_in: 3600 }) : jsonResponse({ devices: [] }),
    );
    await loadTailscaleVpnData({
      tag: "tag:acme",
      env: { PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_ID: "cid", PORTAL_VPN_TAILSCALE_OAUTH_CLIENT_SECRET: "secret" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][];
    expect(calls[0][0]).toBe("https://api.tailscale.com/api/v2/oauth/token");
    expect(String(calls[0][1].body)).toContain("grant_type=client_credentials");
    expect((calls[1][1].headers as Record<string, string>).authorization).toBe("Bearer tok-1");
  });

  it("refuses a map value that is not a tag, and missing credentials", async () => {
    const { loadTailscaleVpnData } = await import("./tailscale");
    const fetchImpl = vi.fn();
    await expect(
      loadTailscaleVpnData({ tag: "acme", env: { PORTAL_VPN_TAILSCALE_API_KEY: "k" }, fetchImpl: fetchImpl as any }),
    ).rejects.toThrow(/tag/);
    await expect(loadTailscaleVpnData({ tag: "tag:acme", env: {}, fetchImpl: fetchImpl as any })).rejects.toThrow(
      /PORTAL_VPN_TAILSCALE_API_KEY/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("twingate adapter", () => {
  const user = twingateFixture.data.group.users.edges[0].node;
  const docDevice = user.devices.edges[0].node;

  it("maps the fixture's group users to devices", async () => {
    const { mapTwingateGroupUsers } = await import("./twingate");
    expect(mapTwingateGroupUsers([user])).toEqual({
      devices: [
        {
          id: "dev-1",
          name: "MacBook Pro",
          os: "macOS",
          status: "active",
          lastSeen: "2024-01-01T00:00:00.000Z",
          user: "alice@example.com",
        },
      ],
      truncated: false,
    });
  });

  it("leaves out archived devices, marks blocked ones and flags truncation", async () => {
    const { mapTwingateGroupUsers } = await import("./twingate");
    const out = mapTwingateGroupUsers([
      {
        ...user,
        devices: {
          pageInfo: { hasNextPage: true },
          edges: [
            { node: { ...docDevice, id: "arch", activeState: "ARCHIVED" } },
            { node: { ...docDevice, id: "blk", activeState: "BLOCKED" } },
          ],
        },
      },
    ]);
    expect(out.devices.map((d) => [d.id, d.status])).toEqual([["blk", "blocked"]]);
    expect(out.truncated).toBe(true);
  });

  it("posts the group query with X-API-KEY to the network's GraphQL endpoint", async () => {
    const { loadTwingateVpnData } = await import("./twingate");
    const fetchImpl = vi.fn(async () => jsonResponse(twingateFixture));
    const data = await loadTwingateVpnData({
      groupId: "R3JvdXA6MTIz",
      env: { PORTAL_VPN_TWINGATE_NETWORK: "denet", PORTAL_VPN_TWINGATE_API_KEY: "tg-key" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://denet.twingate.com/api/graphql/");
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("tg-key");
    expect(JSON.parse(String(init.body)).variables).toEqual({ groupId: "R3JvdXA6MTIz", after: null });
    expect(data.devices.map((d) => d.id)).toEqual(["dev-1"]);
    expect(data.reportsLiveStatus).toBe(false);
  });

  it("pages through group users", async () => {
    const { loadTwingateVpnData } = await import("./twingate");
    const page1 = structuredClone(twingateFixture);
    page1.data.group.users.pageInfo = { hasNextPage: true, endCursor: "c1" };
    const page2 = structuredClone(twingateFixture);
    page2.data.group.users.edges[0].node.devices.edges[0].node.id = "dev-9";
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));
    const data = await loadTwingateVpnData({
      groupId: "R3JvdXA6MTIz",
      env: { PORTAL_VPN_TWINGATE_NETWORK: "denet", PORTAL_VPN_TWINGATE_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(JSON.parse(String((fetchImpl.mock.calls[1] as any)[1].body)).variables.after).toBe("c1");
    expect(data.devices.map((d) => d.id).sort()).toEqual(["dev-1", "dev-9"]);
  });

  it("fails closed on GraphQL errors and an unknown group", async () => {
    const { loadTwingateVpnData } = await import("./twingate");
    const env = { PORTAL_VPN_TWINGATE_NETWORK: "denet", PORTAL_VPN_TWINGATE_API_KEY: "k" };
    await expect(
      loadTwingateVpnData({ groupId: "R3JvdXA6MTIz", env, fetchImpl: (async () => jsonResponse({ errors: [{ message: "x" }] })) as any }),
    ).rejects.toThrow(/error/);
    await expect(
      loadTwingateVpnData({ groupId: "R3JvdXA6MTIz", env, fetchImpl: (async () => jsonResponse({ data: { group: null } })) as any }),
    ).rejects.toThrow(/not found/);
  });
});

describe("manual adapter", () => {
  it("keeps only the documented fields and normalizes values", async () => {
    const { mapManualVpnRecord } = await import("./manual");
    const device = mapManualVpnRecord({
      id: "mr_1",
      data: {
        name: "  Front desk laptop ",
        os: "Windows 11",
        protocol: "WireGuard",
        status: "active",
        lastSeen: "2026-09-30",
        user: "pat@acme.test",
        notes: "Issued Sept",
        privateKey: "should never be returned",
      },
    });
    expect(device).toEqual({
      id: "mr_1",
      name: "Front desk laptop",
      os: "Windows 11",
      status: "active",
      lastSeen: "2026-09-30T00:00:00.000Z",
      user: "pat@acme.test",
      protocol: "wireguard",
      notes: "Issued Sept",
    });
    expect(mapManualVpnRecord({ id: "x", data: { status: "online", protocol: "ipsec" } })).toMatchObject({
      name: "Unnamed device",
      status: "unknown",
      protocol: null,
    });
  });
});

describe("perimeter81 adapter", () => {
  it("does not call any vendor and reports that no devices API is documented", async () => {
    const { loadPerimeter81VpnData } = await import("./perimeter81");
    await expect(loadPerimeter81VpnData()).rejects.toThrow(/no devices endpoint/);
  });
});

describe("client map", () => {
  it("parses the map and treats bad JSON as a config fault", async () => {
    const { readVpnClientMap, vpnScopeFor } = await import("./index");
    expect(readVpnClientMap({ PORTAL_VPN_CLIENT_MAP: '{"acme":" tag:acme ","bad":5}' })).toEqual({ acme: "tag:acme" });
    expect(vpnScopeFor("toString", { PORTAL_VPN_CLIENT_MAP: '{"acme":"tag:acme"}' })).toBeNull();
    expect(() => readVpnClientMap({ PORTAL_VPN_CLIENT_MAP: "{nope" })).toThrow(/valid JSON/);
    expect(() => readVpnClientMap({ PORTAL_VPN_CLIENT_MAP: "[]" })).toThrow(/object/);
  });
});

describe("timus adapter (not built: no documented API)", () => {
  it("throws the provider-unavailable error with the logged reason and makes no call", async () => {
    const { loadVpnData } = await import("./index");
    const { VpnProviderUnavailableError } = await import("./errors");
    const fetchImpl = vi.fn();
    const p = loadVpnData({
      provider: "timus",
      clientId: "acme",
      env: { PORTAL_VPN_CLIENT_MAP: "{not json", PORTAL_VPN_TIMUS_API_KEY: "k" },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    await expect(p).rejects.toBeInstanceOf(VpnProviderUnavailableError);
    await expect(p).rejects.toThrow("Timus API not documented yet");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
