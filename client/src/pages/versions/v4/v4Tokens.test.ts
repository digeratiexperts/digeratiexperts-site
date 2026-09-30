import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Acceptance test 16 of docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md: one token
 * system, guarded by a test rather than by inspection. The DE Desk failure the
 * source of truth records (§2) is what this goes wrong as when nobody is
 * looking: a second naming scheme, a nested re-declaration, an !important
 * patch layer, and two themes shipping as one.
 *
 * What is guarded:
 *   - colour comes only from the theme's DE tokens: no hex literal, no
 *     rgb()/rgba() literal, anywhere in the V4 sources;
 *   - no !important;
 *   - every font size is one the V4 scale (V4Primitives.T) defines, so a
 *     chapter cannot quietly grow its own type system — which is also what
 *     kept the compiled stylesheet inside the bundle budget after the third
 *     cut overran it by six bytes.
 */

const dir = dirname(fileURLToPath(import.meta.url));
const sources = readdirSync(dir)
  .filter((f) => f.endsWith(".tsx"))
  .map((f) => [f, readFileSync(join(dir, f), "utf8")] as const);

const primitives = readFileSync(join(dir, "V4Primitives.tsx"), "utf8");

/** Sizes written in the scale, in px and as clamp() expressions. */
const scalePx = new Set([...primitives.matchAll(/text-\[([\d.]+)px\]/g)].map((m) => m[1]));
const scaleClamps = new Set([...primitives.matchAll(/text-\[(clamp\([^\]]+\))\]/g)].map((m) => m[1]));

/** The one deliberate exception: the hero headline's desktop-only size, tied to the viewport so each sentence keeps to its line. */
const ALLOWED_CLAMPS_OUTSIDE_SCALE = new Set(["clamp(2.4rem,3.6vw,3.3rem)"]);

describe("V4 token system", () => {
  it("has sources to guard", () => {
    expect(sources.length).toBeGreaterThan(5);
    expect(scalePx.size).toBeGreaterThan(0);
    expect(scaleClamps.size).toBeGreaterThan(0);
  });

  it("takes every colour from the theme's DE tokens — no hex or rgb literal", () => {
    for (const [file, src] of sources) {
      const hex = src.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      const rgb = src.match(/rgba?\(\s*\d/g) ?? [];
      expect({ file, hex, rgb }).toEqual({ file, hex: [], rgb: [] });
    }
  });

  it("carries no !important patch layer", () => {
    for (const [file, src] of sources) {
      expect({ file, important: src.includes("!important") }).toEqual({ file, important: false });
    }
  });

  it("sets every font size from the V4 scale", () => {
    for (const [file, src] of sources) {
      if (file === "V4Primitives.tsx") continue;
      const px = [...src.matchAll(/text-\[([\d.]+)px\]/g)].map((m) => m[1]).filter((v) => !scalePx.has(v));
      const clamps = [...src.matchAll(/text-\[(clamp\([^\]]+\))\]/g)]
        .map((m) => m[1])
        .filter((v) => !scaleClamps.has(v) && !ALLOWED_CLAMPS_OUTSIDE_SCALE.has(v));
      const rem = [...src.matchAll(/text-\[([\d.]+rem)\]/g)].map((m) => m[1]);
      expect({ file, offScale: [...px, ...clamps, ...rem] }).toEqual({ file, offScale: [] });
    }
  });

  it("keeps the scale small", () => {
    // Six sizes and three mono treatments. Growing this is a design decision,
    // not a convenience, and it shows up here.
    expect(scalePx.size + scaleClamps.size).toBeLessThanOrEqual(10);
  });
});
