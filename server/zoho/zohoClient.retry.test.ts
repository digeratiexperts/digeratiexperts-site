import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosAdapter } from "axios";
import { ZohoClient } from "./zohoClient";
import { resetZohoOAuthForTests } from "./oauth";

// Real axios here (zohoClient.desk.test.ts mocks it): the 401 interceptor is
// exercised end to end with a fake adapter in place of the network.

function tokenEndpoint() {
  let issued = 0;
  const fetchMock = vi.fn(async () => {
    issued++;
    return new Response(JSON.stringify({ access_token: `tok-${issued}`, expires_in: 3600 }), { status: 200 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function adapter(answer: (authorization: string) => number) {
  const seen: string[] = [];
  const fn: AxiosAdapter = async (config) => {
    const authorization = String(config.headers?.Authorization ?? config.headers?.get?.("Authorization") ?? "");
    seen.push(authorization);
    const status = answer(authorization);
    const response = { data: { ok: status === 200 }, status, statusText: String(status), headers: {}, config };
    if (status >= 400) {
      throw Object.assign(new Error(`HTTP ${status}`), { config, response, isAxiosError: true });
    }
    return response;
  };
  return { fn, seen };
}

beforeEach(() => {
  resetZohoOAuthForTests();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-10T12:00:00Z"));
  vi.stubEnv("DE_STAGING_REVIEW", "0");
  vi.stubEnv("ZOHO_CLIENT_ID_API", "crm-client");
  vi.stubEnv("ZOHO_CLIENT_SECRET_API", "crm-secret");
  vi.stubEnv("ZOHO_REFRESH_TOKEN", "crm-refresh");
  vi.stubEnv("ZOHO_DESK_REFRESH_TOKEN", "desk-refresh");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("CRM and Desk API clients retry a rejected token once", () => {
  it("replays a Desk request with a new token after a 401 on an older token", async () => {
    const tokens = tokenEndpoint();
    const client = new ZohoClient();
    await client.getDeskAccessToken(); // tok-1
    vi.advanceTimersByTime(5 * 60_000); // no longer brand new
    const desk = await client.getDeskClient();
    const { fn, seen } = adapter((authorization) => (authorization === "Zoho-oauthtoken tok-1" ? 401 : 200));
    desk.defaults.adapter = fn;

    const response = await desk.get("/organizations");
    expect(response.status).toBe(200);
    expect(seen).toEqual(["Zoho-oauthtoken tok-1", "Zoho-oauthtoken tok-2"]);
    expect(tokens).toHaveBeenCalledTimes(2);
  });

  it("does not loop or refresh again when a brand-new token is refused (a scope problem)", async () => {
    const tokens = tokenEndpoint();
    const client = new ZohoClient();
    const crm = await client.getClient();
    const { fn, seen } = adapter(() => 401);
    crm.defaults.adapter = fn;

    await expect(crm.get("/crm/v6/Leads")).rejects.toMatchObject({ response: { status: 401 } });
    expect(seen).toHaveLength(1);
    expect(tokens).toHaveBeenCalledTimes(1);
    expect((await client.crmHealth()).state).toBe("needs_reconnect");
  });

  it("leaves other failures alone: a 5xx is not retried and is not an auth problem", async () => {
    tokenEndpoint();
    const client = new ZohoClient();
    const crm = await client.getClient();
    const { fn, seen } = adapter(() => 503);
    crm.defaults.adapter = fn;
    await expect(crm.get("/crm/v6/Leads")).rejects.toMatchObject({ response: { status: 503 } });
    expect(seen).toHaveLength(1);
    expect((await client.crmHealth()).state).toBe("connected");
  });
});
