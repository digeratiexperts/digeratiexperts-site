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
        # Exchange Online and Az stand-ins with the real parameter names (always defined: a function wins over an installed cmdlet)
        function global:Get-EXOMailbox { param([string]$Identity, [string[]]$Properties, $ResultSize, $RecipientTypeDetails) throw 'not mocked' }
        function global:Set-Mailbox { param([string]$Identity, $EmailAddresses, $ForwardingSmtpAddress, $ForwardingAddress, $DeliverToMailboxAndForward, $GrantSendOnBehalfTo) throw 'not mocked' }
        function global:Get-AcceptedDomain { param() throw 'not mocked' }
        function global:Get-EXORecipient { param([string]$Identity) throw 'not mocked' }
        function global:Get-TransportRule { param() throw 'not mocked' }
        function global:Get-AzSubscription { param() throw 'not mocked' }
        function global:Get-AzResourceLock { param([string]$LockName, [string]$ResourceGroupName, [string]$ResourceName, [string]$ResourceType) throw 'not mocked' }
        function global:New-AzResourceLock { param([string]$LockName, [string]$LockLevel, [string]$LockNotes, [switch]$Force, [string]$ResourceGroupName, [string]$ResourceName, [string]$ResourceType) throw 'not mocked' }
        # repo layout (windows/tests) or the standalone zip (DE-Microsoft-Admin/tests)
        $mod = @((Join-Path (Split-Path -Parent $PSScriptRoot) 'microsoft/DE-Microsoft-Admin/DE-Microsoft-Admin.psd1'), (Join-Path (Split-Path -Parent $PSScriptRoot) 'DE-Microsoft-Admin.psd1')) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        Import-Module $mod -Force
        $global:MsT = @{ Dir = Join-Path ([IO.Path]::GetTempPath()) ("de-msadmin-" + [guid]::NewGuid().ToString('N')) }
        New-Item -ItemType Directory -Path $global:MsT.Dir -Force | Out-Null
        $null = Set-DEMsAuditPath -Path (Join-Path $global:MsT.Dir 'audit.jsonl')
        $global:MsT.Secret = New-Object Security.SecureString; foreach ($c in 'job-signing-secret-1'.ToCharArray()) { $global:MsT.Secret.AppendChar($c) }
        function global:Get-MsThrown { param([scriptblock]$S) try { $null = & $S; '<none>' } catch { $_.Exception.Message } }
    }
    AfterAll { Remove-Item -LiteralPath $global:MsT.Dir -Recurse -Force -ErrorAction SilentlyContinue; Remove-Module DE-Microsoft-Admin -Force -ErrorAction SilentlyContinue; Remove-Item -Path Function:\Invoke-MgGraphRequest, Function:\Get-MgContext, Function:\Connect-MgGraph, Function:\Get-EXOMailbox, Function:\Set-Mailbox, Function:\Get-AcceptedDomain, Function:\Get-EXORecipient, Function:\Get-TransportRule, Function:\Get-AzSubscription, Function:\Get-AzResourceLock, Function:\New-AzResourceLock -ErrorAction SilentlyContinue }

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
    It 'New-DEUser: verified domain, no duplicate, generated password never written, change forced at first sign-in' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        $global:MsT.Posts = @()
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            if ($Uri -like '*/domains*') { return @{ value = @(@{ id = 'alamo.com'; isVerified = $true }) } }
            if ($Method -eq 'POST') { $global:MsT.Posts += , $Body; return @{ id = 'u9' } }
            if ($Uri -like '*users?$filter*') { return @{ value = @($(if ($global:MsT.Exists) { @{ id = 'u1'; displayName = 'Old' } })) } }
            return @{ id = 'u9'; userPrincipalName = 'new.hire@alamo.com'; displayName = 'New Hire'; accountEnabled = $true; usageLocation = 'US' }
        }
        (New-DEUser -DisplayName 'X' -UserPrincipalName 'x@not-ours.com' -Confirm:$false).status | Should -Be 'Refused'
        $global:MsT.Exists = $true
        (New-DEUser -DisplayName 'X' -UserPrincipalName 'new.hire@alamo.com' -Confirm:$false).message | Should -Match 'already exists'
        $global:MsT.Exists = $false
        $r = New-DEUser -DisplayName 'New Hire' -UserPrincipalName 'new.hire@alamo.com' -UsageLocation 'us' -Confirm:$false
        $r.status | Should -Be 'Succeeded'; $r.data.temporaryPassword | Should -BeOfType [securestring]
        $sent = $global:MsT.Posts[0] | ConvertFrom-Json
        $sent.passwordProfile.forceChangePasswordNextSignIn | Should -Be $true; $sent.usageLocation | Should -Be 'US'
        $plain = [pscredential]::new('x', $r.data.temporaryPassword).GetNetworkCredential().Password
        $plain.Length | Should -Be 16; $sent.passwordProfile.password | Should -Be $plain
        (Export-DEResult -Result $r -Path (Join-Path $global:MsT.Dir 'u.json') | Get-Content -Raw) | Should -Not -Match ([regex]::Escape($plain))
        (Get-Content -LiteralPath (Get-DEMsAuditPath) -Raw) | Should -Not -Match ([regex]::Escape($plain))
    }
    It 'New-DEGroup is idempotent by nickname and builds a Microsoft 365 group with its owner' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Uri -like '*groups?$filter*') { @{ value = @(@{ id = 'g1'; displayName = 'Staff'; groupTypes = @(); securityEnabled = $true }) } } }
        (New-DEGroup -DisplayName 'Staff' -MailNickname 'staff' -Confirm:$false).message | Should -Match 'nothing changed'
        (New-DEGroup -DisplayName 'Other' -MailNickname 'staff' -Confirm:$false).status | Should -Be 'Refused'
        $global:MsT.Posts = @()
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Method -eq 'POST') { $global:MsT.Posts += , $Body; return @{ id = 'g2'; displayName = 'Sales' } }; if ($Uri -like '*groups?$filter*') { return @{ value = @() } }; @{ id = 'owner1' } }
        (New-DEGroup -DisplayName 'Sales' -MailNickname 'sales' -Type Microsoft365 -Owner 'joe@alamo.com' -Confirm:$false).status | Should -Be 'Succeeded'
        $b = $global:MsT.Posts[0] | ConvertFrom-Json
        @($b.groupTypes) | Should -Contain 'Unified'; $b.mailEnabled | Should -Be $true; $b.visibility | Should -Be 'Private'; @($b.'owners@odata.bind')[0] | Should -Match 'users/owner1$'
    }
    It 'Conditional Access: never enforces an all-users policy that excludes nobody, and reads the state back' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        $global:MsT.CaState = 'enabledForReportingButNotEnforced'; $global:MsT.Excl = @()
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            if ($Method -eq 'PATCH') { $global:MsT.CaState = ($Body | ConvertFrom-Json).state; return $null }
            @{ id = 'p1'; displayName = 'Require MFA'; state = $global:MsT.CaState; conditions = @{ users = @{ includeUsers = @('All'); excludeUsers = $global:MsT.Excl; excludeGroups = @() } } }
        }
        $r = Set-DEConditionalAccessPolicyState -PolicyId 'p1' -State enabled -Confirm:$false
        $r.status | Should -Be 'Refused'; $r.message | Should -Match 'break-glass'; $global:MsT.CaState | Should -Be 'enabledForReportingButNotEnforced'
        $global:MsT.Excl = @('bg-account-id')
        $r = Set-DEConditionalAccessPolicyState -PolicyId 'p1' -State enabled -Confirm:$false
        $r.status | Should -Be 'Succeeded'; $global:MsT.CaState | Should -Be 'enabled'
        (Set-DEConditionalAccessPolicyState -PolicyId 'p1' -State enabled -Confirm:$false).message | Should -Match 'nothing changed'
    }
    It 'Intune actions: the right Graph action, remote lock refused on Windows, wipe only with the exact device name' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        $global:MsT.Posts = @()
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Method -eq 'POST') { $global:MsT.Posts += , "$Uri|$Body"; return $null }; @{ id = 'md1'; deviceName = 'ALAMO-LAP-1'; serialNumber = 'PF3ABC12'; operatingSystem = 'Windows'; userPrincipalName = 'sthompson@alamo.com'; deviceActionResults = @(@{ actionName = 'wipe'; actionState = 'pending' }) } }
        (Invoke-DEIntuneDeviceAction -ManagedDeviceId 'md1' -Action Lock -Confirm:$false).status | Should -Be 'Refused'
        (Invoke-DEIntuneDeviceAction -ManagedDeviceId 'md1' -Action Wipe -Confirm:$false).status | Should -Be 'Refused'
        (Invoke-DEIntuneDeviceAction -ManagedDeviceId 'md1' -Action Wipe -ConfirmDeviceName 'alamo-lap-1' -Confirm:$false).status | Should -Be 'Refused'
        $global:MsT.Posts.Count | Should -Be 0
        (Invoke-DEIntuneDeviceAction -ManagedDeviceId 'md1' -Action Restart -Confirm:$false).status | Should -Be 'Succeeded'
        $global:MsT.Posts[0] | Should -Match '/managedDevices/md1/rebootNow\|'
        $r = Invoke-DEIntuneDeviceAction -ManagedDeviceId 'md1' -Action Wipe -ConfirmDeviceName 'ALAMO-LAP-1' -KeepEnrollmentData -Confirm:$false
        $r.data.actionState | Should -Be 'pending'
        ($global:MsT.Posts[1] -split '\|', 2)[0] | Should -Match '/wipe$'
        (($global:MsT.Posts[1] -split '\|', 2)[1] | ConvertFrom-Json).keepEnrollmentData | Should -Be $true
    }
    It 'Autopilot group tag uses updateDeviceProperties (a PATCH is ignored) and refuses an ambiguous serial' {
        Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 't1' } }
        $global:MsT.Posts = @(); $global:MsT.Tag = 'OLD'
        Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
            if ($Method -eq 'POST') { $global:MsT.Posts += , $Uri; $global:MsT.Tag = ($Body | ConvertFrom-Json).groupTag; return $null }
            if ($Method -eq 'PATCH') { throw 'PATCH must not be used' }
            if ($Uri -like '*$filter*') { return @{ value = @(@{ id = 'a1'; serialNumber = 'PF3ABC12'; groupTag = $global:MsT.Tag }, @{ id = 'a2'; serialNumber = 'PF3ABC123'; groupTag = '' }) } }
            @{ id = 'a1'; groupTag = $global:MsT.Tag }
        }
        $r = Set-DEAutopilotGroupTag -Serial 'PF3ABC12' -GroupTag 'ALAMO-STD' -Confirm:$false
        $r.status | Should -Be 'Succeeded'; $global:MsT.Posts[0] | Should -Match '/windowsAutopilotDeviceIdentities/a1/updateDeviceProperties$'
        (Set-DEAutopilotGroupTag -Serial 'PF3ABC12' -GroupTag 'ALAMO-STD' -Confirm:$false).message | Should -Match 'nothing changed'
        (Set-DEAutopilotGroupTag -Serial 'PF3ABC' -GroupTag 'X' -Confirm:$false).status | Should -Be 'Refused'
    }
    It 'Exchange: forwarding keeps a copy, external forwarding needs approval, aliases need an accepted and unused address' {
        Mock -ModuleName DE-Microsoft-Admin Get-AcceptedDomain { @([pscustomobject]@{ DomainName = 'alamo.com' }) }
        $global:MsT.Fwd = $null; $global:MsT.Set = @()
        Mock -ModuleName DE-Microsoft-Admin Get-EXOMailbox { [pscustomobject]@{ PrimarySmtpAddress = 'office@alamo.com'; ForwardingSmtpAddress = $global:MsT.Fwd; ForwardingAddress = $null; DeliverToMailboxAndForward = $true; EmailAddresses = @('SMTP:office@alamo.com'); ExternalDirectoryObjectId = 'o1' } }
        Mock -ModuleName DE-Microsoft-Admin Set-Mailbox { $global:MsT.Set += , @{ fwd = $ForwardingSmtpAddress; keep = $DeliverToMailboxAndForward; addr = $EmailAddresses }; if ($ForwardingSmtpAddress) { $global:MsT.Fwd = $ForwardingSmtpAddress } }
        (Set-DEMailboxForwarding -Identity 'office@alamo.com' -ForwardTo 'me@gmail.com' -Confirm:$false).status | Should -Be 'Refused'
        $global:MsT.Set.Count | Should -Be 0
        (Set-DEMailboxForwarding -Identity 'office@alamo.com' -ForwardTo 'joe@alamo.com' -Confirm:$false).status | Should -Be 'Succeeded'
        $global:MsT.Set[0].fwd | Should -Be 'smtp:joe@alamo.com'; $global:MsT.Set[0].keep | Should -Be $true
        (Set-DEMailboxAlias -Identity 'office@alamo.com' -Address 'info@elsewhere.com' -Confirm:$false).status | Should -Be 'Refused'
        Mock -ModuleName DE-Microsoft-Admin Get-EXORecipient { [pscustomobject]@{ ExternalDirectoryObjectId = 'other'; RecipientTypeDetails = 'UserMailbox'; DisplayName = 'Info Person' } }
        (Set-DEMailboxAlias -Identity 'office@alamo.com' -Address 'info@alamo.com' -Confirm:$false).message | Should -Match 'Info Person'
        (Set-DEMailboxAlias -Identity 'office@alamo.com' -Address 'office@alamo.com' -Action Remove -Confirm:$false).status | Should -Be 'Refused'
    }
    It 'transport rules that redirect, copy, skip spam filtering or delete are flagged' {
        Mock -ModuleName DE-Microsoft-Admin Get-TransportRule { @([pscustomobject]@{ Name = 'Disclaimer'; State = 'Enabled'; Mode = 'Enforce'; Priority = 0; Description = ''; RedirectMessageTo = $null; BlindCopyTo = $null; AddToRecipients = $null; SetSCL = $null; DeleteMessage = $false }, [pscustomobject]@{ Name = 'Sneaky'; State = 'Enabled'; Mode = 'Enforce'; Priority = 1; Description = ''; RedirectMessageTo = $null; BlindCopyTo = @('x@evil.com'); AddToRecipients = $null; SetSCL = -1; DeleteMessage = $false }) }
        $r = Get-DETransportRule
        $r.message | Should -Match '1 worth a look: Sneaky \(copies mail to others, bypasses spam filtering\)'
    }
    It 'Azure resource lock is idempotent, needs a type for one resource, and warns about ReadOnly' {
        (New-DEAzureResourceLock -LockName 'keep' -ResourceGroupName 'rg1' -ResourceName 'st1' -Confirm:$false).status | Should -Be 'Refused'
        Mock -ModuleName DE-Microsoft-Admin Get-AzResourceLock { if ($LockName -eq 'keep') { [pscustomobject]@{ Name = 'keep'; Properties = [pscustomobject]@{ level = 'CanNotDelete' } } } }
        (New-DEAzureResourceLock -LockName 'keep' -ResourceGroupName 'rg1' -Confirm:$false).message | Should -Match 'nothing changed'
        (New-DEAzureResourceLock -LockName 'keep' -LockLevel ReadOnly -ResourceGroupName 'rg1' -Confirm:$false).status | Should -Be 'Refused'
        (New-DEAzureResourceLock -LockName 'new' -LockLevel ReadOnly -ResourceGroupName 'rg2' -DryRun).message | Should -Match 'blocks routine operations'
    }
    It 'every mutating v0.3 operation is on the Hub job allowlist as a change, and the manifest exports what the module does' {
        $allow = InModuleScope DE-Microsoft-Admin { $script:JobAllowlist }
        foreach ($op in 'New-DEUser', 'New-DEGroup', 'Set-DEConditionalAccessPolicyState', 'Set-DEMailboxAlias', 'Set-DEMailboxForwarding', 'Invoke-DEIntuneDeviceAction', 'Set-DEAutopilotGroupTag', 'New-DEAzureResourceLock') { $allow[$op] | Should -Be $true }
        foreach ($op in 'Get-DETransportRule', 'Get-DEAzureSubscription') { $allow[$op] | Should -Be $false }
        $psd = Import-PowerShellDataFile -Path (Join-Path (Split-Path -Parent (Get-Module DE-Microsoft-Admin).Path) 'DE-Microsoft-Admin.psd1')
        @(Compare-Object @((Get-Module DE-Microsoft-Admin).ExportedFunctions.Keys) @($psd.FunctionsToExport)).Count | Should -Be 0
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
