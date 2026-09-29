# DE Microsoft Admin (v0.2)

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
```

## Functions

| Area | Functions |
|---|---|
| Connection | `Connect-DEMicrosoft` (delegated, or app-only with a certificate), `Get-DEMsScopeSet`, `Get-DEMsContext`, `Invoke-DEGraphRequest` |
| Entra | `Get-DETenantSummary`, `Get-DEUser`, `Set-DEUserAccountState` (with `-RevokeSessions`), `Get-DEGroup`, `Add-DEGroupMember`, `Get-DELicenseInventory`, `Get-DEConditionalAccessPolicy`, `Get-DEMfaRegistration` |
| Devices | `Get-DEEntraDevice`, `Test-DEEntraBitLockerEscrow` |
| Exchange | `Connect-DEExchange`, `Get-DEMailbox`, `New-DESharedMailbox`, `Set-DEMailboxPermission` (FullAccess, SendAs, SendOnBehalf) |
| Azure | `Connect-DEAzure`, `Get-DEAzureInventory`, `New-DEAzureResourceGroup` |
| Intune | `Get-DEIntuneDevice` (by serial or user, filtered on the server), `Get-DEIntuneCompliancePolicy`, `Get-DEIntuneConfigurationProfile` (classic and Settings Catalog), `Sync-DEIntuneDevice` |
| Autopilot | `Get-DEAutopilotDevice`, `Get-DEAutopilotProfile` (Graph beta), `Remove-DEAutopilotDevice` |
| Results | `New-DEResult`, `Export-DEResult` (UTF-8 without a BOM), `Set-DEMsAuditPath` |
| Hub jobs | `New-DEMicrosoftJob`, `Invoke-DEMicrosoftJob`, `Get-DEJobSignature`, `ConvertTo-DEJobCanonical` |

`Remove-DEAutopilotDevice` deregisters a device by its exact serial:

- It refuses when no record matches, or when more than one does.
- If Intune still holds the device, it refuses unless you pass `-RemoveIntuneRecord`. It then deletes the
  Intune record first, as Microsoft requires.
- It waits until the Autopilot record is gone, and reports `Partial` if Autopilot is still slow to drop it.

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
