import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DESK_PAGE_COPY } from "./deskAskDeMotion";
import {
  composerSuggestionsAllowed,
  composerSuggestionsForPage,
  DESK_COMPOSER_SUGGESTIONS,
  DESK_SUGGEST_CYCLE_MS,
  DESK_SUGGEST_MAX_CHARS,
  nextSuggestionIndex,
} from "./deskComposerSuggestions";

const ready = {
  isOpen: true,
  onAskDe: true,
  visitorHasSpoken: false,
  agentLive: false,
  hasText: false,
  sending: false,
  greetingComplete: true,
  expandHintShowing: false,
  reducedMotion: false,
};

describe("Ask DE text box suggestions", () => {
  it("has examples for every Desk page, each short enough for one line at 390px", () => {
    for (const page of Object.keys(DESK_PAGE_COPY) as (keyof typeof DESK_PAGE_COPY)[]) {
      const examples = composerSuggestionsForPage(page);
      expect(examples.length).toBeGreaterThanOrEqual(3);
      for (const example of examples) expect(example.length).toBeLessThanOrEqual(DESK_SUGGEST_MAX_CHARS);
    }
  });

  it("does not repeat the starter chips shown above the box", () => {
    for (const [page, examples] of Object.entries(DESK_COMPOSER_SUGGESTIONS)) {
      const chips = DESK_PAGE_COPY[page as keyof typeof DESK_PAGE_COPY].chips.map((chip) => chip.label.toLowerCase());
      for (const example of examples) expect(chips).not.toContain(example.toLowerCase());
    }
  });

  it("never invites a price question on the public Store", () => {
    for (const example of composerSuggestionsForPage("store")) expect(example).not.toMatch(/cost|price|run us|\$/i);
  });

  it("shows only in an empty Ask DE box, before the visitor has spoken, with nobody live", () => {
    expect(composerSuggestionsAllowed(ready)).toBe(true);
    for (const blocker of [
      { isOpen: false },
      { onAskDe: false },
      { visitorHasSpoken: true },
      { agentLive: true },
      { hasText: true },
      { sending: true },
    ]) {
      expect(composerSuggestionsAllowed({ ...ready, ...blocker })).toBe(false);
    }
  });

  it("waits for the greeting, and never runs while the full-screen hint plays", () => {
    expect(composerSuggestionsAllowed({ ...ready, greetingComplete: false })).toBe(false);
    expect(composerSuggestionsAllowed({ ...ready, expandHintShowing: true })).toBe(false);
  });

  it("stays off under reduced motion", () => {
    expect(composerSuggestionsAllowed({ ...ready, reducedMotion: true })).toBe(false);
  });

  it("is finite: a pass shows each example once, then ends", () => {
    const seen = [0];
    let index: number | null = 0;
    while ((index = nextSuggestionIndex(index, 4)) !== null) seen.push(index);
    expect(seen).toEqual([0, 1, 2, 3]);
  });
});

describe("Ask DE text box suggestions in the Desk", () => {
  const widget = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../components/ZohoASAPWidget.tsx"),
    "utf8",
  );

  it("is decoration: hidden from assistive tech, while the textarea keeps its own placeholder and label", () => {
    const span = widget.match(/<span[^>]*className="de-desk-composer-suggest"[\s\S]*?>/)?.[0] ?? "";
    expect(span).toContain('aria-hidden="true"');
    expect(widget).toContain('aria-label="Ask DE message"');
    expect(widget).toMatch(/: "Type the issue…"/);
  });

  it("makes the full-screen hint wait for a pass, and turns gold inside the text box hint", () => {
    expect(widget).toMatch(/composerHintShowing: composerHint \|\| suggestIndex !== null,/);
    expect(widget).toContain(".de-desk-composer.is-hinting .de-desk-composer-suggest { color: var(--desk-gold-ink); }");
    // The hint's gold placeholder must not show through under a suggestion.
    expect(widget).toMatch(/\.de-desk-composer\.is-hinting\.is-suggesting textarea::placeholder \{ color: transparent; \}/);
    expect(widget).toMatch(/onFocus=\{startSuggestionPass\}\s*onClick=\{startSuggestionPass\}/);
  });

  it("rises in and out on the same cycle the timer uses, and has no motion under reduced motion", () => {
    expect(widget).toContain("animation: de-desk-suggest-cycle ${DESK_SUGGEST_CYCLE_MS}ms");
    expect(DESK_SUGGEST_CYCLE_MS).toBeGreaterThanOrEqual(3000);
    expect(widget).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.de-desk-composer-suggest \{ display: none; \}/);
  });
});
