# Portal OpenAI control reliability

- Date: 2026-11-07
- Who: ChatGPT / Codex, delegated Portal reliability owner; independent native Codex review
- Repo: digeratiexperts/digeratiexperts-site
- Owns: issue [#990](https://github.com/digeratiexperts/digeratiexperts-site/issues/990); branch `chatgpt/portal-openai-control-20261107`, from `855098371b33f5d6ae9e66e3cfab94be5587b4ac`. `AdminOpenAI.tsx` and browser tests; OpenAI-only route registration in `server/routes.ts`; new `server/portalOpenAIRoutes.ts` and HTTP tests; `server/services/openai-config.ts` and tests; `server/openaiService.ts` and mocked SDK tests; shared safe response schema. Other owners' source/history preserved. The parent coordinates integration; this slice has no independent merge/deploy authority.
- Work: repair the mismatched admin status contract, missing enable/disable routes, no-op toggle and unguarded provider calls. Explicit desired-state operations share canonical state and return no credentials or arbitrary endpoint URLs. Every SDK constructor injects a dispatch guard, including retained clients, retries and direct-key speech. Disabled entry points make zero provider requests. Auth/admin guards remain; writes require JSON, the non-simple control header and same Origin when supplied, and reject cross-site Fetch Metadata. The page validates status and mutation receipts, locks unknown/pending states, and exposes safe errors. Existing Portal shell, navigation and styles are preserved.
- Status: implemented, independently reviewed and locally verified; draft publication pending. No merge, deployment or live setting change.

The Hub's canonical ledger is maintained separately in `Intelligence-Hub/docs/work-ledger/`; this website-local record accompanies the code review and is a ready handoff for the parent to record there without editing another owner's Hub branch.

## Persistence and release boundary

The existing runtime startup rule is preserved: literal `false` or `0` in `ENABLE_OPENAI_INTEGRATION` disables; other values, including unset, permit calls when a provider credential exists. Startup does not enable anything beyond the pre-existing rule. Admin changes affect memory in **this process only**. They do not write environment variables or database state and do not survive restart; other processes are unaffected. The UI and status expose this and the startup state. Requests already dispatched may finish and incur charges.

This repairs enforcement of an already configured disable as well as runtime controls. A release must assess that behavior explicitly. Durable/fleet-wide disablement, actual environment changes, provider activation, credentials, spend settings and any live test are separate operator actions. None was performed in this slice.

## Verification evidence

All runtime tests use synthetic credentials, loopback HTTP and mocked provider transport. No live OpenAI, TTS, email or other paid request was used. No configured database or production record was accessed.

- Before: 3 request-level route contract failures (nested state and missing enable/disable), 11 configuration/dispatch failures and a rendered UI persistence-disclosure failure.
- Focused after: 31 tests passed: shared state, real SDK with fake transport, HTTP with actual auth/admin guards, and Chromium UI contracts at 390/768/1440.
- Independent review: no blocking findings; separately ran 23 server tests and inspected all three rendered widths. It traced all current SDK constructors and provider call sites. Reviewed production source fingerprints are preserved in the local review report.
- Typecheck: passed. Final full suite: **342 files passed; 2,483 tests passed, one existing skip**.
- Ordinary build: initially blocked by an unwritable npm cache; passed on rerun using a disposable `/tmp` npm cache, with the normal integrity-pinned PDF.js prebuild hook intact.
- First full run: 341 files passed; only 3 new Chromium cases exceeded the default five-second unit budget while build/full tests ran concurrently. The fixture now uses the same fifteen-second budget as the existing EventSession browser tests; no assertion or production source changed.
- Built browser bundle: real control-route module plus synthetic identity/other APIs at 390/768/1440; keyboard disable, backend state readback and re-enable passed. No overflow or page errors. Provider traffic blocked; no full-app boot, DB or live authorization claim.
- Active-work validator: 170 claims valid; whitespace check passed.

Local evidence: `/tmp/portal-openai-evidence/` (red/green logs, before/after actual PortalLayout screenshots, independent review). These local paths are evidence locations, not a production verification claim. No storage provisioning path is changed.
