# Claude Code Prompt — DE Homepage Refinement (KEEP → UPGRADE → ADD → REPLACE)

## Governing rule
We are **refining the canonical DE homepage, not replacing it.** Preserve the existing DE identity, content, imagery, routes, functionality, business rules, integrations, and useful interactions. The work is consolidation, hierarchy, consistency, and credibility.

Work on a new branch `claude/homepage-refinement-<date>`. Open a PR when done. **Do not merge, push to main, or deploy.** Joe runs production deploys himself.

---

## Phase 0 — Reconcile and report first (STOP after this phase)

Do these checks before changing anything:

1. **Confirm which component is canonical.** Production `/` currently renders the `DigeratiHomepage` component whose section config is:
   `hero → stats (Why DE) → challenges → services → protection → testimonials → trust → team → industries → pricing → insights → faq → cta → contact` (14 sections).
   The **eight cybersecurity blocks with Risk & Exposure as block 8** only appear in the variant routed at `/version-3`, not on `/`.
   - Report which file is the canonical homepage.
   - Report whether the eight-block content should be on `/`.
   - Report whether the corrected hero, trust treatment, Ask DE, and mobile sheet from earlier PRs are all present on `/`.
2. **Confirm the hero.** Check that the original Cyber Risk Assessment hero artwork/card and the "Your Arizona business" line are present on `/`. List any regressions.
3. **Inventory the CTAs.** List every assessment CTA label and button style on the homepage. The current build contains at least:
   - "Start Cyber Risk Assessment" ×9
   - "Get My Cyber Risk Assessment" ×3
   - "Start My Assessment"
   - "Schedule a Cyber Risk Assessment"
   - "Start with a Cyber Risk Assessment"
   - "Book the conversation"
4. **Flag internal/dev copy that visitors can see.** Known examples:
   - "Three clear paths. Capability depth stays available here and under Protect — nothing removed."
   - "Preview of the stack we manage — also detailed under Protect."
   - "Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads."
5. **Flag non-canonical service names.** Known examples:
   - "SMART Identity (MFA + SSO)" → should be **Identity & Access Management**
   - "Endpoint Security (EDR)" → should be **Endpoint Security / EDR-MDR**
   - Check all others against DE naming governance.
6. **List every claim, metric, testimonial, or case-study reference** on the homepage, with its source or "unsupported."

**Deliver the Phase 0 report and wait for Joe's approval before Phase 1.**

---

## Phase 1 — Refinements (after approval)

### 1. Consolidate sections (14 → ~9) without losing useful content
Target story spine:
**credibility strip → problems/risk → ways to engage → packages (ProActive tiers) → assessment/process (Assess → Protect → Operate → Improve, eight blocks, Risk & Exposure 8th) → industries → proof & trust → FAQ → closing CTA/contact**

- **Credibility strip:** fold `stats` (Why DE) into a thin credibility strip. Use defensible proof only.
- **Why Digerati:** make it a tight sales narrative, not a large nav category.
- **Proof & Trust:** merge `testimonials` + `trust` + `team` into one section.
  - Keep the founder section smaller and less self-indulgent.
  - Link to the Trust Center.
  - Leave unpublished proof and case-study slots unpublished.
- **Insights:** move the threat feed off the homepage and replace it with a small link to Security Updates. It is often empty ("No current items meet the homepage threshold") and duplicates threat messaging elsewhere.
- **Closing CTA:** merge `cta` + `contact` into one closing CTA/contact block.
- **Moving content:** anything removed from the homepage moves deeper into the site. Nothing is deleted outright. List every move in the PR.
- **Anchors:** keep existing section `id`s working. Add aliases for any merged IDs so deep links and nav highlighting don't break.
- **Packages:** keep ProActive tiers clear, but don't let pricing dominate.
- **Industries:** keep visible and concise.
- **Additional capabilities / physical security:** keep compact.

### 2. One CTA system
- **Primary:** "Schedule Your Cyber Risk Assessment"
  - Compact surfaces (nav, floating): "Schedule Assessment"
- **Secondary:** "Talk to an Expert" plus the phone number
- **Form submit:** "Request Assessment"
- One primary button style and one secondary button style, used everywhere. Remove the other variants.

### 3. Hero (upgrade, don't replace)
- Keep the canonical hero concept and the original Cyber Risk Assessment card/artwork.
- Reduce oversized type and header scale so the assessment content, CTA, and reassurance fit in the first viewport at 1280 and 1440.
- Keep "Your Arizona business" on one line (use `white-space: nowrap` on that span).
- Keep the Arizona dusk/skyline treatment subdued.
- Reduce gratuitous gradients. Keep the cyan/purple/magenta lighting language.

### 4. Copy and naming
- Rewrite every internal/dev string from Phase 0 into visitor-facing copy.
- Apply canonical DE service names everywhere on the homepage.
- No vendor names, SKUs, costs, or distributor references on public homepage/store surfaces, except vendors with real buying value (Microsoft 365, Apple, Dell, Lenovo).

### 5. Visual consistency
- Standardize section vertical rhythm, the type scale, and card density.
- Reduce light/dark alternation to a deliberate rhythm. There are currently 5 light sections interleaved among 9 dark ones.
- Use fewer competing cards per section. The primary section should look primary.
- Keep the contained max-width canvas. Don't stretch content on wide screens.

### 6. Connected journey (only where existing code supports it — no new systems)
- Carry homepage context (section, service, industry) into assessment, Store, and Ask DE entry points using the existing scope model.
- Do not create a parallel qualification system.
- Store stays available but sits below the service narrative, framed as curated solutions by business need.

---

## DO NOT CHANGE
- Routes, forms, APIs, authentication, Zoho integrations, analytics/GA4 consent mode, store/cart behavior, portal, business workflows
- **Ask DE:**
  - Four-action chooser
  - Real Desk/support behavior
  - Vector DE glyph
  - Focus trap, Escape, and focus restoration
  - Mobile bottom sheet
  - Floating-layer coordination
  - The three separate jobs: Ask DE = advice/discovery, Get Support = focused issue reporting, Client Tools = authenticated shortcuts
- **Navigation:**
  - The "Protected?" compact/floating nav transition
  - Active-section highlighting and smooth anchors
  - Keyboard accessibility and reduced-motion handling
  - Footer avoidance
- **Main nav:** stays Solutions, Industries, Pricing, Resources, About, Store, Assessment. No mega-directory.
- The interactive Cyber Risk Assessment
- Parallax, reduced-motion, and no-WebGL fallbacks
- Good work from earlier PRs: corrected hero, trust treatment, Ask DE behavior, mobile sheet, accessibility fixes
- **No fake metrics, testimonials, SLAs, customer counts, identities, or case studies.** If proof is missing, leave a clearly marked TODO for Joe. Never fill it in.

---

## QA before opening the PR
- **Widths:** 390, 768, 1024, 1280, 1440
- **Check at each width:**
  - Horizontal overflow
  - Hero first-viewport composition
  - Compact-nav breakpoint leaks
  - Floating-layer overlap (assessment CTA, Ask DE, cookie banner, cart)
  - Light/dark transitions
  - Keyboard navigation
  - Every CTA reaches the right destination
- **Compare against:** the current production `/` baseline, with before/after screenshots per width in the PR.
- **PR description must include:**
  - Section map before → after
  - Every moved piece of content and its new location
  - The CTA replacement list
  - Anything skipped because it would have required a new system or broken a DO-NOT-CHANGE item
