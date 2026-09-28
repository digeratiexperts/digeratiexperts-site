---
name: msp-ai-kit
description: Build and maintain the Digerati Experts MSP/MSSP AI prompt kit. Use when someone asks for MSP or MSSP prompts, ChatGPT custom instructions, a Custom GPT, Claude Project instructions, ticket triage / SLA / onboarding / KB / SOW / QBR / security-alert / vulnerability / compliance / incident-comms playbooks, Bash or PowerShell RMM script rules, or wants to install the external MSP skill kits (RTFM, Servosity, WYRE, cmmc-advisor). Runs entirely from kit.config.json and modules/; no API keys, no network except the optional upstream installer.
argument-hint: [build | list | check | verify | install-upstream | edit <module-id>]
allowed-tools: Read, Grep, Glob, Edit, Write, Bash(node .claude/skills/msp-ai-kit/scripts/*), Bash(node --test .claude/skills/msp-ai-kit/scripts/*), Bash(bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh *)
---

# MSP AI Kit

One control file, sixteen prompt modules, one builder. The output is a folder of
copy-paste packs for every AI surface the team uses, all saying the same thing
in the Digerati Experts voice.

```
kit.config.json          <- the only file most people edit (company, stack, SLAs, toggles, budgets)
modules/NN-<id>.md       <- one playbook per file: Line (1 sentence), Rules, Prompt, Notes
references/*.md          <- DE-authored packs shipped verbatim with every build (the scripting pack)
scripts/build.mjs        <- renders modules x config into packs; --list --check --verify --dry-run --set
scripts/install-upstream.sh <- optional: fetch RTFM / Servosity / WYRE / cmmc-advisor into a gitignored vendor dir
windows/                 <- DE Technician Console (console/), AI-pack loader (Install-MspAiKit.ps1), packaging/, tests/
examples/digerati-experts/  <- the committed, rendered DE pack (kept in sync by the tests)
```

## Commands

| Ask | Run |
|---|---|
| Build the packs | `node .claude/skills/msp-ai-kit/scripts/build.mjs` (writes to `artifacts/msp-ai-kit/out/<profile>/`, gitignored) |
| See modules, targets, budgets | `node .claude/skills/msp-ai-kit/scripts/build.mjs --list` |
| Validate without writing | `node .claude/skills/msp-ai-kit/scripts/build.mjs --check` |
| Try a change | `... --dry-run --set sla.confirmed=true --set stack.rmm=NinjaOne` |
| Only some playbooks | `... --only service-desk-triage,sla-escalation` or `--skip qbr-metrics` |
| Only some outputs | `... --targets chatgpt-custom-instructions,prompt-library` |
| Refresh the committed example | `... --out .claude/skills/msp-ai-kit/examples/digerati-experts` |
| Tests | `node --test .claude/skills/msp-ai-kit/scripts/build.test.mjs` |
| External kits | `bash .claude/skills/msp-ai-kit/scripts/install-upstream.sh --list` then `--only cmmc --link` |
| Windows technician | `windows\Start-DETechConsole.cmd` (full console) or `windows\Start-MspAiKit.cmd` (AI Toolkit page) |
| RMM | `windows\console\DETechConsole.ps1 -Headless -Client <id> -Mode <mode>` (audit), or `windows\Install-MspAiKit.ps1 -Action All -NonInteractive` (packs only) |
| Windows tests | `Invoke-Pester -Path windows/tests, windows/console/tests` and `windows/tests/Invoke-GuiSmoke.ps1` |

## Procedure

1. **Read `kit.config.json` first.** Every `{{placeholder}}` in a module resolves
   against it. Keys beginning with `_` are comments. Never put credentials in
   it; the builder refuses to run if a value looks like one.
2. **Change values, not prose, when the ask is factual** (new RMM, new hours, an
   approved SLA). Change a module when the ask is about how a playbook behaves.
   Change `build.mjs` only for a new output format.
3. **Adding a module:** copy an existing file in `modules/`, give it a unique
   `id`, a `priority` (lower = kept first when a destination is short on
   space), a `/command`, and the four sections. Add the id under `modules` in
   the config. Keep `## Line` under 110 characters or ChatGPT block B will
   start dropping modules.
4. **Rebuild, then `--check`, then refresh `examples/digerati-experts/` and run
   the tests.** The example directory is verified against a fresh build, so a
   module edit without a rebuild fails the suite on purpose.
5. **Report what the budget dropped.** The builder prints it and writes it at
   the top of each budgeted file. If something important fell out, lower a
   priority number or disable a module rather than lengthening the budget: the
   limits are ChatGPT's (1,500 characters per custom-instruction field, 8,000
   for a Custom GPT), not ours.

## Where each output goes

Read `INDEX.md` in the output folder; it lists every file with its destination
and size. In short: `chatgpt-custom-instructions.md` has two blocks for
ChatGPT settings; `custom-gpt-instructions.md` plus `prompt-library.md` as a
knowledge file make a Custom GPT; `claude-project-instructions.md` is a Claude
Project; `agent-instructions.md` drops into a `CLAUDE.md` or `AGENTS.md`;
`cursor/msp-ai-kit.mdc` goes in `.cursor/rules/`; `copilot-instructions.md` is
`.github/copilot-instructions.md`; `prompts/<id>.md` are single playbooks for
any chat.

## Guardrails for this skill

- The generated text is internal operating guidance. It is not website copy,
  not a client deliverable, and SLA numbers stay internal while
  `sla.confirmed` is `false`.
- Company naming follows `.cursor/rules/digerati-naming.mdc`: "Digerati
  Experts" then "DE", never "Digerati" alone. The tests check the rendered
  output for it.
- The upstream installer only clones. It never runs a remote installer and
  never touches credentials. RTFM's kit is CC BY-NC-SA: use it, do not copy its
  text into this repository.
- The Technician Console changes endpoints. Every change goes through its gate and evidence engine.
  Runtime secrets stay in memory, and client-safe reports carry no vendor names, keys or costs. Do not
  add a code path that writes a secret to disk or quietly turns a failed control into PASS.
- Nothing here changes `client/`, `server/` or `shared/`. If a request needs
  the website's DE Desk advisor to change, that is a separate task under the
  governance in `AGENTS.md`.

See `README.md` in this folder for the five-minute setup and `UPSTREAM.md` for
provenance and licenses.
