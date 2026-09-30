1. Summary: Possible account takeover of the finance controller's mailbox, with a hidden inbox rule created after a foreign sign-in.
2. Evidence table:
   - Impossible travel: new-country sign-in 40 minutes after an Arizona sign-in | JumpCloud sign-in risk | supports compromise | high.
   - Legacy IMAP protocol used | identity logs | supports compromise | high.
   - Inbox rule moving "invoice" mail to RSS Feeds created 10 minutes later | mail audit | supports compromise | high.
   - No EDR alert on LAP-0140 | EDR | neutral | medium.
3. Verdict: TRUE POSITIVE.
4. MITRE ATT&CK mapping: T1078 Valid Accounts; T1114.003 Email Forwarding Rule collection; T1564.008 Email Hiding Rules.
5. Containment now: revoke sessions and reset the password from the identity console (rollback: none needed); disable the inbox rule (rollback: re-enable if proven legitimate); block legacy authentication for the tenant (rollback: re-enable per application).
6. Investigation next: 30 days of sign-in history; other rules and forwarding; OAuth application consents; sent items for fraudulent invoices; other users signing in from the same IP.
7. Escalation: P1 incident; message to the security lead with the evidence table.
8. Client note: We have secured one mailbox after suspicious sign-in activity and are checking whether any messages were sent from it. You will hear from us within the hour.
9. Tuning: none; the detection fired correctly.
