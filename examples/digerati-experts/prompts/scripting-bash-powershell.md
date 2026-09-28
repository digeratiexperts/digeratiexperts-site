# Bash and PowerShell scripting for RMM deployment

Command: /script | Area: engineering | Module: scripting-bash-powershell

Fill every field in square brackets before sending. Fields in this playbook:
- [WHAT THE SCRIPT MUST DO, in one paragraph]
- [Windows (Windows PowerShell 5.1 or PowerShell 7.4), macOS, Linux distro and version]
- [PARAMETERS the RMM will pass, and which are secret]
- [READ-ONLY REPORT, CHANGES STATE, or BOTH]
- [PASTE or NONE]

```text
You are the DE automation engineer. Write or review the script requested for RMM deployment.

INPUTS
Task: [WHAT THE SCRIPT MUST DO, in one paragraph]
Platform: [Windows (Windows PowerShell 5.1 or PowerShell 7.4), macOS, Linux distro and version]
Run context: pushed through the RMM as SYSTEM or root, non-interactive, one script per task
Inputs and secrets: [PARAMETERS the RMM will pass, and which are secret]
Change or read-only: [READ-ONLY REPORT, CHANGES STATE, or BOTH]
Existing script to review: [PASTE or NONE]

OUTPUT for a new script:
1. Plan: detection logic, change logic, verification, rollback, in five lines.
2. The script, complete, with header comment (purpose, parameters, exit codes, tested-on), strict mode and error handling, dry-run or -WhatIf support, idempotent checks, timestamped logging per DE convention, secrets read from environment or RMM variables only, and a one-line summary on the last line of output.
3. Test plan: commands to run on a clean machine as SYSTEM or root, expected output for first run, second run (NO CHANGE), and failure case.
4. RMM deployment notes: parameters to set, timeout, reboot handling, and how the exit code should be interpreted.
5. Rollback: exact steps or script.
OUTPUT for a review:
1. Findings table: line, issue, severity (BLOCKER, HIGH, MEDIUM, LOW), fix.
2. Corrected script.
3. What changed and why, in bullets.

Never embed credentials, never disable TLS verification, never download from an unpinned URL, and do not produce anything designed to evade security tooling.
```

Rules this playbook assumes:
- Target: Windows PowerShell 5.1 minimum, PowerShell 7.4 preferred; bash 5 (POSIX sh when the target may be busybox or macOS /bin/sh). State which one at the top of the script and fail fast if the runtime is wrong.
- Deployment: pushed through the RMM as SYSTEM or root, non-interactive, one script per task. No prompts, no GUI, no `Read-Host` or `read`, no reliance on a logged-in user or mapped drives.
- Safety: PowerShell uses `Set-StrictMode -Version Latest`, `$ErrorActionPreference = 'Stop'`, `[CmdletBinding(SupportsShouldProcess)]` with `-WhatIf` for anything that changes state; bash uses `set -Eeuo pipefail`, `IFS=$'\n\t'`, quoted variables, `trap` on ERR and EXIT, and a `DRY_RUN=1` path.
- Idempotent: detect current state, change only what differs, report NO CHANGE when nothing is needed. Re-running is always safe.
- Logging: write a timestamped log under ProgramData\DE\logs (Windows) or /var/log/de/ (Linux and macOS) and echo a one-line summary for the RMM output. Exit 0 success, 1 failure, 2 bad input or wrong runtime, 3 reboot required; write the reason on the last line.
- Secrets never live in the script or in RMM script text; read them from the RMM's secure variables or a vault at run time and never echo them.
- Ship with: a header (purpose, params, exit codes, tested-on), a `-WhatIf` or dry-run example, a rollback note, and the one-line verification command.
- Review checklist before deploy: runs on a clean test machine as SYSTEM, PSScriptAnalyzer or ShellCheck clean, 32 and 64-bit paths handled on Windows, execution-policy bypass only for the process scope, no network calls to unpinned URLs.
