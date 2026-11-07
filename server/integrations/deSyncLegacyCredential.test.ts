/**
 * Legacy secret retirement, website PR 1: the durable per-hour counter and the
 * per-direction health read model. The count is best-effort on write (never
 * throws) and "unknown" on a failed read, never 0.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, dbState, ensureDeSyncSchema } = vi.hoisted(() => ({
  query: vi.fn(),
  dbState: { pool: null as null | { query: (...args: unknown[]) => unknown } },
  ensureDeSyncSchema: vi.fn(async () => undefined),
}));
vi.mock("../db", () => ({
  get pool() {
    return dbState.pool;
  },
}));
vi.mock("./ensureDeSyncSchema", () => ({ ensureDeSyncSchema }));
vi.mock("../logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

const {
  directionCredentialHealth,
  hourBucket,
  legacyRetirementState,
  loadDirectionCredentialHealth,
  loadLegacyCredentialUsage,
  recordLegacyCredentialUse,
} = await import("./deSyncLegacyCredential");

const ALL_SCOPED = {
  WEBSITE_TO_HUB_SECRET: "a",
  PORTAL_TO_HUB_SECRET: "b",
  HUB_TO_WEBSITE_SECRET: "c",
  HUB_TO_PORTAL_SECRET: "d",
} as NodeJS.ProcessEnv;

describe("legacy credential counter", () => {
  beforeEach(() => {
    query.mockReset();
    ensureDeSyncSchema.mockReset();
    ensureDeSyncSchema.mockResolvedValue(undefined);
    dbState.pool = { query };
    process.env.DATABASE_URL = "postgres://test";
  });

  it("upserts uses+1 into the direction's UTC hour bucket, path only", async () => {
    query.mockResolvedValue({ rows: [] });
    const at = new Date("2026-11-05T10:37:12Z");
    await recordLegacyCredentialUse({ direction: "hub_to_website", route: "/api/x?accountId=7", source: "techsales", at });
    expect(query).toHaveBeenCalledTimes(1);
    const [sqlText, params] = query.mock.calls[0];
    expect(String(sqlText)).toMatch(/ON CONFLICT \(direction, hour_bucket\) DO UPDATE SET\s+uses = de_sync_legacy_credential_uses\.uses \+ 1/);
    expect(params).toEqual(["hub_to_website", new Date("2026-11-05T10:00:00Z"), at, "/api/x", "techsales"]);
    expect(hourBucket(at).toISOString()).toBe("2026-11-05T10:00:00.000Z");
  });

  it("never throws when the database write fails or the schema bootstrap fails", async () => {
    query.mockRejectedValue(new Error("relation does not exist"));
    await expect(recordLegacyCredentialUse({ direction: "website_to_hub", route: "/api/x", source: "website" })).resolves.toBeUndefined();
    ensureDeSyncSchema.mockRejectedValue(new Error("db down"));
    await expect(recordLegacyCredentialUse({ direction: "website_to_hub", route: "/api/x", source: "website" })).resolves.toBeUndefined();
    dbState.pool = null;
    ensureDeSyncSchema.mockResolvedValue(undefined);
    await expect(recordLegacyCredentialUse({ direction: "website_to_hub", route: "/api/x", source: "website" })).resolves.toBeUndefined();
  });

  it("sums the 7-day window per direction and keeps the latest route", async () => {
    query.mockResolvedValue({
      rows: [
        { direction: "hub_to_website", uses: 2, last_used_at: "2026-11-04T09:10:00Z", last_route: "/api/a", last_source: "techsales" },
        { direction: "hub_to_website", uses: 3, last_used_at: "2026-11-05T09:10:00Z", last_route: "/api/b", last_source: "techsales" },
      ],
    });
    const usage = await loadLegacyCredentialUsage(new Date("2026-11-05T12:00:00Z"));
    expect(query.mock.calls[0][1]).toEqual([new Date("2026-10-29T12:00:00Z")]);
    expect(usage.get("hub_to_website")).toMatchObject({ uses: 5, lastRoute: "/api/b" });
  });

  it("throws on an unreadable count (no database, or query failure) instead of returning empty", async () => {
    query.mockRejectedValue(new Error("boom"));
    await expect(loadLegacyCredentialUsage()).rejects.toThrow("boom");
    dbState.pool = null;
    await expect(loadLegacyCredentialUsage()).rejects.toThrow(/unavailable/);
  });
});

describe("legacy credential health", () => {
  beforeEach(() => {
    query.mockReset();
    ensureDeSyncSchema.mockResolvedValue(undefined);
    dbState.pool = { query };
    process.env.DATABASE_URL = "postgres://test";
  });

  it("reports unknown (null), never 0, when the count cannot be read", async () => {
    const rows = directionCredentialHealth(ALL_SCOPED, null, "legacy use count is unavailable: no database");
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.legacyUses7d).toBeNull();
      expect(row.legacyUses7d).not.toBe(0);
      expect(row.lastUsedAt).toBe("unknown");
      expect(row.countError).toMatch(/unavailable/);
    }
    expect(legacyRetirementState(rows)).toBe("unknown");

    query.mockRejectedValue(new Error("relation missing"));
    const health = await loadDirectionCredentialHealth(ALL_SCOPED);
    expect(health.state).toBe("unknown");
    expect(health.directions.every((d) => d.legacyUses7d === null)).toBe(true);
  });

  it("reports 0 only for a readable empty count, and ready only with every scoped secret set", async () => {
    query.mockResolvedValue({ rows: [] });
    const ready = await loadDirectionCredentialHealth(ALL_SCOPED);
    expect(ready.state).toBe("ready");
    expect(ready.directions.map((d) => d.legacyUses7d)).toEqual([0, 0, 0, 0]);

    const missing = await loadDirectionCredentialHealth({ ...ALL_SCOPED, PORTAL_TO_HUB_SECRET: "" });
    expect(missing.state).toBe("not_ready");
    expect(missing.directions.find((d) => d.direction === "portal_to_hub")).toMatchObject({
      scopedEnv: "PORTAL_TO_HUB_SECRET",
      scopedConfigured: false,
    });
  });

  it("names the legacy env vars that are set but never their values", () => {
    const env = { ...ALL_SCOPED, TECHSALES_SYNC_TOKEN: "legacy-value-x", WEBSITE_LEAD_WEBHOOK_SECRET: " " } as NodeJS.ProcessEnv;
    const usage = new Map([["hub_to_portal", { uses: 2, lastUsedAt: new Date("2026-11-05T01:00:00Z"), lastRoute: "/api/y", lastSource: "techsales" }]]);
    const rows = directionCredentialHealth(env, usage, null);
    expect(rows[0].legacyEnvConfigured).toEqual(["TECHSALES_SYNC_TOKEN"]);
    expect(rows.find((r) => r.direction === "hub_to_portal")).toMatchObject({
      legacyUses7d: 2,
      lastUsedAt: "2026-11-05T01:00:00.000Z",
      lastRoute: "/api/y",
    });
    expect(legacyRetirementState(rows)).toBe("not_ready");
    const json = JSON.stringify(rows);
    for (const value of ["legacy-value-x", '"a"', '"b"', '"c"', '"d"']) expect(json).not.toContain(value);
  });
});

describe("lead webhook fallback health", () => {
  it("reports the count and names, unknown (never 0) when unreadable, and does not change the gate", async () => {
    const { leadWebhookFallbackHealth } = await import("./deSyncLegacyCredential");
    const env = { TECHSALES_SYNC_URL: "https://h/api/webhooks/website-lead", WEBSITE_LEAD_WEBHOOK_SECRET: "v-secret" } as NodeJS.ProcessEnv;
    const usage = new Map([["website_lead_webhook", { uses: 3, lastUsedAt: new Date("2026-11-06T01:00:00Z"), lastRoute: "/api/webhooks/website-lead", lastSource: "website" }]]);
    expect(leadWebhookFallbackHealth(env, usage, null)).toMatchObject({ urlConfigured: true, secretConfigured: true, uses7d: 3, lastUsedAt: "2026-11-06T01:00:00.000Z" });
    expect(leadWebhookFallbackHealth(env, new Map(), null)).toMatchObject({ uses7d: 0 });
    const unknown = leadWebhookFallbackHealth(env, null, "no database");
    expect(unknown.uses7d).toBeNull();
    expect(unknown.lastUsedAt).toBe("unknown");
    expect(JSON.stringify(unknown)).not.toContain("v-secret");
    const rows = directionCredentialHealth(ALL_SCOPED, usage, null);
    expect(legacyRetirementState(rows)).toBe("ready");
  });
});
