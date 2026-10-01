import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One product (source of truth §14.28): the Store's step label, cell rule,
 * spacing and type scale carry V4's values. V4 lives on its own branch, so
 * the values are pinned here from V4Primitives.tsx (T and ChapterLabel).
 */
const root = path.resolve(import.meta.dirname, "../../../../..");
const css = readFileSync(path.join(root, "client/src/styles/store-builder.css"), "utf8");

const V4 = {
  displaySize: "clamp(2.4rem, 6vw, 3.6rem)",
  h2Size: "clamp(1.75rem, 4vw, 2.7rem)",
  h2Tracking: "-0.015em",
  h3Size: "clamp(1.1rem, 1.8vw, 1.45rem)",
  figureSize: "clamp(1.6rem, 3.2vw, 2.3rem)",
  ledeSize: "clamp(1rem, 1.4vw, 1.1rem)",
  smallSize: "13.5px",
  labelSize: "10.5px",
  labelTracking: "0.18em",
  monoSize: "12.5px",
  microSize: "9.5px",
  microTracking: "0.16em",
  labelRuleWidth: "2rem",
  cellPadding: "1.25rem",
};

function block(selector: string): string {
  // The rule that starts a line with exactly this selector (not a compound selector that ends in it).
  const start = css.indexOf(`\n${selector} {`);
  expect(start, `${selector} exists`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("Door 2 tokens match the V4 vocabulary", () => {
  it("uses the six-size scale and three mono treatments", () => {
    expect(block(".d2-display")).toContain(V4.displaySize);
    expect(block(".d2-h2")).toContain(V4.h2Size);
    expect(block(".d2-h2")).toContain(V4.h2Tracking);
    expect(block(".d2-h3")).toContain(V4.h3Size);
    expect(block(".d2-figure")).toContain(V4.figureSize);
    expect(block(".d2-lede")).toContain(V4.ledeSize);
    expect(block(".d2-small")).toContain(V4.smallSize);
    expect(block(".d2-label")).toContain(V4.labelSize);
    expect(block(".d2-label")).toContain(V4.labelTracking);
    expect(block(".d2-mono")).toContain(V4.monoSize);
    expect(block(".d2-micro")).toContain(V4.microSize);
    expect(block(".d2-micro")).toContain(V4.microTracking);
  });

  it("draws the step label and the cell exactly as V4's ChapterLabel and GridCell", () => {
    expect(block(".d2-step__rule")).toContain(`width: ${V4.labelRuleWidth}`);
    expect(block(".d2-step__rule")).toContain("height: 1px");
    expect(block(".d2-cell")).toContain("border-top: 1px solid var(--d2-rule)");
    expect(block(".d2-cell")).toContain(`padding-top: ${V4.cellPadding}`);
  });

  it("keeps colour in the theme tokens and reduces every motion to nothing on request", () => {
    // The only literal colours are the locked focus ring and print black/white; error inks derive from --destructive.
    const hexes = [...css.matchAll(/#[0-9a-fA-F]{3,6}\b/g)].map((match) => match[0].toLowerCase());
    expect(new Set(hexes)).toEqual(new Set(["#ec4899", "#fff", "#000", "#ccc"]));
    expect(css).toContain("--d2-error-ink: color-mix(in srgb, hsl(var(--destructive))");
    expect(block(".d2-need")).not.toContain("animation");
    expect(css).toContain('.d2-need[data-d2-entered="true"]');
    expect(css).toContain('html.de-store-jelly .d2-sheet-panel[data-state="open"]');
    // The accent resolves where the page accent is set; declared on :root alone it froze to magenta.
    expect(css).toMatch(/:root,\n\[data-accent\] \{\n  --d2-accent: rgb\(var\(--de-accent-rgb\)\);\n  --d2-accent-ink: rgb\(var\(--de-accent-ink-rgb\)\);/);
    expect(css.slice(css.indexOf(":root {"), css.indexOf("}", css.indexOf(":root {")))).not.toContain("--d2-accent");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("html[data-de-store-bar] .de-site-canvas");
    expect(css).toContain("html.de-store-jelly .d2-tile[data-de-just-selected");
    expect(css).not.toMatch(/data-de-jelly="feature"/);
  });

  it("sits the expanded profile on a light grey panel mixed from the paper and graphite tokens", () => {
    // Joe, 2026-09-30: the form must separate from the black page. Inks are re-pointed so text clears 4.5:1 on the grey.
    const panel = block(".d2-profile-panel");
    expect(panel).toContain("--d2-panel-bg: color-mix(in srgb, var(--de-paper) 92%, var(--de-bg))");
    expect(panel).toContain("background: var(--d2-panel-bg)");
    expect(panel).toContain("--d2-ink-strong: var(--de-bg)");
    expect(panel).toContain("--d2-accent-ink: color-mix(in srgb, rgb(var(--de-accent-rgb)) 75%, var(--de-bg))");
    expect(block(".d2-profile-panel .d2-input")).toContain("background: var(--de-paper-raised)");
    expect(css).toMatch(/\.d2-profile-panel \.d2-tile:has\(input:focus-visible\) \{\n  outline-color: var\(--de-magenta\);/);
    expect(css).toMatch(/@media print \{[\s\S]*\.d2-profile-panel \{\n    background: #fff !important;/);
    const form = readFileSync(path.join(root, "client/src/components/store/SolutionProfileForm.tsx"), "utf8");
    expect(form).toContain('data-state="expanded"\n      className="d2-profile-panel"');
  });
});
