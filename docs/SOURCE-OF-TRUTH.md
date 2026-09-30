# Website source of truth

This repository is the canonical source for the Digerati Experts public website.

- **Canonical repository:** `github.com/digeratiexperts/digeratiexperts-site`
- **Default / production integration branch:** `main`
- **Public website:** `https://digeratiexperts.com`
- **Production deployment:** CyberPanel + systemd `digeratiexperts-site` on the DE VPS. See `deploy/vps/README.md` for the current deploy procedure.

## Repository authority

The authoritative repository matrix is maintained in [`docs/REPOSITORY-AUTHORITY.md`](./REPOSITORY-AUTHORITY.md).

This file is the **website application/content** source of truth (GitHub). Operational and commercial truth (accounts, deals, catalog, pricing, entitlements, approved claims) lives in Intelligence Hub (`digeratiexperts/Intelligence-Hub`). Account relationship lifecycle is governed by [`docs/ACCOUNT-LIFECYCLE-STATUS.md`](./ACCOUNT-LIFECYCLE-STATUS.md) — a mirror of the Hub authority; it is internal-only and must never reach a public or client-visible surface. Executable agent rule: [`.cursor/rules/de-ecosystem.mdc`](../.cursor/rules/de-ecosystem.mdc). `git commit` ≠ merged ≠ deployed ≠ production verified (**MERGED ≠ LIVE**; website PR #88 closed without merge — deploy reliability still unresolved). Ecosystem scoreboard: [Intelligence-Hub#122](https://github.com/digeratiexperts/Intelligence-Hub/issues/122) — not a competing website ledger.

For website work:

1. Branch from the current `digeratiexperts/digeratiexperts-site` `main`.
2. Push the branch to this repository.
3. Open the pull request against this repository's `main`.
4. Reconcile against current `main` before merge because multiple agents may be working concurrently.
5. Do not redirect new website work to a historical repository name because an old Cursor/Cloud Agent task says to do so.

## `Replit-Site` is historical, not authoritative

`digeratiexperts/Replit-Site` and references to it as the "canonical website repo" are historical migration-era instructions. They must **not** be used as the target for new branches, pull requests, agent environments, deployment decisions, or source-of-truth checks.

If an old task, chat, PR, branch, or document conflicts with this file and `REPOSITORY-AUTHORITY.md`, treat the old instruction as stale and re-check current repository state before taking action.

Replit may still be useful as historical/reference material where explicitly needed, but it is not an authoring or push authority for the production website.

## Preserve recovered content without restoring stale authority

Historical content recovered from Replit or older branches can remain in this repository when it is still valid. Recover content surgically; do not restore old repository-authority instructions along with it.

Examples of previously recovered website content include Journal/read-aloud assets and resource registry material. Their presence does not make Replit the source of truth.

## Non-destructive rule

Do not archive, delete, force-push, or replace another DE repository merely because it is not canonical for the website. Repository retirement is a separate decision and requires explicit verification/approval.
