---
name: premium-web-design
description: Apple/monday.com-grade premium design discipline for web work - when Joe asks for "premium", "simple", "Apple", "monday", "x.ai-style" surfaces, quality-gated concept passes, or when a rendered page reads as "not premium" (flat text-only cards, melody-grey comps, equal grids). Encodes the masterclass rules Joe approved 2026-10-18/19 plus the DE verification pipeline.
---

# Premium web design - the DE masterclass rules

Purpose: turn "make it premium" from taste into a repeatable, evidence-gated loop.
Provenance: rules distilled from the Apple-discipline masterclass Joe adopted for
the 2026-10 homepage exploration (`/concepts/home-chapters`), validated in
merged PRs #632-#649. Original to this repo; no external upstream. Tier 0/1 of
`design/DESIGN-AUTHORITY.md` always override anything here.

## The ten rules (Joe's masterclass, applied)

1. **Dark-first base, with an Apple-style light/dark toggle.** Default ground is charcoal
   `#0a0a0a` with white cards (`#1a1a1c`) and a single magenta accent - the
   ChatGPT/Grok/x.ai register. Light mode flips to `#fafafa` ground / `#ffffff`
   cards / charcoal text and is reachable via a manual toggle (system preference
   is the default, persisted). One dark stage per page still reserves the single
   most important argument. The toggle is a real element, not a CSS-only
   afterthought: persist to localStorage, read system pref on first paint, no FOUC.
2. **One accent, used like a scalpel.** One saturated accent (DE: magenta
   `#D3126A`) for primary actions only. Buttons are pills, >=56px tall, 150ms
   color transitions - no gradients on buttons, no washes on hover.
3. **Movie-poster hero, not a banner.** The hero is a title card: massive negative
   space, one enormous display headline (clamp ~3rem-6.5rem, tracking -0.045em,
   line-height ~0.96), split field (charcoal over parchment) with a real image
   crossing the seam. Real person > real artifact > environment plate. The hero
   shows the product once: one authentic UI shot, never a screenshot zoo.
4. **Bento, never equal grids.** Card layouts are sized by importance - one 2x2
   "hero card" for the biggest idea, supporting cards in measured asymmetry.
   Identical repeated tiles communicate nothing; do not ship
   `grid-template-columns: repeat(3, 1fr)` for a message-first section.
5. **An object in every card.** A text-only card is the signature of "not
   premium". Each card carries one monochrome 3D object (matte charcoal body +
   one cream-white accent part, soft contact shadow, white ground, no text /
   logos / faces / screens) or the real artifact. Situate it in the card's own
   flow at the top, ~84-108px tall (hero-sized cards: 2-3x that). Fighting
   absolute positioning against padding stacks loses every time - put the object
   in flow and let spacing rules follow it. Generated objects spend money ->
   budget boundary below.
6. **Glass once, and once only.** Exactly one translucent fold: a sticky
   chapter/top nav (`backdrop-filter: saturate(180%) blur(14px)` over a
   translucent ground). No glass cards, panels, tiles, chips.
7. **Three motion speeds, no more.** Controls 150ms; panels/hover 320ms;
   imagery/parallax/mood 900ms. One easing family (`cubic-bezier(.2,.7,.2,1)`).
   Everything honors `prefers-reduced-motion`. No scroll choreographies beyond
   opacity/rise of key points; motion directs, never decorates.
8. **Type is the interface.** Display face for headlines only (DE: Space Grotesk
   600); body in Inter 15-17px, `#4a4a4f` on light. Eyebrows and metadata are
   plain sentence case (no letterspaced all-caps). Numbers carry the stats -
   not icon salad.
9. **One dark stage per page.** Reserve it for the single most important
   argument: warm-white text, dark translucency only on genuine dark
   (`rgba(255,255,255,0.04)`) - never over pale ground, which axe reads as
   white-on-#fafafa. Scope dark-stage overrides with selectors that actually
   match the rendered classes.
10. **Ship on a quality gate, not on hope.** Score /50 across: (1) hierarchy and
    ensemble, (2) theme discipline, (3) object/artifact consistency, (4) motion
    discipline, (5) contrast + a11y, (6) responsive operability, (7) content
    preservation, (8) truth rules, (9) performance, (10) code discipline. Target
    >=45; anything under 4 in a category gets a repair pass or a named reason in
    the evidence README.

## Tier-0 gates this skill never relaxes
axe-core **0 violations** at 390 and 1440; **0px horizontal overflow** at
390/768/1440; content preservation (every section, form, feed and link survives
the retheme - reuse the live section components and re-point tokens instead of
rewriting content blocks); truth rules (`design/IMAGERY.md` - generated imagery
is ILLUSTRATIVE and labelled; never fabricate clients, metrics, testimonies);
concept routes stay non-production until Joe explicitly promotes one to `/`.

## Known failure patterns (2026-10 exploration backlog)
- A scoped override like `#protection.v8 :is(...)` quietly matches nothing when
  the section never carries `.v8` - a whole visual pass can be dead code while
  screenshots still "look mostly right". Validate with `el.matches(sel)`.
- Hardcoded live-section colors authored for a dark band (e.g. white phone
  links) resurface as axe contrast violations after a light retheme.
- Decorative accent rules from the production theme (heading underlines) bleed
  into light concept sections; suppress `::before/::after` decorations
  deliberately.

## Verification pipeline (reuse these scripts)
- `<scratch>\concept-shots\capture.mjs <url> <prefix>` - full-page + per-section
  PNGs at 390/768/1440; prints overflow px + page errors. Read the PNGs; never
  judge UI from source code alone.
- `<scratch>\concept-shots\axe-concepts.mjs` (+ `-detail`, `-detail-390`) -
  failing selectors with computed colors; run after every theme change.
- `inspect*.mjs` pattern in the same folder - computed-style sweeps for rules
  that silently lose; check `el.matches(selector)` in-page before assuming a
  specificity fight.
- Stash-verify: before ruling tests "pre-existing", stash your work and re-run
  the failing suite; quote both runs in the PR.
- Save evidence to `artifacts/visual-qa/<name>-<date>/` with a README
  (scorecard + approvals + budget), then PR with concurrency report and the
  approval quote; thread evidence shots as you iterate (v6a, v6b, ...).

## kie.ai spend boundary
Generated card objects/plates run through `.claude/kie-budget/`:
`budget.mjs open --job <name> --model <model> --count N`, then
`$env:KIE_JOB = "<name>"` before `kie.mjs still ... --approved "Joe, <date>" --cap 15`.
Standing caps quoted in-session (e.g. Joe 2026-10-19: "$20" job window, month
soft "$25" in limits.json) - never print keys, cite the approval and job name in
the PR body. **Asset rule (Joe, 2026-10-19):** only generate kie.ai assets that have a real
purpose in the design (one object per card that carries meaning, one plate per
stage that carries mood) - never batch-generate filler. But where an asset earns
its place, spend freely within the approved cap; quality beats thrift. Record
every generation in the kie-budget ledger with the job name and approval quote.
