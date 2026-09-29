# DE Tech Tool (Windows)

One Windows application for DE technicians. It holds the AI Toolkit, endpoint provisioning, identity
migration (Entra to JumpCloud through ADMU), the JumpCloud controller, the OS baseline, the browser
configurator, the security stack, apps, branding, network and site checks, the Vendor Admin Center, and
evidence with Intelligence Hub handoff. Every change goes through one engine: detect, compare with the
desired state, apply, verify, retry, then remediate or roll back. The evidence log records what happened
at each step.

## Install or update (one file)

Download the zip and `Install-DETechConsole.ps1` into the same folder (for example `C:\DE-Provisioning`), then:

```powershell
cd C:\DE-Provisioning
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-DETechConsole.ps1
```

It unpacks the newest `DE-TechTool*.zip` (or an older `DE-TechConsole*.zip`) into `DE-TechConsole\`, clears
Windows' downloaded-file block, keeps the previous copy as `DE-TechConsole.previous`, and opens DE Tech Tool.
The window title shows the version (for example `DE Tech Tool v1.5.0`), so you always know which build is
running. The zip itself is not a script; do not pass it to `-File`.

## Start

| You want | Do |
|---|---|
| The window | Double-click `Start-DETechTool.cmd`. It asks for elevation because provisioning changes the machine. `Start-DETechConsole.cmd` remains as a compatibility alias for older packages. |
| Only the AI prompt packs | Double-click `Start-MspAiKit.cmd`. The console opens on the AI Toolkit page. |
| RMM, no window | `console\DETechConsole.ps1 -Headless -Client alamo -Mode takeover -Technician jrpetro -ResultFile C:\DE\result.json`. It audits and changes nothing. `-ResultFile` writes the outcome as JSON (overall, exit code, restart needed, next step). |
| RMM, apply | Add `-Apply`. Run the console with `-WhatIf` first to see the plan. |
| A ProActive tier or standalone solution | Run its script in `playbooks\` (below), or add `-Bundle <id>` / `-Solution <id>` to the headless command. |
| Let discovery choose the mode | `-Mode auto`. DE Tech Tool prints the recommended mode and why, then runs it. |
| A dropship device | Build a kit with `packaging\New-DEDropshipKit.ps1` (below); the device runs `FirstBoot.cmd`. |
| Old loader actions | `Install-MspAiKit.ps1 -Action Build|Install|Clipboard|Verify|Update|Cleanup|All` still work and are used by the AI Toolkit page. |

Requirements: Windows 10 or 11, Windows PowerShell 5.1 or PowerShell 7. Node 22 is needed only to
build the AI packs, and the AI Toolkit page offers to install it for the current user.

## How a session works

1. **Discovery** reads the machine and classifies it. It covers the join type (local, Entra registered,
   Entra joined, hybrid, AD), the MDM authority (JumpCloud, Intune or both), security agents, BitLocker,
   OneDrive, apps, updates and network.
2. **Client detection** picks the client profile from the tenant, hostname pattern and profile folders.
   It shows why it chose that client, and the technician confirms or picks another.
3. **The technician stays separate from the end user.** The first time DE Tech Tool opens on a machine it
   asks who is running it (Enter keeps `jrpetro`) and remembers the answer; RMM runs pass `-Technician`.
   Evidence and the Hub record name that person. The end user is detected separately: for example `AzureAD\SuzetteThompson` at Alamo becomes the
   local account `sthompson`.
4. **Pick a plan and a mode.** The plan is a ProActive tier, a variant (GCC High, Co-Managed IT), or a
   standalone solution; the client profile's `plan` section is the default. The modes are audit, new,
   dropship, takeover, replacement, repair, co-managed and deprovision. After discovery, the Dashboard
   recommends a mode with its reasons (for example "another MDM manages this device (intune)" means
   takeover); the technician decides.
5. **The Guided workflow page always shows the next action and why.** Actions run in phases. Each
   action waits for its gates, and a closed gate names the step that opens it.
6. **Restarts resume.** A step that needs a restart registers the console to reopen after sign-in and
   continue where it stopped. Headless runs stop at a queued restart (`RESULT: RESTART REQUIRED`, exit 1)
   instead of applying later phases on top of it; run the same command again after the restart.
7. **Evidence and Hub.** The Evidence page writes a hashed bundle and pushes it to the Hub. The bundle
   holds JSON, internal and client-safe reports and a sha256 manifest. Each report comes as HTML and
   as a PDF printed by headless Edge or Chrome.

## Gates that protect the migration

The identity migration refuses to run until every one of these gates passes, or has an approved
exception:

- The console is elevated and the machine is online.
- A hidden local `DE-BreakGlass` administrator exists and its password was proven with a real logon.
  `jrpetro` is never the break-glass account.
- BitLocker is on and the recovery protector id is recorded. The recovery password itself is never stored.
- OneDrive has finished syncing, or the technician confirmed the data is safe.
- The source user is signed out, and no reboot is pending.
- The JumpCloud user exists and maps to the intended local account.
- There is no dual MDM, and the security stack verified.
- The migration takes a registry backup of ProfileList first and refuses to run without one.

**Entra leave is its own step.** By default the migration keeps the laptop Entra-joined; "Leave Entra"
unlocks only after "Verify migration" passes (local account exists, owns the preserved profile by SID).
A client profile can keep the device joined for good (`identity.leaveEntra: false`: only the user moves to
the local, JumpCloud-bound account), or opt into ADMU's one-step leave (`identity.leaveEntraDuringMigration:
true`). A device that stays Entra-joined and Intune-enrolled trips the dual-MDM gate once JumpCloud manages it.

**Updates.** `updates.authority` in the client profile says who keeps Windows updated after handoff:
`jumpcloud` (default: JumpCloud Patch Management), `intune` (Microsoft-only clients) or `windows` (DE Tech
Tool sets the automatic-update policy). The check "Update authority in place" always runs, whichever it is.

**Deprovision** removes DE-BreakGlass only when the client has its own enabled local administrator, and
only after user data preservation is confirmed. The order-match, GCC High, data and client-admin gates
cannot be opened by an exception.

A failed or skipped control never shows as a green check. An exception needs a reason, an approver and an
expiry date. It shows as EXCEPTION everywhere, including readiness.

## JumpCloud Device Trust

When a client profile sets `identity.jumpcloudDeviceTrust` to true, the console checks for a valid
JumpCloud-issued device certificate. A missing or expiring certificate reads WARN with the fix, because
Conditional Access sign-in fails without it.

## Security stack

Guardz is the primary MDR. Blackpoint is the approved backup and installs only when the client profile
selects it. SentinelOne is the EDR. The console also checks for conflicting EDR, sets Defender passive
mode where appropriate, and applies the PABX policy.

## Runtime secrets

Secrets live in memory as SecureString for the session only. They are never written to state, logs,
receipts, client profiles, evidence bundles or Hub payloads, and anything that looks like one is redacted
on screen. There are three ways to provide them:

- **Settings page.** Type each secret into its password box.
- **Approved vault.** Enter a PowerShell SecretManagement vault name on the Settings page and choose
  "Load from vault". Any registered vault works, such as SecretStore, Azure Key Vault, 1Password or Keeper.
- **RMM secure variables.** Name them `DE_SECRET_<NAME>`. The console moves them into memory and clears
  them from the environment.

| Name | Used for |
|---|---|
| `BREAKGLASS_PASSWORD` | DE-BreakGlass account (16+ characters) |
| `MIGRATION_TEMP_PASSWORD` | Temporary password for the new local account (ADMU) |
| `JC_CONNECT_KEY`, `JC_API_KEY`, `JC_ORG_ID` | JumpCloud agent install, and mapping, binding, groups and policies |
| `S1_SITE_TOKEN` | SentinelOne site token |
| `GUARDZ_ORG_KEY` | Guardz organization key |
| `WAZUH_REG_PASSWORD` | Wazuh agent registration |
| `DE_HUB_TOKEN` | Intelligence Hub device endpoint |

## Plans: ProActive tiers, variants, add-ons and standalone solutions

`console\catalog\bundles.json` is the one catalog. It carries the four ProActive tiers (IT, Office,
Business, Enterprise), the variants (Business and Enterprise GCC High, Co-Managed IT), the add-ons and the
13 standalone solution families. Tier defaults feed the profile; each plan's `exclude` or `includeOnly`
patterns decide which actions run. No prices.

| Plan | What changes on the device |
|---|---|
| ProActive IT | Full endpoint plan without endpoint backup, managed site network or SASE. The `endpoint-backup`, `managed-network` and `sase` add-ons put those back. Guardz Pro, no 24/7 human MDR claim. |
| ProActive Office / Business / Enterprise | Full plan (SASE is an add-on). Guardz Ultimate, Ultimate, Elite. |
| GCC High variants | Same as the tier, but every security agent waits on the gate "Security providers verified for GCC High" until a technician confirms it. |
| Co-Managed IT | Only the areas in the client profile's `coManaged.deOwns` (identity, security, apps, baseline, browser, updates, backup, network, support, mfa). |
| Standalone solution | Only that solution's actions and confirm steps. It is never labelled DE managed, and DE support shortcuts and remote-support agents stay off unless the solution is IT Operations. Areas outside it read NOT IN PLAN, never a gap. |

Work done off the device (a restore test, a tenant email baseline, a user enrolled in awareness training,
the dropship handoff) is a **plan step**: choose **Confirm done** and DE Tech Tool records who and when.
A solution's **prerequisite** (for example "Cyber risk assessment completed") gates every change until it
is confirmed. Open plan steps keep readiness from READY.

## Playbooks (one script per plan)

`playbooks\` holds one ready-to-run script per ProActive tier, per variant and per standalone solution,
for example `ProActive-Business.ps1`, `ProActive-Business-GCC-High.ps1`, `Co-Managed-IT.ps1` and
`Standalone-Identity-and-Access.ps1`. Each one audits by default and exits 0 (ready), 1 (not ready) or
2 (blocked):

```powershell
.\playbooks\ProActive-Office.ps1 -Client alamo                            # audit, change nothing
.\playbooks\ProActive-Office.ps1 -Client alamo -Mode auto -Apply          # discovery picks the mode
.\playbooks\ProActive-IT.ps1 -Client alamo -AddOn endpoint-backup -Apply  # tier plus an add-on
```

The scripts are generated from the catalog by `packaging\New-DEPlaybooks.ps1`. Run it after editing
`bundles.json`; a test fails if a playbook is missing or stale.

## Dropship (the device ships straight to the end user)

```powershell
.\packaging\New-DEDropshipKit.ps1 -Client alamo -Bundle proactive-business -OrderId DE-ORD-2026-0142 `
    -EndUserName 'Suzette Thompson' -EndUserUpn sthompson@alamo.example -Serial 7XK2Q14 -Model 'Latitude 7450' `
    -Hostname ALAMO-LAP-0231
.\packaging\New-DEDropshipKit.ps1 -OrderFile .\order.json
```

This writes `packaging\out\dropship\DE-Dropship-<order>\` and a zip with a `.sha256` file. The kit holds
`order.json`, `profile.json` (the composed client profile), `FirstBoot.cmd`, a one-page `README.txt`, and
DE Tech Tool copied unchanged, so a signed release still matches its integrity manifest at first boot.
On the new device, `FirstBoot.cmd` elevates and runs DE Tech Tool headless in dropship mode:

- It first checks this is the unit on the order (serial, then model). On a different machine it stops
  before changing anything and reports `REFUSED: wrong device` (exit 2).
- Identity migration, Entra leave and MDM cleanup never run in dropship mode.
- Secrets are never in the kit. The technician types them when asked (masked, memory only), or RMM
  supplies `DE_SECRET_<NAME>`. With no console to type into, DE Tech Tool says which secrets it did not
  ask for, and the steps that need them read BLOCKED.
- It says READY only when the tool's own result file says READY. Otherwise it says NOT READY or BLOCKED
  with the next step.

**Order without a serial.** The kit still builds (the builder warns). At first boot the technician types the
serial from the chassis sticker; it must equal this machine's own serial, and the order's model is still
checked. With nobody at the device (RMM), such an order is refused before any change.

## Client profiles

Profiles live in `console\catalog\profiles\` as examples and in `%ProgramData%\DE\TechConsole\profiles\`
on a machine. Each one holds the tier, stack roles, apps, branding, sites, vendor tenant ids and
detection rules. The console refuses to save a profile that contains a secret. Start from
`alamo.example.json` or the "New client profile" button.

## Vendor Admin Center

The Vendor Admin Center covers 18 categories and 76 vendors. Each vendor has admin, partner, client,
support, docs and status links, plus its SSO method, DE service and role (primary, backup or alternate).
Tenant-specific links fill in from the client profile. When a value is missing, the console names it
instead of guessing a URL. The same catalog exports a launcher page and the Chrome/Edge managed bookmarks.

## Packages

`console\catalog\packages.json` lists every installer with its source and trust policy: sha256, the
Authenticode publisher, or winget. A download that fails the policy is refused unless the technician
overrides it, and the override is recorded as WARN. These entries are marked `confirmed: false` until
DE fills in the real download source and hash:

- JumpCloud Remote Assist
- SentinelOne
- Guardz
- Blackpoint SNAP
- PABX policy
- MSP360 backup
- Wazuh
- Timus

## Exit codes (headless and loader)

| Code | Meaning |
|---|---|
| 0 | Ready, or ready with exceptions |
| 1 | Not ready: a control failed, or work is still in progress or has not run |
| 2 | Blocked or refused: a gate, secret or elevation is missing, the console files were changed after packaging, the client profile is unknown, or a dropship order names a different device |

The launchers (`Start-DETechTool.cmd`, and `Start-DETechConsole.cmd`, which forwards to it) return these
codes unchanged.
| 3 | RMM deploy only: download or verification failure |

## Data folders

`%ProgramData%\DE\TechConsole\` holds `state`, `logs`, `profiles`, `evidence`, `packages` and
`backups`. Registry and policy changes are backed up before they are made, and rollback uses those
backups.

## Packaging and release

| Step | Command |
|---|---|
| Sign and write the integrity manifest | `packaging\Sign-DETechConsole.ps1 -Thumbprint <code-signing cert>` |
| Check a package | `packaging\Sign-DETechConsole.ps1 -Verify` |
| Deploy from the RMM | `packaging\Deploy-DETechConsole.ps1 -PackageUrl https://... -Sha256 <hash> [-Client alamo -Mode takeover]` |
| Intune Win32 app | `packaging\New-DEIntunePackage.ps1 -IntuneWinAppUtil C:\Tools\IntuneWinAppUtil.exe` |

The deploy script refuses any package whose sha256 differs from the one you pass. There is no switch
to skip that check.

At start, the console checks its own files against `integrity.json` and their Authenticode signatures.
A file changed after packaging makes the console report TAMPERED, and headless `-Apply` then refuses to
run. An unsigned development build runs with a warning.

`integrity.json` is created at release time and is not committed.

There is no winget manifest. winget installs only exe, MSI or MSIX packages, and this is a script
package, so Intune and RMM are the supported deployment routes.

## Tests

```powershell
Invoke-Pester -Path .\tests, .\console\tests          # Pester 4.10 or 5.x
Invoke-ScriptAnalyzer -Path . -Recurse -Settings .\tests\PSScriptAnalyzerSettings.psd1
.\tests\Invoke-GuiSmoke.ps1 -OutDir $env:TEMP\de-smoke
```

The Pester suites run on Windows and Linux because Windows-only calls are mocked. They cover:

- the dsregcmd parser for every join type
- secrets, redaction and state scrubbing
- gates, exceptions, idempotence, retry and remediation, and WhatIf planning
- mocked identity states: Entra joined, local or workgroup, Intune-managed, JumpCloud-managed, dual MDM,
  and username collisions
- the Alamo JumpCloud mapping case, and break-glass refusing `jrpetro`
- vendor URL resolution, the package trust policy and client-safe reports
- the phase runner, module export clashes, the loader, and packaging tamper detection

The GUI smoke builds every page against the Alamo example profile. It renders each page to PNG at 100
and 200 percent scale, which is the high-DPI check. It never shows a window, so CI runs it on each
pull request.

## Fonts

`fonts\` ships Space Grotesk and Oxanium under the SIL Open Font License 1.1 (see the OFL files). The window
falls back to Segoe UI when they are missing, and uses Windows high-contrast colours when that mode is on.
