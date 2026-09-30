# Digerati Experts repository authority

This file defines which repository owns which active product. It exists to prevent stale agent tasks, old migration notes, and historical repository names from redirecting new work.

## Current authority matrix

| Product / role | Canonical repository | Default branch | Status | New work? |
| --- | --- | --- | --- | --- |
| Public website / Store / public portal entry surfaces | `digeratiexperts/digeratiexperts-site` | `main` | **Active / canonical** | Yes |
| Intelligence Hub / internal Tech Sales application | `digeratiexperts/Intelligence-Hub` | `master` | **Active / canonical** | Yes |
| Legacy TechSales codebase | `digeratiexperts/TechSales` | legacy repository state | **Legacy / reference pending migration verification** | No, unless explicitly directed |
| `Replit-Site` name/repository references | historical migration-era website source | n/a | **Obsolete authority** | No |

## Rules for agents and humans

1. **Inspect current repository state before acting.** Old Cursor tasks, chats, PR descriptions, screenshots, branch names, or migration notes are not stronger authority than this matrix plus current GitHub state.
2. **Website work belongs here.** New website branches and PRs must originate from `digeratiexperts/digeratiexperts-site` and target `main` unless an explicit release procedure says otherwise.
3. **Intelligence Hub work belongs in `Intelligence-Hub`.** Do not create Hub work in the website repository or in the legacy `TechSales` repository.
4. **Do not revive `Replit-Site` as canonical.** Treat any instruction saying "canonical website: Replit-Site" as stale unless this authority file is deliberately changed in a reviewed PR.
5. **TechSales is reference-only by default.** It may be inspected to verify historical behavior or migration gaps. Do not add new features there by default.
6. **Do not archive or delete legacy repositories automatically.** Retirement requires a completed migration ledger and an explicit decision.
7. **One task = one owner = one branch.** Before editing shared files, check current `main`/`master` and open work to avoid overwriting another agent.
8. **No blind cherry-picks across products.** Historical commits must be compared to the current architecture and ported intentionally when still needed.

## Known stale work superseded by this policy

The old Cursor/Cloud Agent task that said its environment only had `Replit-Site`, could not see `Intelligence-Hub`, and therefore needed repository access changes is obsolete. Current repository access must be checked directly rather than preserving that blocked-state assumption.

The old website PRs created from that blocked state should not be merged merely to preserve the old instructions. Replacement work should be based on current canonical repositories.

## Related policy

- Website source of truth: [`docs/SOURCE-OF-TRUTH.md`](./SOURCE-OF-TRUTH.md)
- Account Lifecycle Status (internal-only, Hub-authored mirror): [`docs/ACCOUNT-LIFECYCLE-STATUS.md`](./ACCOUNT-LIFECYCLE-STATUS.md)
- Site/agent workflow: [`AGENTS.md`](../AGENTS.md)
- Brand naming rule: [`.cursor/rules/digerati-naming.mdc`](../.cursor/rules/digerati-naming.mdc)
- Ecosystem control plane (always-applied agent rule): [`.cursor/rules/de-ecosystem.mdc`](../.cursor/rules/de-ecosystem.mdc)
- Hub **scoreboard** (do not duplicate here): [Intelligence-Hub#122](https://github.com/digeratiexperts/Intelligence-Hub/issues/122)
- Hub charter (ratified PR #123 / `5354a8b`): `docs/DE-ECOSYSTEM-CHARTER.md`, plus `docs/DE-ECOSYSTEM-CONTROL-PLANE.md`, `docs/SOURCE-OF-TRUTH-MATRIX.md`, `docs/DE-ECOSYSTEM-TASKS.md`
