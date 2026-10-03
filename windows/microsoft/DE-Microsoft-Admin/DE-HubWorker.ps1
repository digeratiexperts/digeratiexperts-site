<#
    DE Microsoft Admin: the Intelligence Hub job loop (dot-sourced by DE-Microsoft-Admin.psm1).

    The Hub's side of the contract is Intelligence-Hub docs/MSADMIN-JOBS.md and docs/msadmin-jobs-openapi.yaml:
      POST /api/msadmin/worker/v1/jobs/claim          {tenantId, workerId} -> {"job": <signed job>} once, or {"job": null}
      POST /api/msadmin/worker/v1/jobs/<jobId>/result  the New-DEResult object, as JSON
    Both calls are signed with MSADMIN_WORKER_SECRET the way DE Tech Tool signs Hub events (DE.Contracts
    Get-DEHubSignature): HMAC-SHA256 over "POST\n<path>\n<timestamp>\n<request id>\n<sha256 hex of the body bytes>".
    The job itself is verified by Invoke-DEMicrosoftJob with MSADMIN_JOB_SIGNING_SECRET before anything runs.
#>

$script:HubWorkerSource = 'msadmin-worker'
$script:HubClaimPath = '/msadmin/worker/v1/jobs/claim'
$script:HubResultPath = '/msadmin/worker/v1/jobs/{0}/result'
$script:HubGuidShape = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
# The Hub refuses a result with these (Intelligence-Hub findMsadminResultSecrets, reusing the techconsole intake's key rule)
$script:HubSecretKeyShape = '(passw|secret|token|api.?key|recovery.?pass|recovery.?key|connect.?key|private.?key|mfa|seed|^tap$|^pin$)'
# ...and the worker also keeps these back (app passwords are covered by 'passw')
$script:HubWorkerSecretKeyShape = '(recovery|pre.?shared.?key|passcode|credential)'
$script:HubNumericSecretKeyShape = '^(pin|tap)$'
$script:HubSecretValueShapes = @(
    '(?<!\d)\d{6}(-\d{6}){7}(?!\d)',                                            # BitLocker recovery password
    '\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}',          # JWT
    '-----BEGIN [A-Z ]*PRIVATE KEY-----'                                         # PEM private key
)
$script:HubResultMaxBytes = 1900000   # the Hub's worker body limit is 2 MB
$script:HubMinSecretLength = 32       # the Hub refuses shorter secrets

# ============================================================ result safety
function Test-DEHubNumber { param($Value) return ($Value -is [int] -or $Value -is [long] -or $Value -is [double] -or $Value -is [decimal] -or $Value -is [single] -or $Value -is [int16] -or $Value -is [byte] -or $Value -is [uint16] -or $Value -is [uint32] -or $Value -is [uint64] -or $Value -is [sbyte]) }
function Get-DEHubPair {
    <# Name/value pairs of a hashtable (Graph) or an object, the same way for both. #>
    param($Object)
    if ($null -eq $Object) { return }
    if ($Object -is [System.Collections.IDictionary]) { foreach ($k in @($Object.Keys)) { [pscustomobject]@{ Name = "$k"; Value = $Object[$k] } }; return }
    foreach ($p in $Object.PSObject.Properties) { [pscustomobject]@{ Name = $p.Name; Value = $p.Value } }
}
function ConvertTo-DEHubCompliancePolicy {
    <#
        Get-DEIntuneCompliancePolicy for the Hub: the policy's identity, platform and its plain settings. Graph returns
        password* settings as strings (passwordRequiredType) that the Hub refuses, so only their names go, as
        deviceLockRules, never their values.
    #>
    param($Policy)
    $o = [ordered]@{ id = $null; displayName = $null; description = $null; platform = $null; version = $null; createdDateTime = $null; lastModifiedDateTime = $null }
    $settings = [ordered]@{}; $lock = New-Object System.Collections.Generic.List[string]
    foreach ($pair in @(Get-DEHubPair $Policy)) {
        $n = $pair.Name; $v = $pair.Value
        if ($o.Contains($n) -and $n -ne 'platform') { $o[$n] = $(if ($v -is [datetime]) { $v.ToUniversalTime().ToString('o') } else { $v }); continue }
        if ($n -eq '@odata.type') { $o.platform = ("$v" -replace '^#microsoft\.graph\.', ''); continue }
        if ($n -like '@odata*') { continue }
        if ($n -match '^(passw|passcode)') { if ($null -ne $v) { $lock.Add($n) }; continue }
        if ($n -match $script:HubSecretKeyShape -or $n -match $script:HubWorkerSecretKeyShape) { continue }
        if ($v -is [bool] -or $v -is [string] -or (Test-DEHubNumber $v)) { $settings[$n] = $v }
    }
    $o.settings = $settings
    $names = $lock.ToArray(); [Array]::Sort($names, [StringComparer]::Ordinal); $o.deviceLockRules = $names
    return [pscustomobject]$o
}
function Protect-DEHubValue {
    <#
        One value of a parsed result, rebuilt without secret-shaped content, by the Hub's own rules: a key that looks like
        a secret keeps only a true/false, a number (not for pin/tap) or null; any other value under it is removed. A key
        shaped like a BitLocker recovery password is removed. A BitLocker recovery password, JWT or PEM private key
        inside a string is replaced with [removed]. Every path changed is added to $Removed.
    #>
    param($Value, [string]$Path, [System.Collections.Generic.List[string]]$Removed)
    if ($null -eq $Value) { return $null }
    if ($Value -is [string]) {
        $t = $Value; $hit = $false
        foreach ($shape in $script:HubSecretValueShapes) { if ($t -match $shape) { $t = $t -replace $shape, '[removed]'; $hit = $true } }
        if ($hit) { $Removed.Add($(if ($Path) { $Path } else { '(root)' })) }
        return $t
    }
    if ($Value -is [bool] -or (Test-DEHubNumber $Value)) { return $Value }
    if ($Value -is [datetime]) { return $Value.ToUniversalTime().ToString('o') }
    if ($Value -is [System.Collections.IDictionary] -or $Value -is [System.Management.Automation.PSCustomObject]) {
        $out = [ordered]@{}
        foreach ($pair in @(Get-DEHubPair $Value)) {
            $k = $pair.Name; $child = $pair.Value; $next = $(if ($Path) { "$Path.$k" } else { $k })
            if ($k -match $script:HubSecretValueShapes[0]) { $Removed.Add($next); continue }
            if ($k -match $script:HubSecretKeyShape -or $k -match $script:HubWorkerSecretKeyShape) {
                $flag = ($null -eq $child) -or ($child -is [bool]) -or ((Test-DEHubNumber $child) -and $k -notmatch $script:HubNumericSecretKeyShape)
                if (-not $flag) { $Removed.Add($next); continue }
            }
            $out[$k] = (Protect-DEHubValue -Value $child -Path $next -Removed $Removed)
        }
        return $out
    }
    if ($Value -is [System.Collections.IEnumerable]) {
        $list = New-Object System.Collections.Generic.List[object]; $i = 0
        foreach ($item in $Value) { $list.Add((Protect-DEHubValue -Value $item -Path "$Path[$i]" -Removed $Removed)); $i++ }
        return , ($list.ToArray())
    }
    return (Protect-DEHubValue -Value "$Value" -Path $Path -Removed $Removed)
}
function ConvertTo-DEHubSafeResult {
    <#
        The copy of a result that may be sent to the Intelligence Hub, as JSON text, and the paths that were kept back.
        The result itself is not changed: New-DEUser's temporary password stays in the technician's local result.
          * Get-DEIntuneCompliancePolicy: identity, platform and plain settings only (password* setting names, no values).
          * Anything secret-shaped is removed by the Hub's own rules (Protect-DEHubValue), so the Hub never has to refuse it:
            temporaryPassword, passwords, secrets, tokens, MFA, recovery keys, Temporary Access Passes, app passwords.
          * A result over the Hub's 2 MB limit goes without its data, and says so.
    #>
    param([Parameter(Mandatory = $true)][object]$Result)
    $removed = New-Object System.Collections.Generic.List[string]
    $data = $Result.data
    if ("$($Result.operation)" -eq 'Get-DEIntuneCompliancePolicy' -and $null -ne $data) { $data = @(@($data) | ForEach-Object { ConvertTo-DEHubCompliancePolicy $_ }) }
    $shaped = [ordered]@{}
    foreach ($f in @('product', 'version', 'operation', 'status', 'target', 'tenant', 'at', 'message')) { $shaped[$f] = $Result.$f }
    $shaped['data'] = $data
    $utf8 = New-Object Text.UTF8Encoding $false
    $omit = {
        param($Target, [int]$Bytes)
        $d = $Target['data']; $count = $(if ($null -eq $d) { 0 } elseif ($d -is [array]) { $d.Count } else { 1 })
        $Target['data'] = [ordered]@{ omitted = $true; items = $count; bytes = $Bytes; reason = "over the Hub's 2 MB result limit; run the operation locally for the full data" }
        $Target['message'] = ("$($Target['message'])" + " [data not sent: $Bytes bytes is over the Hub's limit]").Trim()
    }
    # judged on the JSON the Hub will read, not on the PowerShell objects (a SecureString becomes {"Length":16})
    $json = ConvertTo-Json -InputObject $shaped -Depth 30
    # too big is decided before parsing (Windows PowerShell 5.1's ConvertFrom-Json has a length limit)
    $bytes = $utf8.GetByteCount($json)
    if ($bytes -gt $script:HubResultMaxBytes) { & $omit $shaped $bytes; $json = ConvertTo-Json -InputObject $shaped -Depth 30 }
    $cf = @{}; if ((Get-Command -Name ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { $cf['DateKind'] = 'String' }
    $tree = $json | ConvertFrom-Json @cf
    $clean = Protect-DEHubValue -Value $tree -Path '' -Removed $removed
    if ($removed.Count) {
        $list = (@($removed | Select-Object -First 5) -join ', ') + $(if ($removed.Count -gt 5) { ", and $($removed.Count - 5) more" } else { '' })
        $clean['message'] = ("$($clean['message'])" + " [kept on the worker, not sent to the Hub: $list]").Trim()
    }
    $out = ConvertTo-Json -InputObject $clean -Depth 30
    $bytes = $utf8.GetByteCount($out)
    if ($bytes -gt $script:HubResultMaxBytes) { & $omit $clean $bytes; $out = ConvertTo-Json -InputObject $clean -Depth 30 }
    return [pscustomobject]@{ Json = $out; Removed = $removed.ToArray() }
}

# ============================================================ signed calls to the Hub
function ConvertTo-DESecureText {
    param([Parameter(Mandatory = $true)][string]$Text)
    $s = New-Object Security.SecureString; foreach ($c in $Text.ToCharArray()) { $s.AppendChar($c) }; $s.MakeReadOnly(); return $s
}
function Test-DESecureTextEqual {
    param([Parameter(Mandatory = $true)][securestring]$A, [Parameter(Mandatory = $true)][securestring]$B)
    $ba = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($A); $bb = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($B)
    try { return ([Runtime.InteropServices.Marshal]::PtrToStringBSTR($ba) -ceq [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bb)) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ba); [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bb) }
}
function Resolve-DEHubWorkerSecret {
    <# A Hub secret for this run only: the value passed in, else the SecretManagement vault, else the environment variable. Never written anywhere. #>
    param([Parameter(Mandatory = $true)][string]$Name, [securestring]$Value, [string]$Vault)
    if ($Value -and $Value.Length) { return $Value }
    if ($Vault) {
        if (-not (Get-Command -Name Get-Secret -ErrorAction SilentlyContinue)) {
            try { Import-Module Microsoft.PowerShell.SecretManagement -ErrorAction Stop } catch { throw "Microsoft.PowerShell.SecretManagement is not installed: install it and register the vault '$Vault' first" }
        }
        try { $s = Get-Secret -Name $Name -Vault $Vault -ErrorAction Stop } catch { throw "$Name could not be read from the vault '$Vault': $($_.Exception.Message)" }
        if ($s -is [securestring]) { return $s }
        if ($s -is [string]) { return (ConvertTo-DESecureText $s) }
        throw "$Name in the vault '$Vault' is not a text secret"
    }
    $plain = [Environment]::GetEnvironmentVariable($Name)
    if ($plain) { $s = ConvertTo-DESecureText $plain; $plain = $null; return $s }
    return $null
}
function Get-DEHubWorkerSignature {
    <# HMAC-SHA256 (hex) with the worker secret over POST, the path, the timestamp, the request id and the SHA-256 of the exact body bytes. #>
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Timestamp, [Parameter(Mandatory = $true)][string]$RequestId, [Parameter(Mandatory = $true)][AllowEmptyCollection()][byte[]]$BodyBytes, [Parameter(Mandatory = $true)][securestring]$Secret)
    $utf8 = New-Object Text.UTF8Encoding $false
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $bodyHash = -join ($sha.ComputeHash($BodyBytes) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { $key = $utf8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $h = New-Object Security.Cryptography.HMACSHA256 (, $key)
    try { return (-join ($h.ComputeHash($utf8.GetBytes((@('POST', $Path, $Timestamp, $RequestId, $bodyHash) -join "`n"))) | ForEach-Object { $_.ToString('x2') })) }
    finally { $h.Dispose(); [Array]::Clear($key, 0, $key.Length) }
}
function Invoke-DEHubWorkerHttp {
    <#
        The worker's only network call (tests replace it). Sends the exact bytes that were signed and returns the HTTP
        status and body. Throws only when no HTTP answer came back (timeout, DNS, TLS, connection refused).
    #>
    param([Parameter(Mandatory = $true)][string]$Uri, [Parameter(Mandatory = $true)][hashtable]$Headers, [Parameter(Mandatory = $true)][AllowEmptyCollection()][byte[]]$Body, [int]$TimeoutSec = 60)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { Write-Verbose 'TLS 1.2 could not be added to the allowed protocols' }
    try {
        $r = Invoke-WebRequest -Uri $Uri -Method Post -Headers $Headers -Body $Body -ContentType 'application/json; charset=utf-8' -UseBasicParsing -TimeoutSec $TimeoutSec -MaximumRedirection 0 -ErrorAction Stop
        return [pscustomobject]@{ StatusCode = [int]$r.StatusCode; Content = [string]$r.Content }
    } catch {
        $resp = $null; try { $resp = $_.Exception.Response } catch { $resp = $null }
        $code = 0; if ($resp) { try { $code = [int]$resp.StatusCode } catch { $code = 0 } }
        if (-not $code) { throw }
        $text = "$($_.ErrorDetails.Message)"
        if (-not $text -and $resp -is [System.Net.WebResponse]) { try { $sr = New-Object IO.StreamReader ($resp.GetResponseStream()); try { $text = $sr.ReadToEnd() } finally { $sr.Dispose() } } catch { $text = '' } }
        return [pscustomobject]@{ StatusCode = $code; Content = $text }
    }
}
function Invoke-DEHubWorkerCall {
    <#
        One signed call to the Hub's worker API, retried with backoff (bounded by -MaxRetries) when no answer came, on
        5xx, 408 and 429. Each attempt has a new request id and timestamp (the Hub refuses a reused id as a replay).
        Returns StatusCode (0 = no answer), Content, Attempts, Error and Transient; never throws for a network failure.
    #>
    param([Parameter(Mandatory = $true)][string]$HubUrl, [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Body, [Parameter(Mandatory = $true)][securestring]$Secret, [int]$MaxRetries = 4, [double]$RetryBaseSeconds = 2, [int]$TimeoutSec = 60)
    $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($Body)
    $apiPath = "/api$Path"; $attempt = 0
    while ($true) {
        $attempt++
        $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)
        $id = [guid]::NewGuid().ToString()
        $sig = Get-DEHubWorkerSignature -Path $apiPath -Timestamp $ts -RequestId $id -BodyBytes $bytes -Secret $Secret
        $headers = @{ 'X-DE-Event-ID' = $id; 'X-DE-Timestamp' = $ts; 'X-DE-Source' = $script:HubWorkerSource; 'X-DE-Signature' = $sig }
        $resp = $null; $err = $null
        try { $resp = Invoke-DEHubWorkerHttp -Uri ($HubUrl + $apiPath) -Headers $headers -Body $bytes -TimeoutSec $TimeoutSec } catch { $err = "$($_.Exception.Message)" }
        $code = $(if ($resp) { [int]$resp.StatusCode } else { 0 })
        $transient = ($code -eq 0) -or ($code -ge 500) -or ($code -in @(408, 429))
        if (-not $transient -or $attempt -gt $MaxRetries) {
            return [pscustomobject]@{ StatusCode = $code; Content = $(if ($resp) { "$($resp.Content)" } else { '' }); Attempts = $attempt; Error = $err; Transient = $transient }
        }
        $wait = [Math]::Min([double]60, $RetryBaseSeconds * [Math]::Pow(2, $attempt - 1))   # [double]: Min(60, 0.4) would pick the Int32 overload and wait 0
        Write-Verbose ("Hub {0}: {1}; retry {2} of {3} in {4} s" -f $Path, $(if ($code) { "HTTP $code" } else { 'no answer' }), $attempt, $MaxRetries, $wait)
        if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]($wait * 1000)) }
    }
}
function Get-DEHubAnswerText {
    <# What the Hub said, for a person: status, the Hub's error code and message (never a body with data). #>
    param([Parameter(Mandatory = $true)]$Call)
    if (-not $Call.StatusCode) { return "no answer from the Hub after $($Call.Attempts) attempt(s): $($Call.Error)" }
    $e = $null; try { $e = "$($Call.Content)" | ConvertFrom-Json -ErrorAction Stop } catch { $e = $null }
    $detail = $(if ($e -and $e.PSObject.Properties['error']) { "$($e.error)$(if ($e.PSObject.Properties['message'] -and $e.message) { ": $($e.message)" })" } else { (("$($Call.Content)" -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim()) })
    if ($detail.Length -gt 300) { $detail = $detail.Substring(0, 300) + '...' }
    return ("the Hub answered HTTP $($Call.StatusCode)$(if ($Call.Attempts -gt 1) { " after $($Call.Attempts) attempts" })$(if ($detail) { " ($detail)" })")
}
function Get-DEHubRefusalHint {
    param([int]$StatusCode, [string]$What)
    switch ($StatusCode) {
        401 { return 'Check that MSADMIN_WORKER_SECRET is the same on the Hub and on this worker, and that this machine''s clock is within 5 minutes.' }
        404 { if ($What -eq 'claim') { return 'Check the Hub URL: this Hub has no DE Microsoft Admin worker API (a release before the msadmin jobs, or another site).' } else { return 'The Hub does not know this job.' } }
        503 { return 'The Hub is not ready: MSADMIN_JOB_SIGNING_SECRET / MSADMIN_WORKER_SECRET unset on the Hub, or its msadmin_jobs migration not applied (docs/MSADMIN-JOBS.md).' }
        default { return '' }
    }
}
function Send-DEHubPendingResult {
    <#
        Posts one saved result (the exact text written before the first try) and settles its file: recorded or
        duplicate -> deleted; a 4xx -> moved to rejected\ with the Hub's answer; no answer or 5xx -> left for the next run.
    #>
    param([Parameter(Mandatory = $true)][string]$File, [Parameter(Mandatory = $true)][string]$JobId, [Parameter(Mandatory = $true)][string]$HubUrl, [Parameter(Mandatory = $true)][securestring]$Secret, [Parameter(Mandatory = $true)][string]$RejectedDir, [hashtable]$Retry = @{})
    $body = [IO.File]::ReadAllText($File, (New-Object Text.UTF8Encoding $false))
    $call = Invoke-DEHubWorkerCall -HubUrl $HubUrl -Path ($script:HubResultPath -f $JobId) -Body $body -Secret $Secret @Retry
    $text = Get-DEHubAnswerText -Call $call
    if ($call.StatusCode -ge 200 -and $call.StatusCode -lt 300) {
        $hubStatus = $null; try { $hubStatus = "$(("$($call.Content)" | ConvertFrom-Json -ErrorAction Stop).status)" } catch { $hubStatus = $null }
        Remove-Item -LiteralPath $File -Force -WhatIf:$false
        $state = $(if ($hubStatus -eq 'duplicate') { 'duplicate' } else { 'recorded' })
        Write-DEMsAudit -Operation 'Invoke-DEHubJobLoop' -Status 'Posted' -Target $JobId -Message "result $state by the Hub" -JobId $JobId
        return [pscustomobject]@{ State = $state; Answer = $text; StatusCode = $call.StatusCode }
    }
    if ($call.Transient) {
        Write-DEMsAudit -Operation 'Invoke-DEHubJobLoop' -Status 'Pending' -Target $JobId -Message "result kept for the next run: $text" -JobId $JobId
        return [pscustomobject]@{ State = 'pending'; Answer = $text; StatusCode = $call.StatusCode }
    }
    if (-not (Test-Path -LiteralPath $RejectedDir)) { New-Item -ItemType Directory -Path $RejectedDir -Force -WhatIf:$false | Out-Null }
    Move-Item -LiteralPath $File -Destination (Join-Path $RejectedDir "$JobId.json") -Force -WhatIf:$false
    [IO.File]::WriteAllText((Join-Path $RejectedDir "$JobId.answer.txt"), $text, (New-Object Text.UTF8Encoding $false))
    Write-DEMsAudit -Operation 'Invoke-DEHubJobLoop' -Status 'Rejected' -Target $JobId -Message $text -JobId $JobId
    return [pscustomobject]@{ State = 'rejected'; Answer = $text; StatusCode = $call.StatusCode }
}

# ============================================================ the loop
function Invoke-DEHubJobLoop {
    <#
    .SYNOPSIS
        Claims the Intelligence Hub's approved jobs for the connected tenant, verifies and runs each with
        Invoke-DEMicrosoftJob, and posts each result back, until the queue is empty or a limit is reached.
    .DESCRIPTION
        Connect first, app-only with a certificate (Connect-DEMicrosoft -TenantId -ClientId -CertificateThumbprint).
        Then, each run:
          1. Results that ran earlier but could not be posted (kept under -StatePath\pending, without secrets) are
             posted first. A job is never run twice: Invoke-DEMicrosoftJob's replay ledger refuses it anyway.
          2. A job is claimed for the connected tenant. Invoke-DEMicrosoftJob checks it before anything runs: the
             signature (MSADMIN_JOB_SIGNING_SECRET), its validity window, the replay ledger, the tenant, the allowlist,
             the parameters and, for a change, apply mode with approvedBy. A refused job is reported as Refused.
          3. The result is made safe for the Hub (ConvertTo-DEHubSafeResult), saved, posted, and the saved copy
             removed once the Hub has it. New-DEUser's temporary password stays in the local result only.
        Network: no answer, 5xx, 408 and 429 are retried with backoff (-MaxRetries); then the run stops and the result
        waits for the next run. A 4xx stops the run with the Hub's reason. A job refused because its signature does
        not verify stops the run too (the two sides' MSADMIN_JOB_SIGNING_SECRET probably differ).
        Secrets: -JobSecret / -WorkerSecret, else -Vault (SecretManagement, secrets named MSADMIN_JOB_SIGNING_SECRET
        and MSADMIN_WORKER_SECRET), else the environment variables of those names. Held for this run only; never
        written, logged or sent.
        -WhatIf contacts nothing: claiming hands a job out (approved -> running), so a what-if run only checks the setup
        and says what it would do. Rehearse a change with a plan-mode job, which the worker runs as -DryRun.
    .OUTPUTS
        One summary: ok, stoppedBecause (queue_empty, max_jobs, time_budget, whatif, busy, network, hub_refused,
        job_signature), message, counts, and each job with its local result (as the operation returned it).
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$HubUrl,
        [securestring]$JobSecret,
        [securestring]$WorkerSecret,
        [string]$Vault,
        [string]$WorkerId,
        [switch]$Once,
        [ValidateRange(1, 1000)][int]$MaxJobs = 50,
        [ValidateRange(1, 1440)][int]$MaxMinutes = 30,
        [string]$StatePath = (Join-Path (Split-Path -Parent $script:AuditPath) 'hub-worker'),
        [string]$LedgerPath = (Join-Path (Split-Path -Parent $script:AuditPath) 'job-ledger.txt'),
        [ValidateRange(0, 10)][int]$MaxRetries = 4,
        [ValidateRange(0, 60)][double]$RetryBaseSeconds = 2,
        [ValidateRange(1, 600)][int]$TimeoutSec = 60
    )
    # ---- setup problems throw: nothing has been claimed or run
    $u = $null
    if (-not [uri]::TryCreate($HubUrl, [UriKind]::Absolute, [ref]$u) -or $u.Scheme -ne 'https') { throw "The Hub URL must start with https:// (got '$HubUrl'): the worker never sends a signed call over plain HTTP." }
    if ($u.AbsolutePath -ne '/' -or $u.Query -or $u.Fragment -or $u.UserInfo) { throw "Give the Hub's address only, like https://hub.example.com (got '$HubUrl')." }
    $base = $u.GetLeftPart([UriPartial]::Authority)
    $tenant = "$($script:Ctx.TenantId)"
    if ($tenant -notmatch $script:HubGuidShape) { throw "Connect to the client tenant first (Connect-DEMicrosoft -TenantId <tenant> -ClientId <app id> -CertificateThumbprint <thumbprint>): the Hub needs the connected tenant's id (a GUID), got '$tenant'." }
    $tenant = $tenant.ToLowerInvariant()
    if (-not $WorkerId) { $WorkerId = ("$(if ($env:COMPUTERNAME) { $env:COMPUTERNAME } else { [Environment]::MachineName })" -replace '[^A-Za-z0-9._-]', '-') }
    if ($WorkerId.Length -gt 64) { $WorkerId = $WorkerId.Substring(0, 64) }
    if ($WorkerId -notmatch '^[A-Za-z0-9._-]{1,64}$') { throw "WorkerId must be 1 to 64 letters, digits, '.', '_' or '-' (got '$WorkerId')." }
    $JobSecret = Resolve-DEHubWorkerSecret -Name 'MSADMIN_JOB_SIGNING_SECRET' -Value $JobSecret -Vault $Vault
    $WorkerSecret = Resolve-DEHubWorkerSecret -Name 'MSADMIN_WORKER_SECRET' -Value $WorkerSecret -Vault $Vault
    foreach ($s in @(@('MSADMIN_JOB_SIGNING_SECRET', $JobSecret, '-JobSecret'), @('MSADMIN_WORKER_SECRET', $WorkerSecret, '-WorkerSecret'))) {
        if (-not $s[1]) { throw "$($s[0]) is not set: pass $($s[2]), -Vault <SecretManagement vault>, or set the environment variable for this run." }
        if ($s[1].Length -lt $script:HubMinSecretLength) { throw "$($s[0]) is shorter than $script:HubMinSecretLength characters (the Hub refuses it)." }
    }
    if (Test-DESecureTextEqual -A $JobSecret -B $WorkerSecret) { throw 'MSADMIN_WORKER_SECRET must differ from MSADMIN_JOB_SIGNING_SECRET (the Hub refuses the same value for both).' }

    $pendingDir = Join-Path $StatePath 'pending'; $rejectedDir = Join-Path $StatePath 'rejected'
    $retry = @{ MaxRetries = $MaxRetries; RetryBaseSeconds = $RetryBaseSeconds; TimeoutSec = $TimeoutSec }
    $max = $(if ($Once) { 1 } else { $MaxJobs })
    $jobs = New-Object System.Collections.Generic.List[object]
    $summary = [ordered]@{ ok = $false; stoppedBecause = $null; message = ''; hubUrl = $base; tenantId = $tenant; workerId = $WorkerId; startedAt = (Get-Date).ToUniversalTime().ToString('o'); finishedAt = $null; claimed = 0; posted = 0; pendingPosted = 0; pendingLeft = 0; rejected = 0; jobs = @() }
    $finish = {
        param([string]$Why, [string]$Message)
        $summary.stoppedBecause = $Why; $summary.message = $Message
        $summary.ok = ($Why -in @('queue_empty', 'max_jobs', 'time_budget', 'whatif'))
        $summary.pendingLeft = @(Get-ChildItem -LiteralPath $pendingDir -Filter '*.json' -File -ErrorAction SilentlyContinue).Count
        $summary.jobs = $jobs.ToArray(); $summary.finishedAt = (Get-Date).ToUniversalTime().ToString('o')
        if (-not $summary.ok) { Write-Warning "Hub job loop stopped ($Why): $Message" } else { Write-Verbose "Hub job loop finished ($Why): $Message" }
        Write-DEMsAudit -Operation 'Invoke-DEHubJobLoop' -Status $Why -Target $base -Message ("$Message (claimed $($summary.claimed), posted $($summary.posted), earlier results posted $($summary.pendingPosted), waiting $($summary.pendingLeft))")
        return [pscustomobject]$summary
    }

    if (-not $PSCmdlet.ShouldProcess($base, "claim and run up to $max approved job(s) for tenant $tenant as $WorkerId")) {
        $n = @(Get-ChildItem -LiteralPath $pendingDir -Filter '*.json' -File -ErrorAction SilentlyContinue).Count
        return (& $finish 'whatif' "nothing claimed or posted (claiming hands a job out); setup is complete; $n earlier result(s) waiting to be posted")
    }

    foreach ($d in @($StatePath, $pendingDir)) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force -WhatIf:$false | Out-Null } }
    $lock = $null
    try { $lock = [IO.File]::Open((Join-Path $StatePath 'worker.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None) }
    catch { return (& $finish 'busy' "another Hub job loop is running on this machine (lock $(Join-Path $StatePath 'worker.lock'))") }
    try {
        # ---- 1. results that ran but were not posted
        foreach ($f in @(Get-ChildItem -LiteralPath $pendingDir -Filter '*.json' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTimeUtc)) {
            $jid = $f.BaseName
            if ($jid -notmatch $script:HubGuidShape) { continue }
            $p = Send-DEHubPendingResult -File $f.FullName -JobId $jid -HubUrl $base -Secret $WorkerSecret -RejectedDir $rejectedDir -Retry $retry
            $jobs.Add([pscustomobject]@{ jobId = $jid; operation = $null; status = $null; earlierRun = $true; hub = $p.State; hubAnswer = $p.Answer; removed = @(); localResult = $null })
            switch ($p.State) {
                'pending' { return (& $finish 'network' "an earlier result for job $jid could not be posted ($($p.Answer)); it is kept for the next run and no new job was claimed") }
                'rejected' { $summary.rejected++; return (& $finish 'hub_refused' "the Hub refused the earlier result for job $jid ($($p.Answer)); it was moved to $rejectedDir. $(Get-DEHubRefusalHint $p.StatusCode 'result')".Trim()) }
                default { $summary.pendingPosted++ }
            }
        }
        # ---- 2. claim, verify, run, post
        $deadline = (Get-Date).AddMinutes($MaxMinutes)
        while ($true) {
            if ($summary.claimed -ge $max) { return (& $finish 'max_jobs' "stopped after $max job(s)") }
            if ((Get-Date) -ge $deadline) { return (& $finish 'time_budget' "stopped after $MaxMinutes minute(s)") }
            $claim = Invoke-DEHubWorkerCall -HubUrl $base -Path $script:HubClaimPath -Body ('{"tenantId":"' + $tenant + '","workerId":"' + $WorkerId + '"}') -Secret $WorkerSecret @retry
            if ($claim.StatusCode -lt 200 -or $claim.StatusCode -ge 300) {
                $text = Get-DEHubAnswerText -Call $claim
                if ($claim.Transient) { return (& $finish 'network' "could not claim a job: $text. $(Get-DEHubRefusalHint $claim.StatusCode 'claim')".Trim()) }
                return (& $finish 'hub_refused' "the Hub refused the claim: $text. $(Get-DEHubRefusalHint $claim.StatusCode 'claim')".Trim())
            }
            $body = "$($claim.Content)".Trim()
            if ($body -match '^\{\s*"job"\s*:\s*null\s*\}$') { return (& $finish 'queue_empty' 'no approved job is waiting for this tenant') }
            # the job's exact text goes to the verifier: re-serialising it would change the signed bytes
            $m = [regex]::Match($body, '^\{\s*"job"\s*:\s*(\{[\s\S]*\})\s*\}$')
            if (-not $m.Success) { return (& $finish 'hub_refused' 'the Hub''s claim answer is not {"job": ...}; nothing was run') }
            $jobJson = $m.Groups[1].Value
            $summary.claimed++
            # only the id (to address the result) and the operation (for the summary) are read before verification
            $cf = @{}; if ((Get-Command -Name ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { $cf['DateKind'] = 'String' }
            $peek = $null; try { $peek = $jobJson | ConvertFrom-Json @cf } catch { $peek = $null }
            $jid = "$(if ($peek) { $peek.jobId })"
            if ($jid -notmatch $script:HubGuidShape) { return (& $finish 'hub_refused' 'the Hub handed out a job without a valid jobId; nothing was run and no result can be addressed') }
            $jid = $jid.ToLowerInvariant()
            Write-Verbose "job $jid ($($peek.operation), $($peek.mode)): verifying and running"
            try { $out = @(Invoke-DEMicrosoftJob -JobJson $jobJson -Secret $JobSecret -LedgerPath $LedgerPath) }
            catch { $out = @(New-DEResult -Operation 'Invoke-DEMicrosoftJob' -Status Failed -Target $jid -Message "the worker could not run the job: $($_.Exception.Message)" -JobId $jid) }
            $local = @($out | Where-Object { $_ -and $_.PSObject.Properties['product'] -and $_.PSObject.Properties['status'] }) | Select-Object -Last 1
            if (-not $local) { $local = New-DEResult -Operation 'Invoke-DEMicrosoftJob' -Status Failed -Target $jid -Message 'the operation returned no result' -JobId $jid }
            $safe = ConvertTo-DEHubSafeResult -Result $local
            $file = Join-Path $pendingDir "$jid.json"
            [IO.File]::WriteAllText($file, $safe.Json, (New-Object Text.UTF8Encoding $false))   # written before the first try: a lost answer or a crash never loses it
            if ($local.data -and $local.data.PSObject.Properties['temporaryPassword']) {
                Write-Host "Job $jid ($($local.operation) $($local.target)): the temporary password stays on this machine, in this run's output (jobs[].localResult.data.temporaryPassword, a SecureString). It was not sent to the Hub."
            }
            $p = Send-DEHubPendingResult -File $file -JobId $jid -HubUrl $base -Secret $WorkerSecret -RejectedDir $rejectedDir -Retry $retry
            $jobs.Add([pscustomobject]@{ jobId = $jid; operation = "$($local.operation)"; status = "$($local.status)"; earlierRun = $false; hub = $p.State; hubAnswer = $p.Answer; removed = $safe.Removed; localResult = $local })
            switch ($p.State) {
                'pending' { return (& $finish 'network' "job $jid ran ($($local.status)) but its result could not be posted ($($p.Answer)); it is kept for the next run, and the job will not run again") }
                'rejected' { $summary.rejected++; return (& $finish 'hub_refused' "the Hub refused the result of job $jid ($($p.Answer)); it was moved to $rejectedDir. $(Get-DEHubRefusalHint $p.StatusCode 'result')".Trim()) }
                default { $summary.posted++ }
            }
            if ("$($local.status)" -eq 'Refused' -and "$($local.message)" -eq 'signature does not verify') {
                return (& $finish 'job_signature' "job $jid did not verify and was reported as Refused; stopping so the rest of the queue is not refused too. Check that MSADMIN_JOB_SIGNING_SECRET is the same on the Hub and on this worker.")
            }
        }
    } finally { if ($lock) { $lock.Dispose() } }
}
