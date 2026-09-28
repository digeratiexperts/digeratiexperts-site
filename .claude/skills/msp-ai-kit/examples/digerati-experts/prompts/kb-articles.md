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
- Tags and category for Hudu (documentation, passwords, assets) with Zoho WorkDrive and the Intelligence Hub.
- Open questions: anything in the thread that was unclear and needs the engineer to confirm before publishing.
```

Rules this playbook assumes:
- Two audiences, two articles: an internal runbook (exact steps, commands, admin paths) and a client-facing how-to (no admin steps, no internal hostnames).
- Structure: title as the symptom in the user's words; applies to; symptoms; cause; resolution steps numbered with expected result after each; verification; rollback; related articles; last verified date and owner.
- Strip client identifiers, hostnames, IPs, usernames, and ticket numbers before the text leaves the ticket system.
- Commands go in code blocks with the shell named; never include credentials or tokens, use placeholders in angle brackets.
- One problem per article. If the ticket had two fixes, write two articles.

Worked example (abridged):

Input (abridged): Ticket thread where a user's Teams showed "We ran into a problem"; fix was to sign out, clear %appdata%\Microsoft\Teams cache, sign back in. Audience BOTH. Product: Teams (new client), Windows 11.
Output (abridged):
INTERNAL: Title "Teams shows 'We ran into a problem' at sign-in". Applies to: new Teams on Windows 11. Cause: corrupted local cache after a profile change. Resolution: 1. Fully quit Teams from the system tray (expected: no Teams process in Task Manager). 2. In PowerShell as the user run `Remove-Item "$env:LOCALAPPDATA\Packages\MSTeams_8wekyb3d8bbwe\LocalCache" -Recurse -Force` (expected: folder removed). 3. Start Teams and sign in (expected: home screen loads). Verification: user can join a test meeting. Rollback: none needed; cache rebuilds. Escalate if: error persists on a second device, which points to the account, not the client. Last verified: [DATE] by Tier 2.
CLIENT: Title "Teams says 'We ran into a problem' when you open it". When you will see this: usually after a password change. What to do: 1. Right-click the Teams icon near the clock and choose Quit. 2. Restart your computer. 3. Open Teams and sign in again. If this does not work: contact support at support@digeratiexperts.com or through https://portal.digeratiexperts.com/portal/login.
Redaction report: removed the user's name, machine name LAP-0231 and the ticket number.
Tags: teams, m365, cache. Open questions: confirm the LocalCache path on the classic Teams client before publishing.
