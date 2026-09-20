# Visual Asset Inventory — Digerati Experts site

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Date:** 2026-08-08  
**Repo:** `C:\Users\Joe\Projects\Replit-Site`  
**Related:** `docs/VISUAL-ASSET-AUDIT.md` (Envato Phase 1), `docs/MESHY-BATCH-01.md`, `docs/MESHY-ASSET-BACKLOG.md`

---

## Verdict

| Source | Status |
|---|---|
| Meshy Batch 01 (all 5) | **Complete** — refined dark + violet/fuchsia; public derivatives published + placed selectively |
| Meshy Identity v4 | **Approved** — on outcomes “Protect identities and devices” |
| Envato `4THD2PH` | **Not arrived** — scaffold / drop zone only under `assets/licensed/envato-4THD2PH/` |
| DE / Joseph Petro headshots | **Missing** — founder spotlight stays gated; drop path prepared |

---

## 1. Meshy batch-01 (licensed sources)

Path: `assets/licensed/meshy-batch-01/ORIGINAL/{identity,endpoint,email,network,backup}/`

| Concept | Formats on disk | Preview PNG | DE status | Public derivative |
|---|---|---|---|---|
| Endpoint | clay + `*-refined.glb` + textures | refined | **Approved + refined** | `/images/visual-system/meshy-batch-01/endpoint.{webp,png}` + `-256.webp` |
| Email | clay + refined | refined | **Approved + refined** | `.../email.*` |
| Network | clay + refined | refined | **Approved + refined** | `.../network.*` |
| Backup | clay + refined | refined | **Approved + refined** | `.../backup.*` |
| Identity (v4) | clay + refined | refined | **Approved + refined** | `.../identity.*` |
| Identity v3 | under `_rejected/v3-checkmark-shield-019fe3f2/` | archived | Rejected | Never use |

Licensed binaries/PNGs are **gitignored**. Public derivatives rebuilt from refined preview-alpha PNGs with near-black knockout → true transparency.

Optimize script: `scripts/optimize-meshy-batch01.mjs` (uses local `sharp`; not a permanent dependency).

---

## 2. DE photography / headshots search

Searched (no Joseph Petro / founder headshot found):

| Location | Result |
|---|---|
| `client/public/` | SVG figma chrome only — no headshots |
| `client/src/assets/` | logo + patterns + ebook cover — no headshots |
| `attached_assets/` | Arizona dusk / office / trust desk atmosphere + UI frames — **no DE portrait** |
| `assets/licensed/` | Meshy + empty Envato scaffold |
| `uploads/` | missing |
| Downloads / Desktop / Documents (name match) | no `headshot` / `petro` / `joseph` portrait assets suitable for team page |

**Where DE should drop originals:**

```
C:\Users\Joe\Projects\Replit-Site\assets\photography\de-headshots\ORIGINAL\
  joseph-petro-headshot.jpg   (preferred name)
```

See `assets/photography/de-headshots/README.md`. After drop, optimize → `client/public/images/team/` and set `photography.founderHeadshot.available = true` in `visualAssets.ts`.

Do **not** invent AI portraits or substitute stock faces.

---

## 3. Envato `4THD2PH`

| Check | Result |
|---|---|
| `assets/licensed/envato-4THD2PH/ORIGINAL/` | scaffold `.gitkeep` only — **no ZIP** |
| Downloads / Desktop / Documents / Projects | no `4THD2PH` package |

Drop complete ZIP at:

```
C:\Users\Joe\Projects\Replit-Site\assets\licensed\envato-4THD2PH\ORIGINAL\4THD2PH.zip
```

(Details unchanged from `docs/VISUAL-ASSET-AUDIT.md`.)

---

## 4. Current site image usage (key surfaces)

| Surface | File | Current visuals | Action this pass |
|---|---|---|---|
| Homepage hero | `ModernHeroSection.tsx` | Arizona dusk photo + Lucide trust chips + `DashboardMockup` SVG | **Left alone** — refined DashboardMockup beats a corny Meshy icon swarm; ecosystem composition = later stage |
| Homepage outcomes | `HomepageOutcomesSection.tsx` | Identity / Backup / Network on 3 matching cards | **Polished** — shared `MeshyStillAccent` (refined stills; opacity ~85%, soft frame) |
| Homepage engagement | `HomepageEngagementSection.tsx` | Lucide on relationship cards | **+1** Email still on assessment band only (copy names email); cards stay Lucide |
| Homepage process | `HomepageHowItWorks.tsx` | Numbered steps | **+1** Network still as section intro accent only — not on each step |
| Homepage trust rail / proof / stats | various | Lucide | Unchanged (selective rule) |
| Mega-menu | `MegaMenu` | Lucide | **Do not replace** |
| Portal menus | portal | Lucide | **Do not replace** |
| Services section (legacy) | `DigeratiServicesSection.tsx` | Lucide — **not mounted** on current homepage | Untouched |
| Solutions index | `SolutionsIndex.tsx` | Lucide grids | **Selective** Network / Threat (endpoint) / Backup stills |
| About / Team | `about/Team.tsx` | Role cards + Lucide only | Founder spotlight **wired but gated** until photo exists |
| Trust photo | `DigeratiTrustPhotoSection.tsx` | `de-trust-assessment-desk.png` atmosphere | Keep (real scene, not founder) |
| ProActive ecosystem pages | `solutions/ProActive*EcosystemPage.tsx` | mostly Lucide / layout | Deferred — need more Batch 02+ concepts |

Shared accent component: `client/src/components/visual/MeshyStillAccent.tsx`  
Registry accents: `homepageSectionAccents` in `visualAssets.ts`

---

## 5. Destination map

| Concept | Public path | Primary placement | Secondary | Blocked / next |
|---|---|---|---|---|
| Identity | `/images/visual-system/meshy-batch-01/identity.webp` | Outcomes: “Protect identities and devices” | Future identity pages | Done for Batch 01 |
| Endpoint | `.../endpoint.webp` | Solutions: Threat Detection | — | Done for Batch 01 |
| Email | `.../email.webp` | Engagement assessment band (homepage) | Future email-security page | Done for Batch 01 |
| Network | `.../network.webp` | Outcomes: “Protect and monitor…” | Process intro + Solutions: Managed Network | Done for Batch 01 |
| Backup | `.../backup.webp` | Outcomes: “Keep the business recoverable” | Solutions: Backup & DR | Done for Batch 01 |
| Founder headshot | `/images/team/joseph-petro-headshot.webp` | `/about/team` founder spotlight | Ebook / trust / About | Waiting for DE drop |
| Hero ecosystem | composed still / GLB | `ModernHeroSection` replace/augment `DashboardMockup` | ProActive pages | Needs Batch 10 composition + inventory support |
| Envato pack | TBD derivatives | Selective fill for gaps Meshy doesn’t cover | — | Waiting for ZIP |

Registry: `client/src/lib/visualAssets.ts`

---

## 6. What’s still needed from DE

1. **Drop founder headshot(s)** into `assets/photography/de-headshots/ORIGINAL/` (spotlight stays gated).
2. **Drop Envato `4THD2PH` ZIP** into `assets/licensed/envato-4THD2PH/ORIGINAL/` when ready.
3. **Rotate Meshy API key** if it was exposed in chat — do not leave the old key active.
4. **Go-ahead for Batch 02** when ready (Essential security — large set; next phase).

---

## 7. Guardrails honored

- No homepage redesign / no CTA / form / SEO removal
- No mega-menu or portal Lucide replacement
- Licensed sources stay private; only optimized derivatives public
- Identity placed once (outcomes card) — not icon salad
- Hero mockup left for composition stage
- Founder / Envato still waiting on DE drops — no invented photos or fake ZIP
