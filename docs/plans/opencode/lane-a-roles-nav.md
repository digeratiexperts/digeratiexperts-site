# Lane A — Roles and navigation foundation (Wave 1)

Read `docs/plans/opencode/LANE-RULES.md` first, then `docs/plans/opencode/DE-portal-client-nav-prompt.md`.
Also read: `docs/PORTAL-AUTH.md`, `docs/PORTAL-ROUTING.md`, `docs/PORTAL-REPRESENTATION-CONTRACT.md`, `docs/ACCOUNT-LIFECYCLE-STATUS.md`.

**You own:** roles and permissions, the server-side permission helper, the navigation registry, route guards, the company switcher, the "Digerati Experts" company record, and the sample-data CI guardrail.
**Everything other lanes build depends on you, so finish cleanly.**

## Step 0 — Land the shared files
Your worktree already contains:
- `docs/plans/opencode/` (both plans + all lane files)
- `tools/signcheck/` (the tested signature scanner)

Commit them first, unchanged, as their own commit: "Add approved portal/homepage plans and signcheck tool". They reach `main` with your PR.

## Step 1 — Phase 0 report
Write the Phase 0 report from the portal plan to `docs/lanes/lane-a-phase0.md`.
Continue unless it reveals an architecture fork the plan doesn't settle. If it does, stop and explain the options.

## Step 2 — Role model (plan Phase 1)
- **Break-glass super admin:** keeps today's full Administrator access. Separate login, strongest MFA available, login alert email, and an audit flag on every action.
- **DE staff:** one account with two hats. It's a member of the "Digerati Experts" company (sees the normal client menu there) and a client manager across all companies (switch company, manage client users, roles and entitlements, share files, work tickets and requests).
- **Super admin only:** global settings, auth config, staff roles, deleting a company, billing and integration config.
- **Client roles:** standard, approver, client admin, billing, purchaser, owner.
- One server-side helper, e.g. `can(user, permission, companyId)`. Use it in every route.
- Make sure "Digerati Experts" exists as a normal company (additive migration).

## Step 3 — Navigation registry (plan Phase 2)
- One registry. Each item declares its role rule, entitlement rule, and a `featureReady` flag.
- Make it extensible: other lanes add items as **their own files** in a registry folder. Document exactly how in `docs/lanes/registry.md` before you open the PR.
- Apply the target client menu: merges, renames, role and entitlement rules, and DE-staff-only items.
- SAMPLE items: hidden from every client role, still visible to DE staff, `featureReady: false` until their lane finishes.
- Hidden routes redirect to Home with a short "not available for your account" note. No route is deleted, and old paths keep working.

## Step 4 — Guardrail
Add a CI check that flags SAMPLE badges, `mock`/`sample`/`demo` data imports outside tests, and sample-data feature flags. Run it in **report-only** mode for now; Lane F switches it to enforce.

## Step 5 — Tests and PR
- **Tests:** full role matrix, entitlements on and off, tenant isolation, break-glass audit flag, redirects.
- **PR must include:** the role/permission matrix, the nav config table, before/after menu screenshots for each role, and the concurrency report.
