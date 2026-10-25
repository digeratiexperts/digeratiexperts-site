# Homepage scene story and Signal Thread plates — Oct 2026

**Scope of this approval:** the noindex preview pages `/version-9` and `/version-10` (2026-10-14), and four scene-story frames on the live homepage `/` (Homepage v2, 2026-10-25). Not approved for any other public page; that needs its own decision from Joe.

**Homepage v2 extension (2026-10-25):** Joe reviewed the before/after screenshots of PR #837 (`artifacts/visual-qa/home-v2-scene-story/compare-*.jpg`) and said "Merge". Approved on `/`: `2-exposure` behind #stats, `3-gaps` (light edition, inverted) behind #challenges, `4-protected` behind #protection, `5-close` behind #contact. `1-network` is not used on `/`.

Approved by Joe 2026-10-14 in the build session ("approve the images"), after review of the frames and the fixes below. PR #565, branch `claude/loving-edison-epagrb`.

## What is approved

| Set | Files | Used by |
|---|---|---|
| Scene story (one diorama, five states) | `client/public/images/visual-system/scene-story/{1-network,2-exposure,3-gaps,4-protected,5-close}-{960,1600}.webp` | Version 10 |
| Signal Thread plates | `client/public/images/visual-system/signal-thread/{exposure,paths,proof,fit}-{960,1600}.webp` | Version 9 |

Sources and prompts: `artifacts/kie-ai/nano-banana/{prompts,images}/site/2026-10-10-*`. Generated with Nano Banana 2 on kie.ai, budget jobs in `.claude/kie-budget/ledger.jsonl` ($0.60 total).

## Why it passes

- **Concept, not noun.** The business is a building on a network plate; the story is told by what happens to that place (pressure arrives, gaps glow in the perimeter, layered rings close round it, it is lit at dusk with one path in). No shields, padlocks, hoodies, binary or neon grids.
- **Current art direction (Tier 2).** Dark field, graphite and gunmetal, smoked glass, violet as light rather than paint, generous negative space on the left for the copy.
- **Truth rules.** No people, no faces, no logos, no claims rendered in the image.
- **One camera.** The building sits in the same place on screen from frame to frame, so five backgrounds read as one story.

## Fixes made before approval

- The generator's stray text in the empty left third is painted out in every derivative.
- `3-gaps`: the perimeter showed seven glowing breaks against six gaps in the copy; one was painted out (2026-10-14) so the picture matches "What we tackle".
- Accessibility: decorative only (`alt=""`, `aria-hidden`); axe WCAG 2.2 AA clean on both pages at 390 and 1440.
