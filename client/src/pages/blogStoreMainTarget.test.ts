import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_FALLBACK_ID } from "@/components/SkipToContent";

const read = (...parts: string[]) =>
  readFileSync(resolve(__dirname, ...parts), "utf8");

const GUARDED_PAGES = [
  ["resources", "Blog.tsx"],
  ["store", "StoreLanding.tsx"],
  ["LeadQuoteWizard.tsx"],
] as const;

describe("blog store wizard main content target", () => {
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
