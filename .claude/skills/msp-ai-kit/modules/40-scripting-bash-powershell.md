---
id: scripting-bash-powershell
title: Bash and PowerShell scripting for RMM deployment
area: engineering
priority: 25
command: /script
---
## Line
Scripts: idempotent, non-interactive, logged, no secrets, dry-run, RMM exit codes.

## Rules
- Language: {{scripting.powershell_default}}. {{scripting.bash}} for Linux, macOS, or shell tooling. State the runtime at the top and fail fast (exit 2) if it is wrong.
- Shape: pre-check, plan, apply, verify, retry when safe, report. Detect the real machine state instead of trusting the technician's assumption; separate detection, mutation, verification, and output; never claim success until verification passes.
- Deployment: {{scripting.deployment}}. No prompts, no GUI, no `Read-Host` or `read`, no dependence on a logged-in user, mapped drive, or interactive elevation.
- PowerShell: `Set-StrictMode -Version Latest`, `$ErrorActionPreference = 'Stop'`, `try/catch/finally` with `-ErrorAction Stop` around consequential calls, `[CmdletBinding(SupportsShouldProcess)]` with `-WhatIf` for anything that changes state, `$null` on the left of comparisons, `$()` interpolation where parsing is ambiguous, objects and `Write-Output` for reusable logic rather than `Write-Host`, CIM cmdlets instead of WMIC, execution-policy bypass only at process scope.
- Bash: `#!/usr/bin/env bash`, `set -Eeuo pipefail`, `IFS=$'\n\t'`, quoted `"${var}"` expansions, functions with a `main "$@"` entry point, dependency checks before work, `trap` on ERR and EXIT, a `DRY_RUN=1` path, ShellCheck clean, external input treated as untrusted.
- Idempotent and resumable: change only what differs, report NO CHANGE when nothing is needed, persist non-secret resume state for long or reboot-spanning workflows, and fail closed on ambiguous identity, privilege, encryption, or security state.
- Secrets: {{join scripting.runtime_only_secrets}} live in memory for the run only, read from RMM secure variables or a vault, never written to scripts, logs, transcripts, receipts, exceptions, or resume state. Redact before anything is exported.
- Logging and exit codes: {{scripting.logging}}. Exit 0 success, 1 failure, 2 bad input or wrong runtime, 3 reboot required; the last output line states the result and the next step.
- Never disable a security control globally to make automation easier, never disable TLS verification, never download from an unpinned URL, and never write anything meant to evade security tooling.
- Quality bar before delivery: parses; PSScriptAnalyzer or ShellCheck clean; PowerShell 5.1 compatibility confirmed for Windows endpoint scripts; every referenced command exists or has a fallback; helper functions tested on their own; no secret reaches a log; resume and reboot paths exercised; non-happy paths tested; ships as an operational tool with header (purpose, parameters, exit codes, tested-on), dry-run example, rollback note, and one-line verification command.
- Full DE conventions and the endpoint provisioning model: `references/de-scripting-msp-skill-pack.md` in this kit.

## Prompt
You are the {{company.short}} automation engineer. Write or review the script requested for RMM deployment, following the {{company.short}} scripting conventions.

INPUTS
Task: [WHAT THE SCRIPT MUST DO, in one paragraph]
Platform: [Windows ({{scripting.powershell_default}}), macOS, or Linux distro and version]
Run context: {{scripting.deployment}}
Inputs and secrets: [PARAMETERS the RMM will pass, and which are secret]
Change or read-only: [READ-ONLY REPORT, CHANGES STATE, or BOTH]
Reboot or resume needed: [YES with the phases that span a reboot, or NO]
Existing script to review: [PASTE or NONE]

OUTPUT for a new script:
1. Plan in six lines: pre-check (state detected), plan (what would change), apply, verify, retry policy, report.
2. The script, complete: header comment (purpose, parameters, exit codes, tested-on), strict mode and error handling, dry-run or -WhatIf support, idempotent detection before mutation, resume state (non-secret) if phases span a reboot, timestamped logging per {{company.short}} convention, secrets read from environment or RMM variables only and redacted from every output, a one-line summary as the last output line.
3. Test plan: commands to run on a clean machine as SYSTEM or root; expected output for first run, second run (NO CHANGE), the failure path, and the reboot-resume path if any.
4. RMM deployment notes: parameters to set, secure variables to define, timeout, reboot handling, and how each exit code should be interpreted.
5. Rollback: exact steps or script.
6. Quality bar checklist with a PASS or NOT DONE against each item in the {{company.short}} scripting rules.
OUTPUT for a review:
1. Findings table: line, issue, severity (BLOCKER, HIGH, MEDIUM, LOW), fix. Any secret written to a log, transcript, or state file is a BLOCKER.
2. Corrected script.
3. What changed and why, in bullets.

Never embed credentials, never disable TLS verification, never download from an unpinned URL, and do not produce anything designed to evade security tooling.

## Brief
- {{scripting.powershell_default}}; state the runtime, fail fast, pre-check then plan then apply then verify then report.
- Strict mode, WhatIf or dry run, idempotent detection, non-secret resume state, secrets runtime-only and redacted, exit codes 0/1/2/3.
- Delivery bar: parses, analyzer clean, 5.1 compatible, helpers tested, no secret in a log, reboot and failure paths exercised.

## Example
Input (abridged): Task: ensure the DE browser extension policy registry keys exist for Edge and Chrome and report drift. Platform Windows PowerShell 5.1. Run context: RMM as SYSTEM. Inputs: none secret. Change or read-only: BOTH (report by default, apply with -Apply). No reboot.
Output (abridged):
1. Plan: pre-check reads HKLM policy keys for both browsers; plan lists missing or wrong values; apply writes only the differing values under ShouldProcess; verify re-reads; report one line.
2. Script skeleton: header with purpose, parameters (-Apply, -LogPath), exit codes, tested-on; `Set-StrictMode -Version Latest`; `$ErrorActionPreference = 'Stop'`; `[CmdletBinding(SupportsShouldProcess)]`; a `Get-DesiredState` function returning objects; `Compare-State`; `Set-State` guarded by `$PSCmdlet.ShouldProcess`; `Test-State`; `Write-Log` to ProgramData\DE\logs; final line "RESULT: NO CHANGE" or "RESULT: APPLIED 3, VERIFIED".
3. Test plan: first run without -Apply prints the drift and exits 0; run with -Apply -WhatIf prints the operations; run with -Apply changes the keys and exits 0; second run prints NO CHANGE; a run with a locked key exits 1 with the error and remediation.
4. RMM notes: run as SYSTEM, 5 minute timeout, exit 0 success, 1 failure, 2 wrong runtime; schedule daily in report mode, weekly in apply mode.
5. Rollback: the script writes the previous values to the log; restore them with the same script using -Restore <logfile>.
6. Quality bar checklist: parse PASS, PSScriptAnalyzer PASS, 5.1 PASS, helper tests PASS, secret logging NOT APPLICABLE, resume NOT APPLICABLE, reboot NOT APPLICABLE, failure path PASS.

## Notes
Keep a tested-scripts library per platform in {{stack.documentation}}; link the KB article for the task the script automates. For endpoint identity and security-stack work, run the endpoint-provisioning module first.
