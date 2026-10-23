# Client Portal: turning every SAMPLE page into a real feature

Status: **plan, not started** (written 2026-10-23, base `8cdb120`).
Owner of the plan: Joe (DE). Anyone may pick up a slice; claim it first (see "Picking up a slice").

Joe, 2026-10-23: "nothing should be a mere sample, it should all be fully build and working and tested … plan it all out fully and document how its built from a high level technically so others can continue your work and jump in."

This document is the single plan for that. It says what is sample today, how a real portal
feature is built in this repo, and, per feature, the data model, endpoints, UI, tests,
outside dependencies and the order to build them in.

---

## 1. What is sample today

Source of truth for the badge: `client/src/components/portal/shell/portalNav.ts`
(`sample: true` on the item, or `rule.sample`). Ten items:

| # | Menu label | Route | Page | Today | Outside dependency |
|---|---|---|---|---|---|
| 1 | DE Questionnaires | `/portal/questionnaires` | `pages/portal/PortalQuestionnaireCalendar.tsx` | hardcoded `mockEvents`; server stub `GET /api/portal/questionnaires/events` returns `configured:false` | none |
| 2 | IT Roadmap | `/portal/roadmap` | `pages/portal/PortalRoadmap.tsx` | hardcoded `sampleRoadmapItems`, `budgetSummary` | none |
| 3 | Business Reviews (QBR) | `/portal/qbr` | `pages/portal/PortalQBR.tsx` | hardcoded `qbrReports`, `recommendations`, `SECURITY_SCORE = 88` | none |
| 4 | System Status | `/portal/status` | `pages/portal/PortalStatus.tsx` | hardcoded `services`, `incidents`, `metrics` | none (device health later needs an RMM API) |
| 5 | VPN Access ("Secure access") | `/portal/vpn` | `pages/portal/PortalVPN.tsx` | **live code exists**; shows `SampleVPN()` until `PORTAL_VPN_PROVIDER` is set | `manual` works now; Tailscale/Twingate keys; Timus needs API access |
| 6 | Cytracom Phone ("Business phone") | `/portal/cytracom` | `pages/portal/PortalCytracom.tsx` | **live code exists** (extensions only); `SamplePhonePage()` until `PORTAL_PHONE_PROVIDER=cytracom` | Cytracom token per client |
| 7 | Ship Center | `/portal/ship-center` | `pages/portal/PortalShipCenter.tsx` | **live code exists**; `SampleShipCenter()` until `PORTAL_SHIPPING_PROVIDER` is set | `manual` works now; ShipStation/EasyPost/Shippo keys |
| 8 | IT plan and reviews (hub) | `/portal/it-plan` | `ItPlanHub` in `components/portal/shell/PortalHub.tsx` | `server/routes.ts` hardcodes `navContext.data.itPlan: false` | none (follows 2 and 3) |
| 9 | Data Import (super admin) | `/portal/admin/import` | `pages/portal/AdminImport.tsx` | static list, every system "unavailable" | Zoho (via `server/zoho/oauth`), JumpCloud, Seamless.ai |
| 10 | Manage Agents (super admin) | `/portal/admin/agents` | `pages/portal/AdminAgents.tsx` | hardcoded `sampleAgents`, in-memory CRUD with `alert()`, fake download URL, **no sample notice** | a published, signed DE Windows Agent release |

Who sees a sample item: `shared/permissions/types.ts` hides any item with `rule.sample` or
`featureReady: false` from DE staff and client roles. Only the super-admin break-glass
account sees them. So "finishing" an item means two things: the page shows real data,
**and** its rule flips so real users can reach it.

Already real (not sample, no work here): Surveys, Digital Warehouse, Data Sources, OpenAI Billing.

**Not badged but still fake:** the client "Desktop Agent" page (`client/src/pages/portal/PortalAgent.tsx`)
hardcodes an `agents` array, and its download button points at `/api/portal/agent/download`, a route
that does not exist on the server. Its fix is part of Slice G.

---

## 2. How a real portal feature is built here (the pattern to copy)

Copy the shape of **Service Requests** (`server/serviceRequest*.ts`) and **Licensing**
(`server/licensing*.ts`). Every new feature follows the same seven layers.

```
migrations/NNNN_<feature>.sql      table(s), hand-written SQL, next free number (0021+)
shared/schema.ts                   pgTable definition matching the SQL (drizzle types)
shared/<feature>.ts                shared types, labels, validation used by client AND server
server/<feature>Store.ts           data access: Postgres via drizzle, in-memory fallback for tests
server/<feature>Routes.ts          registerXRoutes(app, deps); company scoping; admin vs client routes
server/<feature>Routes.test.ts     express app + fake auth header; two tenants; in-memory store
client/src/pages/portal/...        page uses React Query against the routes; honest empty/error states
portalNav.ts                       drop `sample`, set featureReady: true, keep the right role rule
```

### 2.1 Storage
- Postgres through drizzle (`server/db.ts` exports `db`, `dbReady`). A store uses the DB when
  `dbReady && db`, otherwise an in-memory map. It exports a `_reset…Memory()` helper for tests.
- **Tables are created only by migrations**: `migrations/NNNN_name.sql`, applied by
  `npm run db:migrate` (`scripts/run-migrations.mjs`). A store's `ensureSchema()` only checks
  `to_regclass(...)` and logs "run npm run db:migrate". Do not `CREATE TABLE` from a store.
  (`server/portalSurveyStore.ts` breaks this rule; don't copy it.)
- Every row carries `client_id`. Every query filters by it. No route returns another company's rows.
- Small, schemaless per-company records (sites, VPN devices, shipments, announcements) can
  use `portal_manual_records` (`server/portalManualRecords.ts`, `MANUAL_RECORD_KINDS`)
  instead of a new table. Use a real table when the data has workflow, status history or relations.

### 2.2 Company scope (who the data belongs to)
- `selectedPortalCompanyId(user)` (`server/portalCompanyProfile.ts`) is the only way to get the
  company: a client user's own `clientId`, or for a DE admin the company they opened ("View as",
  `impersonatingCompanyId` in the token).
- When there is no company, return `400 { code: "COMPANY_CONTEXT_REQUIRED" }`. The client shows
  `<CompanyReadiness missing />` (`client/src/components/portal/CompanyReadiness.tsx`), which gives
  a DE admin an inline **company picker** that opens the company and reloads the same page.
  Never send people to Manage Companies + back button.
- DE-side management screens live under `/api/portal/admin/...` behind `adminGuards`
  and take the company id in the path, not from impersonation.

### 2.3 Routes and guards
- `registerXRoutes(app, deps)` with an explicit deps type (see `ServiceRequestRouteDeps`).
  Inject `getClient`, `findUser`, `listClientUsers`, `now`, and any notifier, so tests need no real services.
- Wire it in `server/routes.ts` next to `registerLicensingRoutes`, with
  `guards: [authMiddleware, validateInput]` and `adminGuards: [authMiddleware, requireAdmin, validateInput]`.
- Role checks for client users come from `shared/permissions` (owner, IT contact, and so on), not ad-hoc string compares.
- Account lifecycle status is never sent in client-scoped responses (`AGENTS.md`, account lifecycle rule).

### 2.4 Intelligence Hub sync (only where the Hub needs the data)
- Pattern: `server/serviceRequestHubSync.ts` → `enqueueOutbox()` (`server/integrations/deSyncStore.ts`).
  The DE-Sync worker signs (`X-DE-Signature`, `PORTAL_TO_HUB_SECRET`) and POSTs with retries; it never throws.
- The Hub is the operational control plane (`.cursor/rules/de-ecosystem.mdc`). Before building
  roadmap, QBR or status storage, read `docs/PORTAL-HUB-BIDIRECTIONAL-BRIEF.md` and decide per
  feature whether the portal **owns** the data or **projects** it from the Hub (see section 5, decision D1).

### 2.5 Outside integrations (VPN, phone, shipping pattern)
- One env var per area picks the source: `sample` | `hidden` | a provider name
  (`server/portalIntegrations.ts`, `readIntegrationStatus()`); `GET /api/portal/integrations`
  reports it, and `client/src/lib/portalIntegrations.ts` feeds the nav and the page.
- `live` mode clears the badge and sets `featureReady` automatically (`effectiveRule()` in `portalNav.ts`).
- Adapters live in `server/integrations/<area>/<provider>.ts` with fixtures and `adapters.test.ts`.
- Secrets: names in `docs/SECRETS-REQUIRED.md`; values only in the server environment. The admin
  Data Sources page (`server/portalDataSources.ts`) shows set/unset, never values.

### 2.6 Client page rules
- React Query against the feature's endpoints; `staleTime` and query keys mirror the URL.
- Every page has four honest states: loading, error (with the server's message), empty (what it
  will show and who fills it), and data. **No hardcoded business data, numbers or claims** in a
  component: no "88/100", no "reduces breach risk by 85%".
- Components from `client/src/components/portal/ui` (`Panel`, `Callout`, `EmptyState`, `StatTile`).
  Styling follows `design/DESIGN-AUTHORITY.md` (portal is Maintenance Mode, current system).

### 2.7 Definition of done (every slice)
1. Migration + schema + store + routes + client page, no sample data left in the component.
2. Route tests: auth required, tenant isolation with two companies, admin-only writes refused for
   client users, validation errors, and the happy path.
3. `npx tsc --noEmit -p .` clean; `npx vitest run` green.
4. Checked in a browser on the dev server (DE admin with the company picker, and a client user),
   screenshots at 1440 and 390 attached to the PR.
5. `portalNav.ts`: `sample` removed, `featureReady: true`, the intended role rule kept.
   Nav tests updated (`client/src/components/portal/shell/*.test.ts`, `shared/permissions/*.test.ts`).
6. Row in `.ai/ACTIVE_WORK.yaml` and in the Hub's `docs/WORK-LEDGER.md` if the Hub is touched.
7. PR merged only on Joe's "merge"; LIVE checked separately from MERGED.

### 2.8 Running it locally as a DE admin
The dev bootstrap admin needs no real credentials:

```bash
HASH=$(node -e "console.log(require('bcrypt').hashSync('<pick-a-local-password>',10))")
ENABLE_DEV_PORTAL_BOOTSTRAP=true DEV_PORTAL_ADMIN_PASSWORD_HASH="$HASH" PORT=5056 npm run dev
```

Sign in at `/portal/login` as `admin@digeratiexperts.com`. Demo companies (Acme Corp, Phoenix
Medical Group, …) are seeded outside production (`seedDemoIfNotProduction` in `server/portalAuthStore.ts`).
Production refuses the bootstrap.

---

## 3. Per-feature plans

Each slice is one PR. Sizes: S ≈ half a day, M ≈ 1–2 days, L ≈ 3+ days.

### Slice A: System Status (S–M, free)
Goal (`docs/plans/opencode/lane-d-status-shipping.md`): DE posts incidents and maintenance for one
client or for everyone; clients see current status and history; a status line on Home.

- **Table** `portal_status_notices` (migration 0021):
  `id, client_id NULL (NULL = all clients), kind ('incident'|'maintenance'|'notice'),
  severity ('info'|'degraded'|'outage'), title, body, affected_services text[],
  starts_at, ends_at NULL, resolved_at NULL, updates jsonb (timestamped posts), created_by, created_at, updated_at`.
- **Routes:**
  - `GET /api/portal/status`: open + last 90 days for the company, plus global notices; computed overall state.
  - `GET|POST|PATCH /api/portal/admin/status-notices[/:id]`: DE creates, posts updates, resolves.
- **UI:** replace the `services` / `incidents` / `metrics` arrays. Overall banner, open incidents with
  their update timeline, scheduled maintenance, history. Keep `formatResponseTargets` (already real).
  A DE admin form on the same page or under `/portal/admin/status`.
- **Out of scope for this slice:** per-device health and uptime metrics. That is a follow-up that needs an
  RMM integration (none exists; see decision D4). Remove the fake metrics instead of keeping them.
- **Nav:** drop `deOnly` so clients see it (decision D2), `featureReady: true`.

### Slice B: IT Roadmap (M, free)
Fields (`docs/plans/opencode/lane-c-planning.md`): title, why it matters, priority, target quarter,
estimated cost, status; the owner comments and approves.

- **Table** `portal_roadmap_items`: `id, client_id, title, rationale, category, priority ('high'|'medium'|'low'),
  target_quarter ('2027-Q1'), estimate_low_cents, estimate_high_cents, status
  ('proposed'|'approved'|'in_progress'|'done'|'declined'), decision_by, decided_at,
  comments jsonb, sort, created_by, created_at, updated_at`.
- **Routes:**
  - `GET /api/portal/roadmap`.
  - `POST /api/portal/roadmap/:id/decision` (owner role only: approve or decline, with a note).
  - `POST /api/portal/roadmap/:id/comments`.
  - Admin CRUD under `/api/portal/admin/companies/:id/roadmap`.
- **UI:** quarter swimlanes or a list grouped by status; budget totals computed from rows (replaces
  `budgetSummary`). No benefit percentages unless DE typed them.
- **Hub:** decision D1. If the Hub owns roadmaps, this slice becomes a projection read plus a decision write-back through DE-Sync.

### Slice C: Business Reviews / QBR (M, free; after B)
Fields: meeting date, summary, decisions, linked roadmap items, attached PDF.

- **Table** `portal_business_reviews`: `id, client_id, period ('2026-Q3'), meeting_at, status
  ('scheduled'|'held'|'published'), summary, decisions jsonb, recommendations jsonb,
  roadmap_item_ids text[], file_id NULL (tenant file storage), published_at, created_by, …`.
- **Routes:**
  - `GET /api/portal/business-reviews[/:id]` (clients see published only).
  - Admin CRUD + publish under `/api/portal/admin/companies/:id/business-reviews`.
- **PDF:** use the existing tenant file storage (`/api/portal/admin/companies/:id/files`); store the file id.
- **UI:** list of reviews; detail with summary, decisions, linked roadmap items (deep links into B)
  and the PDF download. Delete `SECURITY_SCORE` and the vulnerability tables unless D3 says to keep a security section.
- The existing `survey-qbr` survey (`server/portalSurveyStore.ts`) can be linked as "rate this review".

### Slice D: IT plan hub goes live (S; after B and C)
- Replace `itPlan: false` in `server/routes.ts` with "this company has at least one roadmap item or
  published review" (two cheap `count` queries via the stores).
- `portalNav.ts`: drop `rule.sample`, `featureReady: true`, keep `roles: ["owner"]` and `requiresData: "itPlan"`.

### Slice E: DE Questionnaires (M, free)
Goal (`lane-c-planning.md`): DE assigns a questionnaire to a client with a due date; the client saves a
draft and submits; open ones show as tasks on Home; DE sees status across clients (calendar).

- **Build on Surveys**, don't make a second form engine: `portalSurveys` / `portalSurveyResponses`
  (`shared/schema.ts`) and `server/portalSurveyStore.ts`.
- **New table** `portal_questionnaire_assignments`: `id, client_id, survey_id, assigned_to_user_id NULL,
  due_at, status ('assigned'|'draft'|'submitted'|'reviewed'), response_id NULL, assigned_by, …`.
  Migration 002x. Also move the survey tables' `CREATE TABLE IF NOT EXISTS` into a migration (pay down the rule break).
- **Routes:**
  - Replace the stub `GET /api/portal/questionnaires/events` with real assignments.
  - `POST /api/portal/questionnaires/:id/draft` and `POST .../submit`.
  - Admin `POST /api/portal/admin/questionnaires/assign`.
- **UI:** the calendar reads assignments (replaces `mockEvents`); client view = "your questionnaires" list
  with draft/submit; Home task card.
- **Nav:** a client-facing entry needs D2.

### Slice F: VPN, Phone, Shipping go live (S each, mostly configuration)
The code is built; these are switches plus small gaps.

- **VPN:**
  1. Set `PORTAL_VPN_PROVIDER=manual` in production. DE enters devices per company (CSV import exists) and the badge clears.
  2. Then pick a vendor (D5). Tailscale or Twingate need a key + `PORTAL_VPN_CLIENT_MAP`; Timus needs API access (`docs/vendor-requests/TIMUS-API-REQUEST.md`, not sent).
- **Phone:**
  - `PORTAL_PHONE_PROVIDER=cytracom` + `PORTAL_PHONE_CYTRACOM_TOKEN_<CLIENT>` + `PORTAL_PHONE_CLIENT_MAP`.
  - Extensions only. Delete the sample call history and the fake stat tiles from the live view.
  - Call history needs Cytracom Insights (not built; `server/integrations/phone/README.md`). Voicemail is not in their API.
- **Shipping:**
  - `PORTAL_SHIPPING_PROVIDER=manual` now.
  - New work: link a shipment to an order so tracking shows inside "Order equipment" (`lane-d-status-shipping.md`). The menu item stays DE-only.
- **Tests:** existing `server/integrations/{vpn,phone,shipping}/*.test.ts`. Add a test per gap you close.
- **Each switch is a production env change:** it goes in a PR note and Joe applies it, or approves applying it.

### Slice G: Manage Agents (M; needs the agent release)
Goal (`docs/plans/opencode/lane-e-integrations.md`): show the latest published DE Windows Agent from its
release `manifest.json` (version, file, sha256, size_bytes, signer, built_at); honest empty state when none.

- **Remove the fake list first:** `sampleAgents`, the fake URL and the `alert()` CRUD go in the first commit.
  Until the release source exists the page shows the empty state, which is already better than fake data.
- **Storage:** the unused `desktopAgents` table (`shared/schema.ts`) or a `releases` read from the
  agent's GitHub release (decision D6).
- **Client page:** `PortalAgent.tsx` reads the same release data instead of its hardcoded `agents` array.
- **Routes:**
  - `GET /api/portal/admin/agents` (releases + which clients have which version).
  - `GET /api/portal/agent/download`. `PortalAgent.tsx` already calls it, but no server route exists: that is a live 404 today and should be fixed even before the rest.
  - Verify the signer and sha256 before serving.

### Slice H: Data Import (L; after D7)
- **What to build:** pull companies and contacts from Zoho CRM / Zoho Desk and users from JumpCloud into the portal directory,
  with a dry-run preview, field mapping, and a run log.
- **Tables exist and are unused:** `externalIntegrationMappings`, `integrationSyncLogs` (`shared/schema.ts`).
- **Zoho:** only through `server/zoho/oauth` (`docs/ZOHO-OAUTH-INVENTORY.md`). Never mint tokens.
  JumpCloud: `server/integrations/jumpcloud.ts`. Seamless.ai has no client and needs credentials (paid).
- **Small alternative:** if D7 says not now, the page is already honest ("unavailable"). Drop the badge, mark it
  `featureReady: true` with the honest copy, and track the importer separately.

---

## 4. Order of work

| Phase | Slices | Why first |
|---|---|---|
| 1 (free, no outside parties) | F-switches (VPN manual, shipping manual), G step 1 (remove fake agents + fix the download 404), A (System Status) | Fastest real value; removes fake data clients could see |
| 2 | B (Roadmap), C (QBR), D (IT plan hub) | One connected feature: the owner-facing IT plan |
| 3 | E (Questionnaires) | Builds on Surveys; needs the Home task card |
| 4 (outside dependencies) | F vendor modes, G release source, H importer, Phone call history | Each waits on keys, vendor API access or a published agent |

One slice = one branch = one PR = one ledger row. Slices in the same phase can run in parallel if
their file lists don't overlap. Every slice touches `server/routes.ts` (one registration line) and `portalNav.ts` (one item), so expect small conflicts there and merge `main` before pushing.

---

## 5. Decisions Joe needs to make (blocking marked ⛔)

| ID | Question | Blocks | Suggested default |
|---|---|---|---|
| D1 ⛔ | Do roadmaps, reviews and status notices live in the **portal** (owned here) or the **Hub** (portal shows a projection)? | A, B, C | Portal owns them now, synced to the Hub through DE-Sync like service requests |
| D2 | Should clients see System Status and Questionnaires (today `deOnly`)? | A, E | Yes, both are client-facing by design |
| D3 | Keep a security-score section in QBRs? If yes, where does the number come from? | C | Drop it until a real source exists |
| D4 | Which RMM (if any) feeds device health and uptime? | A follow-up | Later |
| D5 | VPN vendor: Timus (needs the API request sent), Tailscale, Twingate, or manual only? | F | Manual now |
| D6 | Where are DE Windows Agent releases published (GitHub release with `manifest.json`)? | G | GitHub release on the agent repo |
| D7 | Is the Zoho/JumpCloud importer wanted now, and is Seamless.ai (paid) in scope? | H | Not now; drop the badge with honest copy |

Paid items (need cost stated and Joe's go-ahead per CLAUDE.md before any call):
Seamless.ai, any VPN or shipping vendor plan, Cytracom Insights if it is an add-on.

---

## 6. Picking up a slice
1. Read `AGENTS.md`, `docs/AI-ENGINEERING-GOVERNANCE.md`, `.ai/ACTIVE_WORK.yaml`.
2. Add your row to `.ai/ACTIVE_WORK.yaml` with the exact files you will touch, before coding.
3. Branch from current `origin/main`; one slice per branch.
4. Follow section 2, meet section 2.7, and update this file's table in section 1 (mark the row **done** with the PR link).
5. Hand-off block at the end of your session (`C:\Users\Joe\DE\Governance\AI-HANDOFF-STANDARD.md`).

## 7. Progress log

| Date | Slice | PR | State |
|---|---|---|---|
| 2026-10-23 | (prep) Inline company picker for DE admins on request pages | digeratiexperts/digeratiexperts-site#703 | in review |
