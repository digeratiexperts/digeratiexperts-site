# Content-change register — resource PDFs (VIS-015)

Every material difference between the current public PDF text and the redesigned text. Phase 1 covers the concept datasheet (ProActive IT) plus claim conflicts found in the audit of the other twelve; it grows to all 13 in phase 3.

**Sources of truth used:** `client/src/data/pricing.ts` (cites Intelligence-Hub `CANONICAL_TIERS`; also `docs/DE-SERVICE-MODEL-2026.md` table), `docs/CLAIMS-REGISTER.md`, `shared/companyContact.ts`, `client/src/pages/legal/SLA.tsx`.

Decision key: **Proposed** = applied in the concept, needs Joe's yes before it ships · **Joe** = not applied; Joe decides · **Wording** = tightened, meaning unchanged (listed for completeness).

## A. Claims corrected to the canonical source

| # | Document | Current text | Proposed / issue | Source | Decision |
|---|---|---|---|---|---|
| C-01 | ProActive IT | "Basic security hygiene recommendations from the initial Cyber Risk Assessment." / "Core identity, MFA, and access hygiene guidance." | Inclusions listed as in `pricing.ts`: service desk & issue ownership; DE Security Foundation included; managed endpoint, identity, email and security-monitoring baseline; security awareness and phishing resilience; documented environment basics; upgrade path into Office. The current text understates what is included. | `pricing.ts` `it.inclusions` | Proposed |
| C-02 | ProActive IT | "Advanced SOC/security operations are not included unless added separately." | "24/7 managed detection and response begins in ProActive Office; available to ProActive IT only as a separately scoped addition." Same boundary, named in the canonical service term. | `pricing.ts` (Office is the first tier listing 24/7 MDR); claims register row on the IT tier carrying no 24/7 D&R | Proposed |
| C-03 | ProActive IT | "Move to ProActive Business when the organization needs backup/BCDR, **security awareness**, risk reporting…" | Security awareness removed from the Business trigger, because IT already includes it. Office trigger adds "managed network" and "24/7 detection and response"; Business adds "semi-annual planning reviews"; Enterprise adds "regulated data", "quarterly executive reviews". | `pricing.ts` inclusions per tier | Proposed |
| C-04 | ProActive IT | "estimated public starting point: $125/user/month" | "From $125 per user per month, with a $1,600 monthly minimum." The minimum was missing. | `pricing.ts` `it.monthlyMinimum`; claims register rows "From $125 per user a month, $1,600 monthly minimum" (Published) | Proposed |
| C-05 | ProActive Office (not yet redesigned) | "SOC/security operations can be added…" and "Security Awareness Training is an add-on at this level." | Both are **included** in Office per `pricing.ts` ("DE Security Foundation with 24/7 managed detection and response"; "Security awareness and phishing resilience"). Will be corrected in phase 3. | `pricing.ts` `office.inclusions` | Proposed |
| C-06 | ProActive Office | "Support is designed around 8x5 operations with standard response and faster critical response targets." | No source found in `pricing.ts`, the SLA page or the claims register. The SLA page publishes 24/7/365 emergency incident response. | — | **Joe**: keep, reword to the SLA, or remove |
| C-07 | Office, Business, Enterprise, Overview | Rates shown for IT and Office only; no minimums anywhere. | Show rate and monthly minimum for every ProActive level where a price appears ($165/$2,400 · $245/$5,400 · $345/$9,000). | `pricing.ts`; claims register "Pricing, four cards" (Published) | **Joe**: show prices in Business/Enterprise sheets, or keep them assessment-only |
| C-08 | Ecosystem Overview | Business row lists "threat detection/SOC options" as if 24/7 detection first appears there. | Align the coverage table to `pricing.ts`: 24/7 MDR begins in Office. | `pricing.ts` | Proposed |
| C-09 | Security Readiness Checklist | "Fast Scoring Guide: 0–2 / 3–5 / 6+ Unknown/No answers…" | Existing content, not invented, but an unvalidated scoring method. The brief says not to invent scoring. | — | **Joe**: keep as is, keep labelled as rough guidance, or replace with "count your No/Unknown answers and bring them to the review" |

## B. Additions in the concept datasheet

| # | Addition | Source | Decision |
|---|---|---|---|
| A-01 | Live links: `digeratiexperts.com/book`, `325-480-9870`, `info@digeratiexperts.com`. | `shared/companyContact.ts`; `/book` (canonical; `/assessment` is a legacy redirect to it in `client/src/App.tsx`) | Proposed |
| A-02 | The four-level ladder with rates and minimums (all concepts). | `pricing.ts` | Proposed |
| A-03 | "How an engagement starts": Cyber Risk Assessment → written recommendation → onboarding → ongoing operations (concept B). | Claims register, "How it works" row (Structural) | Proposed |
| A-04 | Concept C only: "The decision" question, "Three things to know" and the Office fit-check bullets. Editorial synthesis of C-01…C-04 facts; no new claim. | derived | Proposed if C is chosen |
| A-05 | Document ID (`DE-DS-PIT`) and edition (`2026.10`) in the footer/header. | new convention | Proposed |
| A-06 | Lead sentence uses `pricing.ts` `it.note` / `idealBuyer` wording ("Essential managed IT with the DE Security Foundation included… smaller, less complex environments"). | `pricing.ts` | Proposed |

## C. Removals

| # | Removed | Why | Decision |
|---|---|---|---|
| R-01 | "Draft resource content for site publication - final scope and pricing determined after assessment." (footer, every page) | "Draft" should not appear on a published public document. The qualification it carries is kept in the scope note ("Published rates are starting points, not quotes… your Cyber Risk Assessment confirms final scope"). | Proposed |
| R-02 | "Note: This draft is written for Digerati Experts public resource use." | Internal production note. Its substance ("names no customers, no vendor-specific claims; final scope depends on…") is kept in the scope note. | Proposed |
| R-03 | "Engagement type: Starting managed IT ecosystem package" | Replaced by "Published starting point" with rate and minimum (C-04). | Proposed |
| R-04 | (other 12 files) "Prepared as sample/educational resource content. Customize before client-specific use." | Internal note. Sample reports will instead carry a prominent EXAMPLE label on every page and on every finding. | Proposed |

## D. Wording only (meaning unchanged)

- "Replacing purely reactive IT support with a more stable managed model" → "Replace purely reactive IT support with a stable managed model" (and the other two purpose lines into the imperative).
- "Creating baseline ownership over users, endpoints…" → "Establish ownership of users, endpoints…"
- "User/device inventory direction" → "User and device inventory direction".

## E. Not touched

No customers, testimonials, metrics, certifications, response times, uptime figures or assessment results were added. No internal account lifecycle values appear in any document.
