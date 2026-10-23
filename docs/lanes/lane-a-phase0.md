# Lane A — Phase 0 report (Client Portal: roles, client navigation, file delivery)

Status: **complete, no architecture fork found — proceeding with Steps 2–5.**
Written by: opencode Lane A, 2026-10-22, against `origin/main` `398f4d6f`.
Scope note: `docs/plans/opencode/lane-a-update-1.md` (from Claude) overrides the lane file where
they differ; this report is written to inform the *extend, don't rebuild* direction it sets.

Answers the six Phase 0 questions in `docs/plans/opencode/DE-portal-client-nav-prompt.md`, plus the
required "what each sample screen currently does" detail.

---

## 1. Map the nav

Registry: `client/src/components/portal/shell/portalNav.ts` (`PORTAL_NAV_GROUPS`, `PORTAL_ADMIN_GROUP`,
`navGroupsFor(user, integrations)`, `findNavItem(location)`). Every portal page renders its own
`<PortalLayout>` (`client/src/pages/portal/PortalLayout.tsx`), which builds the sidebar from
`navGroupsFor()`. Visibility today = `navAllowed(user, key)` in `client/src/lib/portalRoles.ts`
(staff-minimal vs IT-contact-expanded, org-role driven) + integration mode
(`server/portalIntegrations.ts`: `hidden` drops the item, `live` clears `sample`) + `user.role === "admin"`
appends the DE Admin group.

| Section | Item (label) | Route | Key | Current visibility rule | Sample |
|---|---|---|---|---|---|
| Support | Dashboard | /portal/dashboard | dashboard | staff+ | — |
| Support | Self-Service | /portal/self-service | requests | staff+ | — |
| Support | Support Tickets | /portal/tickets | tickets | staff+ | — |
| Support | Request Forms | /portal/forms | forms | staff+ | — |
| Support | Service Requests | /portal/requests | requests | staff+ | — |
| Support | Licenses | /portal/licensing | requests | staff+ | — |
| Support | Infrastructure Issues | /portal/infrastructure | infrastructure | staff+ (all client roles see it today) | — |
| Support | Chats / DE Desk | /portal/chat | chat | dept/company IT contacts only (nav key `chat`; `canChat()` capability) | — |
| Support | Approvals | /portal/approvals | approvals | manager / IT contacts (org-capability `approvals`) | — |
| Support | Knowledge Base | /portal/kb | kb | staff+ | — |
| Account | Company | /portal/company | company | IT contacts only | — |
| Account | People & Org | /portal/people | people | IT contacts only | — |
| Account | Structure & IDs | /portal/organization | requests | staff+ (all client roles) | — |
| Account | My Groups | /portal/representation | requests | staff+ | — |
| Account | Contracts | /portal/contracts | contracts | staff+ | — |
| Account | Files & Downloads | /portal/files | files | IT contacts only | — |
| Account | Billing | /portal/billing | billing | IT contacts only | — |
| Account | Invoices | /portal/invoices | billing | IT contacts only | — |
| Account | My Services | /portal/services | services | IT contacts only | — |
| Account | Orders | /portal/orders | other | IT contacts only (exact) | — |
| Account | New Order | /portal/order-form | other | IT contacts only | — |
| Programs | DE Questionnaires | /portal/questionnaires | other | IT contacts only | **yes** |
| Programs | Surveys | /portal/surveys | surveys | IT contacts only | — |
| Programs | IT Roadmap | /portal/roadmap | other | IT contacts only | **yes** |
| Programs | Business Reviews | /portal/qbr | other | IT contacts only | **yes** |
| Programs | Learning | /portal/learning | learning | IT contacts only | — |
| Programs | System Status | /portal/status | other | IT contacts only | **yes** |
| Tools | VPN Access | /portal/vpn | other | IT contacts + `integration: vpn` | **yes** (sample mode default) |
| Tools | Cytracom Phone | /portal/cytracom | other | IT contacts + `integration: phone` | **yes** (sample mode default) |
| Tools | Ship Center | /portal/ship-center | other | IT contacts + `integration: shipping` | **yes** (sample mode default) |
| Tools | Client Marketplace | /portal/marketplace | other | IT contacts only | — |
| Tools | Procurement Store | /portal/procurement | other | IT contacts only | — |
| Tools | Desktop Agent | /portal/agent | other | IT contacts only | (unflagged placeholder) |
| Tools | Settings | /portal/settings | settings | staff+ | — |
| DE Admin | Digital Warehouse | /internal/warehouse | other | role=admin | — |
| DE Admin | Companies | /portal/admin/companies | other | role=admin | — |
| DE Admin | License Patch Bay | /portal/admin/license-board | other | role=admin | — |
| DE Admin | Login Alerts | /portal/admin/login-knocks | other | role=admin | — |
| DE Admin | Onboard / Offboard | /portal/admin/lifecycle | other | role=admin | — |
| DE Admin | Contracts | /portal/admin/contracts | other | role=admin | — |
| DE Admin | Data Sources | /portal/admin/data-sources | other | role=admin | — |
| DE Admin | Data Import | /portal/admin/import | other | role=admin | **yes** |
| DE Admin | Manage Agents | /portal/admin/agents | other | role=admin | **yes** |
| DE Admin | OpenAI Billing | /portal/admin/openai | other | role=admin | — |
| DE Admin | Knowledge Authoring | /portal/admin/kb | other | role=admin | — |
| DE Admin | Order Change Requests | /portal/admin/order-requests | other | role=admin | — |
| DE Admin | Sales Process | /portal/sales-process | other | role=admin | — |

What each account sees **today**: a `role=viewer/user` with org role `staff` gets the 9 "staff keys"
(dashboard, tickets, forms, requests, infrastructure, contracts, kb, learning, settings); `manager`
adds Approvals; `dept_it_contact`/`company_it_contact` get everything in the four client groups;
`role=admin` gets everything plus DE Admin. There is no per-client-hat role, no entitlement gating
and no `hasData` gating anywhere.

## 2. Map the roles

Three independent role columns on `portal_users` (`shared/schema.ts:488-515`):

| Column | Enum | Used for |
|---|---|---|
| `role` | `portal_user_role` = `admin｜user｜viewer` (`shared/schema.ts:13`) | portal RBAC; `requireAdmin` = `role === 'admin'` (`server/routes.ts:458-466`) |
| `storeRole` | `store_role` = `public｜prospect｜managed｜comanaged｜admin` | Store RBAC (`requireRole`, `server/routes.ts:444-455`) |
| `orgRole` | `portal_org_role` = `staff｜manager｜dept_it_contact｜company_it_contact` + `department_id`, `manager_user_id`, `is_company_it_contact` | org hierarchy, approvals, and the client nav surface via `resolveOrgRole()` / `navAllowed()` |

Authorization today: `authMiddleware` (`server/routes.ts:316-437`) verifies the JWT but re-reads the
live user record every request and treats the **live record** as authoritative for role, storeRole,
clientId and orgRole. `requireAdmin` / `requireRole` are the only gate middleware. Impersonation
("View as", `POST /api/portal/admin/impersonate`) is honored **only** when the live role is `admin`
(`server/routes.ts:400-405`), and `effectiveClientId` (admin → `impersonatingCompanyId`, else
`clientId`) is duplicated in three server files (`server/portalIntegrations.ts:71`,
`server/serviceRequestRoutes.ts:116`, `server/portalCompanyProfile.ts:9`).

**There is no break-glass class, no DE staff class and no client-hat role model today.** "Administrator"
= `role=admin` = the account the plan calls break-glass. MFA exists (`mfa_enabled`, `mfa_method`,
TOTP + passkeys + backup codes; `/api/portal/mfa/*`, `server/portalMfaCrypto.ts`) but is **optional
per account** — a password-only admin login is possible today. Logins and MFA events are recorded as
"door knocks" (`server/portalLoginKnocksStore.ts`, `logSecurityEvent` at `server/routes.ts:604-623`)
but **no login alert email is sent** and there is **no general action audit log** (only the client
vault's own audit table, `server/portalClientVault.ts`).

## 3. Find the sample data

Sample badge machinery: `PortalNavItem.sample` (`portalNav.ts:51-56`), rendered as a warn `Token`
in `PortalLayout.tsx:197-199` and in the command palette. `navGroupsFor()` only clears `sample`
when an integration area is `live`; nothing stops a client user from seeing a sample item.

| Screen | Route | What it actually does |
|---|---|---|
| DE Questionnaires | /portal/questionnaires | `PortalQuestionnaireCalendar.tsx` — fully interactive fake calendar over a hardcoded `mockEvents` array (lines 44-108), "Sample preview." callout. No API. |
| IT Roadmap | /portal/roadmap | `PortalRoadmap.tsx` — fake vCIO items + budget totals (lines 38-144), fabricated impact claims ("Reduces breach risk by 85%"), "Sample preview." callout. No API. |
| Business Reviews | /portal/qbr | `PortalQBR.tsx` — fake reports, ticket/security/infrastructure metrics, security score 88 (lines 18-130). No API. |
| System Status | /portal/status | `PortalStatus.tsx` — fake services/uptimes/incidents (lines 21-112); only real data is `shared/responseTargets` SLA copy. |
| VPN Access | /portal/vpn | `PortalVPN.tsx` — sample mode (default: `PORTAL_VPN_PROVIDER` unset) shows fake devices and dead buttons; `live` mode is real (`GET /api/portal/vpn`), `hidden` drops the item. |
| Cytracom Phone | /portal/cytracom | `PortalCytracom.tsx` — sample mode shows fake call history/extension and dead buttons; live mode is real (`GET /api/portal/phone`). |
| Ship Center | /portal/ship-center | `PortalShipCenter.tsx` — sample mode shows fake shipments; live mode is real (`GET /api/portal/shipping`). |
| Data Import (admin) | /portal/admin/import | `AdminImport.tsx` — honest static capability list, disabled buttons, no simulation. Badge arguably stale. |
| Manage Agents (admin) | /portal/admin/agents | `AdminAgents.tsx` — fake agent CRUD over a hardcoded array **with fake vendor download URLs** and alert()-only persistence. Worst offender; no on-page disclosure. |
| Desktop Agent (unflagged) | /portal/agent | `PortalAgent.tsx` — static catalog, 3 of 4 downloads are `#`, download button just alerts. |

No feature flag *enables* sample data: sample is the default for the three integration areas
(`PORTAL_VPN_PROVIDER`, `PORTAL_PHONE_PROVIDER`, `PORTAL_SHIPPING_PROVIDER` unset ⇒ sample;
`hidden` ⇒ drop; a provider id ⇒ live). The four always-sample Programs screens have no flag at all.

## 4. Check data sources

- **Role data:** portal DB only — `portal_users.role / store_role / org_role` (above). Nothing comes
  from Zoho for roles.
- **Company/tenant:** `portal_clients` (`shared/schema.ts:197-218`) — `company_name`, `contact_email`,
  `status`, `service_type` (`managed｜comanaged｜prospect`), `hub_account_id`, `account_manager`.
- **Entitlements:** **no service-entitlement source exists yet.** Four partial, unrelated things:
  `portal_clients.service_type` (drives store eligibility), licence policy per company
  (`client_license_policies.policy`, `shared/licensing.ts`), the Hub marketplace scope contract
  (`shared/marketplaceScope.ts`, fails closed, `hubCatalog: "not_attempted"`), and the Hub sync
  contract's *declared but unhandled* `service_entitlement.*` events
  (`server/integrations/deSyncContract.ts:45-47`). No Zoho CRM field feeds entitlements
  (`server/zoho/*` has none).
- **Consequence for Phase 2:** the "by purchased service" menu (Secure access / Business phone /
  Security training) cannot honestly read from Zoho today. Lane A introduces a portal-DB entitlement
  record per company (additive, default **off** = hidden) that DE staff set, with the Hub sync event
  as the later automated source. Nothing is shown until an entitlement record says so.

## 5. Check file storage

Files & Downloads = metadata in `portal_tenant_files` (`migrations/0004`, `shared/schema.ts:1288-1305`)
+ bytes in Google Cloud Storage via presigned PUT (`server/replit_integrations/object_storage/`).
Upload/list/delete routes are `[auth, requireAdmin]` (`server/portalTenantFileRoutes.ts`); clients are
download-only via `GET /api/portal/my-files`. **Tenant isolation is solid** (scoped queries, ownership
check on `/objects/*`, tests in `server/storage.tenantFiles.test.ts`). Gaps for Lane B: no upload size
limit, no MIME/extension allowlist, no magic-byte check, **no malware scanning at all**, and
`file_size`/`mime_type` columns are never written. (`tools/signcheck` is now landed for Lane B.)

## 6. Check DE as a tenant

"Digerati Experts" exists **as a runtime record, not in any migration**: `server/portalAuthStore.ts:630-659`
(`INTERNAL_MSP_ID = "msp-digerati"`, `ensureInternalMspClient()` at startup) creates
`{ id: "msp-digerati", companyName: "Digerati Experts", type: "msp", serviceType: "managed" }`, and
`shared/portalTicketOrg.ts` recognizes it as the internal org. Lane A adds an additive migration that
makes the record durable and normal (same id), so the DE staff "member of the Digerati Experts company"
hat works without special-case code paths. The company switcher = admin impersonation
(`TenantSelector.tsx` → `/api/portal/admin/impersonate`), currently admin-only.

---

## Findings that shape the build (decisions logged in `docs/lanes/lane-a-roles-nav.md`)

1. **No fork found.** Every Phase 0 question has a concrete answer; the plan + update 1 settle the
   design. Proceeding.
2. `authMiddleware` already re-reads the live record per request — the new role values can be added
   to the live record and take effect without touching token claims. Good for additive migration.
3. `effectiveClientId` exists in three server files. The `can()` helper will take `companyId`
   explicitly so route code passes one scope value; consolidating the three copies is out of scope.
4. `AdminAgents.tsx` (fake vendor URLs, alert() CRUD) and `PortalAgent.tsx` (dead downloads) are
   truth-rule problems inside my sample-rule work: they get the same "hidden from client roles until
   built" treatment (Lane D/E own their rebuild).
5. Break-glass MFA enforcement: `PORTAL_QA_EMAIL`/`PORTAL_QA_PASSWORD` QA logins and existing admin
   sessions must keep working; enforcement is a forced second factor at login for `role=admin`
   (email challenge when nothing is enrolled), plus a login alert email and an audit flag on admin
   actions. No auth *methods* change (DO NOT CHANGE respected).
