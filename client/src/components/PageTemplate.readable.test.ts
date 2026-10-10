import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The readable page modifier (Joe, 2026-10-10, /solutions/proactive-ecosystem:
 * "way more readable so you can read all letters and words"). Guards that the
 * page keeps it on and that it stays scoped to <main>.
 */
const root = resolve(__dirname, "../..");
const template = readFileSync(resolve(root, "src/components/PageTemplate.tsx"), "utf8");
const page = readFileSync(resolve(root, "src/pages/solutions/ProActiveEcosystemPage.tsx"), "utf8");
const css = readFileSync(resolve(root, "src/index.css"), "utf8");

describe("readable page modifier", () => {
  it("applies to <main> only, so the nav and footer keep the site defaults", () => {
    expect(template).toContain('<main id="main-content" tabIndex={-1} className={readable ? "de-readable" : undefined}>');
  });

  it("is on for the ProActive Ecosystem page", () => {
    expect(page).toMatch(/<PageTemplate\s+layout="chapters"\s+readable\b/);
  });

  it("lifts muted ink and the 10-11px labels", () => {
    expect(css).toMatch(/\.de-readable :is\(\.text-white\\\/50[^{]*\.text-white\\\/70\) \{\s*color: rgb\(255 255 255 \/ 0\.85\);/);
    expect(css).toMatch(/\.de-readable :is\(\.text-\\\[10px\\\], \.text-\\\[11px\\\]\) \{\s*font-size: 0\.8125rem;/);
  });
});
