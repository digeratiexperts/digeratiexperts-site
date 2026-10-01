# DE Desk reliability follow-up

Maintenance Mode. **Partial; draft review only.** No merge, deployment, production credential change, database change, or real ticket action performed.

## Implementation and preservation

- Ticket submissions require explicit success and a nonempty Zoho ticket ID. Malformed responses and plain-text rate limits retain the visitor's draft. A synchronous guard prevents duplicate in-flight submissions; form fields and issue chips cannot replace a draft while it is being sent.
- Availability is checked only when Get Support opens. The notice uses the existing white Desk surface and canonical telephone link. Existing login, authentication synchronization, navigation, and other Desk tabs are preserved.
- The public ticket boundary validates types and lengths. The separate support form's `Critical` priority maps to Desk `Urgent`. Missing ticket numbers use the real Zoho ID instead of an invented reference.
- Cached failed health probes retain HTTP 503 and `Cache-Control: no-store`; concurrent probes share one provider request. Desk token refresh failures have a 15-second cooldown. OAuth requests are bounded at 10 seconds and Desk requests at 15 seconds. Writes are not automatically replayed.
- Malformed OAuth responses fail closed; readiness expires with the access token. Provider failure logs no longer include arbitrary response text. Department lookup preserves the original authentication/transport error for classification. The redundant error mapper introduced by #290 is consolidated into the existing route classifier.

## Concurrency report

Joe authorized takeover of #290. Another lane subsequently reconciled and merged it at `3b90e35c7ff7c5b822f9cf471361b0efaddaf450`; this branch does not overwrite that PR or its branch. Local preservation checkpoint: `1c697591`. Reconciliation checkpoint: `1af0f3dc`. Verified implementation head: `27ee75fa3df9efa4ecfd041d2d6414d16216f357`.

Current validation base: `7f4cff10b00fbe3e55279989c605b16794363460`. Commits landing on main since the initial base `d211287a`, in first-parent order: `c8d9178b`, `83fb0531`, `67343aa9`, `db4ff9a1`, `7528bd8b`, `f41854e4`, `c2ab6167`, `e02ed7d8`, `1a9ac269`, `cc84f55e`, `0b15a8bf`, `9e41e92d`, `74535d76`, `3b90e35c`, `edc5e280`, `62771762`, `c5fb5fe1`, `f202cc23`, `7f4cff10`.

Compared overlapping hunks rather than taking whole files: retained #187 cookie-based auth and login work in ZohoASAPWidget, #290 typed OAuth handling and axios 1.20.0, and #299 security changes in routes. Preserved all newer unrelated main work, including #292 preview and #301 fonts. The exact implementation diff against this base is restricted to the 12 files below. Open PRs #298, #297, #295, #294, #293, #280 were checked and none overlap these implementation files. Issue #291 remains the authoritative active ownership claim; the YAML record is its mirror.

## Validation

Each command has its own result/log under local `artifacts/validation/de-desk-repair/` in this worktree. Raw logs are intentionally not committed.

| Command | Verified result |
| --- | --- |
| `npm ci --ignore-scripts --no-audit --no-fund` | PASS, exit 0 |
| `npm run check` | PASS, exit 0 |
| `npm test` | FAIL, exit 1; 123/130 files and 674/686 tests passed |
| Desk tests within that full run | PASS: route 28, OAuth client 12, response parser 9, Desk service 3 (52 total) |
| `npm run test:advisor` | PASS, exit 0; 47 tests |
| `npm run test:msp-ai-kit` | PASS, exit 0 |
| `npm run check:active-work` | PASS before mirror addition; rechecked after addition |
| `npm run build` | PASS, exit 0 |
| `node scripts/check-bundle-budget.mjs` | PASS; entry 454.31 kB / 1120 kB; gzip 126.96 kB / 330 kB; CSS 296 kB / 300 kB |
| `npm audit --omit=dev --audit-level=high` | PASS threshold, exit 0; 1 low and 10 moderate advisories remain |
| `git diff origin/main --check` | PASS for this follow-up diff |

Failure triage command (installed Git Bash added to this process's PATH):

```text
npx vitest run scripts/deployScripts.test.ts shared/publicPhone.test.ts server/portalAuthFailClosed.test.ts server/portalAuthStore.bootstrap.test.ts server/stagingReviewGuard.test.ts client/src/lib/brandRuntime.test.ts client/src/components/store/door2/door2Tokens.test.ts --maxWorkers=1
```

Result: 29/31 tests passed; two failures remain. `server/portalAuthFailClosed.test.ts` first test exceeds its 5000 ms timeout while importing the application. `client/src/components/store/door2/door2Tokens.test.ts` expects LF in its literal regex but reads CRLF CSS on Windows. The missing Bash failure, other timeouts, and subsequent mock error did not recur in this targeted run. These tests and the Store stylesheet are unchanged from main. This is evidence of environmental sensitivity, not proof the full suite is green. No speculative changes to unrelated authentication or Store code were made. Two-failure stop applies: investigate with the Linux CI result before any further local retries.

## Rendered QA and production gaps

The existing production white Desk support panel was inspected at desktop size before changes. **Post-change 390 / 768 / 1440 screenshots, interactive success/error flows, and accessibility checks remain UNVERIFIED.** No screenshot evidence files were captured for this repair.

Browser checkpoint: normal accessibility/locator clicks did not open the expected control; another attempt reported `No node found at given location`. Coordinate input under a viewport override reached an unrelated assessment popup. A supported DOM click opened the production support view, but local DOM snapshot/control subsequently stalled for approximately 598 seconds without reaching the form. Suspected cause: browser control/viewport targeting state, not established as an application defect. Stopped speculative retries. Next investigation: compare supported hit testing and the accessibility tree in a fresh local preview, then complete the three-width and keyboard/error/success checks using mocked provider responses. Do not submit a real ticket for QA without authorization.

Live OAuth recovery is not established by these changes. The earlier production probe returned 503 on release `d211287a`; that observation predates later merges and is not a current production assertion. Production credentials were not read or changed. Portal mirror durability remains tracked by #248 and is outside this repair.

## DE handoff

```text
REPO: digeratiexperts/digeratiexperts-site
BRANCH: codex/de-desk-repair
BASE SHA / HEAD SHA: 7f4cff10b00fbe3e55279989c605b16794363460 / 27ee75fa3df9efa4ecfd041d2d6414d16216f357 (validated implementation; later commits are reporting only)
OBJECTIVE: Reliable website Desk ticket submission and bounded OAuth/provider failure handling.
CURRENT STATE: partial — implementation verified in focused tests; broader and rendered gates remain.
WHAT CHANGED: strict contracts; draft/in-flight protection; availability notice; probe/refresh coalescing and bounds; safe errors.
FILES CHANGED: client/src/components/ZohoASAPWidget.tsx; client/src/lib/deskTicketResponse{,.test}.ts; shared/deskTicket.ts; server/widgetTicketRoute{,.test}.ts; server/widgetTicketFailure{,.test}.ts (removed); server/zoho/zohoClient.ts; server/zoho/zohoClient.desk.test.ts; server/zoho/zohoDesk.ts; server/routes.ts (unused import); coordination mirror and this handoff.
TESTS / CHECKS RUN: exact commands and results in Validation above; full suite not green locally.
EVIDENCE: C:\Users\Joe\.codex\worktrees\de-desk-repair\digeratiexperts-site\artifacts\validation\de-desk-repair\
QA (UI slices): 390 / 768 / 1440 / a11y — unverified after changes.
REMAINING ISSUE: two local non-Desk test failures; browser verification blocked; live OAuth/ticket creation unverified.
BLOCKERS (JOE): integration/release authority; credential recovery only if current production still fails.
EXACT NEXT ACTION: inspect the follow-up draft's Linux CI, then recover supported browser verification against a local preview.
DO-NOT-REPEAT: do not overwrite merged PR290; do not repeat the passing typecheck/build/52 Desk tests without a relevant change.
KNOWN BAD APPROACHES: concurrent full suite hit timeouts; one-worker triage still timed out on cold auth import and failed on Store CRLF; browser clicks misdirected and local snapshot stalled. Stop speculative retries.
PRODUCTION STATUS: follow-up not merged or deployed; no current LIVE claim.
PR / LINKS: https://github.com/digeratiexperts/digeratiexperts-site/issues/291 ; https://github.com/digeratiexperts/digeratiexperts-site/pull/290 (already merged externally).
USAGE SIGNALS: prior usage-limit interruption; resumed without changing ownership boundaries. Runtime model identifier unavailable in tools. No subagents. Browser rescue remains necessary; managed worktree writes required sandbox escalation.
```
