# Public Solution Builder (Door 2)

Public `/store` is a **Business Solution Builder**, not a storefront cart and not a disguised managed-services lead form.

```text
PUBLIC
Business Solution Builder
01 Profile → 02 Pain or need → 03 Relationship → 04 Package → 05 Delivery & Setup → 06 Contact
No public payment
        ↓ qualified handoff
CLIENT MARKETPLACE
Authenticated purchasing / approved pricing / real checkout
        ↓ internal mappings
DE DIGITAL WAREHOUSE
Staff-only commercial and implementation data
```

## Canonical buyer journey

The six steps are one constant, `STORE_STEPS` in `client/src/lib/businessNeeds.ts`; every step label, the journey rail and the screen-reader labels read from it. The numbering below is that constant's.

### Step 01 — Business Profile
Collect this before the buyer chooses a solution:

- users
- computers / workstations
- mobile devices
- sites / locations
- device ownership: company / BYOD / hybrid
- internal IT: yes / no / not sure

The profile is entered once, autosaved, and reused to size line items across every package. Do not ask the buyer to repeat the same counts inside each solution.

### Step 02 — Pain or Need
The buyer selects one or more plain-English business needs. The 13 canonical families remain the taxonomy, with the five-goal layer as the novice entry point.

### Step 03 — Relationship (Solution Offer)
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

### Step 04 — Package
Every package must show a customer-readable bill of materials derived from the approved offer, including quantities when the profile can size them.

Examples of quantity bases:
- per covered user
- per approved device
- per site
- included once

Do not expose internal catalog mappings on the public package.

### Step 05 — Delivery & Setup
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

### Step 06 — Contact
Only these four contact fields belong in the final public form:

- company name
- name
- email
- phone

Do not insert a notes essay, long qualification questionnaire, or email gate before the package is visible.

## One draft across every layer

The browser draft is `de-solution-draft-v2` (`client/src/lib/solutionDraft.ts`). It owns:

- business profile
- selected pains / needs (each with the scenario that composed it, when one did)
- the one offer relationship (`deliveryPreference`; a need never carries its own)
- fulfillment preferences, resolved per package at submit time
- the relationship suggestion shown and whether it was used
- hints accepted or dismissed

Intent (quote / consultation / assessment) is derived from policy on both sides and is never stored as buyer state or carried in a URL.

The same draft is rendered by the Store, family pages, `/store/solution`, and the final contact page. A submitted solution is archived on the device (`de-solution-submitted-v1`) so the confirmation page can show a masked contact line (the email masked, the last four digits of the phone) without the server ever serving contact details by reference.

## Anonymous situation continuity

The Store profile and selected needs are **operating facts**, not a person. Public assessment, contact, booking, and Ask DE may read that situation from the same `de-solution-draft-v2` key so those doors can advertise another path without asking the buyer to retype users, computers, or sites.

Rules:

- Remember the situation, never the person. Name, email, phone, and company stay in the form the buyer is filling and go to Hub/CRM only on submit.
- Do not create a second browser store for this. Project the live draft through `shared/anonymousSituation.ts` (allow-listed fields only).
- The server re-sanitizes whatever is posted to `/api/assessment` and `/api/contact` before it reaches CRM description text.
- Compatibility free-text on older drafts (`currentProvider`, `complianceNeeds`, `deviceMix`, `urgency`) is never part of the situation payload.
- Ask DE greets from `deskAskDeMotion` using the same projection. Do not restyle Desk chrome for this.

Empty forms stay empty when there is no Store situation.

The server companion is `/api/public/solutions/request` (contract in `docs/STORE-SOLUTION-ENGINE.md` → Persistence):

- `GET` — retrieve/create the current browser-session draft record
- `PUT` — save progress without requiring contact details and without submitting a lead
- `POST` — submit only after the four-field contact step; validated needs and profile come first
- `GET …/status/:reference` — state of a submitted solution, never its contact details

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
