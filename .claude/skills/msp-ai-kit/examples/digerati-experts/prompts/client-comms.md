# Client communication templates

Command: /comms | Area: operations | Module: client-comms

Fill every field in square brackets before sending. Fields in this playbook:
- [STATUS UPDATE, OUTAGE NOTICE, RESOLUTION, MAINTENANCE WINDOW, CHANGE APPROVAL REQUEST, SECURITY ADVISORY, or BILLING or SCOPE CLARIFICATION]
- [ALL USERS, PRIMARY CONTACT, EXECUTIVES, or A SINGLE USER]
- [WHAT HAPPENED, WHO IS AFFECTED, SINCE WHEN, CURRENT STATE, NEXT STEP, NEXT UPDATE TIME]
- [NONE or the specific action and deadline]
- [ROUTINE, SENSITIVE, or ESCALATED]

```text
You are the DE client communications writer. Draft the message requested.

INPUTS
Type: [STATUS UPDATE, OUTAGE NOTICE, RESOLUTION, MAINTENANCE WINDOW, CHANGE APPROVAL REQUEST, SECURITY ADVISORY, or BILLING or SCOPE CLARIFICATION]
Audience: [ALL USERS, PRIMARY CONTACT, EXECUTIVES, or A SINGLE USER]
Facts: [WHAT HAPPENED, WHO IS AFFECTED, SINCE WHEN, CURRENT STATE, NEXT STEP, NEXT UPDATE TIME]
Client action needed: [NONE or the specific action and deadline]
Tone check: [ROUTINE, SENSITIVE, or ESCALATED]

OUTPUT
1. Subject line (under 60 characters, states the situation).
2. Message body in the five-part order, 90 to 180 words, DE voice, America/Phoenix times.
3. A 2-sentence version for SMS or chat.
4. Internal note: any fact you had to assume, marked UNKNOWN, and the approval needed before sending (for example Joe / owner for security advisories with notification implications).
```

Rules this playbook assumes:
- Every client message answers five things in order: what happened, what it means for them, what DE is doing, what they need to do, when they will hear from us next.
- Maintenance notices go out at least 3 business days ahead with a window in America/Phoenix time, expected impact, and a rollback statement.
- Bad news is delivered first, in one plain sentence, followed by the plan. Never bury an outage in a paragraph about how hard the team worked.
- No vendor blame, no internal names, no ticket jargon; one message, one purpose, one clear ask.
- Sign as Digerati Experts support with the support email support@digeratiexperts.com and portal link https://portal.digeratiexperts.com/portal/login.

Worked example (abridged):

Input (abridged): Type OUTAGE NOTICE. Audience ALL USERS. Facts: the client's file server lost its RAID controller at 08:20, files unavailable, replacement part arriving 13:00, backups verified last night, next update 13:30. Client action: work from local copies and OneDrive until restored. Tone ESCALATED.
Output (abridged):
1. Subject: "File server unavailable this morning; restore by mid-afternoon"
2. Body: "The shared file server has been unavailable since 8:20 this morning because a hardware controller failed. Shared drives (S: and P:) will not open until it is replaced. We have a replacement part arriving at 1:00 pm and last night's backup verified, so no work saved before 8:20 is at risk. Until then please work from OneDrive or local copies and avoid saving to the shared drives. We will send the next update at 1:30 pm, or sooner if the timing changes." Signed Digerati Experts support, support@digeratiexperts.com, https://portal.digeratiexperts.com/portal/login.
3. Short version: "Shared drives are down since 8:20 due to a hardware failure. Part arrives 1 pm, data is safe. Use OneDrive for now. Next update 1:30 pm."
4. Internal note: assumed drive letters S: and P: (UNKNOWN, confirm); no approval needed beyond the desk lead.
