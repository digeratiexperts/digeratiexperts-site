# Three components, one set of contracts: the boot rescue (WinPE), this tool, and the Intelligence Hub.
# Compatible with Pester 4.10 and 5.x. Native tools (manage-bde, robocopy, dism, reg, bcdboot) are mocked.

Describe 'Shared contracts' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
    }
    It 'every schema parses and the example order validates' {
        foreach ($n in 'device', 'order', 'handoff', 'warranty', 'job', 'migration') { (Get-DEContractSchema -Name $n).title | Should -Not -BeNullOrEmpty }
        $o = Get-Content -LiteralPath (Join-Path (Get-DEConsole).Root 'catalog/orders/example-dropship-order.json') -Raw | ConvertFrom-Json
        @(Test-DEContract -Name order -Object $o).Count | Should -Be 0
        @(Test-DEContract -Name order -Object @{ schema = 'de.techconsole.order/v1' }) -join ' ' | Should -Match 'orderId: required'
    }
    It 'refuses secret keys and recovery-password-shaped values anywhere' {
        $bad = @{ schema = 'de.techconsole.order/v1'; orderId = 'o'; client = 'c'; device = @{ serial = 'S' }; procurement = @{ apiKey = 'x' }; endUser = @{ displayName = '111111-222222-333333-444444-555555-666666-000011-719873' } }
        $p = @(Test-DEContract -Name order -Object $bad) -join ' | '
        $p | Should -Match 'apiKey: secrets never go'
        $p | Should -Match 'recovery-password-shaped'
    }
    It 'device keys are the same on every component and refuse OEM placeholders' {
        ConvertTo-DEDeviceKey -Manufacturer 'LENOVO' -Serial ' pf3abc12 ' | Should -Be 'lenovo:PF3ABC12'
        ConvertTo-DEDeviceKey -Manufacturer 'Hewlett-Packard' -Serial '5CG1234' | Should -Be 'hp:5CG1234'
        ConvertTo-DEDeviceKey -Manufacturer 'Contoso Ltd.' -Serial 'A1' | Should -Be 'contoso-ltd:A1'
        (Get-DEThrown { ConvertTo-DEDeviceKey -Manufacturer 'x' -Serial 'To be filled by O.E.M.' }) | Should -Match 'placeholder'
    }
    It 'writes JSON exactly as JSON.stringify does, so the Hub re-serialises the same bytes it verifies' {
        $o = [ordered]@{ a = 'x<y>&z"q'; n = 1; f = 1.5; b = $true; z = $null; arr = @(1, 'two', [ordered]@{ k = 'v' }); one = @('single'); empty = @(); nested = [ordered]@{ t = "tab`there" } }
        ConvertTo-DECanonicalJson $o | Should -BeExactly '{"a":"x<y>&z\"q","n":1,"f":1.5,"b":true,"z":null,"arr":[1,"two",{"k":"v"}],"one":["single"],"empty":[],"nested":{"t":"tab\there"}}'
    }
    It 'an empty object is written {}, never a nameless key, including after a JSON round trip' {
        ConvertTo-DECanonicalJson ('{"a":{},"b":{"c":null},"d":[{}]}' | ConvertFrom-Json) | Should -BeExactly '{"a":{},"b":{"c":null},"d":[{}]}'
        ConvertTo-DECanonicalJson ([ordered]@{ x = $(if ($false) { 1 } else { $null }); y = @{}; z = [pscustomobject]@{} }) | Should -BeExactly '{"x":null,"y":{},"z":{}}'
    }
    It 'signs exactly like the Hub (vector cross-checked with Node crypto)' {
        $body = '{"a":"x<y>&z\"q","n":1,"f":1.5,"b":true,"z":null,"arr":[1,"two",{"k":"v"}]}'
        # node: createHmac('sha256','k').update(['POST',path,ts,'e1',sha256hex(body)].join('\n'))
        $sig = Get-DEHubSignature -Method POST -Path '/api/integrations/v1/techconsole/events' -Timestamp '2026-09-29T00:00:00.000Z' -EventId 'e1' -Body $body -Secret 'k'
        $sig | Should -Match '^[0-9a-f]{64}$'
        $sha = [Security.Cryptography.SHA256]::Create(); $bh = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($body)) | ForEach-Object { $_.ToString('x2') })
        $mac = New-Object Security.Cryptography.HMACSHA256 (, [Text.Encoding]::UTF8.GetBytes('k'))
        $expect = -join ($mac.ComputeHash([Text.Encoding]::UTF8.GetBytes("POST`n/api/integrations/v1/techconsole/events`n2026-09-29T00:00:00.000Z`ne1`n$bh")) | ForEach-Object { $_.ToString('x2') })
        $sig | Should -Be $expect
    }
    It 'the device record the tool builds is a valid device contract with a device key and warranty' {
        Set-DEStateValue -Path 'warranty.current' -Value @{ status = 'active'; end = '2027-01-31'; source = 'lenovo-support-site' }
        $rec = @{ client = 'alamo'; site = 'hq'; hostname = 'ALAMO-LAP-1'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; model = 'ThinkPad X1'; assetTag = 'A1'; role = 'laptop'; os = 'Windows 11'; assignedUser = 'Suzette'; localUserName = 'sthompson'; jumpcloudUser = 'sthompson'; email = 's@x'; mode = 'takeover'; readiness = 'READY'; areas = @(); started = 'x'; completed = 'y'; technician = 'jrpetro'; exceptions = @() }
        $p = New-DEHubPayload -Record $rec -Lifecycle 'configured'
        $p.deviceKey | Should -Be 'lenovo:PF3ABC12'
        $p.warranty.end | Should -Be '2027-01-31'
        @(Test-DEContract -Name device -Object $p) -join ' | ' | Should -Be ''
    }
    It 'Send-DEHubPayload sends one signed device.observed event the Hub can verify, and never the secret' {
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example/api/whatever'
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Set-DEContext -Values @{ hubAccountId = '' }
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { throw 'must not be called without an account' }
        (Send-DEHubPayload -Payload (New-DEHubPayload -Record @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @() }) -Confirm:$false).error | Should -Match 'hub.accountId'
        Set-DEContext -Values @{ hubAccountId = '42' }
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { $global:DETest.Sent = @{ Uri = $Uri; Headers = $Headers; Body = $Body }; @{ ok = $true } }
        $rec = @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; model = 'X1'; exceptions = @() }
        $r = Send-DEHubPayload -Payload (New-DEHubPayload -Record $rec) -Confirm:$false
        $r.sent | Should -Be $true
        $s = $global:DETest.Sent
        $s.Uri | Should -Be 'https://hub.example/api/integrations/v1/techconsole/events'
        $s.Headers['X-DE-Source'] | Should -Be 'techconsole'
        $s.Body | Should -Not -Match 'signing-secret-9876'
        ($s.Headers.Values -join ' ') | Should -Not -Match 'signing-secret-9876'
        $ev = $s.Body | ConvertFrom-Json
        $ev.eventType | Should -Be 'device.observed'; $ev.entityId | Should -Be 'lenovo:PF3ABC12'; $ev.version | Should -Be 1; $ev.canonicalAccountId | Should -Be '42'
        $ev.eventId | Should -Be $s.Headers['X-DE-Event-ID']
        Get-DEHubSignature -Method POST -Path '/api/integrations/v1/techconsole/events' -Timestamp $s.Headers['X-DE-Timestamp'] -EventId $ev.eventId -Body $s.Body -Secret 'signing-secret-9876' | Should -Be $s.Headers['X-DE-Signature']
        Clear-DESecrets
    }
    It 'a record without a usable serial is not sent and is saved for manual upload' {
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example'
        Set-DEContext -Values @{ hubAccountId = '42' }
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { throw 'must not be called' }
        $r = Send-DEHubPayload -Payload (New-DEHubPayload -Record @{ client = 'alamo'; serial = 'Default string'; manufacturer = 'x'; exceptions = @() }) -Confirm:$false
        $r.sent | Should -Be $false; $r.error | Should -Match 'device key'
        Test-Path -LiteralPath $r.file | Should -Be $true
        Clear-DESecrets
    }
    It 'a refused device send records the Hub''s own reason, not only the HTTP status, and never the secret' {
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example'
        Set-DEContext -Values @{ hubAccountId = '999999' }
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp {
            $e = New-Object System.Management.Automation.ErrorRecord ((New-Object System.Exception 'The remote server returned an error: (422) Unprocessable Entity.'), 'HubRefused', 'InvalidOperation', $null)
            $e.ErrorDetails = New-Object System.Management.Automation.ErrorDetails '{"error":"account not mapped"}'
            throw $e
        }
        $r = Send-DEHubPayload -Payload (New-DEHubPayload -Record @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @() }) -Confirm:$false
        $r.sent | Should -Be $false
        $r.error | Should -Match 'Hub refused: account not mapped'; $r.error | Should -Match '422'
        $ev = @(Get-DEEvidence | Where-Object { $_.step -eq 'hub.push' }) | Select-Object -Last 1
        $ev.result | Should -Be 'FAIL'; $ev.verification | Should -Match 'account not mapped'
        "$($r.error) $($ev.verification) $($ev.action)" | Should -Not -Match 'signing-secret-9876'
        Clear-DESecrets
    }
    It 'a refused migration send throws and records the Hub''s own reason, never the secret' {
        $rec = [ordered]@{ schema = 'de.email-migration.record/v1'; projectId = 'alamo-mail' }
        $file = Join-Path $global:DETest.Dir 'refused-record.json'; [IO.File]::WriteAllText($file, ($rec | ConvertTo-Json))
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example'
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Mock -ModuleName DE.Evidence New-DEHubEvent { [ordered]@{ eventId = 'e-refused'; eventType = $EventType; payload = $Payload } }
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp {
            $e = New-Object System.Management.Automation.ErrorRecord ((New-Object System.Exception 'The remote server returned an error: (422) Unprocessable Entity.'), 'HubRefused', 'InvalidOperation', $null)
            $e.ErrorDetails = New-Object System.Management.Automation.ErrorDetails '{"error":"account not mapped"}'
            throw $e
        }
        $msg = Get-DEThrown { Send-DEHubMigrationRecord -Path $file -AccountId '999999' -Confirm:$false }
        $msg | Should -Match 'account not mapped'; $msg | Should -Not -Match 'signing-secret-9876'
        $ev = @(Get-DEEvidence | Where-Object { $_.step -eq 'hub.migration' }) | Select-Object -Last 1
        $ev.result | Should -Be 'FAIL'; $ev.verification | Should -Match 'Hub refused: account not mapped'; $ev.verification | Should -Not -Match 'signing-secret-9876'
        Clear-DESecrets
    }
    It 'Get-DEHubErrorReason: JSON error and message, plain text, no details, length cap, recovery-shaped values masked' {
        $mk = { param($Body) $e = New-Object System.Management.Automation.ErrorRecord ((New-Object System.Exception '(400) Bad Request.'), 'x', 'InvalidOperation', $null); if ($null -ne $Body) { $e.ErrorDetails = New-Object System.Management.Automation.ErrorDetails $Body }; $e }
        Get-DEHubErrorReason -ErrorRecord (& $mk '{"error":"Invalid techconsole envelope","message":"payload.device required"}') | Should -Be 'Hub refused: Invalid techconsole envelope: payload.device required ((400) Bad Request.)'
        Get-DEHubErrorReason -ErrorRecord (& $mk "<html>`r`n502 Bad Gateway</html>") | Should -Be 'Hub refused: <html> 502 Bad Gateway</html> ((400) Bad Request.)'
        Get-DEHubErrorReason -ErrorRecord (& $mk $null) | Should -Be '(400) Bad Request.'
        (Get-DEHubErrorReason -ErrorRecord (& $mk ('{"error":"' + ('x' * 2000) + '"}'))).Length | Should -BeLessOrEqual 400
        Get-DEHubErrorReason -ErrorRecord (& $mk '{"error":"echo 111111-222222-333333-444444-555555-666666-000011-719873"}') | Should -Not -Match '111111-222222'
        Get-DEHubErrorReason -ErrorRecord 'no answer' | Should -Be 'no answer'
    }
    It 'secret-named keys stay [REDACTED] locally but are left out of what goes to the Hub, so the send is not refused' {
        # local state, logs and receipts keep the key and withhold the value
        $local = Remove-DESecretKeys -Object @{ note = 'x'; apiToken = 'tok-123'; nested = @{ password = 'p' } }
        $local.apiToken | Should -Be '[REDACTED]'; $local.nested.password | Should -Be '[REDACTED]'
        $kept = New-Object System.Collections.Generic.List[string]
        $dropped = Remove-DESecretKeys -Object @{ note = 'x'; apiToken = 'tok-123'; nested = @{ password = 'p' }; list = @(@{ credential = 'c' }) } -Drop -DroppedKeys $kept
        $dropped.Contains('apiToken') | Should -Be $false; $dropped.nested.Contains('password') | Should -Be $false; $dropped.note | Should -Be 'x'
        $dropped.list.GetType().IsArray | Should -Be $true; $dropped.list[0].Contains('credential') | Should -Be $false
        (@($kept) | Sort-Object) -join ',' | Should -Be 'apiToken,credential,password'
        # the contract's names (the Hub's own) are wider: mfa, seed, pin
        $c = Remove-DEContractSecretKeys -Object ([pscustomobject]@{ keep = 1; mfaSeed = 's'; inner = @{ pin = '1'; ok = 2 } })
        @($c.PSObject.Properties.Name) -join ',' | Should -Be 'keep,inner'; $c.inner.Contains('pin') | Should -Be $false; $c.inner.ok | Should -Be 2
        # a device record with a stray apiToken and an mfa note now reaches the Hub without them
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example'
        Set-DEContext -Values @{ hubAccountId = '42' }
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { $global:DETest.Sent = @{ Uri = $Uri; Headers = $Headers; Body = $Body }; @{ status = 'applied' } }
        $rec = @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @(@{ control = 'jumpcloud'; reason = 'pending'; apiToken = 'tok-123'; mfaMethod = 'sms' }) }
        $r = Send-DEHubPayload -Payload (New-DEHubPayload -Record $rec) -Confirm:$false
        $r.sent | Should -Be $true
        @($r.leftOut) -join ',' | Should -Be 'apiToken,mfaMethod'
        $global:DETest.Sent.Body | Should -Not -Match 'apiToken|tok-123|mfaMethod|REDACTED'
        ($global:DETest.Sent.Body | ConvertFrom-Json).payload.exceptions[0].reason | Should -Be 'pending'
        Get-Content -LiteralPath $r.file -Raw | Should -Not -Match 'apiToken|tok-123|mfaMethod'
        (@(Get-DEEvidence | Where-Object { $_.step -eq 'hub.push' }) | Select-Object -Last 1).action | Should -Match 'left out secret-named field\(s\): apiToken, mfaMethod'
        Clear-DESecrets
    }
    It 'a migration record from DE Microsoft Admin goes to the Hub as one signed email_migration.recorded event' {
        Import-Module (Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'microsoft/DE-Microsoft-Admin/DE-Microsoft-Admin.psd1') -Force -DisableNameChecking
        $mig = Join-Path $global:DETest.Dir 'migrations'; New-Item -ItemType Directory -Path $mig -Force | Out-Null; $null = Set-DEMigrationDirectory -Path $mig
        $null = Set-DEMsAuditPath -Path (Join-Path $global:DETest.Dir 'msaudit.jsonl')
        $chk = [pscustomobject]@{ 'MFA' = [pscustomobject]@{ status = 'Pass'; detail = '4 of 4 registered'; by = 'jrpetro'; at = '2026-09-28T10:00:00Z' }; 'Replies' = [pscustomobject]@{ status = 'Pending'; detail = ''; by = ''; at = '' } }
        $proj = [pscustomobject]@{ schema = 'de.email-migration.project/v1'; projectId = 'alamo-mail'; client = 'Alamo Industries'; tenantId = 't-1'; targetDomain = 'alamo-industries.com'; sourceType = 'PersonalGmail'; mailPath = 'IMAP'; stage = 'Devices'; updatedAt = $null
            users = @([pscustomobject]@{ source = 'helen.x@gmail.com'; destination = 'helen@alamo-industries.com'; displayName = 'Helen'; devices = @('HELENU'); preflight = [pscustomobject]@{ ok = $true }; migration = $null; contacts = $null; calendar = $null; mfa = [pscustomobject]@{ registered = $true; methods = @('microsoftAuthenticator') } })
            sharedMailboxes = @(); devices = @('HELENU', [pscustomobject]@{ name = 'FRONTDESK'; checkedAt = '2026-09-28T09:00:00Z'; accounts = @('suzette'); gmailReferences = @(); notChecked = @(); source = 'scan' })
            batches = @([pscustomobject]@{ name = 'alamo-mail-pilot'; type = 'Pilot'; status = 'Synced'; users = @('helen@alamo-industries.com'); failed = 0; confirmedBy = 'jrpetro' }); dns = $null; bounce = @(); verification = $chk; signoff = $null; events = @() }
        [IO.File]::WriteAllText((Join-Path $mig 'alamo-mail.json'), ($proj | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
        $out = Join-Path $global:DETest.Dir 'alamo-mail-record.json'; $null = Export-DEMigrationRecord -ProjectId 'alamo-mail' -Path $out
        @(Test-DEContract -Name migration -Object (Get-Content -LiteralPath $out -Raw | ConvertFrom-Json)) -join ' | ' | Should -Be ''
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example/api/whatever'
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'signing-secret-9876'
        Set-DEContext -Values @{ hubAccountId = '' }
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { throw 'must not be called' }
        (Get-DEThrown { Send-DEHubMigrationRecord -Path $out -Confirm:$false }) | Should -Match 'account number'
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { $global:DETest.Sent = @{ Uri = $Uri; Headers = $Headers; Body = $Body }; @{ status = 'applied' } }
        $r = Send-DEHubMigrationRecord -Path $out -AccountId '42' -Confirm:$false
        $r.sent | Should -Be $true
        $s = $global:DETest.Sent
        $s.Body | Should -Not -Match '"":'
        $ev = $s.Body | ConvertFrom-Json
        $ev.payload.identityMap[0].contacts | Should -BeNullOrEmpty
        $s.Uri | Should -Be 'https://hub.example/api/integrations/v1/techconsole/events'
        $ev.eventType | Should -Be 'email_migration.recorded'; $ev.entityType | Should -Be 'email_migration'; $ev.entityId | Should -Be 'alamo-mail'; $ev.canonicalAccountId | Should -Be '42'
        @($ev.payload.checks).Count | Should -Be 2; $ev.payload.identityMap[0].multiFactor.registered | Should -Be $true
        @($ev.payload.devices | ForEach-Object { $_.name }) -join ',' | Should -Be 'HELENU,FRONTDESK'
        $s.Body | Should -Not -Match 'signing-secret-9876'; $s.Body | Should -Not -Match '"[^"]*(?i:mfa)[^"]*":'
        Get-DEHubSignature -Method POST -Path '/api/integrations/v1/techconsole/events' -Timestamp $s.Headers['X-DE-Timestamp'] -EventId $ev.eventId -Body $s.Body -Secret 'signing-secret-9876' | Should -Be $s.Headers['X-DE-Signature']
        # a record carrying a secret-looking key is refused before anything is signed
        $bad = Get-Content -LiteralPath $out -Raw | ConvertFrom-Json; $bad | Add-Member -NotePropertyName mfaSeed -NotePropertyValue 'x'
        $badFile = Join-Path $global:DETest.Dir 'bad-record.json'; [IO.File]::WriteAllText($badFile, ($bad | ConvertTo-Json -Depth 20))
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { throw 'must not be called' }
        (Get-DEThrown { Send-DEHubMigrationRecord -Path $badFile -AccountId '42' -Confirm:$false }) | Should -Match 'mfaSeed: secrets never go'
        Clear-DESecrets; Remove-Module DE-Microsoft-Admin -Force -ErrorAction SilentlyContinue
    }
    It 'Send-DEHubEvent refuses plain http' {
        $ev = New-DEHubEvent -EventType 'device.warranty' -EntityId 'dell:ABC' -Payload @{ serial = 'ABC'; source = 'manual'; status = 'manual' }
        (Get-DEThrown { Send-DEHubEvent -BaseUrl 'http://hub.example' -Event $ev -Secret (New-Object Security.SecureString) }) | Should -Match 'https'
        (Get-DEThrown { New-DEHubEvent -EventType 'device.warranty' -EntityId 'dell:ABC' -Payload @{ serial = 'ABC'; status = 'nope'; source = 's' } }) | Should -Match 'not sending'
    }
}

Describe 'Boot rescue' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'rescue/DE.Rescue.psm1') -Force -DisableNameChecking
        $global:DETest.Key = '111111-222222-333333-444444-555555-666666-000011-719873'
        $global:DETest.Tmp = Join-Path ([IO.Path]::GetTempPath()) ("de-rescue-" + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $global:DETest.Tmp -Force | Out-Null
    }
    AfterAll { Remove-Item -LiteralPath $global:DETest.Tmp -Recurse -Force -ErrorAction SilentlyContinue }
    It 'checks a recovery password for typos before trying it' {
        (Test-DERecoveryPasswordFormat -Value $global:DETest.Key).ok | Should -Be $true
        (Test-DERecoveryPasswordFormat -Value ($global:DETest.Key -replace '-', '')).normalized | Should -Be $global:DETest.Key
        $r = Test-DERecoveryPasswordFormat -Value '111112-222222-333333-444444-555555-666666-000011-719873'; $r.ok | Should -Be $false; $r.badGroup | Should -Be 1
        (Test-DERecoveryPasswordFormat -Value '111111-222222').ok | Should -Be $false
        (Test-DERecoveryPasswordFormat -Value '111111-222222-333333-444444-555555-666666-000011-720896').reason | Should -Match 'group 8'
    }
    It 'reads manage-bde status' {
        $txt = "BitLocker Drive Encryption: Configuration Tool`n`nVolume C: [OSDisk]`n[OS Volume]`n    Size:                 475.83 GB`n    Conversion Status:    Unknown`n    Percentage Encrypted: Unknown`n    Protection Status:    Unknown`n    Lock Status:          Locked`n`nVolume E: [USB]`n    Conversion Status:    Fully Decrypted`n    Percentage Encrypted: 0.0%`n    Protection Status:    Protection Off`n    Lock Status:          Unlocked"
        $v = @(ConvertFrom-DEManageBdeStatus -Text $txt)
        $v.Count | Should -Be 2
        $v[0].drive | Should -Be 'C:'; $v[0].locked | Should -Be $true; $v[0].label | Should -Be 'OSDisk'
        $v[1].encrypted | Should -Be $false; $v[1].percent | Should -Be 0
        $txt2 = "Volume C: [OSDisk]`n    Lock Status:          Unlocked`n    Conversion Status:    Fully Encrypted`n`nVolume \\?\Volume{1b2c}\ [Recovery]`n    Conversion Status:    Fully Decrypted`n    Lock Status:          Unlocked"
        $w = @(ConvertFrom-DEManageBdeStatus -Text $txt2); $w.Count | Should -Be 1; $w[0].encrypted | Should -Be $true
    }
    It 'unlocks with the typed key, never logs it, and does not try a mistyped one' {
        Mock -ModuleName DE.Rescue Invoke-DERescueNative { [pscustomobject]@{ ExitCode = 0; Output = @('ok'); Text = 'ok' } }
        $sec = New-Object Security.SecureString; foreach ($c in $global:DETest.Key.ToCharArray()) { $sec.AppendChar($c) }
        Unlock-DERescueVolume -Drive 'C:' -RecoveryPassword $sec -Confirm:$false | Should -Be 'unlocked'
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 1 -ParameterFilter { $FilePath -eq 'manage-bde.exe' -and $Arguments[0] -eq '-unlock' }
        (Get-DERescueLog) -join ' ' | Should -Not -Match '\d{6}-\d{6}'
        $bad = New-Object Security.SecureString; foreach ($c in '111112-222222-333333-444444-555555-666666-000011-719873'.ToCharArray()) { $bad.AppendChar($c) }
        (Get-DEThrown { Unlock-DERescueVolume -Drive 'C:' -RecoveryPassword $bad -Confirm:$false }) | Should -Match 'not tried: group 1'
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 1 -Exactly
        Write-DERescueLog "oops $($global:DETest.Key)" | Should -Match 'recovery password removed'
    }
    It 'robocopy exit codes: below 8 is fine, 8 and above is a failure' {
        (Test-DERobocopyExit -Code 1).ok | Should -Be $true
        (Test-DERobocopyExit -Code 3).meaning | Should -Match 'extra files'
        (Test-DERobocopyExit -Code 8).ok | Should -Be $false
        (Test-DERobocopyExit -Code 0).meaning | Should -Be 'nothing to copy'
    }
    It 'maps offline profiles onto the rescue drive letter and names Entra accounts' {
        $p = ConvertTo-DEOfflineProfile -Sid 'S-1-12-1-1-2-3-4' -ImagePath 'C:\Users\SuzetteThompson' -Drive 'D:'
        $p.kind | Should -Be 'entra'; $p.path | Should -Be 'D:\Users\SuzetteThompson'; $p.name | Should -Be 'SuzetteThompson'
        (ConvertTo-DEOfflineProfile -Sid 'S-1-5-18' -ImagePath '%systemroot%\system32\config\systemprofile' -Drive 'D:').kind | Should -Be 'system'
    }
    It 'backs up a profile with a manifest, refuses too little space and FAT32 over 4 GB, and never deletes the source' {
        $src = Join-Path $global:DETest.Tmp 'Users/sthompson'; New-Item -ItemType Directory -Path (Join-Path $src 'Documents') -Force | Out-Null; New-Item -ItemType Directory -Path (Join-Path $src 'AppData/Local/Temp') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $src 'Documents/a.txt') -Value 'hello'; Set-Content -LiteralPath (Join-Path $src 'AppData/Local/Temp/junk.tmp') -Value 'junk'
        $usb = Join-Path $global:DETest.Tmp 'usb'
        Mock -ModuleName DE.Rescue Invoke-DERescueNative { $d = $Arguments[1]; New-Item -ItemType Directory -Path (Join-Path $d 'Documents') -Force | Out-Null; Copy-Item -LiteralPath (Join-Path $Arguments[0] 'Documents/a.txt') -Destination (Join-Path $d 'Documents/a.txt'); [pscustomobject]@{ ExitCode = 1; Output = @(); Text = '' } } -ParameterFilter { $FilePath -eq 'robocopy.exe' }
        $b = Backup-DERescueProfile -ProfilePath $src -DestinationRoot $usb -Serial 'PF3ABC12' -Confirm:$false
        $b.result | Should -Be 'PASS'; $b.files | Should -Be 1; $b.manifestSha256 | Should -Match '^[0-9a-f]{64}$'
        Test-Path -LiteralPath (Join-Path $usb 'DE-Rescue/PF3ABC12/profiles/manifest-sthompson.csv') | Should -Be $true
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 1 -ParameterFilter { $FilePath -eq 'robocopy.exe' -and $Arguments -contains '/XJ' -and ($Arguments -join ' ') -match 'AppData.Local.Temp' }
        Test-Path -LiteralPath (Join-Path $src 'Documents/a.txt') | Should -Be $true
        (Get-DEThrown { Backup-DERescueProfile -ProfilePath $src -DestinationRoot $usb -Serial 'X' -DestinationFreeBytes 1 -Confirm:$false }) | Should -Match 'not enough space'
    }
    Context 'a profile with a file over 4 GB' {
        It 'refuses a FAT32 destination' {
            $src = Join-Path $global:DETest.Tmp 'Users/big'; New-Item -ItemType Directory -Path $src -Force | Out-Null
            Mock -ModuleName DE.Rescue Get-DEFolderStats { @{ files = 1; bytes = 5GB; largest = 5GB } }
            (Get-DEThrown { Backup-DERescueProfile -ProfilePath $src -DestinationRoot (Join-Path $global:DETest.Tmp 'usb9') -Serial 'X' -DestinationFat32 -Confirm:$false }) | Should -Match 'FAT32'
        }
    }
    It 'a copy that misses files is WARN and a robocopy failure is FAIL' {
        $src = Join-Path $global:DETest.Tmp 'Users/second'; New-Item -ItemType Directory -Path $src -Force | Out-Null; Set-Content -LiteralPath (Join-Path $src 'a.txt') -Value 'a'; Set-Content -LiteralPath (Join-Path $src 'b.txt') -Value 'b'
        Mock -ModuleName DE.Rescue Invoke-DERescueNative { Copy-Item -LiteralPath (Join-Path $Arguments[0] 'a.txt') -Destination $Arguments[1]; [pscustomobject]@{ ExitCode = 1; Output = @(); Text = '' } } -ParameterFilter { $FilePath -eq 'robocopy.exe' }
        (Backup-DERescueProfile -ProfilePath $src -DestinationRoot (Join-Path $global:DETest.Tmp 'usb2') -Serial 'S1' -Confirm:$false).result | Should -Be 'WARN'
        Mock -ModuleName DE.Rescue Invoke-DERescueNative { [pscustomobject]@{ ExitCode = 16; Output = @(); Text = '' } } -ParameterFilter { $FilePath -eq 'robocopy.exe' }
        (Backup-DERescueProfile -ProfilePath $src -DestinationRoot (Join-Path $global:DETest.Tmp 'usb3') -Serial 'S1' -Confirm:$false).result | Should -Be 'FAIL'
    }
    It 'boot repair and update revert only run when confirmed' {
        Mock -ModuleName DE.Rescue Invoke-DERescueNative { [pscustomobject]@{ ExitCode = 0; Output = @('done'); Text = 'done' } }
        Mock -ModuleName DE.Rescue Get-DERescueSystemPartition { [pscustomobject]@{ partition = $null; letter = 'S:'; firmware = 'UEFI'; disk = 0 } }
        (Invoke-DERescueBootRepair -WindowsDrive 'D:' -Mode bcdboot -WhatIf).result | Should -Be 'SKIPPED'
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 0
        (Invoke-DERescueBootRepair -WindowsDrive 'D:' -Mode revert-pending -Confirm:$false).result | Should -Be 'PASS'
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 1 -ParameterFilter { $FilePath -eq 'dism.exe' -and $Arguments -contains '/RevertPendingActions' }
        # bcdboot targets the Windows disk's own system partition, never the firmware default (the rescue USB)
        (Invoke-DERescueBootRepair -WindowsDrive 'D:' -Mode bcdboot -Confirm:$false).result | Should -Be 'PASS'
        Assert-MockCalled -ModuleName DE.Rescue Invoke-DERescueNative -Scope It -Times 1 -ParameterFilter { $FilePath -eq 'bcdboot.exe' -and ($Arguments -join ' ') -eq 'D:\Windows /s S: /f UEFI' }
    }
    It 'the handoff lands on the USB and the Windows volume, validates, and carries recommendations' {
        $h = New-DEHandoff -Serial 'PF3ABC12' -Manufacturer 'LENOVO' -Model 'X1' -Technician 'jrpetro' -Version '1.7.0'
        $h.windows = [ordered]@{ drive = 'D:'; bitlocker = 'unlocked'; joinType = 'entra'; jumpcloudAgent = $true; pendingUpdates = $true }
        $null = Add-DEHandoffAction -Handoff $h -Action 'unlock' -Result 'PASS' -Detail 'D: unlocked'
        $null = Add-DEHandoffAction -Handoff $h -Action 'profile-backup' -Result 'PASS' -Detail 'ok' -Path 'E:\DE-Rescue\PF3ABC12\profiles\sthompson' -ManifestSha256 ('a' * 64) -Files 10 -Bytes 100
        $usb = Join-Path $global:DETest.Tmp 'usb4'; $win = Join-Path $global:DETest.Tmp 'win'
        New-Item -ItemType Directory -Path (Join-Path $usb 'DE-Rescue/PF3ABC12') -Force | Out-Null
        Mock -ModuleName DE.Rescue Save-DEHandoff { $Path }
        $paths = @(Save-DERescueHandoff -Handoff $h -DestinationRoot $usb -WindowsDrive 'D:')
        $paths.Count | Should -Be 2
        $paths[1] | Should -Match 'ProgramData.DE.TechConsole.handoff.rescue-'
        (@($h.recommendations) -join ' ') | Should -Match 'rotate|add a new recovery password'
        (@($h.recommendations) -join ' ') | Should -Match 'takeover'
        (@($h.recommendations) -join ' ') | Should -Match 'revert pending'
        @(Test-DEContract -Name handoff -Object $h).Count | Should -Be 0
    }
    It 'DE Tech Tool shows an unreviewed handoff as a step and records who reviewed it' {
        $dir = Join-Path (Get-DEConsole).Dirs.Base 'handoff'
        $h = New-DEHandoff -Serial 'PF3ABC12' -Manufacturer 'LENOVO' -Model 'X1' -Technician 'jrpetro' -Version '1.7.0'
        $null = Add-DEHandoffAction -Handoff $h -Action 'unlock' -Result 'PASS' -Detail 'D: unlocked'
        $null = Save-DEHandoff -Handoff $h -Path (Join-Path $dir 'rescue-1.json')
        # the step's Detect is a closure made in DE.Operations, so that is where the call must be mocked (Windows CI
        # otherwise reads the runner's real serial and, rightly, calls the handoff another device's)
        Mock -ModuleName DE.Operations Get-DEDeviceInventory { @{ manufacturer = 'LENOVO'; serial = 'PF3ABC12' } }
        @(Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'takeover') | Should -Contain 'rescue.handoff'
        (@((Get-DERunbook -Mode 'takeover').stages | Where-Object { $_.id -eq 'check' })[0].steps | ForEach-Object { $_.id })[0] | Should -Be 'rescue.handoff'
        $a = Get-DEAction -Id 'rescue.handoff'
        $d = & $a.Detect; $d.unreviewed | Should -Be 1; $d.otherDevice | Should -Be 0; $d.detail | Should -Match 'unlock PASS'
        Set-DEContext -Values @{ technician = '' }
        (Get-DEThrown { & $a.Apply @{ Detected = $d } }) | Should -Match 'technician'
        Set-DEContext -Values @{ technician = 'jrpetro' }
        & $a.Apply @{ Detected = $d } | Should -Match 'marked 1'
        (& $a.Detect).unreviewed | Should -Be 0
        (Get-Content -LiteralPath (Join-Path $dir 'rescue-1.json') -Raw | ConvertFrom-Json).reviewedBy | Should -Be 'jrpetro'
        # a handoff from another laptop (a rescue USB reused) is flagged, never passed
        Mock -ModuleName DE.Operations Get-DEDeviceInventory { @{ manufacturer = 'LENOVO'; serial = 'OTHER999' } }
        (& $a.Detect).otherDevice | Should -Be 1
    }
    It 'the media build plan adds components in dependency order, copies the contracts, and marks the USB step destructive' {
        $plan = @(Get-DERescueBuildPlan -AdkRoot 'C:\ADK' -WorkDir 'C:\W' -WindowsRoot 'C:\DE\windows' -IsoPath 'C:\out\r.iso' -UsbDrive 'E:')
        $ids = @($plan | ForEach-Object { $_.id })
        $ids[0] | Should -Be 'copype'; $ids[-1] | Should -Be 'usb'
        [array]::IndexOf($ids, 'oc:WinPE-WMI') | Should -BeLessThan ([array]::IndexOf($ids, 'oc:WinPE-PowerShell'))
        [array]::IndexOf($ids, 'oc:WinPE-NetFx') | Should -BeLessThan ([array]::IndexOf($ids, 'oc:WinPE-PowerShell'))
        $ids | Should -Contain 'oc:WinPE-SecureStartup-en-us'
        ($plan | Where-Object { $_.id -eq 'usb' }).destructive | Should -Be $true
        (($plan | Where-Object { $_.id -eq 'copy-rescue' }).copy | ForEach-Object { $_.from }) -join ' ' | Should -Match 'DE.Contracts'
        ($plan | Where-Object { $_.id -eq 'startnet' }).write.text | Should -Match 'Start-DERescue.ps1'
        [array]::IndexOf($ids, 'unmount') | Should -BeLessThan ([array]::IndexOf($ids, 'iso'))
    }
    It 'sends the rescue handoff to the Hub only with the client''s Hub account number, and records the Hub''s reason when refused' {
        $h = New-DEHandoff -Serial 'PF3ABC12' -Manufacturer 'LENOVO' -Model 'X1' -Technician 'jrpetro' -Version '1.7.0'
        $sec = ConvertTo-SecureString 'rescue-signing-secret-4321' -AsPlainText -Force
        # no account number (or a name instead of a number): nothing is sent, and the reason says what is missing
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { throw 'must not be called without an account' }
        foreach ($bad in @('', '   ', 'alamo', '0', '-5', '12a')) {
            $r = Send-DERescueHandoffToHub -Handoff $h -HubUrl 'https://hub.example' -AccountId $bad -Secret $sec
            $r.sent | Should -Be $false; $r.detail | Should -Match 'account number'
        }
        Assert-MockCalled -ModuleName DE.Contracts Invoke-DEHubHttp -Scope It -Times 0
        (Test-DEHubAccountId '1576') | Should -Be $true; (Test-DEHubAccountId ' 42 ') | Should -Be $true
        # with the account number: one signed device.rescue_handoff the Hub can verify, filed under that account, never the secret
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp { $global:DETest.Sent = @{ Uri = $Uri; Headers = $Headers; Body = $Body }; @{ status = 'applied' } }
        $r = Send-DERescueHandoffToHub -Handoff $h -HubUrl 'https://hub.example' -AccountId '1576' -Secret $sec
        $r.sent | Should -Be $true; $r.detail | Should -Match 'Hub account 1576'
        $s = $global:DETest.Sent
        $ev = $s.Body | ConvertFrom-Json
        $ev.eventType | Should -Be 'device.rescue_handoff'; $ev.canonicalAccountId | Should -Be '1576'; $ev.entityId | Should -Be $h.deviceKey; $ev.eventId | Should -Be $r.eventId
        Get-DEHubSignature -Method POST -Path '/api/integrations/v1/techconsole/events' -Timestamp $s.Headers['X-DE-Timestamp'] -EventId $ev.eventId -Body $s.Body -Secret 'rescue-signing-secret-4321' | Should -Be $s.Headers['X-DE-Signature']
        $s.Body | Should -Not -Match 'rescue-signing-secret-4321'; ($s.Headers.Values -join ' ') | Should -Not -Match 'rescue-signing-secret-4321'
        # a refusal carries the Hub's own reason, not only the HTTP status
        Mock -ModuleName DE.Contracts Invoke-DEHubHttp {
            $e = New-Object System.Management.Automation.ErrorRecord ((New-Object System.Exception 'The remote server returned an error: (422) Unprocessable Entity.'), 'HubRefused', 'InvalidOperation', $null)
            $e.ErrorDetails = New-Object System.Management.Automation.ErrorDetails '{"error":"account not mapped"}'
            throw $e
        }
        $r = Send-DERescueHandoffToHub -Handoff $h -HubUrl 'https://hub.example' -AccountId '999999' -Secret $sec
        $r.sent | Should -Be $false; $r.detail | Should -Match 'Hub refused: account not mapped'; $r.detail | Should -Match '422'
        $r.detail | Should -Not -Match 'rescue-signing-secret-4321'
        $sec.Dispose()
    }
    It 'rescue scripts parse and use no PowerShell 7-only syntax' {
        foreach ($f in @(Get-ChildItem -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'rescue') -Include '*.ps1', '*.psm1' -Recurse)) {
            $tokens = $null; $errs = $null
            [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errs)
            @($errs).Count | Should -Be 0 -Because $f.Name
            @($tokens | Where-Object { $_.Kind -in @('QuestionQuestion', 'QuestionQuestionEquals', 'AndAnd', 'OrOr') }).Count | Should -Be 0 -Because $f.Name
            [IO.File]::ReadAllBytes($f.FullName)[0] | Should -Be 0xEF -Because "$($f.Name) needs a UTF-8 BOM for Windows PowerShell 5.1"
        }
    }
}
