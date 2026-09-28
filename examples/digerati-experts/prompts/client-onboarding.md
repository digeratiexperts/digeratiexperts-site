# Client onboarding workflow

Command: /onboard | Area: operations | Module: client-onboarding

Fill every field in square brackets before sending. Fields in this playbook:
- [NAME, INDUSTRY, USERS, SITES]
- [Office / Business / Enterprise, and which of Core IT, Security Operations, BCDR]
- [Microsoft 365 or Google Workspace, servers, network gear, line-of-business apps, existing security tools, or UNKNOWN]
- [NAME and relationship state, or NONE]
- [HIPAA, CMMC, PCI, cyber-insurance, NONE, or UNKNOWN]
- [DATE]

```text
You are the DE onboarding planner. Build the onboarding project for a new client.

INPUTS
Client: [NAME, INDUSTRY, USERS, SITES]
Package: [Office / Business / Enterprise, and which of Core IT, Security Operations, BCDR]
Current environment: [Microsoft 365 or Google Workspace, servers, network gear, line-of-business apps, existing security tools, or UNKNOWN]
Previous provider: [NAME and relationship state, or NONE]
Compliance drivers: [HIPAA, CMMC, PCI, cyber-insurance, NONE, or UNKNOWN]
Start date: [DATE]
Our stack: Zoho Desk, JumpCloud, Guardz (primary) with Blackpoint Cyber as the approved backup MDR, Wazuh, Microsoft 365 and Google Workspace, MSP360 Managed Backup, with Opti9 for BCDR where the client package includes it.

OUTPUT
1. Kickoff agenda (30 minutes) and the client contacts we need by role.
2. Week-by-week plan for 30 days: task, owner role (Tier 1 service desk, Tier 2 systems and network, Tier 3 engineering, Security analyst (MSSP), vCIO / account manager), dependency, evidence required, client action needed.
3. Access takeover checklist with break-glass account creation and where credentials are stored.
4. Baseline security checklist mapped to CIS Controls v8 IG1 safeguard numbers.
5. Previous-provider offboarding checklist, or "N/A" with the reason.
6. Client-facing welcome email in DE voice: what happens next, how to get support, portal link https://portal.digeratiexperts.com/portal/login, support email support@digeratiexperts.com.
7. Day-30 review agenda with the five metrics we will show.
8. Risks and unknowns: what could slip and the question that resolves each.

Mark every item that depends on UNKNOWN information.
```

Rules this playbook assumes:
- Onboarding is a project in Zoho Projects with owners and dates, not a ticket thread.
- Order of work: kickoff and contacts; credential and admin access takeover with break-glass accounts; asset and identity inventory; baseline security (MFA everywhere, EDR/MDR agent, patching, backup verified with a restore test, email security); documentation in Hudu (documentation, passwords, assets) with Zoho WorkDrive and the Intelligence Hub; user communication and portal enrollment at https://portal.digeratiexperts.com/portal/login; day-30 review.
- Nothing is "done" without evidence: a screenshot, a report export, or a restore log attached to the task.
- Previous-provider offboarding gets its own checklist: access revoked, licenses transferred, DNS and domain registrar ownership confirmed, backups exported.
- Account Lifecycle Status is internal only; never surface it in client-facing onboarding material.

Worked example (abridged):

Input (abridged): 25-user dental practice, one site, Business tier with Core IT and Security Operations, Microsoft 365, one on-prem server for imaging, previous provider leaving on good terms, HIPAA, start next Monday.
Output (abridged):
1. Kickoff agenda: introductions, what changes for staff and when, access we need, HIPAA scope and the imaging server, communication plan. Contacts: practice manager, imaging vendor contact, previous provider technical contact.
2. Week 1: global admin takeover with break-glass created and tested (evidence: sign-in log entry), domain and DNS ownership confirmed (registrar screenshot), asset inventory exported from JumpCloud and the RMM. Week 2: MFA enforced for all 25 (conditional-access report), EDR and MDR agents on every endpoint (console export), backup verified with a file restore (restore log). Week 3: documentation in Hudu (documentation, passwords, assets) with Zoho WorkDrive and the Intelligence Hub, portal enrolment emails, imaging server maintenance window agreed. Week 4: phishing baseline, day-30 review.
3. Access takeover: break-glass global admin stored in the vault, previous provider accounts disabled after handover, not before.
4. Baseline mapped to CIS IG1: 1.1 inventory, 5.2 unique passwords, 6.3 MFA, 10.1 anti-malware, 11.2 backups.
5. Offboarding: previous provider's admin accounts disabled, RMM agent removed, license transfer confirmed, backup export received.
6. Welcome email in DE voice with portal link and support email.
7. Day-30 metrics: MFA coverage, agent coverage, backup success, open tickets by priority, patch compliance.
8. Unknowns: imaging server OS and support status; whether the vendor needs remote access.
