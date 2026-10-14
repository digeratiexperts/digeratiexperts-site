import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The live homepage hero on phones (PR 499, Joe, 2026-10-06: "why is it like
 * this"), as PR 505 left it. Guards for what a restyle could quietly undo:
 *
 * - the eyebrow "Arizona MSP · Cybersecurity & Managed IT" is a flex row, so
 *   a block second line became a squeezed second column; on phones it wraps
 *   onto its own line under "Arizona MSP", past the 24px rule and 12px gap;
 * - below 1180px there is no full-width photo plate behind the headline (it
 *   cropped to one blown-up grey tile with a light streak through the buttons);
 * - PR 505 removed the hero image at every width, including the phone frame
 *   PR 499 hung on the card's ::before, so nothing paints behind the card.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "01-hero.css"), "utf8");
const tsx = readFileSync(resolve(here, "01-hero.tsx"), "utf8");
const baseCss = readFileSync(resolve(here, "../v9.css"), "utf8");

/** Body of every `@media (max-width: Npx) { ... }` block, joined. */
function mediaBody(maxWidth: number): string {
  const head = `@media (max-width: ${maxWidth}px) {`;
  const bodies: string[] = [];
  let from = 0;
  for (let at = css.indexOf(head, from); at !== -1; at = css.indexOf(head, from)) {
    let depth = 0;
    let i = at + head.length - 1;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    bodies.push(css.slice(at + head.length, i));
    from = i;
  }
  return bodies.join("\n");
}

const phone = mediaBody(639);
const stacked = mediaBody(1179);

describe("homepage hero on phones (PR 499)", () => {
  it("marks the eyebrow's second line and separator so phones can restack them", () => {
    expect(tsx).toMatch(
      /<p className="v9-eyebrow">\s*Arizona MSP<span className="sep"> · <\/span>\s*<span className="l2">Cybersecurity &amp; Managed IT<\/span>/,
    );
  });

  it("wraps the second line onto its own row, aligned after the rule, instead of a second column", () => {
    expect(baseCss).toMatch(/\.v9 \.v9-eyebrow \{ display: flex; align-items: center; gap: 12px; \}/);
    expect(baseCss).toMatch(/\.v9 \.v9-eyebrow::before \{[^}]*width: 24px;/);
    expect(phone).toContain(".v9 .v9s-01 .hero .v9-eyebrow .sep { display: none; }");
    expect(phone).toMatch(/\.v9 \.v9s-01 \.hero \.v9-eyebrow \{[^}]*flex-wrap: wrap;/);
    expect(phone).toMatch(/\.v9 \.v9s-01 \.hero \.v9-eyebrow \.l2 \{[^}]*flex-basis: 100%;[^}]*padding-left: 36px;/);
    // The rule that caused the squeezed column must not come back.
    expect(phone).not.toMatch(/\.l2 \{[^}]*display: block/);
  });

  it("paints no photo behind the headline or the card", () => {
    expect(css).not.toMatch(/hero__plate/);
    expect(css).not.toMatch(/--hero-plate/);
    expect(tsx).not.toMatch(/--hero-plate/);
    expect(tsx).not.toMatch(/home-managed-core/);
    expect(phone).toContain(".v9 .v9s-01 .win::before { display: none; }");
    expect(phone).toContain(".v9 .v9s-01 .win::after { display: none; }");
  });

  it("stacks to one column below 1180px with the card capped, so the headline is not crowded", () => {
    expect(stacked).toMatch(/\.v9 \.v9s-01 \.hero__body \{ grid-template-columns: minmax\(0, 1fr\);/);
    expect(stacked).toContain(".v9 .v9s-01 .win { max-width: 680px; }");
  });
});
