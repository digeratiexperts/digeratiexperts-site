# DE Microsoft Admin (v0.4)

A standalone PowerShell module that Digerati Experts uses to administer Microsoft 365, Entra ID, Exchange
Online, Intune, Windows Autopilot and Azure.

- A technician can run it at a prompt.
- DE Tech Tool can run it.
- The Intelligence Hub can run it through signed jobs.

It works on Windows PowerShell 5.1 and PowerShell 7.

## Rules it keeps

- **Read-only by default.** Every change supports `-WhatIf` and `-DryRun`, and a dry run returns the same
  result shape as a real run.
- **Nothing secret touches disk.** That covers passwords, tokens, client secrets and BitLocker recovery keys.
  The escrow check only ever sees key IDs.
- **Complete, correct Graph data.**
  - Lists follow `@odata.nextLink`, so nothing is silently cut off at 999.
  - Throttling and transient errors (429, 502, 503, 504) are retried, honouring `Retry-After`.
  - Search and filtering happen on the server.
  - Query values are escaped.
- **Least privilege.** `Connect-DEMicrosoft -Scenario Read,Users,...` asks for exactly those scopes. The
  Hub worker signs in app-only with a certificate thumbprint; a client secret is never accepted.
- **One result shape.** Every operation returns one result: `Succeeded`, `DryRun`, `Failed`, `Refused` or
  `Partial`. It also appends one line to the audit log (`%ProgramData%\DE\MicrosoftAdmin\audit.jsonl`):
  who, what, target, status and time, never data.
- **Careful changes.** Destructive commands are `ConfirmImpact High`, read their own effect back, and
  refuse ambiguous targets.
- **Idempotent.** A member that is already added, an existing mailbox address, or an existing resource
  group never produces a second change.

## Quick start

```powershell
.\Install-DEMicrosoftDependencies.ps1 -CurrentUser
Import-Module .\DE-Microsoft-Admin.psd1
Connect-DEMicrosoft -TenantId alamo-industries.com -Scenario Read, BitLocker
Get-DETenantSummary
Get-DEUser -Search suzette
Test-DEEntraBitLockerEscrow -DeviceId <DeviceId from dsregcmd /status> -KeyProtectorId <protector id>
Remove-DEAutopilotDevice -Serial PF3ABC12 -WhatIf

# a new hire (Users scenario): the temporary password comes back once, as a SecureString
$r = New-DEUser -DisplayName 'New Hire' -UserPrincipalName new.hire@alamo-industries.com -UsageLocation US
[pscredential]::new('x', $r.data.temporaryPassword).GetNetworkCredential().Password   # show it once, hand it over, never save it
```

## Functions

| Area | Functions |
|---|---|
| Connection | `Connect-DEMicrosoft` (delegated, or app-only with a certificate), `Get-DEMsScopeSet`, `Get-DEMsContext`, `Invoke-DEGraphRequest` |
| Entra | `Get-DETenantSummary`, `Get-DEUser`, `New-DEUser`, `Set-DEUserAccountState` (with `-RevokeSessions`), `Get-DEGroup`, `New-DEGroup` (security or Microsoft 365, with owners), `Add-DEGroupMember`, `Get-DELicenseInventory`, `Get-DEConditionalAccessPolicy`, `Set-DEConditionalAccessPolicyState`, `Get-DEMfaRegistration` |
| Devices | `Get-DEEntraDevice`, `Test-DEEntraBitLockerEscrow` |
| Exchange | `Connect-DEExchange`, `Get-DEMailbox`, `New-DESharedMailbox`, `Set-DEMailboxPermission` (FullAccess, SendAs, SendOnBehalf), `Set-DEMailboxAlias` (add or remove), `Set-DEMailboxForwarding` (set or stop), `Get-DETransportRule` (risky rules flagged) |
| Azure | `Connect-DEAzure`, `Get-DEAzureSubscription`, `Get-DEAzureInventory`, `New-DEAzureResourceGroup`, `New-DEAzureResourceLock` |
| Intune | `Get-DEIntuneDevice` (by serial or user, filtered on the server), `Get-DEIntuneCompliancePolicy`, `Get-DEIntuneConfigurationProfile` (classic and Settings Catalog), `Sync-DEIntuneDevice`, `Invoke-DEIntuneDeviceAction` (Sync, Restart, Lock, Retire, Wipe, FreshStart) |
| Autopilot | `Get-DEAutopilotDevice`, `Get-DEAutopilotProfile` (Graph beta), `Set-DEAutopilotGroupTag`, `Remove-DEAutopilotDevice` |
| Results | `New-DEResult`, `Export-DEResult` (UTF-8 without a BOM), `Set-DEMsAuditPath` |
| Email migration | `New-DEMigrationProject`, `Get-DEMigrationProject`, `Get-DEMigrationSourceType`, `Add-DEMigrationUser`, `Test-DEGmailImapAccess`, `Set-DEMigrationSharedMailbox`, `Test-DEMigrationSharedMailbox`, `New-DEMigrationBatch`, `Get-DEMigrationStatus`, `Confirm-DEMigrationPilot`, `Complete-DEMigrationBatch`, `Import-DEMigrationContacts`, `Import-DEMigrationCalendar`, `Get-DEMailClientInventory`, `Test-DEMigrationDns`, `Test-DEMigrationMailFlow`, `Test-DEMigrationMfa`, `Invoke-DEBounceDiagnostic`, `Resolve-DEMigrationBounce`, `Set-DEMigrationCheck`, `New-DEMigrationSignoff`, `Close-DEMigrationProject`, `Export-DEMigrationRecord`, `Set-DEMigrationDirectory` |
| Hub jobs | `New-DEMicrosoftJob`, `Invoke-DEMicrosoftJob`, `Get-DEJobSignature`, `ConvertTo-DEJobCanonical` |

Scenarios for `Connect-DEMicrosoft -Scenario`: `Read` (always included), `Users`, `Groups`, `Policy`
(Conditional Access changes), `Intune`, `Autopilot`, `BitLocker`, `Migration` (contacts, calendars, domain
records, MFA registration), `Reports`.

### What the changes refuse

| Function | Refuses |
|---|---|
| `New-DEUser` | a UPN whose domain isn't verified in the tenant, or a UPN that already exists. The password is generated in the module (never passed in or written), returned once as a SecureString, and must be changed at first sign-in. A Hub job gets the user but not the password: issue a Temporary Access Pass or reset it in the portal. |
| `New-DEGroup` | a mail nickname used by a different group (the same group already there is a no-op), or an owner that doesn't exist |
| `Set-DEConditionalAccessPolicyState` | enforcing a policy that targets all users and excludes nobody (that locks out the break-glass account) unless `-AllowNoExclusions`; going straight from off to enforced is called out |
| `Set-DEMailboxAlias` | an address on a domain Exchange doesn't accept, an address another recipient already has, or removing the primary address |
| `Set-DEMailboxForwarding` | forwarding outside the tenant without `-AllowExternal` (the classic exfiltration move, and blocked by Microsoft's outbound spam policy by default). A copy stays in the mailbox unless `-KeepCopy $false`. |
| `Invoke-DEIntuneDeviceAction` | Retire, Wipe or Fresh Start without `-ConfirmDeviceName` set to the device's exact name; remote lock on Windows (Intune doesn't support it) |
| `Set-DEAutopilotGroupTag` | a serial that matches no record or more than one. It uses `updateDeviceProperties` (a PATCH is accepted and ignored by Graph) and reads the tag back. |
| `New-DEAzureResourceLock` | a lock on one resource without `-ResourceType`, or a same-named lock at another level; warns that ReadOnly also blocks routine operations |

`Remove-DEAutopilotDevice` deregisters a device by its exact serial:

- It refuses when no record matches, or when more than one does.
- If Intune still holds the device, it refuses unless you pass `-RemoveIntuneRecord`. It then deletes the
  Intune record first, as Microsoft requires.
- It waits until the Autopilot record is gone, and reports `Partial` if Autopilot is still slow to drop it.

## Email migration (Gmail to Microsoft 365)

[MIGRATION-STANDARD.md](MIGRATION-STANDARD.md) is the contract: stages, gates, credentials and the Hub record. A run
for Alamo looks like this (Graph with `-Scenario Read, Users, Migration`, plus `Connect-DEExchange`):

```powershell
New-DEMigrationProject -ClientName 'Alamo Industries' -TargetDomain alamo-industries.com -ProjectId alamo-mail
Add-DEMigrationUser -ProjectId alamo-mail -SourceAddress helen.x@gmail.com -DestinationAddress helen@alamo-industries.com -Devices HelenU, equip.alamo
Set-DEMigrationSharedMailbox -ProjectId alamo-mail -Address office@alamo-industries.com -DisplayName Office -Members norma@alamo-industries.com, helen@alamo-industries.com, suzette@alamo-industries.com, mike@alamo-industries.com
$suz = Get-Credential suzette.x@gmail.com            # the Gmail address and its app password, held only in memory
New-DEMigrationBatch -ProjectId alamo-mail -Type Pilot -Credential $suz     # preflight runs first
Get-DEMigrationStatus -ProjectId alamo-mail
Confirm-DEMigrationPilot -ProjectId alamo-mail -Technician jrpetro -Note 'opened in Outlook; folders and recent mail present'
New-DEMigrationBatch -ProjectId alamo-mail -Type Production -Credential $norma, $helen, $mike
Import-DEMigrationContacts -ProjectId alamo-mail -SourceAddress helen.x@gmail.com -Path .\helen-contacts.csv
Import-DEMigrationCalendar -ProjectId alamo-mail -SourceAddress helen.x@gmail.com -Path .\helen.ics
Get-DEMailClientInventory -ProjectId alamo-mail            # on each PC, signed in as its user (HelenU, equip.alamo, ...)
Test-DEMigrationDns -ProjectId alamo-mail -Server 1.1.1.1  # after the MX change
Complete-DEMigrationBatch -ProjectId alamo-mail -BatchName <batch>   # final delta, only once DNS points to Microsoft 365
Test-DEMigrationMailFlow -ProjectId alamo-mail; Test-DEMigrationMfa -ProjectId alamo-mail
Invoke-DEBounceDiagnostic -ProjectId alamo-mail -Path .\bounce.eml -MessageTrace
New-DEMigrationSignoff -ProjectId alamo-mail -ApprovedBy 'Mike Daniels' -Decision Approved
Close-DEMigrationProject -ProjectId alamo-mail
Export-DEMigrationRecord -ProjectId alamo-mail -Path .\alamo-mail-record.json
```

- **Gmail exports.** Contacts come from contacts.google.com > Export > Google CSV. Calendars come from Google
  Calendar > Settings > Import & export > Export (one `.ics` per calendar).
- **Mailbox access.** Importing into someone else's mailbox needs the app-only worker with the `Contacts.ReadWrite`
  and `Calendars.ReadWrite` application permissions, or that user's own delegated sign-in.
- **What the calendar import does:**
  - It never invites anyone. Attendees are written into the notes.
  - It keeps recurrence and removes deleted occurrences.
  - It lists moved single occurrences and patterns Outlook cannot express, as skipped with the reason.
  - A rerun adds nothing twice.

## Signed Hub jobs

A job is JSON with these fields:

`{ schema: "de.msadmin.job/v1", jobId, tenantId, operation, parameters, mode: "plan"|"apply", approvedBy, requestedBy, issuedAt, expiresAt, signature }`

The `signature` is HMAC-SHA256 (hex) over the job's canonical JSON:

- the signature field is removed
- keys are sorted, compactly
- strings are escaped the way JavaScript's `JSON.stringify` escapes them

That means a Node signer on the Hub and this module sign the same bytes.

`Invoke-DEMicrosoftJob` runs a job only when every one of these holds:

- The signature verifies (compared in constant time).
- It was issued within the last 60 minutes, allowing 5 minutes of clock skew, and has not expired.
- It hasn't run before. The replay ledger is written before the job runs, so even a crash can't cause a
  second run.
- It targets the connected tenant.
- The operation is on the allowlist.
- Every parameter belongs to that operation.
- Changes run only in `apply` mode with an `approvedBy`. A `plan` job runs a change as `-DryRun`.
