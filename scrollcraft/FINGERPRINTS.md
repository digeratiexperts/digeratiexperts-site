# Fingerprints

Every site you build with **scrollcraft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| de-v2 | Chaptered editorial | No bar; fixed machine-room rail: folio + live mini technology map (top ribbon under 1100px) | Title page: type on paper, kinetic lines, no media above the fold | 10 chapters ≈ 14.1vh: flow, flow+field/silence, pin 2.4 (peak: figure draws itself), flow+interactive, flow+in dossier, pan 1.6, flow+reveal, flow+reveal+tilt, flow+parallax, pin 1.15 (merged edition, same build evolved) | Colophon plate on paper; CTA as running text; completed map holds | The technology map as persistent margin instrument: scatters, snaps together at the peak, answers outcome choices, stands complete at the close | Technical drawing (ink on graphite + paper) with real documentary photography | 4500 |
| proactive-ecosystem-amplify | Chaptered editorial (amplification of an existing React page; site chrome retained) | Global site nav + fixed margin environment folio (2xl+), chapter number, title, live map, jump list | Existing title page (PageTemplate text hero, no media) into staggered pillar chapter | flow, pin(2.2), flow(reveal), flow(parallax), flow(stagger), flow(reveal LR), flow(hold); 7 chapters | Compare panel lands and holds inside the page's existing CTA section, folio map complete | Accumulating margin environment map: one domain node lit and linked per chapter passed, complete and clickable by the close | Coded technical drawing on the site's dark ground, no photography, no generation | /solutions/proactive-ecosystem |
| experience-v1 | One world in states (the storyboard spine): every act is the same environment transformed, no chapters, no plates | Fixed mark + one restrained control; a heading readout (348° → 360°) as the only instrument; no folio, no map, no course line | A code-built place seen from inside the door at first light: desks, screens, figures as presence, cloud slabs overhead, off the grid by 2° | pin 1.6 (disconnected), pin 2.0 (what's underneath: relationships → dependencies → vendors → boundaries → exceptions), pin 2.4 (the heading is wrong → the principle → the world straightens), pin 1.4 (DE sees the whole environment); ~7.4vh; one continuous timeline through the seams | The aligned world held; the doors on the page, not the stage (prototype ends at Act 4's first frame) | The world corrects: the same objects ease onto the grid, gaps close, boundaries complete, DE enters as light along the identity spine, a magenta perimeter completes | Real-time WebGL environment (three.js) behind DOM type; fresnel presence, procedural room environment, no textures beyond a screen gradient, no photography, no generation; stills rendered from the world for fallbacks | 4501 / /scrollcraft/experience-v1/ |
| experience-v1 · revision 2 (2026-09-03, Joe's verdict: conversion and accessibility surgery) | One world in three movements: ONE pinned act with hard-cut copy windows (unmanaged complexity → visible relationships → Digerati direction), the same environment transformed; on phones, under reduced motion and without JavaScript the same markup reads as a document (copy, then a still rendered from the world) | Fixed mark + one small assessment control; no instrument, no readout, no telemetry; a skip link to the assessment | The thesis screen: H1 "Your environment isn't broken. It's been drifting.", the mapping dek, one primary assessment button, over an elevated three-quarter view of the whole floor | pin 4.0 with three windows (p 0–0.30, 0.30–0.62, 0.62–1); page ≈ 5.0–5.4 vh; decision point ≈ 4.1–4.7 vh; first assessment control at 0 vh | "Start by understanding what you have." with one dominant assessment button; three quiet secondary paths beneath | Unchanged: the world corrects and a magenta perimeter completes; movements that are off screen are inert | Same WebGL world leaned deliberately abstract (no chairs, keyboards, phones or door frame), exposure, materials and light raised, labels on plates naming what DE maps and finds; stills in landscape and portrait | 4501 / /scrollcraft/experience-v1/ |
| experience-v1 · revision 4 (2026-09-06, supersedes revisions 2–3) | One world in states, now continuous over the WHOLE page: one pinned act of three movements (unmanaged complexity → visible relationships → Digerati direction) with the evidence layer beneath it, all of it over one uninterrupted world timeline; on phones the same markup reads as a document with the live world behind it | Fixed mark + one small assessment control over a scrim taller than the bar; no instrument, no readout, no telemetry; skip link to the assessment | The thesis screen: H1 "Your environment isn't broken. It's been drifting.", the mapping dek, one primary assessment button, over a fully abstract world — points of light, lit quads, glass planes, a line grid, no furniture and no floor plane | pin 4.0 with three hard-cut windows (p 0–0.30, 0.30–0.62, 0.62–1) mapped to t 0–3; the evidence tail runs t 3–5 across everything below it; page ≈ 8.6 vh desktop / 9.8 vh phone; decision point ≈ 6.2 vh | "Start by understanding what you have." with one dominant assessment button, then the refusals and a final frame holding the corrected world | The scroll changes direction: the camera arcs laterally on a polar path and REVERSES at t = 3, on the beat where the world corrects — vertical scroll, lateral world movement, one direction change, spent on the peak | Real-time WebGL (three.js) driven by page scroll rather than by the pin, so it is behind every section and never freezes or cuts to flat; additive sprites, quads and line work only, no textures, no photography, no generation; stills rendered from the world for reduced motion, no WebGL and low power | 4501 / /scrollcraft/experience-v1/ and /experience |

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

- Chaptered editorial grammar, the margin machine-room rail with a live figure, the title-page hero on paper, the accumulating-legend peak, the colophon close with a running-text CTA, and the 9-act ≈ 14vh band are taken by de-v2.
- Chaptered editorial as an amplification layer over an existing page is taken.
- **Collision on record:** de-v2 and proactive-ecosystem-amplify were built in
  parallel, neither seeing the other's row, and converged on chaptered
  editorial, a fixed margin folio carrying a live environment map, a
  type-only title-page hero, and an accumulating-map signature move. They
  differ on act shape, close pattern, and interactivity, but they share more
  than the gate allows between planned builds. The next build must clear BOTH
  rows on 4 of 6, which in practice rules out the folio-plus-live-map margin
  and the chaptered-editorial grammar together.
- The pinned scatter-to-assembly diagram peak is taken.
- The accumulating margin environment map (folio + trace) is taken.
- The hold-on-existing-CTA close is taken.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scrollcraft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
