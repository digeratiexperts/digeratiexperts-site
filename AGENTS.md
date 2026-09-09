# Agent workflow (Digerati Experts)

## AI engineering governance — mandatory

Authoritative multi-agent policy: **`docs/AI-ENGINEERING-GOVERNANCE.md`**. GitHub-visible active issues + open PRs are the authoritative concurrency locks; **`.ai/ACTIVE_WORK.yaml`** is a mirror only. Required procedure: **`docs/ACTIVE-WORK-COORDINATION.md`**. This policy is mandatory for Claude Code, Cursor, Antigravity/Gemini, ChatGPT-assisted repository work, and other agents.

Default authority: Joe is final product/release authority; Claude Code is the default lead website implementation/integration agent; Cursor and Antigravity/Gemini are specialist/review agents unless Joe explicitly reassigns the role for a specific task. There is only one website integration authority at a time.

Every agent must use an isolated branch/worktree, check open active GitHub issues + all current open PRs + relevant remote branches before editing, then inspect the YAML mirror. Reconcile against current `origin/main` before merge, and treat `MERGED` and `LIVE` as separate states. Specialist agents do not independently merge/deploy website work by default.

For visual work, rendered quality is an acceptance gate separate from code correctness. Inspect the actual UI in context before changing it and verify at 390 / 768 / 1440.

Authoritative policy: **`.cursorrules`** (sections 1-42, including section 9A Visual System v2). Always-applied pointers: `.cursor/rules/00-follow-cursorrules.mdc`, `.cursor/rules/de-ecosystem.mdc`, `.cursor/rules/agent-governance.mdc`, `.cursor/rules/account-lifecycle.mdc`.

## Account Lifecycle Status — internal only

`docs/ACCOUNT-LIFECYCLE-STATUS.md` (mirror; authority is Hub `.agents/memory/account-lifecycle-status-source-of-truth.md`) defines the 13 canonical account lifecycle values. The field is **governed everywhere and displayed nowhere client-facing**: never on the public website or in client-visible portal UI, client-delivered artifacts, or client-scoped API responses — but still fully enforced server-side for authorization, entitlement, gating, automation, and internal/admin UI. Omit it at the serialization boundary; hiding it in the UI is not compliance. Always-applied rule: `.cursor/rules/account-lifecycle.mdc`. Note the naming collision: `/portal/admin/lifecycle` is the **JumpCloud employee identity** lifecycle, a different domain.

Design OS (execution layer, does not replace `.cursorrules`): start with **`design/UI-STYLE-RULES.md`** (consolidated theme/surface/archetype/layout rules), then `.cursor/rules/ui-ux.mdc`, `brand.mdc`, `frontend.mdc`, `visual-system-v2.mdc` + `design/DESIGN_SYSTEM.md` + `design/VISUAL_SYSTEM_V2.md`. Never judge UI from source code alone. Blog/Journal and Store colors are locked: `.cursor/rules/blog-store-color-lock.mdc`.

Task ledger: `docs/SITE-VISUAL-TASKS.md`. Do not start a visual task marked IN PROGRESS by another owner. Do not invent HUD/evidence primitives ad hoc.

## Repository authority — check this before starting work

- This repository, `digeratiexperts/digeratiexperts-site`, is the **canonical public website repository**.
- Website work branches from and opens PRs back to this repository's current `main`.
- `Replit-Site` references are historical and must not redirect new website work.
- `digeratiexperts/Intelligence-Hub` is the canonical internal Intelligence Hub / Tech Sales application repository.
- `digeratiexperts/TechSales` is legacy/reference-only by default; do not start new work there or archive/delete it without an explicit migration decision.
- Full authority matrix: `docs/REPOSITORY-AUTHORITY.md`.
- Website source-of-truth details: `docs/SOURCE-OF-TRUTH.md`.
- Ecosystem rule (always apply): `.cursor/rules/de-ecosystem.mdc`. This website is a GitHub-owned **content/application projection**. Intelligence Hub is the **operational control plane**.
- Ecosystem **scoreboard** is Hub Issue [#122](https://github.com/digeratiexperts/Intelligence-Hub/issues/122) (charter `docs/DE-ECOSYSTEM-CHARTER.md`, ratified PR #123 / `5354a8b`). Do **not** copy ECO-001–030 into this repo. Do **not** call the ecosystem finished until #122’s completion gate passes.

If an old Cursor task, chat, PR description, screenshot, or migration note conflicts with current GitHub state and the authority files above, treat the old instruction as stale and re-check before acting.

## Company naming

Customer-facing company naming is **Digerati Experts** or **DE**, never standalone **Digerati** as the company label. See `.cursor/rules/digerati-naming.mdc`.

## DE SITE-WIDE VISUAL COMPLETION DIRECTIVE

You are working in a multi-agent repository. Other agents may be modifying the site concurrently.

**Before working:**

1. Fetch the latest `origin/main`.
2. Read `docs/AI-ENGINEERING-GOVERNANCE.md` and `docs/ACTIVE-WORK-COORDINATION.md`; inspect open ACTIVE/P0/IN PROGRESS GitHub issues, all current open PRs, and relevant remote branches; then inspect `.ai/ACTIVE_WORK.yaml` as a mirror.
3. Read `design/BRAND.md`, `DESIGN_SYSTEM.md`, `UX_PRINCIPLES.md`, `IMAGERY.md`, and the Visual System v2 documents.
4. Read `docs/SITE-VISUAL-TASKS.md`.
5. Confirm your task has one assigned owner and is not already IN PROGRESS elsewhere.
6. Work on an isolated branch/worktree.

**Brand foundation is locked:** graphite `#050312`, warm paper `#F7F5F2`, magenta `#D3126A`, restrained violet illumination, Space Grotesk / Inter / Oxanium, Store electric blue remains Store-specific. Do not redesign the foundational palette or typography.

**New visual philosophy:** Prefer real artifact → real data → real person → diagram → sanitized UI → illustrative scenario → editorial photography → environment plate → icon. Use technical HUD chrome only to communicate precision, metadata, state, or structure. Do not turn DE into a cyberpunk terminal. Classify operational visuals as LIVE / SANITIZED REAL / EXAMPLE / ILLUSTRATIVE. Never fabricate clients, testimonials, metrics, incident-response times, security events, telemetry, compliance claims, partnerships, or product behavior. Build reusable primitives before duplicating patterns across pages.

**During implementation:** inspect → architect → implement → render → screenshot → critique → refine. Verify at 390 / 768 / 1440.

**Before PR:** Fetch origin/main again. Identify every commit that landed on main since your branch began. Compare overlapping files and active-agent claims. Preserve newer unrelated work. Never resolve conflicts by blindly taking a whole-file "ours" or "theirs." Run typecheck/tests/build. Include the concurrency report and visual evidence in the PR. **Do not merge your own PR unless Joe has explicitly authorized an exception under the governance law.**

A task is not finished until reviewed, merged, production-verified, and marked LIVE in the shared task ledger/coordination state.

## Closed loop (UI work)

0. **Visual audit first** — read `.cursor/skills/visual-audit/SKILL.md` (and premium-saas-ui / responsive-review / image-art-direction as needed) before changing UI.
1. **Inspect** — existing components, tokens, routes, content (preserve → elevate → consolidate).
2. **Implement** — reuse before inventing; no content destruction without DE approval.
3. **Browser verify** — Playwright/browser tooling; desktop + tablet + mobile as required (390 / 768 / 1440 minimum).
4. **Critique** — separate UI/UX pass against `.cursorrules` + `design/approved|rejected`.
5. **Repair** — fix issues found; re-verify.
6. **Report done** — only after verification + critique + fixes (completion report per sections 40-41).

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
| `excalidraw-visuals` | Hand-drawn-style PNG diagrams via kie.ai (Node) | Yes, per image |
| `excalidraw-diagram` | Editable `.excalidraw` files, no API | No |
| `frontend-design` | Distinctive frontend code; DE brand lock wins on `client/` | No |
| `video-to-website` | FFmpeg frames + GSAP/Lenis scroll page from a video | No |
| `web-design-rules` | Standalone page / reference-match builds with `scripts/serve.mjs` + `scripts/screenshot.mjs` | No |
| `skill-builder` | Create or audit a skill | No |
| `wat-framework` | Workflows / Agents / Tools pattern for automation projects | Depends on tools built |
| `trigger-dev`, `trigger-ref` | Trigger.dev automations (in a dedicated Trigger.dev project, never deployed via this repo's CI) | Trigger.dev usage |

Key handling: `KIE_AI_API_KEY` (and `KIE_API_KEY` for `scripts/kie-assets.mjs`) come from the environment or the gitignored `.env`; `.env.example` is the template. Never commit, print or paste a key. Generated images are ILLUSTRATIVE candidates under `artifacts/kie-ai/` until they pass `design/IMAGERY.md` review.
