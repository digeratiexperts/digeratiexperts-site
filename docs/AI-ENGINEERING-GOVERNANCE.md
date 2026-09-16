# DE AI Engineering Governance Law

Status: **MANDATORY** for all AI agents and human-assisted agent workflows in `digeratiexperts/digeratiexperts-site`.

This policy exists to stop lost work, PR overwrite, branch fights, visual regressions, duplicate implementations, and unverified deployments in a multi-agent repository.

If an older chat, prompt, task, branch note, PR body, screenshot, or agent instruction conflicts with this document, this document wins unless Joe explicitly overrides it.

## 1. Authority hierarchy

1. **Joe / DE owner** — final product, business, risk, and release authority.
2. **ChatGPT** — architecture, product/UX direction, design critique, coordination, audit, and independent review. ChatGPT may prepare branches/PRs when explicitly asked, but is not the default website integrator or production deploy authority.
3. **Claude Code** — **default lead website implementation and integration agent**. Claude owns final reconciliation of website implementation branches, merge-readiness review, and production verification unless Joe explicitly reassigns the lead-integrator role for a specific task.
4. **Cursor** — specialist implementation agent. Cursor works on isolated branches/worktrees and submits PRs to the lead integrator. Cursor does not independently merge or deploy website work unless Joe explicitly authorizes that exception.
5. **Antigravity / Gemini and other agents** — specialist implementation, independent review, testing, or challenge agents. They submit work to the lead integrator and do not independently merge or deploy unless Joe explicitly authorizes that exception.

No agent may infer an authority change from another agent's message. Only Joe can reassign final authority or the lead-integrator role.

## 2. One integration authority

At any moment, there is exactly **one lead integrator** for the website. Default: **Claude Code**.

The lead integrator is responsible for:

- reconciling concurrent work against current `main`;
- detecting overlap before merge;
- preserving newer unrelated work;
- rejecting stale or duplicative PRs;
- verifying tests, build, security checks, and rendered UI evidence;
- deciding merge order;
- verifying production after deployment.

Specialist agents may implement. They may not declare the repository integrated merely because their own branch passes tests.

## 3. Never share a working tree

Every agent must use its own branch and isolated worktree/checkout.

Forbidden:

- two agents editing the same working tree;
- an agent developing directly on `main`;
- an agent rebasing, resetting, force-pushing, or replacing another agent's branch without explicit approval;
- using a whole-file `ours`/`theirs` conflict resolution as a shortcut without line-by-line review.

Recommended branch prefixes:

- `claude/*`
- `cursor/*`
- `antigravity/*`
- `chatgpt/*`

## 4. Active-work claims are mandatory

Before changing code, an agent must inspect `.ai/ACTIVE_WORK.yaml` and `docs/SITE-VISUAL-TASKS.md` when visual work is involved.

A new task must record:

- task id;
- owner agent;
- subsystem;
- expected files/globs;
- starting `main` SHA;
- status;
- start time or date when practical.

If another active claim overlaps the same subsystem or files, **do not start**. The agent must either choose non-overlapping work or escalate the overlap to the lead integrator.

An active claim is a coordination lock, not ownership of the repository. Claims should be released when a task is merged, abandoned, or superseded.

## 5. Start-of-task gate

Before implementation, every agent must:

1. `git fetch origin`;
2. identify exact current `origin/main` SHA;
3. read `AGENTS.md` and this document;
4. inspect active-work claims;
5. inspect relevant architecture/design/source-of-truth files;
6. create an isolated branch/worktree from current `main` unless a documented dependency requires another base;
7. record the starting SHA in the task/PR.

A task started from stale `main` is not automatically invalid, but it may not merge without explicit reconciliation.

## 6. No blind overwrite law

Before merge, fetch current `main` again and calculate what changed since the branch started.

Every PR must identify:

- branch base SHA;
- current `origin/main` SHA;
- commits landed on `main` since branch creation;
- overlapping files;
- overlapping active-agent work;
- reconciliation performed;
- whether newer work was preserved.

If overlap exists, the lead integrator must review the actual diff. Tests alone are not proof that newer work was preserved.

Forbidden merge strategies include:

- blindly taking the branch copy of an overlapping file;
- blindly taking `main` and silently dropping branch behavior;
- closing a competing PR without first preserving unique useful work;
- replacing a current component with an older branch version because it is easier to resolve.

## 7. PR-only integration

Normal website changes must arrive through a PR.

Specialist agents do **not** merge their own PRs. The lead integrator performs or coordinates merge-readiness review.

A PR is not ready because it compiles. It is ready only when applicable evidence is complete:

- concurrency audit;
- typecheck;
- relevant unit/integration tests;
- production build;
- security/leakage checks where relevant;
- rendered browser verification for UI work;
- production-impact statement;
- explicit remaining-risk statement.

Emergency direct-to-main work requires Joe's explicit authorization and a follow-up audit record.

## 8. Visual quality is a release gate

**Code correctness and visual quality are separate acceptance criteria.**

For visual work, an agent must inspect the real rendered component **in its actual page context before changing it**. Do not design from source code or a prompt alone when a rendered interface exists.

Required loop:

**inspect -> establish target -> implement -> render -> screenshot -> critique -> refine -> re-render**

Minimum rendered verification:

- 390px;
- 768px;
- 1440px.

For meaningful visual changes, capture before/after evidence where practical.

Ask this before sign-off:

> Is the rendered result materially better, clearer, more coherent, and more premium than the previous state in the actual context where users see it?

Merely matching a prompt is insufficient.

## 9. Design-system law

How much authority each design rule carries is defined in **`design/DESIGN-AUTHORITY.md`** (Tier 0 non-negotiables, Tier 1 brand identity, Tier 2 current design system, Tier 3 historical record) together with the two task modes, Maintenance and Exploration. This section is the engineering side of that model.

**Maintenance Mode (default):** agents compose from the current DE visual system before inventing new patterns. The current system lives in:

- `design/BRAND.md`
- `design/DESIGN_SYSTEM.md`
- `design/UX_PRINCIPLES.md`
- `design/VISUAL_SYSTEM_V2.md`
- `design/UI-STYLE-RULES.md`
- `.cursor/rules/ui-ux.mdc`
- `.cursor/rules/visual-system-v2.mdc`

Before creating a new visual primitive, search for an existing one. If the desired UI cannot be expressed cleanly with existing primitives, propose the new reusable primitive explicitly rather than silently creating a one-off dialect.

**Exploration Mode (Joe asks to redesign, rethink, reimagine, modernize, explore, propose concepts, make it materially better or make it feel different):** the current system is a starting point and a benchmark, not a boundary. Agents may propose new primitives, layout systems, art direction, typography, motion and structure, provided each concept states what it keeps and changes and why, respects Tier 0 and Tier 1, produces materially distinct alternatives before converging, and stays isolated from production paths (`artifacts/design-concepts/<task>/`, `scrollcraft/builds/<name>/`, or an isolated branch) until Joe picks a direction.

**In every mode:** do not let separate agents invent competing versions of the same control, card, modal, dock, icon treatment, spacing language, or interaction pattern *inside one shipped system*. Exploration produces alternatives on purpose; integration must converge on one.

## 10. UI controls must be designed for their physical context

Icons, launchers, modals, fixed bars, floating controls, badges, and responsive controls must be judged at their real rendered size and placement.

Do not treat generated artwork, mockups, screenshots, or references as geometry to copy literally. They establish intent. Implementation must fit the actual UI context.

A tiny persistent launcher must be designed as a tiny persistent launcher, not as a full logo shrunk into a button.

## 11. No overlapping interactive layers

Two fully opaque interactive controls may not occupy the same visual space.

All fixed/floating chrome must use the shared coordination variables/patterns already defined by the repository. Hardcoded offsets that ignore other persistent chrome are prohibited.

The only acceptable overlap is when underlying content is intentionally inactive and visually treated as such, e.g. a modal scrim.

## 12. Production is a separate state from Git

`MERGED` does not mean `LIVE`.

A task may be called LIVE only after production verification confirms the expected release is actually served.

Production verification must include, as applicable:

- expected Git/release SHA or release identifier;
- health endpoint(s);
- affected public route(s);
- critical interaction smoke test;
- protected-route/security behavior when relevant;
- absence of obvious visual regression.

If production serves an older SHA, the task is not complete even if GitHub CI is green.

## 13. Destructive and high-risk actions

Only Joe may authorize:

- force-pushing shared branches;
- destructive database changes;
- deleting repositories or major feature sets;
- rotating credentials outside an approved incident procedure;
- changing production DNS/hosting architecture;
- bypassing required tests or visual QA;
- overriding the lead-integrator rule for a release.

Agents must fail closed when ownership or intent is ambiguous.

## 14. Independent review is encouraged; independent integration is not

Cursor, Antigravity/Gemini, ChatGPT, or another model may challenge Claude's implementation, run additional QA, or propose a superior solution.

That review is valuable. It does **not** create a second integration authority.

If reviewers disagree, preserve both analyses and escalate the decision to Joe or the lead integrator as appropriate. Do not race to merge competing answers.

## 15. Completion definition

A website task is complete only when all applicable stages are true:

1. claimed;
2. implemented on isolated branch/worktree;
3. reconciled against current `main`;
4. reviewed;
5. tests/build pass;
6. rendered visual QA passes when applicable;
7. PR merged by the authorized integration path;
8. production deployment succeeds;
9. production verification succeeds;
10. active-work claim/ledger is updated or closed.

Anything less must be described by its actual state: drafted, implemented, PR-open, merged-not-live, blocked, superseded, or failed verification.

## 16. Enforcement gap: GitHub `main` protection

Repository policy requires `main` to be protected against accidental direct pushes and unsafe integration. Required controls should include, where supported:

- PR required before merge;
- required CI/status checks;
- no force pushes;
- no branch deletion;
- stale approval handling/review as appropriate;
- administrative bypass limited to intentional emergency use.

If GitHub reports `main` as unprotected, treat that as a P0 governance gap. The absence of technical protection does **not** weaken this policy.

## 17. Override rule

Joe may explicitly override any coordination rule for a specific task or emergency. The override should be narrow, stated clearly, and recorded in the PR/issue when practical.

No agent may create a permanent exception by precedent.

## 18. DE Product Preservation Law

**Scope.** This law governs what ships: Maintenance Mode work and the *integration* of any chosen redesign into the production product. It does not govern ideation. An Exploration Mode concept (see `design/DESIGN-AUTHORITY.md`) may replace anything in Tier 2 on its isolated branch; when Joe picks a concept, this law decides how that concept is integrated — what is kept, upgraded, added and replaced — and Tier 0 functional preservation (routes, forms, integrations, SEO, business logic, customer workflows) remains mandatory throughout.

Existing production DE identity, content, imagery, functionality, information architecture, business rules, integrations, customer workflows, and branded elements are canonical product assets.

Visual references, competitor sites, generated mockups, Figma/Fable concepts, screenshots, and AI design proposals establish **design intent and quality targets, not replacement authority**.

Unless Joe explicitly approves a material replacement, agents must improve the existing DE implementation through **preservation, refinement, composition, and addition**. A redesign Joe requested is the documented reason at the concept level. Joe's pick of a concept approves the direction; the integration PR still lists every REPLACE and every removal of existing content, CTAs, navigation, stats or functionality, and each needs Joe's explicit approval.

The default decision hierarchy is:

**KEEP -> UPGRADE -> ADD -> REPLACE**

- **KEEP** — preserve an existing DE element that already serves its purpose well.
- **UPGRADE** — retain the element, function, identity, or content while improving presentation, usability, accessibility, responsiveness, implementation quality, or coherence.
- **ADD** — introduce a genuinely missing layer, capability, supporting component, visual depth, or interaction without displacing useful DE product assets.
- **REPLACE** — last resort. A material replacement requires a documented reason and Joe's explicit approval when it removes or substantially changes an existing DE-specific asset, behavior, workflow, or identity element.

Before replacing or removing an existing production element, the agent must determine and document, where material:

1. what purpose the existing element serves;
2. whether it is DE-specific or generic;
3. what functionality, data, brand meaning, customer context, or business rule would be lost;
4. whether the target can be achieved by restyling, recomposition, augmentation, or refactoring instead;
5. whether Joe explicitly approved replacement.

A reference screenshot or mockup must never cause silent loss of DE-specific assets, content, capabilities, integrations, business logic, customer workflows, or identity.

Rendered visual QA must compare against **two baselines** when applicable:

- **Baseline A — pre-change DE:** what existed before, what purpose it served, and whether anything valuable disappeared or regressed;
- **Baseline B — approved visual target/reference:** which qualities, hierarchy, polish, layering, or interaction patterns should be adopted.

A result that looks closer to a reference but loses useful DE identity, functionality, information, or business behavior **fails acceptance**.

The governing question is:

> Does this feel like a materially upgraded Digerati Experts product, or like a different product wearing the DE name?

If the answer is the latter, preserve more and replace less.

"DE identity" in this question means Tier 1 identity (`design/DESIGN-AUTHORITY.md`): premium, cybersecurity-first, precise, trustworthy, principal-led, with its differentiators intact. A product that keeps that identity but implements it with a different palette, type stack or layout system because Joe asked for a redesign is a materially upgraded Digerati Experts product, not a different product wearing the DE name.
