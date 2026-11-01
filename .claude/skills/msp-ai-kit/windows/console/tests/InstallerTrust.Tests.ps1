# Move 43: "Check Authenticode signatures where the vendor provides them" (#761).
#
# R4 of the installer trust policy: where the vendor signs the installer, the signature is
# verified and the signer recorded - and a broken or absent signature is treated exactly like a
# hash mismatch: a refusal, never a warning. That is what these tests pin. The interesting edge
# is the override path: -AllowUnverified may turn a soft finding into a recorded WARN, but it can
# never open a hard refusal (a hash mismatch, or a broken signature where the vendor signs).
# Before this move a broken signature WAS overridable, which is how a tampered installer could
# have been waved through with a reason attached.
#
# The signature states are mocked (a 'Valid' signature needs a chain-trusted certificate, which a
# test cannot mint on a CI runner); the refusal directions that need no certificate are exercised
# against real files.

Describe 'Authenticode where the vendor signs (move 43)' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:M43 = @{ Dir = Initialize-TestConsole }
        $global:M43.Fixture = Join-Path $global:M43.Dir 'fake-installer.msi'
        Set-Content -LiteralPath $global:M43.Fixture -Value 'not a real installer'
        $global:M43.Hash = Get-DEFileSha256 -Path $global:M43.Fixture
    }

    Context 'the catalog records its signature claims with evidence' {
        It 'vendorSigns and signatureFrom always appear together' {
            foreach ($p in Get-DEPackages) {
                $claims = [bool]$p.source.PSObject.Properties['vendorSigns']
                $evidence = [bool]"$($p.source.signatureFrom)".Trim()
                $claims | Should -Be $evidence -Because "$($p.id) must not claim the vendor signs without a signer record, nor record a signer without the claim"
            }
        }
        It 'every vendorSigns source names a publisher to match the signer against' {
            foreach ($p in Get-DEPackages) {
                if ($p.source.vendorSigns) {
                    "$($p.source.publisher)".Trim() | Should -Not -BeNullOrEmpty -Because "$($p.id) claims a signed installer, so the expected signer must be recorded"
                }
            }
        }
    }

    Context 'a broken signature where the vendor signs is a hard refusal' {
        It 'an unsigned file is refused and -AllowUnverified cannot open it' {
            $r = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'JumpCloud Inc.' -VendorSigns
            $r.Ok | Should -Be $false -Because 'R4: no signature where the vendor signs is a refusal'
            $r.Reasons -join '; ' | Should -Match 'signature'
            $r2 = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'JumpCloud Inc.' -VendorSigns -AllowUnverified
            $r2.Ok | Should -Be $false -Because 'a broken signature where the vendor signs is treated exactly like a hash mismatch: not overridable'
            $r2.Overridden | Should -Be $false -Because 'nothing was overridden: the refusal stands'
        }
        It 'a wrong publisher is refused even when the signature status is Valid' {
            Mock -ModuleName DE.Core Test-DEAuthenticode { [pscustomobject]@{ Ok = $false; Status = 'Valid'; Publisher = 'CN=Not JumpCloud Inc'; Detail = '' } }
            $r = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'JumpCloud Inc.' -VendorSigns -AllowUnverified
            $r.Ok | Should -Be $false -Because 'the signer must be the expected publisher, and a mismatch is not overridable'
        }
        It 'a HashMismatch signature is refused and not overridable' {
            Mock -ModuleName DE.Core Test-DEAuthenticode { [pscustomobject]@{ Ok = $false; Status = 'HashMismatch'; Publisher = 'CN=JumpCloud Inc'; Detail = '' } }
            $r = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'JumpCloud Inc.' -VendorSigns -AllowUnverified
            $r.Ok | Should -Be $false -Because 'R4: broken signature where the vendor signs reads exactly like a hash mismatch'
            $r.Overridden | Should -Be $false
        }
    }

    Context 'the soft path still exists where the vendor signing is not claimed' {
        It 'a valid signed matching file passes' {
            Mock -ModuleName DE.Core Test-DEAuthenticode { [pscustomobject]@{ Ok = $true; Status = 'Valid'; Publisher = 'CN=JumpCloud Inc'; Detail = '' } }
            $r = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'JumpCloud Inc.' -VendorSigns
            $r.Ok | Should -Be $true -Because 'the positive half keeps the refusal honest'
        }
        It 'an unsigned file without a vendorSigns claim is refused but overridable with a reason (the WARN path)' {
            $r = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'Some Vendor'
            $r.Ok | Should -Be $false -Because 'publisher recorded means the signature is checked'
            $r2 = Test-DEPackageTrust -Path $global:M43.Fixture -Sha256 $global:M43.Hash -Publisher 'Some Vendor' -AllowUnverified
            $r2.Ok | Should -Be $true -Because 'without a vendorSigns claim the technician override with a reason is still allowed'
            $r2.Overridden | Should -Be $true -Because 'the override is recorded as WARN, never as PASS'
        }
    }

    Context 'the install path honours the catalog claim' {
        It 'Get-DEPackageFile refuses a staged local file whose vendor signs but the file is unsigned' {
            $pkg = @{ id = 'm43-test'; name = 'M43 Test'; source = @{ type = 'local'; localPath = (Split-Path -Leaf $global:M43.Fixture); publisher = 'JumpCloud Inc.'; vendorSigns = $true; sha256 = $global:M43.Hash; sha256From = 'test' } }
            Mock -ModuleName DE.Apps Get-DELocalPackagesDir { $global:M43.Dir }
            $r = Get-DEPackageFile -Package $pkg
            $r.trust.Ok | Should -Be $false -Because 'the staged file is unsigned while the catalog says the vendor signs'
            ($r.trust.Reasons -join '; ') | Should -Match 'signature'
        }
    }
}
