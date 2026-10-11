# DE Tech Tool: native storage workspace

Status: implementation branch / Windows release validation pending. **Not merged, not LIVE, not a production download.**

- Canonical product source: https://github.com/digeratiexperts/digeratiexperts-site/tree/main/.claude/skills/msp-ai-kit/windows
- This build: https://github.com/digeratiexperts/digeratiexperts-site/tree/chatgpt/tech-tool-storage-20261011/.claude/skills/msp-ai-kit/windows
- Work claim: https://github.com/digeratiexperts/digeratiexperts-site/issues/579
- Local Windows workspace: launch `Start-DETechTool.cmd -Page Storage` (or choose **Storage & cleanup**).
- The Windows WPF workspace is a native application page. A hosted product/download page has not been verified in this session. Do not claim a guessed website route exists. The Hub operational app is https://techsales.digerati-experts.com; verify its exact Tech Hub navigation separately.

## What is in the existing DE Tech Tool

The current canonical architecture and README document these capabilities; this storage change does not re-certify every vendor integration or installed build.

| Area | Existing product capabilities |
|---|---|
| Session and workflow | Scan & fix, desired-state plans, audit/apply/verify, exceptions, remediation/rollback where supported, repair/takeover/new/replacement/co-managed/deprovision modes, restart/resume, client profiles, technician context |
| Identity | JumpCloud-first onboarding, account mapping and binding, group/policy checks, Device Trust, identity migration gates, local break-glass controls, BitLocker escrow and migration checks |
| Security | DE security stack deployment and posture; Guardz primary, Blackpoint approved alternate/backup, SentinelOne; preservation of DE policy gates |
| Endpoint setup | Application/package catalog and winget, browser policies, Windows baseline, network/site configuration, canonical identity/location/network naming |
| Branding | DE/client assets, wallpaper, enforced company lock screen, OEM/About info, pre-logon authorized-use notice, recorded restoration state |
| Automation | Pinned Toolbox, command-line page, headless/RMM execution, background jobs, progress, runbook/playbooks, ProActive tiers/add-ons/standalone families, dropship orders and device binding |
| Microsoft administration | Graph/Entra, Microsoft 365, Exchange, Intune/Autopilot, Azure, certificate-based Hub worker; separate signed job contract |
| Email migration | Gmail discovery across Windows accounts, Microsoft 365 migration project records, next steps/checklists/bounce diagnostics, signed Hub records |
| Evidence and operations | Local logs/evidence bundles/reports, warranty lookup, signed Hub intake, failed-send reason/offline retention, client/profile/device context |
| Product control | Device-bound Hub licences, revocations, build binding, watermarked builds, integrity/signing, packaging/Intune deployment, Settings |
| Boot rescue | WinPE USB/ISO, typed BitLocker unlock without logging secrets, profile preservation, driver export, disk health, boot repair, stuck-update revert, offline/signed handoff |

An outbound DE Tech Agent with mTLS and allowlisted signed jobs is a **roadmap item**, not a completed agent. Do not describe an arbitrary remote PowerShell service as included.

## Added by this branch

| Capability | Implemented behavior |
|---|---|
| Drive capacity | Ready fixed volumes, free bytes/percentage and low/critical-space status |
| Native folder analysis | Iterative metadata traversal, largest files and folder totals, logical byte counts, bounded retained results, 250,000-file default safety limit, explicit partial/unreadable/skipped results |
| Drive intelligence | Windows Storage/CIM facts, drive-to-disk mapping, serial-based physical-media match, model/bus/media/health facts, OS detection, explainable role suggestions, directed pair ranking and same-disk warnings |
| Selected cleanup | Exact local Windows Temp / current user's Temp / current user's `.dmp` CrashDumps targets; 7/30-day age gates, reviewed rows, no automatic selection, stale-plan rejection and per-file result receipt |
| Native deletion guard | Windows handle-based metadata/hash verification, denies concurrent file writes/renames/deletes, refuses links/cloud/system/read-only/hardlinked files, records skipped/locked failures |
| Native relocation | Complete non-cloud/link scan, capacity reserve, copy retained source, SHA-256 verification of both sides, completed-file resume, no differing-file overwrite, unrelated destination refused; source removal is separately confirmed and reverified |
| Windows servicing | AnalyzeComponentStore, CheckHealth, ScanHealth, RestoreHealth, StartComponentCleanup, separately acknowledged ResetBase; supported native DISM, elevation/reboot gates, exit/restart results and local receipt |
| Console + RMM | Storage navigation, native WPF forms, existing background jobs/progress, console audit/live/integrity/licence controls, explicit headless commands, local receipts and summary evidence |

## Headless examples (Windows PowerShell 5.1 or PowerShell 7 on Windows)

Run through the existing console; `-Apply` is required for changes. Choose a real approved client profile for apply and provide the technician. Substitute actual local paths and reviewed IDs.

```powershell
.\Start-DETechTool.cmd -Page Storage
.\Start-DETechTool.cmd -Headless -StorageAction RecommendDrives -Technician jrpetro
.\Start-DETechTool.cmd -Headless -StorageAction Scan -StoragePath 'C:\' -Technician jrpetro
.\Start-DETechTool.cmd -Headless -StorageAction PlanCleanup -StorageCategory user-temp -Technician jrpetro
# Receipt path is returned as the result bundle. Inspect the JSON entries before selecting IDs.
.\Start-DETechTool.cmd -Headless -Client alamo -Technician jrpetro -StorageAction Cleanup -StorageRecord 'I:\reviewed-cleanup-plan.json' -StorageSelectedId '<reviewed-entry-id>' -WhatIf
.\Start-DETechTool.cmd -Headless -Client alamo -Technician jrpetro -StorageAction Cleanup -StorageRecord 'I:\reviewed-cleanup-plan.json' -StorageSelectedId '<reviewed-entry-id>' -Apply
.\Start-DETechTool.cmd -Headless -StorageAction PlanRelocation -StoragePath 'C:\Projects\AI' -StorageDestination 'I:\Projects\AI' -Technician jrpetro
.\Start-DETechTool.cmd -Headless -Client alamo -Technician jrpetro -StorageAction Copy -StorageRecord 'I:\reviewed-relocation-plan.json' -Apply
.\Start-DETechTool.cmd -Headless -StorageAction Verify -StorageRecord 'I:\successful-copy-receipt.json' -Technician jrpetro
# Removal requires separate approval and the exact source path. It re-hashes every source and destination file.
.\Start-DETechTool.cmd -Headless -Client alamo -Technician jrpetro -StorageAction RemoveSource -StorageRecord 'I:\successful-copy-receipt.json' -StorageConfirmSource 'C:\Projects\AI' -Apply
.\Start-DETechTool.cmd -Headless -Client alamo -Technician jrpetro -StorageAction Servicing -StorageServicing StartComponentCleanup -Apply
```

Headless returns a result line plus optional `-ResultFile`, uses existing 0/1/2 conventions, and does not require a client for read-only storage discovery. Detailed local receipts are under the protected DE data folder's `storage/`. Evidence records summarize count/bytes/result; per-file paths remain in the local receipt.

## Storage safety and limits

- Read-only scanning reports **logical length**. Hardlinks, compression, sparse allocation and permissions mean this is not necessarily disk allocation or reclaimable bytes. File counts are bounded; a partial scan is never sufficient to relocate/delete a whole folder.
- No link/junction/offline/cloud-placeholder traversal or hydration. No direct WinSxS, Windows Installer cache or registry cleanup. No broad Defender exclusions or disabled protection. No automatic browser-profile deletion, free-space wiping, partitioning or OS migration.
- Cleanup protects project/config subtrees, recently created/modified files, system/read-only files and locked files. Temp cleanup is not reversible. Approval is specific to reviewed file IDs.
- Source removal keeps directories and any new files. It is not an application migration: update application paths, services, environment variables and shortcuts deliberately. Stop competing Explorer moves and close writers first.
- Relocation copies file content/timestamps, not ACLs, ADS, EFS metadata or hardlink relationships. ADS/EFS detected at planning are refused. Do not use it as a forensic/full-system backup. Empty directories are retained at the source but are not recreated by the current file-copy implementation.
- Incomplete files are staged as sibling `.DE-transfer-<guid>.partial` files outside the destination tree; interruption can leave them for technician review. Completed destination files can be resumed. No automatic orphan-stage deletion.
- Same-device partitions are not independent backups. Backups need independent recoverable copies and an offsite/offline strategy.
- Drive ranking is a **technology-based estimate**, not benchmark data. Unknown/RAID/Storage Spaces/virtual backing is not given an unsupported speed ranking. Negotiated USB/PCIe speed, controllers, encryption, thermal state, competing IO and workload affect performance.
- DISM servicing has no GUI Cancel control; Windows may require a restart. ResetBase removes the ability to uninstall existing update packages. Do not claim a restore point undoes it.
- The engine guards normal managed-endpoint concurrency. It is not a security boundary against an administrator deliberately swapping directory ancestors or modifying trusted receipts. Keep signed builds and protected receipt ACLs; strengthen handle-relative directory traversal before treating it as a privileged untrusted-input agent.

## Native upstream integration roadmap (mandatory minimum requested by Joe)

| Source | Approach / provenance |
|---|---|
| CTT WinUtil | https://github.com/ChrisTitusTech/winutil — MIT. Reuse selected reviewed actions with copyright/licence notices, pinned provenance, DE gates/verification; do not blindly adopt debloat/update/telemetry presets on managed devices. |
| BleachBit | https://github.com/bleachbit/bleachbit — GPLv3-or-later engine AND cleaner definitions. Decide compatible distributed-source architecture before copying/translating code/rules. |
| DISM | Windows-supported executable/APIs; already added ordinary cleanup and servicing. https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/clean-up-the-winsxs-folder |
| DISM++ | https://github.com/Chuyu-Team/Dism-Multi-language — published resource/rule repo; Data.xml cleanup/optimization rules. Review licence per file; complete application engine source is not established by this repo. |
| WinDirStat | https://github.com/windirstat/windirstat — repository currently describes GPLv3-or-later, with some component exceptions. Review each reused component/version; add native treemap/MFT scan design after licence decision. |
| WizTree | https://www.diskanalyzer.com/eula — proprietary commercial/MSP licensing. Optional licensed fallback; no verified source-reuse grant. Do not copy proprietary code. |
| Microsoft PC Manager | Capability reference/optional official app; source availability/reuse not verified. No claim its engine has been embedded. |
| PowerShell automation | Original DE engine and supported Windows/.NET APIs; scripts must be parameterized, dry-run capable, logged, scoped, verified and usable from GUI/headless. |

No third-party cleaner source has been imported in this first slice. All minimum upstream capability goals remain tracked; wrappers alone do not fulfill Joe's requested native integration direction.
