# Move 98 (issue 816): cap log size and rotate the logs. A session log at the cap rotates to .1
# instead of growing without bound, only the newest rotated files survive, and old session logs are
# pruned at startup. The cap is tunable through state (settings.log.maxBytes / settings.log.keepFiles)
# so RMM deployments can tune it without a rebuild. Compatible with Pester 4.10 and 5.x.

Describe 'Log size cap and rotation' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
    }
    It 'rotates a log at the cap and keeps only the newest rotated files' {
        $p = Join-Path $global:DETest.Dir 'rotate.log'
        Set-Content -LiteralPath $p -Value ('a' * 2000) -Encoding UTF8
        Set-Content -LiteralPath "$p.1" -Value 'old1' -Encoding UTF8
        Set-Content -LiteralPath "$p.2" -Value 'old2' -Encoding UTF8
        Set-Content -LiteralPath "$p.3" -Value 'old3' -Encoding UTF8
        Invoke-DELogRotation -Path $p -MaxBytes 1000 -Keep 3 | Should -Be $true
        Test-Path -LiteralPath $p | Should -Be $false -Because 'the full file rotates away to .1'
        (Get-Content -LiteralPath "$p.1" -Raw) | Should -Match 'aaaa'
        (Get-Content -LiteralPath "$p.2" -Raw) | Should -Match 'old1'
        (Get-Content -LiteralPath "$p.3" -Raw) | Should -Match 'old2' -Because 'old3 falls off the end'
    }
    It 'leaves a log under the cap alone' {
        $p = Join-Path $global:DETest.Dir 'small.log'
        Set-Content -LiteralPath $p -Value 'tiny' -Encoding UTF8
        Invoke-DELogRotation -Path $p -MaxBytes 1000 -Keep 3 | Should -Be $false
        (Get-Content -LiteralPath $p -Raw) | Should -Match 'tiny'
        Test-Path -LiteralPath "$p.1" | Should -Be $false
    }
    It 'Write-DELog rotates through the settings cap and never loses the newest line' {
        Set-DEStateValue -Path 'settings.log.maxBytes' -Value 2000
        Set-DEStateValue -Path 'settings.log.keepFiles' -Value 2
        for ($i = 0; $i -lt 60; $i++) { Write-DELog -Level INFO -Message ("log line {0} padded with text so the file grows" -f $i) }
        $log = (Get-DEConsole).LogFile
        Test-Path -LiteralPath $log | Should -Be $true -Because 'the session keeps writing to its log after a rotation'
        (Get-Content -LiteralPath $log -Raw) | Should -Match 'log line 59' -Because 'the newest line is in the current file'
        @(Get-ChildItem -LiteralPath (Get-DEConsole).Dirs.Logs -Filter 'techconsole-*.log*').Count | Should -BeLessOrEqual 4 -Because 'the rotated files are bounded (current + keepFiles, plus room for rotation timing)'
        Set-DEStateValue -Path 'settings.log.maxBytes' -Value $null
        Set-DEStateValue -Path 'settings.log.keepFiles' -Value $null
    }
    It 'old session logs are pruned at startup, newest first' {
        $logs = (Get-DEConsole).Dirs.Logs
        foreach ($i in 1..8) {
            $f = Join-Path $logs ("techconsole-2026010{0}-000000.log" -f $i)
            Set-Content -LiteralPath $f -Value 'old session' -Encoding UTF8
            (Get-Item -LiteralPath $f).LastWriteTime = (Get-Date).AddDays(-$i)
        }
        Invoke-DELogPrune -Directory $logs -Keep 3 | Should -BeGreaterThan 3
        @(Get-ChildItem -LiteralPath $logs -Filter 'techconsole-*.log*').Count | Should -Be 3 -Because 'only the newest logs survive'
    }
}
