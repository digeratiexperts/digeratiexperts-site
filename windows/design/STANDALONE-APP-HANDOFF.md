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
