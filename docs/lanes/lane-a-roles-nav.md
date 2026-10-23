# Lane A — roles & navigation (decision log)

Lane: **A — Roles and navigation foundation (Wave 1)** · agent: opencode · claim: issue #697
(branch `opencode/lane-a-roles-nav-20261022`, base `398f4d6f`).
Sources, in order of authority: `docs/plans/opencode/lane-a-update-2.md` →
`lane-a-update-1.md` → `lane-a-roles-nav.md` → `docs/plans/opencode/DE-portal-client-nav-prompt.md`.
Phase 0 evidence: `docs/lanes/lane-a-phase0.md`.

## Decisions

### D1 — One permission helper, one rule registry (lane file Step 2)
`shared/permissions/` is the permissions registry: `types.ts` (model + evaluator, lane A),
`lane-a.ts` (this lane's permission rules), `index.ts` (merges every `lane-*.ts`, exports
`can(principal, permission, companyId?)`). Wave 2 lanes add `shared/permissions/lane-<x>.ts`
plus one import line in `index.ts` — see `docs/lanes/registry.md`.
- Account classes derive from the existing `portal_users.role` value: `admin` → **super_admin**
  (break-glass), `staff` → **de_staff** (new value, additive migration), `user`/`viewer` → **client**.
  The enum values `admin`/`user`/`viewer` are never renamed or dropped (update 1 §3, update 2 §2).
- Client hats: `standard, approver, client_admin, billing, purchaser, owner` (new table
  `portal_user_client_roles`, additive). Compatibility default so nobody loses access today:
  a client user's effective hats = explicit rows **plus** a legacy derivation from `org_role`
  (`company_it_contact` / `dept_it_contact` / `is_company_it_contact` → all six hats;
  `manager` → standard + approver; otherwise → standard). Explicit rows only ever add.
- Tenant rule: `can(user, perm, companyId)` is **deny** for a client-class principal whose
  `clientId` ≠ `companyId`. `super_admin` / `de_staff` act in any company (that is their job).
- Unknown permission = deny (fail closed). `requireAdmin` is re-implemented on top of `can()`
  as the super-admin-only permission `portal.admin`, so its behaviour is byte-identical and
  every route that used it now goes through the helper.

### D2 — Registry is `portalNav.ts` (update 1 §1)
`PORTAL_NAV_GROUPS` stays the one nav registry; per-item rules (`roles`, `entitlement`,
`featureReady`, `sample`, `deOnly`, `superAdminOnly`, `requiresData`) are added to
`PortalNavItem`. No second registry. Wave 2 lanes edit only their own items' lines.

### D3 — Two presentations of the same registry
- **super_admin** renders exactly today's menu: same groups, same labels, same items, sample
  badges as today. Update 2 §2: "Keep its full access exactly as it is"; the acceptance test
  asserts the break-glass menu and permissions are unchanged.
- **de_staff** and **client** render the plan's target client menu (Phase 2): hub items
  (Home, Get help, People and devices, Billing and contracts, Order equipment, IT plan and
  reviews) with their merged routes as hub children, renamed labels, role/entitlement rules.
  de_staff additionally sees the finished DE-only items (Infrastructure Issues,
  Structure & IDs) and the DE Admin items they may use. Sample items are hidden from
  them too (update 3 §3).
- Every legacy route keeps working: nothing is unmounted or deleted. Hub children cover every
  old menu href (asserted by a test).

### D4 — Sample rule (update 1 §2, corrected by update 3 §3)
`sample: true` and `featureReady: false` items are dropped for **client roles and DE staff**
alike (update 3 §3: "there are no samples in the product"). Only the break-glass account
still sees them — with today's badges — because its access must not be reduced.
`/portal/admin/import` and `/portal/admin/agents` stay super-admin-only, untouched
(update 1 §6).

### D5 — Entitlements (update 2 §3)
New additive table `portal_client_entitlements` (keys `cloud_edge`, `voice`,
`security_awareness`), **default OFF** = menu item hidden. DE staff / super admin set them
(`entitlements.manage`). No Zoho or Hub source is wired; that needs Joe's approval first.

### D6 — Break-glass (update 2 §1, corrected by update 3 §1-2)
Built now (additive):
- **Login alert** on every successful `role=admin` login, sent to
  `PORTAL_BREAK_GLASS_ALERT_EMAIL` **only**. Unset = log a warning and send nothing;
  there is no invented default address (update 3 §2).
- **Audit flag** on admin actions: new additive `portal_audit_log` table; every mutating
  `/api/portal/*` request by a `super_admin`/`de_staff` actor writes a row with
  `break_glass = (role === 'admin')` before the action runs. If that write fails the
  failure is logged loudly and alerted, and **the action still runs** — the emergency
  account is never blocked by its own audit log (update 3 §1).
Built behind a flag, **default OFF**:
- `PORTAL_BREAK_GLASS_REQUIRE_STRONG_MFA` — when set, `role=admin` may only complete
  login with an enrolled passkey / hardware key (WebAuthn). No email or code fallback is
  written.
**Waiting on Joe** — see "Waiting on Joe" below.

### D7 — DE as a tenant (lane file Step 2)
Additive migration makes `msp-digerati` / "Digerati Experts" a durable `portal_clients` row
(same id the runtime already creates, so nothing special-cases). DE staff accounts are members
of it and hold client-manager rights across all companies.

### D8 — Company switcher (update 1 §4)
"DE staff switches company" reuses the existing admin impersonation
(`/api/portal/admin/impersonate` + `TenantSelector`): the routes move from `requireAdmin` to
`requirePermission("company.switch")` (de_staff + super_admin) and `authMiddleware` honours
`impersonatingCompanyId` for both classes. `role=admin` behaviour is unchanged.

## Waiting on Joe

1. **Break-glass strong-MFA enforcement** (update 2 §1). Flag exists, default OFF. When Joe
   approves, the steps are:
   1. Enroll a passkey/hardware key on the break-glass account (`/portal/settings` → MFA).
   2. Set `PORTAL_BREAK_GLASS_REQUIRE_STRONG_MFA=1` on the VPS `shared/.env` (name listed in
      `docs/SECRETS-REQUIRED.md`).
   3. Restart; password login for `role=admin` without an enrolled passkey is then refused with
      a message pointing at enrollment. No other account type is affected.
   4. Joe decides the separate break-glass login path (plan Phase 1) as a later change.
2. **Break-glass alert address** (update 3 §2). `PORTAL_BREAK_GLASS_ALERT_EMAIL` is read
   from the environment only. Joe supplies the real inbox; until it is set, break-glass
   logins and audit failures log a warning and send nothing. Listed in
   `docs/SECRETS-REQUIRED.md`.
3. **Fail-closed audit** (update 3 §1). Today a failed audit write is logged and alerted and
   the action proceeds. Whether break-glass actions should ever be blocked when their audit
   row cannot be written is Joe's decision.

## Verification (2026-10-22)

- **Tests:** `npx vitest run` — 2052 passed, 22 failed. The 22 failures are **identical to the
  `origin/main` baseline** (run in a clean worktree at `398f4d6f`, 1999 passed / 22 failed):
  `portalConsoleTheme` (4), `de-marketing/render` (1), `deployScripts` (1), `adminCompanyMetrics`
  (1), `deskTicketFallback` (1), `portalSessionRevocation` (3), `portalUserInvite` (1),
  `publicSolutionSpool` (6), `stagingReviewGuard` (1), `storeQuoteFallback` (1), `publicPhone` (2)
  — all Windows-environment issues (CRLF regexes, `chmod` modes, slow-runner timeouts) and all
  outside this lane's files. New tests added here: 53.
- **Typecheck / build / smokes:** `npm run check` clean, `npm run build` clean,
  `npm run smoke:public` OK, `npm run smoke:a11y` OK (gate critical/serious; the listed
  `/book` items are the known third-party Zoho Bookings iframe, report-only),
  `npm run check:route-meta` OK (118 routes), `npm run check:active-work` OK.
- **Browser (real render, 390 / 768 / 1024 / 1440):** `node scripts/qa/lane-a-roles-nav.mjs`
  renders the real `PortalLayout` with isolated EXAMPLE responses and asserts every account
  type's menu plus the hidden-route redirect. Evidence:
  `artifacts/visual-qa/lane-a-roles-nav/{before,after}/` (before = the same script run on
  `origin/main`). The break-glass menu is byte-for-byte today's menu in both.
  The browser pass found and fixed one real bug: the "not available for your account" note
  was lost when the guard's redirect remounted the shell; it is now parked in
  `sessionStorage` for the next mount.
- **Guardrail:** `npm run check:sample-data` — 41 findings, report-only, exit 0 (as designed).

## Notes added during verification

- The dashboard's "Do something" quick actions and the "All services" header link now use the
  same `isNavAllowed` rule as the menu, so an account is never offered a route it cannot open
  (e.g. clients no longer see "Report an outage" → the now-DE-only Infrastructure Issues page;
  reporting an issue stays available through Get help / New ticket). Asserted in
  `scripts/qa/lane-a-roles-nav.mjs`.
- `navContext.data.sharedFiles` counts live `portal_tenant_files` rows for the acting company.
  When Lane B adds per-user sharing, narrow it to the signed-in user.

## Notes for other lanes

- **Lane B (file delivery):** `files.share` (de_staff + super_admin) and `files.read` exist in
  `shared/permissions/lane-a.ts`; wire them into the file routes when you build Phase 3. I did
  not change the file routes. `navData.sharedFiles` (nav context) counts live
  `portal_tenant_files` rows for the active company — refine to per-user sharing when
  per-user shares exist.
- **Lane C/D (planning, status):** `IT plan and reviews` is `featureReady: false` +
  `requiresData: "itPlan"`; flip `featureReady` and feed `navData.itPlan` when the real data
  source lands. `System Status` is `deOnly` while it shows sample content.
- **Lane E (integrations):** Secure access / Business phone / Security training items are
  entitlement-gated (`cloud_edge`, `voice`, `security_awareness`) and hidden from clients until
  an entitlement record exists. Vendor names stay out of client labels (DE canonical naming).
- **Everyone:** extend the nav by editing your own items' lines in
  `client/src/components/portal/shell/portalNav.ts`, and permissions via your own
  `shared/permissions/lane-<x>.ts` (`docs/lanes/registry.md`).
