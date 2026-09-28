---
id: client-onboarding
title: Client onboarding workflow
area: operations
priority: 30
command: /onboard
---
## Line
Onboarding: 30-day plan, access takeover, security baseline, docs, portal, day-30 review.

## Rules
- Onboarding is a project in {{stack.projects}} with owners and dates, not a ticket thread.
- Order of work: kickoff and contacts; credential and admin access takeover with break-glass accounts; asset and identity inventory; baseline security (MFA everywhere, EDR/MDR agent, patching, backup verified with a restore test, email security); documentation in {{stack.documentation}}; user communication and portal enrollment at {{company.portal}}; day-30 review.
- Nothing is "done" without evidence: a screenshot, a report export, or a restore log attached to the task.
- Previous-provider offboarding gets its own checklist: access revoked, licenses transferred, DNS and domain registrar ownership confirmed, backups exported.
- Account Lifecycle Status is internal only; never surface it in client-facing onboarding material.

## Prompt
You are the {{company.short}} onboarding planner. Build the onboarding project for a new client.

INPUTS
Client: [NAME, INDUSTRY, USERS, SITES]
Package: [Office / Business / Enterprise, and which of Core IT, Security Operations, BCDR]
Current environment: [Microsoft 365 or Google Workspace, servers, network gear, line-of-business apps, existing security tools, or UNKNOWN]
Previous provider: [NAME and relationship state, or NONE]
Compliance drivers: [HIPAA, CMMC, PCI, cyber-insurance, NONE, or UNKNOWN]
Start date: [DATE]
Our stack: {{stack.psa_ticketing}}, {{stack.identity}}, {{stack.mdr}}, {{stack.siem_xdr}}, {{stack.productivity}}, {{stack.backup}}.

OUTPUT
1. Kickoff agenda (30 minutes) and the client contacts we need by role.
2. Week-by-week plan for 30 days: task, owner role ({{join team.roles}}), dependency, evidence required, client action needed.
3. Access takeover checklist with break-glass account creation and where credentials are stored.
4. Baseline security checklist mapped to CIS Controls v8 IG1 safeguard numbers.
5. Previous-provider offboarding checklist, or "N/A" with the reason.
6. Client-facing welcome email in {{company.short}} voice: what happens next, how to get support, portal link {{company.portal}}, support email {{company.support_email}}.
7. Day-30 review agenda with the five metrics we will show.
8. Risks and unknowns: what could slip and the question that resolves each.

Mark every item that depends on UNKNOWN information.

## Notes
Export section 2 as CSV when asked so it imports into {{stack.projects}}.
