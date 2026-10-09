# Store experience (Door 2): source of truth

Status: authoritative for the Store rebuild. Opened 2026-09-28.

**Branch:** `claude/nifty-newton-uk9g7t` (PR #267, claim `store-experience-v2` in `.ai/ACTIVE_WORK.yaml:33-73`).
**Routes governed:** `/store`, `/store/solutions/:family`, `/store/solution` (+ `/store/checkout` alias), `/solutions/request`, and the new `/store/solution/submitted/:reference`.
**Approval gate:** Joe. Every REPLACE and every removal is listed in §16.12 with its reason and waits for his explicit approval (`docs/AI-ENGINEERING-GOVERNANCE.md` §18). Nothing marked REPLACE ships before that box is ticked.
**Baseline:** Baseline A, `artifacts/visual-qa/store-experience/baseline/` (commit 9c161401, 2026-09-27), critique at `CRITIQUE.md` beside it.
**File:** `docs/STORE-EXPERIENCE-SOURCE-OF-TRUTH.md` (uncommitted; the branch's pre-commit guard reserves commits for the lead session).

Everything below that is measured says how it was measured. Everything that is a judgement says so. Everything that is decided says so; everything that is still Joe's is in §16 and nowhere else.

**State of the branch (audit 2026-09-28).** This document is a reconciliation, not a roadmap. During the audit the lead session committed PR 1 as `0d2f6df4` ("store(policy+contract): one draft, one relationship, policy-derived intent, a reference DE can quote back"; 29 files, tsc clean, vitest 542 passing): `solutionPackage.ts` (`LINE_BASIS`, `ADVISORY`, `installModeDetail`, `resolveInstallMode`, `remoteSupportOptions`, the label maps), `solutionDraft.ts` (`updatedAt`, `serverDraftId`, `suggestion`, hints, `profileGaps`, `resolvedPackages`, `archiveSubmittedDraft`, derived `FAMILY_IDS`, lift-and-drop of `needs[].delivery`), `businessNeeds.ts` (`STORE_STEPS`, `SOLUTION_SUBMITTED_PATH`, `submittedPath`, `requestPath` without `?intent`), `solutionScenarios.ts` / `solutionGuidance.ts` with tests, `publicSolutionRoutes.ts` (cookie-only session, honeypot, validate-before-persist, deterministic `DE-XXXXXX` reference, `nextStep`, `acknowledged: false`, fork on submitted base, `status/:reference`), the store and persistence layers, the CRM description, `server/index.ts` redaction, `storeLegacyRedirects.ts`, `spaKnownPaths.ts`, the `/solutions/business-needs` 301 in `warehouseRoutes.ts`, the sitemap and the four docs; `publicSolutionCart.ts` is deleted. Uncommitted at the time of writing, PR 2 has begun: `client/src/components/store/door2/` (`primitives.tsx`, `ChoiceTiles.tsx`, `Coverage.tsx`, `Guidance.tsx`, `JourneyRail.tsx`, `NeedRow.tsx`, `OfflinePanel.tsx`, `PackageSheet.tsx`, `ProposalSheet.tsx`, `RelationshipCompare.tsx`, `ScenarioTile.tsx`, `SolutionChrome.tsx`), `client/src/hooks/useSolutionDraft.ts`, `client/src/styles/store-builder.css` (imported by `StorePageAtmosphere`, which gained an `intensity` prop), `shared/publicContact.ts` (the lifted `EMAIL_RE` and per-field messages), `isDoor2Path` extended with `/store/solution/submitted/`, and `isStorePath` extended with `/solutions/request` (§16.1 is therefore Joe confirming a change already made, and §5.4 says how the gesture listeners and jelly stay off the form regardless). Where a reviewer's finding described an older working state, the "Rejected critique" note in the affected section says what the tree holds now and at which line.

**How this document was made.** Eight design positions were written against the verified code map (`store-map.json`: keys `flow_today`, `constraint_set`, `defects_ranked`, `ux_gaps_ranked`, `reuse`, `handoffs`, `chrome_contract`, `open_questions_for_owner`, `contradictions`, cited as `map:<key>`). Three judges scored them; two chose "One product, one company" (the Store as the V4 lane's sibling under the electric lock), one chose "A frightened or fed-up Arizona owner". This is the winner with the judges' grafts applied, then revised against a second critique of thirty-nine findings (two P0, eleven P1, twenty-six P2), each verified against the working tree before it was applied or rejected. Grafted from the other positions: the six-step journey rail, per-package Delivery & Setup resolution with a reason, the profile strip that names its gaps, the confirmation's one hairline moment, the suggestion line with Use this / Not now, hints capped at three quoting the family's own prerequisite or boundary, quick-size chips, the "Added" state, `installModeDetail(mode, shipmentMode)`, `remoteSupportOptions(delivery)`, the honest 503 panel with a mailto fallback, three truthful persistence sentences, the measured 390 chrome budget, one polite live region per page, "Print / save" wording, the footer `store` variant, the local submitted archive, scroll-to-top on route change and the paper proposal sheet. Rejected and absent: per-need relationship as the truth; gating Add behind a relationship choice; a horizontal scenario rail on phones; a flying chip; magenta focus rings; turning `/solutions/request` into a redirect; narrating database or CRM state to the buyer; reshaping `curatedSolutions.ts` includes; a timed Undo; toasts; an acknowledgement email inside this design; sending hint telemetry through the POST; hiding the `/store` dock without Joe; and, after the second critique, the claim that the Store copies V4's `GridCell` / `HairGrid`, which V4 itself deleted (§1, §8).

---

## 0. The standard

> If an Arizona owner who typed "we got hacked" or "our IT guy quit" lands on `/store`, they should be able to say in one screen "this is for me", hold a sized package they could show a partner within three decisions, never answer anything twice, and end on a page that proves DE has it and says what happens next. And if the Store is put beside the V4 homepage, it should be obvious the same company made both.

Joe's direction (2026-09-27) outranks the "density over atmosphere" default inside the locks: the Store must feel like a fun, enjoyable, modern store to use, automate wherever the data allows, lead the buyer to the right next step, and be feature rich around real use cases. Delight comes from the object reacting truthfully to the buyer's own facts, never from decoration, counters or invented numbers. Reduced motion collapses all motion to instant.

---

## 1. What the Store is (and is not)

**The Store is** DE's second pathway, "Solve a Business Need": a Business Solution Builder in which one object, **Your Solution**, assembles as the buyer answers plain questions (`docs/PUBLIC-SOLUTION-BUILDER.md:1-16`). Every screen is a view of the same draft (`de-solution-draft-v2`, `client/src/lib/solutionDraft.ts`). The buyer gives six profile facts once, names a situation or a need, sees both ways of working with DE with the package already sized, chooses the relationship once, confirms a Delivery & Setup that DE has already defaulted remote-first, gives four contact fields, and holds a reference DE can quote back.

**It is a catalog / utility page type** (`design/UI-STYLE-RULES.md` §6): task density beats atmosphere, persistent Your Solution chrome, marketing flourish only at the top, and marketing chrome never covers task chrome.

**It is the same product as the V4 homepage**, in the way V4 itself defines sameness. V4's shared vocabulary, read at `origin/claude/homepage-v4` 583b4cd8 (`client/src/pages/versions/v4/V4Primitives.tsx`), is deliberately small: the `Chapter` frame, the `ChapterLabel` (mono 10.5px, tracking 0.18em, number in accent ink, an 8-unit hairline dash), the six-size `T` scale, `RING` and `QuietLink`. Its docblock records that a shared grid cell and hairline grid were tried and that "four chapters composed from them read as the same chapter four times — Joe's verdict was 'generic trash'. Each chapter now builds its own form." The Store honours exactly that: the same frame, label and scale, the same rule from `docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md` §6 ("Hairlines and space before containers. Not everything is a card"), a different accent channel (electric) and higher task density, and **a different form for every chapter**. Where V4 draws the three pathways as a decision tree hanging off the assessment (`V4PathChapter.tsx`, doors A/B/C plus the "No engagement" exit) and the eight blocks as a wall of seven standing on a Risk & Exposure slab (`V4BlocksChapter.tsx`), the Store draws its pathway row and coverage band in forms that echo those two, not a repeated cell. On this branch `client/src/pages/versions/v4/` holds only `HomepageV4.tsx`, `V4Environment.tsx` and `useChapterProgress.ts`, so the Store copies the V4 values as literals into `door2/tokens.ts` with a comment naming the source SHA, and imports them once the homepage-v4 follow-up PR lands (§8, §14.28).

**The Store is not:**

- a storefront or cart: no payment, no cart or checkout vocabulary, no vendor catalog, no SKUs (`map:constraint_set` 1, 15, 16; `client/src/pages/solutions/door2Leakage.test.ts`);
- a disguised managed-services lead form: Standalone never means DE managed (`docs/STORE-SOLUTION-ENGINE.md` "No false standalone semantics");
- a universal assessment funnel: assessment is per-package policy in `client/src/lib/solutionPackage.ts` only (`docs/PUBLIC-SOLUTION-BUILDER.md` "Package policy");
- a dashboard, a terminal or a HUD (`design/UI-STYLE-RULES.md` §4 failure modes; V4 §4);
- a clone of V4's chapters: no `GridCell` repeated six times (§8).

---

## 2. What works today and is kept (Baseline A)

From `artifacts/visual-qa/store-experience/baseline/CRITIQUE.md` "What is right and must be kept" and `map:constraint_set` 60:

| Kept | Where it lives |
|---|---|
| Profile captured once (users, computers, mobile devices, sites, ownership, internal IT) and reused to size every package | `client/src/lib/solutionDraft.ts` `SolutionEnvironment`, `isProfileComplete`, `profileGaps`, `patchEnvironment` |
| Four-field contact (Company name, Name, Email, Phone); no notes, no email gate, no payment | `client/src/pages/solutions/SolutionRequest.tsx`; `server/publicSolutionRoutes.ts` POST validation |
| Standalone / Co-Managed / Help me choose semantics; "Standard price" and "Preferred pricing" as the only pricing phrasings | `docs/PUBLIC-SOLUTION-BUILDER.md` Step 03; `door2Leakage.test.ts` |
| The 13 families and 26 offers in fixed order; the five-goal layer | `client/src/data/curatedSolutions.ts` (Joe-approved PR #101, never forked); `client/src/lib/businessNeeds.ts` `BUSINESS_GOALS` |
| Customer-readable bill of materials with profile-derived quantities; Delivery & Setup published per package | `client/src/lib/solutionPackage.ts` `buildSolutionPackage` |
| DE fulfillment order in policy code: `INSTALL_MODE_ORDER`, `sortInstallModes`, `preferredInstallMode`, `INSTALL_MODE_LABELS`, technician copy naming Truck-Roll, Trip Charge and Tech Labor | commit fe6b64cc; `client/src/lib/solutionPackage.fulfillmentOrder.test.ts` |
| Honest submit: 503 `DURABLE_STORAGE_REQUIRED` with rollback, `durable: database \| crm \| memory` on the 200, `WebsiteLeadLike` `LEAD_CREATED` payload, 20/hour POST limiter, Secure cookie, `Cache-Control: no-store` | commit 4cee840c; `server/publicSolutionRoutes.ts` |
| Routes `/store`, `/store/solutions/:family`, `/store/solution` + `/store/checkout` alias, `/solutions/request`; draft key `de-solution-draft-v2`; GET/PUT/POST `/api/public/solutions/request`, 30-day cookie, `?draftId=` resume | `client/src/App.tsx:283-317`; `server/publicSolutionRoutes.ts` |
| Electric accent lock (`data-accent="electric"`, 29 111 242 / ink 111 179 255), magenta `#D3126A` primary CTA fill, gold wordmark only, foundation tokens and Space Grotesk / Inter / Oxanium | `.cursor/rules/blog-store-color-lock.mdc`; `client/src/App.tsx:956-961`; `design/UI-STYLE-RULES.md` §1-§2 |
| `StorePageAtmosphere` as the Store-chunk CSS loader at today's 0.44 opacity; `store-jelly.css` tiers | `client/src/components/store/StorePageAtmosphere.tsx:41`; `client/src/styles/store-jelly.css` |
| Client Marketplace link via `portalMarketplaceLoginUrl()` with `returnTo`, label "Client Marketplace" | `client/src/lib/portalUrls.ts:37-44` |
| One Ask DE through `openMspAdvisor`; `PRIMARY_PHONE` from `shared/companyContact.ts`; `CTA.*` labels; `CANONICAL_CSRA_ONE_TIME` | `client/src/lib/openMspAdvisor.ts`; `client/src/lib/ctaCopy.ts`; `shared/canonicalCsra.ts` |
| The chrome var contract and the height-publishing pattern of `PublicSolutionCart.tsx:45-58` (KEEP the pattern; the component itself is REPLACED, §16.12 R1) | `client/src/index.css:226-290`; `map:chrome_contract` |
| The h1 "Start with your business. Then solve what hurts." | `BusinessNeedsIndex.tsx`; CRITIQUE item 2 ("is fine") |
| SiteBottomBar dock on exact `/store` (Joe, 2026-08-27) | `client/src/App.tsx:974,997`; `map:constraint_set` 37 |
| The staged scenario and guidance modules, tested and in the leakage guard | `client/src/data/solutionScenarios.ts`; `client/src/lib/solutionGuidance.ts` |
| Zero horizontal overflow at 390 / 768 / 1440 (measured 0 on every screen, `report.json`) | Baseline A |
| The honeypot, cookie-only session, validate-before-persist and deterministic reference already in the working tree (§7) | `server/publicSolutionRoutes.ts`, `server/publicSolutionRequestStore.ts:78-112` |
| Guard tests listed in `map:constraint_set` 67 | keep green, extend `door2Leakage.test.ts` for every new Door 2 file |

---

## 3. What fails today (measured)

From `CRITIQUE.md` "Measured" and "Systemic findings", `report.json`, and `map:defects_ranked` / `map:ux_gaps_ranked`. Each item names the defect the design makes structurally impossible.

| # | Measured failure | Evidence | Made impossible by |
|---|---|---|---|
| 1 | `/store` is 9,616px tall at 390, **11.4 viewports**, for "pick what hurts"; 52 controls in `<main>` | `report.json` index/390; CRITIQUE P2 length | §5.1 collapsible goal groups under 768, one link per family cell, target ≤ 5 viewports (gate ≤ 7) |
| 2 | The relationship is asked twice with different semantics: per need on the family page, global overwrite on the workspace; mixed drafts show "Needed" and contradictory labels | `map:defects_ranked` 2 (P1); CRITIQUE P0 | One owner, `draft.deliveryPreference`; the family page never asks (§4 step 03, §6.2) |
| 3 | The family page shows no package until the commercial choice is made; primary disabled | CRITIQUE item 6; `map:ux_gaps_ranked` 22 | Both offers side by side, sized, before any choice; Add never gated (§5.2) |
| 4 | "Help me choose" cannot be submitted | `map:defects_ranked` 3 (P1) | Help me choose is a submittable consultation intent (§6.3, §7) |
| 5 | No confirmation experience: an inline card under the contact page's own h1 with a raw 36-character UUID, lost on refresh, no next step, no phone | CRITIQUE P0; `06-confirmation-390.png` | A real route `/store/solution/submitted/:reference` (§5.5, §7) |
| 6 | Floating "Your Solution" chip covers the profile pill and shares the corner with the Desk launcher at 390; the sheet has no internal scroll | `baseline/01-index-fold-390.png`; `map:defects_ranked` 10, 11 (P1) | SolutionBar / SolutionRail with the var contract, scrolling sheet, pinned footer, measured with the cookie banner present (§5.6) |
| 7 | Three card dialects and a 13-hue icon rainbow on the index; six rounded islands on `#111` on the workspace | CRITIQUE P1; `01-index-1440.png`; `04-workspace-fold-1440.png` | Three visual forms (cell, sheet, tile), each chapter its own composition; electric IconWell only (§8) |
| 8 | Raw enums reach the buyer: `co_managed`, `remote_assist`, `as_needed` | `04-workspace-fold-1440.png` rail; `06-confirmation-390.png` summary | Label maps beside the policy layer serve every screen and the CRM (§6.3, §12) |
| 9 | Step vocabulary drifts: Step 0, 01-04, Step 2, Step 3 preview, Step 1-4, Step 4 twice | `map:defects_ranked` 30 | One `STORE_STEPS` constant drives every label, the journey rail and its accessible name (§6.1) |
| 10 | Installation gating is a union across packages; a stale disabled tile stays checked; one answer covers shipped hardware and advisory work | `map:defects_ranked` 5 (P1) | Per-package resolution against one buyer preference; unsupported options never rendered; the preference resets when the union shrinks (§6.2, §8B) |
| 11 | Quantities are wrong on real labels ("Privileged-access review · 25 users", every hardware line "32 primary computers") | `map:defects_ranked` 7 (P1) | `LINE_BASIS` per offer line, no regex fallback, golden table (§6.3) |
| 12 | Toasts cover the drawer header, the rail and the confirmation card | `04-workspace-fold-1440.png`, `06-confirmation-390.png` | No toasts on Door 2; in-place state, persistent inline Undo rows, one polite live region (§9, §11; REPLACE §16.12 R2) |
| 13 | The last step leaves the Store: `/solutions/request` renders magenta with no atmosphere, dark cookie banner | `map:defects_ranked` 17; `client/src/App.tsx:956-961` | Door 2 chrome keyed on `isDoor2Path`, not `isStorePath` (§5.4, §13, §16.1) |
| 14 | Announcement strip and footer sell an assessment on top of every Store page; ~155px of chrome before the h1 at 1440 | `01-index-1440.png`; `map:defects_ranked` 62 | Strip suppressed on `isDoor2Path`; footer `store` variant (§5.6, §16.2) |
| 15 | Copy narrates internal policy ("vendor catalog", "composed solution request", "or DE staff") | CRITIQUE item 2, P2 | §12 forbidden phrases |
| 16 | "Save to DE to keep it across devices" overclaims; no resume link; nothing hydrates from the server | `map:defects_ranked` 21 | Three persistence sentences bound to `durable`; resume link only when true (§6.5) |
| 17 | Profile inputs have no validation; "1,000" fails silently; "Mobile devices" and "Sites" are undefined for an owner | `map:defects_ranked` 35 | Per-field validation, field hints, a line that names the gap (§5.1) |
| 18 | Draft never cleared after submit; submitted record mutable by PUT; intent overridden by `?intent=` | `map:defects_ranked` 4, 19, 20 | Archive on success, fork on submitted base, intent derived on both sides (already in the tree, §6.2, §7) |
| 19 | Lead reaches DE without the package | `map:defects_ranked` 26 | CRM description carries the sized package, setup, scenario source and suggestion (in the tree, §7) |
| 20 | No phone anywhere inside the builder; the first tappable thing at 390 is an exit to Door 1 | `map:handoffs.phone`; §5.1 fold | Pathway row collapses to one line under 1024; incident scenarios carry "Happening right now? Call"; HelpRow on every later page (§5.1, §5.6) |

---

## 4. The buyer flow

Six concepts, one constant (`STORE_STEPS`, §6.1): **01 Profile · 02 Pain or need · 03 Relationship · 04 Package · 05 Delivery & Setup · 06 Contact**. Screens carry several concepts; concepts never repeat across screens; on any one screen the visible step numbers appear in non-decreasing DOM order (§14.14). Each screen has exactly one primary action (magenta), and it is enabled whenever the buyer can go forward.

| Screen | Route | Job | Buyer sees | Buyer does | State carried | Exits | One primary action |
|---|---|---|---|---|---|---|---|
| A · Enter | `/store` | Recognise the pressure, size once, pick what hurts | Header band, pathway line, profile strip (01, collapsed to one row until opened or needed), ten scenario starters (02), goal groups of family cells (02), SolutionBar or SolutionRail | Sizes (or skips for now); taps a scenario or Add need; opens a family by its title; calls if it is happening right now | `environment`, `needs[] {familyId, source?}`, `suggestion` (shown, not applied) | family page; workspace via the bar; Handle Our IT; Client Marketplace; Ask DE (dock); Call | **Review Your Solution** (bar/rail, once needs ≥ 1) |
| B · Compare | `/store/solutions/:family` | See what this need buys under both relationships, sized, before any commercial choice | Family label and description, profile line with Edit, two-column comparison on shared rules, Delivery & Setup preview in DE order, coverage chips, actions | Reads; adds; edits profile inline; asks DE about this need | `needs[]` gains the family; nothing else written | workspace; back to `/store`; Ask DE seeded; unknown slug → generic 404 with no data | **Add & review package** (→ `/store/solution`); secondary "Add and keep browsing" |
| C · Assemble | `/store/solution` (+ `/store/checkout`) | Choose the relationship once with the packages visible; confirm the remote-first setup; accept or dismiss DE's hints; save honestly | Profile line (01), need rows (02), relationship tiles with suggestion (03), one PackageSheet per need (04), DE suggests next, coverage (disclosure under 1024), Delivery & Setup (05), save row, rail | Picks Standalone / Co-Managed / Help me choose; confirms or changes setup; removes with Undo; saves; prints; continues | `deliveryPreference`, `fulfillment`, `acceptedHints`, `dismissedHints`, `serverDraftId`, `serverDurable` | contact; family page (Change need); `/store` (Add another); Ask DE; Call; Print / save; resume link; Handle Our IT (below the save row) | **Continue to contact details** |
| D · Sign | `/solutions/request` | Four fields and nothing else | Paper chapter (06): summary in plain words, white card with four fields, no-payment line, what happens next | Fills four fields; submits | POST body (§7); on success the draft archives, `environment` kept | confirmation; Back to Your Solution; Call; Ask DE | **Submit Solution** (or **Submit & have DE recommend**) |
| E · Hold the record | `/store/solution/submitted/:reference` | Prove it landed, say truthfully where it is, lead to the policy-chosen next step | H1, reference, status line, what happens next, summary on paper, actions | Prints; asks DE; calls; starts another | `de-solution-submitted-v1` archive; status by reference | `/store` (Start another, profile kept); Ask DE; Call; Client Marketplace; `/book?ref=` only when `nextStep === "assessment"` **and** §16.6 is merged | none by default; **Get My Cyber Risk Assessment** only under that condition |

Three decisions, in order, each made with the information in view: what hurts (A), how to work with DE (C, after both packages are visible on B and C), how it arrives (C, already defaulted). Nothing is asked twice: the profile is one strip reused on A, B and C; the relationship has one control on C; setup is one preference resolved per package. The profile is not a gate on A ("skip for now" is honest copy: every package sizes once it is filled, and it is needed before you submit); it is a gate on C's Continue and on D's card (§5.3, §5.4).

---

## 5. Screen specs

Conventions used in every subsection:

- **Regions** are listed top to bottom. "Above the fold" is measured at 1440×900 and 390×844 with the cookie banner dismissed, and again with it present, MegaMenu nav at 4rem below 1024px (`client/src/index.css:229-290`).
- **Sticky / floating**: only the shared chrome (MegaMenu, SiteBottomBar on `/store`, CookieConsentBanner) and the Store's one floating element (SolutionBar < 1024; SolutionRail is sticky, not fixed, at ≥ 1024). Contract in §5.6.
- **Frame**: every Door 2 page renders inside `Door2Frame` (§5.6), which owns the stylesheet import, the atmosphere intensity, the one polite live region and the scroll reset.
- **States** are all rendered and screenshotted in acceptance (§14.19).
- Copy is exact unless marked "(example)". Strings said to come from the policy layer are quoted from `client/src/lib/solutionPackage.ts` at `0d2f6df4` verbatim.

### 5.1 `/store` (Enter)

**Regions at 1440**

1. MegaMenu (announcement strip suppressed on `isDoor2Path`, §16.2).
2. Header band on `--de-surface` (`#0a0a0a`, the field the atmosphere gradient already ends in, `StorePageAtmosphere.tsx:45-47`) with `StorePageAtmosphere` at today's 0.44, the page's only atmosphere: StepLabel "Solve a business need" (no number), h1 "Start with your business. Then solve what hurts." (kept), lede, then the **PathwayLine**: one hairline-ruled row echoing V4's door order, A/B/C as `T.label` marks, "Handle Our IT" (→ `/solutions/proactive-ecosystem`), "Solve a Business Need · You are here" (electric ink, `aria-current="page"`), "Client Marketplace" (→ `portalMarketplaceLoginUrl()`). Not three cells: three labelled links on one rule, with each door's one-line kind beneath at ≥ 1024 only.
3. Hairline. Two-column grid `minmax(0,1fr) 320px`; the SolutionRail is sticky at `top: calc(var(--de-nav-current-bottom) + 1rem)`.
4. **Size it to your business** (StepLabel "01 [hairline rule] Profile"): the `ProfileStrip` (§5.6). Renders **collapsed** as one 48px row when the profile is empty ("Size it to your business · Users · Computers · Mobile devices · Sites · Open") and as a `ProfileLine` with Edit when complete; expanded on click, or automatically the first time a need is added while it is incomplete. Expanded, on the light grey ProfileStrip panel (§5.6): four numeric fields in one row with quick-size chips under Users (5 · 10 · 25 · 50 · 100) and "Match users" beside Computers, one-line hints under Mobile devices and Sites, two native radio `ChoiceTile` groups (Who owns the devices? · Is anyone doing IT inside the company?), a `LiveLine` that answers as you type, and a `SuggestionLine` under the internal-IT question once answered.
5. **Start from a situation** (StepLabel "02 [hairline rule] Pain or need", sr-only "Step 2 · Pain or need"): ten `ScenarioTile`s in two columns, each its own form: title in `T.h3`, one line of pressure, the composed families as three small marks, action "Add these 3" / "2 of 3 already in · Add 1" / "All 3 in · Review". The three incident scenarios (phishing, ransomware, it-person-left) carry one in-flow line beneath: `Happening right now? Call 325-480-9870` (from `PRIMARY_PHONE`).
6. **Or pick a family** (still 02): goal pills (anchors to the five groups, `aria-pressed` only for the "All" filter) + search on one row, a result count line; five goal groups, each an h2 with a hairline rule and a four-column list of family cells: electric `IconWell`, title (the cell's only link, → family page), one-line description, lead outcome, and the **Add need** toggle (`aria-pressed`; "Added ✓" when in). Under 768 the first group is open and the other four are `<details>` disclosures headed by their h2, so the thirteen cells are never all rendered on a phone at once.
7. Quiet close: the sanctioned line "No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment."
8. Footer (`store` variant: "Back to Your Solution", no assessment CTA, §16.2).

**Above the fold at 1440:** StepLabel, h1, lede, the pathway line, the collapsed profile row and the first row of scenario tiles. The SolutionRail's empty state is visible at right.

**Regions at 390:** nav 64px; StepLabel, h1 (2 lines), lede; the pathway line collapses to one quiet sentence under the lede (`Want DE to run all of IT? Handle Our IT · Already a client? Client Marketplace`); the collapsed 48px profile row; scenarios as a **vertical** list of ten full-width rows ≥ 48px (never a horizontal rail); goal groups as described; SolutionBar fixed at the bottom once a need exists. **Above the fold at 390 (pass condition):** StepLabel, h1, lede, the pathway sentence, the profile row and the top of ScenarioTile 1 (`.scenario-tile` first top < 844px with consent seeded).

**Length targets:** reported target ≤ 5 viewports at 390 (Baseline A 11.4) with a pass condition of ≤ 7; ≤ 4 at 1440 (Baseline A 4.6). Measured, not assumed.

**States**

| State | Rendering |
|---|---|
| empty draft | Bar hidden on `/store` at < 1024, rail empty state at ≥ 1024: "Nothing added yet. Start from a situation or add a need."; every family cell "Add need" |
| profile empty | Collapsed row; when opened, LiveLine "Four counts and two facts. Then every package sizes itself." |
| profile partial | LiveLine names the gap: "Missing: sites, internal IT" (buyer words: users, computers, mobile devices, sites, device ownership, internal IT); packages elsewhere show basis phrases |
| profile complete | LiveLine "Sized for 25 users · 30 computers · 15 mobile devices · 1 site", then the strip collapses to ProfileLine with Edit |
| invalid count | Under the field: "Numbers only, up to 6 digits" with `aria-invalid` and `aria-describedby`; computers and mobile devices may be 0, users and sites may not (`profileGaps`, `solutionDraft.ts:329-344`); the hint says so |
| first need added with empty profile | The strip expands and the LiveLine names the gaps; **focus does not move**; the bar reads "not sized yet" |
| scenario tapped | Its missing families flip to "Added ✓" in a 60ms stagger; the bar count pulses once; one inline `UndoRow` under the tile that **persists until the next add, remove or navigation** (no timer): "Added Security Awareness & Human Risk, Email & Collaboration, Identity & Access · Undo"; when the scenario carries a relationship hint the same row continues "· Suggested: Standalone, because … · Use this", never applied without the click; the live region announces once |
| scenario partly in | Tile action "2 of 3 already in · Add 1"; all in: "All 3 in · Review Your Solution" |
| need added / removed | Cell flips; live region "Identity & Access added to Your Solution" / "removed"; persistent inline Undo row on remove |
| search filtering | Count line "6 solutions match"; no results: "Nothing matches “x”. Clear search · Show all" |
| suggestion shown / used / declined | SuggestionLine "Suggested from your profile: Standalone. You told us there is no internal IT team to share the work with. Standalone gives you the packaged DE solution; you or your IT provider run it day to day. Use this · Not now" (reason verbatim from `suggestRelationship`); declined persists in `dismissedHints` (`relationship-suggestion`) |
| storage unavailable | Page works; LiveLine "Not saving on this device" |
| reduced motion | stagger, pulse, collapse instant |

**Copy (exact)**

- StepLabel: `SOLVE A BUSINESS NEED`
- h1: `Start with your business. Then solve what hurts.`
- Lede: `Tell us what you have once. Pick what needs attention. DE sizes a solution you can send for a real quote. No payment here.`
- Pathway line: `Handle Our IT` / `One accountable team for the technology.` · `Solve a Business Need · You are here` / `Something specific is in the way. A package with a start and an end.` · `Client Marketplace` / `Already a client? Continue in the Client Marketplace.`
- Profile h2: `Size it to your business`; sub: `Four counts and two facts. Then every package sizes itself. Skip for now if you like; it is needed before you submit.`
- Field labels and hints: `Users` · `Computers` (`Match users` beside it) · `Mobile devices` / hint `Phones and tablets that open company email or files. 0 is fine.` · `Sites` / hint `Offices DE would need to reach. Home workers are not sites.` · `Who owns the devices?` (The company / People bring their own / A mix) · `Is anyone doing IT inside the company?` (Yes / No / Not sure)
- Scenario section h2: `Start from a situation`
- Catalog h2: `Or pick a family`; goal headings from `BUSINESS_GOALS` labels verbatim
- Cell toggle: `Add need` / `Added ✓`
- Rail empty: `Nothing added yet. Start from a situation or add a need.`
- Rail primary: `Review Your Solution`

**Rejected critique.** "Keep the decided order or record a REPLACE": applied as the first option, so no REPLACE is needed. The profile row is first and numbered 01, scenarios and families are 02, and the visible numbers read 01 → 02 top to bottom at every width (§14.14). The smoke script's `Step 0 · Profile` / `#profile-users` selectors are rewritten in PR 2 commit 16 (§15).

### 5.2 `/store/solutions/:family` (Compare)

**Regions at 1440** (content column + rail)

1. Back link `← All needs` (→ `/store`).
2. StepLabel "02 [hairline rule] Pain or need · Identity & Access" (sr-only "Step 2 · Pain or need"), h1 family label, description, three outcomes as a hairline list (from the standalone offer's `outcomes`, then co-managed extras).
3. `ProfileLine` ("Sized for … · Edit"; Edit expands the ProfileStrip inline, collapsed by default). Unsized: "Add your counts to size this · Size it".
4. **Two ways to have it** (h2 "Two ways to have it. Same package, different hands on it."): `RelationshipCompare`, two columns whose rows share top rules across both columns: header (Standalone · Standard price | Co-Managed · Preferred pricing), Who runs it day to day, DE's role, What's included (PackageSheet rows label | Oxanium quantity from `buildSolutionPackage`), Before we start (prerequisites), Not included (boundaries), Assessment (`ASSESSMENT_LABELS`). The suggested column carries a `SuggestionChip` "Suggested from your profile" with its reason; the buyer's current global choice, if any, carries "Your choice" and an electric top rule. **No relationship control on this page.**
5. **Delivery & Setup for this package** (StepLabel "05"): a numbered hairline list of the modes this package supports, in `INSTALL_MODE_ORDER`, first tagged "DE's first choice", labels and details from `installModeDetail(mode, shipmentMode)`; the shipment sentence; the technician sentence.
6. **Where this sits in DE's eight security blocks** (`CoverageChips`): the blocks this family touches from `FAMILY_SECURITY_BLOCKS`, or "Also in this solution: operating layer, not a security block" for families outside the eight.
7. Actions: **Add & review package** (magenta, → `/store/solution`), `Add and keep browsing` (electric outline, stays), `Ask DE about this need` (text, seeded with `solutionAdvisorSeed(draft, {familyLabel})`), `Call 325-480-9870`. Below: the honesty line.
8. Escape link: `Prefer DE to run all of IT? See Handle Our IT.` (→ `/solutions/proactive-ecosystem`).

**Above the fold at 1440:** back link, h1, description, ProfileLine, comparison header and the first two rows.

**At 390:** same order; the comparison stacks Standalone then Co-Managed with both sheets fully visible and a `Compare ↓` jump link under the h1 (no tabs, no swipe); the delivery list and chips stack; **the in-flow action row hides its magenta primary and keeps only `Add and keep browsing`**, because the SolutionBar (mounted on this page even with an empty draft, mode review) carries the one primary: "Add & review package" → "Added ✓ · Review Your Solution".

**States**

| State | Rendering |
|---|---|
| not included | Primary "Add & review package", secondary "Add and keep browsing" |
| included | Primary becomes "Added ✓ · Review Your Solution" (magenta, → workspace); secondary "Remove from Your Solution" with a persistent inline Undo; no forced navigation |
| profile unsized | Quantities print basis phrases exactly as `formatQuantity` does: `Per covered user` · `Per approved device` · `Per primary computer` · `Per site` · `Included once`; ProfileLine offers Size it |
| suggestion (internalIt yes/no) | Chip on the suggested column with the reason from `suggestRelationship` |
| no suggestion (unsure / empty) | Line under the compare: "Not sure? Help me choose is a real option on the next step." |
| unknown family | Generic 404 with no data (`map:constraint_set` 42) |
| draft event | Page reads the draft through `useSolutionDraft` (`SOLUTION_DRAFT_EVENT` + `storage`); profile edits re-size immediately |
| reduced motion | quantity fade-through instant |

**Copy (exact)**

- Compare h2: `Two ways to have it. Same package, different hands on it.`
- Column A header: `Standalone · Standard price`; row "Who runs it day to day": `You, or your IT provider, run it. DE sets it up (remote first) or guides you through it.`
- Column B header: `Co-Managed · Preferred pricing`; row: `Your IT team and DE, by an agreed responsibility split. Preferred pricing where sharing the work lowers DE's effort, never a blanket price cut.`
- Delivery heading: `Delivery & Setup for this package`; rule line: `DE's rule: remote first, shipped second, on-site only when nothing else will do.`
- Honesty line: `Standalone never means DE runs your IT. It means DE builds this and you, or your IT provider, run it day to day.`
- Coverage heading: `Where this sits in DE's eight security blocks`

### 5.3 `/store/solution` + `/store/checkout` (Assemble, the peak)

**Regions at 1440** (content column 8/12 + sticky SolutionRail 4/12)

1. StepLabel "YOUR SOLUTION", h1 `Your Solution, assembled.`, lede `Sized from your profile. Change anything; nothing is final until DE confirms fit, scope, fulfillment and pricing.` The `JourneyRail` (six numbered stations on one thick line: ✓ when ready, a glowing white station for the current step; `aria-label` derived from `STORE_STEPS`, §6.1 Stations).
2. **01 Profile**: `ProfileLine` with inline Edit (same ProfileStrip).
3. **02 Pain or need**: `NeedRow`s (family label, one line, "from: Our only IT person just left" when `source` is set, `Change need →` to the family page, `Remove` with a persistent inline `UndoRow`). Empty: "Nothing in Your Solution yet." with the ten scenario tiles inline and a link to `/store`.
4. **03 Relationship** (h2 `How do you want to work with DE?`, sub `Choose once for the whole solution.`): three native radio `ChoiceTile`s: Standalone / Co-Managed / Help me choose; `SuggestionLine` beneath with the reason and `Use this · Not now`.
5. **04 Package** (h2 `What's in it`): one `PackageSheet` per need separated by space and a top rule: header row (family label · public offer name · pricing label · assessment label), hairline rows label | Oxanium quantity, footer `Change need →`. When Help me choose: the sheet renders both columns compact with the badge `DE confirms which after you submit`. When the relationship is unchosen: Standalone column previewed with the label `Preview · choose above`.
6. **DE suggests next**: at most three suggestions on the whole page, hints first: `HintRow`s from `nextHints(draft, dismissedHints)` (title, reason quoting the source family, one action button, `Dismiss`), then, only while fewer than three are shown, the coverage band's Add links.
7. **Where this solution sits** (`CoverageBand`, a `<details>` closed by default under 1024 and open at ≥ 1024): seven blocks laid as a wall with hairline mortar in the form of `V4BlocksChapter`, each In your solution / Available · Add Endpoint & Device Management → / Part of Handle Our IT →, then the Risk & Exposure slab full width beneath with an electric top rule (V4's magenta rule becomes electric here); line `Also in this solution: IT Operations & Support, Hardware & Lifecycle (operating layer, not security blocks)`; caption `Structure, not a score.`
8. **05 Delivery & Setup** (h2 `Delivery & Setup`, rule line `DE's rule: remote first, shipped second, on-site only when nothing else will do.`): `ChoiceTile`s for the union of modes the selected packages support, in `INSTALL_MODE_ORDER`, the first pre-checked and captioned `DE's first choice`; beneath, the **resolution lines** from `resolveInstallMode`, collapsed when identical ("All 3 packages: Remote DE setup") and itemised only when packages differ ("Identity & Access: Remote DE setup" / "IT Operations & Support: Remote DE setup · shipping does not apply to this package"); shipment sentence per package with a physical or conditional shipment; then **After it is in, how much do you want DE around?** with four tiles from `SUPPORT_LABELS`: Just this setup · When something breaks · Ongoing · Not sure yet, the `remoteSupportOptions` suggestion pre-checked and captioned `Suggested`.
9. **Save row**: the one save control labelled **Save progress** (kept), the persistence sentence, `Copy resume link` (durable only) with its warning, `Print / save`. Beneath, the Door 1 escape: `Prefer DE to run all of IT? See Handle Our IT.`
10. Rail (`SolutionRail`): "Your Solution · 3 needs", six status lines (Profile / Pain or need / Relationship / Package / Delivery & Setup / Contact) each "Ready" or naming the gap ("Relationship: choose above, or let DE recommend"), the next-step line by intent ("After you submit: DE contacts you to schedule the assessment conversation (required for Cybersecurity Operations)"), the save state, **Continue to contact details** (magenta; when disabled, `aria-describedby` points at the visible gap), `Ask DE about this solution`, `Call 325-480-9870`.

**Above the fold at 1440:** h1, journey rail, ProfileLine, the first need rows, the relationship tiles, and the rail's status lines with the primary.

**At 390:** one column in the same order; the rail's status lines move into the SolutionBar's sheet; the SolutionBar switches to **continue mode**: one status line ("Relationship needed" / "Ready") + `Continue to contact details` (magenta), so the primary is never four sections away; tapping the status scrolls to the first section with a gap. Target ≤ 6 viewports at 390 with two needs (Baseline A 8.1 with one).

**States**

| State | Rendering |
|---|---|
| empty | Chapter 02 empty state; rail primary disabled with `aria-describedby` "Add at least one need" |
| profile incomplete | ProfileLine "Not sized yet · Size it"; rail Profile line names the gap; Continue disabled with reason "Finish the profile: sites"; the `profile-incomplete` hint leads |
| relationship unchosen | Tiles unselected; PackageSheets preview Standalone with `Preview · choose above`; rail "Choose above, or let DE recommend"; Continue disabled with that reason |
| Help me choose | Both columns compact per sheet; badge `DE confirms which after you submit`; pricing label `DE confirms`; rail Relationship "DE will recommend"; Continue **enabled** |
| Standalone / Co-Managed | Sheets cross-fade 200ms to that offer; quantities fade-through once |
| setup default | `fulfillment.installation` set to `remote_assist` on the first render of a non-empty solution; every resolution line reads Remote DE setup |
| setup changed to shipped | Resolution lines: packages that support `self_install` read "Shipped to you, set it up yourself" (physical/conditional) or "Set it up yourself, DE guides remotely" (digital); others fall back with the reason |
| setup changed to on-site | Line under the tile: "On-site work is scope-dependent and billed as Truck-Roll, Trip Charge and Tech Labor. DE confirms whether it is needed."; the `onsite-chosen-when-remote-available` hint appears with one-tap return |
| union shrinks after a remove | If `installation` is no longer in the union it resets to `preferredInstallMode(union)`; live region "Setup reset to Remote DE setup: on-site is not offered for the packages left" |
| hint accepted / dismissed | Row collapses to a tick (need added, relationship set, or setup restored) / row removed and id persisted |
| saving | Save control `aria-busy`, "Saving…" in the live region |
| saved on this device | "Saved on this device" |
| saved to DE (durable true) | "Saved to DE · Copy resume link"; on copy: "Copied. Anyone with this link can open your draft." |
| save unavailable (durable false or PUT failed) | "Saved on this device. Couldn't save to DE just now · Try again" |
| hydrating from `?draftId=` | Rail skeleton only; an empty local draft (no need, none of the six profile facts) hydrates silently; a different local draft is replaced by DE's copy silently only when DE's is newer by more than five minutes (§6.5); otherwise "Use the saved copy from DE, or keep what is on this device?" two buttons |
| `?draftId=` of a sent solution | DE answers with a fresh draft and `previousReference`; this device's solution stays and the line "That solution was already sent as DE-4K7Q2M. This is a new one." is shown and announced |
| `?draftId=` unknown | This device's solution stays; live region "That link no longer opens a saved solution. Your solution on this device is open." |
| storage blocked on this device | The device half of the persistence sentence reads "Not saving on this device" (alone, or before "Couldn't save to DE just now"); "Saved to DE" still names only what a PUT confirmed; the page works from this tab's memory copy, which wins over anything storage holds once a write has been refused |
| submitted base (server `forked`) | Line "That solution was already sent as DE-4K7Q2M. This is a new one." |
| print | `window.print()`; the print sheet renders the summary as "Solution summary · draft", no prices |
| reduced motion | all instant |

**Copy (exact)**

- Relationship tiles: `Standalone` / `DE's packaged solution, set up remotely by DE unless you choose to do it yourself. You, or your IT provider, run it day to day. Standard price.` · `Co-Managed` / `DE and your IT team share it. Preferred pricing where sharing lowers the work.` · `Help me choose` / `Submit as-is and DE recommends. You still see both packages below.`
- Delivery tiles, verbatim from `installModeDetail` / `INSTALL_MODE_LABELS` (`solutionPackage.ts:88-122`): `Remote DE setup` / `DE does the setup over a secure remote session. First choice wherever the package allows it.` (digital) or `Equipment ships to you; DE sets it up remotely once it arrives.` (physical/conditional) · `Shipped to you, set it up yourself` / `Equipment arrives ready; you plug in with DE on the phone, or DE finishes remotely.` (physical/conditional) or `Set it up yourself, DE guides remotely` / `Your team follows DE's guided setup; remote help is available if you get stuck.` (digital) · `On-site technician` / `Truck-Roll, Trip Charge and Tech Labor. Only when remote setup and shipped equipment cannot do the job.`
- Support tiles: `Just this setup` · `When something breaks` · `Ongoing` · `Not sure yet` (from `SUPPORT_LABELS`)
- Rail primary: `Continue to contact details`
- Resume warning: `Anyone with this link can open your draft. It never includes your contact details.`

### 5.4 `/solutions/request` (Sign)

Rendered electric. The route is kept: the legacy 301s in `server/storeLegacyRedirects.ts:3-8` already point here, and a redirect target that redirects again was rejected. `ACCENT_BY_PREFIX` gains an explicit `["/solutions/request", "electric"]` entry and `isStorePath` already includes the path in the working tree (§16.1 confirms). The gesture listeners and jelly nevertheless stay off this page: `useStoreChromeGestures` attaches its wheel/touch/navigate listeners only when a `.de-store-h-rail` is present in the document, and jelly is scoped to `html.de-store-jelly`, a class `Door2Frame` sets only on `/store`, the family pages and the workspace (§9, §10). `map:constraint_set` 31 (no transform motion on checkout or pricing surfaces) therefore holds on the form by construction.

**Regions at 1440:** the page's single paper chapter (`bg-de-paper`, text `text-de-bg` `#050312`, exactly as V4's paper `Chapter`). StepLabel "06 [hairline rule] Contact" (paper variant; sr-only "Step 6 · Contact"), h1 `Who should DE follow up with?`, lede `You already did the solution work. Four fields, then it's DE's turn.` Two columns: left 7/12 **What you're sending** as a hairline list in plain words (profile line; relationship label or `Left with DE to recommend`; one row per package: public offer name · setup label · assessment label where required or recommended; remote support label; `Works in: Identity & Access, Human Risk`); right 5/12 a white card (`--de-paper-hairline`): `Company name` · `Name` · `Email` · `Phone` (native inputs, `autocomplete`, `inputmode`, per-field error under the field with `aria-invalid` + `aria-describedby`, messages from `shared/publicContact.ts`), the honeypot (§16.13: outside the four-field group, `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`, visually hidden), the sanctioned line, **What happens next** (three plain steps), the primary, then `Prefer to talk? Call 325-480-9870` and `Ask DE about this solution`. Below: `← Back to Your Solution`.

**Above the fold at 1440:** h1, first summary rows, the card's first two fields.

**At 390:** the card first (fields full width, 48px), the summary below in a disclosure `What you're sending (3 packages) ▾`; no SolutionBar on this step (the card owns the primary and the cookie banner never meets a floating bar).

**States**

| State | Rendering |
|---|---|
| default | Four empty fields; the draft view carries no contact fields, so nothing prefills (§7). The GET only tells the page which draft the submit lands on |
| per-field invalid | Message under the field ("Enter a phone number DE can call, for example 480-555-0100"), first invalid field focused, live region summary; client and server share `EMAIL_RE` and the messages from `shared/publicContact.ts` |
| sending | Button "Sending…", `aria-busy`, form inert |
| 400 with a field name | Message placed at the field it names |
| 400 `NEEDS_REQUIRED` / `PROFILE_INCOMPLETE` / `RELATIONSHIP_REQUIRED` (§7) | The card's disabled panel below, not a field error |
| 503 `DURABLE_STORAGE_REQUIRED` | `OfflinePanel` replaces the button row: "DE couldn't record this yet. Nothing was lost; your solution is still here on this device." → `Try again` · `Email this summary to DE` (mailto built from the local draft in public labels) · `Call 325-480-9870` |
| 429 | "Too many attempts from this connection. Try again in a while, or call 325-480-9870." |
| network failure | The same panel with "Check your connection." |
| empty draft (arrived by link) | Card disabled with `aria-describedby` "Add at least one need first · Back to Your Solution"; a `?family=` seed on an empty draft adds the need and **navigates to `/store/solution`** with the inline "Added Identity & Access from your link · Undo" there, so the buyer never signs before seeing the package |
| profile incomplete | Card disabled with `aria-describedby` "Finish Your Solution: sites · Back to Your Solution" (the same reason string as the rail); the summary's profile row names the gap |
| relationship unchosen | Card disabled with `aria-describedby` "Finish Your Solution: relationship · Back to Your Solution"; summary row `Relationship: choose on Your Solution`, never "Not chosen yet" beside an enabled Submit |
| Help me choose | Primary reads `Submit & have DE recommend`; summary row `Relationship: Left with DE to recommend` |
| assessment required | Line above the primary: `An assessment comes next for Cybersecurity Operations. DE contacts you to schedule it after you submit.`; the label stays `Submit Solution` (never promises a booking) |
| success | Navigate to the confirmation; focus lands on its h1 |
| replay 2xx | Same navigation; the confirmation shows the replay banner |

**Copy (exact)**

- Sanctioned line: `No payment is taken here. DE confirms package fit, scope, fulfillment, and pricing before commitment.`
- What happens next: `1. A person at DE reads Your Solution. 2. DE emails or calls to confirm fit, scope, delivery and pricing. 3. Nothing is billed until you say yes.`
- Primary: `Submit Solution` / `Submit & have DE recommend`

### 5.5 `/store/solution/submitted/:reference` (Hold the record)

New route (ADD). Registered in `client/src/App.tsx` (lazy, Door 2), already in `server/storeLegacyRedirects.ts` public set, `server/spaKnownPaths.ts` PREFIXES and `client/src/lib/isDoor2Path.ts` (working tree); noindex via `useSEO`.

**Regions (1440 and 390, one column, measure ~65ch):** quiet graphite (`Door2Frame` intensity 0), no rail, no SolutionBar. StepLabel "SUBMITTED", h1 `Your solution is with DE.` inside a `role="status"` region that receives focus; an electric hairline draws left to right beneath the h1 (the one loud moment); `ReferenceMark` in Oxanium `DE-4K7Q2M` with a copy button and `Quote this if you call.`; the status line; masked contact line `DE will reach you at j***@acme.com or ···-4567.` from `archive.contact` (§6.2, never the raw values); **What happens next** as three hairline rows chosen by `nextStep`; the assessment band (paper) only when required; the submitted summary on paper (`ProposalSheet` from the local archive, never a PII refetch) with `Print / save`; actions `Ask DE about DE-4K7Q2M` · `Start another solution` · `Client? Open Client Marketplace` · `Call 325-480-9870`.

**Above the fold at 390:** h1, reference, status line, the first next-step row.

**States**

| State | Rendering |
|---|---|
| durable database or crm | Status line `Recorded with DE. Keep this reference.` |
| durable memory (never in production without the smoke flag) | H1 `Your solution is recorded.`; status line `DE is confirming the record. Keep this reference and call if you do not hear from us.` |
| nextStep quote | Rows: `DE reads the solution` · `DE calls or emails to confirm scope` · `You receive pricing to approve` |
| nextStep consultation | First row `DE recommends Standalone or Co-Managed and says why` |
| nextStep assessment | Paper band `This package needs an assessment before final scope. DE contacts you to schedule the conversation first; the formal Cyber Security Risk Assessment is $2,500 when that document is scoped.` with `Call 325-480-9870` and `Ask DE about DE-4K7Q2M`. The magenta `CTA.primary` → `/book?ref=DE-4K7Q2M` renders only when `BOOK_ALIGNED === true`; flipped to `true` in PR #267 together with the `/book` copy (§16.6), so the band carries the screen's one magenta, preceded by the bridge line `Or pick a time for that first conversation yourself. It costs nothing.` (the booking is an optional, no-cost first step, not the priced document); the price in the band is `CANONICAL_CSRA_ONE_TIME`, formatted as `/book` formats it and `/book?ref=` shows `Reference DE-4K7Q2M` above the widget |
| acknowledged false (always, until §16.7 is decided) | Line `This page and the reference are your record. Print or save it.` No email is promised |
| replayed | Banner `We already have this request as DE-4K7Q2M. Nothing was sent twice.` |
| refresh | Re-renders from the archive and the status endpoint |
| direct visit, no archive on this device | Status-only page: h1, reference, status line, `Start another solution`; summary absent with the line `The summary is on the device you used to send it.` |
| lookup pending, no archive on this device | H1 `Checking your reference…`; nothing about the record is asserted until DE answers (§12) |
| lookup failed, no archive on this device | H1 `Keep this reference.` with the line `DE could not check this reference just now. Keep it, try again, or call.` and `Try again`; the archive's own durability is used instead when this device holds one |
| unknown or expired reference | Generic 404 |
| print | Sheet only |
| reduced motion | hairline static |

**Copy (exact)**: `Your solution is with DE.` · `Your solution is recorded.` (memory variant) · `Checking your reference…` (lookup pending, no archive) · `Keep this reference.` (lookup failed, no archive) · `Reference DE-4K7Q2M. Quote this if you call.` · `Start another solution (your profile is kept)`.

### 5.6 Shared Store chrome: Door2Frame, SolutionBar, SolutionRail, ProfileStrip, help

**Door2Frame** (`client/src/components/store/door2/Door2Frame.tsx`, ADD; the working tree's `SolutionChrome.tsx` may host it): every Door 2 page renders inside it. It imports `store-builder.css` (through `StorePageAtmosphere`, so the entry stylesheet gains nothing), mounts `StorePageAtmosphere` with `intensity` 0.44 on `/store`, 0.28 on family and workspace, 0 on contact and confirmation, sets `html.de-store-jelly` on the three building pages only, sets `html[data-de-store-bar]` while a SolutionBar is mounted, owns the page's **one** polite live region, and resets `window.scrollTo(0, 0)` on every location change (verified in the visual-QA walk before it is assumed, §14.15). It publishes nothing else.

**SolutionRail (≥ 1024)**: sticky (not fixed) panel on `--de-raised` with `--de-hairline` border, the only raised container on the index and family pages: count line, the six status lines on the workspace, the SuggestionLine when a scenario or the profile suggests, the persistence sentence, the screen's primary, and on every Door 2 page except `/store` the `HelpRow` (Ask DE seeded + Call). On `/store` the SiteBottomBar dock is the one help option (Ask DE + Call in its quick menu, `SiteBottomBar.tsx:141-146, 286-290`), so the rail carries no Ask DE there.

**SolutionBar (< 1024)**: the Store's one fixed element. Class `de-fixed-in-canvas`, `z-40`, height 56px, `role="region"` `aria-label="Your Solution"`, `bottom: calc(var(--de-chrome-inset) + var(--de-cookie-h, 0px) + var(--de-unified-bar-h, 0px))`, publishes `--de-store-cart-h` via ResizeObserver and resets it to `0px` on unmount (pattern `PublicSolutionCart.tsx:45-58`). Space is reserved from the Store chunk, not the entry stylesheet: `store-builder.css` rules `html[data-de-store-bar] .de-site-canvas { padding-bottom: calc(var(--de-unified-bar-h) + var(--de-sticky-cta-h) + var(--de-cookie-h) + var(--de-chrome-inset) + var(--de-store-cart-h, 0px)) }`, so `client/src/index.css:333-343` is untouched (§8, §14.27) and the double claim on `index.css` (§15) is not exercised. The Toaster viewport already clears the var (`ui/toast.tsx:17`) though Door 2 no longer toasts. It **stacks above** the cookie banner and the unified bar via the vars rather than deferring: the persistent Your Solution chrome is a constraint (`map:constraint_set` 25). **It never fades**: with reserved space nothing scrolls beneath it, and its primary stays at full opacity (a 40% magenta on graphite fails 4.5:1). It hides while its sheet is open (`useDockHiddenWhileOpen`). Modes: **review** ("Your Solution · 3 needs · sized" or "· not sized yet", the count line tapping to the ProfileStrip, + `Review Your Solution`) on index and family — on `/store` it is hidden while the draft is empty, on the family page it is mounted even then ("Nothing added yet") because it carries the family primary; **continue** (status + `Continue to contact details`) on the workspace; unmounted on contact and confirmation. Its sheet (`YourSolutionSheet`, Radix Sheet, bottom) is `flex flex-col` with an `overflow-y-auto` list and a pinned footer holding the primary and the HelpRow; focus-trapped; Escape restores focus. The suggestion, when one exists, is rendered in the sheet and in the scenario's UndoRow, never only in the sheet.

**390 chrome budget (measured gate):** logo bar 64 + unified bar ≈ 56 + SolutionBar 56 = 176 of 844px (21%) without the banner. With the banner present the gate is the measured sum of all fixed chrome heights ≤ 40% of the viewport and the bar's primary fully visible (§14.13). If the light banner's measured height breaks that gate on Door 2, the CookieConsentBanner renders its compact one-line variant (`Cookies: Accept all · Manage`, the same two actions) on `isDoor2Path`; the choice is recorded in the completion report with the measurement (a PR 3 edit, §15). No two fixed elements' rects intersect.

**ProfileStrip**: one component used on all three building screens: collapsed row (empty), expanded (four numeric fields with `inputmode="numeric"`, quick-size chips, "Match users", the two hints, two native radio groups styled as ChoiceTiles, LiveLine, SuggestionLine) and `ProfileLine` ("Sized for … · Edit") when complete. Autosaves through `patchEnvironment`. Its exported name stays `SolutionProfileForm` (test lock `door2Leakage.test.ts:130`) with `ProfileStrip` as the internal name.

**ProfileStrip panel (Joe, 2026-09-30)**: expanded, the strip sits on a light grey panel (`.d2-profile-panel`) so the form reads as one object against the graphite page, on `/store`, the family page and the workspace. The grey is `color-mix(in srgb, var(--de-paper) 92%, var(--de-bg))` (about `#e4e2e0`), mixed from the two brand tokens rather than a new literal; inputs, tiles and chips lift to `--de-paper-raised` white on it. Inks are re-pointed inside the panel so text clears 4.5:1 on the grey: graphite ink at 0.78 / 0.64, the electric accent ink darkened 25% toward graphite (raw electric ink is about 3.5:1 there), the error ink darkened 20%. Input borders (0.58) and radio marks (0.45) clear 3:1. The focus ring stays 2px offset 2 but takes the magenta fill (`--de-magenta`, about 4:1 on the grey) because `#ec4899` is about 2.7:1 on it, a panel-scoped exception to the one-ring rule. The two radio groups stack one per row at every width: side by side at 1024+ they clipped "The company" inside the padded panel. The empty 48px row and the collapsed `ProfileLine` stay rules on graphite. Print renders the panel white. Locked by `door2Tokens.test.ts`.

**Help**: exactly one Ask DE control and one `tel:` link **inside `<main>`** per Door 2 page, in addition to whatever shared chrome renders (the MegaMenu utility bar phone at ≥ 1024, `MegaMenu.tsx:711-716`; the dock on `/store`). `/store`: the dock (no in-content Ask DE) plus the incident scenarios' Call line. Family, workspace, contact, confirmation: the HelpRow (rail, bar sheet, or in flow on contact and confirmation). The dock stays hidden on those routes as today (`client/src/App.tsx:974`).

**Announcement strip and footer**: the MegaMenu announcement strip does not render on `isDoor2Path` (trailing slashes and case normalised, as the server serves them) nor on `/book`, the page it sells, where it would read "free" above the conversation-first copy and the assessment's price (§14.24); the utility bar's height is measured with its min-height and transitions released, so a client-side hop from a page with the strip leaves no empty band; `DigeratiEnhancedFooterSection` takes `variant="store"` swapping the magenta assessment CTA for an outline "Back to Your Solution" link to `/store/solution` (so the page's own primary stays the one magenta action); on the confirmation, whose draft was just sent, the link reads "Back to the Store" → `/store`. Approved 2026-09-28 (§16.2); built in PR #267 with the claim extended first. The compact cookie banner is not built: §14.13's banner gate passes as measured.

**Scroll**: native everywhere. `Door2Frame` owns the reset.

**Rejected critique.** "Three primitives and no fourth" was the draft's wording, not its intent; §8 now says three visual forms expressed by a named set of components, shipped as a primitive sheet before any screen is composed from them.

---

## 6. Data and state model

### 6.1 One constant for the journey

`STORE_STEPS` (`client/src/lib/businessNeeds.ts`, committed in `0d2f6df4`, shared by client and server) drives every StepLabel, the JourneyRail, the rail status lines and the docs:

```
01 Profile · 02 Pain or need · 03 Relationship · 04 Package · 05 Delivery & Setup · 06 Contact
```

Each StepLabel renders the visible V4 form ("02", a hairline rule element, "Pain or need") plus the sr-only `sr` string from the constant ("Step 2 · Pain or need"), so the leakage locks stay string-locked in one form (re-locked in PR 2 commit 16: index `Step 2 · Pain or need`, request `Step 6 · Contact`).

**Stations (Joe, 2026-10-01: "go with B").** Joe found the Store "too matched … hard to see what's what and move forward in steps" and asked for thicker, more fun lines; of two rendered concepts (Track, Stations) he chose Stations. A numbered StepLabel is now a station: the number in a 2.75rem round badge (Oxanium), a ✓ once its step is ready, a white station plus a visible `You are here` badge on the current step; the sr-only form gains ` · ready` / ` · you are here`. An unnumbered eyebrow keeps the V4 hairline. On a chapter at 1024+ the station sits in a 4.75rem left gutter and a 6px line joins it toward the next station (electric under a ready step, fading under the rest). `StoreChapter` takes `stepState` and sets `data-step-state`; the workspace derives it from the same `readiness` and `currentStep` as the JourneyRail (`stepStateOf`), so the rail and the chapters never disagree; the contact page marks step 06 current. The current graphite chapter lights up as a card (electric 6px left edge, 1px electric border, a 12% electric wash into `--de-raised`, a soft glow); a ready chapter's heading folds back to `--d2-ink` while its controls keep full contrast. The JourneyRail is six 2.5rem stations on one 6px line: ✓ when ready, a white station with a breathing electric halo when current (one instant run under reduced motion), numbered ahead, the label under each and wrapping rather than truncating. Index and family pages show neutral stations (no state there). Locked by `door2Tokens.test.ts`; evidence in `artifacts/visual-qa/store-stations/`.

Step 03 is **Relationship** everywhere, the buyer's word. `STORE_JOURNEY_SENTENCE` is no longer a literal: it is derived, `STORE_STEPS.map(s => s.label).join(" → ")` lower-cased after the first word, giving `Profile → pain or need → relationship → package → delivery & setup → contact`, and that is the JourneyRail's `aria-label` and the string the JourneyRail lock at `door2Leakage.test.ts:114` binds through `aria-label={STORE_JOURNEY_SENTENCE}`. PR 1 commit 7 already renamed the canonical doc heading to "Step 03 — Relationship (Solution Offer)".

**Rejected critique (partly).** The finding that "one constant drives every label" is untrue today is right for the sentence (`businessNeeds.ts:36` still says "offer"); it is corrected above rather than kept as a lock.

### 6.2 SolutionDraft (`client/src/lib/solutionDraft.ts`, key `de-solution-draft-v2` kept; committed in `0d2f6df4` unless marked)

| Field | Change | Why |
|---|---|---|
| `needs[].familyId` | KEEP | |
| `needs[].delivery` | **Parsed, never written, never displayed.** `parseDraft` (`:196-218`) lifts a unanimous per-need value into `deliveryPreference` when the global is empty, otherwise drops it | One owner (`map:constraint_set` 12; defect 2). REPLACE of the write path, §16.12 R3 |
| `needs[].source?` | ADD: scenario id | Lead can see what started it |
| `deliveryPreference` | KEEP as the sole owner: `standalone \| co_managed \| unsure \| ""` | |
| `environment` | KEEP the six facts; the four compat fields stay parsed for old drafts but are no longer typed as public | dead surface (defect 57) |
| `fulfillment.installation` | KEEP as one buyer preference; defaulted to `remote_assist` the first time a non-empty solution renders; resolved per package at render and at POST; **reset to `preferredInstallMode(union)` by a draft effect when a remove shrinks the union past it** (PR 2) | Per-package resolution without a stored per-package field; cannot dead-end; no stale checked value |
| `fulfillment.remoteSupport` | KEEP; suggested by `remoteSupportOptions(deliveryPreference)` and pre-checked with "Suggested" | automation |
| `intent` | Parsed only; derived by `recommendedIntent` (assessment > consultation > quote) on the client and recomputed on the server | defect 4 |
| `updatedAt` | ADD ISO string on every write | resume conflict rule |
| `serverDraftId`, `serverDurable` | ADD | resume link and persistence sentence |
| `suggestion` | ADD `{ value, accepted } \| null`; sent on every PUT and POST, stored on the record, read by the CRM description | lead payload |
| `submitAttemptId` | ADD (PR 2): minted by `ensureSubmitAttemptId()` on the first submit attempt, cleared by `resetSolutionKeepingProfile`; the POST `idempotencyKey` is `${submitAttemptId}\|${email}` | a retry replays; a solution built after "Start another" never does, whatever it shares with the last one |
| `acceptedHints[]`, `dismissedHints[]` | ADD | hints persist across reloads |
| `FAMILY_IDS` | derived from `curatedSolutionFamilies` (`:85`) | defect 29 |
| `recommendedCtaLabel`, `SOLUTION_CART_EVENT`, `publicSolutionCart.ts`, `parseDeliveryModel` | deleted (verified dead by `git grep` before deletion) | §16.12 R4 |
| `profileGaps(environment): string[]` | ADD, buyer field names | pill and rail |
| `resolvedPackages(draft)` | ADD → `{ need, family, package \| { standalone, coManaged }, policyView }[]` | one derivation for every screen |
| `archiveSubmittedDraft(archive)` | ADD: writes `de-solution-submitted-v1`; `resetSolutionKeepingProfile` clears needs, relationship, fulfillment, hints, `serverDraftId` and keeps `environment` | defect 19 |
| `SubmittedSolutionArchive.contact` | ADD (PR 2): `{ emailMasked, phoneLast4 }` computed client-side by `maskEmail` / `maskPhone` **before** the write; the raw email and phone are never stored; a unit test asserts the archive contains no `@` outside the masked form and no run of 7+ digits | §5.5 masked line without PII in localStorage |

### 6.3 Package policy (`client/src/lib/solutionPackage.ts`, the only owner; committed in `0d2f6df4`)

- **`LINE_BASIS: Record<offerId, LineBasis[]>`** with `LineBasis = "user" | "device" | "computer" | "site" | "once"`, one entry per include line, same length as `includes` (asserted by `solutionPackage.sizing.test.ts:25-36`). `formatQuantity(basis, profile)` prints `25 users` · `32 computers + 18 mobile devices` · `32 computers` · `2 sites` · `Included once`, singular forms correct, and the basis phrase when unsized: `Per covered user` · `Per approved device` · `Per primary computer` · `Per site` · `Included once`. `curatedSolutions.ts` is untouched. **The regex fallback `inferBasis` (`:283-295`) is deleted in PR 2 commit 8's policy touch-up**: `lineBasisFor` returns `"once"` for a missing entry and the sizing test, which fails on any include line without a basis, is the only guard, so the table is the sole truth (§16.12 R5 records the original regex replacement).

  The basis table (decided; Joe reads it as data; it is the `LINE_BASIS` constant at `solutionPackage.ts:206-233`):

  | Offer | Line 1 | Line 2 | Line 3 | Line 4 |
  |---|---|---|---|---|
  | de-it-operations-standalone | Helpdesk intake and triage · user | Routine workstation support · computer | Patch and maintenance coordination · device | Escalation reporting · once |
  | de-it-operations-co-managed | Shared service queue · user | Overflow and escalation handling · user | Maintenance coordination · device | Operational reporting · once |
  | de-endpoint-standalone | Endpoint enrollment · device | Patch and health monitoring · device | Baseline configuration · device | Device inventory and reporting · once |
  | de-endpoint-co-managed | Shared endpoint monitoring · device | Patch coordination · device | Health and exception reporting · once | Escalation support · once |
  | de-identity-standalone | Multi-factor authentication policy · user | Single sign-on design · once | Account lifecycle controls · user | Privileged-access review · once |
  | de-identity-co-managed | Shared access administration · user | Authentication-policy support · once | Lifecycle workflow assistance · user | Identity-risk reporting · once |
  | de-collaboration-standalone | Tenant administration · once | Email protection baseline · user | Collaboration policy · once | User and license administration · user |
  | de-collaboration-co-managed | Shared tenant administration · once | Email-security operations · user | Configuration review · once | Escalation and change support · once |
  | de-cybersecurity-standalone | Security control baseline · device | Threat monitoring and triage · device | Incident coordination · once | Security posture reporting · once |
  | de-cybersecurity-co-managed | Shared monitoring and triage · device | Investigation assistance · once | Incident escalation · once | Security review and recommendations · once |
  | de-network-standalone | Network monitoring · site | Configuration management · site | Maintenance coordination · site | Performance and incident reporting · once |
  | de-network-co-managed | Shared monitoring · site | Configuration review · site | Change assistance · once | Engineering escalation · once |
  | de-continuity-standalone | Backup policy and monitoring · computer | Recovery-objective design · once | Restore testing · once | Continuity and recovery reporting · once |
  | de-continuity-co-managed | Shared backup monitoring · computer | Recovery test assistance · once | Continuity planning · once | Exception and readiness reporting · once |
  | de-compliance-standalone | all four · once | | | |
  | de-compliance-co-managed | all four · once | | | |
  | de-awareness-standalone | Recurring awareness education · user | Phishing exercises · user | New-hire security onboarding · user | Leadership reporting · once |
  | de-awareness-co-managed | Campaign operations · user | Simulation support · user | Reporting and coaching guidance · once | Program improvement reviews · once |
  | de-communications-standalone | Solution design · once | Number and call-flow planning · site | User deployment · user | Administration and support · user |
  | de-communications-co-managed | Shared administration · user | Call-flow engineering · site | Deployment assistance · user | Carrier and incident escalation · once |
  | de-hardware-standalone | Requirements-based selection · once | Secure provisioning · computer | Deployment coordination · site | Asset and warranty tracking · computer |
  | de-hardware-co-managed | Standards-based sourcing · once | Provisioning assistance · computer | Deployment logistics · site | Lifecycle and warranty reporting · computer |
  | de-documentation-standalone | Asset and service inventory · once | Network and system diagrams · site | Configuration standards · once | Operational runbooks · once |
  | de-documentation-co-managed | all four · once | | | |
  | de-strategy-standalone | all four · once | | | |
  | de-strategy-co-managed | all four · once | | | |

- **`ADVISORY` policy** `{ shipmentMode: "none", installModes: ["remote_assist"], technicianPolicy: "not_needed" }` for `compliance_risk`, `documentation_standards`, `technology_strategy` (`:172-176`). Order unchanged.
- **`installModeDetail(mode, shipmentMode)`** (`:104-122`) → `{ label, detail }`, strings as quoted in §5.3. The label must say what actually ships (`docs/PUBLIC-SOLUTION-BUILDER.md` Step 05).
- **`resolveInstallMode(preference, view)`** (`:143-159`) → `{ mode, reason? }`: the preference when `view.installModes` includes it, else `preferredInstallMode(view.installModes)` with a reason ("shipping does not apply to this package" / "on-site is not offered for this package" / "remote setup is not offered for this package"). Because every family policy begins with `remote_assist`, the default never falls back.
- **`remoteSupportOptions(delivery)`** (`:329-337`): standalone → suggested `as_needed`; co_managed → `ongoing`; otherwise `unsure`. All four options selectable. `remoteSupportAvailable: true` remains on the view for the API passthrough only.
- **Label maps** `RELATIONSHIP_LABELS`, `PRICING_LABELS` ("Standard price" / "Preferred pricing" / "DE confirms"), `SUPPORT_LABELS`, `ASSESSMENT_LABELS`, `INSTALL_MODE_LABELS` exported once; imported by every Door 2 page and by `server/publicSolutionRequestCrm.ts`. No screen may render an enum. `RELATIONSHIP_LABELS[""]` ("Not chosen yet") is for the CRM and the rail gap line only; the contact summary never prints it beside an enabled Submit (§5.4).
- `technicianCopy("not_needed")` is "No on-site visit is offered for this package; everything is done remotely." (`:352`).
- The standalone offer name is `${family.label} — Standalone` with an em dash (`:373`); §5.3, §12 and the print sheet use that exact string.
- `derivePrimaryIntent(draft)` (= `recommendedIntent`, `solutionDraft.ts:386-394`): `assessment` if any resolved package is `required`; `consultation` if `deliveryPreference === "unsure"` with needs; else `quote`.

### 6.4 What is derived versus asked

| Derived (never asked) | From |
|---|---|
| Every line quantity | profile × `LINE_BASIS` |
| The relationship suggestion and its reason | `suggestRelationship(environment)` |
| The composed needs of a scenario | `composeScenario` |
| The installation default and each package's resolved mode | `preferredInstallMode`, `resolveInstallMode` |
| The remote-support suggestion | `remoteSupportOptions` |
| The intent and the submit label | `derivePrimaryIntent` (client) and `deriveSolutionIntent` (server) |
| The eight-block coverage | `coverageForFamilies` |
| The hints | `nextHints(draft, dismissedHints)` |
| The next step on the confirmation | `nextStep` from the POST response |

Asked exactly once: six profile facts (A), which needs (A or B), the relationship (C), setup confirmation (C, defaulted), support preference (C, suggested), four contact fields (D).

### 6.5 Autosave and save-to-DE semantics

- Local autosave on every change through `writeSolutionDraft` (kept). Sentence: **Saved on this device**.
- Save to DE: the one control labelled **Save progress** (kept) PUTs the draft (no contact, no notes); also debounced 2 s after a change once `serverDraftId` exists. Sentence when the PUT returns `durable: true`: **Saved to DE · Copy resume link**. When it returns `durable: false` or fails: **Saved on this device. Couldn't save to DE just now · Try again**. No service, store or CRM is ever named (`docs/PUBLIC-SOLUTION-BUILDER.md` "Public language rules"). "Across devices" appears only inside the resume-link copy.
- "Saved to DE" is claimed only for the content DE confirmed: the last PUT 2xx, or the copy the mount-time GET returned. A change made since (on another page, or before a reload) reads as "Saved on this device" until the autosave, which the mount-time read arms, has carried it. Storage blocked on the device: "Not saving on this device", and the page keeps working from a memory copy of the draft.
- Resume link: `${origin}/store/solution?draftId=<serverDraftId>` with the warning "Anyone with this link can open your draft. It never includes your contact details." Hydration on load: if the local draft is empty (no need and none of the six profile facts), hydrate silently; if it differs, DE's copy replaces it silently only when newer by more than five minutes (a device clock is not trusted to the second; the silent branch is the destructive one), otherwise ask. The handled `?draftId=` is dropped from the URL so a reload is a plain load. A link to a sent solution or an unknown id leaves this device's draft in place and says so (§5.3); when the mount-time read fails or answers with another draft, what DE holds is unknown and the autosave carries this device's content.

---

## 7. Server and post-submit

All of this is in `server/publicSolutionRoutes.ts`, `publicSolutionRequestStore.ts`, `publicSolutionRequestPersistence.ts` and `publicSolutionRequestCrm.ts` at `0d2f6df4` except the items marked **PR 2 server touch** and, from the second review round, the draft view `publicSolutionDraftView` (GET and PUT answer without contact fields or notes), the stored `suggestion`, and the explicit-`""` relationship rule on PUT. Nothing from 4cee840c is renamed or re-implemented.

**GET `/api/public/solutions/request`** (`routes:136-176`): returns the session's most recent **draft**, never a submitted record; when the session's or `?draftId=`'s record is submitted the response is a fresh draft with `previousReference`. The draft view (`publicSolutionDraftView`, also PUT's answer) never carries the four contact fields or notes, so a resume link, or a session it re-pointed, cannot read what a rolled-back submit left on the record; the contact step no longer prefills from it. Returns `durable: boolean` (`durablePersistenceAvailable()`). `sessionId` is read from the cookie only (`readSessionId`, `:78-81`). Rate limited by `apiGeneralRateLimiter`; `server/index.ts:82-86` **redacts** (not hashes) `draftId`, `reference` and `sessionId` query values.

**PUT** (`:184-193`): `draftInput` carries no contact fields and no notes (the documented contract; `map:contradictions` 9 closed). Accepts `selectedNeeds[].source`, `selectedNeeds[].installation` and `suggestion` (`{ value: standalone | co_managed, accepted }` or null; a present but malformed value is stored as null; an absent field keeps what DE holds). `deliveryPreference` `""` sent explicitly is stored as `""` (a kept local copy over DE's); an absent field keeps what DE holds. Only the buyer or Use this writes a relationship. `upsertPublicSolutionRequestDurable(…, { forkSubmitted: true })` forks a fresh draft on a submitted base and returns `{ request, durable, forked, previousReference }`.

**POST** (`:195-300`; keeps the 20/hour limiter, fail-closed 503 with rollback, `durable: database | crm | memory`, `WebsiteLeadLike` `LEAD_CREATED`, no-downgrade replay):
1. Honeypot (`company_website`, `website`, `fax`) non-empty → 400, no record, no lead (`honeypotTripped`, `:84-88`; §16.13).
2. Four contact fields validated (`EMAIL_RE`, ≥ 7 digits).
3. `submissionProblem` validates ≥ 1 need and a complete profile **before** any contact is upserted (`:218-224`). **PR 2 server touch:** the 400 body gains `code: "NEEDS_REQUIRED" | "PROFILE_INCOMPLETE" | "RELATIONSHIP_REQUIRED"` beside `error` so the contact page renders the disabled panel, not a field error (§5.4). `RELATIONSHIP_REQUIRED` fires only when `deliveryPreference` is `""`; `unsure` is submittable.
4. `intent` is recomputed by `deriveSolutionIntent` on every write (`store:123-128`); the body value is ignored.
5. `selectedNeeds[].installation` validated against that family's `installModes`, else replaced by the family's preferred mode.
6. A submitted base is a replay without re-upserting.
7. Response: `{ request, correlationId, reference, crm, replayed, durable, intent, nextStep: "assessment" | "consultation" | "quote", acknowledged: false, message }`.

**Reference** (`store:78-104`): `DE-` + 6 Crockford base32 characters (`0123456789ABCDEFGHJKMNPQRSTVWXYZ`, no I, L, O or U) derived deterministically from the `correlationId` (first 30 bits of its SHA-256, `attempt` salted on the astronomically unlikely collision), so a replay after a restart yields the same reference with no shared state. Pattern `/^DE-[0-9A-HJKMNP-TV-Z]{6}$/`; `normalizeSolutionReference` accepts what a buyer types (lower case, missing hyphen, I/L for 1, O for 0). Stored on the record and indexed in memory and by `payload->>'reference'` in Postgres. Shown in Oxanium; the full `correlationId` sits in a disclosure on the confirmation. Deterministic wins over random minting because it makes the replay case free.

**GET `/api/public/solutions/request/status/:reference`** (`routes:178-182`; `publicSolutionStatusView`, `store:563-571`): returns exactly `{ reference, status, submittedAt, durable: boolean, nextStep }`. No name, company, email, phone, notes, profile, packages **or CRM status**. Unknown or draft → generic 404. `Cache-Control: no-store`; `referenceLookupRateLimiter` 120 / 15 min. `replayed` is a POST-response field and is not part of this view; the confirmation reads it once from the POST result and keeps it in the archive.

**Store and persistence**: `upsert` forks a submitted base; the memory map evicts submitted records after 24 h and idempotency entries after 24 h (`SUBMITTED_MEMORY_TTL_MS`) — **this is a cache**, not the record: the record is Postgres (production requires it, 4cee840c), `getPublicSolutionRequestByReferenceDurable` falls through to `loadPublicSolutionRequestByReference` after eviction, and a replay after eviction is matched by the durable idempotency lookup, so submitted requests never expire (`map:constraint_set` 56) and the day-scoped hash rule (`constraint_set` 19) holds.

**CRM description** (`buildPublicSolutionRequestDescription`, `crm:47-110`, also the `LEAD_CREATED` message): reference, intent word, relationship label or "Relationship: DE to recommend", suggestion shown and used / declined, profile in words, and per need: family label and public offer name (or "DE confirms Standalone or Co-Managed"), pricing label, assessment label, sized lines from `buildSolutionPackage` + `LINE_BASIS`, `Delivery & Setup: <label> (DE's first choice | chosen)`, shipping words, `Started from situation: <scenario id>`; then the remote-support label and the on-site request when made. Public words only. Hint ids are not sent. Lead_Source stays "Web Download" (`server/zoho/leadTaxonomy.ts`).

**Post-submit on the client** (PR 2): on 2xx call `archiveSubmittedDraft(summarizeForArchive(draft, response, maskedContact))` then navigate to `/store/solution/submitted/:reference`; focus lands on the h1.

**What DE does next** (truthful copy, no durations): a person reads the solution; DE emails or calls to confirm fit, scope, delivery and pricing; nothing is billed until the buyer says yes; when `nextStep === "assessment"` DE contacts the buyer to schedule the conversation first, the formal CSRA is $2,500 when scoped (`shared/canonicalCsra.ts`; `client/src/data/campaigns.ts:120`).

**Wording under DB-down**: production returns 503 `DURABLE_STORAGE_REQUIRED` unless the CRM recorded it synchronously. The contact page renders the `OfflinePanel` (§5.4) and never says "saved". Outside production the `memory` path renders the "recorded" variant (§5.5). The buyer is never told which store, service or CRM was involved.

**Retry**: `Try again` re-POSTs with the same `idempotencyKey` (`${submitAttemptId}|${email}`, §6.2) and the OfflinePanel stays mounted with its button reading "Sending…"; the server's rollback (`unsubmitPublicSolutionRequest`) made the memory record a draft again so the retry is a real submit, not a replay. A reload after a lost response keeps the attempt id on the draft, so that retry replays; "Start another solution" clears it, so a second solution that happens to share needs, relationship and address is a new submit.

**Rejected critique.** Two findings said the tree mints references at random from an alphabet with L and U, serves `/api/public/solutions/submitted/:reference`, and exposes `crmStatus`, `deliveryPreference`, `selectedNeeds` and `environment` in the status view. Verified against `0d2f6df4`: `publicSolutionRequestStore.ts:85-104` derives from the correlation id's SHA-256 with the alphabet above; `publicSolutionRoutes.ts:178` registers `…/request/status/:reference`; `publicSolutionStatusView` (`store:563-571`) returns the five fields and nothing else; `publicSolutionRoutes.test.ts:299-328` asserts the same pattern and path. The design matches the code; only the `replayed` key was wrong in the draft and is removed above. Kept from those findings: the `VITEST` skip on the limiter (`routes:55`) and `resolveInstallMode` returning an object, both applied in §14.

---

## 8. Visual system and theme

**Named theme:** *One product, electric channel.* The one DE theme (`design/UI-STYLE-RULES.md` §1) expressed through the Store's locked accent and V4's discipline, at catalog density.

**Field steps.** Page canvas `--de-surface` (`#0a0a0a`, the field the Store already stands on and the atmosphere gradient ends in) under `StorePageAtmosphere` (KEEP today's 0.44 on `/store`; 0.28 on family and workspace; 0 on contact and confirmation; the header band on `/store` is the only atmospheric moment). Chapters are hairlines (`--de-hairline`) and space (`py-10 md:py-14`), never rounded islands. `--de-raised #151217` is spent on exactly two things: the SolutionRail panel and the SolutionBar (its sheet, and its launcher pill at 96%). Invalid-field lines and error text derive from the theme's `--destructive` (lifted toward white on graphite, as is on paper); no error colour is invented. Paper `--de-paper` with white cards appears exactly twice in the flow: the contact step, where the buyer signs (`design/UI-STYLE-RULES.md` §6 rule 3), and the held record on the confirmation and in print; paper ink is `text-de-bg` (`#050312`), as V4's paper `Chapter`, and no near-black is invented. Graphite is where the buyer builds; paper is where the buyer signs and holds.

**Electric channel** (`--de-accent-rgb 29 111 242`, ink `111 179 255`, via `text-de-accent-ink` / `bg-de-accent` / `border-de-accent`): wayfinding and state only. Step numbers, the journey rail's fill, checked ChoiceTile borders, the "Added ✓" state, quantities and counts in Oxanium ink, links, the pathway "You are here", suggestion chips, touched coverage blocks, the Risk & Exposure slab's top rule (V4's magenta rule becomes electric here), the confirmation's hairline draw. Never a wash, never a filled panel, never a purple tile. The Door 2 variables (`--d2-accent`, `--d2-accent-ink`) are declared on `:root, [data-accent]`, never `:root` alone: a custom property resolves `var()` where it is declared, so a `:root`-only declaration froze them to the default magenta under the electric canvas (found in the approved-round review; the smoke now asserts the computed ink is `rgb(111, 179, 255)`). The portalled Your Solution sheet carries `data-accent="electric"` itself.

**Guidance and separation (Joe, 2026-10-03).** Joe: "you need more dynamic animations in the store UI that lead the user to do a task … and some type of color accent or background cards to separate tasks and categories." This extends the Stations precedent and amends the "never rounded islands" and "never a wash" lines above for these surfaces only. All are electric, use tokens only, and live in `store-builder.css` under "Guidance and separation": (1) situation tiles are cards (`.d2-grid--cards`: hairline border, 3px top edge that turns electric when added, a 7% electric wash into `--de-raised`, a 3px hover lift); (2) each goal group is a card (`.d2-group--card`: 6% electric wash, an electric bar before the group heading, row hover tint); (3) a "Start here" chip with a bobbing chevron (`.d2-cue`) sits above the situations until the first need is added; (4) the family page's forward actions sit on a "Next step" card (`.d2-next`, electric left edge); (5) the screen's forward primary carries a trailing arrow that nudges (`StoreAction lead`), and plays a magenta ring three times after each add (`StoreAction attention`, keyed to `pulseKey`); (6) cards marked `data-d2-reveal` rise in once on scroll (`useStoreReveal`). They start hidden only under `html.d2-reveal-ready`, which the hook sets, so no JS means no hidden content. Magenta stays the single forward action; the contact step and the confirmation keep no motion.

**Amendment (Joe, 2026-10-09, site PR #551).** The Oct 4 flag layout dropped (2) and (3); they return in its vocabulary. (2) With "All" selected and no search, each business goal in `#families` is its own panel (`.d2-goalcard`: `--f-fill` with an 8% electric wash at the top, a 3px electric top edge, an electric bar before the goal heading, and a solution count); a goal filter or a search shows the flat lineup. Cards mounted by a switch between the two skip the rise-in. (3) The "Start here · choose one below" chip (`.d2-cue--flag`) is magenta, approved by Joe from the preview ("yes merge"). It shows only before the first need is added, when the screen has no forward action yet, so it never competes with the single magenta forward action.

**Magenta `#D3126A`**: the single forward action per screen and nothing else. Index: `Review Your Solution` (once a need exists). Family: `Add & review package`. Workspace: `Continue to contact details`. Contact: `Submit Solution`. Confirmation: none, except the locked assessment CTA when required and `BOOK_ALIGNED`. Focus ring stays pink `#ec4899` 2px offset 2 per `design/UI-STYLE-RULES.md` §2, which binds `client/`; V4's `RING` is `ring-de-accent-ink`, a difference §16.14 puts to Joe rather than resolving here. Gold appears only in the wordmark. Violet is absent from the Store. The 13 `FAMILY_ACCENTS` icon hues are retired for one electric `IconWell` (§16.12 R6). The sitewide nav's "Cyber Risk Assessment" button is header chrome under the colour lock's Shared rule (the primary marketing CTA stays magenta sitewide, store chrome included), not a second page action; the announcement strip and the footer CTA, which were page-level sells, are off Door 2 (§16.2).

**Type**: the V4 `T` scale copied as literals into `client/src/components/store/door2/tokens.ts` with a comment naming `origin/claude/homepage-v4` 583b4cd8 `V4Primitives.tsx` as the source, to be replaced by an import once the homepage-v4 follow-up PR merges into `main`: display `clamp(2.4rem,6vw,3.6rem)` (h1 on `/store`, V4's `T.display`), h2 `clamp(1.75rem,4vw,2.7rem)` tracking `-0.015em` leading 1.08, h3 `clamp(1.1rem,1.8vw,1.45rem)`, lede `clamp(1rem,1.4vw,1.1rem)`, body 15px, small 13.5px, label mono 10.5px uppercase tracking 0.18em, mono 12.5px tabular, micro 9.5px tracking 0.16em. Space Grotesk for the display and headings, Inter body at 58ch, Oxanium only for step numbers, quantities, counts and the reference. StepLabel reproduced `ChapterLabel` exactly (`T.label`, number in accent ink, an `h-px w-8` hairline dash, `mb-5`) until Joe chose Stations on 2026-10-01: an unnumbered eyebrow keeps that form; a numbered step is a station (§6.1 Stations).

**Three visual forms, each chapter its own composition.** The Store has three ways of drawing a thing, and every chapter composes them differently so no two chapters read as the same chapter twice (V4's correction):

- **Cell** (a hairline top rule, no border box, `border-t py-5`, `T.label` marker): family cells in the goal groups, scenario tiles, next-step rows on the confirmation, comparison rows. Families are a four-column list under a goal h2; scenarios are two columns with the composed families as marks; next steps are a numbered vertical list. Same rule, three different compositions.
- **Sheet** (hairline rows label | Oxanium quantity, a header row, footer actions): every bill of materials in compare, single, preview and print modes.
- **Tile** (a native radio or checkbox inside a label; hairline at rest, electric border + ink when checked, pink focus ring, `data-de-jelly-choice`): every exclusive choice.

The pathway line and the coverage band are neither cells nor tiles: the pathway line is one ruled row echoing `V4PathChapter`'s A/B/C order, and the coverage band is `V4BlocksChapter`'s wall-and-slab in the electric channel.

**Components** (`client/src/components/store/door2/`; the directory is covered by `door2Leakage.test.ts` without editing its list). Names in the working tree at audit time are given where they exist:

| Component (file) | Props |
|---|---|
| `Door2Frame` (`SolutionChrome.tsx` or its own file) | `intensity, jelly?, bar?: "review" \| "continue" \| null, children` |
| `StoreChapter`, `StepLabel`, `Cell`, `LiveLine`, `StoreAction` (`primitives.tsx`) | `StepLabel: n?, srText?, children, paper?` · `Cell: label?, title, detail?, href?, action?, state?: "idle" \| "added" \| "current", paper?` · `StoreAction: variant: "primary" \| "secondary" \| "quiet"` |
| `IconWell` (existing, `components/visual`) | electric ink only |
| `ChoiceTiles` (`ChoiceTiles.tsx`) | `name, value, options[{value,label,detail,tag?}], onChange, columns?` (native radios, arrow keys) |
| `PackageSheet` (`PackageSheet.tsx`) | `view \| { standalone, coManaged }, mode: "single" \| "compare" \| "preview" \| "print", onChange?, onRemove?` |
| `RelationshipCompare` (`RelationshipCompare.tsx`) | `family, profile, suggestion?, current?` |
| `CoverageBand` / `CoverageChips` (`Coverage.tsx`) | `coverage: CoverageView, onAdd?, open?` |
| `HintRow` / `SuggestionLine` (`Guidance.tsx`) | `hint, onAction, onDismiss` · `suggestion, onUse, onDecline` |
| `ProfileStrip` (export `SolutionProfileForm`) / `ProfileLine` | `environment, onChange, collapsed?` |
| `NeedRow` / `UndoRow` (`NeedRow.tsx`) | `need, family, onRemove, onUndo` |
| `ScenarioTile` (`ScenarioTile.tsx`) | `scenario, compose: {add, alreadyIn}, onStart, onUndo, suggestion?` |
| `JourneyRail` (`JourneyRail.tsx`) | `steps: STORE_STEPS, current, complete?` (`aria-label={STORE_JOURNEY_SENTENCE}`) |
| `SolutionRail` / `SolutionBar` / `YourSolutionSheet` (`SolutionChrome.tsx`) | `mode: "review" \| "continue", status[], primary, help?` |
| `HelpRow` | `seed: string, reference?` (Ask DE + Call) |
| `ReferenceMark` | `reference, correlationId` |
| `OfflinePanel` (`OfflinePanel.tsx`) | `onRetry, mailto, phone` |
| `ProposalSheet` (`ProposalSheet.tsx`) | `archive \| draft, print?` |

All Store CSS (ChoiceTile states, quantity fade-through, stagger, print sheet, the `html[data-de-store-bar]` canvas padding, reduced-motion kill switch) ships in `client/src/styles/store-builder.css`, imported only by `StorePageAtmosphere` (Store chunk); the entry stylesheet gains zero bytes (4.87 kB headroom, `map:constraint_set` 40).

**The engineered peak** is `/store/solution`: the package reveal. Quantities settle once from basis phrase to number, the coverage wall fills as structure, the remote-first setup is already checked. It is louder because it is the only thing on the page that moves, not because of colour. **The signature moment** is on `/store`: a scenario tap lights the composed needs in sequence and the bar count pulses once, the buyer's first proof that the Store does the work.

**Rejected critique.** None here; both P0 findings on the V4 anchoring are applied in full (§1, this section, §14.28).

### 8A. Use cases and scenario starters

The list is `client/src/data/solutionScenarios.ts` (committed in `0d2f6df4`, tested by `solutionScenarios.test.ts`), consumed as-is; Joe approves the list before it renders publicly (§16.3). Each tile composes 2-3 canonical families; each "why" line paraphrases that family's own public copy; relationship is `profile` (the buyer's internal-IT answer decides) unless the situation itself implies one.

| # | id | Title (buyer's words) | Composes | Relationship hint |
|---|---|---|---|---|
| 1 | phishing-close-call | `A phishing or spoofed email got through` / pressure `Someone clicked, or a client got mail pretending to be us.` (amended per §16.3a, approved 2026-09-28; the id is kept so drafts that recorded it as `source` still resolve) | security_awareness, email_collaboration, identity_access | profile |
| 2 | insurance-questionnaire | Cyber-insurance renewal sent a questionnaire we can't answer | compliance_risk, identity_access, backup_continuity | profile |
| 3 | second-location | We're opening a second office | network_connectivity, business_communications, hardware_lifecycle | profile |
| 4 | it-person-left | Our only IT person just left | it_operations, documentation_standards, endpoint_devices | standalone, reason shown |
| 5 | internal-it-stretched | Our internal IT team is stretched thin | it_operations, cybersecurity_operations, endpoint_devices | co_managed, reason shown |
| 6 | new-hires-fast | New hires need laptops and accounts fast | hardware_lifecycle, endpoint_devices, identity_access | profile |
| 7 | auditor-evidence | A client or auditor asked for our policies and evidence | compliance_risk, documentation_standards, technology_strategy (**§16.3b**) | profile |
| 8 | ransomware-recovery | We don't know if we'd recover from ransomware | backup_continuity, cybersecurity_operations, endpoint_devices | profile |
| 9 | hybrid-byod | Half the team works from home on their own devices | endpoint_devices, identity_access, email_collaboration | profile |
| 10 | phone-contract-ending | Our phone system is old and the contract is ending | business_communications, network_connectivity | profile |

**Data shape** (unchanged): `{ id, title, pressure, familyIds, why: Record<familyId, string>, relationship: { suggest: "profile" } | { suggest: "standalone" | "co_managed", reason } }`. Tapping records `needs[].source = id`, adds only the families not already in (`composeScenario`), offers one persistent Undo that removes exactly what it added, and shows the relationship hint as a SuggestionLine (in the UndoRow and the sheet) that is never applied without a click. The committed test asserts every family appears in at least one scenario.

**Rejected critique.** The finding that scenario 7's third family "reverses a staged, tested decision" cites a test clause ("technology_strategy is intentionally catalog-only") that is not in the committed test: `solutionScenarios.test.ts:37-41` asserts `unreachable` is `[]`, and `solutionScenarios.ts:117-126` carries `technology_strategy` in scenario 7. The staged behaviour **is** the every-family one. The decision is still surfaced on its own as §16.3b, with the build defaulting to what is committed.

### 8B. Automation and guidance

Every automation shows its input and its reason, can be undone or declined, and never writes state without a click (except the two defaults the buyer is asked to confirm, marked below).

| Behaviour | Input | Output | Override | Explanation shown |
|---|---|---|---|---|
| Sizing | profile × `LINE_BASIS` | every quantity, live | edit the profile anywhere | LiveLine "Sized for …"; basis phrases when unsized |
| Quick-size | chip tap | users set; "Match users" copies users into computers | type | none needed |
| Scenario compose | tile tap | families added with `source` | Undo (persistent) | "Added X, Y, Z · Undo"; per-family why lines on the tile |
| Relationship suggestion | `internalIt` (or a scenario's hint) | SuggestionLine with reason | Use this / Not now (decline persisted) | "Suggested from your profile: … because …" |
| Setup default (**auto-applied, confirm**) | `INSTALL_MODE_ORDER` ∩ selected packages | `installation = remote_assist` on first non-empty render; reset when the union shrinks past it | pick another tile | "DE's first choice" caption + rule line; the reset is announced |
| Per-package resolution | preference × each package's modes | one line, itemised only when packages differ | change the preference | the fallback reason in the line |
| Support suggestion (**auto-applied, confirm**) | `remoteSupportOptions(deliveryPreference)` | suggested tile pre-checked | pick another | "Suggested" caption |
| Coverage | `coverageForFamilies(needs)` | eight-block structure | Add link per available block (counted in the three-suggestion cap) | caption "Structure, not a score." |
| Hints | `nextHints(draft, dismissedHints)`, max 3 across the page | HintRows | action or Dismiss (persisted) | reason quotes the source family's prerequisite or boundary |
| Intent and submit label | `derivePrimaryIntent` | label; next-step line | none (policy) | "An assessment comes next for …" / "DE will recommend" |
| Assessment routing | `nextStep` in the response | the confirmation's band | none (policy) | the $2,500 framing, conversation first |
| Save to DE | PUT result | the persistence sentence | Try again | three sentences (§6.5) |
| Resume | `?draftId=` | hydrate or ask | choose | "Use the saved copy from DE, or keep what is on this device?" |
| Ask DE seeding | `solutionAdvisorSeed(draft, …)` | the Desk opens seeded | edit the message | visible in the chat |

**Eight-block coverage map** (`client/src/lib/solutionGuidance.ts` `FAMILY_SECURITY_BLOCKS`, conservative; Joe approves, §16.3): identity_access → Identity & Access · endpoint_devices → Endpoint · email_collaboration → Email & Collaboration · network_connectivity → Network · cybersecurity_operations → Detection & Response · security_awareness → Human Risk · compliance_risk → Risk & Exposure · Browser & Web → no family, shown as "Part of Handle Our IT →" · it_operations, backup_continuity, business_communications, hardware_lifecycle, documentation_standards, technology_strategy → outside the eight, listed under "Also in this solution (operating layer, not a security block)". States: `in_solution` / `available` (with `Add <family>`) / `handle_our_it`. `complete` is unreachable on Door 2 and never rendered; no percentage, score, ring or "8 BLOCKS" chip (`design/PROOF_SYSTEM.md:33`). The wall-and-slab form, a disclosure under 1024 and the three-suggestion cap keep four grey blocks beside three lit ones from reading as 3/8.

**"DE recommends next" rules** (`HINT_RULES`, in priority order, ≤ 3 shown after dismissals): profile-incomplete (with needs) → Finish the profile; co-managed-without-internal-it → Let DE recommend; assessment-required → explanation only; onsite-chosen-when-remote-available → Use Remote DE setup; the seven add-family pairs (it-ops-excludes-security, it-ops-excludes-backup, cyber-without-recovery, awareness-without-email-controls, hardware-without-endpoint, communications → network, compliance → documentation), each quoting the source family's boundary or prerequisite; standalone-with-internal-it → Compare Co-Managed. Every rule id is kebab-case and unique; every add-family and relationship reason is ≥ 30 characters and names its source family (`profile-incomplete` is a profile hint and has no source family by design); no reason contains a percentage, "discount", "DE managed" or a duration. The `standalone-with-internal-it` reason (`solutionGuidance.ts:327`) changes "never a blanket discount" to "never a blanket price cut" in PR 2 commit 8 so the word is absent from every Door 2 surface.

---

## 9. Motion

Motion communicates state, hierarchy, continuity and feedback (`design/MOTION_LANGUAGE.md`; `map:constraint_set` 32). Native scroll everywhere. Nothing animates on mount: the jelly settle keys on a transient `data-de-just-selected` attribute set on change, not on steady-state `aria-checked` (defect 48). All durations `ease-out` from the two existing easings in `store-jelly.css`.

**Scoping (decoupled from the gesture lock).** `store-jelly.css` stays keyed to `html.de-store-gesture-lock`, and `useStoreChromeGestures` sets that class only where a `.de-store-h-rail` exists (the warehouse), so none of its rules, the side-sheet keyframe and the steady-state `aria-pressed` settle among them, reach Door 2. Door 2's jelly lives in `store-builder.css` under `html.de-store-jelly`, which `Door2Frame` sets on `/store`, the family pages and the workspace only: tile, toggle and `[data-de-jelly-choice]` press/settle keyed on the transient attribute, and the bottom sheet's own rise (`d2-sheet-in`). The contact form and the confirmation therefore carry no jelly and no transform motion whatever `isStorePath` says.

| What moves | Why | Duration | Reduced motion |
|---|---|---|---|
| ChoiceTile and ScenarioTile press/settle (`data-de-jelly-choice`) | feedback | existing jelly tier | none |
| Composed cells flip to "Added ✓" in sequence on a scenario tap | shows what was added | 60ms stagger, 150ms fade each | all at once, instant |
| SolutionBar count pulse on add | feedback | 200ms, once | none |
| Quantities fade-through from basis phrase to number when the profile completes | the object reacting to the buyer's facts | 180ms, 40ms stagger, ≤ 8 rows, once per completion | instant |
| PackageSheet cross-fade on relationship change | continuity | 200ms | instant |
| Coverage block to electric when touched | state | 150ms | instant |
| Rail status line tick when ready | state | 150ms | instant |
| NeedRow / UndoRow height + opacity (only a row added after the page painted rises, `data-d2-entered`; rows present at mount or hydrated from DE stand still, and a row that returns after a remove is an add again) | continuity | 160ms | instant |
| Save control spinner → check | state | while pending | text only |
| Sheet open (bottom) | short and local | `d2-sheet-in` 320ms ease-out in `store-builder.css` under `html.de-store-jelly`, rising from the bottom edge and never past it | none |
| Confirmation hairline draws under the h1 | the one loud moment | 600ms, once | static line |

No hover wobble (`data-de-jelly="feature"`) anywhere on Door 2. No transform motion on PackageSheets, the contact card, the rail or the confirmation. No flying chip, no count-ups, no parallax beyond the kept atmosphere. No timed disappearance of any control (the Undo row persists; WCAG 2.2.1). `prefers-reduced-motion: reduce` collapses every transition and animation in `store-builder.css` to 0ms via one media query and every page reads complete.

**Amendment (Joe, 2026-10-03).** The guidance cues in §8 "Guidance and separation" are sanctioned motion: the scroll reveal (480ms once), the card hover lift (200ms), the "Start here" chevron bob and the primary arrow nudge (both looping, like the journey beacon), and the post-add magenta ring (1.3s × 3). `prefers-reduced-motion: reduce` turns all of them off and shows every revealed card immediately.

---

## 10. Responsive

390 is authored first, then 768, then 1440; verified at all three (`map:constraint_set` 61).

- **Zero horizontal overflow** at 390 / 768 / 1440 on all five routes, measured (`document.scrollWidth === document.documentElement.clientWidth`); `min-w-0` on every grid child; `overflow-x: clip` on the canvas.
- **390**: one column everywhere with the same top rules; the pathway line as one sentence; scenarios a vertical list; the profile row collapsed, expanding to 2×2 + two radio rows; the family comparison stacks Standalone then Co-Managed with a jump link; goal groups as disclosures after the first; the workspace's rail contents move into the SolutionBar sheet; the coverage band closed by default; contact card first, summary in a disclosure; confirmation one column, actions full width. Tap targets ≥ 44px (steppers and tiles 48px). No hover-only affordance carries meaning. Chrome budget as §5.6, measured with the banner present. No content beneath fixed chrome.
- **768**: two-column scenarios, families and profile fields; the comparison side by side; the SolutionBar persists (the rail appears at ≥ 1024); goal groups all open.
- **1440**: the two-column grid with the sticky rail; contained canvas rules from `client/src/index.css:229-290` apply.
- **Lengths** (reported in the completion report): `/store` ≤ 7 viewports at 390 (pass) with ≤ 5 the reported target, ≤ 4 at 1440; `/store/solution` with two needs ≤ 6 at 390; family ≤ 5 at 390.
- The horizontal gesture lock (`useStoreChromeGestures`) attaches its listeners and sets `html.de-store-gesture-lock` only on the warehouse routes (`isWarehousePath`, decided by route on every location change because the rails mount lazily behind the warehouse gate), so swipe-back returns on Door 2 pages, which have no rails and carry no lock class (defect 47); `isStorePath` keeps deciding the white cookie surface.

---

## 11. Accessibility

WCAG 2.2 AA (`map:constraint_set` 41).

- One `<h1>` per route; h2 per chapter, h3 per package or cell; no skipped levels; the index explainer's five h2s are gone (§16.12 R7).
- Every exclusive choice is a **native radio group** (ownership, internal IT, relationship, installation, remote support): arrow keys and one tab stop, no ARIA invention. `aria-pressed` only on true toggles (Add need, goal "All" filter).
- **One polite live region per page**, owned by `Door2Frame`: every LiveLine, count line, save state, add, remove, undo and reset writes to it through one `announce()`; the LiveLines themselves are plain text with no `role`. Errors use `role="alert"` in the contact card. The confirmation h1 sits in a `role="status"` region and receives focus.
- Disabled primaries carry `aria-describedby` pointing at the visible reason; no generic "Finish the steps above".
- Per-field validation with `aria-invalid` + `aria-describedby`; focus moves to the first invalid field on submit; focus never moves on add or on profile auto-expand.
- Contrast ≥ 4.5:1 for body text measured on the composited page: no `text-white/40` on small text; `text-white/55` minimum for detail text on graphite; placeholders are hints beside visible labels; the SolutionBar never renders below full opacity.
- Decorative SVGs `aria-hidden`; IconWell glyphs never carry meaning alone.
- Keyboard path index → family → workspace → contact → confirmation completes with visible focus at every stop; the sheet is focus-trapped, Escape closes and restores focus; nothing else traps.
- Motion is never the sole carrier of meaning: anything the stagger, pulse or fade says, text and the live region also say. No control disappears on a timer.
- `aria-current="page"` on the pathway "You are here" and on the journey rail's current step; the rail's `aria-label` matches its visible step words (label-in-name).

---

## 12. Truth and copy rules

**Allowed and required**

- Company is "Digerati Experts" or "DE"; the door in nav is "Store", on the page "Solve a Business Need"; the object is "Your Solution"; the action is "Submit Solution". The visible eyebrow "Business Solution Builder" and the `<title>` "IT Solutions Store | Digerati Experts" are replaced (§16.12 R8) by the StepLabel `SOLVE A BUSINESS NEED` and the title `Solve a Business Need | Digerati Experts`; the canonical doc keeps "Business Solution Builder" as the internal name of the thing.
- Pricing appears only as `Standard price`, `Preferred pricing` (with "where sharing lowers the work") and `DE confirms`. Never a percentage, never a price, except the canonical CSRA framing "Conversation first. Formal Cyber Security Risk Assessment $2,500 when that document is scoped."
- Standalone: "You, or your IT provider, run it day to day"; DE sets it up remotely unless the buyer chooses to do it themselves. Never "DE managed", "DE manages", "DE operates" on any Door 2 surface; the standalone offer `name`/`summary` fields in `curatedSolutions.ts` that say so are never rendered (overridden in `buildSolutionPackage`); the copy-only naming sweep (`docs/DE-NAMING-CANON.md:66`) stays a separate PR.
- Delivery & Setup is listed, defaulted and printed in DE order everywhere: Remote DE setup → shipped or guided self-setup → On-site technician (Truck-Roll, Trip Charge and Tech Labor, scope-dependent, last resort). Never a ship date, technician date or ETA; timing language only from `shipmentCopy`.
- Quantities only from the profile through `LINE_BASIS`; otherwise the basis phrase.
- Persistence: "Saved on this device" / "Saved to DE" only when `durable: true` / "Couldn't save to DE just now".
- Submit success only after the server's durable answer; "Recorded with DE" for database or crm; the memory variant says "recorded" and never "sent".
- The confirmation shows public names, a masked email and phone, the reference, and the policy-chosen next step; no email is promised; a required assessment is "DE contacts you to schedule the conversation", never "DE books".
- Suggestions and hints always show their reason and are labelled "Suggested from your profile" or quote the source family.
- Phone and NAP from `shared/companyContact.ts` only; hours are not shown until they live there.
- The sanctioned line appears on `/store` (close) and the contact card.

**Forbidden, in two lists (grep-gated in §14.21):**

(a) **Exact phrases**, matched case-insensitively in visible text: `Add to cart`, `Pay Now`, `vendor catalog`, `managed-services contract`, `composed solution request`, `DE staff`, `DE managed`, `DE manages`, `DE operates`, `replies in`, `ships in`, `sent to sales`, `blanket discount`, `discount`, `guarantee`, `SLA`, `ETA`, `8 BLOCKS`, `Business Solution Builder`, `IT Solutions Store`, bare `Digerati` (not followed by ` Experts`), `free` within 40 characters of `assessment`, `across devices` outside the resume-link copy, `score` as a whole word, any vendor name in the `door2Leakage.test.ts` list, `sku`, and `\d+\s*%`.

(b) **Enum tokens**, matched as whole words (`\b…\b`) in visible text and in `aria-label`, `aria-describedby` targets, `alt` and `title` attribute values only: `co_managed`, `remote_assist`, `self_install`, `as_needed`, `not_required`, `onsite`, and bare `unsure`. Enum values are **allowed** in `value=` attributes of the native radios, in `data-*` attributes, in CSS variable names (`--de-store-cart-h`) and in the `/store/checkout` path string; `checkout` and `cart` are therefore not on list (a).

**Naming canon**: `docs/DE-NAMING-CANON.md` applies to labels the Store renders; network offer names are shown through `buildSolutionPackage` (standalone as `Network & Connectivity — Standalone`, co-managed by offer name) until the sweep lands.

**Rejected critique (partly).** The finding that `quote` and `assessment` cannot be banned is right and both are gone from the lists; "discount" stays banned because both strings that carried it are rewritten (§5.2, §8B) and the scenario test already bans it.

---

## 13. Handoffs

| Handoff | Label (exact) | Target | Where | Source |
|---|---|---|---|---|
| Handle Our IT | `Handle Our IT` (pathway line); `Prefer DE to run all of IT? See Handle Our IT.` (family page; workspace below the save row) | `/solutions/proactive-ecosystem` | `/store` header, family page, workspace | `map:handoffs.handle_our_it` |
| Client Marketplace | `Client Marketplace` (pathway line); `Client? Open Client Marketplace` (confirmation) | `portalMarketplaceLoginUrl()` = `https://portal.digeratiexperts.com/portal/login?returnTo=%2Fportal%2Fmarketplace` | `/store` header, confirmation | `client/src/lib/portalUrls.ts:37-44`; never apex `/portal/*` |
| Assessment | `Get My Cyber Risk Assessment` (`CTA.primary`) | `/book?ref=DE-XXXXXX` | confirmation, only when `nextStep === "assessment"` and `BOOK_ALIGNED` | `client/src/lib/ctaCopy.ts:5`; `map:handoffs.assessment`; framing per §12; `/book` copy and its `ref` reader are §16.6 |
| Phone | `Call 325-480-9870` (label `Sales & Business` in the accessible name) | `PRIMARY_PHONE.telHref` = `tel:+13254809870` | incident scenarios on `/store`; HelpRow on family, workspace, contact, confirmation; the dock's quick menu on `/store` | `shared/companyContact.ts:67-74` |
| Ask DE | `Ask DE about this need` / `Ask DE about this solution` / `Ask DE about DE-XXXXXX` | `openMspAdvisor({ context: "store", seedMessage: solutionAdvisorSeed(draft, …), tab: "chat" })` from Door 2 callers only; `ZohoASAPWidget.tsx`, `deskAskDeMotion.ts` and `STORE_ADVISOR_SEED` are **not** edited in PR 2 (the explicit `seedMessage` wins in the widget's existing listener). In the approved round `deskAskDeMotion.ts` classifies the store page by `isDoor2Path` and `STORE_ADVISOR_SEED` speaks builder terms; the widget's own pathname fallback (`ZohoASAPWidget.tsx`, still `includes("/store")`) is stood off until draft PR #229, which holds the file, lands | `client/src/lib/openMspAdvisor.ts`; `solutionGuidance.ts` `solutionAdvisorSeed` |
| Back to the Store | `← All needs` / `Start another solution` / footer `Back to Your Solution` (on the confirmation, whose draft was just sent: `Back to the Store` → `/store`) | `/store`, `/store/solution` | family, confirmation, footer | |
| Legacy routes | 301 `/solutions/business-needs` → `/store`, `/solutions/business-needs/:family` → `/store/solutions/:family` (query kept) | server, `warehouseRoutes.ts:33-38`, a middleware registered **before** the `/store` gate | committed in `0d2f6df4` | defect 39 |

The client twins of the legacy routes are removed in PR 2 commit 13 with defect 39 as the reason (§16.12 R9): the two `<Route>` entries at `App.tsx:283-292`, the two `isDoor2Path` branches, and the `"/solutions/business-needs"` exemption at `App.tsx:974`; `spaKnownPaths.ts` already lacks the entry.

**Rejected critique.** "The 301 is placed in a middleware that never sees those paths": at `0d2f6df4` `server/warehouseRoutes.ts:33-38` is a separate `app.use` that matches `/solutions/business-needs*` and runs before the `/store`-only gate at `:40`; the server half is done. The client-twin half of the finding is applied above.

---

## 14. Acceptance tests

Numbered, measurable, all attached to the completion report. "Rendered" means Playwright at 390 / 768 / 1440 with consent pre-seeded (`de_cookie_consent_v2`) and again with the banner present. Server tests run under vitest with `DE_TEST_RATE_LIMIT=1`, which disables the `VITEST` skip on `submitRateLimiter` and `referenceLookupRateLimiter` (`publicSolutionRoutes.ts:55,65`) for the two limiter cases only.

**Fulfillment order and policy**

1. `INSTALL_MODE_ORDER` deep-equals `["remote_assist","self_install","onsite"]`; every `FAMILY_PACKAGE_POLICY[*].installModes` equals its own elements sorted by that order; `installModes[0]` is never `onsite`; ADVISORY families expose only `remote_assist`; DIGITAL families never `onsite` (`solutionPackage.fulfillmentOrder.test.ts`, kept and extended).
2. `preferredInstallMode(buildSolutionPackage(f, d, p).installModes)` is `remote_assist` for all 26 offers; `resolveInstallMode("onsite", hardware).mode === "onsite"` with no reason; `resolveInstallMode("self_install", it_operations)` returns `{ mode: "remote_assist", reason }`; `installModeDetail("self_install","none").label` does not contain "Ship".
3. Rendered: on the family page, the workspace, the contact summary, the confirmation and the print sheet, Delivery & Setup options appear in DOM order Remote DE setup → shipped/guided self-setup → On-site technician at all three widths; the first supported option is checked by default and captioned "DE's first choice"; the on-site text contains "Truck-Roll, Trip Charge and Tech Labor"; unsupported modes are not rendered; no tile is ever both disabled and checked; **removing `hardware_lifecycle` after choosing on-site leaves `remote_assist` checked and the live region text "Setup reset to Remote DE setup" present**; the CRM description lists setup in the same order.

**Sizing**

4. Golden table: `buildSolutionPackage` over all 26 offers with `{25 users, 32 computers, 18 mobile, 2 sites}` matches §6.3; `LINE_BASIS` has an entry of the same length as `includes` for every offer and no stale entry; no "1 computers"; "Privileged-access review" is "Included once"; "Network and system diagrams" is "2 sites"; "Phishing exercises" is "25 users"; an empty profile prints exactly the five basis phrases of §6.3 (including "Per primary computer" for `de-continuity-standalone` line 1) and never "Included" for a sized line; `inferBasis` no longer exists in the module.

**One owner, three decisions**

5. No code path writes `needs[].delivery`; the family page renders no `name="relationship"` radiogroup; `/store/solution` renders exactly one; `parseDraft` lifts a unanimous legacy value and drops mixed ones; the rail, sheet, contact summary and CRM label the relationship from one source.
6. Add is never gated: on every family page "Add & review package" and "Add and keep browsing" are enabled with an empty relationship; both offers' sized lines render before any choice.
7. Help me choose submits: with `deliveryPreference === "unsure"` the workspace enables Continue, the contact primary reads "Submit & have DE recommend", the POST returns `intent: "consultation"` and `nextStep: "consultation"`, the CRM description says "Relationship: DE to recommend", and the confirmation shows the consultation row.
8. Intent is derived: a request with `cybersecurity_operations` and a body `intent: "quote"` stores `assessment`; `?family=` on an empty draft seeds the need and lands on `/store/solution` with the Undo row; on a non-empty draft it is ignored.

**Automation and guidance**

9. Scenarios: exactly ten; every `familyId` canonical; every family appears in ≥ 1 scenario; a tap adds only the missing families, records `source`, shows one Undo that removes exactly those and **is still present 10 s later**, never sets `deliveryPreference` without Use this; at 390 after tapping it-person-left the suggestion text is visible in the document, not only inside a closed dialog; declined suggestions persist across reload.
10. Suggestion: `internalIt` yes → Co-Managed, no → Standalone, unsure/empty → null; rendered as "Suggested from your profile" with the reason; `aria-checked` on the suggested tile stays false until clicked.
11. Hints: ≤ 3 rendered and, together with the coverage Add links, ≤ 3 suggestions on `/store/solution`; profile-incomplete first when needs exist; every add-family and relationship reason ≥ 30 chars naming a source family; no reason contains `\d+\s*%`, "discount", "DE managed" or a duration; dismissed ids skipped after reload; accepting `add_family` adds the need and collapses the row.
12. Coverage: exactly the eight canonical labels; Risk & Exposure as a slab, not a block; Browser & Web labelled "Part of Handle Our IT"; no `%`, "score", "complete" or "8 BLOCKS" text in the component; the Add link performs the add; the band is a closed `<details>` under 1024 and open at ≥ 1024.

**Chrome and layout**

13. No overlapping chrome: at 390 / 768 / 1440 on all five routes, with the cookie banner present and absent, no two independently interactive fixed elements' bounding boxes intersect (SolutionBar × unified bar × cookie banner × Desk launcher × Ask DE nudge × MegaMenu); `--de-store-cart-h` is published while the bar is mounted and `0px` after unmount; `html[data-de-store-bar]` is set while it is mounted and the canvas padding includes the var; at 390×844 without the banner the fixed stack (logo bar + unified bar + SolutionBar) is ≤ 180px; **with the banner present the sum of fixed chrome heights is ≤ 40% of the viewport and the bar's primary is fully visible**; the SolutionBar's computed opacity is 1 at every scroll position.
14. Zero horizontal overflow (`scrollWidth === clientWidth`) at 390 / 768 / 1440 on all five routes; `/store` ≤ 7 viewports at 390 (reported target ≤ 5) and ≤ 4 at 1440; `/store/solution` with two needs ≤ 6 at 390; on `/store` at every width the visible StepLabel numbers appear in non-decreasing DOM order; at 390×844 the first `.scenario-tile`'s top is < 844px; reported in `artifacts/visual-qa/store-experience/redesign/report.json` beside screenshots compared against Baseline A for nothing valuable lost.
15. Scroll-to-top: `scrollY === 0` after each navigation index → family → workspace → contact → confirmation.
16. Announcement strip absent and SiteBottomBar absent on every Door 2 route except `/store`; exactly one Ask DE control and one `tel:` link equal to `PRIMARY_PHONE.telHref` **inside `<main>`** per page (on `/store`: zero Ask DE in `<main>`, the three incident Call lines allowed), excluding the MegaMenu utility bar and the dock; `#app-canvas` has `data-accent="electric"` on `/store`, `/store/solutions/:family`, `/store/solution`, `/store/checkout` and `/store/solution/submitted/:reference` unconditionally, and on `/solutions/request` **conditional on §16.1 = approve**; the cookie banner renders `data-surface="light"` on the same set under the same condition; `html.de-store-jelly` is present on the three building pages and absent on contact and confirmation; no wheel/touch listener from `useStoreChromeGestures` is attached and `html.de-store-gesture-lock` is absent on any Door 2 route; both are present on `/internal/warehouse`.
17. Link budget per screen, measured in `<main>` and reported: `/store` ≤ 65 controls with at most one link per family cell; family ≤ 16; workspace with three needs ≤ 40 and ≤ 3 suggestions; contact ≤ 12; confirmation ≤ 10.
18. Sheet scroll: with 13 needs the SolutionBar sheet's footer primary stays visible and the list scrolls inside the sheet at 390×660.

**States, honesty, server**

19. Every state in §5 is rendered and screenshotted: empty, profile partial (with the named gap and the two field hints), ready, saving, save error, saved durable (resume link + warning), saved non-durable, hydration conflict, forked-after-submit, per-field validation, contact-page `profile incomplete` and `relationship unchosen` panels, 503 panel, 429, success, replay, memory variant, unknown reference 404, `?draftId=` of a sent solution, `?draftId=` unknown, storage blocked, lookup pending and lookup failed without an archive; evidence filed under `artifacts/visual-qa/store-experience/redesign/`.
20. Persistence sentences: PUT `durable: true` → "Saved to DE" and a resume link `${origin}/store/solution?draftId=<id>` with the warning; `durable: false` or failure → "Couldn't save to DE just now" and no link; no visible text names a service, store or CRM; the string "across devices" occurs only inside the resume-link copy; opening the link in a fresh context hydrates the draft.
21. Copy grep over `document.body.innerText` plus `aria-label`, `alt` and `title` attribute values at all five routes and in the print sheet: none of §12 list (a) phrases and none of list (b) tokens as whole words; enum values inside `value=` attributes are allowed; the sanctioned no-payment line present on the contact card; `door2Leakage.test.ts` passes with the door2 directory covered and the locks as they stand in the working tree (`SolutionProfileForm`, `ScenarioTile`, `STORE_STEPS`, `Add need`, `Review Your Solution`, `RelationshipCompare`, `Add & review package`, `Add and keep browsing`, no family `name="relationship"`, `JourneyRail` with `aria-label={STORE_JOURNEY_SENTENCE}`, `Save progress`, `Continue to contact details`, `publicContactProblems`, `company_website`, the absence of "Add to Your Solution"), plus `STORE_JOURNEY_SENTENCE === "Profile → pain or need → relationship → package → delivery & setup → contact"`; `storeLightChrome.test.ts`, `storeChromeGestures.test.ts` and `isDoor2Path.test.ts` are updated in the same commit for `/solutions/request`, the submitted prefix and the removed legacy twins.
22. Server (HTTP harness): PUT stores no contact or notes even when sent and returns `durable`; the GET and PUT draft view carries no contact field or notes; an explicit `""` `deliveryPreference` on PUT is stored as `""` and an absent one keeps DE's value; PUT on a submitted base returns `forked: true`; POST with no needs, an incomplete profile or an empty relationship returns 400 with `code` `NEEDS_REQUIRED` / `PROFILE_INCOMPLETE` / `RELATIONSHIP_REQUIRED` before any contact is persisted; honeypot filled → 400 and no `LEAD_CREATED`; with `DE_TEST_RATE_LIMIT=1` the 21st POST in an hour from one address → 429; with persistence mocked false and Zoho unconfigured in production mode → 503 `DURABLE_STORAGE_REQUIRED`, no lead, record reads back as draft; the 200 carries `reference` matching `/^DE-[0-9A-HJKMNP-TV-Z]{6}$/` and equal across a replay, `nextStep`, `acknowledged: false`; `selectedNeeds[].installation` outside the family's modes is replaced by its preferred mode; the status endpoint returns exactly the keys `{reference, status, submittedAt, durable, nextStep}` and 404s an unknown reference, a draft's reference and `DE-OOOOOO`; after the memory eviction window (clock mocked) the status lookup still resolves from the persistence mock; GET never returns a submitted record and reads `sessionId` from the cookie only; a replayed POST does not downgrade `crmStatus`.
23. Lead payload: `LEAD_CREATED` carries name, email, company, phone, message, correlationId and reference; the message contains each package's public offer name, sized lines matching what the buyer saw, the setup label with "(DE's first choice)" or "(chosen)", the support label, the assessment label, scenario ids and "Suggestion shown: Co-Managed (used)" or "(declined)"; it contains no enum values, offer ids, vendor names or "sku".
24. Confirmation: after a 200 the URL is `/store/solution/submitted/DE-…`, the h1 has focus inside `role="status"`, the local draft has no needs and an intact `environment`, `de-solution-submitted-v1` exists and contains no raw email or 7+-digit run, refresh re-renders the same page from the archive and the status endpoint, the assessment band renders only when `nextStep === "assessment"`, its magenta CTA renders only when `BOOK_ALIGNED` is true and then links to `/book?ref=` and the `/book` document contains no "free" within its assessment copy (Playwright string check), and "Start another solution" clears the archive.

**Accessibility, motion, build**

25. axe reports no serious or critical issues at 390 and 1440 on all five routes; one h1 per page and no skipped levels; every exclusive choice is a native radio group navigable by arrow keys; every disabled primary has `aria-describedby` pointing at a visible reason; every invalid field has `aria-invalid` + `aria-describedby` and the first is focused; exactly one `aria-live="polite"` region per page and no other `role="status"` except the confirmation h1's; the JourneyRail's accessible name contains each visible step word (label-in-name); decorative SVGs `aria-hidden`; composited body-text contrast ≥ 4.5:1 with no `text-white/40` on small text; the keyboard path completes without a mouse; Escape closes the sheet and restores focus.
26. Reduced motion: with `prefers-reduced-motion: reduce` no element on any Door 2 route has a running animation or a transition longer than 0ms after add, profile completion, relationship change, sheet open or route change, and all content is present; with motion on, no settle animation plays on first paint for already-selected controls.
27. `tsc --noEmit` clean; `vitest` green including every guard test in `map:constraint_set` 67 plus the policy, draft, scenario, guidance, route-registry and server tests; production build clean; `scripts/check-bundle-budget.mjs` passes with the entry stylesheet's raw bytes **not increased by a single byte** (`index.css` untouched) and every new Store style resolving from the Store chunk; `scripts/door2-browser-smoke.mjs` invariants hold (13 families, no email gate, no Pay Now, profile row before the scenarios, no notes field, no "DE manages this", overflow 0) with its selectors and strings rewritten to the new screens in PR 2 commit 16.
28. One product: (a) a token test asserts that the door2 `StepLabel` renders the same class set as V4's `ChapterLabel` (`T.label`, accent-ink number, `h-px w-8` dash, `mb-5`) and that `door2/tokens.ts` values equal the V4 `T` literals recorded in its source comment; (b) a side-by-side screenshot of the Store's pathway line and coverage band beside V4's chapters 04 and 05 (from `/version-4` on `origin/claude/homepage-v4` 583b4cd8) shows the same label form, rule weight, spacing and type scale differing in accent channel and in composition, never a repeated cell; no test imports from `client/src/pages/versions/v4/` until that PR is on `main`.

---

## 15. Build plan

Three PRs, in order, each reviewable against the Preservation Law and each rendered at 390 / 768 / 1440 before it is called done. Before any edit: reconcile against `origin/main`, never edit `server/storeQuoteCrm.ts` (#206), never merge on top of PR #196. Commits are reserved for the lead session (`DE_LEAD_COMMIT=1`).

**PR 1 · Policy, draft and server contract — DONE as `0d2f6df4`** (29 files; tsc clean; vitest 542 passing; `check:active-work` OK). What the draft's commits 1-7 described is that commit; two PR 2 touches remain on those files: delete `inferBasis` (§6.3), add `code` to the three 400 bodies (§7), and rename "never a blanket discount" (§8B).

**Files outside the claim.** `.ai/ACTIVE_WORK.yaml:33-73` (as amended in `0d2f6df4`) covers the door2 directory, the four pages, `SolutionSubmitted.tsx`, the libs, the server files above, `server/index.ts` (redaction line), `spaKnownPaths.ts`, `storeLegacyRedirects.ts`, `warehouseRoutes.ts` (301 only) and `App.tsx` (Door 2 routes and `ACCENT_BY_PREFIX` only). Everything else a commit below touches is listed here with its approver, and the claim (GitHub issue/PR #267 body first, YAML mirror second) is extended **before** the commit that touches it:

| File | Commit | Why outside | Approver |
|---|---|---|---|
| `client/src/styles/store-builder.css` (new), `client/src/hooks/useSolutionDraft.ts` (new), `shared/publicContact.ts` (new) | 8, 13 | new files not under a claimed glob | claim amendment, Joe informed |
| `client/src/lib/storeChromeGestures.ts`, `client/src/hooks/useStoreChromeGestures.ts`, `storeLightChrome.test.ts`, `storeChromeGestures.test.ts` | 13 | chrome predicates | §16.1 (Joe) |
| `client/src/pages/solutions/door2Leakage.test.ts` | 16 | in the claim | — |
| `scripts/door2-browser-smoke.mjs` | 16 | `scripts/**` released to Cursor for R5/R6 per the completion-program note | Cursor's release in writing, else the smoke rewrite ships as a new file `scripts/door2-browser-smoke.v2.mjs` |
| `client/src/index.css` | none | double-claimed with `claude-completion-program-lane`; **not touched** (canvas padding moves to the Store chunk) | — |
| `client/src/components/store/SolutionProfileForm.tsx` | 10 | double-claimed with the completion-program lane (local-only patch stack c1..c8 on `fe4a5216`, not a GitHub-visible lock); before commit 10 run `git log fe4a5216..origin/main -- <file>` and record in the PR whether c-lane hunks landed; if not, the redesign proceeds and the c-lane rebases | recorded in PR #267 |
| `client/src/lib/openMspAdvisor.ts`, `ZohoASAPWidget.tsx`, `deskAskDeMotion.ts`, `VirtualMspAdvisor.tsx` | 18 (PR 3) | Desk chrome, `docs/STORE-ARCHITECTURE-DESIGN.md:130` "do not restyle" | Joe, PR 3 |
| `client/src/components/MegaMenu.tsx`, `DigeratiEnhancedFooterSection.tsx`, `SiteBottomBar.tsx`, `CookieConsentBanner.tsx` | 17, 18 (PR 3) | shared chrome | §16.2, §5.6 banner variant (Joe) |
| `design/STORE_DOOR2_GRAMMAR.md`, `design/approved|rejected/store-*` | 8, 16 | design evidence | Joe reviews the primitive sheet |
| `.cursor/rules/blog-store-color-lock.mdc` | 20 (PR 3) | lock file | Joe |
| `client/src/pages/BookingPage.tsx` | PR 0 (§16.6) | not a Store file | Joe, approved 2026-09-28; built in PR #267 (§15 PR 0) |
| `client/src/pages/solutions/BusinessNeedsIndex.tsx`, `BusinessNeedsFamily.tsx`, `SolutionRequest.tsx`, `client/src/pages/store/PublicStoreCheckout.tsx` | 10–13, approved round (footer `variant="store"`) | double-claimed with `claude-completion-program-lane`; frozen draft PRs #219 / #220 also touch them (a11y and contrast hunks, local patch stack on `fe4a5216`) | recorded in PR #267; the c-lane rebases onto the rebuild |
| `.cursor/rules/blog-store-color-lock.mdc` | approved round | open draft PR #217 (design-authority tiers) edits the description and intro; this PR edits the globs and the Store section, disjoint hunks | recorded in PR #267; #217 rebases |
| `docs/STORE-WAREHOUSE.md` | approved round (staff preview step) | also changed by open PR #149 (portal staff recognition) | recorded in PR #267 |

**PR 2 · Screens (the redesign)** — begun in the working tree (`door2/*`, `store-builder.css`, `useSolutionDraft.ts`, `shared/publicContact.ts`).

| Commit | Files touched | Untouched | Closes |
|---|---|---|---|
| 8. **Primitive sheet first**: `door2/tokens.ts`, `primitives.tsx`, `ChoiceTiles.tsx`, `PackageSheet.tsx`, `Coverage.tsx`, `Guidance.tsx`, `NeedRow.tsx`, `ScenarioTile.tsx`, `JourneyRail.tsx`, `OfflinePanel.tsx`, `ProposalSheet.tsx`, `Door2Frame`, `store-builder.css`, `StorePageAtmosphere.tsx` (import + intensity), the token test; a rendered sheet of every primitive in every state at 390/1440 filed under `design/approved/store-primitives-2026-09/` for Joe's look **before** commits 10-14; the three policy touch-ups (`inferBasis`, 400 `code`, "price cut") | entry stylesheet, `index.css` | 44, 48 |
| 9. `SolutionChrome.tsx` (SolutionRail / SolutionBar / YourSolutionSheet); retire `PublicSolutionCart.tsx` (§16.12 R1) | `door2/SolutionChrome.tsx` | `Toaster`, `SiteBottomBar`, `index.css` | 10, 11, 49, 50 |
| 10. `/store` rebuilt: header band, pathway line, collapsed profile row, scenarios with Call lines, goal groups as disclosures; no toasts | `BusinessNeedsIndex.tsx`, `SolutionProfileForm.tsx` (ProfileStrip, export kept) | `BUSINESS_GOALS` | 33, 35, 37, 51, 52, 53, 61 |
| 11. Family page rebuilt: RelationshipCompare, delivery preview, coverage chips, live draft, inline profile, no relationship control, bar carries the primary under 1024 | `BusinessNeedsFamily.tsx` | | 2 (screen half), 6 (render), 53 |
| 12. Workspace rebuilt: hairline chapters, one relationship control, PackageSheets, capped suggestions, coverage disclosure, per-package Delivery & Setup with the union-shrink reset, save row, rail | `PublicStoreCheckout.tsx` | route and alias | 5, 18, 21, 48, 49, 50 |
| 13. Contact step: paper chapter, per-field validation from `shared/publicContact.ts`, the three disabled panels, OfflinePanel, intent-labelled submit, archive with masked contact, `?family=` → workspace; `ACCENT_BY_PREFIX` entry; jelly class and rail-gated gesture listeners; legacy client twins removed | `SolutionRequest.tsx`, `client/src/App.tsx` (accent entry, new lazy route, twin routes and the `:974` exemption removed), `storeChromeGestures.ts`, `useStoreChromeGestures.ts`, `isDoor2Path.ts` + the three chrome tests | | 17, 31, 32, 36, 39 (client half), 47 |
| 14. Confirmation route, created with `BOOK_ALIGNED = false` (flipped to `true` in the approved round, with the `/book` copy) | `client/src/pages/store/SolutionSubmitted.tsx`, `App.tsx` route | `BookingPage.tsx` | 16, 19 |
| 15. Ask DE seeding from Door 2 callers only (`seedMessage` passed explicitly) | the four pages | `openMspAdvisor.ts`, `ZohoASAPWidget.tsx`, `deskAskDeMotion.ts` | 38 (Door 2 half) |
| 16. Locks, smoke and evidence: `door2Leakage.test.ts` final locks (§14.21), `STORE_JOURNEY_SENTENCE` derived and re-locked, `door2-browser-smoke` rewritten, screenshots and `report.json` under `artifacts/visual-qa/store-experience/redesign/`, `design/STORE_DOOR2_GRAMMAR.md` with approved/rejected Store screenshots | those | | 44, 63 |

Out of scope for PR 2: MegaMenu, footer, SiteBottomBar, CookieConsentBanner, warehouse UI, the naming sweep of `curatedSolutions.ts`, the acknowledgement email, `/book`.

**PR 3 · Chrome (approved 2026-09-28; built in PR #267 with the claim extended first, except the two parts of commit 18 held by draft PR #229)**

| Commit | Files | Closes |
|---|---|---|
| 17. Announcement strip suppressed on `isDoor2Path`; footer `variant="store"`; compact cookie banner on Door 2 only if §14.13's banner gate demands it (measurement attached) | `client/src/components/MegaMenu.tsx`, `DigeratiEnhancedFooterSection.tsx`, `CookieConsentBanner.tsx` | 62 |
| 18. **Built:** `deskAskDeMotion.ts` classifies the store page by `isDoor2Path` with Door 2 greeting and starters; `STORE_ADVISOR_SEED` in builder terms; `VirtualMspAdvisor.tsx` deleted. **Stood off until draft PR #229 lands:** the Ask DE nudge on the canvas gutter and `--de-cookie-h` (`SiteBottomBar.tsx`), and the widget's pathname fallback by `isDoor2Path` vs `isWarehousePath` (`ZohoASAPWidget.tsx`) | `deskAskDeMotion.ts`, `VirtualMspAdvisor.tsx`; later `SiteBottomBar.tsx`, `ZohoASAPWidget.tsx` | 38 (rest), 60, 64 |
| 19. `de_store_preview` cookie so signed-in staff can view the public Store as a buyer | `server/warehouseRoutes.ts`, `server/warehouseRoutes.test.ts` | open question 28 |
| 20. `.cursor/rules/blog-store-color-lock.mdc` split into public-Store and warehouse scopes; staff `ShoppingCart` title → "Warehouse cart" | those | 13, 41 |

**PR 0 · `/book` copy** (§16.6; approved 2026-09-28 and built in PR #267, since the lane has one designated branch): `BookingPage.tsx` aligned to the campaign framing (a no-obligation conversation first; the formal CSRA at `CANONICAL_CSRA_ONE_TIME` when scoped; nothing billed until the buyer says yes) and a `?ref=` reader (`shared/solutionReference.ts`, the one pattern and normalizer the server also uses) that shows "Reference DE-XXXXXX" above the widget. `BOOK_ALIGNED` flips in the same commit series, so neither reaches production without the other.

**Explicitly out of scope of this design**: warehouse defects (`map:defects_ranked` 1, 14, 15, 45, 46, 67, 68, 69, in flight under caa29e47), the copy-only naming sweep of standalone offer records, promoting office hours into `shared/companyContact.ts`, a drizzle migration for `public_solution_requests`, Turnstile, cross-device marketing.

---

## 16. Decisions for Joe — answered

**Answered 2026-09-28: Joe approved every recommendation below ("All approved, continue").** Each item keeps its recommendation text as the record of what was approved; the resulting work is listed in §15 (PR 3 and PR 0 now build inside PR #267, since the lane's one designated branch is `claude/nifty-newton-uk9g7t`). Two items touch files an active lane holds and stand off until it lands: the Ask DE nudge position in `SiteBottomBar.tsx` and the pathname fallback in `ZohoASAPWidget.tsx`, both in draft PR #229 (DE Desk launcher and modal).

1. **Electric scope for the contact step.** The colour lock names `/store/*` and says ask before changing any value. The working tree already extends `isStorePath` with `/solutions/request` and the design adds `["/solutions/request", "electric"]` to `ACCENT_BY_PREFIX` so the last step stays electric with the white cookie surface (defect 17); jelly and the gesture listeners stay off the form regardless (§5.4). **Recommendation: approve.** The alternative (a new `/store/solution/contact` route) adds registry surface and a double hop through the existing legacy 301s for no buyer benefit. §14.16's contact clauses are conditional on this answer.
2. **Announcement strip off and footer `store` variant on Door 2.** Both are REPLACEs of shared chrome outside the claim (PR 3). **Recommendation: approve.** The strip sells an assessment the policy says is not universal, over a task page.
3. **The ten scenarios and the eight-block family map as public claims.** `solutionScenarios.ts` as committed and `FAMILY_SECURITY_BLOCKS` (conservative). **Recommendation: approve both as committed**; widen the block map only if a family's public includes genuinely deliver that block's control.
   - **3a. Scenario 1 wording.** Amend to `A phishing or spoofed email got through` / `Someone clicked, or a client got mail pretending to be us.` so an owner whose domain is being spoofed recognises it; same three families. **Recommendation: approve the amendment.**
   - **3b. Scenario 7's third family.** Keep `technology_strategy` in "A client or auditor asked for our policies and evidence" (as committed, so every family is reachable from a situation) or make strategy catalog-only again (the earlier staged intent: "advisory is chosen, not triggered by a pressure") and let the every-family test carry that one exception. **Recommendation: keep it**; the build defaults to what is committed.
4. **Retire the 13 `FAMILY_ACCENTS` icon hues** for one electric IconWell (§16.12 R6). The lock says ask before changing any Store colour, even though these hues are named by no lock. **Recommendation: retire.**
5. **Naming.** Nav "Store"; page and pathway "Solve a Business Need"; object "Your Solution"; page `<title>` "Solve a Business Need | Digerati Experts"; the staff `ShoppingCart` title renamed "Warehouse cart" (`map:open_questions_for_owner` 4). **Recommendation: confirm**, and mark packet item 8 resolved.
6. **`/book` when reached with `?ref=`.** Before the approved round, `BookingPage.tsx:43,84` said "free" while the canonical CSRA is $2,500 when scoped, so the confirmation's magenta CTA to `/book` was held behind `BOOK_ALIGNED = false` until the `/book` copy was aligned; while it was held, the assessment band offers Call and Ask DE and says "DE contacts you to schedule the conversation first". **Recommendation: approve PR 0 first.** ☑ Approved 2026-09-28. The `/book` copy change ships in the same PR as the confirmation, so `BOOK_ALIGNED` flips in that PR: the magenta action and the aligned `/book` reach production in one merge, never apart.
7. **Acknowledgement email.** A receipt for the request the buyer made, but it adds a send to a four-field form and needs a consent line. **Recommendation: defer**; the confirmation carries `acknowledged: false` copy until decided.
8. **Retention of submitted PII behind possession-keyed ids.** GET `?draftId=` no longer returns submitted records and the status endpoint is PII-free. Whether older submitted records should be redacted after a period is a policy call. **Recommendation: revisit retention when the drizzle migration question is settled.**
9. **Jelly per-surface list (roadmap 2.1).** This design opts in only ChoiceTiles and ScenarioTiles (press/settle on change), on the three building pages. **Recommendation: confirm that list.**
10. **Staff preview cookie.** A deliberate, scoped hole in the staff 302 so internal visual QA can walk the public Store as a buyer. **Recommendation: approve, PR 3.**
11. **Office hours.** Not shown in the Store until they live in `shared/companyContact.ts`. **Recommendation: promote them later in a shared NAP change; the Store shows the phone only.**
12. **REPLACE and removal register.** Each line is a REPLACE or removal under the Preservation Law, with its reason; each waits for a tick.
    - ☑ **R1** Retire `PublicSolutionCart.tsx` (floating chip + sheet) for SolutionBar / SolutionRail / YourSolutionSheet. Reason: defects 10 and 11 (no internal scroll; covers the profile pill and the Desk corner at 390). The var-publishing pattern is kept verbatim.
    - ☑ **R2** Remove every Door 2 toast (`useToast` in the four pages). Reason: CRITIQUE item 9 (toasts cover the drawer header, the rail and the confirmation card); replaced by in-place state, persistent Undo rows and one live region.
    - ☑ **R3** Stop writing `needs[].delivery` (done in `0d2f6df4`; parse-and-lift keeps old drafts). Reason: two owners for one decision (defect 2).
    - ☑ **R4** Delete `recommendedCtaLabel`, `SOLUTION_CART_EVENT`, `publicSolutionCart.ts`, `parseDeliveryModel` (done in `0d2f6df4`). Reason: dead exports, zero callers by `git grep` (defect 57).
    - ☑ **R5** Replace `quantityForLine` regex sizing with `LINE_BASIS` (done in `0d2f6df4`) and delete the `inferBasis` fallback (PR 2). Reason: verified wrong quantities on real labels (defect 7).
    - ☑ **R6** Retire the 13 `FAMILY_ACCENTS` icon hues for one electric IconWell (= §16.4).
    - ☑ **R7** Remove the index "How the Solution Builder works" explainer (five h2s, `BusinessNeedsIndex.tsx:135-143`). Reason: heading soup (defect 52) and the numbering it carries contradicts `STORE_STEPS`; the JourneyRail on the workspace and the numbered StepLabels carry the same information.
    - ☑ **R8** Replace the visible eyebrow "Business Solution Builder" and the `<title>` "IT Solutions Store" with "Solve a Business Need" (= §16.5). Reason: five names for one door (`map:ux_gaps_ranked` 12).
    - ☑ **R9** Remove the client twins of `/solutions/business-needs[/:family]` (`App.tsx:283-292`, the two `isDoor2Path` branches, the `:974` exemption). Reason: the server 301 exists; the twins render a magenta duplicate (defect 39).
    - ☑ **R10** Renumber `docs/PUBLIC-SOLUTION-BUILDER.md` to six steps and rewrite the leakage locks (`Step 1 · Pain or need` → `Step 2 · Pain or need`, `Step 4 · Contact` → `Step 6 · Contact`, the journey sentence). Reason: defect 30; done in `0d2f6df4` for the doc, PR 2 commit 16 for the locks.
    - ☑ **R11** Read `sessionId` from the cookie only (body/query readers removed, done in `0d2f6df4`). Reason: a body value lets anyone name a session (defect 23); `map:open_questions_for_owner` 9 asked whether the readers were intended.
    - ☑ **R12** Evict submitted records from the memory cache after 24 h (done in `0d2f6df4`). Reason: unbounded growth (defect 59); the record is Postgres and never expires (§7).
    - ☑ **R13** Announcement strip and footer on Door 2 (= §16.2).
13. **Honeypot on the public POST.** Already in `0d2f6df4` (`company_website`, `website`, `fax`; non-empty → quiet 400, no record). It is a fifth input on a form the rules define as four, so it is Joe's call under the no-friction rule (`map:open_questions_for_owner` 10). If kept: rendered outside the four-field group with `tabindex="-1"`, `autocomplete="off"`, `aria-hidden="true"`, visually hidden, never `required`, so a password manager cannot fill it; §14.22 keeps the bot case. **Recommendation: keep**, with those attributes; no timing floor (a slow-typing rule punishes real buyers on prefilled forms).
14. **Focus ring on Door 2.** `design/UI-STYLE-RULES.md` §2 binds `client/` to pink `#ec4899`; V4's `RING` is `ring-de-accent-ink`. The Store follows the style rules (pink) unless Joe wants the V4 ring sitewide. **Recommendation: pink now; revisit with V4's promotion.**
