# Move 78: "Add a global kill switch that halts all agent jobs" (#796).
#
# The Hub half (the pause table, the 423 answer, fail closed when the pause state cannot be read) is the move 60 design and is not built.
# This is the DEVICE half, DE.AgentPause, and the suite pins what makes a pause actually stop something (AGENT-THREAT-MODEL.md D5, E5):
#   - a 423 is recorded on disk with a bounded time to ask again; while paused there is no lease and no run;
#   - the device never un-pauses itself: after the time has passed it may send ONE request, and the Hub's answer decides;
#   - a job in flight stops BEFORE THE NEXT ACTION, never mid-action, and a pause that lands mid-job stops it with the rest not run;
#   - an unreadable pause state is a pause (fail closed);
#   - a local hold has no timer, the Hub cannot lift it, and a Hub pause cannot be lifted at the device;
#   - a pause stops work only: heartbeat, renewal, evidence and reporting carry on.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentPause: a pause stops work, fails closed, and is lifted only by the right party' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentPause.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-pause-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:T0 = [datetime]::SpecifyKind([datetime]'2026-11-01T12:00:00', 'Utc')
        function script:New-PauseDir { return (Join-Path $script:Work ([guid]::NewGuid().ToString('N'))) }
        function script:Test-May { param($Dir, $Op = 'lease', [int]$Seconds = 0) return (Get-DEPauseDecision -Dir $Dir -Operation $Op -Now $script:T0.AddSeconds($Seconds)) }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'not paused' {
        It 'a device with no pause file may lease and run' {
            $dir = New-PauseDir
            (Get-DEPauseState -Dir $dir).Paused | Should -Be $false
            (Test-May -Dir $dir -Op 'lease').Allowed | Should -Be $true
            (Test-May -Dir $dir -Op 'run').Allowed | Should -Be $true
        }
    }

    Context 'the Hub says 423' {
        It 'records the pause, stops lease and run, and writes it to disk' {
            $dir = New-PauseDir
            $s = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 600 -Now $script:T0
            $s.Paused | Should -Be $true
            $s.Source | Should -Be 'hub'
            $s.RetryAt | Should -Be $script:T0.AddSeconds(600)
            foreach ($op in @('lease', 'run')) {
                $d = Test-May -Dir $dir -Op $op -Seconds 10
                $d.Allowed | Should -Be $false
                $d.Code | Should -Be 'paused'
            }
            Test-Path -LiteralPath (Join-Path $dir 'pause.json') | Should -Be $true
            Test-Path -LiteralPath (Join-Path $dir 'pause.json.tmp') | Should -Be $false
        }
        It 'survives a restart: it is on disk' {
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 600 -Now $script:T0
            Import-Module (Join-Path $script:Win 'agent\DE.AgentPause.psm1') -Force
            (Test-May -Dir $dir -Op 'lease' -Seconds 10).Allowed | Should -Be $false
        }
        It 'bounds the time to ask again: at least 30 s, at most an hour, and 5 minutes when the Hub gave none' -TestCases @(
            @{ given = 1; expect = 30 }
            @{ given = 600; expect = 600 }
            @{ given = 999999; expect = 3600 }
            @{ given = 0; expect = 300 }
            @{ given = -5; expect = 300 }
        ) {
            param($given, $expect)
            $s = Resolve-DEPauseAnswer -Dir (New-PauseDir) -HttpStatus 423 -RetryAfterSeconds $given -Now $script:T0
            $s.RetryAt | Should -Be $script:T0.AddSeconds($expect)
        }
        It 'a second 423 moves the time to ask again but keeps when the pause began' {
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 60 -Now $script:T0
            $s = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 60 -Now $script:T0.AddSeconds(100)
            $s.Since | Should -Be $script:T0
            $s.RetryAt | Should -Be $script:T0.AddSeconds(160)
        }
    }

    Context 'the device never un-pauses itself' {
        It 'before the time to ask again there is no request; at it, exactly one probe is allowed, still not a run' {
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0
            (Test-May -Dir $dir -Op 'lease' -Seconds 299).Allowed | Should -Be $false
            $probe = Test-May -Dir $dir -Op 'lease' -Seconds 300
            $probe.Allowed | Should -Be $true
            $probe.Probe | Should -Be $true
            (Test-May -Dir $dir -Op 'run' -Seconds 3000).Allowed | Should -Be $false -Because 'the time passing never lets a job run: only the Hub lifts a pause'
        }
        It 'a probe answered 423 again stays paused with a new time to ask' {
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0.AddSeconds(300)
            (Test-May -Dir $dir -Op 'lease' -Seconds 301).Allowed | Should -Be $false
            (Test-May -Dir $dir -Op 'lease' -Seconds 600).Probe | Should -Be $true
        }
        It 'a probe answered with a job or with nothing to do ends the pause' -TestCases @(
            @{ status = 200 }
            @{ status = 204 }
        ) {
            param($status)
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus $status -Now $script:T0.AddSeconds(301)).Paused | Should -Be $false
            (Test-May -Dir $dir -Op 'run' -Seconds 302).Allowed | Should -Be $true
        }
        It 'a refusal, a rate limit or a failure says nothing about the pause, so it stays' -TestCases @(
            @{ status = 403 }
            @{ status = 429 }
            @{ status = 500 }
            @{ status = 0 }
            @{ status = 401 }
        ) {
            param($status)
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus $status -Now $script:T0.AddSeconds(301)).Paused | Should -Be $true
        }
        It 'a success answer when nothing is paused changes nothing' {
            $dir = New-PauseDir
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus 200 -Now $script:T0).Paused | Should -Be $false
            Test-Path -LiteralPath (Join-Path $dir 'pause.json') | Should -Be $false
        }
    }

    Context 'fail closed' {
        It 'a pause state that cannot be read is a pause, with no probe, for lease and run' -TestCases @(
            @{ text = 'garbage {' }
            @{ text = '{"source":"somebody","since":"2026-11-01T12:00:00Z"}' }
            @{ text = '{"source":"hub","since":"yesterday","retryAt":"soon"}' }
            @{ text = '' }
            @{ text = '[]' }
        ) {
            param($text)
            $dir = New-PauseDir; New-Item -ItemType Directory -Path $dir -Force | Out-Null
            [IO.File]::WriteAllText((Join-Path $dir 'pause.json'), $text)
            (Get-DEPauseState -Dir $dir).Source | Should -Be 'unreadable'
            foreach ($op in @('lease', 'run')) {
                $d = Test-May -Dir $dir -Op $op -Seconds 999999
                $d.Allowed | Should -Be $false
                $d.Code | Should -Be 'pause_state_unreadable'
                $d.Probe | Should -Be $false
            }
        }
        It 'an unreadable state is not repaired by a Hub 200 or 204, only at the device' {
            $dir = New-PauseDir; New-Item -ItemType Directory -Path $dir -Force | Out-Null
            [IO.File]::WriteAllText((Join-Path $dir 'pause.json'), 'garbage {')
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus 200 -Now $script:T0).Source | Should -Be 'unreadable'
            (Clear-DELocalHold -Dir $dir).Paused | Should -Be $false
            (Test-May -Dir $dir -Op 'run').Allowed | Should -Be $true
        }
    }

    Context 'a local hold' {
        It 'has no timer, and the Hub can neither replace nor lift it' {
            $dir = New-PauseDir
            $h = Set-DELocalHold -Dir $dir -Reason 'customer asked us to stop' -Now $script:T0
            $h.Source | Should -Be 'local'
            $h.RetryAt | Should -BeNullOrEmpty
            $d = Test-May -Dir $dir -Op 'lease' -Seconds 999999
            $d.Allowed | Should -Be $false
            $d.Code | Should -Be 'local_hold'
            $d.Probe | Should -Be $false
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus 200 -Now $script:T0.AddSeconds(5)).Source | Should -Be 'local'
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus 204 -Now $script:T0.AddSeconds(5)).Paused | Should -Be $true
            (Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 60 -Now $script:T0.AddSeconds(5)).Source | Should -Be 'local' -Because 'a Hub pause must not replace a local hold, or the Hub could lift it later'
        }
        It 'is cleared only by an explicit local clear' {
            $dir = New-PauseDir
            $null = Set-DELocalHold -Dir $dir -Reason 'x' -Now $script:T0
            (Clear-DELocalHold -Dir $dir).Paused | Should -Be $false
            (Test-May -Dir $dir -Op 'run').Allowed | Should -Be $true
        }
        It 'needs a reason, flattened and bounded' {
            { Set-DELocalHold -Dir (New-PauseDir) -Reason '  ' -Now $script:T0 } | Should -Throw
            $s = Set-DELocalHold -Dir (New-PauseDir) -Reason ("line1`nline2 " + ('x' * 300)) -Now $script:T0
            $s.Reason | Should -Not -Match '[\x00-\x1f]'
            $s.Reason.Length | Should -BeLessOrEqual 128
        }
        It 'a Hub pause cannot be lifted at the device: only the Hub resumes' {
            $dir = New-PauseDir
            $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -RetryAfterSeconds 300 -Now $script:T0
            { Clear-DELocalHold -Dir $dir } | Should -Throw
            (Get-DEPauseState -Dir $dir).Paused | Should -Be $true
        }
    }

    Context 'a pause stops work, not identity, visibility or reporting' {
        It '<op> stays allowed under a Hub pause, a local hold and an unreadable state' -TestCases @(
            @{ op = 'renew' }
            @{ op = 'heartbeat' }
            @{ op = 'evidence' }
            @{ op = 'report' }
        ) {
            param($op)
            $a = New-PauseDir; $null = Resolve-DEPauseAnswer -Dir $a -HttpStatus 423 -Now $script:T0
            $b = New-PauseDir; $null = Set-DELocalHold -Dir $b -Reason 'x' -Now $script:T0
            $c = New-PauseDir; New-Item -ItemType Directory -Path $c -Force | Out-Null; [IO.File]::WriteAllText((Join-Path $c 'pause.json'), 'garbage')
            foreach ($d in @($a, $b, $c)) { (Test-May -Dir $d -Op $op).Allowed | Should -Be $true }
        }
    }

    Context 'a job stops before its next action, never in the middle of one' {
        BeforeAll {
            $script:Ran = New-Object System.Collections.Generic.List[string]
            $script:Handler = { param($id) $script:Ran.Add($id); [pscustomobject]@{ Ok = $true; Result = 'PASS' } }
        }
        BeforeEach { $script:Ran.Clear() }
        It 'runs every action when nothing intervenes' {
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two', 'a.three') -Handler $script:Handler -Dir (New-PauseDir) -Clock { $script:T0 }
            $r.Status | Should -Be 'succeeded'
            ($script:Ran -join ',') | Should -Be 'a.one,a.two,a.three'
            @($r.NotRun).Count | Should -Be 0
        }
        It 'a pause already in force means not even the first action runs' {
            $dir = New-PauseDir; $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -Now $script:T0
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two') -Handler $script:Handler -Dir $dir -Clock { $script:T0 }
            $r.Status | Should -Be 'paused'
            $script:Ran.Count | Should -Be 0
            ($r.NotRun -join ',') | Should -Be 'a.one,a.two'
        }
        It 'a pause that lands DURING an action lets that action finish and stops the rest' {
            $dir = New-PauseDir
            $log = $script:Ran; $now = $script:T0
            $h = { param($id) $log.Add($id); if ($id -eq 'a.two') { $null = Resolve-DEPauseAnswer -Dir $dir -HttpStatus 423 -Now $now }; [pscustomobject]@{ Ok = $true; Result = 'PASS' } }.GetNewClosure()
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two', 'a.three', 'a.four') -Handler $h -Dir $dir -Clock { $script:T0 }
            $r.Status | Should -Be 'paused'
            ($script:Ran -join ',') | Should -Be 'a.one,a.two' -Because 'the action in flight finishes; the next one does not start'
            (@($r.Completed | ForEach-Object { $_.Id }) -join ',') | Should -Be 'a.one,a.two'
            ($r.NotRun -join ',') | Should -Be 'a.three,a.four'
            $r.Why | Should -Match 'paused'
        }
        It 'a cancel stops it the same way, and a cancel check that throws counts as a cancel' {
            $script:n2 = 0
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two', 'a.three') -Handler $script:Handler -Dir (New-PauseDir) -Clock { $script:T0 } -ShouldCancel { $script:n2++; $script:n2 -gt 1 }
            $r.Status | Should -Be 'cancelled'
            ($script:Ran -join ',') | Should -Be 'a.one'
            ($r.NotRun -join ',') | Should -Be 'a.two,a.three'
            $script:Ran.Clear()
            $r2 = Invoke-DEActionSequence -Actions @('a.one') -Handler $script:Handler -Dir (New-PauseDir) -Clock { $script:T0 } -ShouldCancel { throw 'cannot tell' }
            $r2.Status | Should -Be 'cancelled'
            $script:Ran.Count | Should -Be 0
        }
        It 'the first failure stops the job and leaves the rest not run' {
            $h = { param($id) $script:Ran.Add($id); [pscustomobject]@{ Ok = ($id -ne 'a.two'); Result = $(if ($id -eq 'a.two') { 'FAIL' } else { 'PASS' }) } }
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two', 'a.three') -Handler $h -Dir (New-PauseDir) -Clock { $script:T0 }
            $r.Status | Should -Be 'failed'
            ($script:Ran -join ',') | Should -Be 'a.one,a.two'
            ($r.NotRun -join ',') | Should -Be 'a.three'
        }
        It 'a handler that throws is a failure, not a crash' {
            $r = Invoke-DEActionSequence -Actions @('a.one', 'a.two') -Handler { param($id) throw 'boom' } -Dir (New-PauseDir) -Clock { $script:T0 }
            $r.Status | Should -Be 'failed'
            $r.Completed[0].Result | Should -Match 'boom'
        }
        It 'an unreadable pause state stops the job too (fail closed)' {
            $dir = New-PauseDir; New-Item -ItemType Directory -Path $dir -Force | Out-Null; [IO.File]::WriteAllText((Join-Path $dir 'pause.json'), 'garbage')
            $r = Invoke-DEActionSequence -Actions @('a.one') -Handler $script:Handler -Dir $dir -Clock { $script:T0 }
            $r.Status | Should -Be 'paused'
            $r.Why | Should -Match 'pause_state_unreadable'
            $script:Ran.Count | Should -Be 0
        }
    }

    Context 'the whole story across a fleet' {
        It 'every device in a pause stops, none runs anything, and every device resumes only on the Hub''s say-so' {
            $dirs = 1..25 | ForEach-Object { New-PauseDir }
            foreach ($d in $dirs) { $null = Resolve-DEPauseAnswer -Dir $d -HttpStatus 423 -RetryAfterSeconds 120 -Now $script:T0 }
            $ran = 0
            foreach ($d in $dirs) { $r = Invoke-DEActionSequence -Actions @('a.one') -Handler { param($id) $script:Ran2++; [pscustomobject]@{ Ok = $true; Result = 'PASS' } } -Dir $d -Clock { $script:T0.AddSeconds(60) }; if ($r.Status -ne 'paused') { $ran++ } }
            $ran | Should -Be 0
            foreach ($d in $dirs) { (Test-May -Dir $d -Op 'lease' -Seconds 121).Probe | Should -Be $true }
            foreach ($d in $dirs) { (Resolve-DEPauseAnswer -Dir $d -HttpStatus 204 -Now $script:T0.AddSeconds(121)).Paused | Should -Be $false }
            foreach ($d in $dirs) { (Test-May -Dir $d -Op 'run' -Seconds 122).Allowed | Should -Be $true }
        }
    }

    Context 'the document' {
        BeforeAll {
            $script:Doc = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-KILL-SWITCH.md'))
            $script:Flat = $script:Doc -replace '\s+', ' '
        }
        It 'says plainly that the Hub half is not built and needs a Hub pull request' {
            $script:Flat | Should -Match 'The Hub half is\s+specified in the job queue design'
            $script:Flat | Should -Match '\*\*not built\*\*'
            $script:Flat | Should -Match 'Intelligence-Hub'
        }
        It 'every function the document names is exported by the module' {
            $exported = @((Get-Module DE.AgentPause).ExportedFunctions.Keys)
            $named = @([regex]::Matches($script:Doc, '`((?:Invoke|Test|Get|Set|Clear|Register|Resolve)-DE\w+)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
            $named.Count | Should -BeGreaterThan 3
            foreach ($n in $named) { $exported | Should -Contain $n }
        }
        It 'states the bounds the code enforces, and that a pause stops work only' {
            $script:Flat | Should -Match 'bounded to 30 seconds \.\. 1 hour, and 5 minutes when the Hub gave none'
            $script:Flat | Should -Match 'A pause stops work and nothing else'
            $script:Flat | Should -Match 'The device never lifts a Hub pause'
            $script:Flat | Should -Match 'unknown never means go'
        }
        It 'every local link resolves' {
            $missing = New-Object System.Collections.Generic.List[string]
            foreach ($m in [regex]::Matches($script:Doc, '\]\(([A-Za-z0-9._-]+\.md)\)')) { if (-not (Test-Path -LiteralPath (Join-Path $script:Win $m.Groups[1].Value))) { $missing.Add($m.Groups[1].Value) } }
            ($missing -join ', ') | Should -BeNullOrEmpty
        }
    }
}