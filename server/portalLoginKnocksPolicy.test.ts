import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import { loginKnockRateLimiter } from "./middleware/rateLimiter";
import { boundedKnockText, normalizeKnockMeta, normalizeKnockPath } from "./portalLoginKnocksPolicy";
vi.mock("./db", () => ({ db: null, dbReady: false, initPromise: Promise.resolve() }));
afterEach(() => { vi.useRealTimers(); });

describe("login beacon boundaries", () => {
  it("rejects the 21st public beacon in one window", async () => {
    const app = express();
    app.post("/ping", loginKnockRateLimiter, (_req, res) => res.json({ ok: true }));
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Missing test address");
    try {
      for (let i = 0; i < 21; i++) {
        const response = await fetch(`http://127.0.0.1:${address.port}/ping`, { method: "POST" });
        expect(response.status).toBe(i < 20 ? 200 : 429);
        await response.text();
      }
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
  it("drops query/fragment data and bounds hostile input", () => {
    expect(normalizeKnockPath("/portal/login?code=private#email")).toBe("/portal/login");
    expect(normalizeKnockPath("https://other.example/a")).toBe("/portal/login");
    expect(normalizeKnockPath("//other.example/a")).toBe("/portal/login");
    expect(normalizeKnockPath("/" + "a".repeat(4000))).toHaveLength(256);
    expect(boundedKnockText("agent\r\n" + "a".repeat(2000), 512)).toHaveLength(512);
    expect(normalizeKnockMeta({ token: "private", nested: { a: "b" }, source: "beacon", rapidFire: true })).toEqual({ source: "beacon", rapidFire: true });
    expect(JSON.stringify(normalizeKnockMeta(Object.fromEntries(Array.from({length: 100}, (_, i) => [`field${i}`, "a".repeat(1000)])))).length).toBeLessThanOrEqual(2048);
  });
  it("expires old public page hits while retaining authentication audit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const { recordLoginKnock, listLoginKnocks } = await import("./portalLoginKnocksStore");
    await recordLoginKnock({ kind: "page_hit", path: "/portal/login" });
    await recordLoginKnock({ kind: "login_failed", path: "/api/portal/login" });
    vi.setSystemTime(new Date("2026-02-02T00:00:00Z"));
    await recordLoginKnock({ kind: "page_hit", path: "/portal/login" });
    const rows = await listLoginKnocks({ sinceHours: 24 * 40 });
    expect(rows.filter(row => row.kind === "page_hit")).toHaveLength(1);
    expect(rows.filter(row => row.kind === "login_failed")).toHaveLength(1);
  });
});
