1. Kickoff agenda (30 minutes): introductions; what changes for staff and when; access we need; HIPAA scope including the imaging server; how to reach support. Contacts needed: practice manager (owner), Dentrix / imaging vendor contact, Valley IT technical contact.
2. Week-by-week plan:
   - Week 1: global admin takeover with a break-glass account created and tested (owner Tier 2, evidence: sign-in log entry); domain and DNS ownership confirmed (evidence: registrar screenshot); asset and identity inventory (evidence: export).
   - Week 2: MFA enforced for all 25 users (evidence: conditional-access report); EDR and MDR agents on every endpoint (evidence: console export); backup configured and verified with a file restore (evidence: restore log).
   - Week 3: documentation in Hudu; portal enrolment emails; imaging server maintenance window agreed with the vendor.
   - Week 4: phishing baseline; replace the consumer-grade router (quote needed); day-30 review.
3. Access takeover checklist: break-glass global admin created and stored in the vault; Valley IT admin accounts disabled only after handover is confirmed; registrar and DNS logins transferred.
4. Baseline security checklist (CIS Controls v8 IG1): 1.1 enterprise asset inventory; 5.2 unique passwords; 6.3 MFA for externally exposed applications; 10.1 anti-malware on all endpoints; 11.2 automated backups with a tested restore.
5. Previous-provider offboarding: Valley IT RMM agent removed; licenses transferred; backup export received; shared credentials rotated after takeover.
6. Client-facing welcome email: explains what happens over the next 30 days, how to get support through the client portal and support@digeratiexperts.com, and that staff will be asked to set up MFA in week 2.
7. Day-30 review agenda and metrics: MFA coverage, agent coverage, backup success and last restore test, open tickets by priority, patch compliance.
8. Risks and unknowns: imaging server operating system and support status (UNKNOWN); whether the imaging vendor needs remote access; router replacement budget.
