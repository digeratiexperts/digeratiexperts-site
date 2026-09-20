# PR #146 — preservation & correction audit

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

Living checklist for the Claude-led integration pass on issue #118.
Governing law: `docs/AI-ENGINEERING-GOVERNANCE.md` §18 (DE Product
Preservation Law) — **KEEP → UPGRADE → ADD → REPLACE**, with two QA baselines
(pre-change DE page *and* the approved reference).

Status legend: ✅ done · 🔄 in progress · ⏳ queued · ❓ needs Joe

---

## A. Change ledger (classification of every #146 change)

| Change | Class | Notes |
|---|---|---|
| Nav DE logo | ✅ KEEP | Speech-bubble lockup reverted; real `DE-Logo-new` webp restored. Glyph confined to Ask DE chrome |
| Hero assessment artwork | ✅ KEEP + UPGRADE | `DashboardMockup` restored into the dark field w/ violet depth glow; invented `ShieldIllustration` removed |
| Hero secondary CTA | ✅ KEEP | Canonical `CTA.secondary` ("See Plans & Pricing") restored over invented "View Our Solutions" |
| Hero reassurance + phone row | ✅ KEEP | Restored (No obligation / Response within one business day / Call) |
| Hero vendor logo row | ✅ removed | Joe: no vendor names on the public homepage (also §9 internal-stack separation) |
| Hero typography / spacing / gradient line | ✅ UPGRADE | Reference-quality hierarchy applied to DE's own copy |
| Top announcement strip | ✅ ADD | Dismissible, session-remembered, wired to existing booking flow |
| Trust strip | ✅ ADD | Attached to hero; DE copy |
| Ask DE chooser (4 actions) | ✅ ADD + UPGRADE | Routes into the **existing** Desk functions; no new chatbot |
| Ask DE a11y (focus trap / Esc / restore / bottom sheet / scrim) | ✅ ADD | |
| Ask DE launcher + bottom bar chrome | ✅ UPGRADE | Magenta glow ring + decorative status dot removed |
| Desk light treatment | ✅ UPGRADE | `customCSS` prop; widget not rewritten. Fixed white-on-white perk bullets |
| StickyCTABar mobile | ✅ UPGRADE | Compact one-row pill < 640px; visibility/parking logic untouched |
| `public-route-smoke.mjs` rendered gates | ✅ ADD | Homepage/Ask DE checks at 390/768/1440 |
| **Hero background** (Arizona dusk photo → dark precision field) | ❓ **REPLACE** | The one outstanding REPLACE. Reference-approved, but it removes a DE-specific photographic asset. Joe's explicit call required |

## B. Investigation items (added by Joe, 2026-08-30)

- ⏳ **Desk timestamp verification** — confirm message timestamps render correctly/consistently in the light treatment and across tabs
- ⏳ **Compact message actions** — audit the small message-action icon set for completeness
- ⏳ **Contextual / right-click-equivalent message controls** — verify a keyboard- and touch-accessible equivalent exists
- ⏳ **Floating-layer collision audit** — Ask DE × "Your Solution" × Store autosave chip × cookie banner × sticky CTA × unified bottom bar, rendered at 390/768/1440 (`UX_PRINCIPLES.md` no-overlapping-layers hard rule)
- ✅ **Portal Marketplace `returnTo` verification** (2026-08-30) — `shared/portalReturnTo.ts` sanitizer blocks `//`, backslashes, `javascript:`/`data:`, off-site hosts, and auth-path loops (5 tests green). Live production: `GET /api/portal/auth/zoho/start?returnTo=/portal/marketplace` → 302 to accounts.zoho.com with the redirect URI scoped to `portal.digeratiexperts.com` and returnTo carried in signed 10-min-expiry state. Remaining slice: one real completed login landing on `/portal/marketplace` (Joe)
- ✅ **Portal auth timing flake** (2026-08-30) — **not reproducible**: 3 consecutive standalone runs + multiple full 81-file suite runs all green. Single occurrence attributed to bcrypt cost under local CPU contention (dev server + Playwright + build concurrently). No code change warranted; CI unaffected

## C. Explicitly out of scope (separate governed workstreams)

Do **not** absorb into #146:

- Store **pricing** engine (#121)
- Store **inventory / ship-date ETA** (#122)
- **Technician eligibility & scheduling** (#123)
- Store/Solution Builder architecture generally; Digital Warehouse asset security

Route any Store problems found during visual QA to those issues with evidence.

## D. Resolved findings

### D1. Zoho Payments "not configured" is **not** a production defect

Corrected 2026-08-30 at Joe's direction. Determination from code:

- **Public Door 2 is request-only by design.** `PublicStoreCheckout.tsx` submits
  to `POST /api/public/solutions/request` — a scoped recommendation request,
  not an order. `"Pay Now"` and `"Add to cart"` are **prohibited strings** in
  Door 2 sources, enforced by `door2Leakage.test.ts`.
- **Payment eligibility is authenticated + role-gated.** The only payment
  routes — `POST /api/store/checkout/zoho` and `POST /api/store/orders`
  (`secureStoreCheckout.ts`) — require `authMiddleware` **and**
  `requireRole("comanaged", "admin")`.

So payment-eligible = **authenticated portal users with `comanaged` or `admin`
role** (Client Marketplace), never anonymous public visitors. Absent
`ZOHO_PAYMENTS_*`, that authenticated flow fails closed with a clean 503 and
no order is stranded in a payable state.

**Conclusion:** whether to enable the authenticated co-managed/admin checkout
is a **business/policy decision for Joe**, not a site defect. Public Door 2
must remain request-only regardless.

### D2. Integration health (verified 2026-08-30)

Production: Zoho Desk connected · portal Zoho OIDC configured · OpenAI
configured · database connected · Hub sync healthy (reachable 159 ms, outbox
0 pending / 0 failed) · `portal.digeratiexperts.com/portal/login` → 200.
Zoho Desk org `641745124`, single default department, IDs auto-discovered at
runtime. Zoho CRM licence paid through **2026-11-23** (renewal watch item).

## E. Sequence (approved)

preview → correction/preservation → Fable lower-page polish → 390/768/1440
approval → reconciliation/CI → merge → production deploy → exact SHA/runtime
verification. **MERGED ≠ LIVE.**
