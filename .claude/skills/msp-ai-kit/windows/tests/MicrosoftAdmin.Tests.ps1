# DE Microsoft Admin: Graph is mocked. Compatible with Pester 4.10 and 5.x.
Describe 'DE Microsoft Admin' {
    BeforeAll {
        # stand-ins so the module's calls resolve without the Microsoft modules installed; each test mocks them
        # (with the real parameter names, so mocks can read $Uri, $Method and $Headers). Always defined: a function wins
        # over a cmdlet, so a runner that has Microsoft.Graph installed mocks the same stand-in (the real cmdlet types
        # -Uri as [uri], whose string form un-escapes a%40b to a@b and would hide what the module actually sends)
        function global:Invoke-MgGraphRequest { param([string]$Method, [string]$Uri, $Body, [hashtable]$Headers, [string]$ContentType, [string]$OutputType) throw 'not mocked' }
        function global:Get-MgContext { param() throw 'not mocked' }
        function global:Connect-MgGraph { param([string]$TenantId, [string[]]$Scopes, [string]$ClientId, [string]$CertificateThumbprint, [switch]$NoWelcome) throw 'not mocked' }
        # repo layout (windows/tests) or the standalone zip (DE-Microsoft-Admin/tests)
        $mod = @((Join-Path (Split-Path -Parent $PSScriptRoot) 'microsoft/DE-Microsoft-Admin/DE-Microsoft-Admin.psd1'), (Join-Path (Split-Path -Parent $PSScriptRoot) 'DE-Microsoft-Admin.psd1')) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        Import-Module $mod -Force
        $global:MsT = @{ Dir = Join-Path ([IO.Path]::GetTempPath()) ("de-msadmin-" + [guid]::NewGuid().ToString('N')) }
        New-Item -ItemType Directory -Path $global:MsT.Dir -Force | Out-Null
        $null = Set-DEMsAuditPath -Path (Join-Path $global:MsT.Dir 'audit.jsonl')
        $global:MsT.Secret = New-Object Security.SecureString; foreach ($c in 'job-signing-secret-1'.ToCharArray()) { $global:MsT.Secret.AppendChar($c) }
        function global:Get-MsThrown { param([scriptblock]$S) try { $null = & $S; '<none>' } catch { $_.Exception.Message } }
    }
    AfterAll { Remove-Item -LiteralPath $global:MsT.Dir -Recurse -Force -ErrorAction SilentlyContinue; Remove-Module DE-Microsoft-Admin -Force -ErrorAction SilentlyContinue; Remove-Item -Path Function:\Invoke-MgGraphRequest, Function:\Get-MgContext, Function:\Connect-MgGraph -ErrorAction SilentlyContinue }

    It 'scope sets are least privilege: Read reads, and nothing asks for mail' {
        $r = @(Get-DEMsScopeSet -Scenario Read)
        @($r | Where-Object { $_ -match 'Write|Mail\.' }).Count | Should -Be 0
        @(Get-DEMsScopeSet -Scenario BitLocker) | Should -Contain 'BitLockerKey.ReadBasic.All'
        @(Get-DEMsScopeSet -Scenario BitLocker) | Should -Not -Contain 'BitLockerKey.Read.All'
    }
    It 'follows @odata.nextLink so a big tenant is never cut at 999' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Uri -like '*skiptoken*') { @{ value = @(@{ id = 'u3' }) } } else { @{ value = @(@{ id = 'u1' }, @{ id = 'u2' }); '@odata.nextLink' = 'https://graph.microsoft.com/v1.0/users?$skiptoken=abc' } } }
        $r = Get-DEUser
        @($r.data).Count | Should -Be 3; $r.status | Should -Be 'Succeeded'
    }
    It 'searches on the server with ConsistencyLevel eventual, escaped' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Last = @{ Uri = $Uri; Headers = $Headers }; @{ value = @() } }
        $null = Get-DEUser -Search 'o''brien & co'
        $global:MsT.Last.Headers['ConsistencyLevel'] | Should -Be 'eventual'
        $global:MsT.Last.Uri | Should -Match '\$search='
        $global:MsT.Last.Uri | Should -Not -Match ' & '
    }
    It 'retries throttling (429) and then succeeds' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Start-Sleep { }
        $global:MsT.Calls = 0
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Calls++; if ($global:MsT.Calls -lt 3) { throw 'Response status code does not indicate success: 429 (Too Many Requests).' }; @{ value = @(@{ id = 'x' }) } }
        @((Get-DEGroup).data).Count | Should -Be 1
        $global:MsT.Calls | Should -Be 3
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { throw 'Response status code does not indicate success: 403 (Forbidden).' }
        (Get-MsThrown { Get-DEGroup }) | Should -Match '403'
    }
    It 'Set-DEUserAccountState changes, reads back, and dry-runs without touching Graph' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Methods += , "$Method $Uri"; if ($Method -eq 'GET') { @{ id = 'u1'; userPrincipalName = 'a@b'; accountEnabled = $false } } }
        $global:MsT.Methods = @()
        (Set-DEUserAccountState -UserId 'a@b' -Enabled $false -RevokeSessions -Confirm:$false).status | Should -Be 'Succeeded'
        ($global:MsT.Methods -join ' | ') | Should -Match 'PATCH .*users/a%40b'
        ($global:MsT.Methods -join ' | ') | Should -Match 'POST .*revokeSignInSessions'
        ($global:MsT.Methods -join ' | ') | Should -Match 'GET .*users/a%40b\?\$select=id,userPrincipalName,accountEnabled'
        $global:MsT.Methods = @()
        (Set-DEUserAccountState -UserId 'a@b' -Enabled $true -DryRun).status | Should -Be 'DryRun'
        $global:MsT.Methods.Count | Should -Be 0
    }
    It 'Add-DEGroupMember is idempotent and refuses dynamic groups' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Uri -like '*members?*') { @{ value = @(@{ id = 'm1' }) } } else { @{ id = 'g1'; displayName = 'Staff'; groupTypes = @() } } }
        $r = Add-DEGroupMember -GroupId 'g1' -DirectoryObjectId 'm1' -Confirm:$false
        $r.status | Should -Be 'Succeeded'; $r.data.changed | Should -Be $false
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ id = 'g2'; displayName = 'All staff'; groupTypes = @('DynamicMembership', 'Unified') } }
        (Add-DEGroupMember -GroupId 'g2' -DirectoryObjectId 'm1' -Confirm:$false).status | Should -Be 'Refused'
    }
    It 'Remove-DEAutopilotDevice refuses ambiguity and an Intune record, and deletes Intune first when told to' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Start-Sleep { }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ value = @(@{ id = 'a1'; serialNumber = 'PF3ABC12' }, @{ id = 'a2'; serialNumber = 'PF3ABC12' }) } }
        (Remove-DEAutopilotDevice -Serial 'PF3ABC12' -Confirm:$false).status | Should -Be 'Refused'
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Uri -like '*managedDevices*') { @{ value = @(@{ id = 'md1'; deviceName = 'ALAMO-LAP-1' }) } } else { @{ value = @(@{ id = 'a1'; serialNumber = 'PF3ABC12' }, @{ id = 'a9'; serialNumber = 'PF3ABC123' }) } } }
        $r = Remove-DEAutopilotDevice -Serial 'PF3ABC12' -Confirm:$false
        $r.status | Should -Be 'Refused'; $r.message | Should -Match 'RemoveIntuneRecord'
        $global:MsT.Deleted = @(); $global:MsT.Gone = $false
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            if ($Method -eq 'DELETE') { $global:MsT.Deleted += , $Uri; if ($Uri -like '*windowsAutopilot*') { $global:MsT.Gone = $true }; return $null }
            if ($Uri -like '*managedDevices*') { return @{ value = @(@{ id = 'md1'; deviceName = 'ALAMO-LAP-1' }) } }
            if ($global:MsT.Gone) { return @{ value = @() } }; return @{ value = @(@{ id = 'a1'; serialNumber = 'PF3ABC12' }) } }
        (Remove-DEAutopilotDevice -Serial 'PF3ABC12' -RemoveIntuneRecord -WhatIf).status | Should -Be 'DryRun'
        $global:MsT.Deleted.Count | Should -Be 0
        $r = Remove-DEAutopilotDevice -Serial 'PF3ABC12' -RemoveIntuneRecord -Confirm:$false
        $r.status | Should -Be 'Succeeded'
        $global:MsT.Deleted[0] | Should -Match 'managedDevices/md1$'
        $global:MsT.Deleted[1] | Should -Match 'windowsAutopilotDeviceIdentities/a1$'
    }
    It 'proves BitLocker escrow in Entra from key IDs only, with the audit headers Graph requires' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Last = @{ Uri = $Uri; Headers = $Headers }; @{ value = @(@{ id = 'b0b0b0b0-1111-2222-3333-444455556666'; createdDateTime = '2026-01-01T00:00:00Z'; volumeType = 'operatingSystemVolume' }) } }
        $r = Test-DEEntraBitLockerEscrow -DeviceId 'dev-1' -KeyProtectorId '{B0B0B0B0-1111-2222-3333-444455556666}'
        $r.status | Should -Be 'Succeeded'; $r.data.escrowed | Should -Be $true
        $global:MsT.Last.Headers['ocp-client-name'] | Should -Not -BeNullOrEmpty
        $global:MsT.Last.Uri | Should -Not -Match 'select=key'
        (Test-DEEntraBitLockerEscrow -DeviceId 'dev-1' -KeyProtectorId '{00000000-0000-0000-0000-000000000000}').status | Should -Be 'Failed'
    }
    It 'a generic serial never deletes unrelated Intune devices, and a data-drive key is not the OS key' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Start-Sleep { }
        $global:MsT.Deleted = @()
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            if ($Method -eq 'DELETE') { $global:MsT.Deleted += , $Uri; return $null }
            if ($Uri -like '*managedDevices*') { return @{ value = @(@{ id = 'md1'; deviceName = 'A' }, @{ id = 'md2'; deviceName = 'B' }, @{ id = 'md3'; deviceName = 'C' }) } }
            @{ value = @(@{ id = 'a1'; serialNumber = 'Default string'; managedDeviceId = '00000000-0000-0000-0000-000000000000' }) }
        }
        (Remove-DEAutopilotDevice -Serial 'Default string' -RemoveIntuneRecord -Confirm:$false).status | Should -Be 'Refused'
        $global:MsT.Deleted.Count | Should -Be 0
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ value = @(@{ id = 'k1'; createdDateTime = '2026-01-01T00:00:00Z'; volumeType = 'fixedDataVolume' }) } }
        (Test-DEEntraBitLockerEscrow -DeviceId 'dev-1').status | Should -Be 'Failed'
    }
    It 'job canonical JSON orders keys by code unit and keeps nested arrays, like a Node signer' {
        ConvertTo-DEJobCanonical ([ordered]@{ environment = 1; Owner = 2; a_b = 3; aB = 4 }) | Should -Be '{"Owner":2,"aB":4,"a_b":3,"environment":1}'
        ConvertTo-DEJobCanonical ('{"p":[[1,2]],"n":0.00001}' | ConvertFrom-Json) | Should -Be '{"n":0.00001,"p":[[1,2]]}'
    }
    It 'Autopilot profiles come from Graph beta (they are not in v1.0)' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Last = $Uri; @{ value = @() } }
        $null = Get-DEAutopilotProfile
        $global:MsT.Last | Should -Match '/beta/deviceManagement/windowsAutopilotDeploymentProfiles'
    }
    It 'writes results without a BOM and audits without data' {
        $r = New-DEResult -Operation 'Test-Op' -Target 'x' -Data @{ secretish = 'value-not-in-audit' } -Message 'key 111111-222222-333333-444444-555555-666666-000011-719873'
        $f = Export-DEResult -Result $r -Path (Join-Path $global:MsT.Dir 'r.json')
        [IO.File]::ReadAllBytes($f.FullName)[0] | Should -Not -Be 0xEF
        $audit = Get-Content -LiteralPath (Get-DEMsAuditPath) -Raw
        $audit | Should -Match 'Test-Op'
        $audit | Should -Not -Match 'value-not-in-audit'
        $audit | Should -Not -Match '111111-222222'
    }
    Context 'signed Hub jobs' {
        BeforeAll { Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1'; Account = 'hub-worker' } } }
        It 'runs a signed plan job for a change as a dry run, and an approved apply job for real' {
            Mock -ModuleName DE-Microsoft-Admin Connect-MgGraph { }
            $null = Connect-DEMicrosoft -TenantId 'tenant-1' -Scenario Read
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { $global:MsT.Methods += , "$Method"; @{ id = 'u1'; accountEnabled = $false } }
            $global:MsT.Methods = @()
            $job = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Set-DEUserAccountState' -Parameters @{ UserId = 'a@b'; Enabled = $false } -RequestedBy 'hub:joe' -Secret $global:MsT.Secret
            $r = Invoke-DEMicrosoftJob -JobJson ($job | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath (Join-Path $global:MsT.Dir 'ledger.txt')
            $r.status | Should -Be 'DryRun'; $global:MsT.Methods.Count | Should -Be 0
            $job2 = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Set-DEUserAccountState' -Parameters @{ UserId = 'a@b'; Enabled = $false } -Mode apply -ApprovedBy 'joe' -RequestedBy 'hub:joe' -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($job2 | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath (Join-Path $global:MsT.Dir 'ledger.txt')).status | Should -Be 'Succeeded'
            ($global:MsT.Methods -join ',') | Should -Match 'PATCH'
            # the same job again is a replay
            (Invoke-DEMicrosoftJob -JobJson ($job2 | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath (Join-Path $global:MsT.Dir 'ledger.txt')).message | Should -Match 'replay'
        }
        It 'refuses tampering, missing approval, other tenants, unknown operations and foreign parameters' {
            $L = Join-Path $global:MsT.Dir 'ledger2.txt'
            $j = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Get-DEUser' -Parameters @{ Search = 'suz' } -Secret $global:MsT.Secret
            $t = $j | ConvertTo-Json -Depth 5 | ConvertFrom-Json; $t.parameters.Search = 'everyone'
            (Invoke-DEMicrosoftJob -JobJson ($t | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match 'signature'
            $a = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Remove-DEAutopilotDevice' -Parameters @{ Serial = 'X' } -Mode apply -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($a | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match 'approvedBy'
            $o = New-DEMicrosoftJob -TenantId 'tenant-2' -Operation 'Get-DEUser' -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($o | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match 'tenant'
            $u = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Connect-DEAzure' -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($u | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match 'not allowlisted'
            $p = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Get-DEUser' -Parameters @{ Search = 'a'; Verbose = $true } -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($p | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match "parameter 'Verbose'"
            $e = New-DEMicrosoftJob -TenantId 'tenant-1' -Operation 'Get-DEUser' -ValidMinutes 120 -Secret $global:MsT.Secret
            (Invoke-DEMicrosoftJob -JobJson ($e | ConvertTo-Json -Depth 5) -Secret $global:MsT.Secret -LedgerPath $L).message | Should -Match 'validity window'
        }
        It 'canonical job JSON is sorted, compact and escaped like JSON.stringify (a Node signer gets the same bytes)' {
            ConvertTo-DEJobCanonical ([ordered]@{ b = 1; a = 'x<y>&z"q'; signature = 'drop'; c = @($true, $null) }) | Should -BeExactly '{"a":"x<y>&z\"q","b":1,"c":[true,null]}'
        }
    }
}
