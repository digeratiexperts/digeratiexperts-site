# DE Active Work Coordination

Status: **MANDATORY companion** to `docs/AI-ENGINEERING-GOVERNANCE.md`.

## Why this exists

A claim committed only on an unmerged feature branch is invisible to agents that correctly inspect `origin/main`. On August 30, 2026, `.ai/ACTIVE_WORK.yaml` on `main` showed no claims while a substantial homepage/Ask DE implementation PR was still open. That proved the YAML file cannot be the sole concurrency lock.

## Authoritative lock order

**Agent Relay (Joe, 2026-11-05).** Claude, OpenCode and ChatGPT share ownership of **relay tasks**: issues labelled `relay` in this repo or Intelligence-Hub. The issue is the live lock and handoff: claim with a `RELAY CLAIM` comment, post `RELAY PULSE` while working, end with `RELAY HANDOFF` so the next agent continues from your last pushed SHA. A lease idle for 3 hours expires and anyone may take over. Protocol: Intelligence-Hub `docs/AGENT-RELAY.md` ([issue #886](https://github.com/digeratiexperts/Intelligence-Hub/issues/886)). Board: [open relay tasks](https://github.com/search?q=org%3Adigeratiexperts+label%3Arelay+is%3Aopen&type=issues). The YAML mirror and ledger row are still written, with the issue link; the relay issue counts as the GitHub-visible lock in the order below.

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

## Open PRs and owners

This file no longer keeps a PR table. The 2026-11-01 snapshot (#884-#931) had gone stale within
days, and a stale table reads like a lock that does not exist. Read the live list instead:
`list_pull_requests` (GitHub MCP, `state: open`) or `gh pr list --state open`, then each PR's
changed files and the session link at the bottom of its body.

Each PR is owned by the session or person that opened it. Do not push to, rebase, close or merge
it; the lead integrator's exception, on Joe's instruction, is in `AGENTS.md` ("Who owns what right
now"). Open `[ACTIVE]` issues name the owner of local-only work that has no PR yet.

Cross-repo pending decisions and secrets: Intelligence Hub
[`docs/OPEN-ITEMS-FOR-DE.md`](https://github.com/digeratiexperts/Intelligence-Hub/blob/master/docs/OPEN-ITEMS-FOR-DE.md).
