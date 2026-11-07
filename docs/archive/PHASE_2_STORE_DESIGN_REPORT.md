# Phase 2 — Store Visual Design + Site UX Mission — Report

**Branch:** `claude/overnight-store-site-ux` (pushed to `origin`, not merged to `main`)
**Baseline:** Phase 1's final commit (`33b3862`), continued in a fresh isolated worktree
**This session's commits:** 9, all pushed. See §K for the full list.

---

## A. Executive summary

Phase 1 (prior session) delivered a route audit and a handful of Store engineering fixes,
but explicitly could not do real visual QA — the in-app Browser pane's screenshot
compositing was unavailable, so every "fix" was verified only through DOM/computed-style
inspection, never an actual rendered image.

Phase 2's first job was solving that. It's solved: the Claude in Chrome extension
(connected to a real local browser) reliably captures real screenshots, and — after some
mid-session instability — the in-app Browser pane's mobile-device emulation started
compositing correctly too, giving genuine 390px-viewport screenshots. Both were used
throughout this session, not just DOM measurements.

With real visual inspection in hand, this pass found and fixed **7 confirmed layout/overlap
bugs** across the Store — all of them cases where a fixed-position element (a cart summary
pill, a promotional bar, a filter drawer, Ask DE's launcher, a button label) was rendering
on top of other content it was never supposed to cover. Every one of these was invisible to
Phase 1's DOM-only inspection method, because a computed-style check can confirm an
element's *position* without ever revealing that something else is painted on top of it —
exactly the class of bug real screenshots exist to catch.

Beyond bug-fixing, this pass also did one substantive **visual design change**: the
product-card imagery sitewide (every merchandising rail, the full catalog grid, and the
PDP hero) was being crushed by double-darkening (a 50%-opacity image under a heavy black
gradient) into indistinct dark mush, hiding real, well-crafted category artwork. That's
fixed — the art now reads as intended.

This session also produced the two decision documents the mission asked for: three fully
fleshed-out proposals (not just a sketch) for fixing the Store's new-prospect login wall,
and concrete, re-verified consolidation recommendations for the five named route groups.
Nothing in either document has been implemented — both are decisions for you.

One significant, evidence-based finding is flagged rather than fixed: the homepage's
scrolled-state bottom dock appears to conflict with an explicit **approved** design
document (`design/approved/homepage-visual-rhythm-2026-08.md`) that says "no floating
bottom dock" — see §I.

---

## B. Store summary

### Bugs found and fixed (all verified live, before/after, not just "it compiles")

1. **Cart pill phantom-height bug.** `SolutionMobileBar` (the "Your Solution" cart
   summary) computed its position using a fallback height for the sticky assessment bar
   that got applied *before that bar had ever shown once* — reserving ~112px of dead space
   on every fresh Store page load and shoving the cart pill into the middle of the
   viewport, overlapping the hero headline. Root-caused to `lastHeight.current` defaulting
   to `STICKY_CTA_FALLBACK_HEIGHT` instead of `0`. One-line fix; the now-dead fallback
   constant was removed too.
2. **Assessment bar painting over commerce content.** The "Independent Risk Assessment"
   sticky bar only ever knew to avoid modals/cookie-banners/the footer — it had no concept
   of "don't cover another product's price or CTA," so it routinely rendered on top of the
   trust strip and the merchandising rails. Fixed by extending its existing avoid-list with
   the trust strip and — after a second round of live mobile testing turned up the *same*
   bug on the plain full-catalog grid, which isn't wrapped by the merchandising-rail
   component — a general `[data-testid^='product-']` selector that covers every
   `StoreProductCard` anywhere it renders, present or future, plus one explicit exception
   for the PDP's differently-built "Recommended with this service" cards.
3. **Mobile filter drawer dock-overlap.** The "Filter & sort" bottom sheet never called the
   existing `useDockHiddenWhileOpen` hook that the cart and configure drawers already use —
   Ask DE's launcher rendered on top of the sheet's own "Show N results" button, cutting off
   its label. One-line fix using the established pattern.
4. **Truncated filter labels.** Nine filter `Select` triggers reused fixed desktop pixel
   widths inside the narrower mobile sheet; three of them ("All compliance focus",
   "Checkout or quote", "All coverage areas") truncated into unreadable fragments — a real
   information-loss bug on mobile, not cosmetic. Switched every trigger to
   `w-auto min-w-[Npx]` so labels always fit their content, on any viewport, for any future
   filter option too.
5. **PDP mobile buy-bar vs. Ask DE.** The product page's own mobile "Add to
   Solution"/"Configure" bar sat flush at the true bottom of the viewport, colliding with
   the sitewide Ask DE/menu capsule that lives in that same strip on every page. Every
   other fixed-bottom Store element already stacks above that capsule via the same
   `calc()`; this one had just never been wired in. Same fix, same convention.
6. **Cart drawer text collision.** "Continue shopping" and "Cyber Risk Assessment" are two
   `Button`s in a 2-column grid; both inherit `whitespace-nowrap`, and the longer label
   doesn't fit its column, so it visually bled into the neighboring button. Both now wrap
   to two lines within their own column instead.
7. **Orphaned grid tile.** "Shop by Outcome" renders 5 category tiles in a 2-column mobile
   grid; the odd count stranded the 5th tile ("Compliance") alone with a large empty gap
   beside it. The last tile now spans both columns specifically when the count is odd and
   the grid is at 2 columns — self-correcting if a 6th outcome is ever added.

### Visual design change (not a bug fix)

8. **Product-card imagery.** `ProductMedia.tsx` rendered every category's Meshy-generated
   art (genuinely well-crafted 3D renders with a consistent pink brand-accent motif) at
   `opacity-50` under a `from-black/70` gradient — a leftover from before the card
   badge-hierarchy redesign, when vendor/category text sat directly on the image and
   needed that darkening for contrast. It doesn't anymore: every badge overlaid on a
   product image now carries its own opaque background. Raised the image to `opacity-90`
   and lightened the gradient to `from-black/40 ... to-transparent`. Verified live: cards
   now show real, distinct texture per category instead of uniform dark murk, and PDP
   badges stay fully legible (checked via zoomed crop) because their own contrast doesn't
   depend on the image anymore.

### Reviewed and found genuinely solid, no changes made

- **Checkout** (both desktop and mobile): billing form, payment-method selector, order
  summary — clean, no overlaps, no changes needed.
- **Compare table**: side-by-side attribute comparison with checkmarks/dashes — a
  professional, working pattern, nothing to fix.
- **PDP for contract-only services** (e.g., "ProActive Ecosystem - Business"): correctly
  suppresses the mobile buy-bar and shows Schedule Consultant/Call instead; no stray sticky
  CTA collision observed.

### Found, documented, not fixed (real but lower-priority or requires a decision)

- **Compare-selection floating bar** briefly overlaps the "Browse the full catalog" link.
  Confirmed real via pixel-rect overlap, but only reproduces at an unusually short viewport
  height (this session's browser window was constrained to ~500-680px by the underlying
  display — see §G); not chased further given the higher-value work still ahead of it.
- **Homepage scrolled-state bottom dock** — see §I, flagged as a decision, not a bug fix.

---

## C. Deep-dive documents produced this session

### `STORE_FUNNEL_LOGIN_WALL_TRACE.md` (restructured)

Kept Phase 1's exact file/line trace of both "Pay Now" and "Request Formal Quote" (still
accurate, re-verified this session), and replaced the earlier 3-option sketch with the
three fully-specified proposals the mission asked for:

- **A — Guest quote request** (no account required): low complexity, fixes the more common
  funnel exit immediately, doesn't touch payment.
- **B — Guest checkout with optional account creation**: high complexity, the only option
  that lets a stranger actually complete a card purchase today; carries real new security
  surface (a guest-order lookup token, a relaxed payment-adjacent role check).
- **C — Hybrid**: guest checkout for a pre-approved "genuinely simple, one-time" SKU subset,
  guided intake for everything else (the recurring/contract majority of the catalog).

Each proposal is written out against all nine dimensions the mission specified (user
journey, account model, complexity, API changes, security implications, UX implications,
advantages, disadvantages). **Recommendation: C**, with **A shippable first** since it's
nearly free and fixes the "lost my typed quote" dead end days before C's guest-checkout
plumbing could be built and reviewed. Nothing implemented.

### `ROUTE_CONSOLIDATION_RECOMMENDATIONS.md` (new)

Concrete, re-verified (not assumed from the Phase 1 report) recommendations for all five
named groups:

| Group | Verdict |
|---|---|
| `/pricing` | Literal same-component duplicate of `/proactive-ecosystem-pricing` — confirmed by reading the route table, zero content difference. Redirect. |
| `/ecosystem-pricing` | Lighter subset that already links to the canonical page itself. Merge unique content, then redirect. |
| `/about/compliance`, `/about/insurance` | Distinct angles, zero inbound links to any of the three compliance pages. Merge into `/about/compliance-certifications`, then **actually link the result from nav/footer** — undiscoverability is the real bug, not redundancy. |
| `/official-network-planner` | A staff-gated tool mounted on the public route tree by mistake. Move under `/portal/`. |
| `/de-ecosystem-matrix-offical` | Third duplicate tier-comparison page, typo'd URL, zero links. Safe to remove outright after a sitemap/GSC check. |
| `/quote-wizard` | Not a duplicate — a real, working flow with no front door. Recommend wiring an entry CTA, not folding it into `/book`. |

No routes changed. Decision document only.

---

## D. Active page status (P1 pass)

Per the 70/20/10 allocation, the Store received the large majority of this session's
effort. One P1 active page — the **homepage** — received a real visual audit this session
(desktop + scroll-through), which surfaced the significant finding in §I. No code changes
were made to the homepage this session beyond what Phase 1 already shipped (the nav-dock
label-overlap fix); the finding here needs a decision, not a CSS tweak, so it's documented
rather than acted on. Given the session's remaining time went to closing out the Store's
bug list and the two decision documents, the rest of the P1 sweep (Solutions hub,
Industries hub, `/book`, `/contact`, canonical pricing) is next session's starting point,
not started blind in the time remaining here.

---

## E. Unused/consolidated page report

Covered in full in `ROUTE_CONSOLIDATION_RECOMMENDATIONS.md` (§C above) — not duplicated
here. No routes were removed, redirected, or otherwise changed this session.

---

## F. Design system

No new tokens invented. The one visual-language change (product-media opacity/gradient)
works within the existing categoryAccent/locked-color system — `categoryAccent.test.ts`
still passes, confirming the Store's locked hues were untouched. The badge-hierarchy
architecture Phase 1 shipped (opaque self-contained badges, no text-on-image dependency)
is what made the imagery fix safe to make in the first place — this session extended that
prior decision rather than reworking it.

---

## G. Visual QA

**Viewports tested:** Real desktop widths (via the Claude in Chrome extension, connected to
a live local Chrome instance — actual composited screenshots, not DOM inference) and real
390px-wide mobile emulation (via the in-app Browser pane, once its screenshot compositing
recovered mid-session — see below). Both were used to find *and* verify every fix in this
report with actual before/after images, not just passing computed-style assertions.

**A real environment constraint, documented rather than hidden:** the machine's actual
display in this session was unusually short (~500–680px of usable browser-viewport height,
confirmed via `screen.availHeight`), because `resize_window` on the Claude in Chrome
extension does not reliably resize the real, shared browser window on this hardware.
Several transient overlaps this session (the sticky assessment bar briefly painting over
content during its 900ms debounce window; the Compare-selection bar touching "Browse the
full catalog") are real but specifically *aggravated* by that constrained window — they
either self-correct within ~1-2 seconds on any viewport, or only reproduce at all on a
viewport this short. These are called out explicitly in this report rather than reported
as fixed or silently ignored.

**A second, unrelated environment issue surfaced and was corrected mid-session:** the dev
server process from earlier in this session went stale after a usage-limit interruption
and stopped reflecting file edits. Diagnosing that led to briefly stopping it, which let an
**unrelated process on port 8080 belonging to a different project directory entirely**
(`C:\Users\Joe\Projects\digeratiexperts-site` — not this worktree, not anything this
session started) claim the port. That process was left untouched — it is not this
session's to manage — and this worktree's dev server was restarted on **port 8081**
instead. If you want to check this branch's Store locally, use `http://localhost:8081`,
not 8080.

---

## H. Technical QA

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean, 0 errors (checked after every edit) |
| `npm run test` (vitest) | **237/237 passing**, 53 test files — checked repeatedly through the session, including immediately before this report |
| `npm run build` | Succeeds (`vite build` + `esbuild`). Same pre-existing chunk-size advisory Phase 1 noted (main bundle over Vite's 500kB guideline) — not introduced this session |
| Console errors | None observed on any page visited this session |
| Git working tree | Clean at time of writing (the build's sitemap regeneration artifact was reverted, not committed) |

---

## I. Blockers (need your decision)

1. **Homepage bottom dock vs. approved design spec.** While auditing the homepage,
   scrolling past the hero revealed the scrolled-state bottom capsule (nav-section pills +
   phone + "Risk Assessment" CTA, assembled by `HomepageDockMenu`/`HomepageDockActions`
   inside `SiteBottomBar.tsx`) overlapping body copy in the "Why We Exist" section.
   Investigating *why* turned up `design/approved/homepage-visual-rhythm-2026-08.md`, which
   states explicitly: **"Homepage section jumps live in MegaMenu (`Protected?` / On this
   page) — no floating bottom dock."** The current code still has one. Two readings are
   both plausible and I can't tell which is true without more context: (a) the approved
   spec was written and this dock should be removed/migrated into the MegaMenu as
   documented, or (b) the `SiteBottomBar` "unified capsule" architecture (which the code's
   own `@deprecated ... kept so existing homepage imports stay safe during the swap`
   comment suggests was an in-progress migration) *is* the intended successor to whatever
   the doc was describing, and the doc is stale relative to that later decision. This is a
   product/design call about which artifact is current, not something I felt was mine to
   guess at — flagging clearly rather than either ripping out a working feature or ignoring
   a named "approved" spec.
2. **The Store's login-wall funnel** (Phase 1's original finding, still unresolved): see
   `STORE_FUNNEL_LOGIN_WALL_TRACE.md` for the three fully-specified proposals. This is
   still the single biggest lever on Store conversion identified in either session.

---

## J. Risks

- The Compare-selection bar / homepage-dock overlaps noted in §B and §I are real but
  environment-sensitive (short viewport) or architecture-ambiguous (homepage dock) — flagged,
  not silently dropped, but also not force-fixed without more certainty.
- `/quote-wizard`'s missing front door (§C) and the three unlinked compliance pages (§C)
  both represent real, already-built content nobody can currently find — worth prioritizing
  the "add a link" half of each recommendation even before tackling the merge/redirect half.
- Port 8080 on this machine is currently held by an unrelated project's dev server (see
  §G) — not a risk to this repo, just worth knowing if a future session also expects 8080
  to be free.

## K. Git

- **Branch:** `claude/overnight-store-site-ux`, tracking `origin/claude/overnight-store-site-ux`
- **Worktree this session:** `.claude/worktrees/overnight-store-site-ux-9f53da` (isolated;
  a second worktree, `tool-access-check-b25b2f`, also tracks the same branch — both were
  confirmed at the same commit before this session started, no divergence)
- **Commits this session** (oldest to newest):
  1. `0c18191` — cart-pill mispositioning + assessment-bar overlap on commerce content
  2. `b466fed` — generalized assessment-bar overlap fix to the full catalog grid
  3. `eecc375` — mobile filter drawer dock-overlap + truncated filter labels
  4. `8362141` — PDP mobile Add-to-Cart bar lifted above the Ask DE launcher
  5. `947e35f` — cart drawer "Continue shopping"/"Cyber Risk Assessment" text collision
  6. `22f0044` — product-card imagery opacity/gradient (visual design pass)
  7. `f323830` — funnel proposals A/B/C + new route consolidation doc
  8. `2ecef0c` — orphaned last tile in mobile Shop by Outcome grid
  9. (this report)
- **Push status:** all 9 commits pushed to `origin/claude/overnight-store-site-ux`. **Not
  merged to `main`.** No production deploy attempted or performed.

## L. Morning review order

1. **§I Blockers**, both of them — the homepage dock/design-doc question first (it's
   quick to resolve: either point me at whichever artifact is current, or tell me to just
   implement the approved spec as written), then the funnel proposals.
2. Load `/store` and `/store/co-managed` and scroll through on your phone — the product
   card imagery should read as noticeably more premium/distinct than before (§B.8); the
   filter drawer and cart drawer fixes (§B.1-7) should all be invisible now, in the sense
   that nothing should visibly collide anywhere in the Store on mobile.
3. Read `ROUTE_CONSOLIDATION_RECOMMENDATIONS.md` — several of these (especially the
   pricing-page redirect, which is a same-component duplicate with zero risk) are quick,
   low-risk wins whenever you're ready to greenlight them.
4. Diff `client/src/components/store/ProductMedia.tsx` if you want to confirm the exact
   opacity/gradient values before trusting my judgment on them — it's a 2-line change.
