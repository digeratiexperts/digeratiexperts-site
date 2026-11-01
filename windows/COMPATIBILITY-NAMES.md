# Compatibility names — what stays, and what retiring them takes

**Move 104** of the 104-move plan ([issue #822](https://github.com/digeratiexperts/digeratiexperts-site/issues/822),
folded into the canonical issue [#737](https://github.com/digeratiexperts/digeratiexperts-site/issues/737) —
move 19 — for the actual retirement). This document is the policy and the checklist the retirement waits on.

## The rule

**Nothing is renamed or removed until the installed base is checked** ([DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md)).
Compatibility names may remain in file paths or launch aliases where changing them would break installed
automation. A rename that breaks a technician's muscle memory or a client's RMM script is worse than an
old name that works.

## The compatibility names

| Compatibility name | Where it still lives | Canonical name |
|---|---|---|
| MSP AI Kit | The kit root (`.claude/skills/msp-ai-kit/`), `Start-MspAiKit.cmd`, `Install-MspAiKit.ps1` | DE Tech Tool |
| DE Technician Console / TechConsole | Historical docs, `DETechConsole.ps1` itself, state paths (`ProgramData\DE\TechConsole`), contract ids (`de.techconsole.*`) | DE Tech Tool (the console component) |
| `Start-DETechConsole.cmd` | Launcher beside `Start-DETechTool.cmd` | `Start-DETechTool.cmd` |
| `DE-TechConsole` in release/zip names and settings | Packaging output, install dirs | `DE-TechTool` |

Contract schema ids (`de.techconsole.device/v1` and siblings) are wire identifiers shared with the Hub and the
rescue: they are **not** candidates for renaming at all — a rename there is a protocol break, not a name tidy.

## What "check the installed base" means

Do all of these before any rename ships; record the evidence in the canonical issue:

1. **RMM and Intune:** search every deployment script, package and scheduled task for the old names
   (`Start-MspAiKit.cmd`, `Install-MspAiKit.ps1`, `Start-DETechConsole.cmd`, `DE-TechConsole`, paths under
   `ProgramData\DE\TechConsole`).
2. **On the managed estate:** inventory installed copies — which launchers exist on devices, what shortcuts
   point at them, what automation invokes them.
3. **Client-facing material:** any client documentation, run sheets or dropship kits that name the old paths.
4. **This repo:** grep the tree (including `windows/`, `docs/` and `scripts/`) for every alias below.
5. **The Hub:** integration points that quote the old names (event sources, device record fields, panels).

## The retirement procedure (under issue #737)

1. The checklist above is complete, with evidence.
2. Rename in one release **with working shims**: the old launchers forward to the new ones and log a
   deprecation WARN for at least one release.
3. Measure: the WARN tells you what still calls the old names.
4. Remove the shims in a later release, only when the WARN has gone quiet.
5. Docs change with step 2; file paths that are wire-visible (contracts, state schema) stay.

## Related

- [DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md) — the naming statement this policy implements.
- Issues [#737](https://github.com/digeratiexperts/digeratiexperts-site/issues/737) (canonical,
  "Remove compatibility aliases once the installed base is checked") and
  [#822](https://github.com/digeratiexperts/digeratiexperts-site/issues/822) (this move, folded into it).
