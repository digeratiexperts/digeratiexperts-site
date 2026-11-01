# Move 93: apply the retention periods to local evidence. Periods set by DE (Joe, threat model D6,
# issue #727): raw device evidence 13 months, audit logs and compliance reports 6 years.
#
# The interesting property is that one bundle does not expire as a unit - the raw data inside it goes
# at 13 months while the reports built from it last 6 years. That is what the decision says, and it
# is the part a naive "delete folders older than X" sweep would get wrong.

Describe 'Evidence retention: 13 months raw, 6 years for reports and audit logs' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:Ret = @{ Dir = Initialize-TestConsole }
    }

    Context 'move 93: the policy is the one DE set' {
        It 'holds the periods from the decision, not guesses' {
            $p = Get-DERetentionPolicy
            $p.raw.months | Should -Be 13 -Because 'raw device evidence: 13 months'
            $p.report.months | Should -Be 72 -Because 'compliance reports: 6 years'
            $p.auditlog.months | Should -Be 72 -Because 'audit logs: 6 years'
        }
        It 'names the three classes so the periods can be argued with in one place' {
            foreach ($k in @('raw', 'report', 'auditlog')) {
                (Get-DERetentionPolicy)[$k].label | Should -Not -BeNullOrEmpty
                @((Get-DERetentionPolicy)[$k].files).Count | Should -BeGreaterThan 0
            }
        }
    }

    Context 'each file name finds its class' {
        It 'classifies <name> as <class>' -TestCases @(
            @{ name = 'evidence.json'; class = 'raw' }
            @{ name = 'snapshot.json'; class = 'raw' }
            @{ name = 'asset.json'; class = 'raw' }
            @{ name = 'gaps.json'; class = 'raw' }
            @{ name = 'console.log'; class = 'raw' }
            @{ name = 'manifest.sha256'; class = 'raw' }
            @{ name = 'report-client.html'; class = 'report' }
            @{ name = 'report-internal.pdf'; class = 'report' }
            @{ name = 'techconsole-20260101-000000.log'; class = 'auditlog' }
        ) {
            param($name, $class)
            Get-DERetentionClass -Name $name | Should -Be $class
        }
        It 'keeps an unclassified name rather than guessing it is expirable' {
            # the safe direction here: a mistake DESTROYS data, so unknown means keep and report
            Get-DERetentionClass -Name 'something-new.json' | Should -Be 'unknown'
            Get-DERetentionClass -Name '' | Should -Be 'unknown'
        }
    }

    Context 'the sweep expires the two classes separately' {
        BeforeAll {
            $d = $global:Ret.Dir
            $bundle = Join-Path (Join-Path $d 'evidence') 'ALAMO-PC-20250101-000000'
            New-Item -ItemType Directory -Path $bundle -Force | Out-Null
            New-Item -ItemType Directory -Path (Join-Path $d 'logs') -Force | Out-Null
            # one bundle, both classes, all well past 13 months
            $global:Ret.Files = @{
                rawOld   = Join-Path $bundle 'evidence.json'
                reportOld = Join-Path $bundle 'report-client.html'
                rawNew   = Join-Path $bundle 'snapshot.json'
                logOld   = Join-Path (Join-Path $d 'logs') 'techconsole-20240101-000000.log'
                oddOld   = Join-Path $bundle 'something-new.json'
            }
            foreach ($k in @($global:Ret.Files.Keys)) { Set-Content -LiteralPath $global:Ret.Files[$k] -Value 'x' }
            $old = (Get-Date).AddMonths(-14)      # past 13 months, inside 6 years
            $veryOld = (Get-Date).AddMonths(-80)  # past 6 years too
            (Get-Item -LiteralPath $global:Ret.Files.rawOld).LastWriteTime = $old
            (Get-Item -LiteralPath $global:Ret.Files.rawNew).LastWriteTime = (Get-Date).AddDays(-1)
            (Get-Item -LiteralPath $global:Ret.Files.oddOld).LastWriteTime = $old
            # the report is 14 months old: past raw retention, well inside its 6 years
            (Get-Item -LiteralPath $global:Ret.Files.reportOld).LastWriteTime = $old
            (Get-Item -LiteralPath $global:Ret.Files.logOld).LastWriteTime = $veryOld
        }

        It 'deletes raw device evidence past 13 months' {
            $r = Invoke-DERetentionSweep
            Test-Path -LiteralPath $global:Ret.Files.rawOld | Should -Be $false -Because 'raw device evidence expires at 13 months'
            $r.deleted | Should -BeGreaterThan 0
        }
        It 'keeps a compliance report of the same age, because it lasts 6 years' {
            Test-Path -LiteralPath $global:Ret.Files.reportOld | Should -Be $true -Because 'the report outlives the raw data it was built from'
        }
        It 'keeps raw evidence still inside its window' {
            Test-Path -LiteralPath $global:Ret.Files.rawNew | Should -Be $true
        }
        It 'deletes an audit log past 6 years' {
            Test-Path -LiteralPath $global:Ret.Files.logOld | Should -Be $false -Because 'audit logs expire at 6 years, not before'
        }
        It 'never deletes an unclassified file, even when it is old' {
            Test-Path -LiteralPath $global:Ret.Files.oddOld | Should -Be $true -Because 'unknown means keep, not destroy'
        }
        It 'reports every file it acted on, with the reason' {
            $r = Invoke-DERetentionSweep
            @($r.items).Count | Should -BeGreaterThan 0
            foreach ($i in @($r.items)) {
                $i.reason | Should -Not -BeNullOrEmpty
                $i.action | Should -BeIn @('deleted', 'kept', 'failed', 'would delete')
            }
        }
    }

    Context 'the sweep is safe to run' {
        It '-WhatIf deletes nothing' {
            $d = $global:Ret.Dir
            $probe = Join-Path (Join-Path $d 'evidence') 'whatif-probe'
            New-Item -ItemType Directory -Path $probe -Force | Out-Null
            # a name that IS classified as raw, so it is genuinely past its retention
            $f = Join-Path $probe 'evidence.json'
            Set-Content -LiteralPath $f -Value 'x'
            (Get-Item -LiteralPath $f).LastWriteTime = (Get-Date).AddMonths(-20)
            $r = Invoke-DERetentionSweep -WhatIf
            Test-Path -LiteralPath $f | Should -Be $true -Because 'WhatIf must not delete'
            $r.deleted | Should -Be 0
            @($r.items | Where-Object { $_.action -eq 'would delete' }).Count | Should -BeGreaterThan 0 -Because 'it must still report what it would have done'
            Remove-Item -LiteralPath $probe -Recurse -Force
        }
        It 'a recent file is never touched' {
            $d = $global:Ret.Dir
            $f = Join-Path (Join-Path $d 'evidence') 'fresh.json'
            Set-Content -LiteralPath $f -Value 'x'
            $before = (Get-Item -LiteralPath $f).LastWriteTime
            $null = Invoke-DERetentionSweep
            Test-Path -LiteralPath $f | Should -Be $true
            Remove-Item -LiteralPath $f -Force
        }
    }
}
