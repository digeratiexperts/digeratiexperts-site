# Proof system

Layer 6 of Visual System v2. Parent: `VISUAL_SYSTEM_V2.md`. Policy: `.cursorrules` §3 (do not invent business facts), §20 (structured data only when accurate), §36 (honest empty states).

Purpose: show **human and client proof** without manufacturing trust.

Reviews implementation: `docs/GOOGLE-REVIEWS.md`. Imagery of people: `PHOTOGRAPHY.md`.

---

## What counts as proof

| Strong | Weak / forbidden |
|--------|------------------|
| Verbatim Google / Yelp / Thumbtack reviews from the catalog or live API | Invented quotes, star counts, or “500+ happy clients” |
| Named principal, real photography, real role | Stock “IT manager in headset” as if they were DE staff |
| Documented case-study with DE-approved facts | Fabricated MTTC, savings %, ransomware recoveries |
| Factual chips: `ARIZONA` Principal-led, `24/7` Human-led monitoring when that is actually how the service is sold | `99.99%` uptime, “SOC 2 certified” unless DE confirms, fake vendor-partner walls |
| Honest empty state: “Google reviews are temporarily unavailable.” | A 5-star row invented to fill space |

If required information is unavailable: use an honest empty state, or clearly labeled representative/sample data, and preserve the ability to populate real data later.

---

## ProofChip

Path: `client/src/components/evidence/ProofChip.tsx` (on `main` as of `87e2858`). VIS-001 does not restyle it. VIS-013 owns proof-chapter usage.

Factual only. Examples that are allowed **when they remain true**:

- `24/7` Human-led monitoring — only on offers that actually include 24/7 monitoring (e.g. Business / Enterprise SOC language already in package copy)
- `ARIZONA` Principal-led
- `8 BLOCKS` Assessed / Managed Protection — the eight cybersecurity blocks of the DE 2026 service model (Identity & Access, Endpoint, Email & Collaboration, Browser & Web, Network, Detection & Response, Human Risk, Risk & Exposure); only where the offer genuinely covers them, and never a different count

Never invent. Never use ProofChip as a rating widget. Never put EXAMPLE incident numbers on a ProofChip.

Visual: hairline chip, `bg-de-raised` or paper equivalent, Oxanium or small Inter. Active/selected border `#D3126A`. Not a purple pill. Not a Store category pill.

---

## Human proof

Prefer real people over avatars.

- Founder / principal: only with an approved photograph (`PHOTOGRAPHY.md`). Do not generate a face.
- Team: real names and roles DE has published. Do not invent headcount.
- Reviewers: names as they appear on the source platform; do not “improve” the quote.

Until photography exists, keep type + honest layout. Do not drop generic stock into the proof chapter to avoid emptiness.

---

## Client proof

Homepage Client Proof already aggregates live Places / Yelp when configured, plus a curated verbatim catalog. Rules:

- Failed APIs are omitted; never show raw errors as reviews
- Empty catalog + no live data → honest empty state
- Do not set an invalid `GOOGLE_PLACE_ID` to silence unconfigured
- Review/rating **structured data** only when legitimately supported (`.cursorrules` §20)

Case studies: real engagements only. If none are published: “No published case studies yet.”

---

## Operational proof vs marketing proof

| Kind | Classification | Surface |
|------|----------------|---------|
| Live reviews | LIVE (API) or verbatim catalog (treat as real, sourced) | Proof chapter, trust |
| Assessment excerpt | SANITIZED REAL | EvidenceFrame |
| Incident sequence | EXAMPLE unless sanitized-real | IncidentFlow — not a proof chip |
| Package inclusions | Product truth from canonical pricing | Coverage diagram, not a fake SLA badge |

Do not move EXAMPLE telemetry into the proof chapter. Proof is Layer 6; fake SOC is not proof.

---

## Do

- Source statistics from CISA, NIST, FBI/IC3, Microsoft, Verizon DBIR, IBM, FTC, or official regulators when citing industry risk (`.cursorrules` §33) — and still do not imply those numbers are DE’s
- Keep “Your Technology. Your Data. Your Keys.” as a principle, not a fabricated contractual guarantee
- Preserve existing genuine differentiators (cybersecurity-first IT, assessment-led, Arizona/local accountability)

## Do not

- Fabricate clients, logos, testimonials, ratings, certifications, awards, partnerships, response times, uptime, ransomware stats, case-study results, employee counts, years in business, compliance status, or guarantees
- Use emerald StatusTokens on proof chips to imply a live estate is healthy
- Restyle Journal amber or Store electric to “match proof”

---

## Consumers (later)

- VIS-012 photography
- VIS-013 proof system implementation
- Homepage proof / trust chapters
- PDP factual chips (Store — still no invented metrics)

Related: `client/src/data/reviewsCatalog.ts`, `docs/GOOGLE-REVIEWS.md`.
