---
name: DE Account Lifecycle Status — Source of Truth (mirror)
description: Mirror of the canonical DE Account Lifecycle Status model. Internal classification — governed everywhere, never client-facing.
status: mirror
version: 1.1
effective_date: 2026-09-09
authority: digeratiexperts/Intelligence-Hub .agents/memory/account-lifecycle-status-source-of-truth.md
classification: internal
---

> **MIRROR.** The **canonical section** below is **byte-identical** to the authority:
> [`digeratiexperts/Intelligence-Hub`](https://github.com/digeratiexperts/Intelligence-Hub) →
> `.agents/memory/account-lifecycle-status-source-of-truth.md`.
> A **repo-local application section is permitted after the canonical section** — here,
> **"Application in this repository"** — and is the only repo-local content in this file.
> Do not edit the vocabulary, semantics, or disclosure boundary here. Change the authority
> first, then propagate to this repository in the same change set.


# DE Account Lifecycle Status — Source of Truth

**Status:** Canonical  
**Version:** 1.1  
**Effective:** 2026-09-09  
**Classification:** Internal — governed everywhere, displayed nowhere client-facing (see [Disclosure boundary](#disclosure-boundary--internal-only))  
**Scope:** Digerati Experts account/client relationship lifecycle across TechSales, Zoho, Sales OS, portals, reporting, automations, integrations, and future systems.

This file is the authoritative definition of the DE **Account Lifecycle Status** field.

**Authority and mirrors.** This file, in `digeratiexperts/Intelligence-Hub`, is the single authority. Mirrors are maintained at `docs/ACCOUNT-LIFECYCLE-STATUS.md` in `digeratiexperts-site`, `de-platform`, and `vulnerability-management`. In each mirror the **canonical section is byte-identical** to this file; a **repo-local application section is permitted after the canonical section** and is the only repo-local content. A mirror may not alter the vocabulary, the semantics, or the disclosure boundary. Change this file first, then propagate.

**v1.1 change:** adds the internal-only disclosure boundary. The 13 values and their definitions are unchanged from v1.0.

> **Supersedes:** the previous account lifecycle taxonomy `Suspect → Prospect → Lead → Opportunity → Client` as a business-status model. `Lead`, `Opportunity`, `Qualified`, `Proposal Sent`, `Negotiation`, `Closed Won`, and similar terms remain valid **sales/deal pipeline concepts**, but they are **not Account Lifecycle Status values**.

## Canonical field

- **Label:** `Account Lifecycle Status`
- **Type:** single-select / enumerated value
- **Cardinality:** exactly one lifecycle status per account at a time
- **Authority:** this document defines the allowed vocabulary and semantics
- **Rule:** downstream systems may project, label, filter, report, or automate from this field, but may not silently redefine it

## Canonical values

The following 13 values are the complete approved vocabulary, in canonical order.

| # | Status | Canonical definition |
|---:|---|---|
| 1 | **Suspect** | An organization appears potentially relevant to DE or plausibly fits the ICP, but DE has not established that a real opportunity exists. Research, list membership, enrichment, or apparent fit alone can support Suspect status. |
| 2 | **Prospect** | There is enough evidence of fit, need, interest, engagement, access, timing, or opportunity to justify active sales pursuit. A Prospect is materially more qualified for pursuit than a Suspect. |
| 3 | **Tentative** | The organization has indicated meaningful intent to move forward, but the commercial or client relationship is not yet finalized. |
| 4 | **Pending** | The relationship is effectively approved or expected to begin, but activation is waiting on a required dependency such as signature, payment, assessment, scheduling, provisioning, or another start condition. |
| 5 | **Onboarding** | The organization is an official client and implementation, discovery, migration, remediation, stabilization, or initial service activation is underway. |
| 6 | **Active** | The client relationship is operational and the client is receiving normal active services. |
| 7 | **Paused** | The relationship or service delivery is temporarily suspended with an expectation that it may resume. |
| 8 | **At Risk** | The client remains active, but a material retention, payment, satisfaction, service, operational, contractual, or relationship risk exists that requires attention. |
| 9 | **Offboarding** | The relationship has been decided to end and DE is actively transitioning, deprovisioning, documenting, transferring, or closing services. |
| 10 | **Inactive** | The organization remains a valid account but is not currently receiving active services; the relationship is dormant or otherwise non-active without being classified as a completed former-client relationship. |
| 11 | **Former** | A prior client relationship has ended and is retained as historical account context. |
| 12 | **Disqualified** | DE evaluated the organization and determined that it is not a viable account/opportunity for current pursuit or client conversion. |
| 13 | **Do Not Engage** | DE has intentionally decided not to pursue, solicit, reactivate, or conduct business with the organization unless an authorized decision explicitly changes that restriction. |

## Suspect and Prospect are not the same

This distinction is mandatory.

### Suspect
A **Suspect** answers:

> “Does this organization look like someone DE may want to pursue?”

A Suspect can exist because of ICP fit, research, enrichment, a target list, referral intelligence, territory, company profile, or another preliminary signal. A Suspect does **not** require an established opportunity.

### Prospect
A **Prospect** answers:

> “Do we have enough evidence to justify actively pursuing this organization?”

Promotion from Suspect to Prospect requires more than mere existence on a list. The evidence can include fit, a recognizable need, interest, engagement, access to a relevant person, timing, a trigger event, or another credible opportunity signal.

**Governance rule:** imported, scraped, enriched, or researched companies must not automatically inflate the Prospect population merely because they were discovered.

## Disclosure boundary — internal only

`Account Lifecycle Status` is **internal DE business classification**. It is governed everywhere and displayed nowhere a client or the public can see it. This boundary is mandatory and applies to every repository, service, and integration in the DE ecosystem.

### Never exposed

Lifecycle values, their internal codes, their ordering/rank, or derived synonyms must not appear on:

- **the public website** (`digeratiexperts.com`) — marketing pages, Store, pricing, solution builders, lead/quote forms, confirmation and thank-you pages, rendered HTML source, meta tags, structured data, or any unauthenticated JSON/API response;
- **client-visible Client Portal** (`portal.digeratiexperts.com`) surfaces — dashboards, chips, badges, status strips, account/profile screens, tooltips, empty states, filters, sorting, or navigation labels;
- **client-delivered artifacts** — quotes, proposals, agreements, invoices, statements, onboarding packets, assessments, posture/vulnerability reports, exports, or scheduled email;
- **client-scoped API responses, webhooks, or event payloads** reachable by a portal user's session.

The high-sensitivity values are absolute. **`Suspect`, `At Risk`, `Inactive`, `Former`, `Disqualified`, and `Do Not Engage`** must never reach a client or the public in any wording, abbreviation, colour code, icon, sort position, or inferable proxy.

### Always enforced

The same field remains fully authoritative behind the boundary:

- storage, transitions, and validation follow this document exactly;
- portal **server-side** authorization, entitlement, feature gating, and tenant joins may read it;
- internal/admin/DE-staff UI, Hub, reporting, forecasting, automations, and integrations use it as the lifecycle authority;
- audit trails and history retain real values.

"Not client-facing" restricts **disclosure**, never **enforcement**. A backend that stops honouring the lifecycle model because it cannot show it is a defect.

### Approved presentation instead of the raw value

A client-facing surface that must communicate something about the relationship renders an **approved presentation label** produced by an explicit mapping layer — never the lifecycle value, and never a one-to-one relabel that leaks the same distinctions. Absent an approved mapping entry, show nothing.

### Rules for implementers

1. Treat lifecycle as internal-classification data **at the serialization boundary**: omit by default and opt in for internal consumers, rather than returning it and hiding it in the UI.
2. Hiding a value with CSS, `display:none`, a feature flag, or client-side filtering is **not** compliance — the value must not be in the payload the client receives.
3. Do not leak the value indirectly: no lifecycle-derived ordering, counts, colours, badge presence/absence, or error text that lets a client infer their classification.
4. Log and telemetry sent to third parties follow the same rule as client surfaces.
5. Leaking a lifecycle value to a client or the public is a **P0 defect**, not a cosmetic issue.

## Primary lifecycle progression

The normal relationship progression is:

`Suspect → Prospect → Tentative → Pending → Onboarding → Active → Offboarding → Former`

This is the primary path, **not an exhaustive state machine**. Legitimate side-state transitions include, for example:

- `Active ↔ Paused`
- `Active → At Risk → Active`
- `At Risk → Offboarding`
- `Inactive → Active` when a dormant relationship is reactivated
- pre-client states → `Disqualified`
- an appropriate account state → `Do Not Engage` when DE intentionally blocks pursuit or business

Automations must use explicit business rules and evidence. They must not infer a transition merely because a numeric rank is higher.

## What does not belong in Account Lifecycle Status

The lifecycle field describes **DE's relationship with the organization**. The following concepts belong in separate fields/models and must not be substituted into this field:

### Sales/deal pipeline
Examples: `Lead`, `Opportunity`, `Qualified`, `Discovery`, `Assessment`, `Proposal Sent`, `Negotiation`, `Verbal Yes`, `Closed Won`, `Closed Lost`.

### Service/commercial model
Examples: ProActive tier, Standalone, Co-Managed, Marketplace-only, package, bundle, service family, contract type.

### Billing/finance
Examples: trial, current, overdue, delinquent, suspended-for-nonpayment, payment method, credit state.

### Delivery/implementation
Examples: assessment complete, migration scheduled, stabilization complete, project phase, deployment status.

### Support/operations
Examples: ticket state, incident severity, escalation state, SLA state.

### Health/risk metadata
Examples: health score, satisfaction, churn probability, security risk score, payment risk, technical debt.

These dimensions may influence an Account Lifecycle Status transition, but they do not replace the lifecycle value itself.

## Decision test

When choosing a lifecycle value, ask:

1. **Are we only aware of or researching this organization?** → `Suspect`
2. **Is there enough evidence to actively pursue it?** → `Prospect`
3. **Have they indicated meaningful intent to proceed without final commitment?** → `Tentative`
4. **Is the relationship effectively approved but waiting on a start dependency?** → `Pending`
5. **Are they officially a client and being implemented/stabilized?** → `Onboarding`
6. **Are normal services operating?** → `Active`
7. **Is service temporarily suspended with expected resumption?** → `Paused`
8. **Are they still active but materially endangered?** → `At Risk`
9. **Has termination been decided and transition-out work begun?** → `Offboarding`
10. **Is the account valid but currently dormant/non-active?** → `Inactive`
11. **Did a prior client relationship end and remain historical?** → `Former`
12. **Was the organization evaluated and rejected for pursuit?** → `Disqualified`
13. **Has DE intentionally prohibited pursuit or business?** → `Do Not Engage`

## TechSales implementation governance

- Account lifecycle and deal pipeline are separate domains even when both appear on the same client/account UI.
- Deal-stage chips may continue to display deal/pipeline state; they must not be treated as the account lifecycle authority.
- Code, database enums, `POSITIVE_RANK`, `floorLifecycle`, boot migrations, API labels, and UI strips that still encode the superseded July 2026 lifecycle taxonomy are **legacy implementation surfaces that require migration** to this v1.1 model.
- Until that migration is complete, do not add new code that depends on the superseded `Lead → Opportunity → Client` account-lifecycle ordering.
- Existing one-account-per-organization, exact merge-key, race-safe-create, Zoho ID separation, quote-linking, and demo-clear integrity rules remain valid unless separately superseded.

## Change control

This document is the vocabulary authority. Any proposal to add, remove, rename, reorder, or materially redefine an Account Lifecycle Status must follow this sequence:

1. Update and approve this Source of Truth first.
2. Propagate the change to the `digeratiexperts-site`, `de-platform`, and `vulnerability-management` mirrors in the same change set.
3. Update the TechSales canonical model and tests.
4. Update database enum/storage rules and migrations where required.
5. Update Zoho/CRM picklists and mappings.
6. Update APIs, internal UI labels, filters, automations, reporting, and integrations.
7. Re-verify the disclosure boundary: confirm no public or client-facing surface serializes or renders the new/changed value.
8. Validate existing records and migrate legacy values explicitly.
9. Verify production behavior before calling the change complete.

No downstream implementation is permitted to create a competing lifecycle taxonomy by convenience, historical convention, or local UI terminology.

## Canonical order

`Suspect, Prospect, Tentative, Pending, Onboarding, Active, Paused, At Risk, Offboarding, Inactive, Former, Disqualified, Do Not Engage`

---

## Application in this repository

`digeratiexperts-site` owns the public website, the Store, the public portal entry surfaces, the Client Portal UI, and the Express server behind them. It therefore sits directly on the disclosure boundary and carries the highest leak risk in the ecosystem.

### Public website — never

`digeratiexperts.com` is fully unauthenticated. No lifecycle value, code, rank, or derived synonym may appear in marketing pages, the Store, pricing, solution builders, lead/quote wizards, confirmation or thank-you pages, rendered HTML, meta tags, structured data, or any public JSON response.

Lead, quote, and register ingest may legitimately cause an account to be created or advanced in the Hub (typically `Suspect` or `Prospect`). The classification must never be echoed back to the visitor in a response body, confirmation copy, redirect parameter, analytics event, or error message.

### Client Portal — server-side only

`portal.digeratiexperts.com` is authenticated but **client-visible**. Lifecycle may be read by portal server code for authorization, entitlement, feature gating, and tenant joins. It must not cross into `client/src/**` — not as a prop, query-key payload, cached response, or debug field. Omit it when serializing client-scoped responses rather than filtering it in the browser.

Internal/DE-staff admin screens behind `requireAdmin` are internal surfaces and may display it.

### Naming collision — two different "lifecycles"

`/portal/admin/lifecycle`, `client/src/pages/portal/AdminLifecycle.tsx`, `server/lifecycleOrchestrator.ts`, and the `/api/portal/admin/lifecycle/*` routes are the **JumpCloud + Blackpoint employee identity lifecycle** — onboarding and offboarding a client's own staff accounts. That is a different domain from **Account Lifecycle Status**, which describes DE's relationship with the client organization.

Do not merge, rename into, cross-wire, or infer one from the other. An employee offboarding run says nothing about the account's lifecycle status.

### Legacy implementation surface — migration target

`server/integrations/tenantIdentity.ts` still encodes the **superseded** taxonomy:

- `HUB_LIFECYCLES` = `suspect, prospect, lead, qualified_opportunity, client_pending_activation, active_client, former_client, disqualified, closed_lost`
- `mapHubLifecycleToMaturity()` maps from those legacy values.

These are legacy surfaces requiring migration to the canonical 13-value model. They are **not** authority to redefine the vocabulary. Until migrated, do not add new code that depends on the superseded ordering.

`MATURITY_STAGES` and `mapPortalMaturity()` produce a portal-side derived stage. Derived or not, it inherits this document's disclosure boundary: `prospect`, `former`, and `closed` must not surface to a client. If any maturity signal is ever shown client-side, it must go through an approved presentation mapping.

### Automated enforcement

The boundary is enforced by tests, not only by review. `server/integrations/tenantIdentity.ts` exports:

- `ACCOUNT_LIFECYCLE_STATUSES` — the canonical 13 values;
- `findLifecycleDisclosures(payload)` — walks a client-bound payload and returns every disclosure, by path;
- `assertNoLifecycleDisclosure(payload, label)` — throws on any disclosure.

Detection is deliberately asymmetric. A **lifecycle-named key** (`lifecycle`, `lifecycleStatus`, `accountLifecycleStatus`, `hubLifecycle`, in any casing or separator style) is always a violation — naming a field that way and putting anything in it discloses the classification. A **value** match only fires on unambiguous terms, so a portal user's `status: "active"`, a request's `state: "pending"`, and the existing client-visible `storeRole: "prospect"` do not trip it.

`server/integrations/lifecycleDisclosure.test.ts` feeds each client-bound serializer a source record deliberately polluted with lifecycle fields — the shape a future schema addition or a Hub sync would produce — and asserts the output is clean. An allowlist serializer drops them; a serializer that starts spreading its source (`...user`) fails the test. This has been verified to fail on a deliberately leaky serializer, so it is a real guard rather than a vacuous one.

**When you add a client-scoped serializer, add it to `CLIENT_BOUND_SERIALIZERS` in that test.** The guard cannot find a serializer it has never been given.

Its limits, stated honestly: it covers serializers registered in that list, not every route handler that builds a response inline, and it cannot see values assembled only at runtime from live data. It raises the floor; it does not make a leak impossible.

### Checklist before merging a portal or website change

1. Does any response reaching an unauthenticated visitor or a portal client contain a lifecycle value? If yes, remove it from the payload.
2. Is a client-visible string derived from lifecycle? If yes, it needs an approved mapping entry; absent one, show nothing.
3. Could a client infer their classification from ordering, counts, colour, badge presence, or error text?
4. Is server-side enforcement still intact after removing the value from the payload?
