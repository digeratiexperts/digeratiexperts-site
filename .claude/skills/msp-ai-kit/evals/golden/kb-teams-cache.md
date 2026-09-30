INTERNAL
Title: Teams shows "We ran into a problem" at sign-in
Applies to: new Teams client on Windows 11
Symptoms: the error appears right after a password change; signing out does not help.
Cause: corrupted local cache after the credential change.
Resolution:
1. Quit Teams fully from the system tray. Expected result: no ms-teams process in Task Manager.
2. In PowerShell as the user run `Remove-Item "$env:LOCALAPPDATA\Packages\MSTeams_8wekyb3d8bbwe\LocalCache" -Recurse -Force`. Expected result: the folder is gone.
3. Start Teams and sign in. Expected result: the home screen loads.
Verification: the user joins a test meeting.
Rollback: none needed; the cache rebuilds.
Escalate if: the error persists on a second device, which points to the account rather than the client.
Last verified: [DATE] by [ROLE]

CLIENT
Title: Teams says "We ran into a problem" when you open it
When you will see this: usually right after you change your password.
What to do:
1. Right-click the Teams icon near the clock and choose Quit.
2. Restart your computer.
3. Open Teams and sign in again. [SCREENSHOT: Teams sign-in screen]
If this does not work: contact support at support@digeratiexperts.com or through the client portal.

Redaction report: removed the user's first name, the machine name and the ticket number.
Tags and category: teams, microsoft-365, cache; category Microsoft 365 / Teams.
Open questions: confirm the LocalCache path for the classic Teams client before publishing.
