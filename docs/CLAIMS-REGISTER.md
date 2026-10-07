# Claims register — homepage and /v2

Every quantitative, security, or service-level claim a visitor can read on the
homepage (`/`) and the Version B preview (`/v2`), with its basis and status.
Opened after the 2026-09-02 review of PR #178, which asked that
security/statistical claims carry source-and-date validation before they
become durable marketing copy, and that unsupported service claims be removed.

Rules this register enforces (from `design/PROOF_SYSTEM.md`,
`design/UI-STYLE-RULES.md` §Honest evidence, and `AGENTS.md` §38):

- Industry statistics are context, never DE performance; each carries a named
  source and year from `client/src/data/cyberAwarenessFacts.ts`.
- Response times and service levels are claims only where a published DE
  document (SLA, Terms of Use) states them; otherwise they are removed.
- Nothing here is a testimonial, client count, certification, or telemetry.

Status key: **Sourced** = source, year, and URL in the facts registry ·
**Published** = stated in a public DE legal/SLA page · **Structural** = follows
from how the site is built (canonical data, product capture) · **Unsupported**
= no basis found in the repository; Joe decides keep-with-basis or remove.

## Homepage `/`

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| Hero reassurance row (`ReferenceHeroSection`, pre-existing on main) | "Response within one business day" | `client/src/pages/legal/SLA.tsx`: Low priority = next business day; Terms of Use §4.1 lists the same tiers | Published | Keep. It describes the standard tier; critical/high tiers are faster per the SLA. |
| Hero trust strip, item 04 (PR #178) | Was "Response within one business day"; now "Response targets are published in our SLA" | Same SLA | Published | Fixed 2026-09-02: the strip no longer repeats the number; the hero row above already carries it with its SLA basis. |
| Hero trust strip, item 01 | "Eight blocks, one accountable team" | The eight cybersecurity blocks of `docs/DE-SERVICE-MODEL-2026.md` (PR #185), as the protection command deck (`ProtectionCommandDeck`) now lists them; Risk & Exposure retained as the continuous layer | Structural | Corrected 2026-09-02: the strip, the deck and the diagrams said "six", the stale pre-2026 model. This is a separate system from the 12 capability lanes and the 14 internal domains. |
| Hero trust strip, item 02 | "reviews at your tier's cadence" | Package tiers in `client/src/lib/proactiveCoverage.ts` and the pricing page define review cadence per tier | Structural | Verify wording against the tier data at the next pricing change |
| Hero trust strip, item 03 | "HIPAA, PCI DSS, SOC 2 and cyber-insurance readiness support. Framework names are your requirements, not our certifications." | Copy states the boundary explicitly | Structural | None. Never present a framework as a DE certification. |
| Stats section (`DigeratiStatsSection` → `HOMEPAGE_FACT_IDS`) | 48% of breaches involve ransomware | Verizon DBIR 2026, URL in registry | Sourced | Re-verify the figure when the 2027 DBIR publishes |
| Stats section | $11.5M average cost of a US data breach | IBM Cost of a Data Breach 2026, URL in registry | Sourced | Re-verify at the 2027 report |
| Stats section | 99%+ of unauthorized access attempts blocked by MFA | Microsoft Digital Defense Report 2025, URL in registry | Sourced | Re-verify at the 2026 report |
| Stats section | $392M internet-crime losses reported from Arizona in 2024 | FBI IC3 Annual Report 2024, URL in registry | Sourced | Re-verify when the 2025 IC3 report publishes |
| Threats & insights (`DigeratiThreatsInsightsSection`) | 45-day Arizona breach-notification window | A.R.S. § 18-552 via Arizona Attorney General FAQ, URL in registry | Sourced | None |
| Lead form and hero copy (`DigeratiLeadFormSection`, `DigeratiHeroSection`, `LeadCaptureBand`) | "24 hours to schedule your Cyber Risk Assessment" | No SLA or published document states a 24-hour scheduling commitment | Unsupported | Removed in the local 2026-10-02 takeover change; now says we will contact the requester to discuss and schedule the assessment. Support response targets do not establish assessment scheduling deadlines. |
| Lead form (`DigeratiLeadFormSection`, "48 hours") | 48-hour turnaround statement | No published basis found | Unsupported | Removed in the local 2026-10-02 takeover change; now says "Findings in plain English". |
| Contact section (`DigeratiContactSection`) | "We'll get back to you within 24 hours" | No published basis; SLA standard tier is next business day | Unsupported | Removed in the local 2026-10-02 takeover change; now says our team will follow up on the enquiry. |
| Services section, capability list (PR #178) | "SOC / MDR Monitoring: 24/7 detection and response" | Service definition; SLA lists 24/7/365 emergency incident response availability | Published | None |
| Diagrams (PR #178): "DETECTION & RESPONSE · 24/7" (was "SECURITY OPERATIONS · 24/7"), "24/7 · vCIO" | 24/7 detection and response | Same basis as above; the frame is named for block 06 of the eight-block model | Published | None |
| What we protect / How protection works (PR #178) | Eight blocks (seven layers plus Risk & Exposure as the continuous layer); four stages (assessment → roadmap → implementation → continuous) | Structural description of DE's delivery model per `docs/DE-SERVICE-MODEL-2026.md`; labelled as illustration | Structural | Corrected 2026-09-02 from "six layers" |
| Pricing progression (PR #178) | Coverage depth per package | `client/src/lib/proactiveCoverage.ts` canonical inclusions | Structural | Keep the rings bound to that file; never hand-edit inclusions |
| How DE delivers (PR #178, formerly "Client proof") | DE Desk capture | DE's own product, labelled "Real, details removed"; no client data | Structural | Section renamed 2026-09-02 so a product capture is not presented as client proof. Real client evidence stays the reviews feed (Google, Yelp, Thumbtack), published only from live API or permissioned catalog entries. |
| Cyber Risk Assessment CTA (PR #178) | "The inspection" figure with priority marks | Labelled "Example, not a client report" in the figure and caption | Structural | None |
| Page metadata (`useSEO` in `client/src/pages/DigeratiHomepage.tsx`) | Description: "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment …" (was "24/7 operations") | SLA page: "24/7/365 emergency incident response availability" (`client/src/pages/legal/SLA.tsx`); Terms of Use: "Emergency Support: 24/7/365 for critical incidents". "Operations" was not tier-true: the IT (Entry) tier carries no 24/7 detection and response (`client/src/data/pricing.ts`) | Corrected 2026-09-30 | None |

## Version B preview `/v2` (noindex)

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| Problem field | 48% of breaches involve ransomware — Verizon DBIR 2026 | Matches `dbir-ransomware-2026` | Sourced | Add the registry URL as a footnote when the page is rebuilt |
| Problem field | 62% of breaches involve the human element — Verizon DBIR 2026 | Matches `dbir-human-element-2026` | Sourced | Same |
| Problem field | $392M lost to internet crime from Arizona in 2024 — FBI IC3 | Matches `az-ic3-losses-2024` | Sourced | Same |
| Problem field | ~96% of sized ransomware victims were SMBs — Verizon DBIR 2026 | Matches `dbir-smb-ransomware-victims-2026` | Sourced | Same |
| Cadence chapter | MFA blocks 99%+ of unauthorized access attempts — Microsoft 2025 | Matches `microsoft-mfa-blocks-2025` | Sourced | Same |
| Range rail | "Fourteen domains" DE operates | DE's domain taxonomy used across the site and the Experience Plan; no file in the repository enumerates the fourteen (open discrepancy in `docs/DE-SERVICE-MODEL-2026.md`) | Unsupported | The 2026-09-02 review found fourteen domains too many for a buying decision on a homepage; the homepage leads with the eight cybersecurity blocks. The fourteen stay unenumerated until Joe resolves the taxonomy; do not conflate them with the eight blocks or the 12 capability lanes. |

## Version 4 preview `/version-4` (noindex)

Every quoted artifact on V4 is verbatim from the DE page that publishes it, and
says so on the page. Rows marked **Practice** are statements of how DE works
(not metrics, results or certifications); they need Joe's confirmation before
V4 is proposed for `/`, per `docs/VERSION-4-HOMEPAGE-SOURCE-OF-TRUTH.md` §10.

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| 01 Hero, guarantee figure | "Digerati Experts 30-day, no-questions-asked money-back guarantee on managed IT and cybersecurity services." / "Release from contracts without penalties. No questions asked, no fine print." | Verbatim from `client/src/pages/about/Guarantee.tsx` (page description and bullet list) | Published | None. Linked to `/about/guarantee` beside the quote. |
| 01 Hero | "Cybersecurity-first managed technology for Arizona businesses" | DE positioning as the production hero and `/solutions/proactive-ecosystem` state it | Structural | None |
| 02 Sizer | "They stay on this device, and this step asks for no contact details." | `client/src/lib/solutionDraft.ts` writes `localStorage` only; the sizer has three numeric inputs and no contact field | Structural | Re-verify if the sizer ever gains a network call |
| 02 Sizer | "It is the same profile the store sizes every solution from, so nothing is asked twice." | `BusinessNeedsIndex.tsx` reads the same draft on mount and on `SOLUTION_DRAFT_EVENT`; harness verifies the draft round-trip | Structural | None |
| 03 Scope | Eight questions, one per block, sized to the visitor's numbers | The eight-block model (`docs/DE-SERVICE-MODEL-2026.md` via PR #185); the counts are the visitor's own input | Structural | None. No result or score is shown. |
| 03 Scope, "Then" | "You get the findings in plain English, and you keep them whichever way you go — including the way where the answer is that you do not need us for this." | "Plain English" is the Bill of Rights pledge. 2026-10-02: the findings belong to the client. Digerati Experts writes them. | Practice | Exit popup third fact is "Yours to keep." No delivery date, no score. See `VENDOR_SETUP_STATUS.md`. |
| 04 Path | "what we would not take on" · exit D "No engagement … You keep the findings." | Same 2026-10-02 decision as the row above | Practice | Same popup line. The findings belong to the client. |
| 05 Blocks | Eight blocks, Risk & Exposure continuous | Same basis as the homepage row above; code-drawn, caption says "states no metric" | Structural | None |
| 06 Desk | DE Desk capture, `client/public/images/evidence/de-desk-shell.webp` | Captured from this site's own support widget (`ZohoASAPWidget`); QA placeholder details removed; labelled "Real, details removed" with `data-classification="SANITIZED_REAL"` | Structural | The capture carries the widget's own line "100% Arizona-based engineering desk" (`ZohoASAPWidget.tsx:1456`); that claim is the widget's, already live, and is not restated in V4 copy |
| 07 Ledger, right column | Service names: DE Security Foundation, Detection & Response, Managed Workplace, DE Desk, Microsoft 365 / Google Workspace / Zoho workspace support, UCaaS: Voice & Meetings, Compliance Evidence & Risk Reporting, BCDR, Endpoint Backup, User Cloud Storage Backup, ProActive IT → Office → Business → Enterprise, Hybrid / Multi-Site | Package lines in `client/src/pages/ProActiveEcosystemPricing.tsx` and `client/src/data/pricing.ts`; network names from `docs/DE-NAMING-CANON.md` | Published | **Threadline and Switchboard were removed on 2026-09-28**: they exist only in the naming canon, with no page, package or store entry behind them, so naming them as "the thing we run" would have implied an available service. Restore them here only when a page publishes them. Footnote on the page: no supplier named, no tier priced |
| 06 Desk, caption | "the support surface on every page of this site … from the launcher at the bottom right" | `MarketingChrome` mounts the DE Desk launcher on every marketing route; the launcher sits bottom-right at every width | Structural | Re-verify if the launcher moves |
| 09 Fit, industries line | "Arizona businesses in Healthcare · Accounting & finance · Law firms · Real estate · Nonprofits · Animal hospitals and beyond" | One published page per sector: `client/src/pages/industries/*.tsx`, routed under `/industries/*` in `App.tsx` | Structural | Add or remove a name only when its page is added or removed |
| 09 Fit, ProActive | "Entry tiers start at five people." | `minUsers: 5` on the ProActive IT and Office plans, `client/src/pages/ProActiveEcosystemPricing.tsx` | Published | Re-verify at the next pricing change |
| 07 Ledger, Comply | "Framework alignment — HIPAA, SOC 2, cyber insurance" | Trust Center compliance-support list; the page's own boundary is quoted in 08 | Published | Never present a framework as a DE certification |
| 08 Proof | Two pledges, verbatim: "We Pledge to never recommend or deliver a service that would put you at risk for non-compliance." / "We Pledge to deliver solutions on budget with straightforward, clear billing—without mistakes, hidden fees, or unexpected expenses." | `client/src/pages/about/ClientBillOfRights.tsx` | Published | None. Linked to `/about/client-bill-of-rights` |
| 08 Proof | "These names describe frameworks and customer requirements Digerati Experts helps organizations address. They are not certifications DE holds." | `client/src/pages/trust/TrustCenter.tsx` | Published | None |
| 08 Proof | "Critical (Active Breach/System Down) · 15 minutes" | `client/src/pages/legal/SLA.tsx`, Standard Response Times | Published | Shown with the tier name and the note that lower tiers are slower — never as a blanket "15-minute response" |
| 08 Proof | Joseph Petro, "Founder & Chief Technology Strategist", Chandler, Arizona; "Directly involved in the assessments, the architecture and the milestones that matter" | Production homepage `DigeratiMeetExpertsSection` (same photograph, title and involvement copy) | Published | None |
| 09 Fit | "You want the solution without changing IT providers." / "You have IT capability and want DE involved." / "You want DE to act as the IT department." | Verbatim "Best fit" row, `client/src/pages/solutions/StandaloneServices.tsx` and `CoManagedIT.tsx` | Published | None |
| 09 Fit | "progressing IT → Office → Business → Enterprise. Each tier is a fit for a different environment, not a merchandising rank." | `client/src/pages/solutions/ProActiveEcosystemPage.tsx` subtitle | Published | None |
| 09 Fit | Pricing scope note | `PRICING_SCOPE_NOTE`, `client/src/data/pricing.ts` | Published | None |
| 10 Close (nothing typed) | Guarantee body, verbatim: "If you are not over-the-top thrilled … no questions asked." | `client/src/pages/about/Guarantee.tsx` | Published | None |
| 08 Proof, reviews row | Client reviews when the feed has them; otherwise "We publish only real client reviews, verbatim — never placeholders." and "Read us on Google" | Same feed and wording as the production homepage's Client Proof section: `GET /api/public/reviews` (live Google Places when valid, plus the verbatim catalog in `client/src/data/reviewsCatalog.ts`), falling back to the catalog; the link is DE's verified service-area Google Business Profile (Maps CID) | Published | Reviews are shown whole or not at all, with author, rating, source and date exactly as the source shows them, labelled "Live from Google" or "published with permission"; an average only when Google returns one. Empty today: the catalog is empty and Places does not answer for a service-area listing (`docs/GOOGLE-REVIEWS.md`) |
| Page metadata (on promotion) | Title "Managed Security Service Provider"; description "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment …" | SLA page: "24/7/365 emergency incident response availability" (`client/src/pages/legal/SLA.tsx`); Terms of Use: "Emergency Support: 24/7/365 for critical incidents". Production's line says "24/7 operations", which the pricing data does not support as a blanket claim: the IT (Entry) tier carries no 24/7 detection and response (`client/src/data/pricing.ts`), so this page names the SLA commitment instead | Corrected 2026-09-30 | Not visible on `/version-4`, where `VersionFrame` sets the preview's own noindex title and description. The live homepage's own line (`client/src/pages/DigeratiHomepage.tsx`) is a separate one-line fix |
| Absent by design | Reviews, case studies, client logos, counters, telemetry, certifications | `reviewsCatalog` and `publishedCaseStudies` are empty; nothing is faked | — | Add real reviews only through the catalog / live API per `design/PROOF_SYSTEM.md` |

## Version 5 preview `/version-5` (noindex; PR #292, merged 2026-10-01, verified live)

Every figure on this page is read at build time from a file the rest of the site already trusts, and `scripts/qa/homepage-v5-acceptance.mjs` fails the build if the rendered page shows any figure that does not appear verbatim in one of them.

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| Hero facts | "From $125 per user a month, $1,600 monthly minimum" | `client/src/data/pricing.ts` (`pricing.it.user`, `pricing.it.monthlyMinimum`), rendered from the import | Published | Bound to the file; never hand-edit |
| Hero facts, Response times table | Critical 15 minutes, High 1 hour, Medium 4 hours, Low next business day; "24/7/365 emergency incident response availability"; service credits for SLA violations | `client/src/pages/legal/SLA.tsx` | Published | Change the SLA page first, then this table |
| Hero, footer, contact | Chandler, Arizona; Greater Phoenix (Chandler, Phoenix, Scottsdale, Tempe, Mesa, Gilbert); 325-480-9870; info@digeratiexperts.com; 3165 S Alma School Rd Suite 29, Chandler, AZ 85248 | `shared/companyContact.ts` (`COMPANY`, `PRIMARY_PHONE`), rendered from the import | Published | None |
| Hero figure | Joseph Petro, founder; "Principal-led. Accountable recommendations from the people who stand behind the work." | The approved photograph live on `/` and `/about/team` (`client/public/images/founder/joe-petro-studio-blazer-white.jpg`); the line paraphrases `client/src/pages/about/Team.tsx` | Published | None |
| What we do, six cards | Help desk that owns the issue; 24/7 managed detection and response; tested backups with agreed recovery targets; managed network and connectivity; co-managed coverage; compliance reporting with the framework boundary | `pricing.ts` inclusions ("Service desk & issue ownership", "DE Security Foundation with 24/7 managed detection and response", "Managed network & connectivity", "Endpoint backup"); solution page subtitles in `client/src/pages/routes/servicePages.tsx`; the framework boundary from the homepage trust strip row above | Published | Each card links to the page that carries the detail |
| What we do, coverage strip | The eight blocks: Identity & Access, Endpoint, Email & Collaboration, Browser & Web, Network, Detection & Response, Human Risk, Risk & Exposure | `client/src/components/visual/ProtectionCommandDeck.tsx` on main (the live homepage's command deck) | Structural | Keep in step with the deck |
| Who we work with | Healthcare, law firms, accounting and finance, real estate, nonprofits, veterinary practices, professional services | Each chip links to an existing `/industries/*` page; the acceptance script fails on a link that does not answer 200 | Structural | None |
| How it works | Cyber Risk Assessment → written recommendation of one of four ProActive models → onboarding → ongoing operations with reviews at the tier's cadence (annual, semi-annual, quarterly executive) | `/book` page copy; published FAQ answer ("We start with a Cyber Risk Assessment…"); `pricing.ts` inclusions name the review cadence per tier | Structural | Same as the homepage's four-stage row |
| Pricing, four cards | $125 / $165 / $245 / $345 per user per month; $1,600 / $2,400 / $5,400 / $9,000 monthly minimums; ideal-buyer lines; first three inclusions; "No Black-Box IT…"; the scope note | `client/src/data/pricing.ts` (`pricingTiers`, `NO_BLACK_BOX_TAGLINE`, `PRICING_SCOPE_NOTE`), rendered from the import | Published | Bound to the file |
| Pledges | 30-day, no-questions-asked money-back guarantee; Client Bill of Rights (complete satisfaction, compliance-first, plain English, professionalism and respect); 21 questions to ask any IT company | `/about/guarantee`, `/about/client-bill-of-rights`, `/about/21-questions` (existing pages, linked) | Published | If the guarantee page changes, this line changes |
| Questions | Four questions and answers | Verbatim from `client/src/pages/sections/DigeratiFAQSection.tsx` (already published on `/`) | Published | Keep verbatim or change both |
| Reviews | Real reviews only, from `GET /api/public/reviews` (live Google feed or the permissioned catalog); the section is absent when the feed is empty | `docs/GOOGLE-REVIEWS.md`; no quote, name or rating is written into the page | Published | None |
| Page metadata (`useSEO`) | "Arizona MSP/MSSP. Cybersecurity-first managed IT, 24/7 emergency incident response, and a Cyber Risk Assessment that matches the operating model to your environment." | Same SLA basis as the `/` metadata row and PR #288 | Published | None |

## Version 6 preview `/version-6` (noindex)

Every section of the live homepage, redrawn on the Version 5 system. The same acceptance script checks it (`scripts/qa/homepage-v5-acceptance.mjs --scope v6`, limits in `client/src/pages/versions/v6/ACCEPTANCE.md`): every figure on the rendered page must appear verbatim in one of the source files below.

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| Hero facts, pricing | $125 per user a month, $1,600 monthly minimum; the four tiers, minimums, ideal-buyer lines, first three inclusions; the scope note | `client/src/data/pricing.ts`, rendered from the import | Published | Bound to the file; never hand-edited |
| Hero facts, response times table, contact hours | Critical 15 minutes, High 1 hour, Medium 4 hours, Low next business day; 24/7/365 emergency incident response; service credits | `client/src/pages/legal/SLA.tsx` | Published | Change the SLA page first |
| Why it matters | 48% of breaches involve ransomware; $11.5M average US breach cost; 99%+ of unauthorized access attempts blocked by MFA; $392M Arizona internet-crime losses in 2024 | `client/src/data/cyberAwarenessFacts.ts` (`getHomepageCyberFacts`), each linked to its report | Published, sourced | Bound to the file |
| Why we exist, what we tackle, three paths, capabilities, four steps, outcomes, pillars, roles, industries, detection points, CTA items, compliance chips | The live homepage's own copy for those sections, de-dashed | The live section components under `client/src/pages/sections/` | Published on `/` | Keep in step with the live sections, or retire the live ones |
| What we protect | The eight blocks and their two scope lines each; Risk & Exposure as the continuous layer | `client/src/components/visual/ProtectionCommandDeck.tsx` (`protectionDomains`), rendered from the import | Published, Joe-decided model | Bound to the file |
| Hero figure, the people | Joseph Petro, founder and Chief Technology Strategist; the Chandler paragraph | The approved photograph live on `/` and `/about/team`; the live team section's copy | Published | Keep verbatim or change both |
| Client proof | 30-day guarantee, 100% money back; Client Bill of Rights; Trust Center; case studies | `/about/guarantee`, `/about/client-bill-of-rights`, `/trust/trust-center`, `/resources/case-studies` | Published | Link targets must answer 200 |
| Client proof, reviews | Real reviews only, from `GET /api/public/reviews`; otherwise the empty state says so | `docs/GOOGLE-REVIEWS.md` | Published | No quote, name or rating is written in the page |
| Security updates | Items from `GET /api/public/threats?scope=homepage`; otherwise the empty state; the 45-day window; the attribution line | `shared/threatFeed.ts` (`THREAT_ATTRIBUTION`), the live threats section | Published | Bound to the feed |
| Contact, footer | Phone, email, office address, service area, social links; office hours | `shared/companyContact.ts`; hours as published in `client/src/pages/sections/DigeratiContactSection.tsx` | Published | Change the source first |
| Forms | Assessment, contact and newsletter requests | `POST /api/assessment`, `/api/contact`, `/api/newsletter`, the same endpoints and fields the live homepage uses | Published | No new endpoint |
| Questions | Four questions and answers | `client/src/pages/sections/DigeratiFAQSection.tsx`, minus the dashes | Published | Keep in step |
| Removed on purpose | "Results in 24-48 hours"; Microsoft Partner and Apple Consultants badges; the generated office and desk stills; the industry stock photographs; the illustrative assessment dashboard | No source for the first two; `design/IMAGERY.md` for the rest | Not on the page | Add back only with a source |

## Related claims (main fixes and remaining local takeover corrections)

| Where | Claim | Status | Action |
| --- | --- | --- | --- |
| `client/src/pages/routes/locationPages.tsx` (Chandler) | "we deliver 15-minute response times" | Fixed 2026-10-03 | Now "a published SLA with a 15-minute response for critical incidents" |
| `locationPages.tsx` (Chandler, Mesa) | "Same-day onsite support available", "Fast response times" | Fixed 2026-10-03 | Now "Onsite visits from our Chandler office, as your plan sets" (onsite support is a published plan line in `servicePages.tsx`) and the SLA's critical tier |
| Solution pages (`BackupDisasterRecovery`, `ManagedWorkplace`, `OfficePage`) | "quote within 24 hours" | Unsupported | Removed the deadline; follow-up and quote preparation now carry no unsupported turnaround. |
| `ManagedWorkplace.tsx` FAQ | "fully productive within 1 business day" (onboarding) | Unsupported | Removed fixed onboarding and offboarding turnaround; timing is agreed for the environment and required approvals. |

## Site-wide truth pass (2026-10-03)

Joe, 2026-10-03: make the claims flagged by PR #370 "authentic branded and true rather than remove them or flag them forever". Each row says what the page claims now and what makes it true.

| Family | Where | Now | Basis |
| --- | --- | --- | --- |
| Response time | Mission & Values, Team, location pages (all cities via `LocationServicePage`), Chandler data, Managed Store, Remote Support, service and narrative routes, threat detection ("Minutes-to-respond"), Submit Ticket (its tiers read "Immediate", "Tracked to resolution", "Within 2 hours"; now the SLA's four tiers verbatim) | "15-minute response for critical incidents, per our published SLA"; "emergency incident response 24/7/365"; Managed Store's "Guaranteed SLA" now "Published SLA, with service credits" | `client/src/pages/legal/SLA.tsx` (Critical 15 minutes; 24/7/365 emergency availability; service credits). "During business hours" removed: the SLA does not say it |
| Response time, Managed Store | "$50K+ Avg. Savings per client annually" | Replaced by "30 days, money-back guarantee" | No source for the savings figure; the guarantee is `/about/guarantee` |
| Phoenix presence | `phoenix-az` location data; Mesa; Chandler "Primary Office" | Phoenix and Mesa are served "from our Chandler office"; "Phoenix's largest businesses", "Large healthcare networks… Government contractors", "Mesa service office", "Mesa-based technical team" removed; industries are the ones with a published `/industries/*` page | `shared/companyContact.ts` (one office, Chandler; Phoenix metro service area) |
| Phoenix wording | `/about/21-questions` question 18 | "Phoenix-based" now "Chandler-based" | `shared/companyContact.ts` |
| Phoenix superlative | `/about/guarantee` | "only IT firm in the Phoenix area" replaced with an invitation to compare | No survey supports "only" |
| Certifications and partners | Team, Compliance & Certifications, Privacy Policy 4.3, homepage newsletter chips, city-page hero note | Rendered only from `client/src/data/credentials.ts`, each entry linked to the issuer's own record with a checked date; empty until records are confirmed, with a plain statement and an offer to send verification links. `credentials.test.ts` fails if a page types a credential name | No public record found for CISSP, CISM, CEH, OSCP, GIAC, MCSE, VCP, AWS, Azure, ITIL, HDI, Microsoft Partner, Apple Consultants Network or Google Partner (2026-10-03 search; primary directories blocked from the build environment) |
| Google Partner badge | `/thank-you` | Replaced by "Read us on Google" (DE's Google Business Profile, `COMPANY.mapsUrl`) and the 30-day guarantee | No Google Partners or Partner Advantage listing found |
| Ebook case studies | `/resources/ebook` chapters 1 and 3 | Labelled "Example scenario · not a client" (`data-classification="EXAMPLE"`), invented figures (147 devices, 23 systems, $1.2M) removed, each tied to a sourced registry fact (DBIR SMB ransomware share, DBIR vulnerability and human-element shares, IC3 BEC losses). "After conducting hundreds of risk assessments" replaced by the DBIR finding | `design/VISUAL_EVIDENCE.md` EXAMPLE class; `client/src/data/cyberAwarenessFacts.ts` |
| Ebook cover | `client/src/assets/images/ebook-defending-digital-realm-cover.webp` (page, mega menu, blog, og:image) | Code-drawn cover with the real title, subtitle, six chapters and byline; source `design/source/ebook-cover/cover.html` | Replaces a generated image whose author line read "Youthor Name / Auter Reable Here" |
| Cyber facts chips and notes | `/resources/cyber-facts` (page, search title "Credibility Layer" and its description "Use these facts across the site…") | "Every figure names its report and year", "Each card links to the publisher", "State losses and the 45-day notice law"; developer notes ("Tip: Put this under your hero…", "Auto-randomizes on load", "Most persuasive • 2 cards is the sweet spot", "Use 1–3 per page", "Best practice…") replaced with visitor-facing copy | "Peer-Reviewed" and "CISA & FBI IC3 Audited" were not true of the sources |

Still for Joe (no change made): the published office address and phone number do not match public business records (BBB, Arizona Corporation Commission mirrors, Yelp list other Chandler and Phoenix addresses and another number); certifications and partner programs to add to `credentials.ts` with their verification links; Trust Center practice claims ("annual penetration testing", "third-party security audits", "Tier III/IV facilities"); the Privacy Policy's other security-practice bullets.

## How to add a claim

1. Statistics: add the fact to `cyberAwarenessFacts.ts` with source, year, and
   URL, then reference it by id. Never type a number into page copy.
2. Service levels: quote the SLA or Terms tier by name; link to `/legal/sla`.
3. Anything about DE's own performance, clients, or certifications: not
   without a real artifact classified per `design/VISUAL_EVIDENCE.md`.

## Takeover validation boundary — 2026-10-02

The local branch also corrects quote confirmation, location assessment confirmations and Version 7 follow-up copy. It does not alter frozen preview snapshots or the separately owned Version 6 PR. Vendor portal screens explicitly label sample data and disable unavailable mutations/downloads; no vendor integration is represented as live. Historical statistics above were not independently revalidated in this change. Local browser fixtures establish rendering and interaction only, not authenticated tenant isolation. See `docs/CLAUDE-TAKEOVER-20261002.md` for decisions, requirements and release boundaries.
