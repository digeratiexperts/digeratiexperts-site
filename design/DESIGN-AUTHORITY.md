# Design authority — tiers and task modes

**Status: canonical.** This file decides how much authority every other design rule in this repository has. When a design rule anywhere in the repo (`.cursorrules`, `AGENTS.md`, `.cursor/rules/*`, `design/*`, `.claude/skills/*`, `docs/*`) seems to conflict with this file, this file wins. Joe is the only person who changes it.

Why it exists: by September 2026 the repository had accumulated an excellent but flat rulebook in which "authorization is enforced server-side", "target WCAG 2.2 AA", "violet is lighting only", "use Space Grotesk", and "do not replace the mega-menu icons" all carried the same weight. That made every AI agent treat one design pass's conclusions as permanent law, and asking five different models for a "materially better" website produced five variations of the same answer key. This file separates the rules that prevent **bad** work from the rules that merely prevent **different** work.

> **Governing sentence.** Existing design patterns are evidence and defaults, not creative boundaries. In Exploration Mode an agent may challenge palette implementation, typography, layout systems, component composition, imagery, motion language, visual hierarchy and information architecture when doing so materially improves the experience. Security, accessibility, truthful evidence, business/data correctness and required product behavior are never on the table. Consistency means intentional coherence, not visual sameness.

---

## 1. The four tiers

Every design-relevant rule in the repo belongs to exactly one tier. If a file does not say which tier a rule is in, use the table in §4.

### Tier 0 — Non-negotiables

Hold in every mode, every surface, every agent. No task phrasing relaxes them.

- Security: server-side authorization, no client-side secrets, no IDOR, CSRF/XSS/injection hygiene, safe uploads, no verbose production errors, no admin data protected only by hidden UI (`.cursorrules` §21–22, `docs/AI-ENGINEERING-GOVERNANCE.md` §13).
- Secrets and paid services: keys from the environment only; nothing that spends money (kie.ai, Meshy, KIE credits) without Joe.
- Truth: never fabricate clients, logos, testimonials, reviews, ratings, certifications, partnerships, response times, uptime, statistics, case-study results, headcount, compliance status, pricing, telemetry, incidents, or product behavior (`.cursorrules` §3, §20, §33–36; `design/PROOF_SYSTEM.md`; `design/VISUAL_EVIDENCE.md` classification LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE; `.cursor/rules/de-ecosystem.mdc` honesty section). Honest empty states over invented content.
- Accessibility: WCAG 2.2 AA, semantic HTML, keyboard operability, visible focus, focus order and trapping, labels, contrast, ~44px targets, `prefers-reduced-motion`, no hover-only functionality (`.cursorrules` §12–13).
- Responsive operability: every shipped UI works and is verified at 390 / 768 / 1440 minimum, with no overflow, clipping, collisions or unreachable controls (`.cursorrules` §10–11, §27).
- No overlapping interactive chrome; all floating elements coordinate through the shared CSS variables (`design/UX_PRINCIPLES.md`; governance §11).
- Performance budgets: Core Web Vitals targets, image optimization, no gratuitous JS or dependencies, CSS bundle budget (`.cursorrules` §23, §25, §37).
- Business and data correctness: canonical pricing/service data from central sources, canonical ProActive names (IT / Office / Business / Enterprise), service-architecture distinctions, company naming ("Digerati Experts" / "DE"), portal login URL (`.cursorrules` §17–18; `.cursor/rules/digerati-naming.mdc`; `.cursor/rules/account-lifecycle.mdc`).
- Functional preservation of what ships: routes, forms, CTAs' destinations, SEO/JSON-LD, analytics, integrations, Store/portal/Desk logic and APIs survive any restyle (`.cursorrules` §2, §19, §35; `.cursor/skills/de-desk-ui/SKILL.md` functional list).
- Engineering governance: isolated branch/worktree, active-work claims, PR-only integration, concurrency audit, MERGED ≠ LIVE, Joe is release authority, no agent merges its own PR without Joe's exception (`docs/AI-ENGINEERING-GOVERNANCE.md` §1–8, §12–17; `.cursor/rules/agent-governance.mdc`).
- Rendered verification: never judge UI from source; render, screenshot, critique, fix, re-verify (`.cursorrules` §27–28).

### Tier 1 — Brand identity

Hard in every mode, but at the level of *meaning*, not implementation.

- The company is **Digerati Experts (DE)**, a premium, cybersecurity-first MSP/MSSP with a principal-led, Arizona-accountable posture. The wordmark and the gold three-bar mark are the identity marks.
- The identity must read as: trustworthy, competent, technically sophisticated, secure, reliable, mature, precise, premium (`design/BRAND.md`, `.cursor/rules/brand.mdc`).
- The identity must never read as: childish, gimmicky, cyberpunk, hacker-themed, Matrix/neon, overly futuristic, generic SaaS template, commodity computer store, WordPress MSP template, stock-photo driven, visually noisy, AI-generated.
- Differentiators are protected: cybersecurity-first IT, assessment-led recommendations, proactive risk reduction, client ownership ("Your Technology. Your Data. Your Keys."), documented environments, transparent service architecture, ProActive tiers, standalone and co-managed services (`.cursorrules` §15–16).
- Content voice: credible consultancy, specific outcomes, sourced claims, no AI marketing filler (`.cursorrules` §32).

A specific palette, type stack, material language or lighting recipe is **not** Tier 1. Those are Tier 2 expressions of the identity. Tier 1 is what any successful redesign must still communicate.

### Tier 2 — Current design system (defaults)

The way the identity is implemented **today**. Maintenance Mode must use it. Exploration Mode may challenge any of it, provided the concept says what it changed and why.

- Foundation tokens: `--de-bg #050312`, `--de-surface #0a0a0a`, `--de-raised #151217`, `--de-hairline`, `--de-paper #f7f5f2`, magenta `#D3126A`, violet as lighting (`design/DESIGN_SYSTEM.md`, `design/VISUAL_SYSTEM_V2.md` Layer 0).
- Type stack: Space Grotesk / Inter / Oxanium.
- Field ladder and accent doctrine ("dark field, accent pop"; one loud band per page) (`.cursor/rules/dark-field-accent-pop.mdc`, `design/UI-STYLE-RULES.md` §2–3).
- Section archetypes, page-layout doctrine and recipes (`design/UI-STYLE-RULES.md` §5–6); the current homepage structure (`.cursorrules` §14).
- Component vocabulary: `IconWell`, `EvidenceFrame`, `HUDFrame`, `StatusToken`, `ProofChip`, the style-box utilities, shadcn primitives; reuse-before-invent (`.cursorrules` §8–9).
- Visual System v2 layers, HUD grammar, diagram grammar, motion recipes (`design/VISUAL_SYSTEM_V2.md`, `HUD_CHROME.md`, `DIAGRAM_SYSTEM.md`, `MOTION_LANGUAGE.md`). The *truth* content of those docs (classification, no fake pulses, emerald only when live) is Tier 0; the *aesthetic* content is Tier 2.
- Imagery art direction: dark technical sculpture, concept-not-noun, the nine-item consistency list (`design/IMAGERY.md`, `.cursor/skills/image-art-direction/SKILL.md`). Concept-not-noun and the cliché list (shield / padlock / hoodie / server rack) are closer to Tier 1 and should survive most explorations; the rendering language is Tier 2.
- Editorial, product-media and photography recipes (`EDITORIAL_ASSETS.md`, `PRODUCT_MEDIA.md`, `PHOTOGRAPHY.md`), excluding their truth rules.

**Joe-decided items inside Tier 2.** Some current-system decisions were made by Joe, not by an agent. They carry a `JOE-DECIDED <date>` marker where they live. Exploration may *propose* against them and must say so explicitly; shipping the alternative to production needs Joe's yes. Current list:

| Decision | Where |
|---|---|
| Blog/Journal amber and Store electric + 14 category-pill hues stay as they are | `.cursor/rules/blog-store-color-lock.mdc` (2026-08) |
| DE Desk: one graphite shell, magenta actions, no purple glow — release target | `.cursor/skills/de-desk-ui/SKILL.md`, `.cursor/rules/de-desk-design.mdc` (board 2026-09-14) |
| No vendor names on the public homepage hero | `design/UI-STYLE-RULES.md` §7 (2026-08-30) |
| Sculpture / Meshy stills retired from public marketing ("high quality or not at all") | `design/IMAGERY.md`, `design/approved/*-2026-08.md` |
| Gold is the wordmark mark only, never a CTA or fill (current value per `brand/README.md`; `design/DESIGN_SYSTEM.md` still carries the older `#e7b20d`) | `brand/README.md`, `design/DESIGN_SYSTEM.md`, `.cursor/rules/brand.mdc` |
| Homepage keeps the eight-block security model with Risk & Exposure as the continuous eighth block | Joe, Completion Program board 2026-09-12 (outside the repo); blocks listed in `design/PROOF_SYSTEM.md` |
| Homepage section-jump dock kept (MegaMenu spy + `SiteBottomBar`) | `design/DESIGN_SYSTEM.md` ("DE restored the dock 2026-08-27") |

If Joe says "write it in stone" about a design decision, add it to this table in the same PR.

### Tier 3 — Historical record

Evidence of what was decided at a point in time. **Never authority.** Read it to understand *why* something is the way it is; never treat it as a prohibition on future work unless a Tier 0–2 file promotes the decision.

- `design/approved/*` and `design/rejected/*` (screenshots and notes)
- `docs/VISUAL-ASSET-INVENTORY.md`, `docs/VISUAL-ASSET-AUDIT.md`, `docs/MESHY-*.md`, `docs/VISUAL-SHOPPING-LIST.md`
- `docs/HOMEPAGE-REFERENCE-REDESIGN-HANDOFF.md`, `docs/PR146-PRESERVATION-AUDIT.md`, `docs/BRAND-SWEEP-NEXT.md`
- `docs/SITE-VISUAL-TASKS.md` (a ledger — its status rows coordinate work; its "do not" notes are per-task scope, not design law)
- Old PR bodies, task chats, Scrollcraft plans, `artifacts/visual-qa/*`, screenshots, `.ai/ACTIVE_WORK.yaml` history
- Anything in `design/references/`

"Hero unchanged", "cards stay Lucide", "do not replace", "identity placed once", "selective rule" and similar lines in Tier 3 files record the guardrails of one earlier task. They do not bind the next designer. A `rejected/` note does record a direction Joe turned down and *why*; a new concept that revisits it must answer that why.

---

## 2. Task modes

Every UI task runs in exactly one mode. The agent states the mode at the top of its work.

### Maintenance Mode (default)

Applies when no exploration trigger is present: bug fixes, polish, responsive repair, a11y repair, new pages or sections inside the existing system, content updates, component extraction, Store/Portal/Desk feature work, anything the Completion Program lists as stabilization.

- Tiers 0, 1 and 2 all apply. Compose from the current system; reuse before inventing; do not introduce new colors, type, radii or patterns without promoting them into tokens/primitives (`.cursorrules` §8–9, `design/UI-STYLE-RULES.md`).
- The Product Preservation Law's KEEP → UPGRADE → ADD → REPLACE order applies in full (`docs/AI-ENGINEERING-GOVERNANCE.md` §18).
- Tier 3 is context.

### Exploration Mode

Triggered only by Joe's own words — in his message, or in a brief he approved — asking to **redesign, rethink, reimagine, modernize, explore, propose concepts, create directions, make it materially better, make it feel different, challenge the current design**, or naming a page/surface as a "concept", "candidate", "challenger" or "design pass". A document an agent wrote (a Scrollcraft plan, a handoff, a ledger row, a PR body) cannot put a task into Exploration Mode. If the wording is ambiguous, ask Joe one question; if no one is there to answer, run in Maintenance Mode and say so.

- Tier 0 and Tier 1 apply in full.
- Tier 2 is a starting point and a benchmark, not a boundary. The agent may introduce new visual primitives, alternative layout systems, different art direction, new typography, new motion, additional or replacement accent colors, different page structures and substantial recomposition.
- Joe-decided Tier 2 items may be challenged only explicitly: the concept names the decision, proposes the alternative, and states that shipping it needs Joe.
- **Divergence before convergence.** For a scope of one page or larger, produce at least three materially distinct concepts before converging: different design hypotheses (for example a different hierarchy strategy, a different field/contrast model, a different evidence strategy), not three variations of the same dark-card composition. For a scope smaller than a page, two concepts are enough. Each concept carries a short brief: hypothesis, which Tier 2 defaults it keeps, which it changes and why, and what it does for Tier 1.
- **Isolation.** Concepts are built and rendered on an isolated branch/worktree, under `artifacts/design-concepts/<task>/<concept>/` (create it when first needed) or `scrollcraft/builds/<name>/` when the concept is standalone, or on a `concept/*` branch when it has to live in `client/` to be rendered honestly. A concept branch opens a **draft PR labelled `concept`** for review only; it is never merged as-is. Integration of a picked concept is a separate PR under the Product Preservation Law. Rendered evidence at 390 / 768 / 1440 for each concept.
- **Truth still applies while exploring.** Placeholder evidence is labeled EXAMPLE / ILLUSTRATIVE; no invented metrics, clients, faces or partners appear even in a mockup.
- **Convergence and integration.** Joe picks (or rejects) a direction. Only then does the Product Preservation Law (§18) govern how the chosen direction is integrated into the existing product: what to KEEP, what to UPGRADE, what to ADD, what to REPLACE. A Joe-requested redesign is itself the "documented reason" that §18 asks for at the concept level. Joe's pick approves the *direction*; it is not blanket approval to remove things. The integration PR lists every REPLACE and every removal of existing content, CTA, nav item, stat or function, and each one needs Joe's yes. Tier 0 functional preservation (routes, forms, integrations, SEO, logic) is still mandatory during integration.
- **Consistency.** The result must cohere across the site on purpose. A concept may redefine the system; it may not leave half the site on one system and half on another without a stated migration plan.

### Mode boundaries that are easy to get wrong

- A Cursor stabilization slice or a Claude acceptance review is Maintenance even if the surface is ugly. Log the design debt; do not redesign inside a stabilization PR.
- "Make the homepage substantially better" is Exploration. "Fix the homepage hero on 390" is Maintenance.
- A skill whose upstream text says "never use Space Grotesk / Inter" (`frontend-design`, `web-design-rules`) is *right* in Exploration Mode and is overridden by Tier 2 in Maintenance Mode. Neither the skill nor Tier 2 wins unconditionally; the mode decides.
- Store, Portal, Journal and DE Desk are not exempt from Exploration Mode; their color and shell decisions are Joe-decided Tier 2 items, so a concept may propose against them and must say so.

---

## 3. How agents read the corpus now

1. Read this file.
2. Decide the mode from the task wording; state it.
3. Maintenance: read `design/UI-STYLE-RULES.md` (Tier 2 reference) plus the scoped rules for the surface, then work.
4. Exploration: read `design/BRAND.md` §Identity (Tier 1), skim `design/UI-STYLE-RULES.md` and `design/approved|rejected` as evidence of what exists and what failed, then diverge.
5. Both: Tier 0 always; render and verify; report which tier each notable decision sat in.

Historical documents remain in place. Do not delete them, do not rewrite them to soften old instructions; their headers now say they are Tier 3.

---

## 4. Tier map by file

| File | Tier(s) |
|---|---|
| `.cursorrules` §1–3, §10–13, §17–31, §33–42 | 0 |
| `.cursorrules` §15–16, §32 | 1 |
| `.cursorrules` §4–9, §9A, §14 | 2 (the identity lists inside §4 are 1) |
| `AGENTS.md` | 0 (governance, hosts, naming) · pointers |
| `docs/AI-ENGINEERING-GOVERNANCE.md` §1–8, §10–17 | 0 |
| `docs/AI-ENGINEERING-GOVERNANCE.md` §9, §18 | Maintenance and integration rules (see §2 above) |
| `.cursor/rules/agent-governance.mdc`, `de-ecosystem.mdc`, `digerati-naming.mdc`, `account-lifecycle.mdc`, `frontend.mdc` | 0 |
| `.cursor/rules/00-follow-cursorrules.mdc` | pointer |
| `.cursor/rules/brand.mdc`, `design/BRAND.md` | identity sections: 1 · color/materials/lighting/type: 2 |
| `.cursor/rules/ui-ux.mdc`, `design/UX_PRINCIPLES.md` | body: 0 (a11y, states, responsive, overlap) · DE execution tail and "content preservation": Maintenance rules |
| `.cursor/rules/dark-field-accent-pop.mdc` | 2 |
| `.cursor/rules/blog-store-color-lock.mdc` | 2, Joe-decided |
| `.cursor/rules/visual-system-v2.mdc`, `design/VISUAL_SYSTEM_V2.md` | truth/classification: 0 · layers, tokens, HUD aesthetics: 2 |
| `.cursor/rules/de-desk-design.mdc`, `.cursor/skills/de-desk-ui/*` | functional list: 0 · shell direction: 2, Joe-decided |
| `design/DESIGN_SYSTEM.md`, `design/UI-STYLE-RULES.md` | 2 (its §7 truth/a11y/overlap items: 0) |
| `design/IMAGERY.md`, `.cursor/skills/image-art-direction/SKILL.md` | concept-not-noun and cliché list: 1 · rendering language and consistency list: 2 |
| `design/VISUAL_EVIDENCE.md`, `PROOF_SYSTEM.md` | 0 |
| `design/HUD_CHROME.md`, `DIAGRAM_SYSTEM.md`, `MOTION_LANGUAGE.md`, `PRODUCT_MEDIA.md`, `EDITORIAL_ASSETS.md`, `PHOTOGRAPHY.md` | truth lines: 0 · everything else: 2 |
| `.cursor/skills/premium-saas-ui`, `visual-audit`, `responsive-review` | method (any mode) |
| `.claude/skills/frontend-design`, `web-design-rules`, `scrollcraft` | creative method; mode decides whether Tier 2 overrides them |
| `brand/README.md` | 1 (marks, lockups) · 2 (its token values) |
| `scrollcraft/EXPERIENCE-PLAN.md`, `scrollcraft/builds/*/BRIEF.md`, `public/scrollcraft/plan/*` | 3 (plans and briefs of one build; their "locked" wording is the state at the time) |
| `design/approved/*`, `design/rejected/*`, `design/references/*`, `design/DESIGN-RATIONALE.md` | 3 |
| `docs/VISUAL-ASSET-*.md`, `docs/MESHY-*.md`, `docs/HOMEPAGE-REFERENCE-REDESIGN-HANDOFF.md`, `docs/SITE-VISUAL-TASKS.md`, `docs/BRAND-SWEEP-NEXT.md`, `docs/PR146-PRESERVATION-AUDIT.md` | 3 |

---

## 5. Change log

- 2026-09-16 — Created. Replaces the flat "everything is mandatory" reading of the design corpus with tiers and modes. No Tier 0 rule was weakened; Tier 2 rules were re-labeled from law to default; Tier 3 files received a header only.
