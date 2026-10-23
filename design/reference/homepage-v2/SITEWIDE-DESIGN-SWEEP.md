# Sitewide sweep: applying the homepage decisions to every page

Audited **60 public pages** on digeratiexperts.com on Oct 22, 2026. Each was checked at 1280px (layout, color order, fonts, labels, images) and 390px (horizontal scroll), plus a text scan for offering and claim consistency.

**Good news:** the interior pages don't have the homepage's noise. Gradients and animations are near zero (only Store, Blog and Efficiency-before-AI use gradients), and no page scrolls sideways on a phone. The problems are below.

---

## Part A — Joe's decisions (made 2026-10-22)

1. **24/7 MDR / SOC = Business and Enterprise only.** Office and IT never claim 24/7 MDR or SOC. (Matches DE's internal Security tier map: "Business: All Office + 24/7 MDR".) The **pricing matrix and the Office/IT pages are what's wrong**, not the homepage.
2. **Third lane = "Ready-to-Work IT"** (final). Under 30 users, Arizona and beyond, DE buys / sets up / tests / ships devices, per-user licenses through DE, for business owners and IT departments, no assessment required. Connect it to `/solutions/standalone-services` and the Store engine rather than building a separate buying flow.
3. **Gold approved inside Ink & Gold (`t-ink`) sections** for links, labels and accents. Record the exception in `design/DESIGN-AUTHORITY.md`.
4. **Imagery: a new custom DE visual system** (see Part E). Neither the generic 3D objects nor the pink/white cubes become the standard. **Existing assets stay until replacements are reviewed side by side and approved.**

---

## Part B — Content truth fixes (Phase 1, ship first — wording only)

| Fix | Where | What to change |
|---|---|---|
| **Assessment is required** for Fully Managed and Co-Managed | `/solutions/co-managed-it` (**0 mentions of the assessment**), `/go` (card says "Start here", not required), `/solutions` (Door 1 says "Assessment first"; also apply to the Co-Managed door), all 4 ProActive tier pages, `/proactive-ecosystem-pricing`, `/quote-wizard` (result screen), location + industry CTAs | Add one consistent line: "Fully managed and co-managed plans start with a required Cyber Risk Assessment." |
| **Third lane exists** | `/solutions/standalone-services`, `/go`, `/solutions`, `/store`, `/quote-wizard` (when people ≤ 29), homepage FAQ, location pages ("Serving Greater Phoenix") | Under 30 users, in Arizona and beyond; DE buys, sets up, tests and ships devices; per-user licenses (e.g. Microsoft 365) through DE; for business owners and IT departments; no assessment required. **Never name distributors.** |
| **Unqualified 24/7 claims** | All 6 location pages ("24/7 Human-Led Monitoring" + "24/7 Monitoring" stat), 9 solution pages ("24/7 human-led SOC Monitoring behind the managed stack" in the hero strip), `/contact` ("24/7 Security Operations Center — Always Active"), `/about/mission-values` ("keep your systems running smoothly 24/7"), `/industries/animal-hospitals`, `/industries/professional-services` | Add the tier qualifier everywhere: "24/7 MDR on ProActive Business and Enterprise". Keep "24/7/365 emergency incident response" (that's a published SLA line). |
| **Office/IT wrongly claim 24/7 MDR** | Pricing page Coverage Explorer + estimator cards (Office column: "24/7 MDR", "24/7 SOC Monitoring"), `/solutions/proactive-office-ecosystem`, `/solutions/proactive-it-ecosystem` ("Office adds 24/7 MDR"), `/solutions/proactive-ecosystem` (Office step), `/resources/datasheets` (Office datasheet blurb), tier tables on `/solutions/security-awareness` and `/solutions/security-operations` (Office "Enhanced EDR + 24/7 MDR") | Remove 24/7 MDR/SOC from Office and IT. Office keeps its managed EDR/email/identity stack; 24/7 MDR + SOC first appears at Business. Check that the Business column says it. |
| `/trust` and `/trust/trust-center` say "24/7 Security Operations Center" | Trust pages | Clarify whether this describes **DE's own** security or client coverage. |
| `/solutions/co-managed-it` and `/go` | | Already say "Co-Managed is a separate path — not a ProActive tier." Good; keep it. |

---

## Part C — Design system fixes (Phase 2, global CSS/components)

1. **One typeface.** Every page loads 3 (Inter, Space Grotesk, Oxanium). Standardize on **Space Grotesk** for headings and body. Keep Oxanium only if the logo wordmark needs it (it's an SVG, so it shouldn't).
2. **Kill the colon headlines.** **45 of 60 H1s end with ":"** ("Backup & Disaster Recovery:", "Mission & Values:", "Industries We Serve:"). Write real headlines (the homepage-v2 style: "Industries we serve." or a benefit line like the healthcare page's "Keep patient data protected without becoming a HIPAA expert"). That page is the model.
3. **Sentence-case section labels.** Pages average 10–40 ALL-CAPS labels (Security Updates 43, Solutions 28, Case Studies 22). Convert eyebrows to sentence case in the accent color, like homepage v2. Remove the "— LABEL" dash prefix.
4. **Section color tokens.** Port the four scoped token sets from homepage v2 (`.t-store`, `.t-sonoran`, `.t-ink`, `.t-signal`) into the global stylesheet so every template can use them.
5. **Cards.** Interior pages use dark-on-dark cards with very low contrast (#1c1c1f on ~#0b0b0d). In `t-ink` sections use the ink card (#172138 on #0E1526); in light sections use the white card with the 1px border. Keep the card variant rules (featured = gold left bar, urgent = pink border).

---

## Part D — Template recipes (Phase 3, apply per template)

Interior pages are **almost entirely near-black with one light section** (order like D D L D D D D L D). That reads heavy and makes long pages feel endless. Use the same role rule as the homepage:

> **Ink & Gold** = proof and decisions · **Sonoran** = Arizona/local · **Signal Blue** = how it works · **Store** = everyday reading. Never two of the same in a row.

| Template (pages) | Recommended section order |
|---|---|
| **Solution pages** (13: managed-it-support, threat-detection, security-operations, backup-dr, cloud-backup, compliance-reports, data-encryption, unified-security, vcio-strategy, security-awareness, managed-workplace, efficiency-before-ai, co-managed) | Hero `t-ink` → "Sound familiar?" problems `t-store` → What you get `t-signal` → Outcomes `t-store` → How engagement works `t-signal` → Service tiers table `t-ink` → Where it lives (pricing) `t-store` → FAQ `t-sonoran` → CTA `t-ink` |
| **ProActive tier pages** (IT, Office, Business, Enterprise) | Hero `t-ink` → Who it's for `t-store` → What you get `t-signal` → What's included `t-store` → Not included at this level `t-sonoran` (light) → Add-ons `t-store` → Pricing + required-assessment line `t-ink` |
| **Location pages** (6) | Hero with **real Arizona photo** `t-sonoran` → Services `t-store` → Why [city] chooses DE `t-ink` → Local stat `t-signal` → Industries & neighborhoods `t-store` → Serving Greater Phoenix + third lane line `t-sonoran` (light) → CTA `t-ink`. Also: the 6 pages are near-identical (same height, same blocks). Give each one city-specific paragraph to reduce duplicate-content risk. |
| **Industry pages** (7) | Hero `t-ink` → Critical risks `t-store` → Services for this industry `t-signal` → Compliance checklist `t-ink` → How engagement works `t-signal` → FAQ `t-sonoran` → CTA `t-ink` |
| **About pages** (team, mission, bill of rights, guarantee, 21 questions) | Hero `t-sonoran` → body `t-store` → proof/credentials `t-ink` → CTA `t-ink`. Joe's photo appears **once per page**. |
| **Pricing page** | Hero `t-ink` → Package depth selector `t-store` → Estimator `t-ink` → Coverage Explorer `t-store` (it's already light and clean) → CTA `t-ink` |
| **Resources** (blog, briefs, datasheets, videos, case studies, cyber facts, security updates) | Hero `t-signal` → listing `t-store` → CTA `t-ink`. Blog has 23 gradients; remove them like the homepage. |
| **Store, Contact, Book, Quote wizard** | Leave the visuals alone (the Store is the reference look); apply the Part B wording only. |

---

## Part E — Visual system (Joe's direction, 2026-10-22)

**Goal:** a reusable, distinctive DE visual language. Premium enterprise cybersecurity, without the industry clichés. Every image must show what DE actually provides, not fill empty space.

- **Not the standard:** generic 3D shields, locks and laptops, or the pink/white cube art.
- **Capability cards:** custom architectural 3D forms, abstract security infrastructure, refined geometric compositions, original DE-branded elements.
- **Interior-page heroes:** cinematic, sophisticated compositions that communicate each service's real business value.
- **Store / product pages:** accurate product imagery in consistent DE-branded presentation.
- **Color:** keep the existing themes (Store, Sonoran, Ink & Gold, Signal Blue) and use their color systems consistently, with restrained gold.
- **Consistency:** shared lighting, composition, material quality, typography and visual hierarchy across the site.
- **Process (hard rule):** keep existing assets until each replacement is reviewed and approved in a **side-by-side comparison preview**. No sweeping visual swaps.

Rules that still hold now:
- Real Arizona photos only in Sonoran sections. **Never the same image twice on a page** (the live homepage shows the dusk photo twice).
- Joe's photo: Team section/page only, once.
- Mascots: Dex on the assessment card where the assessment is pitched; Rati only in technical/detection contexts; **no captions or copy about them**. The Ask DE launcher stays as is.

---

## Copy-paste prompt for Claude Code

> Work on branch `claude/sitewide-sweep-20261022`. Use `SITEWIDE-DESIGN-SWEEP.md` as the spec. Do **Phase 1 (Part B wording) only**, then stop and send Joe a PR with a before/after list of every changed sentence. Wait for approval before Phase 2.
>
> **Do NOT change:** routes, nav/footer structure, forms and where they submit, the Store, Ask DE / DE Desk, live feeds, analytics, schema, or legal pages. No new dependencies. Don't name distributors anywhere public. Don't decide any Part A item yourself. Part A decisions are final; apply them. Don't change any imagery in these PRs (Part E is a separate, preview-first project).
>
> Later phases follow the same rule: **one phase per PR**, stop for review after each. Each PR includes screenshots at 1280px and 390px for one page per template.

---

## Appendix — page-by-page measurements

Order is section order, top to bottom: L = light, D = dark. "—" means no measurable sections (single-panel page).

| Page | Light/dark order | ALL-CAPS labels | Fonts | 24/7 mentions | 'Assessment' mentions | H1 ends in ':' |
|---|---|---|---|---|---|---|
| `/` | DDDDDDDDDDDDDD | 61 | 3 | 2 | 27 |  |
| `/about/21-questions` | DLD | 2 | 3 | 1 | 3 | yes |
| `/about/client-bill-of-rights` | DLDD | 4 | 3 | 0 | 0 | yes |
| `/about/guarantee` | DLD | 4 | 3 | 0 | 1 | yes |
| `/about/mission-values` | DDLDD | 5 | 2 | 2 | 3 | yes |
| `/about/team` | DLDD | 5 | 3 | 2 | 4 | yes |
| `/book` | DL | 2 | 3 | 0 | 3 | yes |
| `/contact` | D | 4 | 2 | 1 | 3 |  |
| `/go` | DDD | 10 | 3 | 0 | 3 | yes |
| `/industries` | DLD | 3 | 2 | 0 | 3 | yes |
| `/industries/accounting-finance` | DDLDDL | 7 | 3 | 0 | 4 | yes |
| `/industries/animal-hospitals` | DDLDL | 6 | 3 | 1 | 2 | yes |
| `/industries/healthcare` | DDLDDLDDLD | 15 | 3 | 0 | 13 | yes |
| `/industries/law-firms` | DDLDDLD | 8 | 3 | 0 | 7 | yes |
| `/industries/nonprofits` | DDLDDL | 7 | 3 | 0 | 4 | yes |
| `/industries/professional-services` | DDDLDDDD | 7 | 3 | 1 | 3 | yes |
| `/industries/real-estate` | DDLDDL | 7 | 3 | 0 | 4 | yes |
| `/locations/chandler-az` | DDLDDLD | 9 | 3 | 2 | 7 |  |
| `/locations/gilbert-az` | DDLDDLD | 9 | 3 | 2 | 6 |  |
| `/locations/mesa-az` | DDLDDLD | 9 | 3 | 2 | 8 |  |
| `/locations/phoenix-az` | DDLDDLD | 9 | 3 | 4 | 7 |  |
| `/locations/scottsdale-az` | DDLDDLD | 9 | 3 | 2 | 6 |  |
| `/locations/tempe-az` | DDLDDLD | 9 | 3 | 2 | 6 |  |
| `/proactive-ecosystem-pricing` | DDDLDD | 20 | 3 | 4 | 11 | yes |
| `/quote-wizard` | — | 1 | 3 | 0 | 0 |  |
| `/resources` | DDDL | 3 | 2 | 0 | 3 | yes |
| `/resources/blog` | DDD | 18 | 2 | 0 | 4 |  |
| `/resources/briefs` | — | 1 | 2 | 0 | 3 |  |
| `/resources/case-studies` | DDL | 22 | 3 | 0 | 4 | yes |
| `/resources/cyber-facts` | DDDLD | 21 | 3 | 0 | 3 | yes |
| `/resources/datasheets` | DLD | 15 | 3 | 1 | 4 | yes |
| `/resources/downtime-calculator` | DLD | 7 | 2 | 0 | 2 | yes |
| `/resources/security-checklist` | DLD | 2 | 3 | 0 | 3 | yes |
| `/resources/security-updates` | DLDL | 43 | 2 | 0 | 1 | yes |
| `/resources/videos` | DDLD | 4 | 3 | 0 | 3 | yes |
| `/services/ucaas` | DDLDDLD | 11 | 3 | 1 | 2 | yes |
| `/solutions` | DDDDLDD | 28 | 3 | 4 | 12 | yes |
| `/solutions/backup-disaster-recovery` | DDDLDLDDLDD | 17 | 3 | 0 | 7 | yes |
| `/solutions/cloud-backup` | DDDLDDDDLD | 12 | 3 | 2 | 4 | yes |
| `/solutions/co-managed-it` | DDLDLD | 12 | 3 | 0 | 0 |  |
| `/solutions/compliance-reports` | DDDLDDDDLD | 11 | 3 | 1 | 5 | yes |
| `/solutions/data-encryption` | DDDLDDDDD | 9 | 3 | 2 | 4 | yes |
| `/solutions/efficiency-before-ai` | DDLDLDLD | 26 | 3 | 0 | 6 |  |
| `/solutions/managed-it-support` | DDDLDDDDLD | 12 | 3 | 2 | 5 | yes |
| `/solutions/managed-workplace` | DDLDLDLDD | 10 | 3 | 0 | 2 | yes |
| `/solutions/proactive-business-ecosystem` | DDLDDLD | 10 | 3 | 4 | 4 | yes |
| `/solutions/proactive-ecosystem` | DDDDDDLDD | 23 | 4 | 2 | 12 | yes |
| `/solutions/proactive-enterprise-ecosystem` | DDLDDLD | 9 | 3 | 0 | 4 | yes |
| `/solutions/proactive-it-ecosystem` | DDLDDLD | 10 | 3 | 3 | 5 | yes |
| `/solutions/proactive-office-ecosystem` | DDLDDLD | 10 | 3 | 4 | 4 | yes |
| `/solutions/security-awareness` | DDDLDDDDLD | 12 | 3 | 4 | 4 | yes |
| `/solutions/security-operations` | DDDLDDDDLD | 11 | 3 | 4 | 4 | yes |
| `/solutions/standalone-services` | DDLDD | 7 | 3 | 0 | 2 |  |
| `/solutions/threat-detection` | DDDLDDDDLD | 13 | 3 | 4 | 4 | yes |
| `/solutions/unified-security` | DDDLDDDDD | 9 | 3 | 1 | 4 | yes |
| `/solutions/vcio-strategy` | DDDLDDDDLD | 10 | 3 | 1 | 4 | yes |
| `/store` | DLDDLL | 30 | 4 | 0 | 1 |  |
| `/support/knowledge-base` | DLDD | 6 | 3 | 0 | 0 | yes |
| `/trust` | DDLDD | 7 | 3 | 1 | 0 | yes |
| `/trust/trust-center` | DDLDD | 7 | 3 | 1 | 0 | yes |