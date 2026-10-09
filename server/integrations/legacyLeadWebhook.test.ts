import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeSyncEnvelope } from "./deSyncContract";
import { deliverEnvelopeToHub, legacyLeadWebhookAllowed } from "./techSalesClient";

// Issue 195: the legacy lead webhook carries the raw sync secret as a bearer
// token. It must never be used in signed-only mode or over plain HTTP.
describe("legacy lead webhook fallback", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    process.env.TECHSALES_HUB_URL = "https://techsales.example.test";
    process.env.TECHSALES_SYNC_TOKEN = "legacy-token-value";
    process.env.TECHSALES_SYNC_URL = "https://hooks.example.test/lead";
    delete process.env.DE_SYNC_REQUIRE_SIGNED;
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
  });
});
