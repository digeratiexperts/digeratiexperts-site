# DE Technician Console (Windows)

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

It unpacks the newest `DE-TechConsole*.zip` into `DE-TechConsole\`, clears Windows' downloaded-file block,
keeps the previous copy as `DE-TechConsole.previous`, and opens the console. The window title shows the
version (for example `DE Technician Console v1.3.4`), so you always know which build is running. The zip
itself is not a script; do not pass it to `-File`.

## Start

| You want | Do |
|---|---|
| The window | Double-click `Start-DETechConsole.cmd`. It asks for elevation because provisioning changes the machine. |
| Only the AI prompt packs | Double-click `Start-MspAiKit.cmd`. The console opens on the AI Toolkit page. |
| RMM, no window | `console\DETechConsole.ps1 -Headless -Client alamo -Mode takeover`. It audits and changes nothing. |
| RMM, apply | Add `-Apply`. Run the console with `-WhatIf` first to see the plan. |
| Old loader actions | `Install-MspAiKit.ps1 -Action Build|Install|Clipboard|Verify|Update|Cleanup|All` still work and are used by the AI Toolkit page. |

Requirements: Windows 10 or 11, Windows PowerShell 5.1 or PowerShell 7. Node 22 is needed only to
build the AI packs, and the AI Toolkit page offers to install it for the current user.

## How a session works

1. **Discovery** reads the machine and classifies it. It covers the join type (local, Entra registered,
   Entra joined, hybrid, AD), the MDM authority (JumpCloud, Intune or both), security agents, BitLocker,
   OneDrive, apps, updates and network.
2. **Client detection** picks the client profile from the tenant, hostname pattern and profile folders.
   It shows why it chose that client, and the technician confirms or picks another.
3. **The technician stays separate from the end user.** The technician is Joe (`jrpetro`) by default.
   The end user is detected separately: for example `AzureAD\SuzetteThompson` at Alamo becomes the
   local account `sthompson`.
4. **Pick a mode.** The modes are audit, new, takeover, replacement, repair, co-managed and deprovision.
   The mode decides which actions are planned.
5. **The Guided workflow page always shows the next action and why.** Actions run in phases. Each
   action waits for its gates, and a closed gate names the step that opens it.
6. **Restarts resume.** A step that needs a restart registers the console to reopen after sign-in and
   continue where it stopped.
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
| 1 | Not ready: at least one control failed |
| 2 | Blocked: a gate, secret or elevation is missing, or the console files were changed after packaging |
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
