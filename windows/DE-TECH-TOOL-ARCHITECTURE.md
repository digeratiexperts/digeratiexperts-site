# DE Tech Tool architecture and recovered roadmap

**Canonical product name:** DE Tech Tool.

Compatibility names such as DE Technician Console, TechConsole and MSP AI Kit may remain in file paths or launch aliases where changing them would break installed automation.

## Product rule: three components, one contract

DE Tech Tool has three parts. Each one works on its own, and all three were designed to work together.

| Component | Runs where | Works alone | Code |
|---|---|---|---|
| **Online** (Intelligence Hub) | techsales.digerati-experts.com | Device registry, orders/jobs, evidence and rescue intake, warranty history, fleet views | Intelligence-Hub repo, `POST /api/integrations/v1/techconsole/events` (merged; Intelligence-Hub `master` auto-deploys, and DE still sets the secrets and applies the migrations: [GO-LIVE.md](GO-LIVE.md)) |
| **On-device** (DE Tech Tool) | The Windows device: OOBE, after first sign-in, configured | Discover, audit, plan, apply, verify, roll back and keep evidence, with no server | `console/` (WPF plus headless) |
| **Boot rescue** | WinPE from USB or ISO, when Windows will not boot or must not be booted | Unlock BitLocker with a typed recovery password, copy profiles, export drivers, check disk health, repair boot, revert stuck updates | `rescue/` (`New-DERescueMedia.ps1`, `Start-DERescue.ps1`, `DE.Rescue.psm1`) |

The contracts they share live in `console/contracts/*.schema.json` (JSON Schema). The Hub validates with
the same files, and `DE.Contracts` validates them on the device and in WinPE.

| Contract | Written by | Read by |
|---|---|---|
| `de.techconsole.device/v1` | on-device (`New-DEHubPayload`) | Hub |
| `de.techconsole.order/v1` | DE / Hub | dropship kit, first boot |
| `de.techconsole.handoff/v1` | rescue | on-device (the `rescue.handoff` step), Hub |
| `de.techconsole.warranty/v1` | on-device (`DE.Warranty`) | Hub |
| `de.techconsole.job/v1` | Hub | on-device (planned: the signed DE Tech Agent) |
| `de.email-migration.record/v1` | DE Microsoft Admin (`Export-DEMigrationRecord`), sent by the on-device Email migration page | Hub (IT Operations) |

Microsoft 365 admin jobs use their own signed contract, `de.msadmin.job/v1`, between the Hub and the DE Microsoft
Admin worker (`Invoke-DEHubJobLoop`); see `microsoft/DE-Microsoft-Admin/README.md`.

- **Device key.** Every component names a device `<maker>:<SERIAL>` (`ConvertTo-DEDeviceKey`), so the
  three agree without talking to each other. An OEM placeholder serial is refused, and the technician
  types the serial from the sticker.
- **No secrets in any contract.** Validators refuse secret-looking keys and any value shaped like a
  BitLocker recovery password. The device record leaves secret-named keys out before it is validated
  (`Remove-DEContractSecretKeys`), so a stray key does not stop every send; a migration record or a
  rescue handoff with one is refused. A refused send records the Hub's own reason
  (`Get-DEHubErrorReason`), never the secret or the signed body.
- **Transport to the Hub.** The Hub's de-sync envelope (version 1, source `techconsole`), signed with
  HMAC-SHA256 over `METHOD\npath\ntimestamp\neventId\nsha256(body)`. The body is written byte for byte
  as JavaScript's `JSON.stringify` writes it, because that is what the Hub hashes. The signing secret is
  `TECHCONSOLE_TO_HUB_SECRET` on the Hub and `DE_HUB_SIGNING_SECRET` at runtime on the device. The rescue
  prompts for it and never stores it.
- **Handoffs work offline.** The rescue leaves its handoff in two places: on the USB, and in
  `ProgramData\DE\TechConsole\handoff` on the Windows volume. On the next start, DE Tech Tool shows it
  as the first step to review, and the review records who did it.

The on-device engine is never disabled because the Hub is unavailable, and the rescue never needs either.

## Call-home design

Do not expose an inbound management port on client laptops. The endpoint initiates an outbound TLS connection to a DE control-plane endpoint.

Recommended components:

- **DE Tech Tool UI/CLI:** interactive technician experience, audit/apply, local evidence.
- **DE Tech Agent Windows service:** optional background service using the same action engine; no arbitrary shell by default.
- **DE Control Plane:** Intelligence Hub service for device registration, heartbeat, job queue, signed profile/catalog distribution and evidence intake.
- **Remote-assist provider adapter:** JumpCloud Remote Assist first. A self-hosted MeshCentral deployment can be integrated later for attended/unattended remote sessions instead of building a remote-desktop protocol into DE Tech Tool.

### Device identity

- One-time enrollment token only for bootstrap.
- Exchange it for a unique per-device client certificate.
- Store private keys in the Windows machine certificate store; prefer TPM-backed non-exportable keys when available.
- Use mutual TLS, certificate rotation and immediate server-side revocation.
- Bind device identity to DE account/client/device IDs; never infer tenant scope from hostname alone.

### Job security

Remote jobs are immutable signed envelopes containing job id, account/device ids, action id + version, typed parameters, issued/expiry times, replay nonce, required privilege/approval, catalog/profile hashes and signature.

The agent runs only allowlisted DE action IDs from a signed local catalog. Arbitrary remote PowerShell is not part of the normal control plane. Any future emergency shell must be a separate break-glass capability: disabled by default, just-in-time approved, short-lived and fully transcripted.

### Transport

Use outbound HTTPS long-polling or WebSocket over TLS. Endpoints never talk directly to the database.

Minimum API surface: enroll, heartbeat/inventory delta, lease job, acknowledge/start, result/evidence upload, signed profile/catalog refresh and identity rotation/revocation.

Every job is idempotent and leased. Offline endpoints keep full local functions and queue evidence for later upload.

### Updates

Release packages are code-signed and sha256-pinned. The server advertises version/hash; the endpoint verifies signature and hash before replacement. No unsigned server-supplied script executes.

## Recovered work that must not be lost

- Windows PowerShell 5.1 compatibility and Windows CI.
- Safe WPF button handling and background jobs.
- Audit -> desired state -> apply -> verify -> retry -> remediation / rollback.
- Restart/resume.
- Runtime-only secrets and redaction.
- Client profiles separate from machine state.
- ProActive IT / Office / Business / Enterprise bundle catalog.
- 13 canonical standalone solution families.
- Dropship / pre-provision mode.
- Alamo-only client branding.
- Packaged DE brand assets.
- JumpCloud agent, mapping/binding, groups, policies, Device Trust and migration gates.
- Guardz primary platform, SentinelOne EDR, Blackpoint approved alternate/backup, PABX browser controls.
- OS/browser baseline, apps, networking, backup, remote support and branding.
- Vendor Admin Center.
- Evidence bundle, client-safe report and Hub handoff.
- Packaging, integrity, Authenticode path, RMM and Intune deployment.
- Automation Library, Run Automation, Workflow Builder, Onboarding, Assess, Remediate, Run History, Evidence and Vendor Actions direction.

## Implementation order

1. ~~Finish planning/bundle layer and Dropship.~~ Done in 1.5.0: one catalog (`console/catalog/bundles.json`: tiers, GCC High and Co-Managed variants, add-ons, 13 standalone solutions), plan composition and gates in `DE.Planning`, generated `playbooks/`, and dropship kits (`packaging/New-DEDropshipKit.ps1`) that refuse a device other than the ordered one.
2. Keep DE Tech Tool naming and packaged DE/Alamo assets consistent.
3. Validate on a real DE Windows laptop in audit mode.
4. Confirm remaining installer sources/hashes without weakening trust policy.
5. ~~Define Hub device-intake/call-home API.~~ 1.7.0: contracts in `console/contracts`, signed `techconsole` events, Hub intake route in a draft Intelligence-Hub PR.
   1.8.0: device-bound Hub-signed licences and watermarked builds, the pinned Toolbox of proven MSP scripts, the Command line page, a Windows PowerShell 5.1 and fail-closed bug hunt, DE Microsoft Admin 0.4 (Microsoft 365, Entra, Exchange, Intune, Autopilot, Azure, and the Gmail-to-Microsoft 365 migration engine), redesigned evidence reports and dark window controls, the Email migration page (scan every Windows account for Gmail, the project's next step, bounces) and signed email_migration.recorded events to the Hub (IT Operations shows them).
   1.9.0: the company-branded lock screen as its own enforced step (image, users cannot change it, shown at sign-in, Windows Spotlight off for every profile, exact undo, Windows Home reported), and Settings cards for the Intelligence Hub connection (the four parts sending needs, a Hub check, the release check) and code signing (this copy's signature, the certificates on the PC, how to get one, the signed rebuild).
   1.10.0: the licence follow-ups for the Hub licence service (Intelligence-Hub PR #310): the tool downloads the Hub's revocation list into its protected data folder (at launch when the Hub URL is set, and after activation; offline, the last saved list stays) and refuses a licence revoked in it or in the shipped `trust/revoked.json`, which a release build made with `-HubUrl` refreshes; a licence pinned to a build (`bid`) works only in that build (state `wrong-build`).
   1.10.1: the boot rescue sends its handoff to the Hub only with the client's Hub account number (asked at the rescue prompt, or `-HubAccountId` on media made for one client); before this the Hub refused every rescue send as "account not mapped". A refused send records the Hub's own reason. DE Microsoft Admin 0.5.0 adds the Hub job loop (`Invoke-DEHubJobLoop`).
   1.10.2: the device and email migration sends record the Hub's own reason when it refuses (for example "Hub refused: account not mapped"), shared with the boot rescue (`DE.Contracts` `Get-DEHubErrorReason`), and the Evidence page shows it. Secret-named keys in a device record (an `apiToken` in an exception note, say) are left out of what goes to the Hub instead of being sent as `[REDACTED]`, which the Hub refused, failing every send; local state and logs still keep them as `[REDACTED]`. `GO-LIVE.md` lists every production step in order.
   1.10.4: a headless run sends the warranty lookup to the Hub right after the device record it already sent (`Send-DEHubWarranty`, same terms as the Evidence page button: only a confirmed answer; `-WhatIf` sends nothing; a send that cannot happen is a WARN and never changes the exit code).
   1.10.5: the DE Windows baseline owns the pre-logon authorized-use/security-monitoring notice. `windows.logonNotice` in each client profile selects DE standard wording, client-approved custom wording, or an explicit disabled state; the tool writes Windows `LegalNoticeCaption`/`LegalNoticeText`, verifies exact desired state before reporting success, records the pre-DE values once, and restores them on rollback. The DE default names the client as the business context and Digerati Experts only as an authorized technology service provider where applicable.
   1.10.3: the Evidence page's Send to Intelligence Hub sends the latest warranty lookup after the device record, as its own signed `device.warranty` event (`DE.Evidence` `Send-DEHubWarranty`; the Hub accepts that event type (Intelligence-Hub `techconsole-contract.ts`), but no tool code sent it, so warranty reached the Hub only inside the device record). Only a confirmed answer goes (active or expired with an end date, recomputed for the day, or not-applicable); no lookup, a fallback to the maker's check page or `unknown` sends nothing and records a WARN saying why. The status line reports both sends. DE Microsoft Admin 0.6.0: the Hub worker runs Exchange Online and Azure jobs unattended, signing in with the Graph app's certificate only when such a job has verified (`-ExchangeOrganization`, `-AzureSubscriptionId`), signing out at the end, and posting a job it cannot sign in for as Failed with what is missing.
6. Build the outbound-only DE Tech Agent with mTLS, signed jobs and evidence sync.
7. Integrate remote assist as a provider rather than building a remote-desktop protocol first.
8. Add connected fleet/device views to Intelligence Hub Tech Hub.
