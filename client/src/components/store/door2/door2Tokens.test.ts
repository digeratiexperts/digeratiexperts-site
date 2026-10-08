import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * One product (source of truth §14.28): the Store's step label, cell rule,
 * spacing and type scale carry V4's values. V4 lives on its own branch, so
 * the values are pinned here from V4Primitives.tsx (T and ChapterLabel).
 */
const root = path.resolve(import.meta.dirname, "../../../../..");

/** Source files may use CRLF on Windows; pin tests to LF so regexes stay stable. */
function readLf(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

const css = readLf(path.join(root, "client/src/styles/store-builder.css"));

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
    const form = readLf(path.join(root, "client/src/components/store/SolutionProfileForm.tsx"));
    expect(form).toContain('data-state="expanded"\n      className="d2-profile-panel"');
  });

  it("drops the count steppers under the number when the card is too narrow, so typed counts stay readable", () => {
    // Visual status 2026-10-08: on a 390px phone "25" showed as "2" behind the - / + buttons.
    expect(block(".d2-flag-config__form .d2-field")).toContain("container-type: inline-size");
    expect(css).toMatch(/@container \(max-width: 17rem\) \{\s*\.d2-dial \{\s*flex-wrap: wrap;[\s\S]*?\.d2-dial \.d2-input \{\s*flex-basis: 100%;/);
  });

  it("eases the count down on the narrowest phones so six digits still fit the card", () => {
    // Live check 2026-10-08: at 320px the card's content is ~97px and "999999" needs 116px at the base size.
    const narrow = css.match(/@container \(max-width: 17rem\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(narrow).toContain("font-size: min(clamp(2.2rem, 4vw, 3rem), 29cqi);");
    // The base size is the same clamp, so from 390px up nothing changes.
    expect(block(".d2-flag-config__form .d2-input")).toContain("font-size: clamp(2.2rem, 4vw, 3rem);");
  });

  it("draws numbered steps as stations: a check when ready, a white station and 'You are here' when current", () => {
    // Joe, 2026-10-01: concept B "Stations" — thick lines and clear done / current / ahead states.
    expect(block(".d2-journey__bar")).toContain("height: 6px");
    expect(block(".d2-journey__node")).toContain("width: 2.5rem");
    expect(css).toMatch(/\.d2-journey__step\[data-state="current"\] \.d2-journey__node \{[^}]*background: #fff;[^}]*animation: d2-beacon/);
    expect(block(".d2-step__n")).toContain("border-radius: 9999px");
    expect(css).toMatch(/\.d2-chapter--station\[data-step-state="current"\]:not\(\.d2-chapter--paper\) \{[^}]*border-left: 6px solid var\(--d2-accent\)/);
    expect(css).toMatch(/\.d2-layout \.d2-chapter--station::before \{[^}]*width: 6px;/);
    const rail = readFileSync(path.join(root, "client/src/components/store/door2/JourneyRail.tsx"), "utf8");
    expect(rail).toContain('state === "complete" ? <Check className="d2-journey__check"');
    expect(rail).toContain("aria-label={STORE_JOURNEY_SENTENCE}");
    const primitives = readFileSync(path.join(root, "client/src/components/store/door2/primitives.tsx"), "utf8");
    expect(primitives).toContain("You are here");
    expect(primitives).toContain('current: " · you are here"');
    const workspace = readFileSync(path.join(root, "client/src/pages/store/PublicStoreCheckout.tsx"), "utf8");
    for (const id of ["profile", "need", "relationship", "package", "delivery"]) {
      expect(workspace).toContain(`stepState={stepStateOf("${id}")}`);
    }
  });
});
