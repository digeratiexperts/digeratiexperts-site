# DE Microsoft Admin (v0.3)

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
| Hub jobs | `New-DEMicrosoftJob`, `Invoke-DEMicrosoftJob`, `Get-DEJobSignature`, `ConvertTo-DEJobCanonical` |

Scenarios for `Connect-DEMicrosoft -Scenario`: `Read` (always included), `Users`, `Groups`, `Policy`
(Conditional Access changes), `Intune`, `Autopilot`, `BitLocker`, `Reports`.

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
