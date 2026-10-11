# Standalone Windows application continuation

Joe authorized a complete installable standalone Windows app on 2026-10-11 and permits an improved design beyond his mockup. Preserve the existing working product and its native capabilities. This broadens the prior storage task; it does not authorize presenting scaffolding as a finished app.

## Added now

`../packaging/DETechTool.iss` is an Inno Setup recipe for the existing complete Windows release staging folder. It installs into Program Files, registers Windows uninstall, provides Start-menu tool/storage shortcuts and optional desktop shortcut, and leaves evidence/client data under ProgramData intact. Stable AppId supports the same installation identity. It uses the existing elevation-aware launcher and packages files without modifying the signed payload. No Node/compiler/Inno runtime is installed on the endpoint by this recipe. Existing AI-pack building still has its documented Node dependency; prebuilt packs and offline functions must be tested independently.

Build prerequisite: independently verify the complete release staging folder using the existing signing/integrity/release process in GO-LIVE.md and PROTECTING-THE-TOOL.md. Never feed a source checkout containing development fixtures, test secrets, sample evidence or output trees to the recursive payload rule. Recipe presence does not establish verification or signing. Compile with Inno Setup 6.3+ and the three required defines PayloadDir, ProductVersion and OutputPath; sign resulting Setup EXE through the approved release pipeline before distribution. ProductVersion must match the staged release, not the mockup's sample 3.2.0 label.

## Design direction

Use the supplied operations-console composition but improve readability: restrained dark background, solid readable panels, consistent red primary actions, visible focus, legible telemetry, clear hierarchy and purposeful density. Keep textures subtle and reserve elaborate logo artwork for splash/about views. Existing client/technician/device context, readiness, PLAN ONLY/LIVE distinction and destructive confirmations must remain visible. Add Storage & cleanup to navigation. Do not invent fleet totals, ticket integrations or healthy-agent status.

Read MAIN-WINDOW-REFERENCE.md and BRANDING-ASSET-REFERENCES.md. Original image binaries remain unavailable and uncommitted; import unchanged when attachment filesystem access returns. No redesign runtime code has been applied by this installer commit.

## Required implementation and verification

- Restore workspace and audit current repository governance/concurrent Windows work before editing.
- Inspect release builder and signed manifest coverage. Verify new packaging files integrate into the release without changing payload hashes after signing.
- Compile installer on a disposable Windows build runner. Existing passing storage CI predates this installer and does not prove installer compilation.
- Test clean install, launch, repair/reinstall, upgrade from older signed release, downgrade refusal policy, uninstall and preserved evidence/client data. Reject missing/partial payloads. Implement obsolete-file handling so upgrades cannot retain removed executable code. Protect installed folder ACLs and verify installation integrity before app launch.
- Test launch as standard user with UAC accepted/declined, silent RMM install without unintended app launch, headless exit-code propagation, restart/resume and installed-path behavior.
- Add shared WPF resources and redesigned shell incrementally, preserve all existing module routes/handlers, inspect populated pages and Windows scaling/keyboard/high-contrast behavior.
- Define offline behavior: local diagnostics/storage/evidence continue locally; Hub/licensing/vendor/tenant-dependent capabilities clearly show unavailable/blocked state rather than bypassing existing controls. Standalone does not mean removing authorization.
- Deliver actual signed installer artifact, exact version/hash and verified download location. No hosted download URL has been verified. PR/source links are not installer downloads.

## Current checkpoint

Draft PR #580, branch chatgpt/tech-tool-storage-20261011. Previous storage head 53983f1 passed general CI and MSP AI Kit CI, including 409 Windows tests and initial WPF Storage render inspection. Later design/installer commits need their own validation. Workspace is offline, so this continuation cannot compile or install the app locally. No complete installer EXE, full redesign, install validation or signed release is claimed.

## Verified checkpoint — 2026-10-11 (supersedes earlier checkpoint)

Code commit: e07d0b8d22f3d84fa5303e4a2c7d00fb7e7cbbf4. Branch: chatgpt/tech-tool-storage-20261011. Draft PR: https://github.com/digeratiexperts/digeratiexperts-site/pull/580.

An actual unsigned installer now exists:
https://github.com/digeratiexperts/digeratiexperts-site/actions/runs/38180845851/artifacts/11718365333
Download the artifact ZIP, extract DE-TechTool-Setup-1.11.0-x64.exe and its SHA256 file. Repository access may be required. This is a test build, omits community tools, and is not a signed production release. Artifact expires 2027-01-09.

Implemented after the initial recipe:
- Original native x64 DE-TechTool.exe entry point, compiled with Windows .NET Framework before signing/hashing; installed shortcuts target it. Existing PowerShell/WPF application remains the functional engine.
- Launcher supports default console, --storage and --check; unknown options return 2. --check checks host/script availability and architecture only. It does not prove GUI readiness, integrity or licensing. Interactive launch requests elevation; UAC decline falls back to the existing engine's restricted controls. Interactive accepted/declined UAC paths still require manual verification.
- EXE signing support and manifest coverage for original C# source and executable.
- Installer refuses a registered newer version before modification, permits same-version reinstall, and retains evidence on uninstall.
- Operations and Precision WPF appearances with shared tokens, corrected appearance forwarding and Storage input styling. Existing Brand and high-contrast behavior retained. This is an appearance foundation, not the full supplied fleet dashboard.

GitHub Actions run 38180845851: Linux checks and standalone installer lifecycle job passed. Installer compiled; install/reinstall, launcher diagnostic/invalid-option probes, installed headless audit, registered-version downgrade-refusal fixture, unchanged-file/version assertions and uninstall/evidence preservation passed. Both appearances rendered all 18 pages with zero smoke failures. The intentional handler-error smoke fixture is expected. Full Windows job was still running when this checkpoint was written. Earlier code 2a24b23773b60b7130a690fcc846bf8466767908 passed 409 Windows tests; do not attribute that result to later code without checking the current run.

Native storage functions already implemented: capacity/topology inventory; iterative file metadata scan with partial/error reporting; explainable drive-role and directed transfer estimates; guarded selected old temporary-file/crash-dump cleanup; copy-first relocation with verification and separate explicit source removal; supported DISM actions with elevation, license, integrity and reboot gates. Transfer rankings are estimates, not measured benchmark speeds. Read STORAGE.md and tests for detailed boundaries.

Next work:
1. Check current full Windows job 114592900968 and general CI at the code SHA above. Resolve failures before merging.
2. Test genuine older-to-newer payload upgrade, obsolete executable removal, missing/partial payload rejection, default Program Files permissions, manual UAC/interactive startup, scaling/keyboard/high contrast and real-device storage behavior. The registry fixture is not a genuine version upgrade test.
3. Build the broader operations dashboard only with real connected data; preserve all existing routes and PLAN ONLY/LIVE distinctions. Add an appearance selector if useful.
4. Import original supplied image binaries when accessible. Text catalogs exist; original images have not been committed. GitHub can write binary blobs; attachment byte access is the limitation.
5. Continue native disk analysis/visualization and benchmark work, upstream source/license review and cleanup-rule coverage. The requested utility-equivalent feature set is not complete.
6. Verify offline diagnostics/evidence and prebuilt AI packs separately; existing AI-pack building still needs Node. Cloud/vendor features must show unavailable states truthfully.
7. Complete approved production signing, installer/toolchain licensing review and release gates. Do not self-merge or claim production deployment. Lead-integrator review remains required.

Local workspace is disconnected, but GitHub edits and Windows Actions builds work. Preserve this distinction for the next AI.
