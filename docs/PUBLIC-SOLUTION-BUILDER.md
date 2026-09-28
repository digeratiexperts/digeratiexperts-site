# Public Solution Builder (Door 2)

Public `/store` is a **Business Solution Builder**, not a storefront cart and not a disguised managed-services lead form.

```text
PUBLIC
Business Solution Builder
Profile → Pain / Need → Solution Offer → Package → Delivery → Contact
No public payment
        ↓ qualified handoff
CLIENT MARKETPLACE
Authenticated purchasing / approved pricing / real checkout
        ↓ internal mappings
DE DIGITAL WAREHOUSE
Staff-only commercial and implementation data
```

## Canonical buyer journey

### Step 0 — Business Profile
Collect this before the buyer chooses a solution:

- users
- computers / workstations
- mobile devices
- sites / locations
- device ownership: company / BYOD / hybrid
- internal IT: yes / no / not sure

The profile is entered once, autosaved, and reused to size line items across every package. Do not ask the buyer to repeat the same counts inside each solution.

### Step 1 — Pain or Need
The buyer selects one or more plain-English business needs. The 13 canonical families remain the taxonomy, with the five-goal layer as the novice entry point.

### Step 2 — Solution Offer
Every selected solution must be offered under one of these commercial relationships:

**Standalone**
- standard pricing position
- buyer receives the preconfigured DE solution
- buyer or its existing IT provider owns implementation and ongoing operation unless DE implementation/support is separately selected
- standalone does **not** mean DE manages the environment
- standalone does **not** enroll the buyer in the traditional managed-services operating model

**Co-Managed**
- preferred pricing position where the relationship legitimately lowers delivery effort or creates shared operating value
- DE and the buyer's IT team share defined responsibilities
- no blanket percentage discount; commercial rules remain governed by the pricing engine

**Help me choose**
- valid temporary state
- cannot silently become standalone or co-managed
- buyer must either choose an offer or ask DE to recommend the relationship before a final package is submitted

### Step 3 — Package
Every package must show a customer-readable bill of materials derived from the approved offer, including quantities when the profile can size them.

Examples of quantity bases:
- per covered user
- per approved device
- per site
- included once

Do not expose internal catalog mappings on the public package.

### Step 3 — Delivery & Setup
Every package must publish fulfillment behavior, even when the answer is "not applicable":

- physical shipment: none / conditional / physical
- shipment or provisioning timing language
- self-install availability
- remote implementation availability
- on-site technician availability / scope dependency
- remote support preference

**DE fulfillment order (Joe, 2026-09-27, binding):** remote support and shipping come before
Truck-Roll, Trip Charge and Tech Labor. Every Delivery & Setup surface lists, defaults and prints
installation options in this order:

1. Remote DE setup
2. Ship it, set it up yourself (remote guidance available)
3. On-site technician: Truck-Roll, Trip Charge and Tech Labor, scope-dependent, chosen only when
   remote setup and shipped equipment cannot do the job

The default suggestion is the earliest option the selected packages support. The order lives in
`client/src/lib/solutionPackage.ts` (`INSTALL_MODE_ORDER`, `sortInstallModes`,
`preferredInstallMode`, `INSTALL_MODE_LABELS`) and is guarded by
`client/src/lib/solutionPackage.fulfillmentOrder.test.ts`.

Do not invent a ship date before inventory, model, scope, and delivery destination can support that promise.

### Step 4 — Contact
Only these four contact fields belong in the final public form:

- company name
- name
- email
- phone

Do not insert a notes essay, long qualification questionnaire, or email gate before the package is visible.

## One draft across every layer

The browser draft is `de-solution-draft-v2` (`client/src/lib/solutionDraft.ts`). It owns:

- business profile
- selected pains / needs
- offer relationship
- fulfillment preferences
- route intent

The same draft is rendered by the Store, family pages, `/store/solution`, and the final contact page.

The server companion is `/api/public/solutions/request`:

- `GET` — retrieve/create the current browser-session draft record
- `PUT` — save progress without requiring contact details and without submitting a lead
- `POST` — submit only after the four-field contact step

`/store/checkout` remains an alias of `/store/solution` so legacy links do not resurrect public cart semantics.

## Package policy

`client/src/lib/solutionPackage.ts` is the public package/fulfillment policy layer. It must remain independent from the private warehouse catalog.

It determines:

- standard vs preferred commercial position
- line-item sizing labels
- assessment required / recommended / not required
- physical vs conditional vs digital fulfillment
- supported installation modes
- technician policy
- remote-support availability
- package-level primary intent

A Cyber Risk Assessment is **not** the universal next step. Only package policy may require it.

## Public language rules

Use customer language such as:

> No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.

Do not narrate internal engineering, CRM reliability, private catalog structure, implementation mappings, or legacy migration concerns to the buyer.

## Door separation

Client Marketplace is a separate door. The Store link for existing clients must send them through:

`https://portal.digeratiexperts.com/portal/login?returnTo=/portal/marketplace`

After sign-in they continue to `/portal/marketplace`, not portal home. Preserve `returnTo`.
