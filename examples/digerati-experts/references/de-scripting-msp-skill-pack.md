# Digerati Experts Scripting & MSP Skill Pack

Version: 1.0
Purpose: Working rules for DE PowerShell/Bash automation, endpoint onboarding, MSP/MSSP operations, and security-oriented tooling.

## Source references loaded for this pack

This pack distills useful patterns from:

- mleoca/Bash-Scripting-GPT (`prompt.md`)
- RTFM-IT-Services-LLC/msp-claude-skills (`msp-onboarding`, `msp-security`)
- Servosity/msp-skills (MCP/integration architecture reference)
- LV-262/cmmc-advisor (CMMC routing and evidence-first compliance guidance)
- Joe's PowerShell/Bash rules supplied in chat

External defaults are reference material only. DE's own operational, pricing, security, identity, and packaging rules remain authoritative.

---

## 1. Default scripting language

- Windows endpoint automation: PowerShell 5.1 unless PowerShell 7+ is explicitly required.
- Cross-platform PowerShell: use PowerShell 7+.
- Bash only when Linux/macOS or shell tooling makes it the better fit.

## 2. Production-quality scripting rules

Every script should be built as a complete operational tool, not a demonstration skeleton.

Required design principles:

- Pre-check -> plan -> apply -> verify -> retry when safe -> report.
- Idempotent behavior whenever practical.
- Resumable state for long-running onboarding/provisioning workflows.
- Fail closed on ambiguous identity, privilege, encryption, or security state.
- Validate inputs before making changes.
- Detect the real machine state instead of trusting technician assumptions.
- Separate detection, mutation, verification, and UI logic.
- Prefer explicit functions over giant inline procedural blocks for large tools.
- Provide actionable errors with remediation guidance.
- Avoid silent failures.
- Never claim success until verification passes.

## 3. PowerShell conventions

- Prefer objects and `Write-Output`/returned objects for reusable logic rather than `Write-Host`.
- Put `$null` on the left side of equality checks.
- Use `$()` interpolation where adjacent characters could make variable parsing ambiguous.
- Use `Set-StrictMode` for substantial scripts where compatibility permits.
- Use `try/catch/finally` around consequential operations.
- Use `-ErrorAction Stop` where a failed operation must be caught.
- Prefer CIM cmdlets over deprecated WMIC.
- Avoid globally disabling security controls to make automation easier.
- Never persist passwords, API keys, MFA seeds, JumpCloud keys, SentinelOne tokens, Guardz keys, TAPs, BitLocker recovery passwords, or similar secrets in logs or reusable state.
- Redact secrets from exceptions, transcripts, receipts, and exported reports.
- Keep runtime secrets in memory only unless an approved secure credential system is explicitly used.

## 4. Bash conventions

- Shebang: `#!/usr/bin/env bash`
- Use `set -euo pipefail` when compatible with the task.
- Quote expansions carefully: `"${var}"`.
- Use functions and a `main()` entry point for non-trivial scripts.
- Validate commands and dependencies before execution.
- Prefer ShellCheck-friendly constructs.
- Treat external input as untrusted.

## 5. DE endpoint onboarding execution model

A DE endpoint provisioning tool should operate as a stateful orchestration engine rather than a pile of installers.

Core phases:

1. Intake / client / site / user / tier / authority
2. Hardware / BIOS / firmware / OS readiness
3. Identity discovery
4. Identity migration plan when required
5. Break-glass readiness
6. Encryption / TPM / Secure Boot
7. JumpCloud / endpoint authority
8. Security stack
9. Browser / application baseline
10. Microsoft 365 / user application identity
11. Branding / DE and client experience
12. Verification / evidence / receipt
13. Documentation / Hub handoff

Every phase should expose:

- Detected state
- Desired state
- Readiness gate
- Action
- Verification
- Retry / rollback option where safe
- Evidence
- Technician notes

## 6. Windows identity graph requirements

Detect and distinguish:

- Local/workgroup
- Microsoft Entra registered / Workplace Joined
- Microsoft Entra Joined
- Microsoft Entra Hybrid Joined
- Active Directory domain joined
- Unknown / conflicting state

Collect before changing identity:

- `dsregcmd /status`
- current principal and SID
- user-profile paths and SIDs
- local users
- local administrators
- Windows Hello / NGC state
- PRT / SSO state
- TPM state
- BitLocker state
- MDM indicators
- OneDrive state and known-folder redirection
- JumpCloud user / local-account mapping
- existing profile collisions
- pending reboot state

Never blindly run an Entra leave/unjoin operation.

## 7. Entra -> JumpCloud migration rules

When JumpCloud is the intended Windows identity authority:

- Preserve the existing user profile.
- Do not assume an Entra principal can be directly taken over as a JumpCloud local account.
- Establish the intended local username first.
- Detect username/profile/SID collisions.
- Verify a dedicated local break-glass administrator before identity changes.
- Keep Joe's `jrpetro` account as the normal JumpCloud-managed DE administrator, not the break-glass identity.
- Create a separate local-only break-glass administrator.
- Hide the break-glass account from normal sign-in tiles without disabling it.
- Verify the break-glass login interactively before unjoin/migration.
- Preserve existing profile data and re-associate carefully instead of creating duplicate profiles.
- Reboot and verify local authentication before considering the migration complete.
- Bind/take over the intended local JumpCloud account only after the local identity is correct.
- Reconnect Microsoft 365/Teams/Outlook/OneDrive as application identities after Windows identity migration.

## 8. BitLocker migration gate

Before identity migration:

- OS volume fully encrypted.
- Protection on.
- RecoveryPassword protector present.
- Protector ID verified against independently stored recovery record.
- Never store the recovery password in DE logs or provisioning state.
- Record only non-secret verification metadata.

## 9. OneDrive migration gate

Detect:

- running process
- configured account keys
- user folder
- Known Folder Move for Desktop/Documents/Pictures
- meaningful synced content

Classification examples:

- Active + KFM
- Active without KFM
- Dormant/unconfigured
- Unknown/review required

Do not detach identity while material OneDrive sync risk is unresolved.

## 10. Break-glass standard

Break-glass account must be:

- Local-only
- Enabled
- Administrator
- Strongly credentialed
- Hidden from normal sign-in tiles
- Usable through explicit `Other user` / `.\\username`
- Independent of JumpCloud and Entra
- Verified interactively

Do not store the password in ordinary DE logs/state/reusable profiles.

## 11. Security stack as first-class provisioning components

The onboarding engine should pre-check, apply, verify, retry, and report at minimum:

- JumpCloud / OneTouch
- Guardz Device Agent
- SentinelOne Managed
- Prisma Browser Extension / PABX policy
- DE Windows baseline
- BitLocker
- TPM / Secure Boot
- browser baseline
- required Microsoft 365 components

Guardz Organization Keys and SentinelOne Site Tokens are runtime-only secrets and must not be persisted in onboarding state or normal logs.

## 12. MSP onboarding concepts adapted for DE

Useful patterns from MSP onboarding skill sets:

- document the environment as-found before mutation
- create repeatable onboarding phases
- collect evidence, not just checkboxes
- define explicit handoff to steady-state support
- separate client-facing communication from internal technical truth
- protect credentials from tickets, notes, and loose files
- maintain authoritative client/site/device/user relationships

DE's own Intelligence Hub remains the internal control plane/source of truth.

## 13. MSP security concepts adapted for DE

Use an evidence-based baseline:

- identity/MFA
- endpoint protection
- email security
- patching
- encryption
- backup/recovery
- admin separation
- logging/detection
- browser/security controls
- offboarding

Client-facing language should describe controls actually implemented and verified. Avoid unsupported claims of guaranteed security or certification.

## 14. CMMC / regulated-client rule

For CMMC-specific work:

- route to authoritative evidence and control references
- distinguish FCI vs CUI
- define the system boundary first
- map technical controls to evidence artifacts
- keep current requirement version and transition context explicit
- do not claim certification/compliance solely from tool presence

DE GCC/GCC High or regulated packaging must be validated separately from standard commercial packaging.

## 15. UI/UX requirements for DE provisioning console

The technician should not need to memorize commands.

The console should provide:

- prominent machine/client/user identity header
- health/status cards
- automatic state detection
- grouped phases
- clear PASS / WARN / BLOCKED / READY states
- one-click safe actions
- destructive-action confirmation
- dry-run / audit mode
- resume after reboot
- exportable final receipt
- copyable diagnostic bundle
- searchable logs with secret redaction
- optional advanced/technician detail drawer
- visible next recommended action
- no hidden dependency on manually typed PowerShell unless troubleshooting

## 16. Execution gates

A consequential identity/security step is locked until prerequisite gates pass.

Examples:

- Entra disconnect locked until break-glass and BitLocker gates pass.
- JumpCloud takeover locked until target username/profile mapping is unambiguous.
- final handoff locked until critical security controls verify.
- 'Complete' cannot be set merely because an installer exited zero; verification must succeed.

## 17. Evidence and reporting

Every action should produce structured evidence such as:

- timestamp
- step ID
- detected before-state
- action attempted
- result
- verification result
- retry count
- non-secret identifiers
- error/remediation if failed

Never include secrets in evidence output.

## 18. Script quality bar

Before delivery:

- parse/syntax validation
- PSScriptAnalyzer where practical
- PowerShell 5.1 compatibility check for Windows endpoint scripts
- test important helper functions independently
- confirm all referenced commands exist or have fallbacks
- validate no secret logging
- verify state/resume logic
- test reboot-sensitive operations
- test non-happy paths
- produce a final operationally useful tool, not a mockup

---

This pack is intentionally DE-specific. External skill kits are references, not DE policy.
