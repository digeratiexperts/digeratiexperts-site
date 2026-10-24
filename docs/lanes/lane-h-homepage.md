# Lane H — homepage refinement (Wave 1) — log

**Agent:** opencode (specialist) · **Branch:** `opencode/lane-h-homepage-20261022` · **Claim:** issue
[#696](https://github.com/digeratiexperts/digeratiexperts-site/issues/696) + `.ai/ACTIVE_WORK.yaml` mirror.
**Plan:** `docs/plans/opencode/lane-h-homepage.md`, overridden where it differs by
`docs/plans/opencode/lane-h-update-1.md`. **Mode:** Maintenance.

## Slice declaration (2026-10-22)

- **Objective:** refine the live homepage (V8 at `/`) — one CTA system, canonical service names,
  visitor-facing copy, section consolidation per the plan's story spine, threat feed moved off the
  homepage to a Security Updates link, unpublished TODO slots for the assessment price and a client
  testimonial.
- **Files:** `client/src/pages/versions/v8/**` only (plus this log, the Phase 0 report, and the YAML
  mirror). Nothing in the portal, no shared chrome, no frozen version bundles.
- **Acceptance:** `npm run check`, `npm test`, `npm run build`, `npm run smoke:a11y` green; smoke gate
  test ids and `<h1>` preserved; browser evidence at 390 / 768 / 1024 / 1280 / 1440; PR carries the
  section map, moved-content list, CTA replacement list, concurrency report.
- **Verify:** `npm run check` · `npm test` · `npm run build` · `npm run smoke:a11y` · browser renders.
- **Boundaries:** no merges, no deploy, no secrets, no new dependencies, no deletion of routes or
  content (moves are listed), no fabricated proof.

## Decisions

1. **V8 is the base** (Update 1). The plan's `/version-3` comparison is recorded in
   `docs/lanes/lane-h-phase0.md` and closed out: nothing is ported, V8's hero stays, the
   `ModernHeroSection` "Your Arizona business," line stays out.
2. **Merge at composition level, not by deleting files.** `01-hero.phone.test.ts`,
   `teamProfile.test.ts` (reads `09-team.tsx`) and `footerContact.test.ts` (reads `16-contact-footer.tsx`)
   pin those files, so the proof-and-trust and closing blocks compose the existing components inside one
   chapter each instead of rewriting them into new files.
3. **Section order follows the plan's story spine** (credibility → problems/risk → ways to engage →
   packages → assessment/process → industries → proof & trust → FAQ → closing). Every existing `id`
   keeps working via the primary id or an alias anchor, so the spy row, the dock and deep links survive.
4. **CTA system is homepage-scoped.** Labels live in a V8-local module
   (`client/src/pages/versions/v8/cta.ts`), not in `client/src/lib/ctaCopy.ts`, which serves every other
   surface and is outside this lane. The compact labels ("Schedule Assessment") are needed in
   `MegaMenu.tsx` / `StickyCTABar.tsx` (shared chrome, Lane A territory) — listed as a cross-lane
   follow-up, not edited here.
5. **Threat feed:** the feed UI leaves `/`; `/resources/security-updates` (route and `SecurityUpdates.tsx`
   component) is untouched and keeps the full stream. The homepage keeps a small Security Updates link
   where the feed was, so the dev loading copy ("Nothing is invented while this loads") leaves with the
   feed it belonged to. Nothing deleted: the cards, caption, attribution and empty/loading states already
   live on the Security Updates page (`useThreatFeed("all")`).
6. **Unpublished slots:** assessment price (FAQ) and client testimonial ship as `TODO (Joe)` code
   comments with no rendered placeholder. No fake proof, ever.
7. **Truth pass inside lane scope:** "Signals surface immediately" loses its speed implication; the
   proof-foot industry list matches the six published `/industries/*` pages. Full claims inventory in
   `docs/lanes/lane-h-phase0.md` §6.

## Cross-lane needs

- **Lane A / shared chrome:** the compact CTA labels ("Schedule Assessment") in `MegaMenu.tsx` and
  `StickyCTABar.tsx`, so the CTA system is consistent site-wide.
- **Joe:** two decisions (assessment price wording; a real client testimonial when one is approved) —
  see the `Add to to-do list:` block in the handoff.

## Status

- 2026-10-22: claim opened (issue #696), Phase 0 report written, implementation in progress.

## Delivered (2026-10-22)

### Section map before → after (live `/`)

| Before (16 blocks / 14 scroll sections) | After (16 blocks / 11 scroll sections) |
|---|---|
| 01-hero | **hero**: 01-hero (unchanged concept; type/card density trimmed for first-viewport fit) |
| 02-why-we-exist · 03-threats-are-real | **stats** (credibility strip): 02 tight narrative + 03 sourced facts, both `--tight` |
| 04-what-we-tackle | **challenges**: 04 (unchanged content) |
| 05-services | **services**: 05 (canonical names, visitor copy) |
| 06-eight-blocks | **protection**: 06 (eight blocks, Risk & Exposure #8; unchanged) |
| 07-client-proof · 08-why-arizona · 09-team | **testimonials** (proof & trust): 07 + 08 (`#trust`) + 09 (`#team`) |
| 10-industries | **industries**: 10 (moved after the blocks, per the spine) |
| 11-pricing | **pricing**: 11 (moved before the blocks, per the spine) |
| 12-threats-insights (feed + monitor) | **insights**: 12 Security Updates link band + monitor block |
| 13-lead-form | **cta** (closing): 15 + 13 + 16 (`#contact`) |
| 14-faq | **faq**: 14 (+ assessment-price TODO for Joe) |
| 15-next-step · 16-contact-footer | **cta** (closing): see above |

### Moved content (nothing deleted outright)

| Piece | Was | Now |
|---|---|---|
| Threat feed cards, live caption, attribution, loading/empty shells | homepage 12 | `/resources/security-updates` (route + `SecurityUpdates.tsx` unchanged; `useThreatFeed("all")` keeps the full stream) |
| "Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads." (dev copy) | homepage feed loading shell | removed with the feed; the Security Updates page keeps its own visitor loading copy ("Loading the live threat stream…") |
| 02's "Ready to Secure Your Business?" CTA band ("Schedule Consultation" + "Call …") | homepage 02 | the closing block's CTA pair (primary assessment + "Talk to an Expert" + phone) — same actions, one CTA system |
| "Get Industry-Specific Protection", "Discuss Your Security Needs", "Schedule Consultation" labels | homepage CTAs | unified to the primary CTA label (context stays in each section's copy) |
| Ids `#trust`, `#team`, `#contact`, `#why-we-exist`, `#insights`, `#stats`, `#challenges` | section wrappers | kept working (chapter ids + alias wrappers); the duplicate `stats`/`challenges` ids are gone |

### CTA replacement list (homepage)

| Surface | Before | After |
|---|---|---|
| hero primary (button-hero-schedule) | "Get My Cyber Risk Assessment" (violet `--hero` style) | **"Schedule Your Cyber Risk Assessment"** (magenta primary) |
| 05 assessment path card | "Get My Cyber Risk Assessment" | "Schedule Your Cyber Risk Assessment" |
| 04 challenge CTA (tackle-cta) | "Discuss Your Security Needs" | "Schedule Your Cyber Risk Assessment" |
| 10 industries CTAs ×2 | "Get Industry-Specific Protection" | "Schedule Your Cyber Risk Assessment" |
| 07 proof CTA | "Get My Cyber Risk Assessment" | "Schedule Your Cyber Risk Assessment" |
| 08 trust CTA | "Get My Cyber Risk Assessment" | "Schedule Your Cyber Risk Assessment" |
| 12 monitor CTA | "Get My Cyber Risk Assessment" | "Schedule Your Cyber Risk Assessment" |
| 15 heading + button | "Start with a Cyber Risk Assessment" + "Get My Cyber Risk Assessment" | "Schedule Your Cyber Risk Assessment" (heading) + primary label (button) + new secondary **"Talk to an Expert"** |
| 13 form | heading "Request a Cyber Risk Assessment", button "Get My Cyber Risk Assessment" | heading "Request your assessment here", button **"Request Assessment"** |
| 09 team | "Talk to an Expert" in primary style | "Talk to an Expert" in secondary style + "or call 325-480-9870" |
| 16 contact | text link "Get My Cyber Risk Assessment" + "Call 325-480-9870" | primary button "Schedule Your Cyber Risk Assessment" + secondary "Talk to an Expert · 325-480-9870" (tel) |
| 02 band | "Schedule Consultation" + "Call …" | removed (moved to the closing pair) |
| hero secondary (button-hero-pricing) | "See Plans & Pricing" | unchanged label (navigation CTA in the secondary style; test id is CI-gated) |
| Contact form submit | "Send Message" in the third style (`--dark`) | unchanged label, now the one primary style |
| Compact surfaces (nav, floating) | "Risk Assessment" / "Cyber Risk Assessment" (`ctaCopy.ts`) | **not changed here** — `.cursorrules` §7 still sets the site-wide labels; the plan's "Schedule Assessment" needs Joe's ratification site-wide (one line in `client/src/lib/ctaCopy.ts` + §7) |

### Verification (2026-10-22)

- `npm run check` (tsc) → clean. `npm run build` → clean.
- `npm test` → homepage tests green (`01-hero.phone.test.ts`, `teamProfile.test.ts`, `footerContact.test.ts`, `useDockAutohide.test.ts`, `focusVisible.test.ts`, plus the v8 suites). The remaining suite failures are pre-existing on this Windows checkout and none read homepage files: CRLF-sensitive literal matches (`portalConsoleTheme.test.ts`, `de-marketing/render.test.ts`), Windows file-permission semantics (`publicSolutionSpool`, `deskTicketFallback`, `portalSessionRevocation`, `portalUserInvite`, `storeQuoteFallback`, `stagingReviewGuard`, `deployScripts`) and source-tree scans that time out under full-suite load but pass alone (`publicPhone`, `credentials`, `brandRuntime`, `adminCompanyMetrics`, `licenseBoardRoutes`, `portalDeskAgentRoutes`).
- `npm run smoke:public` → OK (incl. the `/` h1 + test-id gate). `npm run smoke:a11y` → axe 0 violation groups, 31 routes × 2 viewports (only the known Zoho `/book` iframe, report-only).
- Browser audit at 390 / 768 / 1024 / 1280 / 1440 (`scripts/qa/lane-h-homepage-audit.mjs`): **0px horizontal overflow at every width** (before and after); hero first-viewport fit achieved at 1280/1440 (assessment card bottom 884/860 in a 900px fold, was 962/939); every section id resolves (no duplicate ids left); spy row and dock show the new spine order and land on the right chapters.
- Floating layers: the cookie banner and the Ask DE bar overlap hero content in the arrival state at 768+ — **identical measurements on production before this change** (fixed chrome stack, pre-existing). Not introduced here; not fixable from a homepage lane (chrome coordination lives in `SiteBottomBar` / cookie components).
- Evidence: `artifacts/visual-qa/lane-h-homepage/{before,after}` (before = production baseline, same day), reports in each `report.json`.

## Handover

- 2026-10-22: PR [#698](https://github.com/digeratiexperts/digeratiexperts-site/pull/698) opened with the section map, moved-content list, CTA replacement list, before/after evidence and the concurrency report; issue [#696](https://github.com/digeratiexperts/digeratiexperts-site/issues/696) updated to match. Lane H is complete on the opencode side.
- 2026-10-22: **Joe told Claude (Code, lead integrator) about this lane / PR #698**, so the review-and-merge step is Claude's to take under `docs/AI-ENGINEERING-GOVERNANCE.md` (exact wording not captured here). Merge and deploy remain separate states: Joe deploys, then this lane's claim flips to `verified-live` in `.ai/ACTIVE_WORK.yaml` and issue #696 closes.

## Follow-up slice (2026-10-22, plan §6 + §5)

- **§6 Connected journey — wired where the existing scope model already supports it.** The booking
  context model is `openBooking(source)` (`client/src/contexts/BookingContext.tsx`, which also sends
  `analytics.bookingOpened(source)`). Four homepage assessment CTAs navigated to `/book` bare; they now
  carry their section like the other five already did: `tackle_section` (04), `trust_section` (08),
  `industries_section` (10, both CTAs), `contact_section` (16). `href="/book"` stays as the no-JS and
  modified-click fallback (middle-click still opens the page). Verified in-browser: each opens the
  booking modal with the Zoho booking frame.
  - **Store context:** the Store sits in the main nav, which the plan's DO-NOT-CHANGE list fixes
    ("Solutions, Industries, Pricing, Resources, About, Store, Assessment") — nothing to carry.
  - **Ask DE context:** the existing scope model deliberately seeds nothing from `/`
    (`client/src/lib/deskOpenSeed.test.ts` asserts `deskOpenSeed({ context: "home" }, "/")` is
    `undefined`). Carrying homepage context there would need a new seed decision — out of scope
    ("no new systems").
  - **Assessment form:** `POST /api/assessment` already posts `source: "lead_form"`; forms and APIs are
    DO-NOT-CHANGE.
- **§5 Visual consistency — assessed, no further churn:** section rhythm is already one system
  (`.v8-section` 64px, `--tight` 48px on the credibility strip); the light/dark sequence after the
  reorder is deliberate (dark hero → paper credibility → paper problems → dark engage/packages →
  light protect → dark updates/industries/proof → paper trust island → light FAQ → light close + dark
  contact bookend); the remaining gradients are the cyan/purple/magenta lighting language the plan
  tells us to keep. Card-count reductions would mean moving content the plan forbids deleting.
- Gates re-run after this slice: `npm run check` clean · `npm run smoke:public` OK · `npm run smoke:a11y`
  axe 0 violation groups · v8 + `useDockAutohide` + `deskOpenSeed` suites green.

## Ownership and continuity (Joe, 2026-10-22)

Joe asked that opencode keep exclusive ownership of the rights and tasks assigned to it if his own
account access lapses, with someone taking the work over. **What is recorded here:** Lane H's slice
(PR #698, issue #696, `docs/lanes/lane-h-homepage.md`) is opencode-owned work product and the next
session may pick it up from this log + the handoff block without re-asking. **What an agent cannot
do:** grant account access, transfer workspace/org ownership, or change roles — those are admin
actions only Joe (or the account owner) can perform; they are listed on his DE To-Do. Nothing has
been granted or transferred at the account level by this session.

