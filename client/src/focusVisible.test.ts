import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Keyboard focus must never change a control's shape (2026-10-03). The global
 * focus rules used to set `border-radius: 4px`, which beat Tailwind's rounded-*
 * utilities while a control had focus: 319 of 417 keyboard stops on the
 * homepage, Store and Contact snapped to 4px corners (pills, rounded buttons,
 * cards). A second, later `*:focus-visible` rule also drew a violet outline on
 * the elements the first rule did not reach.
 */

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "index.css"), "utf8");
const hero = readFileSync(resolve(here, "pages/sections/ReferenceHeroSection.tsx"), "utf8");

/** Top-level-or-nested rule bodies whose selector list contains `:focus-visible`. */
function focusRules(): Array<{ selector: string; body: string }> {
  const rules: Array<{ selector: string; body: string }> = [];
  const re = /([^{}]*:focus-visible[^{}]*)\{([^{}]*)\}/g;
  for (const m of css.matchAll(re)) rules.push({ selector: m[1].trim(), body: m[2] });
  return rules;
}

describe("global keyboard focus", () => {
  it("never sets a border-radius, so the outline follows each control's own corners", () => {
    const offenders = focusRules().filter((r) => /border-radius/.test(r.body)).map((r) => r.selector);
    expect(offenders).toEqual([]);
  });

  it("draws one outline colour: there is no second universal rule", () => {
    const universal = focusRules().filter((r) => /(^|,|\s)\*?:focus-visible$/.test(r.selector.split("\n").pop()!.trim()));
    // The base rule and the forced-colours (Highlight) rule; nothing else re-colours every element.
    expect(universal.map((r) => r.body.match(/outline:\s*([^;]+);/)?.[1]?.trim())).toEqual([
      "2px solid rgb(236, 72, 153)",
      "3px solid Highlight",
    ]);
  });

  it("keeps the hero's main button ring: its glow is a shadow class, not an inline box-shadow", () => {
    // An inline style={{ boxShadow }} replaced the Button's focus ring, so focus on the
    // site's primary call to action was invisible.
    const button = hero.match(/<Button[\s\S]*?data-testid="button-hero-schedule"/)?.[0] ?? "";
    expect(button).not.toMatch(/style=\{\{\s*boxShadow/);
    expect(button).toContain("shadow-[0_14px_36px_-18px_rgba(111,92,255,0.9)]");
  });
});
