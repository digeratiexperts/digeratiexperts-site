# MSP AI Kit on Windows

Three files in this folder turn the kit into a double-click tool with a DE-styled window:

| File | Purpose |
|---|---|
| `Start-MspAiKit.cmd` | Launcher. Double-click for the window, or pass options through to the loader. Runs Windows PowerShell 5.1 in STA mode with the execution policy bypassed for that process only. |
| `Install-MspAiKit.ps1` | The engine: pre-check, plan, apply, verify, report. Idempotent. `-WhatIf` / `-DryRun` on every change. Writes a log and a JSON receipt. Also the RMM entry point. |
| `MspAiKit.Gui.ps1` | The window (WPF, ships with Windows). Loaded by the engine when the session is interactive; nothing extra to install. |

## The window

Double-click `Start-MspAiKit.cmd`.

- **Identity header**: machine, user, kit path, profile. Magenta rail, graphite ground, paper text, the DE tokens.
- **Status cards**: PowerShell, Node.js, Skill install, Packs. Each shows PASS, READY, WARN, or BLOCKED and one line of detail.
- **Next recommended action** with a Go button. The window works out what is missing (Node.js, packs, skill link) and offers only that.
- **Actions**: Do everything (build, install, verify), Build, Install, Verify, Fetch upstream kits, plus Install Node.js when it is missing.
- **ChatGPT**: Copy Block A, Copy Block B, Open packs. The clipboard is the paste surface; no waiting on Enter.
- **Run mode**: Dry run (every action reports its plan and changes nothing), Force (replace a foreign skill folder; asks first).
- **Output folder** with a picker; **Advanced** drawer for config file, module and target filters, key=value overrides, Cursor repo, vendor folder, and Uninstall (asks first).
- **Steps and evidence** grid: step, result, action, verification, fix. Colour by result. Export receipt writes the JSON receipt and puts its path on the clipboard. Copy diagnostic bundle puts header, steps and the last 200 log lines (redacted) on the clipboard for a ticket.
- **Log** pane with search; anything that looks like a key, token, password or BitLocker key is redacted before it is shown or copied.
- **Footer**: overall result and loader version.

Fonts: Space Grotesk and Oxanium are used when installed, with Segoe UI as the fallback; Cascadia Mono or Consolas for paths and detail.

If the window cannot open (no desktop session, PowerShell not in STA, or `-NonInteractive`), the engine falls back to a text menu with the same actions. `-Action Console` forces the text menu; `-Action Gui` forces the window.

## RMM or scripted use

```powershell
# build + install for the current user + verify; exit code carries the result
.\Install-MspAiKit.ps1 -Action All -NonInteractive

# build only, to a chosen folder, with a config override
.\Install-MspAiKit.ps1 -Action Build -OutDir 'D:\DE\packs' -Set 'sla.confirmed=true' -NonInteractive

# let winget install Node.js LTS if it is missing (asks first unless -NonInteractive)
.\Install-MspAiKit.ps1 -Action All -InstallNode -NonInteractive

# plan only
.\Install-MspAiKit.ps1 -Action All -WhatIf
```

Exit codes: 0 success, 1 failure, 2 blocked (missing Node.js or git, bad input,
kit not found). Every run prints a step table with PASS / WARN / BLOCKED /
FAIL / NO CHANGE / PLANNED and writes:

- log: `%ProgramData%\DE\logs\msp-ai-kit-<timestamp>.log` (falls back to `%LOCALAPPDATA%\DE\logs`)
- receipt: `msp-ai-kit-receipt-<timestamp>.json` next to the log (timestamp, step, before-state, action, result, verification, remediation)

## What each action does

- **Build** runs `scripts\build.mjs` through Node.js. Packs land in
  `%USERPROFILE%\Documents\DE\msp-ai-kit\<profile>\` unless the output folder
  says otherwise. Start with `INDEX.md` there.
- **Install** creates junctions `%USERPROFILE%\.claude\skills\msp-ai-kit` and
  `%USERPROFILE%\.agents\skills\msp-ai-kit` pointing at this kit (no admin
  rights needed). An existing entry that is not this kit is kept unless Force
  is on. With a Cursor repo set, the built Cursor rule is copied to that
  repo's `.cursor\rules\`.
- **ChatGPT blocks** go to the clipboard from the window; from the command
  line `-Action Clipboard` copies Block A, waits for Enter, then Block B, and
  always saves `chatgpt-block-A.txt` and `chatgpt-block-B.txt` in the packs
  folder (the only output when `-NonInteractive`).
- **Upstream** clones the four external kits into
  `%LOCALAPPDATA%\DE\msp-ai-kit\vendor\` and links cmmc-advisor as a skill.
  Nothing from those repositories is executed; read each README and LICENSE.
- **Verify** runs `build.mjs --check` and the test suite.
- **Uninstall** removes the two junctions and nothing else.

## Requirements

- Windows 10 or 11, Windows PowerShell 5.1 (built in) or PowerShell 7.
- Node.js 18 or newer for Build and Verify. The loader can install the LTS
  release through winget when asked (the window's Install Node.js button,
  `-InstallNode`, or the console prompt).
- Git for Windows only for Upstream.

## Safety

- No secrets are read, prompted for, or written. The kit contains none, and
  the on-screen log and diagnostic bundle are redacted anyway.
- Nothing runs elevated. Junctions, `%LOCALAPPDATA%`, and Documents are all
  per-user locations.
- Machine-wide state is never changed: the execution policy bypass is
  process-scoped, and PATH is only extended inside the running session after a
  winget install of Node.js.
- Every mutating step honours dry run; destructive steps (Force replace,
  Uninstall, Node.js install) ask first in the window.

## Validation status

The engine (build, install, verify, clipboard files, uninstall, dry run,
blocked paths, receipts) was exercised end to end with PowerShell 7 on Linux
in the build environment. Both scripts parse cleanly and the XAML is
well-formed XML. The window itself needs a Windows desktop to render, so its
first run on a DE machine is the acceptance test: open it, run "Dry run", then
"Do everything", and copy the diagnostic bundle into the ticket if anything
reads WARN or FAIL.
