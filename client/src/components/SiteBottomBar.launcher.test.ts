import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The Ask DE launcher (Joe, 2026-10-03): "B on desktop, C on mobile, with the
 * same speech mark and gold tone throughout". Guards for what a restyle could
 * quietly undo. The browser smoke (scripts/desk-browser-smoke.mjs) checks the
 * rendered colours, sizes and focus ring.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, "SiteBottomBar.tsx"), "utf8");
const indexCss = readFileSync(resolve(here, "../index.css"), "utf8");

const constant = (name: string) => src.match(new RegExp(`const ${name} =\\s*"([^"]+)"`))?.[1] ?? "";
const alone = constant("ASK_DE_BADGE_ALONE");
const labelled = constant("ASK_DE_BADGE_LABELLED");
const launcherButton = src.match(/<button\s+ref=\{launcherRef\}[\s\S]*?data-testid="button-open-asap-widget"/)?.[0] ?? "";
const launcherBadge = src.match(/className=\{`de-ask-fab [^`]+`\}/)?.[0] ?? "";

describe("Ask DE badge", () => {
  it("is a solid gold disc with a dark mark when it stands alone", () => {
    expect(alone).toContain("bg-[#E3B23C]");
    expect(alone).toContain("text-[#0b0b0d]");
    expect(alone).not.toMatch(/\bsm:/);
  });

  it("is that disc on phones and a gold ring on charcoal with a white mark from sm up, where the label shows", () => {
    expect(labelled.startsWith(alone)).toBe(true);
    for (const cls of ["sm:border-[#E3B23C]", "sm:bg-[#0b0b0d]", "sm:text-[#f5f5f4]"]) {
      expect(labelled).toContain(cls);
    }
  });

  it("keeps the white mark white on hover: only the ring and a faint fill respond", () => {
    expect(labelled).toContain("sm:group-hover:border-[#EDBE4C]");
    expect(labelled).not.toMatch(/sm:group-hover:text-/);
  });

  it("is one treatment for the launcher and the chooser header", () => {
    expect(launcherBadge).toContain("${askDeBadgeClasses(compact)}");
    expect(src).toMatch(/className=\{`[^`]*\$\{askDeBadgeClasses\(compact\)\}`\}\s+data-testid="ask-de-chooser-badge"/);
    expect(src).not.toContain("border border-white/20 bg-white text-[#111116]");
  });

  it("pulses gold on a first visit, not magenta", () => {
    expect(src).toMatch(/\.de-ask-fab\.de-ask-fab--breathe::before \{[^}]*border: 2px solid rgba\(227, 178, 60, 0\.55\)/);
  });
});

describe("Ask DE launcher button", () => {
  it("draws one white focus ring that keeps the round shape", () => {
    expect(launcherButton).toContain("focus-visible:rounded-full");
    expect(launcherButton).toContain("focus-visible:ring-[#f5f5f4]");
    expect(launcherButton).toContain("focus-visible:outline-none");
    expect(launcherButton).not.toContain("ring-de-magenta-ink");
  });

  it("is a circle when there is no label (extra right padding only beside the label)", () => {
    expect(launcherButton).toMatch(/px-1\$\{compact \? "" : " sm:pr-1\.5"\}/);
  });
});

describe("Ask DE chooser", () => {
  it("names the chat choice so it does not read like Get Support", () => {
    expect(src).toContain('title: "Ask a Question"');
    expect(src).not.toContain('title: "Get Help"');
    expect(src).toContain('title: "Get Support"');
  });
});

describe("bottom chrome on phones", () => {
  it("sits on the page's 20px side margin, not in the corner", () => {
    const phones = indexCss.match(/@media \(max-width: 639px\) \{[\s\S]*?\n\}/)?.[0] ?? "";
    expect(phones).toMatch(/:root \{\s*--de-chrome-inset: 1\.25rem;\s*\}/);
    expect(indexCss).toMatch(/--de-chrome-inset: 0\.75rem;/);
  });
});
