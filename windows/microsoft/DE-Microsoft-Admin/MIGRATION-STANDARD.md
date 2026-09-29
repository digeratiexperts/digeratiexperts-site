# DE Email Migration Standard v1

Status: **standing requirement.** It applies to every Digerati Experts client email migration run through DE
Microsoft Admin and the Intelligence Hub Tech Hub. Every stage below names the function that carries it out and
records its result on the migration project.

## Alamo Industries profile

- **Source:** consumer Gmail accounts (`@gmail.com`), not Google Workspace.
- **Destination:** Microsoft 365 Business.
- **Scope:** four users (the office staff and Mike Daniels). Users from the acquired company are out of scope.
- **Mailboxes:** one Microsoft 365 user mailbox per person, plus an `office@` shared mailbox.
- **Shared mailbox members:** Norma, Helen, Suzette and Mike, each with Full Access and Send As. Nobody gets a
  shared-mailbox password; the mailbox account's own sign-in is blocked.
- **Known identity:** `suzette@alamo-industries.com`.
- **Domain:** always checked against the verified domains in the tenant before anything is created, never read from
  a screenshot. `New-DEMigrationProject` refuses a domain the tenant has not verified.

## Source classification (`Get-DEMigrationSourceType`)

1. **PersonalGmail** (`@gmail.com`, `@googlemail.com`): mail and folders move over IMAP. Contacts and calendars move
   separately. Tasks, Drive files and Gmail filters are not migrated; they are listed for the client.
2. **GoogleWorkspace** (the domain's MX is Google's): use Microsoft's Google Workspace migration when the client
   controls the Workspace tenant.
3. **OtherIMAP**: any other IMAP host.

The Google Workspace path is never offered for a consumer Gmail address. `Add-DEMigrationUser` refuses a source
whose type does not match the project.

## Stages

`Get-DEMigrationNextStep` reads what has been recorded and names the next stage's command.

| # | Stage | Function |
|---|---|---|
| 1 | Create the project (client, verified destination domain, source type) | `New-DEMigrationProject` |
| 2 | Create and license the Microsoft 365 users | `New-DEUser`, then licence in the admin centre |
| 3 | Map every source address to its mailbox, with the devices each person uses | `Add-DEMigrationUser` (refuses unlicensed or non-user mailboxes) |
| 4 | Create the shared mailbox, grant Full Access and Send As, block its sign-in, prove it | `Set-DEMigrationSharedMailbox`, `Test-DEMigrationSharedMailbox` |
| 5 | IMAP preflight: sign in with the Gmail app password, count folders, messages and size | `Test-DEGmailImapAccess` |
| 6 | Pilot: one mailbox, then a technician confirms it in Outlook | `New-DEMigrationBatch -Type Pilot`, `Confirm-DEMigrationPilot` |
| 7 | Remaining mailboxes in batches (only after a confirmed pilot) | `New-DEMigrationBatch -Type Production`, `Get-DEMigrationStatus` |
| 8 | Contacts from the Google Contacts export | `Import-DEMigrationContacts` |
| 9 | Calendars from the Google Calendar export | `Import-DEMigrationCalendar` |
| 10 | Every PC: remove Gmail from Outlook, Credential Manager, Thunderbird and scheduled scripts | `Get-DEMailClientInventory -AllProfiles` on each PC (or the DE Tech Tool's Email migration page), `Import-DEMailClientInventory` on the admin PC |
| 11 | DNS: MX, SPF and autodiscover to Microsoft 365, no stray MX, DMARC and DKIM reported | `Test-DEMigrationDns` |
| 12 | Final delta after DNS points to Microsoft 365, then complete the batches | `Complete-DEMigrationBatch` (refused before DNS) |
| 13 | Verify: mail flow both ways, MFA, folders, contacts, calendar, shared mailbox, bounces, plus the checks a technician does by hand | `Test-DEMigrationMailFlow`, `Test-DEMigrationMfa`, `Set-DEMigrationCheck` |
| 14 | Client sign-off against the checklist | `New-DEMigrationSignoff` |
| 15 | Close: remove the batches (and the Gmail credentials Exchange stored), revoke the app passwords, end old access as agreed | `Close-DEMigrationProject` |

Old Gmail access or forwarding stays in place for the agreed transition window. Source mail is never deleted
without the client's agreement.

### What IMAP migration moves

Exchange Online's IMAP migration moves mail and folders (Gmail labels become folders). It does not move contacts,
calendars, tasks, rules or Drive files. By default the batch excludes `[Gmail]/Spam`, `[Gmail]/Trash`,
`[Gmail]/Important` and `[Gmail]/Starred`. `[Gmail]/All Mail` is kept, because archived mail exists only there. The
cost is that labelled mail also appears in the All Mail folder.

## Bounce-back and forwarding diagnostic (`Invoke-DEBounceDiagnostic`)

Run this before cutover and again after forwarding starts, on every bounce the client or the tool sees. It reads
the non-delivery report (`.eml`), including the original message it carries, and decides which of these is
generating the bounce:

- **NdrReprocessed:** the bounced message was itself a bounce; a filter, forward or client is resending bounces.
- **AutomaticForward:** the original was forwarded automatically (X-Forwarded-*, Resent-*, Auto-Submitted,
  X-Gm-Original-To).
- **RetryingClient:** the original is more than a day older than the bounce; a device or app keeps retrying it.
- **NewMessage:** a person or app is sending new mail to a dead address.

It reports the bounced recipient, the SMTP status and what it means, the sending client (X-Mailer, User-Agent,
Received HELO names), any project device named in the headers (for Helen: `HelenU` and `equip.alamo`), how often the
same subject hit that recipient in the last 10 days (`-MessageTrace`), and the change to make.

Archived or deleted Gmail messages do not send mail. A new bounce means something active is still sending: a
forward, a filter, a stale account on a PC or phone, a scanner or script with old SMTP settings, or an integration
that retries. `Get-DEMailClientInventory` finds those on each PC. Anything it could not read (another account's Credential Manager, a locked profile) is recorded as not checked, never as clean. Findings stay open until `Resolve-DEMigrationBounce`
records what was changed, and the Bounce diagnostic check passes only when none are open. Source mail is not deleted
and forwarding is not disabled until the cause and the transition plan are written down.

## Credentials and state

- The tool never requests or stores Gmail passwords, app passwords, Microsoft passwords, tokens, recovery codes or
  client secrets in chat, logs, reusable profiles, project state or Hub records.
- A Gmail app password exists only as a `PSCredential` for the one call that needs it. The CSV Exchange needs for a
  batch (`EmailAddress,UserName,Password`) is built in memory, passed as bytes, and wiped.
- Project state is one JSON file per project (`%ProgramData%\DE\MicrosoftAdmin\migrations`). It holds identities,
  counts, timestamps, statuses, errors and the event trail. Saving refuses any credential-like field.
- After sign-off, `Close-DEMigrationProject` removes the migration batches, which deletes the credentials Exchange
  kept for them. Each app password is then revoked in the Google account.
- Every change follows the same pattern: check, approve (`-WhatIf` / `-Confirm` / `-DryRun`), apply, verify, record.

## Verification checklist

| Check | Measured by |
|---|---|
| Inbound mail, Outbound mail | `Test-DEMigrationMailFlow` (message trace; send a test each way first) |
| Folders | `Get-DEMigrationStatus` (every mailbox Synced or Completed without errors) |
| Contacts | `Import-DEMigrationContacts` |
| Calendar | `Import-DEMigrationCalendar` |
| MFA | `Test-DEMigrationMfa` |
| Shared mailbox | `Test-DEMigrationSharedMailbox` |
| DNS and forwarding | `Test-DEMigrationDns` |
| Bounce diagnostic | `Invoke-DEBounceDiagnostic` / `Resolve-DEMigrationBounce` |
| Replies, Attachments, Outlook desktop, Outlook mobile | a technician, with `Set-DEMigrationCheck` |

A measured check can only pass by running its test. A technician can mark any check NotApplicable, with a reason.
The sign-off rules:

- `Approved` needs every check to be Pass or NotApplicable.
- `ApprovedWithExceptions` needs a written reason for each check that is not.

## Intelligence Hub record (`Export-DEMigrationRecord`)

`Export-DEMigrationRecord` writes the project as the Hub keeps it, with no credential in it:

- the project with its client, tenant and account boundary
- the source classification
- the identity map
- the device inventory and its Gmail references
- the shared mailboxes and their verification
- the pilot and batch results
- the contact and calendar import results
- the DNS and forwarding state
- the bounce findings
- the verification checklist
- the sign-off and final disposition
- the event trail
