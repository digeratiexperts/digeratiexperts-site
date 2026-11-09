import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { ZohoClient } from "./zohoClient";
import { classifyZohoTokenFailure } from "./zohoOAuthErrors";
import { resetZohoOAuthForTests, ZohoAuthUnavailableError } from "./oauth";
import {
  clearZohoConnectTestEnv,
  seedZohoConnectGrant,
  TEST_CONNECT_CLIENT,
  TEST_CONNECT_REFRESH,
  zohoTokenUrl,
} from "./oauth/testing/connectGrant";

// The Desk and CRM API clients are axios instances; the token endpoint goes
// through the token manager (server/zoho/oauth), which uses fetch.
vi.mock("axios", () => ({ default: { post: vi.fn(), create: vi.fn() } }));

const TOKEN_URL = zohoTokenUrl("https://accounts.zoho.com");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function tokenEndpoint(...replies: Array<Response | (() => Response)>) {
  const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => {
    const next = replies.length > 1 ? replies.shift()! : replies[0];
    return typeof next === "function" ? next() : next.clone();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const tokenRequest = (fetchMock: ReturnType<typeof tokenEndpoint>, call: number) =>
  Object.fromEntries(new URLSearchParams(String(fetchMock.mock.calls[call][1]?.body)));

beforeEach(() => resetZohoOAuthForTests());
afterEach(() => {
  vi.unstubAllGlobals();
  clearZohoConnectTestEnv();
});

describe("Desk OAuth readiness and request bounds", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubEnv("DE_STAGING_REVIEW", "0");
    await seedZohoConnectGrant();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("coalesces concurrent refreshes and expires readiness with the token", async () => {
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();
    expect(client.getDeskAuthStatus()).toBe("credentials_present");
    expect(await Promise.all(Array.from({ length: 10 }, () => client.getDeskAccessToken())))
      .toEqual(Array(10).fill("access"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(TOKEN_URL);
    expect(client.getDeskAuthStatus()).toBe("ok");
    vi.advanceTimersByTime(3600000);
    expect(client.getDeskAuthStatus()).toBe("credentials_present");
  });

  it("stops on invalid_code (needs reconnect) and re-checks only after the long cool-down", async () => {
    const fetchMock = tokenEndpoint(json({ error: "invalid_code" }), json({ access_token: "recovered", expires_in: 3600 }));
    const client = new ZohoClient();
    for (let i = 0; i < 3; i++) {
      await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk", code: "invalid_refresh_token" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getDeskAuthStatus()).toBe("auth_failed");
    expect((await client.deskHealth()).state).toBe("needs_reconnect");
    // A revoked token is re-checked every 6 hours, not hammered.
    vi.advanceTimersByTime(60 * 60_000);
    await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5 * 60 * 60_000 + 1);
    expect(await client.getDeskAccessToken()).toBe("recovered");
    expect(client.getDeskAuthStatus()).toBe("ok");
  });

  it("treats throttling as degraded, never auth_failed (#418)", async () => {
    const fetchMock = tokenEndpoint(
      json({ error: "Access Denied", error_description: "You have made too many requests continuously." }, 400),
      json({ access_token: "later", expires_in: 3600 }),
    );
    const client = new ZohoClient();
    await expect(client.getDeskAccessToken()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(client.getDeskAuthStatus()).toBe("degraded");
    expect(await client.deskHealth()).toMatchObject({ state: "degraded", configured: true });
    vi.advanceTimersByTime(5 * 60_000);
    await expect(client.getDeskAccessToken()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(6 * 60_000);
    expect(await client.getDeskAccessToken()).toBe("later");
  });

  it.each([
    [json(null), "null"],
    [json({}), "{}"],
    [json({ access_token: {} }), "non-string token"],
    [json({ access_token: " " }), "blank token"],
    [new Response("<html>502</html>", { status: 502 }), "a 5xx page"],
  ])("reads an answer without a token as degraded, not a dead credential (%s)", async (reply) => {
    tokenEndpoint(reply);
    const client = new ZohoClient();
    await expect(client.getDeskAccessToken()).rejects.toBeInstanceOf(ZohoAuthUnavailableError);
    expect(client.getDeskAuthStatus()).toBe("degraded");
  });

  it("bounds Desk HTTP reads and writes and uses the data center's Desk host", async () => {
    tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();
    await client.getDeskClient();
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 15000, baseURL: "https://desk.zoho.com/api/v1" }));
  });

  it("derives every host from ZOHO_ACCOUNTS_SERVER for another data center", async () => {
    vi.stubEnv("ZOHO_ACCOUNTS_SERVER", "https://accounts.zoho.eu");
    resetZohoOAuthForTests();
    await seedZohoConnectGrant();
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600, api_domain: "https://www.zohoapis.eu" }));
    const client = new ZohoClient();
    await client.getDeskClient();
    expect(fetchMock.mock.calls[0][0]).toBe("https://accounts.zoho.eu/oauth/v2/token");
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ baseURL: "https://desk.zoho.eu/api/v1" }));
  });

  it("logs only classified failures, never arbitrary upstream error content", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tokenEndpoint(json({ error: "invalid_code", error_description: "sensitive-marker" }));
    await expect(new ZohoClient().getDeskAccessToken()).rejects.toThrow();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("sensitive-marker"); }));
    resetZohoOAuthForTests();
    await seedZohoConnectGrant();
    await expect(new ZohoClient().getDeskAccessToken()).rejects.toThrow();
    expect(JSON.stringify([...error.mock.calls, ...warn.mock.calls])).not.toContain("sensitive-marker");
  });

  it.each([["invalid_code", "invalid_refresh_token"], ["invalid_grant", "invalid_refresh_token"], ["invalid_client", "invalid_client"]])
    ("classifies %s", (error, expected) => {
      expect(classifyZohoTokenFailure({ error })).toBe(expected);
    });
});

describe("CRM and the Desk on the one Zoho Connect grant", () => {
  const LEGACY_VARS = {
    ZOHO_CLIENT_ID_API: "crm-client",
    ZOHO_CLIENT_SECRET_API: "crm-secret",
    ZOHO_REFRESH_TOKEN: "crm-refresh",
    ZOHO_FORM_OAUTH: "form-refresh",
    ZOHO_DESK_CLIENT_ID: "desk-client",
    ZOHO_DESK_CLIENT_SECRET: "desk-secret",
    ZOHO_DESK_REFRESH_TOKEN: "desk-refresh",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DE_STAGING_REVIEW", "0");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("refreshes CRM and the Desk with the Connect client and shares one access token", async () => {
    await seedZohoConnectGrant();
    const fetchMock = tokenEndpoint(json({ access_token: "shared", expires_in: 3600 }));
    const client = new ZohoClient();
    expect(client.isConfigured()).toBe(true);
    expect(client.isDeskConfigured()).toBe(true);
    expect(client.getDeskAuthStatus()).toBe("credentials_present");

    expect(await client.getAccessToken()).toBe("shared");
    expect(await client.getDeskAccessToken()).toBe("shared");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(tokenRequest(fetchMock, 0)).toEqual({
      grant_type: "refresh_token",
      client_id: TEST_CONNECT_CLIENT.id,
      client_secret: TEST_CONNECT_CLIENT.secret,
      refresh_token: TEST_CONNECT_REFRESH,
    });
    expect(client.getDeskAuthStatus()).toBe("ok");
  });

  it("ignores every legacy Self Client setting: no grant means not configured, and Zoho is never called", async () => {
    for (const [name, value] of Object.entries(LEGACY_VARS)) vi.stubEnv(name, value);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();

    expect(client.isConfigured()).toBe(false);
    expect(client.isDeskConfigured()).toBe(false);
    expect(client.getDeskAuthStatus()).toBe("not_configured");
    expect((await client.deskHealth()).state).toBe("not_configured");
    await expect(client.getDeskAccessToken()).rejects.toThrow("not connected");
    await expect(client.getAccessToken()).rejects.toThrow("not connected");
    expect(fetchMock).not.toHaveBeenCalled();

    const logged = JSON.stringify(warn.mock.calls);
    for (const value of Object.values(LEGACY_VARS)) expect(logged).not.toContain(value);
  });

  it("keeps the Desk not configured when the grant lacks the Desk scopes", async () => {
    await seedZohoConnectGrant({ products: ["crm"] });
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();
    expect(client.isConfigured()).toBe(true);
    expect(client.isDeskConfigured()).toBe(false);
    const health = await client.deskHealth();
    expect(health.state).toBe("not_configured");
    expect(health.reason).toContain("/api/zoho/connect");
    await expect(client.getDeskAccessToken()).rejects.toThrow("not connected");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("marks the Desk auth_failed when Zoho refuses the Connect client, without logging secrets", async () => {
    await seedZohoConnectGrant();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tokenEndpoint(json({ error: "invalid_client" }, 400));
    const client = new ZohoClient();

    await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk", code: "invalid_client" });
    expect(client.getDeskAuthStatus()).toBe("auth_failed");
    expect((await client.deskHealth()).state).toBe("needs_reconnect");
    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    for (const value of [TEST_CONNECT_CLIENT.secret, TEST_CONNECT_REFRESH]) expect(logged).not.toContain(value);
  });
});
