# Production health check every 3 hours (2026-11-23)
Owner: Claude Code (cloud thread). Branch: claude/health-every-3h.
Scope: `.github/workflows/production-health.yml` only, plus this row.
Authority: Joe, 2026-11-22: "Exactly don't let it get high on GitHub anymore. Ever." Interval chosen by the coordinator session on Joe's delegation; merge still needs Joe's yes.
Relay: https://github.com/digeratiexperts/Intelligence-Hub/issues/886

Implemented: cron "17 * * * *" to "17 */3 * * *"; a 10-minute job limit (none before, so a hang could run 6 hours). The old schedule is kept in the workflow comments.
Finding: this repository is public, so GitHub does not bill its standard hosted runners; the check likely costs nothing from the free 2,000 minutes today. The change only matters if the repository goes private again.
Checks: workflow YAML parses. The probe's own steps are unchanged.
Status: draft PR, waiting on Joe's yes.
