# Homepage Refinement — Phase 1 Acceptance Verification

**Date:** 2026-10-23 · **Lane:** Homepage (H) · **Verdict:** shipped work meets the acceptance gates; open items documented below.

**Scope of this PR:** **docs-only.** No live code changed. This report verifies the already-shipped
homepage (`homepage-v2`, live at `/`) against the Phase 1 acceptance gates. The homepage refinement
itself was implemented and merged earlier (PRs #698, #716 and the `feat(homepage-v8)` commits) by the
lead integrator from `docs/plans/opencode/lane-h-homepage.md` + `DE-homepage-refinement-prompt.md`.
This report was produced because a re-run of the brief would have duplicated merged work and risked
regressions; it is verification + inventory, not re-implementation.

**Verified ref:** `origin/main` @ `a30a1ae4` ("Merge #716: port #698's CTA and copy fixes to homepage v2").
**Branch:** `claude/homepage-verify-20261023` (isolated worktree, off `origin/main`).

---

## 0. Reconciliation (why this is verification, not implementation)

The live homepage at `/` is **`HomepageV2`** (`client/src/pages/homepage-v2/HomepageV2.tsx`).
`HomepageV8` is **no longer in the router** (the previous page is at `/concepts/home-classic`, noindex).
`homepage-v2/cta.ts` states its CTA system is *"from `docs/plans/opencode/lane-h-homepage.md` and
`DE-homepage-refinement-prompt.md` §2"* — this exact brief. Therefore the brief is already executed and
live; this report records the evidence and the remaining limitations.

---

## 1. Acceptance gates

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | No regression to assessment submission, lead routing, Store, Client Portal, Ask DE | **PASS (source + contract)** | Assessment form `ContactSection` → `POST /api/assessment` (fullName, email, phone, company, interest, message). Newsletter `SiteFooter` → `POST /api/newsletter`. Client Portal footer link `/portal/login`; Client tools `/support/submit-ticket`, `/support/remote-support`, `/support/pay-invoice`. Store reachable below the service narrative via third lane + `/solutions/standalone-services`. Ask DE is shared chrome (mounted outside `.hv2`, unchanged). |
| 2 | No broken navigation, anchor links, or responsive behavior | **PASS (source)** | Site-wide homepage deep-links are only `/#contact` and `/#industries`; `homepage-v2` has both ids (`contact`, `industries`). No code references the removed `#hero`/`#testimonials`/`#trust`/`#cta`, so no dangling anchors. Protection tabs use the WAI-ARIA tablist/tabpanel pattern (keyboard nav). Responsive behavior is CSS-scoped and to be render-verified (Gate 3 — see limitations). |
| 3 | Visual comparisons at 390 / 768 / 1440, light + dark | **NOT RUN (limitation)** | Requires a running render + screenshots; not performed in this environment. See §4. |
| 4 | Before-and-after screenshots + change inventory | **PARTIAL** | Change inventory (§3) complete from source/git. Screenshots pending (Gate 3). |
| 5 | Typecheck, relevant tests, build | **PASS** | `npm run check` (tsc) clean. `npm run build` green ("✓ built in 2m 50s"; `HomepageV2` bundled). Homepage tests `homepage-v2.test.ts` **6/6 pass**. Full suite: 27 failed / 2138 passed — **all failures in server/scripts/portal-theme tests (env/network/DB/permission-dependent), none in the homepage** (see §5). |
| 6 | Claims and terminology vs canonical service definitions | **PASS** | Service names canonical (§2). No fabricated metrics/testimonials/case studies (§2). `npm run check:sample-data`: `sample-data-import: 0`, `sample-data-flag: 0` (no mock-data modules/flags; remaining "sample" strings are internal Portal placeholders). |
| 7 | PR opened with limitations/blockers documented | **PASS** | This PR. Limitations in §4/§5. |

---

## 2. Terminology & claims check (Gate 6)

**Canonical service names on the live page** (match `client/src/pages/routes/servicePages.tsx` + naming rules):
- `Identity & Access Management` (not "SMART Identity (MFA + SSO)")
- `Endpoint Security / EDR-MDR` (not "Endpoint Security (EDR)")
- `Detection & Response (SOC / MDR)`, `Privileged access controls`, `Backup & Disaster Recovery`, `Email protection`
- Three lanes: `Fully managed IT & cybersecurity`, `Co-managed IT`, `Ready-to-Work IT` (`THIRD_LANE_NAME`), `The ProActive Ecosystem`
- Internal/dev strings from the brief ("Three clear paths…", "Preview of the stack…", "Checking CISA…") are **absent** from the live page.

**Eight cybersecurity blocks** (`ProtectionSection`) — cohesive, cybersecurity-first:
Identity & access · Endpoint · Email & collaboration · Browser & web · Network · Detection & response · Human risk · **Risk & exposure** (continuous 8th). Heading: *"Eight blocks. One accountable operating model."* / *"Risk and exposure runs continuously beneath the other seven."*

**No fabricated proof.** Case studies `publishedCaseStudies: []`; reviews real-only ("Never invent reviews", Yelp/Thumbtack catalogs empty pending verbatim copy). `check:sample-data` confirms no mock-data imports/flags.

**External, cited industry stats** (`ThreatStatsSection`) — third-party threat intelligence, each with a source link (not DE performance claims):
- "48% of breaches involve ransomware" — Verizon DBIR 2026
- "99%+ of unauthorized access attempts are blocked by MFA" — Microsoft Digital Defense Report 2025
> **Action for Joe:** confirm these two figures match their cited sources (they change year to year). They are attributed and linked, but the numbers should be re-checked before publish.

---

## 3. Change inventory (Gate 4) — shipped `homepage-v2` vs previous homepage

**Section map before → after** (previous `/` = 14 nav ids → `homepage-v2` = 16 sections + footer):

| Before (id) | After (`homepage-v2`) |
|---|---|
| hero | HeroSection + PillarsStrip |
| stats (Why DE) | WhySection + ThreatStatsSection (`id="stats"`) |
| challenges (Problems) | ChallengesSection |
| services (How It Works) | ServicesSection (Three Doors + ProActive Ecosystem) |
| protection (Protect) | ProtectionSection (eight blocks) + HowProtectionSection (`id="how"`) |
| testimonials (Proof) + trust (Trust) | ProofSection (merged) + FitSection (`id="fit"`) |
| team | TeamSection |
| industries | IndustriesSection |
| pricing (Packages) | PricingSection |
| insights (Insights) | DetectSection + InsightsSection (slim entry) |
| faq | FaqSection |
| cta (Next step) + contact (Contact) | ContactSection (merged closing CTA + assessment form) + SiteFooter |

**Moved content and new locations:**
- **Threat feed (full)** → moved **off** the homepage to **Security Updates** (commit `c6605eaa`); homepage keeps a slim `InsightsSection` entry point.
- **Reviews + trust** → merged into `ProofSection` (Client Bill of Rights, Trust Center, "Worked with us?"); case studies/reviews stay **unpublished** (empty-until-real).
- **Closing CTA + contact** → merged into `ContactSection` (one assessment form).
- **"Your Arizona business" hero line** → **not restored** (Joe's decision); the V2 hero keeps the Arizona-businesses messaging and the approved Arizona-dusk hero + assessment preview.

**CTA replacement list** (one system, `homepage-v2/cta.ts` `HOME_CTA`):
| Role | Label |
|---|---|
| Primary (every primary surface) | **Schedule Your Cyber Risk Assessment** |
| Compact (nav/floating — shared chrome, see §4) | Schedule Assessment |
| Secondary (paired with phone) | **Talk to an Expert** |
| Form submit | **Request Assessment** |
| Destination | `/book` |
| Secondary path (pricing) | See Plans & Pricing → `/pricing` |

Removed label proliferations ("Start Cyber Risk Assessment", "Start My Assessment", "Schedule a Cyber Risk Assessment", "Start with a Cyber Risk Assessment", "Book the conversation") are consolidated into the above. Assessment is the dominant CTA; pricing is the secondary path; consultation ("Talk to an Expert") is contextual and visually secondary.

---

## 4. Limitations & blockers

1. **Gate 3/4 visual not run (blocker for full sign-off):** render + screenshots at 390 / 768 / 1440 (light + dark) and before/after were **not** produced in this environment. To complete: run `npm run dev` (or build + preview) and capture `/` vs `/concepts/home-classic` at the three widths in both themes, per `.cursor/skills/visual-audit`. Recommended in CI or a render pass. Nothing here fabricates screenshots.
2. **Shared-chrome CTA labels not reconciled (out of Lane H scope):** `homepage-v2/cta.ts` notes the compact nav / floating-bar labels still use site-wide `lib/ctaCopy.ts` ("Get My Cyber Risk Assessment" / "Risk Assessment"). Aligning MegaMenu / StickyCTABar to `HOME_CTA.compact` is owned by the **shared-chrome lane**, flagged in code. Touching `ctaCopy.ts` here would be parallel-lane interference.
3. **Verify two cited threat figures** (§2) against Verizon DBIR 2026 / Microsoft MDDR 2025 before publish.
4. **`check:route-meta`** did not complete within the 120s window on this box (still running a longer retry); it is CI-guarded and unrelated to homepage content.

## 5. Full test-suite failures (out of homepage scope)

`npm run test`: **27 failed / 2138 passed / 16 skipped.** All failures are outside the homepage and
environment-dependent (stderr: `auth_failed`, `fetch failed`, `DB lookup failed`):

| Failing file | # | Nature |
|---|---|---|
| `server/publicSolutionSpool.test.ts` | 5 | DB/network |
| `client/src/styles/portalConsoleTheme.test.ts` | 4 | portal theme (not homepage) |
| `server/portalSessionRevocation.test.ts` | 2 | DB |
| `server/deskTicketFallback.test.ts` | 1 | file-permission/spool (Windows) |
| `server/storeQuoteFallback.test.ts` | 1 | network |
| `server/adminCompanyMetrics.test.ts` | 1 | DB |
| `scripts/de-marketing/render.test.ts` | 1 | script env |
| `scripts/deployScripts.test.ts` | 1 | script env |

Two vitest worker `Timeout calling "onTaskUpdate"` errors also occurred (resource contention on this
box). **No homepage or public-marketing test fails.** The full suite should be treated as authoritative
in CI (the proper environment for the DB/network-dependent tests).

## 6. Anything skipped (and why)

- **No implementation changes** — the brief's Phase 1 was already shipped (`homepage-v2`); re-implementing would duplicate merged work and risk regressions (per the brief's "avoid parallel-lane interference" and `AGENTS.md` "never duplicate another session's work").
- **Shared-chrome CTA reconciliation** — owned elsewhere (§4.2).
- **/version-0 (`DigeratiHomepage`), v3–v10 concepts, `/concepts/home-classic`** — reference/concept copies; not modified (per the brief "do not modify /version-0").
- **DE Windows Agent workstream** — untouched (separate lane).

---

## Concurrency

- Base: `origin/main` @ `a30a1ae4`. Isolated worktree, branch `claude/homepage-verify-20261023`.
- **No overlap:** this PR adds one docs file only. Open PR **#717** owns `homepage-v2/sections/SiteFooter.tsx` + `homepage-v2/homepage-v2.css` (untouched here). PR **#718** is docs/artifacts (kie.ai samples).
- Per `AGENTS.md` / the brief: **PR only — not merged, not deployed, production untouched.**
