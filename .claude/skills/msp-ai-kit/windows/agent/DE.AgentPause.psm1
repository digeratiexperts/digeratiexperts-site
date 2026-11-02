# DE.AgentPause: the device half of the kill switch (move 78).
#
# The Hub pauses delivery fleet-wide or per account (the job queue design: any staff member pauses, only an owner_admin resumes,
# the answer is 423). This module is what makes a pause STOP something on the device (AGENT-THREAT-MODEL.md D5, E5):
#   - a 423 from the Hub is recorded on disk, atomically, with a time to ask again (the Hub's Retry-After, bounded);
#   - while paused the agent does not take new work: no lease, no run. It may only ask again once the time has passed, and the
#     HUB decides whether the pause is over: the device never un-pauses itself;
#   - a job already running is not killed mid-action, but it stops BEFORE THE NEXT ACTION: the runner checks before every action
#     (including the first), so a pause or a cancel costs at most the action in flight;
#   - a pause that cannot be read is a pause (fail closed): an unreadable state file never means "go";
#   - a LOCAL hold (a technician at the device) is separate: it has no timer, the Hub cannot lift it, and only an explicit local
#     clear removes it;
#   - a pause stops WORK and nothing else: the heartbeat, certificate renewal and reporting what already ran carry on, because
#     pausing work must not make the fleet's identities lapse or hide what happened (the rotation design, move 64).
# No network access: the transport is the service's, over mTLS.

$script:StateFile = 'pause.json'
$script:MinRetry = 30
$script:MaxRetry = 3600
$script:DefaultRetry = 300

function Get-DEPauseFile { param([string]$Dir) return (Join-Path $Dir $script:StateFile) }

function ConvertTo-DEPauseTime { param($Value) return $Value.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture) }

function Get-DEPauseState {
    <#
        Returns Paused, Source (hub, local, unreadable or none), Reason, Since and RetryAt. A missing file is not paused. A file that
        cannot be read, or says something unexpected, is paused with Source 'unreadable': unknown must not mean go.
    #>
    param([Parameter(Mandatory = $true)][string]$Dir)
    $p = Get-DEPauseFile -Dir $Dir
    $none = [pscustomobject]@{ Paused = $false; Source = 'none'; Reason = ''; Since = $null; RetryAt = $null }
    if (-not (Test-Path -LiteralPath $p)) { return $none }
    try {
        $j = Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop
        $src = "$($j.source)"
        if (@('hub', 'local') -cnotcontains $src) { throw 'unknown source' }
        $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
        $format = "yyyy-MM-dd'T'HH:mm:ss'Z'"
        $since = [datetime]::ParseExact("$($j.since)", $format, [Globalization.CultureInfo]::InvariantCulture, $styles)
        $retry = $null
        if ($src -eq 'hub') { $retry = [datetime]::ParseExact("$($j.retryAt)", $format, [Globalization.CultureInfo]::InvariantCulture, $styles) }
        return [pscustomobject]@{ Paused = $true; Source = $src; Reason = "$($j.reason)"; Since = $since; RetryAt = $retry }
    } catch { return [pscustomobject]@{ Paused = $true; Source = 'unreadable'; Reason = 'pause_state_unreadable'; Since = $null; RetryAt = $null } }
}

function Write-DEPauseState {
    param([string]$Dir, $Body)
    if (-not (Test-Path -LiteralPath $Dir)) { New-Item -ItemType Directory -Path $Dir -Force | Out-Null }
    $p = Get-DEPauseFile -Dir $Dir
    $tmp = "$p.tmp"
    [IO.File]::WriteAllText($tmp, ($Body | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
    if (Test-Path -LiteralPath $p) { [IO.File]::Replace($tmp, $p, [NullString]::Value) } else { [IO.File]::Move($tmp, $p) }
}

function Register-DEHubPause {
    <# Records a 423 from the Hub. The next ask is -RetryAfterSeconds from now, bounded to 30 s .. 1 h (0 or missing means 5 minutes). A local hold is never replaced by a Hub pause. Returns the state now in force. #>
    param([Parameter(Mandatory = $true)][string]$Dir, [int]$RetryAfterSeconds = 0, [Parameter(Mandatory = $true)][datetime]$Now)
    $cur = Get-DEPauseState -Dir $Dir
    if ($cur.Paused -and $cur.Source -eq 'local') { return $cur }
    $secs = if ($RetryAfterSeconds -gt 0) { [Math]::Min([Math]::Max($RetryAfterSeconds, $script:MinRetry), $script:MaxRetry) } else { $script:DefaultRetry }
    $since = if ($cur.Paused -and $cur.Source -eq 'hub') { $cur.Since } else { $Now }
    Write-DEPauseState -Dir $Dir -Body ([ordered]@{ source = 'hub'; reason = 'hub_paused'; since = (ConvertTo-DEPauseTime $since); retryAt = (ConvertTo-DEPauseTime $Now.AddSeconds($secs)) })
    return (Get-DEPauseState -Dir $Dir)
}

function Set-DELocalHold {
    <# A technician at the device stops the agent's work, with no timer. The Hub cannot lift it. #>
    param([Parameter(Mandatory = $true)][string]$Dir, [Parameter(Mandatory = $true)][string]$Reason, [Parameter(Mandatory = $true)][datetime]$Now)
    $r = ($Reason -replace '[\x00-\x1f\x7f]', ' ').Trim(); if ($r.Length -gt 128) { $r = $r.Substring(0, 128) }
    if (-not $r) { throw 'a local hold needs a reason' }
    Write-DEPauseState -Dir $Dir -Body ([ordered]@{ source = 'local'; reason = $r; since = (ConvertTo-DEPauseTime $Now) })
    return (Get-DEPauseState -Dir $Dir)
}

function Clear-DELocalHold {
    <# Removes a local hold, or repairs an unreadable pause state. It refuses to clear a Hub pause: only the Hub resumes. #>
    param([Parameter(Mandatory = $true)][string]$Dir)
    $cur = Get-DEPauseState -Dir $Dir
    if (-not $cur.Paused) { return $cur }
    if ($cur.Source -eq 'hub') { throw 'a Hub pause is lifted by the Hub, not at the device' }
    Remove-Item -LiteralPath (Get-DEPauseFile -Dir $Dir) -Force
    return (Get-DEPauseState -Dir $Dir)
}

function Resolve-DEPauseAnswer {
    <#
        Applies the Hub's answer to a lease request to the pause state. 423 records a pause. Any other answer from the Hub that is a
        real verdict on delivery (200 a job, 204 nothing to do) means the pause is over, and clears a Hub pause. A refusal, a rate limit
        or a failure says nothing about the pause, so the state is left as it is. A local hold is never cleared by the Hub.
    #>
    param([Parameter(Mandatory = $true)][string]$Dir, [Parameter(Mandatory = $true)][int]$HttpStatus, [int]$RetryAfterSeconds = 0, [Parameter(Mandatory = $true)][datetime]$Now)
    if ($HttpStatus -eq 423) { return (Register-DEHubPause -Dir $Dir -RetryAfterSeconds $RetryAfterSeconds -Now $Now) }
    $cur = Get-DEPauseState -Dir $Dir
    if (($HttpStatus -eq 200 -or $HttpStatus -eq 204) -and $cur.Paused -and $cur.Source -eq 'hub') {
        Remove-Item -LiteralPath (Get-DEPauseFile -Dir $Dir) -Force
        return (Get-DEPauseState -Dir $Dir)
    }
    return $cur
}

function Get-DEPauseDecision {
    <#
        May the agent do -Operation now? Operations: lease and run (WORK: stopped by a pause), and renew, heartbeat, evidence and report
        (never stopped: identity, visibility and honest reporting outlive a pause). For lease, Probe is true when a Hub pause has reached its
        time to ask again: the agent may send ONE lease request, and the Hub's answer decides. Codes: paused, local_hold, pause_state_unreadable.
    #>
    param([Parameter(Mandatory = $true)][string]$Dir, [Parameter(Mandatory = $true)][ValidateSet('lease', 'run', 'renew', 'heartbeat', 'evidence', 'report')][string]$Operation, [Parameter(Mandatory = $true)][datetime]$Now)
    $d = { param($allowed, $code, $why, $probe) [pscustomobject]@{ Allowed = $allowed; Code = $code; Why = $why; Probe = $probe } }
    if (@('renew', 'heartbeat', 'evidence', 'report') -contains $Operation) { return (& $d $true '' 'a pause stops work, not identity, visibility or reporting' $false) }
    $s = Get-DEPauseState -Dir $Dir
    if (-not $s.Paused) { return (& $d $true '' 'not paused' $false) }
    if ($s.Source -eq 'unreadable') { return (& $d $false 'pause_state_unreadable' 'the pause state cannot be read, so nothing runs' $false) }
    if ($s.Source -eq 'local') { return (& $d $false 'local_hold' "held at the device: $($s.Reason)" $false) }
    if ($Operation -eq 'lease' -and $Now.ToUniversalTime() -ge $s.RetryAt) { return (& $d $true '' 'the Hub pause has reached its time to ask again: one request, and the Hub decides' $true) }
    return (& $d $false 'paused' 'the Hub has paused delivery' $false)
}

function Invoke-DEActionSequence {
    <#
        Runs -Actions in order through -Handler (called as & $Handler $actionId, returning Ok and Result, or throwing). Before EVERY action,
        the first included, it asks whether it may continue: not paused (Get-DEPauseDecision run), and -ShouldCancel (a scriptblock, true when the
        Hub or technician asked this job to stop) is false. The action in flight is never interrupted; the next one does not start. The first
        failure stops the job (a half-applied run is not carried on). Returns Status (succeeded, failed, cancelled, paused), Completed, NotRun and Why.
    #>
    param(
        [Parameter(Mandatory = $true)][string[]]$Actions, [Parameter(Mandatory = $true)][scriptblock]$Handler, [Parameter(Mandatory = $true)][string]$Dir,
        [scriptblock]$ShouldCancel = { $false }, [scriptblock]$Clock = { [datetime]::UtcNow }
    )
    $done = New-Object System.Collections.Generic.List[object]
    for ($i = 0; $i -lt $Actions.Count; $i++) {
        $rest = @($Actions[$i..($Actions.Count - 1)])
        $dec = Get-DEPauseDecision -Dir $Dir -Operation 'run' -Now (& $Clock)
        if (-not $dec.Allowed) { return [pscustomobject]@{ Status = 'paused'; Completed = $done.ToArray(); NotRun = $rest; Why = "$($dec.Code): $($dec.Why)" } }
        $cancel = $false
        try { $cancel = [bool](& $ShouldCancel) } catch { $cancel = $true }
        if ($cancel) { return [pscustomobject]@{ Status = 'cancelled'; Completed = $done.ToArray(); NotRun = $rest; Why = 'the job was asked to stop' } }
        $r = $null
        try { $r = & $Handler $Actions[$i] } catch { $r = [pscustomobject]@{ Ok = $false; Result = "threw: $($_.Exception.Message)" } }
        $done.Add([pscustomobject]@{ Id = $Actions[$i]; Ok = [bool]$r.Ok; Result = "$($r.Result)" })
        if (-not [bool]$r.Ok) { return [pscustomobject]@{ Status = 'failed'; Completed = $done.ToArray(); NotRun = @($Actions | Select-Object -Skip ($i + 1)); Why = "action '$($Actions[$i])' failed" } }
    }
    return [pscustomobject]@{ Status = 'succeeded'; Completed = $done.ToArray(); NotRun = @(); Why = '' }
}

Export-ModuleMember -Function Get-DEPauseState, Register-DEHubPause, Set-DELocalHold, Clear-DELocalHold, Resolve-DEPauseAnswer, Get-DEPauseDecision, Invoke-DEActionSequence
