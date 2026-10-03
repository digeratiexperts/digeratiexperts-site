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

  it(`exposes <main id="${MAIN_CONTENT_FALLBACK_ID}"> for the skip-link hash fallback`, () => {
    expect(source).toMatch(
      new RegExp(`<main[\\s\\S]*?id=["']${MAIN_CONTENT_FALLBACK_ID}["']`),
    );
  });

  it("makes the main landmark programmatically focusable", () => {
    expect(source).toMatch(/tabIndex=\{-1\}/);
  });
});
