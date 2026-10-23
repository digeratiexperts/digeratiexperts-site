# opencode lane rules (portal + homepage build, approved by Joe 2026-10-22)

These rules add to the repo's own rules. They never override them.
**Read first, in order:** `AGENTS.md`, `CLAUDE.md`, `docs/AI-ENGINEERING-GOVERNANCE.md`, `docs/ACTIVE-WORK-COORDINATION.md`, `.ai/ACTIVE_WORK.yaml`, `design/DESIGN-AUTHORITY.md`.

## Your role
- You are a **specialist agent** (opencode). Claude Code is the lead integrator. Joe has final authority.
- The plans in `docs/plans/opencode/` are **approved**. Build them; don't re-debate scope.
- Your lane file says what you own. Stay inside it.

## Before you edit anything
1. `git fetch origin` and confirm your worktree branch is based on current `origin/main`.
2. Check all open PRs (drafts too) and their changed files, plus active issues. An open PR owns its files.
3. Claim your work the way `docs/ACTIVE-WORK-COORDINATION.md` says (issue or draft PR, and the YAML mirror).
4. Declare your slice in a few lines: objective, likely files, acceptance criteria, test commands, boundaries.

## Never (stop gates)
- Never merge, push to `main`, rebase or force-push a shared branch, approve PRs, or deploy. Open PRs only.
- Never touch another session's branch or PR.
- Never add, print, paste or commit secrets. Use env var **names** only, and list new ones for `docs/SECRETS-REQUIRED.md`.
- Never generate Zoho grant codes or call Zoho token endpoints. All Zoho access goes through `server/zoho/oauth`.
- Never delete routes, data, tables or files outside your lane. Migrations are additive only.
- Never spend money (no kie.ai or Recraft jobs, no sign-ups).
- **Stop and ask Joe only for:** production access, secrets, money, deletion, client impact, or an architecture fork the plans don't settle. For everything else, decide, write it in your lane log, and continue.

## Quality bar
- **No sample, mock, placeholder or demo data in production code, ever.** No data means an honest empty state.
- No fabricated clients, testimonials, metrics, SLAs, response times or security events.
- `Account Lifecycle Status` is internal only. It never appears in client-facing UI or client-scoped API responses.
- Use DE canonical names (`docs/DE-NAMING-CANON.md`). No vendor names in client-facing UI, except Microsoft 365, Apple, Dell and Lenovo.
- Company name: "Digerati Experts" or "DE", never "Digerati" alone.
- UI tasks run in **Maintenance Mode** (`design/DESIGN-AUTHORITY.md`) unless your lane says otherwise.
- Every feature needs:
  - loading, empty and error states
  - role and tenant checks enforced on the **server**
  - a test proving client A cannot read client B's data
- Verify UI in a real browser at 390 / 768 / 1024 / 1440. Never judge UI from source code alone.
- Before every push, run `npm run check`, `npm test` and `npm run build`. Run `npm run smoke:a11y` for UI changes.

## Coordination between lanes
- Keep a log at `docs/lanes/<your-lane>.md` with what you decided, what you changed, and what you need from other lanes.
- Shared registries (navigation, routes, permissions) are extended by adding **your own file** in the registry folder Lane A creates (see `docs/lanes/registry.md`). Don't edit another lane's file.
- Follow the repo's existing migration tooling and naming (`migrations/`, `npm run db:migrate`). Never edit another lane's migration.
- Add a dependency only if needed, and list it in your PR with the reason.

## Finishing a session
- Commit small and often. Before opening the PR, fetch `origin/main` again, reconcile, and include the concurrency report and visual evidence (`AGENTS.md` → "Before PR").
- End with the DE handoff block (`C:\Users\Joe\DE\Governance\AI-HANDOFF-STANDARD.md`).
- If Joe must do something himself, end with an `Add to to-do list:` block, one line per task as `group | title | notes`.
