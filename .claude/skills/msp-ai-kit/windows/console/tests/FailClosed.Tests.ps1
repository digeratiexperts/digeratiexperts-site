# Move 16: "Mutation-test the licence and fail-closed paths" (#734).
#
# These pin the behaviours windows/tests/Invoke-MutationCheck.ps1 mutates: every break it applies
# must make one of these fail. The mutation run is the judge - a SURVIVED mutant means a test here
# (or in the suite it names) is too weak to notice the break. Each refusal case is paired with its
# positive half first, so a mock that refuses nothing cannot make the refusal pass vacuously.
#
# Why edges and not happy paths: the licence and gate code fail closed on purpose - a check that
# throws, answers nothing, invents a status or names an unknown gate must read BLOCKED, and no
# approval may open a -NoException safety gate. Those are exactly the lines a future edit flips by
# accident, and nothing else in the suite asserted them.

Describe 'Fail closed: the licence and the gates refuse rather than allow' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:Fct = @{ Dir = Initialize-TestConsole }
    }
    AfterAll { Set-DELicensePolicyOverride $null }

    Context 'the licence refuses when it must' {
        It 'policy required refuses an unlicensed feature outright' {
            Set-DELicensePolicyOverride ([pscustomobject]@{ enforce = 'required'; maxTechnicianHours = 12; maxOrderDays = 45; clockSkewMinutes = 5; issuer = 'de-hub'; audience = 'de-techtool' })
            Mock -ModuleName DE.License Get-DELicenseStatus { [pscustomobject]@{ state = 'unlicensed'; valid = $false; reason = 'no licence on this device'; technician = $null; clients = @(); features = @(); expires = $null; id = $null; enforce = 'required'; build = 'dev' } }
            $r = Test-DELicenseFor -Feature 'apply'
            $r.ok | Should -Be $false -Because 'policy required must refuse an unlicensed apply'
            $r.licensed | Should -Be $false
            $r.reason | Should -Match 'UNLICENSED'
        }
        It 'a licence without the feature refuses that feature and allows the one it has' {
            Set-DELicensePolicyOverride ([pscustomobject]@{ enforce = 'required'; maxTechnicianHours = 12; maxOrderDays = 45; clockSkewMinutes = 5; issuer = 'de-hub'; audience = 'de-techtool' })
            Mock -ModuleName DE.License Get-DELicenseStatus { [pscustomobject]@{ state = 'licensed'; valid = $true; reason = ''; technician = 'dana'; clients = @('*'); features = @('apply'); expires = '2026-11-30T00:00:00Z'; id = 'jti-1'; enforce = 'required'; build = 'dev' } }
            (Test-DELicenseFor -Feature 'apply').ok | Should -Be $true -Because 'the positive half keeps the refusal honest'
            $r = Test-DELicenseFor -Feature 'toolbox'
            $r.ok | Should -Be $false -Because "a licence that grants only 'apply' must refuse 'toolbox'"
            $r.reason | Should -Match "does not include 'toolbox'"
        }
        It 'a licence for other clients refuses the client and allows its own' {
            Set-DELicensePolicyOverride ([pscustomobject]@{ enforce = 'required'; maxTechnicianHours = 12; maxOrderDays = 45; clockSkewMinutes = 5; issuer = 'de-hub'; audience = 'de-techtool' })
            Mock -ModuleName DE.License Get-DELicenseStatus { [pscustomobject]@{ state = 'licensed'; valid = $true; reason = ''; technician = 'dana'; clients = @('Acme'); features = @('*'); expires = '2026-11-30T00:00:00Z'; id = 'jti-2'; enforce = 'required'; build = 'dev' } }
            (Test-DELicenseFor -Feature 'apply' -Client 'Acme').ok | Should -Be $true -Because 'the positive half keeps the refusal honest'
            $r = Test-DELicenseFor -Feature 'apply' -Client 'Northwind'
            $r.ok | Should -Be $false -Because "a licence for 'Acme' must refuse client 'Northwind'"
            $r.reason | Should -Match "client 'Northwind'"
        }
        It 'an invalid licence never reads as licensed under policy required' {
            Set-DELicensePolicyOverride ([pscustomobject]@{ enforce = 'required'; maxTechnicianHours = 12; maxOrderDays = 45; clockSkewMinutes = 5; issuer = 'de-hub'; audience = 'de-techtool' })
            Mock -ModuleName DE.License Get-DELicenseStatus { [pscustomobject]@{ state = 'expired'; valid = $false; reason = 'the licence expired'; technician = 'dana'; clients = @('*'); features = @('*'); expires = '2026-01-01T00:00:00Z'; id = 'jti-3'; enforce = 'required'; build = 'dev' } }
            $r = Test-DELicenseFor -Feature 'apply'
            $r.ok | Should -Be $false -Because 'an invalid licence is a reason to refuse, whatever it grants'
            $r.reason | Should -Match 'UNLICENSED: the licence expired'
        }
    }

    Context 'a change is refused while unlicensed' {
        It 'Assert-DEStorageWrite throws Licence refused when the licence says no' {
            Set-DEMode -Mode Apply
            try {
                Mock -ModuleName DE.Storage Test-DELicenseFor { [pscustomobject]@{ ok = $false; licensed = $false; reason = 'UNLICENSED: no licence on this device' } }
                (Get-DEThrown { InModuleScope DE.Storage { Assert-DEStorageWrite } }) | Should -Match 'Licence refused'
            } finally { Set-DEMode -Mode Audit }
        }
    }

    Context 'a gate can never fail open' {
        It 'a check that throws reads BLOCKED, and says the check failed' {
            Register-DEGate -Id 'gate.m16.throw' -Title 'throwing' -Check { throw 'boom' }
            $g = Test-DEGate -Id 'gate.m16.throw' -Refresh
            $g.Status | Should -Be 'BLOCKED' -Because 'a gate that cannot answer must block'
            $g.Detail | Should -Match 'gate check failed'
        }
        It 'a check that returns nothing reads BLOCKED' {
            Register-DEGate -Id 'gate.m16.nothing' -Title 'silent' -Check { }
            (Test-DEGate -Id 'gate.m16.nothing' -Refresh).Status | Should -Be 'BLOCKED' -Because 'a gate that answers nothing must block'
        }
        It 'a check that invents a status reads BLOCKED' {
            Register-DEGate -Id 'gate.m16.garbage' -Title 'garbage' -Check { @{ Status = 'NONSENSE'; Detail = 'x' } }
            (Test-DEGate -Id 'gate.m16.garbage' -Refresh).Status | Should -Be 'BLOCKED' -Because 'only PASS, WARN, BLOCKED and READY are real statuses'
        }
        It 'an unregistered gate id reads BLOCKED' {
            $g = Test-DEGate -Id 'gate.m16.not-registered'
            $g.Status | Should -Be 'BLOCKED' -Because 'a gate nobody registered can never be satisfied'
            $g.Detail | Should -Match 'gate not registered'
        }
        It 'no approval opens a -NoException safety gate, not even a hand-edited exception file' {
            Register-DEGate -Id 'gate.m16.safety' -Title 'safety' -Check { @{ Status = 'BLOCKED'; Detail = 'wrong device' } } -NoException
            Register-DEGate -Id 'gate.m16.normal' -Title 'normal' -Check { @{ Status = 'BLOCKED'; Detail = 'needs work' } }
            # the first layer: an exception for a safety gate cannot even be recorded
            (Get-DEThrown { Add-DEException -Target 'gate.m16.safety' -Reason 'approved anyway' -Approver 'Joe' -ExpiresOn (Get-Date).AddDays(2) }) | Should -Match 'safety gate'
            # the second layer: even a hand-edited exceptions store must not open the gate
            InModuleScope DE.Core { $script:DE.Exceptions['gate.m16.safety'] = [pscustomobject]@{ target = 'gate.m16.safety'; reason = 'approved anyway'; approver = 'Joe'; technician = ''; created = (Get-Date).ToString('o'); expiresOn = (Get-Date).AddDays(2).ToString('o'); remediation = '' } }
            $g = Test-DEGate -Id 'gate.m16.safety' -Refresh
            $g.Status | Should -Be 'BLOCKED' -Because 'a safety gate must stay blocked however the approval arrived'
            $g.Status | Should -Not -Be 'EXCEPTION'
            Add-DEException -Target 'gate.m16.normal' -Reason 'approved anyway' -Approver 'Joe' -ExpiresOn (Get-Date).AddDays(2) | Out-Null
            (Test-DEGate -Id 'gate.m16.normal' -Refresh).Status | Should -Be 'EXCEPTION' -Because 'the positive half proves the exception mechanism is exactly what the safety gate refuses'
        }
        It 'Test-DEGatesSatisfied refuses while any gate is not PASS or EXCEPTION' {
            Register-DEGate -Id 'gate.m16.blocked' -Title 'b' -Check { @{ Status = 'BLOCKED'; Detail = 'no' } }
            Register-DEGate -Id 'gate.m16.open' -Title 'o' -Check { @{ Status = 'PASS'; Detail = 'ok' } }
            $s = Test-DEGatesSatisfied -Ids @('gate.m16.blocked', 'gate.m16.open')
            $s.Ok | Should -Be $false -Because 'one blocked gate is enough to refuse'
            @($s.Failing).Count | Should -Be 1
            (Test-DEGatesSatisfied -Ids @('gate.m16.open')).Ok | Should -Be $true -Because 'the positive half keeps the refusal honest'
        }
    }

    Context 'integrity: a change is found, not waved through' {
        It 'a console file changed since packaging reads tampered, a matching one does not' {
            $base = Join-Path $global:Fct.Dir 'integrity-m16-changed'; $root = Join-Path $base 'console'
            New-Item -ItemType Directory -Path $root -Force | Out-Null
            # a realistic script body: a BOM-less file containing bare '1' makes the Authenticode
            # parser report UnknownError, which reads as tampering and would drown the manifest check
            Set-Content -LiteralPath (Join-Path $root 'a.ps1') -Value 'Write-Output 1'
            $good = (Get-FileHash -LiteralPath (Join-Path $root 'a.ps1') -Algorithm SHA256).Hash.ToLowerInvariant()
            Set-Content -LiteralPath (Join-Path $base 'integrity.json') -Value ('{"files":[{"path":"console/a.ps1","sha256":"' + $good + '"}]}')
            $clean = Test-DEConsoleIntegrity -Root $root
            $clean.status | Should -Not -Be 'tampered' -Because 'a file matching the manifest must read clean (unsigned, but clean)'
            Set-Content -LiteralPath (Join-Path $base 'integrity.json') -Value '{"files":[{"path":"console/a.ps1","sha256":"00"}]}'
            $i = Test-DEConsoleIntegrity -Root $root
            $i.status | Should -Be 'tampered' -Because 'a file changed since packaging is tampering'
            ($i.problems -join ' ') | Should -Match 'changed since packaging'
        }
        It 'a console file another process holds open reads tampered, not unknown' {
            $base = Join-Path $global:Fct.Dir 'integrity-m16-unreadable'; $root = Join-Path $base 'console'
            New-Item -ItemType Directory -Path $root -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $root 'a.ps1') -Value 'Write-Output 1'
            $good = (Get-FileHash -LiteralPath (Join-Path $root 'a.ps1') -Algorithm SHA256).Hash.ToLowerInvariant()
            Set-Content -LiteralPath (Join-Path $base 'integrity.json') -Value ('{"files":[{"path":"console/a.ps1","sha256":"' + $good + '"}]}')
            Mock -ModuleName DE.Core Get-DEFileSha256 { throw 'The process cannot access the file because it is being used by another process.' }
            $i = Test-DEConsoleIntegrity -Root $root
            $i.status | Should -Be 'tampered' -Because 'an unreadable file is a finding, never a shrug'
            ($i.problems -join ' ') | Should -Match 'unreadable'
        }
    }
}

# Move 17: "Audit every 'policy warn' path for fail-open risk" (#735).
#
# The audit found three places where the licence policy could relax itself without anyone noticing:
# a missing trust\license-policy.json fell back to the permissive default even on a real build, and a
# malformed policy or keys file threw instead of being read as absent. A release that loses a config
# file must fail closed, not quietly become permissive.
#
# The permissive default is deliberate for a development checkout - License.Tests.ps1 asserts it -
# so the fix keys on whether the build carries a watermark.

Describe 'Fail closed: a missing or broken policy never relaxes a real build' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $dir = Initialize-TestConsole
        $global:Pol = @{ Dir = $dir; Empty = (Join-Path $dir 'empty-trust'); Broken = (Join-Path $dir 'broken-trust') }
        New-Item -ItemType Directory -Path $global:Pol.Empty -Force | Out-Null
        New-Item -ItemType Directory -Path $global:Pol.Broken -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $global:Pol.Broken 'license-policy.json') -Value '{ this is not json'
        Set-Content -LiteralPath (Join-Path $global:Pol.Broken 'license-keys.json') -Value 'not json at all'
    }
    AfterAll { Set-DELicensePolicyOverride $null }

    It 'a development checkout with no policy keeps the permissive default' {
        Set-DELicensePolicyOverride $null
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Empty }
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'dev'; builtAt = $null; issuedTo = 'development checkout'; channel = 'dev' } }
        (Get-DELicensePolicy).enforce | Should -Be 'warn' -Because 'a dev checkout is meant to run unlicensed'
    }

    It 'a real build with no policy fails closed instead' {
        # the fail-open risk this move exists for: a release whose policy file went missing must not
        # silently become permissive
        Set-DELicensePolicyOverride $null
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Empty }
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'DE-1.11.0-20261027-abc123'; builtAt = '2026-10-27'; issuedTo = 'test-tech'; channel = 'release' } }
        (Get-DELicensePolicy).enforce | Should -Be 'required' -Because 'a build with a watermark must never fall back to permissive'
    }

    It 'a readable policy still wins over the build default' {
        Set-DELicensePolicyOverride $null
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Broken }
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'DE-1.11.0-20261027-abc123'; builtAt = $null; issuedTo = 'test-tech'; channel = 'release' } }
        # Broken holds unparseable files, so there is no readable policy and the build default applies
        (Get-DELicensePolicy).enforce | Should -Be 'required'
    }

    It 'a malformed policy is read as absent, never as a throw' {
        Set-DELicensePolicyOverride $null
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Broken }
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'dev'; builtAt = $null; issuedTo = 'development checkout'; channel = 'dev' } }
        # try/catch, not { ... } | Should -Not -Throw: a scriptblock runs in its own scope, so the
        # assignment would never escape and the assertion would pass while proving nothing
        $pol = $null
        $threw = $false
        try { $pol = Get-DELicensePolicy } catch { $threw = $true }
        $threw | Should -Be $false -Because 'malformed policy is read as absent, not as a crash'
        $pol | Should -Not -BeNullOrEmpty
        $pol.enforce | Should -Be 'warn'
    }

    It 'a malformed key file yields no keys instead of throwing' {
        # the extras a test may have registered are legitimate; what matters is that the broken file
        # contributes nothing and nothing throws. Compare against the same module with no file at all.
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Empty }
        $baseline = @(Get-DELicenseTrustedKeys).Count
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Broken }
        $keys = $null
        $threw = $false
        try { $keys = @(Get-DELicenseTrustedKeys) } catch { $threw = $true }
        $threw | Should -Be $false -Because 'a malformed key file must not crash the licence check'
        @($keys).Count | Should -Be $baseline -Because 'the broken file must contribute nothing'
    }

    It 'the fallback is warned about, once, rather than happening silently' {
        Set-DELicensePolicyOverride $null
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:Pol.Empty }
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'DE-1.11.0-20261027-abc123'; builtAt = $null; issuedTo = 'test-tech'; channel = 'release' } }
        $log = (Get-DEConsole).LogFile
        $before = (Get-Content -LiteralPath $log -Raw)
        $null = Get-DELicensePolicy
        $null = Get-DELicensePolicy
        $after = (Get-Content -LiteralPath $log -Raw)
        $added = $after.Substring($before.Length)
        $added | Should -Match 'license-policy.json is missing or unreadable' -Because 'a silent fallback is the thing this move is about'
        ([regex]::Matches($added, 'license-policy.json is missing or unreadable')).Count | Should -Be 1 -Because 'once, not on every check'
        $added | Should -Match 'fails closed'
    }
}
