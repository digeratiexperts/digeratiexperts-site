import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { ZohoClient, resolveDeskOAuthConfig } from "./zohoClient";
import { classifyZohoTokenFailure } from "./zohoOAuthErrors";
import { resetZohoOAuthForTests, ZohoAuthUnavailableError } from "./oauth";

// The Desk and CRM API clients are axios instances; the token endpoint goes
// through the token manager (server/zoho/oauth), which uses fetch.
vi.mock("axios", () => ({ default: { post: vi.fn(), create: vi.fn() } }));

const TOKEN_URL = "https://accounts.zoho.com/oauth/v2/token";
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
afterEach(() => vi.unstubAllGlobals());

describe("Desk OAuth readiness and request bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DE_STAGING_REVIEW", "0");
    vi.stubEnv("ZOHO_CLIENT_ID_API", "test-client");
    vi.stubEnv("ZOHO_CLIENT_SECRET_API", "test-secret");
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "test-refresh");
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
    await expect(new ZohoClient().getDeskAccessToken()).rejects.toThrow();
    expect(JSON.stringify([...error.mock.calls, ...warn.mock.calls])).not.toContain("sensitive-marker");
  });

  it.each([["invalid_code", "invalid_refresh_token"], ["invalid_grant", "invalid_refresh_token"], ["invalid_client", "invalid_client"]])
    ("classifies %s", (error, expected) => {
      expect(classifyZohoTokenFailure({ error })).toBe(expected);
    });
});

describe("Desk OAuth client separate from CRM", () => {
  const DESK_VARS = [
    "ZOHO_CLIENT_ID_API",
    "ZOHO_CLIENT_SECRET_API",
    "ZOHO_REFRESH_TOKEN",
    "ZOHO_FORM_OAUTH",
    "ZOHO_DESK_CLIENT_ID",
    "ZOHO_DESK_CLIENT_SECRET",
    "ZOHO_DESK_REFRESH_TOKEN",
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DE_STAGING_REVIEW", "0");
    for (const name of DESK_VARS) vi.stubEnv(name, "");
    vi.stubEnv("ZOHO_CLIENT_ID_API", "crm-client");
    vi.stubEnv("ZOHO_CLIENT_SECRET_API", "crm-secret");
    vi.stubEnv("ZOHO_REFRESH_TOKEN", "crm-refresh");
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("refreshes the Desk with its own client and CRM with the original client", async () => {
    vi.stubEnv("ZOHO_DESK_CLIENT_ID", "desk-client");
    vi.stubEnv("ZOHO_DESK_CLIENT_SECRET", "desk-secret");
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();
    expect(client.isDeskConfigured()).toBe(true);
    expect(client.getDeskAuthStatus()).toBe("credentials_present");

    await client.getDeskAccessToken();
    await client.getAccessToken();

    expect(tokenRequest(fetchMock, 0)).toEqual({
      grant_type: "refresh_token",
      client_id: "desk-client",
      client_secret: "desk-secret",
      refresh_token: "desk-refresh",
    });
    expect(tokenRequest(fetchMock, 1)).toEqual({
      grant_type: "refresh_token",
      client_id: "crm-client",
      client_secret: "crm-secret",
      refresh_token: "crm-refresh",
    });
    expect(client.getDeskAuthStatus()).toBe("ok");
  });

  it("keeps the shared CRM client for the Desk when no Desk client is set", async () => {
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const client = new ZohoClient();
    await client.getDeskAccessToken();
    expect(tokenRequest(fetchMock, 0)).toMatchObject({ client_id: "crm-client", client_secret: "crm-secret", refresh_token: "desk-refresh" });
  });

  it("still falls back to ZOHO_FORM_OAUTH, then ZOHO_REFRESH_TOKEN, on the shared client", async () => {
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    vi.stubEnv("ZOHO_FORM_OAUTH", "form-refresh");
    await new ZohoClient().getDeskAccessToken();
    expect(tokenRequest(fetchMock, 0)).toMatchObject({ client_id: "crm-client", refresh_token: "form-refresh" });

    vi.stubEnv("ZOHO_FORM_OAUTH", "");
    await new ZohoClient().getDeskAccessToken();
    expect(tokenRequest(fetchMock, 1)).toMatchObject({ client_id: "crm-client", refresh_token: "crm-refresh" });
  });

  it("shares one access token between CRM and Desk when they share a refresh token", async () => {
    const fetchMock = tokenEndpoint(json({ access_token: "shared", expires_in: 3600 }));
    const client = new ZohoClient();
    expect(await client.getAccessToken()).toBe("shared");
    expect(await client.getDeskAccessToken()).toBe("shared");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [{ ZOHO_DESK_CLIENT_ID: "desk-client", ZOHO_DESK_REFRESH_TOKEN: "desk-refresh" }, ["ZOHO_DESK_CLIENT_SECRET"]],
    [{ ZOHO_DESK_CLIENT_SECRET: "desk-secret", ZOHO_DESK_REFRESH_TOKEN: "desk-refresh" }, ["ZOHO_DESK_CLIENT_ID"]],
    // The CRM refresh token is never paired with the Desk's own client.
    [{ ZOHO_DESK_CLIENT_ID: "desk-client", ZOHO_DESK_CLIENT_SECRET: "desk-secret", ZOHO_FORM_OAUTH: "form-refresh" }, ["ZOHO_DESK_REFRESH_TOKEN"]],
  ])("refuses a half-set Desk client %j without calling Zoho", async (env, missing) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const fetchMock = tokenEndpoint(json({ access_token: "access", expires_in: 3600 }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new ZohoClient();

    expect(resolveDeskOAuthConfig()).toEqual({ state: "incomplete", missing });
    expect(client.isDeskConfigured()).toBe(false);
    expect(client.getDeskAuthStatus()).toBe("not_configured");
    expect((await client.deskHealth()).state).toBe("not_configured");
    await expect(client.getDeskAccessToken()).rejects.toThrow("not connected");
    expect(fetchMock).not.toHaveBeenCalled();

    const logged = JSON.stringify(warn.mock.calls);
    for (const name of missing) expect(logged).toContain(name);
    for (const value of ["desk-client", "desk-secret", "desk-refresh", "form-refresh", "crm-secret"]) {
      expect(logged).not.toContain(value);
    }
  });

  it("treats blank Desk client values as unset", () => {
    vi.stubEnv("ZOHO_DESK_CLIENT_ID", "  ");
    vi.stubEnv("ZOHO_DESK_CLIENT_SECRET", "");
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
    expect(resolveDeskOAuthConfig()).toMatchObject({ state: "ready", clientId: "crm-client", dedicatedClient: false });
  });

  it("reports not_configured when no Desk credential is set at all", () => {
    vi.stubEnv("ZOHO_CLIENT_SECRET_API", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new ZohoClient();
    expect(resolveDeskOAuthConfig()).toEqual({ state: "missing" });
    expect(client.isDeskConfigured()).toBe(false);
    expect(client.getDeskAuthStatus()).toBe("not_configured");
  });

  it("marks the Desk auth_failed when Zoho refuses its own client, without logging secrets", async () => {
    vi.stubEnv("ZOHO_DESK_CLIENT_ID", "desk-client");
    vi.stubEnv("ZOHO_DESK_CLIENT_SECRET", "desk-secret");
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    tokenEndpoint(json({ error: "invalid_client" }, 400));
    const client = new ZohoClient();

    await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk", code: "invalid_client" });
    expect(client.getDeskAuthStatus()).toBe("auth_failed");
    expect((await client.deskHealth()).state).toBe("needs_reconnect");
    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    for (const value of ["desk-secret", "desk-refresh", "crm-secret"]) expect(logged).not.toContain(value);
  });
});
