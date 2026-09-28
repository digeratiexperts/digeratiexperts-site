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
| scripting-bash-powershell | /script | engineering | RMM-ready PowerShell or Bash with dry-run, logging, exit codes, test plan |
| profile, guardrails | always | core | company facts, voice, and the never-fabricate / defensive-only rules |

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
node --test .claude/skills/msp-ai-kit/scripts/build.test.mjs
```

The suite renders the templates, checks budgets and naming, exercises the CLI,
and verifies `examples/digerati-experts/` against a fresh build so a module
edit without a rebuild fails loudly.
