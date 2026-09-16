# Visual Asset Audit — Cybersecurity 3D System (Phase 1)

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Status:** BLOCKED — Envato package not found  
**Date:** 2026-08-08  
**Repo:** `digeratiexperts/Replit-Site`  
**Primary pack (DE decision):** Envato item `4THD2PH` — YES #1 (download entire package)  
**Secondary (deferred):** Envato `QUCF9E5` — maybe later if concepts missing  
**IconScout `234707`:** decide after inspecting Envato #1 style fit  
**FreeVector cyber homepage:** skip (probable)  
**Magnific:** selective photo/motion later — not hacker aesthetic

---

## Search results (this phase)

| Location | Result |
|---|---|
| `C:\Users\Joe\Projects\Replit-Site` | No `4THD2PH`, no `.blend` / `.obj` / `.fbx` / `.gltf` / `.glb` packs |
| `C:\Users\Joe\Projects\de-platform` | No match |
| `C:\Users\Joe\Projects` (name match) | No match |
| `C:\Users\Joe\Downloads` | No Envato / cyber-3D-icon ZIP matching `4THD2PH` |
| Desktop / Documents / OneDrive (name match) | No match |
| `attached_assets/` | Empty / no 3D source packs |

**Conclusion:** Inventory of individual icons cannot proceed until DE uploads the complete Envato ZIP.

---

## Required next step (DE)

1. Download the **entire** Envato package for item **`4THD2PH`** (BLEND / OBJ / FBX / PNG / LICENSE + keep the original ZIP).
2. Place the **complete ZIP** (do not unpack for the agent) at:

```
C:\Users\Joe\Projects\Replit-Site\assets\licensed\envato-4THD2PH\ORIGINAL\
```

Example filename (exact name may vary; keep Envato’s original name):

```
C:\Users\Joe\Projects\Replit-Site\assets\licensed\envato-4THD2PH\ORIGINAL\4THD2PH.zip
```

3. Reply in chat that the ZIP is in place so Phase 1 inventory can resume (unpack → per-file audit → draft integration plan).

**Do not** unpack manually into `client/public`, `public/`, or any other publicly downloadable web root.

---

## Licensing & public-serving rules (critical)

| Rule | Detail |
|---|---|
| Source-only formats | `.blend`, `.obj`, `.fbx`, PSD, texture source packages, editable materials — **never** in `client/public`, `public/`, or deployable static roots |
| Keep original ZIP | Always retain the purchased ZIP under `ORIGINAL/` |
| Deployable derivatives only | Website-ready AVIF / WebP / optimized PNG / GLB (if approved) generated later |
| Git | Large binaries and source packs are **gitignored**; docs + folder scaffold are committed |
| Brand target | Dark premium cybersecurity — violet, fuchsia, pink, restrained highlights; preserve Arizona dusk hero identity |

---

## Expected private folder structure (scaffolded)

```
assets/licensed/
  README.md                          ← licensing overview (tracked)
  envato-4THD2PH/
    README.md                        ← drop instructions (tracked)
    ORIGINAL/                        ← DROP COMPLETE ZIP HERE
    BLEND/                           ← after agent unpack
    OBJ/
    FBX/
    PNG/
    LICENSE/                         ← license + readme from pack
```

`.gitignore` excludes licensed source binaries/ZIPs under `assets/licensed/` while allowing README / `.gitkeep` / this docs trail.

---

## Per-asset inventory table (waiting)

Fill after ZIP is uploaded and unpacked privately. Columns:

| filename | format | dimensions / polycount | subject / concept | likely Digerati use | needs recoloring? | needs optimization? | source-only? | proposed public derivative |
|---|---|---|---|---|---|---|---|---|
| _pending ZIP_ | — | — | — | — | — | — | — | — |

### Concept coverage checklist (map after inventory)

| Concept | Candidate asset(s) | Notes |
|---|---|---|
| Identity | pending | |
| Endpoint | pending | |
| Email | pending | |
| Network | pending | |
| Cloud | pending | |
| Backup / DR | pending | |
| SOC | pending | |
| Vuln Mgmt | pending | |
| Compliance | pending | |
| Awareness | pending | |
| Threat Detection | pending | |
| Business Continuity | pending | |

---

## Downstream docs (not created yet)

`docs/VISUAL-INTEGRATION-PLAN.md` will be drafted **only after** inventory is complete enough. Planned topics:

- Exact assets selected (selective — not every card)
- Destinations: **PRIMARY** `client/src/pages/sections/ModernHeroSection.tsx` — replace/augment `DashboardMockup` with ProActive Ecosystem composition
- Also: outcomes, ProActive Ecosystem pages, solution pages, assessments, store categories (selective)
- Brand recolor (violet / fuchsia / pink), Framer Motion + subtle parallax + `prefers-reduced-motion`
- Performance / mobile / a11y
- Licensing & source handling
- Proposed registry: `client/src/lib/visualAssets.ts`
- Staged implementation (no hero code in Phase 1)

---

## Phase 1 scope guardrails

- Do **not** redesign the site
- Do **not** modify application / UI code in this phase
- Do **not** deploy
- Do **not** dump stock icons everywhere
- Avoid conflicting portal menu work (separate agent)
- IconScout `234707` approval deferred until Envato #1 style is inspected
