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

**Refreshed:** 2026-10-10 from GitHub, `origin/main` at `7b1b4197` (merge of #551). This table is a
snapshot for orientation; the live PR list is still the lock. Each PR is owned by the session that
opened it (session link at the bottom of its body). Do not push to, rebase, close or merge it.

| PR | Draft | Branch | What it changes | Owner session |
| --- | --- | --- | --- | --- |
| #555 | yes | `claude/awesome-bardeen-4pbl2m` | Zoho Desk gets its own OAuth client (`server/zoho/zohoClient.ts` + tests, env example, `.ai/ACTIVE_WORK.yaml` claim `desk-oauth-client`) | Claude Code `session_01DpGjiCZTGCKrihFTHJKUay` |
| #554 | yes | `claude/charming-faraday-rrlyzq` | `artifacts/branch-cleanup/delete-merged-branches.sh` skips moved branches | Claude Code `session_01YMDnpncWwwq7aXEDfnHHpp` |
| #553 | yes | `claude/dreamy-einstein-mbqa0w` | Client Portal agreement gate, first-login tour, Cytracom vendor profile (portal pages, `migrations/0016`, warehouse vendors; claim `portal-agreement-gate`) | Claude Code `session_01Jt6Sn1CsXD7p7wFtG7b12a` |
| #550 | yes | `claude/nifty-newton-uk9g7t` | Ledger only: `store-counts-phone` claim → verified-live | Claude Code `session_01PxcA8RVur1v39SbYpkmzMY` |
| #542 | yes | `claude/store-pdfs-de-system` | Hide `.scroll-progress` in print (`client/src/index.css`) | Claude Code `session_017jXyuGTxDWJZzDNLP4dHYj` |
| this PR | yes | `claude/t10-agent-governance-docs` | Agent docs + secret diff check (`AGENTS.md`, this file, `.github/workflows/secret-diff-check.yml`, `scripts/security/check-added-secrets.mjs`) | DE backlog thread T10 |

Backlog threads starting 2026-10-10 (T1, T2, T7 in this repo) add their PRs here or appear in the
live PR list. Cross-repo pending decisions and secrets: Intelligence Hub
[`docs/OPEN-ITEMS-FOR-DE.md`](https://github.com/digeratiexperts/Intelligence-Hub/blob/master/docs/OPEN-ITEMS-FOR-DE.md).

How to refresh this table: list open PRs (`gh pr list --state open` or the GitHub MCP
`list_pull_requests`), read each one's changed files and session link, and replace the rows.
Keep the "Refreshed" line honest: date plus the `origin/main` SHA you checked against.
