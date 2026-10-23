# Lane H — homepage refinement (Wave 1) — log

**Agent:** opencode (specialist) · **Branch:** `opencode/lane-h-homepage-20261022` · **Claim:** issue
[#696](https://github.com/digeratiexperts/digeratiexperts-site/issues/696) + `.ai/ACTIVE_WORK.yaml` mirror.
**Plan:** `docs/plans/opencode/lane-h-homepage.md`, overridden where it differs by
`docs/plans/opencode/lane-h-update-1.md`. **Mode:** Maintenance.

## Slice declaration (2026-10-22)

- **Objective:** refine the live homepage (V8 at `/`) — one CTA system, canonical service names,
  visitor-facing copy, section consolidation per the plan's story spine, threat feed moved off the
  homepage to a Security Updates link, unpublished TODO slots for the assessment price and a client
  testimonial.
- **Files:** `client/src/pages/versions/v8/**` only (plus this log, the Phase 0 report, and the YAML
  mirror). Nothing in the portal, no shared chrome, no frozen version bundles.
- **Acceptance:** `npm run check`, `npm test`, `npm run build`, `npm run smoke:a11y` green; smoke gate
  test ids and `<h1>` preserved; browser evidence at 390 / 768 / 1024 / 1280 / 1440; PR carries the
  section map, moved-content list, CTA replacement list, concurrency report.
- **Verify:** `npm run check` · `npm test` · `npm run build` · `npm run smoke:a11y` · browser renders.
- **Boundaries:** no merges, no deploy, no secrets, no new dependencies, no deletion of routes or
  content (moves are listed), no fabricated proof.

## Decisions

1. **V8 is the base** (Update 1). The plan's `/version-3` comparison is recorded in
   `docs/lanes/lane-h-phase0.md` and closed out: nothing is ported, V8's hero stays, the
   `ModernHeroSection` "Your Arizona business," line stays out.
2. **Merge at composition level, not by deleting files.** `01-hero.phone.test.ts`,
   `teamProfile.test.ts` (reads `09-team.tsx`) and `footerContact.test.ts` (reads `16-contact-footer.tsx`)
   pin those files, so the proof-and-trust and closing blocks compose the existing components inside one
   chapter each instead of rewriting them into new files.
3. **Section order follows the plan's story spine** (credibility → problems/risk → ways to engage →
   packages → assessment/process → industries → proof & trust → FAQ → closing). Every existing `id`
   keeps working via the primary id or an alias anchor, so the spy row, the dock and deep links survive.
4. **CTA system is homepage-scoped.** Labels live in a V8-local module
   (`client/src/pages/versions/v8/cta.ts`), not in `client/src/lib/ctaCopy.ts`, which serves every other
   surface and is outside this lane. The compact labels ("Schedule Assessment") are needed in
   `MegaMenu.tsx` / `StickyCTABar.tsx` (shared chrome, Lane A territory) — listed as a cross-lane
   follow-up, not edited here.
5. **Threat feed:** the feed UI leaves `/`; `/resources/security-updates` (route and `SecurityUpdates.tsx`
   component) is untouched and keeps the full stream. The homepage keeps a small Security Updates link
   where the feed was, so the dev loading copy ("Nothing is invented while this loads") leaves with the
   feed it belonged to. Nothing deleted: the cards, caption, attribution and empty/loading states already
   live on the Security Updates page (`useThreatFeed("all")`).
6. **Unpublished slots:** assessment price (FAQ) and client testimonial ship as `TODO (Joe)` code
   comments with no rendered placeholder. No fake proof, ever.
7. **Truth pass inside lane scope:** "Signals surface immediately" loses its speed implication; the
   proof-foot industry list matches the six published `/industries/*` pages. Full claims inventory in
   `docs/lanes/lane-h-phase0.md` §6.

## Cross-lane needs

- **Lane A / shared chrome:** the compact CTA labels ("Schedule Assessment") in `MegaMenu.tsx` and
  `StickyCTABar.tsx`, so the CTA system is consistent site-wide.
- **Joe:** two decisions (assessment price wording; a real client testimonial when one is approved) —
  see the `Add to to-do list:` block in the handoff.

## Status

- 2026-10-22: claim opened (issue #696), Phase 0 report written, implementation in progress.
