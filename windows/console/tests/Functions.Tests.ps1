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
        Mock -ModuleName DE.Core Invoke-RestMethod { $global:DETest.Post = @{ Headers = $Headers; Body = $Body; Uri = $Uri }; @{ ok = $true } }
        $null = Invoke-DEJsonPost -Uri 'https://hub.example/x' -Body @{ device = 'd1'; token = 'leak-me' } -TokenSecret 'T_HUB'
        $global:DETest.Post.Headers['Authorization'] | Should -Be 'Bearer hub-token-abc'
        $global:DETest.Post.Body | Should -Not -Match 'leak-me'
        $global:DETest.Post.Body | Should -Match 'd1'
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
        Invoke-DEEntraLeave | Should -Be 'not Entra joined'
        Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined' } }
        Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'BLOCKED'; Detail = 'x' } }
        (Get-DEThrown { Invoke-DEEntraLeave -Confirm:$false }) | Should -Match 'refusing Entra leave'
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
            [void]$global:DETest.Calls.Add(@{ Method = "$Method"; Uri = "$Uri"; Headers = $Headers; Body = $Body })
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
        $res.overall | Should -Not -Match '^READY'
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
