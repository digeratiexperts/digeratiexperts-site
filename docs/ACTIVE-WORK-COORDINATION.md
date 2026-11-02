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

**Refreshed:** 2026-11-01 from GitHub, `origin/main` at `7826a8b7`. This table is a
snapshot for orientation; the live PR list is still the lock. Each PR is owned by the session or
person that opened it (a Claude Code PR has its session link at the bottom of its body). Do not
push to, rebase, close or merge it; the lead integrator's exception, on Joe's instruction, is in
`AGENTS.md` ("Who owns what right now"). The W1-10 lane PRs each carry the same generated tracker
projection, so they merge clean in any order.

| PR | Draft | Branch | What it changes | Owner |
| --- | --- | --- | --- | --- |
| #897 | no | `techtool/move-40-trust-records` | Tech Tool move 40: installer source, vendor hash, verified-or-not trust records (section C lane) | DE Tech Tool section C lane (OpenCode) |
| #896 | no | `techtool/move24-hub-payload-fuzz` | Tech Tool move 24: Hub payload builder fuzz (issue #742; Hub schedule W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #895 | no | `techtool/move-84-dropship-serials` | Tech Tool move 84: dropship kit against real serial samples (section G lane) | DE Tech Tool section G lane (OpenCode) |
| #894 | no | `techtool/move-83-desk-ticket` | Tech Tool move 83: Zoho Desk ticket ID on the device record (section G lane) | DE Tech Tool section G lane (OpenCode) |
| #893 | no | `techtool/move23-contract-secret-refusal` | Tech Tool move 23: contracts refuse secret-shaped keys (issue #741; W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #892 | no | `techtool/move22-contract-schema-tests` | Tech Tool move 22: a Pester test for every contract schema's validators (issue #740; W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #891 | no | `techtool/move21-launcher-ci-confirmation` | Tech Tool move 21: launcher tests confirmed on Windows CI + silent-skip guard (issue #739; W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #888 | no | `techtool/move20-changelog` | Tech Tool move 20: changelog entry per version, linked to its PR (issue #738; W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #887 | no | `techtool/move18-export-drift-check` | Tech Tool move 18: exported-module-functions vs docs drift check (issue #736; W1-10 lane) | OpenCode · MiMo-V2.6-Pro (W1-10 session) |
| #886 | yes | `chatgpt/event-contact-receipt-20261101` | Live Briefings contact receipt claims fix | ChatGPT session |
| #884 | no | `techtool/move-85-placeholder-serials` | Tech Tool move 85: OEM placeholder-serial refusal against a real serial list (section G lane) | DE Tech Tool section G lane (OpenCode) |
| #882 | yes | `chatgpt/restore-v2-before-scenes-20261101` | Restore Homepage V2 before decorative scene bands | ChatGPT session |


Cross-repo pending decisions and secrets: Intelligence Hub
[`docs/OPEN-ITEMS-FOR-DE.md`](https://github.com/digeratiexperts/Intelligence-Hub/blob/master/docs/OPEN-ITEMS-FOR-DE.md).

How to refresh this table: list open PRs (`gh pr list --state open` or the GitHub MCP
`list_pull_requests`), read each one's changed files and session link, and replace the rows.
Keep the "Refreshed" line honest: date plus the `origin/main` SHA you checked against.
