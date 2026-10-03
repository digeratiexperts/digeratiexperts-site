/**
 * Ask DE text box suggestions (Joe, 2026-10-03: "like how Suno mobile has in
 * the user text box suggestions of what they might say, do that for DE").
 *
 * While the Ask DE box is empty, examples of what a visitor might type rise
 * into it one at a time, in place of the static placeholder. The examples are
 * page-aware and worded the way people write to a help desk; the starter chips
 * above the box stay the tap-to-ask path.
 *
 * Rules, kept free of React so they can be tested as behaviour:
 * - only on the Ask DE tab, before the visitor has said anything, with nobody
 *   live in the chat, nothing in the box and no reply on its way;
 * - they start once the greeting has finished typing. On a first visit they
 *   run inside the gold text box hint, in gold: the hint says "type here", the
 *   examples say what. The full-screen hint waits for the pass to end
 *   (ZohoASAPWidget feeds it composerHintShowing), so the header and the box
 *   never animate together;
 * - finite: a pass shows each example once, then the plain placeholder comes
 *   back. One pass starts by itself; focusing or clicking the empty box can
 *   start another, up to DESK_SUGGEST_MAX_PASSES per page load;
 * - none under reduced motion: the plain placeholder stays.
 *
 * The rotating text is decoration (aria-hidden). Assistive tech keeps the
 * textarea's own stable placeholder and label.
 */

import type { DeskMotionPage } from "@/lib/deskAskDeMotion";

/** One example's full cycle: rise in, hold, rise out (matches the CSS keyframes). */
export const DESK_SUGGEST_CYCLE_MS = 3600;
export const DESK_SUGGEST_MAX_PASSES = 3;
/** Fits one line of the box at 390px without truncation. */
export const DESK_SUGGEST_MAX_CHARS = 36;

const GENERAL = [
  "My Outlook keeps logging me out",
  "A phishing email got through",
  "Is our backup actually restorable?",
  "Our Wi-Fi drops every afternoon",
  "New laptop setup for a new hire",
];

export const DESK_COMPOSER_SUGGESTIONS: Record<DeskMotionPage, string[]> = {
  home: GENERAL,
  other: GENERAL,
  support: [
    "My Outlook keeps logging me out",
    "I can't sign in to the portal",
    "The printer stopped working",
    "I need a new user set up",
  ],
  pricing: [
    "What would 25 users run us?",
    "Office or Business tier for us?",
    "Is security in every tier?",
    "Can we keep our own IT person?",
  ],
  compliance: [
    "What's in a HIPAA risk assessment?",
    "Our cyber insurance form is due",
    "Do we need a BAA with DE?",
    "CMMC Level 1 or Level 2?",
  ],
  // Door 2: nothing that invites a price (the Desk does not price solutions).
  store: [
    "Standalone or Co-Managed for us?",
    "Which need covers email security?",
    "What happens after I send this?",
    "Can an engineer review my build?",
  ],
  cybersecurity: [
    "Someone clicked a bad link",
    "Do we need MFA on every app?",
    "How do we stop ransomware?",
    "Can someone spoof our email?",
  ],
};

export function composerSuggestionsForPage(page: DeskMotionPage): string[] {
  return DESK_COMPOSER_SUGGESTIONS[page] ?? GENERAL;
}

/** Whether suggestions may show in the box right now. */
export function composerSuggestionsAllowed(input: {
  isOpen: boolean;
  onAskDe: boolean;
  visitorHasSpoken: boolean;
  agentLive: boolean;
  hasText: boolean;
  sending: boolean;
  greetingComplete: boolean;
  expandHintShowing: boolean;
  reducedMotion: boolean;
}): boolean {
  if (!input.isOpen || !input.onAskDe || input.reducedMotion) return false;
  if (input.visitorHasSpoken || input.agentLive || input.hasText || input.sending) return false;
  return input.greetingComplete && !input.expandHintShowing;
}

/** The example after `index` in this pass, or null when the pass is over. */
export function nextSuggestionIndex(index: number, count: number): number | null {
  return index + 1 < count ? index + 1 : null;
}
