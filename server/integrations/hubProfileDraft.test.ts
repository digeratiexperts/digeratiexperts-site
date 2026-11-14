import { afterEach, describe, expect, it, vi } from "vitest";
import { capUtf8, claimProfileDraft, createProfileDraft, profileDraftsEnabled, PROFILE_CLAIM_PATH } from "./hubProfileDraft";
import { CARD_DATA_REJECTED_CODE, CardDataRejectedError } from "@shared/pciGuard";
import { signDeSyncRequest } from "./deSyncAuth";

const ENV = { ...process.env };
afterEach(() => {
  process.env = { ...ENV };
  vi.restoreAllMocks();
});
function on() {
  process.env.HUB_PROFILE_DRAFTS_ENABLED = "1";
  process.env.TECHSALES_HUB_URL = "https://hub.example.test";
  process.env.WEBSITE_TO_HUB_SECRET = "scoped-secret-for-tests";
  process.env.WEBSITE_LEAD_WEBHOOK_SECRET = "legacy-secret-must-not-be-used";
}
const TOKEN = "claim_0123456789abcdefABCDEF";

describe("profile drafts are off until switched on", () => {
  it("sends nothing when HUB_PROFILE_DRAFTS_ENABLED is unset", async () => {
    delete process.env.HUB_PROFILE_DRAFTS_ENABLED;
    process.env.TECHSALES_HUB_URL = "https://hub.example.test";
    const f = vi.fn();
    expect(profileDraftsEnabled()).toBe(false);
    expect(await createProfileDraft({ sessionId: "s", words: "w", situationIds: [], serviceIds: [], itPlan: {} }, f as any)).toBeNull();
    expect(await claimProfileDraft({ claimToken: TOKEN, portalClientId: "c1", email: "a@b.co" }, { fetchImpl: f as any })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });
});

describe("createProfileDraft", () => {
  it("sends words, ids and it_plan with the consent version, and never identity", async () => {
    on();
    const f = vi.fn(async (_u: string, init: any) => new Response(JSON.stringify({ draftId: "d1", claimToken: TOKEN, expiresAt: "2026-12-13T00:00:00Z" }), { status: 200 }));
    const r = await createProfileDraft({ sessionId: "s1", words: "é".repeat(9000), situationIds: ["backup_continuity"], serviceIds: ["vcio-services"], itPlan: { a: 1 } }, f as any);
    expect(r).toEqual({ draftId: "d1", claimToken: TOKEN, expiresAt: "2026-12-13T00:00:00Z" });
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("https://hub.example.test/api/public/desk/profile-draft");
    const body = JSON.parse(init.body);
    expect(Buffer.byteLength(body.words, "utf8")).toBeLessThanOrEqual(8 * 1024);
    expect(body.consent_text_version).toBe("v1");
    expect(body.situation_ids).toEqual(["backup_continuity"]);
    for (const k of ["email", "phone", "name", "company"]) expect(body).not.toHaveProperty(k);
  });

  it("refuses card data and does not call the Hub", async () => {
    on();
    const f = vi.fn();
    await expect(
      createProfileDraft({ sessionId: "s1", words: "please charge 4111111111111111", situationIds: [], serviceIds: [], itPlan: {} }, f as any),
    ).rejects.toSatisfy((err: unknown) => err instanceof CardDataRejectedError && (err as CardDataRejectedError).code === CARD_DATA_REJECTED_CODE);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("claimProfileDraft", () => {
  it("signs with the website_to_hub scoped secret, never the legacy lead secret, and keeps the canonical id", async () => {
    on();
    const persist = vi.fn(async () => undefined);
    const f = vi.fn(async () => new Response(JSON.stringify({ canonicalAccountId: "4821" }), { status: 200 }));
    const r = await claimProfileDraft({ claimToken: TOKEN, portalClientId: "c1", company: "Example Co", email: "a@b.co" }, { fetchImpl: f as any, persist });
    expect(r).toEqual({ canonicalAccountId: "4821" });
    expect(persist).toHaveBeenCalledWith("c1", "4821");
    const [url, init] = (f.mock.calls[0] as unknown) as [string, any];
    expect(url).toBe("https://hub.example.test" + PROFILE_CLAIM_PATH);
    const h = init.headers as Record<string, string>;
    const expected = signDeSyncRequest({ method: "POST", path: PROFILE_CLAIM_PATH, timestamp: h["X-DE-Timestamp"], eventId: h["X-DE-Event-ID"], body: init.body, secret: "scoped-secret-for-tests" });
    expect(h["X-DE-Signature"]).toBe(expected);
    expect(JSON.stringify(init)).not.toContain("legacy-secret-must-not-be-used");
    expect(JSON.parse(init.body)).toEqual({ claimToken: TOKEN, portalClientId: "c1", company: "Example Co", email: "a@b.co" });
  });

  it("never throws and never persists a bad answer", async () => {
    on();
    const persist = vi.fn(async () => undefined);
    expect(await claimProfileDraft({ claimToken: TOKEN, portalClientId: "c1", email: "a@b.co" }, { fetchImpl: (async () => { throw new Error("down"); }) as any, persist })).toBeNull();
    expect(await claimProfileDraft({ claimToken: TOKEN, portalClientId: "c1", email: "a@b.co" }, { fetchImpl: (async () => new Response(JSON.stringify({ canonicalAccountId: "abc; drop" }))) as any, persist })).toBeNull();
    expect(await claimProfileDraft({ claimToken: "short", portalClientId: "c1", email: "a@b.co" }, { fetchImpl: vi.fn() as any, persist })).toBeNull();
    expect(persist).not.toHaveBeenCalled();
  });

  it("caps UTF-8 without splitting a character", () => {
    expect(Buffer.byteLength(capUtf8("😀".repeat(3000)), "utf8")).toBeLessThanOrEqual(8192);
  });
});
