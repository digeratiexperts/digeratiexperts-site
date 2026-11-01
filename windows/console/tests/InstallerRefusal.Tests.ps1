# Move 47: "Test the refusal path for each mismatch type" (#765).
#
# The matrix behind R3/R4/R5/R8/R9: every way a file can fail the trust policy, driven through the
# real technician surface - Invoke-DEPackageInstall, the one entry point a playbook or button uses -
# and each refusal checked for the same three properties: it throws, the message says what happened
# in the R3 shape (both hashes where a hash is involved), and no override can open a hard refusal.
# Every refusal case is paired with its positive half so a mock that refuses nothing cannot make a
# case pass vacuously.
#
# Where signatures are involved the states are mocked (a chain-trusted 'Valid' cannot be minted in a
# test); the absent-signature direction runs against a real unsigned file. The package and directory
# mocks read $global:M47 because a mock body executes after its defining scope is gone - a closure
# over a helper's parameter is null by the time the mock runs.

Describe 'Every mismatch type is refused the same way (move 47)' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:M47 = @{ Dir = Initialize-TestConsole }
        $global:M47.Local = Join-Path $global:M47.Dir 'staged.msi'
        Set-Content -LiteralPath $global:M47.Local -Value 'staged installer bytes'
        $global:M47.Hash = Get-DEFileSha256 -Path $global:M47.Local
        Mock -ModuleName DE.Apps Get-DEPackage { $global:M47.Case }
        Mock -ModuleName DE.Apps Get-DELocalPackagesDir { $global:M47.PkgDir }
    }

    Context 'the install path refuses every mismatch type' {
        It '1. url hash mismatch: refused with both hashes, the download deleted, and no override opens it' {
            $dir = Join-Path $global:M47.Dir 'c1'
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            $cached = Join-Path $dir 'poison.msi'
            Set-Content -LiteralPath $cached -Value 'poisoned'
            $poison = Get-DEFileSha256 -Path $cached
            $global:M47.PkgDir = $dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'url'; url = 'https://example.com/poison.msi'; sha256 = ('a' * 64); sha256From = 'test' } }
            $m = Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' -AllowUnverified -OverrideReason 'checked by hand' }
            $m | Should -Match 'trust policy refused'
            $m | Should -Match ('have ' + $poison)
            $m | Should -Match ('want ' + ('a' * 64))
            $m | Should -Match 'deleted'
            $m | Should -Match 'not overridable'
            Test-Path -LiteralPath $cached | Should -Be $false
        }
        It '2. local hash mismatch: refused with both hashes and the DE-supplied file kept' {
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi'; publisher = 'Some Vendor'; sha256 = ('a' * 64); sha256From = 'test' } }
            $m = Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' }
            $m | Should -Match ('have ' + $global:M47.Hash)
            $m | Should -Match ('want ' + ('a' * 64))
            $m | Should -Not -Match 'deleted' -Because 'a DE-supplied file is evidence and stays for inspection'
            Test-Path -LiteralPath $global:M47.Local | Should -Be $true
        }
        It '3. broken signature where the vendor signs: refused and not overridable' {
            Mock -ModuleName DE.Core Test-DEAuthenticode { [pscustomobject]@{ Ok = $false; Status = 'HashMismatch'; Publisher = 'CN=Some Vendor'; Detail = '' } }
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi'; publisher = 'Some Vendor'; vendorSigns = $true; sha256 = $global:M47.Hash; sha256From = 'test' } }
            $m = Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' -AllowUnverified -OverrideReason 'checked by hand' }
            $m | Should -Match 'signature'
            $m | Should -Match 'not overridable'
        }
        It '4. absent signature where the vendor signs: refused (real unsigned file)' {
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi'; publisher = 'Some Vendor'; vendorSigns = $true; sha256 = $global:M47.Hash; sha256From = 'test' } }
            $m = Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' }
            $m | Should -Match 'signature'
            $m | Should -Match 'NotSigned|UnknownError|Error' -Because 'the exact status varies by host; the refusal is the contract'
        }
        It '5. wrong publisher: refused even when the signature status is Valid' {
            Mock -ModuleName DE.Core Test-DEAuthenticode { [pscustomobject]@{ Ok = $false; Status = 'Valid'; Publisher = 'CN=Not The Vendor'; Detail = '' } }
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi'; publisher = 'Some Vendor'; vendorSigns = $true; sha256 = $global:M47.Hash; sha256From = 'test' } }
            (Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' }) | Should -Match 'signature'
        }
        It '6. no hash and no publisher: refused; with a reason it runs as WARN, never as PASS' {
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi' }; install = @{ type = 'msi'; args = ''; timeoutSeconds = 60; successExitCodes = @(0) } }
            $m = Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' }
            $m | Should -Match 'neither sha256 nor publisher'
            # the override path: recorded as WARN evidence, and the refusal is not dressed up as a pass
            Mock -ModuleName DE.Apps Add-DEEvidence { }
            $r = Invoke-DEPackageInstall -Id 'm47-case' -AllowUnverified -OverrideReason 'checked by Dana 2026-11-01 against the vendor portal' -WhatIf
            $r.planned | Should -Be $true -Because 'the install proceeds only as a plan under -WhatIf'
            Assert-MockCalled -ModuleName DE.Apps Add-DEEvidence -Times 1 -ParameterFilter { $Result -eq 'WARN' -and $ActionTaken -match 'checked by Dana' }
        }
        It '7. non-HTTPS source: refused before any download' {
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'url'; url = 'http://example.com/x.msi'; sha256 = ('a' * 64); sha256From = 'test' } }
            (Get-DEThrown { Invoke-DEPackageInstall -Id 'm47-case' }) | Should -Match 'non-HTTPS'
        }
        It '8. community file mismatch: refused with both hashes and the pinned commit' {
            Mock -ModuleName DE.Community Invoke-DECommunityDownload { Set-Content -LiteralPath $OutFile -Value 'tampered' -NoNewline }
            $m = Get-DEThrown { Invoke-DECommunityScript -Key 'limehawk-rmm-scripts/print-queue-reset' -Confirm:$false -Force }
            $m | Should -Match 'does not match the reviewed sha256'
            $m | Should -Match 'have [0-9a-f]{64}'
            $m | Should -Match 'want [0-9a-f]{64}'
            $m | Should -Match 'pinned commit'
        }
    }

    Context 'the positive halves keep the refusals honest' {
        It 'a file that matches every claim proceeds to the planned install' {
            $global:M47.PkgDir = $global:M47.Dir
            $global:M47.Case = @{ id = 'm47-case'; name = 'M47 Case'; source = @{ type = 'local'; localPath = 'staged.msi'; sha256 = $global:M47.Hash; sha256From = 'test' }; install = @{ type = 'msi'; args = ''; timeoutSeconds = 60; successExitCodes = @(0) } }
            $r = Invoke-DEPackageInstall -Id 'm47-case' -WhatIf
            $r.planned | Should -Be $true
        }
        It 'winget sources are honestly unverified (R8), never dressed up as hash-verified' {
            $r = Get-DEPackageFile -Package @{ id = 'm47-winget'; name = 'M47 Winget'; source = @{ type = 'winget'; id = 'Some.Package' } }
            $r.trust.Ok | Should -Be $true
            $r.winget | Should -Be 'Some.Package'
            "$($r.trust.Sha256)" | Should -BeNullOrEmpty -Because 'R8: the tool never pretends to have seen a hash it never saw'
        }
    }
}
