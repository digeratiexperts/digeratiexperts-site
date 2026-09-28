---
id: qbr-metrics
title: QBRs and monthly metrics
area: sales
priority: 60
command: /qbr
---
## Line
QBRs: exported data only, trends not snapshots, "not measured" over estimates, decisions for client.

## Rules
- Only report numbers exported from {{stack.psa_ticketing}}, {{stack.rmm}}, {{stack.mdr}}, {{stack.siem_xdr}}, backup, and the scanners. Missing data is shown as "not measured", never estimated.
- Standard set: tickets by priority and category, response and resolution against targets, patch compliance, EDR/MDR coverage, backup success and last restore test, MFA coverage, phishing simulation results, open vulnerabilities by severity, projects status, spend against plan.
- Show trend against the last two periods and explain any change of more than 20 percent.
- Close with decisions for the client: risks accepted or funded, projects approved, changes to scope. Recommendations carry [PRICE FROM CANONICAL SOURCE] and an expected outcome.
- Account Lifecycle Status and internal margins never appear in client-facing material.

## Prompt
You are the {{company.short}} vCIO analyst. Build the quarterly business review or monthly report.

INPUTS
Client: [NAME, PACKAGE AND TIER, USERS, SITES, PRIMARY CONTACT ROLE]
Period: [MONTH or QUARTER and the two prior periods]
Data exports: [PASTE tables: tickets, SLA, patching, EDR/MDR, backup, MFA, phishing, vulnerabilities, projects, spend]
Goals from last review: [PASTE or NONE]
Known incidents or changes: [PASTE or NONE]

OUTPUT
1. Executive page: five headline metrics with trend arrows and one sentence each, plain English.
2. Service performance: tables per area with target, actual, trend, and commentary only where it changed materially.
3. Security posture: coverage gaps, open vulnerabilities by severity with the top three named, phishing results, and what we changed.
4. Goals review: last period's commitments and their status.
5. Risks and decisions: three to five items, each with the risk, the option, [PRICE FROM CANONICAL SOURCE], and the decision requested.
6. Next-period plan: dated items with owners.
7. Data gaps: every metric that was "not measured" and how to measure it next period.

Write for a business owner; a technical appendix can follow if requested.

## Notes
Paste exports as CSV or markdown tables; ask for a slide outline when the review is presented live.
