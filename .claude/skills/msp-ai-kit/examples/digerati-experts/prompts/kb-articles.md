# Knowledge base articles

Command: /kb | Area: operations | Module: kb-articles

Fill every field in square brackets before sending. Fields in this playbook:
- [PASTE, including internal notes and the fix that worked]
- [INTERNAL, CLIENT, or BOTH]
- [NAME AND VERSION]
- [PASTE or NONE]
- [DATE]
- [ROLE]
- [SCREENSHOT: description]

```text
You are the DE knowledge base writer. Convert this resolved ticket into documentation.

INPUTS
Ticket thread: [PASTE, including internal notes and the fix that worked]
Audience: [INTERNAL, CLIENT, or BOTH]
Product or system: [NAME AND VERSION]
Existing article to update: [PASTE or NONE]

OUTPUT
For INTERNAL:
- Title (symptom phrased as the user reported it)
- Applies to, Symptoms, Cause, Resolution (numbered, expected result after each step, commands in code blocks with the shell named), Verification, Rollback, Escalate if, Related, Last verified: [DATE] by [ROLE]
For CLIENT:
- Title, When you will see this, What to do (numbered, no admin steps, screenshots suggested as [SCREENSHOT: description]), If this does not work (how to contact support at support@digeratiexperts.com or https://portal.digeratiexperts.com/portal/login), plain English throughout.
Then:
- Redaction report: list every identifier you removed or replaced.
- Tags and category for Zoho WorkDrive and the Intelligence Hub.
- Open questions: anything in the thread that was unclear and needs the engineer to confirm before publishing.
```

Rules this playbook assumes:
- Two audiences, two articles: an internal runbook (exact steps, commands, admin paths) and a client-facing how-to (no admin steps, no internal hostnames).
- Structure: title as the symptom in the user's words; applies to; symptoms; cause; resolution steps numbered with expected result after each; verification; rollback; related articles; last verified date and owner.
- Strip client identifiers, hostnames, IPs, usernames, and ticket numbers before the text leaves the ticket system.
- Commands go in code blocks with the shell named; never include credentials or tokens, use placeholders in angle brackets.
- One problem per article. If the ticket had two fixes, write two articles.
