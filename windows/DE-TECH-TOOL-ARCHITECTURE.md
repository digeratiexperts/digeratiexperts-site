# DE Tech Tool architecture and recovered roadmap

**Canonical product name:** DE Tech Tool.

Compatibility names such as DE Technician Console, TechConsole and MSP AI Kit may remain in file paths or launch aliases where changing them would break installed automation.

## Product rule: three components, one contract

DE Tech Tool has three parts. Each one works on its own, and all three were designed to work together.

| Component | Runs where | Works alone | Code |
|---|---|---|---|
| **Online** (Intelligence Hub) | techsales.digerati-experts.com | Device registry, orders/jobs, evidence and rescue intake, warranty history, fleet views | Intelligence-Hub repo, `POST /api/integrations/v1/techconsole/events` (draft PR; merging is a production deploy and needs DE approval) |
| **On-device** (DE Tech Tool) | The Windows device: OOBE, after first sign-in, configured | Discover, audit, plan, apply, verify, roll back and keep evidence, with no server | `console/` (WPF plus headless) |
| **Boot rescue** | WinPE from USB or ISO, when Windows will not boot or must not be booted | Unlock BitLocker with a typed recovery password, copy profiles, export drivers, check disk health, repair boot, revert stuck updates | `rescue/` (`New-DERescueMedia.ps1`, `Start-DERescue.ps1`, `DE.Rescue.psm1`) |

The contracts they share live in `console/contracts/*.schema.json` (JSON Schema). The Hub validates with
the same files, and `DE.Contracts` validates them on the device and in WinPE.

| Contract | Written by | Read by |
|---|---|---|
| `de.techconsole.device/v1` | on-device (`New-DEHubPayload`), rescue | Hub |
| `de.techconsole.order/v1` | DE / Hub | dropship kit, first boot |
| `de.techconsole.handoff/v1` | rescue | on-device (the `rescue.handoff` step), Hub |
| `de.techconsole.warranty/v1` | on-device (`DE.Warranty`) | Hub |
| `de.techconsole.job/v1` | Hub | on-device (planned: the signed DE Tech Agent) |

- **Device key.** Every component names a device `<maker>:<SERIAL>` (`ConvertTo-DEDeviceKey`), so the
  three agree without talking to each other. An OEM placeholder serial is refused, and the technician
  types the serial from the sticker.
- **No secrets in any contract.** Validators refuse secret-looking keys and any value shaped like a
  BitLocker recovery password.
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
6. Build the outbound-only DE Tech Agent with mTLS, signed jobs and evidence sync.
7. Integrate remote assist as a provider rather than building a remote-desktop protocol first.
8. Add connected fleet/device views to Intelligence Hub Tech Hub.
