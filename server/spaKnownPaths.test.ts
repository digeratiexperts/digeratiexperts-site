import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownSpaPath, normalizeSpaPath } from "./spaKnownPaths";
import { CAMPAIGN_SLUGS } from "@/data/campaigns";
import { EXECUTIVE_BRIEFS } from "@/data/executiveBriefs";
import resourceRegistry from "@/data/resourceRegistry.v2.json";

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

  it("knows every data-driven industry and support page", () => {
    // /industries/professional-services (linked from every page's footer) and
    // /support/system-status answered 404 until 2026-10-01.
    const src = readFileSync(path.resolve(import.meta.dirname, "../client/src/pages/routes/servicePages.tsx"), "utf8");
    for (const [name, prefix] of [["industryPageData", "/industries"], ["supportPageData", "/support"]] as const) {
      const start = src.indexOf(`export const ${name}`);
      const next = src.indexOf("export const", start + 1);
      const keys = [...src.slice(start, next === -1 ? undefined : next).matchAll(/^\s{2}'([A-Za-z-]+)': \{/gm)].map((m) => m[1]);
      expect(keys.length, name).toBeGreaterThan(0);
      for (const key of keys) {
        expect(isKnownSpaPath(`${prefix}/${key}`), `${prefix}/${key}`).toBe(true);
      }
    }
  });

  it("answers 200 for every page in the sitemap", () => {
    // 27 of the 113 sitemap URLs (every /go campaign, every brief and resource
    // page) rendered while answering HTTP 404 until 2026-10-01.
    const xml = readFileSync(path.resolve(import.meta.dirname, "../public/sitemap.xml"), "utf8");
    const paths = [...xml.matchAll(/<loc>https:\/\/digeratiexperts\.com([^<]*)<\/loc>/g)].map((m) => m[1] || "/");
    expect(paths.length).toBeGreaterThan(100);
    expect(paths.filter((p) => !isKnownSpaPath(p))).toEqual([]);
  });

  it("knows every campaign, executive brief and resource page the client renders", () => {
    const rendered = [
      "/go",
      ...CAMPAIGN_SLUGS.map((slug) => `/go/${slug}`),
      "/resources/briefs",
      ...EXECUTIVE_BRIEFS.map((brief) => `/resources/briefs/${brief.slug}`),
      ...resourceRegistry.resources.map((resource) => resource.route),
    ];
    expect(rendered.length).toBeGreaterThan(25);
    expect(rendered.filter((p) => !isKnownSpaPath(p))).toEqual([]);
  });

  it("still answers 404 for a campaign, brief or resource slug that does not exist", () => {
    for (const p of ["/go/not-a-campaign", "/resources/briefs/not-a-brief", "/resources/datasheets/not-a-datasheet", "/lp/anything", "/ads/anything"]) {
      expect(isKnownSpaPath(p), p).toBe(false);
    }
  });

  /**
   * The failure this guards against: a page is added to App.tsx, renders
   * perfectly in dev, and then serves HTTP 404 in production because nobody
   * added it here. Humans still see the page, so it looks fine — but crawlers,
   * link checkers and uptime monitors are told it does not exist. /the-box
   * shipped exactly this way on 2026-10-05 and was caught only by hitting
   * production.
   *
   * So rather than assert one path, read every static route the client
   * registers and require each to be resolvable.
   */
  it("knows every static route App.tsx registers", () => {
    const app = readFileSync(
      path.resolve(__dirname, "../client/src/App.tsx"),
      "utf8",
    );
    const declared = [...app.matchAll(/<Route\s+path="(\/[^"{]*)"/g)].map((m) => m[1]);
    const staticRoutes = [...new Set(declared)].filter(
      (route) => !route.includes(":") && !route.includes("*"),
    );

    // Retired routes the server 301s before the SPA catch-all ever runs. They
    // must NOT be known SPA paths — a redirect that returns the shell instead
    // would strand the visitor on a page that no longer exists.
    const REDIRECTED = new Set(["/solutions/business-needs"]);

    expect(staticRoutes.length).toBeGreaterThan(100);
    const unreachable = staticRoutes.filter(
      (route) => !REDIRECTED.has(route) && !isKnownSpaPath(route),
    );
    expect(unreachable).toEqual([]);
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
