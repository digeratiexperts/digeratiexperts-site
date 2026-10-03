import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_FALLBACK_ID } from "@/components/SkipToContent";

/**
 * /pricing is a high-traffic marketing page that owns its own <main>
 * (not PageTemplate). The global skip link's no-JS fallback is
 * href="#main-content", so this page must expose that id.
 */
describe("ProActiveEcosystemPricing skip / main landmark", () => {
  const source = readFileSync(
    path.resolve(__dirname, "./ProActiveEcosystemPricing.tsx"),
    "utf8",
  );

  // Since the 2026-10 site chapter pass the page renders through PageTemplate,
  // which owns the <main>; either it or the page itself must carry the target.
  const template = readFileSync(
    path.resolve(__dirname, "../components/PageTemplate.tsx"),
    "utf8",
  );
  const viaTemplate = /<PageTemplate\b/.test(source) && !/<main\b/.test(source);
  const owner = viaTemplate ? template : source;

  it(`exposes <main id="${MAIN_CONTENT_FALLBACK_ID}"> for the skip-link hash fallback`, () => {
    expect(owner).toMatch(
      new RegExp(`<main[\\s\\S]*?id=["']${MAIN_CONTENT_FALLBACK_ID}["']`),
    );
  });

  it("makes the main landmark programmatically focusable", () => {
    expect(owner).toMatch(/tabIndex=\{-1\}/);
  });
});
