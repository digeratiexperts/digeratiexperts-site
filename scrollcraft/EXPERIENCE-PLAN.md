# DE Scrollcraft Experience Plan

**Status:** approved by Joe, 2026-09-01. This document gates all Scrollcraft
work on digeratiexperts.com. Nothing in §06–§07 ships until its phase gate is
passed by Joe. Governed by `docs/AI-ENGINEERING-GOVERNANCE.md`; the claim is
`de-site-v2-scrollcraft` in `.ai/ACTIVE_WORK.yaml`.

Companion documents (session artifacts, review-only):

- Experience Plan (this document, designed edition): the "DE Scrollcraft
  Experience Plan" artifact.
- Phase 0 inventory: the "Scrollcraft Review Gallery" artifact.
- Phase 2 briefs: the "DE Flagship Briefs" artifact.

> **Scrollcraft is a storytelling capability, not a visual theme.** DE looks
> like DE whether a page scrolls cinematically or sits perfectly still.

**What DE is.** A Managed Security Service Provider and an IT Managed
Services company. Managed security and managed IT are the offering every
page sells, the flagships are built around them, and they are developed
first and to the highest finish. DE also does AI and the rest of the
fourteen domains, each within its scope. AI material is wanted (Joe,
2026-09-01), but AI is one contained domain and never the lead: Automation +
AI stays in the plan as the last flagship, built only after the four service
flagships, and never given more prominence in the information architecture
than managed security and managed IT.

## Where things stand

- Production `/` serves the original homepage, unchanged.
- Version B is live for review at `/v2` (noindex preview, PR #172).
- PR #164 merged the Version B build into `scrollcraft/builds/de-v2`.
- PR #173 (Version B at `/`) was blocked by the public-route smoke guardrail
  and reverted by PR #177 at Joe's decision. Production never changed.
- All Scrollcraft implementation is frozen; this plan reopens it phase by phase.

## 01 · Four experience levels, with a motion budget each

| Level | Purpose | Motion budget (maximum) |
|---|---|---|
| A · FULL | Change how the visitor understands the company | 1 signature behavior · 1 major peak · 2–4 supporting devices · deliberate quiet sections · designed reduced-motion parity |
| B · SELECTIVE | Sequence or a visual explanation earns its place | 1 meaningful scroll sequence · 1 secondary reveal system |
| C · NORMAL | Read, compare, decide | Entrances, state changes, small hierarchy cues only |
| D · UTILITY | Get something done quickly | Functional feedback only |

Level A additionally requires an approved asset brief (§05) and a fingerprint
check against `scrollcraft/FINGERPRINTS.md` before any code. Levels C and D
never receive Scrollcraft treatment.

## 02 · Route inventory with designations

142 routed pages plus the static `/v2` preview tree.

### Level A — flagship narratives (4 services + 1 last)

| Route | Note |
|---|---|
| `/` | The flagship, rebuilt from the strongest of production, Version B, the DE visual system, and a new material direction. Brief 1. |
| `/solutions/proactive-ecosystem` | New grammar: a living operating cadence, not another map assembly. Brief 2. |
| How We Protect — **route TBD** | Default proposal: elevate `/solutions/unified-security`. Brief 3. |
| `/assessment` | The conversion flagship: unknown → observed → findings → prioritized → roadmap. Brief 4. |
| Automation + AI — **last**, route TBD | Built only after the four service flagships; default `/solutions/automation-ai`; subordinate in the IA. Brief 5. |

### Level B — selective moments (10)

`/solutions` (orientation landscape) · `/industries` + the six industry pages
(law, healthcare, accounting-finance, real-estate, animal-hospitals,
nonprofits: one industry-specific moment each) · `/about/mission-values` (one
editorial movement: independent + technical + local + principal-led) ·
`/store` (one controlled branded introduction; motion gets out of the way once
shopping starts).

### Level C — editorial / normal marketing (~45)

Solutions detail pages (managed-it-support, managed-workplace,
backup-disaster-recovery, co-managed-it, standalone-services, email-security,
endpoint-management, identity-management, threat-detection,
security-operations, security-awareness, data-encryption, compliance-reports,
vcio-strategy, unified-security unless elevated) · the four ProActive tier
pages, business-needs, solutions/request · pricing (`/pricing`,
`/ecosystem-pricing`, `/proactive-ecosystem-pricing`) · six location pages ·
resources (index, blog, blog posts, case-studies, cyber-facts,
security-updates, videos, datasheets, security-checklist,
downtime-calculator, ebook) · about (team, press, guarantee, insurance,
compliance, compliance-certifications, client-bill-of-rights, 21-questions,
about/support) · trust (`/trust`, `/trust/trust-center`: almost documentary)
· `/book`, `/services/ucaas`, `/case-studies`.

### Level D — utility / transactional (~80; Scrollcraft forbidden)

Contact and FAQ surfaces (incl. the quiet pages) · legal (seven documents,
`/privacy`, `/terms`) · auth (`/login`, `/signup`, portal auth routes) ·
`/portal/*` (38 routes) · support (submit-ticket, ticket-confirmation,
knowledge-base, remote-support, pay-invoice) · commerce (`/store/checkout`,
`/store/solution`, `/store/solutions/:family`, `/quote-wizard`,
`/quote-confirmation`, `/thank-you-success-page`) · internal tools
(`/internal/warehouse/*`, `/de-ecosystem-matrix-offical`,
`/official-network-planner`) · `/trust/vulnerability-disclosure`,
`/trust/accessibility` · `/v2` (temporary preview).

## 03 · Existing material audit

Corrected after the Phase 0 inventory (the visual-system library under
`client/public/images/` was missed in the first draft).

**Class A — real DE evidence.** DE Desk support-surface capture
(`scrollcraft/builds/de-v2/assets/de-desk-support.webp`, in use); assessment
desk scene (`attached_assets/de-trust-assessment-desk.png`, sanitized real);
pricing render (`client/public/images/visual-system/site/pricing-ecosystem`);
coded React diagrams (ProActiveEcosystemDiagram, EcosystemProgression,
AssessmentReportSample); 52 vendor/tooling logos
(`client/public/images/vendors/`). Uncaptured: DE Desk and portal as live
software, assessment deliverables, roadmap and QBR structure. Reviews catalog
empty by rule; case studies pending client permission.

**Class B — real people and place.** Founder portrait (two crops:
`de-v2/assets/joe-petro.webp`,
`client/public/images/founder/joe-petro-studio-blazer-white.jpg`); Arizona
dusk (`de-v2/assets/arizona-dusk.webp`, same source as the production hero
dusk); Chandler office at evening
(`attached_assets/de-arizona-office-evening.png`); section atmosphere plate.
Not on file: working environment, hands-on engineering, equipment, meetings,
team.

**Class C — bespoke explanatory graphics.** Version B environment map
(`de-v2/de.js`); EnvironmentAssembly + EnvironmentFolio
(`client/src/scrollstory/`); decorative patterns (blueprint grid, hero
overlay, network shield) that are not a diagram system. Biggest opportunity.

**Class D — art-directed imagery.** Graphite Illumination plates ×6 with the
deterministic generator (`de-v2/lab/plates/`); Meshy batch-01 approved
licensed stills (identity, endpoint, email, network, backup) at
`client/public/images/visual-system/meshy-batch-01/`; engagement-path brand
art ×4 at `client/public/images/visual-system/engage-paths/`; eight Lucid
Origin generated images in `attached_assets/` (SOC-center and abstract
subjects — the visual governance forbids the neon SOC wall as a direction);
brand backgrounds and Figma exports (`Rectangle-*`, `Frame *`, `Homepage_*`;
source `digerati_*.fig`); the ebook cover.

**Class E — sourced / licensed.** Cited industry statistics (Verizon DBIR
2026, FBI IC3 2024, A.R.S. §18-552, IBM, Microsoft) with source and year
inline, industry context only; fourteen stock photographs in
`attached_assets/stock_images/` whose source and license are not recorded in
the repository; three generic marketing stills.

Reference clutter (184 pasted screenshots, 21 phone screenshots, ~90 pasted
text specs) is counted, not used.

## 04 · Current Scrollcraft work: keep / redesign / reject

**Keep:** the story-first pipeline; the energy curve with authored silence and
one major peak ("THE ENVIRONMENT WAKES UP" stays the homepage's central
idea); reduced-motion parity, harness verification and contrast gates; the
real-evidence rule and outcome-driven interaction; editorial typography on
the locked faces; the fingerprint registry discipline.

**Redesign:** the Graphite Illumination material language (one instrument,
seasoning not meal); the environment-map visual language (two builds drew the
same map; the idea stays, the execution restarts on the diagram system); the
margin folio (retired as a default); mobile as a designed sequence; the seams
between Scrollcraft sections and site chrome.

**Reject:** chaptered editorial + margin map as a default grammar (occupied
twice; closed); internal-process language in viewer copy; recycled server
artifacts as hero material; designing to the 14vh ceiling.

## 05 · Material creation plan

1. **The DE diagram system (Class C, the signature).** One governed visual
   language for architecture, workflow, protection-boundary,
   assessment-finding, coverage and lifecycle diagrams on DE tokens — static
   on Level C pages, animated inside Level A experiences.
2. **The concept art set (Class D, eight pieces, one material family).**
   Fragmentation · Connection · Boundary · Continuity · Orchestration ·
   Intelligence · Recovery · Human oversight. Concept, not noun. Generated
   base material where the allowlist permits (`api.kie.ai`,
   `kieai.redpandaai.co` — currently blocked), composited and finished with
   code/vector overlays; authored generatively in-house otherwise. Board test
   before anything moves.
3. **Photography and evidence capture (Classes B and A).** A half-day shoot
   with one photographer (office, working environment, engineering,
   equipment, meetings, founder in context; never AI-generated humans as
   staff). Sanitized captures of DE Desk, the portal, the solution builder, an
   assessment deliverable's structure, a roadmap view, each with provenance.

**The asset-brief gate.** No Level A or B page begins coding until its
scene-by-scene asset table (scene · what the visitor needs to understand ·
primary material · source) is approved.

## 06 · Flagship creative briefs

Full briefs with asset tables live in the "DE Flagship Briefs" artifact and
will be committed under `scrollcraft/briefs/` once approved. Direction fixed
here:

1. **Homepage — The Environment Wakes Up, rebuilt.** Belief: "IT providers
   are interchangeable ticket-takers" → "my environment could be secured and
   run as one designed system, and DE, a managed security and managed IT
   company, is who does that." Curve retained. The
   transformation peak is redesigned from scratch on the diagram system;
   explicitly not the existing environment map, not a margin folio.
2. **ProActive Ecosystem — a living operating cadence.** Observe → Decide →
   Protect → Improve cycling under scroll; services surface when they become
   operationally relevant. Temporal grammar, not spatial assembly.
3. **How We Protect — layered, adaptive, continuous.** A real business
   environment progressively enclosed by identity, endpoint, network, email,
   backup and security-operations layers; an attack path failing layer by
   layer. No SOC wall, no fake telemetry.
4. **Cyber Risk Assessment — unknown to roadmap.** An incomplete environment
   inspected, annotated, classified and prioritized under scroll; findings
   resolve into a roadmap; the real promises typeset plainly at the close.
5. **Automation + AI — manual work to orchestrated systems (last).** Built
   only after the four service flagships. Handoffs collapse into one
   automated path while a human approval gate stays lit, framed as one of
   the fourteen domains a managed security and managed IT company operates.
   No robots, no AI blobs, and never more prominence in the IA than the
   security and managed IT pages.

## 07 · Rollout order and gates

| Phase | Deliverable | Gate |
|---|---|---|
| P0 Inventory | Review-only gallery of everything that exists | Joe has seen everything |
| P1 Experience map | §02 ratified route by route; two route decisions made | Joe approves the map · no code |
| P2 Creative direction | Full briefs for every FULL page | Joe approves each brief · no code |
| P3 Material production | Diagram system, concept set, photography, evidence captures | Board test: a premium DE campaign before anything moves |
| P4 Motion storyboards | Chapter by chapter for the homepage | Storyboard + asset table approved |
| P5 Build one flagship | Homepage only; fingerprint gate; harness at all widths; smoke expectations updated with the release; staged rollout with instant revert | Joe's verdict on the live candidate |
| P6 Integrate | Reusable DE primitives, not reusable page designs | Primitives documented |
| P7 Selective propagation | ProActive → How We Protect → Assessment, each with a distinct fingerprint; then Automation + AI, last; then Level B moments (industries, solutions index, about, store introduction) | Per page, same rigor |

## 08 · Standing rules the program inherits

- The brand foundation is locked: `#050312` · Warm Paper · `#D3126A` ·
  restrained violet illumination · Space Grotesk · Inter · Oxanium.
  Scrollcraft consumes the DE system; it never replaces it.
- Truthfulness: no fabricated certifications, partnerships, customer counts,
  testimonials, SLAs or telemetry. Sourced statistics carry source and year
  as industry context only.
- Evidence hierarchy: real artifact → real data → real person → explanatory
  diagram → sanitized interface → illustration → photography → atmosphere →
  icon.
- The fingerprint registry is binding; every new build clears every row.
- MERGED and LIVE are separate states; every release names both, is verified
  against production, ships with its rollback path, and updates guardrail
  expectations rather than disabling them.
- Levels C and D never receive Scrollcraft.
- Joe holds merge, deploy and approval authority at every gate.

## 09 · Review corrections (2026-09-02)

Joe's review of the live `/v2`, the PR #178 before/after, the mobile
captures and the six plates: "promising system, not ready to merge
unchanged." Release decision: PR #178 stays a draft; no merge, no kie.ai
spend. What changed in response, and what is now a rule:

**Fixed on PR #178.**

1. "Client proof" showed DE Desk, DE's own product. The section eyebrow is
   now "How DE delivers"; the capture is titled as DE's own product; real
   client evidence remains the reviews feed only.
2. The trust strip promised "response within one business day" while the
   report said no response-time claims were added. The strip now says
   "Response targets are published in our SLA." The hero's pre-existing
   line keeps its basis (SLA standard tier: next business day). Every
   claim on `/` and `/v2` is now listed with its basis in
   `docs/CLAIMS-REGISTER.md`; unsupported ones are marked for Joe.
3. Classification badges read as internal production language. Disclosure
   stays visible but in plain words: "Illustration", "Example, not a client
   report", "Real, details removed", "Live data". The code stays on
   `data-classification` for governance and tests.
4. Diagrams too dense and small on mobile: narrow layouts step the type up
   (14 px labels, 10.5 px codes), widen nodes, and show one stage per
   viewport. The persuasive job moves to asset families (see
   `scrollcraft/ASSET-PLAN.md` §0); a diagram explains one mechanism beside
   a frame, never carries the hero.

**Rules for Version C and the flagships.**

5. `/v2` is not the primary homepage. Its length and concept density suit a
   "Why DE" story, sales explainer, or campaign experience. Proposal for
   Joe: keep `/v2` noindex as the Version B record; the rebuilt homepage
   (P5) is short; a "Why DE" route inherits the story grammar at Level B.
6. Conversion is available in the first viewport and at the close of every
   chapter, never only at the end.
7. Lead with the six protection domains; the fourteen domains appear only
   in the "range" moment, after the buying decision has been simplified.
8. Desktop length budget for the primary homepage: eight viewport-heights,
   not fourteen.
9. Statistics carry source and year from `cyberAwarenessFacts.ts` and a
   footnote link; service-level claims quote the SLA tier.
10. Of the six Graphite Illumination plates, `peakground` and `ink` remain
    as atmospheric support; the other four are retired from hero roles.
11. No kie.ai credit is spent until the asset's row in
    `scrollcraft/ASSET-PLAN.md` (page, buyer purpose, composition, crops,
    conversion role, route) is approved.

**The diagram system's reusable business use cases** (the part the review
asked to preserve):

| Surface | Diagrams | What it needs next |
| --- | --- | --- |
| Homepage and service pages | all five, static beside copy; state-driven in flagships | mobile step (done); one idea per frame |
| Cyber Risk Assessment deliverables | the inspection, layered protection (paper tone) | a real deliverable template that embeds the paper-tone SVG |
| Sales explanations | one environment, the cadence, coverage depth | a static PNG/SVG export command for decks and email |
| Proposals and SOWs | coverage depth, the cadence (paper tone) | the same export, plus a "scope" variant that names the package chosen |
| Client reviews (QBR) | the cadence, layered protection with the client's own six layers via `data.layers` | a review template; never client telemetry in the figure |
