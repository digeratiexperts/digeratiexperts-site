---
name: recraft-icons
description: Generate on-brand SVG icons with Recraft (native vector output) for Digerati Experts, cleaned to single-colour currentColor glyphs that sit beside Lucide in IconWell. Use when someone asks for a Recraft icon, a custom or missing icon, an icon set, an SVG glyph for an MSP or security concept Lucide does not have, or a vector illustration from Recraft. Each generation costs Recraft credits.
---

# Recraft icons (DE)

Lucide is the site's icon set (300+ files use it, inside `client/src/components/visual/IconWell.tsx`). Use this skill only for concepts Lucide does not cover, or for vector illustrations. Check https://lucide.dev/icons first; a Lucide icon always wins over a generated one.

## Before you run anything

- **Cost and consent.** `generate` and `create-style` spend Recraft credits (about $0.01 to $0.08 per image, plus the plan). Run them only when Joe or the task asks for an icon. `--dry-run` and `clean` make no network call.
- **Key.** `RECRAFT_API_KEY` from the environment or the gitignored project-root `.env` (`.env.example` lists it). It needs a **paid** Recraft plan: free-plan images are public and not licensed for commercial use (`docs/CONTENT-TOOLING-PLAN.md`). Never print, commit or paste the key. `check` verifies it and shows credits without spending.
- **Network.** The script calls `external.api.recraft.ai` and downloads the returned file URLs. A sandbox that blocks that host fails with a fetch error; run it on a machine that can reach Recraft.

## Commands

From the repository root (Node 20+, no install step):

```bash
S=.claude/skills/recraft-icons/scripts/recraft.mjs

node $S check                                                     # key + credits, free
node $S generate --subject "a server rack with a shield" --name rack-shield --set security --dry-run
node $S generate --subject "a server rack with a shield" --name rack-shield --set security       # spends credits
node $S generate --subject "..." --name ... --n 4                 # more candidates (1-6)
node $S create-style --name de-icons ref1.png ref2.png --dry-run  # 1-5 PNG/JPEG/WebP references
node $S generate --subject "..." --name ... --style artifacts/recraft/styles/de-icons.json
node $S clean some.svg --out some.clean.svg                       # offline cleaner; --keep-colour for illustrations
```

Defaults come from `references/de-icon-style.json` (`--spec` swaps it): model `recraftv4_1_utility_vector` (Recraft's icon/logo-tuned vector model), 1024x1024, two candidates, graphite-on-white palette lock, no text, and a prompt template that asks for a Lucide-weight outline glyph legible at 20px. With a saved style the model switches to `recraftv4_styles_vector` and `style_match: precise`. If Recraft rejects an optional field (HTTP 400/422, not charged), the script retries once without `negative_prompt` and `controls.no_text` and records that in the manifest.

## What a run produces

`artifacts/recraft/icons/<set>/`:

| File | What it is |
|---|---|
| `<date>-<name>-N.svg` | Cleaned icon, ready for review |
| `<date>-<name>-N.raw.svg` | Recraft's original, for provenance |
| `<date>-<name>-N.svg.manifest.json` | model, prompt, style_id, credits, cleaner report, `classification: ILLUSTRATIVE`, `approval: candidate` |
| `review.html` | Every cleaned icon in the set at 20px in a dark and a light IconWell, and at 96px |

A repeat run with the same name on the same day is saved as `-r2`, `-r3`, ... and never overwrites earlier candidates. The raw file is written before cleaning, so a paid result is kept even if cleaning fails.

The cleaner removes scripts, event handlers, `foreignObject`, external references and metadata; drops `width`/`height` so CSS sizes it; removes a full-canvas background plate; and (single-colour mode, the default) rebuilds the glyph as a luminance mask under one `currentColor` shape. Dark paint is drawn, white paint is cut out in the original stacking order, so white details stay real holes and the well's text colour (magenta on dark, magenta ink on paper) applies exactly as it does to Lucide.

## Review, then ship

1. Open `review.html` (or screenshot it) and compare each candidate with neighbouring Lucide icons at 20px: stroke weight, padding, corner radius, legibility. Regenerate rather than hand-fix a weak glyph.
2. Generated icons are **ILLUSTRATIVE candidates** until they pass `design/IMAGERY.md`. Joe approves anything that ships.
3. To ship an approved icon, copy the cleaned SVG into the client code (not `client/public/images/`; an `<img>` cannot take `currentColor`) and wrap it so it accepts `className` like a Lucide icon:

```tsx
// client/src/components/icons/RackShield.tsx
import type { SVGProps } from "react";
import markup from "./svg/rack-shield.svg?raw";

const inner = markup.replace(/^[\s\S]*?<svg[^>]*>|<\/svg>\s*$/g, "");
const viewBox = markup.match(/viewBox="([^"]+)"/)?.[1] ?? "0 0 1024 1024";

export function RackShield(props: SVGProps<SVGSVGElement>) {
  return <svg xmlns="http://www.w3.org/2000/svg" viewBox={viewBox} aria-hidden="true" {...props} dangerouslySetInnerHTML={{ __html: inner }} />;
}
```

`IconWell` types its `icon` prop as `LucideIcon`; pass the wrapper with a cast or widen that prop in the same PR. Every UI change still needs rendered checks at 390 / 768 / 1440.

## Tests

`npm run test:recraft-icons` runs `scripts/recraft.test.mjs` offline (stubbed API, no key, no credits); CI runs it.
