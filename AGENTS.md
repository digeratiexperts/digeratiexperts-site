# Agent workflow (Digerati Experts)

## AI engineering governance â€” mandatory

Authoritative multi-agent policy: **`docs/AI-ENGINEERING-GOVERNANCE.md`**. GitHub-visible active issues + open PRs are the authoritative concurrency locks; **`.ai/ACTIVE_WORK.yaml`** is a mirror only. Required procedure: **`docs/ACTIVE-WORK-COORDINATION.md`**. This policy is mandatory for Claude Code, Cursor, Antigravity/Gemini, ChatGPT-assisted repository work, and other agents.

Default authority: Joe is final product/release authority; Claude Code is the default lead website implementation/integration agent; Cursor and Antigravity/Gemini are specialist/review agents unless Joe explicitly reassigns the role for a specific task. There is only one website integration authority at a time.

Every agent must use an isolated branch/worktree, check open active GitHub issues + all current open PRs + relevant remote branches before editing, then inspect the YAML mirror. Reconcile against current `origin/main` before merge, and treat `MERGED` and `LIVE` as separate states. Specialist agents do not independently merge/deploy website work by default.

For visual work, rendered quality is an acceptance gate separate from code correctness. Inspect the actual UI in context before changing it and verify at 390 / 768 / 1440.

Authoritative policy: **`.cursorrules`** (sections 0-42, including section 9A Visual System v2), read through the tier model in **`design/DESIGN-AUTHORITY.md`**. Always-applied pointers: `.cursor/rules/00-follow-cursorrules.mdc`, `.cursor/rules/de-ecosystem.mdc`, `.cursor/rules/agent-governance.mdc`, `.cursor/rules/account-lifecycle.mdc`.

## Design authority â€” tiers and modes

`design/DESIGN-AUTHORITY.md` decides how much weight every design rule carries. **Tier 0** (security, truth, accessibility, responsive operability, performance, business/data correctness, functional preservation, engineering governance) and **Tier 1** (brand identity as meaning) hold in every task. **Tier 2** (the current palette, type stack, field ladder, archetypes, primitives, HUD/imagery/motion recipes) is the mandatory default in **Maintenance Mode** and a challengeable starting point in **Exploration Mode**. **Tier 3** (approved/rejected notes, asset inventories, old handoffs, ledgers) is evidence, never authority. Every UI task states its mode. Exploration Mode is entered when Joe asks to redesign, rethink, reimagine, modernize, explore, propose concepts, make it materially better or make it feel different; it requires materially distinct concepts before convergence, keeps Tier 0/1 intact, flags any challenge to a Joe-decided item, and hands integration back to the Product Preservation Law once Joe picks.

## Account Lifecycle Status â€” internal only

`docs/ACCOUNT-LIFECYCLE-STATUS.md` (mirror; authority is Hub `.agents/memory/account-lifecycle-status-source-of-truth.md`) defines the 13 canonical account lifecycle values. The field is **governed everywhere and displayed nowhere client-facing**: never on the public website or in client-visible portal UI, client-delivered artifacts, or client-scoped API responses â€” but still fully enforced server-side for authorization, entitlement, gating, automation, and internal/admin UI. Omit it at the serialization boundary; hiding it in the UI is not compliance. Always-applied rule: `.cursor/rules/account-lifecycle.mdc`. Note the naming collision: `/portal/admin/lifecycle` is the **JumpCloud employee identity** lifecycle, a different domain.

Design OS (Tier 2 execution layer, does not replace `.cursorrules`): in Maintenance Mode start with **`design/UI-STYLE-RULES.md`** (current theme/surface/archetype/layout reference), then `.cursor/rules/ui-ux.mdc`, `brand.mdc`, `frontend.mdc`, `visual-system-v2.mdc` + `design/DESIGN_SYSTEM.md` + `design/VISUAL_SYSTEM_V2.md`. In Exploration Mode read the same files as evidence of what exists, not as the boundary. Never judge UI from source code alone. Blog/Journal and Store colors are a Joe-decided Tier 2 direction: `.cursor/rules/blog-store-color-lock.mdc` (Maintenance: keep; Exploration: may propose, Joe ships).

Task ledger: `docs/SITE-VISUAL-TASKS.md` (Tier 3 for design decisions; its ownership rows still coordinate work). Do not start a visual task marked IN PROGRESS by another owner. In Maintenance Mode do not invent HUD/evidence primitives ad hoc.

## Repository authority â€” check this before starting work

- This repository, `digeratiexperts/digeratiexperts-site`, is the **canonical public website repository**.
- Website work branches from and opens PRs back to this repository's current `main`.
- `Replit-Site` references are historical and must not redirect new website work.
- `digeratiexperts/Intelligence-Hub` is the canonical internal Intelligence Hub / Tech Sales application repository.
- `digeratiexperts/TechSales` is legacy/reference-only by default; do not start new work there or archive/delete it without an explicit migration decision.
- Full authority matrix: `docs/REPOSITORY-AUTHORITY.md`.
- Website source-of-truth details: `docs/SOURCE-OF-TRUTH.md`.
- Ecosystem rule (always apply): `.cursor/rules/de-ecosystem.mdc`. This website is a GitHub-owned **content/application projection**. Intelligence Hub is the **operational control plane**.
- Canonical identity/location/network rule: Intelligence Hub `docs/de-canonical/08_DE_IDENTITY_LOCATION_NETWORK_STANDARD.md` is authoritative. This repo projects it through `shared/canonicalIdentityLocationNetwork.ts`; DE Tech Tool projects it through `windows/CANONICAL-IDENTITY-LOCATION-NETWORK.md` + `DE.Naming`. Do not invent a different username suffix, privilege-account class, hostname/location code, VLAN convention, or client CIDR rule in website/Store/Portal/Tech Tool code.
- Ecosystem **scoreboard** is Hub Issue [#122](https://github.com/digeratiexperts/Intelligence-Hub/issues/122) (charter `docs/DE-ECOSYSTEM-CHARTER.md`, ratified PR #123 / `5354a8b`). Do **not** copy ECO-001â€“030 into this repo. Do **not** call the ecosystem finished until #122â€™s completion gate passes.

If an old Cursor task, chat, PR description, screenshot, or migration note conflicts with current GitHub state and the authority files above, treat the old instruction as stale and re-check before acting.

## Company naming

Customer-facing company naming is **Digerati Experts** or **DE**, never standalone **Digerati** as the company label. See `.cursor/rules/digerati-naming.mdc`.

## DE SITE-WIDE VISUAL COMPLETION DIRECTIVE

You are working in a multi-agent repository. Other agents may be modifying the site concurrently.

**Before working:**

1. Fetch the latest `origin/main`.
2. Read `docs/AI-ENGINEERING-GOVERNANCE.md` and `docs/ACTIVE-WORK-COORDINATION.md`; inspect open ACTIVE/P0/IN PROGRESS GitHub issues, all current open PRs, and relevant remote branches; then inspect `.ai/ACTIVE_WORK.yaml` as a mirror.
3. Read `design/DESIGN-AUTHORITY.md` and state the task mode (Maintenance or Exploration). Then read `design/BRAND.md`, `DESIGN_SYSTEM.md`, `UX_PRINCIPLES.md`, `IMAGERY.md`, and the Visual System v2 documents â€” as the mandatory system in Maintenance Mode, as evidence of the current system in Exploration Mode.
4. Read `docs/SITE-VISUAL-TASKS.md`.
5. Confirm your task has one assigned owner and is not already IN PROGRESS elsewhere.
6. Work on an isolated branch/worktree.

**Current foundation (Tier 2):** graphite `#050312`, warm paper `#F7F5F2`, magenta `#D3126A`, restrained violet illumination, Space Grotesk / Inter / Oxanium, Store electric blue remains Store-specific (Joe-decided). In Maintenance Mode use it as-is. In Exploration Mode a concept may propose a different implementation of the Tier 1 identity and must say what it changed and why; the identity itself (premium, cybersecurity-first, precise, trustworthy; never cyberpunk, hacker, generic SaaS) does not move.

**Visual philosophy (Tier 0 truth rules, Tier 2 evidence order):** Prefer real artifact â†’ real data â†’ real person â†’ diagram â†’ sanitized UI â†’ illustrative scenario â†’ editorial photography â†’ environment plate â†’ icon. Use technical HUD chrome only to communicate precision, metadata, state, or structure. Do not turn DE into a cyberpunk terminal. Classify operational visuals as LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE. Never fabricate clients, testimonials, metrics, incident-response times, security events, telemetry, compliance claims, partnerships, or product behavior. Build reusable primitives before duplicating patterns across pages.

**During implementation:** inspect â†’ architect â†’ implement â†’ render â†’ screenshot â†’ critique â†’ refine. Verify at 390 / 768 / 1440.

**Before PR:** Fetch origin/main again. Identify every commit that landed on main since your branch began. Compare overlapping files and active-agent claims. Preserve newer unrelated work. Never resolve conflicts by blindly taking a whole-file "ours" or "theirs." Run typecheck/tests/build. Include the concurrency report and visual evidence in the PR. **Do not merge your own PR unless Joe has explicitly authorized an exception under the governance law.**

A task is not finished until reviewed, merged, production-verified, and marked LIVE in the shared task ledger/coordination state.

## Closed loop (UI work)

0. **Visual audit first** â€” read `.cursor/skills/visual-audit/SKILL.md` (and premium-saas-ui / responsive-review / image-art-direction as needed) before changing UI.
1. **Inspect** â€” existing components, tokens, routes, content (preserve â†’ elevate â†’ consolidate).
2. **Implement** â€” Maintenance: reuse before inventing. Exploration: diverge into materially distinct concepts first, built as reusable primitives, isolated from production paths until Joe picks. In both: no content or functionality destruction without DE approval.
3. **Browser verify** â€” Playwright/browser tooling; desktop + tablet + mobile as required (390 / 768 / 1440 minimum).
4. **Critique** â€” separate UI/UX pass against `.cursorrules` Tier 0/1, the mode's Tier 2 expectations, and `design/approved|rejected` as evidence.
5. **Repair** â€” fix issues found; re-verify.
6. **Report done** â€” only after verification + critique + fixes (completion report per sections 40-41).

## Role separation (same agent, distinct passes)

| Pass | Focus |
|------|--------|
| UI director | Hierarchy, brand, conversion, anti-patterns |
| FE engineer | Correct reuse, tokens, a11y, performance |
| QA critic | Rendered result vs rules; routes; regressions |
| Repair | Fix critique findings; re-verify |

## Hosts

- Site: `https://digeratiexperts.com`
- Portal login: `https://portal.digeratiexperts.com/portal/login` (never `//login`)

## Next steps (out of scope here)

- Figma MCP + Code Connect
- Storybook / Chromatic if needed later

## Project skills (all agents)

Reusable skill packs live in `.claude/skills/<name>/SKILL.md` (Claude Code discovers them there) and are mirrored by relative symlinks under `.agents/skills/<name>/` for tools that follow the agentskills convention (Codex / ChatGPT, Cursor, Gemini). Read the skill's `SKILL.md` before doing that kind of task; each carries an `UPSTREAM.md` with provenance, local deviations and its external-service boundary. Do not fork a second copy of a skill into another directory; edit the one under `.claude/skills/` and the mirror follows.

| Skill | Use for | Spends money? |
|---|---|---|
| `scrollcraft` | Scroll-driven experience builds under `scrollcraft/builds/<name>/` | Only if `scripts/kie.mjs` is run |
| `nano-banana-images` | Nano Banana 2 images via kie.ai from a JSON prompt file (Python) | Yes, per image |
| `recraft-icons` | On-brand SVG icons via Recraft, cleaned to `currentColor` glyphs for IconWell, for concepts Lucide lacks (Node) | Yes, per image (`--dry-run` and `clean` are free) |
| `excalidraw-visuals` | Hand-drawn-style PNG diagrams via kie.ai (Node) | Yes, per image |
| `excalidraw-diagram` | Editable `.excalidraw` files, no API | No |
| `frontend-design` | Distinctive frontend code. Maintenance Mode: Tier 2 current system applies on `client/`. Exploration Mode: only Tier 0/1 apply, on `client/` too (`design/DESIGN-AUTHORITY.md`) | No |
| `video-to-website` | FFmpeg frames + GSAP/Lenis scroll page from a video | No |
| `web-design-rules` | Standalone page / reference-match builds with `scripts/serve.mjs` + `scripts/screenshot.mjs`; same mode rule as `frontend-design` | No |
| `skill-builder` | Create or audit a skill | No |
| `wat-framework` | Workflows / Agents / Tools pattern for automation projects | Depends on tools built |
| `trigger-dev`, `trigger-ref` | Trigger.dev automations (in a dedicated Trigger.dev project, never deployed via this repo's CI) | Trigger.dev usage |
| `msp-ai-kit` | MSP/MSSP operating prompts and instruction packs from `kit.config.json` (ChatGPT, Custom GPT, Claude, Cursor, Copilot); optional clone of external MSP kits into `artifacts/msp-ai-kit/vendor/` | No |

Key handling: `KIE_AI_API_KEY` (and `KIE_API_KEY` for `scripts/kie-assets.mjs`) and `RECRAFT_API_KEY` (paid plan only) come from the environment or the gitignored `.env`; `.env.example` is the template. Never commit, print or paste a key. Generated images are ILLUSTRATIVE candidates under `artifacts/kie-ai/` until they pass `design/IMAGERY.md` review.

## Content and webmaster tooling (all agents)

**`docs/CONTENT-TOOLING-PLAN.md`** is Joe's adopted decision (2026-10-04) on which outside tools DE uses for work general assistants can't do well on their own (vector icons, video, voice, live SEO data) and for webmaster-grade finishing (Lighthouse, axe, image optimization, JSON-LD), across the Website, Store, Client Portal and Intelligence Hub. Read it before reaching for an outside generator, builder or SEO tool; do not adopt a tool from its "Not using" list without Joe. Wired in this repo: Chrome DevTools MCP (`.mcp.json`, `.cursor/mcp.json`; Codex and Gemini setup in the plan), `npm run smoke:a11y` in CI, and `vite-imagetools` in `vite.config.ts`.

<!-- >>> DE token-discipline (managed; edit in DE\Governance\repo-kit) >>> -->
## Token discipline (DE operating standard)

Execution rules for every agent in this repo (Claude / Claude Code, Cursor, ChatGPT / Codex). Company-wide AI spend and routing policy is NOT here â€” it lives in `C:\Users\Joe\DE\Governance\AI-STACK.md`. These rules never override this repo's own instructions above, Completion Program lane ownership, or stop gates.

**Session**
- One slice = one fresh agent session. Don't let unrelated slices pile into one long conversation.
- Start from the latest handoff (format: `C:\Users\Joe\DE\Governance\AI-HANDOFF-STANDARD.md`), not from old chat history.

**Declare the slice before significant coding** (a few lines): objective Â· files likely involved Â· acceptance criteria Â· verification/test commands Â· known boundaries.

**Reading**
- Search first (symbols, routes, functions, tests, docs, references). Open only files the slice needs; read ranges of large files.
- No recursive reading of the whole repo without a specific reason.
- Don't reopen unchanged files unless verifying a later modification.
- Don't open generated output, `node_modules`, media, or evidence/screenshot folders unless the slice is about them. Lockfiles, migrations, schemas and config ARE readable when the slice needs them.

**Two-failure stop rule**
After two materially failed attempts at the same issue: STOP. No speculative patch cycling. Write a checkpoint with: observed behavior Â· each attempt and why it failed Â· evidence (logs/errors) Â· suspected root cause Â· exact next investigation. Escalate per lane.

**Model economics**
- Economy/fast models: inventory, repetitive edits, routine refactors, doc formatting, simple test updates, lint cleanup, search/classification.
- Premium/deep models: architecture, security-sensitive changes, identity/auth, billing/payment, data migrations, hard debugging, cross-repo contracts, final review of high-risk work.
- Don't use expensive reasoning just because it's available.

**Verification**
Run targeted tests while iterating; run the full suite once before the checkpoint. Trim tool output to what matters (failures, tails).

**Handoff**
End every session with the DE handoff block. Record limit hits, model used, and any manual rescue under USAGE SIGNALS so the monthly scorecard stays accurate.
<!-- <<< DE token-discipline (managed) <<< -->
