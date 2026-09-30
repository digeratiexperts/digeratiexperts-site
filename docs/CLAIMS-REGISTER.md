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
| Lead form and hero copy (`DigeratiLeadFormSection`, `DigeratiHeroSection`, `LeadCaptureBand`) | "24 hours to schedule your Cyber Risk Assessment" | No SLA or published document states a 24-hour scheduling commitment | Unsupported | Joe: confirm it is operationally true, or change to "one business day" to match the SLA |
| Lead form (`DigeratiLeadFormSection`, "48 hours") | 48-hour turnaround statement | No published basis found | Unsupported | Joe: confirm or remove |
| Contact section (`DigeratiContactSection`) | "We'll get back to you within 24 hours" | No published basis; SLA standard tier is next business day | Unsupported | Align to "within one business day" unless Joe confirms 24 hours |
| Services section, capability list (PR #178) | "SOC / MDR Monitoring: 24/7 detection and response" | Service definition; SLA lists 24/7/365 emergency incident response availability | Published | None |
| Diagrams (PR #178): "DETECTION & RESPONSE · 24/7" (was "SECURITY OPERATIONS · 24/7"), "24/7 · vCIO" | 24/7 detection and response | Same basis as above; the frame is named for block 06 of the eight-block model | Published | None |
| What we protect / How protection works (PR #178) | Eight blocks (seven layers plus Risk & Exposure as the continuous layer); four stages (assessment → roadmap → implementation → continuous) | Structural description of DE's delivery model per `docs/DE-SERVICE-MODEL-2026.md`; labelled as illustration | Structural | Corrected 2026-09-02 from "six layers" |
| Pricing progression (PR #178) | Coverage depth per package | `client/src/lib/proactiveCoverage.ts` canonical inclusions | Structural | Keep the rings bound to that file; never hand-edit inclusions |
| How DE delivers (PR #178, formerly "Client proof") | DE Desk capture | DE's own product, labelled "Real, details removed"; no client data | Structural | Section renamed 2026-09-02 so a product capture is not presented as client proof. Real client evidence stays the reviews feed (Google, Yelp, Thumbtack), published only from live API or permissioned catalog entries. |
| Cyber Risk Assessment CTA (PR #178) | "The inspection" figure with priority marks | Labelled "Example, not a client report" in the figure and caption | Structural | None |

## Version B preview `/v2` (noindex)

| Where | Claim | Basis | Status | Action |
| --- | --- | --- | --- | --- |
| Problem field | 48% of breaches involve ransomware — Verizon DBIR 2026 | Matches `dbir-ransomware-2026` | Sourced | Add the registry URL as a footnote when the page is rebuilt |
| Problem field | 62% of breaches involve the human element — Verizon DBIR 2026 | Matches `dbir-human-element-2026` | Sourced | Same |
| Problem field | $392M lost to internet crime from Arizona in 2024 — FBI IC3 | Matches `az-ic3-losses-2024` | Sourced | Same |
| Problem field | ~96% of sized ransomware victims were SMBs — Verizon DBIR 2026 | Matches `dbir-smb-ransomware-victims-2026` | Sourced | Same |
| Cadence chapter | MFA blocks 99%+ of unauthorized access attempts — Microsoft 2025 | Matches `microsoft-mfa-blocks-2025` | Sourced | Same |
| Range rail | "Fourteen domains" DE operates | DE's domain taxonomy used across the site and the Experience Plan; no file in the repository enumerates the fourteen (open discrepancy in `docs/DE-SERVICE-MODEL-2026.md`) | Unsupported | The 2026-09-02 review found fourteen domains too many for a buying decision on a homepage; the homepage leads with the eight cybersecurity blocks. The fourteen stay unenumerated until Joe resolves the taxonomy; do not conflate them with the eight blocks or the 12 capability lanes. |

## Elsewhere on the site (outside this PR, listed so they are not forgotten)

| Where | Claim | Status | Action |
| --- | --- | --- | --- |
| `client/src/pages/routes/locationPages.tsx` (Chandler) | "we deliver 15-minute response times" | Unsupported as a blanket claim; the SLA's 15 minutes applies to Critical only | Reword to "15-minute critical response per our SLA" or remove |
| `locationPages.tsx` (Chandler, Mesa) | "Same-day onsite support available", "Fast response times" | Unsupported | Joe: confirm or remove |
| Solution pages (`BackupDisasterRecovery`, `ManagedWorkplace`, `OfficePage`) | "quote within 24 hours" | Unsupported | Joe: confirm or align to one business day |
| `ManagedWorkplace.tsx` FAQ | "fully productive within 1 business day" (onboarding) | Unsupported | Joe: confirm or soften |

## How to add a claim

1. Statistics: add the fact to `cyberAwarenessFacts.ts` with source, year, and
   URL, then reference it by id. Never type a number into page copy.
2. Service levels: quote the SLA or Terms tier by name; link to `/legal/sla`.
3. Anything about DE's own performance, clients, or certifications: not
   without a real artifact classified per `design/VISUAL_EVIDENCE.md`.
