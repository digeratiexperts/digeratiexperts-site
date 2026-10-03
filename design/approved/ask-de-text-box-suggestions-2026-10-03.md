# Ask DE text box suggestions — 3 Oct 2026

**Tier 3 record**: what Joe asked for, what changed, and why. The rule this
produced lives in `.cursor/skills/de-desk-ui/tokens-and-structure.md` (composer).

**Status:** built at Joe's request. **Pending Joe's review of the motion** before
merge.

## Ask

> Like how Suno mobile has in the user text box suggestions of what they might
> say, do that for DE and try to match their effect if you can look up exactly
> what I'm talking about.

## What could be confirmed about Suno

Suno's pages, help center and app listing could not be opened from the build
environment (the egress proxy blocks them). Web-search summaries of them confirm
three things:

- a dice button that fills the box with a random prompt;
- "Surprise me" in the iOS app;
- an "Inspiration" area of genre and mood tags.

No source describes how the text in Suno's box moves. So the effect below is a
common pattern for rotating placeholders, **not a verified copy of Suno**. A 5 to
10 second screen recording of Suno's Create box (empty, then tapped) would let
the timing and motion be matched frame by frame.

## What changed

- **Examples.** While the Ask DE box is empty, it shows examples of what a
  visitor might type, one at a time, in place of the static placeholder.
  - They are page-aware (home, support, pricing, compliance, public Store,
    cybersecurity) and written the way people write to a help desk.
  - They live in `client/src/lib/deskComposerSuggestions.ts`.
- **Motion.** Each example rises about 0.6em into place while a 4px blur clears
  (about 430ms, ease-out), holds, then rises out as the next comes in. One cycle
  is 3.6s, from a single keyframe set.
- **Colour.** Gold inside the first-visit text box hint, so the hint says "type
  here" and the examples say what. `--desk-ink-dim` after the hint.
- **When it runs.**
  - One pass of each example starts when the greeting has typed. Focusing or
    clicking the empty box starts another, up to three per page load. After a
    pass, "Type the issue…" comes back.
  - Typing, a live agent, a reply on its way or leaving the tab ends a pass at
    once.
  - The full-screen hint waits for the pass, so header and box never animate
    together.
- **Accessibility.** The examples are decoration (`aria-hidden`). The textarea
  keeps its label and its "Type the issue…" placeholder for assistive tech.
  Reduced motion shows no examples.
- **Starter chips.** The chips above the box stay the tap-to-ask path, and the
  examples never repeat them. On the public Store no example invites a price
  question (the Desk does not price solutions).

## Evidence

All captures are in `artifacts/visual-qa/desk-composer-suggestions/`.

- `before/`: production on 3 Oct 2026, at 390 and 1440. The box shows only
  "Type the issue…".
- `after/`: this branch on the Vite dev server, at 390 and 1440.
  - Clips: `390-desk-suggestions.mp4` (full screen) and
    `1440-desk-suggestions.mp4` (the Desk).
  - Stills: steady, mid-transition and typing.
  - `report.json` records:
    - the first example at about 3.1s (390) and 3.6s (1440) after the Desk
      opens;
    - all five examples seen, in order;
    - the box's own placeholder transparent while an example shows;
    - "Type the issue…" back after the pass;
    - focus restarting a pass, and typing ending it;
    - no examples under reduced motion;
    - no page errors.
