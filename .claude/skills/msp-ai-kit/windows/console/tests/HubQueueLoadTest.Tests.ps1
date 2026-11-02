# Move 77: "Load-test the Hub job queue with many devices" (#795) - HARNESS ONLY.
#
# The Hub queue (the move 60 design) is not built, so nothing here runs against a real Hub. This suite tests the INSTRUMENT,
# so that the numbers it produces later can be trusted:
#   - the arithmetic (percentiles) and determinism (the same seed gives the same run);
#   - the model Hub follows the design: every job is driven to done exactly once, the per-device rate limit answers 429 on the
#     301st request without touching other devices, a pause answers 423 and changes nothing, lost acknowledgements are re-leased
#     up to the ceiling of 3 and then time out;
#   - the invariant checks CATCH a broken queue (a held job leased again, an acknowledged job re-leased, no attempt ceiling);
#   - jitter spreads load: a thundering herd fails the latency threshold and the same devices with jitter pass it;
#   - the verdict fails for each way a run can go wrong, and the document states the same thresholds the code uses and says it
#     has not been run against a real Hub.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentLoadTest: the load-test harness is itself trustworthy' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentLoadTest.psm1') -Force
        $script:Doc = [IO.File]::ReadAllText((Join-Path $script:Win 'HUB-QUEUE-LOAD-TEST.md'))
        $script:Flat = $script:Doc -replace '\s+', ' '
        function script:Start-Run {
            param([int]$Devices = 50, [int]$Duration = 900, [int]$JobsPerDevice = 2, [string]$Bug = '', [switch]$Herd, [int]$Seed = 1, [int]$DropAck = 0, [switch]$Paused, [int]$JobSeconds = 30)
            $hub = New-DEModelHub -DevicesWithJobs $Devices -JobsPerDevice $JobsPerDevice -Bug $Bug -Paused ([bool]$Paused)
            $run = Invoke-DELoadTest -Devices $Devices -DurationSeconds $Duration -Transport ({ param($r) Invoke-DEModelHub -Hub $hub -Request $r }.GetNewClosure()) -Seed $Seed -Herd:$Herd -DropAckPercent $DropAck -JobSeconds $JobSeconds
            return [pscustomobject]@{ Hub = $hub; Run = $run; Summary = (Get-DELoadSummary -Run $run) }
        }
        function script:New-Req { param($Kind = 'lease', $Device = 0, $Time = 0.0, $JobId = $null) return [pscustomobject]@{ Kind = $Kind; Device = $Device; VirtualTime = $Time; JobId = $JobId } }
    }

    Context 'the arithmetic' {
        It 'nearest-rank percentile: <p>th of 1..100 is <expect>' -TestCases @(
            @{ p = 50; expect = 50 }
            @{ p = 95; expect = 95 }
            @{ p = 99; expect = 99 }
            @{ p = 100; expect = 100 }
            @{ p = 1; expect = 1 }
        ) {
            param($p, $expect)
            (Get-DEPercentile -Values (1..100) -Percent $p) | Should -Be $expect
        }
        It 'is order-independent, handles one value, and an empty list is zero' {
            (Get-DEPercentile -Values @(9, 1, 5, 3, 7) -Percent 50) | Should -Be 5
            (Get-DEPercentile -Values @(42) -Percent 99) | Should -Be 42
            (Get-DEPercentile -Values @() -Percent 95) | Should -Be 0
        }
        It 'the default thresholds are the ones the document states' {
            $t = Get-DELoadThresholds
            $t.P95Ms | Should -Be 500
            $t.MaxServerErrorRate | Should -Be 0.001
            $t.MaxAttempts | Should -Be 3
            $t.QueueDepthCap | Should -Be 20
            $t.RateLimitPer5Min | Should -Be 300
            $script:Flat | Should -Match 'at most \*\*500 ms\*\*'
            $script:Flat | Should -Match 'at most \*\*0\.1 percent\*\*'
            $script:Flat | Should -Match 'attempts at most 3'
            $script:Flat | Should -Match 'at most 20 jobs per device'
            $script:Flat | Should -Match '300 requests per device per 5 minutes'
        }
        It 'returns a copy of the thresholds, so a caller cannot change the defaults' {
            $t = Get-DELoadThresholds; $t.P95Ms = 99999
            (Get-DELoadThresholds).P95Ms | Should -Be 500
        }
    }

    Context 'determinism' {
        It 'the same seed gives the same run, and another seed gives another' {
            $a = Start-Run -Devices 30 -Duration 600 -Seed 5
            $b = Start-Run -Devices 30 -Duration 600 -Seed 5
            $c = Start-Run -Devices 30 -Duration 600 -Seed 6
            $a.Summary.Requests | Should -Be $b.Summary.Requests
            $a.Summary.P95Ms | Should -Be $b.Summary.P95Ms
            ($a.Run.Latencies -join ',') | Should -Be ($b.Run.Latencies -join ',')
            ($a.Run.Latencies -join ',') | Should -Not -Be ($c.Run.Latencies -join ',')
        }
        It 'an hour of virtual time for a few hundred devices takes seconds, not an hour' {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $r = Start-Run -Devices 200 -Duration 3600
            $sw.Stop()
            $r.Summary.Requests | Should -BeGreaterThan 5000
            $sw.Elapsed.TotalSeconds | Should -BeLessThan 120
        }
    }

    Context 'the model Hub follows the design' {
        It 'drives every job to done, acknowledged once and finished once, with no violations' {
            $r = Start-Run -Devices 100 -Duration 1800 -JobsPerDevice 2
            $states = @($r.Hub.Jobs.Values | Group-Object State | ForEach-Object { "$($_.Name)=$($_.Count)" })
            ($states -join ',') | Should -Be 'done=200'
            foreach ($j in $r.Hub.Jobs.Values) { $j.Acks | Should -Be 1; $j.Results | Should -Be 1; $j.Attempts | Should -Be 1 }
            (@(Test-DEQueueInvariants -Hub $r.Hub) -join '; ') | Should -BeNullOrEmpty
            $r.Summary.ServerErrorRate | Should -Be 0
        }
        It 'an acknowledgement for a job that is not leased, and a result for one that is not running, are 409' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -JobId 'j-0-0' -Time 1)).HttpStatus | Should -Be 409
            $l = Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Time 2)
            $l.HttpStatus | Should -Be 200
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'result' -JobId $l.JobId -Time 3)).HttpStatus | Should -Be 409
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -JobId $l.JobId -Time 4)).HttpStatus | Should -Be 200
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -JobId $l.JobId -Time 5)).HttpStatus | Should -Be 409 -Because 'acknowledged at most once'
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'result' -JobId $l.JobId -Time 6)).HttpStatus | Should -Be 200
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'result' -JobId $l.JobId -Time 7)).HttpStatus | Should -Be 409 -Because 'a result is recorded once'
        }
        It 'a device cannot acknowledge or finish another device''s job' {
            $hub = New-DEModelHub -DevicesWithJobs 2 -JobsPerDevice 1
            $l = Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Device 0 -Time 1)
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -Device 1 -JobId $l.JobId -Time 2)).HttpStatus | Should -Be 409
        }
        It 'a device with no jobs gets 204' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Device 9 -Time 1)).HttpStatus | Should -Be 204
        }
        It 'caps a device''s queue at 20 jobs however many were asked for' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 50
            $hub.ByDevice[0].Count | Should -Be 20
        }
    }

    Context 'limits' {
        It 'the 301st request from one device inside 5 minutes is 429, and the first 300 are not' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1
            $codes = foreach ($i in 0..300) { (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Device 0 -Time ($i * 0.5))).HttpStatus }
            @($codes | Where-Object { $_ -eq 429 }).Count | Should -Be 1
            $codes[300] | Should -Be 429
            $codes[299] | Should -Not -Be 429
        }
        It 'another device is unaffected while one is limited' {
            $hub = New-DEModelHub -DevicesWithJobs 2 -JobsPerDevice 1
            foreach ($i in 0..300) { $null = Invoke-DEModelHub -Hub $hub -Request (New-Req -Device 0 -Time ($i * 0.5)) }
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Device 0 -Time 151)).HttpStatus | Should -Be 429
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Device 1 -Time 151)).HttpStatus | Should -Not -Be 429
        }
        It 'the window recovers: after 5 minutes the same device is served again' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1
            foreach ($i in 0..300) { $null = Invoke-DEModelHub -Hub $hub -Request (New-Req -Time ($i * 0.5)) }
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Time 151)).HttpStatus | Should -Be 429
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Time 451)).HttpStatus | Should -Not -Be 429
        }
        It 'a paused Hub answers 423 and changes nothing: no job is leased' {
            $r = Start-Run -Devices 20 -Duration 600 -Paused
            $r.Run.Statuses['423'] | Should -BeGreaterThan 0
            @($r.Run.Statuses.Keys | Where-Object { $_ -ne '423' }).Count | Should -Be 0
            @($r.Hub.Jobs.Values | Where-Object { $_.State -ne 'approved' -or $_.Attempts -ne 0 }).Count | Should -Be 0
        }
        It 'a 423 pause is not counted as a server error' {
            (Start-Run -Devices 20 -Duration 600 -Paused).Summary.ServerErrorRate | Should -Be 0
        }
    }

    Context 'lost acknowledgements' {
        It 'a lease never acknowledged is re-leased after it expires, up to 3 attempts, then times out; nothing is acknowledged twice' {
            $r = Start-Run -Devices 10 -Duration 6000 -JobsPerDevice 1 -DropAck 100
            @($r.Hub.Jobs.Values | Where-Object { $_.State -eq 'timed_out' }).Count | Should -Be 10
            foreach ($j in $r.Hub.Jobs.Values) { $j.Attempts | Should -Be 3; $j.Acks | Should -Be 0 }
            (@(Test-DEQueueInvariants -Hub $r.Hub) -join '; ') | Should -BeNullOrEmpty
        }
        It 'a partial loss still finishes the jobs that were acknowledged, and keeps every invariant' {
            $r = Start-Run -Devices 60 -Duration 7200 -JobsPerDevice 2 -DropAck 30 -Seed 11
            @($r.Hub.Jobs.Values | Where-Object { $_.State -eq 'done' }).Count | Should -BeGreaterThan 0
            @($r.Hub.Jobs.Values | Where-Object { $_.State -in @('approved', 'running') }).Count | Should -Be 0 -Because 'two hours is long enough for every job to finish or time out'
            (@(Test-DEQueueInvariants -Hub $r.Hub) -join '; ') | Should -BeNullOrEmpty
        }
    }

    Context 'the invariant checks catch a broken queue' {
        It 'a Hub that leases a held job again is caught' {
            $r = Start-Run -Devices 20 -Duration 600 -JobsPerDevice 1 -Bug 'double-lease' -DropAck 100
            $v = @(Test-DEQueueInvariants -Hub $r.Hub)
            $v.Count | Should -BeGreaterThan 0
            ($v -join ' ') | Should -Match 'while already held'
        }
        It 'a Hub that re-leases an acknowledged job is caught' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1 -Bug 'no-ack-limit'
            $l = Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Time 1)
            $null = Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -JobId $l.JobId -Time 2)
            (Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'lease' -Time 3)).HttpStatus | Should -Be 200 -Because 'the bug hands out a job that is already running'
            $null = Invoke-DEModelHub -Hub $hub -Request (New-Req -Kind 'ack' -JobId $l.JobId -Time 4)
            $v = @(Test-DEQueueInvariants -Hub $hub)
            ($v -join ' ') | Should -Match 'acknowledged 2 times'
            ($v -join ' ') | Should -Match 'while already held'
        }
        It 'a Hub with no attempt ceiling is caught' {
            $r = Start-Run -Devices 5 -Duration 6000 -JobsPerDevice 1 -Bug 'unbounded-attempts' -DropAck 100
            $v = @(Test-DEQueueInvariants -Hub $r.Hub)
            ($v -join ' ') | Should -Match 'attempts \(ceiling 3\)'
        }
        It 'the same lost-acknowledgement scenarios with a correct Hub are clean (so the catches above mean something)' {
            (@(Test-DEQueueInvariants -Hub (Start-Run -Devices 20 -Duration 600 -JobsPerDevice 1 -DropAck 100).Hub) -join '; ') | Should -BeNullOrEmpty
            (@(Test-DEQueueInvariants -Hub (Start-Run -Devices 5 -Duration 6000 -JobsPerDevice 1 -DropAck 100).Hub) -join '; ') | Should -BeNullOrEmpty
        }
        It 'a job that is done without exactly one acknowledgement, and an unknown state, are caught' {
            $hub = New-DEModelHub -DevicesWithJobs 1 -JobsPerDevice 1
            $hub.Jobs['j-0-0'].State = 'done'
            (@(Test-DEQueueInvariants -Hub $hub) -join ' ') | Should -Match 'done without exactly one acknowledgement'
            $hub.Jobs['j-0-0'].State = 'vanished'
            (@(Test-DEQueueInvariants -Hub $hub) -join ' ') | Should -Match 'unaccounted state'
        }
    }

    Context 'jitter spreads the load' {
        It 'a thundering herd of 2000 devices is one big spike and fails the latency threshold; jitter does not' {
            $herd = Start-Run -Devices 2000 -Duration 120 -JobsPerDevice 0 -Herd -Seed 3
            $spread = Start-Run -Devices 2000 -Duration 120 -JobsPerDevice 0 -Seed 3
            $herd.Summary.PeakRequestsPerSecond | Should -BeGreaterThan 1500
            $spread.Summary.PeakRequestsPerSecond | Should -BeLessThan 150
            $herd.Summary.P95Ms | Should -BeGreaterThan 500
            $spread.Summary.P95Ms | Should -BeLessThan 500
            (Get-DELoadVerdict -Summary $herd.Summary).Pass | Should -Be $false
            (Get-DELoadVerdict -Summary $spread.Summary).Pass | Should -Be $true
        }
        It 'devices are served about equally (fairness near 1)' {
            (Start-Run -Devices 200 -Duration 1800 -JobsPerDevice 0).Summary.Fairness | Should -BeLessThan 1.6
        }
    }

    Context 'the verdict' {
        BeforeAll {
            $script:Good = [pscustomobject]@{ Requests = 1000; P95Ms = 100; ServerErrorRate = 0 }
        }
        It 'passes a good run with no violations' {
            $v = Get-DELoadVerdict -Summary $script:Good
            $v.Pass | Should -Be $true
            @($v.Reasons).Count | Should -Be 0
        }
        It 'fails, with a reason that names it, for <why>' -TestCases @(
            @{ why = 'a slow p95'; p95 = 900; err = 0; req = 1000; viol = @(); match = 'p95 latency 900' }
            @{ why = 'one percent server errors'; p95 = 100; err = 0.01; req = 1000; viol = @(); match = 'server error rate' }
            @{ why = 'zero requests'; p95 = 0; err = 0; req = 0; viol = @(); match = 'no requests' }
            @{ why = 'an invariant violation'; p95 = 100; err = 0; req = 1000; viol = @('j-1: acknowledged 2 times (once only)'); match = 'invariant: j-1' }
        ) {
            param($why, $p95, $err, $req, $viol, $match)
            $s = [pscustomobject]@{ Requests = $req; P95Ms = $p95; ServerErrorRate = $err }
            $v = Get-DELoadVerdict -Summary $s -Violations $viol
            $v.Pass | Should -Be $false
            ($v.Reasons -join ' ') | Should -Match $match
        }
        It 'a p95 exactly at the threshold passes, one over fails' {
            (Get-DELoadVerdict -Summary ([pscustomobject]@{ Requests = 10; P95Ms = 500; ServerErrorRate = 0 })).Pass | Should -Be $true
            (Get-DELoadVerdict -Summary ([pscustomobject]@{ Requests = 10; P95Ms = 501; ServerErrorRate = 0 })).Pass | Should -Be $false
        }
        It 'a real run through the model passes end to end' {
            $r = Start-Run -Devices 100 -Duration 1800 -JobsPerDevice 2
            $v = Get-DELoadVerdict -Summary $r.Summary -Violations @(Test-DEQueueInvariants -Hub $r.Hub)
            $v.Pass | Should -Be $true -Because ($v.Reasons -join '; ')
        }
        It 'a Hub with a broken invariant fails the same end-to-end verdict' {
            $r = Start-Run -Devices 20 -Duration 600 -JobsPerDevice 1 -Bug 'double-lease' -DropAck 100
            (Get-DELoadVerdict -Summary $r.Summary -Violations @(Test-DEQueueInvariants -Hub $r.Hub)).Pass | Should -Be $false
        }
    }

    Context 'the document' {
        It 'says plainly that it has not been run against a real Hub' {
            $script:Flat | Should -Match '\*\*Harness only\.'
            $script:Flat | Should -Match 'has not been run against a real Hub'
        }
        It 'names the five scenarios and the three device counts for the real run' {
            foreach ($s in @('S1 steady', 'S2 herd', 'S3 lost acknowledgements', 'S4 pause storm', 'S5 one abusive device')) { $script:Flat | Should -Match $s }
            $script:Flat | Should -Match '1,000, 5,000 and 10,000 devices'
        }
        It 'every function the document names is exported by the module' {
            $exported = @((Get-Module DE.AgentLoadTest).ExportedFunctions.Keys)
            foreach ($n in @([regex]::Matches($script:Doc, '`((?:Invoke|Test|Get|New)-DE\w+)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)) { $exported | Should -Contain $n }
        }
        It 'every local link resolves' {
            $missing = New-Object System.Collections.Generic.List[string]
            foreach ($m in [regex]::Matches($script:Doc, '\]\(([A-Za-z0-9._-]+\.md)\)')) { if (-not (Test-Path -LiteralPath (Join-Path $script:Win $m.Groups[1].Value))) { $missing.Add($m.Groups[1].Value) } }
            ($missing -join ', ') | Should -BeNullOrEmpty
        }
    }
}
