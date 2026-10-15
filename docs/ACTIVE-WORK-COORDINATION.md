# DE Active Work Coordination

Status: **MANDATORY companion** to `docs/AI-ENGINEERING-GOVERNANCE.md`.

## Why this exists

A claim committed only on an unmerged feature branch is invisible to agents that correctly inspect `origin/main`. On August 30, 2026, `.ai/ACTIVE_WORK.yaml` on `main` showed no claims while a substantial homepage/Ask DE implementation PR was still open. That proved the YAML file cannot be the sole concurrency lock.

## Authoritative lock order

Before editing code, every agent must inspect, in this order:

1. **Open GitHub issues** marked or titled `ACTIVE`, `P0`, `IN PROGRESS`, recovery, or otherwise clearly describing current implementation ownership.
2. **All open pull requests**, including changed files, head branch, base branch, and current mergeability.
3. **Relevant remote branches** when a prior task/recovery branch is named.
4. `.ai/ACTIVE_WORK.yaml` as a convenient mirror.
5. `docs/SITE-VISUAL-TASKS.md` for visual work.

GitHub-visible issues and PRs are authoritative because every agent can see them without first merging another agent's branch.

## Starting work

Create or update one GitHub issue before implementation. Record:

- task id/title;
- owner/integrator;
- subsystem;
- branch;
- exact starting `origin/main` SHA;
- expected files or globs;
- dependencies/source PRs;
- status;
- explicit blockers.

Then create an isolated branch/worktree. A YAML claim may mirror the issue, but the issue must exist first.

## Collision rule

If an open issue/PR overlaps the same component, route, subsystem, or expected files:

- do not start a parallel rewrite;
- link the existing work;
- reconcile through the lead integrator;
- preserve unique commits before closing/superseding anything.

An empty YAML registry never means the repository is idle.

## Local-only WIP

Local-only code is an emergency preservation condition. Before continuing development:

1. inspect uncommitted changes, local commits, stash, worktrees, and agent artifacts;
2. commit recoverable work intact to a `recovery/*` branch before refactoring;
3. create a GitHub recovery issue containing the original task, source environment, last known remote SHA, and recovery status;
4. if the local state cannot be recovered, mark the implementation lost but keep the requirement tracked for rebuild.

Never silently drop local WIP because another PR shipped around it.

## Before merge

Immediately before merge, repeat the GitHub issue/PR/branch audit and fetch latest `main`. If `main` moved after validation began, the branch must be reconciled and the applicable gates rerun. A previously green run does not cover commits that landed afterward.

## Completion

A task is released only when its actual status is recorded as one of:

- `MERGED`
- `VERIFIED LIVE`
- `BLOCKED`
- `ABANDONED`
- `SUPERSEDED`
- `LOST LOCAL IMPLEMENTATION — REQUIREMENT PRESERVED`

Close the active GitHub issue/claim only when the state above is explicit and no recovery work remains.

## Current open PRs and owners (snapshot)

**Refreshed:** 2026-10-14 from GitHub, `origin/main` at `4505f0c` (merge of #570). This table is a
snapshot for orientation; the live PR list is still the lock. Each PR is owned by the session or
person that opened it (a Claude Code PR has its session link at the bottom of its body). Do not
push to, rebase, close or merge it.

| PR | Draft | Branch | What it changes | Owner |
| --- | --- | --- | --- | --- |
| #587 | yes | `claude/t7-outstanding` | T7 follow-ups: portal SLA response times, city-only NAP, header CTA, cookie Preferences link | T7 |
| #586 | yes | `claude/lucid-dijkstra-s3v2s3` | Every page gets its own plate; assessment bar off plates | Claude Code session |
| #580 | yes | `chatgpt/tech-tool-storage-20261011` | DE Tech Tool native storage, Windows installer, operations appearance | ChatGPT / Codex |
| #578 | no | `chatgpt/portal-black-theme-20261011` | Pure black Client Portal theme, saved contrast settings | ChatGPT / Codex |
| #576 | no | `docs/store-cart-and-agent-coordination` | Docs: upgrade cart direction, multi-agent coordination, retire PR 567 | its author (see PR) |
| #575 | yes | `concept/ai-background-check` | Concept: AI Background Check page (3 Exploration concepts) | its author (see PR) |
| #574 | yes | `claude/exciting-cannon-ttx8m8` | Licensing: JumpCloud installs and starter kits on the License Patch Bay | Claude Code session |
| #572 | yes | `claude/kie-approval-rule` | Docs (kie.ai): consult DE before generating | Claude Code session |
| #571 | no | `claude/awesome-bardeen-4pbl2m` | Ask DE greeting fix; desk-oauth-client verified live | Claude Code session (also opened #555, now closed) |
| #565 | no | `claude/loving-edison-epagrb` | Homepage story backgrounds: Versions 9 and 10, mockups | Claude Code session |
| #564 | yes | `claude/inspiring-franklin-1o69vr` | Events: live-session pages, event and campaign calendar | Claude Code session |
| #560 | yes | `claude/t2-ops-hardening` | CI minutes, canonical-host probes, portal headers, secrets/cache docs (touches `.github/workflows/*`) | T2 |
| #559 | yes | `claude/t2-npm-audit` | Clear critical npm advisories | T2 |
| #557 | yes | `claude/t10-agent-governance-docs` | Agent docs + secret diff check (this table) | T10 |
| #553 | yes | `claude/dreamy-einstein-mbqa0w` | Client Portal agreement gate, first-login tour, Cytracom profile | Claude Code session |
| #550 | yes | `claude/nifty-newton-uk9g7t` | Ledger only: store-counts-phone verified live | Claude Code session |
| #542 | yes | `claude/store-pdfs-de-system` | Hide `.scroll-progress` in print | Claude Code session |

Cross-repo pending decisions and secrets: Intelligence Hub
[`docs/OPEN-ITEMS-FOR-DE.md`](https://github.com/digeratiexperts/Intelligence-Hub/blob/master/docs/OPEN-ITEMS-FOR-DE.md).

How to refresh this table: list open PRs (`gh pr list --state open` or the GitHub MCP
`list_pull_requests`), read each one's changed files and session link, and replace the rows.
Keep the "Refreshed" line honest: date plus the `origin/main` SHA you checked against.
