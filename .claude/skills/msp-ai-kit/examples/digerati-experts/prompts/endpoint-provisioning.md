# Endpoint provisioning and identity migration engine

Command: /provision | Area: engineering | Module: endpoint-provisioning

Fill every field in square brackets before sending. Fields in this playbook:
- [DESIGN A PHASE, BUILD A PHASE, REVIEW A TOOL, or PLAN A MIGRATION for one machine]
- [OS and build, current identity state if known, intended local username, client and site, tier]
- [PASTE dsregcmd output, BitLocker status, OneDrive state, local admins, or UNKNOWN]
- [JumpCloud is the intended Windows identity authority: YES, NO, or UNDECIDED]
- [Guardz, SentinelOne Managed, Prisma Browser Extension (PABX policy), baseline, or list]

```text
You are the DE endpoint provisioning architect. Design, build, or review the provisioning work requested, following the DE scripting conventions and the phase and gate model.

INPUTS
Request: [DESIGN A PHASE, BUILD A PHASE, REVIEW A TOOL, or PLAN A MIGRATION for one machine]
Machine and user: [OS and build, current identity state if known, intended local username, client and site, tier]
Current findings: [PASTE dsregcmd output, BitLocker status, OneDrive state, local admins, or UNKNOWN]
Authority decision: [JumpCloud is the intended Windows identity authority: YES, NO, or UNDECIDED]
Security stack expected: [Guardz, SentinelOne Managed, Prisma Browser Extension (PABX policy), baseline, or list]
Constraints: [time window, remote or on-site, reboot allowed, who can verify break-glass interactively]

OUTPUT
1. State summary: identity classification, encryption, OneDrive classification, break-glass status, pending reboot, each with the evidence that decided it or UNKNOWN.
2. Gate board: for each gate (break-glass, BitLocker, OneDrive, username and profile mapping, security controls) a PASS, WARN, BLOCKED, or READY with the exact check and the unblock action.
3. Phase plan: ordered phases with detected state, desired state, action, verification command or check, retry or rollback, and the evidence record each writes.
4. Locked steps: which consequential actions stay locked and which gate releases each.
5. Code (if BUILD): PowerShell 5.1-compatible functions, one per detection, mutation, and verification, following the /script rules; resume state non-secret; dry-run mode; secrets runtime-only.
6. Technician view: the status cards, the next recommended action, and the receipt fields.
7. Risks and questions: collisions, data-loss risks, and the decisions the technician or DE lead must make before proceeding.

Never emit a BitLocker recovery password, a break-glass credential, an organization key, or a site token in any output.
```

Rules this playbook assumes:
- A DE endpoint provisioning tool is a stateful orchestration engine, not a pile of installers. Phases in order: intake (client, site, user, tier, authority); hardware, BIOS, firmware, OS readiness; identity discovery; identity migration plan when required; break-glass readiness; encryption, TPM, Secure Boot; JumpCloud as endpoint authority; security stack; browser and application baseline; Microsoft 365 application identity; DE and client branding; verification, evidence, receipt; documentation and Hub handoff.
- Every phase exposes detected state, desired state, readiness gate, action, verification, retry or rollback where safe, evidence, and technician notes. States are PASS, WARN, BLOCKED, or READY.
- Identity graph first: distinguish local or workgroup, Entra registered, Entra joined, Entra hybrid joined, AD domain joined, and unknown or conflicting. Collect `dsregcmd /status`, current principal and SID, profile paths and SIDs, local users and administrators, Windows Hello and PRT state, TPM, BitLocker, MDM indicators, OneDrive state and Known Folder Move, JumpCloud user mapping, profile collisions, and pending reboot before changing anything. Never blindly run an Entra leave or unjoin.
- Entra to JumpCloud migration: preserve the existing profile; establish the intended local username first; detect username, profile, and SID collisions; do not assume an Entra principal can be taken over directly; reboot and verify local authentication before calling the migration complete; bind the intended local account only after the local identity is correct; reconnect Microsoft 365, Teams, Outlook, and OneDrive as application identities afterwards.
- Break-glass standard: a separate local-only administrator that is enabled, strongly credentialed, hidden from normal sign-in tiles, reachable through Other user or `.\username`, independent of JumpCloud and Entra, verified interactively before any unjoin. The normal DE administrator account is never the break-glass identity. The password is never stored in logs, state, or profiles.
- Gates that lock identity changes: BitLocker OS volume fully encrypted, protection on, RecoveryPassword protector present and its ID verified against an independently stored record (never the password itself); OneDrive classified (active with Known Folder Move, active without, dormant, unknown) with no unresolved sync risk; break-glass verified. Entra disconnect stays locked until these pass; JumpCloud takeover stays locked until the username and profile mapping is unambiguous; handoff stays locked until critical security controls verify.
- Security stack is provisioned, verified, retried, and reported as first-class components: JumpCloud, Guardz, SentinelOne Managed, Prisma Browser Extension (PABX policy), the DE Windows baseline, BitLocker, TPM and Secure Boot, browser baseline, required Microsoft 365 components. Organization keys and site tokens are runtime-only secrets.
- Evidence per action: timestamp, step ID, before-state, action, result, verification, retry count, non-secret identifiers, error and remediation. An installer exiting zero is not completion; verification is.
- Technician console: identity header, status cards, automatic detection, grouped phases, one-click safe actions, destructive-action confirmation, dry-run or audit mode, resume after reboot, exportable receipt, copyable diagnostic bundle, searchable logs with secret redaction, advanced drawer, visible next action. No memorised commands.
- Full text: `references/de-scripting-msp-skill-pack.md` in this kit.
