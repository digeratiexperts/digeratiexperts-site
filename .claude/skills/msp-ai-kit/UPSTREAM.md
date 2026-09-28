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
| `windows/console/` (DE Technician Console), `windows/packaging/`, `windows/tests/` | Written for this repository from Joe's Technician Console and Vendor Admin Center specifications (2026-09-28) | Repository license (MIT) |
| `windows/console/catalog/vendors.json` | Vendor admin, partner, support, docs and status URLs taken from Joe's vendor list; tenant-specific URLs are templates filled from client profiles | Facts, no vendor text copied |
| `windows/fonts/` | Space Grotesk and Oxanium variable fonts | SIL Open Font License 1.1 (OFL texts shipped alongside) |
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

Nothing upstream is vendored. `upstream.lock` pins each external kit to a commit. The installers
fetch that exact commit and copy its license into `vendor/LICENSES`. `--latest` follows the default
branch, and `--update-pins` rewrites the lock after review.

## External-service boundary

- `build.mjs`: none. Reads the config and modules, writes files. No network.
- `install-upstream.sh`: `git clone` / `git fetch` from github.com only. It
  never runs a remote script and never reads or writes credentials. Connector
  credentials for the Servosity and WYRE kits are supplied by the user as
  environment variables when they follow those kits' own instructions.
- `windows/Install-MspAiKit.ps1`: runs the local `node` and `git` binaries
  only. With `-InstallNode` (or a yes at the interactive prompt) it calls
  `winget install OpenJS.NodeJS.LTS`; that is the only software it installs.
  It writes under the user's profile, `%LOCALAPPDATA%\DE` and
  `%ProgramData%\DE\logs`, never elevates, and never touches credentials.
- `windows/console/` (DE Technician Console) runs on the technician's endpoint, elevated. Its network
  calls are limited to these:
  - JumpCloud REST (console.jumpcloud.com, v1 and v2, `x-api-key` from the runtime secret JC_API_KEY).
  - The JumpCloud ADMU module from the PowerShell Gallery.
  - Installer downloads listed in `catalog/packages.json`. Each one is refused unless it matches its
    sha256, Authenticode publisher or winget id.
  - The Intelligence Hub device endpoint set in Settings (HTTPS only, with the runtime token DE_HUB_TOKEN).
  - Opening vendor URLs in the default browser.

  It does not call Microsoft Graph. Entra state comes from `dsregcmd` on the device. Secrets are held in
  memory only and scrubbed from every output. Packages marked `confirmed: false` have no verified download
  source yet and cannot install until DE fills one in.
- `windows/packaging/Deploy-DETechConsole.ps1` downloads one release zip over HTTPS and refuses it unless its
  sha256 matches.
- Generated packs are pasted by a person into ChatGPT, Claude, Cursor or a
  repository. Client data pasted into those tools afterwards is governed by
  the guardrails module and DE's own data-handling rules, not by this skill.
