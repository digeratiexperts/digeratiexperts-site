# GA4 measurement and private-document isolation

Status: implemented on an isolated branch; pending integration and production verification. No merge or deployment is authorized by this work. Tracking measurements from production are intentionally not copied into this public repository.

## Resulting behavior

- HTML supplies a denied-by-default Google consent queue only. Google loads once, after analytics consent and actual public-page metadata readiness. Automatic initial pageviews are disabled.
- `useSEO` and `AnalyticsHelmet` report readiness with the destination path/title. A page's loading fallback must disappear before its single manual pageview is emitted. A MutationObserver handles Helmet's documented render/commit timing; route changes disconnect and invalidate old observers. No timing delay is used to guess readiness.
- Public pathname changes, including back/forward, start a new visit. Query/hash-only changes do not create additional pageviews. Redirects do not inherit the preceding page's title. GA destination context is updated without automatic views so later engagement events follow the current public page.
- Manual GA payloads omit query strings/fragments and private referrers. Only consented engagement events from the current pending visit wait for metadata; navigation or revocation discards that buffer. Denied events are not replayed.
- Consent grants count only the current ready public page. Revoking either consent category reloads the document after saving reduced consent because previously loaded third-party SDKs cannot all be reliably unloaded. Legacy consent remains supported; malformed/non-boolean values fail closed.
- Portal hosts/paths/auth aliases, staff internal paths, the authorized-only Networking Planner and the standalone challenger preview exclude analytics SDK initialization and explicit event sinks. Crossing between public and excluded contexts uses a full document navigation before history mutation. Legacy cross-context popstate/BFCache restoration disables GA, stops later event listeners, reloads and prevents the destination router from rendering in the wrong document.
- Repeated metadata effects do not duplicate explicit GA or Meta pageviews. Meta's initial PageView is owned by the ready-page reporter instead of also firing at SDK initialization. Bing's separate vendor behavior is not claimed as GA verification.

## Configuration action already completed

On October 28, 2026 the authorized GA4 operator session confirmed that the website's measurement ID matched the property and that Enhanced Measurement's **Page changes based on browser history events** was enabled. It was turned **off**, saved, and reopened to verify persistence. Other Enhanced Measurement switches were preserved. This removes a separate automatic producer; deployed HTML still needs the code correction for its automatic initial view.

The website stream's display URL uses the historical hyphenated domain. It was observed, not changed; that display value does not by itself establish which hostnames contributed events.

## Regression and browser verification

Run:

```bash
npm ci --no-audit --no-fund
npm test -- client/src/lib/analyticsPortal.test.ts client/src/lib/analyticsTracking.test.ts client/src/lib/analyticsNavigation.test.ts
npm run check
npm run build
GA4_START_PREVIEW=1 BASE_URL=http://127.0.0.1:4317 node scripts/ga4-browser-smoke.mjs
```

Install the repository's supported Playwright Chromium first. `BROWSER_EXECUTABLE_PATH` optionally selects an already-installed Chromium. The optional preview launcher keeps the test browser and server in the same network namespace. To exercise optional SDK exclusions, build the isolated test output with non-production QA identifiers:

```bash
VITE_CLARITY_ID=qa-clarity VITE_LINKEDIN_PARTNER_ID=qa-linkedin VITE_META_PIXEL_ID=qa-meta VITE_BING_UET_TAG_ID=qa-bing npm run build
```

Do not deploy this synthetic test output; normal CI must build using the actual deployment environment. No dependency or lockfile changes were made for local browser tooling.

The browser harness intercepts external vendor responses and prevents telemetry from leaving the test browser. It verifies the actual rendered application, queued commands, script-loading requests and navigation boundaries. It does **not** execute Google/Meta/Clarity/LinkedIn/Bing SDKs or verify Google's receipt. It covers initial consent, grant after navigation, SPA/back/forward/reload, slow lazy-page reveal, Helmet-only pages, portal/auth/staff entry paths and hostname, full-document crossings, marketing-only consent and 404 attribution. Public screenshots at 390/768/1440 are synthetic local QA evidence.

The full-suite spool permission test at `server/publicSolutionSpool.test.ts:127` fails in this sandbox because UID 0 does not bypass filesystem permissions here. The same test fails on unchanged base main. Its source was not modified. This is a disclosed baseline failure, not a green full-suite claim; CI remains a merge gate.

## Historical 404 follow-through

The authorized report inspection identified concept/version/preview-artifact paths. Some remain genuine unknown URLs; some are working or redirected routes today and may have inherited a stale 404 title or behaved differently in the reporting period. Exact unknown-path literals were not found in current public link sources. Public HTTP results are in `artifacts/qa/ga4-20261028/404-http.json`.

No speculative redirect or route deletion was added. Historical referrer/preceding-page and origin-log evidence is still required to establish whether any historical request came from a broken internal link. Original emailed totals and the subsequently queried UI totals differ; this work does not claim that changing settings rewrites historical counts.

## Concurrency and review

- Task: GitHub issue #859; owner ChatGPT/Codex; website integration authority remains the designated integrator.
- Branch base: `aac46811dc53230914c70881dde449215b74b3b4`. Main was re-fetched during verification and had not moved.
- Only open PR at the start was #858, affecting Zoho Help Center files.
- The apparently overlapping typography claim was reconciled through Git history: `claude/design-basics-20261024` is an ancestor of main, its unique diff is empty, and PR #827 merged as `cbd98752`. Existing font/typography changes are preserved; HTML changes here concern tracking only.
- No changes to another agent's branch, portal authorization, pricing, database schemas, secrets or deployment configuration.
- Independent read-only review found the Networking Planner exclusion gap; it was corrected and covered. Browser integration found the Helmet/Suspense race; the observer repair is covered by unit and browser regressions. Both repairs were re-reviewed with no new actionable findings.

## Release and rollback gate

Before merge, reconcile main again and require the applicable CI/security gates. Review must include the private-context matrix with real configured SDKs in an isolated test property/environment and an authorized test tenant, not real client data. Confirm zero vendor scripts/transmissions on excluded documents and no private titles/paths/query data after public-to-private navigation or back/forward. Local interception tests do not replace this check.

After separately authorized deployment, verify release identity and live HTML, then use Tag Assistant/DebugView and decoded collection payloads to confirm one `page_view` per completed consented public visit with correct location/title/referrer. Count event payloads, including batched POST bodies, rather than HTTP request count. Confirm revocation/regrant and real SDK behavior. Annotate the release/config-change time and compare subsequent duplicate-pair rates without dividing historical figures by two.

If a rollback restores automatic/config-generated pageviews, reassess the GA4 history toggle before changing it; do not blindly re-enable duplicate tracking. Maintain portal exclusions as a release invariant.

## DE handoff / checkpoint

Implementation proof and independent change review are recorded in this PR's validation. Next required event: designated integrator review and CI, then separate merge/deployment authorization and real production collection verification. Current state is not LIVE. No production code or private-client data was changed.

USAGE SIGNALS: Codex session; one read-only review agent, independently verified by the parent. Local browser setup required an alternate Chromium package because the standard browser download was truncated; tooling was installed outside the repository. The baseline UID/filesystem permission mismatch remains disclosed. No manual rescue of source code was required.
