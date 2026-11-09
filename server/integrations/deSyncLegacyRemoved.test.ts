/**
 * Legacy secret retirement, website PR 2 (remove). Mirrors Intelligence-Hub
 * #842: the shared TECHSALES_SYNC_TOKEN / WEBSITE_LEAD_WEBHOOK_SECRET no longer
 * authenticates or signs any DE-Sync direction. A direction without its scoped
 * secret fails closed (503 inbound, not sent outbound) and logs one error per
 * direction per hour that names the variable, never a value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Request } from "express";

const { error } = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error, debug: vi.fn() } }));

const {
  buildSignedHeaders,
  DE_SYNC_DIRECTIONS,
  outboundSecret,
  resetMissingSecretLogs,
  resolveScopedSecret,
  SCOPED_SECRET_ENV,
  verifySignedRequest,
} = await import("./deSyncAuth");
const { deliverEnvelopeToHub, fetchPublicCatalog } = await import("./techSalesClient");
const { createDeSyncEnvelope } = await import("./deSyncContract");

type Direction = (typeof DE_SYNC_DIRECTIONS)[number];

const LEGACY = "legacy-shared-secret-value";
const SOURCE: Record<Direction, "website" | "portal" | "techsales"> = {
  website_to_hub: "website",
  portal_to_hub: "portal",
  hub_to_website: "techsales",
  hub_to_portal: "techsales",
};
const PATH = "/api/integrations/v1/x";

function signedRequest(direction: Direction, secret: string): Request {
  const headers = buildSignedHeaders({ method: "POST", path: PATH, eventId: "e1", source: SOURCE[direction], body: "{}", secret });
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { method: "POST", path: PATH, originalUrl: PATH, body: {}, get: (n: string) => lower[n.toLowerCase()] || "" } as unknown as Request;
}

function bearerRequest(token: string, header: "authorization" | "x-de-sync-token" = "authorization"): Request {
  const value = header === "authorization" ? `Bearer ${token}` : token;
  return { method: "POST", path: PATH, originalUrl: PATH, body: {}, get: (n: string) => (n.toLowerCase() === header ? value : "") } as unknown as Request;
}

describe("legacy DE-Sync secret removed (website)", () => {
  beforeEach(() => {
    error.mockClear();
    resetMissingSecretLogs();
    process.env.TECHSALES_SYNC_TOKEN = LEGACY;
    process.env.WEBSITE_LEAD_WEBHOOK_SECRET = LEGACY;
    for (const d of DE_SYNC_DIRECTIONS) delete process.env[SCOPED_SECRET_ENV[d]];
    delete process.env.DE_SYNC_REQUIRE_SIGNED;
  });
  afterEach(() => {
    delete process.env.TECHSALES_SYNC_TOKEN;
    delete process.env.WEBSITE_LEAD_WEBHOOK_SECRET;
    for (const d of DE_SYNC_DIRECTIONS) delete process.env[SCOPED_SECRET_ENV[d]];
    delete process.env.TECHSALES_HUB_URL;
    vi.unstubAllGlobals();
  });

  for (const direction of DE_SYNC_DIRECTIONS) {
    const env = SCOPED_SECRET_ENV[direction];

    it(`${direction}: no scoped secret → 503 and one error naming ${env}, even with the legacy secret set`, () => {
      expect(resolveScopedSecret(direction)).toEqual({ secret: "" });
      expect(verifySignedRequest(signedRequest(direction, LEGACY), direction)).toEqual({
        ok: false,
        status: 503,
        error: "Integration not configured",
      });
      expect(verifySignedRequest(bearerRequest(LEGACY), direction)).toMatchObject({ ok: false, status: 503 });
      expect(error).toHaveBeenCalledTimes(1);
      const [message, , fields] = error.mock.calls[0];
      expect(fields).toMatchObject({ event: "de_sync.scoped_secret_missing", direction, scopedSecretEnv: env });
      expect(String(message)).toContain(env);
      expect(JSON.stringify(error.mock.calls)).not.toContain(LEGACY);
    });

    it(`${direction}: with ${env} set, the legacy secret gets 401 (signed, bearer, x-de-sync-token)`, () => {
      process.env[env] = `scoped-${direction}`;
      expect(verifySignedRequest(signedRequest(direction, LEGACY), direction)).toMatchObject({ ok: false, status: 401 });
      expect(verifySignedRequest(bearerRequest(LEGACY), direction)).toMatchObject({ ok: false, status: 401 });
      expect(verifySignedRequest(bearerRequest(LEGACY, "x-de-sync-token"), direction)).toMatchObject({ ok: false, status: 401 });
      expect(verifySignedRequest(signedRequest(direction, `scoped-${direction}`), direction)).toMatchObject({ ok: true });
      expect(error).not.toHaveBeenCalled();
    });

    it(`${direction}: outbound never signs with the legacy secret; missing ${env} is named`, () => {
      expect(outboundSecret(direction, PATH)).toBe("");
      expect(String(error.mock.calls[0]?.[0])).toContain(env);
      process.env[env] = `scoped-${direction}`;
      expect(outboundSecret(direction, PATH)).toBe(`scoped-${direction}`);
    });
  }

  it("logs a missing secret once per direction per hour", () => {
    verifySignedRequest(bearerRequest(LEGACY), "hub_to_website");
    verifySignedRequest(bearerRequest(LEGACY), "hub_to_website");
    verifySignedRequest(bearerRequest(LEGACY), "hub_to_portal");
    expect(error.mock.calls.map(([, , f]) => (f as { direction: string }).direction)).toEqual(["hub_to_website", "hub_to_portal"]);
  });

  it("does not send an outbound envelope without the scoped secret, and says which variable", async () => {
    process.env.TECHSALES_HUB_URL = "https://techsales.example.test";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const website = createDeSyncEnvelope({ eventType: "lead.created", source: "website", entityType: "lead", payload: { email: "a@example.com" } });
    await expect(deliverEnvelopeToHub(website, "hub")).rejects.toThrow(/WEBSITE_TO_HUB_SECRET is not set/);
    const portal = createDeSyncEnvelope({ eventType: "document.acknowledged", source: "portal", entityType: "document", payload: {} });
    await expect(deliverEnvelopeToHub(portal, "hub")).rejects.toThrow(/PORTAL_TO_HUB_SECRET is not set/);
    await expect(fetchPublicCatalog()).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
