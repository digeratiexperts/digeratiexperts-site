# DE Microsoft Admin: the Intelligence Hub job loop. Graph and the Hub's HTTP layer are mocked; the Hub's signature
# check and its secret-content rules are re-implemented here independently. Pester 5.
Describe 'DE Microsoft Admin Hub job loop' {
    BeforeAll {
        function global:Invoke-MgGraphRequest { param([string]$Method, [string]$Uri, $Body, [hashtable]$Headers, [string]$ContentType, [string]$OutputType) throw 'not mocked' }
        function global:Get-MgContext { param() throw 'not mocked' }
        function global:Connect-MgGraph { param([string]$TenantId, [string[]]$Scopes, [string]$ClientId, [string]$CertificateThumbprint, [switch]$NoWelcome) throw 'not mocked' }
        $mod = @((Join-Path (Split-Path -Parent $PSScriptRoot) 'microsoft/DE-Microsoft-Admin/DE-Microsoft-Admin.psd1'), (Join-Path (Split-Path -Parent $PSScriptRoot) 'DE-Microsoft-Admin.psd1')) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        Import-Module $mod -Force
        function global:ConvertTo-HwSecure([string]$s) { $x = New-Object Security.SecureString; foreach ($c in $s.ToCharArray()) { $x.AppendChar($c) }; $x.MakeReadOnly(); return $x }
        $global:HwT = @{
            Dir = Join-Path ([IO.Path]::GetTempPath()) ("de-hubworker-" + [guid]::NewGuid().ToString('N'))
            Tenant = '0f0e0d0c-1111-2222-3333-444455556666'; Other = '99999999-aaaa-bbbb-cccc-dddddddddddd'
            JobPlain = 'job-signing-secret-for-tests-0123456789abcdef'; WorkerPlain = 'worker-transport-secret-for-tests-0123456789'
            Hub = 'https://hub.example.test'
        }
        $global:HwT.JobSecret = ConvertTo-HwSecure $global:HwT.JobPlain
        $global:HwT.WorkerSecret = ConvertTo-HwSecure $global:HwT.WorkerPlain
        New-Item -ItemType Directory -Path $global:HwT.Dir -Force | Out-Null
        $null = Set-DEMsAuditPath -Path (Join-Path $global:HwT.Dir 'audit.jsonl')

        # the Hub's signature check (Intelligence-Hub msadmin-job-auth.ts), written separately from the module's
        function global:Test-HwSignature {
            param($Call)
            $utf8 = New-Object Text.UTF8Encoding $false
            $sha = [Security.Cryptography.SHA256]::Create(); $hash = -join ($sha.ComputeHash($utf8.GetBytes($Call.Body)) | ForEach-Object { $_.ToString('x2') }); $sha.Dispose()
            $h = New-Object Security.Cryptography.HMACSHA256 (, $utf8.GetBytes($global:HwT.WorkerPlain))
            $want = -join ($h.ComputeHash($utf8.GetBytes("POST`n$($Call.Path)`n$($Call.Headers['X-DE-Timestamp'])`n$($Call.Headers['X-DE-Event-ID'])`n$hash")) | ForEach-Object { $_.ToString('x2') }); $h.Dispose()
            return ($want -eq $Call.Headers['X-DE-Signature'])
        }
        # the Hub's result intake rule (Intelligence-Hub findMsadminResultSecrets), on the posted JSON
        function global:Find-HwSecret {
            param($Value, [string]$Path = '')
            $found = New-Object System.Collections.Generic.List[string]
            $keyRe = '(passw|secret|token|api.?key|recovery.?pass|recovery.?key|connect.?key|private.?key|mfa|seed|^tap$|^pin$)'
            $valRe = '(?<!\d)\d{6}(-\d{6}){7}(?!\d)|\beyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
            $walk = $null
            $walk = {
                param($V, $P)
                if ($V -is [string]) { if ($V -cmatch $valRe) { $found.Add($P) }; return }
                if ($V -is [System.Management.Automation.PSCustomObject]) {
                    foreach ($pr in $V.PSObject.Properties) {
                        $n = $(if ($P) { "$P.$($pr.Name)" } else { $pr.Name }); $c = $pr.Value
                        if ($pr.Name -match '(?<!\d)\d{6}(-\d{6}){7}(?!\d)') { $found.Add($n); continue }
                        if ($pr.Name -match $keyRe) {
                            $num = ($c -is [int] -or $c -is [long] -or $c -is [double] -or $c -is [decimal])
                            if (-not (($null -eq $c) -or ($c -is [bool]) -or ($num -and $pr.Name -notmatch '^(pin|tap)$'))) { $found.Add($n); continue }
                        }
                        & $walk $c $n
                    }
                    return
                }
                if ($V -is [System.Collections.IEnumerable]) { $i = 0; foreach ($x in $V) { & $walk $x "$P[$i]"; $i++ } }
            }
            & $walk $Value $Path
            return , $found.ToArray()
        }
        function global:New-HwJob {
            param([string]$Operation, [hashtable]$Parameters = @{}, [string]$Mode = 'plan', [string]$ApprovedBy, [string]$Tenant = $global:HwT.Tenant)
            $j = New-DEMicrosoftJob -TenantId $Tenant -Operation $Operation -Parameters $Parameters -Mode $Mode -ApprovedBy $ApprovedBy -RequestedBy 'tech@digerati-experts.com' -Secret $global:HwT.JobSecret
            return ($j | ConvertTo-Json -Depth 6 -Compress)
        }
        function global:Reset-Hw {
            param([string[]]$Queue = @())
            $global:HwT.Queue = New-Object System.Collections.Generic.List[string]; foreach ($q in $Queue) { $global:HwT.Queue.Add($q) }
            $global:HwT.Calls = New-Object System.Collections.Generic.List[object]
            $global:HwT.Posts = New-Object System.Collections.Generic.List[object]
            $global:HwT.Graph = New-Object System.Collections.Generic.List[string]
            $global:HwT.Http = $null; $global:HwT.Sleeps = New-Object System.Collections.Generic.List[int]
            $global:HwT.State = Join-Path $global:HwT.Dir ("state-" + [guid]::NewGuid().ToString('N'))
            $global:HwT.Ledger = Join-Path $global:HwT.State 'ledger.txt'
        }
        function global:Invoke-HwLoop {
            param([hashtable]$Extra = @{})
            $p = @{ HubUrl = $global:HwT.Hub; JobSecret = $global:HwT.JobSecret; WorkerSecret = $global:HwT.WorkerSecret; WorkerId = 'TEST-WORKER'; StatePath = $global:HwT.State; LedgerPath = $global:HwT.Ledger; RetryBaseSeconds = 0; MaxRetries = 2 }
            foreach ($k in $Extra.Keys) { $p[$k] = $Extra[$k] }
            return (Invoke-DEHubJobLoop @p)
        }
        function global:Get-HwPostedResults { return @($global:HwT.Posts | ForEach-Object { $_.Body | ConvertFrom-Json }) }
    }
    AfterAll {
        Remove-Item -LiteralPath $global:HwT.Dir -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Module DE-Microsoft-Admin -Force -ErrorAction SilentlyContinue
        Remove-Item -Path Function:\Invoke-MgGraphRequest, Function:\Get-MgContext, Function:\Connect-MgGraph, Function:\ConvertTo-HwSecure, Function:\Test-HwSignature, Function:\Find-HwSecret, Function:\New-HwJob, Function:\Reset-Hw, Function:\Invoke-HwLoop, Function:\Get-HwPostedResults -ErrorAction SilentlyContinue
    }
    BeforeEach {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = $global:HwT.Tenant; Account = 'hub-worker' } }
        Mock -ModuleName DE-Microsoft-Admin Connect-MgGraph { }
        Mock -ModuleName DE-Microsoft-Admin Start-Sleep { $global:HwT.Sleeps.Add([int]$Milliseconds) }
        # a fake Hub: claim hands out the queue in order, a result is recorded; $global:HwT.Http can answer first
        Mock -ModuleName DE-Microsoft-Admin Invoke-DEHubWorkerHttp {
            $text = (New-Object Text.UTF8Encoding $false).GetString($Body)
            $call = [pscustomobject]@{ Uri = $Uri; Path = ([uri]$Uri).AbsolutePath; Headers = $Headers; Body = $text }
            $global:HwT.Calls.Add($call)
            if ($global:HwT.Http) { $answer = & $global:HwT.Http $call; if ($null -ne $answer) { return $answer } }
            if ($call.Path -like '*/jobs/claim') {
                if ($global:HwT.Queue.Count) { $j = $global:HwT.Queue[0]; $global:HwT.Queue.RemoveAt(0); return [pscustomobject]@{ StatusCode = 200; Content = '{"job":' + $j + '}' } }
                return [pscustomobject]@{ StatusCode = 200; Content = '{"job":null}' }
            }
            $global:HwT.Posts.Add($call)
            return [pscustomobject]@{ StatusCode = 200; Content = '{"status":"recorded","jobId":"x","jobStatus":"succeeded"}' }
        }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            $global:HwT.Graph.Add("$Method $Uri")
            if ($Uri -like '*/domains*') { return @{ value = @(@{ id = 'alamo-industries.com'; isVerified = $true }) } }
            if ($Uri -like '*users?$filter*') { return @{ value = @() } }
            if ($Uri -like '*deviceCompliancePolicies*') {
                return @{ value = @(@{ '@odata.type' = '#microsoft.graph.windows10CompliancePolicy'; id = 'p1'; displayName = 'Windows baseline'; version = 3; passwordRequired = $true; passwordRequiredType = 'alphanumeric'; passwordMinimumLength = 12; passwordExpirationDays = $null; osMinimumVersion = '10.0.19045'; bitLockerEnabled = $true; validOperatingSystemBuildRanges = @() }) }
            }
            if ($Method -eq 'POST' -and $Uri -like '*/v1.0/users') { return @{ id = 'u9' } }
            if ($Uri -like '*users?$select*') { return @{ value = @(@{ id = 'u1'; displayName = 'Suzette'; userPrincipalName = 'suzette@alamo-industries.com' }) } }
            return @{ id = 'u9'; userPrincipalName = 'new.hire@alamo-industries.com'; displayName = 'New Hire'; accountEnabled = $false; usageLocation = 'US' }
        }
        $null = Connect-DEMicrosoft -TenantId $global:HwT.Tenant -ClientId 'app-id' -CertificateThumbprint 'ABCDEF'
    }

    It 'claims, verifies, runs and posts each job until the queue is empty, every call signed the way the Hub checks' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'), (New-HwJob -Operation 'Set-DEUserAccountState' -Parameters @{ UserId = 'suzette@alamo-industries.com'; Enabled = $false } -Mode apply -ApprovedBy 'joe@digerati-experts.com'))
        $r = Invoke-HwLoop
        $r.ok | Should -Be $true; $r.stoppedBecause | Should -Be 'queue_empty'
        $r.claimed | Should -Be 2; $r.posted | Should -Be 2; $r.pendingLeft | Should -Be 0
        @($r.jobs | ForEach-Object { "$($_.operation):$($_.status):$($_.hub)" }) -join ',' | Should -Be 'Get-DEUser:Succeeded:recorded,Set-DEUserAccountState:Succeeded:recorded'
        @($global:HwT.Calls | ForEach-Object { $_.Path -replace '[0-9a-f-]{36}', 'ID' }) -join ',' | Should -Be '/api/msadmin/worker/v1/jobs/claim,/api/msadmin/worker/v1/jobs/ID/result,/api/msadmin/worker/v1/jobs/claim,/api/msadmin/worker/v1/jobs/ID/result,/api/msadmin/worker/v1/jobs/claim'
        foreach ($c in $global:HwT.Calls) {
            (Test-HwSignature $c) | Should -Be $true
            $c.Headers['X-DE-Source'] | Should -Be 'msadmin-worker'
            $c.Uri | Should -Match '^https://hub\.example\.test/api/'
        }
        @($global:HwT.Calls | ForEach-Object { $_.Headers['X-DE-Event-ID'] } | Select-Object -Unique).Count | Should -Be 5
        $claim = $global:HwT.Calls[0].Body | ConvertFrom-Json
        $claim.tenantId | Should -Be $global:HwT.Tenant; $claim.workerId | Should -Be 'TEST-WORKER'
        $posted = @(Get-HwPostedResults)
        $posted[0].operation | Should -Be 'Get-DEUser'; $posted[0].tenant | Should -Be $global:HwT.Tenant; $posted[0].product | Should -Be 'DE Microsoft Admin'
        $global:HwT.Posts[1].Path | Should -Match ($r.jobs[1].jobId)
        @($global:HwT.Graph | Where-Object { $_ -like 'PATCH *' }).Count | Should -Be 1
        @(Get-ChildItem -LiteralPath (Join-Path $global:HwT.State 'pending') -Filter *.json).Count | Should -Be 0
    }
    It '-Once and -MaxJobs stop after that many jobs' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'), (New-HwJob -Operation 'Get-DEUser'), (New-HwJob -Operation 'Get-DEUser'))
        $r = Invoke-HwLoop -Extra @{ Once = $true }
        $r.stoppedBecause | Should -Be 'max_jobs'; $r.claimed | Should -Be 1; $r.ok | Should -Be $true
        $r = Invoke-HwLoop -Extra @{ MaxJobs = 2 }
        $r.stoppedBecause | Should -Be 'max_jobs'; $r.claimed | Should -Be 2; $global:HwT.Queue.Count | Should -Be 0
    }
    It 'never runs a tampered job or another tenant''s job: each is reported as Refused, and a bad signature stops the run' {
        $good = New-HwJob -Operation 'Set-DEUserAccountState' -Parameters @{ UserId = 'suzette@alamo-industries.com'; Enabled = $false } -Mode apply -ApprovedBy 'joe@digerati-experts.com'
        Reset-Hw -Queue @($good.Replace('suzette@alamo-industries.com', 'ceo@alamo-industries.com'), (New-HwJob -Operation 'Get-DEUser'))
        $r = Invoke-HwLoop
        $r.stoppedBecause | Should -Be 'job_signature'; $r.ok | Should -Be $false; $r.message | Should -Match 'MSADMIN_JOB_SIGNING_SECRET'
        $global:HwT.Graph.Count | Should -Be 0
        $p = @(Get-HwPostedResults)
        $p.Count | Should -Be 1; $p[0].status | Should -Be 'Refused'; $p[0].operation | Should -Be 'Invoke-DEMicrosoftJob'; $p[0].message | Should -Be 'signature does not verify'
        $global:HwT.Queue.Count | Should -Be 1   # the rest of the queue was left for a fixed worker

        Reset-Hw -Queue @((New-HwJob -Operation 'Set-DEUserAccountState' -Parameters @{ UserId = 'a@b.com'; Enabled = $false } -Mode apply -ApprovedBy 'joe@digerati-experts.com' -Tenant $global:HwT.Other))
        $r = Invoke-HwLoop
        $r.stoppedBecause | Should -Be 'queue_empty'
        $global:HwT.Graph.Count | Should -Be 0
        $p = @(Get-HwPostedResults)
        $p[0].status | Should -Be 'Refused'; $p[0].message | Should -Match "for tenant $($global:HwT.Other)"
    }
    It 'keeps New-DEUser''s temporary password and Intune password settings away from the Hub, and the password on this machine' {
        Reset-Hw -Queue @((New-HwJob -Operation 'New-DEUser' -Parameters @{ DisplayName = 'New Hire'; UserPrincipalName = 'new.hire@alamo-industries.com'; UsageLocation = 'US' } -Mode apply -ApprovedBy 'joe@digerati-experts.com'), (New-HwJob -Operation 'Get-DEIntuneCompliancePolicy'))
        $r = Invoke-HwLoop 6> $null
        $r.stoppedBecause | Should -Be 'queue_empty'; $r.posted | Should -Be 2
        $local = $r.jobs[0].localResult
        $local.data.temporaryPassword | Should -BeOfType [securestring]
        $plain = [pscredential]::new('x', $local.data.temporaryPassword).GetNetworkCredential().Password
        $plain.Length | Should -Be 16
        $r.jobs[0].removed | Should -Contain 'data.temporaryPassword'
        foreach ($post in $global:HwT.Posts) {
            $post.Body | Should -Not -Match '"temporaryPassword"'
            $post.Body | Should -Not -Match ([regex]::Escape($plain))
            $post.Body | Should -Not -Match '"passw[^"]*"\s*:'   # no password* key (their names may be listed as values)
            (Find-HwSecret ($post.Body | ConvertFrom-Json)).Count | Should -Be 0
        }
        $p = @(Get-HwPostedResults)
        $p[0].data.userPrincipalName | Should -Be 'new.hire@alamo-industries.com'
        $p[0].message | Should -Match 'kept on the worker, not sent to the Hub: data\.temporaryPassword'
        $pol = @($p[1].data)[0]
        $pol.platform | Should -Be 'windows10CompliancePolicy'; $pol.displayName | Should -Be 'Windows baseline'
        $pol.settings.osMinimumVersion | Should -Be '10.0.19045'; $pol.settings.bitLockerEnabled | Should -Be $true
        @($pol.deviceLockRules) -join ',' | Should -Be 'passwordMinimumLength,passwordRequired,passwordRequiredType'
        foreach ($f in @(Get-ChildItem -LiteralPath $global:HwT.State -Recurse -File) + @(Get-Item (Get-DEMsAuditPath))) { (Get-Content -LiteralPath $f.FullName -Raw) | Should -Not -Match ([regex]::Escape($plain)) }
    }
    It 'a 4xx from the Hub stops the run at once with the Hub''s reason (no retry)' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'))
        $global:HwT.Http = { param($c) [pscustomobject]@{ StatusCode = 401; Content = '{"error":"unauthorized","message":"Invalid signature."}' } }
        $r = Invoke-HwLoop 3> $null
        $r.ok | Should -Be $false; $r.stoppedBecause | Should -Be 'hub_refused'
        $r.message | Should -Match 'HTTP 401 \(unauthorized: Invalid signature\.\)'
        $r.message | Should -Match 'MSADMIN_WORKER_SECRET'
        $global:HwT.Calls.Count | Should -Be 1; $r.claimed | Should -Be 0
    }
    It '5xx and no answer are retried with backoff, then the run stops; a recovered Hub carries on' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'))
        $global:HwT.Http = { param($c) [pscustomobject]@{ StatusCode = 503; Content = '{"error":"msadmin_not_configured","message":"DE Microsoft Admin jobs are not configured on this Hub."}' } }
        $r = Invoke-HwLoop -Extra @{ RetryBaseSeconds = 0.5 } 3> $null
        $r.stoppedBecause | Should -Be 'network'; $r.ok | Should -Be $false
        $global:HwT.Calls.Count | Should -Be 3
        @($global:HwT.Sleeps) -join ',' | Should -Be '500,1000'   # fractional seconds are kept (not rounded to 0)
        $r.message | Should -Match 'HTTP 503 after 3 attempts'; $r.message | Should -Match 'msadmin_not_configured'
        $global:HwT.Queue.Count | Should -Be 1

        $global:HwT.Calls.Clear(); $global:HwT.Fails = 1
        $global:HwT.Http = { param($c) if ($global:HwT.Fails -gt 0) { $global:HwT.Fails--; throw 'The operation has timed out.' } }
        $r = Invoke-HwLoop
        $r.stoppedBecause | Should -Be 'queue_empty'; $r.posted | Should -Be 1
        $global:HwT.Calls.Count | Should -Be 4   # timed-out claim, claim, result, empty claim
    }
    It 'a result that could not be posted waits on disk without secrets, goes first next run, and its job never runs again' {
        $job = New-HwJob -Operation 'New-DEUser' -Parameters @{ DisplayName = 'New Hire'; UserPrincipalName = 'new.hire@alamo-industries.com' } -Mode apply -ApprovedBy 'joe@digerati-experts.com'
        Reset-Hw -Queue @($job, (New-HwJob -Operation 'Get-DEUser'))
        $global:HwT.Http = { param($c) if ($c.Path -like '*/result') { [pscustomobject]@{ StatusCode = 500; Content = '{"error":"server_error"}' } } }
        $r = Invoke-HwLoop 3> $null 6> $null
        $r.stoppedBecause | Should -Be 'network'; $r.claimed | Should -Be 1; $r.pendingLeft | Should -Be 1
        $r.message | Should -Match 'will not run again'
        $plain = [pscredential]::new('x', $r.jobs[0].localResult.data.temporaryPassword).GetNetworkCredential().Password
        $pending = Join-Path (Join-Path $global:HwT.State 'pending') "$($r.jobs[0].jobId).json"
        Test-Path -LiteralPath $pending | Should -Be $true
        $saved = [IO.File]::ReadAllText($pending)
        $saved | Should -Not -Match ([regex]::Escape($plain)); $saved | Should -Not -Match '"temporaryPassword"'
        @($global:HwT.Graph | Where-Object { $_ -like 'POST *' }).Count | Should -Be 1
        $global:HwT.Queue.Count | Should -Be 1   # nothing more was claimed while results cannot be posted

        # next run: the Hub is back
        $global:HwT.Http = $null; $global:HwT.Calls.Clear()
        $r2 = Invoke-HwLoop
        $r2.ok | Should -Be $true; $r2.pendingPosted | Should -Be 1; $r2.pendingLeft | Should -Be 0; $r2.claimed | Should -Be 1
        $global:HwT.Calls[0].Path | Should -Match "$($r.jobs[0].jobId)/result$"
        $global:HwT.Calls[0].Body | Should -BeExactly $saved
        Test-Path -LiteralPath $pending | Should -Be $false
        @($global:HwT.Graph | Where-Object { $_ -like 'POST *' }).Count | Should -Be 1

        # the same job handed out again (it never is) is refused by the replay ledger, not run
        $global:HwT.Queue.Add($job)
        $r3 = Invoke-HwLoop
        $r3.jobs[0].status | Should -Be 'Refused'; $r3.jobs[0].localResult.message | Should -Match 'replay'
        @($global:HwT.Graph | Where-Object { $_ -like 'POST *' }).Count | Should -Be 1
    }
    It 'a result the Hub refuses (4xx) is moved aside with the answer, stops the run and is not retried' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'), (New-HwJob -Operation 'Get-DEUser'))
        $global:HwT.Http = { param($c) if ($c.Path -like '*/result') { [pscustomobject]@{ StatusCode = 409; Content = '{"error":"result_conflict","message":"A different result was already recorded for this job."}' } } }
        $r = Invoke-HwLoop 3> $null
        $r.stoppedBecause | Should -Be 'hub_refused'; $r.rejected | Should -Be 1
        $r.message | Should -Match 'result_conflict'
        $rej = Join-Path $global:HwT.State 'rejected'
        Test-Path -LiteralPath (Join-Path $rej "$($r.jobs[0].jobId).json") | Should -Be $true
        (Get-Content -LiteralPath (Join-Path $rej "$($r.jobs[0].jobId).answer.txt") -Raw) | Should -Match '409'
        $global:HwT.Http = $null; $global:HwT.Calls.Clear()
        $r2 = Invoke-HwLoop
        $r2.pendingPosted | Should -Be 0
        @($global:HwT.Calls | Where-Object { $_.Path -match [regex]::Escape($r.jobs[0].jobId) }).Count | Should -Be 0
    }
    It 'talks to an https Hub address only' {
        Reset-Hw
        foreach ($bad in @('http://hub.example.test', 'hub.example.test', 'ftp://hub.example.test', 'https://hub.example.test/api', 'https://hub.example.test/?x=1')) {
            { Invoke-HwLoop -Extra @{ HubUrl = $bad } } | Should -Throw
        }
        { Invoke-HwLoop -Extra @{ HubUrl = 'http://hub.example.test' } } | Should -Throw '*https://*'
        $global:HwT.Calls.Count | Should -Be 0
        (Invoke-HwLoop -Extra @{ HubUrl = 'https://hub.example.test/' }).stoppedBecause | Should -Be 'queue_empty'
    }
    It 'takes secrets from the vault or the environment at run time; they never reach output, logs, results or disk' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'))
        $env:MSADMIN_JOB_SIGNING_SECRET = $global:HwT.JobPlain; $env:MSADMIN_WORKER_SECRET = $global:HwT.WorkerPlain
        try {
            $p = @{ HubUrl = $global:HwT.Hub; WorkerId = 'TEST-WORKER'; StatePath = $global:HwT.State; LedgerPath = $global:HwT.Ledger; RetryBaseSeconds = 0 }
            $all = Invoke-DEHubJobLoop @p -Verbose *>&1
            $summary = @($all | Where-Object { $_ -is [pscustomobject] -and $_.PSObject.Properties['stoppedBecause'] })[0]
            $summary.stoppedBecause | Should -Be 'queue_empty'; $summary.posted | Should -Be 1
            $text = (@($all | ForEach-Object { "$_" }) -join "`n") + ($summary | ConvertTo-Json -Depth 12)
            foreach ($f in @(Get-ChildItem -LiteralPath $global:HwT.State -Recurse -File) + @(Get-Item (Get-DEMsAuditPath))) { $text += [IO.File]::ReadAllText($f.FullName) }
            foreach ($c in $global:HwT.Calls) { $text += $c.Body + ($c.Headers.Values -join ' ') }
            foreach ($secret in @($global:HwT.JobPlain, $global:HwT.WorkerPlain)) { $text | Should -Not -Match ([regex]::Escape($secret)) }
            ($global:HwT.Calls | ForEach-Object { Test-HwSignature $_ }) | Should -Not -Contain $false

            # a SecretManagement vault, when given, wins over the environment
            $global:HwT.VaultAsked = @()
            function global:Get-Secret { param($Name, $Vault) $global:HwT.VaultAsked += "$Vault/$Name"; if ($Name -eq 'MSADMIN_WORKER_SECRET') { return (ConvertTo-HwSecure $global:HwT.WorkerPlain) }; return $global:HwT.JobPlain }
            try { (Invoke-DEHubJobLoop @p -Vault 'DE').stoppedBecause | Should -Be 'queue_empty' } finally { Remove-Item Function:\Get-Secret -ErrorAction SilentlyContinue }
            ($global:HwT.VaultAsked -join ',') | Should -Be 'DE/MSADMIN_JOB_SIGNING_SECRET,DE/MSADMIN_WORKER_SECRET'

            Remove-Item Env:\MSADMIN_WORKER_SECRET
            $err = try { Invoke-DEHubJobLoop @p; '<none>' } catch { $_.Exception.Message }
            $err | Should -Match 'MSADMIN_WORKER_SECRET is not set'; $err | Should -Not -Match ([regex]::Escape($global:HwT.JobPlain))
            $env:MSADMIN_WORKER_SECRET = $global:HwT.JobPlain
            { Invoke-DEHubJobLoop @p } | Should -Throw '*must differ*'
            $env:MSADMIN_WORKER_SECRET = 'too-short'
            { Invoke-DEHubJobLoop @p } | Should -Throw '*shorter than 32*'
        } finally { Remove-Item Env:\MSADMIN_JOB_SIGNING_SECRET, Env:\MSADMIN_WORKER_SECRET -ErrorAction SilentlyContinue }
    }
    It 'needs a connected tenant (a GUID) and -WhatIf contacts nothing' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'))
        $r = Invoke-HwLoop -Extra @{ WhatIf = $true }
        $r.stoppedBecause | Should -Be 'whatif'; $r.ok | Should -Be $true
        $global:HwT.Calls.Count | Should -Be 0; $global:HwT.Queue.Count | Should -Be 1
        InModuleScope DE-Microsoft-Admin { $script:Ctx.TenantId = 'alamo-industries.com' }
        { Invoke-HwLoop } | Should -Throw '*Connect to the client tenant first*'
        $global:HwT.Calls.Count | Should -Be 0
    }
    It 'a second loop on the same machine does not run alongside the first' {
        Reset-Hw -Queue @((New-HwJob -Operation 'Get-DEUser'))
        New-Item -ItemType Directory -Path $global:HwT.State -Force | Out-Null
        $held = [IO.File]::Open((Join-Path $global:HwT.State 'worker.lock'), [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
        try { $r = Invoke-HwLoop 3> $null } finally { $held.Dispose() }
        $r.stoppedBecause | Should -Be 'busy'; $global:HwT.Calls.Count | Should -Be 0
        (Invoke-HwLoop).stoppedBecause | Should -Be 'queue_empty'
    }
    It 'ConvertTo-DEHubSafeResult applies the Hub''s rules: flags and settings pass, secret values do not' {
        $bl = '111111-222222-333333-444444-555555-666666-000011-719873'
        $jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdefghijklmnop'
        $res = New-DEResult -Operation 'Get-DEUser' -Message "key $bl" -Data ([pscustomobject]@{
                mfaRegistered = $true; passwordMinimumLength = 8; passwordless = $false; mfaMethod = 'authenticator'; pin = 1234; tap = 'Abc12345'
                clientSecret = 'shh'; nested = @{ apiKey = 'k'; ok = 'fine'; note = "bearer $jwt" }; list = @(@{ recoveryKey = 'x'; id = 1 }, @{ appPassword = 'abcd efgh' }); preSharedKey = 'wifi'
            })
        $s = ConvertTo-DEHubSafeResult -Result $res
        $o = $s.Json | ConvertFrom-Json
        (Find-HwSecret $o).Count | Should -Be 0
        $o.data.mfaRegistered | Should -Be $true; $o.data.passwordMinimumLength | Should -Be 8; $o.data.passwordless | Should -Be $false
        $o.data.nested.ok | Should -Be 'fine'; $o.data.list[0].id | Should -Be 1
        $o.data.nested.note | Should -Be 'bearer [removed]'
        foreach ($k in 'mfaMethod', 'pin', 'tap', 'clientSecret', 'preSharedKey') { $o.data.PSObject.Properties[$k] | Should -BeNullOrEmpty }
        $s.Removed | Should -Contain 'data.nested.apiKey'; $s.Removed | Should -Contain 'data.list[0].recoveryKey'; $s.Removed | Should -Contain 'data.list[1].appPassword'
        $s.Json | Should -Not -Match '111111-222222'
        $res.data.clientSecret | Should -Be 'shh'   # the local result is not changed
    }
    It 'a result over the Hub''s 2 MB limit goes without its data, and says so' {
        $res = New-DEResult -Operation 'Get-DEUser' -Message '3 user(s)' -Data @(('x' * 1000000), ('y' * 1000000), 'z')
        $o = (ConvertTo-DEHubSafeResult -Result $res).Json | ConvertFrom-Json
        $o.data.omitted | Should -Be $true; $o.data.items | Should -Be 3
        $o.message | Should -Match "over the Hub's limit"
    }
}
