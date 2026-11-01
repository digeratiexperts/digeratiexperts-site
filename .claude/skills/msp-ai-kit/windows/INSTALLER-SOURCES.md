# Installer source inventory

Move 39 of the [104-move tracker](DE-TECH-TOOL-TRACKER.md) ([#757](https://github.com/digeratiexperts/digeratiexperts-site/issues/757)).
The complete list of every installer source the DE Tech Tool downloads, stages or executes - the
subject list of rule R1 in [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md). Every row below
is an object the trust policy applies to.

`console/tests/InstallerSources.Tests.ps1` keeps this file honest in both directions: a source that
exists in the catalog or playbooks must be listed here, and every id listed here must still exist
in the catalog or playbooks. Adding an installer anywhere without adding it here fails the suite.

Recorded 2026-10-31 from `console/catalog/packages.json`, `console/catalog/community.json`,
`console/catalog/vendors.json` and `playbooks/`. The URL, vendor-hash and verification record for
each source is move 40 ([#758](https://github.com/digeratiexperts/digeratiexperts-site/issues/758));
the outcome for sources with no vendor hash is move 41
([#759](https://github.com/digeratiexperts/digeratiexperts-site/issues/759)).

## Where installer sources live

| Policy scope (R1) | Lives in | Count | What it is |
|---|---|---|---|
| The 18 packages in the package catalog | `console/catalog/packages.json` | 18 | Installers the Technician Console installs, upgrades and repairs through `Invoke-DEPackageInstall` |
| The community tools | `console/catalog/community.json` | 10 tools (396 pinned files, 15 pinned scripts) | Reviewed community PowerShell, downloaded at one pinned commit and refused on any file-hash mismatch |
| Anything referenced from `console/catalog/vendors.json` | `console/catalog/vendors.json` | 0 installers | Admin, client, partner, docs and status portal URLs only - no file the tool downloads or runs |
| Any installer named in a playbook | `playbooks/*.ps1` | 22 playbooks, 0 installer sources | Generated launchers; each delegates to the console catalog by bundle or solution id and names no installer of its own |
| The tool's own update payload (R10/R11) | `Install-MspAiKit.ps1`, `packaging/` | see section E | The tool's own release packages and the portable Node.js runtime it bootstraps |

## A. `console/catalog/packages.json` - the approved package catalog (18)

`Invoke-DEPackageInstall` is the only install path; every entry below goes through
`Test-DEPackageTrust` before anything runs. `{SECRET:...}` and `{VALUE:...}` tokens in install
arguments are runtime data and are not source locations.

| id | name | source type | location | publisher recorded |
|---|---|---|---|---|
| `jumpcloud-agent` | JumpCloud Agent | `url` | `https://cdn02.jumpcloud.com/production/jcagent-msi-signed.msi` | JumpCloud Inc. |
| `jumpcloud-remote-assist` | JumpCloud Remote Assist | `url` | `https://cdn02.jumpcloud.com/production/jumpcloud-remote-assist-agent.msi` | JumpCloud Inc. |
| `wazuh-agent` | Wazuh Agent | `url` | `https://packages.wazuh.com/4.x/windows/wazuh-agent-4.9.2-1.msi` | Wazuh |
| `m365-apps` | Microsoft 365 Apps for business/enterprise | `url` | `https://officecdn.microsoft.com/pr/wsus/setup.exe` | Microsoft Corporation |
| `sentinelone-agent` | SentinelOne Agent (managed) | `local` | `SentinelOneInstaller_windows_64bit.exe` | SentinelOne |
| `guardz-agent` | Guardz Device Agent | `local` | `GuardzDeviceAgent.msi` | Guardz |
| `blackpoint-snap` | Blackpoint SNAP Agent | `local` | `BlackpointSnapAgent.msi` | Blackpoint |
| `pabx-policy` | Prisma Browser Extension policy (PABX, no private browsing) | `local` | `install-pabx_no-private-browsing.ps1` | Digerati Experts |
| `msp360-backup` | MSP360 Managed Backup agent | `local` | `MSP360Backup.exe` | MSP360 |
| `timus-connect` | Timus Connect | `local` | `TimusConnect.msi` | Timus |
| `teams` | Microsoft Teams | `winget` | `Microsoft.Teams` | (none - R8: winget inherits winget's trust) |
| `onedrive` | Microsoft OneDrive | `winget` | `Microsoft.OneDrive` | (none - R8: winget inherits winget's trust) |
| `dropbox` | Dropbox | `winget` | `Dropbox.Dropbox` | (none - R8: winget inherits winget's trust) |
| `edge` | Microsoft Edge | `winget` | `Microsoft.Edge` | (none - R8: winget inherits winget's trust) |
| `chrome` | Google Chrome | `winget` | `Google.Chrome` | (none - R8: winget inherits winget's trust) |
| `pdf-reader` | Adobe Acrobat Reader (64-bit) | `winget` | `Adobe.Acrobat.Reader.64-bit` | (none - R8: winget inherits winget's trust) |
| `dell-command-update` | Dell Command \| Update | `winget` | `Dell.CommandUpdate` | (none - R8: winget inherits winget's trust) |
| `powershell-7` | PowerShell 7 | `winget` | `Microsoft.PowerShell` | (none - R8: winget inherits winget's trust) |

Local packages are staged by DE into `%ProgramData%\DE\TechConsole\packages`
(`localPackagesDir` in the catalog) and must be hashed at intake (R9).

## B. `console/catalog/community.json` - community tools (10)

Every tool is pinned to one reviewed commit with a sha256 per file DE loads or runs; the files come
from `raw.githubusercontent.com/{repo}/{commit}/{path}` and any mismatch refuses the tool. Pins move
only through `packaging/update-community-catalog.py` against reviewed clones, never by hand.

| id | name | repository | reviewed commit | use | status | pinned files | pinned scripts |
|---|---|---|---|---|---|---|---|
| `lsuclient` | LSUClient | `jantari/LSUClient` | `cc82c9f0163c4ae6b76289ccbb57d5b645890ee6` | module | wired | 31 | 0 |
| `hardeningkitty` | HardeningKitty | `scipag/HardeningKitty` | `da0976073caad006c48b2478588c2f7fa572ab46` | module | wired | 15 | 0 |
| `win11debloat` | Win11Debloat | `Raphire/Win11Debloat` | `32024662f3c602442e7af82bbf52c89143b31aeb` | scripts | wired | 350 | 1 |
| `winget-autoupdate` | Winget-AutoUpdate (WAU) | `Romanitho/Winget-AutoUpdate` | `084d39de1fb81f7fa475cc1448538011feacc8e0` | scripts | reviewed | 0 | 0 |
| `winget-install` | winget-install | `asheroto/winget-install` | `58e3688f7f52707b273c019766207d82693df6d1` | scripts | wired | 0 | 1 |
| `psadt` | PSAppDeployToolkit | `PSAppDeployToolkit/PSAppDeployToolkit` | `2da0cd95ac49de44ac73a00244d2dfc3a7eecbd4` | reference | reviewed | 0 | 0 |
| `limehawk-rmm-scripts` | limehawk rmm-scripts | `limehawk/rmm-scripts` | `3c45afbdf3c9e9f473fa7dfcb4261acd1cc5d31f` | scripts | wired | 0 | 9 |
| `dszp-msp-scripts` | dszp msp-scripts | `dszp/msp-scripts` | `e73beb97a3ed1419da52b99970d180db4f3eb5f3` | scripts | wired | 0 | 4 |
| `flatlinebb-mspscripts` | flatlinebb MSPscripts | `flatlinebb/MSPscripts` | `1595ec5d8c7cc196d89872c913c76fa1de05af5a` | reference | reviewed | 0 | 0 |
| `pswarranty` | PowerShellWarrantyReports | `KelvinTegelaar/PowerShellWarrantyReports` | (none - reference only, not used) | reference | reviewed | 0 | 0 |

## C. `playbooks/` - 22 playbooks that name no installer of their own

Generated by `packaging\New-DEPlaybooks.ps1` from the console catalog; do not edit by hand. Each
one launches `console\DETechConsole.ps1 -Headless` with a bundle or solution id and inherits every
installer source from section A through plan composition - so a playbook cannot introduce a source
the catalog does not have. `InstallerSources.Tests.ps1` asserts that: no playbook contains a URL,
an installer filename or a `winget` call.

| playbook | delegates with | installers named directly |
|---|---|---|
| `Co-Managed-IT.ps1` | `-Bundle co-managed` | none |
| `ProActive-Business-GCC-High.ps1` | `-Bundle proactive-business-gcch` | none |
| `ProActive-Business.ps1` | `-Bundle proactive-business` | none |
| `ProActive-Enterprise-GCC-High.ps1` | `-Bundle proactive-enterprise-gcch` | none |
| `ProActive-Enterprise.ps1` | `-Bundle proactive-enterprise` | none |
| `ProActive-IT.ps1` | `-Bundle proactive-it` | none |
| `ProActive-Office.ps1` | `-Bundle proactive-office` | none |
| `Standalone-Backup-and-Business-Continuity.ps1` | `-Solution backup_continuity` | none |
| `Standalone-Business-Communications.ps1` | `-Solution business_communications` | none |
| `Standalone-Compliance-and-Risk-Readiness.ps1` | `-Solution compliance_risk` | none |
| `Standalone-Cybersecurity-Operations.ps1` | `-Solution cybersecurity_operations` | none |
| `Standalone-Documentation-and-Standards.ps1` | `-Solution documentation_standards` | none |
| `Standalone-Email-and-Collaboration.ps1` | `-Solution email_collaboration` | none |
| `Standalone-Endpoint-and-Device-Management.ps1` | `-Solution endpoint_devices` | none |
| `Standalone-Hardware-and-Lifecycle.ps1` | `-Solution hardware_lifecycle` | none |
| `Standalone-Identity-and-Access.ps1` | `-Solution identity_access` | none |
| `Standalone-IT-Operations-and-Support.ps1` | `-Solution it_operations` | none |
| `Standalone-Network-and-Connectivity.ps1` | `-Solution network_connectivity` | none |
| `Standalone-Security-Awareness-and-Human-Risk.ps1` | `-Solution security_awareness` | none |
| `Standalone-Technology-Strategy-and-Advisory.ps1` | `-Solution technology_strategy` | none |

## D. `console/catalog/vendors.json` - admin portals, no installers

The vendor catalog holds sign-in URLs for vendor admin, partner, client, docs and status portals.
It contains no download URL and nothing the tool executes, so it contributes no installer source.
If a download URL is ever added there, it must be listed in section A or B and carry a trust record
like every other source.

## E. The tool's own payloads (R10/R11)

Not covered by the package catalog rules - these are the tool itself, governed by code signing and
`integrity.json` (tracker section D, moves 49-58). Listed here so the policy's scope is complete:

| payload | source | how it is verified today |
|---|---|---|
| Portable Node.js runtime bootstrapped by `Install-MspAiKit.ps1` | `https://nodejs.org/dist/v<version>/node-v<version>-win-<arch>.zip` | sha256 against the vendor's published `SHASUMS256.txt` (nodejs.org); on mismatch the download is deleted and `sha256 mismatch for <name>.zip (have <have>, want <want>)` is thrown (R3's reference behaviour) |
| The tool's own update payload | signed release package | sha256 pinned and signature-checked before replacement (R11); unsigned server-supplied scripts never execute |
| The tool's own shipped files | release zip | every file hashed in `integrity.json`, written by `packaging\Sign-DETechConsole.ps1`; `Test-DEConsoleIntegrity` refuses a copy whose files changed (R11) |
