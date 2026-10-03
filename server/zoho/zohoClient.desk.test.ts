import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { ZohoClient } from "./zohoClient";
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
