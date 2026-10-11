# Store Solution Engine

**Decision:** DE has three intentionally separate commerce surfaces. They share terminology and handoff contracts, but they do not share one giant client-side cart.

```text
Door 2 — Public Business Solution Builder
Profile + need + offer + package + fulfillment + contact
No public payment

Door 3 — Authenticated Client Marketplace
Approved client items + client pricing + real cart + checkout

Door 4 — DE Digital Warehouse
Internal commercial, sourcing, implementation, and mapping data
```

## 1. Public builder object

The public canonical object is `SolutionDraft` in `client/src/lib/solutionDraft.ts`.

It owns:

- business profile
- selected pains / needs
- standalone / co-managed relationship
- fulfillment preferences
- request intent

`client/src/lib/solutionPackage.ts` converts the approved public solution family into the package presentation shown to the prospect:

- customer-readable line items
- quantity basis from the profile
- standard vs preferred commercial position
- assessment policy
- shipping / provisioning behavior
- installation modes
- technician policy
- remote support behavior

The public object deliberately does not become a payment cart.

## 2. Authenticated commerce object

The existing Store/Marketplace Solution engine remains the durable commerce object for standardized client purchasing.

It owns:

- approved purchasable items
- quantities
- save-for-later
- client-facing prices
- quote/payment eligibility
- checkout
- post-order state

<<<<<<< Updated upstream
Money movement remains on the existing payment authority. Portal authentication remains the identity path.

## 3. Internal warehouse object

The warehouse owns internal-only information needed to assemble, source, price, approve, and implement what the public and client surfaces describe.

The warehouse is not imported into the public builder.

## Cross-layer law

### One concept, one owner

| Concept | Owner |
|---|---|
| Public business profile | `SolutionDraft.environment` |
| Public selected needs | `SolutionDraft.needs` |
| Standalone / co-managed relationship | `SolutionDraft.deliveryPreference` |
| Public package and fulfillment rules | `solutionPackage.ts` |
| Public browser persistence | `de-solution-draft-v2` |
| Public server-session save | `/api/public/solutions/request` `PUT` |
| Public final submission | `/api/public/solutions/request` `POST` |
| Authenticated purchasing | Client Marketplace commerce engine |
| Money movement | Existing payment integration |
| Internal commercial/implementation mapping | Digital Warehouse / authoritative back-office systems |

### No duplicate qualification questionnaires

Users, computers, mobile devices, sites, ownership model, and internal IT status are captured once in Step 0 and reused throughout the public builder.

Additional questions should be conditional and package-specific. Do not rebuild a second generic environment questionnaire later in the funnel.

### No public cart vocabulary

The public surface uses:

- Your Solution
- Solution Draft
- Package
- Delivery & Setup
- Submit Solution

Real cart and checkout vocabulary belongs to the authenticated purchasing surface.

### No universal assessment

Assessment behavior is a package policy:

- `required`
- `recommended`
- `not_required`

A package that does not require an assessment must not be routed through one just because another legacy service flow used that pattern.

### No false standalone semantics

Standalone means the buyer is purchasing a packaged solution without joining DE's traditional managed-services operating model. It must never be labeled "DE managed."

Co-managed means shared responsibilities and may qualify for preferred pricing when the commercial engine supports it. It is not a blanket percentage discount.

## Persistence

Public browser draft: `de-solution-draft-v2`.

Public server-session draft (`server/publicSolutionRoutes.ts`, `server/publicSolutionRequestStore.ts`, `server/publicSolutionRequestPersistence.ts`):

- 30-day httpOnly browser-session cookie `de_solution_request`. The cookie is the only session identity; a `sessionId` in a body or query is ignored.
- `GET` creates/returns the current draft record and reports `durable` (Postgres reachable right now). A session whose last record was submitted gets a fresh draft plus `previousReference`. The draft view GET and PUT return never carries contact fields or notes, whatever the record holds.
- `PUT` saves progress without contact information and without creating a lead. Contact fields and notes in a PUT body are dropped. `suggestion` (`{ value: standalone | co_managed, accepted }` or null) is stored for the lead description and kept when the field is absent; an explicit empty `deliveryPreference` is stored as empty, an absent one keeps DE's value. Each need may carry `source` (scenario) and `installation`; an installation the package's policy does not offer is replaced by the package's first choice (remote → shipped → on-site). `intent` is recomputed from policy on every write. A PUT that lands on a submitted record forks a new draft (`forked: true`, `previousReference`).
- `POST` submits after company, name, email, and phone are supplied. Order of checks: honeypot → four contact fields → at least one need, a complete profile (users, computers, mobile devices, sites, ownership, internal IT) and a relationship (`standalone`, `co_managed` or `unsure`; only an unmade choice is refused) → persist contact → submit. Every 400 carries `code` beside `error`: `CONTACT_REQUIRED` (also for a tripped honeypot, so a bot learns nothing), `NEEDS_REQUIRED`, `PROFILE_INCOMPLETE`, `RELATIONSHIP_REQUIRED`. The client's `idempotencyKey` is one attempt id per solution plus the email (a retry replays; a solution built after "Start another" never does). The response carries `reference` (`DE-XXXXXX`, Crockford base32 derived from the correlation id, so a replay after a restart yields the same one), `durable` (`database` / `crm` / `memory`), `intent`, `nextStep` (`quote` / `consultation` / `assessment`) and `acknowledged: false` (no acknowledgement email is sent yet).
- `GET /api/public/solutions/request/status/:reference` returns `{ reference, status, submittedAt, durable, nextStep }` and nothing else: no contact details, no profile, no packages. A confirmation page renders those from the submitter's own device archive (`de-solution-submitted-v1`). Lookups are rate limited and unknown references are a generic 404.

Durable storage is Postgres when `DATABASE_URL` is configured (`public_solution_requests`, JSONB payload, lazily provisioned). In production a submit that can reach neither Postgres nor the CRM is refused with 503 `DURABLE_STORAGE_REQUIRED` and rolled back to a draft so the retry is a real submit. Outside production a memory-only submit is accepted and labelled `durable: "memory"`. Memory keeps submitted records and idempotency keys for 24 hours; drafts for 30 days.

Draft ids, references and session ids are redacted from the request log (`server/index.ts`).

## Follow-on engineering priorities

1. Decide the acknowledgement email (owner decision, see `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` §16); until then `acknowledged` is always `false`.
2. Add package-specific compatibility questions and dependencies without duplicating the Step 0 profile.
3. Connect preferred co-managed pricing to the authoritative pricing engine rather than hardcoding discounts in UI.
4. Add inventory/availability-backed shipment estimates for hardware-bearing packages.
5. Add technician scheduling eligibility and calendar handoff after scope determines on-site work is needed.
6. Add shareable authenticated/read-only solution links only after authorization rules are defined.
7. Keep client marketplace checkout and public builder regression suites separate so one door cannot accidentally re-enable another door's behavior.
8. Shareable read-only solution links
9. Provisioning state machine after paid Zoho orders
10. Lifecycle-aware upgrade cart and plan comparison

## Approved future direction: lifecycle-aware upgrade cart

**Goal:** Make the cart a clear upgrade surface as well as a purchase surface. It should help an authenticated customer understand their current relationship with DE, compare eligible next steps, see the financial effect before committing, and continue through the correct payment, quote, or consultation path.

**Primary users:** Existing ProActive Ecosystem clients, standalone buyers, and co-managed clients.

### Upgrade paths

- ProActive Ecosystem clients: show the eligible progression between the canonical managed tiers and clearly distinguish the current tier, recommended next tier, added coverage, recurring-price change, effective date, and any prorated adjustment.
- Standalone buyers: allow an eligible standalone purchase or saved Solution to become the starting point for either a scoped Co-Managed relationship or a Fully Managed ProActive Ecosystem conversation.
- Co-Managed clients: allow a scoped service relationship or accumulated Solution to become the starting point for Fully Managed qualification and proposal creation.
- Never imply that adding an item automatically transfers broad operational or security responsibility to DE. Only a completed ProActive Ecosystem agreement establishes the Fully Managed relationship.

### Checkout experience to emulate

- Use a calm two-column desktop layout: selectable plan/relationship cards and payment method on the left; a persistent order or upgrade summary on the right.
- Give the selected option an unmistakable border, background, and radio state. A recommendation label such as `Recommended` or `Best fit` must be explainable from known account and Solution data, never invented urgency.
- Keep order math visible before confirmation: current plan credit, one-time charges, monthly change, tax, subtotal, total due today, renewal/effective date, and the amount charged on the next billing cycle.
- Preserve the same hierarchy on mobile as one column: options first, summary second, confirmation last. Keep the total and primary action available without obscuring terms.
- Require explicit recurring-charge consent immediately before the final action. Do not preselect consent.
- For contract-only or qualification-dependent transitions, replace `Buy now` with the truthful next action: `Review upgrade`, `Request proposal`, or `Schedule transition review`.

### Required states

- Happy: eligible upgrade options, current state, price delta, and next action are all available.
- Loading/pending: keep the summary shell visible, disable confirmation, and label the calculation or request in progress.
- Error/failure: preserve the customer's selection and explain whether pricing, payment, eligibility, or proposal creation failed and how to recover.
- Edge/constraint: explain ineligible paths, contract timing, minimums, site/user-count requirements, or required assessment without presenting a dead-end checkout button.

### Acceptance criteria

- The cart derives the customer's current relationship and entitlements from the authenticated portal/account source of truth rather than browser state.
- Each user sees only valid next-step paths: ProActive tier progression, Standalone to Co-Managed or Fully Managed, and Co-Managed to Fully Managed.
- The summary separates due-today, recurring, annual, tax, credits/proration, and renewal/effective-date amounts.
- Changing an option recalculates the summary without discarding the existing Solution.
- Contract-only transitions create a traceable proposal/consultation request; they do not simulate a completed managed-services purchase.
- Desktop and mobile implementations meet keyboard, focus, contrast, and screen-reader requirements, including announced selection and price changes.
- Analytics distinguish upgrade option viewed, option selected, proposal requested, checkout started, checkout completed, and upgrade abandoned without recording sensitive payment data.

**Recommended next step:** Product planning and implementation discovery should map the canonical tier/relationship state machine, eligibility rules, price/proration authority, and Zoho handoff before UI implementation begins.
