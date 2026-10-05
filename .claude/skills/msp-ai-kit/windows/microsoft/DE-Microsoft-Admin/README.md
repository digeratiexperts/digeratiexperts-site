# DE Microsoft Admin (v0.6.0)

A standalone PowerShell module that Digerati Experts uses to administer Microsoft 365, Entra ID, Exchange
Online, Intune, Windows Autopilot and Azure.

- A technician can run it at a prompt.
- DE Tech Tool can run it.
- The Intelligence Hub can run it through signed jobs.

It works on Windows PowerShell 5.1 and PowerShell 7.

**0.6.0:**
- The Hub worker runs Exchange Online and Azure jobs unattended. `Invoke-DEHubJobLoop` signs in to Exchange Online
  (`Connect-DEExchange -AppId -CertificateThumbprint -Organization`) or Azure (`Connect-DEAzure -ServicePrincipal`)
  with the same app and certificate as Graph, only when a job that needs that service has verified, once per run,
  and signs out at the end. New settings: `-ExchangeOrganization` and `-AzureSubscriptionId`. See
  [Exchange Online and Azure jobs](#exchange-online-and-azure-jobs).
- A job that cannot sign in (a setting, the app-only Graph connection or the module missing, or the sign-in refused)
  is posted as `Failed` with exactly what is missing, and the loop carries on with the next job.
- `Invoke-DEHubJobLoop -WhatIf` also reports whether Exchange Online and Azure jobs could sign in unattended.

**0.5.0:**
- `Invoke-DEHubJobLoop` is the worker side of the Intelligence Hub's job queue. It claims the Hub's approved jobs for
  the connected tenant, runs each through `Invoke-DEMicrosoftJob` (which verifies it first), and posts each result
  back. See [The Hub job loop](#the-hub-job-loop).
- `ConvertTo-DEHubSafeResult` is the copy of a result that may go to the Hub. Nothing secret-shaped goes:
  `New-DEUser`'s temporary password stays on the worker, and `Get-DEIntuneCompliancePolicy` sends safe fields only.

**0.4.1:**
- `Get-DEMailClientInventory -AllProfiles` scans every Windows account on a PC. Another account's Credential
  Manager is reported as not checked, never as clean.
- `Import-DEMailClientInventory` records a scan made on a client PC onto the project on the admin PC.
- `Get-DEMigrationNextStep` gives the next step and its command, worked out from what was recorded.
- `Export-DEMigrationRecord` writes the record so the Intelligence Hub accepts it: checks as a list, `multiFactor`,
  and `null` rather than `{}` on Windows PowerShell 5.1.

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
| Exchange | `Connect-DEExchange` (user sign-in, or app-only with a certificate), `Get-DEMailbox`, `New-DESharedMailbox`, `Set-DEMailboxPermission` (FullAccess, SendAs, SendOnBehalf), `Set-DEMailboxAlias` (add or remove), `Set-DEMailboxForwarding` (set or stop), `Get-DETransportRule` (risky rules flagged) |
| Azure | `Connect-DEAzure` (interactive, or a service principal with a certificate), `Get-DEAzureSubscription`, `Get-DEAzureInventory`, `New-DEAzureResourceGroup`, `New-DEAzureResourceLock` |
| Intune | `Get-DEIntuneDevice` (by serial or user, filtered on the server), `Get-DEIntuneCompliancePolicy`, `Get-DEIntuneConfigurationProfile` (classic and Settings Catalog), `Sync-DEIntuneDevice`, `Invoke-DEIntuneDeviceAction` (Sync, Restart, Lock, Retire, Wipe, FreshStart) |
| Autopilot | `Get-DEAutopilotDevice`, `Get-DEAutopilotProfile` (Graph beta), `Set-DEAutopilotGroupTag`, `Remove-DEAutopilotDevice` |
| Results | `New-DEResult`, `Export-DEResult` (UTF-8 without a BOM), `Set-DEMsAuditPath` |
| Email migration | `New-DEMigrationProject`, `Get-DEMigrationProject`, `Get-DEMigrationSourceType`, `Add-DEMigrationUser`, `Test-DEGmailImapAccess`, `Set-DEMigrationSharedMailbox`, `Test-DEMigrationSharedMailbox`, `New-DEMigrationBatch`, `Get-DEMigrationStatus`, `Confirm-DEMigrationPilot`, `Complete-DEMigrationBatch`, `Import-DEMigrationContacts`, `Import-DEMigrationCalendar`, `Get-DEMailClientInventory`, `Import-DEMailClientInventory`, `Get-DEMigrationNextStep`, `Test-DEMigrationDns`, `Test-DEMigrationMailFlow`, `Test-DEMigrationMfa`, `Invoke-DEBounceDiagnostic`, `Resolve-DEMigrationBounce`, `Set-DEMigrationCheck`, `New-DEMigrationSignoff`, `Close-DEMigrationProject`, `Export-DEMigrationRecord`, `Set-DEMigrationDirectory` |
| Hub jobs | `Invoke-DEHubJobLoop` (claim, verify, run, post), `ConvertTo-DEHubSafeResult`, `New-DEMicrosoftJob`, `Invoke-DEMicrosoftJob`, `Get-DEJobSignature`, `ConvertTo-DEJobCanonical` |

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
Get-DEMailClientInventory -AllProfiles -ProjectId alamo-mail   # on each PC, elevated (HelenU, equip.alamo, ...); or the DE Tech Tool's Email migration page
Import-DEMailClientInventory -ProjectId alamo-mail -Path .\HELENU-gmail-scan.json   # a scan saved on a PC that does not hold the project
Get-DEMigrationNextStep -ProjectId alamo-mail              # what to do next, with the command
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

## The Hub job loop

The Intelligence Hub queues, approves and signs jobs (Hub: **Tech Center > Microsoft 365 admin jobs**; its
contract is `docs/MSADMIN-JOBS.md` in the Intelligence-Hub repo). `Invoke-DEHubJobLoop` is the worker that runs
them. Each run does this:

1. It posts any result from an earlier run that could not be posted (see below).
2. It claims the oldest approved job for the connected tenant
   (`POST /api/msadmin/worker/v1/jobs/claim`). The Hub hands a job out once.
3. `Invoke-DEMicrosoftJob` verifies the job before anything runs: the signature, the validity window, the replay
   ledger, the tenant, the allowlist, the parameters, and for a change `apply` mode with `approvedBy`. A job that
   fails any check is not run; it is reported to the Hub as `Refused`.
4. It makes the result safe for the Hub, saves it, posts it (`POST /api/msadmin/worker/v1/jobs/<jobId>/result`)
   and deletes the saved copy once the Hub has it.
5. It repeats until no job is waiting, or until `-MaxJobs` (default 50) or `-MaxMinutes` (default 30) is reached.
   `-Once` runs at most one job.
6. It signs out of Exchange Online and Azure if this run signed in to them (see
   [Exchange Online and Azure jobs](#exchange-online-and-azure-jobs)).

It returns one summary: `ok`, `stoppedBecause`, `message`, the counts, `services` (what the run did with Exchange
Online and Azure) and each job with its local result.

| `stoppedBecause` | `ok` | Meaning |
|---|---|---|
| `queue_empty`, `max_jobs`, `time_budget` | yes | Finished normally. |
| `whatif` | yes | `-WhatIf`: nothing was claimed or posted (see below). |
| `network` | no | The Hub did not answer, or answered 5xx, after the retries. Nothing more is claimed this run. |
| `hub_refused` | no | The Hub answered 4xx. The message gives the Hub's reason and what to check. |
| `job_signature` | no | A job's signature did not verify. It was reported as `Refused`, and the run stopped so the rest of the queue is not refused too: `MSADMIN_JOB_SIGNING_SECRET` probably differs between the Hub and the worker. |
| `busy` | no | Another loop is running on this machine. |

### What never reaches the Hub

- **Secrets in results.** Before posting, `ConvertTo-DEHubSafeResult` applies the Hub's own rules, so the Hub never
  has to refuse a result.
  - It removes any field whose name looks like a secret: password, secret, token, API key, MFA, seed, recovery key,
    `pin`, `tap`, app password, pre-shared key. A `true`/`false`, a number or `null` under such a name is a setting
    or a flag and stays (`mfaRegistered`, `passwordless`, `passwordMinimumLength`).
  - It replaces a BitLocker recovery password, a JWT or a PEM private key inside any text with `[removed]`.
  - The result's message lists what was kept back.
- **New-DEUser's temporary password.** It stays in the local result only. A technician running the loop at a prompt
  reads it the same way as after `New-DEUser`:

  ```powershell
  $r = Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE
  $j = $r.jobs | Where-Object operation -eq 'New-DEUser'
  [pscredential]::new('x', $j.localResult.data.temporaryPassword).GetNetworkCredential().Password   # show once, never save
  ```

  An unattended run discards it. Issue a Temporary Access Pass, or reset the password in the portal.
- **Intune password settings.** A `Get-DEIntuneCompliancePolicy` result sends each policy's id, name, platform,
  version, dates and its plain settings. Its `password*` and `passcode*` settings are sent as names only, in
  `deviceLockRules`, never their values.
- **The two Hub secrets.** They are held as SecureStrings for the run. They are never written to disk, the audit
  log, the output or a result.
- **Oversized data.** A result over the Hub's 2 MB limit is sent without its data, and its message says so.

### Exchange Online and Azure jobs

Graph is connected before the loop starts. Exchange Online and Azure are not: the loop signs in to them only when a
claimed job needs them, and only after that job has verified (a job that fails verification never signs anything
in). The operations that need them:

- Exchange Online: `Get-DEMailbox`, `New-DESharedMailbox`, `Set-DEMailboxPermission`, `Set-DEMailboxAlias`,
  `Set-DEMailboxForwarding`, `Get-DETransportRule`.
- Azure: `Get-DEAzureSubscription`, `Get-DEAzureInventory`, `New-DEAzureResourceGroup`, `New-DEAzureResourceLock`.

The sign-in uses the app and certificate thumbprint of the Graph connection (`Connect-DEMicrosoft -ClientId
-CertificateThumbprint`), plus these settings of `Invoke-DEHubJobLoop`:

| Setting | Needed for | Value |
|---|---|---|
| `-ExchangeOrganization` | Exchange Online jobs | The tenant's initial domain, for example `alamoindustries.onmicrosoft.com` (Microsoft 365 admin center > Settings > Domains: the `*.onmicrosoft.com` one, which is not always the primary domain). |
| `-AzureSubscriptionId` | Azure jobs (optional) | The subscription GUID to work in. Without it, Azure picks the service principal's default subscription. |

- **Exchange Online:** `Connect-ExchangeOnline -AppId <app id> -CertificateThumbprint <thumbprint> -Organization
  <-ExchangeOrganization>`.
- **Azure:** `Connect-AzAccount -ServicePrincipal -ApplicationId <app id> -CertificateThumbprint <thumbprint>
  -Tenant <tenant>`, with `-Subscription <-AzureSubscriptionId>` when it is set.
- **Once per run.** The first job that needs a service signs in; later jobs in the run use that session. A sign-in
  that failed is not retried in the same run: each later job for that service gets the same reason.
- **Signed out at the end** of every run that signed in (`Disconnect-ExchangeOnline`, `Disconnect-AzAccount`).
- **At a prompt**, a session you opened yourself with `Connect-DEExchange` or `Connect-DEAzure` (in the same
  PowerShell session, for the connected tenant) is used as it is and left open.
- **When it cannot sign in**, the job does not run. It is posted to the Hub as `Failed`, with a message that says
  exactly what is missing, for example `not run: Exchange Online unattended sign-in is not configured on this worker:
  -ExchangeOrganization is not set (...)`, `Graph is not connected app-only with a certificate`, `the
  ExchangeOnlineManagement module is not installed on this worker`, or `Azure app-only sign-in failed: <reason>`. The
  loop carries on with the next job, and the job is not written to the replay ledger (nothing ran).
- **`-WhatIf`** reports, for each service, `ready (...)` or `not configured: <what is missing>` (in `services` and
  in the message), and signs nothing in.

The Entra app needs, besides its Graph permissions:

- **Exchange Online:** the application permission **Office 365 Exchange Online > `Exchange.ManageAsApp`** (API
  permissions > Add a permission > APIs my organization uses > Office 365 Exchange Online), with admin consent, and an
  Exchange admin role assigned to the app's service principal (Entra > Roles and administrators). **Exchange
  Recipient Administrator** covers the mailbox jobs (mailboxes, permissions, aliases, forwarding);
  `Get-DETransportRule` also needs a role that can read transport rules, such as **Exchange Administrator**. Assign
  the smallest role that covers the jobs you queue.
- **Azure:** an Azure RBAC role for the app's service principal on each subscription (or resource group) the jobs
  touch (subscription > Access control (IAM) > Add role assignment): **Reader** for `Get-DEAzureSubscription` and
  `Get-DEAzureInventory`; **Contributor** on the scope for `New-DEAzureResourceGroup`; a role with
  `Microsoft.Authorization/locks/*` (for example **User Access Administrator** or Owner, scoped as narrowly as you
  can) for `New-DEAzureResourceLock`.
- No client secret, certificate file or certificate password, for either service: the certificate is found by its
  thumbprint in the worker's certificate store.

### Network failures and results that could not be posted

- No answer, a timeout, 5xx, 408 and 429 are retried with backoff: `-RetryBaseSeconds` (default 2) doubling, up to
  `-MaxRetries` (default 4) retries. Every attempt has a new request id. If the Hub still cannot be reached, the
  run stops.
- A 4xx is not retried. The run stops with the Hub's reason. For a 401, check that `MSADMIN_WORKER_SECRET` matches
  and that the clock is within 5 minutes. For a 404 on the claim, check the Hub URL.
- Each result is saved to `-StatePath\pending\<jobId>.json` before the first post, so a lost answer or a crash
  never loses it. The saved copy is the safe one, with no secrets in it. The next run posts it first, byte for
  byte, before it claims anything new.
  - The job does not run again: the replay ledger (`job-ledger.txt`) refuses it.
  - The Hub records a re-post of the same result as `duplicate`.
- A saved result the Hub refuses with a 4xx is moved to `-StatePath\rejected\`, with the Hub's answer next to it.
  It is not retried.
- A claim whose answer was lost leaves that job `running` on the Hub with no result. Recreate it on the Hub.
- The default `-StatePath` is `%ProgramData%\DE\MicrosoftAdmin\hub-worker`, next to the audit log and the replay
  ledger. Results hold tenant data such as names and devices. Limit that folder to the worker's account and
  administrators.

### Set up the Hub (DE)

These are production steps on the Hub. Only DE carries them out.

1. Generate two different random values of at least 32 characters, on a trusted machine. Never commit them.

   ```bash
   openssl rand -base64 48 | tr -d '\n'   # once for MSADMIN_JOB_SIGNING_SECRET, once for MSADMIN_WORKER_SECRET
   ```

2. Add both values to `/etc/intelligence-hub/portal.env`, one per line, then restart the Hub service:

   ```bash
   MSADMIN_JOB_SIGNING_SECRET=<value 1>
   MSADMIN_WORKER_SECRET=<value 2>
   ```

3. Apply the two database migrations, in order. The first adds one table; the second adds the check constraints
   for owner self-approval and plan-mode auto-approval (no data change). Both are safe to run again:

   ```bash
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-02-msadmin-jobs.sql
   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-03-msadmin-jobs-self-and-plan-approval.sql
   ```

   Without the second, a plan-mode change waits for approval and self-approval answers `503 migration_required`.

4. Check the status page. Signed in, `GET /api/msadmin-jobs/status` should say both secrets are configured; it
   never shows their values.

The whole production order (Hub, worker PC, DE Tech Tool) is in [GO-LIVE.md](../../GO-LIVE.md).

### Set up the worker

- **The machine.** A Windows machine or service account with this module, Microsoft.Graph.Authentication
  (`Install-DEMicrosoftDependencies.ps1`) and Microsoft.PowerShell.SecretManagement. For Exchange Online and Azure
  jobs, also ExchangeOnlineManagement and Az.Accounts / Az.Resources (the same script installs all of them; `-Only
  Graph` skips them).
- **The Entra app registration.** An app in the client tenant with a certificate, and the application permissions
  the allowlisted operations need. The certificate goes in the worker account's store, or in LocalMachine with
  private-key access for that account. A client secret is never accepted. For Exchange Online and Azure jobs, add
  the permissions and roles in [Exchange Online and Azure jobs](#exchange-online-and-azure-jobs).
- **The secrets.** Store the same two values in a SecretManagement vault that the worker account can open without a
  prompt, under the names `MSADMIN_JOB_SIGNING_SECRET` and `MSADMIN_WORKER_SECRET`. Examples: SecretStore
  configured with `-Authentication None -Interaction None` for that account (its store sits in that account's
  profile, with no password prompt), or Azure Key Vault.

  ```powershell
  Set-Secret -Vault DE -Name MSADMIN_JOB_SIGNING_SECRET -Secret (Read-Host -AsSecureString 'job signing secret')
  Set-Secret -Vault DE -Name MSADMIN_WORKER_SECRET -Secret (Read-Host -AsSecureString 'worker secret')
  ```

  `-JobSecret` and `-WorkerSecret` (SecureStrings) win over `-Vault`. With neither, the loop reads environment
  variables of the same names, for that run only.

### Run it

At a prompt:

```powershell
Import-Module .\DE-Microsoft-Admin.psd1
Connect-DEMicrosoft -TenantId <tenant guid> -ClientId <app id> -CertificateThumbprint <thumbprint>
Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE -WhatIf   # checks the setup; contacts nothing
Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE -ExchangeOrganization alamoindustries.onmicrosoft.com -WhatIf   # ...and whether Exchange / Azure jobs can sign in
Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE -Once     # one job
Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE           # until the queue is empty
```

- `-HubUrl` must be `https://` and the Hub's address only, with no path. Plain HTTP is refused before anything is
  sent.
- `-WhatIf` contacts nothing. Claiming a job hands it out (approved becomes running), so a what-if run only checks
  the URL, the tenant and the secrets, and says what it would do. To rehearse a change, queue it on the Hub in
  `plan` mode: the worker runs it with `-DryRun`.
- `-WorkerId` defaults to the computer name. The Hub records it on each job.
- `-ExchangeOrganization` and `-AzureSubscriptionId` are needed only for Exchange Online and Azure jobs (see above).

As a scheduled task, every 5 minutes, one instance at a time:

```powershell
# C:\ProgramData\DE\MicrosoftAdmin\Run-DEHubJobs.ps1  (no secrets in this file)
Import-Module 'C:\Program Files\DE\DE-Microsoft-Admin\DE-Microsoft-Admin.psd1'
$null = Connect-DEMicrosoft -TenantId <tenant guid> -ClientId <app id> -CertificateThumbprint <thumbprint>
$r = Invoke-DEHubJobLoop -HubUrl https://hub.example.com -Vault DE -MaxMinutes 10 -ExchangeOrganization <name>.onmicrosoft.com   # add -AzureSubscriptionId <guid> for Azure jobs in one subscription
$r | Select-Object ok, stoppedBecause, message, claimed, posted, pendingLeft, services | Format-List
if (-not $r.ok) { exit 1 }
```

```powershell
$action   = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "C:\ProgramData\DE\MicrosoftAdmin\Run-DEHubJobs.ps1"'
$trigger  = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'DE Microsoft Admin Hub jobs' -Action $action -Trigger $trigger -Settings $settings -User '<worker account>' -Password (Read-Host 'worker account password') -RunLevel Limited
```

A worker serves one tenant: the one it is connected to. For several clients, run one task per tenant, each with
its own app registration.
