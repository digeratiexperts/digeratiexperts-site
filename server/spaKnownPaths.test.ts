import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownSpaPath, normalizeSpaPath } from "./spaKnownPaths";

describe("spaKnownPaths", () => {
  it("normalizes trailing slashes", () => {
    expect(normalizeSpaPath("/store/")).toBe("/store");
    expect(normalizeSpaPath("/")).toBe("/");
  });

  it("allows known marketing and portal routes", () => {
    expect(isKnownSpaPath("/")).toBe(true);
    expect(isKnownSpaPath("/store")).toBe(true);
    expect(isKnownSpaPath("/store/")).toBe(true);
    expect(isKnownSpaPath("/portal/marketplace")).toBe(true);
    expect(isKnownSpaPath("/resources/blog/some-slug")).toBe(true);
  });

  it("knows every homepage version preview, so none of them answers 404", () => {
    // /version-4 was routed in App.tsx but missing here, so the preview rendered
    // while answering HTTP 404 to monitors, crawlers and link checkers.
    for (const n of [1, 2, 3, 4, 5, 6, 7]) {
      expect(isKnownSpaPath(`/version-${n}`)).toBe(true);
    }
    expect(isKnownSpaPath("/versions")).toBe(true);
  });

  it("knows every data-driven solution page, so none of them answers 404", () => {
    // App.tsx routes every servicePageData key at /solutions/<key>. Production
    // answered 404 for /solutions/threat-detection and friends on 2026-09-30
    // because this allowlist only carried the hand-written routes.
    const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/routes/servicePages.tsx"), "utf8");
    const block = src.slice(src.indexOf("servicePageData"), src.indexOf("industryPageData"));
    const keys = [...block.matchAll(/^\s{2}'([A-Za-z-]+)': \{/gm)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys) {
      expect(isKnownSpaPath(`/solutions/${key}`), `/solutions/${key}`).toBe(true);
    }
  });

  it("returns false for unknown paths so the SPA catch-all can send HTTP 404", () => {
    expect(isKnownSpaPath("/this-is-not-a-real-page")).toBe(false);
    expect(isKnownSpaPath("/store/product/secret-sku")).toBe(false);
  });

  it("treats wouter-style case variants as known SPA paths", () => {
    expect(normalizeSpaPath("/Store")).toBe("/store");
    expect(normalizeSpaPath("/Pricing")).toBe("/pricing");
    expect(isKnownSpaPath("/Store")).toBe(true);
    expect(isKnownSpaPath("/Pricing")).toBe(true);
  });
});
