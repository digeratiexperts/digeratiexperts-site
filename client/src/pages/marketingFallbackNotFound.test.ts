import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Pages mounted by MarketingRouteFallback must render the plain 404 page for an
 * unknown slug. The default NotFound export re-dispatches /resources/briefs/*,
 * /resources/datasheets/*, /go/* … back to MarketingRouteFallback, so using it
 * there recursed until the browser tab crashed (found 2026-10-03).
 */
const FALLBACK_PAGES = [
  ["resources", "ResourceAssetPage.tsx"],
  ["resources", "ExecutiveBriefPage.tsx"],
  ["campaigns", "CampaignLanding.tsx"],
] as const;

describe("marketing fallback pages render the plain 404", () => {
  for (const parts of FALLBACK_PAGES) {
    it(`${parts.join("/")} does not import the re-dispatching NotFound default`, () => {
      const source = readFileSync(resolve(__dirname, ...parts), "utf8");
      expect(source).not.toMatch(/import\s+NotFound\s+from\s+["']@\/pages\/not-found["']/);
      expect(source).toMatch(/NotFoundPage/);
    });
  }
});
