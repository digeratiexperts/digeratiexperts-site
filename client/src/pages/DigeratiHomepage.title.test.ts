import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import routeMeta from "../../../shared/routeMeta.json";

// Regression: the client-side useSEO call overwrote the server-approved homepage
// title after hydration, so the tab and the indexed title were the old wording.
// The homepage title must equal the shared route-meta "/" title, minus the brand suffix
// that useSEO adds back.
describe("homepage document title", () => {
  it("matches the shared route-meta title for '/'", () => {
    const source = readFileSync(new URL("./DigeratiHomepage.tsx", import.meta.url), "utf8");
    // Allow comment lines between `useSEO({` and `title:`.
    const match = source.match(/useSEO\(\{(?:\s|\/\/[^\n]*)*title:\s*'([^']+)'/);
    expect(match, "homepage must call useSEO with a literal title").not.toBeNull();
    const clientTitle = match![1];
    const approved = (routeMeta as Record<string, { title: string }>)["/"].title;
    const brandSuffix = " | Digerati Experts";
    expect(approved.endsWith(brandSuffix)).toBe(true);
    expect(clientTitle).toBe(approved.slice(0, -brandSuffix.length));
  });
});
