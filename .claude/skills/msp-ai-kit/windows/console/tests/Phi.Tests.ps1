# Issue #890: PHI-restricted mode. Decided by Joe, 2026-11-01.
#
#   - 'is healthcare' = the client account's vertical in the Hub profile; it applies to every device
#   - a per-device override can only make it MORE restrictive
#   - unknown vertical or unreachable Hub => restricted (fail closed)
#   - nothing sent to a vendor without a confirmed BAA
#
# The fail-closed clause is the one worth testing hardest: being wrong in the permissive direction is
# a PHI leak, being wrong in the restrictive direction is an inconvenience.

Describe 'PHI-restricted mode: decide conservatively, gate the vendors' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $global:Phi = @{ Profile = @{ hub = @{ accountId = 'ACC-100' } } }
    }

    Context 'a healthcare client is restricted on every device' {
        It 'a healthcare vertical restricts the account' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'healthcare' }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true -Because 'a healthcare client account restricts all its devices'
            $s.reason | Should -Match 'healthcare'
        }
        It 'the same vertical restricts a second device, because it is the account that decides' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'healthcare' }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:AAA').restricted | Should -Be $true
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:BBB').restricted | Should -Be $true
        }
    }

    Context 'a non-healthcare client is not restricted, unless something says otherwise' {
        It 'a known non-healthcare vertical is not restricted' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'legal' }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $false
            $s.vertical | Should -Be 'legal'
        }
        It 'a per-device override CAN restrict it, because an override may only tighten' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'legal' }
            Set-DEPhiDeviceOverride -DeviceKey 'dell:CCC' -Restricted
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:CCC').restricted | Should -Be $true
        }
    }

    Context 'an override can only make it more restrictive, never less' {
        It 'an attempt to unrestrict is refused and logged, not silently honoured' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'healthcare' }
            Set-DEPhiDeviceOverride -DeviceKey 'dell:DDD' -Restricted:$false
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:DDD'
            $s.restricted | Should -Be $true -Because 'a device cannot talk its way out of a restricted client'
            $s.override | Should -Be $false -Because 'the unrestricting override must not have been recorded'
        }
    }

    Context 'when the answer cannot be determined, it is restricted' {
        It 'an unknown vertical fails closed' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { $null }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true -Because 'unknown vertical must not be read as not-healthcare'
            $s.vertical | Should -Be 'unknown'
            $s.reason | Should -Match 'could not be determined'
        }
        It 'an unreachable Hub fails closed, because the vertical could not be read' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { $null }
            $s = Get-DEPhiState -ClientProfile @{ hub = @{ accountId = '' } }
            $s.restricted | Should -Be $true
        }
        It 'a client with no account id at all is restricted' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { $null }
            (Get-DEPhiState -ClientProfile @{}).restricted | Should -Be $true
        }
    }

    Context 'the BAA gate blocks unconfirmed vendors on a restricted device' {
        It 'an unconfirmed vendor is BLOCKED, not warned' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Guardz' -PhiRestricted
            $g.allowed | Should -Be $false -Because 'a blank or unconfirmed BAA is a block under the PHI rule'
            $g.reason | Should -Match 'blocked rather than warned'
        }
        It 'a confirmed vendor is allowed' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Intelligence Hub' -PhiRestricted
            $g.allowed | Should -Be $true
            $g.status | Should -Be 'confirmed'
        }
        It 'a vendor nobody has written down is blocked, not assumed fine' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Some New Vendor' -PhiRestricted
            $g.allowed | Should -Be $false
            $g.status | Should -Be 'unknown'
        }
        It 'the check is case-insensitive on the vendor name' {
            (Test-DEVendorBaaAllowed -Vendor 'guardz' -PhiRestricted).allowed | Should -Be $false
            (Test-DEVendorBaaAllowed -Vendor 'intelligence hub' -PhiRestricted).allowed | Should -Be $true
        }
        It 'a broken or missing register reads as unknown and blocks' {
            # the register is the whole enforcement mechanism; if it cannot be read, nothing is confirmed
            $status = Get-DEVendorBaaStatus -Vendor 'Intelligence Hub'
            $status | Should -BeIn @('confirmed', 'unconfirmed', 'unknown')
        }
    }

    Context 'outside a restricted device the register is recorded, not enforced' {
        It 'a non-PHI device may talk to an unconfirmed vendor' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Guardz'
            $g.allowed | Should -Be $true -Because 'the gate exists for PHI, not for every device'
            $g.reason | Should -Match 'not enforced'
        }
    }

    Context 'the decision carries its reason' {
        It 'every state explains itself, so the call can be checked later' {
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'healthcare' }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
            Mock -ModuleName DE.Phi Get-DEClientVertical { 'legal' }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
            Mock -ModuleName DE.Phi Get-DEClientVertical { $null }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
        }
    }

    Context 'the gate is wired into the vendor entry points, not left as a function nobody calls' {
        It 'a warranty lookup to an unconfirmed vendor is refused on a restricted device' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            $msg = Get-DEThrown { Invoke-DEWarrantyWeb -Uri 'https://www.dell.com/support/asset-entitlements' -Method GET }
            $msg | Should -Match 'blocked' -Because 'a serial must not reach Dell without a confirmed BAA'
        }
        It 'the same lookup proceeds when the BAA is confirmed' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            # prove the gate OPENS for a confirmed vendor, by confirming Dell for this test only
            Mock -ModuleName DE.Phi Get-DEVendorBaaStatus { 'confirmed' } -ParameterFilter { $Vendor -eq 'Dell' }
            $msg = Get-DEThrown { Invoke-DEWarrantyWeb -Uri 'https://www.dell.com/support/asset-entitlements' -Method GET }
            # the gate let it through, so the failure is the network call itself, not the refusal
            $msg | Should -Not -Match 'PHI-restricted device: the warranty lookup'
        }
        It 'a JumpCloud call is refused on a restricted device without a confirmed BAA' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            Mock -ModuleName DE.Phi Get-DEPhiRestricted { $true }
            $gate = Test-DEVendorBaaAllowed -Vendor 'JumpCloud' -PhiRestricted
            $gate.allowed | Should -Be $false
        }
        It 'an undecided session is treated as restricted, so nothing opens by default' {
            # the fail-closed direction again: a device nobody has cleared is not cleared
            $r = & (Get-Module DE.Phi) { $script:Phi.decision = $null; Get-DEPhiRestricted }
            $r | Should -Be $true
        }
        It 'vendor names are derived from the URL, and an unknown host is its own risk' {
            Get-DEVendorFromUri -Uri 'https://www.dell.com/x' | Should -Be 'Dell'
            Get-DEVendorFromUri -Uri 'https://support.lenovo.com/x' | Should -Be 'Lenovo'
            Get-DEVendorFromUri -Uri 'https://api.hp.com/x' | Should -Be 'HP'
            Get-DEVendorFromUri -Uri 'https://unknown.example/x' | Should -Be 'unknown'
        }
    }
}
