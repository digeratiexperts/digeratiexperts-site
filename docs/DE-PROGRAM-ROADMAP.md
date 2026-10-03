# DE Program Roadmap — next steps per project

Requested by Joe 2026-08-30 (directive item 11). Baseline correction 2026-08-31: the approved homepage/Ask DE integration merged via **PR #147** and production serves `main @ 9c5e7f9` — PR #146 is closed; all new work starts from current production main. Living document; the lead
integrator updates it as work lands. Governance: `docs/AI-ENGINEERING-GOVERNANCE.md`
(incl. §18 Preservation Law). One bounded task at a time; every item gets its
own claim/branch when picked up.

Status: 🟢 in flight · 🟡 ready to start · 🔵 needs Joe decision · ⚪ later

---

## 1. Website (public marketing)

| # | Item | Status |
|---|---|---|
| 1.1 | Fable visual batch (new PR off production main): hero Phoenix-lights background (faint), premium chat + fullscreen expand, bottom-bar smoothness | 🟢 |
| 1.2 | Joe's four-question local review → correction pass (new lane) | 🟢 awaiting notes |
| 1.3 | Lower-homepage section upgrades — take the "ugliest" sections to the new hero's bar, each restyled to showcase its own message (directive #6); candidates from render audit: Testimonials/Proof shells, ProActive Ecosystem switcher, Newsletter band, AI-assistance teaser | 🟢 Fable batch 2 (sitewide polish sweep) |
| 1.4 | Homepage final-version sign-off per section (directive #4) — tracked against `design/UI-STYLE-RULES.md` §5 archetypes; answered by Joe's review, not assumed | 🔵 |
| 1.5 | Tier-1 staging deploy (`deploy/vps/staging-review-safety.md`) — needs one-time staging provisioning on the VPS (root/CyberPanel) | 🔵 Joe runs setup |
| 1.6 | Hero background REPLACE decision (dusk photo treatment now returning via 1.1) | 🟢 resolves with 1.1 |
| 1.7 | Reference PNG into `docs/reference/homepage-support-target.png` | 🔵 Joe |
| 1.8 | Sitewide premium pass at 390/768/1440 after merge — "everything as premium as possible" (directive #12) applied through UI-STYLE-RULES, page by page, 80+ routes triaged by traffic | ⚪ |
| 1.9 | Tech-showcase opportunities (directive #5): candidates identified — route-level code-splitting for the 906KB entry bundle; `prefers-reduced-data`/`save-data` handling for hero imagery; View Transitions API for section nav; RSS/JSON feed for Journal; OG-image automation per page; skeleton loaders on live feeds (threat feed, reviews). Each is small and additive; adopt selectively | 🟡 |

## 2. Store / Solution Builder

| # | Item | Status |
|---|---|---|
| 2.1 | Jelly mode scoping (directive #7): keep the jelly treatment only where playfulness fits the use case — needs Joe's per-surface list (e.g., yes: category pills, add-to-solution moments; no: checkout, pricing math, compliance items). Then codify in UI-STYLE-RULES §Store | 🔵 define list with Joe |
| 2.2 | Authoritative Co-Managed preferred pricing (issue #121) | 🟡 separate workstream |
| 2.3 | Hardware availability / ship-date ETAs (issue #122) | 🟡 separate workstream |
| 2.4 | Technician eligibility + scheduling handoff (issue #123) | 🟡 separate workstream |
| 2.5 | Zoho Payments enablement for authenticated co-managed/admin checkout — policy decision; Door 2 stays request-only regardless (`docs/PR146-PRESERVATION-AUDIT.md` D1) | 🔵 |
| 2.6 | Store 390px: "Your Solution" pill overlaps autosave chip (evidence in `artifacts/visual-qa/pr-116/sweep_store-390.png`) — route into #121–123 chrome work | 🟡 |
| 2.7 | Anonymous situation-continuity recovery (issue #119) | 🟢 website projection from Store draft (this PR); Hub still owns people after submit |

## 3. Client Portal — user side

| # | Item | Status |
|---|---|---|
| 3.1 | Portal login page visual upgrade to the new premium system (directive #9) — Fable batch now that the approved integration is live (PR #147, main @ 9c5e7f9) | 🟡 |
| 3.2 | "Fully functional account" verification: OIDC configured ✓, login 200 ✓, returnTo sanitizer verified ✓ (live 302 with portal-scoped redirect URI + signed state). Remaining: one real end-to-end login by Joe (dashboard, tickets, marketplace, sign-out), then fix list | 🔵 Joe's 5-min click-through |
| 3.3 | Marketplace returnTo end-to-end (post-login landing) — closes with 3.2 | 🔵 |
| 3.4 | Portal ↔ Desk ticket views: timestamps/actions parity with the upgraded public Desk | 🟡 |

## 4. Portal — DE admin side

| # | Item | Status |
|---|---|---|
| 4.1 | Admin-side audit (AdminAgents, AdminCompanies, AdminImport, AdminLifecycle): functional pass + premium alignment — needs an admin session to exercise | 🔵 schedule with Joe |
| 4.2 | Client-pricing admin flow end-to-end test (`/api/admin/client-pricing/*`) once 2.2 lands | ⚪ |
| 4.3 | Admin visibility for deSync outbox/conflicts (`/api/integrations/conflicts`, `/retry`) — small UI over existing endpoints | 🟡 |

## 5. Journal / Blog — AI editorial automation

Directive: routine, automatically-created posts by an AI editor. Current state:
Journal is a static curated catalog (16 posts) with locked amber identity; no
generation pipeline exists.

| # | Item | Status |
|---|---|---|
| 5.1 | Editorial pipeline design: source (threat feed / CISA KEV already ingested) → AI draft → **human approval gate** (governance: never fabricate; Joe approves before publish) → publish to Journal catalog → sitemap/SEO update | 🟡 design doc first |
| 5.2 | Draft store + review UI (admin portal section; reuse portal approvals pattern) | ⚪ after 5.1 |
| 5.3 | Scheduling/cadence (weekly threat-roundup candidate: data already live on Security Updates) | ⚪ |
| 5.4 | Attribution/classification rules: every AI-assisted post labeled per `VISUAL_EVIDENCE.md` honesty standards | 🟡 write into 5.1 |

## 6. TechSales / Intelligence Hub landscape

| # | Item | Status |
|---|---|---|
| 6.1 | Website→Hub sync: **verified healthy** in prod (reachable, 159ms, outbox 0/0) | 🟢 done 2026-08-30 |
| 6.2 | Bidirectional parity ("same information both sides", directive #10): website side proven — outbox drained = all events acked by Hub; inbox lifecycle A–H test-covered; conflicts endpoint exists. **Hub-side verification requires Intelligence-Hub repo/DB access** — needs a Hub-side session or ChatGPT survey against Hub Issue #122 scoreboard | 🔵 needs Hub access |
| 6.3 | Zoho ↔ Hub record parity spot-check: pick 3 real clients, compare CRM account ↔ Hub tenant ↔ portal org (tenantIdentity mapping) | 🔵 with Joe (real data) |
| 6.4 | TechSales knowledge ingestion → advisor answers: covered by tests; production eval run (`npm run eval:advisor`) as a periodic gate | 🟡 |
| 6.5 | Ecosystem scoreboard: do not declare done until Hub Issue #122 completion gate passes (AGENTS.md) | ⚪ standing rule |
| 6.6 | **TechSales AI intelligence upgrade** (Joe 2026-08-31: "ultra smart, roleplay-capable"). Repository authority: the TechSales AI lives in `digeratiexperts/Intelligence-Hub` — this repo can't implement it; needs a Hub-side lane. Design outline: (a) model upgrade to a frontier model (website's public advisor now runs `gpt-4o` by default, `MSP_ADVISOR_MODEL` env-tunable; Hub still needs its own upgrade), (b) roleplay mode = persona engine (AI plays prospect/objection-handler so Joe can practice pitches; scenario library seeded from real DE solution families), (c) grounding on DE Intelligence knowledge + CRM context, (d) eval harness like the website's `eval:advisor`. Decisions needed: model/budget ceiling, roleplay scenarios wanted first | 🔵 Hub-side lane + Joe scoping |
| 6.7 | Website-side contribution to 6.6: advisor model-tier review (`server/services/msp-advisor/advisor.ts`), knowledge retrieval quality pass, richer eval set | 🟡 |

## 7. Cross-cutting

| # | Item | Status |
|---|---|---|
| 7.1 | Zoho CRM renewal 2026-11-23 | 🔵 calendar |
| 7.2 | Main branch protection (issues #124/#115/#100) | 🔵 P0, GitHub settings |
| 7.3 | Production re-audit of open PRs/branches after reconciliation (issue #127) | 🟡 |
| 7.4 | Portal-auth test flake: **closed — not reproducible** (3 standalone + multiple full-suite green runs; single occurrence attributed to bcrypt cost under local CPU contention; CI unaffected) | 🟢 done |

## 8. Sales tax platform (new workstream, Joe 2026-08-31)

Joe: "finish the sales tax project and embed routes into all our projects —
store, techsales portal, client portal — always correct, connected to the
proper gov databases at all times."

**Honest current state:** there is no sales-tax implementation in this repo —
Store checkout hardcodes `tax: "0"` (`server/secureStoreCheckout.ts`) and the
orders schema defaults tax to 0. If a sales-tax project exists, it lives in
the Intelligence-Hub repo; otherwise this is a greenfield build.

**Engineering reality on "gov databases":** no government runs a real-time
tax-calculation API suitable for checkout. The correct-by-construction pattern
is a maintained tax engine as the source of truth, with government data as the
verification layer: AZDOR publishes the official TPT rate tables and an
address-level rate lookup — right for AZ verification/audit, not for live
multi-jurisdiction checkout math.

| # | Item | Status |
|---|---|---|
| 8.1 | Nexus + taxability decisions (Joe + accountant): which states DE collects in (AZ TPT at minimum); which catalog items are taxable (AZ services vs retail differ materially) | 🔵 blocking |
| 8.2 | Engine selection: Zoho Books/Commerce tax (already licensed under Zoho One, Books API connected) vs Avalara/TaxJar. Recommendation: start Zoho-native, keep an adapter seam | 🔵 |
| 8.3 | One shared service (`server/services/salesTax.ts`): address+line-items → jurisdiction, rate, tax; provider adapter; fail-closed (no silent 0-tax on engine failure for taxable items) | 🟡 after 8.1/8.2 |
| 8.4 | AZDOR TPT verification job: scheduled pull of official rate tables, alert on drift vs engine | 🟡 |
| 8.5 | Embed: Store authenticated checkout (replace hardcoded 0) → client-portal invoices/marketplace → Hub via deSync bridge (one engine, every surface) | ⚪ after 8.3 |
| 8.6 | Order/tax audit trail: persist jurisdiction + rate + engine version per order line | ⚪ |

## Quick-wins log (directive #8)

Done this pass: portal-auth flake investigated & closed (7.4) · Marketplace
returnTo verified incl. live prod 302 (3.3 partial) · staging safeguards
implemented & tested · this roadmap. In flight via Fable: hero background,
premium chat + fullscreen, bar smoothness, Desk timestamps check.
