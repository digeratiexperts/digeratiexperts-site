# msp-ai-kit provenance

- Source: built in-house on 2026-09-28 from a ChatGPT research thread Joe
  pasted into the session ("best existing skills, prompts and resources for
  IT service providers / MSPs / MSSPs"). That thread pointed at four external
  kits and one article; none of their text is copied here.
- Installed for: Claude Code project skill discovery (`/msp-ai-kit`), the
  `.agents/skills/` mirror for Codex / Cursor, and machine-wide use through
  `.claude/install-user-skills.sh`.
- Audited: 2026-09-28

## What is original and what is referenced

| Piece | Origin | License |
|---|---|---|
| `modules/*.md`, `kit.config.json`, `scripts/build.mjs`, tests, docs | Written for this repository | Repository license (MIT) |
| `references/de-scripting-msp-skill-pack.md` | "Digerati Experts Scripting & MSP Skill Pack" v1.0, uploaded by Joe on 2026-09-28; it distills mleoca/Bash-Scripting-GPT, the RTFM onboarding and security skills, Servosity's architecture, cmmc-advisor, and Joe's own PowerShell/Bash rules. Shipped verbatim; the `/script` and `/provision` modules are derived from it | DE internal document |
| Topic list (triage, SLA, onboarding, KB, SOW, ROI) | Inspired by the NinjaOne article "Top 10 ChatGPT prompts for MSPs"; the article was not reachable from the build environment and no prompt text was copied | n/a |
| RTFM-IT-Services-LLC/msp-claude-skills | Fetched on demand by `scripts/install-upstream.sh` into `artifacts/msp-ai-kit/vendor/rtfm` | CC BY-NC-SA 4.0. Using it to run DE's own MSP is allowed; reselling it or copying its text into this MIT repository is not, so it is never vendored |
| Servosity/msp-skills | Fetched on demand into `vendor/servosity`; per-connector installers are printed, never executed | Apache-2.0 |
| wyre-technology/msp-claude-plugins | Fetched on demand into `vendor/wyre`; install through the Claude Code plugin marketplace | Apache-2.0 |
| LV-262/cmmc-advisor | Fetched on demand into `vendor/cmmc`; `--link` exposes it as `/cmmc-advisor` | MIT |

DE facts in `kit.config.json` (contact addresses, portal URL, booking URL, area
served, package names, tool stack) were read from `shared/companyContact.ts`,
`server/services/msp-advisor/`, `docs/DE-SYSTEM-INTEGRATION.md`, and the
vulnerability-management repository README. SLA numbers and the escalation
ladder are working defaults chosen for this kit and are flagged
`sla.confirmed: false` until Joe approves them.

## Local deviations

Not applicable: nothing upstream is vendored. The installer pins each kit to
its default branch at shallow depth; run it again to update.

## External-service boundary

- `build.mjs`: none. Reads the config and modules, writes files. No network.
- `install-upstream.sh`: `git clone` / `git fetch` from github.com only. It
  never runs a remote script and never reads or writes credentials. Connector
  credentials for the Servosity and WYRE kits are supplied by the user as
  environment variables when they follow those kits' own instructions.
- Generated packs are pasted by a person into ChatGPT, Claude, Cursor or a
  repository. Client data pasted into those tools afterwards is governed by
  the guardrails module and DE's own data-handling rules, not by this skill.
