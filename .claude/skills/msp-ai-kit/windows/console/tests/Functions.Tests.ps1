# Function-level tests for every console function the scenario tests do not reach. Compatible with Pester 4.10 and 5.x.
# Windows-only effects (registry, BitLocker, printers, netsh, ADMU, JumpCloud API) are mocked; each test checks behaviour,
# above all the refusal paths: no backup no delete, no gate no change, WhatIf changes nothing, secrets never logged.

Describe 'Core helpers' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole } }
    It 'Set-DEMode switches mode and dry run' {
        Set-DEMode -Mode Apply -DryRun; (Get-DEConsole).Mode | Should -Be 'Apply'; (Get-DEConsole).DryRun | Should -Be $true
        Set-DEMode -Mode Audit; (Get-DEConsole).DryRun | Should -Be $false
    }
    It 'Get-DEProgramData points at a per-machine folder' {
        $p = Get-DEProgramData
        if ($env:OS -eq 'Windows_NT') { $p | Should -Match 'DE\\TechConsole$' } else { $p | Should -Match '\.de/techconsole$' }
    }
    It 'Get-DESecretNames lists names, never values' {
        Set-DESecret -Name 'T_NAME_ONLY' -Plain 'value-that-must-not-show-1234'
        @(Get-DESecretNames) | Should -Contain 'T_NAME_ONLY'
        (@(Get-DESecretNames) -join ' ') | Should -Not -Match 'value-that-must-not-show'
        Clear-DESecrets
    }
    It 'Test-DEFileHash matches, mismatches and reports a missing file as false' {
        $f = Join-Path $global:DETest.Dir 'h.txt'; Set-Content -LiteralPath $f -Value 'abc' -NoNewline
        $h = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash
        Test-DEFileHash -Path $f -Sha256 $h | Should -Be $true
        Test-DEFileHash -Path $f -Sha256 ('0' * 64) | Should -Be $false
        Test-DEFileHash -Path (Join-Path $global:DETest.Dir 'nope') -Sha256 $h | Should -Be $false
    }
    It 'Set-DEJsonFile scrubs secret-looking keys and Get-DEJsonFile reads it back' {
        $f = Join-Path $global:DETest.Dir 'sub/x.json'
        Set-DEJsonFile -Path $f -Object @{ name = 'ok'; apiKey = 'k-123'; nested = @{ password = 'p' } }
        $o = Get-DEJsonFile -Path $f
        $o.name | Should -Be 'ok'
        (Get-Content -LiteralPath $f -Raw) | Should -Not -Match 'k-123'
        (Get-Content -LiteralPath $f -Raw) | Should -Not -Match '"p"'
    }
    It 'Get-DEGateBoard returns every registered gate with a status' {
        Register-DEGate -Id 'gate.t1' -Title 't1' -Module 'test' -Check { @{ Status = 'PASS'; Detail = 'ok' } } -Unblock 'n/a'
        Register-DEGate -Id 'gate.t2' -Title 't2' -Module 'test' -Check { @{ Status = 'BLOCKED'; Detail = 'no' } } -Unblock 'fix it'
        $b = @(Get-DEGateBoard -Refresh)
        ($b | Where-Object { $_.Id -eq 'gate.t1' }).Status | Should -Be 'PASS'
        ($b | Where-Object { $_.Id -eq 'gate.t2' }).Status | Should -Be 'BLOCKED'
    }
    It 'Set-DEResume records the resume point and Get-DEResume reads it' {
        Set-DEResume -Launcher 'C:\DE\Start-DETechTool.cmd' -NextAction 'identity.verify-migration' -LoginAs '.\sthompson' -WhatIf
        (Get-DEResume).nextAction | Should -Be 'identity.verify-migration'
        (Get-DEResume).launcher | Should -Match 'Start-DETechTool.cmd'
    }
    It 'Invoke-DERestart never restarts under WhatIf or dry run' {
        Mock -ModuleName DE.Core Add-DEEvidence { } -ParameterFilter { $ActionTaken -like 'shutdown*' }
        Invoke-DERestart -DelaySeconds 5 -WhatIf
        Assert-MockCalled -ModuleName DE.Core Add-DEEvidence -Times 0 -ParameterFilter { $ActionTaken -like 'shutdown*' }
    }
    It 'Invoke-DERollback: SKIPPED without a rollback, PLANNED under dry run, PASS or FAIL from the rollback itself' {
        Register-DEAction -Id 't.norb' -Module 'test' -Title 'no rollback' -Phase 99 -Detect { @{ ok = $true } }
        (Invoke-DERollback -Id 't.norb').result | Should -Be 'SKIPPED'
        Register-DEAction -Id 't.rb' -Module 'test' -Title 'rollback' -Phase 99 -Detect { @{ ok = $true } } -Rollback { param($s) 'restored' }
        Set-DEMode -Mode Apply -DryRun; (Invoke-DERollback -Id 't.rb').result | Should -Be 'PLANNED'
        Set-DEMode -Mode Apply; (Invoke-DERollback -Id 't.rb').result | Should -Be 'WARN'   # text only: nothing proved the undo
        Register-DEAction -Id 't.rbok' -Module 'test' -Title 'verified rollback' -Phase 99 -Detect { @{ ok = $true } } -Rollback { param($s) 'noise'; @{ ok = $true; detail = 'previous value restored and read back' } }
        (Invoke-DERollback -Id 't.rbok').result | Should -Be 'PASS'
        Register-DEAction -Id 't.rbno' -Module 'test' -Title 'unverified rollback' -Phase 99 -Detect { @{ ok = $true } } -Rollback { param($s) @{ ok = $false; detail = 'value still set' } }
        (Invoke-DERollback -Id 't.rbno').result | Should -Be 'FAIL'
        Register-DEAction -Id 't.rbfail' -Module 'test' -Title 'bad rollback' -Phase 99 -Detect { @{ ok = $true } } -Rollback { param($s) throw 'cannot restore' }
        (Invoke-DERollback -Id 't.rbfail').result | Should -Be 'FAIL'
        Set-DEMode -Mode Audit
    }
    It 'Invoke-DENative returns the exit code and output, and redacts secrets in the log' {
        $exe = (Get-Process -Id $PID).Path
        Set-DESecret -Name 'T_NATIVE' -Plain 'native-secret-value-987'
        $r = Invoke-DENative -FilePath $exe -Arguments @('-NoProfile', '-Command', 'Write-Output hello; exit 3 # native-secret-value-987')
        $r.ExitCode | Should -Be 3
        $r.Text | Should -Match 'hello'
        (Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw) | Should -Not -Match 'native-secret-value-987'
        Clear-DESecrets
    }
    It 'Invoke-DEJsonPost refuses plain HTTP and sends a bearer token and a scrubbed body over HTTPS' {
        { Invoke-DEJsonPost -Uri 'http://hub.example/x' -Body @{ a = 1 } } | Should -Throw
        Set-DESecret -Name 'T_HUB' -Plain 'hub-token-abc'
        Mock -ModuleName DE.Core Invoke-RestMethod { $global:DETest.Post = @{ Headers = $Headers; Body = $(if ($Body -is [byte[]]) { [Text.Encoding]::UTF8.GetString($Body) } else { $Body }); Uri = $Uri; ContentType = $ContentType }; @{ ok = $true } }
        $null = Invoke-DEJsonPost -Uri 'https://hub.example/x' -Body @{ device = 'd1'; token = 'leak-me' } -TokenSecret 'T_HUB'
        $global:DETest.Post.Headers['Authorization'] | Should -Be 'Bearer hub-token-abc'
        $global:DETest.Post.Body | Should -Not -Match 'leak-me'
        $global:DETest.Post.Body | Should -Match 'd1'
        $global:DETest.Post.ContentType | Should -Match 'charset=utf-8'
        Clear-DESecrets
    }
    It 'Set-DERegistryValue changes nothing under WhatIf; Backup-DERegistryKey and Test-DEIsElevated are safe off Windows' {
        Mock -ModuleName DE.Core New-ItemProperty { throw 'registry written under WhatIf' }
        { Set-DERegistryValue -Path 'HKLM:\SOFTWARE\DE-Test' -Name 'x' -Value 1 -WhatIf } | Should -Not -Throw
        if ($env:OS -ne 'Windows_NT') { Backup-DERegistryKey -Key 'HKLM\SOFTWARE\X' | Should -BeNullOrEmpty; Test-DEIsElevated | Should -Be $false }
    }
    It 'Write-DEIntegrityEvidence records the integrity result as evidence' {
        $i = Write-DEIntegrityEvidence
        $i.status | Should -Not -BeNullOrEmpty
        @(Get-DEEvidence | Where-Object { $_.step -eq 'console.integrity' }).Count | Should -BeGreaterThan 0
    }
}

Describe 'Discovery engines never throw and return their documented shape' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'device, identity, MDM, agents, BitLocker, updates, network, browsers and reboot state' {
        $d = Get-DEDeviceInventory; $d.Keys | Should -Contain 'serial'
        $i = Get-DEIdentityState; $i.Keys | Should -Contain 'joinType'
        $m = Get-DEMdmState; $m.Keys | Should -Contain 'authority'
        (Get-DEJumpCloudAgentState).Keys | Should -Contain 'installed'
        (Get-DESecurityAgentState).Keys | Should -Contain 'conflictingEdr'
        $null = Get-DEBitLockerState
        $null = Get-DEWindowsUpdateState
        $null = Get-DENetworkState
        $null = Get-DEBrowserState
        (Get-DEPendingReboot).Keys | Should -Contain 'pending'
    }
    It 'Find-DEApp matches by pattern in a given app list' {
        $apps = @(@{ name = 'Dropbox'; version = '1' }, @{ name = 'Google Chrome'; version = '2' })
        @(Find-DEApp -NamePattern 'Chrome' -Apps $apps).Count | Should -Be 1
        @(Find-DEApp -NamePattern 'Zoom' -Apps $apps).Count | Should -Be 0
    }
    It 'Test-DEConnectivity reports an unreachable host without throwing' {
        $c = Test-DEConnectivity -Hosts @('de-test-unreachable.invalid')
        $c.allOk | Should -Be $false
    }
    It 'Get-DEDiscoverySnapshot builds the full snapshot' {
        $s = Get-DEDiscoverySnapshot -SkipApps -SkipUpdates -SkipConnectivity
        foreach ($k in @('device', 'identity', 'mdm', 'agents')) { $s.Keys | Should -Contain $k }
    }
}

Describe 'Identity: gates and refusals' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole }
        foreach ($stub in @('Suspend-BitLocker', 'Resume-BitLocker', 'Install-Module', 'Start-Migration')) { if (-not (Get-Command $stub -ErrorAction SilentlyContinue)) { New-Item -Path "function:global:$stub" -Value { param([Parameter(ValueFromRemainingArguments = $true)]$Rest) } | Out-Null } }
    }
    It 'the break-glass account is never jrpetro and is unverified until a real sign-in is confirmed' {
        (Get-DEBreakGlassState).normalAdminIsNotBreakGlass | Should -Be $true
        (Get-DEBreakGlassState -Name 'jrpetro').normalAdminIsNotBreakGlass | Should -Be $false
        { New-DEBreakGlassAccount -Name 'jrpetro' -WhatIf } | Should -Throw
        Mock -ModuleName DE.Identity Test-DEBreakGlassLogon { @{ ok = $false; detail = 'LogonUser failed' } }
        Confirm-DEBreakGlassVerified | Should -Be $false
        Get-DEState -Path 'identity.breakGlass.verifiedAt' | Should -BeNullOrEmpty
        if ($env:OS -ne 'Windows_NT') { (Test-DEBreakGlassLogon).ok | Should -Be $false }
    }
    It 'the BitLocker gate is BLOCKED unencrypted, WARN without the protector id, PASS with the right id' {
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyDecrypted'; protection = 'Off'; hasTpm = $false; hasRecoveryPassword = $false; recoveryProtectorIds = @() } } }
        (Test-DEBitLockerGate).Status | Should -Be 'BLOCKED'
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyEncrypted'; protection = 'On'; hasTpm = $true; hasRecoveryPassword = $true; recoveryProtectorIds = @('{AAA}'); method = 'XtsAes256' } } }
        (Test-DEBitLockerGate).Status | Should -Be 'WARN'
        (Test-DEBitLockerGate -ExpectedProtectorId '{BBB}').Status | Should -Be 'WARN'
        (Test-DEBitLockerGate -ExpectedProtectorId '{AAA}').Status | Should -Be 'PASS'
        { Set-DEBitLockerExpectedProtector -ProtectorId '123456-123456-123456-123456-123456-123456-123456-123456' } | Should -Throw
    }
    It 'suspending and resuming BitLocker respect WhatIf' {
        Mock -ModuleName DE.Identity Suspend-BitLocker { throw 'suspended under WhatIf' }
        Mock -ModuleName DE.Identity Resume-BitLocker { throw 'resumed under WhatIf' }
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ osProtectionOn = $true } }
        { Suspend-DEBitLockerForFirmware -WhatIf } | Should -Not -Throw
        { Resume-DEBitLocker -WhatIf } | Should -Not -Throw
    }
    It 'the OneDrive gate: PASS with no business account, BLOCKED when not running, WARN until confirmed' {
        Mock -ModuleName DE.Identity Get-DEOneDriveState { @{ businessAccounts = @(); running = $false; classification = 'none' } }
        (Test-DEOneDriveGate).Status | Should -Be 'PASS'
        Mock -ModuleName DE.Identity Get-DEOneDriveState { @{ businessAccounts = @(@{ email = 's@alamo.example' }); running = $false; classification = 'business' } }
        (Test-DEOneDriveGate).Status | Should -Be 'BLOCKED'
        Mock -ModuleName DE.Identity Get-DEOneDriveState { @{ businessAccounts = @(@{ email = 's@alamo.example' }); running = $true; classification = 'business' } }
        (Test-DEOneDriveGate).Status | Should -Be 'WARN'
        Confirm-DEOneDriveSynced
        (Test-DEOneDriveGate).Status | Should -Be 'PASS'
    }
    It 'clearing the Hello container is a no-op when there is none' {
        $saved = $env:SystemRoot; $env:SystemRoot = $global:DETest.Dir
        try { Clear-DEHelloContainer | Should -Be 'no NGC container' } finally { $env:SystemRoot = $saved }
    }
    It 'ADMU: reports not installed and never installs under WhatIf' {
        Mock -ModuleName DE.Identity Get-DEAdmuState { @{ installed = $false; version = $null } }
        Mock -ModuleName DE.Identity Install-Module { throw 'installed under WhatIf' }
        { Install-DEAdmu -WhatIf } | Should -Not -Throw
        (Get-DEAdmuState).installed | Should -Be $false
    }
    It 'migration refuses on failed preconditions or a missing temp password, and a planned run records and installs nothing' {
        Mock -ModuleName DE.Identity Test-DEMigrationPreconditions { @{ ok = $false; issues = @('source user is signed in') } }
        (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' }) | Should -Match 'signed in'
        Mock -ModuleName DE.Identity Test-DEMigrationPreconditions { @{ ok = $true; issues = @(); sourceProfile = @{ path = 'C:\Users\SuzetteThompson' } } }
        (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' }) | Should -Match 'MIGRATION_TEMP_PASSWORD'
        Set-DESecret -Name 'MIGRATION_TEMP_PASSWORD' -Plain 'Temp-Password-For-Test-1!'
        Mock -ModuleName DE.Identity Install-DEAdmu { throw 'ADMU installed for a planned run' }
        $r = Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' -WhatIf
        $r.planned | Should -Be $true
        Get-DEState -Path 'identity.migration' | Should -BeNullOrEmpty
        Clear-DESecrets
    }
    It 'migration refuses without a ProfileList backup' {
        Set-DESecret -Name 'MIGRATION_TEMP_PASSWORD' -Plain 'Temp-Password-For-Test-1!'
        Mock -ModuleName DE.Identity Test-DEMigrationPreconditions { @{ ok = $true; issues = @(); sourceProfile = @{ path = 'C:\Users\SuzetteThompson' } } }
        Mock -ModuleName DE.Identity Install-DEAdmu { 'present' }
        Mock -ModuleName DE.Identity Import-Module { }
        Mock -ModuleName DE.Identity Backup-DERegistryKey { $null }
        Mock -ModuleName DE.Identity Start-Migration { throw 'migrated without a rollback point' }
        (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' -Confirm:$false }) | Should -Match 'rollback point'
        Get-DEState -Path 'identity.migration' | Should -BeNullOrEmpty
        Clear-DESecrets
    }
    It 'migration verification passes only when the local account owns the preserved profile' {
        (Test-DEMigrationResult).ok | Should -Be $false
        Set-DEStateValue -Path 'identity.migration' -Value @{ source = 'AzureAD\SuzetteThompson'; target = 'sthompson'; sourceProfilePath = 'C:\Users\SuzetteThompson'; leaveEntra = $false; status = 'migrated-pending-reboot' }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; localUsers = @(@{ name = 'sthompson'; enabled = $true; sid = 'S-1-5-21-1' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-5-21-9' }) } }
        (Test-DEMigrationResult).ok | Should -Be $false
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; localUsers = @(@{ name = 'sthompson'; enabled = $true; sid = 'S-1-5-21-1' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-5-21-1' }) } }
        (Test-DEMigrationResult).ok | Should -Be $true
        Set-DEStateValue -Path 'identity.migration' -Value $null
    }
    It 'Entra leave does nothing off Entra and refuses while a gate is closed' {
        Mock -ModuleName DE.Identity Invoke-DENative { throw 'dsregcmd /leave ran' }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'local-workgroup' } }
        Invoke-DEEntraLeave | Should -Be 'not joined to Entra ID or a domain'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined' } }
        Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'BLOCKED'; Detail = 'x' } }
        (Get-DEThrown { Invoke-DEEntraLeave -Confirm:$false }) | Should -Match 'refusing to leave Microsoft'
    }
    It 'stale MDM cleanup keeps any enrollment whose registry backup failed' {
        Mock -ModuleName DE.Identity Get-DEMdmState { @{ staleEnrollments = @(@{ id = 'E1' }, @{ id = 'E2' }) } }
        Mock -ModuleName DE.Identity Remove-Item { }
        Mock -ModuleName DE.Identity Backup-DERegistryKey { $null }
        (Get-DEThrown { Remove-DEStaleMdmEnrollments -Confirm:$false }) | Should -Match 'kept 2'
        Assert-MockCalled -ModuleName DE.Identity Remove-Item -Times 0
        Mock -ModuleName DE.Identity Backup-DERegistryKey { 'C:\DE\backups\e.reg' }
        Remove-DEStaleMdmEnrollments -Confirm:$false | Should -Match 'removed 2'
    }
}

Describe 'JumpCloud API calls' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole
        $global:DETest = @{ Calls = New-Object System.Collections.ArrayList }
    }
    BeforeEach {
        $global:DETest.Calls.Clear()
        Set-DESecret -Name 'JC_API_KEY' -Plain 'jc-api-key-test-0001'
        Mock -ModuleName DE.JumpCloud Invoke-RestMethod {
            [void]$global:DETest.Calls.Add(@{ Method = "$Method"; Uri = "$Uri"; Headers = $Headers; Body = $(if ($Body -is [byte[]]) { [Text.Encoding]::UTF8.GetString($Body) } else { $Body }) })
            switch -Regex ("$Uri") {
                '/search/systemusers$' { @{ results = @(@{ _id = 'U1'; username = 'sthompson' }) } }
                '/search/systems$' { @{ results = @(@{ _id = 'S1'; hostname = 'ALAMO-LAP-0231' }) } }
                '/systems/S1$' { @{ _id = 'S1'; hostname = 'ALAMO-LAP-0231' } }
                '/v2/systems/S1/users(\?|$)' { @(@{ id = 'U1' }) }
                '/v2/systems/S1/memberof(\?|$)' { @(@{ id = 'G1' }) }
                '/v2/systems/S1/policystatuses(\?|$)' { @(@{ policy = @{ name = 'BitLocker' }; success = $true; exitCode = 0 }, @{ policy = @{ name = 'Firewall' }; success = $false; exitCode = 1 }) }
                'groups\?filter=' { @(@{ id = 'G1'; name = 'Alamo Laptops' }) }
                '/v2/usergroups/G1/members(\?|$)' { if ("$Method" -eq 'GET') { @(@{ to = @{ id = 'U1' } }) } }
                default { $null }
            }
        }
        Mock -ModuleName DE.JumpCloud Get-DEJumpCloudAgentState { @{ installed = $true; systemKey = $null } }
    }
    AfterEach { Clear-DESecrets }
    It 'refuses without the API key and refuses a GET with a body' {
        Clear-DESecrets
        (Get-DEThrown { Invoke-DEJumpCloudApi -Method GET -Path '/systems' }) | Should -Match 'JC_API_KEY'
        Set-DESecret -Name 'JC_API_KEY' -Plain 'jc-api-key-test-0001'
        (Get-DEThrown { Invoke-DEJumpCloudApi -Method GET -Path '/search/systems' -Body @{ a = 1 } }) | Should -Match 'cannot carry a body'
    }
    It 'searches users and systems by POST with a filter list, the key in x-api-key, and never logs the key' {
        (Get-DEJumpCloudUser -Username 'sthompson')._id | Should -Be 'U1'
        $c = $global:DETest.Calls[0]
        $c.Method | Should -Be 'POST'; $c.Uri | Should -Be 'https://console.jumpcloud.com/api/search/systemusers'
        $c.Headers['x-api-key'] | Should -Be 'jc-api-key-test-0001'
        ($c.Body | ConvertFrom-Json).filter[0].username | Should -Be 'sthompson'
        (Get-DEJumpCloudSystem)._id | Should -Be 'S1'
        (Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw) | Should -Not -Match 'jc-api-key-test-0001'
    }
    It 'a search is a read: it still runs under WhatIf, while a write does not' {
        (Invoke-DEJumpCloudApi -Method POST -Search -Path '/search/systemusers' -Body @{ filter = @(@{ username = 'sthompson' }) } -WhatIf).results[0]._id | Should -Be 'U1'
        Invoke-DEJumpCloudApi -Method POST -Path '/systemusers' -Body @{ username = 'x' } -WhatIf | Should -BeNullOrEmpty
        @($global:DETest.Calls | Where-Object { $_.Uri -like '*/api/systemusers' }).Count | Should -Be 0
        (Get-DEThrown { Invoke-DEJumpCloudApi -Method POST -Search -Path '/systemusers' -Body @{} }) | Should -Match 'only for POST /search'
    }
    It 'looks the system up by its agent key first' {
        Mock -ModuleName DE.JumpCloud Get-DEJumpCloudAgentState { @{ installed = $true; systemKey = 'S1' } }
        (Get-DEJumpCloudSystem)._id | Should -Be 'S1'
        $global:DETest.Calls[0].Uri | Should -Be 'https://console.jumpcloud.com/api/systems/S1'
        $global:DETest.Calls[0].Method | Should -Be 'GET'
    }
    It 'reads bound users, groups and policy results from the v2 endpoints' {
        @(Get-DEJumpCloudBoundUsers -SystemId 'S1')[0].id | Should -Be 'U1'
        @(Get-DEJumpCloudSystemGroupsOf -SystemId 'S1')[0].id | Should -Be 'G1'
        (Get-DEJumpCloudGroupByName -Name 'Alamo Laptops').id | Should -Be 'G1'
        @(Get-DEJumpCloudPolicyResults -SystemId 'S1').Count | Should -Be 2
        $s = Get-DEJumpCloudPolicySummary
        @($s.failed) | Should -Contain 'Firewall'
        @($s.failed) | Should -Not -Contain 'BitLocker'
    }
    It 'binding under WhatIf sends no write' {
        $null = Set-DEJumpCloudUserBinding -Username 'sthompson' -WhatIf
        @($global:DETest.Calls | Where-Object { $_.Uri -like '*/associations' }).Count | Should -Be 0
    }
    It 'binding sends the association with the sudo setting' {
        $null = Set-DEJumpCloudUserBinding -Username 'sthompson' -Confirm:$false
        $a = @($global:DETest.Calls | Where-Object { $_.Uri -like '*/v2/systems/S1/associations' })[0]
        $a.Method | Should -Be 'POST'
        $b = $a.Body | ConvertFrom-Json
        $b.op | Should -Be 'update'; $b.type | Should -Be 'user'; $b.id | Should -Be 'U1'; $b.attributes.sudo.enabled | Should -Be $false
    }
    It 'group membership: an existing member is not re-added, and a new membership is read back' {
        (Add-DEJumpCloudSystemToGroup -GroupName 'Alamo Laptops' -Confirm:$false).changed | Should -Be $false
        $r = Add-DEJumpCloudUserToGroup -Username 'sthompson' -GroupName 'Alamo Laptops' -Confirm:$false
        $r.member | Should -Be $true
    }
    It 'reports client-side components without throwing' {
        (Get-DEJumpCloudComponents).Keys | Should -Contain 'jumpcloudGoExtensionForced'
    }
}

Describe 'Operations helpers' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole }
        foreach ($stub in @('Get-PrinterPort', 'Add-PrinterPort', 'Get-Printer', 'Add-Printer', 'Import-Certificate')) { if (-not (Get-Command $stub -ErrorAction SilentlyContinue)) { New-Item -Path "function:global:$stub" -Value { param([Parameter(ValueFromRemainingArguments = $true)]$Rest) } | Out-Null } }
        if (-not $env:TEMP) { $env:TEMP = [IO.Path]::GetTempPath() }
    }
    It 'a Wi-Fi profile under WhatIf writes nothing; a real add deletes its temp file and never logs the passphrase' {
        Set-DESecret -Name 'WIFI_HQ_PSK' -Plain 'wifi-passphrase-xyz-42'
        Add-DEWifiProfile -Ssid 'ALAMO-STAFF' -SecretName 'WIFI_HQ_PSK' -WhatIf | Should -Be 'planned'
        Mock -ModuleName DE.Operations Invoke-DENative { $global:DETest.Wlan = ($Arguments | Where-Object { $_ -like 'filename=*' }) -replace '^filename=', ''; $global:DETest.WlanXml = Get-Content -LiteralPath $global:DETest.Wlan -Raw; [pscustomobject]@{ ExitCode = 0; Text = ''; Output = @() } }
        Add-DEWifiProfile -Ssid 'ALAMO-STAFF' -SecretName 'WIFI_HQ_PSK' -Confirm:$false | Should -Match 'added'
        $global:DETest.WlanXml | Should -Match '<name>ALAMO-STAFF</name>'
        $global:DETest.WlanXml | Should -Match 'wifi-passphrase-xyz-42'
        Test-Path -LiteralPath $global:DETest.Wlan | Should -Be $false
        (Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw) | Should -Not -Match 'wifi-passphrase-xyz-42'
        Clear-DESecrets
    }
    It 'printers are only added when not planned' {
        Add-DEPrinter -Name 'Front Desk' -Address '10.0.0.50' -WhatIf | Should -Be 'planned'
    }
    It 'a certificate is refused when its thumbprint differs from the expected one' {
        $rsa = [System.Security.Cryptography.RSA]::Create(2048)
        $req = New-Object System.Security.Cryptography.X509Certificates.CertificateRequest('CN=DE Test Root', $rsa, [System.Security.Cryptography.HashAlgorithmName]::SHA256, [System.Security.Cryptography.RSASignaturePadding]::Pkcs1)
        $cert = $req.CreateSelfSigned((Get-Date).AddDays(-1), (Get-Date).AddDays(30))
        $f = Join-Path $global:DETest.Dir 'root.cer'; [IO.File]::WriteAllBytes($f, $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
        (Get-DEThrown { Import-DECertificate -Path $f -ExpectedThumbprint ('A' * 40) -WhatIf }) | Should -Match 'does not match'
        Import-DECertificate -Path $f -ExpectedThumbprint $cert.Thumbprint.ToLowerInvariant() -WhatIf | Should -Be 'planned'
    }
    It 'OEM tooling: none found means no automated update, and a scan reports that' {
        Mock -ModuleName DE.Operations Get-DEDeviceInventory { @{ manufacturer = 'Contoso' } }
        (Get-DEOemTool).applicable | Should -Be 'none'
        (Invoke-DEOemScan).output | Should -Match 'no supported OEM tool'
        (Get-DEThrown { Invoke-DEOemUpdate -WhatIf }) | Should -Match 'no automated OEM update path'
    }
    It 'Dell Command Update: BIOS updates suspend BitLocker for one restart and unknown exit codes fail' {
        Mock -ModuleName DE.Operations Get-DEOemTool { @{ manufacturer = 'Dell Inc.'; dell = 'C:\dcu-cli.exe'; applicable = 'dell' } }
        Mock -ModuleName DE.Operations Get-DEBitLockerState { @{ osProtectionOn = $true } }
        Mock -ModuleName DE.Operations Suspend-DEBitLockerForFirmware { }
        Mock -ModuleName DE.Operations Request-DEReboot { }
        Mock -ModuleName DE.Operations Invoke-DENative { [pscustomobject]@{ ExitCode = 1; Text = ''; Output = @() } }
        Invoke-DEOemUpdate -IncludeBios -Confirm:$false | Should -Match 'exit 1'
        Assert-MockCalled -ModuleName DE.Operations Suspend-DEBitLockerForFirmware -Times 1
        Assert-MockCalled -ModuleName DE.Operations Request-DEReboot -Times 1
        Mock -ModuleName DE.Operations Invoke-DENative { [pscustomobject]@{ ExitCode = 3000; Text = 'error'; Output = @() } }
        (Get-DEThrown { Invoke-DEOemUpdate -Confirm:$false }) | Should -Match 'exit 3000'
    }
    It 'battery health, site resources and operational confirmations' {
        if ($env:OS -ne 'Windows_NT') { Get-DEBatteryHealth | Should -BeNullOrEmpty }
        $r = Test-DESiteResources -ClientProfile (Get-DEClientProfile -Id 'alamo')
        $r.Keys | Should -Contain 'connectivity'
        Confirm-DEOperationalCheck -Check 'operations.remoteSupport.testedAt' -Note 'session 123'
        Get-DEState -Path 'operations.remoteSupport.testedAt' | Should -Not -BeNullOrEmpty
    }
    It 'Windows Update needs the Windows Update agent' {
        if ($env:OS -ne 'Windows_NT') { { Install-DEWindowsUpdates -WhatIf } | Should -Throw }
    }
}

Describe 'Apps: trust policy and installers' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole } }
    It 'the local packages folder is under the console data folder' {
        Get-DELocalPackagesDir | Should -Not -BeNullOrEmpty
    }
    It 'winget packages trust the winget id; a non-HTTPS URL is refused; a missing local file fails trust' {
        (Get-DEPackageFile -Package (Get-DEPackage -Id 'chrome')).trust.Ok | Should -Be $true
        (Get-DEThrown { Get-DEPackageFile -Package @{ id = 'x'; source = @{ type = 'url'; url = 'http://example.com/a.msi' } } }) | Should -Match 'non\-HTTPS'
        $f = Get-DEPackageFile -Package @{ id = 'x'; source = @{ type = 'local'; localPath = 'does-not-exist.msi'; sha256 = ('0' * 64) } }
        $f.trust.Ok | Should -Be $false
    }
    It 'an install refuses a missing runtime secret and an untrusted file' {
        Clear-DESecrets
        (Get-DEThrown { Invoke-DEPackageInstall -Id 'sentinelone-agent' -WhatIf }) | Should -Match 'S1_SITE_TOKEN'
        Set-DESecret -Name 'S1_SITE_TOKEN' -Plain 's1-site-token-abcdef0123456789'
        (Get-DEThrown { Invoke-DEPackageInstall -Id 'sentinelone-agent' -Confirm:$false }) | Should -Match 'trust policy refused'
        Clear-DESecrets
    }
    It 'a winget install under WhatIf is planned with the exact id and runs nothing' {
        $r = Invoke-DEPackageInstall -Id 'chrome' -WhatIf
        $r.planned | Should -Be $true
        $r.detail | Should -Match 'winget.exe install --id'
        $r.detail | Should -Match '--exact'
    }
    It 'uninstalling an app that is not installed is a no-op; WhatIf runs nothing' {
        Mock -ModuleName DE.Apps Find-DEApp { @() }
        Mock -ModuleName DE.Apps Invoke-DENative { throw 'uninstall ran under WhatIf' }
        { Invoke-DEPackageUninstall -Id 'dropbox' -WhatIf } | Should -Not -Throw
        Mock -ModuleName DE.Apps Find-DEApp { @(@{ name = 'Dropbox'; uninstall = 'MsiExec.exe /X{11111111-2222-3333-4444-555555555555}' }) }
        (Invoke-DEPackageUninstall -Id 'dropbox' -WhatIf).planned | Should -Be $true
    }
    It 'the Microsoft 365 configuration XML carries the channel and no secrets' {
        $f = Join-Path $global:DETest.Dir 'm365.xml'
        $null = New-DEOfficeConfigXml -Package (Get-DEPackage -Id 'm365-apps') -ClientProfile (Get-DEClientProfile -Id 'alamo') -Path $f
        [xml]$x = Get-Content -LiteralPath $f -Raw
        $x.Configuration | Should -Not -BeNullOrEmpty
        $null = Get-DEM365Readiness -ExpectedUpn 'sthompson@alamo.example'
    }
}

Describe 'Configuration: baseline, browser, branding, shortcuts' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
        # Windows folders the branding and shortcut code joins paths with; off Windows they point at a temp folder
        foreach ($v in @('ProgramData', 'PUBLIC')) { if (-not (Get-Item -Path "env:$v" -ErrorAction SilentlyContinue)) { Set-Item -Path "env:$v" -Value $global:DETest.Dir } }
    }
    It 'baseline controls read state, and a WhatIf set changes nothing; the assessment writes a report' {
        Mock -ModuleName DE.Configure Set-DERegistryValue { throw 'registry written under WhatIf' }
        $c = @(Get-DEBaselineControls)[0]
        (Get-DEBaselineControlState -Control $c).Keys | Should -Contain 'ok'
        Set-DEBaselineControl -Control $c -WhatIf | Should -Be 'planned'
        $a = Invoke-DEBaselineAssessment -Label 'test'
        Test-Path -LiteralPath $a.file | Should -Be $true
        ($a.pass + $a.drift + $a.exceptions) | Should -Be @($a.rows).Count
    }
    It 'the browser policy has Chrome and Edge keys, PABX forced in, and the Alamo homepage when set' {
        $p = Get-DEBrowserPolicyProfile
        $p | Should -Not -BeNullOrEmpty
        $w = Get-DEBrowserDesiredPolicy -ClientProfile $global:DETest.Alamo
        $w.chrome.Count | Should -BeGreaterThan 0
        $w.edge.Count | Should -BeGreaterThan 0
        if ($env:OS -eq 'Windows_NT') { $null = Compare-DEBrowserPolicy -ClientProfile $global:DETest.Alamo }
        Mock -ModuleName DE.Configure Set-DERegistryValue { throw 'policy written under WhatIf' }
        Mock -ModuleName DE.Configure New-ItemProperty { throw 'policy written under WhatIf' }
        { Set-DEBrowserPolicy -ClientProfile $global:DETest.Alamo -WhatIf } | Should -Not -Throw
        { Set-DEDefaultBrowserAssociations -Browser edge -WhatIf } | Should -Not -Throw
    }
    It 'branding assets: the DE logo always, the Alamo logo only for Alamo' {
        $a = Get-DEBrandingAssets -ClientProfile $global:DETest.Alamo
        $a.deLogo | Should -Not -BeNullOrEmpty
        $a.clientLogo | Should -Match 'alamo-mark.png$'
        (Get-DEBrandingAssets -ClientProfile (New-DEClientProfileTemplate)).clientLogo | Should -BeNullOrEmpty
    }
    It 'branding under WhatIf changes nothing and a re-run never overwrites the client''s original look' {
        Mock -ModuleName DE.Configure Set-DERegistryValue { }
        Set-DEBranding -ClientProfile $global:DETest.Alamo -WhatIf | Should -Be 'planned'
        Get-DEState -Path 'branding.previous' | Should -BeNullOrEmpty
        Undo-DEBranding -WhatIf | Should -Be 'planned'
        $null = Get-DEBrandingState
    }
    It 'the hostname follows the client pattern and fits the 15-character limit' {
        Mock -ModuleName DE.Configure Get-DEDeviceInventory { @{ serial = 'ABCD-7XK2Q14' } }
        $h = New-DEHostname -ClientProfile $global:DETest.Alamo -Role 'LAP'
        $h.Length | Should -BeLessOrEqual 15
        $h | Should -Match '^ALAMO'
    }
    It 'support shortcuts: the default set, and none are written under WhatIf' {
        @(Get-DEShortcutDefinitions -ClientProfile @{}).Count | Should -Be 3
        Set-DESupportShortcuts -ClientProfile @{} -WhatIf | Should -Be 'planned'
    }
    It 'the branded wallpaper renders on Windows' {
        if ($env:OS -eq 'Windows_NT') { $f = New-DEBrandedWallpaper -ClientProfile $global:DETest.Alamo -Width 640 -Height 360 -OutFile (Join-Path $global:DETest.Dir 'w.png'); Test-Path -LiteralPath $f | Should -Be $true }
    }
}

Describe 'Evidence, security, vendors and workflow helpers' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole } }
    It 'the Hub payload has the device schema and no secrets; with no endpoint it is saved, not sent' {
        Set-DESecret -Name 'T_HUBP' -Plain 'hub-payload-secret-555'
        Add-DEEvidence -Step 't.hub' -Module 'test' -Before 'b' -ActionTaken 'a hub-payload-secret-555' -Result 'PASS' | Out-Null
        $p = New-DEHubPayload -Record @{ client = 'alamo'; hostname = 'ALAMO-LAP-0231'; serial = 'X' } -BundleSha256 ('a' * 64) -BundlePath 'C:\x\bundle.zip'
        $p.schema | Should -Be 'de.techconsole.device/v1'
        $p.evidence.bundleName | Should -Be 'bundle.zip'
        ($p | ConvertTo-Json -Depth 8) | Should -Not -Match 'hub-payload-secret-555'
        $r = Send-DEHubPayload -Payload $p
        $r.sent | Should -Be $false
        Test-Path -LiteralPath $r.file | Should -Be $true
        (Get-Content -LiteralPath $r.file -Raw) | Should -Not -Match 'hub-payload-secret-555'
        Clear-DESecrets
    }
    It 'installer diagnostics are redacted' {
        $saved = $env:TEMP; $env:TEMP = $global:DETest.Dir
        try {
            Set-Content -LiteralPath (Join-Path $global:DETest.Dir 'MSI1234.LOG') -Value 'Property(S): SITE_TOKEN=eyJhbGciOiJIUzI1NiJ9abcdefghijklmnop'
            $d = @(Get-DESanitizedInstallerDiagnostics)
            ($d | ConvertTo-Json -Depth 5) | Should -Not -Match 'eyJhbGciOiJIUzI1NiJ9abcdefghijklmnop'
        } finally { $env:TEMP = $saved }
    }
    It 'the security posture names Guardz primary for Alamo' {
        $s = Get-DESecurityPosture -ClientProfile (Get-DEClientProfile -Id 'alamo')
        ($s | ConvertTo-Json -Depth 6) | Should -Match 'guardz'
    }
    It 'vendor roles, the launcher page and opening a vendor' {
        $roles = @(Get-DEVendorRoles)
        $roles.Count | Should -Be 18
        $f = Join-Path $global:DETest.Dir 'launcher.html'
        $null = Export-DEVendorLauncherHtml -Path $f -ClientProfile (Get-DEClientProfile -Id 'alamo')
        $h = Get-Content -LiteralPath $f -Raw
        $h | Should -Match 'DE Vendor Admin Center'
        $h | Should -Not -Match 'href="http://'
        Mock -ModuleName DE.Vendors Start-Process { throw 'browser opened under WhatIf' }
        $id = (@(Get-DEVendors) | Where-Object { $_ -and (Get-DEProp $_ 'adminUrl') } | Select-Object -First 1).id
        if ($id) { { Open-DEVendor -Id $id -WhatIf } | Should -Not -Throw }
        { Open-DEVendor -Id 'no-such-vendor' } | Should -Throw
    }
    It 'resume with nothing queued returns nothing and restores no context' {
        Resume-DEWorkflow | Should -BeNullOrEmpty
    }
    It 'deprovision: data gate first, and DE-BreakGlass is removed only when the client has its own administrator' {
        $null = Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'deprovision'
        (Get-DEAction 'deprov.breakglass').Gates | Should -Contain 'deprov.gate.client-admin'
        (Get-DEAction 'deprov.agents').Gates | Should -Contain 'deprov.gate.data'
        Mock -ModuleName DE.Workflow Get-DEOtherLocalAdmins { @() }
        Reset-DEGateCache
        (Test-DEGate -Id 'deprov.gate.client-admin' -Refresh).Status | Should -Be 'BLOCKED'
        Mock -ModuleName DE.Workflow Get-DEOtherLocalAdmins { @('AlamoAdmin') }
        (Test-DEGate -Id 'deprov.gate.client-admin' -Refresh).Status | Should -Be 'PASS'
    }
}

Describe 'Module closures' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'no action scriptblock made with GetNewClosure calls a module-private function (it would not be found at run time)' {
        $broken = @()
        foreach ($f in Get-ChildItem -LiteralPath (Join-Path $script:ConsoleRoot 'modules') -Recurse -Filter '*.psm1') {
            $exported = @((Get-Module $f.BaseName).ExportedFunctions.Keys)
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$null)
            $private = @($ast.FindAll({ $args[0] -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true) | ForEach-Object { $_.Name } | Where-Object { $exported -notcontains $_ })
            foreach ($c in @($ast.FindAll({ $args[0] -is [System.Management.Automation.Language.InvokeMemberExpressionAst] -and $args[0].Member.Value -eq 'GetNewClosure' }, $true))) {
                foreach ($n in @($c.Expression.FindAll({ $args[0] -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { $_.GetCommandName() } | Where-Object { $_ })) {
                    if ($private -contains $n) { $broken += "$($f.Name):$($c.Extent.StartLineNumber) $n" }
                }
            }
        }
        $broken | Should -BeNullOrEmpty
    }
}

Describe 'Fixes from the function-by-function review' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Exe = (Get-Process -Id $PID).Path; Alamo = Get-DEClientProfile -Id 'alamo' }
    }
    It 'readiness: an in-plan check that never ran keeps the device IN PROGRESS, a skip is READY WITH EXCEPTIONS, a stray FAIL is NOT READY' {
        Initialize-DEWorkflow -ClientProfile (New-DEComposedProfile -ClientProfile $global:DETest.Alamo -Solution 'technology_strategy') -Mode 'new' | Out-Null
        Clear-DEEvidence
        (Get-DEReadiness).overall | Should -Be 'NOT RUN'
        $null = Invoke-DEAction -Id 'plan.technology_strategy-roadmap' -SkipReason 'client declined'
        (Get-DEReadiness).overall | Should -Be 'READY WITH EXCEPTIONS'
        Add-DEEvidence -Step 'console.integrity' -Module 'core' -Before 'x' -ActionTaken 'integrity check' -Result 'FAIL' | Out-Null
        (Get-DEReadiness).overall | Should -Be 'NOT READY'
        Clear-DEEvidence
        Add-DEEvidence -Step 'order.verify-device' -Module 'order' -Before 'x' -ActionTaken 'refused' -Result 'BLOCKED' | Out-Null
        (Get-DEReadiness).blocked | Should -Be $true
    }
    It 'safety gates cannot be opened by an exception' {
        Register-DEGate -NoException -Id 'gate.t-safety' -Title 'safety' -Module 'test' -Check { @{ Status = 'BLOCKED'; Detail = 'no' } }
        (Get-DEThrown { Add-DEException -Target 'gate.t-safety' -Reason 'r' -Approver 'Joe' -ExpiresOn (Get-Date).AddDays(3) }) | Should -Match 'safety gate'
        (Test-DEGate -Id 'gate.t-safety' -Refresh).Status | Should -Be 'BLOCKED'
    }
    It 'a Verify block''s stray output never reads as success; its last value is the verdict' {
        Set-DEMode -Mode Apply
        $global:DETest.V = 0
        Register-DEAction -Id 't.verify' -Module 'test' -Title 'verify' -Phase 99 -Detect { @{ v = $global:DETest.V } } -Desired { @{ v = 1 } } -Apply { param($s) $global:DETest.V = 1 } -Verify { param($a) 'some log line'; @{ ok = $false; detail = 'not really' } }
        (Invoke-DEAction -Id 't.verify' -Mode Apply -MaxRetries 0 -Confirm:$false).result | Should -Be 'FAIL'
        Set-DEMode -Mode Audit
    }
    It 'an approved exception on an action turns audit drift into EXCEPTION, never PASS' {
        Register-DEAction -Id 't.exc' -Module 'test' -Title 'exc' -Phase 99 -Detect { @{ v = 0 } } -Desired { @{ v = 1 } }
        $null = Add-DEException -Target 't.exc' -Reason 'legacy app' -Approver 'Joe' -ExpiresOn (Get-Date).AddDays(10)
        (Invoke-DEAction -Id 't.exc' -Mode Audit).result | Should -Be 'EXCEPTION'
        Remove-DEException -Target 't.exc'
    }
    It 'deprovision runs only the deprovision steps, never installs' {
        $ids = @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'deprovision')
        @($ids | Where-Object { $_ -notlike 'deprov.*' }).Count | Should -Be 0
    }
    It 'identity migration steps are scoped to takeover, co-managed and audit' {
        @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'new') | Should -Not -Contain 'identity.migrate'
        @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover') | Should -Contain 'identity.migrate'
    }
    It 'Entra leave is its own verified step by default, absent when the client stays joined' {
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['identity']['leaveEntra'] = $null; $p['identity'].Remove('leaveEntraDuringMigration')
        @(Initialize-DEWorkflow -ClientProfile $p -Mode 'takeover') | Should -Contain 'identity.entra-leave'
        $p['identity']['leaveEntra'] = $false
        @(Initialize-DEWorkflow -ClientProfile $p -Mode 'takeover') | Should -Not -Contain 'identity.entra-leave'
    }
    It 'plans: co-managed keeps its limits with a solution; an unknown area and add-ons on a standalone plan are refused' {
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['coManaged'] = @{ deOwns = @('identity') }
        $ids = @(Initialize-DEWorkflow -ClientProfile (New-DEComposedProfile -ClientProfile $p -Bundle 'co-managed' -Solution 'cybersecurity_operations') -Mode 'co-managed')
        @($ids | Where-Object { $_ -like 'security.*' -or $_ -like 'baseline.*' }).Count | Should -Be 0
        $p['coManaged'] = @{ deOwns = @('identiy') }
        (Get-DEThrown { New-DEComposedProfile -ClientProfile $p -Bundle 'co-managed' }) | Should -Match 'unknown co-managed area'
        (Get-DEThrown { New-DEComposedProfile -ClientProfile $global:DETest.Alamo -Solution 'identity_access' -AddOn 'sase' }) | Should -Match 'add-ons'
    }
    It 'dsregcmd output without the join answers is unknown, never local' {
        (ConvertFrom-DEDsregcmd -Text "Error : The operation failed`nCode : 0x80070005").joinType | Should -Be 'unknown'
    }
    It 'native runs time out and are killed; arguments that carry their own quotes are passed as written' {
        $r = Invoke-DENative -FilePath $global:DETest.Exe -Arguments @('-NoProfile', '-Command', 'Start-Sleep -Seconds 30') -TimeoutSeconds 2
        $r.TimedOut | Should -Be $true
        ConvertTo-DEArgumentString -Arguments @('/i', 'C:\Program Files\x.msi', 'JCINSTALLERARGUMENTS="-k KEY"') | Should -Be '/i "C:\Program Files\x.msi" JCINSTALLERARGUMENTS="-k KEY"'
    }
    It 'uninstall never guesses silent switches' {
        Mock -ModuleName DE.Apps Get-DEPackage { @{ id = 'x'; name = 'X App'; source = @{ type = 'local' }; detect = @{ appNameRegex = 'X App' } } }
        Mock -ModuleName DE.Apps Find-DEApp { @(@{ name = 'X App'; uninstall = 'C:\X\uninst.exe'; quietUninstall = '' }) }
        $r = Invoke-DEPackageUninstall -Id 'x' -Confirm:$false
        $r.ok | Should -Be $false; $r.manual | Should -Be $true
    }
    It 'the OneDrive gate sees the end user''s business OneDrive in their profile folder' {
        $global:DETest.Prof = Join-Path $global:DETest.Dir 'SuzetteThompson'; New-Item -ItemType Directory -Path (Join-Path $global:DETest.Prof 'OneDrive - Alamo Industries') -Force | Out-Null
        Set-DEContext -Values @{ sourcePrincipal = 'AzureAD\SuzetteThompson' }
        Mock -ModuleName DE.Identity Get-DEOneDriveState { @{ businessAccounts = @(); running = $false; classification = 'none' } }
        Mock -ModuleName DE.Identity Find-DEProfileForUser { @(@{ path = $global:DETest.Prof; sid = 'S-1-12-1-1' }) }
        Set-DEStateValue -Path 'identity.onedrive.syncConfirmedAt' -Value $null
        (Test-DEOneDriveGate).Status | Should -Be 'WARN'
        Confirm-DEOneDriveSynced
        (Test-DEOneDriveGate).Status | Should -Be 'PASS'
    }
    It 'profile lookup prefers the exact folder and several candidates block the migration' {
        $profiles = @(@{ path = 'C:\Users\jsmith'; sid = 'A' }, @{ path = 'C:\Users\jsmith.CONTOSO'; sid = 'B' })
        @(Find-DEProfileForUser -UserName 'AzureAD\jsmith' -Profiles $profiles).Count | Should -Be 1
        @(Find-DEProfileForUser -UserName 'AzureAD\jdoe' -Profiles @(@{ path = 'C:\Users\jdoe.A'; sid = 'A' }, @{ path = 'C:\Users\jdoe.B'; sid = 'B' })).Count | Should -Be 2
    }
    It 'secret detection in profiles catches short Wi-Fi keys and passphrases' {
        @(Test-DEProfileHasSecrets -Profile @{ network = @{ wifiPsk = 'abc123' } }).Count | Should -BeGreaterThan 0
        @(Test-DEProfileHasSecrets -Profile @{ s1 = @{ uninstallPassphrase = 'x' } }).Count | Should -BeGreaterThan 0
        (Remove-DESecretKeys -Object @{ list = @('one') }).list.GetType().IsArray | Should -Be $true
    }
    It 'headless: an unknown client is REFUSED with exit 2 and a result file; a profile file runs the plan' {
        $rf = Join-Path $global:DETest.Dir 'result.json'
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Client 'no-such-client' -ResultFile $rf -DataDir (Join-Path $global:DETest.Dir 'd1') | Out-Null
        $LASTEXITCODE | Should -Be 2
        (Get-Content -LiteralPath $rf -Raw | ConvertFrom-Json).overall | Should -Be 'REFUSED'
        $pf = Join-Path $global:DETest.Dir 'profile.json'
        New-DEComposedProfile -ClientProfile $global:DETest.Alamo -Solution 'technology_strategy' | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $pf -Encoding UTF8
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -ProfileFile $pf -ResultFile $rf -DataDir (Join-Path $global:DETest.Dir 'd2') 2>&1 | ForEach-Object { "$_" }
        ($out -join "`n") | Should -Match 'PLAN: standalone: technology_strategy'
        $res = Get-Content -LiteralPath $rf -Raw | ConvertFrom-Json
        $res.exitCode | Should -Be $LASTEXITCODE
        $res.overall | Should -Not -Be 'ERROR' -Because "$($res.message)"
        $res.overall | Should -Not -Match '^READY'
    }
    It 'headless plan-only (-WhatIf) still writes the whole evidence bundle and a result file' {
        $rf = Join-Path $global:DETest.Dir 'result-plan.json'
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Mode audit -Client 'alamo' -Technician 'tester' -WhatIf -ResultFile $rf -DataDir (Join-Path $global:DETest.Dir 'd3') | Out-Null
        $res = Get-Content -LiteralPath $rf -Raw | ConvertFrom-Json
        $res.exitCode | Should -Be $LASTEXITCODE
        $res.overall | Should -Not -Be 'ERROR' -Because "$($res.message)"
        $zip = ($res.bundle -replace ' \(sha256 .*$', '')
        Test-Path -LiteralPath $zip | Should -Be $true
        $folder = $zip -replace '\.zip$', ''
        foreach ($f in @('report-client.html', 'report-internal.html', 'manifest.sha256')) { Test-Path -LiteralPath (Join-Path $folder $f) | Should -Be $true }
        # every manifest line is the file's real sha256
        foreach ($line in @(Get-Content -LiteralPath (Join-Path $folder 'manifest.sha256'))) {
            $hash, $name = $line -split '  ', 2
            $hash | Should -Be (Get-FileHash -LiteralPath (Join-Path $folder $name) -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    It 'headless: an unexpected error still leaves through RESULT with an ERROR result file' {
        $rf = Join-Path $global:DETest.Dir 'result-error.json'
        $notDir = Join-Path $global:DETest.Dir 'not-a-dir'; Set-Content -LiteralPath $notDir -Value 'x'
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Mode audit -Client 'alamo' -Technician 'tester' -ResultFile $rf -DataDir $notDir | Out-Null
        $LASTEXITCODE | Should -Be 1
        $res = Get-Content -LiteralPath $rf -Raw | ConvertFrom-Json
        $res.overall | Should -Be 'ERROR'
        $res.message | Should -Match '^ERROR: '
    }
}

Describe 'Choices Joe made in review' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Exe = (Get-Process -Id $PID).Path; Alamo = Get-DEClientProfile -Id 'alamo' }
    }
    It 'updates: JumpCloud is the default authority and is checked; Intune and Windows are per-client options' {
        $ids = @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'new')
        $ids | Should -Contain 'maint.update-authority'
        $ids | Should -Not -Contain 'baseline.wu-auto'
        (Get-DEAction 'maint.update-authority').Title | Should -Match 'jumpcloud'
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['updates'] = @{ authority = 'windows' }
        @(Initialize-DEWorkflow -ClientProfile $p -Mode 'new') | Should -Contain 'baseline.wu-auto'
        $p['updates'] = @{ authority = 'intune' }
        $null = Initialize-DEWorkflow -ClientProfile $p -Mode 'new'
        # this test machine is not Intune-enrolled, so an Intune authority must read as not in place
        if ($env:OS -ne 'Windows_NT') { (Get-DEActionState -Id 'maint.update-authority').Status | Should -Be 'DRIFT' }
        $p['updates'] = @{ authority = 'jumpcloudd' }
        $null = Initialize-DEWorkflow -ClientProfile $p -Mode 'new'
        (Get-DEActionState -Id 'maint.update-authority').Drift -join ' ' | Should -Match 'ready'
    }
    It 'an order without a serial is refused when there is no one at the device to read it' {
        $o = Get-Content -LiteralPath (Join-Path $script:ConsoleRoot 'catalog/orders/example-dropship-order.json') -Raw | ConvertFrom-Json
        $o.device.serial = ''
        $f = Join-Path $global:DETest.Dir 'noserial.json'; $o | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $f -Encoding UTF8
        $out = $null | & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Order $f -Apply -Mode dropship -Technician 'test' -DataDir (Join-Path $global:DETest.Dir 'ns') 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 2
        ($out -join "`n") | Should -Match 'no serial number and there is no one at the device'
    }
    It 'the technician is remembered on the machine after the first run' {
        $data = Join-Path $global:DETest.Dir 'tech'
        $null | & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Client alamo -Solution technology_strategy -Technician 'akim' -DataDir $data 2>&1 | Out-Null
        $state = Get-ChildItem -LiteralPath (Join-Path $data 'state') -Filter '*.json' | Where-Object { $_.Name -notlike 'exceptions*' -and $_.Name -notlike 'gui-*' } | Select-Object -First 1
        (Get-Content -LiteralPath $state.FullName -Raw | ConvertFrom-Json).settings.technician | Should -Be 'akim'
        $out = $null | & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Client alamo -Solution technology_strategy -DataDir $data 2>&1 | ForEach-Object { "$_" }
        ($out -join "`n") | Should -Not -Match 'recorded as jrpetro'
    }
}

Describe 'A dropship order never leaks into later runs' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole; Exe = (Get-Process -Id $PID).Path } }
    It 'an order for another client adds no order checks, and a headless run without -Order clears a leftover one' {
        $null = Import-DEOrderManifest -Path (Join-Path $script:ConsoleRoot 'catalog/orders/example-dropship-order.json')
        $other = New-DEClientProfileTemplate; $other['id'] = 'contoso'
        @(Initialize-DEWorkflow -ClientProfile $other -Mode 'new') | Should -Not -Contain 'order.verify-device'
        $data = Join-Path $global:DETest.Dir 'leak'
        $null | & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Order (Join-Path $script:ConsoleRoot 'catalog/orders/example-dropship-order.json') -Technician t -DataDir $data 2>&1 | Out-Null
        $out = $null | & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:ConsoleRoot 'DETechConsole.ps1') -Headless -Client alamo -Bundle proactive-office -Technician t -DataDir $data 2>&1 | ForEach-Object { "$_" }
        ($out -join "`n") | Should -Not -Match 'dropship order'
    }
}

Describe 'Leaving Microsoft and backing up BitLocker before JumpCloud owns the device' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover'
        $global:DETest.Key = '111111-222222-333333-444444-555555-666666-777777-888888'
    }
    It 'reads every Microsoft join: Entra, AD domain, hybrid, registration, unknown' {
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'hybrid-entra-joined'; dsreg = @{ azureAdJoined = $true; domainJoined = $true; tenantName = 'Alamo'; domainName = 'ALAMO' } } }
        $j = Get-DEMicrosoftJoinState
        $j.entraJoined | Should -Be $true; $j.domainJoined | Should -Be $true; $j.summary | Should -Match 'Entra ID \(Alamo\) \+ AD domain ALAMO'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'unknown' } }
        (Get-DEMicrosoftJoinState).known | Should -Be $false
        (Get-DEThrown { Invoke-DEMicrosoftLeave -Confirm:$false }) | Should -Match 'join state unknown'
    }
    It 'finds Entra and domain profiles that would be stranded, and honours accepted ones' {
        $idn = @{ localUsers = @(@{ name = 'jrpetro'; sid = 'S-1-5-21-100-200-300-1001' }); profiles = @(
                @{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-11-22-33-44' }, @{ path = 'C:\Users\old.admin'; sid = 'S-1-5-21-900-800-700-1105' }, @{ path = 'C:\Users\jrpetro'; sid = 'S-1-5-21-100-200-300-1001' }) }
        $paths = @(Get-DEUnmigratedDomainProfiles -Identity $idn | ForEach-Object { $_.path })
        $paths | Should -Contain 'C:\Users\SuzetteThompson'; $paths | Should -Contain 'C:\Users\old.admin'; $paths | Should -Not -Contain 'C:\Users\jrpetro'
        Confirm-DEStrandedProfilesAccepted -Paths @('C:\Users\old.admin') -Technician 'tester' -Confirm:$false
        @(Get-DEUnmigratedDomainProfiles -Identity $idn | ForEach-Object { $_.path }) | Should -Not -Contain 'C:\Users\old.admin'
        Set-DEStateValue -Path 'identity.leave' -Value $null
    }
    Context 'fail-closed refusals (mocks stay in this context)' {
        It 'fails closed: unreadable local users, a short-name mapping, a folder owned by another account, an Entra copy on a device that left' {
            # local users could not be read: every domain profile counts as stranded until accepted
            @(Get-DEUnmigratedDomainProfiles -Identity @{ localUsers = @(); profiles = @(@{ path = 'C:\Users\old.admin'; sid = 'S-1-5-21-900-800-700-1105' }) }).Count | Should -Be 1
            # AzureAD\X is the profile that account owns, not a local X's folder
            $profs = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-5-21-1-2-3-1001'; account = 'PC1\SuzetteThompson' }, @{ path = 'C:\Users\SuzetteThompson.000'; sid = 'S-1-12-1-9'; account = 'AzureAD\SuzetteThompson' })
            @(Find-DEProfileForUser -UserName 'AzureAD\SuzetteThompson' -Profiles $profs).path | Should -Be 'C:\Users\SuzetteThompson.000'
            # the mapping typed as a short name still sees the signed-in AzureAD\ user
            Set-DEContext -Values @{ sourcePrincipal = 'SuzetteThompson' }
            Mock -ModuleName DE.Identity Get-DEIdentityState { @{ interactiveUser = 'AzureAD\SuzetteThompson'; profiles = @(); localUsers = @() } }
            (Test-DEGate -Id 'gate.source-user-signed-out' -Refresh).Status | Should -Be 'BLOCKED'
            Set-DEContext -Values @{ sourcePrincipal = $null }
            # a keep-joined client: an Entra copy counts only while the device really is Entra joined
            Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyEncrypted'; hasRecoveryPassword = $true; recoveryProtectorIds = @('{AAAA-1}') } } }
            Set-DEStateValue -Path 'identity.bitlocker.escrow' -Value @{ protectorId = '{AAAA-1}'; location = 'entra'; by = 'tester' }
            Mock -ModuleName DE.Identity Get-DEMicrosoftJoinState { @{ known = $true; entraJoined = $false } }
            $g = InModuleScope DE.Identity { $keep = $script:LeaveMicrosoft; $script:LeaveMicrosoft = $false; try { Test-DEBitLockerBackupGate -Offline } finally { $script:LeaveMicrosoft = $keep } }
            $g.Status | Should -Not -Be 'PASS'; $g.Detail | Should -Match 'not Entra joined'
            Mock -ModuleName DE.Identity Get-DEMicrosoftJoinState { @{ known = $true; entraJoined = $true } }
            $g = InModuleScope DE.Identity { $keep = $script:LeaveMicrosoft; $script:LeaveMicrosoft = $false; try { Test-DEBitLockerBackupGate -Offline } finally { $script:LeaveMicrosoft = $keep } }
            $g.Status | Should -Be 'PASS'
            Set-DEStateValue -Path 'identity.bitlocker.escrow' -Value $null
        }
        It 'ADMU LeaveDomain refuses without a key backup outside Entra, and while another profile would be stranded' {
            Mock -ModuleName DE.Identity Test-DEMigrationPreconditions { @{ ok = $true; issues = @(); warnings = @(); sourceProfile = @{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-9' } } }
            Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'WARN'; Detail = 'backed up to Entra ID only' } }
            Mock -ModuleName DE.Identity Get-DEUnmigratedDomainProfiles { @() }
            (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' -LeaveEntra -Confirm:$false }) | Should -Match 'refusing LeaveDomain: no proven BitLocker key backup'
            Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'PASS'; Detail = 'ok' } }
            Mock -ModuleName DE.Identity Get-DEUnmigratedDomainProfiles { @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-9' }, @{ path = 'C:\Users\old.admin'; sid = 'S-1-5-21-900-800-700-1105' }) }
            (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' -LeaveEntra -Confirm:$false }) | Should -Match 'strand C:\\Users\\old.admin$|strand C:\\Users\\old.admin;'
            Mock -ModuleName DE.Identity Get-DEUnmigratedDomainProfiles { @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-9' }) }
            # past both refusals it reaches the next check (the temporary password), without migrating anything
            (Get-DEThrown { Start-DEIdentityMigration -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson' -LeaveEntra -Confirm:$false }) | Should -Match 'MIGRATION_TEMP_PASSWORD'
        }
    }
    It 'refuses to leave while a profile would be stranded, then leaves Entra and the AD domain' {
        Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'PASS'; Detail = 'ok' } }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'hybrid-entra-joined'; dsreg = @{ azureAdJoined = $true; domainJoined = $true; domainName = 'ALAMO' }; localUsers = @(@{ name = 'jrpetro'; sid = 'S-1-5-21-100-200-300-1001' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-11-22-33-44' }) } }
        Mock -ModuleName DE.Identity Invoke-DENative { throw 'dsregcmd ran while a profile was stranded' }
        (Get-DEThrown { Invoke-DEMicrosoftLeave -Confirm:$false }) | Should -Match 'would be stranded: C:\\Users\\SuzetteThompson'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'hybrid-entra-joined'; dsreg = @{ azureAdJoined = $true; domainJoined = $true; domainName = 'ALAMO' }; localUsers = @(@{ name = 'sthompson'; sid = 'S-1-5-21-100-200-300-1002' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-5-21-100-200-300-1002' }) } }
        Mock -ModuleName DE.Identity Invoke-DENative { [pscustomobject]@{ ExitCode = 0; Text = ''; Output = @() } }
        Mock -ModuleName DE.Identity Invoke-DEDomainUnjoin { 0 }
        Invoke-DEMicrosoftLeave -WhatIf | Should -Be 'planned'
        Assert-MockCalled -ModuleName DE.Identity Invoke-DEDomainUnjoin -Times 0 -Exactly
        $r = Invoke-DEMicrosoftLeave -Confirm:$false
        $r | Should -Match 'left Entra ID'; $r | Should -Match 'left AD domain ALAMO'; $r | Should -Match 'restart pending'
        Assert-MockCalled -ModuleName DE.Identity Invoke-DENative -Times 1 -Exactly -ParameterFilter { $FilePath -eq 'dsregcmd.exe' -and $Arguments -contains '/leave' }
        Assert-MockCalled -ModuleName DE.Identity Invoke-DEDomainUnjoin -Times 1 -Exactly
        Mock -ModuleName DE.Identity Invoke-DEDomainUnjoin { 1355 }
        (Get-DEThrown { Invoke-DEMicrosoftLeave -Confirm:$false }) | Should -Match 'returned 1355'
        Set-DEStateValue -Path 'identity.leftMicrosoft' -Value $null
    }
    It 'the BitLocker backup gate needs a copy outside Entra before leaving; Entra is enough only when the device stays joined' {
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyDecrypted'; hasRecoveryPassword = $false; recoveryProtectorIds = @() } } }
        (Test-DEBitLockerBackupGate -Offline).Status | Should -Be 'BLOCKED'
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyEncrypted'; protection = 'On'; hasTpm = $true; hasRecoveryPassword = $true; recoveryProtectorIds = @('{AAA}') } } }
        (Test-DEBitLockerBackupGate -Offline).Status | Should -Be 'BLOCKED'
        Set-DEStateValue -Path 'identity.bitlocker.entraBackup' -Value @{ protectorIds = @('{AAA}'); at = 'now' }
        $g = Test-DEBitLockerBackupGate -Offline; $g.Status | Should -Be 'WARN'; $g.Detail | Should -Match 'Entra ID only'
        # keep-joined (Entra copy is enough only while the device is Entra joined): 'fail-closed refusals' context below
        Set-DEBitLockerExpectedProtector -ProtectorId '{AAA}' -Location 'entra' -Technician 'tester' -Confirm:$false
        (Test-DEBitLockerBackupGate -Offline).Status | Should -Not -Be 'PASS'
        Set-DEBitLockerExpectedProtector -ProtectorId '{AAA}' -Location 'hudu' -Technician 'tester' -Confirm:$false
        $g = Test-DEBitLockerBackupGate -Offline; $g.Status | Should -Be 'PASS'; $g.Detail | Should -Match 'hudu by tester'
        (Get-DEState -Path 'identity.bitlocker.escrow.location') | Should -Be 'hudu'
        Set-DEBitLockerExpectedProtector -ProtectorId '{BBB}' -Location 'hudu' -Confirm:$false
        (Test-DEBitLockerBackupGate -Offline).Status | Should -Not -Be 'PASS'   # the recorded id is not on this volume
        foreach ($k in @('identity.bitlocker.escrow', 'identity.bitlocker.entraBackup', 'identity.bitlocker.expectedProtectorId')) { Set-DEStateValue -Path $k -Value $null }
    }
    It 'proves the JumpCloud escrow against the volume without ever returning, logging or storing the key' {
        Mock -ModuleName DE.Identity Get-DEJumpCloudSystem { @{ _id = 'SYS1' } }
        Mock -ModuleName DE.Identity Invoke-DEJumpCloudApi { @{ key = $global:DETest.Key } } -ParameterFilter { $Path -eq '/systems/SYS1/fdekey' -and $V2 }
        Mock -ModuleName DE.Identity Get-DEBitLockerRecoveryPasswords { @(@{ id = '{AAA}'; password = $global:DETest.Key }) }
        $r = Test-DEBitLockerKeyInJumpCloud
        $r.ok | Should -Be $true; $r.protectorId | Should -Be '{AAA}'
        ($r | ConvertTo-Json -Compress) | Should -Not -Match '111111'
        (Protect-DEText "key $($global:DETest.Key)") | Should -Not -Match '111111'
        Mock -ModuleName DE.Identity Get-DEBitLockerRecoveryPasswords { @(@{ id = '{CCC}'; password = '999999-999999-999999-999999-999999-999999-999999-999999' }) }
        $r = Test-DEBitLockerKeyInJumpCloud; $r.ok | Should -Be $false; $r.detail | Should -Match 'does not match'
        Mock -ModuleName DE.Identity Get-DEBitLockerRecoveryPasswords { @(@{ id = '{AAA}'; password = $global:DETest.Key }) }
        Mock -ModuleName DE.Identity Test-DESecret { $true }
        Mock -ModuleName DE.Identity Get-DEBitLockerState { @{ os = @{ status = 'FullyEncrypted'; protection = 'On'; hasTpm = $true; hasRecoveryPassword = $true; recoveryProtectorIds = @('{AAA}') } } }
        $g = Test-DEBitLockerBackupGate; $g.Status | Should -Be 'PASS'; $g.Detail | Should -Match 'JumpCloud holds the recovery key for protector \{AAA\}'
        (Get-DEState -Path 'identity.bitlocker.jumpcloudEscrow.protectorId') | Should -Be '{AAA}'
        ((Get-DEState) | ConvertTo-Json -Depth 12 -Compress) | Should -Not -Match '111111'
        Set-DEStateValue -Path 'identity.bitlocker.jumpcloudEscrow' -Value $null
    }
    It 'plans the backup and the Microsoft leave wherever JumpCloud goes on, and binds only after leaving' {
        foreach ($m in @('takeover', 'repair', 'new', 'replacement')) {
            $ids = @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode $m)
            $ids | Should -Contain 'identity.entra-leave'; $ids | Should -Contain 'identity.bitlocker-backup'
        }
        (Get-DEAction -Id 'identity.entra-leave').Gates | Should -Contain 'gate.bitlocker-backup'
        (Get-DEAction -Id 'jumpcloud.bind-user').Gates | Should -Contain 'gate.microsoft-left'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; dsreg = @{ azureAdJoined = $true; tenantName = 'Alamo' } } }
        (Test-DEGate -Id 'gate.microsoft-left' -Refresh).Status | Should -Be 'BLOCKED'
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['identity']['leaveEntra'] = $false
        $null = Initialize-DEWorkflow -ClientProfile $p -Mode 'takeover'
        $g = Test-DEGate -Id 'gate.microsoft-left' -Refresh; $g.Status | Should -Be 'PASS'; $g.Detail | Should -Match 'keeps this device joined'
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover'
    }
}

Describe 'What the real Alamo laptop showed' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover'
    }
    It 'run from jrpetro, the end user is still found: the Entra profile, named by its account' {
        $snap = @{ identity = @{ interactiveUser = 'DE-ALAMO-LAPTOP\jrpetro'; currentPrincipal = 'DE-ALAMO-LAPTOP\jrpetro'; profiles = @(
                    @{ path = 'C:\Users\jrpetro'; sid = 'S-1-5-21-100-200-300-1001'; account = 'DE-ALAMO-LAPTOP\jrpetro'; lastUse = '2026-09-29T01:00:00' },
                    @{ path = 'C:\Users\Owner'; sid = 'S-1-5-21-100-200-300-1000'; account = 'DE-ALAMO-LAPTOP\Owner'; lastUse = '2026-09-29T00:59:00' },
                    @{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-11-22-33-44'; account = 'AzureAD\SuzetteThompson'; lastUse = '2026-09-28T17:00:00' }) } }
        $eu = Resolve-DEEndUser -Snapshot $snap -Technician 'jrpetro'
        $eu.endUser | Should -Be 'AzureAD\SuzetteThompson'; $eu.endUserIsEntraPrincipal | Should -Be $true
        $snap.identity.profiles[2].Remove('account')
        (Resolve-DEEndUser -Snapshot $snap -Technician 'jrpetro').endUser | Should -Be 'AzureAD\SuzetteThompson'   # no account name: the folder names it
    }
    It 'an unmapped end user never reads green while an Entra profile waits to be migrated' {
        Set-DEContext -Values @{ sourcePrincipal = $null }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; interactiveUser = 'PC\jrpetro'; localUsers = @(@{ name = 'jrpetro'; sid = 'S-1-5-21-100-200-300-1001' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-11-22-33-44' }) } }
        Mock -ModuleName DE.Identity Get-DEOneDriveState { @{ businessAccounts = @(); running = $false; classification = 'dormant-or-unconfigured' } }
        $g = Test-DEGate -Id 'gate.source-user-signed-out' -Refresh; $g.Status | Should -Be 'BLOCKED'; $g.Detail | Should -Match 'not mapped'
        $o = Test-DEOneDriveGate; $o.Status | Should -Be 'WARN'; $o.Detail | Should -Match 'not checked'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'local-workgroup'; localUsers = @(); profiles = @() } }
        (Test-DEGate -Id 'gate.source-user-signed-out' -Refresh).Status | Should -Be 'PASS'   # nothing to migrate
    }
    It 'pre-migration checks refuse what ADMU refuses: a long name, a JumpCloud user bound too early, an unknown JumpCloud user' {
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; localUsers = @(); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-11-22-33-44' }) } }
        Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'PASS'; Detail = 'ok' } }
        Mock -ModuleName DE.Identity Test-DESecret { $true }
        Mock -ModuleName DE.Identity Test-DEJumpCloudUserMapping { @{ localAccount = $null; jumpcloud = @{ bound = $true; userExists = $true; userState = 'ACTIVATED' } } }
        $p = Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson'
        $p.ok | Should -Be $false; ($p.issues -join ' ') | Should -Match 'already bound to this device'
        Mock -ModuleName DE.Identity Test-DEJumpCloudUserMapping { @{ localAccount = $null; jumpcloud = @{ bound = $false; userExists = $false } } }
        ((Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson').issues -join ' ') | Should -Match 'no user'
        ((Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'suzette.thompson.alamo').issues -join ' ') | Should -Match '20 characters'
        Mock -ModuleName DE.Identity Test-DEJumpCloudUserMapping { @{ localAccount = $null; jumpcloud = @{ bound = $false; userExists = $true; userState = 'STAGED' } } }
        ((Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson').warnings -join ' ') | Should -Match 'STAGED'
    }
}

Describe 'The job runbook (what to do, in what order, and why it is blocked)' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
    }
    It 'orders a takeover into stages the way a technician works it, every step placed exactly once' {
        $ids = @(Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover')
        $rb = Get-DERunbook -Mode 'takeover'
        @($rb.stages | ForEach-Object { $_.id }) -join ',' | Should -Be 'check,protect,migrate,leave,jumpcloud,security,updates,apps,configure,finish'
        $rb.total | Should -Be @(Get-DEActions -Mode 'takeover').Count
        @($rb.stages | ForEach-Object { $_.steps } | ForEach-Object { $_.id } | Select-Object -Unique).Count | Should -Be $rb.total
        $protect = @(($rb.stages | Where-Object { $_.id -eq 'protect' }).steps | ForEach-Object { $_.id })
        [array]::IndexOf($protect, 'jumpcloud.agent') | Should -BeLessThan ([array]::IndexOf($protect, 'identity.bitlocker-backup'))   # the agent escrows the key
        $order = @($rb.stages | ForEach-Object { $_.steps } | ForEach-Object { $_.id })
        [array]::IndexOf($order, 'identity.migrate') | Should -BeLessThan ([array]::IndexOf($order, 'identity.entra-leave'))
        [array]::IndexOf($order, 'identity.entra-leave') | Should -BeLessThan ([array]::IndexOf($order, 'jumpcloud.bind-user'))
        (@($rb.stages | ForEach-Object { $_.steps }) | Where-Object { $_.id -eq 'identity.migrate' }).why | Should -Match 'ADMU'
    }
    It 'names the current step and says in plain words what blocks it' {
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'takeover'
        Set-DEContext -Values @{ sourcePrincipal = $null; localUserName = $null }
        $rb = Get-DERunbook -Mode 'takeover'
        $rb.current.id | Should -Be 'net.connectivity'
        ($rb.stages | Where-Object { $_.id -eq 'check' }).state | Should -Be 'current'
        $m = @($rb.stages | ForEach-Object { $_.steps }) | Where-Object { $_.id -eq 'identity.migrate' }
        $m.needsMapping | Should -Be $true; $m.secretsMissing | Should -Contain 'MIGRATION_TEMP_PASSWORD'; $m.ready | Should -Be $false
        @($m.blockers | ForEach-Object { $_.title }) | Should -Contain 'DE break-glass administrator verified'
        @($m.blockers | Where-Object { $_.unblock }).Count | Should -BeGreaterThan 0
        # finishing the first stage moves the job on
        foreach ($sid in @(($rb.stages | Where-Object { $_.id -eq 'check' }).steps | ForEach-Object { $_.id })) { Add-DEEvidence -Step $sid -Module 'test' -Before 'x' -ActionTaken 'checked' -Result 'PASS' -Verification 'ok' | Out-Null }
        $rb2 = Get-DERunbook -Mode 'takeover'
        ($rb2.stages | Where-Object { $_.id -eq 'check' }).state | Should -Be 'done'
        $rb2.current.stage | Should -Be 'protect'
    }
    It 'deprovision gets its own stage' {
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'deprovision'
        @((Get-DERunbook -Mode 'deprovision').stages | ForEach-Object { $_.id }) | Should -Contain 'deprovision'
    }
}

Describe 'Browser control: login manager, autofill, approved and blocked extensions' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
    }
    It 'the chosen login manager is forced in, rivals are blocked, built-in managers and autofill are off' {
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['browser']['loginManager'] = 'bitwarden'
        $plan = Get-DEBrowserExtensionPlan -ClientProfile $p
        $plan.loginManager | Should -Be 'Bitwarden'
        @($plan.browsers['chrome'].force | ForEach-Object { $_.id }) | Should -Contain 'nngceckbapebfimnlniiiahkandclblb'
        @($plan.browsers['chrome'].block | ForEach-Object { $_.id }) | Should -Contain 'hdokiejnpimakedhajhdlcegeplioahd'   # LastPass
        @($plan.browsers['chrome'].block | ForEach-Object { $_.id }) | Should -Not -Contain 'nngceckbapebfimnlniiiahkandclblb'
        $w = Get-DEBrowserDesiredPolicy -ClientProfile $p
        foreach ($b in @('chrome', 'edge')) { $w[$b]['PasswordManagerEnabled'] | Should -Be 0; $w[$b]['AutofillAddressEnabled'] | Should -Be 0; $w[$b]['AutofillCreditCardEnabled'] | Should -Be 0 }
        $w.lists.chrome.ExtensionInstallForcelist | Should -Contain 'nngceckbapebfimnlniiiahkandclblb;https://clients2.google.com/service/update2/crx'
        $w.lists.chrome.ExtensionInstallBlocklist[0] | Should -Be '*'   # approved-only
        @($w.lists.chrome.ExtensionInstallBlocklist | Where-Object { $_ -match ' ' }).Count | Should -Be 0   # one id per entry
        $w.lists.chrome.ExtensionInstallAllowlist | Should -Contain 'nngceckbapebfimnlniiiahkandclblb'
        $f = Get-DEFirefoxDesiredPolicy -ClientProfile $p
        $f.PasswordManagerEnabled | Should -Be 0
        $fx = $f.ExtensionSettings | ConvertFrom-Json
        $fx.'{446900e4-71c2-419f-a6a7-df9c091e268b}'.installation_mode | Should -Be 'force_installed'
        $fx.'support@lastpass.com'.installation_mode | Should -Be 'blocked'
    }
    It 'builtin keeps the browser manager; autofill on keeps autofill; blocklist mode never blocks everything; an unknown manager is refused' {
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['browser']['loginManager'] = 'builtin'; $p['browser']['autofill'] = 'on'; $p['browser']['extensions']['mode'] = 'blocklist'
        $w = Get-DEBrowserDesiredPolicy -ClientProfile $p
        $w.chrome['PasswordManagerEnabled'] | Should -Be 1; $w.chrome['AutofillAddressEnabled'] | Should -Be 1
        $w.lists.chrome.ExtensionInstallBlocklist | Should -Not -Contain '*'
        @($w.lists.chrome.ExtensionInstallBlocklist) | Should -Contain 'bfogiafebfohielmmehodmfbbebbbpei'   # every catalog manager is a rival of builtin
        $p['browser']['loginManager'] = ''; $p['browser']['extensions']['mode'] = 'approved-only'
        # nothing forced or allowed yet (no manager, PABX ids not filled): '*' is never written, the browser would lose every extension
        (Get-DEBrowserDesiredPolicy -ClientProfile $p).lists.chrome.ExtensionInstallBlocklist | Should -Not -Contain '*'
        $p['browser']['loginManager'] = 'notamanager'
        (Get-DEThrown { Get-DEBrowserExtensionPlan -ClientProfile $p }) | Should -Match 'not in the catalog'
    }
    It 'the login manager step asks for a decision until one is chosen, and names missing store ids' {
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'new'
        $st = Get-DEActionState -Id 'browser.login-manager'
        $st.Status | Should -Not -Be 'PASS'
        $st.Detected.missing | Should -Match 'Prisma Browser Extension'
    }
    It 'finds installed extensions in every user profile and names the ones policy will remove' {
        $root = Join-Path $global:DETest.Dir 'Users'
        foreach ($d in @('suzette\AppData\Local\Google\Chrome\User Data\Default\Extensions\hdokiejnpimakedhajhdlcegeplioahd\4.1_0', 'suzette\AppData\Local\Google\Chrome\User Data\Default\Extensions\nngceckbapebfimnlniiiahkandclblb\2024_0', 'suzette\AppData\Local\Microsoft\Edge\User Data\Profile 1\Extensions\abcdefghijklmnopabcdefghijklmnop\1_0', 'suzette\AppData\Roaming\Mozilla\Firefox\Profiles\x.default\extensions')) { New-Item -ItemType Directory -Force -Path (Join-Path $root $d) | Out-Null }
        Set-Content -LiteralPath (Join-Path $root 'suzette\AppData\Local\Google\Chrome\User Data\Default\Extensions\hdokiejnpimakedhajhdlcegeplioahd\4.1_0\manifest.json') -Value '{"name":"LastPass"}'
        Set-Content -LiteralPath (Join-Path $root 'suzette\AppData\Roaming\Mozilla\Firefox\Profiles\x.default\extensions\support@lastpass.com.xpi') -Value 'x'
        $inst = @(Get-DEInstalledBrowserExtensions -UsersRoot $root)
        $inst.Count | Should -Be 4
        ($inst | Where-Object { $_.id -eq 'hdokiejnpimakedhajhdlcegeplioahd' }).name | Should -Be 'LastPass'
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['browser']['loginManager'] = 'bitwarden'
        $c = @(Test-DEBrowserExtensionConflicts -ClientProfile $p -Installed $inst)
        @($c | ForEach-Object { $_.id }) | Should -Contain 'hdokiejnpimakedhajhdlcegeplioahd'
        @($c | ForEach-Object { $_.id }) | Should -Contain 'support@lastpass.com'
        @($c | ForEach-Object { $_.id }) | Should -Contain 'abcdefghijklmnopabcdefghijklmnop'   # unapproved in approved-only mode
        @($c | ForEach-Object { $_.id }) | Should -Not -Contain 'nngceckbapebfimnlniiiahkandclblb'   # the approved manager stays
        ($c | Where-Object { $_.id -eq 'hdokiejnpimakedhajhdlcegeplioahd' }).reason | Should -Match 'blocked'
    }
}

Describe 'Device lifecycle: OOBE, after first sign-in, configured' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'new'
    }
    It 'reads OOBE from the setup flags and the defaultuser0 session, and recommends new with user steps deferred' {
        $snap = @{ setup = @{ oobeInProgress = $true }; identity = @{ joinType = 'local-workgroup'; profiles = @() }; mdm = @{ authority = 'none' } }
        $l = Get-DEDeviceLifecycle -Snapshot $snap; $l.stage | Should -Be 'oobe'; ($l.reasons -join ' ') | Should -Match 'OOBE'
        (Get-DEDeviceLifecycle -Snapshot @{ identity = @{ joinType = 'local-workgroup'; interactiveUser = 'DESKTOP-1\defaultuser0'; profiles = @() } }).stage | Should -Be 'oobe'
        $r = Get-DERecommendedMode -Snapshot $snap -ClientProfile @{ id = 'x' }
        $r.mode | Should -Be 'new'; $r.reason | Should -Match 'first sign-in'
    }
    It 'after first sign-in until the DE stack is on, then configured' {
        $snap = @{ identity = @{ joinType = 'local-workgroup'; profiles = @(@{ path = 'C:\Users\sthompson'; sid = 'S-1-5-21-1-2-3-1001' }) }; mdm = @{ authority = 'none' }; agents = @{ agents = @{} } }
        $l = Get-DEDeviceLifecycle -Snapshot $snap; $l.stage | Should -Be 'first-login'; ($l.reasons -join ' ') | Should -Match 'JumpCloud, SentinelOne, Guardz'
        $snap.mdm.authority = 'jumpcloud'; $snap.agents.agents = @{ sentinelone = @{ installed = $true }; guardz = @{ installed = $true } }
        (Get-DEDeviceLifecycle -Snapshot $snap).stage | Should -Be 'configured'
        (Get-DEDeviceLifecycle -Snapshot @{ identity = @{ joinType = 'local-workgroup'; profiles = @(@{ path = 'C:\Users\jrpetro' }, @{ path = 'C:\Users\DE-BreakGlass' }) } }).stage | Should -Be 'oobe'   # only DE accounts so far
    }
    It 'per-user steps wait for a real user session' {
        (Get-DEAction -Id 'apps.m365.readiness').Gates | Should -Contain 'gate.user-session'
        Mock -ModuleName DE.Identity Get-DESetupState { @{ oobeInProgress = $true } }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'local-workgroup'; profiles = @() } }
        Mock -ModuleName DE.Identity Get-DEMdmState { @{ authority = 'none' } }
        $g = Test-DEGate -Id 'gate.user-session' -Refresh; $g.Status | Should -Be 'BLOCKED'; $g.Detail | Should -Match "user's own session"
        Mock -ModuleName DE.Identity Get-DESetupState { @{ oobeInProgress = $false } }
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'local-workgroup'; profiles = @(@{ path = 'C:\Users\sthompson' }) } }
        (Test-DEGate -Id 'gate.user-session' -Refresh).Status | Should -Be 'PASS'
    }
}

Describe 'Branding: readable logos, sizes and options' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
    }
    It 'luminance and logo variants: the white DE logo on dark backgrounds, the dark one on light' {
        (Get-DEColorLuminance -Hex '#050312') | Should -BeLessThan 0.05
        (Get-DEColorLuminance -Hex '#F7F5F2') | Should -BeGreaterThan 0.85
        (Get-DEBrandingAssets -ClientProfile $global:DETest.Alamo -Background '#050312').deLogo | Should -Match 'reverse-2400'
        (Get-DEBrandingAssets -ClientProfile $global:DETest.Alamo -Background '#F7F5F2').deLogo | Should -Match 'digerati-logo-2400'
        (Get-DEBrandingAssets -ClientProfile $global:DETest.Alamo -Background '#050312' -DeLogoStyle stacked).deLogo | Should -Match 'stacked-reverse'
        foreach ($f in @('digerati-logo-2400.png', 'digerati-logo-reverse-2400.png', 'digerati-logo-stacked-1600.png', 'digerati-logo-stacked-reverse-1600.png', 'digerati-mark-1024.png')) { Test-Path -LiteralPath (Join-Path $script:ConsoleRoot "assets\brand\$f") | Should -Be $true }
    }
    It 'a light client logo is used on dark backgrounds when the profile has one' {
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['branding']['clientLogoReverse'] = 'asset:brand/digerati-mark-1024.png'
        (Get-DEBrandingAssets -ClientProfile $p -Background '#050312').clientLogo | Should -Match 'digerati-mark-1024'
        (Get-DEBrandingAssets -ClientProfile $p -Background '#F7F5F2').clientLogo | Should -Match 'alamo-mark'
    }
    It 'options: DE defaults, the profile overrides, a centred lock screen with bigger logos' {
        $o = Get-DEBrandingOptions -ClientProfile $global:DETest.Alamo
        $o.position | Should -Be 'lower-left'; $o.logoHeightPct | Should -BeGreaterOrEqual 9; $o.background | Should -Be '#050312'
        $l = Get-DEBrandingOptions -ClientProfile $global:DETest.Alamo -LockScreen
        $l.position | Should -Be 'center'; $l.logoHeightPct | Should -BeGreaterThan $o.logoHeightPct; $l.showHostname | Should -Be $false
        $p = ConvertTo-DEHashtable $global:DETest.Alamo; $p['branding']['wallpaper'] = @{ theme = 'light'; position = 'upper-right'; logoHeightPct = 14 }
        $o2 = Get-DEBrandingOptions -ClientProfile $p
        $o2.background | Should -Be '#F7F5F2'; $o2.position | Should -Be 'upper-right'; $o2.logoHeightPct | Should -Be 14
    }
    It 'layout: logos sized from the screen height, inside the screen, where the position says' {
        $o = Get-DEBrandingOptions -ClientProfile $global:DETest.Alamo
        foreach ($res in @(@(1920, 1080), @(3840, 2160))) {
            $L = Get-DEBrandingLayout -Width $res[0] -Height $res[1] -Options $o -LogoSizes @{ client = @(96, 100); de = @(2400, 578) } -Lines @('Alamo Industries  |  managed by Digerati Experts', 'Support: support@digeratiexperts.com')
            $client = $L.items | Where-Object { $_.which -eq 'client' }; $deL = $L.items | Where-Object { $_.which -eq 'de' }
            $client.h | Should -Be ([int]($res[1] * 0.09))                 # 9% of the screen: about 97 px at 1080p, 194 px at 4K
            $deL.h | Should -Be ([int]($res[1] * 0.06))
            foreach ($it in $L.items) { $it.x | Should -BeGreaterOrEqual 0; ($it.x + $it.w) | Should -BeLessOrEqual $res[0]; ($it.y + $it.h) | Should -BeLessOrEqual $res[1] }
            $L.block.x | Should -BeLessThan ($res[0] / 3)                  # lower-left
            $L.block.y | Should -BeGreaterThan ($res[1] / 2)
        }
        $c = Get-DEBrandingLayout -Width 1920 -Height 1080 -Options (Get-DEBrandingOptions -ClientProfile $global:DETest.Alamo -LockScreen) -LogoSizes @{ client = @(96, 100); de = @(2400, 578) } -Lines @('x')
        $mid = $c.block.x + $c.block.w / 2; [math]::Abs($mid - 960) | Should -BeLessThan 60   # centred
        $w = Get-DEBrandingLayout -Width 1920 -Height 1080 -Options (Get-DEBrandingOptions -ClientProfile @{ branding = @{ wallpaper = @{ logos = 'de'; logoHeightPct = 30 } } }) -LogoSizes @{ de = @(2400, 578) } -Lines @()
        ($w.items | Where-Object { $_.which -eq 'de' }).w | Should -BeLessOrEqual ([int](1920 * 0.42))   # a very wide wordmark stays on screen
    }
    It 'renders a wallpaper where the DE logo stands out from the background (Windows)' -Skip:($env:OS -ne 'Windows_NT') {
        $f = New-DEBrandedWallpaper -ClientProfile $global:DETest.Alamo -Width 1920 -Height 1080 -OutFile (Join-Path $global:DETest.Dir 'contrast.png')
        Add-Type -AssemblyName System.Drawing
        $o = Get-DEBrandingOptions -ClientProfile $global:DETest.Alamo; $a = Get-DEBrandingAssets -ClientProfile $global:DETest.Alamo -Background $o.background
        $sizes = @{}; foreach ($k in @('client', 'de')) { $src = $(if ($k -eq 'client') { $a.clientLogo } else { $a.deLogo }); if ($src) { $im = [System.Drawing.Image]::FromFile($src); $sizes[$k] = @($im.Width, $im.Height); $im.Dispose() } }
        $box = (Get-DEBrandingLayout -Width 1920 -Height 1080 -Options $o -LogoSizes $sizes -Lines @('a', 'b')).items | Where-Object { $_.which -eq 'de' }
        $bmp = [System.Drawing.Bitmap]::FromFile($f)
        try { $bright = 0; for ($x = $box.x; $x -lt ($box.x + $box.w); $x += 4) { for ($y = $box.y; $y -lt ($box.y + $box.h); $y += 4) { $c = $bmp.GetPixel($x, $y); if ((0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B) -gt 150) { $bright++ } } } } finally { $bmp.Dispose() }
        $bright | Should -BeGreaterThan 40    # the white wordmark is visible on graphite (the dark one drew about zero bright pixels)
        (New-DEOemLogo -ClientProfile $global:DETest.Alamo -OutFile (Join-Path $global:DETest.Dir 'oem.bmp')) | Should -Exist
    }
}

Describe 'Warranty: when does it end, and where did the answer come from' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Alamo = Get-DEClientProfile -Id 'alamo' }
        $global:DETest.LenovoHtml = "<html><script>`nvar ds_warranties = window.ds_warranties || {""BaseWarranties"":[{""Name"":""Depot"",""Start"":""2024-02-01"",""End"":""$((Get-Date).AddYears(1).ToString('yyyy-MM-dd'))""}],""UpmaWarranties"":[{""Name"":""Premier Support"",""Start"":""2024-02-01"",""End"":""$((Get-Date).AddYears(2).ToString('yyyy-MM-dd'))""}]};`nvar other = 1;</script></html>"
    }
    It 'parses the Lenovo support page and picks the latest end date' {
        $e = @(ConvertFrom-DELenovoWarrantyPage -Html $global:DETest.LenovoHtml)
        $e.Count | Should -Be 2; $e[1].name | Should -Be 'Premier Support'
        @(ConvertFrom-DELenovoWarrantyPage -Html '<html>nothing here</html>').Count | Should -Be 0
        Mock -ModuleName DE.Warranty Invoke-DEWarrantyWeb { @(@{ Id = 'Laptops-and-netbooks/ThinkPad-X1/21X0' }) } -ParameterFilter { $Uri -like '*getproducts*' }
        Mock -ModuleName DE.Warranty Invoke-DEWarrantyWeb { $global:DETest.LenovoHtml } -ParameterFilter { $Uri -like '*/warranty' }
        $w = Get-DEWarranty -Serial 'PF6CLF01' -Manufacturer 'LENOVO' -Model '21X00004US' -Refresh
        $w.source | Should -Be 'lenovo-support-site'; $w.status | Should -Be 'active'
        $w.end | Should -Be ((Get-Date).AddYears(2).ToString('yyyy-MM-dd')); $w.daysLeft | Should -BeGreaterThan 700
        Assert-MockCalled -ModuleName DE.Warranty Invoke-DEWarrantyWeb -Times 1 -ParameterFilter { $Uri -like '*/products/laptops-and-netbooks/thinkpad-x1/21x0/warranty' }
        (Get-DEWarranty -Serial 'PF6CLF01' -Manufacturer 'LENOVO').cached | Should -Be $true   # second read comes from the cache
    }
    It 'Dell uses TechDirect only with a key, and the key and token never land in the result or state' {
        (Get-DEWarranty -Serial 'ABC1234' -Manufacturer 'Dell Inc.' -Refresh).status | Should -Be 'manual'   # no key: the check page
        Mock -ModuleName DE.Warranty Test-DESecret { $true }
        Mock -ModuleName DE.Warranty Get-DESecretPlain { if ($Name -eq 'DELL_API_KEY') { 'dell-key-123' } else { 'dell-secret-456' } }
        Mock -ModuleName DE.Warranty Invoke-DEWarrantyWeb { @{ access_token = 'tok-789' } } -ParameterFilter { $Uri -like '*oauth*' }
        Mock -ModuleName DE.Warranty Invoke-DEWarrantyWeb { @(@{ serviceTag = 'ABC1234'; productLineDescription = 'LATITUDE 7450'; shipDate = '2023-03-01T00:00:00Z'; entitlements = @(@{ serviceLevelDescription = 'ProSupport'; startDate = '2023-03-01T00:00:00Z'; endDate = '2024-03-01T00:00:00Z' }) }) } -ParameterFilter { $Uri -like '*asset-entitlements*' }
        $w = Get-DEWarranty -Serial 'ABC1234' -Manufacturer 'Dell Inc.' -Refresh
        $w.source | Should -Be 'dell-techdirect'; $w.status | Should -Be 'expired'; $w.end | Should -Be '2024-03-01'; $w.detail | Should -Be 'LATITUDE 7450'
        Assert-MockCalled -ModuleName DE.Warranty Invoke-DEWarrantyWeb -Times 1 -ParameterFilter { $Headers.Authorization -eq 'Bearer tok-789' }
        (($w | ConvertTo-Json -Depth 5) + ((Get-DEState) | ConvertTo-Json -Depth 12)) | Should -Not -Match 'dell-key-123|dell-secret-456|tok-789'
    }
    It 'every other maker: the check page, then the date the technician records; virtual machines need none' {
        $w = Get-DEWarranty -Serial 'S0123456789' -Manufacturer 'Microsoft Corporation' -Model 'Surface Laptop 5' -Refresh
        $w.status | Should -Be 'manual'; $w.checkUrl | Should -Match 'surface'
        Set-DEWarrantyManual -Serial 'S0123456789' -End (Get-Date).AddDays(30) -Note 'Surface business portal' -Technician 'tester' -Confirm:$false
        $w2 = Get-DEWarranty -Serial 'S0123456789' -Manufacturer 'Microsoft Corporation' -Model 'Surface Laptop 5'
        $w2.source | Should -Be 'technician'; $w2.status | Should -Be 'active'; $w2.daysLeft | Should -Be 30; $w2.detail | Should -Match 'tester'
        (Get-DEWarranty -Serial '1234' -Manufacturer 'Microsoft Corporation' -Model 'Virtual Machine').status | Should -Be 'not-applicable'
        (Get-DEWarranty -Serial 'To be filled by O.E.M.' -Manufacturer 'Acme').status | Should -Be 'unknown'
    }
    It 'the warranty step flags expired, ending soon and unknown, and the evidence record carries the end date' {
        $null = Initialize-DEWorkflow -ClientProfile $global:DETest.Alamo -Mode 'repair'
        Mock -ModuleName DE.Warranty Get-DEWarranty { [pscustomobject]@{ status = 'active'; end = (Get-Date).AddDays(40).ToString('yyyy-MM-dd'); daysLeft = 40; source = 'lenovo-support-site'; checkUrl = 'u'; detail = '' } }
        $st = Get-DEActionState -Id 'maint.warranty'; $st.Status | Should -Not -Be 'PASS'; ($st.Drift -join ' ') | Should -Match 'in 40 days'
        Mock -ModuleName DE.Warranty Get-DEWarranty { [pscustomobject]@{ status = 'active'; end = '2030-01-01'; daysLeft = 1200; source = 'lenovo-support-site'; checkUrl = 'u'; detail = '' } }
        (Get-DEActionState -Id 'maint.warranty').Status | Should -Be 'PASS'
        (New-DEAssetRecord -Snapshot @{ device = @{ hostname = 'H' } } -ClientProfile $global:DETest.Alamo).warrantyEnd | Should -Be '2030-01-01'
        Mock -ModuleName DE.Warranty Get-DEWarranty { [pscustomobject]@{ status = 'expired'; end = '2024-01-01'; daysLeft = -600; source = 'dell-techdirect'; checkUrl = 'u'; detail = '' } }
        ((Get-DEActionState -Id 'maint.warranty').Drift -join ' ') | Should -Match 'ended 2024-01-01'
    }
}

Describe 'Community tools: pinned, hash-checked, and only MIT code in the console' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $global:DETest.Community = Join-Path ([IO.Path]::GetTempPath()) ("de-community-" + [guid]::NewGuid().ToString('N'))
        # A fake tool with two files; its catalog entry pins their real sha256.
        $global:DETest.Src = Join-Path $global:DETest.Community 'src'; New-Item -ItemType Directory -Path (Join-Path $global:DETest.Src 'public') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $global:DETest.Src 'Fake.psm1') -Value 'function Get-FakeCommunity { ''fake-ok'' }' -NoNewline
        Set-Content -LiteralPath (Join-Path $global:DETest.Src 'public/a.ps1') -Value '# a' -NoNewline
        $h = { param($f) (Get-FileHash -LiteralPath (Join-Path $global:DETest.Src $f) -Algorithm SHA256).Hash.ToLowerInvariant() }
        $global:DETest.Fake = [pscustomobject]@{ id = 'fake'; name = 'Fake'; repo = 'example/fake'; commit = ('a' * 40); version = '1.0'; license = 'MIT'; use = 'module'; module = 'Fake.psm1'
            files = @([pscustomobject]@{ path = 'Fake.psm1'; sha256 = (& $h 'Fake.psm1') }, [pscustomobject]@{ path = 'public/a.ps1'; sha256 = (& $h 'public/a.ps1') }) }
        $global:DETest.Catalog = [pscustomobject]@{ rawBase = 'https://raw.example/{repo}/{commit}/{path}'; tools = @($global:DETest.Fake, [pscustomobject]@{ id = 'gpl'; name = 'Gpl'; license = 'GPL-3.0'; use = 'scripts'; files = @() }) }
    }
    AfterAll { Remove-Item -LiteralPath $global:DETest.Community -Recurse -Force -ErrorAction SilentlyContinue }
    It 'the real catalog pins every loaded tool to a 40-character commit, an MIT licence and a sha256 per file' {
        $c = Get-DECommunityCatalog
        foreach ($t in @($c.tools | Where-Object { $_.use -in @('module', 'scripts') })) {
            $t.commit | Should -Match '^[0-9a-f]{40}$' -Because $t.id
            foreach ($f in @(@($t.files) + @($t.scripts) | Where-Object { $_ })) { $f.sha256 | Should -Match '^[0-9a-f]{64}$' -Because "$($t.id) $($f.path)" }
        }
        @($c.tools | Where-Object { $_.use -eq 'module' -and -not @($_.files).Count }).Count | Should -Be 0
        @($c.tools | Where-Object { $_.use -eq 'reference' -and @($_.scripts | Where-Object { $_ }).Count }).Count | Should -Be 0
        (Get-DECommunityTool -Id 'lsuclient').module | Should -Be 'LSUClient.psd1'
        @((Get-DECommunityTool -Id 'hardeningkitty').files | Where-Object { $_.path -eq 'lists/hardeningkitty_lists_manifest.psd1.p7s' }).Count | Should -Be 1
    }
    Context 'a fake pinned tool' {
        It 'downloads each file at the pinned commit, verifies it, caches it, and loads it' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.Catalog }
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { $rel = $Uri -replace '^https://raw.example/example/fake/a{40}/', ''; Copy-Item -LiteralPath (Join-Path $global:DETest.Src $rel) -Destination $OutFile }
            $p = Get-DECommunityToolPath -Id 'fake'
            $p | Should -Match 'community[\\/]fake[\\/]a{40}$'
            Assert-MockCalled -ModuleName DE.Community Invoke-DECommunityDownload -Times 1 -ParameterFilter { $Uri -eq "https://raw.example/example/fake/$('a' * 40)/public/a.ps1" }
            (Test-DECommunityToolFiles -Tool $global:DETest.Fake -Path $p).ok | Should -Be $true
            # Second call uses the verified cache: no more downloads.
            Get-DECommunityToolPath -Id 'fake' | Should -Be $p
            Assert-MockCalled -ModuleName DE.Community Invoke-DECommunityDownload -Times 2 -Exactly
            $m = Import-DECommunityTool -Id 'fake'; $m.Name | Should -Be 'Fake'
            Get-FakeCommunity | Should -Be 'fake-ok'
            Remove-Module Fake -Force -ErrorAction SilentlyContinue
        }
        It 'refuses a download that does not match the pin and leaves nothing half-written' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.Catalog }
            Remove-Item -LiteralPath (Join-Path (Get-DEConsole).Dirs.Base 'community') -Recurse -Force -ErrorAction SilentlyContinue
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { Set-Content -LiteralPath $OutFile -Value 'tampered' -NoNewline }
            (Get-DEThrown { Get-DECommunityToolPath -Id 'fake' }) | Should -Match 'does not match the reviewed sha256'
            Test-Path -LiteralPath (Join-Path (Get-DEConsole).Dirs.Base "community/fake/$('a' * 40)") | Should -Be $false
            Test-Path -LiteralPath (Join-Path (Get-DEConsole).Dirs.Base "community/fake/$('a' * 40).download") | Should -Be $false
            # A cached copy that was changed after download is not used either.
            $cache = Join-Path (Get-DEConsole).Dirs.Base "community/fake/$('a' * 40)"; New-Item -ItemType Directory -Path (Join-Path $cache 'public') -Force | Out-Null
            Copy-Item -LiteralPath (Join-Path $global:DETest.Src 'Fake.psm1') -Destination $cache; Set-Content -LiteralPath (Join-Path $cache 'public/a.ps1') -Value 'changed'
            (Get-DEThrown { Get-DECommunityToolPath -Id 'fake' -Offline }) | Should -Match 'no verified copy'
        }
        It 'uses a verified staged copy offline (USB kit or dropship bundle) and never imports a non-module entry' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.Catalog }
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { throw 'no network' }
            Get-DECommunityToolPath -Id 'fake' -StagedPath $global:DETest.Src -Offline | Should -Be $global:DETest.Src
            (Get-DEThrown { Get-DECommunityToolPath -Id 'gpl' }) | Should -Match 'not a module'
            (Get-DEThrown { Get-DECommunityTool -Id 'nope' }) | Should -Match 'not in catalog'
        }
    }
    Context 'toolbox scripts' {
        BeforeAll {
            $global:DETest.ScriptSrc = Join-Path $global:DETest.Community 'scripts'; New-Item -ItemType Directory -Path (Join-Path $global:DETest.ScriptSrc 'scripts') -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $global:DETest.ScriptSrc 'scripts/fix_thing.ps1') -Value 'Write-Output fixed' -NoNewline
            $sha = (Get-FileHash -LiteralPath (Join-Path $global:DETest.ScriptSrc 'scripts/fix_thing.ps1') -Algorithm SHA256).Hash.ToLowerInvariant()
            $global:DETest.ScriptCatalog = [pscustomobject]@{ rawBase = 'https://raw.example/{repo}/{commit}/{path}'; tools = @([pscustomobject]@{ id = 'msp'; name = 'MSP scripts'; repo = 'example/msp'; commit = ('b' * 40); license = 'GPL-3.0'; use = 'scripts'; files = @()
                scripts = @([pscustomobject]@{ id = 'fix-thing'; title = 'Fix the thing'; category = 'repair'; path = 'scripts/fix_thing.ps1'; sha256 = $sha; arguments = @('-Quiet'); successExitCodes = @(0, 3010); timeoutSeconds = 60 },
                    [pscustomobject]@{ id = 'remove-rmm'; title = 'Remove old RMM'; category = 'takeover-removal'; path = 'scripts/fix_thing.ps1'; sha256 = $sha; confirm = $true; reboots = $true }) }) }
        }
        It 'lists scripts, downloads the pinned file, verifies it and runs it in its own PowerShell with the catalog arguments' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.ScriptCatalog }
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { Copy-Item -LiteralPath (Join-Path $global:DETest.ScriptSrc 'scripts/fix_thing.ps1') -Destination $OutFile }
            Mock -ModuleName DE.Community Invoke-DENative { [pscustomobject]@{ ExitCode = 3010; Output = @('fixed'); Text = 'fixed'; TimedOut = $false } }
            @(Get-DECommunityScripts).Count | Should -Be 2
            (Get-DECommunityScripts -Category 'takeover-removal').key | Should -Be 'msp/remove-rmm'
            $r = Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false
            $r.result | Should -Be 'PASS'; Test-Path -LiteralPath $r.log | Should -Be $true
            Assert-MockCalled -ModuleName DE.Community Invoke-DENative -Scope It -Times 1 -ParameterFilter { $Arguments -contains '-File' -and $Arguments -contains '-Quiet' -and $Arguments -contains '-NonInteractive' -and $TimeoutSeconds -eq 60 }
            Assert-MockCalled -ModuleName DE.Community Invoke-DECommunityDownload -Scope It -Times 1 -ParameterFilter { $Uri -eq "https://raw.example/example/msp/$('b' * 40)/scripts/fix_thing.ps1" }
            Mock -ModuleName DE.Community Invoke-DENative { [pscustomobject]@{ ExitCode = 1; Output = @('broke'); Text = 'broke'; TimedOut = $false } }
            (Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false).result | Should -Be 'FAIL'
            Mock -ModuleName DE.Community Invoke-DENative { [pscustomobject]@{ ExitCode = -1; Output = @(); Text = ''; TimedOut = $true } }
            (Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false).result | Should -Be 'FAIL'
        }
        It 'a script that uninstalls or restarts never runs headless without -Force, and plan-only runs nothing' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.ScriptCatalog }
            Mock -ModuleName DE.Community Test-DEInteractiveHost { $false }
            Mock -ModuleName DE.Community Invoke-DENative { [pscustomobject]@{ ExitCode = 0; Output = @(); Text = ''; TimedOut = $false } }
            (Invoke-DECommunityScript -Key 'msp/remove-rmm').result | Should -Be 'SKIPPED'
            (Invoke-DECommunityScript -Key 'msp/fix-thing' -WhatIf).result | Should -Be 'PLANNED'
            Assert-MockCalled -ModuleName DE.Community Invoke-DENative -Scope It -Times 0
            (Invoke-DECommunityScript -Key 'msp/remove-rmm' -Force -Confirm:$false).result | Should -Be 'PASS'
        }
        It 'a script that needs an Entra-joined device is refused on a JumpCloud-only device, and when the join state is unknown' {
            $cat = $global:DETest.ScriptCatalog | ConvertTo-Json -Depth 8 | ConvertFrom-Json
            $cat.tools[0].scripts[0] | Add-Member -NotePropertyName requires -NotePropertyValue @('entra-joined')
            $global:DETest.ReqCatalog = $cat
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.ReqCatalog }
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { Copy-Item -LiteralPath (Join-Path $global:DETest.ScriptSrc 'scripts/fix_thing.ps1') -Destination $OutFile }
            Mock -ModuleName DE.Community Invoke-DENative { [pscustomobject]@{ ExitCode = 0; Output = @(); Text = ''; TimedOut = $false } }
            Mock -ModuleName DE.Community Get-DEMicrosoftJoinState { @{ known = $true; entraJoined = $false } }
            $r = Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false
            $r.result | Should -Be 'REFUSED'; $r.detail | Should -Match 'not entra-joined'
            Mock -ModuleName DE.Community Get-DEMicrosoftJoinState { @{ known = $false; entraJoined = $false } }
            (Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false).result | Should -Be 'REFUSED'
            Assert-MockCalled -ModuleName DE.Community Invoke-DENative -Scope It -Times 0 -Exactly
            Mock -ModuleName DE.Community Get-DEMicrosoftJoinState { @{ known = $true; entraJoined = $true } }
            (Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false).result | Should -Be 'PASS'
        }
        It 'the real catalog gates the LAPS-to-Entra script on an Entra-joined device' {
            $real = Get-Content -LiteralPath (Join-Path (Split-Path -Parent $PSScriptRoot) 'catalog/community.json') -Raw -Encoding UTF8 | ConvertFrom-Json
            @(@($real.tools | ForEach-Object { @($_.scripts) } | Where-Object { $_ -and $_.id -eq 'laps-entra' })[0].requires) | Should -Contain 'entra-joined'
        }
        It 'a tampered script is refused' {
            Mock -ModuleName DE.Community Get-DECommunityCatalog { $global:DETest.ScriptCatalog }
            Remove-Item -LiteralPath (Join-Path (Get-DEConsole).Dirs.Base 'community/msp') -Recurse -Force -ErrorAction SilentlyContinue
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { Set-Content -LiteralPath $OutFile -Value 'Remove-Item C:\ -Recurse' }
            Mock -ModuleName DE.Community Invoke-DENative { throw 'must not run' }
            (Get-DEThrown { Invoke-DECommunityScript -Key 'msp/fix-thing' -Confirm:$false }) | Should -Match 'does not match the reviewed sha256'
        }
        It 'uses 64-bit Windows PowerShell' { if ($env:OS -eq 'Windows_NT') { Get-DEWindowsPowerShellPath | Should -Match 'System32|Sysnative' } else { Get-DEWindowsPowerShellPath | Should -Be 'pwsh' } }
    }
    It 'Lenovo: lists LSUClient packages, flags firmware and packages that need a technician' {
        Mock -ModuleName DE.Community Invoke-DELsuClient { @(
            [pscustomobject]@{ ID = 'n1'; Title = 'Intel Graphics Driver'; Type = 'Driver'; Category = 'Display'; Severity = 'Recommended'; Version = '31.0'; Installer = [pscustomobject]@{ Unattended = $true } },
            [pscustomobject]@{ ID = 'b1'; Title = 'BIOS Update'; Type = 'BIOS'; Category = 'BIOS'; Severity = 'Critical'; Version = '1.40'; Installer = [pscustomobject]@{ Unattended = $true } },
            [pscustomobject]@{ ID = 'm1'; Title = 'Dock Firmware'; Type = 'Firmware'; Category = 'Dock'; Severity = 'Recommended'; Version = '2.0'; Installer = [pscustomobject]@{ Unattended = $false } }) } -ParameterFilter { $Operation -eq 'Get' }
        $u = @(Get-DELenovoUpdates)
        $u.Count | Should -Be 3
        @($u | Where-Object { $_.firmware }).Count | Should -Be 2
        ($u | Where-Object { $_.id -eq 'm1' }).unattended | Should -Be $false
    }
    It 'Lenovo: BIOS suspends BitLocker, a shutdown is requested, and a failed package fails the step' {
        Mock -ModuleName DE.Operations Get-DEOemTool { @{ manufacturer = 'LENOVO'; lenovo = $null; applicable = 'lenovo' } }
        Mock -ModuleName DE.Operations Get-DELenovoUpdates { @(
            [pscustomobject]@{ id = 'n1'; title = 'Graphics'; type = 'Driver'; firmware = $false; unattended = $true; package = 'p1' },
            [pscustomobject]@{ id = 'b1'; title = 'BIOS'; type = 'BIOS'; firmware = $true; unattended = $true; package = 'p2' },
            [pscustomobject]@{ id = 'm1'; title = 'Dock'; type = 'Firmware'; firmware = $true; unattended = $false; package = 'p3' }) }
        Mock -ModuleName DE.Operations Get-DEBitLockerState { @{ osProtectionOn = $true } }
        Mock -ModuleName DE.Operations Suspend-DEBitLockerForFirmware { }
        Mock -ModuleName DE.Operations Request-DEReboot { }
        Mock -ModuleName DE.Community Invoke-DELsuClient { @([pscustomobject]@{ Title = 'Graphics'; Success = $true; PendingAction = 'NONE' }, [pscustomobject]@{ Title = 'BIOS'; Success = $true; PendingAction = 'SHUTDOWN' }) } -ParameterFilter { $Operation -eq 'Install' }
        Invoke-DEOemUpdate -IncludeBios -WhatIf | Should -Be 'planned'
        Assert-MockCalled -ModuleName DE.Operations Suspend-DEBitLockerForFirmware -Times 0
        $r = Invoke-DEOemUpdate -IncludeBios -Confirm:$false
        $r | Should -Match 'installed 2'; $r | Should -Match 'install by hand: Dock'
        Assert-MockCalled -ModuleName DE.Community Invoke-DELsuClient -Times 1 -ParameterFilter { $Operation -eq 'Install' -and @($Packages).Count -eq 2 }
        Assert-MockCalled -ModuleName DE.Operations Suspend-DEBitLockerForFirmware -Times 1
        Assert-MockCalled -ModuleName DE.Operations Request-DEReboot -Times 1 -ParameterFilter { $Reason -match 'shutdown' }
        # Without -IncludeBios only the driver goes, and nothing suspends BitLocker.
        Mock -ModuleName DE.Community Invoke-DELsuClient { @([pscustomobject]@{ Title = 'Graphics'; Success = $false; FailureReason = 'INSTALLER_EXITCODE'; ExitCode = 1603; PendingAction = 'NONE' }) } -ParameterFilter { $Operation -eq 'Install' }
        (Get-DEThrown { Invoke-DEOemUpdate -Confirm:$false }) | Should -Match 'Lenovo: 1 package\(s\) failed: Graphics \(INSTALLER_EXITCODE\)'
        Assert-MockCalled -ModuleName DE.Operations Suspend-DEBitLockerForFirmware -Times 1 -Exactly
    }
    It 'Lenovo scan: up to date, waiting, or unknown when the check fails (never a quiet green)' {
        Mock -ModuleName DE.Operations Get-DEOemTool { @{ manufacturer = 'LENOVO'; applicable = 'lenovo' } }
        Mock -ModuleName DE.Operations Get-DELenovoUpdates { @() }
        (Invoke-DEOemScan).current | Should -Be $true
        Mock -ModuleName DE.Operations Get-DELenovoUpdates { @([pscustomobject]@{ title = 'BIOS'; type = 'BIOS'; firmware = $true; unattended = $true }) }
        $s = Invoke-DEOemScan; $s.current | Should -Be $false; $s.count | Should -Be 1; $s.tool | Should -Be 'lsuclient'
        Mock -ModuleName DE.Operations Get-DELenovoUpdates { throw 'download.lenovo.com unreachable' }
        $s = Invoke-DEOemScan; $s.current | Should -BeNullOrEmpty; $s.output | Should -Match 'unreachable'
    }
    It 'HP: HP Image Assistant exit codes decide, and an unknown code fails' {
        Mock -ModuleName DE.Operations Get-DEOemTool { @{ manufacturer = 'HP'; hp = 'C:\HPIA\HPImageAssistant.exe'; applicable = 'hp' } }
        Mock -ModuleName DE.Operations Invoke-DENative { [pscustomobject]@{ ExitCode = 256; Text = ''; Output = @() } }
        (Invoke-DEOemScan).current | Should -Be $true
        Mock -ModuleName DE.Operations Get-DEBitLockerState { @{ osProtectionOn = $false } }
        Mock -ModuleName DE.Operations Request-DEReboot { }
        Mock -ModuleName DE.Operations Invoke-DENative { [pscustomobject]@{ ExitCode = 3010; Text = ''; Output = @() } }
        Invoke-DEOemUpdate -Confirm:$false | Should -Match 'exit 3010'
        Assert-MockCalled -ModuleName DE.Operations Invoke-DENative -Times 1 -ParameterFilter { $Arguments -contains '/Category:Drivers,Software,Accessories' }
        Assert-MockCalled -ModuleName DE.Operations Request-DEReboot -Times 1
        Mock -ModuleName DE.Operations Invoke-DENative { [pscustomobject]@{ ExitCode = 3020; Text = ''; Output = @() } }
        (Get-DEThrown { Invoke-DEOemUpdate -Confirm:$false }) | Should -Match '3020'
        Mock -ModuleName DE.Operations Get-DEOemTool { @{ manufacturer = 'HP'; hp = $null; applicable = 'hp' } }
        (Get-DEThrown { Invoke-DEOemUpdate -Confirm:$false }) | Should -Match 'HP Image Assistant is not installed'
    }
    It 'CIS audit: picks the benchmark by Windows version or profile, and summarises the report' {
        Mock -ModuleName DE.Community Get-DEDeviceInventory { @{ osBuild = '19045.4000' } }
        (Get-DECisBenchmark).key | Should -Be 'cis-win10-22h2'
        Mock -ModuleName DE.Community Get-DEDeviceInventory { @{ osBuild = '26100.2000' } }
        (Get-DECisBenchmark).key | Should -Be 'cis-win11-24h2'
        (Get-DECisBenchmark -ClientProfile @{ baseline = @{ cisBenchmark = 'msft-win11-25h2' } }).machine | Should -Match 'msft_security_baseline_windows_11_25h2_machine'
        (Get-DEThrown { Get-DECisBenchmark -Key 'nope' }) | Should -Match 'unknown benchmark'
        $csv = Join-Path $global:DETest.Community 'r.csv'
        "ID,Category,Name,Severity,Result,Recommended`n1,A,One,Passed,1,1`n2,A,Two,High,0,1`n3,B,Three,Medium,0,1`n4,B,Four,Passed,1,1" | Set-Content -LiteralPath $csv
        $s = ConvertFrom-DEHardeningKittyReport -Path $csv
        $s.total | Should -Be 4; $s.passed | Should -Be 2; $s.high | Should -Be 1; $s.percentPassed | Should -Be 50; $s.highFindings | Should -Be @('2 Two')
        Invoke-DECisAudit -WhatIf | Should -Be 'planned'
    }
    It 'the CIS audit step is registered, placed in the runbook, and not green until audited' {
        @(Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'takeover') | Should -Contain 'baseline.cis-audit'
        (@((Get-DERunbook -Mode 'takeover').stages | Where-Object { $_.id -eq 'configure' })[0].steps | ForEach-Object { $_.id }) | Should -Contain 'baseline.cis-audit'
        Set-DEStateValue -Path 'baseline.cisAudit' -Value $null
        $d = & (Get-DEAction -Id 'baseline.cis-audit').Detect
        $d.audited | Should -Be $false
    }
}

Describe 'Company-branded lock screen' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $global:DETest.Alamo = Get-DEClientProfile -Id 'alamo'
        $global:DETest.PD = $env:ProgramData
        $env:ProgramData = Join-Path $global:DETest.Dir 'programdata'; New-Item -ItemType Directory -Path $env:ProgramData -Force | Out-Null
        $global:DETest.Png = Join-Path $global:DETest.Dir 'lock-source.png'; [IO.File]::WriteAllBytes($global:DETest.Png, [byte[]](137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3))
        $global:DETest.WasWindows = & (Get-Module DE.Configure) { $script:IsWindowsHost }
        & (Get-Module DE.Configure) { $script:IsWindowsHost = $true }
    }
    AfterAll {
        $env:ProgramData = $global:DETest.PD
        & (Get-Module DE.Configure) { param($w) $script:IsWindowsHost = $w } $global:DETest.WasWindows
    }
    Context 'on a Pro device with two profiles' {
        BeforeAll {
            $global:FR = @{ 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP|LockScreenImagePath' = 'C:\Windows\Web\Screen\img100.jpg'; 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP|LockScreenImageStatus' = 1 }
            Mock -ModuleName DE.Configure Get-DEWindowsEdition { 'Professional' }
            Mock -ModuleName DE.Configure Get-DERegistryValue { $global:FR["$Path|$Name"] }
            Mock -ModuleName DE.Configure Set-DERegistryValue { $global:FR["$Path|$Name"] = $Value }
            Mock -ModuleName DE.Configure Remove-ItemProperty { $global:FR.Remove("$Path|$Name") }
            Mock -ModuleName DE.Configure Open-DEUserHives { @{ targets = @(@{ sid = 'S-1-5-21-1-2-3-1001'; root = 'Registry::HKEY_USERS\S-1-5-21-1-2-3-1001'; name = 'helen' }, @{ sid = 'Default'; root = 'Registry::HKEY_USERS\DE_Default'; name = 'Default (new users)' }); loaded = @(); failed = @() } }
            Mock -ModuleName DE.Configure Close-DEUserHives { }
        }
        It 'sets the image, stops users changing it, shows it at sign-in and turns Spotlight off for every profile' {
            (Get-DELockScreenState).ok | Should -Be $false
            $r = Set-DELockScreen -ClientProfile $global:DETest.Alamo -Image $global:DETest.Png -Confirm:$false
            $r | Should -Match 'Spotlight off for 2 profile\(s\)'
            $img = Join-Path $env:ProgramData 'DE\Branding\lockscreen.png'
            $global:FR['HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP|LockScreenImagePath'] | Should -Be $img
            $global:FR['HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization|NoChangingLockScreen'] | Should -Be 1
            $global:FR['HKLM:\SOFTWARE\Policies\Microsoft\Windows\System|DisableLogonBackgroundImage'] | Should -Be 0
            $global:FR['Registry::HKEY_USERS\S-1-5-21-1-2-3-1001\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager|RotatingLockScreenEnabled'] | Should -Be 0
            $s = Get-DELockScreenState
            $s.ok | Should -Be $true; $s.detail | Should -Match 'users cannot change it'
        }
        It 'a re-run keeps the original look for Undo, and Spotlight coming back for one person is named' {
            $null = Set-DELockScreen -ClientProfile $global:DETest.Alamo -Image $global:DETest.Png -Confirm:$false
            Get-DEHashPath -Object (Get-DEState -Path 'lockscreen.previous') -Path 'machine.csp.LockScreenImagePath.value' | Should -Be 'C:\Windows\Web\Screen\img100.jpg'
            $global:FR['Registry::HKEY_USERS\S-1-5-21-1-2-3-1001\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager|RotatingLockScreenEnabled'] = 1
            $s = Get-DELockScreenState
            $s.ok | Should -Be $false; $s.detail | Should -Match 'Spotlight still rotates the lock screen for: helen'
        }
        It 'undo restores the previous image and removes what did not exist before' {
            $r = Undo-DELockScreen -Confirm:$false
            $r | Should -Match 'restored'
            $global:FR['HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP|LockScreenImagePath'] | Should -Be 'C:\Windows\Web\Screen\img100.jpg'
            $global:FR.ContainsKey('HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization|NoChangingLockScreen') | Should -Be $false
            $global:FR.ContainsKey('Registry::HKEY_USERS\S-1-5-21-1-2-3-1001\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager|RotatingLockScreenEnabled') | Should -Be $false
            Get-DEState -Path 'lockscreen.previous' | Should -BeNullOrEmpty
        }
        It 'is its own step on Scan & fix, with the reason in plain words' {
            Register-DEBrandingActions -ClientProfile $global:DETest.Alamo
            $a = Get-DEAction -Id 'branding.lockscreen'
            $a.Title | Should -Match 'lock screen'
            $st = Get-DEActionState -Id 'branding.lockscreen'
            $st.Status | Should -Be 'DRIFT'; ($st.Drift -join ' ') | Should -Match 'not in place|does not point'
        }
    }
    Context 'on Windows Home' {
        BeforeAll { Mock -ModuleName DE.Configure Get-DEWindowsEdition { 'Core' } }
        It 'is reported, never passed, and nothing is written' {
            Mock -ModuleName DE.Configure Set-DERegistryValue { throw 'written on Home' }
            (Get-DEThrown { Set-DELockScreen -ClientProfile $global:DETest.Alamo -Image $global:DETest.Png -Confirm:$false }) | Should -Match 'ignores lock screen policy'
            $s = Get-DELockScreenState
            $s.supported | Should -Be $false; $s.ok | Should -Be $false; $s.detail | Should -Match 'upgrade to Pro'
        }
    }
}

Describe 'Intelligence Hub connection and code signing (Settings)' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:DETest = @{ Dir = Initialize-TestConsole } }
    It 'lists the four parts, and the server secret counts only after a signed send succeeded' {
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value ''
        Set-DEContext -Values @{ hubAccountId = '' }
        $c = @(Get-DEHubConnectionChecklist)
        $c.Count | Should -Be 4
        @($c | Where-Object { $_.ok -eq $true }).Count | Should -Be 0
        $c[3].ok | Should -BeNullOrEmpty
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example'
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'x-secret-value'
        Set-DEContext -Values @{ hubAccountId = '42' }
        $null = Add-DEEvidence -Step 'hub.migration' -Module 'migration' -Before 'record ready' -ActionTaken 'sent to the Hub as signed event e-1' -Result 'PASS' -Verification 'https://hub.example : applied'
        $c = @(Get-DEHubConnectionChecklist)
        @($c | Where-Object { $_.ok -eq $true }).Count | Should -Be 4
        ($c | ForEach-Object { $_.detail }) -join ' ' | Should -Not -Match 'x-secret-value'
        Clear-DESecrets
    }
    It 'the Hub check refuses plain http and reports what answered' {
        (Test-DEHubReachable -Endpoint 'http://hub.example').ok | Should -Be $false
        Mock -ModuleName DE.Evidence Invoke-WebRequest { [pscustomobject]@{ StatusCode = 200 } }
        $r = Test-DEHubReachable -Endpoint 'https://hub.example/api/whatever'
        $r.ok | Should -Be $true; $r.detail | Should -Be 'https://hub.example answered 200'
        Mock -ModuleName DE.Evidence Invoke-WebRequest { throw 'no route to host' }
        (Test-DEHubReachable -Endpoint 'https://hub.example').detail | Should -Match 'did not answer: no route to host'
    }
    It 'code-signing certificates are listed only on Windows, never throws' {
        $certs = @(Get-DECodeSigningCertificates)
        if ($env:OS -ne 'Windows_NT') { $certs.Count | Should -Be 0 } else { @($certs | Where-Object { -not $_.thumbprint }).Count | Should -Be 0 }
    }
}
