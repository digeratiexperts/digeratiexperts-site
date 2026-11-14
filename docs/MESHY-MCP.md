# Meshy MCP — Digerati Cursor workflow

**Date:** 2026-08-08  
**Status:** Connected — Batch 01 preview meshes done; **Identity regenerating**; refine deferred.  
**Related:** `docs/MESHY-ASSET-BACKLOG.md` (Batches 01–10), `docs/MESHY-BATCH-01.md`, `docs/VISUAL-SHOPPING-LIST.md`

---

## Confirmed setup

| Item | Value |
|---|---|
| Plan | **Meshy Premium** (~**3,100** credits; ~140 used on batch-01 first pass) |
| Cursor MCP server | **`user-meshy`** |
| Server status | `ready` (verified via GetMcpTools) |
| Tools | 24 `meshy_*` tools (+ `mcp_auth`) |
| Key name | `Digerati-Cursor` (local only) |
| Role vs Envato | Envato `4THD2PH` = primary stock; Meshy = controlled brand library (~**40** core, selective page use) |
| Highest-value set | ~**25** security/IT + ~**10** industry + ~**10** compositions |

### Tools available (do not call generate until approved)

`meshy_check_balance`, `meshy_list_tasks`, `meshy_list_models`, `meshy_get_task_status`, `meshy_cancel_task`, `meshy_download_model`, `meshy_text_to_3d`, `meshy_text_to_3d_refine`, `meshy_image_to_3d`, `meshy_multi_image_to_3d`, `meshy_text_to_image`, `meshy_image_to_image`, `meshy_retexture`, `meshy_remesh`, `meshy_rig`, `meshy_animate`, `meshy_convert`, `meshy_resize`, `meshy_uv_unwrap`, `meshy_process_multicolor`, `meshy_creative_lab`, `meshy_analyze_printability`, `meshy_repair_printability`, `meshy_send_to_slicer`

---

## Security — never commit keys; rotate if exposed

- Store `MESHY_API_KEY` in the user environment and/or `~/.cursor/mcp.json` only.
- **Never** commit keys, paste them into repo docs, or leave them in chat logs as the long-term secret.
- If a complete API key was posted in chat earlier: **rotate** (create new key → update local config → revoke old key). Template PowerShell is in the “Key rotation” section below — no real keys in this file.

---

## Style constraints (all Meshy work)

- Dark premium MSP look; accent **violet / fuchsia**
- Soft plastic / clay 3D (Envato-adjacent), clean marketing iconography
- **Global avoid list:** threatening humans, masks, hoods, faces, skulls, insects, weapons — threat assets stay clean/abstract
- Sources stay under `assets/licensed/meshy-*/` — gitignored; never under `client/public` or `public/`
- Derivatives only for the Digerati site after inventory + DE approval

### Export layout

```
C:\Users\Joe\Projects\digeratiexperts-site\assets\licensed\meshy-batch-01\ORIGINAL\
  <concept-slug>\
    *.glb / *.fbx / previews…
```

Website-ready derivatives only after inventory + approval (same rules as Envato packs).

---

## Recommended build order (production)

Full backlog: **`docs/MESHY-ASSET-BACKLOG.md`**.

| Step | Action | Notes |
|---|---|---|
| **1** | Regenerate **Identity** | In flight separately; badge/card + shield/keyhole/MFA — no people/rings/bowls |
| **2** | Refine four approved Batch 01 (+ Identity when approved) | Endpoint, Email, Network, Backup shapes already approved |
| **3** | Generate **Batch 02** | Essential security (MFA, Zero Trust, Firewall, EDR, etc.) |
| **4** | Assessment, SOC, hero ecosystem **compositions** | Batch 10 priority subset |
| **5** | Compliance + managed IT | Batches 04–05 |
| **6** | Industry only for pages being redesigned | Batch 08 — do not pre-build all |
| **7** | Threat / problem **sparingly** | Batch 09 — abstract containment only |
| **8** | Communications / secondary **last** | Batches 06–07 |

**Next gate after Identity approval:** refine Batch 01 → then Batch 02. Do **not** auto-spend credits without DE go-ahead per step.

---

## FIRST generation brief — APPROVED & RUN (batch-01)

DE approved Text-to-3D batch-01 on 2026-08-08. Full prompts, task IDs, paths, and credit log: **`docs/MESHY-BATCH-01.md`**.

### Recommended first batch (5 concepts)

| # | Concept | Subject (soft plastic icon) | Mode | Why |
|---|---|---|---|---|
| 1 | **Identity** | Badge / shield + person silhouette (MSP identity) | **Text-to-3D** first (Meshy-6), refine if needed | Strong brand opener; no Envato ref required |
| 2 | **Endpoint** | Laptop / device with soft shield corner | **Text-to-3D** (or Image-to-3D once Envato PNG style ref exists) | Core MSP service visual |
| 3 | **Email** | Rounded envelope + lock / check | **Text-to-3D** | Common subject-page gap |
| 4 | **Network** | Soft node cluster / cloud link (no skull/bug) | **Text-to-3D** | Easy to go “hacker” — prompt must stay MSP-safe |
| 5 | **Backup** | Cloud + cylinder / drive stack | **Text-to-3D** | Complements Envato stock themes |

**Image-to-3D:** Prefer after Envato `4THD2PH` PNGs are on disk (use one soft-plastic still as style/reference). Edge tab + `Digerati-Cursor` is ready for that path — **not** the first spend unless DE supplies a reference image now.

**Defaults when approved:** `ai_model: meshy-6` (or `latest`), `target_formats: ["glb","fbx"]`, textured on, download into `assets/licensed/meshy-batch-01/ORIGINAL/<slug>/`.

### Estimated credit cost (first 5 — Meshy-6)

| Path | Per asset | ×5 | Notes |
|---|---|---|---|
| Text-to-3D preview only | ~20 | ~**100** | Mesh check; may need refine |
| Text-to-3D + refine (texture) | ~20 + ~10 | ~**150** | Likely path for site-ready look |
| Image-to-3D textured | ~20–30 | ~**100–150** | After style reference available |
| Buffer for 1–2 retries | — | +**40–60** | Budget ~**200** for batch-01 |

~200 credits ≈ ~6% of ~3,100 — leaves headroom for a later 10–20 concept program.

### Prompt guardrails (all five)

Include: soft plastic 3D icon, dark charcoal base, violet and fuchsia accents, clean MSP marketing, centered single object, studio lighting.  
Exclude: hooded figure, hacker, skull, malware insect, ransomware, greasy cyberpunk clutter, photoreal people.

---

## Key rotation (PowerShell template — no real keys)

1. Create a **new** API key at [meshy.ai/settings/api](https://www.meshy.ai/settings/api) (name e.g. `Digerati-Cursor-2`).
2. In a **new** PowerShell window (do not echo the key into logs):

```powershell
# Paste when prompted — value is not echoed to the console history the same way as plain args
$newKey = Read-Host "Paste new Meshy API key"

# Persist user env for future shells / MCP
setx MESHY_API_KEY $newKey | Out-Null

# Update Cursor MCP config (path may vary — adjust if your mcp.json lives elsewhere)
$mcpPath = Join-Path $env:USERPROFILE ".cursor\mcp.json"
if (-not (Test-Path $mcpPath)) { throw "mcp.json not found at $mcpPath" }
$json = Get-Content $mcpPath -Raw | ConvertFrom-Json

# Typical shapes: env.MESHY_API_KEY on the meshy server entry — adjust property path to match your file
# DO NOT commit mcp.json if it contains secrets; keep it user-local.
$servers = $json.mcpServers
if (-not $servers) { $servers = $json.servers }
# Inspect once: $servers | Get-Member / ConvertTo-Json  — then set the meshy entry's env.MESHY_API_KEY = $newKey
# Example if key path is mcpServers.meshy.env.MESHY_API_KEY:
# $json.mcpServers.meshy.env.MESHY_API_KEY = $newKey
# ($json | ConvertTo-Json -Depth 20) | Set-Content $mcpPath -Encoding utf8

Remove-Variable newKey -ErrorAction SilentlyContinue
Write-Host "Updated local env. Restart Cursor, then revoke the OLD key in Meshy settings."
```

3. **Restart Cursor** so MCP reloads the new key.
4. In Meshy settings: **revoke** the old key (the one that may have been exposed in chat).
5. Optional sanity check (free): call `meshy_check_balance` via MCP — do not generate until the first brief is approved.

---

## Reminder

- Still drop **Envato `4THD2PH`** ZIP → `assets/licensed/envato-4THD2PH/ORIGINAL/` when ready.
- Identity regen is separate; **do not refine** Batch 01 until DE approves the new Identity shape.
- After Identity approval: refine Batch 01 (~10/asset) → Batch 02 — see `docs/MESHY-ASSET-BACKLOG.md`. Do not auto-spend.
