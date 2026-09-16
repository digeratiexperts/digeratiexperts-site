# Claude Code — Digerati Experts Website

Before doing any work in this repository, read and obey:

1. `AGENTS.md`
2. `docs/AI-ENGINEERING-GOVERNANCE.md`
3. `.ai/ACTIVE_WORK.yaml`
4. `design/DESIGN-AUTHORITY.md` (tiers and task modes for every design rule)
5. the relevant design/source-of-truth documents referenced by `AGENTS.md`

Claude Code is the **default lead website implementation and integration agent** unless Joe explicitly reassigns that role for a specific task.

That role does not permit bypassing PR review, concurrency audits, visual QA, production verification, or Joe's final authority.

Never develop directly on `main`. Use an isolated branch/worktree. Reconcile against current `origin/main` before merge. Treat `MERGED` and `LIVE` as separate states.

## Project skills (`.claude/skills/`)

Each vendored skill carries an `UPSTREAM.md` with provenance, local deviations and its external-service boundary. Skills that call kie.ai spend credits; run them only when the user asks for an image, and read the key from the environment or the gitignored `.env` (`KIE_AI_API_KEY`, or `KIE_API_KEY` per PR #168), never from a committed file. Copy `.env.example` to `.env` to start. The same skills are mirrored at `.agents/skills/` (symlinks) for Codex / ChatGPT and other tools; `AGENTS.md` carries the cross-agent catalog. To use these skills in every project on a machine, run `bash .claude/install-user-skills.sh` once (links them into `~/.claude/skills` and `~/.agents/skills`).

| Skill | Trigger | What it does | Output |
|---|---|---|---|
| `/scrollcraft` | scroll-driven / "Apple-style" landing page | Isolated scroll-experience builds | `scrollcraft/builds/<name>/` |
| `/nano-banana-images` | "nano banana image of…", any generated photo/still | JSON-prompted Nano Banana 2 generation via kie.ai (Python) | `artifacts/kie-ai/nano-banana/` |
| `/excalidraw-visuals` | "excalidraw visual/image of…" | Hand-drawn-style PNG diagrams via kie.ai (Node) | `artifacts/kie-ai/excalidraw/` |
| `/excalidraw-diagram` | "draw me a diagram of…" | Editable `.excalidraw` JSON, no API | `artifacts/diagrams/` |
| `/frontend-design` | build a component, page or site | Distinctive frontend code. Maintenance Mode: Tier 2 current system applies on `client/`. Exploration Mode: only Tier 0/1 apply (`design/DESIGN-AUTHORITY.md`) | in place |
| `/video-to-website` | "turn this video into a scroll-driven site" | FFmpeg frames + GSAP/Lenis canvas page | isolated experiment dir |
| `/skill-builder` | "help me build a skill" | Discovery interview, build and audit of skills | `.claude/skills/<name>/` |
| `/web-design-rules` | standalone page / mockup, match a reference image | Craft rules + localhost screenshot loop; standalone pages by default, `client/` concepts in Exploration Mode | isolated experiment dir |
| `/wat-framework` | automation / scraper / data pipeline, "WAT" | Workflows-Agents-Tools operating pattern for automation projects | project's own `workflows/`, `tools/`, `.tmp/` |
| `/trigger-dev` | automate a process, cron job, poller on Trigger.dev | Beginner workflow-builder rules for Trigger.dev SDK v4 (build in a dedicated Trigger.dev project, not this repo) | that project's `src/trigger/` |
| `/trigger-ref` | writing Trigger.dev task code | SDK v4 code reference | none |

The Trigger.dev MCP server is declared in the root `.mcp.json`; enable it only when working on Trigger.dev automations.

Generated images are ILLUSTRATIVE candidates until they pass `design/IMAGERY.md` review; only optimized derivatives go under `client/public/images/`.
