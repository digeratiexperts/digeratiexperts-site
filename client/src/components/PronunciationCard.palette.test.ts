import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), "PronunciationCard.tsx"),
  "utf8",
);

/**
 * Comments in the card deliberately quote the colour rule, gold hex included.
 * Palette assertions run against code only so documenting the rule can never
 * trip the check that enforces it.
 */
const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * design/UI-STYLE-RULES.md: "Gold #e7b20d is the wordmark bars only. Never a
 * CTA, numeral, or fill." An earlier draft of this card put gold on the play
 * button, the sense numeral, and the entry rail, and painted the panel on an
 * off-token navy. This card renders in the homepage hero (archetype A, magenta
 * CTAs), so these assertions lock the rule at the one place it was actually
 * broken rather than trusting review to catch it again.
 */
describe("pronunciation card palette", () => {
  const goldMatches = code.match(/#e7b20d/gi) ?? [];

  it("uses gold exactly once, as the wordmark bar fill", () => {
    expect(goldMatches).toHaveLength(1);
    expect(src).toContain('fill="#e7b20d"');
  });

  it("keeps gold off every button", () => {
    const buttons = code.match(/<button[\s\S]*?>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.filter((b) => /e7b20d/i.test(b))).toEqual([]);
  });

  it("fills the play button with the page accent token, not a hard-coded hue", () => {
    expect(src).toMatch(/background: "rgb\(var\(--de-accent-rgb\)\)"/);
  });

  it("paints no off-token dark ground", () => {
    // The system defines --de-bg / --de-surface / --de-raised; a literal panel
    // colour here would introduce a competing field.
    expect(code).not.toMatch(/#0a0e27|#111737|#0f0f1a|#0f0f0f/i);
    expect(src).toContain("bg-de-raised");
  });

  it("marks the stressed syllable with the accent, not gold", () => {
    expect(src).toContain("text-de-accent-ink");
    expect(src).toMatch(/borderBottom: "3px solid rgb\(var\(--de-accent-rgb\)\)"/);
  });
});

/**
 * The card is the answer to "nobody says our name right", so the respelling and
 * the stress position are the load-bearing content. Keep them in one place and
 * fail loudly if a refactor desyncs the chips from the spoken string.
 */
describe("pronunciation content", () => {
  it("speaks the same respelling it prints", () => {
    expect(src).toContain('const SPOKEN_PRONUNCIATION = "dij-uh-RAH-tee"');
    expect(src).toContain("{SPOKEN_PRONUNCIATION}");
  });

  it("stresses exactly one syllable, the third", () => {
    const stressed = code.match(/stressed: true/g) ?? [];
    expect(stressed).toHaveLength(1);
    expect(src).toMatch(/\{ label: "RAH", say: "rah", hint: "stress here", stressed: true \}/);
  });

  it("keeps an audio-file override ahead of speech synthesis", () => {
    expect(src).toMatch(/const AUDIO_SRC = /);
    expect(src).toContain("if (!AUDIO_SRC)");
  });

  /**
   * AUDIO_SRC failing over to synthesis is deliberate runtime behaviour, which
   * means a renamed or deleted asset degrades silently — the button still makes
   * a sound, just a different one on every device. Fail the build instead.
   */
  it("points AUDIO_SRC at an asset that actually ships", () => {
    const declared = code.match(/const AUDIO_SRC = "([^"]*)"/)?.[1];
    expect(declared, "AUDIO_SRC should name a file").toBeTruthy();
    expect(declared!.startsWith("/"), "AUDIO_SRC should be a site-absolute path").toBe(true);

    const asset = resolve(
      dirname(fileURLToPath(import.meta.url)),
      "../../public",
      declared!.replace(/^\//, ""),
    );
    expect(existsSync(asset), `missing pronunciation asset: ${asset}`).toBe(true);
    expect(statSync(asset).size).toBeGreaterThan(8_000);
  });

  it("stays usable when speech synthesis is missing", () => {
    expect(src).toContain('data-testid="pronunciation-audio-unsupported"');
    expect(src).toMatch(/role="status"\s+aria-live="polite"/);
  });
});
