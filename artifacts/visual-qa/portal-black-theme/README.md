# Client Portal Black theme — review evidence

Maintenance Mode. Joe's supplied 2026-10-11 palette is the approved direction for this slice. Owner: ChatGPT/Codex. Claim: [issue #577](https://github.com/digeratiexperts/digeratiexperts-site/issues/577). Base: `72cdd50e56f911c2779c03e9b0abbb0971e94781`.

These are **EXAMPLE** screenshots of the actual production frontend build with mocked API responses, an example company/contact, and no live operational data. External network requests are blocked. They demonstrate the UI, not authenticated production access or provisioning completion.

## Result

- Black paints the page, topbar and rail `#000000`, with `#08080b` cards. Dark and Light use Joe's supplied palettes. Existing saved choices are retained; new viewers start in Black.
- The account menu and Settings share Black / Dark / Light / Match device. Contrast offers Standard / Boost / Maximum and persists separately on this device.
- Resolved `data-theme` and `data-contrast` live on `<html>` while a portal page is mounted. Body scope carries tokens to Radix menus/dialogs. Sign-in, signup and password recovery use the same saved preferences, with appropriate light/dark logo artwork.
- The raw action token is named `--pt-action`: shadcn reserves `--accent` for an HSL hover surface. HSL bridges reproduce the hex palette in existing components. The dark brand rail and semantic status/category colors are preserved.
- Small accessibility adaptations: bright pink hover uses dark button text; placeholders use the readable muted ink. Black sign-in omits the decorative glow so its field stays pure black.

## Verification

`browser-results.json` records 27 combinations: Black/Dark/Light × Standard/Boost/Maximum × 390/768/1440 pixels. It verifies exact page/card colors, no horizontal overflow and primary-button text contrast of at least 4.5:1. Browser page errors: 0.

Additional browser checks cover account-menu/Settings synchronization, persistence after reload, live Match device changes, cross-tab updates, mobile navigation, portalled account and command menus, visible keyboard focus, sign-in preferences and cleanup of portal root/body attributes on a public route.

Axe WCAG 2 A/AA + 2.1 AA: 11 scans, 0 violations in the Appearance/Profile panels across all nine theme/contrast combinations and the Black/Light mobile sign-in pages. This is scoped UI verification, not a site-wide accessibility certification.

- `npm run check`: passed.
- Theme/light-palette tests: 9 passed.
- `npm run build`: passed. Browser bundle budget passed: entry 563.32 kB raw / 157.92 kB gzip; entry CSS 299.56 kB against the 300 kB limit.
- `npm run check:active-work` and `git diff --check`: passed.
- Full Vitest suite: 1,785 passed, 1 failed. The unchanged `server/publicSolutionSpool.test.ts` write-permission test assumes UID 0 can write into a mode-0500 directory. This sandbox reports UID 0 without that permission, so it expects `true` and receives `false`. Source/test files in that area are unchanged. Missing sparse-checkout assets and the local PDF-renderer path were restored before this result.

Reproduce with a production build and installed Playwright Chromium:

```sh
npm run build
node scripts/qa/portal-theme-browser.mjs
```

For an existing Chromium executable, set `PORTAL_QA_CHROMIUM_PATH`. This run used a local Chromium executable via that override and intercepted requests to serve the build from disk.

## Critique and concurrency

Reviewed mobile and desktop Black/Light settings, Black Maximum, account/command menus and mobile sign-in in context. Cards, controls and selected swatches remain distinct against the pure-black canvas; mobile controls fit without clipping. Keyboard focus is visible. Light sign-in uses the primary logo. No layout/content/auth-flow rewrite was required.

Before PR, `origin/main` remained at the base SHA. All 14 open PR head SHAs were unchanged from the pre-edit audit. PR #553 overlaps `PortalLayout.tsx` and `PortalUserMenu.tsx`: preserve its agreement-gate logic, tour entry/mounts and sign-out work when integrating these focused appearance changes. This branch does not modify those behaviors. Issue #544 retains the broader visual audit; #577 owns this explicitly assigned appearance slice. The YAML mirror is left untouched because open governance/coordination PRs also edit it; #577 is the authoritative claim.

## DE handoff

Implemented and locally verified; ready for integration review. Not merged, deployed or marked LIVE. Claude Code remains the integration authority under repository governance. After integration, verify authenticated Settings, saved preferences and portalled menus in production, then update the active claim/ledger.

USAGE SIGNALS: ChatGPT/Codex (GPT-6 family); prior usage limit interrupted the initial inspection, and Joe's “Continue” resumed the same slice. Runtime workarounds used a local Chromium executable and request interception; no repository dependency changes or sub-agents were used.
