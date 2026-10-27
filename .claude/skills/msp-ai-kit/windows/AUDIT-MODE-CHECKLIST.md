# Real-laptop audit-mode checklist

Roadmap step 3 of [DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md). Move 5 of the
[104-move tracker](DE-TECH-TOOL-TRACKER.md); move 25 is the run itself.

**What this is.** A repeatable procedure for validating DE Tech Tool on a real DE Windows laptop
in **audit mode**, and a recording sheet for what actually happened.

**What this is not.** Not a release checklist (that is GO-LIVE.md Part G). Not a test suite. Not a
document that already contains results.

> **Rule: record only what happened.** Every result field below starts empty and gets filled during
> the run. If a step was skipped, write `SKIPPED` and why. Never infer, tidy up, or fill in a value
> because it is probably right. A checklist with plausible-looking entries is worse than an empty
> one, because it reads as evidence.

## Why audit mode

Audit mode **detects and compares only**. It never applies, whatever the console mode says
(`Invoke-DEAction -Mode Audit` never Applies). That makes it safe to run on a real laptop that is
in use, and it is the right first validation: it proves discovery, planning, evidence and reporting
work before anyone trusts the tool to change a machine.

## Before you start

Have these ready. The run is not meaningful without them.

- [ ] A real DE Windows laptop, on battery or mains, with the chassis sticker readable
- [ ] The exact build you are validating: `console\BUILD.json` build id, or `dev` for a checkout
- [ ] The client profile id you will audit against (for example `alamo`)
- [ ] A place to put the evidence: `C:\DE\evidence\<yyyy-mm-dd>-audit\`
- [ ] This document, so the recording sheet is filled in as you go

Record the starting state. Later findings are only interpretable against it.

| Field | Value |
|---|---|
| Date / time (local) | |
| Technician | |
| Laptop make and model | |
| Windows edition and version (`winver`, or `Get-ComputerInfo`) | |
| Windows architecture (x64 / ARM64) | |
| Elevated? (yes / no, and how) | |
| Signed build or dev checkout | |
| Build id (`console\BUILD.json`, or `dev`) | |
| Licence state (Settings > Licence) | |
| Client profile id | |

## Part A. Launch and integrity

- [ ] A1. Start the console: `Start-DETechTool.cmd`
- [ ] A2. Read the window title. It carries the build id and who the copy was issued to. Record it:
- [ ] A3. Check the status line for an integrity warning. A signed build reports clean; a dev
      checkout reports `Unsigned development build. Use the signed release for client work.`
- [ ] A4. Open Settings > Code signing. Record what the copy's own signature says.

| Step | Result (PASS / WARN / FAIL / SKIPPED) | What it actually said |
|---|---|---|
| A1 | | |
| A2 | | |
| A3 | | |
| A4 | | |

## Part B. Discovery, read-only

- [ ] B1. Run discovery (Scan). It must complete without a crash.
- [ ] B2. Confirm the snapshot covers: device, identity, MDM, security agents, BitLocker, Windows
      Update, network, browsers, reboot state.
- [ ] B3. Note anything discovery reports as absent that you can see is present. **This is the
      failure mode that hides** — an empty `catch` turns "could not read" into "not installed".
- [ ] B4. Record the serial discovery used, and whether it matched the chassis sticker. An OEM
      placeholder serial (`To be filled by O.E.M.`) must be refused as a device key.

| Step | Result | What it actually said |
|---|---|---|
| B1 | | |
| B2 | | |
| B3 | | |
| B4 | | |

## Part C. Audit the plan, change nothing

- [ ] C1. Choose the client profile and bundle, and build the plan.
- [ ] C2. Walk the plan. Confirm every step shows an audit result and none shows an applied change.
- [ ] C3. Record the mix of results you saw. The full set is: `PASS`, `WARN`, `FAIL`, `NO CHANGE`,
      `EXCEPTION`, `PLANNED`, `SKIPPED`, `BLOCKED`.
- [ ] C4. Confirm a step that is not in desired state reads `WARN` or `PLANNED`, **never `PASS`**.
      This is move 11 and it is the single most important property in this checklist.
- [ ] C5. If any step is under an approved exception, confirm it reads `EXCEPTION`, not `PASS`.
- [ ] C6. Note any step that reads `BLOCKED` and record the stated reason.

| Step | Result | What it actually said |
|---|---|---|
| C1 | | |
| C2 | | |
| C3 | | counts: PASS__ WARN__ FAIL__ NO CHANGE__ EXCEPTION__ PLANNED__ SKIPPED__ BLOCKED__ |
| C4 | | |
| C5 | | |
| C6 | | |

## Part D. Evidence

- [ ] D1. Export the evidence bundle (Evidence page). Record the zip path and its sha256.
- [ ] D2. Open the **internal** report. Confirm it matches what you saw in Part C.
- [ ] D3. Open the **client-facing** report. Confirm it carries no costs, margins, keys, vendor
      sourcing or restricted fields (moves 12 and 13).
- [ ] D4. Confirm the redacted log contains no BitLocker recovery passwords and no tokens
      (move 14).
- [ ] D5. Confirm the bundle was written and not withheld. If it was withheld, the tool deleted the
      zip and folder because it found a registered secret in it — that is a console bug worth
      reporting, not a working-as-intended outcome.

| Step | Result | What it actually said |
|---|---|---|
| D1 | | zip: <br>sha256: |
| D2 | | |
| D3 | | |
| D4 | | |
| D5 | | |

## Part E. Headless, from the same laptop

- [ ] E1. Run headless in audit mode:

      console\DETechConsole.ps1 -Headless -Client <profile id> -Mode audit -ResultFile C:\DE\result.json

- [ ] E2. Confirm the exit code is the one the outcome deserves: `0` ready, `1` failures, `2` refused.
- [ ] E3. Confirm `-ResultFile` was written, is valid JSON, and has **no** BOM (RMM parses it).
- [ ] E4. Confirm the result file carries no secrets.
- [ ] E5. Repeat from a **32-bit** host and confirm the 64-bit relaunch keeps the exit code:

      %SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass ^
        -File console\DETechConsole.ps1 -Headless -Client <profile id> -Mode audit -ResultFile C:\DE\result32.json

- [ ] E6. Repeat under the RMM agent as **SYSTEM** and record whether anything differed.

| Step | Result | Exit code | What it actually said |
|---|---|---|---|
| E1 | | | |
| E2 | | | |
| E3 | | | |
| E4 | | | |
| E5 | | | |
| E6 | | | |

## Part F. Time and resource

- [ ] F1. Record wall-clock time for discovery, for the audit, and for the evidence export.
- [ ] F2. Record peak memory and the size of the evidence bundle.
- [ ] F3. Note anything that felt slow. Move 36 sets the timeouts from these numbers, so an
      unrecorded slow run costs a second run later.

| Step | Discovery | Audit | Evidence export | Notes |
|---|---|---|---|---|
| F1-F3 | | | | |

## Findings

Record every finding here and file each one as a tracked issue (move 38). Do not fix anything
during the run; the point is to learn what the tool does on real hardware.

| # | What happened | Where (step) | Severity | Issue link |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

Severity: `blocker` (audit mode must not do this) / `major` (wrong answer) / `minor` (cosmetic or
slow).

## After the run

- [ ] Save this document filled in, next to the evidence bundle, under
      `C:\DE\evidence\<yyyy-mm-dd>-audit\`.
- [ ] File a tracked issue per finding.
- [ ] Copy the bundle sha256 and build id into the issue for move 25 so the run is quotable later.
- [ ] If anything in Part C read `PASS` when the machine was not in desired state, stop and raise
      it as a **blocker** before any Apply run is attempted anywhere.

## What this checklist feeds

| Next | Needs |
|---|---|
| Move 25 — audit-mode run recorded as evidence | This checklist, filled in |
| Move 26 — Windows Home | Same run, Home edition, record what it reports |
| Move 27 — 32-bit RMM host | Part E5 |
| Move 28 — as SYSTEM under RMM | Part E6 |
| Move 36 — timeouts | Part F |
| Move 38 — findings as tracked issues | The Findings table |
