import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_FALLBACK_ID } from "@/components/SkipToContent";

/**
 * Skip-to-content falls back to #main-content when JS focus helpers do not
 * run. Solutions siblings beyond SolutionsIndex / CoManaged / Standalone.
 */
const read = (...parts: string[]) =>
  readFileSync(resolve(__dirname, ...parts), "utf8");

const GUARDED_PAGES = [
  ["solutions", "BusinessNeedsIndex.tsx"],
  ["solutions", "BusinessNeedsFamily.tsx"],
  ["solutions", "SolutionRequest.tsx"],
  ["solutions", "OfficePage.tsx"],
] as const;

describe("solutions siblings main content target", () => {
  for (const parts of GUARDED_PAGES) {
    const label = parts.join("/");
    it(`${label} exposes id="${MAIN_CONTENT_FALLBACK_ID}" on main`, () => {
      const source = read(...parts);
      expect(source).toMatch(
        new RegExp(`<main[^>]*\\bid=["']${MAIN_CONTENT_FALLBACK_ID}["']`),
      );
    });
  }
});
