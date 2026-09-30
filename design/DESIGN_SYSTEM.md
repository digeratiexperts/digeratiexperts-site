# Design System

Source of truth for the **current** Digerati Experts visual tokens (Tier 2 — `DESIGN-AUTHORITY.md`). Extracted from the live codebase (`client/src/index.css`, `tailwind.config.ts`, `client/src/components/ui/button.tsx`, DE Desk tokens).

Maintenance Mode: use these tokens; do not invent new brand colors, one-off radii or arbitrary values — promote repeated values into tokens instead. Exploration Mode: a concept may propose new or replacement tokens (colors, type, radii, motion) as a *token set*, never as scattered inline values, and must say which current tokens it keeps. Gold-as-wordmark-only and the Blog/Store accents are Joe-decided.

Quality bar: `design/approved/` — match or elevate toward those examples. Do not copy Linear/Stripe; analyze principles (hierarchy, restraint, composition) and apply them in DE’s language.

Companion docs: `BRAND.md`, `UX_PRINCIPLES.md`, `IMAGERY.md`. Layers on this foundation: `VISUAL_SYSTEM_V2.md`. Policy: root `.cursorrules` (§9A).

## Personality

Premium
Technical
Trustworthy
Restrained
Modern
Enterprise

## Color

Shade ladder (Lucide lesson, DE hex — nested, juxtaposed, not leftover slabs):

`--de-bg` `#050312` — deepest well (page canvas, inset cards inside a style box, hero/credibility/proof/founder/closing)
`--de-surface` `#0a0a0a` — marketing field for a full-bleed dark chapter
`--de-raised` `#151217` — contained style box (2–4 flat chapters) and lifted panels/chips
`--de-hairline` `rgba(255,255,255,0.1)` — 1px borders and same-chapter seams
`--de-paper` `#f7f5f2` — one light chapter recipe (protect, trust, FAQ)
`--de-paper-raised` `#ffffff` — cards on paper
`--de-paper-hairline` `rgba(26, 18, 16, 0.1)`

OpenMSP background mapping (do not copy their yellow): page `#161616` → `--de-bg`; box `#212121` → `--de-raised`; inset `#121212` → `--de-bg`. Utility: `.de-style-box` / `.de-style-box-inset`. Do not wrap every chapter.

Adjacent same-chapter dark sections share one field with a hairline and internal lift (raised cards). Different chapters step well ↔ surface ↔ paper ↔ magenta so the page does not read as one `#0a0a0a` slab. Do not paint `#0f0f0f`, `#0f0f1a`, `#141418`, or cool `#F7FAFC` as competing page fields. Magenta how-it-works stays the only loud band. DE logo gold (`#e7b20d`) is a secondary mark color only — never a CTA fill.

Base canvas: `html`/`body` background is `--de-bg` (`#050312`), never pure `#000`. Sections that intentionally go transparent to share a continuous field with their neighbor fall through to this color — an undocumented pure-black base would introduce a third, off-token dark underneath the two the system defines.

DE Desk shell `#1a0b33`
Nested dark `#12141c` / `#171922`
Nested light `#ffffff` / `#faf8fc` (Desk chat insert only)

Border:
`--de-hairline` / `white/10` `rgba(255,255,255,0.1)`
`white/15` `rgba(255,255,255,0.15)`
`--radius` `0.5rem` (shadcn)

Primary:
`#D3126A` (brand magenta — CTA, brand mark, active underline, colon, icon, user bubbles)

Accent violet:
`#5B45E0` / `#7c3aed` (lighting only — not box fills)
`#8B5CF6` / `#A78BFA` (lavender frame / glow, lighting only)

**Accent pop:** magenta is loud because the field is quiet. Raised boxes = `--de-raised` + `--de-hairline`. Do not paint cards/chips/sections with violet or indigo fills. See `.cursor/rules/dark-field-accent-pop.mdc`.

Primary text:
`#ffffff` / `--de-fg`

Secondary text:
`--de-muted` `rgba(255, 255, 255, 0.85)`
`--de-muted-soft` `rgba(255, 255, 255, 0.72)`
`white/65` / `white/45` (hierarchy on dark)

Focus:
`2px solid rgb(236, 72, 153)` (`#ec4899`) offset `2px`

Button brand variant:
`from-fuchsia-600 via-pink-600 to-rose-500` with pink shadow; violet→magenta gradients (`#7c3aed` → `#D3126A`) on portal/Desk submits.

Maintenance Mode: do not introduce a new purple, magenta, or near-black — reuse these. Exploration Mode: propose changes as tokens with a rationale.

## Typography

- Headings: Space Grotesk, weight 600–700, letter-spacing `-0.015em` to `-0.03em`, line-height `1.15`
- Body: Inter, weight 400, line-height `1.6` (prose `1.75`)
- Stats/numbers: Oxanium, fallback JetBrains Mono
- Root font-size: `16px` (`18px` at 1920px, `20px` at 2560px, `22px` at 3840px)
- Small type: `text-xs` = `0.875rem` (14px), `text-sm` = `1rem` (16px) — lifted so chips and captions stay readable
- Tailwind: `font-heading`, `font-sans` / `font-body`, `font-mono`

## Radius

- Token: `--radius: 0.5rem` → `rounded-lg` / `md` / `sm`
- Common UI: `rounded-xl`, `rounded-2xl` (cards), `rounded-3xl` (large panels)
- Do not invent one-off radii (e.g. 13px, 17px); a new radius scale is a token proposal, not an inline value

## Spacing / layout

- Container: centered, padding `1rem`, `2xl` max `1680px`
- Sticky nav clearance: `--de-nav-offset` (MegaMenu ResizeObserver)
- Homepage section jumps: MegaMenu `HomepageOnPageNav` at rest, plus the expanding `SiteBottomBar` dock after scroll. Keep both — DE restored the dock 2026-08-27.
- Dark marketing cards: `rounded-2xl border border-de-hairline bg-de-raised` with Lucide in `IconWell` (quiet well, magenta icon)
- Section padding pattern: `py-10 md:py-14 lg:py-16` (and nearby variants already in sections)
- Touch targets: ~44×44px where practical (`min-h-11`)

## Motion

- Buttons: `transition-all duration-200 ease-out`, `active:scale-[0.98]`, hover `-translate-y-0.5`
- Accordion: `0.2s ease-out`
- Respect `prefers-reduced-motion` (already in `index.css`)
- Motion communicates state, hierarchy, continuity, feedback — never decoration

## Imagery

Current engage-path system (Tier 2): dark technical sculpture — graphite / smoked glass / violet-as-light. Registry: `client/src/lib/visualAssets.ts`. See `IMAGERY.md`.

## Principles

1. Restraint over decoration.
2. Hierarchy over density.
3. Consistency over novelty.
4. Purpose over ornament.
5. Real visual composition over generic AI imagery.
6. Accents pop because fields stay black/charcoal — never purple-filled boxes.
