# Bottom bar autohide — integration spec

Joe, 2026-10-01: "upgrade the bar on the bottom with autohide features that are not annoying."

Prototype: `dock-prototype.html` (open it served from the repo root; `?hud` shows the state). Behaviour checks: `node capture.mjs` drives it with real wheel, pointer, keyboard and focus input and writes `BEHAVIOR-CHECKS.txt` and `frames/`. Storyboard: `storyboard-1440.png`.

## What stays exactly as live

`SiteBottomBar.tsx` + `HomepageSectionNav.tsx`: the charcoal glass capsule (`rgba(10,10,10,0.95)`, 24px blur), Protected? lead-in, the six dock chapters (Home · Why DE · How It Works · Industries · Packages · Contact) with the magenta active pill and its glowing dot, phone, Risk Assessment, back-to-top after 500px, the Ask DE launcher, its chooser and its nudge, the expand after 72px on desktop, the width tween, `inert` on the collapsed menu, the consent gate, the footer collapse, and every `data-testid`.

## What is added

| Rule | Value | Why it is not annoying |
|---|---|---|
| Tuck while reading down | 160px of continuous downward scroll, only once past the first viewport | Hysteresis; the opening screen never tucks |
| Tucked state | Chapter menu, phone, CTA and back-to-top leave; Ask DE stays as the 40px round button in the same corner | Nothing needed disappears; support is one tap away |
| Come back | 32px of upward scroll; pointer resting 120ms in the bottom 96px (fine pointers); Tab focus into the bar; the contact chapter / end of page | Any sign of intent, never a timer |
| Hold (never tuck) | Pointer over the bar; focus inside; Ask DE chooser open; 900ms after a chapter or back-to-top click; 1.2s after load | The bar never runs away from the person using it |
| Phone typing | While an input, textarea or select outside the bar has focus, the bar moves below the keyboard; returns on blur | No bar floating over the keyboard or the field |
| Read progress | 2px line inside the active chapter pill, from that chapter's top to the next dock chapter | Quiet orientation, no new chrome |
| Motion | `transform` + `opacity`, 240ms `cubic-bezier(.2,.8,.2,1)`; reduced motion = 120ms opacity only | No layout animation, no backdrop smear |
| Chrome contract | `--de-unified-bar-h` republished on every state change (tucked = the round button's height; typing = 0) | The nudge, cookie banner and Store cart keep clearing it (no overlapping chrome) |
| Performance | One passive scroll listener, rAF-throttled; one pointermove listener only while tucked on fine pointers | No jank |

## Where it goes in the app

- `client/src/components/HomepageSectionNav.tsx` → `useHomepageDockVisibility()` gains `tucked` (the state machine above) and the per-chapter progress value; `HomepageDockMenu` renders the progress line inside the active pill.
- `client/src/components/SiteBottomBar.tsx` → applies `tucked` (collapse to the Ask DE button, hide back-to-top), the hold signals (pointer, focus-within, chooser `showMenu`, jump clicks), the phone typing rule, and republishes `--de-unified-bar-h`.
- Tests: extend the existing bar tests with the fifteen behaviours in `BEHAVIOR-CHECKS.txt`.

Concurrency: `SiteBottomBar.tsx` appears in other agents' claims in `.ai/ACTIVE_WORK.yaml` (the Ask DE nudge offset and the Desk lane). The integration PR re-checks those claims first and touches only the visibility logic.
