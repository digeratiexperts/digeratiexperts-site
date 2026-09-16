# Visual shopping list — cybersecurity packs

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

**Date:** 2026-08-08  
**Goal:** Dark premium MSP visuals (violet/fuchsia), not hooded-hacker.  
**Sources stay private** under `assets/licensed/*/ORIGINAL/` — never in `client/public` or `public/`.

---

## Buy / download order

### TODAY — Envato only ([pricing](https://elements.envato.com/pricing))

Core plan (~$16.50/mo annual or $39/mo) is enough. Unlimited stock downloads; each download licenses one project; **no redistributing source ZIPs/BLEND/OBJ/FBX/PSD**.

| Priority | Pack | Action |
|---|---|---|
| **1 — do now** | [Envato `4THD2PH`](https://elements.envato.com/cyber-security-3d-icon-pack-4THD2PH) (macmaster3d) | Download **entire** ZIP → `assets/licensed/envato-4THD2PH/ORIGINAL/` |
| **2 — same session** | [Envato `QUCF9E5`](https://elements.envato.com/cyber-security-3d-icon-pack-QUCF9E5) (GavStd) | Optional backup style (16 icons). Drop at `assets/licensed/envato-QUCF9E5/ORIGINAL/` if you grab it |

### IconScout — wait

Do **not** subscribe yet. Inventory Envato #1 first.

| Pack | Verdict |
|---|---|
| [Semusim Kreatif 20](https://iconscout.com/3d-icon-pack/cybersecurity-3d-icon-pack_234707) (`234707`) | **Preferred if still needed** — MSP-safe themes (cloud/device/biometrics). Skip **Incognito** icon. |
| [Design Circle 50](https://iconscout.com/3d-icon-pack/cyber-security-707_365019) (`365019`) | **Wait / skip** — larger set but heavier malware/carding/bug threat look. Only if #1 + Semusim leave real gaps. |

### Lottie — later (after static 3D system)

| Pack | Verdict |
|---|---|
| [LottieFiles `260657`](https://lottiefiles.com/marketplace/cybersecurity-icon-pack_260657) | **Not 50 Lotties** — IconScout lists this ID as **50 line icons (SVG/PNG)** by Blinix. Skip for hero 3D / motion. |
| [Data Protection 25](https://lottiefiles.com/marketplace/cybersecurity-data-protection-animation-pack_372187) / [IconScout mirror](https://iconscout.com/lottie-animation-pack/cybersecurity-data-protection-animation-pack_372187) | Real **25 Lottie JSON + GIF**. Useful later for motion; many skull/malware frames — cherry-pick padlock/VPN/encrypt only, or find a cleaner pack. |

### Skip for now

- FreeVector / Magnific (Freepik) — free catalogs exist; brand/license/quality not worth the detour until paid packs are in.

### Meshy.ai — Premium + Cursor MCP (confirmed 2026-08-08)

**Envato `4THD2PH` remains the primary stock pack.** Meshy is complementary: a reusable Digerati library of ~**40 core assets** with **selective page use** — not a dump of every mesh onto every page. Highest-value set ≈ **25** security/IT + **10** industry + **10** compositions. Full backlog: **`docs/MESHY-ASSET-BACKLOG.md`**.

| Topic | Status |
|---|---|
| Plan | **Meshy Premium** — ~**3,100 credits** at start (batch-01 first pass used ~140) |
| Cursor MCP | Connected as server **`user-meshy`** (`serverStatus: ready`, 24 Meshy tools) |
| API key | Configured locally for key name **Digerati-Cursor** — **never commit**; **rotate** if the full key was posted in chat (see `docs/MESHY-MCP.md`) |
| Commercial license | Paid plans (Pro+): commercial use + private ownership. Free = CC BY — do not use for DE brand work. Sources under `assets/licensed/` only; derivatives for the site only — never `public/`. |
| Credit burn (Meshy-6) | Image→3D ≈ **5–30** (meshy-5 cheaper / meshy-6 ~20; textured toward upper end); Text→3D preview ≈ **5–20**; refine/retexture ≈ **10**. Confirm cost before any generate call. |
| Export path | `assets/licensed/meshy-<batch>/ORIGINAL/` (gitignored binaries) — never `client/public` / `public/` |
| Avoid list | Threatening humans, masks, hoods, faces, skulls, insects, weapons; threat assets clean/abstract |

**Recommended Meshy build order:**

1. Regenerate **Identity** (in flight separately).
2. Refine Batch 01 — **done** (all five).
3. Generate **Batch 02**.
4. Assessment, SOC, and hero ecosystem compositions.
5. Compliance + managed IT.
6. Industry only for pages being redesigned.
7. Threat / problem sparingly.
8. Communications / secondary last.

**Next gate:** Batch 02 Essential security (when DE is ready).

See **`docs/MESHY-ASSET-BACKLOG.md`** for Batches 01–10 and **`docs/MESHY-MCP.md`** for MCP tools / prompts.

---

## Pack comparison (public pages)

| # | Pack | Count / themes | Formats (listed) | Style / brand fit | License note |
|---|---|---|---|---|---|
| 1 | Envato macmaster3d `4THD2PH` | **20** premium cyber icons | **BLEND, OBJ, FBX, PNG** 3000×3000 | Soft plastic 3D — best primary for DE | Website end-product OK; **no source redistribution** |
| 2 | Envato GavStd `QUCF9E5` | **16** minimal 3D | **OBJ, PSD, PNG** 2000×2000 (no BLEND/FBX listed) | Minimal clay 3D — good backup | Same Envato rules |
| 3 | IconScout Semusim `234707` | **20** — cloud secure, biometrics, folder/PC/phone, wifi; + Incognito | IconScout 3D: typically **PNG, BLEND, FBX, GLTF** | Soft plastic colorful 3D — strong MSP fit if Envato gaps | IconScout RF digital; sources not public |
| 4 | IconScout Design Circle `365019` | **50** — VPN, firewall, cloud… plus malware/carding/bugs | Same IconScout 3D set | Mixed; threat-heavy subset risks hacker aesthetic | Same |
| 5 | Marketplace `260657` | **50 line icons** (not Lottie) | **SVG, PNG** | Flat line UI icons — wrong lane for 3D hero | Skip for this phase |
| 6 | Iconique `372187` | **25** Lotties — encrypt, VPN, malware/skull alerts | **Lottie JSON, GIF** (+ AE-friendly workflow) | Motion later; filter out skull/threat frames | No AE/source dump in `/public` |

---

## Cursor + subscriptions

| Source | Can Cursor use DE’s subscription directly? |
|---|---|
| Envato / IconScout / LottieFiles | **No** — DE downloads ZIPs / exports → drop locally → agent inventories. |
| Meshy (Premium + API key + MCP) | **Yes, via MCP** — Cursor server **`user-meshy`** (ready). Never paste the key in chat; never commit it; rotate if exposed. See `docs/MESHY-MCP.md`. |

Drop pattern (stock packs):

```
C:\Users\Joe\Projects\Replit-Site\assets\licensed\envato-4THD2PH\ORIGINAL\<envato-zip>.zip
C:\Users\Joe\Projects\Replit-Site\assets\licensed\envato-QUCF9E5\ORIGINAL\<envato-zip>.zip   (if bought)
C:\Users\Joe\Projects\Replit-Site\assets\licensed\meshy-<batch>/ORIGINAL/   (MCP or web exports)
```

Then ping the agent to unpack (private folders only) and continue `docs/VISUAL-ASSET-AUDIT.md`.
