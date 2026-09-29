# DE Store Architecture — Phase 0 design packet

**Status:** APPROVED by Joe (DE). Door 2 is live. Warehouse isolation, Door 1 two-door entry, and fail-safe marketplace are implemented in follow-on slices. **MERGED ≠ LIVE.**  
**Date:** 2026-08-29  
**Inspected `origin/main`:** `9b2ffdc` (Merge PR #93). **MERGED ≠ LIVE.** This packet describes current *code*, not production verification.  
**Governing spec:** Three public doors + Client Marketplace + DE Digital Warehouse (supersedes earlier kitchen-sink and three-door implementation instructions).  
**Company:** Digerati Experts / DE. Portal login: `https://portal.digeratiexperts.com/portal/login`. Phone: **325-480-9870** (do not change). Store electric lock remains.

**Phase 0 actions already taken**

- Implementation on `cursor/store-three-doors` was **stopped and reverted** to `origin/main`. Catalog data was not deleted. Nothing was merged, deployed, or force-pushed.
- Abandoned local commit that copied PR #101’s `curatedSolutions.ts` was discarded. That copy must **not** be revived.
- This document is documentation only.

**Do not begin Phase 1 (Door 2) until Joe approves this packet.**

---

## 1. Proposed route map

Inspected first. The spec’s example routes are **not** used blindly: `/solutions` and several `/solutions/*` paths already exist as **marketing** pages. `/portal/*` is the authenticated Client Portal on `portal.digeratiexperts.com`. `/internal/*` has **no app routes** today but is already `Disallow` in `public/robots.txt`.

### Recommended public (Doors 1–2)

| Route | Audience | Purpose |
| --- | --- | --- |
| `/solutions` | Public | **Keep** existing marketing solutions index. Later add a two-door chooser (Handle Our IT vs Solve a Business Need) without deleting current sections unless Joe approves. |
| `/solutions/proactive-ecosystem` and `/solutions/proactive-{it,office,business,enterprise}-ecosystem` | Public | **Door 1 later.** Already exist. Do not invent `/solutions/managed-it` — it would collide with `/solutions/managed-it-support`. |
| `/solutions/business-needs` | Public | **Door 2 (Phase 1).** 13 family cards. Not 26 fully expanded offers. |
| `/solutions/business-needs/:family` | Public | Family page. `:family` = kebab of PR #101 ids (`it-operations`, …). Standalone + co-managed. Recs visible without email. |
| `/solutions/request` | Public | **Solution Request** workspace (not a grocery cart). Persist progress; contact only when save/request/schedule/assessment persistence requires it. |
| `/solutions/standalone-services` | Public | **Legacy marketing.** Later redirect or retitle into Door 2. Do not delete in Phase 1. |
| `/solutions/co-managed-it` | Public | **Legacy marketing.** Same: preserve until Joe approves consolidation. |

### Recommended authenticated (Doors 3–4)

| Route | Audience | Purpose |
| --- | --- | --- |
| `https://portal.digeratiexperts.com/portal/marketplace` | Authorized client + org | **Door 3 later.** Lives on the portal host so auth cookies and login work. Apex `/portal/*` is unsafe (Cloudflare can strip `/portal` → `//login`). |
| `/portal/marketplace/cart` | Same | Thin cart for standardized Pay Now items only. |
| `/portal/procurement` | Existing portal | **Keep.** Related procurement UI; do not delete. Classify vs marketplace in Door 3. |
| `/internal/warehouse` | DE staff only | **Door 4 later.** Current complex store relocated here. |
| `/internal/warehouse/products/:id` | DE staff | Internal product / SKU record. |
| `/internal/warehouse/solutions/:id` | DE staff | Internal assembly / mapping record. |

### Optional aliases (Joe decision)

| Alias | Proposed behavior |
| --- | --- |
| `/client/marketplace` | 302 to portal-host `/portal/marketplace` (never invent `//login`). |
| `/solutions/managed-it` | **Do not add.** Use existing proactive-ecosystem routes. |
| `/store` after Door 2 | 301 to `/solutions/business-needs` (or a public two-door chooser if Joe wants Door 1 visible immediately). |

### Phase 1 (Door 2 only) route set

After approval, implement **only**:

- `/solutions/business-needs`
- `/solutions/business-needs/:family`
- `/solutions/request`

Do **not** relocate `/store`, warehouse, or client marketplace in Phase 1.

---

## 2. Current-route migration map

| Current route | Current production-code behavior | Classification | Proposed migration (not Phase 1 unless noted) |
| --- | --- | --- | --- |
| `/store` | Quiz-first landing (`guide` / `recommended` / `catalog`). Full catalog, rails, bundles, email in guided wizard. | Legacy public catalog + workshop | After Door 2: 301 to `/solutions/business-needs` (or chooser). Until then leave live. |
| `/store/managed` | Four ProActive SKUs + contract products. Schedule consult. **No Pay Now.** Contains unverified claims (`<15 min`, `99.9%`, `24/7`, `$50K+`). | Door 1 ancestor / marketing | Later align to `/solutions/proactive-*`. Do not invent new SLA copy. Joe must approve claim removal or sourcing. |
| `/store/co-managed` | Full SKU catalog, vendor filters, coverage, quiz. `isClientOnly` hidden in UI only. | Internal warehouse leaked publicly | Later: staff → `/internal/warehouse`; prospects → Door 2. Do not 404 in a way that reveals SKUs. |
| `/store/product/:sku` | Public PDP. Sitemap includes **every** SKU. “Powered with {vendor}” from `vendorLogos.ts` (Coro, NinjaOne, Blackpoint, Hudu, Pax8, …). | Mixed / leakage | Classify each SKU: public family redirect, client-auth required (generic 404 if unauthorized), staff-only generic denial. Never reveal staff destination. |
| `/store/checkout` | Defaults to Zoho **Pay Now**. Guest / 403 / recurring → quote. `robots` noindex. Sticky CTA can cover payment (known UX defect). | Thin-cart ancestor | Later: only for eligibility=`pay_now`. Solution requests must not use this page. |
| `/store/order-confirmation` | Post-pay. | Keep for Pay Now | Unchanged until Pay Now catalog phase. |
| `/store/quote-request` | Authenticated quote of **SKU cart lines**. | Legacy cart quote | Distinct from Door 2 Solution Request. Keep until cart is split. |
| `/store/quote-confirmation/:id` | Quote confirmation. | Keep | Do not put private mappings on this page. |
| `/solutions` and `/solutions/proactive-*` | Marketing Door 1-ish | Keep | Door 1 phase restyles in place; no content deletion without Joe. |
| `/solutions/standalone-services`, `/solutions/co-managed-it` | Marketing package pages | Overlap with Door 2 / #101 | Later consolidate into Door 2. Preserve SEO. |
| `/solutions/managed-it-support`, `/managed-workplace`, `/backup-disaster-recovery` | Older marketing | Keep | Optional later map to families `it_operations`, collaboration/workplace, `backup_continuity`. |
| `/portal/login` | Canonical on portal host | Keep | Never `//login`. |
| `/portal/procurement` | Portal procurement store | Adjacent to Door 3 | Keep; do not treat as warehouse. |
| `/portal/orders`, `/portal/billing` | Client commerce | Keep | Handoffs only. |
| `/api/store/*` | Mixed public/auth | Split contracts | See §4–5. |
| `/internal/*` | robots Disallow; **no routes** | Vacant | Door 4 home. |

**Redirect rules (later):** no loops; staff-only products return generic denial (same 404 body as unknown); do not leak existence. Preserve staff bookmarks where practical via authenticated warehouse aliases.

---

## 3. Component disposition inventory

Classifications: **Public solution** · **Client marketplace** · **Internal warehouse** · **Reusable shared** · **Legacy migrate** · **Obsolete after separation**

| Component / module | Classification | Notes |
| --- | --- | --- |
| `curatedSolutions.ts` (**PR #101, not on main**) | Public solution SoT | 13 families × standalone + co-managed. Consume; **do not copy**. |
| `StoreLanding.tsx` | Legacy migrate | Quiz-first public workshop. After Door 2, become redirect or destage. |
| `GuidedBuyingWizard.tsx` | Legacy migrate / Obsolete for Door 2 | Work email **required** before recommendations (`emailReady`). Violates “recs without email.” Do not reuse as Door 2 gate. |
| `ShopByOutcome.tsx` | Legacy migrate | Outcome merchandising over SKUs. Door 2 uses #101 families instead. |
| `MerchandisingRails.tsx` | Internal warehouse / Legacy | SKU rails. Keep inside warehouse later. |
| `StoreBundlesSection.tsx` | Legacy migrate | SKU “starter bundles.” #101 would retarget this toward curated families — wait/coordinate, do not fork. |
| `StoreProductCard.tsx` | Internal warehouse + thin Pay Now later | 14 category pills locked. Not the Door 2 family card. |
| `ProductMedia.tsx` / `productImages.ts` / `vendorLogos.ts` | Internal warehouse | **Public leakage today** via PDP “Powered with {vendor}.” |
| `ProductDetail.tsx` | Legacy / warehouse | Public SKU PDP. |
| `ManagedStore.tsx` | Door 1 ancestor | Keep for Door 1; strip unverified claims only with Joe approval + source. |
| `CoManagedStore.tsx` | Internal warehouse leaked | Relocate later. |
| `ShoppingCart.tsx` (“Your Solution” 3-pane) | Legacy cart / Internal + thin cart | SKU cart. **Do not** use for Door 2 composed solutions. Name collision: existing drawer is already “Your Solution.” Door 2 workspace should be **Solution Request** to stay truthful. *(Superseded 2026-09-28 by item 8's resolution: Door 2 is “Your Solution”; the staff drawer is “Warehouse cart”.)* |
| `CoverageScorePanel.tsx` + `computeCoverageScore` | Internal warehouse — **experimental heuristic** | See §7. |
| `ConfigureProductDrawer.tsx` | Warehouse / Pay Now | Qty/config for SKUs. |
| `StoreAssessmentPanel.tsx` | Reusable / Door 1–2 later | Assessment CTA. Must not auto-add paid assessment to a cart. |
| `StoreTrustStrip.tsx` | Legacy | Review for unverified claims. |
| `StoreClientBar.tsx` | Client marketplace / shared chrome | Auth chip. Not authorization. |
| `StoreCatalogToolbar.tsx` | Warehouse | Filters including vendor. |
| `ProductCompare.tsx` | Warehouse | Do not make a public vendor comparison. |
| `SolutionOrderSummary.tsx` / `SolutionDrawerPane.tsx` / `solutionDrawerPanes.ts` | SKU cart UX | Reuse only for thin Pay Now / warehouse. |
| `SolutionMobileBar.tsx` / `CartButton.tsx` | SKU cart chrome | Suppress on Door 2 guided/request flows. |
| `Checkout.tsx` | Thin cart / leakage of Pay Now default | Default `paymentMethod = "zoho"`. Guests cannot complete Pay Now. |
| `QuoteRequest.tsx` / `QuoteConfirmation.tsx` | SKU quote | Distinct from Solution Request. |
| `useStoreAuth.ts` | Reusable but insufficient | Frontend role + localStorage JWT. Server must remain source of truth. |
| `CartContext` + `/api/store/solutions/*` | SKU durable cart | Keep for warehouse/thin cart. New Door 2 request store is a **different** object. |
| `storeProducts.ts` (66 SKUs) | Internal warehouse catalog | Entire array is **imported into the public client bundle**. |
| `pricing.ts` | Door 1 public rates | Approved ProActive starting prices. Do not invent others. |
| `storeMerchandising.ts` | Warehouse heuristics | Bundles, complements, coverage. |
| `secureStoreCheckout.ts` | Pay Now server | Role + flags + recurring block. Not a full eligibility enum yet. |
| `storeClientPricing.ts` | Client marketplace / Hub-adjacent | Per-client overrides. Website-local; not Hub-authoritative. |
| `storeQuoteCrm.ts` | CRM handoff | Best-effort Zoho. Failure does not fail HTTP create. |
| `PortalProcurementStore.tsx` | Client / portal | Names Pax8 in portal admin-ish UI. Keep off public store. |
| `ZohoASAPWidget.tsx` | Out of scope | Desk widget. Do not restyle. |
| `SiteBottomBar` / Ask DE / Sticky CTA | Shared chrome | Suppress extras on Door 2 request/review. One help option. Cookie controls must not cover buttons. |
| `scripts/generate-sitemap.mjs` | SEO leakage | Indexes `/store`, `/store/managed`, `/store/co-managed`, **every product SKU**. |

---

## 4. Public / client / internal data contracts

**Rule:** Never put public and private fields on one browser-delivered object and hide fields in the UI.

### Public contract (anonymous + prospects) — Door 2

Source: PR #101 `CuratedSolutionFamily` / `CuratedSolutionOffer` **as-is**. Do not recreate.

Allowed fields already in #101:

- Family `id`, `label`, `description`
- Offer `id`, `name`, `deliveryModel` (`standalone` | `co_managed`)
- `summary`, `audience`, `outcomes`, `includes`, `prerequisites`, `boundaries`, `serviceLevel`, `commercialModel`
- `nextStep` (currently only `"Assessment and scope approval"`)

**Do not add** to the public module: vendor, SKU, cost, margin, distributor, implementation, approval state, GCCH, waivers, device ratios.

**UI-only composition (no second package model):** request path, “what happens next” copy derived from `nextStep`, optional enhancements as **references** only if Joe later adds IDs to #101. If a spec field is missing (split DE vs customer responsibilities, exclusion list, compatibility questions), use an honest empty state or ask Joe to extend **#101** — do not fork a parallel JSON file.

Public API shape (Phase 1): `GET /api/public/solutions/families` and `GET /api/public/solutions/families/:id` returning **only** the public contract. No `storeProducts` join.

### Client contract (Door 3 later)

Per authorized `(user, clientId/org)`:

- Client-approved product id
- Public/client name
- One-time vs recurring
- **Client-facing** price only
- Eligibility enum (see §9)
- Order/request action

Must **not** include: cost, margin, other tenants’ catalogs, raw warehouse SKU maps, another org’s contract.

Server-side tenant check required. Auth alone is insufficient.

### Internal contract (Door 4 later)

May include: vendor, distributor, SKU, license, cost, approved sell, margin, floor status, availability, substitutions, compatibility, provisioning, package membership, client eligibility, quote-only, approval, notes, Hub mapping ids, last-verified, owner.

Served only from `/api/internal/warehouse/*` after staff auth. Same denial body for unknown and unauthorized.

### Hub-owned (do not duplicate as website truth)

Qualification, implementation rules, compatibility decisions, approvals, device ratios, minimums, margin floors, compliance decisions, assessment waivers.

Website may **display approved public guidance** or show **unavailable**. Do not silently copy Hub rules into the website during Phase 1.

**Current honesty:** those Hub rules are **not implemented in this website**. Do not claim they are live.

---

## 5. Authentication and authorization design

### Actors the server must distinguish

| Actor | How identified today | Gap |
| --- | --- | --- |
| Anonymous visitor | No JWT | OK |
| Prospect | `storeRole` default `prospect` if user exists without storeRole | Weakly used |
| Authenticated client | Portal JWT; live record `clientId` | OK as identity |
| Authorized client **organization** | `clientId` on live portal user | **Not** used to filter public catalog. Client pricing is per `clientId` when authenticated. No per-SKU tenant allow-list for marketplace. |
| DE staff | **No dedicated staff role.** Closest: `role === "admin"` or `storeRole === "admin"` | **Blocking for Door 4.** Chat `deInternal` is conversational only. |
| DE administrator | `requireAdmin` (`role === "admin"`) | Exists. Not least-privilege for cost/margin. |

`authMiddleware` already fail-closes: JWT is identity; **live portal record** is authoritative for `role` / `storeRole` / `clientId` (not token claims). Keep this.

`useStoreAuth` is **UI only**. `canPurchase` = `comanaged | admin` in the browser. Checkout server repeats a similar check. **Warehouse must not trust the client.**

### Enforcement layers (required)

1. **Route:** SSR/server handler or Express static policy — unauthenticated `/internal/warehouse` → 401/302 to portal login with `returnTo`. Unauthorized → generic 404, not “this SKU exists.”
2. **API:** `/api/internal/*` staff allow-list; `/api/client/marketplace/*` requires `clientId` + org membership; `/api/public/solutions/*` public contract only.
3. **Data:** separate queries/serializers. Public endpoints must not `import` `storeProducts` or `vendorLogos` into the response.
4. **Not sufficient:** hidden buttons, Wouter route guards, `robots.txt` (already Disallow `/internal/` and `/portal/`), `noindex`, obscure URLs.

### Phase 1 auth

Door 2 pages and public APIs are **anonymous-readable**. Solution Request **submit** requires contact fields at submit time; persist draft by `sessionId` like today’s cart. Do not require portal login to *browse*.

Joe must decide **staff identity** before Door 4: email domain, Hub flag, new `storeRole: "staff"`, or admin-only. Least privilege: not every DE account gets cost/margin.

---

## 6. Public-data leakage threat model

### Already leaking in current public code

| Channel | What leaks |
| --- | --- |
| Client JS bundle | Entire `storeProducts` (66 SKUs, names, `basePrice`, features, flags). `vendorLogos.skuVendorMap` (Coro, NinjaOne, Blackpoint, Hudu, Pax8, distributors, …). Coverage improve-SKUs. |
| Public HTML / PDP | “Powered with {vendor}.” SKU in URL `/store/product/:sku`. |
| Sitemap | `/store`, `/store/managed`, `/store/co-managed`, every product URL. |
| UI-only `isClientOnly` | Filter on landing/co-managed; **direct URL still renders** ProductDetail. |
| Guided wizard | Email captured **before** recommendations. |
| Checkout UI | Pay Now offered to guests who cannot pay. |
| `publicSolution()` API | SKU line items + price snapshot to anyone with `sessionId`. |
| Quote create | Requires auth (good) but CRM description includes SKU + unit price (staff CRM, not prospect HTML — keep mappings out of **confirmation pages**). |
| Analytics / logs | Quote security log includes item names/ids. Avoid cost/margin (not present today). Do not add stack vendors to analytics. |

### Not present

- GraphQL / introspection: **none**
- Source maps in repo policy: treat as leak surface in Phase 1 tests if shipped
- Hub live enforcement: **none** in this repo

### Phase 1 test surfaces (specify now; write after approval)

See §16. Scanners must fail CI if public HTML, `/api/public/*`, or client **public** chunks contain prohibited tokens (Coro, Guardz, NinjaOne, Blackpoint, Hudu, Pax8, Sherweb, Griffin, Ingram, `sku`, `margin`, `distributor`, cost fields, GCCH, waiver).

Door 2 must **not** import `storeProducts` or `vendorLogos`.

---

## 7. Digital Warehouse preservation plan

**Do not destroy the current store.** Relocate it later under `/internal/warehouse`.

### Preserve

- 66-SKU `storeProducts.ts` and merchandising
- Durable SKU cart (`/api/store/solutions/*`, `store_carts`)
- Zoho checkout + quote + PDF + CRM best-effort
- Client pricing overrides
- Coverage scorer **code and history**
- Category pills / electric store chrome
- Configure drawers, compare, rails, vendor maps (internal)

### Coverage scorer classification (from code, not marketing)

`computeCoverageScore` in `storeMerchandising.ts`:

- 6 dimensions: endpoint, identity, email, backup, network, compliance
- Score = `round(coveredCount / 6 * 100)`
- Match = regex/category presence on cart SKUs
- Comment in code: *“Heuristic cart coverage — category presence, not a fake security audit.”*
- **1 of 6 dimensions = 17/100** — this is the “17/100-style” behavior (e.g. scoring a lone assessment)

**Classification:** **Experimental merchandising heuristic / legacy feature awaiting validation.**  
**Not:** a valid Hub stack-analysis authority.

**Must not:** approve a quote, set a price, represent compliance, block an order, or make a customer-facing security claim.

Door 2 must not score a standalone family against the full ProActive Ecosystem or treat a $299 assessment as 17/100 coverage.

### Website vs Hub vs CRM vs Portal (do not duplicate)

| System | Role |
| --- | --- |
| Website warehouse | Searchable catalog and operational **reference** |
| TechSales Hub | Qualification, implementation, compatibility, approvals, ratios, floors, waivers |
| CRM / quote | Prospect, opportunity, configuration, quote/order **status** |
| Client portal | Agreements, billing, marketplace eligibility, support |

### Rules that live on the website today and belong in Hub (document only — do not migrate in Phase 0/1)

- `isCheckoutEnabled` / `isContractOnly` / `requiredClientType` / `isClientOnly` as commerce policy
- Recurring-category block (`comanaged_subscriptions`, `networking_managed`, `ucaas_subscriptions`) in `secureStoreCheckout.ts`
- Coverage heuristic and merchandising complements
- Guided-wizard recommendation logic
- Client price overlay (`0 < customPrice < list`)

**Missing warehouse safeguards (plan later; do not build in Phase 1 unless required):** staff-role matrix; audit log for cost/margin **read** and price **write**; change history; source + last-verified; data owner; active/deprecated/replacement; price effective dates; draft vs approved; export rate limits; no distributor credentials in catalog rows; confirm-before-price-change; Hub-authoritative indicator.

**Existing fragments:** admin pricing routes; quote/order security logs; live-record auth. Not a warehouse audit system.

---

## 8. PR #101 dependency strategy

**PR:** https://github.com/digeratiexperts/digeratiexperts-site/pull/101  
**Branch:** `feature/curated-de-solution-families`  
**State:** OPEN **draft**. **Not merged. Not LIVE.**

**Files:** `client/src/data/curatedSolutions.ts` (+ test), `StoreBundlesSection.tsx` (behavior change on current `/store`).

**Decision: depend on #101. Do not fork or copy the module.**

| Option | Verdict |
| --- | --- |
| Copy `curatedSolutions.ts` onto a Door 2 branch | **Rejected.** Already tried locally; reverted. Creates a competing package model. |
| Implement Door 2 against `main` without #101 | **Rejected.** Would recreate the model. |
| Wait for #101 to merge, then branch Door 2 from `main` | **Preferred** if Joe will merge #101 first (package-only, as #101 states). |
| After approval, extend #101’s branch with Door 2 UI **importing** the same module | **Allowed** if Joe wants Door 2 before #101 merge. One branch, one module. |
| Review/merge #101 as data-only, keep `StoreBundlesSection` change or revert it | **Joe decision.** That section change is the only #101 behavior on the current store. |

Phase 1 must `import { curatedSolutionFamilies } from "@/data/curatedSolutions"` (or a server-safe re-export of the **same** objects). Tests in #101 already forbid stack/SKU/margin language in that module.

---

## 9. Exact Pay Now eligibility mechanism

**Centralize.** Do not scatter checkout eligibility across cards.

### Proposed server type (implement in Phase 1 for Door 2 as **always non-pay-now**; full engine later)

```ts
type CheckoutEligibility =
  | "pay_now"
  | "request_approval"
  | "request_quote"
  | "assessment_required"
  | "client_only"
  | "staff_only"
  | "unavailable";
```

Single function, e.g. `resolveCheckoutEligibility({ actor, offerOrSku, context })`, used by API + UI.

### Current code (not this enum)

`isPurchasableForRole` in `secureStoreCheckout.ts`:

- `isCheckoutEnabled && !isContractOnly`
- `admin` → yes; else only `storeRole === "comanaged"`
- `requiredClientType` in `{ public, comanaged }`
- Recurring categories **cannot** complete Zoho one-time Pay Now → quote

Checkout **UI** still defaults to Pay Now, then falls back. That is the defect.

### Rules for this program

| Offer class | Eligibility |
| --- | --- |
| Door 2 families / standalone / co-managed / cyber / compliance / composed / assessment-dependent | **Never** `pay_now`. Use `assessment_required` or `request_quote`. Actions: Request this solution / Request a quote / Start an assessment / Schedule a consultation / Ask DE. |
| Door 1 ProActive plans | **Never** `pay_now`. Consultation / assessment / proposal. |
| New offers | Default `request_quote` unless Joe explicitly approves Pay Now. |
| Standardized low-risk client items | `pay_now` only when **all** server conditions pass **and** payment can complete. |
| Unverified client eligibility | `request_approval`, not Pay Now. |
| Warehouse | `staff_only`. |

Phase 1 Door 2: wire family/request pages to `assessment_required` / `request_quote` only. Do not add Pay Now buttons. Do not add Door 2 items to `ShoppingCart`.

---

## 10. CRM and TechSales handoff boundaries

### Today

- `POST /api/store/quote-requests` requires **auth**. Canonicalizes **SKU** lines. Emits `QUOTE_REQUESTED`. Best-effort `syncStoreQuoteToCrm` (Account/Contact/Deal/Lead/optional Quote). **CRM down ≠ quote HTTP failure.** Zoho “not configured” → skip sync.
- Connector health is **not** claimed here. Treat CRM as **unknown unless a given environment proves it**.
- TechSales Hub qualification/enforcement: **not in this website.**

### Door 2 Solution Request (after approval)

Create a **new** persist + handoff, do not overload SKU quote as the public UX.

Capture: public solution id, delivery model, enhancement refs, org, contact, eligibility answers, assessment requirement, referral/source, consent, timestamp, **correlation id**.

Idempotency: `(correlationId | idempotency-key)` or hash of (email + solution id + delivery + day) so retries do not duplicate opportunities.

CRM confirmation shown to prospects: public names only. **No** implementation mappings, vendors, SKUs, cost, margin.

If CRM/Hub unavailable: persist locally; honest **pending** confirmation; retry path; staff correlation id. Do not claim “sent to sales” before persistence succeeds.

Analytics/marketing automation: no internal pricing or margin.

Hub: optional later read of qualification status as unavailable/pending — not a second rules engine.

---

## 11. Legacy URL and SEO migration plan

**Phase 1:** add Door 2 routes + sitemap entries for `/solutions/business-needs` and each family. **Do not** remove `/store` from sitemap yet (still live). **Do not** delete catalog data.

**Later:**

1. Classify each of 66 SKUs: public family / client-only / staff-only / retire from SERP.
2. Public SKUs: 301 → `/solutions/business-needs/:family` (not a SKU PDP).
3. Client-only: unauthenticated → portal login; unauthorized → generic 404.
4. Staff-only: generic 404 for non-staff (no Location to `/internal/...`).
5. `/store` → Door 2 or chooser (Joe).
6. `/store/co-managed` → Door 2 for public; staff bookmark `/internal/warehouse`.
7. Remove private URLs from `generate-sitemap.mjs`; request search-engine removal after they 404/401.
8. Keep useful marketing `/solutions/proactive-*` and `/solutions/standalone-services` until Joe approves consolidation.
9. `robots.txt` already Disallow checkout/quote/portal/internal — keep. Do not rely on robots as security.

Avoid redirect loops (`/solutions/proactive-ecosystem-packages` already redirects).

---

## 12. State and progress-persistence design

### Door 2 workspace (new object)

Name: **Solution Request** (recommended). Do not call it Cart unless payment is available. *(Superseded 2026-09-28: “Your Solution”, see item 8.)*

Holds: family id, delivery model, enhancement refs, org fields, eligibility answers, assessment status, quote/request status, saved flag, next action.

Persistence:

- Anonymous: `sessionId` (cookie or existing store session) + server record, 30-day TTL (same idea as guest cart).
- Save / request / schedule / assessment persist: require contact; then bind to email + optional claim on portal login.
- Do not require email to **browse** families or see both offers.

### Existing SKU “Your Solution”

Keep isolated. Do not auto-add Door 2 offers or CSRA into it. Do not score Door 2 against coverage.

### UX persistence

- Visible Back; exit without losing **saved** work (warn if unsaved).
- Direct links to families (`/solutions/business-needs/identity-access`).
- Meaningful history (each family is a real URL).
- Restore focus after dialogs.

---

## 13. Failure and retry behavior

| Failure | Visitor | Staff |
| --- | --- | --- |
| Public family API down | Honest empty/error; retry; no fake catalog | Log correlation |
| Request persist fails | Do not claim success; keep form; retry | Correlation id |
| CRM sync fails | Pending: “We saved your request. A specialist will follow up.” (only if **local** persist succeeded) | Retry job + id |
| Hub unavailable | Do not invent qualification; “Assessment and scope approval” as #101 | Escalate |
| Pay Now (later) cannot complete | Never show Pay Now | — |
| Auth for warehouse | Generic denial | Audit |

Idempotent POST for request submit. No duplicate CRM opportunities on double-click.

Do not expose stack traces, SKUs, or other tenants in errors.

---

## 14. Accessibility and mobile approach

- WCAG 2.2 AA. Semantic headings per family page. One h1.
- Keyboard: family cards, delivery toggle, request form, dialogs. Visible focus.
- Announce validation errors (`aria-live`).
- Touch ~44px. 390 / 768 / 1440 verification in Phase 1.
- Do **not** one long page of all 26 offers expanded. Index = 13 cards; family = two offers, one expanded or accordion **with** accessible names (not decoration).
- Guided/request: suppress risk banner, quizzes, extra nav CTAs, floating prompts; **one** Ask DE; keep cookie control; cookie UI must not cover primary buttons (known checkout/sticky overlap — do not repeat).
- `prefers-reduced-motion`. Store **electric** accent lock. No magenta restyle of store/Door 2 if it lives under store chrome; marketing `/solutions` may keep marketing tokens — **Joe decision** whether Door 2 uses solutions (marketing) or store (electric) chrome. Recommendation: **marketing `/solutions` chrome** for Door 2 (outcomes showroom), electric reserved for warehouse + thin marketplace later.
- Portal login copy always `https://portal.digeratiexperts.com/portal/login`.

---

## 15. Affected files

### Phase 0 (this PR)

- `docs/STORE-ARCHITECTURE-DESIGN.md` (this file)

### Phase 1 after approval (preview — do not edit now)

**Add:** Door 2 pages (family index, family detail, request workspace); `GET /api/public/solutions/*`; public leakage tests; sitemap entries for new public routes.

**Import only:** `client/src/data/curatedSolutions.ts` from #101 (after merge or on #101 branch).

**Touch carefully:** `client/src/App.tsx` (add routes only); `scripts/generate-sitemap.mjs` (add Door 2 URLs, do not drop `/store` yet); MegaMenu (add Door 2 link; **do not remove** Store/Standalone/Co-managed without Joe).

**Do not touch in Phase 1:** `storeProducts.ts` (no deletes), `vendorLogos.ts`, warehouse relocate, cart/checkout behavior (except ensuring Door 2 does not use them), `ZohoASAPWidget.tsx`, `scripts/setup-github-runner.sh`, phone/contact, Hub ECO work.

**Later phases:** `StoreLanding`, `CoManagedStore`, `ProductDetail`, `ShoppingCart`, `Checkout`, `secureStoreCheckout`, sitemap SKU purge, `/internal/warehouse`, portal marketplace.

---

## 16. Acceptance tests

### Phase 1 (Door 2) — after approval

**Functional**

- All 13 #101 families render; each has standalone + co-managed.
- Recommendations / both offers visible **without** email.
- Contact required only on save/request/schedule/persist-assessment.
- No Pay Now, no add-to-cart, no coverage score on Door 2.
- Actions use truthful labels (Request this solution / quote / assessment / consultation / Ask DE).
- Deep link `/solutions/business-needs/:family` works; Back/history work.
- Unknown family → generic 404, no SKU dump.

**Leakage (automated, not visual-only)**

- `tests/public-store-leakage.test.ts` (name TBD): scan rendered Door 2 HTML, `/api/public/solutions/*` JSON, and the **Door 2 client chunk** for prohibited substrings: `coro`, `guardz`, `ninjaone`, `blackpoint`, `hudu`, `pax8`, `sherweb`, `griffin`, `ingram`, `margin`, `distributor`, `sku`, `gcch`, `waiver`, cost/margin field names.
- Assert Door 2 modules do not import `storeProducts` or `vendorLogos`.
- Keep #101 module tests as the package-data contract.

**A11y / mobile**

- Keyboard path through index → family → request.
- 390 / 768 / 1440 smoke: no overflow, one primary CTA, cookie/Ask DE do not cover actions.

**Honesty**

- No invented prices or SLAs. `commercialModel` text from #101 only.
- Pending confirmation if CRM skipped.

### Later phases (specify, do not write yet)

- Warehouse APIs return identical generic denial for missing vs unauthorized.
- Client marketplace cannot read another `clientId`.
- Sitemap excludes warehouse and staff SKUs.
- Pay Now appears only when `resolveCheckoutEligibility === "pay_now"` and hosted payment starts.
- Coverage scorer not on public Door 2; if shown in warehouse, labeled heuristic.

---

## 17. Overlapping PRs and conflicts

**Open PRs (`gh pr list --state open`, 2026-08-29):** **only #101.**

No other open store, portal, cart, checkout, or TechSales website PRs.

**Merged store history (context, not conflicts):** #97 Your Solution panes; #83 cart vs coverage rows; #73/#64/#68 chrome; #55 client pricing; #13 Zoho checkout; #56/#11 four ProActive tiers. All on `main` already.

**Closed without merge (do not treat as done):** website PR #88 (Actions runner / deploy reliability). Production deploy is **unresolved**. Do not report LIVE from this design PR.

**Local abandoned work:** `cursor/store-three-doors` implementation reverted; unused. `cursor/store-outcome-reconstruction` was unused kitchen-sink. Do not resume.

**Main tree dirt:** `scripts/setup-github-runner.sh` on `cursor/desk-support-field-outline` — **unrelated. Do not touch.**

**#101 overlap:** `StoreBundlesSection.tsx`. Door 2 after merge should not fight a second bundles rewrite. Family pages are new files — low conflict if #101 merges first.

**Antigravity:** may share the checkout. Re-read `git status` before any later write. No force-push.

**Route overlap:** existing `/solutions/*` marketing vs new `/solutions/business-needs` — **no path collision** if we do not add `/solutions/managed-it`.

---

## 18. Risks, assumptions, and unresolved decisions

### Assumptions (call out)

- PR #101 copy is the approved public package model. Website will not invent prices, SLAs, certifications, or vendor names beyond Microsoft / Apple / Dell / Lenovo unless Joe approves.
- Zoho CRM sync is best-effort and **not** proven healthy from this inspection.
- Hub enforcement of floors/waivers/ratios **does not exist in this repo**.
- `9b2ffdc` is current `origin/main` code; production SHA was **not** verified this phase.

### Risks

- **Public bundle leak** remains until warehouse is gated (later). Phase 1 must not worsen it; Door 2 must ship without importing the catalog.
- **Name collision:** existing cart is “Your Solution.” Door 2 should use **Solution Request**. *(Superseded 2026-09-28: Door 2 keeps “Your Solution”; the staff drawer is renamed “Warehouse cart”, see item 8.)*
- **Guided email-for-recs** will still exist on `/store` until destaged — dual experiences.
- **Unverified ManagedStore claims** remain until Joe approves change (do not silently delete).
- **Staff identity** undefined → cannot honestly ship Door 4.
- **`/store` 301 timing** vs SEO of SKU URLs — destage too early and lose marketing; destage too late and keep leaking stack.
- Cloudflare portal `//login` if anyone uses apex `/portal` for marketplace.

### Unresolved decisions for Joe

1. Merge **#101** first (data-only), or extend #101’s branch for Door 2 after approving this packet?
2. After Door 2, should `/store` 301 to `/solutions/business-needs` or to a two-door chooser that includes Door 1?
3. Door 2 visual chrome: marketing `/solutions` or store electric?
4. Keep or destage `#101` `StoreBundlesSection` change on the old `/store`?
5. Door 3 URL: `/portal/marketplace` vs public `/client/marketplace` alias?
6. How are **DE staff** identified for the warehouse (admin-only vs new role vs Hub)?
7. Which unverified ManagedStore claims (`<15 min`, `99.9%`, `24/7`, `$50K+`, “Real humans, always”) have a source — keep, rewrite, or remove **after** you say so?
8. Solution Request vs “Your Solution” naming — confirm **Solution Request**. **Resolved 2026-09-28 (Joe, via docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md §16.5):** the Door 2 object is “Your Solution”; the page and pathway are “Solve a Business Need”; the staff drawer is renamed “Warehouse cart”.
9. Guest Solution Request submit **without** portal login (recommended) vs reuse authenticated quote API?
10. Compatibility / enhancement fields: extend #101 later, or honest empty states in Phase 1?

---

## Stop

Phase 0 complete. **No Door 2 code, no warehouse move, no cart change, no merge, no deploy.**

Next: Joe approves or corrects this packet. Only then Phase 1.
