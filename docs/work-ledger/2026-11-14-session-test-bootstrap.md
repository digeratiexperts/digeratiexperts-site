# Session-revocation test fixture startup

- Date: 2026-11-14
- Who: Codex / ChatGPT
- Repo: digeratiexperts-site
- Owns: issue [1038](https://github.com/digeratiexperts/digeratiexperts-site/issues/1038), branch `codex/fix-session-test-bootstrap-20261114`, `server/portalSessionRevocation.test.ts`; this task's claim and record only.
- Status: in-review; merge and deployment remain with the lead integrator and Joe.
- Work: preload server routes and validate lookup mocks in a bounded setup hook. Preserve all behavior assertions and their five-second test timeout; production code is unchanged.
- Evidence: the same two failures reproduced on historical main `fe69f3b6` and PR head `06ccb18e`. The isolated repair passed all 10 session tests and 37 related tests. Current-main validation and complete PR CI are recorded in the pull request.
- Starting main: `bf4ffdd616ab5f4a767a80be4f234a1d12b0f56c`.
- Concurrency: 24 open PR heads/file lists and active issues checked; no PR owns this test file. Other portal work is preserved.
- Delivery scope: separate branch, review, and CI. No merge, deployment, production data, credential, or app-permission changes.
