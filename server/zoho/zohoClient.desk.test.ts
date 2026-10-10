import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { ZohoClient, resolveDeskOAuthConfig } from "./zohoClient";
import { classifyZohoTokenFailure } from "./zohoOAuthErrors";

vi.mock("axios", () => ({ default: { post: vi.fn(), create: vi.fn() } }));

describe("Desk OAuth readiness and request bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("DE_STAGING_REVIEW", "0");
    vi.stubEnv("ZOHO_CLIENT_ID_API", "test-client");
    vi.stubEnv("ZOHO_CLIENT_SECRET_API", "test-secret");
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "test-refresh");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });

  it("coalesces concurrent refreshes and expires readiness with the token", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: "access", expires_in: 3600 } });
    const client = new ZohoClient();
    expect(client.getDeskAuthStatus()).toBe("credentials_present");
    expect(await Promise.all(Array.from({ length: 10 }, () => client.getDeskAccessToken())))
      .toEqual(Array(10).fill("access"));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith("https://accounts.zoho.com/oauth/v2/token", expect.any(String), expect.objectContaining({ timeout: 10000 }));
    expect(client.getDeskAuthStatus()).toBe("ok");
    vi.advanceTimersByTime(3600000);
    expect(client.getDeskAuthStatus()).toBe("credentials_present");
  });

  it("cools down invalid_code and recovers on a later successful refresh", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { error: "invalid_code" } })
      .mockResolvedValueOnce({ data: { access_token: "recovered", expires_in: 3600 } });
    const client = new ZohoClient();
    for (let i = 0; i < 3; i++) {
      await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk", code: "invalid_refresh_token" });
    }
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(client.getDeskAuthStatus()).toBe("auth_failed");
    vi.advanceTimersByTime(15001);
    expect(await client.getDeskAccessToken()).toBe("recovered");
    expect(client.getDeskAuthStatus()).toBe("ok");
  });

  it.each([null, {}, { access_token: {} }, { access_token: " " }, { access_token: "x", expires_in: "bad" }])
    ("rejects incomplete credentials %j", async (data) => {
      vi.mocked(axios.post).mockResolvedValueOnce({ data });
      const client = new ZohoClient();
      await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk" });
      expect(client.getDeskAuthStatus()).toBe("auth_failed");
    });

  it("bounds Desk HTTP reads and writes without automatically replaying a create", async () => {
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { access_token: "access", expires_in: 3600 } });
    const client = new ZohoClient();
    await client.getDeskClient();
    expect(axios.create).toHaveBeenCalledWith(expect.objectContaining({ timeout: 15000 }));
  });

  it("logs only classified failures, never arbitrary upstream error content", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(axios.post).mockRejectedValueOnce({ message: "sensitive-marker", response: { data: { error: "sensitive-marker" } } });
    await expect(new ZohoClient().getDeskAccessToken()).rejects.toThrow();
    expect(JSON.stringify(log.mock.calls)).not.toContain("sensitive-marker");
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
  const tokenRequest = (call: number) =>
    Object.fromEntries(new URLSearchParams(String(vi.mocked(axios.post).mock.calls[call][1])));

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
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: "access", expires_in: 3600 } });
    const client = new ZohoClient();
    expect(client.isDeskConfigured()).toBe(true);
    expect(client.getDeskAuthStatus()).toBe("credentials_present");

    await client.getDeskAccessToken();
    await client.getAccessToken();

    expect(tokenRequest(0)).toEqual({
      grant_type: "refresh_token",
      client_id: "desk-client",
      client_secret: "desk-secret",
      refresh_token: "desk-refresh",
    });
    expect(tokenRequest(1)).toEqual({
      grant_type: "refresh_token",
      client_id: "crm-client",
      client_secret: "crm-secret",
      refresh_token: "crm-refresh",
    });
    expect(client.getDeskAuthStatus()).toBe("ok");
  });

  it("keeps the shared CRM client for the Desk when no Desk client is set", async () => {
    vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: "access", expires_in: 3600 } });
    const client = new ZohoClient();
    await client.getDeskAccessToken();
    expect(tokenRequest(0)).toMatchObject({ client_id: "crm-client", client_secret: "crm-secret", refresh_token: "desk-refresh" });
  });

  it("still falls back to ZOHO_FORM_OAUTH, then ZOHO_REFRESH_TOKEN, on the shared client", async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { access_token: "access", expires_in: 3600 } });
    vi.stubEnv("ZOHO_FORM_OAUTH", "form-refresh");
    await new ZohoClient().getDeskAccessToken();
    expect(tokenRequest(0)).toMatchObject({ client_id: "crm-client", refresh_token: "form-refresh" });

    vi.stubEnv("ZOHO_FORM_OAUTH", "");
    await new ZohoClient().getDeskAccessToken();
    expect(tokenRequest(1)).toMatchObject({ client_id: "crm-client", refresh_token: "crm-refresh" });
  });

  it.each([
    [{ ZOHO_DESK_CLIENT_ID: "desk-client", ZOHO_DESK_REFRESH_TOKEN: "desk-refresh" }, ["ZOHO_DESK_CLIENT_SECRET"]],
    [{ ZOHO_DESK_CLIENT_SECRET: "desk-secret", ZOHO_DESK_REFRESH_TOKEN: "desk-refresh" }, ["ZOHO_DESK_CLIENT_ID"]],
    // The CRM refresh token is never paired with the Desk's own client.
    [{ ZOHO_DESK_CLIENT_ID: "desk-client", ZOHO_DESK_CLIENT_SECRET: "desk-secret", ZOHO_FORM_OAUTH: "form-refresh" }, ["ZOHO_DESK_REFRESH_TOKEN"]],
  ])("refuses a half-set Desk client %j without calling Zoho", async (env, missing) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const client = new ZohoClient();

    expect(resolveDeskOAuthConfig()).toEqual({ state: "incomplete", missing });
    expect(client.isDeskConfigured()).toBe(false);
    expect(client.getDeskAuthStatus()).toBe("not_configured");
    await expect(client.getDeskAccessToken()).rejects.toThrow("not configured");
    expect(axios.post).not.toHaveBeenCalled();

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
    vi.mocked(axios.post).mockResolvedValueOnce({ data: { error: "invalid_client" } });
    const client = new ZohoClient();

    await expect(client.getDeskAccessToken()).rejects.toMatchObject({ product: "desk", code: "invalid_client" });
    expect(client.getDeskAuthStatus()).toBe("auth_failed");
    const logged = JSON.stringify(error.mock.calls);
    for (const value of ["desk-secret", "desk-refresh", "crm-secret"]) expect(logged).not.toContain(value);
  });
});
