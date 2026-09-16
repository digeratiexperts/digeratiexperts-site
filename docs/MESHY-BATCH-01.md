# Meshy batch-01 — generation log

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Date:** 2026-08-08  
**Status:** **Complete** — Identity approved; all five refined + public derivatives published  
**MCP server:** `user-meshy`  
**Mode:** Text-to-3D preview → refine · `ai_model: meshy-6` · formats `glb` + `fbx` + `obj` · `alpha_thumbnail: true`

---

## DE review

| Concept | DE decision |
|---|---|
| Endpoint | **APPROVED** |
| Email | **APPROVED** |
| Network | **APPROVED** (abstract OK) |
| Backup | **APPROVED** |
| Identity | **APPROVED** (v4 ID badge — agent finish-up; reads as badge/auth after refine) |

**Refine:** Completed 2026-08-08 on all five (~50 credits). Dark charcoal + violet/fuchsia materials.

---

## Credit estimate

| Item | Credits |
|---|---|
| Opening balance | **3100** |
| First-pass 5 concepts | 5 × 20 = **100** |
| Identity retries (v2–v3) | 2 × 20 = **40** |
| Identity regenerate v4 | 1 × 20 = **20** |
| Refine ×5 | 5 × 10 = **50** |
| **Approx used** | **~210** |
| Closing balance (post-refine) | **~2890** |
| Batch 02+ | **Not started** — next phase |

---

## Export root (gitignored binaries)

```
C:\Users\Joe\Projects\Replit-Site\assets\licensed\meshy-batch-01\ORIGINAL\
  identity\          ← v4 clay + *-refined.glb + refined preview PNGs
  identity\_rejected\v3-checkmark-shield-019fe3f2\
  endpoint\
  email\
  network\
  backup\
```

Each concept folder contains clay preview meshes, `*-refined.glb` (+ textures), and current refined `*-preview.png` / `*-preview-alpha.png` (clay copies saved as `*-preview-clay.png` where applicable).

Public derivatives (committed):

```
client/public/images/visual-system/meshy-batch-01/
  {endpoint,email,network,backup,identity}.{webp,png}
  {slug}-256.webp
```

Optimize: `node scripts/optimize-meshy-batch01.mjs`

---

## Results per concept

| Concept | Status | Preview task ID | Refine task ID | Notes |
|---|---|---|---|---|
| **Identity** | Approved + refined | `019fe3fb-5218-7280-a649-860f5f1e09ef` | `019fe452-259b-7a89-82de-2d047cec4342` | Upright ID badge + shield/keyhole; dark + violet accents |
| **Endpoint** | Approved + refined | `019fe3ec-a126-7062-adb2-a56579f77ef7` | `019fe452-292b-7de0-8008-d5441d9990d6` | Laptop + shield |
| **Email** | Approved + refined | `019fe3ec-a412-7063-b9fb-da51cf638d8f` | `019fe452-2bfb-7a8a-81b5-c12e24d06804` | Envelope + padlock |
| **Network** | Approved + refined | `019fe3ec-a5a1-7773-b921-3304bae929e5` | `019fe452-2dbb-7424-b839-6fff2f266815` | Node cluster |
| **Backup** | Approved + refined | `019fe3ec-aaca-7064-add0-3e2109cee9bc` | `019fe452-30f9-7425-9259-7b69490bffc2` | Cloud over drives |

---

## Site placement

| Asset | Placement |
|---|---|
| Identity | Homepage outcomes — “Protect identities and devices” |
| Backup | Homepage outcomes — “Keep the business recoverable” |
| Network | Homepage outcomes — “Protect and monitor…” + How it works intro |
| Email | Homepage engagement assessment band |
| Endpoint | Solutions — Threat Detection & Response |
| Network / Backup | Solutions — Managed Network / Backup & DR |

Registry: `client/src/lib/visualAssets.ts`

---

## Identity retry log

| Ver | Task ID | Outcome |
|---|---|---|
| v1 | `019fe3ec-9e59-7061-8dfb-083aad46e7f2` | Hooded silhouette — rejected |
| v2 | `019fe3f0-cc59-7100-9029-6519a1e65031` | Weak/ambiguous — rejected |
| v3 | `019fe3f2-e43b-7160-af02-922442e66961` | Dish/ring — rejected; archived |
| **v4** | `019fe3fb-5218-7280-a649-860f5f1e09ef` | ID badge + shield/keyhole — **approved + refined** |

---

## Next phase

1. **Batch 02** Essential security (planned — do not start until DE ready / credits comfortable).
2. Assessment / SOC / hero ecosystem compositions (Batch 10 subset).
3. Do **not** remesh / rig / animate unless a deliverable needs it.
