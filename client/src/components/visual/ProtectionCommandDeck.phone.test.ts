import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The phone layout of the protection deck (Joe's 390px mock, 2026-10-01).
 * Vitest runs in a node environment here, so this reads the source and the
 * data rather than rendering: the row has to fit, the continuous block has
 * to be the rail and not a ninth chip, the reading order has to be plain,
 * and the bottom of the block has to stay clear of the Ask DE launcher.
 */

const deckPath = resolve(__dirname, "ProtectionCommandDeck.tsx");
const deckSource = readFileSync(deckPath, "utf8");
const sectionSource = readFileSync(resolve(__dirname, "../../pages/sections/DigeratiHowWeProtectSection.tsx"), "utf8");

function phoneBlock(): string {
  const start = deckSource.indexOf('data-testid="protection-deck-phone"');
  const end = deckSource.indexOf('<div className="hidden md:block">');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return deckSource.slice(start, end);
}

/** Pull the phoneLabel values straight from the data block, in order. */
function phoneLabels(): { id: string; label: string; continuous: boolean }[] {
  const out: { id: string; label: string; continuous: boolean }[] = [];
  const re = /id: "([a-z]+)",[\s\S]*?phoneLabel: "([^"]+)",[\s\S]*?answers: "[^"]+",(\s*continuous: true,)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(deckSource))) out.push({ id: m[1], label: m[2], continuous: Boolean(m[3]) });
  return out;
}

describe("ProtectionCommandDeck phone layout", () => {
  it("has eight blocks: seven peers on the row and exactly one continuous block as the rail", () => {
    const labels = phoneLabels();
    expect(labels).toHaveLength(8);
    expect(labels.filter((l) => l.continuous).map((l) => l.id)).toEqual(["exposure"]);
    expect(labels.find((l) => l.continuous)?.label).toBe("Risk & exposure");
  });

  it("keeps the seven row labels short enough to share one 358px line", () => {
    // Measured in Chromium at 390px with Inter 11.5px medium: the seven labels
    // end at x=374 with 4px gaps. Nine characters is the longest that fits.
    for (const l of phoneLabels().filter((l) => !l.continuous)) {
      expect(l.label.length, l.label).toBeLessThanOrEqual(9);
      expect(l.label).not.toMatch(/&/);
    }
  });

  it("renders the phone layout below md and the framed desktop layout from md up", () => {
    expect(deckSource).toContain('<div className="md:hidden" data-testid="protection-deck-phone">');
    expect(deckSource).toContain('<div className="hidden md:block">');
    expect(deckSource.indexOf('data-testid="protection-deck-phone"')).toBeLessThan(deckSource.indexOf("<EvidenceFrame"));
  });

  it("marks the continuous block as a rail under the row, not a ninth tab chip", () => {
    const block = phoneBlock();
    expect(block).toContain("peerDomains.map(");
    expect(block).toContain('data-continuous="true"');
    expect(block).toContain("Continuous · under all seven");
    expect(block).toContain("border-dashed");
  });

  it("reads plainly: no boxed questions label, no nested card, no diagram widget", () => {
    const block = phoneBlock();
    expect(block).not.toContain("Questions the assessment should answer");
    expect(block).not.toContain("SecurityBoundary");
    expect(block).not.toContain("DiagramNode");
    expect(block).not.toContain("ControlGate");
    expect(block).not.toContain("EvidenceFrame");
    expect(block).not.toMatch(/rounded-(lg|xl|2xl) border[^"]*bg-(white|de-raised)/);
    // The boundary is a definition list, and the questions a plain list.
    expect(block).toContain("<dl");
    expect(block).toContain('aria-label="What an assessment asks"');
    expect(block).toContain("Seven blocks each answer a threat class, and risk and exposure runs under all of them.");
  });

  it("keeps 96px empty above the dock and its gap, so the Ask DE launcher and nudge never sit on the type at rest", () => {
    // Measured at 390x844 with the block's end at the viewport bottom: the dock
    // tops out at y=778 and the "Stuck on something" nudge stacks above it from
    // y=685. A flat 96px reserve (pb-24) ended the last line at 748, under the
    // nudge. 96px above the dock and its 0.75rem gap ends it at 682, clear of
    // both; the safe-area inset keeps that true under an iPhone home indicator.
    expect(phoneBlock()).toContain(
      'paddingBottom: "calc(96px + var(--de-unified-bar-h, 3.5rem) + 0.75rem + env(safe-area-inset-bottom, 0px))"',
    );
    expect(phoneBlock()).not.toMatch(/<article className="[^"]*\bpb-24\b/);
  });

  it("holds one accent only: magenta, no purple fills", () => {
    const block = phoneBlock();
    const hexes = Array.from(new Set(block.match(/#[0-9A-Fa-f]{6}/g) ?? []));
    expect(hexes.sort()).toEqual(["#050312", "#D3126A", "#F04C97"]);
  });

  it("puts the section on the dark field below md and on the paper chapter from md up", () => {
    // The homepage chapter grammar (PR 298) replaced the paper island with a
    // full-bleed paper chapter; below md the chapter drops to the well so the
    // phone deck sits on one dark field, as the mock has it.
    expect(sectionSource).toContain('<HomeChapter tone="paper" className="max-md:border-[var(--de-hairline)] max-md:bg-[var(--de-bg)] max-md:text-white">');
    expect(sectionSource).toContain("text-white sm:text-3xl md:text-4xl md:text-[#1A1228]");
    expect(sectionSource).toContain("text-white/70 md:text-lg md:leading-relaxed md:text-[#3A3448]");
  });
});
