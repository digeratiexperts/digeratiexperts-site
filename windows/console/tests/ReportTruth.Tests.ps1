# Move 11: "a failed control can never appear as PASS in any report".
#
# Get-DEReadiness rolls up per area with severity order (FAIL > BLOCKED > WARN > PLANNED >
# EXCEPTION > SKIPPED > PASS), so the worst result wins inside an area. The two places a failure
# could still disappear are (a) the latest-evidence-wins map, where a later PASS overwrites an
# earlier FAIL for the same step, and (b) the client-safe wording table, which may soften a result
# but must never make a failure read as 'In place'. Both are pinned here.
#
# Area ids and prefixes come from $script:Areas in DE.Evidence.psm1; 'net.' belongs to the
# 'network' area (title 'Network / site'), 'apps.' to 'apps'.

Describe 'A failed control never reads as PASS in any report' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Alamo = Get-DEClientProfile -Id 'alamo'
        $script:Snap = @{ device = @{ hostname = 'H'; serial = 'PF3ABC12'; manufacturer = 'Dell'; model = 'M' } }

        # the report HTML is largely one line, so find a row by its area label, not by line
        function script:Get-DEAreaPill {
            param([Parameter(Mandatory = $true)][string]$Html, [Parameter(Mandatory = $true)][string]$Label)
            $m = [regex]::Match($Html, '<tr><td>' + [regex]::Escape($Label) + '</td><td class="state"><span class="pill ([^"]+)">([^<]*)</span>')
            if (-not $m.Success) { return $null }
            return [pscustomobject]@{ Css = $m.Groups[1].Value; Word = $m.Groups[2].Value }
        }
    }

    Context 'inside one area, the worst result wins' {
        BeforeAll {
            Clear-DEEvidence
            Add-DEEvidence -Step 'net.pass-a' -Module 'net' -Before 'x' -ActionTaken 'check' -Result 'PASS' | Out-Null
            Add-DEEvidence -Step 'net.fail' -Module 'net' -Before 'x' -ActionTaken 'check' -Result 'FAIL' -Verification 'service stopped' | Out-Null
            Add-DEEvidence -Step 'net.pass-b' -Module 'net' -Before 'x' -ActionTaken 'check' -Result 'PASS' | Out-Null
            $script:Card = @((Get-DEReadiness).cards | Where-Object { $_.id -eq 'network' }) | Select-Object -First 1
        }
        It 'the area card reads FAIL, not PASS' { $script:Card.state | Should -Be 'FAIL' }
        It 'the overall readiness is NOT READY' { (Get-DEReadiness).overall | Should -Be 'NOT READY' }
        It 'the internal report never styles the area as passing' {
            $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -Evidence (Get-DEEvidence)
            $p = Get-DEAreaPill -Html $html -Label 'Network / site'
            $p | Should -Not -BeNullOrEmpty
            $p.Css | Should -Not -Be 'pass'
            $p.Css | Should -Be 'fail'
        }
        It 'the client report says Not in place, never In place' {
            $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -ClientSafe
            $p = Get-DEAreaPill -Html $html -Label 'Network / site'
            $p | Should -Not -BeNullOrEmpty
            $p.Word | Should -Be 'Not in place'
            $p.Word | Should -Not -Be 'In place'
        }
    }

    Context 'a later result for the same step cannot erase the failure' {
        BeforeAll {
            Clear-DEEvidence
            Add-DEEvidence -Step 'apps.chrome' -Module 'apps' -Before 'x' -ActionTaken 'install' -Result 'FAIL' -Verification 'download refused' | Out-Null
            Add-DEEvidence -Step 'apps.chrome' -Module 'apps' -Before 'x' -ActionTaken 'install' -Result 'PASS' | Out-Null
        }
        It 'the evidence log still carries both results' {
            $results = @(Get-DEEvidence | Where-Object { $_.step -eq 'apps.chrome' } | ForEach-Object { $_.result })
            $results | Should -Contain 'FAIL'
            $results | Should -Contain 'PASS'
        }
        It 'the internal report prints the failure detail alongside the pass' {
            $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -Evidence (Get-DEEvidence)
            $html | Should -Match 'download refused'
            $html | Should -Match 'pill fail'
        }
    }

    Context 'no failing result is worded as a passing one for the client' {
        It '<result> is never rendered to the client as In place' -TestCases @(
            @{ result = 'FAIL' }, @{ result = 'BLOCKED' }, @{ result = 'WARN' },
            @{ result = 'PLANNED' }, @{ result = 'EXCEPTION' }, @{ result = 'SKIPPED' }
        ) {
            param($result)
            Clear-DEEvidence
            Add-DEEvidence -Step 'net.firewall' -Module 'net' -Before 'x' -ActionTaken 'check' -Result $result | Out-Null
            $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -ClientSafe
            $p = Get-DEAreaPill -Html $html -Label 'Network / site'
            $p | Should -Not -BeNullOrEmpty -Because "$result must still be rendered to the client"
            $p.Word | Should -Not -Be 'In place' -Because "$result must not read as In place to the client"
        }
        It 'a genuine PASS is what the client sees as In place' {
            Clear-DEEvidence
            Add-DEEvidence -Step 'net.firewall' -Module 'net' -Before 'x' -ActionTaken 'check' -Result 'PASS' | Out-Null
            $html = ConvertTo-DEHtmlReport -Record (New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo) -ClientProfile $script:Alamo -ClientSafe
            (Get-DEAreaPill -Html $html -Label 'Network / site').Word | Should -Be 'In place'
        }
    }

    Context 'the readiness rollup is severity ordered' {
        It '<results> rolls the area up to <expected>' -TestCases @(
            @{ results = @('PASS', 'FAIL'); expected = 'FAIL' }
            @{ results = @('PASS', 'BLOCKED'); expected = 'BLOCKED' }
            @{ results = @('PASS', 'WARN'); expected = 'WARN' }
            @{ results = @('PASS', 'PLANNED'); expected = 'PLANNED' }
            @{ results = @('PASS', 'EXCEPTION'); expected = 'EXCEPTION' }
            @{ results = @('PASS', 'SKIPPED'); expected = 'SKIPPED' }
            @{ results = @('PASS', 'NO CHANGE'); expected = 'PASS' }
            @{ results = @('FAIL', 'WARN', 'PASS'); expected = 'FAIL' }
        ) {
            param($results, $expected)
            Clear-DEEvidence
            $i = 0
            foreach ($r in $results) { $i++; Add-DEEvidence -Step ("net.t$i") -Module 'net' -Before 'x' -ActionTaken 'check' -Result $r | Out-Null }
            $card = @((Get-DEReadiness).cards | Where-Object { $_.id -eq 'network' }) | Select-Object -First 1
            $card | Should -Not -BeNullOrEmpty
            $card.state | Should -Be $expected
        }
    }
}
