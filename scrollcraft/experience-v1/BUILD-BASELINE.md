# BUILD-BASELINE — DE Experience v1 (Phase 0)

Recorded 2026-09-03 by Claude Code at the start of the creative reset Joe
ordered on 2026-09-02 ("Next-Generation Website Build Plan", Phases 0–5 only).
Everything here was checked, not assumed.

## Repositories

| Role | Repository | Status |
| --- | --- | --- |
| **Canonical production and development repository** | `digeratiexperts/digeratiexperts-site` (public) | The only build target. Production deploys from `main`. |
| Legacy website repository | `digeratiexperts/de_site` (public, last push 2026-08-31) | **Not used as a build target.** Nothing in this lane reads from or writes to it. |
| Other DE repositories seen in the account | `Intelligence-Hub`, `de-platform`, `vulnerability-management`, `TechSales`, `intelligencehub-` | Products and tooling, not the website. Product-proof captures (Phase 8) may come from these later, with provenance. |

## Production state at baseline

| Item | Value |
| --- | --- |
| Production branch | `main` |
| Production SHA | `80ce2f47a43bcf99f3a5545a525f17a8ee30ccb5` ("Bug-hunt hardening follow-up", PR #182) |
| Deploy evidence | CI run 545 (`33685140870`), 2026-09-02 21:26–21:30 UTC: job "Typecheck, test, build, audit, and smoke" success; job "Deploy and verify production VPS" success on the self-hosted runner `racknerd-17eee46-website-prod`, step "Verify production runtime" success |
| Live host | https://digeratiexperts.com/ |
| Homepage on production | `DigeratiHomepage.tsx`: the pre-existing hero plus the nine diagram-system service sections merged by PR #178 (`1ec1457`) |
| Review lab on production | https://digeratiexperts.com/scrollcraft/ (noindex, `Disallow: /scrollcraft/`), static files under `public/scrollcraft/**` served by `server/index.ts` |

`MERGED` and `LIVE` are separate states. Production is LIVE only after the
"Verify production runtime" step passes on the deploy job.

## The new build lane

| Item | Value |
| --- | --- |
| Branch | `claude/de-experience-v1`, created from `main` @ `80ce2f4` |
| Worktree | `/home/user/de-exp` (this cloud session) |
| Build folder | `scrollcraft/builds/experience-v1/` (isolated Scrollcraft build: `index.html`, a copied engine, vendored libraries, fonts, assets) |
| Planning documents | `scrollcraft/experience-v1/` (this file and the Phase 1–5 deliverables) |
| Local development URL | `node .claude/skills/scrollcraft/scripts/serve.mjs --root scrollcraft/builds/experience-v1 --port 4500` → http://127.0.0.1:4500/ |
| Review URL before any merge | a claude.ai artifact (private to Joe's account), published from the build |
| Review URL after merge to `main` | https://digeratiexperts.com/scrollcraft/experience-v1/ (the lab: noindex, robots-disallowed, no navigation from the public site except `/versions`) |
| Staging URL | none exists for this repository |
| Deployment target for the experience itself | **none.** Nothing in this lane touches `client/`, `server/` or `shared/`. Production replacement requires Joe's explicit approval after Quality Gate A, Phases 6–16 and the final production gate. |

## Isolation from production

- The build lives under `scrollcraft/builds/`, which no production route serves.
- The only production-visible surface this lane can reach is the review lab
  under `public/scrollcraft/`, and only when a PR is merged; the lab is
  noindex and robots-disallowed.
- The `de-site-v2-scrollcraft` claim (mirror in `.ai/ACTIVE_WORK.yaml`) owns
  `scrollcraft/**`; this lane is a new claim `de-experience-v1` inside it,
  same owner. Other open lanes: PR #184 (kie.ai tooling and asset planning,
  draft), PR #185 (service-model governance, draft), PR #186 (Why DE passage,
  draft, awaiting Joe's verdict), the eight-block homepage correction (its own
  small PR). None of them touches `scrollcraft/builds/experience-v1/`.

## Existing Scrollcraft dependencies

| Dependency | Where | Notes |
| --- | --- | --- |
| Scrollcraft engine | `scrollcraft/builds/why-passage/scrollcraft.js` + `scrollcraft.css` (vendored copy of the skill's engine; acts: flow / pin / pan / scrub, cues, kinetic text, reveals, counters, worldflight) | Copied verbatim into the new build, never edited. Publishes `--sc-p` per act, which the WebGL stage reads. |
| Locked faces | `inter-latin.woff2` (48 KB), `space-grotesk-latin.woff2` (22 KB), `oxanium-latin.woff2` (14 KB) | Served locally; no third-party font requests. |
| Verification harness | `.claude/skills/scrollcraft/scripts/shoot.mjs` (contact sheets, per-act frames, reduced motion), `serve.mjs`, `worldflight-assert.mjs`, `doctor.mjs` | Needs the installed Chromium (`/opt/pw-browsers/chromium-1234/chrome-linux/chrome`) and `playwright-core` from the project. |
| Lab publisher | `scripts/build-scrollcraft-lab.mjs` (`import`, `docs`, `diagrams`) | Copies a build into `public/scrollcraft/<slug>/` and renders the planning markdown to HTML. |
| Diagram system | `client/src/diagrams/` (five framework-free SVG diagrams, staged) | Evidence layer only in the new direction (see the teardown). |

## Creative and engineering tools available in this environment

| Tool | State |
| --- | --- |
| Node 22, TypeScript, Vite, esbuild, vitest | installed |
| three.js | `three@0.185.1` reachable from the registry; `three.module.min.js` 366 KB (87 KB gzip) + `three.core.min.js` 385 KB (101 KB gzip). Vendored into the build's `assets/vendor/` rather than loaded from a CDN, so the lab's static host and CSP need no change. |
| Playwright + Chromium 1234 | screenshots at any viewport, reduced-motion emulation, WebGL through SwiftShader (software; frame timings are a lower bound, not a GPU measurement) |
| ffmpeg (full build, libwebp) | frame sequences, contact sheets, clip encoding |
| kie.ai | key present in the environment (`KIE_AI_API_KEY`); the API host is on the allowlist; the two result hosts (`tempfile.redpandaai.co`, `tempfile.aiquickdraw.com`) are **not yet** on the Default environment's allowlist. Spend gate `.claude/skills/scrollcraft/scripts/kie.mjs`. **Zero spend in Phases 0–5**: no asset has a role until the asset bible says so, and every paid generation needs Joe's approval and a cap in the same message. |
| Skill packs | `scrollcraft`, `nano-banana-images`, `excalidraw-visuals` (explainers only, never the flagship), `excalidraw-diagram`, `frontend-design`, `video-to-website`, `web-design-rules` |
| Real phone / device farm | **none.** Mobile is verified by emulation only; a real-device pass is a standing manual gate. |

## Known constraints (binding)

1. **Brand.** `design/BRAND.md`: not childish, not gimmicky; graphite ground, magenta `#D3126A` as the only pop, violet as lighting only, never a purple-filled panel; locked type. `design/IMAGERY.md`: "represent the underlying idea rather than the literal noun"; no AI-generated humans as staff; no stock. The living-business scene of Act 1 must therefore be **built, not photographed**: a dimensional environment rendered in code, with light, depth and material, in which people are presence rather than portraits.
2. **kie.ai.** Image models only (no video, audio, LLM); approval and cap per generation; asset bible before any generation; candidate status until Joe has seen it; never auto-published.
3. **Scrollcraft freeze.** The 2026-09-01 freeze on new scroll treatments for any route stands; this lane is the flagship prototype Joe ordered on 2026-09-02, isolated under `scrollcraft/builds/`, not a route.
4. **Production.** No merge or deploy of the experience without Joe's explicit approval. The lab route is a review surface, not a launch.
5. **Performance.** The main site's CSS budget (300 KB entry stylesheet, 291.19 KB used) does not apply to the isolated build, but the build sets its own budget: first paint without the WebGL library, the library lazy-loaded (≈190 KB gzip), scene assets under 1 MB total, no layout shift, reduced-motion parity.
6. **Taxonomy.** The eight cybersecurity blocks (`docs/DE-SERVICE-MODEL-2026.md` on PR #185) are the current architecture; the 14 internal domains are unenumerated and unresolved. Act 5 of the storyboard represents the business's domains without leaning on either count until Joe settles it.

## STOP GATE 0

Known exactly: the new development site lives in `digeratiexperts/digeratiexperts-site` on branch `claude/de-experience-v1` (from `main` @ `80ce2f4`), under `scrollcraft/builds/experience-v1/`. Production is `main` @ `80ce2f4`, verified live 2026-09-02 21:30 UTC. Gate 0 is passed.
