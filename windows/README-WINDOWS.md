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
   dropship, takeover, replacement, repair, co-managed and deprovision. After the scan the tool recommends
   a mode with its reasons (for example "another MDM manages this device (intune)" means takeover, and a
   device at OOBE means new); the technician decides.
5. **Scan & fix is the main page.** When the tool opens it scans every category without changing anything,
   and says where the device is in its life: OOBE (machine settings now, user settings after the first
   sign-in), after first sign-in, or configured. The results are grouped into stages in the order the work
   is done: check, protect, migrate, leave Microsoft, JumpCloud, security, updates, apps, hardening and
   browser, sign-off (`catalog\runbook.json`). Every item has a checkbox. Items that can be fixed now are
   pre-ticked, and destructive ones are never pre-ticked. The buttons under the list act on the ticked
   items, in job order: Fix selected, Check selected, Skip, Undo, and Scan again. A large switch shows
   **PLAN ONLY** (nothing changes) or **LIVE**. Click an item to see why it matters, what the scan found,
   what it is waiting on and how to unlock it, with its inputs right there: user mapping, runtime
   secrets, the BitLocker protector and escrow, and the break-glass and OneDrive confirmations. The
   module pages are still available under Advanced.
6. **Restarts resume.** A step that needs a restart registers the console to reopen after sign-in and
   continue where it stopped. Headless runs stop at a queued restart (`RESULT: RESTART REQUIRED`, exit 1)
   instead of applying later phases on top of it; run the same command again after the restart. An
   unexpected error in a headless run still ends with a RESULT line and `-ResultFile` (`ERROR`, exit 1).
   A plan-only run (`-WhatIf`) changes nothing on the device but still writes its evidence bundle.
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

**Putting JumpCloud on takes the device off Microsoft, as its own step.** "Disconnect from Microsoft"
(`identity.entra-leave`) leaves Entra ID (`dsregcmd /leave`) and any on-prem AD domain, hybrid included
(unjoined to WORKGROUP without deleting the AD computer object, so no domain credential is needed). It is
planned in every mode that puts JumpCloud on (new, replacement, repair, takeover, co-managed) and unlocks only when:
- every Entra or domain profile has been migrated (or the technician accepts a leftover one on the Identity page);
- the BitLocker recovery key is backed up outside Entra. "Back up the BitLocker recovery key" backs it up to
  Entra while the device is still joined, then asks JumpCloud for the key it holds and compares it with the
  volume in memory. Otherwise the technician records the protector id and the escrow (Hudu, IT Glue, vault).
  The recovery password is never written to logs, state or bundles;
- break-glass and OneDrive are confirmed.

JumpCloud binds the user only after the device is off Microsoft (`gate.microsoft-left`), because JumpCloud
warns against binding onto an Entra-joined device. A client profile can keep the device joined for good
(`identity.leaveEntra: false`: only the user moves to the local, JumpCloud-bound account), or opt into ADMU's
one-step leave (`identity.leaveEntraDuringMigration: true`). A device that stays Entra-joined and
Intune-enrolled trips the dual-MDM gate once JumpCloud manages it.

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

## Boot rescue (WinPE)

The rescue is for a device whose Windows will not boot, or should not be booted. It works with no
network and no DE Tech Tool.

**Build the media once**, on a DE PC with the Windows ADK and the Windows PE add-on installed. Run it
elevated:

```
.\rescue\New-DERescueMedia.ps1 -IsoPath C:\DE\DE-Rescue.iso -HubUrl https://techsales.digerati-experts.com -Technician jrpetro
.\rescue\New-DERescueMedia.ps1 -UsbDrive E: -ConfirmFormat       # erases E:
```

- Add `-WhatIf` to list every step without running it.
- Add `-DriverPath` when a model needs extra storage or network drivers.

**What the rescue menu does:**

| Option | What it does |
|---|---|
| Unlock a BitLocker drive | Shows the key ID. The recovery password you type is checked for typos (each group must be a multiple of 11), used once, and never written or logged. |
| Back up profiles | Copies profiles to a second USB drive (NTFS or exFAT; FAT32 is refused for files over 4 GB). Keeps timestamps, skips caches, writes a manifest with its sha256, compares file counts, and never deletes the source. |
| Export drivers | Exports the drivers with DISM. |
| Disk health | Shows health, wear and temperature for each disk. |
| Repair boot files / Revert stuck updates | Runs `bcdboot` or `DISM /RevertPendingActions`. Only runs after you type YES. |
| Save handoff | Writes a `de.techconsole.handoff/v1` record to the USB and to the Windows volume. It can also send it to the Hub as a signed event; the signing secret is typed and not saved. |

When Windows starts again, DE Tech Tool lists **Review what the boot rescue did** as the first check. It
shows what the rescue did and its recommendations, for example rotating a recovery password that was
used, or running the takeover flow. The review is recorded with the technician's name. A handoff that
fails its contract, or that belongs to another device, is flagged and not marked as reviewed.

## Online component (Intelligence Hub)

The Hub records each device under its device key (`<maker>:<SERIAL>`), along with its evidence, rescue
handoffs and warranty. The shared contracts are in `console/contracts/`.

- **Signed sending.** When `DE_HUB_SIGNING_SECRET` is entered as a runtime secret, `Send-DEHubPayload`
  sends a signed `device.observed` event to `<Hub>/api/integrations/v1/techconsole/events`.
- **Account number.** The client profile needs the client's Hub account number, set as
  `"hub": { "accountId": 123 }`. Without it the signed send is refused and the record is saved for
  manual upload.
- **Legacy sending.** Without a signing secret, the older Bearer POST (`DE_HUB_TOKEN`) is used.
- **Not live yet.** The Hub route is in a draft Intelligence-Hub PR. Merging it deploys to production,
  so it waits for DE approval. Until then, sends that fail are saved to evidence for manual upload.

## Warranty

The `maint.warranty` step shows when the device's warranty ends and where that answer came from.
The sources are listed in `console\catalog\warranty.json`. The tool only talks to the manufacturer
itself, never to a third-party lookup service, so client serial numbers stay between DE and the maker.

- **Dell:** looked up through the TechDirect warranty API. Enter `DELL_API_KEY` and `DELL_API_SECRET`
  as runtime secrets; without them you get Dell's check page.
- **Lenovo:** looked up from Lenovo's public support site. No key is needed.
- **HP:** HP's warranty API needs an approved key and its endpoints are not filled in yet. Until they
  are, you get HP's check page.
- **Other makers:** Surface, Apple, Acer, ASUS, Dynabook, Samsung, Panasonic, Framework, MSI, Getac and
  Gigabyte open the maker's check page. The technician records the end date on the Scan & fix page, and
  the tool stores who recorded it.

Answers are cached for 7 days. The step warns when fewer than 90 days are left. The end date goes into
the asset record.

## Community tools and the Toolbox (pinned)

`console\catalog\community.json` lists every community project the tool uses. Each one is pinned to the
commit DE reviewed, and every file it loads or runs has a sha256. DE uses these tools internally and does
not redistribute them, so the licence is recorded but never blocks a useful tool.

| Kind | Tools | How it is used |
|---|---|---|
| Module | LSUClient, HardeningKitty | Imported: `maint.oem` on Lenovo, and the read-only `baseline.cis-audit` |
| Toolbox scripts | limehawk rmm-scripts, dszp msp-scripts, asheroto winget-install, Raphire Win11Debloat | Run unmodified from the **Toolbox** page |
| Reference | PSAppDeployToolkit, flatlinebb, PowerShellWarrantyReports | Read, not run |

**How a Toolbox script runs:**

- Each script runs in its own 64-bit Windows PowerShell with `-NonInteractive` and stdin closed. A 32-bit
  RMM agent can't send it to SysWOW64.
- It gets the catalog's arguments and a timeout.
- Its full output is saved to Evidence as `toolbox-*.log`.
- It reads PASS only when it returns one of the success codes listed in the catalog.
- Scripts that uninstall software, restart the device or change security settings ask first. From
  RMM they only run with `-Force`.
- In PLAN ONLY mode, Run shows what would happen and changes nothing.

**What's in the Toolbox:**

| Group | Scripts |
|---|---|
| Repair | Windows Update reset, DISM + SFC, WebView2 repair, print queue reset |
| Clean up | disk clean-up |
| Checks | SMART disk health, N-central removal preview |
| Remove the previous MSP's tools | NinjaOne, N-central, legacy antivirus |
| Hardening | remove PowerShell 2.0, network hardening, Windows LAPS to Entra |
| Setup | install or repair winget (as SYSTEM and at OOBE), debloat for new user profiles |

These were reviewed and left out:

- limehawk `time_sync_fix`: it hard-codes Eastern time. The tool's own `net.time` check fixes clocks instead.
- limehawk `winre_restore`: it has placeholder URLs.
- limehawk `eset_cleanup`: it crashes when exactly one ESET service matches, and ESET's own uninstaller is
  the right tool.
- limehawk `winget_setup`: asheroto's winget-install does the same job better.

**winget:** when an install finds winget missing, the tool runs winget-install once and tries again.

**How a pinned file is fetched and checked:**

- It is downloaded from `raw.githubusercontent.com` at the pinned commit, with three tries.
- It is checked against its sha256 before it is used. One mismatch refuses it, and nothing half-downloaded
  is kept.
- The verified copy is cached under the data folder, in `community\<id>\<commit>`.
- The release zip and every dropship kit carry a staged copy in `community\` beside `console\`, for
  offline and OOBE use.
- The staged copy is outside `integrity.json` and code signing, which cover DE's own code only.

To move a pin, review the upstream diff and clone the new commit. Then run:

```
python3 packaging/update-community-catalog.py --clones <dir> --pin <id>=<commit>
```

`--check` fails when any pin is out of date.

## Windows behaviour (what the tool does for you)

- **32-bit hosts.** When a 32-bit host (many RMM agents) starts the tool, it re-runs itself in 64-bit
  Windows PowerShell and passes the exit code on. The launchers, first boot and Intune package pick 64-bit
  directly.
- **Running as SYSTEM** (RMM, Intune, first boot):
  - winget is found under WindowsApps, and App Installer is registered if it isn't yet.
  - Per-user settings go to every user profile and the Default profile, not to SYSTEM's own hive.
  - OneDrive is read from each user's hive.
  - A window never opens without a desktop session; use `-Headless`.
- **Any Windows language.** Groups and ACLs use well-known SIDs. Password and audit policy come from
  `secedit` and `auditpol /backup` values, and Wi-Fi profiles from their XML files. No translated command
  output is parsed.
- **Locked-down PCs.** Under WDAC/AppLocker Constrained Language Mode the tool refuses with exit 2 and
  says why. Mark-of-the-Web is removed when installing (the installer, Intune and FirstBoot.cmd do it).
- **Resume after a restart.** This uses a scheduled task. It triggers at any user's logon, then asks UAC
  for the technician, so it works even when the first sign-in after migration is a standard user.
  Headless resume runs as SYSTEM at startup.
- **Data folder.** `%ProgramData%\DE\TechConsole` is locked to SYSTEM and Administrators, so a standard
  user can't plant approved exceptions or profiles.
- **Clock.** `net.time` compares the clock with an HTTPS server. More than 5 minutes off breaks TLS,
  sign-in and Hub signatures, and it resyncs Windows Time.
- **Small screens and high contrast.** The window fits a 1366x768 laptop at 125% scaling, and high
  contrast uses the system colours. The CI smoke test renders every page at both sizes.

**OEM updates in `maint.oem`:**

| Maker | Tool | Notes |
|---|---|---|
| Dell | Dell Command \| Update | installs itself if it is missing |
| Lenovo | LSUClient | Packages that cannot install silently are listed for the technician. A BIOS update that needs a full shutdown asks for one. |
| HP | HP Image Assistant, when it is installed | Exit 0 or 256 means done, 3010 means a restart is needed, and anything else fails the step. |

Any failed package fails the step. BitLocker is suspended for one restart whenever BIOS or firmware is
included, and `maint.bitlocker-resume` checks that protection comes back on.

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
