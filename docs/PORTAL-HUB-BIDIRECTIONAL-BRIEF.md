# Client Portal ↔ Intelligence Hub — two-repo work brief

**For:** a Cursor session with both repos checked out
**Written:** 2026-09-26, from code in `digeratiexperts-site@d1031dd6` and `Intelligence-Hub@fa80c9f`
**Status of this document:** survey + ordered plan. Every claim below was read from code or the live GitHub API, not assumed.

## Repos and authority

Per `Intelligence-Hub/REPOSITORY-AUTHORITY.md` (canonical):

| System | Repo | Branch | Production |
|---|---|---|---|
| Public website / Store / **Client Portal** | `digeratiexperts/digeratiexperts-site` | `main` | `digeratiexperts.com` |
| TechSales / **Intelligence Hub** | `digeratiexperts/Intelligence-Hub` | `master` | `techsales.digerati-experts.com`, VPS `/opt/intelligence-hub` |

Note the branch names differ (`main` vs `master`). Legacy, do not use as source: `TechSales`, `de_site`, `intelligencehub-`.

Suggested Cursor layout:

```
~/de/digeratiexperts-site      # branch main
~/de/intelligence-hub          # branch master
```

Hub runtime SHA is read from `/opt/intelligence-hub/current/RELEASE_SHA`. Repo state is not a substitute for runtime verification.

---

## What already exists — do not rebuild this

The bidirectional layer is substantially built on both sides. Going in assuming a greenfield integration would destroy working code.

**Shared protocol.** Four HMAC-signed directions, implemented on both sides:
`website_to_hub`, `portal_to_hub`, `hub_to_website`, `hub_to_portal`.

- Site: `server/integrations/deSyncAuth.ts` (HMAC, 5-minute timestamp skew window, per-direction scoped secrets)
- Hub: `artifacts/api-server/src/lib/de-sync-auth.ts`

**Event contract — currently in sync.** 41 event types, identical sets, identical order, verified by diff:

- Site: `server/integrations/deSyncContract.ts` (108 lines)
- Hub: `artifacts/api-server/src/lib/de-sync-contract.ts` (100 lines)

**Site transport.** `server/integrations/` — `deSyncStore.ts`, `deSyncWorker.ts`, `deSyncRoutes.ts`, `deSyncInboxLifecycle.ts`, `deSyncOutboxRecovery.ts`, `enqueueWebsiteCommand.ts`, `ensureDeSyncSchema.ts`, `techSalesClient.ts`, `tenantIdentity.ts`.

**Live push to the browser.** `hubEvents.ts` → `portalSse.ts` (`publishPortalProjection`) → `client/src/hooks/usePortalHubEvents.ts`. Hub events already reach the portal UI over SSE.

**Hub API surface.** `lib/api-spec/openapi.yaml` — 8,427 lines, **103 paths**. Client-relevant groups: `/client-environment/*` (10), `/deals/*` (15), `/clients/*` (4), `/qbrs/*` (4), `/scorecards/*` (4), `/it-operations/*` (4), `/signatures/*` (5), `/quotes/*` (2).

**Codegen already wired.** `lib/api-spec/orval.config.ts` → `lib/api-zod/src/generated/*` (Zod types) and `lib/api-client-react`. The site does **not** consume these yet. That is the single biggest available win — see Task 3.

**Hub Integration v1 service API.** `/api/integrations/v1/*` — `health`, `tenant-scope`, `identities`, `sync-state`, `dead-letters`, `reconciliation-issues`, `audit-events`, `github-changes`, `deployments`, `content-registry`, `publication-jobs`, `organizations`, `contacts`, `inventory`. Contract: `Intelligence-Hub/docs/integrations-v1-openapi.yaml`.

**Hub-side portal bridge.** `artifacts/api-server/src/lib/portal-bridge.ts` (59 lines) — exists, and is the weak point. See Task 2.

---

## What is genuinely not done

From `Intelligence-Hub/docs/DE-ECOSYSTEM-TASKS.md`, the 30-task ECO ledger. Status vocabulary there: BACKLOG → READY → IN_PROGRESS → BLOCKED → PR_READY → REVIEW → APPROVED → MERGED → LIVE.

| ID | Deliverable | Depends on | Status |
|---|---|---|---|
| **ECO-016** | **Client Portal connector and field-level two-way sync** | ECO-003, ECO-004, ECO-007 | **BACKLOG** |
| ECO-003 | Canonical DE UUID / external-ID model + entity registry | ECO-002 | READY, blocked |
| ECO-002 | Field-level source-of-truth matrix | ECO-001 | **REVIEW — "Do not start ECO-003"** |
| ECO-013 | Replace duplicated website facts with registry consumers | ECO-011, ECO-012 | BACKLOG |
| ECO-014 | Store catalog/pricing sync + drift checks | ECO-011 | BACKLOG |
| ECO-024 | Email approval/send workflow + delivery ingestion | ECO-023 | BACKLOG |

The ledger states the portal position explicitly and repeatedly:

> "Portal is authority for explicitly user-owned profile fields; two-way sync remains ECO-016 and is not wired."

So: **the transport is built, the field-level mapping is not.** Events flow. Nothing yet decides, per field, which side wins on conflict.

---

## Blockers to clear before writing integration code

These are not integration work, but integration work cannot be verified without them.

### B1 — Site production cannot deploy (highest priority)

Tracked as **digeratiexperts-site#224**, filed 2026-09-25.

Every `main` push since 2026-09-20 fails at the migration step:

```
[deploy] Applying database migrations
> node scripts/run-migrations.mjs
error: Your account or project has exceeded the quota. Upgrade your plan to increase limits.
code: '53000'   (insufficient_resources)
```

- Last successful deploy: `12cbb8d9`, 2026-09-19.
- **15+ commits are MERGED but not LIVE**, including the MFA crypto and portal auth migrations.
- Needs a provider/billing action on the production Postgres. Not fixable in code.

Any portal↔Hub work you merge lands in the same stranded state until this clears. Fix first, or accept that nothing you build is verifiable in production.

### B2 — `main` is unprotected

**digeratiexperts-site#124** (#100 and #115 closed into it). `protected: false`, required checks off, 22 open PRs, multiple agents. When configuring: require the PR and the check named exactly `Typecheck, test, build, audit, and smoke`. **Do not enable required approving reviews** — every PR is authored by the `digeratiexperts` account and GitHub blocks self-approval, which would deadlock all open PRs.

### B3 — ECO-002 review is open, and it gates the critical path

ECO-002 is in REVIEW with "Do not start ECO-003." ECO-003 is the canonical ID model. ECO-016 depends on ECO-003. **So the portal two-way sync you want is two closed reviews away from being startable.** Named unresolved items in ECO-002: tax and provisioning authority remain conditional; historical lead/prospect meaning-swap vs no SDR-derived mutation.

Either close ECO-002 (decide those), or consciously accept starting ECO-016 on `accountId` only and eat the rework.

### B4 — Unmerged work on both sides

- Site: 22 open PRs, most draft.
- Hub: 11 open PRs, all draft, on `master` (`#267 Answer Hub AI questions from portal rows and confirm write` is portal-relevant; `#281` is stacked on `cursor/visual-pass-9e94`).

Many ECO items are PR_READY, meaning written but not merged. Before building, check whether the thing you are about to write is sitting in a draft PR.

---

## Ordered task list

### Task 1 — Reconcile the ECO ledger against merged reality

**Both repos.** The ledger has many PR_READY rows. PR_READY is not MERGED and definitely not LIVE.

For each ECO row marked PR_READY, determine which of: merged to `master`/`main`; sitting in an open draft PR; or neither. Write the finding back into `docs/DE-ECOSYSTEM-TASKS.md`.

Do this first. Every later estimate is wrong without it.

**Done when:** every ECO row's status matches a verifiable commit or PR number.

---

### Task 2 — Replace string-matched identity in the portal bridge

**Hub.** `artifacts/api-server/src/lib/portal-bridge.ts` currently resolves a portal caller's account by `accountId`, and failing that by **`companyName` / `accountName` string match**:

```ts
const companyName =
  typeof req.query.companyName === "string" ? req.query.companyName.trim()
  : typeof req.query.accountName === "string" ? req.query.accountName.trim() : ...
```

Company-name matching across two systems is the classic silent cross-tenant data leak: two accounts with similar names, or a renamed account, resolve to the wrong tenant. This is a **security** issue in a multi-tenant path, not just a data-quality one.

This is what ECO-003's canonical ID model is for. Minimum viable fix without waiting on ECO-003:

1. Require a stable Hub account id or a mapped external id on every portal-bridge call.
2. Make name-based resolution fail closed, behind an explicit opt-in flag, never the default.
3. Add a test asserting two similarly-named accounts cannot resolve to each other.

Site counterpart: `server/integrations/tenantIdentity.ts`, `techSalesClient.ts` (`persistHubAccountId`).

**Done when:** no portal→Hub request resolves a tenant by name alone, and a test proves it.

---

### Task 3 — Stop hand-maintaining the sync contract in two places

**Both repos.** `deSyncContract.ts` and `de-sync-contract.ts` are two hand-kept copies of the same 41 event types. They agree *today* (verified). They will not stay that way, and drift here breaks sync silently — an event the sender emits and the receiver rejects.

Complication: the site uses `zod`, the Hub imports `zod/v4`. Different majors, so you cannot naively share one module.

Options, in preference order:

1. Publish the contract from the Hub as a versioned package the site consumes (fits the existing `lib/api-spec` → `lib/api-zod` codegen pattern).
2. Generate the site's copy from the Hub's at build time and fail CI on drift.
3. Cheapest stopgap: a contract-drift test in both CIs that compares the event-type list against a committed fixture.

Even option 3 is worth doing this week. The site now has `scripts/check-active-work.mjs` as a precedent for a cheap CI invariant check.

**Done when:** a contract change in one repo cannot merge without the other repo's CI noticing.

---

### Task 4 — Retire the legacy shared secret

**Both repos.** `deSyncAuth.ts` accepts per-direction scoped secrets *and* falls back to a legacy shared one:

```ts
process.env.TECHSALES_SYNC_TOKEN || process.env.WEBSITE_LEAD_WEBHOOK_SECRET
```

`acceptedSecrets()` accepts the legacy secret **in addition to** the scoped secret, for all four directions. So one leaked legacy token authenticates `website_to_hub`, `portal_to_hub`, `hub_to_website` and `hub_to_portal` alike — it defeats the entire point of direction scoping.

1. Confirm all four scoped secrets are set in both production environments (`/etc/intelligence-hub/portal.env` on the Hub side).
2. Remove the legacy fallback and delete the variables.
3. Keep the `legacy: true` flag long enough to log and confirm nothing still uses it, *then* remove.

**Done when:** legacy acceptance is gone from both repos and no request is rejected because of it.

---

### Task 5 — ECO-016 proper: the field-level authority map

**Both repos.** This is the actual "bidirectional" ask. Transport is done; this is the decision layer.

For every field that appears in both the portal and the Hub, record: which side is authoritative, whether it is user-owned, and what happens on conflict. The Hub already has machine-readable precedent: `artifacts/api-server/src/lib/eco-002-sot-matrix.ts`. Extend it rather than inventing a parallel format.

Start with the fields the portal actually renders — from `client/src/pages/portal/`: `PortalCompany.tsx`, `PortalDashboard.tsx`, `PortalContracts.tsx`, `PortalBilling.tsx`, `PortalApprovals.tsx`.

The ledger's existing rule is the right default and must be honored: **the portal is authority for explicitly user-owned profile fields.** Everything else needs an explicit decision, and "unavailable" must never resolve to a broader permission, a newer lifecycle, `$0` pricing, or any other permissive assumption — that fail-closed rule is already written into ECO-002.

**Done when:** every field rendered by the portal has a recorded authority and conflict rule, enforced in code, with a test per conflict direction.

---

### Task 6 — Make the portal consume the Hub's generated client

**Site.** The Hub publishes an OpenAPI spec with 103 paths and generates `lib/api-zod` + `lib/api-client-react`. The site currently hand-rolls its Hub calls in `techSalesClient.ts` and `client/src/lib/portalApi.ts`.

Adopt the generated types for the client-facing Hub reads the portal needs — `/client-environment/*`, `/clients/*`, `/qbrs/*`, `/scorecards/*`, `/it-operations/*`. This deletes hand-written types and makes Hub API changes a compile error instead of a runtime surprise.

Do Task 3 first — same underlying problem, and the answer should be consistent.

**Done when:** portal Hub reads are typed from the Hub's spec, and a spec change that breaks the portal fails the site's typecheck.

---

### Task 7 — Close the loop with reconciliation and health

**Both repos.** The Hub exposes `/api/integrations/v1/sync-state`, `dead-letters`, `reconciliation-issues`, `health`. The site has `deSyncOutboxRecovery.ts` and dead-letter handling. Nothing surfaces any of it.

Per the ledger's own definition of done:

> "A connector is not done when it authenticates. It is done when reads/writes are scoped, external IDs are mapped, health/freshness is visible, retries are idempotent, divergence is detectable, reconciliation is verified, failures create actionable internal issues, and all mutations are auditable."

Wire the existing health/dead-letter/reconciliation endpoints into something a human looks at — ECO-027 is the Hub-side console and is already PR_READY, so check Task 1's finding before building a second one.

**Done when:** a stalled or diverged portal↔Hub sync is visible without reading logs.

---

## Do not touch

- **Scrollcraft is frozen** (2026-09-01, Joe): no page code or new scroll treatment on any route until `scrollcraft/EXPERIENCE-PLAN.md` phase gates pass. Planning documents only.
- **`Intelligence-Hub` PR #196-equivalent corruption on the site:** `chatgpt/finish-bug-hunt` has a 150,060-byte binary `server/routes.ts`. Do not merge it. Its salvageable files already landed via `2d784ea7` and `ca42d1e1`. Site issue #195 tracks the session-preservation work that was lost inside the blob and must be rewritten by hand against `main`.
- **kie.ai spend:** none without Joe's approval and a cap in the same message.

## Environment

Integration variables the site reads (`server/integrations/`):

```
WEBSITE_TO_HUB_SECRET      PORTAL_TO_HUB_SECRET
HUB_TO_WEBSITE_SECRET      HUB_TO_PORTAL_SECRET
TECHSALES_BASE_URL         TECHSALES_HUB_URL       TECHSALES_SYNC_URL
TECHSALES_SYNC_TOKEN       WEBSITE_LEAD_WEBHOOK_SECRET   # legacy — Task 4 removes
DATABASE_URL  SESSION_SECRET
ZOHO_CLIENT_ID  ZOHO_CLIENT_SECRET  ZOHO_OIDC_ISSUER
ZOHO_PORTAL_OIDC_REDIRECT_URI  ZOHO_OAUTH_PORTAL_REDIRECT_URI  ZOHO_OAUTH_STATE_SECRET
PORTAL_OAUTH_EMAIL_ALLOWLIST
BLACKPOINT_*  JUMPCLOUD_*
```

Hub production env lives at `/etc/intelligence-hub/portal.env`.

**Host trap, documented in the ledger:** the Hub is not the Client Portal, and hyphenated `portal.digerati-experts.com` is **not** the portal login host. Confirm hosts against `de-hosts` before wiring any redirect or CORS origin.

## Suggested sequence

1. **B1** (#224 database quota) — nothing is verifiable in production until this clears.
2. **Task 1** (ledger reconciliation) — cheap, and everything else is mis-estimated without it.
3. **Task 2** (name-matched identity) and **Task 4** (legacy secret) — both security, both small, both independent of the ECO chain.
4. **B2** (#124 branch protection) once the PR backlog is drained enough not to deadlock.
5. **B3** (close ECO-002 → ECO-003), then **Task 5** (ECO-016 field authority) — the real deliverable.
6. **Task 3** then **Task 6** (contract sharing, generated client).
7. **Task 7** (health and reconciliation visible).

Tasks 2, 3, 4 are worth doing even if ECO-002 stays open. Task 5 is not — it will be rewritten.
