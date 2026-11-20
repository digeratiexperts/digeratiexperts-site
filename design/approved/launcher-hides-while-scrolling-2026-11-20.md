# Bottom launcher steps aside while scrolling — 20 Nov 2026

**Tier 3 record.** What was asked, what changed, and the limits that keep it from
hiding something in use. Rule home: `design/UX_PRINCIPLES.md` (floating chrome
coordinates through shared CSS variables; this adds when it gets out of the way).

## Why

The fixed capsule (Ask DE, back-to-top, homepage chapter menu) is about 100px wide
on phones and sits over copy as it scrolls past. A side gutter big enough to clear
it would squeeze phone content to roughly 250px (tried on `/design-system` in
#1048 and backed out), so the page cannot make room for it. In chat on
2026-11-20 the request was: "hide the launcher while scrolling."

## What changed

- While the page is scrolling the capsule fades out; 700ms after it stops it comes
  back (`LAUNCHER_SCROLL_IDLE_MS`). Scroll movement under 6px is ignored.
- Opacity and visibility only (`index.css`, `html[data-de-launcher-scrolling]`),
  never `display` or `transform`: layout is unchanged, so `--de-unified-bar-h` stays
  right and nothing shifts when it returns. Out instantly, in with a 160ms fade
  (none under `prefers-reduced-motion`).
- Wired in `SiteBottomBar.tsx` with helpers in `lib/launcherScrollHide.ts`, so it
  applies wherever the bar renders.

## What it leaves alone (Tier 0: keyboard operability, no lost focus)

- The pointer is on the capsule: scrolling does not hide it, so the back-to-top
  click (which scrolls the page) is not interrupted.
- Keyboard focus is inside it: also excluded in CSS with `:not(:focus-within)`,
  because `visibility: hidden` removes an element from the tab order and a keyboard
  user scrolling with Space or the arrow keys would lose their place.
- The Desk or its chooser is open.

## Not changed

- The opt-in `autohide` (Joe, 2026-10-01; `useDockAutohide`) is a different rule:
  it tucks only the chapter dock and back-to-top and keeps the Ask DE button.
  It still works as before.
- The cookie banner, the sticky assessment bar (it already hides while scrolling)
  and the separate Ask DE nudge are untouched.
- Launcher styling is the gold ring/disc in `ask-de-launcher-gold-2026-10-03.md`.
