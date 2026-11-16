# Desk crisis browser privacy
- **Date (UTC):** 2026-11-15
- **Who:** ChatGPT / Codex on DESKTOP-O52DFPD
- **Repo:** digeratiexperts-site
- **Owns:** `chatgpt/desk-crisis-browser-privacy-20261115`; `client/src/lib/deskChatSession.ts`, its tests, this ledger and narrow YAML mirror; relay https://github.com/digeratiexperts/Intelligence-Hub/issues/886#issuecomment-6892642434
- **Did / state:** Implemented crisis redaction on browser storage writes/legacy reads and exclusion from ticket drafts from main `f1fba01eee4af6432ee36e71f7ba2a58360b5637`; main unchanged at pre-PR refresh. Independent read-only review passed with 109/109 focused tests. Held DRAFT PR delivery only; production unchanged.
- **Status:** handed off for held draft PR review; no merge/deploy authorization

## Change and preservation

- Reuses shared `isCrisisMessage` and `CRISIS_HISTORY_PLACEHOLDER` for user content at the storage boundary. Live message input and deterministic server resource response are preserved.
- Legacy restore removes the unsafe entry before sanitized rewrite, retaining the original `savedAt` and expiry. A failed rewrite cannot leave the removed legacy entry behind.
- Ticket drafts omit both raw detected crisis content and placeholders. Ordinary IT conversation, session ID, message cap, card filtering and resource replies are preserved.
- No exact repair ownership found after inspecting relay, open issues, all open PR file lists, remote branches, ledger and dirty site worktrees. Widget PR owners #1015/#1017/#1022/#1034 are untouched. Isolated worktree: `I:\DE\Worktrees\site-desk-crisis-browser-privacy`.
- Storage category: automatic tab-history persistence only; no provisioning/backup policy or manual file move is changed.

## Verification

- Red: all seven new privacy tests failed meaningfully before implementation (12 existing tests passed).
- Focused: `vitest run client/src/lib/deskChatSession.test.ts shared/deskCrisis.test.ts client/src/lib/deskActions.test.ts shared/pciGuard.test.ts` passed 109/109; independently repeated by read-only reviewer `/root/privacy_review`.
- `npm run check` passed. No separate lint script is configured; `git diff --check` passed.
- `npm run test:advisor` passed 83/83. Initial sandbox loopback errors resolved with authorized local execution.
- Aggregate `vitest run`: 373 files passed, 5 failed, 1 skipped; 2780 tests passed, 4 failed, 19 skipped. Failures: missing `openssl` in msGraphCert setup; timeout in publicPhone scan, two noDirectTokenCalls scans, location visual navigation and portal visual teardown. All five files rechecked serially with installed Git OpenSSL on PATH: 5 files / 16 tests passed. Full aggregate was not rerun a second time; source did not change between aggregate and recheck.
- `npm run build` passed including 106/106 prerender pages; existing bundle-size warning remains.
- `npm run check:active-work` passed 176 claims with an existing stale-claim advisory. `npm run check:sample-data` exited 0 in report-only mode with 18 existing findings; unrelated records preserved.
- Browser: synthetic legacy storage, new send, fixed resource reply, reload and ticket conversion passed at 390/768/1440 with zero page errors. External network was blocked and every API call stubbed; no real visitor storage/messages or live model calls were inspected. Screenshots reviewed: readable unchanged black/gold Desk, safe draft containing only Outlook text at all three widths.
- Local evidence: `C:\Users\Joe\AppData\Local\Temp\desk-privacy-*.log`; browser script `desk-privacy-browser.mjs`, screenshots/results under `desk-privacy-browser\` in the same temp directory. No screenshot fixtures committed.

## Checkpoint and next step

Implementation isolation/red/proof and independent review passed for this scoped draft. Shipping scope is only the user's explicit request: commit as digeratiexperts <53747291+digeratiexperts@users.noreply.github.com>, push this isolated branch from this desktop, open a held DRAFT PR. No merge, deployment, migration, email, credential change, paid/live model API, D: access, deletion of old checkouts, force-push or worktree cleanup.

Next / upcoming task: review exact PR head and CI, preserve hold, then hand to the authorized release coordinator. No production readiness claim. Rollback after any separately authorized integration: revert the repair commit; no schema/config migration. Existing live raw text remains in transient UI memory until reload as before, but cannot enter storage or chat-derived ticket drafts. Detector coverage remains the shared deterministic detector's scope.

USAGE SIGNALS: Codex host model (no paid API calls or provider changes); one read-only independent review agent; no limit hit or manual rescue.