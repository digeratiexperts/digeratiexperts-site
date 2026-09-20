# Visual System v2

Current governance for Digerati Experts site visuals. Established by VIS-001 (August 2026). Versioned, not eternal: Joe revises it, and an Exploration Mode concept may propose a v3.

**Authority tiers (`DESIGN-AUTHORITY.md`):** the truthfulness and classification rules in this document (LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE, never invent telemetry, emerald only when live, no fake pulses) are **Tier 0** and hold in every task mode. The layer model, foundation tokens, HUD grammar and "vocabulary first" sequencing are **Tier 2** — mandatory in Maintenance Mode, a challengeable starting point in Exploration Mode. Blog/Store accents and the DE Desk shell are Joe-decided Tier 2 items.

This document does **not** replace `BRAND.md`, `DESIGN_SYSTEM.md`, `UX_PRINCIPLES.md`, or `IMAGERY.md`. Those remain the authoritative foundation. Visual System v2 is the **layer model** on top of that foundation: how precision, evidence, interactivity, and publishing sit on graphite / paper / magenta without becoming a new brand.

**DE intent:** Huntress-style analysis adds useful detail, but it must be absorbed into DE’s system rather than becoming a new visual direction.

> **DE needs more technical precision, visual evidence, and interactivity — but not more visual noise.**

Existing brand already rejects cyberpunk, generic SaaS, excessive glow, purple-filled panels, and decorative effects without purpose (Tier 1). Graphite / paper / magenta and Space Grotesk / Inter / Oxanium are the current implementation (Tier 2). Huntress ideas become **controlled upper layers** on DE’s existing foundation.

Task ledger: `docs/SITE-VISUAL-TASKS.md`. Agent rule: `.cursor/rules/visual-system-v2.mdc`. Policy: root `.cursorrules` §9A.

---

## Companion docs (v2 layers)

| Doc | Layer / job |
|-----|-------------|
| `BRAND.md` | Layer 0 identity constraints |
| `DESIGN_SYSTEM.md` | Live tokens |
| `UX_PRINCIPLES.md` | Design-first / visual QA / definition of done |
| `IMAGERY.md` | Concept-not-noun; sculpture inventory; IconWell on small cards |
| `VISUAL_EVIDENCE.md` | Layer 4 — LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE |
| `HUD_CHROME.md` | Layer 2 — technical HUD yes/no |
| `DIAGRAM_SYSTEM.md` | Diagram grammar (primitives later) |
| `PRODUCT_MEDIA.md` | Layer 7 Store visual grammar (P0, docs this sprint) |
| `PROOF_SYSTEM.md` | Layer 6 — human + client proof; no fabricated trust |
| `PHOTOGRAPHY.md` | Photography set plan |
| `EDITORIAL_ASSETS.md` | Layer 7 publication templates / threat storytelling |
| `MOTION_LANGUAGE.md` | Motion: state / hierarchy / continuity / feedback |

Maintenance Mode: do not invent HUD ticks, evidence frames, or diagram chrome on pages until the approved primitive for that pattern exists (VIS-002+). Exploration Mode: propose new vocabulary as reusable primitives, isolated until Joe picks.

---

## Master design rule

Before creating any substantial visual element, determine what the visitor needs to understand or believe. Then select the strongest evidence form in this order:

**real artifact → real data → real person → explanatory diagram → sanitized interface → illustrative scenario → editorial photography → atmospheric environment → icon.**

Decorative visual treatment comes last.

DE’s current visual implementation (Tier 2) is Midnight Obsidian `#050312`, Warm Paper `#F7F5F2`, Electric Magenta `#D3126A`, restrained violet illumination, Space Grotesk / Inter / Oxanium. Store electric blue remains Store-specific (Joe-decided).

Technical HUD elements are restrained precision details, not a cyberpunk theme.

Never invent telemetry, customers, metrics, performance numbers, incidents, compliance status, or product capabilities.

Clearly classify visual evidence as **LIVE**, **SANITIZED REAL**, **EXAMPLE**, or **ILLUSTRATIVE**.

Maintenance Mode: do not introduce new site-wide design patterns until an approved reusable primitive exists.

Large visual placements should favor evidence and explanation. Small functional cards should continue using the established `IconWell` system where appropriate (`client/src/components/visual/IconWell.tsx`).

---

## Layers

| Layer | Name | DE implementation |
|-------|------|-------------------|
| 0 | Brand foundation | `#050312` graphite (`--de-bg`), warm paper `--de-paper` `#f7f5f2` / `#F7F5F2`, magenta `#D3126A`, Space Grotesk / Inter / Oxanium. Hairline `--de-hairline`. Raised `--de-raised` `#151217`. Surface `--de-surface` `#0a0a0a`. Gold `#e7b20d` is wordmark bars only. Store electric blue is Store-specific. Blog/Journal amber is Journal-specific. |
| 1 | Continuous atmosphere | Grain (`--de-field-grain` / `.de-field-grain` already in `index.css`), restrained matrices, environmental plates, controlled violet illumination. Violet is lighting, never a wash fill. Hero may stay atmospheric. Do not wrap every chapter in a rounded gray island. |
| 2 | Precision chrome | Hairlines, alignment ticks, corner markers, technical frames. Metadata and framing, not decoration. See `HUD_CHROME.md`. |
| 3 | Technical metadata | Oxanium labels, sequence numbers, status tokens, timestamps, small telemetry. Labels, not body text. See tactical monospace below. |
| 4 | Evidence assets | Assessment UI, roadmaps, diagrams, real reports, portal/interface evidence. Classified. See `VISUAL_EVIDENCE.md`. |
| 5 | Interactive command surfaces | Capability switchers, coverage maps, incident timelines, comparison views. Build after primitives exist. Do not fake live SOC terminals. |
| 6 | Human + client proof | Real people, reviews, customer evidence, real operational proof. Honest empty states over invented trust. See `PROOF_SYSTEM.md`. |
| 7 | Publishing / product universe | Store media, threat stories, guides, datasheets, report covers. See `PRODUCT_MEDIA.md` and `EDITORIAL_ASSETS.md`. |

Layers 2–5 are **upper layers**. In Maintenance Mode they must not rewrite Layer 0. In any mode, if a treatment would make the site look like a SOC wall, Huntress clone, or neon terminal, it is wrong (Tier 1).

---

## Current foundation (Layer 0 — Tier 2; Maintenance Mode keeps it, Exploration Mode may propose against it)

| Role | Token / value | Notes |
|------|----------------|-------|
| Deep well | `--de-bg` `#050312` | Page / chapter field / inset cards. Midnight Obsidian. |
| Marketing field | `--de-surface` `#0a0a0a` | Adjacent dark chapter |
| Raised / style box | `--de-raised` `#151217` + `--de-hairline` | Contained boxes, panels, chips |
| Paper | `--de-paper` `#f7f5f2` / `#F7F5F2` | Light chapters; paper-raised `#ffffff` |
| Pop | `#D3126A` | CTA fill, active border, colon, icon |
| Violet | `#5B45E0` / `#8B5CF6` / `#A78BFA` | Lighting only — never panel fills |
| Gold | `#e7b20d` | Wordmark 3-bar mark only — never CTA or numeral fill |
| Store accent | electric `#1D6FF2` / ink `#6FB3FF` | Store routes only — `.cursor/rules/blog-store-color-lock.mdc` |
| Journal accent | amber | `/resources` and `/case-studies` only |
| Headings | Space Grotesk | Presentation |
| Body / UI reading | Inter | Prose and standard UI |
| Tactical labels | Oxanium (JetBrains Mono fallback) | Metadata, stats, sequence IDs — not paragraphs |

Executable field recipe: `.cursor/rules/dark-field-accent-pop.mdc`.

---

## HUD interpretation

**Yes** to:

- tiny corner ticks
- alignment markers
- subtle crosshair intersections
- understated grid / dot matrix
- small section IDs
- tiny telemetry labels
- precision rulers / lines

**No** to:

- every card having `+` signs
- every section looking like a SOC terminal
- endless grids
- neon outlines
- sci-fi screen decoration

**Rule:** HUD chrome is metadata and framing, not decoration.

Use primarily on:

- evidence modules
- diagrams
- operational visualizations
- coverage displays
- security telemetry
- Store technical product media

**Do not** use on ordinary FAQ, forms, long prose, testimonials, or editorial paper sections.

Full grammar: `HUD_CHROME.md`. Do not add HUD ticks independently. Vocabulary first (VIS-003).

---

## Tactical monospace

Oxanium is for labels such as:

- `01 / IDENTITY`
- `MONITORING / ACTIVE`
- `RISK / 72`
- `ASSESS → REMEDIATE → VERIFY`
- `LAST VERIFIED`

Not body text. Not testimonials. Not FAQ answers.

- Space Grotesk = presentation
- Inter = reading / UI
- Oxanium = tactical metadata

Do not invent numbers (`RISK / 72`) unless they are LIVE, SANITIZED REAL, or clearly labeled EXAMPLE / ILLUSTRATIVE.

---

## Truthfulness

Never make simulated UI indistinguishable from:

- actual customer data
- live telemetry
- measured DE performance
- a real incident

Classify assets as **LIVE**, **SANITIZED REAL** (code union `SANITIZED_REAL`), **EXAMPLE**, or **ILLUSTRATIVE**. Definitions: `VISUAL_EVIDENCE.md`. The landed `EvidenceFrame` type uses underscore tokens; UI labels may read `SANITIZED ARTIFACT`.

Examples of what not to do:

- Do not show “M365 Phishing Vector Neutralized in 8m” as real DE performance.
- Use labeled **EXAMPLE** incident flows.
- A future Arizona threat radar cannot imply live Arizona telemetry unless it actually uses live data.
- Homepage threat cards may be LIVE only when they come from the real feed (`docs/THREAT-INTEL-FEED.md`). Dates and sources must stay honest (`.cursorrules` §34).

Never invent telemetry, customers, metrics, performance numbers, incidents, compliance status, partnerships, or product capabilities (`.cursorrules` §3).

---

## What this is not

Visual System v2 is **not**:

- a Huntress visual clone (Tier 1)
- a cyberpunk / SOC-terminal theme (Tier 1)
- permission to spray HUD on 138 pages (Maintenance Mode)
- a replacement for IconWell on small functional cards (Maintenance Mode)
- a Store or Journal recolor (Joe-decided)
- a DE Desk restyle (owned elsewhere; do not touch `ZohoASAPWidget.tsx` from visual-system tasks unless the ledger or Joe says so)

It is also not a ceiling. An Exploration Mode concept may propose a different layer model, HUD grammar or foundation; it must keep the Tier 0 truth rules and the Tier 1 identity, and it ships only when Joe picks it.

---

## Vocabulary first

**Do not have every agent start adding HUD effects independently.**

Order:

1. Rule defined (this sprint — VIS-001 governance)
2. Primitive built (VIS-002, VIS-003, VIS-004) — first files landed on `main` in `87e2858`; they are **not** license to mount HUD on 138 pages
3. Flagship assets using those primitives (VIS-005–VIS-008) after visual review
4. Then coordinated propagation (VIS-016)

VIS-001 through VIS-005 should happen before agents start spraying new design treatments across the site.

CSS utilities `.de-hud-card`, `.de-grid-matrix`, `.de-telemetry-badge`, `.de-telemetry-live-dot` were added to `client/src/index.css` in `87e2858`. `2722dd5` applied `.de-hud-card` and ProofChip/IncidentFlow to several solutions/resources/trust pages. Do not extend that spray from VIS-001. Visual review is VIS-003 / VIS-008 / VIS-016.

---

## Program (Sprints 0–8)

This table records the program. Sprint 0 is this governance PR. `87e2858` on `main` shipped a short v2 note plus evidence primitives ahead of this fuller corpus — preserve that code; this PR completes the docs/rules the primitives were missing.

| Sprint | Job | Ledger |
|--------|-----|--------|
| **0** | Governance: these docs, agent rules, task ledger, concurrency audit | VIS-001 (this PR) |
| **1** | Primitives: EvidenceFrame, TechnicalFrame / HUDFrame, StatusToken, ProofChip, diagram primitives. Code for 002/003/008 landed on `main` (`87e2858`). This PR does not restyle or remount them. Diagram primitives still unbuilt (VIS-004). | VIS-002, VIS-003, VIS-004 |
| **2** | Flagship assets: Protection Coverage, ProActive Ecosystem diagram, Assessment EvidenceFrame, Roadmap EvidenceFrame, IncidentFlow (**not** a SimulatedIncidentResponseCard that looks live) | VIS-005–VIS-008 |
| **3** | Protection Command Deck | VIS-009 |
| **4** | Four environment plates | VIS-010 |
| **5** | Store visual system (P0) | VIS-011 |
| **6** | Human proof photography | VIS-012, VIS-013 |
| **7** | Threat-storytelling template | VIS-014 |
| **8** | Publication system | VIS-015, then VIS-016 propagation |

### Sprint 1 contracts

VIS-001 does **not** add or rewrite component TSX. Paths that already exist on `main` (`87e2858`) are preserved:

| Primitive | Path | Contract (summary) | Full spec |
|-----------|------|--------------------|-----------|
| EvidenceFrame | `client/src/components/evidence/EvidenceFrame.tsx` | Variants `dark` \| `paper` \| `interactive`. Required `classification`: `LIVE` \| `SANITIZED_REAL` \| `EXAMPLE` \| `ILLUSTRATIVE`. Optional timestamp, status, source note. Title required in the landed API. | `VISUAL_EVIDENCE.md` |
| HUDFrame / TechnicalFrame | `client/src/components/evidence/HUDFrame.tsx` | Thin hairline, two controlled corner marks, optional technical ID. No giant glow, no decorative fill. Not a normal card. Landed file has optional `accentBorder` glow and `gridMatrix` — do not turn those on by default; visual review is VIS-003. | `HUD_CHROME.md` |
| StatusToken | `client/src/components/evidence/StatusToken.tsx` | `active` / `verified` / `attention` / `informational`. Emerald only when genuinely healthy/live. Magenta remains brand/action. Landed `active` currently uses emerald — flag for VIS-003, do not silent-rewrite in VIS-001. | `HUD_CHROME.md` |
| ProofChip | `client/src/components/evidence/ProofChip.tsx` | Factual only (`24/7` Human-led monitoring, `ARIZONA` Principal-led, `6 DOMAINS` Assessed). Never invent. | `PROOF_SYSTEM.md` |
| IncidentFlow | `client/src/components/evidence/IncidentFlow.tsx` | EXAMPLE classification in code. Do not mount as live DE performance. Copy such as “under 5 minutes” stays EXAMPLE. Visual review: VIS-008. | `VISUAL_EVIDENCE.md` |
| Diagram primitives | not built | DiagramNode, DiagramEdge, SecurityBoundary, ControlGate, RiskMarker, StatusMarker, TelemetryLabel | `DIAGRAM_SYSTEM.md` |

Do **not** create a second EvidenceFrame/HUDFrame. Extend the files above after visual review. They are **not** mounted on marketing pages yet — keep it that way until VIS-005+.

Existing coverage UI (`ProActiveCoverageMap`) is a pricing/coverage control, not a license to invent new diagram languages. Future Protection Coverage (VIS-005) must reuse diagram primitives and stay mapped to real package inclusions.

---

## Definition of complete

A visual-system task is not finished when a component exists.

**Rule defined → primitive built → real content used → rendered → 390 / 768 / 1440 tested → self-critique → a11y → tests/build clean → latest-main concurrency audit clean → PR reviewed → merged → production verified → task ledger marked LIVE.**

For docs-only PRs (VIS-001): visual QA of rendered pages is N/A. Still include the concurrency audit. Do not claim design-complete for UI.

UI work still follows `UX_PRINCIPLES.md` and `.cursorrules` §27–§28, §40–§41.

---

## Consumption map

| Later work | Consumes |
|------------|----------|
| Evidence modules, assessment/roadmap frames | `VISUAL_EVIDENCE.md`, EvidenceFrame |
| Coverage maps, ecosystem diagrams, incident flows | `DIAGRAM_SYSTEM.md`, `HUD_CHROME.md` |
| Store PDP / cards / comparison | `PRODUCT_MEDIA.md`, Store color lock |
| Reviews, founder, case-study proof | `PROOF_SYSTEM.md`, `PHOTOGRAPHY.md` |
| Journal threat stories, datasheets, covers | `EDITORIAL_ASSETS.md` |
| Any motion on layers 2–5 | `MOTION_LANGUAGE.md` |
| Small offer / capability cards | existing `IconWell` — do not replace with HUD cards |

DE Desk / `ZohoASAPWidget.tsx` is **out of scope** for Visual System v2 rollout unless a later ledger row explicitly assigns it. Parallel restyle lives on `cursor/de-desk-ask-support-style-c9ac`.
