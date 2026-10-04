# DE Tech Tool go-live checklist

Everything DE does to put DE Tech Tool, its licences, device intake, email migration records and the DE Microsoft
Admin Hub jobs into production, in the order to do it. Each step says where it is done, the exact command or
setting, how to check it worked, and what breaks if it is skipped.

Written for DE Tech Tool 1.10.2, DE Microsoft Admin 0.5.0, and the Intelligence Hub as merged on `master`
(read 2026-10-03). Hub-side facts come from these Intelligence-Hub documents, which win if they disagree with this
page: `docs/TECHTOOL-LICENSING.md`, `docs/MSADMIN-JOBS.md`, `docs/integrations-v1-openapi.yaml`,
`deploy/.env.example` and `lib/db/migrations/`.

## Before you start

- **Every Hub step is a production action, done only by DE.** The Hub at `https://techsales.digerati-experts.com`
  deploys `master` by itself. Setting a variable, restarting the service and applying a migration change
  production straight away.
- **Secrets never go in a file in a repository, a ticket or a chat.** This page names environment variables and never
  gives values. Generate each value on a trusted machine and keep a copy in DE's password vault.
- **The places:**

  | Where | What it is |
  |---|---|
  | Hub VPS | `ssh de-vps`. The env file is `/etc/intelligence-hub/portal.env`. The source checkout is `/opt/intelligence-hub/source`. Restart with `sudo systemctl restart intelligence-hub`. |
  | Hub UI | `https://techsales.digerati-experts.com`, signed in as `owner_admin` or `technical` |
  | Zoho Sign console | the Zoho Sign webhook that points at the Hub |
  | Entra | the client's Microsoft Entra admin center (one app registration per client tenant) |
  | Build PC | the DE PC that holds the code-signing certificate and a clone of this repository |
  | Technician PC | each copy of DE Tech Tool a technician runs |
  | Worker PC | the Windows machine (or service account) that runs the Microsoft 365 admin jobs |
  | WinPE build PC | a DE PC with the Windows ADK and the Windows PE add-on |

- **Generating a random secret** (the Hub's shared secrets):

  ```bash
  openssl rand -base64 48 | tr -d '\n'
  ```

- **Loading the database URL on the VPS** before running `psql` (it stays in that shell only):

  ```bash
  sudo -i
  set -a; source /etc/intelligence-hub/portal.env; set +a
  cd /opt/intelligence-hub/source
  ```

- **About the migrations.** Each deploy runs the Hub's schema push (`pnpm --filter @workspace/db push`), which may
  already have created the new tables and columns. Run the SQL files anyway, in the order below. Every one of them is
  written to be run again safely (`IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS`), and some carry CHECK constraints that
  only the SQL adds. Keep `-v ON_ERROR_STOP=1` so a failure stops the file.

## Part A. Hub VPS

### A1. Confirm which release the Hub runs

- **Where:** Hub VPS.
- **Do:**

  ```bash
  ssh de-vps 'sudo cat /opt/intelligence-hub/current/RELEASE_SHA'
  ```

- **Verify:** `RELEASE_SHA` equals the `master` commit on GitHub (`digeratiexperts/Intelligence-Hub`). `curl -fsS https://techsales.digerati-experts.com/api/healthz`
  returns `{"status":"ok"}`. Every route below (device intake, licences, Microsoft 365 admin jobs) is on `master`
  as of 2026-10-03.
- **If skipped:** the later checks can fail because a route is missing, not because a setting is wrong.

### A2. Device intake secret: `TECHCONSOLE_TO_HUB_SECRET`

- **Where:** Hub VPS, then DE's password vault.
- **Do:** generate one random value. Add `TECHCONSOLE_TO_HUB_SECRET=<value>` on one line to
  `/etc/intelligence-hub/portal.env`, then restart the service. Store the same value in DE's vault under the name
  `DE_HUB_SIGNING_SECRET`: that is the name DE Tech Tool and the boot rescue use for it (step D3).
- **Verify:** an unsigned request is now refused as unauthorized (401), not as unconfigured (503):

  ```bash
  curl -s -o /dev/null -w '%{http_code}\n' -X POST https://techsales.digerati-experts.com/api/integrations/v1/techconsole/events \
    -H 'Content-Type: application/json' -d '{}'
  ```

  The full proof is the first signed send in step D5.
- **If skipped:** every device record, rescue handoff and migration record is refused with 503. DE Tech Tool saves
  each one to evidence for manual upload, so nothing is lost, but the Hub stays empty.

### A3. Email migration records table

- **Where:** Hub VPS.
- **Do:**

  ```bash
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-09-29-email-migration-records.sql
  ```

- **Verify:** `psql "$DATABASE_URL" -c '\d email_migration_records'` lists the table with its unique index on the
  account and project.
- **If skipped:** `email_migration.recorded` events are refused with 503 ("migration store is not available"), and
  IT Operations shows no migrations.

### A4. Licence signing key: `TECHTOOL_LICENSE_SIGNING_KEY`

- **Where:** a trusted machine (not the repository), then the Hub VPS.
- **Do:**
  1. Generate the key and make a one-line copy for the env file:

     ```bash
     umask 077
     openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out techtool-license-key.pem
     base64 -w0 techtool-license-key.pem > techtool-license-key.b64
     ```

  2. Keep `techtool-license-key.pem` in DE's vault.
  3. Add `TECHTOOL_LICENSE_SIGNING_KEY=<contents of techtool-license-key.b64>` on one line to the env file. Leave
     `TECHTOOL_LICENSE_SIGNING_KEY_PREVIOUS` unset; it is only for a key rotation.
  4. Restart the service, then delete the working copies: `shred -u techtool-license-key.*`.
  5. Apply the licence tables:

     ```bash
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-01-techtool-licenses.sql
     ```

- **Verify:**

  ```bash
  curl -fsS https://techsales.digerati-experts.com/api/techtool/license/jwks          # {"keys":[{"kty":"RSA",...,"alg":"RS256",...}]}
  curl -fsS https://techsales.digerati-experts.com/api/techtool/license/revocations   # {"jti":[],"updatedAt":...}
  ```

  On 2026-10-02 the JWKS still answered `503 licensing_not_configured`.
- **If skipped:** no licence can be issued (activation, the token route, the JWKS and approvals answer 503), and the
  release build in step C2 fails, because it reads the JWKS. A build made with an empty key list cannot verify any
  licence: with the policy `required` every licensed action is refused.

### A5. Profile ids on Hub accounts, and the Zoho events state (2026-10-02)

- **Where:** Hub VPS.
- **Do:**

  ```bash
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-02-techtool-profile-id-and-zoho-inbox-state.sql
  ```

- **Verify:**

  ```bash
  psql "$DATABASE_URL" -c "select conname from pg_constraint where conname in ('accounts_techtool_profile_id_format_check','sync_inbox_apply_state_check')"
  ```

  It returns both names.
- **If skipped:** the profile-id endpoints answer 503, and licence approval falls back to a typed profile id. A
  mistyped id gives a licence for a client the tool does not know. The Zoho events webhook (`/api/webhooks/zoho/events`)
  also answers 503.

### A6. Microsoft 365 admin jobs: two migrations and two secrets

- **Where:** Hub VPS, then DE's vault (the worker reads both secrets in step E3).
- **Do:**
  1. Apply the migrations in order:

     ```bash
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-02-msadmin-jobs.sql
     psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f lib/db/migrations/2026-10-03-msadmin-jobs-self-and-plan-approval.sql
     ```

  2. Generate two different random values, each at least 32 characters. Add `MSADMIN_JOB_SIGNING_SECRET=<value 1>`
     and `MSADMIN_WORKER_SECRET=<value 2>` to the env file, one line each. Leave `MSADMIN_WORKER_SECRET_PREVIOUS`
     unset; it is only for a rotation. Restart the service.
- **Verify:**
  - Signed in to the Hub, open `/api/msadmin-jobs/status`. It shows `"signing":{"configured":true}` and
    `"worker":{"configured":true}`, never the values.
  - `psql "$DATABASE_URL" -c "select conname from pg_constraint where conrelid = 'msadmin_jobs'::regclass"` lists
    `msadmin_jobs_approval_kind_check`, `msadmin_jobs_two_person_check`, `msadmin_jobs_self_approval_check` and
    `msadmin_jobs_auto_plan_check`.
- **If skipped:**
  - Without the first migration, every job route answers `503 not_persisted`.
  - Without the second, a plan-mode change waits for an approver, and owner self-approval answers
    `503 migration_required`.
  - Without the secrets, creating, approving and claiming jobs answer `503 msadmin_not_configured`.
  - If both secrets are given the same value, the worker secret could also sign jobs. Keep them different.

### A7. Zoho Sign webhook: switch to the HMAC signature, close `?token=`

This is a Hub hardening step that belongs in the same window. It is not needed by DE Tech Tool, but it closes the
last webhook that still takes a secret in the URL.

- **Where:** Zoho Sign console, then the Hub VPS.
- **Do:**
  1. In the Zoho Sign console, on the webhook that points at `https://techsales.digerati-experts.com/api/webhooks/zoho-sign`,
     set a secret key (a new random value). Zoho Sign then signs each callback (`X-ZS-WEBHOOK-SIGNATURE`).
  2. Add two lines to the env file, then restart the service:
     - `ZOHO_SIGN_WEBHOOK_HMAC_SECRET=<the same value>`. From then on the Hub accepts only the signature on that
       route, and `ZOHO_SIGN_WEBHOOK_SECRET` (the old shared secret) is not consulted; it can stay as the fallback or
       be removed. The variable is not yet listed in `deploy/.env.example`.
     - `ALLOW_QUERY_TOKEN_ZOHO_SIGN=0`, so a secret in the URL stays refused even if the HMAC secret is ever removed.
  3. Remove `?token=...` from the webhook URL in Zoho Sign.
  4. Leave `ALLOW_QUERY_TOKEN_WEBSITE_LEAD` and `ALLOW_QUERY_TOKEN_ZOHO_EVENTS` unset (their default is off). Set one
     to `1` only for a short migration window, because every use is logged as deprecated.
- **Verify:**
  - Send a test envelope in Zoho Sign. Its status updates on the Hub, and `sudo journalctl -u intelligence-hub --since '10 min ago' | grep -i 'zoho-sign'` shows no `Unauthorized webhook`.
  - An unsigned POST to `/api/webhooks/zoho-sign` answers 401.
- **If skipped:** the Sign webhook keeps accepting the shared secret in the URL (`ALLOW_QUERY_TOKEN_ZOHO_SIGN`
  defaults to on), where proxy and access logs can keep it. If step 2 is done before step 1, every callback is
  refused with 401 until Zoho sends the signature. Signature status polling still catches up, more slowly.

## Part B. Hub UI (accounts and people)

### B1. Hub account numbers and profile ids for each client

- **Where:** Hub UI, Customers > the client's account > Environment.
- **Do:** for each client DE Tech Tool will work on, note the Hub account number shown on the account's page (a
  whole number). Set **DE Tech Tool profile id** to the client profile's `id` in DE Tech Tool (for example `alamo`:
  lower case, letters, digits and dashes).
- **Verify:** the licence approval page (Tech Center > DE Tech Tool licences) shows the saved id for that account
  and does not ask for one.
- **If skipped:** the technician types the profile id at each approval. Device records cannot be filed without the
  account number (step D2).

### B2. Who approves

- **Where:** Hub UI, user roles.
- **Do:** make sure the people who approve licences have `technical` or `owner_admin`, and that at least two people
  have `owner_admin` for Microsoft 365 apply-mode changes (two-person rule). A sole owner can approve their own change
  only by typing the confirmation phrase.
- **Verify:** a second owner_admin sees **Approve** on a test apply-mode job.
- **If skipped:** apply-mode changes wait in the queue, and expire after 24 hours unclaimed.

## Part C. Release build (Build PC)

### C1. Code-signing certificate

- **Where:** Build PC.
- **Do:** get an OV code-signing certificate from a public CA on a USB token (README-WINDOWS.md, "Code signing"
  section), plug it in, and note its thumbprint:

  ```powershell
  Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert | Format-Table Subject, Thumbprint, NotAfter
  ```

- **Verify:** the certificate is listed, not expired, and DE Tech Tool's Settings > Code signing card shows it.
- **If skipped:** a release cannot be signed. An unsigned build runs with a warning, and a client device under
  AllSigned or WDAC refuses it.

### C2. Signed, enforced release from the Hub

- **Where:** Build PC, in a clean checkout of `main` at the commit being released. Steps A4 and A5 must be done
  first.
- **Do:**

  ```powershell
  cd .claude\skills\msp-ai-kit\windows\packaging
  .\New-DEReleasePackage.ps1 -IssuedTo rmm-channel -HubUrl https://techsales.digerati-experts.com -Enforce -Thumbprint <thumbprint>
  ```

  Use one `-IssuedTo` per recipient (a technician's name, or the RMM channel), so a leaked copy names its source.
- **Verify:**
  - It prints the zip `packaging\out\DE-TechTool-v<version>-<buildId>.zip`, its sha256 and `policy required`.
  - `packaging\out\build-register.csv` has the new row.
  - Unpack the zip and run `.\msp-ai-kit\windows\packaging\Sign-DETechConsole.ps1 -Verify -RequireSignature` in
    it; it passes.
  - In the unpacked copy, `msp-ai-kit\windows\console\trust\license-keys.json` holds the Hub's key (`kid`, `n`, `e`;
    no private parts), `trust\revoked.json` exists, and `trust\license-policy.json` says `"enforce": "required"`.
- **If skipped, or built without these switches:**
  - Without `-HubUrl`: no public key, so no licence verifies, and no shipped revocation list.
  - Without `-Enforce`: the policy stays `warn`, and an unlicensed copy can still apply changes (marked UNLICENSED).
  - Without `-Thumbprint`: the build stops. `-SkipSigning` is for test builds only.

### C3. Distribute

- **Where:** RMM or Intune, never a public link.
- **Do:** publish the zip with its sha256. For RMM:

  ```powershell
  .\Deploy-DETechConsole.ps1 -PackageUrl <https url of the zip> -Sha256 <sha256> -RequireSignature
  ```

  For Intune: `.\New-DEIntunePackage.ps1 -IntuneWinAppUtil C:\Tools\IntuneWinAppUtil.exe`. For a technician's own
  PC: the zip and `Install-DETechConsole.ps1` in one folder, then
  `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-DETechConsole.ps1 -Sha256 <sha256>`.
- **Verify:** the window title shows `DE Tech Tool v<version>` and the build id. Settings > Code signing shows the copy
  as signed, and the integrity state is not TAMPERED.
- **If skipped:** technicians keep older builds that do not have the Hub's key or the latest fixes.

## Part D. Technician PC and client profiles

### D1. Hub URL

- **Where:** each technician PC, DE Tech Tool > Settings > Console settings.
- **Do:** set the Hub URL to `https://techsales.digerati-experts.com`.
- **Verify:** Settings > Intelligence Hub connection > **Check the Hub answers** reports 200.
- **If skipped:** no activation, no revocation download at launch, and no Hub sends. Records are saved for manual
  upload.

### D2. Client's Hub account number in the client profile

- **Where:** DE Tech Tool > Settings > Intelligence Hub connection > "Client's Hub account number" > **Save to the
  client profile** (or `"hub": { "accountId": <number> }` in the profile).
- **Verify:** the connection checklist ticks "Client's Hub account number".
- **If skipped:** the device send stops before signing ("the client profile has no hub.accountId"). The Migration page
  asks for the number each time.

### D3. The signing secret for the session: `DE_HUB_SIGNING_SECRET`

- **Where:** each technician PC, one of:
  - Settings > Runtime secrets > "Intelligence Hub signing secret" (typed each session);
  - Settings > "Load from vault", from a SecretManagement vault holding `DE_HUB_SIGNING_SECRET`;
  - an RMM secure variable named `DE_SECRET_DE_HUB_SIGNING_SECRET`.
- **Verify:** the connection checklist ticks "Signing secret for this session".
- **If skipped:** the record is saved for manual upload. If a legacy `DE_HUB_TOKEN` is set, the tool sends a Bearer
  POST instead, which the techconsole route refuses (it requires the HMAC signature).

### D4. Activate a licence

- **Where:** the device being worked on (Settings > Licence > **Activate on this device**), then the Hub UI (Tech
  Center > DE Tech Tool licences).
- **Do:** the tool shows a code. In the Hub, enter the code, check the device key against the chassis serial, choose
  clients, features (`apply`, `toolbox`, `rescue`, `msadmin`) and hours (12 at most), and approve. Pin to the build
  when the licence is for one copy. Headless: `-License <token>` with a token copied from the Hub.
- **Verify:** Settings > Licence shows the licence as valid, with the technician, the device key and the expiry.
- **If skipped:** with the enforced build, applying changes, rolling back, Toolbox scripts, loading client profiles
  and headless `-Apply` are refused.

### D5. First signed sends

- **Where:** a test device, then the Hub UI.
- **Do:** on the Evidence page, **Export the bundle**, then **Send to Intelligence Hub**. On the Email migration
  page of a test project, **Send to Intelligence Hub**.
- **Verify:**
  - The status line says "Sent to the Hub". The evidence line reads `sent to Hub as signed event <id>`, and the
    connection checklist's fourth item ("The same secret on the Hub server") ticks.
  - The device appears on the Hub under the account (asset `asset:<accountId>:detechconsole:<maker>:<SERIAL>`).
  - The migration appears under IT Operations (`GET /api/it-operations/email-migrations?accountId=<id>`).
  - A refusal shows the Hub's own reason, for example `Hub refused: account not mapped`, with the HTTP status. Fix
    what it names: the account number (D2), the secret (A2, D3), or the clock (more than 5 minutes off breaks the
    signature).
- **If skipped:** nobody knows the two halves of the secret match until a real job depends on it.

## Part E. Worker PC (Microsoft 365 admin jobs)

One worker serves one client tenant. For several clients, repeat this part per tenant.

### E1. Entra app registration with a certificate

- **Where:** Entra, in the client tenant.
- **Do:** register an app, upload the public part of a certificate whose private key is on the worker (current user
  store of the worker account, or LocalMachine with private-key access for that account). Grant as **application**
  permissions only what the jobs you will queue need, with admin consent. The Graph names per scenario are in
  `Get-DEMsScopeSet -Scenario Users, Groups, Policy, Intune, Autopilot` (Read is always included). Never create a
  client secret: the module refuses one.
- **Verify:** on the worker,
  `Connect-DEMicrosoft -TenantId <tenant guid> -ClientId <app id> -CertificateThumbprint <thumbprint>` succeeds, and
  `(Get-DEMsContext).TenantId` is the client's tenant.
- **If skipped:** the loop cannot connect, and every job for that tenant waits until it expires.
- **Known limit:** `Connect-DEExchange` signs in as a user (`-UserPrincipalName`), and `Connect-DEAzure` is
  interactive too. So an unattended scheduled worker cannot run the Exchange mailbox or Azure jobs yet. Run those
  from a prompt, or do not queue them for unattended tenants.

### E2. Install the module

- **Where:** Worker PC, elevated.
- **Do:** copy `microsoft\DE-Microsoft-Admin\` from the release to `C:\Program Files\DE\DE-Microsoft-Admin\`, then:

  ```powershell
  & 'C:\Program Files\DE\DE-Microsoft-Admin\Install-DEMicrosoftDependencies.ps1'
  Install-Module Microsoft.PowerShell.SecretManagement, Microsoft.PowerShell.SecretStore -Scope AllUsers
  ```

- **Verify:** `Import-Module 'C:\Program Files\DE\DE-Microsoft-Admin\DE-Microsoft-Admin.psd1'; (Get-Module DE-Microsoft-Admin).Version`
  shows `0.5.0`.
- **If skipped:** the scheduled task fails at its first line.

### E3. The vault with the two Hub secrets

- **Where:** Worker PC, signed in as the worker account.
- **Do:** register a vault that this account can open without a prompt (for example SecretStore with
  `-Authentication None -Interaction None`, or Azure Key Vault), then store the values from step A6 under their own
  names:

  ```powershell
  Set-Secret -Vault DE -Name MSADMIN_JOB_SIGNING_SECRET -Secret (Read-Host -AsSecureString 'job signing secret')
  Set-Secret -Vault DE -Name MSADMIN_WORKER_SECRET -Secret (Read-Host -AsSecureString 'worker secret')
  ```

- **Verify:** `Invoke-DEHubJobLoop -HubUrl https://techsales.digerati-experts.com -Vault DE -WhatIf` reports the URL,
  the tenant and both secrets as ready, and contacts nothing.
- **If skipped, or the values differ from the Hub's:** with a wrong worker secret, every call answers 401 and the
  loop stops with `stoppedBecause: hub_refused`. With a wrong job secret, the first job is reported as `Refused` and
  the loop stops with `stoppedBecause: job_signature`, so the rest of the queue is not refused too.

### E4. Scheduled task

- **Where:** Worker PC, elevated.
- **Do:** write `C:\ProgramData\DE\MicrosoftAdmin\Run-DEHubJobs.ps1` and register the task every 5 minutes, one
  instance at a time, exactly as in the module README ("Run it"). The script holds no secret.
- **Verify:** `Get-ScheduledTaskInfo -TaskName 'DE Microsoft Admin Hub jobs'` shows a last result of 0 after the
  first run. `C:\ProgramData\DE\MicrosoftAdmin\audit.jsonl` has an `Invoke-DEHubJobLoop` line. Limit
  `C:\ProgramData\DE\MicrosoftAdmin\hub-worker` to the worker account and administrators (`icacls`).
- **If skipped:** jobs run only when someone runs the loop by hand.

### E5. First jobs

- **Where:** Hub UI (Tech Center > Microsoft 365 admin jobs), then the worker.
- **Do:** queue a read-only job (for example `Get-DETenantSummary`) for the tenant, then a change in **plan** mode.
- **Verify:** both are approved on creation, claimed within 5 minutes, and end `succeeded` and `dry_run`. The plan
  job changed nothing in the tenant.
- **If skipped:** the first real change is also the first test.

## Part F. Boot rescue media (WinPE build PC)

### F1. Build the media with the Hub URL

- **Where:** WinPE build PC, elevated, from the release's `windows\rescue\`.
- **Do:**

  ```powershell
  .\New-DERescueMedia.ps1 -IsoPath C:\DE\DE-Rescue.iso -HubUrl https://techsales.digerati-experts.com -Technician <name>
  .\New-DERescueMedia.ps1 -UsbDrive E: -ConfirmFormat -HubUrl https://techsales.digerati-experts.com    # erases E:
  ```

  Add `-HubAccountId <number>` only for media made for one client. Add `-DriverPath` for models that need storage or
  network drivers, and `-SecureBoot2023` for devices that only trust the Windows UEFI CA 2023. Run with `-WhatIf`
  first to see every step.
- **Verify:** `rescue.config.json` on the media holds the technician, the Hub URL and (single-client media only) the
  account number, and no secret. On a test device, **Save handoff** offers "Send to the Hub", asks for the account
  number (unless the media carries one) and the signing secret (`DE_HUB_SIGNING_SECRET`, typed, not saved), and
  reports `sent as event <id> for Hub account <number>`.
- **If skipped:** media built without `-HubUrl` never offers to send, so handoffs reach the Hub only through DE Tech
  Tool's review on the next boot.

## Part G. Real-laptop test plan

On a real Windows 10 or 11 laptop (not a VM), with the enforced release from step C2, before wide distribution:

1. Install with `Install-DETechConsole.ps1 -Sha256 <sha256>` from a standard download. The window title shows the
   version and build id, and the integrity state is signed and not tampered.
2. Run `Start-DETechTool.cmd` under **Windows PowerShell 5.1** (no PowerShell 7 on the PC). Confirm
   `$PSVersionTable.PSVersion` in a 5.1 window first.
3. Open every WPF page at the laptop's native resolution and at 125% scaling, and once in high contrast. No page
   is cut off, every button responds, and background jobs report back.
4. Scan & fix in **PLAN ONLY**: discovery reads the **real serial** and maker, and the device key is
   `<maker>:<SERIAL>` matching the chassis sticker. A virtual or OEM-placeholder serial is refused and asks for the
   sticker.
5. Check the data-folder ACL: `icacls C:\ProgramData\DE\TechConsole` shows only SYSTEM (`S-1-5-18`) and
   Administrators (`S-1-5-32-544`) with full control. As a standard user, writing to `profiles\` is refused.
6. Activate a licence (D4), restart the tool, and confirm it stays valid. Revoke it on the Hub, restart the tool, and
   confirm it is refused. With a fresh licence, set the clock back an hour, confirm the licence is refused, and set
   the clock right again.
7. Run one LIVE fix that is safe to undo (for example the lock screen on a Pro edition), then **Undo**, and confirm
   the previous state is back.
8. Export the evidence bundle. Open both reports (HTML and PDF), and confirm the client report carries no vendor
   names or keys.
9. Send to the Hub (D5) with the account number set, then once with a wrong account number: the status shows
   `Hub refused: account not mapped`.
10. Run headless from an elevated 32-bit prompt (`%SystemRoot%\SysWOW64\WindowsPowerShell\v1.0\powershell.exe`):
    `console\DETechConsole.ps1 -Headless -Client <id> -ResultFile C:\DE\result.json`. The result file is written and
    the exit code comes through.
11. Boot the rescue USB (F1) on the same laptop with BitLocker on: unlock with the recovery password, back up a
    profile to a second USB, save the handoff and send it. Boot Windows and confirm DE Tech Tool shows **Review what
    the boot rescue did** first.
12. On a test client mailbox PC, run the Email migration page's **Scan this PC for Gmail** elevated, and confirm other
    accounts are listed as not checked rather than clean.

Record each result (pass, fail and what happened) in the release notes for that build id.

## Part H. Verify everything

Run this when every part is done, and after each Hub deploy that touches these routes:

```bash
# Hub VPS
ssh de-vps 'sudo cat /opt/intelligence-hub/current/RELEASE_SHA'
curl -fsS https://techsales.digerati-experts.com/api/healthz
curl -fsS https://techsales.digerati-experts.com/api/techtool/license/jwks
curl -fsS https://techsales.digerati-experts.com/api/techtool/license/revocations
curl -s -o /dev/null -w 'techconsole unsigned: %{http_code} (want 401)\n' -X POST \
  https://techsales.digerati-experts.com/api/integrations/v1/techconsole/events -H 'Content-Type: application/json' -d '{}'
curl -s -o /dev/null -w 'zoho-sign unsigned: %{http_code} (want 401)\n' -X POST \
  https://techsales.digerati-experts.com/api/webhooks/zoho-sign -H 'Content-Type: application/json' -d '{}'
```

Then, in the root shell from "Before you start" (`DATABASE_URL` loaded):

```bash
psql "$DATABASE_URL" -At <<'SQL'
select to_regclass('email_migration_records'), to_regclass('techtool_licenses'), to_regclass('techtool_license_requests'), to_regclass('msadmin_jobs');
select count(*) from pg_constraint where conname in ('accounts_techtool_profile_id_format_check', 'sync_inbox_apply_state_check',
  'msadmin_jobs_approval_kind_check', 'msadmin_jobs_two_person_check', 'msadmin_jobs_self_approval_check', 'msadmin_jobs_auto_plan_check');
SQL
# want: the four table names on one line, then 6
```

| Check | Where | Pass |
|---|---|---|
| Env names present (names only, never print values) | Hub VPS: `sudo grep -oE '^(TECHCONSOLE_TO_HUB_SECRET\|TECHTOOL_LICENSE_SIGNING_KEY\|MSADMIN_JOB_SIGNING_SECRET\|MSADMIN_WORKER_SECRET\|ZOHO_SIGN_WEBHOOK_HMAC_SECRET\|ALLOW_QUERY_TOKEN_ZOHO_SIGN)=' /etc/intelligence-hub/portal.env` | all six names |
| Job secrets configured | Hub UI: `/api/msadmin-jobs/status` | both `configured: true` |
| Release | Build PC: `build-register.csv`, `Sign-DETechConsole.ps1 -Verify -RequireSignature` | row present, verify passes, policy `required` |
| Technician PC | DE Tech Tool > Settings > Intelligence Hub connection | all four items ticked |
| Licence | DE Tech Tool > Settings > Licence | valid, correct device key |
| Device record | Hub account page | the device under its account, latest evidence |
| Migration record | Hub > IT Operations | the project with its stage |
| Worker | Worker PC: `Get-ScheduledTaskInfo -TaskName 'DE Microsoft Admin Hub jobs'`; Hub job page | last result 0; test jobs `succeeded` and `dry_run` |
| Rescue | test device | handoff sent, reviewed in DE Tech Tool |
| Laptop plan | release notes | Part G all pass |

Only when every row passes is the DE Tech Tool live. Merged code alone is not live.
