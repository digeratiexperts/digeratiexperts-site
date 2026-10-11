# DE Tech Tool storage: next-AI handoff

## User authorization and objective

Joe approved building the first storage slice inside the EXISTING GitHub DE Tech Tool on 2026-10-11. He wants a premium technician product, not another weak separate cleaner or a bundle of wrappers. Minimum sources/capability references: CTT WinUtil, BleachBit, DISM/DISM++, WizTree or WinDirStat, PowerShell automation; Microsoft PC Manager appears in his comparison. Prefer native DE implementations and reviewed reusable upstream source, respecting licences.

Joe additionally asked for: (1) the URL of the page; (2) scanning drives to recommend OS/storage/custom roles and the fastest transfer pairings based on actual storage technology; (3) an intuitive thinking engine able to support these and further recommendations; (4) document everything for the next AI because only ~1% usage remained; then (5) continue the build and output the complete tool inventory. These are cumulative instructions, not cancellation.

## Canonical location and governance

- Repo: `digeratiexperts/digeratiexperts-site`, main at task start **72cdd50e56f911c2779c03e9b0abbb0971e94781**.
- Branch: `chatgpt/tech-tool-storage-20261011`.
- Claim: https://github.com/digeratiexperts/digeratiexperts-site/issues/579.
- Windows source: `.claude/skills/msp-ai-kit/windows/`.
- Native application entry: `Start-DETechTool.cmd -Page Storage`.
- Product inventory, URLs, commands, safety limits and upstream matrix: `STORAGE.md` beside this handoff.
- Read `AGENTS.md`, `docs/AI-ENGINEERING-GOVERNANCE.md`, `docs/ACTIVE-WORK-COORDINATION.md` BEFORE editing. Recheck all active issues/open PR file sets/relevant branches, then YAML. Work in isolated checkout. Claude Code remains lead integrator; this session has not been assigned independent merge/deploy authority.
- Open PRs #542,550,553,557,559,560,564,565,570,571,572,574,575,576,578 file lists were inspected before coding; none modifies the Windows tool paths. YAML has historic/merged Tech Tool licensing/contracts/rescue/Microsoft-admin claims. Preserve them. Remote `claude/msp-ai-skills-prompts-htqi09` was inspected; it is a prior branch, not the base of this implementation.
- No production credentials/data or real user drives were accessed. All runtime verification so far uses disposable local fixtures.

## Existing product

Read `DE-TECH-TOOL-ARCHITECTURE.md`, `README-WINDOWS.md`, `GO-LIVE.md` and `PROTECTING-THE-TOOL.md`. Existing version file says **1.11.0**; storage work does not bump or sign a release yet. Existing WPF pages, client profiles, engine, signing/licences, ProActive plans, vendor adapters, boot rescue, Microsoft admin, email migration and signed Hub contracts are preserved. The future outbound mTLS Tech Agent is a roadmap item.

## Added code

1. `console/modules/DE.Storage/DE.Storage.psm1`: original DE metadata scanner, volume inventory, Windows topology, explainable drive-role/transfer rule engine, cleanup plans/results, native Windows deletion by verified handle, supported DISM servicing, hash-verified relocation and separate source removal, receipt/evidence helpers.
2. `console/modules/DE.Workflow/DE.Workflow.psm1`: module loader adds DE.Storage only.
3. `console/DETechConsole.ps1`: Storage navigation/page, headless StorageAction parameters/dispatcher, existing async job path reused; a NoCancel switch hides cancel for DISM. Existing product pages/functions preserved.
4. `console/tests/Invoke-StorageRegression.ps1`: offline self-contained fixtures without external modules.
5. `console/tests/Storage.Tests.ps1`: calls the offline suite under the existing Windows Pester CI.
6. `STORAGE.md`, this handoff: inventory, user requirements, source/licence matrix, commands and limits.

## Verified so far

- PowerShell 7.4.6 Linux runtime was downloaded from the official PowerShell GitHub release for local syntax/fixture checks (scratch dependency only).
- All console PowerShell sources parsed under that runtime; original verified-file C# compiled before embedding into the signed PowerShell module. Embedded source avoids a shipped executable-code file outside the existing integrity manifest.
- Offline storage fixture suite: **29 checks passed** before latest documentation/last safety edits; rerun after every code change. Covers counts/literal paths, partial scans, invalid/nested roots, WhatIf, audit block, copy/durable receipt, source retention, SHA-256 verification, completed-file resume, destination mismatch/unrelated files, typed removal, changed source, protected Git project, stale/forged cleanup, symlink avoidance, low-space OS recommendation, HDD archive, custom roles, separate NVMe pair estimate, same-disk partitions and unknown USB.
- Windows-only native handle deletion, locked-file behavior and ADS refusal are included in the same suite and await Windows CI execution.
- `msp-ai-kit.yml` already runs Windows PowerShell 5.1 parsing/Pester and every WPF page at 1440x900 and small/125% layout, plus uploads renders and emits JPEG/base64 renders in job logs. The new Storage page is enumerated automatically. Retrieve actual renders and LOOK before marking ready.
- External local Pester/PSScriptAnalyzer module installation was rejected by automatic approval review because a telemetry request went to an untrusted Microsoft endpoint with unestablished payload and potential machine/usage metadata disclosure. Do not bypass that rejection by re-running through another tool. Continue offline checks and repository CI; report the block honestly. The rejected process was not used for test evidence.

## Remaining release gates / issues to investigate

- Publish/preserve branch and draft PR first so work survives remaining usage. Record exact commit and CI results in issue/PR/handoff.
- Run local offline tests again; run appropriate existing kit tests; open PR triggers canonical Windows CI. Do not claim Windows 5.1/native deletion/WPF validated until CI passes and screenshots have been inspected.
- Inspect actual WPF rendering and interactions: Storage initial page, recommendation grids, scanned preview, cleanup selection, relocation result and explicit source-removal controls. Initial generic smoke may not cover populated Storage states: extend fixtures/smoke if necessary.
- Review Windows native deletion (CreateFile READ|DELETE, share READ, metadata/hash, FileDispositionInfo) using real disposable files under Windows. Reject hardlinks, reparse/cloud/read-only/system and locked files; hold destination read lock during source deletion.
- Cancellation can leave one `.DE-transfer-*.partial` file beside the destination; it is documented and never auto-deleted. Completed-file resume works, partial-file resume is not implemented.
- Relocation is file-content transfer, not full backup/application migration; no ACL/hardlink topology preservation, ADS/EFS refused, empty directories not copied. Apply source removal only after user/client closes writers and confirms actual paths. Never move entire active profiles.
- Directory ancestor replacement by a hostile admin is outside the current safety model. Before any privileged untrusted-input background agent: strengthen handle-relative traversal/path identity, receipt trust, immutable signed action/job catalogs and per-device mTLS. No arbitrary remote shell.
- Cleanup receipt reports deleted logical bytes, not an independently sampled free-space delta. Add actual before/after volume-space reporting without claiming unrelated background changes were reclaimed by DE.
- DISM stdout currently collected until command completes; UI stays async but live servicing percent/log tail is not implemented. No GUI cancel for DISM, but review window-close behavior so a running service is not accidentally killed by runspace teardown.
- Drive topology uses serial matching; unknown/pooled/virtual backing remains explicit. Negotiated link/controller/sustained speeds are NOT measured. No fabricated MB/s or assertion that J/I/G are NVMe from drive letters/free-space output alone.
- Extend native treemap and optional NTFS/MFT analyzer only after source/licence decisions. Keep existing scanner fallback for unsupported filesystems/non-admins.
- Upstream CTT/BleachBit/DISM++/WinDirStat code integration remains UNIMPLEMENTED in this slice. The source/license matrix is a research checkpoint, not a completed integration.
- Hosted DE product/download URL not verified; give GitHub source/doc URL and native `-Page Storage`. Build a branded authenticated technician launch/download page as a separate coordinated slice, preserving Hub operational authority; don't invent a route or publish an unverified signed download.
- Reconcile latest main/open PRs before integration; specialist must not self-merge. Signed release, licensing, install/update, package hash, Windows laptop audit and production/Hub proof are separate gates.

## Drive-thinking engine direction

Implemented now: deterministic explainable facts → role suggestions + pair ranking, with custom-use preferences in `Get-DEStorageRecommendations -CustomUse`, confidence, errors and limitations. No cloud AI, no data upload, no destructive autonomous action.

Next: collect physical controller/topology, negotiated PCIe/USB links and health/endurance facts with documented API evidence; user-approved bounded read/write benchmarks using temporary test files only, sufficient free-space reserve and thermal/current-load context; mixed large-file vs many-small-file profiles; role planner across OS/apps/DE_WORK/APPS_DATA/archive/backup/custom with capacity/growth constraints; optional AI explanations from sanitized facts. AI output proposes actions, never grants execute authority. Recommendations must state facts, inference, confidence, expected benefit, compatibility, risk and required approval. Distinguish same-volume rename from cross-volume copy and shared disk/controller paths. Verify backup independence and recoverability.

## Joe's reported drive state (historical, not a live scan)

C 1.09 GB free; J Apps_Tools 421.06 GB; I DE_WORK 953.73 GB; G APPS_DATA 931.38 GB; H 8TB Backup 790.91 GB; D Storage 7130.49 GB. Screenshots reportedly showed C NVMe, low disk active time and high Explorer CPU while moving tens/hundreds of thousands of files. Source/destination exact paths remain unknown. Never start deletion or profile relocation from these historical numbers.

## Resume commands

```powershell
# offline fixtures, no module install needed
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .claude\skills\msp-ai-kit\windows\console\tests\Invoke-StorageRegression.ps1
# canonical Pester (on a Windows host where installed/approved)
Invoke-Pester .claude\skills\msp-ai-kit\windows\console\tests\Storage.Tests.ps1
# real WPF smoke
powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -File .claude\skills\msp-ai-kit\windows\tests\Invoke-GuiSmoke.ps1 -OutDir <temporary-evidence-folder>
```

## DE handoff state

Objective: existing DE Tech Tool native storage workspace + drive intelligence.
Owner: ChatGPT/Codex; lead integrator: Claude Code.
State: implementation and local fixture tests; release validation pending. Not merged/deployed/LIVE.
USAGE SIGNALS: Joe reported ~1% remaining usage and requested durable complete handoff. No subagents used. No paid AI API calls. Local test-module install blocked by auto-review; offline checks used instead.
