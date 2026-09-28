# DE Tech Tool architecture and recovered roadmap

**Canonical product name:** DE Tech Tool.

Compatibility names such as DE Technician Console, TechConsole and MSP AI Kit may remain in file paths or launch aliases where changing them would break installed automation.

## Product rule

DE Tech Tool is one engine with two operating shapes:

1. **Standalone / offline-first.** The WPF app and headless CLI can discover, audit, plan, apply, verify, retry, roll back and produce evidence without any server connection.
2. **Connected control-plane mode.** The same engine can optionally call home to the Digerati Experts Intelligence Hub for signed profiles/catalogs, queued jobs, inventory, evidence and status.

The standalone engine is never disabled merely because the Hub is unavailable.

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

1. Finish planning/bundle layer and Dropship.
2. Keep DE Tech Tool naming and packaged DE/Alamo assets consistent.
3. Validate on a real DE Windows laptop in audit mode.
4. Confirm remaining installer sources/hashes without weakening trust policy.
5. Define Hub device-intake/call-home API.
6. Build the outbound-only DE Tech Agent with mTLS, signed jobs and evidence sync.
7. Integrate remote assist as a provider rather than building a remote-desktop protocol first.
8. Add connected fleet/device views to Intelligence Hub Tech Hub.
