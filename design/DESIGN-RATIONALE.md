# Design rationale library

Use this folder with the root `.cursorrules` policy (sections 4–14, 27–28, 31, 40–42), read through the tier model in `DESIGN-AUTHORITY.md`. `approved/`, `rejected/` and `references/` are Tier 3: evidence of what exists and what failed, never a boundary on an Exploration Mode concept Joe requests.

Design OS (tokens, brand, UX, imagery): `DESIGN_SYSTEM.md`, `BRAND.md`, `UX_PRINCIPLES.md`, `IMAGERY.md`. Visual System v2 (layers on that foundation, does not replace it): `VISUAL_SYSTEM_V2.md`. Cursor execution layer: `.cursor/rules/ui-ux.mdc`, `brand.mdc`, `frontend.mdc`, `visual-system-v2.mdc`. Audit before implementing: `.cursor/skills/visual-audit/SKILL.md`. Ledger: `docs/SITE-VISUAL-TASKS.md`.

## Layout

| Path | Purpose |
|------|---------|
| `design/DESIGN-AUTHORITY.md` | **Authority model** — Tier 0 non-negotiables / Tier 1 identity / Tier 2 current system / Tier 3 record; Maintenance vs Exploration Mode. Read first. |
| `design/UI-STYLE-RULES.md` | Current design reference (Tier 2) — one theme / five surfaces, accent doctrine, section archetypes, page-layout doctrine, hard rules (consolidates the corpus; start here for any UI task) |
| `design/DESIGN_SYSTEM.md` | Live tokens (color, type, radius, motion) extracted from the codebase |
| `design/BRAND.md` | Visual identity constraints |
| `design/UX_PRINCIPLES.md` | Design-first / visual QA / definition of done |
| `design/IMAGERY.md` | Dark technical sculpture system; concept-not-noun |
| `design/VISUAL_SYSTEM_V2.md` | Canonical v2 layers + master rule (does not replace BRAND / DESIGN_SYSTEM / UX / IMAGERY) |
| `design/VISUAL_EVIDENCE.md` | LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE + EvidenceFrame contract |
| `design/HUD_CHROME.md` | Technical HUD yes/no; HUDFrame / StatusToken contracts |
| `design/DIAGRAM_SYSTEM.md` | Diagram grammar; primitives later |
| `design/PRODUCT_MEDIA.md` | Store visual grammar (P0, docs until VIS-011) |
| `design/PROOF_SYSTEM.md` | Human + client proof; no fabricated trust |
| `design/PHOTOGRAPHY.md` | Photography set plan |
| `design/EDITORIAL_ASSETS.md` | Publication templates / threat storytelling |
| `design/MOTION_LANGUAGE.md` | Motion: state / hierarchy / continuity / feedback |
| `design/references/` | Inspiration and competitor/industry refs (not yet approved for DE) |
| `design/approved/` | Ship-quality examples agents should match or elevate toward |
| `design/rejected/` | Anti-patterns — do not recreate these looks or structures |

## How agents should use this

1. Before major UI work, scan `approved/` for patterns that already fit DE.
2. Check `rejected/` so you do not reintroduce failed directions.
3. In Maintenance Mode prefer elevating existing DE sections in place over inventing new layouts. In Exploration Mode diverge first.
4. After browser verification, if DE accepts or rejects a direction, drop a short note + screenshot into `approved/` or `rejected/` with why.

## Homepage shade system (2026-08)

Steal Lucide.dev’s nested neutrals, not their layout. Homepage chapters should juxtapose: `--de-bg` well, `--de-surface` field, `--de-paper`, and the magenta how-it-works band. Adjacent dark sections in the *same* chapter share a field with a 1px hairline and raised cards (`--de-raised`). Do not flatten every section to one `#0a0a0a` slab. Light leftovers use one `--de-paper` (`#f7f5f2`) recipe with lifted white cards. Magenta how-it-works stays the only loud band. Do not call Meshy for UI chrome.

## Naming

Prefer descriptive filenames, e.g. `homepage-hero-fullbleed-2026-08.png` plus a sibling `.md` with 2–5 bullets on why it works or fails.
