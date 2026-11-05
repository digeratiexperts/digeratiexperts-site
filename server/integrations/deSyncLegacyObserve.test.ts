/**
 * Legacy secret retirement, website PR 1 (observe). Mirrors Intelligence-Hub
 * #841: a request verified with the legacy shared secret instead of the scoped
 * one logs one structured warning per direction per hour (never the secret)
 * and every use is counted; a scoped use is neither logged nor counted;
 * outbound signing uses the scoped secret only when it is set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const { warn, recordLegacyCredentialUse } = vi.hoisted(() => ({
  warn: vi.fn(),
  recordLegacyCredentialUse: vi.fn(async (_input: unknown) => undefined),
}));
vi.mock("../logger", () => ({ logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock("./deSyncLegacyCredential", () => ({ recordLegacyCredentialUse }));

const {
  buildSignedHeaders,
  noteLegacyCredentialUse,
  outboundSecret,
  resetLegacyCredentialWarnings,
  resolveScopedSecret,
  verifySignedRequest,
} = await import("./deSyncAuth");

const PATH = "/api/integrations/v1/hub/events";
const SCOPED = "scoped-hub-to-website-value";
const LEGACY = "legacy-shared-secret-value";
const SCOPED_ENV = ["WEBSITE_TO_HUB_SECRET", "PORTAL_TO_HUB_SECRET", "HUB_TO_WEBSITE_SECRET", "HUB_TO_PORTAL_SECRET"];

function request(headers: Record<string, string>, originalUrl = PATH): Request {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    method: "POST",
    path: originalUrl.split("?")[0],
    originalUrl,
    body: { eventId: "e1" },
    get: (name: string) => lower[name.toLowerCase()] || "",
  } as unknown as Request;
}

function signedWith(secret: string, path = PATH) {
  return buildSignedHeaders({
    method: "POST",
    path,
    eventId: "11111111-1111-4111-8111-111111111111",
    source: "techsales",
    body: JSON.stringify({ eventId: "e1" }),
    secret,
  });
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("legacy DE-Sync secret observation (website)", () => {
  beforeEach(() => {
    warn.mockClear();
    recordLegacyCredentialUse.mockClear();
    resetLegacyCredentialWarnings();
    for (const n of SCOPED_ENV) delete process.env[n];
    process.env.HUB_TO_WEBSITE_SECRET = SCOPED;
    process.env.TECHSALES_SYNC_TOKEN = LEGACY;
    delete process.env.WEBSITE_LEAD_WEBHOOK_SECRET;
    delete process.env.DE_SYNC_REQUIRE_SIGNED;
  });
  afterEach(() => {
    for (const n of SCOPED_ENV) delete process.env[n];
    delete process.env.TECHSALES_SYNC_TOKEN;
  });

  it("does not log or count a request verified with the scoped secret", async () => {
    expect(verifySignedRequest(request(signedWith(SCOPED)), "hub_to_website")).toMatchObject({ ok: true, legacy: false });
    expect(verifySignedRequest(request({ authorization: `Bearer ${SCOPED}` }), "hub_to_website")).toMatchObject({
      ok: true,
      legacy: false,
    });
    await flush();
    expect(warn).not.toHaveBeenCalled();
    expect(recordLegacyCredentialUse).not.toHaveBeenCalled();
  });

  it("logs a structured warning and counts a signed request verified with the legacy secret", async () => {
    expect(verifySignedRequest(request(signedWith(LEGACY)), "hub_to_website")).toMatchObject({ ok: true, legacy: true });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    const [, fields] = warn.mock.calls[0];
    expect(fields).toMatchObject({
      event: "de_sync.legacy_credential_used",
      direction: "hub_to_website",
      route: PATH,
      source: "techsales",
      scopedSecretEnv: "HUB_TO_WEBSITE_SECRET",
      scopedSecretConfigured: true,
    });
    await vi.waitFor(() =>
      expect(recordLegacyCredentialUse).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "hub_to_website", route: PATH, source: "techsales" }),
      ),
    );
  });

  it("logs and counts a bearer request that used the legacy secret (scoped secret missing)", async () => {
    delete process.env.HUB_TO_PORTAL_SECRET;
    const route = "/api/integrations/v1/hub/service-requests/sr-1/status";
    const res = verifySignedRequest(request({ authorization: `Bearer ${LEGACY}`, "x-de-source": "techsales" }, route), "hub_to_portal");
    expect(res).toMatchObject({ ok: true, legacy: true });
    await flush();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({
      direction: "hub_to_portal",
      route,
      scopedSecretEnv: "HUB_TO_PORTAL_SECRET",
      scopedSecretConfigured: false,
    });
    await vi.waitFor(() => expect(recordLegacyCredentialUse).toHaveBeenCalledTimes(1));
  });

  it("never writes a secret value into the warning or the counter", async () => {
    process.env.WEBSITE_LEAD_WEBHOOK_SECRET = "other-legacy-value";
    verifySignedRequest(request(signedWith(LEGACY)), "hub_to_website");
    verifySignedRequest(request({ authorization: `Bearer ${LEGACY}` }), "hub_to_portal");
    verifySignedRequest(request({ "x-de-sync-token": LEGACY }), "hub_to_website");
    outboundSecret("website_to_hub", "/api/integrations/v1/website/leads");
    await flush();
    await vi.waitFor(() => expect(recordLegacyCredentialUse).toHaveBeenCalledTimes(4));
    const logged = JSON.stringify([warn.mock.calls, recordLegacyCredentialUse.mock.calls]);
    for (const value of [LEGACY, SCOPED, "other-legacy-value"]) expect(logged).not.toContain(value);
  });

  it("warns once per direction per hour but counts every use", async () => {
    const t0 = Date.parse("2026-11-05T10:00:00Z");
    noteLegacyCredentialUse({ direction: "website_to_hub", route: PATH, source: "website", now: t0 });
    noteLegacyCredentialUse({ direction: "website_to_hub", route: PATH, source: "website", now: t0 + 59 * 60_000 });
    noteLegacyCredentialUse({ direction: "portal_to_hub", route: "/api/x", source: "portal", now: t0 + 60_000 });
    noteLegacyCredentialUse({ direction: "website_to_hub", route: PATH, source: "website", now: t0 + 60 * 60_000 });
    await flush();
    expect(warn.mock.calls.map(([, f]) => (f as { direction: string }).direction)).toEqual([
      "website_to_hub",
      "portal_to_hub",
      "website_to_hub",
    ]);
    await vi.waitFor(() => expect(recordLegacyCredentialUse).toHaveBeenCalledTimes(4));
  });

  it("drops the query string from the logged and counted route", async () => {
    noteLegacyCredentialUse({ direction: "portal_to_hub", route: "/api/webhooks/portal/x?accountId=7", source: "portal" });
    await flush();
    expect(warn.mock.calls[0][1]).toMatchObject({ route: "/api/webhooks/portal/x" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("accountId");
    await vi.waitFor(() =>
      expect(recordLegacyCredentialUse).toHaveBeenCalledWith(expect.objectContaining({ route: "/api/webhooks/portal/x" })),
    );
  });

  it("drops the query string on an inbound bearer request too", async () => {
    verifySignedRequest(request({ authorization: `Bearer ${LEGACY}` }, `${PATH}?accountId=42`), "hub_to_website");
    await flush();
    expect(warn.mock.calls[0][1]).toMatchObject({ route: PATH });
  });

  it("signs outbound with the scoped secret only when it is set, and counts the fallback", async () => {
    process.env.WEBSITE_TO_HUB_SECRET = "scoped-outbound";
    expect(resolveScopedSecret("website_to_hub")).toEqual({ secret: "scoped-outbound", legacy: false });
    expect(outboundSecret("website_to_hub", "/api/integrations/v1/website/leads")).toBe("scoped-outbound");
    await flush();
    expect(recordLegacyCredentialUse).not.toHaveBeenCalled();

    delete process.env.WEBSITE_TO_HUB_SECRET;
    expect(outboundSecret("website_to_hub", "/api/integrations/v1/website/leads?x=1")).toBe(LEGACY);
    await vi.waitFor(() =>
      expect(recordLegacyCredentialUse).toHaveBeenCalledWith(
        expect.objectContaining({ direction: "website_to_hub", route: "/api/integrations/v1/website/leads", source: "website" }),
      ),
    );
  });

  it("puts no raw secret beside the HMAC in outbound headers", () => {
    const headers = signedWith(SCOPED);
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("x-de-sync-token");
    expect(JSON.stringify(headers)).not.toContain(SCOPED);
  });

  it("never lets a counter failure break the request", async () => {
    recordLegacyCredentialUse.mockRejectedValueOnce(new Error("db down"));
    expect(verifySignedRequest(request(signedWith(LEGACY)), "hub_to_website")).toMatchObject({ ok: true });
    await flush();
  });
});
