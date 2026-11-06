/**
 * fetchHubLicenses: the portal's read of the Hub licence contract
 * (de.hub.licenses/v1). Hub mocked. Scoped secret only, signature over path +
 * query, canonical accountId only, and anything off-contract reads as null so
 * the board falls back to the portal's own data.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signDeSyncRequest } from "./deSyncAuth";
import { fetchHubLicenses } from "./techSalesClient";

const SECRET = "portal-licences-fixture-secret";

const projection = (accountId = 41) => ({
  contract: "de.hub.licenses/v1",
  accountId,
  generatedAt: "2026-11-05T16:00:00.000Z",
  items: [
    {
      productId: 7,
      kind: "license",
      vendor: "Microsoft",
      product: "Microsoft 365 Business Premium",
      category: "Productivity",
      catalogKey: "ms_m365_bp",
      sku: null,
      chocoPackage: null,
      seats: { total: 3, fromPool: 2, toOrder: 1 },
    },
  ],
  totals: { products: 1, seats: 3, fromPool: 2, toOrder: 1 },
});

type Captured = { url: string; headers: Record<string, string> };

describe("fetchHubLicenses", () => {
  let calls: Captured[];
  let reply: { status: number; body: unknown };

  beforeEach(() => {
    calls = [];
    reply = { status: 200, body: projection() };
    process.env.TECHSALES_HUB_URL = "https://hub.example.test/api";
    process.env.PORTAL_TO_HUB_SECRET = SECRET;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, headers: init.headers as Record<string, string> });
        return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { "content-type": "application/json" } });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.TECHSALES_HUB_URL;
    delete process.env.PORTAL_TO_HUB_SECRET;
    delete process.env.TECHSALES_SYNC_TOKEN;
    delete process.env.WEBSITE_LEAD_WEBHOOK_SECRET;
  });

  it("GETs the contract path with the tenant in the query, signed over path + query with the scoped secret", async () => {
    const out = await fetchHubLicenses("41", "c1");
    expect(out?.items[0].seats).toEqual({ total: 3, fromPool: 2, toOrder: 1 });
    expect(calls).toHaveLength(1);
    const parsed = new URL(calls[0].url);
    expect(parsed.origin + parsed.pathname).toBe("https://hub.example.test/api/webhooks/portal/licenses");
    expect(parsed.searchParams.get("accountId")).toBe("41");
    expect(parsed.searchParams.get("portalClientId")).toBe("c1");
    const h = calls[0].headers;
    expect(h).not.toHaveProperty("Authorization");
    expect(h).not.toHaveProperty("x-de-sync-token");
    expect(JSON.stringify(h)).not.toContain(SECRET);
    expect(h["X-DE-Source"]).toBe("portal");
    expect(h["X-DE-Signature"]).toBe(
      signDeSyncRequest({
        method: "GET",
        path: `${parsed.pathname}${parsed.search}`,
        timestamp: h["X-DE-Timestamp"],
        eventId: h["X-DE-Event-ID"],
        body: "{}",
        secret: SECRET,
      }),
    );
  });

  it("never falls back to the legacy shared secret (the Hub refuses it on this route)", async () => {
    delete process.env.PORTAL_TO_HUB_SECRET;
    process.env.TECHSALES_SYNC_TOKEN = "legacy-token";
    process.env.WEBSITE_LEAD_WEBHOOK_SECRET = "legacy-webhook";
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("needs the canonical numeric Hub accountId: no company-name fallback", async () => {
    expect(await fetchHubLicenses("Acme Dental", "c1")).toBeNull();
    expect(await fetchHubLicenses("", "c1")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("reads as null when the Hub is not configured", async () => {
    delete process.env.TECHSALES_HUB_URL;
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it.each([
    [401, { error: "Scoped portal secret required", code: "scoped_secret_required" }],
    [409, { error: "A canonical Hub accountId is required", code: "account_mapping_required" }],
    [503, { error: "Licence records are not persisted yet", persisted: false }],
  ])("reads a Hub %i as null", async (status, body) => {
    reply = { status, body };
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
  });

  it("refuses an answer for another account or off the contract", async () => {
    reply = { status: 200, body: projection(42) };
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
    reply = { status: 200, body: { ...projection(), contract: "de.hub.licenses/v2" } };
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
    const bad = projection();
    (bad.items[0].seats as Record<string, unknown>).total = -1;
    reply = { status: 200, body: bad };
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
  });

  it("reads a network failure as null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("ECONNREFUSED"))));
    expect(await fetchHubLicenses("41", "c1")).toBeNull();
  });
});
