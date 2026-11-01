# Move 86 (issue 804): Alamo-only client branding, enforced by these tests. The shipped package carries
# one client's branding - Alamo's - and these tests are the enforcement: a second client's assets or a
# profile pointing at one fails CI here instead of shipping someone else's logo to a client. A missing
# client logo falls back to DE branding, never to another client's.
# Compatible with Pester 4.10 and 5.x.

Describe 'Alamo-only client branding' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $global:DEAssetsRoot = Join-Path (Join-Path $script:ConsoleRoot 'assets') 'clients'
    }
    It 'the shipped package carries Alamo branding and nothing else' {
        $dirs = @(Get-ChildItem -LiteralPath $global:DEAssetsRoot -Directory | ForEach-Object { $_.Name })
        $dirs | Should -Be @('alamo') -Because 'adding another client''s branding is a decision, not a copy-paste (architecture: Alamo-only client branding)'
        foreach ($f in @(Get-ChildItem -LiteralPath (Join-Path $global:DEAssetsRoot 'alamo') -File)) {
            $f.Name | Should -Match '^alamo-' -Because "$($f.Name) is not an Alamo asset name"
        }
    }
    It 'every shipped profile brands with Alamo assets only' {
        foreach ($p in @(Get-ChildItem -LiteralPath (Join-Path (Join-Path $script:ConsoleRoot 'catalog') 'profiles') -Filter '*.json')) {
            $prof = Get-Content -LiteralPath $p.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            foreach ($key in @('clientLogo', 'clientLogoReverse')) {
                $spec = "$($prof.branding.$key)"
                if ($spec) {
                    $spec | Should -Match '^asset:clients/alamo/' -Because "$($p.Name) brands with $key = $spec; only Alamo branding ships"
                    $leaf = Join-Path $global:DEAssetsRoot ('alamo\' + ($spec -replace '^asset:clients/alamo/', ''))
                    Test-Path -LiteralPath $leaf | Should -Be $true -Because "$($p.Name) points at $spec, which does not ship"
                }
            }
        }
    }
    It 'resolves the Alamo mark for an Alamo profile' {
        $a = Get-DEBrandingAssets -ClientProfile @{ branding = @{ clientLogo = 'asset:clients/alamo/alamo-mark.png' } } -Background '#050312'
        $a.clientLogo | Should -Match 'alamo-mark\.png$'
        $a.deLogo | Should -Not -BeNullOrEmpty -Because 'DE branding stays on every build beside the client''s'
    }
    It 'a client with no shipped logo gets DE branding only, never another client''s' {
        foreach ($spec in @('asset:clients/othercorp/othercorp-mark.png', 'missing-logo.png', '')) {
            $a = Get-DEBrandingAssets -ClientProfile @{ branding = @{ clientLogo = $spec } } -Background '#050312'
            $a.clientLogo | Should -BeNullOrEmpty -Because "an unshipped logo ($spec) must resolve to nothing, not to another client's asset"
            $a.deLogo | Should -Not -BeNullOrEmpty
        }
    }
}
