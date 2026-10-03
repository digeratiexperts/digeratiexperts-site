import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MAIN_CONTENT_FALLBACK_ID } from "@/components/SkipToContent";

/**
 * Guards for the /quote-wizard quiz room (issue 419). The behaviour itself is
 * walked in a real browser by scripts/qa/quote-wizard-quiz-check.mjs.
 */
const source = readFileSync(resolve(__dirname, "LeadQuoteWizard.tsx"), "utf8");

describe("quote wizard quiz room", () => {
  it(`keeps a focusable <main id="${MAIN_CONTENT_FALLBACK_ID}"> for the skip link`, () => {
    expect(source).toMatch(new RegExp(`<main\\s[^>]*id="${MAIN_CONTENT_FALLBACK_ID}"[^>]*tabIndex=\\{-1\\}`));
  });

  it("uses the pinned plan match, not a local copy", () => {
    expect(source).toContain("from '@/lib/quoteMatch'");
    expect(source).not.toMatch(/const getPlanMatch\s*=/);
  });

  it("posts to the same endpoint with the same source and hands off to the confirmation page", () => {
    expect(source).toContain("fetch('/api/lead-quote'");
    expect(source).toContain("source: 'header-instant-quote'");
    expect(source).toContain("sessionStorage.setItem('leadQuoteResult'");
    expect(source).toContain("setLocation('/quote-confirmation')");
  });

  it("points its canonical at the real route", () => {
    expect(source).toContain("canonical: '/quote-wizard'");
  });

  it("runs in its own thin chrome rather than the MegaMenu and footer", () => {
    expect(source).not.toContain("MegaMenu");
    expect(source).not.toContain("DigeratiEnhancedFooterSection");
    expect(source).toContain("<QuizRoomShell");
  });
});
