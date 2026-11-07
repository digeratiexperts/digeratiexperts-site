# Overnight Store + Site UX Mission — Morning Report

**Branch:** `claude/overnight-store-site-ux` (pushed to `origin`, not merged to `main`)
**Worktree:** `.claude/worktrees/tool-access-check-b25b2f` (isolated; your main checkout on `chore/remove-dead-store-route-handlers-20260825` was never touched)
**Baseline:** branched from `origin/main` @ `f099ace`

---

## A. Executive summary

This pass did two things: a full evidence-based audit of all ~180 routes (138 public + ~40 portal/system + redirects), and a set of verified, shipped fixes concentrated on the Store. It did **not** attempt to visually redesign all 138 pages — per the mission brief's own instruction, effort was concentrated on the Store and on pages proven (by route wiring, nav/footer presence, and internal links) to matter, rather than spread evenly.

**Four real Store fixes shipped, verified, and committed:**
1. Fixed a color-token bug on every product card CTA (was a stray purple, not the Store's locked electric-blue accent).
2. Replaced the mobile filter experience (was 9 stacked dropdowns inline) with a real bottom-sheet drawer.
3. Fixed the checkout order summary so it's visible while filling out the form on mobile, and actually sticky on desktop (a CSS bug was silently disabling it).
4. Removed ~190 lines of dead route-data code proven unreachable by wouter's routing order.

**One finding matters more than any visual polish:** the Store's entire purchase funnel — both "buy" and "request a quote" — currently dead-ends at a portal login wall for any new, non-client visitor. See §I (Blockers) — this is a business decision, not something I changed unilaterally.

Everything below is backed by two independent research passes (route/nav inventory, Store architecture) plus my own direct file reads and live-browser verification — not guesses from file names.

---

## B. Store summary

### What changed
- **`StoreProductCard.tsx`** — every hardcoded `#5034ff`/`#6548ff` purple accent (borders, badges, CTA fills, checkbox accent-color) replaced with the `de-accent` token, which resolves to the Store's actual locked accent (`rgb(29,111,242)`, electric blue) via `[data-accent="electric"]`. Previously the cards' primary buttons rendered in a color that matched neither the page's locked accent nor the sitewide magenta CTA — a straightforward, verifiable bug. The sitewide `hover:bg-[#6548ff]` convention (already used in 6+ other Store components) was preserved rather than invented.
- **`StoreCatalogToolbar.tsx`** — the mobile filter UI was an inline expand/collapse of 9 stacked `<Select>` dropdowns. Replaced with a `Sheet`-based bottom drawer ("Filter & sort") that scrolls internally, shows a live active-filter-count badge on the trigger button, and has a sticky footer with "Clear all" and "Show N results." Desktop is untouched — same inline sticky toolbar as before.
- **`Checkout.tsx`** — the order summary column stacked *below* a long billing form on mobile (verified: user would scroll past the entire form before seeing any total), and its `sticky` positioning silently did nothing on desktop because the grid's default `align-items: stretch` gave it no room to move. Fixed both: summary now renders first on mobile (`order-1`) and stays in its normal right-column position on desktop (`lg:order-2`), and `lg:items-start` on the grid lets the existing `sticky top-28` actually engage.
- Added `cross-env` so `npm run dev`/`start` work at all on Windows (the scripts used `VAR=value cmd`, which only works in POSIX shells) — this was blocking every subsequent verification step in this environment.

### Deliberately *not* changed (and why)
- **Category pills duplicating the category `<Select>`** on `CoManagedStore.tsx` — the code has an explicit comment: *"Category chips — restored for scannability (toolbar Select remains)."* This was a prior deliberate DE decision, not an oversight. Left alone per the content-preservation rule.
- **Bundle "savings" framing** on `StoreBundlesSection.tsx` — the file has an explicit comment: *"Display-only bundle maps from real SKUs. No invented bundle pricing."* Investigated whether an honest (non-fabricated) subtotal was possible: it isn't, because catalog prices are per-unit (per user/endpoint/seat) with no quantity collected on this view — summing raw prices would understate real cost for any customer with more than one seat/endpoint. This is a correct existing constraint, not a gap.
- **Store category-pill hues and the store's `electric` page accent** were never touched — both are explicitly locked by `.cursor/rules/blog-store-color-lock.mdc`. My color fix moved a bug *toward* the locked token, never away from it. `categoryAccent.test.ts` (the guard test for this) still passes.
- Container max-width inconsistency across the 8 Store pages (`var(--de-canvas)` vs `max-w-7xl` vs `max-w-6xl` vs `max-w-4xl`) — confirmed real via code read, but a blind multi-page width change without pixel-accurate screenshots (see §G) was judged too risky to ship unverified. Documented here as a scoped follow-up instead.

### Unresolved Store opportunities (highest-value next steps, in priority order)
1. **The funnel dead-ends at a login wall for new visitors** (see §I — this is the big one).
2. Recurring-billing products (the majority of the co-managed catalog) can never be paid online today — checkout silently reroutes any cart containing them to "Request Quote," and the "Pay Now" button label overpromises for most SKUs.
3. Container max-width standardization across the 8 Store pages (needs visual QA a future session with working screenshots should do properly, not blind).
4. Product detail page has no "what's NOT included" section, no onboarding/turnaround estimate (buried only in the cart drawer), and no image gallery for physical hardware SKUs.
5. `ManagedStore.tsx` (`/store/managed`) uses an older, separate `ProductCard` implementation that never adopted `StoreProductCard`/the merchandising layer — visually and structurally behind the co-managed catalog page.
6. `ProductCompare` exists only on `/store/co-managed`, not on `/store` landing or PDP — inconsistent availability of a real differentiation tool.

---

## C. 138-page (route) audit — counts

Evidence-based (route wiring in `App.tsx`, MegaMenu/mobile-nav/footer presence, internal `<Link>` references, `public/sitemap.xml`), **not** traffic analytics — none was available.

| Classification | Count | Notes |
|---|---|---|
| CORE | ~28 | Homepage, Solutions hub + tier family, Industries hub + verticals, key About/Trust pages, `/book`, `/contact`, canonical pricing |
| STORE (public) | 4 | `/store`, `/store/managed`, `/store/co-managed`, `/store/product/:sku` |
| STORE (transactional/system) | 4 | checkout, order-confirmation, quote-request, quote-confirmation |
| SUPPORTING | ~31 | Solutions generic pages, industry/resource/support pages, legal docs |
| SEO-CAMPAIGN | 6 | The 6 Phoenix-metro city location pages — legitimate local-SEO pattern, not duplicates |
| SYSTEM (portal + utility) | ~48 | `/portal/*` (client + admin), auth, ticket/quote confirmations |
| DUPLICATE / CONSOLIDATE (live, overlapping) | 3 | `/pricing` (undeclared alias of `/proactive-ecosystem-pricing`), `/ecosystem-pricing`, `/portal/tickets/new` |
| OBSOLETE / CONSOLIDATE (already redirected) | 14 | Old short URLs (`/login`, `/privacy`, `/case-studies`, etc.) — already correctly handled via `<Redirect>`, no action needed |
| ORPHANED | 8 | Reachable only by typing the exact URL — zero inbound links from nav, footer, or any page body |
| ORPHANED + DUPLICATE | 1 | `/de-ecosystem-matrix-offical` (note the typo in the URL itself) |
| ORPHANED / SYSTEM (misplaced internal tool) | 1 | `/official-network-planner` — gated by an internal-staff check but mounted on the public route tree |
| DEAD (code-level, never rendered) | 11 found → **10 removed this session** | Shadowed by wouter's first-match `<Switch>` behavior; see §E |

---

## D. Active page status

Given the scale (~180 routes), full page-by-page status wasn't individually re-designed in one pass — that would have spread effort thin across low-value pages, which the mission brief explicitly warned against. Instead:

- **Store pages** (the 8 listed in §B): audited deeply, 3 files edited and verified live (see §B).
- **CORE and SUPPORTING pages** (~59 pages): audited for classification/evidence only in this pass — no code changes. They are correctly linked, serve a clear purpose, and were left as first-pass-complete for *this* session's scope; the mission's own "second pass" priority order (weakest primary page, weakest mobile experience, etc.) is a legitimate next session's work, not something to rush blind without real screenshot QA.
- **SYSTEM/portal pages** (~48): confirmed live and wired via `PortalLayout`'s nav; out of scope per the mission's Store-first priority and the color-lock rule's explicit "portal is out of scope" note.

---

## E. Unused / consolidated page report

### Removed this session (verified dead, zero other consumers, tests/build still pass)
| Route data | Why dead | Live replacement |
|---|---|---|
| `resourcePageData` (blog, videos, security-checklist, datasheets) — **entire object removed** | All 4 keys shadowed by dedicated `<Route>`s declared earlier in `App.tsx`'s `<Switch>` | `pages/resources/{Blog,Videos,SecurityChecklist,Datasheets}.tsx` |
| `industryPageData['accounting-finance']`, `['real-estate']`, `['nonprofits']` | Same shadowing | `pages/industries/{Accounting,RealEstate,Nonprofits}.tsx` |
| `supportPageData['remote-support']`, `['pay-invoice']`, `['knowledge-base']` | Same shadowing | `pages/support/{RemoteSupport,PayInvoice,KnowledgeBase}.tsx` |

Verified via: grep confirming zero consumers outside `App.tsx`/`servicePages.tsx`, `tsc --noEmit` clean, full test suite (237/237) still passing, and live in-browser render checks on the two remaining live keys (`/industries/professional-services`, `/support/system-status`) after the trim.

### Flagged, not removed (needs a human call or bigger scope than a color/routing fix)
| Route | Classification | Recommendation |
|---|---|---|
| `/pricing` | DUPLICATE of `/proactive-ecosystem-pricing` (same component, no redirect between them) | Add a canonical `<Redirect>` from `/pricing` → `/proactive-ecosystem-pricing`, or vice versa if `/pricing` is meant to be canonical for SEO. This is a live SEO/duplicate-content decision — didn't change it unilaterally. |
| `/ecosystem-pricing` | Lighter subset of `/proactive-ecosystem-pricing`, kept alive by 2 inbound links, itself links back to the fuller page | Consolidate: fold its content into the canonical pricing page and redirect. |
| `/de-ecosystem-matrix-offical` | ORPHANED + third overlapping implementation of the same tier-comparison concept, zero inbound links, typo in URL | Safe to remove entirely — nothing links to it. |
| `/official-network-planner` | An internal staff tool (gated by `/api/portal/me`) mounted on the public marketing route tree | Move under `/portal/` — this looks like a routing mistake, not intentional public exposure. |
| `/about/compliance`, `/about/insurance`, `/about/compliance-certifications` | 3 overlapping "compliance" pages, zero inbound links between or to any of them | Pick one canonical compliance page, fold the other two's unique content into it, redirect the rest. |
| `/about/press` | ORPHANED, sitemapped but unlinked | Either link it from the About nav/footer, or drop from sitemap if press activity isn't current. |
| `/legal/aup`, `/legal/dpa`, `/legal/sample-sow` | ORPHANED — likely referenced only from signed contracts/emails outside the SPA | Leave in place (removing could break external links from contracts); just not a design priority. |
| `/quote-wizard` | ORPHANED — no nav/CTA sends a user here to start the flow | Either wire it into a real entry point or fold its purpose into `/book`. |
| `servicePageData['ProActive-Ecosystem-Packages']` key + `pages/solutions/OfficePage.tsx` | DEAD (key filtered out of the live route map; its only consumer, `OfficePage.tsx`, isn't mounted in `App.tsx` at all) | Whole file + data key can be deleted, but didn't do it this session — it's a bigger unmounted-component removal, not a shadowed-route data trim, and deserved its own explicit check rather than being bundled into the routing cleanup commit. |
| `/portal/tickets/new` vs `/portal/tickets/create` | Two paths render the identical component | Collapse to one canonical path + redirect. Low priority (portal is out of scope for this pass). |

No routes were deleted destructively; no redirects, external links, or SEO-indexed URLs were removed.

---

## F. Design system

No new tokens invented. Confirmed the repo already has a maintained design OS (`design/DESIGN_SYSTEM.md`, `BRAND.md`, `UX_PRINCIPLES.md`, `DESIGN-RATIONALE.md`, plus `.cursor/rules/*.mdc`) and worked within it:
- Store's locked accent (`electric`, `rgb(29,111,242)`) and the 14 locked category-pill hues (`.cursor/rules/blog-store-color-lock.mdc`) were read first and respected — my only color change moved a bug *toward* the existing locked token, never invented a new one.
- Reused the existing `Sheet` primitive (`components/ui/sheet.tsx`) for the mobile filter drawer rather than building a new drawer component.
- Matched the sitewide Store CTA convention (`bg-de-accent hover:bg-[#6548ff]`, already used in `StoreLanding.tsx`, `GuidedBuyingWizard.tsx`, `ProductCompare.tsx`, `CoverageScorePanel.tsx`) rather than inventing a new hover treatment.

No design-system-level inconsistencies were changed this session beyond the one card-color bug — the store container max-width inconsistency (§B) is flagged, not fixed, pending real visual QA.

---

## G. Visual QA

**Important limitation:** the Browser pane's screenshot compositing was unavailable throughout this session (`preview_start` succeeded and the app rendered correctly, but `computer{action:"screenshot"}` timed out every time with "the Browser pane is not displayed" — this is a client-side display state I have no way to force from here). All visual verification was therefore done via:
- The accessibility tree (`read_page`)
- Live `getComputedStyle()` queries (confirmed the product-card button resolves to `rgb(29, 111, 242)`, confirmed `position: sticky` is actually active, confirmed bounding-box coordinates for column order at each breakpoint)
- `resize_window` to emulate exact viewports (390×844, 1440×900, plus the 375×812 mobile preset)
- Console/network inspection (zero errors introduced)

**Viewports tested:** 390×844 (mobile), 1440×900 (desktop), plus a 375×812 pass for the filter drawer specifically.

This is a real, verifiable, but not pixel-level QA method. I did not claim a design was "visually polished" anywhere I couldn't measure it — every fix above was chosen specifically because its correctness is verifiable through computed styles/DOM structure/measurements, not because it merely compiled. Anything that would require actual pixel judgment (the container-width inconsistency, deeper visual-hierarchy work on PDP/cards) was intentionally left as a documented recommendation rather than shipped blind.

---

## H. Technical QA

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, 0 errors (checked after every edit) |
| `npm run test` (vitest) | **237/237 tests passed**, 53 test files, including `categoryAccent.test.ts` (the locked-hue guard) and `storeProducts.formatPrice.test.ts` |
| `npm run build` | Succeeded (`vite build` + `esbuild`). One pre-existing warning (main `index-*.js` chunk is 811 kB / 236 kB gzipped, over Vite's 500 kB advisory threshold) — not introduced by this session's changes, flagged as a P3 follow-up, not fixed |
| Console errors | None on any page visited (homepage, `/store`, `/store/co-managed`, `/store/checkout`, `/industries/professional-services`, `/support/system-status`) |
| Lint | No `lint` script exists in `package.json` — not run |

---

## I. Blockers (need your decision)

**The Store's entire purchase funnel dead-ends at a portal login wall for any new visitor.** Specifically:
- Clicking "Pay Now" at checkout requires an authenticated Client Portal session (`portalToken`) — if you're not logged in, the UI silently flips you to "Request Quote" instead.
- "Request Quote" *also* requires portal login (`QuoteRequest.tsx` redirects to `/portal/login` if no `portalToken`).
- So a first-time prospect who fills out billing info and tries to buy, or tries to get a quote, hits a login wall either way — there is currently no self-serve completion path for anyone who isn't already a portal user.

This is very likely the single biggest lever on Store conversion, bigger than any visual change — but it's a business/auth/security decision (does self-serve checkout for new customers need to exist? does anonymous quote request?), not something I felt was mine to unilaterally change. Flagging it clearly rather than guessing at your intent.

Secondary, related: recurring-subscription products (majority of the co-managed catalog) can never be paid online even by an authenticated client — checkout always reroutes them to quote. If that's intentional (e.g., recurring billing requires a human contract step), the "Pay Now" button copy should say so before the click, not after.

---

## J. Risks

- The container max-width inconsistency across Store pages (§B) is real but unfixed — flagging so it doesn't get missed, not because it's risky to fix, just unverified without real screenshots.
- `pages/solutions/OfficePage.tsx` and its `servicePageData['ProActive-Ecosystem-Packages']` data key are dead but were left in place rather than deleted in this pass (see §E) — low risk either way, just didn't want to bundle a whole-file/unmounted-component deletion into the same commit as the shadowed-data-key cleanup without calling it out separately.
- No screenshots exist from this session as visual evidence — everything is verifiable via computed styles/DOM, but if you want pixel-level before/after images, that needs a session where the Browser pane actually composites frames.

## K. Git

- **Branch:** `claude/overnight-store-site-ux`, tracking `origin/claude/overnight-store-site-ux`
- **Worktree:** `.claude/worktrees/tool-access-check-b25b2f` (isolated; confirmed your main checkout was on a different branch and untouched throughout)
- **Commits this session:**
  1. `33a0a29` — Store: mobile filter drawer, accent-token fix, sticky checkout summary
  2. `7f85ae3` — Routes: remove dead page-data shadowed by wouter's first-match Switch
  3. (this report)
- **Push status:** both commits pushed to `origin`. **Not merged to `main`** — a PR can be opened from `claude/overnight-store-site-ux` when you're ready to review.

## L. Morning review order

1. **§I Blockers** first — the login-wall funnel issue. Everything else is secondary to this.
2. Load `/store/co-managed` on your phone (or resize to ~390px), tap "Filters" — check the new bottom-sheet drawer feels right.
3. Load `/store/checkout` with an item in cart on mobile — confirm the order summary at the top feels right rather than jarring.
4. Diff `client/src/components/store/StoreProductCard.tsx` — confirm the blue matches your expectation for the Store's electric accent.
5. Skim §E's "flagged, not removed" table — several of these (the `/pricing` duplicate, the orphaned compliance pages) are quick wins whenever you're ready to greenlight them.
