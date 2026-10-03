# Content-change register — 13 public resource PDFs (VIS-015)

**Approved by Joe on 2026-10-03** ("approved", in reply to the review package at `9be76c4`). This approval covers every item in this register, including C-05–C-08, A-03, A-12 and A-14.

Every material difference between the May 2026 PDFs and the 2026-10 edition. Joe approved fixing all audit findings and asked for best-judgement decisions on the open items (2026-10-03). Those decisions are marked **Decided** with the reason, so any of them can be reversed by editing one content file and rebuilding.

**Sources of truth:**
- `client/src/data/pricing.ts`: prices, minimums, inclusions and cadence. It mirrors Intelligence-Hub `CANONICAL_TIERS`.
- `docs/CLAIMS-REGISTER.md`
- `shared/companyContact.ts`
- `client/src/pages/legal/SLA.tsx`

**Not added anywhere:**
- customers, testimonials or logos
- metrics, statistics or assessment results
- certifications, response times or uptime figures
- vendor names, except the workplace platforms the site already publishes (Microsoft 365, Google Workspace, Zoho)
- internal account lifecycle values

## A. Changes applied to all 13

| # | Change | Why |
|---|---|---|
| G-01 | Removed the footers "Draft resource content for site publication — final scope and pricing determined after assessment" (8 files) and "Prepared as sample/educational resource content. Customize before client-specific use." (5 files). | Internal production notes on public files. The qualification they carried is kept in each document's scope note ("Published rates are starting points, not quotes… your Cyber Risk Assessment confirms final scope"). |
| G-02 | Removed "Note: This draft is written for Digerati Experts public resource use." | Same. Its substance (no customer names or vendor claims; scope depends on assessment, users, endpoints, sites, compliance, backup, add-ons) is kept as the scope note. |
| G-03 | Every call to action is now live: `digeratiexperts.com/book` (canonical; `/assessment` redirects to it), `325-480-9870`, `info@digeratiexperts.com`. | No document had a working link. |
| G-04 | Added document ID (`DE-DS-…`, `DE-CL-…`, `DE-RP-…`), edition `2026.10`, running header and "Page N of M". | Identification and navigation. |
| G-05 | Table header labels now visible; tables rebuilt with header cells. | The old header text was drawn dark-on-dark. |
| G-06 | Headings no longer strand at page ends: "Recommended Next Step" (both checklists), "Best Fit" (Managed Workplace) and "Common Add-On Areas" (Overview). | Layout defect. |
| G-07 | Wording tightened without changing meaning: imperative list items, "user/device" → "user and device", "tier movement" → "level changes", "dropship" → "drop-ship". | Readability. |

## B. Claims corrected to the canonical source

| # | Document | Was | Now | Source |
|---|---|---|---|---|
| C-01 | ProActive IT | "Basic security hygiene recommendations…" / "Core identity, MFA, and access hygiene guidance." | The six `pricing.ts` inclusions, including the DE Security Foundation, the managed endpoint/identity/email/monitoring baseline, and security awareness. | `pricing.it.inclusions` |
| C-02 | ProActive IT | "Advanced SOC/security operations are not included unless added separately." | "24/7 managed detection and response: included from ProActive Office; added to ProActive IT only by separate scope." | `pricing.ts`; claims register (the IT tier carries no 24/7 detection and response) |
| C-03 | ProActive IT, Office, Business | Move to Business for "…security awareness…" | The original move-up wording is kept word for word, with one deletion: "security awareness" is dropped from the Business trigger because `pricing.ts` explicitly includes it in ProActive IT. | Original IT datasheet; `pricing.it.inclusions` |
| C-04 | ProActive IT | "$125/user/month" | "$125 per user per month, $1,600 monthly minimum". | `pricing.it` |
| C-05 | ProActive Office | "SOC/security operations can be added…"; "Security Awareness Training is an add-on at this level." | Both shown as **Included**: "DE Security Foundation with 24/7 managed detection and response", "Security awareness and phishing resilience". Also added from `pricing.ts`: stronger MFA/SSO/password hygiene, advanced email anti-phishing. | `pricing.office.inclusions` |
| C-06 | ProActive Office | "Support is designed around 8x5 operations with standard response and faster critical response targets." | **Decided: removed.** Replaced with "Response targets and 24/7/365 emergency incident response availability are defined in the DE Service Level Agreement (digeratiexperts.com/legal/sla)." "8x5" had no source and reads against the published 24/7/365 emergency commitment. | `SLA.tsx`; claims register |
| C-07 | Office, Business, Enterprise, Overview | Rate shown for IT and Office only; no minimums. | **Decided: show rate and monthly minimum for every level.** These figures are already published on the site's pricing pages (claims register "Pricing, four cards", Published). | `pricing.ts` |
| C-08 | Ecosystem Overview | Business row read as if 24/7 detection first appears at Business ("threat detection/SOC options"); Office row did not mention it. | Each row now states what that level's `pricing.ts` list includes (Office: "…endpoint backup and 24/7 managed detection and response"; Business: "backup and DR posture, user cloud backup, enhanced threat detection, security awareness training, compliance and risk reporting, semi-annual reviews"). Positive statements only; no row says what a level lacks. Added a rate / minimum column. | `pricing.ts` |
| C-09 | Security Readiness Checklist | "Fast Scoring Guide" (0–2 / 3–5 / 6+ Unknown/No answers). | **Decided: kept the existing thresholds and their wording**, retitled "Reading your answers" and framed as "a rule of thumb for deciding what to do next, not an assessment or a score of your security". No new scoring was invented. | original content |
| C-10 | ProActive Office | "Everything in IT" (implied) | "The ProActive IT baseline… builds on what matters at the IT level", matching `pricing.ts` "Everything meaningful in IT". | `pricing.office.inclusions` |

## C. Additions per document

| # | Document | Addition | Basis |
|---|---|---|---|
| A-01 | IT, Office, Business, Enterprise, Overview | Stepped "ladder" diagram of the four levels with rates and minimums, current level marked. Each level's label names items from that level's own published inclusion list; the labels do not claim lower levels lack them (caption says so). | `pricing.ts` |
| A-02 | IT | "How an engagement starts": assessment → written recommendation → onboarding → operations. | Claims register "How it works" (Structural) |
| A-03 | IT only (Office and Business rows withdrawn) | Scope rows that state what is *not* included at a level. Kept only where an explicit rule says so; see §F. The Office row "Backup and DR posture, compliance reporting: begin in ProActive Business" and the Business row "Audit-grade reporting, quarterly executive reviews: begin in ProActive Enterprise" were **removed** on 2026-10-03 because their only basis was absence from the lower level's inclusion list. | §F |
| A-04 | Enterprise | "Privileged access program elements" row (detail: "Controls for administrative and high-risk access"). | `pricing.enterprise.inclusions`; the detail is a plain-language gloss |
| A-05 | Overview | "In brief" takeaways: one model, four depths; standalone vs Ecosystem; published starting points. | Synthesis of existing text and `pricing.ts` notes ("not a ranking") |
| A-06 | Co-Managed IT | "Who owns what" lanes diagram. Lane labels "Daily operations you already run" and "Approvals for assigned systems" paraphrase "Client internal IT remains the day-to-day owner where assigned" and the "approvals" scope. | Existing operating rules and roles |
| A-07 | UCaaS | Core planning areas shown as four labelled areas. | Existing list |
| A-08 | Managed Workplace | Employee-lifecycle flow; a boundary callout ("runs the technology around your people; employment, payroll, benefits and legal decisions stay with you") summarizing the existing "What this is not" list, which is kept in full. | Existing content |
| A-09 | Both checklists | "How to use it" steps; Yes / No / Unknown boxes and a notes / owner line per check; a notes area. Backup: "Treat Unknown as an area to review, not a pass." Security: "What's covered" index. | Instruction only; consistent with the existing "a 'no' answer… indicates an area that should be reviewed" |
| A-10 | Backup checklist | RPO / RTO timeline diagram; checks grouped (What is protected / Whether it can be recovered / How fast, and how much / Who owns recovery). | Definitions already in the document |
| A-11 | Security checklist | Checks grouped (Identity and devices / Email, backups and network / People and process). | Existing control areas |
| A-12 | Cyber Risk Assessment sample | **EXAMPLE · NOT CLIENT DATA** on every page; summary table restating the three original bullets; three takeaways; contents; a "How to read this sample" limitations panel. Its first point is original; two are new explanation: "A real assessment reports what is found in your environment, so its findings, rating and sequence will differ" and "The roadmap shows the shape of prioritized remediation, not a commitment to particular dates or outcomes." | Brief: label sample content prominently; add limitations |
| A-13 | Compliance & Risk Reports | Summary page and contents; flow of what reports show; boundary callout adds "Framework names are your requirements, not Digerati Experts certifications." | Claims register, homepage trust strip row |
| A-14 | Sample QBR | **EXAMPLE** on every page; cadence diagram (Office annual, Business semi-annual, Enterprise quarterly; the Office annual review comes from `pricing.ts` and was not in the old QBR sheet); callout "Metric categories only. This sample shows no values, because none would be real."; CTA heading "Choose your review cadence" (the original next-step sentence is kept as its detail). | `pricing.ts`; brief |

## D. Removals

| # | Document | Removed | Why |
|---|---|---|---|
| R-01 | Cyber Risk Assessment sample | "…and should be customized before use." | Internal note; the sample is now labelled EXAMPLE throughout. |
| R-02 | Office | "Optional add-ons" heading with SOC and awareness as add-ons. | Corrected by C-05; spend-card controls kept as the one optional add-on. |
| R-03 | All datasheets | "Engagement type: … package - estimated public starting point" lines. | Replaced by the price box (rate + minimum) or an engagement box; Enterprise keeps its engagement-type line verbatim. |

## F. Scope-boundary audit (2026-10-03)

Rule applied: a statement that something is excluded at a level, or begins at a higher level, must come from an explicit scope rule. Absence from a lower level's inclusion list does not count.

| Statement in the PDFs | Explicit source | Result |
|---|---|---|
| IT: endpoint backup not included by default; "backup can be added by scope; endpoint backup is included in ProActive Office" | Original IT datasheet: "No default backup program is included at this level." Site copy (`resourceRegistry.ts`): "Backup is not included at the IT level. Add Managed Workplace, BCDR, or move up to ProActive Office." Office inclusion: `pricing.ts` "Endpoint backup". | Kept. The earlier wording "begins in ProActive Office" was **corrected**, because backup can also be added at IT. |
| IT: 24/7 managed detection and response is a scoped add-on, included from Office | Original IT datasheet: "Advanced SOC/security operations are not included unless added separately." `pricing.ts` Office: "DE Security Foundation with 24/7 managed detection and response". Claims register: the IT tier carries no 24/7 detection and response. | Kept |
| IT: compliance reporting not included; "sits in higher levels or standalone engagements" | Original IT datasheet: "Compliance reporting and audit-grade documentation are handled in higher tiers or standalone engagements." | Kept |
| Office: spend-card lifecycle controls optional | Original Office datasheet: "optional when clients want stronger workplace offboarding controls" | Kept |
| Office: "Backup and DR posture, compliance reporting: begin in ProActive Business" | None: only absence from Office's `pricing.ts` list | **Removed** |
| Business: "Audit-grade reporting, quarterly executive reviews: begin in ProActive Enterprise" | None: the original says these "may increase scope", not that they are excluded | **Removed**. The explicit cadence statement stays: reviews "twice per year" in Business (`pricing.ts`, original Business and QBR sheets). |
| Move-up triggers (IT, Office, Business sheets) | Original IT datasheet "When to move up", verbatim except C-03 | Kept as recommendations, not exclusion claims. The additions made earlier in this PR (managed network, 24/7 MDR, regulated data, privileged access) were **withdrawn**. |
| Ladder labels | Each level's own `pricing.ts` inclusion list. Labels changed from "+ …" (which implied a lower level lacks the item) to a neutral list, with the caption "Labels name items from each level's published inclusions". | Corrected |
| QBR cadence: Office annual, Business semi-annual, Enterprise quarterly | `pricing.ts` inclusions; original QBR sheet ("Semiannual in ProActive Business; quarterly in ProActive Enterprise") | Kept: positive statements per level |
| Compliance reports: "standalone, or included in ProActive Business and Enterprise depending on reporting depth" | Original Compliance & Risk Reports sheet, verbatim | Kept |
