# Version 9: the Signal Thread

**Ask (Joe, 2026-10-10):** "I need the backgrounds of each section on the homepage have backgrounds that tell a story or prep the user for the next section or the sections connect visually somehow in the design or the designs message … Less plain background and more of a constant infographic type of design … use [kie.ai] and the others."

**Where:** `/version-9` (noindex, canonical `/`, not in navigation). The live homepage (Version 8) is untouched. Replacing `/` is Joe's call.

## Hypothesis

The homepage is one argument told in 17 steps: why DE exists, the exposure, the gaps, the paths, the layers, the method, the proof, the place, the people, the sector, the fit, the watch, the start, the questions, the standards, the next step, and Chandler. Today each section sits on a plain field with a generic texture (dots, lattice, contour), so nothing carries the reader from one step to the next. A single visible thread that runs through every section, names each step and previews it, turns the page into a route you follow.

## What it adds

1. **The thread.** One line runs down the page in the side gutter. Each section picks it up on the side where the previous one left it, crosses (when its side changes) inside its own top padding, and hands it on at its bottom edge. A magenta copy draws itself as you scroll; under reduced motion it is simply drawn.
2. **Step nodes.** Each section's node names the step along the rail ("03 · The gaps"). These labels are shown only at that step and restate what the section says.
3. **Motifs.** A faint line-art diagram behind each section previews its content: a perimeter with six breaks (six problems), three diverging paths, seven rings with an eighth running continuously (eight blocks), four rising steps (four models), signal → triage → owner, contours and a pin at Chandler's coordinates, and so on.
4. **Plates.** Four kie.ai environment plates (Nano Banana 2, 2K) for the darker chapters: exposure, paths, proof, fit. The panels in the exposure and pricing chapters were made slightly translucent so their plates read through. Classification: ILLUSTRATIVE decoration, not evidence.

## Tier notes

- **Tier 0 kept.** No content, copy, form, link, route or SEO changes; everything new is decorative, `aria-hidden` and pointer-events none; axe WCAG A/AA reports 0 violations at 390 and 1440 with reduced motion; no overflow at 390/768/1440; reduced motion stops all movement; nothing fabricated (each label and motif restates its own section).
- **Tier 1 kept.** No cliché imagery (no shield, padlock, server rack or neon); violet is used only as light.
- **Tier 2 changed:** the chapter textures (`ChapterPattern`) are replaced on this version by content-specific motifs and a continuous thread. Tokens, type and the card system are unchanged.

## Cost

kie.ai job `homepage-signal-thread-plates-2026-10-10`: 4 × Nano Banana 2 at 2K, projected $0.24, spent $0.24.

## Files

`client/src/pages/versions/v9/story/` (chapters, motifs, backdrop, CSS, test); plates in `client/public/images/visual-system/signal-thread/` (WebP 960/1600); sources and prompts under `artifacts/kie-ai/nano-banana/`.
