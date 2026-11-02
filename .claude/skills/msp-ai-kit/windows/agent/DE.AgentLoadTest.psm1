# DE.AgentLoadTest: a load-test harness for the Hub job queue (move 77). HARNESS ONLY.
#
# The Hub's job queue (the move 60 design) is not built, so nothing here has been run against a real Hub. What this module
# provides is the instrument, and the instrument is itself tested so that when the real queue exists the numbers can be trusted:
#   - a deterministic VIRTUAL-TIME scheduler: N simulated devices poll on a seeded, jittered schedule and call a transport
#     scriptblock; the same seed gives the same run, and a run of an hour takes seconds;
#   - a MODEL Hub that follows the design's semantics (a job is acknowledged at most once, a lease that is never acknowledged
#     returns to the queue up to a ceiling of 3 attempts, a queue depth cap of 20 per device, 300 requests per device per 5
#     minutes, a pause that answers 423), so the harness and its invariant checks can be validated today;
#   - INVARIANTS the real queue must also keep (no job leased to two live holders, none acknowledged twice, attempts bounded,
#     depth bounded, every job accounted for), checked after every run, and shown to catch a deliberately broken Hub;
#   - a SUMMARY (latency percentiles, peak requests per second, errors by status, fairness) and a VERDICT against explicit
#     thresholds, so "it went fine" is a number.
# The transport is a scriptblock: the model here, or a real HTTP client against a real Hub later (HUB-QUEUE-LOAD-TEST.md).
# No network access of its own.

$script:Defaults = [pscustomobject]@{ P95Ms = 500; MaxServerErrorRate = 0.001; MaxAttempts = 3; QueueDepthCap = 20; RateLimitPer5Min = 300; LeaseSeconds = 900 }

function Get-DELoadThresholds { return $script:Defaults.PSObject.Copy() }

function Get-DEPercentile {
    <# Nearest-rank percentile of a list of numbers. An empty list gives 0. #>
    param([double[]]$Values, [Parameter(Mandatory = $true)][double]$Percent)
    $v = @($Values | Sort-Object)
    if (-not $v.Count) { return 0 }
    $rank = [Math]::Ceiling($Percent / 100.0 * $v.Count)
    return [double]$v[[Math]::Max(0, [Math]::Min($v.Count - 1, $rank - 1))]
}

function New-DEModelHub {
    <#
        An in-process Hub following the move 60 semantics. -Bug turns on a deliberate defect so the invariants can be shown to catch it:
        'double-lease' (a leased job can be leased again), 'no-ack-limit' (an acknowledged job is re-leased), 'unbounded-attempts'.
    #>
    param([int]$DevicesWithJobs = 0, [int]$JobsPerDevice = 1, [string]$Bug = '', [bool]$Paused = $false, [double]$BaseLatencyMs = 20, [double]$LatencyPerRequestInSecondMs = 0.4)
    $hub = [pscustomobject]@{
        Jobs = @{}; ByDevice = @{}; Paused = $Paused; Bug = $Bug; BaseLatencyMs = $BaseLatencyMs; PerReq = $LatencyPerRequestInSecondMs
        Window = @{}; Second = @{}; Counts = @{ lease = 0; ack = 0; result = 0 }
    }
    for ($d = 0; $d -lt $DevicesWithJobs; $d++) {
        $hub.ByDevice[$d] = New-Object System.Collections.Generic.List[string]
        for ($j = 0; $j -lt [Math]::Min($JobsPerDevice, $script:Defaults.QueueDepthCap); $j++) {
            $id = "j-$d-$j"
            $hub.Jobs[$id] = [pscustomobject]@{ Id = $id; Device = $d; State = 'approved'; Attempts = 0; Acks = 0; LeaseExpires = [double]::MaxValue; LeasedTo = -1; Results = 0; DoubleLeased = 0 }
            $hub.ByDevice[$d].Add($id)
        }
    }
    return $hub
}

function Invoke-DEModelHub {
    <# One request against the model: Kind is lease, ack or result. Returns HttpStatus, LatencyMs and JobId. #>
    param([Parameter(Mandatory = $true)]$Hub, [Parameter(Mandatory = $true)]$Request)
    $now = [double]$Request.VirtualTime; $dev = [int]$Request.Device
    $sec = [long][Math]::Floor($now)
    if (-not $Hub.Second.ContainsKey($sec)) { $Hub.Second.Clear(); $Hub.Second[$sec] = 0 }
    $Hub.Second[$sec]++
    $latency = $Hub.BaseLatencyMs + $Hub.PerReq * $Hub.Second[$sec]
    $answer = { param($status, $job) [pscustomobject]@{ HttpStatus = $status; LatencyMs = $latency; JobId = $job } }
    # the per-device limit: 300 requests in any 5 minute window, counted per device
    if (-not $Hub.Window.ContainsKey($dev)) { $Hub.Window[$dev] = New-Object System.Collections.Generic.Queue[double] }
    $w = $Hub.Window[$dev]
    while ($w.Count -and $w.Peek() -le ($now - 300)) { [void]$w.Dequeue() }
    if ($w.Count -ge $script:Defaults.RateLimitPer5Min) { return (& $answer 429 $null) }
    $w.Enqueue($now)
    if ($Hub.Paused) { return (& $answer 423 $null) }
    switch ($Request.Kind) {
        'lease' {
            $Hub.Counts.lease++
            if (-not $Hub.ByDevice.ContainsKey($dev)) { return (& $answer 204 $null) }
            foreach ($id in $Hub.ByDevice[$dev]) {
                $j = $Hub.Jobs[$id]
                if ($j.State -eq 'leased' -and $j.LeaseExpires -le $now -and $j.Acks -eq 0) {
                    if ($j.Attempts -ge $script:Defaults.MaxAttempts -and $Hub.Bug -ne 'unbounded-attempts') { $j.State = 'timed_out' } else { $j.State = 'approved' }
                }
                $leasable = ($j.State -eq 'approved') -or ($Hub.Bug -eq 'double-lease' -and $j.State -eq 'leased') -or ($Hub.Bug -eq 'no-ack-limit' -and $j.State -eq 'running')
                if ($leasable) { if ($j.State -eq 'leased' -or $j.State -eq 'running') { $j.DoubleLeased++ }; $j.State = 'leased'; $j.Attempts++; $j.LeasedTo = $dev; $j.LeaseExpires = $now + $script:Defaults.LeaseSeconds; return (& $answer 200 $id) }
            }
            return (& $answer 204 $null)
        }
        'ack' {
            $Hub.Counts.ack++
            $j = $Hub.Jobs[$Request.JobId]
            if ($null -eq $j -or $j.Device -ne $dev -or $j.State -ne 'leased') { return (& $answer 409 $null) }
            $j.Acks++; $j.State = 'running'; return (& $answer 200 $j.Id)
        }
        'result' {
            $Hub.Counts.result++
            $j = $Hub.Jobs[$Request.JobId]
            if ($null -eq $j -or $j.Device -ne $dev -or $j.State -ne 'running') { return (& $answer 409 $null) }
            $j.Results++; $j.State = 'done'; return (& $answer 200 $j.Id)
        }
    }
    return (& $answer 400 $null)
}

function Test-DEQueueInvariants {
    <# What a correct queue keeps after any run. Returns a list of violations; empty means the queue behaved (wrap the call in @()). #>
    param([Parameter(Mandatory = $true)]$Hub)
    $v = New-Object System.Collections.Generic.List[string]
    foreach ($j in $Hub.Jobs.Values) {
        if ($j.DoubleLeased -gt 0) { $v.Add("$($j.Id): leased $($j.DoubleLeased) time(s) while already held") }
        if ($j.Acks -gt 1) { $v.Add("$($j.Id): acknowledged $($j.Acks) times (once only)") }
        if ($j.Attempts -gt $script:Defaults.MaxAttempts) { $v.Add("$($j.Id): $($j.Attempts) attempts (ceiling $($script:Defaults.MaxAttempts))") }
        if ($j.Results -gt 1) { $v.Add("$($j.Id): $($j.Results) results (once only)") }
        if (@('approved', 'leased', 'running', 'done', 'timed_out') -cnotcontains $j.State) { $v.Add("$($j.Id): unaccounted state '$($j.State)'") }
        if ($j.State -eq 'done' -and $j.Acks -ne 1) { $v.Add("$($j.Id): done without exactly one acknowledgement") }
    }
    foreach ($d in $Hub.ByDevice.Keys) { if ($Hub.ByDevice[$d].Count -gt $script:Defaults.QueueDepthCap) { $v.Add("device ${d}: queue depth $($Hub.ByDevice[$d].Count) over the cap") } }
    return $v.ToArray()
}

function Invoke-DELoadTest {
    <#
        Runs -Devices simulated devices for -DurationSeconds of VIRTUAL time against -Transport (called as & $Transport $request, returning
        HttpStatus and LatencyMs; the request has Kind, Device, VirtualTime and JobId). Each device polls every -PollSeconds with +/- -JitterPct
        jitter from a seeded generator; -Herd starts every device at t=0 instead of spread across one interval. A leased job is acknowledged at
        once and its result follows -JobSeconds later. -DropAckPercent loses that share of acknowledgements, to exercise the re-lease path.
        Returns the raw samples: Latencies, Statuses, PerSecond (requests per virtual second), PerDevice.
    #>
    param(
        [Parameter(Mandatory = $true)][int]$Devices, [Parameter(Mandatory = $true)][int]$DurationSeconds, [Parameter(Mandatory = $true)][scriptblock]$Transport,
        [int]$PollSeconds = 60, [int]$JitterPct = 20, [int]$Seed = 1, [switch]$Herd, [int]$JobSeconds = 30, [int]$DropAckPercent = 0
    )
    $rng = New-Object System.Random $Seed
    $queue = New-Object 'System.Collections.Generic.SortedDictionary[double,object]'
    $push = { param($time, $item) $k = $time; while ($queue.ContainsKey($k)) { $k += 1e-7 }; $queue[$k] = $item }
    for ($d = 0; $d -lt $Devices; $d++) { & $push $(if ($Herd) { 0.0 } else { $rng.NextDouble() * $PollSeconds }) @{ Kind = 'lease'; Device = $d; JobId = $null } }
    $lat = New-Object System.Collections.Generic.List[double]; $status = @{}; $perSec = @{}; $perDev = @{}
    while ($queue.Count) {
        $first = $queue.GetEnumerator(); [void]$first.MoveNext(); $t = $first.Current.Key; $ev = $first.Current.Value; [void]$queue.Remove($t)
        if ($t -ge $DurationSeconds) { break }
        $req = [pscustomobject]@{ Kind = $ev.Kind; Device = $ev.Device; VirtualTime = $t; JobId = $ev.JobId }
        $a = & $Transport $req
        $lat.Add([double]$a.LatencyMs)
        $status["$($a.HttpStatus)"] = 1 + [int]$status["$($a.HttpStatus)"]
        $s = [long][Math]::Floor($t); $perSec[$s] = 1 + [int]$perSec[$s]
        $perDev[$ev.Device] = 1 + [int]$perDev[$ev.Device]
        $jit = (($rng.NextDouble() * 2) - 1) * ($JitterPct / 100.0)
        $next = $PollSeconds * (1 + $jit)
        if ($ev.Kind -eq 'lease' -and [int]$a.HttpStatus -eq 200) {
            if ($rng.Next(0, 100) -ge $DropAckPercent) {
                & $push ($t + 0.05) @{ Kind = 'ack'; Device = $ev.Device; JobId = $a.JobId; Then = $true }
            } else { & $push ($t + $next) @{ Kind = 'lease'; Device = $ev.Device; JobId = $null } }
        } elseif ($ev.Kind -eq 'ack') {
            if ([int]$a.HttpStatus -eq 200) { & $push ($t + $JobSeconds) @{ Kind = 'result'; Device = $ev.Device; JobId = $ev.JobId } } else { & $push ($t + $next) @{ Kind = 'lease'; Device = $ev.Device; JobId = $null } }
        } elseif ($ev.Kind -eq 'result') { & $push ($t + 1) @{ Kind = 'lease'; Device = $ev.Device; JobId = $null } }
        else { & $push ($t + $next) @{ Kind = 'lease'; Device = $ev.Device; JobId = $null } }
    }
    return [pscustomobject]@{ Latencies = $lat.ToArray(); Statuses = $status; PerSecond = $perSec; PerDevice = $perDev; Devices = $Devices; DurationSeconds = $DurationSeconds }
}

function Get-DELoadSummary {
    <# Condenses a run into numbers: requests, latency p50/p95/p99, peak requests per second, errors by status, server error rate and fairness (busiest device over quietest). #>
    param([Parameter(Mandatory = $true)]$Run)
    $total = $Run.Latencies.Count
    $server = 0; foreach ($k in $Run.Statuses.Keys) { if ([int]$k -ge 500) { $server += [int]$Run.Statuses[$k] } }
    $peak = 0; foreach ($v in $Run.PerSecond.Values) { if ($v -gt $peak) { $peak = $v } }
    $counts = @($Run.PerDevice.Values | ForEach-Object { [int]$_ })
    $fair = if ($counts.Count -and ($counts | Measure-Object -Minimum).Minimum -gt 0) { [Math]::Round(($counts | Measure-Object -Maximum).Maximum / ($counts | Measure-Object -Minimum).Minimum, 2) } else { 0 }
    return [pscustomobject]@{
        Requests = $total; P50Ms = (Get-DEPercentile -Values $Run.Latencies -Percent 50); P95Ms = (Get-DEPercentile -Values $Run.Latencies -Percent 95); P99Ms = (Get-DEPercentile -Values $Run.Latencies -Percent 99)
        PeakRequestsPerSecond = $peak; Statuses = $Run.Statuses; ServerErrorRate = $(if ($total) { $server / [double]$total } else { 0 }); Fairness = $fair
    }
}

function Get-DELoadVerdict {
    <# Pass or fail against explicit thresholds: p95 latency, server error rate, and that the queue kept every invariant. Returns Pass and the reasons it did not. #>
    param([Parameter(Mandatory = $true)]$Summary, [string[]]$Violations = @(), $Thresholds = (Get-DELoadThresholds))
    $why = New-Object System.Collections.Generic.List[string]
    if ($Summary.Requests -eq 0) { $why.Add('the run made no requests') }
    if ($Summary.P95Ms -gt $Thresholds.P95Ms) { $why.Add("p95 latency $($Summary.P95Ms) ms is over $($Thresholds.P95Ms) ms") }
    if ($Summary.ServerErrorRate -gt $Thresholds.MaxServerErrorRate) { $why.Add("server error rate $([Math]::Round($Summary.ServerErrorRate, 5)) is over $($Thresholds.MaxServerErrorRate)") }
    foreach ($x in @($Violations)) { $why.Add("invariant: $x") }
    return [pscustomobject]@{ Pass = ($why.Count -eq 0); Reasons = $why.ToArray() }
}

Export-ModuleMember -Function Get-DELoadThresholds, Get-DEPercentile, New-DEModelHub, Invoke-DEModelHub, Test-DEQueueInvariants, Invoke-DELoadTest, Get-DELoadSummary, Get-DELoadVerdict
