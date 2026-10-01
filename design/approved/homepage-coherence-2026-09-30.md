# Homepage coherence pass — 30 Sep 2026

**Tier 3 record.** What Joe asked for, what changed, and why. The rules it
produced live in `design/UI-STYLE-RULES.md` §5–6 (Tier 2).

## Why

Joe, 2026-09-30, on the live homepage: "This has all the right things but
looks like a fucking mess. Then the white when you scroll down looks like a
mess too, then the rest of the sections look like they are from 4 different
websites." He also asked for the second (on-page) menu to take a different
colour with effects "that are not annoying but make it act more dynamic and
controlled", and sent a reference mockup as the quality target.

Diagnosis from the rendered page (1440 / 768 / 390), not the source:

- **Four container systems on one page.** Rounded paper islands, rounded
  graphite style boxes, full-bleed dark chapters and full-bleed loud bands,
  in no order. Every chapter had its own left edge and its own padding.
- **Five heading kits.** Tracked eyebrow + left title; centred title with a
  badge pill; centred title with a colon; pill eyebrow with an icon and a
  pulsing dot; gradient word, magenta word or plain.
- **Five card recipes.** Gradient graphite cards, white cards with pink top
  bars on dark, image tiles, bordered city boxes, shadowed FAQ rows.
- **Dead field.** Every nav chapter was stretched to one viewport
  (`.scroll-snap-chapter { min-height: 100svh }`), so short chapters (stats,
  industries) ended in 300–400px of empty black.
- **A tall, crowded hero.** Seven stacked elements in the copy column, the
  full dictionary card, the assessment preview sitting 200px lower than the
  headline, and a violet grid on top of the city plate.

## What changed (Maintenance Mode; content, routes, CTAs, forms, JSON-LD and
test ids preserved)

- **One chapter primitive** — `client/src/components/home/HomeChapter.tsx`:
  `HomeChapter` (full-bleed well / surface / paper field, hairline seam, one
  padding rhythm), `HomeContainer` (the hero's canvas and gutters, so every
  heading sits on the hero's left edge), `HomeChapterHeader` (dash eyebrow →
  title → lede + link, split across two columns at lg like the reference),
  and the card / button / index recipes. All 19 production sections compose
  from it; `client/src/lib/homepageFields.test.ts` locks that.
- **Field rhythm** — well ↔ surface ↔ paper, full-bleed, no islands: hero →
  paper trust strip → why we exist (well) → stats (surface) → problems
  (paper) → services (well) → protect (paper) → how protection works
  (surface) → proof + trust surfaces (well) → trust photo (paper) → team
  (well) → industries (surface) → packages (well) → threats (surface) →
  detection (well) → assessment form + FAQ (paper) → compliance/newsletter
  (well) → closing assessment band (surface) → contact (well) → footer.
- **Chapters take their natural height.** The one-viewport stretch is gone;
  snap targets keep only the chrome offset.
- **Hero** — copy column tightened (eyebrow, H1, lede, CTAs, one reassurance
  row with icons, one positioning line), the assessment preview top-aligned
  with the headline, the violet grid removed, the city plate legible on the
  right, and the pronunciation card in a new `compact` variant (same controls
  and test ids; the "commonly heard" line and per-chip hints stay in the
  `full` variant used elsewhere). Trust strip is one paper row.
- **On-page section bar** — its own raised graphite field (`#151217`) under
  the black nav, a spring-damped marker that glides between chapters
  (`layoutId`, instant under reduced motion), a scroll-linked progress
  hairline, and an `01 / 06` chapter counter. Nothing loops or pulses.
- **Truth fixes found on the way** — the pulsing dot on the team eyebrow and
  the pulsing emerald "SOC operations" badge are gone (no fake pulses, Tier
  0); the "Always-On Telemetry" caption line is reduced to "Arizona-based ·
  Principal-led"; the red "24/7 Security Response Team" badge above the
  threat feed is replaced by the "Threat intelligence" eyebrow.

- **Reconciled with main, 2026-10-01** — PR 306 (Joe's 390px protection-deck
  mock) landed meanwhile. Its phone layout wants one dark field below `md`,
  so the Protect chapter is paper from `md` up and drops to the well below
  it; the island class it used is gone with the island mechanism. The
  self-hosted fonts (PR 301) added ~1.5 kB to the entry stylesheet, so the
  chapter recipes were re-pointed at existing token classes (`bg-de-raised`,
  `border-de-hairline`, `from-de-surface`) and a few one-off values folded
  into neighbours; the sheet sits at 298.8 / 300 kB.

## Evidence

`artifacts/visual-qa/homepage-coherence/` — full-page renders at 1440, 768
and 390 after the pass.

## Still open for Joe

- The page carries three assessment forms (mid-page lead form, closing band,
  contact). They are all kept; consolidating them is a content decision.
- The dictionary card's compact variant drops the "commonly heard" line from
  the hero; say the word and it comes back.
