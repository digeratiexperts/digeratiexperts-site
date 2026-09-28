# Pester tests for the DE Technician Console engine. Compatible with Pester 4.10 and 5.x.
#   Invoke-Pester -Path .claude/skills/msp-ai-kit/windows/console/tests
# Helpers live in TestHelpers.ps1 and are dot-sourced inside every BeforeAll.
# Windows-only behaviour (registry, CIM, services) is mocked so the suite also runs on Linux/macOS.

Describe 'dsregcmd parser: every join type' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'classifies Entra joined and reads tenant, PRT, NGC, account' {
        $r = ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-entra-joined.txt') -Raw)
        $r.joinType | Should -Be 'entra-joined'
        $r.tenantName | Should -Be 'Alamo'
        $r.azureAdPrt | Should -Be $true
        $r.ngcSet | Should -Be $true
        $r.executingAccountName | Should -Match 'AzureAD\\SuzetteThompson'
    }
    It 'classifies hybrid Entra joined' { (ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-hybrid.txt') -Raw)).joinType | Should -Be 'hybrid-entra-joined' }
    It 'classifies AD domain joined' { (ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-ad-domain.txt') -Raw)).joinType | Should -Be 'ad-domain-joined' }
    It 'classifies Entra registered (workplace joined)' { (ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-registered.txt') -Raw)).joinType | Should -Be 'entra-registered' }
    It 'classifies local / workgroup' { (ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-local.txt') -Raw)).joinType | Should -Be 'local-workgroup' }
    It 'returns unknown for empty output instead of guessing' { (ConvertFrom-DEDsregcmd -Text '').joinType | Should -Be 'unknown' }
}

Describe 'Secrets runtime and redaction' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $script:Dir = Initialize-TestConsole }
    It 'keeps secrets in memory and redacts them from any text' {
        Set-DESecret -Name 'S1_SITE_TOKEN' -Plain 'eyJhbGciOiJSUzI1NiJ9-site-token-value-1234567890'
        Test-DESecret -Name 'S1_SITE_TOKEN' | Should -Be $true
        (Protect-DEText 'installer -t eyJhbGciOiJSUzI1NiJ9-site-token-value-1234567890 -q') | Should -Not -Match 'site-token-value'
    }
    It 'redacts common credential shapes even when not registered' {
        $t = Protect-DEText 'password=hunter2hunter2 token: abcdefghijklmnop Bearer abc.def.ghi 111111-222222-333333-444444-555555-666666-777777-888888'
        $t | Should -Not -Match 'hunter2'
        $t | Should -Not -Match 'abcdefghijklmnop'
        $t | Should -Not -Match '111111-222222'
    }
    It 'never writes a secret into the state file' {
        Set-DESecret -Name 'BREAKGLASS_PASSWORD' -Plain 'Correct-Horse-Battery-Staple-9'
        Set-DEStateValue -Path 'test.value' -Value 'Correct-Horse-Battery-Staple-9'
        Set-DEStateValue -Path 'test.password' -Value 'whatever-it-is'
        $raw = Get-Content -LiteralPath (Get-ChildItem (Join-Path $script:Dir 'state') -Filter '*.json' | Where-Object { $_.Name -ne 'exceptions.json' } | Select-Object -First 1).FullName -Raw
        $raw | Should -Not -Match 'Correct-Horse'
        $raw | Should -Not -Match 'whatever-it-is'
    }
    It 'clears secrets' { Clear-DESecrets; Test-DESecret -Name 'S1_SITE_TOKEN' | Should -Be $false }
}

Describe 'Gate engine and action lifecycle' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        # Action scriptblocks run inside DE.Core, where $script: is the module scope; share state through a global.
        $global:DETest = @{ GateState = 'BLOCKED'; Value = 1; ApplyCount = 0; Rem = 0 }
        Register-DEGate -Id 'gate.t' -Title 'Test gate' -Check { @{ Status = $global:DETest.GateState; Detail = 'x' } } -Unblock 'open it'
        Register-DEAction -Id 't.action' -Module 'test' -Title 'Test action' -Gates @('gate.t') -Detect { @{ v = $global:DETest.Value } } -Desired { @{ v = 2 } } -Apply { param($s) $global:DETest.ApplyCount++; $global:DETest.Value = 2; 'applied' }
    }
    It 'refuses to apply while a gate is closed (BLOCKED) and names the unblock step' {
        $e = Invoke-DEAction -Id 't.action' -Mode Apply
        $e.result | Should -Be 'BLOCKED'
        $e.remediation | Should -Match 'open it'
        $global:DETest.ApplyCount | Should -Be 0
    }
    It 'audit detects drift even while gated and changes nothing' {
        $e = Invoke-DEAction -Id 't.action' -Mode Audit
        $e.result | Should -Be 'WARN'
        $e.verification | Should -Match 'gates not passed'
        $global:DETest.ApplyCount | Should -Be 0
    }
    It 'an approved exception unlocks the gate but the result reads EXCEPTION, never PASS' {
        $null = Add-DEException -Target 'gate.t' -Reason 'test' -Approver 'Joe' -ExpiresOn (Get-Date).AddDays(1)
        Reset-DEGateCache
        $e = Invoke-DEAction -Id 't.action' -Mode Apply
        $e.result | Should -Be 'EXCEPTION'
        $global:DETest.ApplyCount | Should -Be 1
        Remove-DEException -Target 'gate.t'
    }
    It 'is idempotent: a second run is NO CHANGE and does not apply again' {
        $global:DETest.GateState = 'PASS'; Reset-DEGateCache
        $e = Invoke-DEAction -Id 't.action' -Mode Apply
        $e.result | Should -Be 'NO CHANGE'
        $global:DETest.ApplyCount | Should -Be 1
    }
    It 'plans instead of applying under WhatIf' {
        $global:DETest.Value = 1
        $e = Invoke-DEAction -Id 't.action' -Mode Apply -WhatIf
        $e.result | Should -Be 'PLANNED'
        $global:DETest.Value | Should -Be 1
    }
    It 'refuses when a required runtime secret is missing' {
        Register-DEAction -Id 't.secret' -Module 'test' -Title 'Needs secret' -RequiresSecrets @('NOPE') -Detect { @{ v = 1 } } -Desired { @{ v = 2 } } -Apply { param($s) 'x' }
        (Invoke-DEAction -Id 't.secret' -Mode Apply).result | Should -Be 'BLOCKED'
    }
    It 'retries, runs remediation, and reports FAIL (never PASS) when verification keeps failing' {
        $global:DETest.Rem = 0
        Register-DEAction -Id 't.fail' -Module 'test' -Title 'Always fails' -Detect { @{ v = 1 } } -Desired { @{ v = 2 } } -Apply { param($s) 'tried' } -Remediate { param($s) $global:DETest.Rem++ }
        $e = Invoke-DEAction -Id 't.fail' -Mode Apply -MaxRetries 2
        $e.result | Should -Be 'FAIL'
        $global:DETest.Rem | Should -Be 1
    }
    It 'records skips with the reason' { (Invoke-DEAction -Id 't.fail' -SkipReason 'client declined').result | Should -Be 'SKIPPED' }
    It 'refuses exceptions without a future expiry' { { Add-DEException -Target 'x' -Reason 'r' -Approver 'a' -ExpiresOn (Get-Date).AddDays(-1) } | Should -Throw }
}

Describe 'Profiles: technician versus end user, client detection, no secrets' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Snap = @{
            device = @{ hostname = 'ALAMO-LAP-0231'; serial = 'ABC1234'; model = 'Latitude 7450' }
            identity = @{ dsreg = (ConvertFrom-DEDsregcmd -Text (Get-Content (Join-Path $script:Fixtures 'dsregcmd-entra-joined.txt') -Raw)); interactiveUser = 'AzureAD\SuzetteThompson'; currentPrincipal = 'ALAMO-LAP-0231\DE-BreakGlass'; profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-1'; lastUse = '2026-09-27' }, @{ path = 'C:\Users\DE-BreakGlass'; sid = 'S-1-5-21-9'; lastUse = '2026-09-28' }) }
        }
    }
    It 'turns an Entra principal into the DE local user name' { ConvertTo-DELocalUserName -DisplayOrPrincipal 'AzureAD\SuzetteThompson' | Should -Be 'sthompson' }
    It 'detects Alamo from tenant, hostname and profile folder with high confidence' {
        $m = Resolve-DEClientContext -Snapshot $script:Snap
        $m.best.id | Should -Be 'alamo'
        $m.confidence | Should -Be 'high'
    }
    It 'keeps the technician as Joe (jrpetro) and the end user as Suzette' {
        $eu = Resolve-DEEndUser -Snapshot $script:Snap -Technician 'jrpetro'
        $eu.technician | Should -Be 'jrpetro'
        $eu.endUser | Should -Be 'AzureAD\SuzetteThompson'
        $eu.endUserIsEntraPrincipal | Should -Be $true
    }
    It 'builds the takeover context: source AzureAD\SuzetteThompson, destination sthompson' {
        $c = New-DEProvisioningContext -Snapshot $script:Snap -Mode takeover
        $c.client | Should -Be 'alamo'
        $c.sourcePrincipal | Should -Be 'AzureAD\SuzetteThompson'
        $c.localUserName | Should -Be 'sthompson'
        $c.technician | Should -Be 'jrpetro'
    }
    It 'refuses to save a profile that carries a secret' {
        $p = New-DEClientProfileTemplate -Id 'leaky' -Name 'Leaky'
        $p.vendorTenants.s1_site_token = 'eyJhbGciOiJ-real-looking-token'
        { Save-DEClientProfile -Profile $p } | Should -Throw
    }
    It 'tier defaults name components, never prices' {
        $t = Get-DETierDefaults -Tier Business
        $t.included.mdr | Should -Be 'guardz'
        ($t | ConvertTo-Json -Depth 5) | Should -Not -Match '\$\d'
    }
}

Describe 'Identity gates with mocked machine states' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole; Register-DEIdentityGates }
    Context 'Entra-joined laptop, source user signed in, no break-glass' {
        BeforeAll {
            Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; interactiveUser = 'AzureAD\SuzetteThompson'; localUsers = @(); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-1'; loaded = $true }); dsreg = @{ azureAdPrt = $true }; hello = @{ pinConfigured = $true; ngcFolderPresent = $true } } }
            Mock -ModuleName DE.Identity Get-DEBreakGlassState { @{ exists = $false; enabled = $false; administrator = $false; passwordRequired = $false; hiddenFromLogon = $false; localOnly = $false; verified = $false; verifiedAt = $null } }
            Mock -ModuleName DE.Identity Test-DEIsElevated { $true }
            Mock -ModuleName DE.Identity Get-DEPendingReboot { @{ pending = $false; reasons = @() } }
            Mock -ModuleName DE.Identity Get-DEAdmuState { @{ installed = $true; version = '2.8.0' } }
            Mock -ModuleName DE.Identity Test-DEBitLockerGate { @{ Status = 'WARN'; Detail = 'protector id not recorded' } }
            Mock -ModuleName DE.Identity Test-DEOneDriveGate { @{ Status = 'WARN'; Detail = 'sync not confirmed' } }
            Mock -ModuleName DE.Identity Get-DEMdmState { @{ authority = 'none'; staleEnrollments = @() } }
        }
        It 'blocks the migration and lists every reason' {
            Reset-DEGateCache
            $p = Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson'
            $p.ok | Should -Be $false
            ($p.issues -join ' ') | Should -Match 'signed in'
            ($p.issues -join ' ') | Should -Match 'break-glass'
            ($p.issues -join ' ') | Should -Match 'BitLocker'
            ($p.issues -join ' ') | Should -Match 'OneDrive'
        }
        It 'explains the Windows Hello impact before the migration' { ((Get-DEHelloImpact).impact -join ' ') | Should -Match 'PIN' }
    }
    Context 'Username or profile collision' {
        BeforeAll {
            Mock -ModuleName DE.Identity Get-DEIdentityState { @{ joinType = 'entra-joined'; interactiveUser = 'ALAMO-LAP\DE-BreakGlass'; localUsers = @(@{ name = 'sthompson'; enabled = $true; sid = 'S-1-5-21-5' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-1'; loaded = $false }, @{ path = 'C:\Users\sthompson'; sid = 'S-1-5-21-5'; loaded = $false }); dsreg = @{ azureAdPrt = $false }; hello = @{ pinConfigured = $false; ngcFolderPresent = $false } } }
            Mock -ModuleName DE.Identity Test-DEGate { [pscustomobject]@{ Id = $Id; Status = 'PASS'; Detail = 'ok'; Unblock = '' } }
            Mock -ModuleName DE.Identity Test-DEIsElevated { $true }
            Mock -ModuleName DE.Identity Get-DEPendingReboot { @{ pending = $false; reasons = @() } }
            Mock -ModuleName DE.Identity Get-DEAdmuState { @{ installed = $true } }
        }
        It 'refuses when the destination account or profile already exists' {
            $p = Test-DEMigrationPreconditions -SourcePrincipal 'AzureAD\SuzetteThompson' -LocalUserName 'sthompson'
            $p.ok | Should -Be $false
            ($p.issues -join ' ') | Should -Match 'collision'
        }
    }
    Context 'Break-glass rules' {
        It 'never lets jrpetro be the break-glass identity' {
            Set-DESecret -Name 'BREAKGLASS_PASSWORD' -Plain 'Long-Enough-Password-123'
            { New-DEBreakGlassAccount -Name 'jrpetro' } | Should -Throw
        }
        It 'refuses to store a recovery password as a protector id' { { Set-DEBitLockerExpectedProtector -ProtectorId '111111-222222-333333-444444-555555-666666-777777-888888' } | Should -Throw }
    }
    Context 'MDM authority' {
        It 'blocks dual MDM (JumpCloud agent plus active Intune)' {
            Mock -ModuleName DE.Identity Get-DEMdmState { @{ authority = 'dual (JumpCloud + Intune)'; staleEnrollments = @() } }
            (Test-DEGate -Id 'gate.no-dual-mdm' -Refresh).Status | Should -Be 'BLOCKED'
        }
        It 'passes a JumpCloud-managed device' {
            Mock -ModuleName DE.Identity Get-DEMdmState { @{ authority = 'jumpcloud'; staleEnrollments = @() } }
            (Test-DEGate -Id 'gate.no-dual-mdm' -Refresh).Status | Should -Be 'PASS'
        }
        It 'passes an Intune-managed device (authority decided by the profile, not assumed)' {
            Mock -ModuleName DE.Identity Get-DEMdmState { @{ authority = 'intune'; staleEnrollments = @() } }
            (Test-DEGate -Id 'gate.no-dual-mdm' -Refresh).Status | Should -Be 'PASS'
        }
    }
}

Describe 'JumpCloud mapping: the Alamo finding' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'reports BLOCKED when sthompson does not exist locally and Suzette is still the Entra principal' {
        Mock -ModuleName DE.JumpCloud Get-DEIdentityState { @{ localUsers = @(@{ name = 'Owner'; enabled = $true; sid = 'S-1-5-21-1' }); profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-1' }); interactiveUser = 'AzureAD\SuzetteThompson' } }
        $m = Test-DEJumpCloudUserMapping -IntendedLocalUser 'sthompson' -SourcePrincipal 'AzureAD\SuzetteThompson'
        $m.status | Should -Be 'BLOCKED'
        ($m.issues -join ' ') | Should -Match 'does not exist'
        ($m.issues -join ' ') | Should -Match 'signed in'
    }
    It 'reports READY once the local account owns the preserved profile' {
        Mock -ModuleName DE.JumpCloud Get-DEIdentityState { @{ localUsers = @(@{ name = 'sthompson'; enabled = $true; sid = 'S-1-5-21-5' }); profiles = @(@{ path = 'C:\Users\sthompson'; sid = 'S-1-5-21-5' }); interactiveUser = 'ALAMO\jrpetro' } }
        (Test-DEJumpCloudUserMapping -IntendedLocalUser 'sthompson').status | Should -Be 'READY'
    }
}

Describe 'Vendor Admin Center' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'has the 18 locked categories in order' { @(Get-DEVendorCategories).Count | Should -Be 18 }
    It 'marks Guardz primary and Blackpoint backup' {
        (Get-DEVendors | Where-Object { $_.id -eq 'guardz-msp' }).role | Should -Be 'primary'
        (Get-DEVendors | Where-Object { $_.id -eq 'blackpoint' }).role | Should -Be 'backup'
    }
    It 'names the missing tenant value instead of guessing a URL' {
        $v = Get-DEVendors | Where-Object { $_.id -eq 'wazuh-cloud' }
        (Resolve-DEVendorUrl -Vendor $v -Kind tenant -ClientProfile (Get-DEClientProfile -Id 'alamo')).missing | Should -Contain 'wazuh_cloud_id'
    }
    It 'every catalog URL is https' {
        foreach ($v in Get-DEVendors) { foreach ($p in $v.urls.PSObject.Properties) { $p.Value | Should -Match '^https://' } }
    }
    It 'builds managed bookmarks JSON with a DE top-level folder' { ((New-DEManagedBookmarks) | ConvertFrom-Json)[0].toplevel_name | Should -Be 'DE' }
}

Describe 'Packages and trust policy' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'resolves secret tokens only at run time and the log view is redacted' {
        Set-DESecret -Name 'JC_CONNECT_KEY' -Plain 'jcconnectkeyvalue0123456789abcdef'
        $pkg = Get-DEPackage -Id 'jumpcloud-agent'
        $t = Resolve-DEPackageTokens -Text $pkg.install.args -Package $pkg -File 'C:\x.msi'
        $t | Should -Match 'jcconnectkeyvalue'
        (Protect-DEText $t) | Should -Not -Match 'jcconnectkeyvalue'
    }
    It 'refuses a local file that matches neither hash nor publisher' {
        $f = Join-Path ([IO.Path]::GetTempPath()) 'fake-installer.msi'; Set-Content -LiteralPath $f -Value 'not an installer'
        (Test-DEPackageTrust -Path $f -Sha256 ('0' * 64)).Ok | Should -Be $false
    }
    It 'every package without winget declares a publisher or sha256' {
        foreach ($p in Get-DEPackages) { if ($p.source.type -ne 'winget') { ([bool]$p.source.PSObject.Properties['publisher'] -or [bool]$p.source.PSObject.Properties['sha256']) | Should -Be $true } }
    }
}

Describe 'Evidence: client-safe output and readiness honesty' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Alamo = Get-DEClientProfile -Id 'alamo'
        Add-DEEvidence -Step 'security.guardz' -Module 'security' -Before 'x' -ActionTaken 'install' -Result 'PASS' | Out-Null
        Add-DEEvidence -Step 'security.sentinelone' -Module 'security' -Before 'x' -ActionTaken 'install' -Result 'FAIL' -Verification 'service stopped' | Out-Null
    }
    It 'never reports READY while any area failed' { (Get-DEReadiness).overall | Should -Be 'NOT READY' }
    It 'the client report carries no vendor names, keys or internal sections' {
        $snap = @{ device = @{ hostname = 'H'; serial = 'S'; manufacturer = 'Dell'; model = 'M' } }
        $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -ClientSafe
        $html | Should -Not -Match 'Guardz|SentinelOne|Blackpoint|JumpCloud'
        $html | Should -Not -Match 'Evidence log'
    }
    It 'writes a hashed bundle with a manifest' {
        $snap = @{ device = @{ hostname = 'H'; serial = 'S' } }
        $b = Export-DEEvidenceBundle -Snapshot $snap -ClientProfile $script:Alamo
        Test-Path -LiteralPath $b.zip | Should -Be $true
        $b.sha256 | Should -Match '^[0-9a-fA-F]{64}$'
        (Get-Content -LiteralPath (Join-Path $b.folder 'manifest.sha256')).Count | Should -BeGreaterThan 4
    }
}

Describe 'Workflow' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole; $script:Ids = Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'takeover' }
    It 'registers the full takeover plan' { $script:Ids.Count | Should -BeGreaterThan 60 }
    It 'puts identity migration behind break-glass, BitLocker, OneDrive and signed-out gates' {
        $a = Get-DEAction -Id 'identity.migrate'
        foreach ($g in @('gate.breakglass', 'gate.bitlocker', 'gate.onedrive', 'gate.source-user-signed-out')) { $a.Gates | Should -Contain $g }
    }
    It 'puts JumpCloud binding behind the mapping gate' { (Get-DEAction -Id 'jumpcloud.bind-user').Gates | Should -Contain 'gate.jc-mapping' }
    It 'always has a next action with a reason' { (Get-DENextAction -Mode 'takeover').why | Should -Not -BeNullOrEmpty }
}

Describe 'Module surface and phase runner' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'no two console modules export the same function (last import would silently win)' {
        $seen = @{}; $dupes = @()
        # Pester 5 lists a module once per importer; compare distinct modules only
        foreach ($m in @(Get-Module | Where-Object { $_.Name -like 'DE.*' } | Group-Object Name | ForEach-Object { $_.Group[0] })) { foreach ($f in $m.ExportedFunctions.Keys) { if ($seen.ContainsKey($f)) { $dupes += "$f ($($seen[$f]) and $($m.Name))" } else { $seen[$f] = $m.Name } } }
        $dupes | Should -BeNullOrEmpty
    }
    It 'runs every action in a phase instead of stopping after the first' {
        $global:DETest = @{ A = 0; B = 0 }
        Register-DEAction -Id 'p.one' -Module 'test' -Title 'one' -Phase 77 -Detect { @{ v = $global:DETest.A } } -Desired { @{ v = 1 } } -Apply { param($s) $global:DETest.A = 1 }
        Register-DEAction -Id 'p.two' -Module 'test' -Title 'two' -Phase 77 -Detect { @{ v = $global:DETest.B } } -Desired { @{ v = 1 } } -Apply { param($s) $global:DETest.B = 1 }
        $r = @(Invoke-DEPhase -Phase 77 -Mode 'takeover')
        $r.Count | Should -Be 2
        $global:DETest.B | Should -Be 1
    }
    It 'stops a phase once the console queues a restart, and resumes cleanly' {
        $global:DETest = @{ A = 0; B = 0 }
        Register-DEAction -Id 'p.one' -Module 'test' -Title 'one' -Phase 78 -Detect { @{ v = $global:DETest.A } } -Desired { @{ v = 1 } } -Apply { param($s) $global:DETest.A = 1; $null = Request-DEReboot -Reason 'test' }
        Register-DEAction -Id 'p.two' -Module 'test' -Title 'two' -Phase 78 -Detect { @{ v = $global:DETest.B } } -Desired { @{ v = 1 } } -Apply { param($s) $global:DETest.B = 1 }
        @(Invoke-DEPhase -Phase 78 -Mode 'takeover').Count | Should -Be 1
        $global:DETest.B | Should -Be 0
        Clear-DEResume
        @(Get-DERebootQueue | Where-Object { $_ }).Count | Should -Be 0
    }
    It 'a one-item drift list is DRIFT, not a detector failure' {
        Register-DEAction -Id 'p.drift' -Module 'test' -Title 'drift' -Detect { @{ v = 1 } } -Desired { @{ v = 2 } }
        (Get-DEActionState -Id 'p.drift').Status | Should -Be 'DRIFT'
    }
    It 'resolves the Vendor URL placeholders from the client profile' {
        $v = [pscustomobject]@{ id = 'x'; urls = [pscustomobject]@{}; tenantUrlTemplate = 'https://{a}.example.com/{b}' }
        $p = [pscustomobject]@{ vendorTenants = [pscustomobject]@{ a = 'acme'; b = 'home' } }
        (Resolve-DEVendorUrl -Vendor $v -Kind tenant -ClientProfile $p).url | Should -Be 'https://acme.example.com/home'
        $p2 = [pscustomobject]@{ vendorTenants = [pscustomobject]@{ a = 'acme' } }
        (Resolve-DEVendorUrl -Vendor $v -Kind tenant -ClientProfile $p2).missing | Should -Be @('b')
    }
}

Describe 'Secret vault, device trust and PDF helpers' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'loads secrets from a SecretManagement vault into memory and redacts them' {
        function global:Get-Secret { param($Name, $Vault) if ($Name -eq 'JC_API_KEY') { return (ConvertTo-SecureString 'jcapikeyfromvault0123456789' -AsPlainText -Force) } throw "secret $Name was not found" }
        try {
            $rows = Import-DESecretsFromVault -Vault 'DE' -Names @('JC_API_KEY', 'S1_SITE_TOKEN')
            ($rows | Where-Object { $_.name -eq 'JC_API_KEY' }).status | Should -Be 'loaded'
            ($rows | Where-Object { $_.name -eq 'S1_SITE_TOKEN' }).status | Should -Be 'missing'
            Test-DESecret -Name 'JC_API_KEY' | Should -Be $true
            (Protect-DEText 'key jcapikeyfromvault0123456789') | Should -Not -Match 'jcapikeyfromvault'
        } finally { Remove-Item Function:\Get-Secret -ErrorAction SilentlyContinue; Clear-DESecrets }
    }
    It 'registers the device-trust check only when the client profile asks for it' {
        $p = New-DEClientProfileTemplate -Id 'dt' -Name 'DT'
        Register-DEJumpCloudActions -ClientProfile $p
        { Get-DEAction -Id 'jumpcloud.device-trust' } | Should -Throw
        $p.identity.jumpcloudDeviceTrust = $true
        Register-DEJumpCloudActions -ClientProfile $p
        (Get-DEAction -Id 'jumpcloud.device-trust').Module | Should -Be 'jumpcloud'
    }
    It 'device trust state never throws and reports no certificate off Windows' {
        $t = Get-DEDeviceTrustState
        if ($env:OS -ne 'Windows_NT') { $t.certificatePresent | Should -Be $false }
    }
    It 'PDF conversion degrades to nothing instead of failing' {
        $h = Join-Path ([IO.Path]::GetTempPath()) 'de-pdf-test.html'; Set-Content -LiteralPath $h -Value '<p>x</p>'
        { Convert-DEHtmlToPdf -HtmlPath $h -PdfPath ($h + '.pdf') -TimeoutSeconds 20 } | Should -Not -Throw
    }
}

Describe 'Background jobs (the path every console button uses)' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'runs discovery in a runspace and returns the snapshot, evidence and context' {
        $j = Start-DEBackgroundJob -Work { Get-DEDiscoverySnapshot -SkipApps -SkipUpdates -SkipConnectivity } -Params @{ quick = $true }
        $null = $j.handle.AsyncWaitHandle.WaitOne(180000)
        $d = Complete-DEBackgroundJob -Job $j
        $d.failure | Should -BeNullOrEmpty
        $d.ok | Should -Be $true
        $d.result['out'] | Should -Not -BeNullOrEmpty
        $d.result['out']['device'] | Should -Not -BeNullOrEmpty
    }
    It 'runs a full takeover audit for the Alamo profile in a runspace' {
        $j = Start-DEBackgroundJob -Work { $null = Invoke-DEAudit -Mode $JobMode; @(Get-DEEvidence).Count } -ProfileId 'alamo' -Mode 'takeover'
        $null = $j.handle.AsyncWaitHandle.WaitOne(300000)
        $d = Complete-DEBackgroundJob -Job $j
        $d.failure | Should -BeNullOrEmpty
        [int]$d.result['out'] | Should -BeGreaterThan 20
    }
    It 'reports a failing job with its real error instead of an empty result' {
        $j = Start-DEBackgroundJob -Work { throw 'discovery exploded on purpose' }
        $null = $j.handle.AsyncWaitHandle.WaitOne(60000)
        $d = Complete-DEBackgroundJob -Job $j
        $d.ok | Should -Be $false
        $d.failure | Should -Match 'exploded on purpose'
    }
}

Describe 'File encoding (Windows PowerShell 5.1 reads BOM-less files as ANSI)' {
    It 'every PowerShell file with non-ASCII characters starts with a UTF-8 BOM' {
        $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $bad = @()
        foreach ($f in @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Extension -in @('.ps1', '.psm1', '.psd1') })) {
            $b = [IO.File]::ReadAllBytes($f.FullName)
            $bom = $b.Length -ge 3 -and $b[0] -eq 0xEF -and $b[1] -eq 0xBB -and $b[2] -eq 0xBF
            if (-not $bom -and @($b | Where-Object { $_ -gt 127 }).Count) { $bad += $f.Name }
        }
        $bad | Should -BeNullOrEmpty
    }
}

Describe 'Package detection with the Windows code path forced on' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole; & (Get-Module DE.Apps) { $script:SavedWin = $script:IsWindowsHost; $script:IsWindowsHost = $true } }
    AfterAll { & (Get-Module DE.Apps) { $script:IsWindowsHost = $script:SavedWin } }
    It 'detects every catalog package without throwing (packages with no registry rules included)' {
        foreach ($p in Get-DEPackages) { { $null = Test-DEPackageInstalled -Package $p -Apps @() } | Should -Not -Throw }
    }
    It 'reads the cloud-storage standard for Alamo without throwing' {
        { $null = Get-DECloudStorageState -ClientProfile (Get-DEClientProfile -Id 'alamo') } | Should -Not -Throw
    }
}

Describe 'Audit without runtime secrets' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'reports a check that needs a missing secret as not verified (WARN), never FAIL' {
        Clear-DESecrets
        Register-DEAction -Id 'a.needs-secret' -Module 'test' -Title 'Needs JC key' -RequiresSecrets @('JC_API_KEY') -Detect { throw 'would call the API' } -Desired { @{ v = 1 } }
        $e = Invoke-DEAction -Id 'a.needs-secret' -Mode Audit
        $e.result | Should -Be 'WARN'
        $e.verification | Should -Match 'JC_API_KEY'
    }
}

Describe 'Console integrity on a clean, unsigned copy' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'never reads as tampered and only inspects PowerShell files' {
        $root = Split-Path -Parent $PSScriptRoot
        $i = Test-DEConsoleIntegrity -Root $root
        $i.status | Should -Not -Be 'tampered' -Because (($i.problems | Select-Object -First 5) -join '; ')
        $scripts = @(Get-ChildItem -LiteralPath $root -Recurse -File | Where-Object { $_.Extension -in @('.ps1', '.psm1', '.psd1') }).Count
        $i.files | Should -Be $scripts
    }
}

Describe 'Loading a client plan (the "Use this client and mode" button)' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $null = Initialize-TestConsole }
    It 'says to choose a client before any plan exists, not that everything is done' {
        (Get-DENextAction -Mode 'takeover').title | Should -Be 'Choose a client and mode'
    }
    It 'builds the plan without scanning the machine (fast, safe on the window thread)' {
        & (Get-Module DE.Apps) { $script:SavedWin2 = $script:IsWindowsHost; $script:IsWindowsHost = $true }
        try {
            Mock -ModuleName DE.Apps Test-DEPackageInstalled { throw 'machine scan during plan registration' }
            Mock -ModuleName DE.Apps Get-DECloudStorageState { throw 'machine scan during plan registration' }
            $p = Get-DEClientProfile -Id 'alamo'
            $p.cloudStorage.removeConflicting = $true
            $ids = @(Initialize-DEWorkflow -ClientProfile $p -Mode 'takeover')
            $ids.Count | Should -BeGreaterThan 60
            $ids | Should -Contain 'apps.remove.dropbox'
        } finally { & (Get-Module DE.Apps) { $script:IsWindowsHost = $script:SavedWin2 } }
    }
    It 'asks for an audit when the plan exists but nothing has run' {
        Clear-DEEvidence
        (Get-DENextAction -Mode 'takeover').title | Should -Not -Be 'All actions for this mode are in desired state'
    }
}
