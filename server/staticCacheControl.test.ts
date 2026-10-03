import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { cacheControlFor } from "./staticCacheControl";

const LONG = /max-age=31536000/;

describe("cache headers for files served from dist/public", () => {
  it("caches Vite's hashed output forever", () => {
    expect(cacheControlFor("assets/index-diQjwR2l.js")).toBe("public, max-age=31536000, immutable");
    expect(cacheControlFor("assets/index-C4MozliL.css")).toBe("public, max-age=31536000, immutable");
    expect(cacheControlFor("assets/hero-Bx3k9QaZ.webp")).toBe("public, max-age=31536000, immutable");
  });

  it("never caches the deploy marker or a page", () => {
    expect(cacheControlFor("release.txt")).toBe("no-cache, no-store, must-revalidate");
    expect(cacheControlFor("index.html")).toBe("no-cache, no-store, must-revalidate");
  });

  it("keeps files with unchanging names off the one-year cache", () => {
    for (const file of [
      "site.webmanifest",
      ".well-known/security.txt",
      "fonts/inter-latin.woff2",
      "vendor/pdfjs/pdf.worker.js",
      "assets/resources/security-readiness-checklist.pdf",
      "images/meshy/manifest.json",
    ]) {
      expect(cacheControlFor(file), file).not.toMatch(LONG);
      expect(cacheControlFor(file), file).toContain("must-revalidate");
    }
  });

  it("keeps images at thirty days, including public covers inside assets/", () => {
    expect(cacheControlFor("images/team/joe.webp")).toBe("public, max-age=2592000");
    expect(cacheControlFor("assets/covers/backup-guide.png")).toBe("public, max-age=2592000");
  });

  it("accepts Windows separators and a leading slash", () => {
    expect(cacheControlFor("\\assets\\index-diQjwR2l.js")).toMatch(LONG);
    expect(cacheControlFor("/release.txt")).toContain("no-store");
  });

  it("finds no file placed directly in client/public/assets, where it would be cached forever", () => {
    // Vite's hashed output owns the top level of assets/; a public file there
    // would get the immutable header under a name that never changes.
    const dir = resolve(__dirname, "../client/public/assets");
    const topLevelFiles = readdirSync(dir).filter((name) => statSync(join(dir, name)).isFile());
    expect(topLevelFiles).toEqual([]);
  });
});
