import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOMEPAGE_VERSIONS } from "./registry";

const here = path.resolve(import.meta.dirname);
const root = path.resolve(here, "../../../..");

describe("homepage versions registry", () => {
  it("numbers versions sequentially from 1 with matching /version-n paths", () => {
    HOMEPAGE_VERSIONS.forEach((v, i) => {
      expect(v.n).toBe(i + 1);
      expect(v.path).toBe(`/version-${v.n}`);
    });
  });

  it("has a frozen snapshot folder for every react version, and every snapshot is registered", () => {
    for (const v of HOMEPAGE_VERSIONS.filter((x) => x.kind === "react")) {
      const home = path.join(here, `v${v.n}`, "DigeratiHomepage.tsx");
      expect(existsSync(home), `${v.path} snapshot missing`).toBe(true);
      const src = readFileSync(home, "utf8");
      expect(src.startsWith("// FROZEN")).toBe(true);
      // structured data belongs to the canonical homepage only
      expect(src).not.toContain("JsonLd");
    }
    const folders = readdirSync(here, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^v\d+$/.test(d.name))
      .map((d) => Number(d.name.slice(1)));
    for (const n of folders) {
      // A version folder belongs to a frozen snapshot or to a live build. It
      // may not be unregistered either way.
      expect(
        HOMEPAGE_VERSIONS.some((v) => v.n === n && (v.kind === "react" || v.kind === "build")),
        `v${n} folder is not registered`,
      ).toBe(true);
    }
  });

  it("gives every live build a folder, and never freezes one", () => {
    for (const v of HOMEPAGE_VERSIONS.filter((x) => x.kind === "build")) {
      const dir = path.join(here, `v${v.n}`);
      expect(existsSync(dir), `${v.path} build folder missing`).toBe(true);
      // A build under development must not be carrying the frozen-snapshot
      // marker: that marker is what tells everyone else not to edit the file.
      const frozen = path.join(dir, "DigeratiHomepage.tsx");
      if (existsSync(frozen)) {
        expect(readFileSync(frozen, "utf8").startsWith("// FROZEN")).toBe(false);
      }
    }
  });

  it("static versions name the URL they forward to", () => {
    for (const v of HOMEPAGE_VERSIONS.filter((x) => x.kind === "static")) {
      expect(v.href).toBeTruthy();
    }
  });

  it("is routed in App.tsx and kept out of the sitemap", () => {
    const app = readFileSync(path.join(root, "client/src/App.tsx"), "utf8");
    expect(app).toContain('path="/versions"');
    for (const v of HOMEPAGE_VERSIONS.filter((x) => x.kind !== "planned")) {
      expect(app, `${v.path} route missing`).toContain(`path="${v.path}"`);
    }
    const sitemapScript = readFileSync(path.join(root, "scripts/generate-sitemap.mjs"), "utf8");
    expect(sitemapScript).not.toContain("/version");
    const sitemap = readFileSync(path.join(root, "public/sitemap.xml"), "utf8");
    expect(sitemap).not.toContain("/version");
  });
});
