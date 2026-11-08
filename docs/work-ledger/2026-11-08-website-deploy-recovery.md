# Website deploy restart recovery

- Date: 2026-11-08
- Who: ChatGPT / Codex delegated website reliability lane; parent coordinates integration/release; independent native review
- Repo: `digeratiexperts/digeratiexperts-site`
- Owns: explicit follow-up on issue [#990](https://github.com/digeratiexperts/digeratiexperts-site/issues/990); branch `chatgpt/website-deploy-recovery-20261108`, base `855098371b33f5d6ae9e66e3cfab94be5587b4ac`. `deploy/vps/deploy.sh` initial restart/health guard only; `scripts/deployScripts.rollback.test.ts`; this record. Separate from OpenAI draft #991, whose source/head is preserved. Fresh active issues, every website/Hub open PR head and file list, relevant remote refs and YAML checked; no active overlap. Historical spool/Turnstile claims are verified-live.
- Work: a failed initial systemd restart or inactive service previously exited after switching `current`, before the rollback block. Require restart and health/release verification in one conditional so either failure attempts the existing prior-release recovery. Recovery still exits deployment nonzero; unsuccessful recovery and missing prior release remain explicit failures. No changes to setup, secrets, permissions, migrations, deployment workflow, AI controls or startup defaults.
- Status: implemented and independently reviewed; preparing a separate draft PR. No merge or deployment. Parent retains integration/release coordination.

## Verification

The executable regression runs the actual activation/restart/health/rollback section with a cleared environment, synthetic release directories and mocked service/HTTP/wait functions. It never runs the full deploy, sources a configured environment, accesses a database, starts/stops a service or calls a provider. Ten cases cover success, failed initial restart, inactive service, local/public health failures, release mismatch, failed rollback restart/health, missing prior release and legacy prior release without a marker. Before the guard change: 5 failures / 5 passes, including the missing recovery and diagnostic. The same assertions must pass after the change. Existing deployment/Turnstile tests remain intact.

After the guard change: all 10 regressions plus all 8 existing deployment tests pass (18/18). Independent native review found no blocking findings and separately ran the same 18 tests successfully. Typecheck, Bash syntax, whitespace and the 170-claim registry validator pass. The normal production build passes; its first attempt failed because the inherited npm cache path was unavailable, then passed unchanged with a disposable writable cache. No dependency, prebuild or configuration was changed. Local Node is 24; normal CI uses Node 22. The full-suite and exact-head workflow results are recorded in the PR/evidence handoff rather than inferred from focused checks. Local evidence: `/workspace/artifacts/website-deploy-recovery-20261108/`.

## Release limits

This is a code repair, not production acceptance. GitHub invokes the already-installed `/home/digeratiexperts.com/current/deploy/vps/deploy.sh`; changing source does not protect this repair's own first deployment automatically. Parent/operations must separately accept the initial promotion/recovery procedure. No SSH, live service, production DB, credentials/settings, AI activation, provider call, merge, ready conversion or deployment occurred. #124/#960 governance/protection and operational holds remain unchanged, as does #991's process-only state limitation. The earlier permission-blocked protection read was not retried. Only the specifically approved single #990 issue-update retry was performed, succeeded and read-back verified before implementation.

The canonical Hub ledger is maintained separately in `Intelligence-Hub/docs/work-ledger/`; the parent can record this handoff there through the existing integration owner without editing another owner's branch.
