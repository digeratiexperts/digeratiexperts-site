# Claude Code â€” Digerati Experts Website

Before doing any work in this repository, read and obey:

1. `AGENTS.md`
2. `docs/AI-ENGINEERING-GOVERNANCE.md`
3. `.ai/ACTIVE_WORK.yaml`
4. `design/DESIGN-AUTHORITY.md` (tiers and task modes for every design rule)
5. the relevant design/source-of-truth documents referenced by `AGENTS.md`

Claude Code is the **default lead website implementation and integration agent** unless Joe explicitly reassigns that role for a specific task.

That role does not permit bypassing PR review, concurrency audits, visual QA, production verification, or Joe's final authority.

Never develop directly on `main`. Use an isolated branch/worktree. Reconcile against current `origin/main` before merge. Treat `MERGED` and `LIVE` as separate states.

**Zoho:** never generate Zoho grant codes or call `/oauth/v2/token` directly. All Zoho access goes through `server/zoho/oauth` on the one Zoho Connect grant. `degraded` means wait; `needs_reconnect` means Joe clicks `/api/zoho/connect`. Rules: `docs/ZOHO-OAUTH-INVENTORY.md` → "Rules for every agent and person".

**Content and webmaster tools:** `docs/CONTENT-TOOLING-PLAN.md` decides which outside tools to use (and which not) for images, icons, video, voice, SEO data, Lighthouse, accessibility and image optimization. Read it before adopting any.

## Project skills (`.claude/skills/`)

Each vendored skill carries an `UPSTREAM.md` with provenance, local deviations and its external-service boundary. Skills that call kie.ai spend credits; run them only when the user asks for an image, and only inside a budget job (`.claude/kie-budget/README.md`: projection, soft and hard limits per job and per month, a ledger; Joe 2026-10-04), and read the key from the environment or the gitignored `.env` (`KIE_AI_API_KEY`, or `KIE_API_KEY` per PR #168), never from a committed file. Copy `.env.example` to `.env` to start. The same skills are mirrored at `.agents/skills/` (symlinks) for Codex / ChatGPT and other tools; `AGENTS.md` carries the cross-agent catalog. To use these skills in every project on a machine, run `bash .claude/install-user-skills.sh` once (links them into `~/.claude/skills` and `~/.agents/skills`).

| Skill | Trigger | What it does | Output |
|---|---|---|---|
| `/scrollcraft` | scroll-driven / "Apple-style" landing page | Isolated scroll-experience builds | `scrollcraft/builds/<name>/` |
| `/nano-banana-images` | "nano banana image ofâ€¦", any generated photo/still | JSON-prompted Nano Banana 2 generation via kie.ai (Python) | `artifacts/kie-ai/nano-banana/` |
| `/recraft-icons` | "Recraft icon of...", a custom or missing icon, icon set, SVG glyph Lucide lacks | Native SVG via Recraft (Node), cleaned to `currentColor` for IconWell; key `RECRAFT_API_KEY`, paid plan | `artifacts/recraft/icons/<set>/` |
| `/excalidraw-visuals` | "excalidraw visual/image ofâ€¦" | Hand-drawn-style PNG diagrams via kie.ai (Node) | `artifacts/kie-ai/excalidraw/` |
| `/excalidraw-diagram` | "draw me a diagram ofâ€¦" | Editable `.excalidraw` JSON, no API | `artifacts/diagrams/` |
| `/frontend-design` | build a component, page or site | Distinctive frontend code. Maintenance Mode: Tier 2 current system applies on `client/`. Exploration Mode: only Tier 0/1 apply (`design/DESIGN-AUTHORITY.md`) | in place |
| `/video-to-website` | "turn this video into a scroll-driven site" | FFmpeg frames + GSAP/Lenis canvas page | isolated experiment dir |
| `/skill-builder` | "help me build a skill" | Discovery interview, build and audit of skills | `.claude/skills/<name>/` |
| `/web-design-rules` | standalone page / mockup, match a reference image | Craft rules + localhost screenshot loop; standalone pages by default, `client/` concepts in Exploration Mode | isolated experiment dir |
| `/wat-framework` | automation / scraper / data pipeline, "WAT" | Workflows-Agents-Tools operating pattern for automation projects | project's own `workflows/`, `tools/`, `.tmp/` |
| `/trigger-dev` | automate a process, cron job, poller on Trigger.dev | Beginner workflow-builder rules for Trigger.dev SDK v4 (build in a dedicated Trigger.dev project, not this repo) | that project's `src/trigger/` |
| `/trigger-ref` | writing Trigger.dev task code | SDK v4 code reference | none |
| `/msp-ai-kit` | MSP/MSSP prompts, ChatGPT custom instructions, Custom GPT, Claude Project, triage / SLA / SOW / security playbooks | Renders `kit.config.json` + `modules/` into copy-paste packs; optional installer for external MSP kits | `artifacts/msp-ai-kit/out/`, committed example under the skill |

The Trigger.dev MCP server is declared in the root `.mcp.json`; enable it only when working on Trigger.dev automations.

Generated images are ILLUSTRATIVE candidates until they pass `design/IMAGERY.md` review; only optimized derivatives go under `client/public/images/`.

<!-- >>> DE token-discipline (managed; edit in DE\Governance\repo-kit) >>> -->
## Token discipline (DE operating standard)
Follow the "Token discipline" section in `AGENTS.md` in this repo. Key rules: one slice = one fresh session started from a handoff Â· declare the slice before coding Â· search before reading Â· stop after two failed attempts and checkpoint Â· economy models for mechanical work Â· end with the handoff block (`C:\Users\Joe\DE\Governance\AI-HANDOFF-STANDARD.md`). Spend/routing policy: `C:\Users\Joe\DE\Governance\AI-STACK.md` â€” not in this repo.
<!-- <<< DE token-discipline (managed) <<< -->
