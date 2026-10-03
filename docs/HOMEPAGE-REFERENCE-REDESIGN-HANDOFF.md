# Digerati Experts — Full Homepage + Ask DE Visual Integration Handoff

> **HISTORICAL RECORD (Tier 3 — `design/DESIGN-AUTHORITY.md`).** This document records what was decided, placed or guarded at a point in time. It explains *why* things are the way they are. Its "do not", "unchanged", "leave alone" and "keep" lines were the guardrails of that task; they do not prohibit future maintenance or redesign work unless a Tier 0–2 file promotes the decision.

Status: historical — was the design/integration handoff for PR #116 (August 2026); superseded by later merges (#147, #148) and by `design/DESIGN-AUTHORITY.md`

This document tells the lead integration agent how to merge the approved visual direction into the **current site** without losing current functionality, content, Store work, or newer `main` changes.

## Current repository state

- Repository: `digeratiexperts/digeratiexperts-site`
- PR: **#116**
- Branch: `chatgpt/homepage-support-reference-style`
- Current `main` at handoff: `eaf8198b9d8b79ffc6e72ad4ca8f3709f84f1fa2`
- Current PR head at handoff: `14535100a6bb160b45ccc2234fe5b27909b9f824`
- Branch relationship at handoff: **12 commits ahead / 0 behind** current `main`
- Latest PR CI at handoff: **green**

Do not assume those SHAs remain current. Fetch again before any implementation or merge.

## Important correction to PR #116

PR #116 currently implements only part of the intended redesign: the new hero and Ask DE entry experience. **Do not merge it as the completed redesign.**

The intended scope is:

> Keep the current Digerati Experts homepage story, content, routes, forms, interactions, Store integration, support functionality, analytics, SEO, and application behavior — but redesign the **entire visible homepage** so it reads as one coherent premium cybersecurity-first system inspired by the approved reference.

This is not a page replacement. It is a visual-system integration into the current product.

## Core visual direction

The target aesthetic is:

- premium enterprise cybersecurity
- black / near-black precision surfaces
- crisp white / warm-white paper sections where contrast helps
- black text on light sections
- white text on dark sections
- restrained violet / indigo / magenta accents
- thin technical linework rather than neon cyberpunk effects
- oversized but disciplined typography
- generous spacing
- clear hierarchy
- low visual noise
- flat, crisp controls with restrained depth
- consistent radii, borders, spacing, icon treatment, and hover behavior
- no generic SaaS gradient soup
- no random glass cards everywhere
- no excessive glow
- no gratuitous HUD decoration
- no independently styled section that looks like it belongs to another website

The supplied visual reference is a **direction**, not something to copy literally. Preserve DE branding and DE product logic.

## Homepage integration rule

Preserve the current homepage narrative and existing section functionality. Restyle and refactor the existing sections instead of deleting their purpose.

At minimum, the final homepage must visually integrate:

1. Navigation / announcement treatment
2. Hero
3. Trust / why-DE rail
4. Stats / why DE
5. Problems / challenges
6. How it works / services
7. What we protect
8. Proof / testimonials / evidence
9. Trust / transparency
10. Team / experts
11. Industries
12. ProActive Ecosystem / package section
13. Insights
14. AI assistance where still part of the current homepage
15. Lead form
16. FAQ
17. Newsletter if still current
18. Next-step CTA
19. Contact
20. Footer
21. Persistent bottom navigation / Ask DE chrome

If current `main` has added, removed, or reordered homepage sections since this handoff, treat **current `main` as source of truth for functionality and content**, and apply this visual system to the current structure.

## Hero

Use the existing/new `ReferenceHeroSection` only as a starting point.

Desired result:

- dark precision field
- very strong left-aligned headline hierarchy
- `Cybersecurity-First IT That Powers Your Business` direction
- one controlled violet/indigo/magenta text accent, not many
- clean dual CTA hierarchy
- restrained partner/trust marks only where allowed by current public-site rules
- technical shield / security illustration that feels engineered, not clip-art
- illustration must remain subordinate to the copy
- clean transition into the next section

Do not destroy the previous hero source. Preserve a rollback path until final acceptance.

## Section system

Create or normalize a small set of reusable visual primitives rather than styling every section independently.

Examples:

- dark precision section
- light paper section
- editorial eyebrow
- section title / intro
- evidence card
- metric card
- process step
- package card
- trust row
- CTA group
- icon well
- divider / hairline

Prefer design tokens / shared classes / shared components where practical.

### Light sections

- warm white / white surface
- near-black headings
- muted graphite body copy
- thin neutral borders
- restrained shadows only where hierarchy requires them

### Dark sections

- near-black rather than pure flat black everywhere
- white headings
- muted cool-gray body copy
- thin translucent hairlines
- very limited accent color

## Ask DE / support experience

The public visitor should have **one initial Ask DE entry experience**, not three competing tabs as the first decision.

Initial chooser options:

- **Get Support** — open existing support/ticket flow
- **Get Help** — open existing Ask DE advisor/chat flow
- **Client Tools** — open existing Client Tools / portal resources flow
- **Give Feedback** — route into existing advisor/support infrastructure with feedback context

Rules:

- Do not create a second chatbot
- Do not replace the existing Zoho/support APIs
- Do not break live handoff, ticket creation, portal access, remote support, unread state, drag/resize, or existing deep links
- The chooser is the single public first decision pane
- After choosing, keep the experience visually unified
- White / black / graphite UI with restrained DE accent
- Ask DE launcher should be a clean UI control, not a miniature poster/logo
- No decorative status dot unless it represents a real state
- If old tabs remain in DOM for functionality/accessibility, make sure hiding/reframing them does not create keyboard or focus regressions

## What must be preserved

Do not regress or delete:

- current homepage content and routes
- SEO metadata and JSON-LD
- current Store / solution-builder work
- Door 2 / Store public leakage protections
- existing support APIs
- ticket creation
- advisor/chat session behavior
- Client Tools
- remote support links
- analytics
- accessibility behavior
- cookie / bottom chrome coordination
- mobile behavior
- current production safety rules
- public-vs-internal catalog boundaries
- any current-main fixes landed after this handoff

## Git / concurrency procedure

Before editing:

1. `git fetch origin`
2. inspect `origin/main`
3. inspect `.ai/ACTIVE_WORK.yaml`
4. inspect open PRs and current branches touching homepage / support / shared chrome
5. reconcile PR #116 with latest `main`
6. do not use blind `ours` / `theirs`
7. preserve both newer-main behavior and the redesign intent

If another active agent owns overlapping files, coordinate instead of overwriting.

## Required visual QA

Do not approve from source code alone.

Render the actual branch and inspect at minimum:

- **390 px**
- **768 px**
- **1440 px**

Capture before/after screenshots for major homepage sections and Ask DE.

Check:

- entire homepage feels like one design system
- no section looks inherited from an unrelated older theme
- no overlap with cookie banner, Store cart, `Your Solution`, bottom dock, or Ask DE
- headings do not clip
- cards do not overflow
- no horizontal scroll
- proper spacing at every breakpoint
- no oversized decorative art dominating mobile
- CTA hierarchy is obvious
- Ask DE chooser is usable by mouse and keyboard
- all support states remain readable in the light treatment
- Store pages are not visually or functionally regressed by shared chrome changes

## Functional verification

Run the repository's full required CI / test suite, including:

- typecheck
- unit tests
- advisor/support tests
- production build
- bundle budget
- relevant browser smoke tests
- public route smoke
- Store / Door 2 smoke where shared chrome can affect it

Do not increase bundle budgets merely to make the redesign pass.

## Merge decision

The PR may be merged only when all are true:

- branch is reconciled with current `main`
- full homepage scope is complete, not hero-only
- Ask DE unified entry is complete
- current content/functionality is preserved
- no newer Store work is lost
- CI is green
- 390 / 768 / 1440 visual QA is complete
- before/after evidence exists
- the final rendered site clearly looks more cohesive and premium than the current production homepage

After merge, **MERGED != LIVE**. Verify the deployed production SHA, health checks, homepage render, Ask DE behavior, Store shared chrome, and critical routes before declaring completion.

## Lead-agent instruction

Claude Code is the lead integration agent for this work under `docs/AI-ENGINEERING-GOVERNANCE.md`.

Treat PR #116 as a **design scaffold + integration branch**, not a finished deliverable. Expand and refine it against current `main`, then merge only after the gates above pass.
