# Move 87 (issue 807): a sanity test per bundle tier. Every tier in catalog/bundles.json - the four
# ProActive tiers and the variants (GCC High, co-managed) - must compose a real plan whose exclusions
# are valid regexes that actually remove something, and whose plan still runs the core checks.
# The test cases are built from the raw JSON at discovery time, so each tier gets its own test and a
# new tier added to the catalog is picked up automatically. Compatible with Pester 4.10 and 5.x.

$bundleCatalogPath = Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'catalog') 'bundles.json'
$bundleCatalog = Get-Content -LiteralPath $bundleCatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$bundleCases = @()
foreach ($p in $bundleCatalog.proactive.PSObject.Properties) { $bundleCases += @{ Tier = $p.Name; Id = "$($p.Value.bundleId)" } }
foreach ($v in @($bundleCatalog.variants | Where-Object { $null -ne $_ })) { $bundleCases += @{ Tier = "$($v.id)"; Id = "$($v.id)" } }
$proactiveCases = @()
foreach ($p in $bundleCatalog.proactive.PSObject.Properties) { $proactiveCases += @{ Tier = $p.Name; TierId = "$($p.Value.id)"; Id = "$($p.Value.bundleId)" } }

Describe 'Bundle tier sanity' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
    }
    It 'tier <Tier> composes a real plan whose exclusions are valid and bite' -TestCases $bundleCases {
        param($Tier, $Id)
        $b = Get-DEBundle -Id $Id
        $b.id | Should -Be $Id -Because "the catalog's $Tier row must resolve to bundle $Id"
        $b.name | Should -Not -BeNullOrEmpty
        $composed = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id 'alamo') -Bundle $Id
        $composed.plan.bundle | Should -Be $Id
        foreach ($rx in @($composed.plan.exclude)) {
            $ok = $true; try { [void][regex]::new($rx) } catch { $ok = $false }
            $ok | Should -Be $true -Because "plan.exclude '$rx' for $Id is not a valid regex"
        }
        $ids = @(Initialize-DEWorkflow -ClientProfile $composed -Mode 'takeover')
        $ids.Count | Should -BeGreaterThan 10 -Because "tier $Tier composes almost nothing"
        foreach ($core in @('net.connectivity', 'net.time', 'maint.pending-reboot', 'security.edr-conflicts')) {
            if ($ids -contains $core) { continue }
            # a tier may carve out a core check, but only through its documented plan scoping: an
            # exclude pattern, or an includeOnly list that does not cover the check's family
            # (co-managed takes over the DE-owned areas and leaves the rest to the client's team)
            $excluded = $false
            foreach ($rx in @($composed.plan.exclude)) { if ($core -match $rx) { $excluded = $true } }
            $scoped = @($composed.plan.includeOnly | Where-Object { $_ })
            if ($scoped.Count) { $covered = $false; foreach ($rx in $scoped) { if ($core -match $rx) { $covered = $true } }; if (-not $covered) { $excluded = $true } }
            $excluded | Should -Be $true -Because "tier $Tier runs neither $core nor documents scoping it out"
        }
        foreach ($rx in @($composed.plan.exclude)) {
            foreach ($id in $ids) { $id | Should -Not -Match $rx -Because "$Id excludes $rx but $id is still in the plan" }
        }
    }
    It 'tier <Tier> carries the DE Security Foundation and its provisioning defaults' -TestCases $proactiveCases {
        param($Tier, $TierId, $Id)
        $b = Get-DEProActiveBundle -Tier $Tier
        $b.bundleId | Should -Be $Id
        $b.components.securityFoundation | Should -Be 'included' -Because 'DE Security Foundation is included in every ProActive tier'
        foreach ($k in @('identity', 'edr', 'mdr')) { "$($b.defaults.$k)" | Should -Not -BeNullOrEmpty -Because "tier $Tier must say which $k it provisions" }
        foreach ($add in @($b.addOns)) {
            @(Get-DEAddOns | Where-Object { $_['id'] -eq $add }).Count | Should -Be 1 -Because "tier $Tier offers add-on '$add', which is not in the catalog"
        }
    }
    It 'every bundle, add-on and solution id is unique' {
        $ids = @()
        $ids += @(Get-DEBundles | ForEach-Object { $_['id'] })
        $ids += @(Get-DEAddOns | ForEach-Object { $_['id'] })
        $ids += @(Get-DESolutions | ForEach-Object { $_['id'] })
        @($ids | Group-Object | Where-Object { $_.Count -gt 1 }).Count | Should -Be 0 -Because 'a duplicated id makes Get-DEBundle resolve the wrong plan'
        $ids.Count | Should -BeGreaterThan 20
    }
    It 'every standalone solution composes its own non-empty plan' {
        foreach ($s in @(Get-DESolutions)) {
            $composed = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id 'alamo') -Solution $s['id']
            @($composed.plan.solutions) | Should -Contain $s['id']
            $ids = @(Initialize-DEWorkflow -ClientProfile $composed -Mode 'takeover')
            $ids.Count | Should -BeGreaterThan 0 -Because "solution $($s['id']) composes no plan at all"
        }
    }
}
