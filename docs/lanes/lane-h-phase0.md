# Lane H — Phase 0 report (homepage refinement, Wave 1)

**Lane:** H (homepage refinement) · **Agent:** opencode · **Date:** 2026-10-22
**Mode:** Maintenance Mode (`design/DESIGN-AUTHORITY.md`). Refinement of the canonical homepage, not a redesign.
**Base:** `origin/main` @ `398f4d6f` (branch `opencode/lane-h-homepage-20261022`).
**Governing plan:** `docs/plans/opencode/DE-homepage-refinement-prompt.md`, narrowed by
`docs/plans/opencode/lane-h-homepage.md` and **overridden where they differ by
`docs/plans/opencode/lane-h-update-1.md`** (Claude, 2026-10-22).

Per Update 1, the plan's "/ vs `/version-3`" step is **not run**: V8 is the base and nothing is
ported from `/version-3`. The reconciliation below records what the checks found, so nothing in
the plan's older premise is silently dropped.

---

## 1. Which component is canonical

| Question (plan Phase 0.1) | Finding |
|---|---|
| Which file is the canonical homepage? | **`client/src/pages/versions/v8/HomepageV8.tsx`**, routed at `/` in `client/src/App.tsx` (Joe, 2026-10-03: "its approved. do it."). `/version-8` is a 301 to `/`. |
| Is the plan's premise current? | **No — the plan's Phase 0 premise is stale.** It describes production `/` as `DigeratiHomepage` with the 14-section config `hero → stats → challenges → services → protection → testimonials → trust → team → industries → pricing → insights → faq → cta → contact`. That component is now the frozen **`/version-0`** archive. The 14-section config it names is real, but it is V8's `sections` array (`HomepageV8.tsx`), which mounts **16 section components**. |
| Eight-block content on `/`? | **Already on `/`.** `sections/06-eight-blocks.tsx` renders the eight-block model from `protectionDomains` (`client/src/components/visual/ProtectionCommandDeck.tsx`): Identity & Access · Endpoint · Email & Collaboration · Browser & Web · Network · Detection & Response · Human Risk · **Risk & Exposure as #8**, kept as the continuous layer beneath the other seven (the canon in `docs/CLAIMS-REGISTER.md`, `docs/DE-SERVICE-MODEL-2026.md`). Nothing to bring over. |
| Corrected hero / Ask DE / mobile sheet / accessibility fixes on `/`? | **Present.** V8 carries the corrected hero (`01-hero.tsx` incl. the Joe 2026-10-05 phone fix and the 2026-10-07 city-lights plate), the pronunciation card, and site chrome (MegaMenu, `SiteBottomBar autohide`, Ask DE `ZohoASAPWidget`) unchanged. Ask DE behaviour is untouched by this lane. |

**Brought over from `/version-3`: nothing** (Update 1 forbids the port). The only item from Joe's
"bring if missing" list that was genuinely absent — the `ModernHeroSection` "Your Arizona business,"
line — is deliberately **not** brought over (Update 1: keep V8's hero). It remains in the repository
as the preserved previous hero (`client/src/pages/sections/ModernHeroSection.tsx`), unrouted.

## 2. The hero (plan Phase 0.2)

- V8's hero is present with the **Cyber Risk Assessment card** (`AssessmentPreview`, `data-testid="hero-assessment-card"`), labelled **Illustrative preview** via `TipTag` ("Example format, not client data"). Values are the `DashboardMockup` sample values, unchanged.
- `<h1>` is "Cybersecurity-First IT That Powers Your Business" — the `scripts/public-route-smoke.mjs` gate expects this string and the test ids `button-hero-schedule`, `button-hero-pricing`, `digerati-pronunciation-card`, `button-play-digerati-pronunciation`, `button-open-asap-widget`. All five stay.
- "Your Arizona business," (`ModernHeroSection`) is **not** on `/`; per Update 1 that is expected, not a regression.
- Known hero debt (to fix in Phase 1, not a regression): first-viewport fit at 1280/1440 — type scale is large and the assessment card + CTA + reassurance row crowd the fold.

## 3. CTA inventory on `/` today (plan Phase 0.3)

Labels actually rendered by V8 (the plan's list came from an older build — "Start Cyber Risk Assessment ×9",
"Start My Assessment", "Schedule a Cyber Risk Assessment", "Book the conversation" do **not** appear on `/` now):

| Label | Where (V8) | Style today | Count |
|---|---|---|---|
| "Get My Cyber Risk Assessment" (`CTA.primary` / `CTA.heroPrimary`, `client/src/lib/ctaCopy.ts`) | hero (button-hero-schedule), 05 path 3 (engage-assessment), 07 (button-proof-assessment), 08 (link-trust-cta), 12 monitor (button-ai-section-assessment), 15 (button-cta-assessment), 13 form submit (button-lead-submit) | `v8-btn--hero` (hero) / `v8-btn--primary` | 7 |
| "Request a Cyber Risk Assessment" | 13 heading (assessment-form-title) | heading, not a button | 1 |
| "Talk to an Expert" | 09 team (button-talk-to-expert) | `v8-btn--primary` (!) | 1 |
| "Schedule Consultation" | 02 (button-schedule-consultation-banner) | `v8-btn--primary` | 1 |
| "Discuss Your Security Needs" | 04 (tackle-cta) | `v8-btn--primary` | 1 |
| "Get Industry-Specific Protection" | 10 (button-industries-cta + ind-ask) | `v8-btn--primary` | 2 |
| "See Plans & Pricing" (`CTA.secondary`) | hero (button-hero-pricing) | `v8-btn--outline` | 1 |
| "Call 325-480-9870" | hero checks, 02 (button-call-banner), 13, 15, 16, 07 proof-foot | link / `v8-btn--outline-paper` | 5 |
| Non-assessment buttons | "Explore managed services", "See co-managed", "View Standalone Services", "How the ProActive Ecosystem works", "Details ×6", "Full methodology", "View case studies", "Read the Bill of Rights", "Open Trust Center", "Compare Everything", "Pricing tools", "View All Security Updates", "Read the Digerati Journal", "Send Message", "Subscribe" | mixed | — |

Compact surfaces (`CTA.primaryNavCompact` = "Risk Assessment", `CTA.primaryShort` = "Cyber Risk Assessment")
live in **shared site chrome** — `MegaMenu.tsx` (nav) and `StickyCTABar.tsx` (floating; deliberately **off `/`** per
`client/src/lib/stickyCtaVisibility.ts`, which excludes `/`, `/version-*`, `/concepts/home-*`, `/contact`,
`/portal`, `/store`). They are outside this lane's file ownership (homepage only) and are listed in the
PR's CTA replacement list as a cross-lane follow-up.

## 4. Internal/dev copy visible to visitors (plan Phase 0.4)

| Where | String | Disposition |
|---|---|---|
| `sections/05-services.tsx` lede | "Three clear paths. Capability depth stays available here and under Protect — nothing removed." | Rewrite to visitor copy |
| `sections/05-services.tsx` stack lede | "Preview of the stack we manage — also detailed under Protect." | Rewrite to visitor copy |
| `sections/12-threats-insights.tsx` feed loading | "Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads." | The feed block leaves the homepage (Update 1); the string leaves with it. Any remaining loading state gets visitor copy |

No other visitor-visible dev strings found in V8 (remaining hits are code comments and frozen version
bundles, which are archive and out of lane).

## 5. Non-canonical service names (plan Phase 0.5)

| Where | Today | Canonical | Source of canon |
|---|---|---|---|
| `sections/05-services.tsx` capability rail | "SMART Identity (MFA + SSO)" | **Identity & Access Management** | Update 1; `servicePages.tsx` uses this name |
| `sections/05-services.tsx` capability rail | "Endpoint Security (EDR)" | **Endpoint Security / EDR-MDR** | Update 1 |
| `sections/05-services.tsx` capability rail | "SOC / MDR Monitoring" | **Detection & Response (SOC / MDR)** — keeps the acronym buyers search, names the block canon | `docs/DE-SERVICE-MODEL-2026.md` block 06; `docs/CLAIMS-REGISTER.md` row keeps "SOC / MDR Monitoring: 24/7 detection and response" as the published claim |
| `sections/05-services.tsx` capability rail | "Privileged Access Controls", "Backup & Disaster Recovery", "Email Protection" | kept (accurate, used verbatim on solution pages) | — |
| `sections/11-pricing.tsx` highlights | "SOC / MDR" | kept, renamed peers only where wrong; the map mirrors `EcosystemProgression.tsx` (`client/src/components/`, outside homepage ownership) | keep-in-step comment |

Network service names (`docs/DE-NAMING-CANON.md`: Cloud Edge / SASE, Managed Physical Site Network,
Hybrid / Multi-Site, Co-Managed Network) do not appear in V8 copy. No vendor names appear on the
homepage except Microsoft ("Microsoft-aligned stack", "Microsoft MSRC"), which is allowed.

## 6. Claims, metrics, testimonials, case studies on `/` (plan Phase 0.6)

Full row-by-row register: **`docs/CLAIMS-REGISTER.md`** (authoritative). V8 status summary:

| Family | On `/` now | Basis | Status |
|---|---|---|---|
| Industry statistics (4) | 48% ransomware / $11.5M US breach cost / 99%+ MFA / $392M AZ IC3 2024 (`03-threats-are-real`, `getHomepageCyberFacts()`) | `client/src/data/cyberAwarenessFacts.ts`, source + year + URL per fact | **Sourced** — keep |
| Response times | "Response within one business day" (hero, lead-form toast), "24/7/365 emergency incident response" (16) | `client/src/pages/legal/SLA.tsx` | **Published** — keep |
| Frameworks | "HIPAA, PCI DSS, SOC 2 and cyber-insurance readiness support" + explicit boundary "not certifications DE holds" (14) | Trust Center boundary | **Structural** — keep, boundary preserved |
| Pricing | $125/$165/$245/$345 per user, minimums, fit lines, scope note (11) | `client/src/data/pricing.ts`, rendered from import | **Published** — keep |
| Eight blocks | "Eight blocks. One accountable operating model." + Risk & Exposure continuous (06) | `protectionDomains` import | **Structural** — keep |
| Assessment report figure (08) | "Example format" outline, no numbers | TipTag + `data-classification` pattern | **Structural** — keep |
| Reviews / testimonials | Honest live feed (`/api/public/reviews`), empty today → leave-a-review QR + "Read us on Google" (07) | `docs/GOOGLE-REVIEWS.md`, `reviewsCatalog.ts` (empty) | **Published** — keep; **no testimonial is invented** |
| Case studies (07) | "How we approach each industry — challenge, approach, and outcome." with `publishedCaseStudies` empty | `client/src/data/caseStudies.ts` | **Structural** — keep; slot stays unpublished |
| "Serving professional services, healthcare, construction, nonprofit, and regulated organizations across Greater Phoenix" (07 proof-foot) | "construction" has no published `/industries/*` page | `docs/CLAIMS-REGISTER.md` V4 row: industries named only while their page exists | **Flagged** — align the list to the six published industry pages |
| "Signals surface immediately" + "Signals surface immediately" step (12 monitor) | reads as a response-time claim | SLA is the only published timing source | **Flagged** — remove the speed implication |
| Practice claims (02 "Executive-Level Transparency", 08 pillars, 13 "Independent findings", 15 badges) | statements of how DE works | Client Bill of Rights / Guarantee / 2026-10-02 findings decision | **Practice** — keep; no numbers |

**Unpublished slots left for Joe (never invented):** client testimonial (07) and the assessment price
answer (14 FAQ). Both ship as `TODO (Joe)` code comments with no visible placeholder copy.

## 7. Concurrency check

- Open PRs at start: **none** (`gh pr list` = `[]`). No other session owns homepage files.
- Open ACTIVE/P0 issues reviewed; none claim V8 files. Issue **#696** opened for this lane (claim).
- `.ai/ACTIVE_WORK.yaml` mirror: the only `status: active` claims are `dex-presence` (mascots concept),
  `home-chapters-legibility-ink` (concept route), `de-bug-hunt-2026-10-21` (**`client/src/pages/DigeratiHomepage.tsx`
  + its title test — the `/version-0` archive; **not touched by this lane**) and `de-db-dead-pool-recovery` (server).
  `client/src/pages/versions/v8/**` is unclaimed.
- Frozen/version files (`/version-0` … `/version-7`, v9/v10 concepts) are **not** in lane; only
  `client/src/pages/versions/v8/**` (plus its own tests' expectations) is edited.

## 8. Tests and gates that constrain the change

- `scripts/public-route-smoke.mjs` asserts on `/`: `<h1>` contains "Cybersecurity-First IT That Powers" and
  "Your Business"; test ids `button-hero-schedule`, `button-hero-pricing`, `digerati-pronunciation-card`,
  `button-play-digerati-pronunciation`, `button-open-asap-widget` visible; Ask DE chooser opens. **All kept.**
- `client/src/pages/versions/v8/sections/01-hero.phone.test.ts` asserts hero markup + CSS strings. Hero kept.
- `client/src/data/teamProfile.test.ts` reads `v8/sections/09-team.tsx` (founder name/title). File kept; merge is at composition level.
- `client/src/pages/sections/footerContact.test.ts` reads `v8/sections/16-contact-footer.tsx`. File kept.
- `client/src/hooks/useDockAutohide.test.ts` asserts `<SiteBottomBar autohide />` in `HomepageV8.tsx` and the `/` route. Kept.
- `client/src/focusVisible.test.ts` reads a `button-hero-schedule` matcher. Kept.

## 9. Phase 1 shape accepted from Update 1

Section consolidation (V8 has 16 section components → the story spine in the plan):

| Spine beat | V8 content | Change |
|---|---|---|
| Hero | `01-hero` | keep; hierarchy + first-viewport fit only |
| Credibility strip | `02-why-we-exist` + `03-threats-are-real` | fold into one thin credibility strip; sourced facts only |
| Problems / risk | `04-what-we-tackle` | keep; small **Security Updates** link replaces the threat feed |
| Ways to engage | `05-services` | keep; canonical names + visitor copy |
| Packages | `11-pricing` | keep (moves before the blocks per the spine) |
| Assessment / process | `06-eight-blocks` (+ `12` monitor band) | keep; Risk & Exposure stays #8 continuous |
| Industries | `10-industries` | keep, concise |
| Proof & trust | `07-client-proof` + `08-why-arizona` + `09-team` | merge to one proof-and-trust section (Update 1 names 07+09; 08 is the trust block of the same beat) |
| FAQ | `14-faq` | keep + assessment-price TODO for Joe |
| Closing CTA / contact | `15-next-step` + `16-contact-footer` (+ `13-lead-form`) | merge to one closing block; form button "Request Assessment" |

Every existing `id` keeps working: primary ids stay on the chapter that owns the beat, merged-away ids
become alias anchors (`#why-we-exist`, `#trust`, `#team`, `#insights`, `#contact`, `#assessment-form`).
