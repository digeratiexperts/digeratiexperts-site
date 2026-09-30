---
name: excalidraw-visuals
description: Use when someone asks for a hand-drawn visual, PNG image, rendered diagram, visual explanation, or says "excalidraw image" or "excalidraw visual". This generates PNG images, not editable files.
---

> **Digerati Experts repository note (local addition, not upstream text).**
> Each generation spends kie.ai credits, so run the script only when the user
> asks for a visual. All files for this skill live inside
> `.claude/skills/excalidraw-visuals/` (script, style guide, style reference);
> outputs go to `artifacts/kie-ai/excalidraw/` as ILLUSTRATIVE candidates.
> Anything bound for digeratiexperts.com still passes the imagery review in
> `design/IMAGERY.md` and the DE diagram system (`design/DIAGRAM_SYSTEM.md`)
> before an optimized derivative is placed under `client/public/images/`.
> For an editable `.excalidraw` file instead of a PNG, use
> `.claude/skills/excalidraw-diagram/`.

## Prerequisites

Before using this skill, make sure you have:
1. A kie.ai API key (sign up at https://kie.ai) available as `KIE_AI_API_KEY` (or `KIE_API_KEY`) in the environment or a gitignored project-root `.env`
2. Node.js installed
3. The generation script at `.claude/skills/excalidraw-visuals/scripts/generate-visual.cjs`
4. The style reference image at `.claude/skills/excalidraw-visuals/brand-assets/excalidraw-style-reference.png`

---

Read the full visual specification before building any prompt:
- `style-guide.md` (in this skill's folder) -- color system, font spec, shape rules, icon vocabulary, layout templates, text minimization rules

---

## Style Prefix (LOCKED)

This exact text is prepended to EVERY prompt. Never modify it per-request.

```
Excalidraw-style hand-drawn diagram on a clean white background. All text uses neat, consistent architect-style handwriting -- legible, slightly rounded letters with medium stroke weight. Letter sizes are uniform within each label. Titles are bold and larger. Body labels are smaller but equally neat. This is NOT sloppy handwriting -- it looks like a designer wrote it carefully with a thick marker.

Shapes are rounded rectangles with a 2-3px dark gray (#495057) hand-drawn outline and soft pastel fills. Lines and arrows are slightly wobbly and hand-drawn, not ruler-straight. Arrowheads are simple triangles. Nothing is pixel-perfect -- everything has a natural, sketched feel with visible stroke texture.

Color palette: soft blue (#a5d8ff), warm yellow (#ffec99), soft green (#b2f2bb), coral (#ffa8a8), light purple (#d0bfff). All text is dark charcoal (#343a40). All lines and arrows are dark gray (#495057). Background is always clean white.

People are simple stick figures with round heads, no facial features. AI agents/robots have a round head with two dot eyes and a small antenna. Documents have a folded corner. Gears represent automation. All icons are simple line drawings, not detailed or cartoonish.

Layout is clean and spacious with generous whitespace. Visual hierarchy is clear -- title is largest, labels are short (max 3 words each). The overall feel is educational, friendly, and slightly more polished than basic Excalidraw -- colored fills, intentional spacing, consistent sizing, and meaningful color coding elevate it.

Do NOT include: realistic photos, gradients, drop shadows, 3D effects, corporate clip art, stock imagery, dark backgrounds, heavy borders.
```

---

## Step 1: Gather Input

Get from the user:
- What concept or process to visualize
- Any specific elements, steps, or labels to include
- Aspect ratio preference (default: 16:9)

If the request is vague, ask one clarifying question about what specific angle or flow to show.

## Step 2: Choose a Layout Template

Pick the best layout from the style guide:

| Template | Best For |
|----------|----------|
| Left-to-Right Flow | Processes, sequences, transformations |
| Hub and Spoke | Capabilities, features around a central concept |
| Top-to-Bottom Hierarchy | Levels, layers, progressive depth |
| Side-by-Side Comparison | Before/after, old vs new, option A vs B |
| Numbered Steps List | Frameworks, checklists, ordered instructions |
| Cycle / Loop | Feedback loops, iterative processes |

## Step 3: Plan the Text (Minimize It)

Plan every piece of text that will appear in the image before writing the prompt:

1. **Title:** Max 5 words. Prefer 3.
2. **Box labels:** Max 3 words each. Prefer 1-2.
3. **Annotations:** Max 4 words each.
4. **Total word count:** Target under 30 words. Absolute max 50.

**Spelling protection:**
- Flag any word over 8 characters and shorten it
- Use icons instead of words where possible
- Use abbreviations (API, AI, DB, CLI)
- Remove articles and prepositions

## Step 4: Build the Prompt

Construct the prompt in this exact structure:

```
[STYLE PREFIX]

STYLE REFERENCE: Match the visual style of the reference image exactly -- same font, same shapes, same colors, same level of polish.

Diagram concept: [TITLE -- max 5 words]

Layout: [TEMPLATE NAME] -- [brief spatial description]

Elements (left to right / top to bottom):
1. [Element name] -- [color] fill, [icon if any], label: "[EXACT TEXT]"
2. [Element name] -- [color] fill, [icon if any], label: "[EXACT TEXT]"
3. ...

Connections:
- Arrow from [1] to [2], label: "[TEXT or none]"
- Arrow from [2] to [3]
...

Title at top center, bold and large: "[EXACT TITLE TEXT]"
```

**Rules:**
- Be explicit about spatial positions ("on the left", "top center", "bottom right")
- Assign a specific color from the palette to every filled element
- Name every element and its exact label text
- Describe connections/arrows with direction

## Step 5: Assign Colors by Meaning

- **Flows:** Blue (input) -> Yellow (process) -> Green (output)
- **Comparisons:** Coral (old/bad/slow) vs Green (new/good/fast)
- **Hub and spoke:** Blue center, mixed colors for spokes
- **Hierarchies:** Blue (top) -> Yellow (middle) -> Green (bottom)
- **Lists/grids:** Alternate colors row by row

Never leave color choice to the model. Always specify.

## Step 6: Generate the Image

**Always include the style reference image.** This is mandatory for visual consistency.

```bash
node .claude/skills/excalidraw-visuals/scripts/generate-visual.cjs "<FULL_PROMPT>" "artifacts/kie-ai/excalidraw/[YYYY-MM-DD]-[slug].png" "[ASPECT_RATIO]" --input ".claude/skills/excalidraw-visuals/brand-assets/excalidraw-style-reference.png"
```

You can pass additional reference images (logos, screenshots, etc.) via extra `--input` arguments:
```bash
node .claude/skills/excalidraw-visuals/scripts/generate-visual.cjs "<FULL_PROMPT>" "artifacts/kie-ai/excalidraw/[YYYY-MM-DD]-[slug].png" "[ASPECT_RATIO]" --input ".claude/skills/excalidraw-visuals/brand-assets/excalidraw-style-reference.png" "path/to/another-image.png"
```

Aspect ratios: `16:9` (default), `1:1`, `4:5`

If `.claude/skills/excalidraw-visuals/brand-assets/excalidraw-style-reference.png` does not exist, generate without it and tell the user to add a style reference image for consistent results.

## Step 7: Present Result

- Show the file path for preview
- One-line summary of what the visual shows
- Ask if adjustments are needed

If adjustments needed: modify only the diagram-specific portion. Never change the style prefix.

---

## File Locations

| What | Path |
|------|------|
| Style guide | `.claude/skills/excalidraw-visuals/style-guide.md` |
| Script | `.claude/skills/excalidraw-visuals/scripts/generate-visual.cjs` |
| Style reference | `.claude/skills/excalidraw-visuals/brand-assets/excalidraw-style-reference.png` |
| Output | `artifacts/kie-ai/excalidraw/` |
| API key | env var or project-root `.env` (`KIE_AI_API_KEY` or `KIE_API_KEY`), never committed |

## Notes

- Uses Nano Banana API via kie.ai (~$0.02-0.09 per image)
- The style prefix is locked. Only the diagram description changes per-request.
- The style reference image is the #1 consistency lever. Always include it.
- If generation fails, check that `KIE_AI_API_KEY` (or `KIE_API_KEY`) is set in the environment or project-root `.env`
- When in doubt, fewer words and more icons
