# DE Tech Tool (private)

The DE Tech Tool, DE Technician Console and DE Microsoft Admin, with the MSP AI Kit they bundle.
This repository is **private**. It was split out of the public website repository
`digeratiexperts/digeratiexperts-site` on 2026-11-05 with its full commit history
(`git filter-repo --subdirectory-filter .claude/skills/msp-ai-kit`).

## Layout

The repository root is the kit root, so every path the tool uses is unchanged:

| Path | What |
|---|---|
| `windows/` | The DE Tech Tool: `console/`, `microsoft/`, `rescue/`, `agent/`, `packaging/`, `tests/`, plan docs |
| `windows/Start-DETechTool.cmd` | Technician launcher (`Start-DETechConsole.cmd` is the compatibility alias) |
| `windows/packaging/New-DEReleasePackage.ps1` | Builds the watermarked release zip (`DE-TechTool-v<version>-<buildId>.zip`); the zip holds this whole folder as `msp-ai-kit\` |
| `kit.config.json`, `modules/`, `scripts/`, `profiles/`, `examples/` | The MSP AI Kit that the tool's AI Toolkit page renders (`windows/Install-MspAiKit.ps1` needs `scripts/build.mjs` beside it) |

Why the kit came too: the release zip, the installer lifecycle test, the mutation check and the
AI-pack loader all expect `windows/` to sit inside a kit root. Moving `windows/` alone to the root
would have broken them and meant rewriting paths while other work was in flight.

## Run the tests

```powershell
Invoke-Pester -Path windows/tests, windows/console/tests     # Windows PowerShell 5.1, Pester 5.x
windows/tests/Invoke-GuiSmoke.ps1 -OutDir $env:TEMP\de-smoke  # WPF smoke, every page
node --test scripts/build.test.mjs                            # kit builder
```

CI (`.github/workflows/ci.yml`) runs the same on `windows-latest` and `ubuntu-latest`.
`.github/workflows/installer-source-recheck.yml` re-checks pinned installer hashes weekly.

## What changed from the website copy

- `scripts/sync-facts.mjs --check` compared the packs with the website's `shared/companyContact.ts`.
  That file is not in this repository, so CI skips the check. Run it from a website checkout
  (`--site <path>` is not supported yet), or retire it here; see the website PR that removed this folder.
- Everything else is byte-identical to website `main` at `ca244410` (includes #961).

Security: see `SECURITY.md`. Plan and status: `windows/DE-TECH-TOOL-TRACKER.md`.

---

# MSP AI Kit for Digerati Experts

Copy-paste AI instruction packs for an MSP/MSSP team, generated from one
control file so ChatGPT, a Custom GPT, Claude Projects, Claude Code, Codex,
Cursor and Copilot all follow the same playbooks in the same voice.

## Five-minute start

1. **Use the rendered DE pack as is.** Open `examples/digerati-experts/INDEX.md`.
   It lists each file and where to paste it. The two ChatGPT blocks are in
   `chatgpt-custom-instructions.md`; a single playbook is under `prompts/`.
2. **Change a fact.** Edit `kit.config.json` (RMM name, hours, escalation
   ladder, which modules and outputs you want), then rebuild:

   ```bash
   node .claude/skills/msp-ai-kit/scripts/build.mjs
   ```

   Output lands in `artifacts/msp-ai-kit/out/digerati-experts/` (gitignored).
3. **Check before you paste.** `--check` validates the config and modules and
   confirms the ChatGPT and Custom GPT budgets; `--dry-run` shows the plan.

## Windows: DE Technician Console

`windows\Start-DETechConsole.cmd` opens the DE Technician Console. It is one DE-styled window for the
AI Toolkit and every endpoint job: provisioning, Entra to JumpCloud migration with break-glass,
BitLocker and OneDrive gates, the security stack (Guardz primary, Blackpoint backup, SentinelOne, PABX),
apps, OS baseline, browser policy, branding, network, the Vendor Admin Center, and evidence with
Intelligence Hub handoff.

`windows\Start-MspAiKit.cmd` opens the console on the AI Toolkit page, which builds these packs. RMM
runs use `-Headless`, and packaging covers signing, RMM deploy and Intune. See `windows\README-WINDOWS.md`.

## What is inside

| Module | Command | Area | What it produces |
|---|---|---|---|
| service-desk-triage | /triage | operations | priority, category, missing facts, client first reply, tech note |
| sla-escalation | /sla | operations | breached and at-risk tables, stale-update messages, escalations due |
| client-onboarding | /onboard | operations | 30-day plan, access takeover, CIS IG1 baseline, welcome email |
| kb-articles | /kb | operations | internal runbook and client how-to from a resolved ticket, redaction report |
| client-comms | /comms | operations | five-part client message, SMS version, approval note |
| proposals-sow | /sow | sales | proposal or SOW draft with placeholders for canonical prices |
| business-dev-roi | /roi | sales | ROI model with sourced inputs, outreach and objection responses |
| qbr-metrics | /qbr | sales | QBR or monthly report from exported data, decisions for the client |
| security-alert-triage | /alert | security | verdict with evidence, ATT&CK mapping, reversible containment |
| vulnerability-prioritization | /vuln | security | KEV / EPSS / exposure ranking, remediation plan, compensating controls |
| compliance-mapping | /comply | security | control matrix with evidence, gap plan, questionnaire answers |
| incident-comms | /incident | security | incident updates from the log only, holding statement, decision list |
| scripting-bash-powershell | /script | engineering | RMM-ready PowerShell 5.1 or Bash with dry-run, logging, exit codes, quality-bar checklist |
| endpoint-provisioning | /provision | engineering | phase and gate model for endpoint onboarding, Entra to JumpCloud migration, break-glass, BitLocker and OneDrive gates, security stack, evidence |
| profile, guardrails | always | core | company facts, voice, and the never-fabricate / defensive-only rules |

`references/de-scripting-msp-skill-pack.md` is Joe's DE Scripting and MSP
Skill Pack, shipped verbatim into every build under `references/` so the
/script and /provision playbooks can cite it and a Custom GPT or Claude
Project can hold it as knowledge.

Outputs: ChatGPT Custom Instructions (two 1,500-character blocks), Custom GPT
instructions (8,000 characters, with `prompt-library.md` as the knowledge
file), Claude Project instructions, `agent-instructions.md` for CLAUDE.md or
AGENTS.md, a Cursor `.mdc` rule, `copilot-instructions.md`, the prompt library
and one file per prompt.

## Controls

| Control | Where | Effect |
|---|---|---|
| Company facts, stack, hours, SLAs, escalation, frameworks, scripting conventions | `kit.config.json` | Rendered into every module through `{{placeholders}}` |
| `modules.<id>: false` | config | Leave a playbook out of every pack |
| `targets.<name>: false` | config | Skip an output format |
| `budgets.<target>` | config | Character limit of a destination; the builder trims by module priority and reports it |
| `sla.confirmed` | config | While `false`, packs label SLA numbers as working defaults not to be quoted to clients |
| `priority:` in a module's frontmatter | module | Lower numbers survive budget trimming longer |
| `--only`, `--skip`, `--targets`, `--set key=value`, `--out`, `--config` | command line | One-off variations without editing files, for example a second profile |
| `--list`, `--check`, `--dry-run`, `--verify <dir>`, `--json` | command line | Inspect, validate, plan, detect drift, script it |

A second company or brand is a second config file:
`node .claude/skills/msp-ai-kit/scripts/build.mjs --config path/to/other.json`.

## External kits

The kit is self-contained. The ChatGPT research that started it also named four
public kits worth having next to it. `scripts/install-upstream.sh` clones them
into `artifacts/msp-ai-kit/vendor/` (gitignored) and prints each kit's own
install steps rather than running them:

| Kit | License | Use for |
|---|---|---|
| RTFM-IT-Services-LLC/msp-claude-skills | CC BY-NC-SA 4.0 | Full MSP operations suite (brand, pricing, legal, sales, QBR, security baselines) |
| Servosity/msp-skills | Apache-2.0 | MCP connectors to PSA, RMM, backup, security and M365 with a local mirror |
| wyre-technology/msp-claude-plugins | Apache-2.0 | Claude plugin marketplace for vendor integrations |
| LV-262/cmmc-advisor | MIT | CMMC 2.0 guidance; `--link` exposes it as `/cmmc-advisor` |

```bash
bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --list
bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --only cmmc,rtfm --link
```

## Tests

```bash
npm run test:msp-ai-kit
```

That runs the builder tests, `--check`, the example drift check, the eval goldens and the company-facts
check. The Windows side has Pester suites for the loader and the Technician Console engine. It also has
PSScriptAnalyzer and a GUI smoke that renders every page at 100 and 200 percent. CI runs these under
Windows PowerShell 5.1 in `.github/workflows/msp-ai-kit.yml`. See `windows/README-WINDOWS.md` to run
them locally.
