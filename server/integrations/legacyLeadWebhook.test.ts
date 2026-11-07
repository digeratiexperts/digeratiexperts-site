import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { recordLegacyCredentialUse, warn } = vi.hoisted(() => ({
  recordLegacyCredentialUse: vi.fn(async (_input: unknown) => undefined),
  warn: vi.fn(),
}));
vi.mock("./deSyncLegacyCredential", () => ({ recordLegacyCredentialUse }));
vi.mock("../logger", () => ({ logger: { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const { createDeSyncEnvelope } = await import("./deSyncContract");
const { _resetLeadWebhookWarning, deliverEnvelopeToHub, legacyLeadWebhookAllowed } = await import("./techSalesClient");

const SCOPED = "scoped-website-to-hub-value";
const WEBHOOK = "lead-webhook-secret-value";

// Issue 195: the legacy lead webhook carries the raw sync secret as a bearer
// token. It must never be used in signed-only mode or over plain HTTP.
describe("legacy lead webhook fallback", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.TECHSALES_HUB_URL = "https://techsales.example.test";
    process.env.TECHSALES_SYNC_TOKEN = "legacy-token-value";
    process.env.WEBSITE_TO_HUB_SECRET = SCOPED;
    process.env.WEBSITE_LEAD_WEBHOOK_SECRET = WEBHOOK;
    process.env.TECHSALES_SYNC_URL = "https://hooks.example.test/lead";
    delete process.env.DE_SYNC_REQUIRE_SIGNED;
    recordLegacyCredentialUse.mockClear();
    warn.mockClear();
    _resetLeadWebhookWarning();
  });

  afterEach(() => {
    process.env = { ...saved };
    vi.unstubAllGlobals();
  });

  function leadEnvelope() {
    return createDeSyncEnvelope({
      eventType: "lead.created",
      source: "website",
      entityType: "lead",
      entityId: "lead-1",
      payload: { name: "Jordan", email: "jordan@example.com" },
    });
  }

  it("is allowed only for an https URL without signed-only mode", () => {
    expect(legacyLeadWebhookAllowed("https://hooks.example.test/lead")).toBe(true);
    expect(legacyLeadWebhookAllowed("http://hooks.example.test/lead")).toBe(false);
    expect(legacyLeadWebhookAllowed("not a url")).toBe(false);
    expect(legacyLeadWebhookAllowed("")).toBe(false);
    process.env.DE_SYNC_REQUIRE_SIGNED = "1";
    expect(legacyLeadWebhookAllowed("https://hooks.example.test/lead")).toBe(false);
  });

  it("falls back to the webhook on a 404 while signed-only mode is off", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(deliverEnvelopeToHub(leadEnvelope(), "hub")).resolves.toEqual({
      canonicalAccountId: null,
      duplicate: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never sends the raw secret when DE_SYNC_REQUIRE_SIGNED=1", async () => {
    process.env.DE_SYNC_REQUIRE_SIGNED = "1";
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(deliverEnvelopeToHub(leadEnvelope(), "hub")).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = JSON.stringify(fetchMock.mock.calls[0][1]?.headers ?? {});
    expect(headers).not.toContain("legacy-token-value");
    expect(headers).not.toContain(WEBHOOK);
  });

  function fallbackFetch() {
    return vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => "" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "" });
  }

  it("sends the webhook its own secret (WEBSITE_LEAD_WEBHOOK_SECRET) in one header, never the scoped or sync secret", async () => {
    const fetchMock = fallbackFetch();
    vi.stubGlobal("fetch", fetchMock);
    await deliverEnvelopeToHub(leadEnvelope(), "hub");
    const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
    expect(headers["x-de-sync-token"]).toBe(WEBHOOK);
    expect(Object.keys(headers).map((k) => k.toLowerCase())).not.toContain("authorization");
    const all = JSON.stringify(headers);
    expect(all).not.toContain(SCOPED);
    expect(all).not.toContain("legacy-token-value");
  });

  it("skips the fallback when WEBSITE_LEAD_WEBHOOK_SECRET is not set (it could only 401)", async () => {
    delete process.env.WEBSITE_LEAD_WEBHOOK_SECRET;
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
    await expect(deliverEnvelopeToHub(leadEnvelope(), "hub")).rejects.toThrow(/404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(recordLegacyCredentialUse).not.toHaveBeenCalled();
  });

  it("counts every fallback use, warns once per hour, and logs no secret or query", async () => {
    process.env.TECHSALES_SYNC_URL = "https://hooks.example.test/api/webhooks/website-lead?x=1";
    vi.stubGlobal("fetch", fallbackFetch());
    await deliverEnvelopeToHub(leadEnvelope(), "hub");
    vi.stubGlobal("fetch", fallbackFetch());
    await deliverEnvelopeToHub(leadEnvelope(), "hub");
    await vi.waitFor(() => expect(recordLegacyCredentialUse).toHaveBeenCalledTimes(2));
    expect(recordLegacyCredentialUse).toHaveBeenCalledWith(
      expect.objectContaining({ direction: "website_lead_webhook", route: "/api/webhooks/website-lead", source: "website" }),
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][1]).toMatchObject({ event: "de_sync.lead_webhook_fallback_used", route: "/api/webhooks/website-lead" });
    const logged = JSON.stringify([warn.mock.calls, recordLegacyCredentialUse.mock.calls]);
    for (const v of [WEBHOOK, SCOPED, "legacy-token-value", "x=1"]) expect(logged).not.toContain(v);
  });

  it("does not count a lead the signed route accepted", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 201, text: async () => "", json: async () => ({}) }));
    await deliverEnvelopeToHub(leadEnvelope(), "hub");
    await new Promise((r) => setTimeout(r, 0));
    expect(recordLegacyCredentialUse).not.toHaveBeenCalled();
  });
});
