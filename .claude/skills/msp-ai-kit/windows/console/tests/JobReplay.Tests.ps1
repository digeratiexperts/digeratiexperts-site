# Move 66: "Keep a replay store of nonces on the device" (#784).
#
# DE.AgentReplay is where the agent remembers which job nonces it has already accepted (AGENT-THREAT-MODEL.md S4).
# The suite pins the behaviours a replay store lives or dies by:
#   - a nonce is accepted once, and the second attempt is replayed_nonce - on disk, so it survives a restart;
#   - the record is durable before the job runs (the line is on disk when Register returns);
#   - two callers racing for one nonce: exactly one wins, and nobody sees an IO error;
#   - the store is bounded and NEVER evicts a live nonce: full of live nonces means refuse (replay_store_full);
#   - expired entries are forgotten only after expiry plus skew, and pruning makes room;
#   - damage: a torn last line from a crash is repaired and the store carries on; any other bad line, or a file
#     that cannot be read, refuses (replay_store_unreadable) - damaged is never read as empty;
#   - malformed nonces are refused before they can put a hostile line in the file.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentReplay: a job nonce is accepted once, and the store fails closed' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:ModulePath = Join-Path $script:Win 'agent\DE.AgentReplay.psm1'
        Import-Module $script:ModulePath -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-replay-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:Now = [datetime]::SpecifyKind([datetime]'2026-11-01T12:05:00', 'Utc')
        $script:Exp = [datetime]::SpecifyKind([datetime]'2026-11-01T12:10:00', 'Utc')
        function script:New-DENonce { param([int]$N) return ('n{0:D21}' -f $N) }
        function script:New-StorePath { return (Join-Path $script:Work ([guid]::NewGuid().ToString('N') + '\nonces.txt')) }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'accepted once, durably' {
        It 'accepts a nonce the first time and refuses it the second (replayed_nonce)' {
            $p = New-StorePath
            $a = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            $a.Ok | Should -Be $true -Because $a.Why
            $b = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            $b.Ok | Should -Be $false
            $b.Code | Should -Be 'replayed_nonce'
        }
        It 'a different nonce is independent, and nonces are case-sensitive' {
            $p = New-StorePath
            (Register-DEJobNonce -Path $p -Nonce 'AbCdEfGhIjKlMnOpQrStUv' -ExpiresAt $script:Exp -Now $script:Now).Ok | Should -Be $true
            (Register-DEJobNonce -Path $p -Nonce 'abcdefghijklmnopqrstuv' -ExpiresAt $script:Exp -Now $script:Now).Ok | Should -Be $true -Because 'base64url is case-sensitive'
            (Register-DEJobNonce -Path $p -Nonce 'AbCdEfGhIjKlMnOpQrStUv' -ExpiresAt $script:Exp -Now $script:Now).Code | Should -Be 'replayed_nonce'
        }
        It 'is on disk when Register returns, so a restart cannot forget it' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 7) -ExpiresAt $script:Exp -Now $script:Now
            (Get-Content -LiteralPath $p -Raw) | Should -Match ('N1 2026-11-01T12:10:00\.000Z ' + (New-DENonce 7) + "`n")
            Import-Module $script:ModulePath -Force
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 7) -ExpiresAt $script:Exp -Now $script:Now).Code | Should -Be 'replayed_nonce'
        }
        It 'reports what it holds without exposing the nonces' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 2) -ExpiresAt $script:Exp.AddMinutes(1) -Now $script:Now
            $s = Get-DEReplayStoreStatus -Path $p
            $s.Readable | Should -Be $true
            $s.Count | Should -Be 2
            $s.Latest | Should -Be $script:Exp.AddMinutes(1)
            ($s | ConvertTo-Json -Compress) | Should -Not -Match (New-DENonce 1)
        }
        It 'two callers racing for one nonce: exactly one wins and nobody sees an IO error' {
            $p = New-StorePath
            $null = New-Item -ItemType Directory -Path (Split-Path -Parent $p) -Force
            $pool = [runspacefactory]::CreateRunspacePool(1, 8); $pool.Open()
            $jobs = foreach ($i in 1..8) {
                $ps = [powershell]::Create(); $ps.RunspacePool = $pool
                $null = $ps.AddScript({ param($mod, $path, $nonce, $exp, $now) Import-Module $mod -Force; Register-DEJobNonce -Path $path -Nonce $nonce -ExpiresAt $exp -Now $now }).AddArgument($script:ModulePath).AddArgument($p).AddArgument((New-DENonce 99)).AddArgument($script:Exp).AddArgument($script:Now)
                [pscustomobject]@{ Ps = $ps; Handle = $ps.BeginInvoke() }
            }
            $results = foreach ($j in $jobs) { $j.Ps.EndInvoke($j.Handle); $j.Ps.Dispose() }
            $pool.Close()
            @($results | Where-Object { $_.Ok }).Count | Should -Be 1 -Because 'one registration wins the race'
            @($results | Where-Object { $_.Code -eq 'replayed_nonce' }).Count | Should -Be 7
            @(Get-Content -LiteralPath $p).Count | Should -Be 1
        }
    }

    Context 'bounded, and never evicting a live nonce' {
        It 'refuses new jobs when the store is full of live nonces (replay_store_full)' {
            $p = New-StorePath
            foreach ($i in 1..3) { (Register-DEJobNonce -Path $p -Nonce (New-DENonce $i) -ExpiresAt $script:Exp -Now $script:Now -MaxEntries 3).Ok | Should -Be $true }
            $r = Register-DEJobNonce -Path $p -Nonce (New-DENonce 4) -ExpiresAt $script:Exp -Now $script:Now -MaxEntries 3
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'replay_store_full'
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now -MaxEntries 3).Code | Should -Be 'replayed_nonce' -Because 'a full store must still remember every live nonce'
        }
        It 'forgets a nonce only after its expiry plus the skew, and then has room again' {
            $p = New-StorePath
            foreach ($i in 1..3) { $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce $i) -ExpiresAt $script:Exp -Now $script:Now -MaxEntries 3 }
            $inSkew = $script:Exp.AddSeconds(299)
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 4) -ExpiresAt $inSkew.AddMinutes(10) -Now $inSkew -MaxEntries 3).Code | Should -Be 'replay_store_full' -Because 'inside the skew the old jobs are not yet safely forgotten'
            $after = $script:Exp.AddSeconds(301)
            $r = Register-DEJobNonce -Path $p -Nonce (New-DENonce 4) -ExpiresAt $after.AddMinutes(10) -Now $after -MaxEntries 3
            $r.Ok | Should -Be $true -Because $r.Why
            $r.Count | Should -Be 1 -Because 'the three expired nonces were dropped'
            @(Get-Content -LiteralPath $p).Count | Should -Be 1
        }
        It 'Clear-DEExpiredNonces drops only the expired and reports how many' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 2) -ExpiresAt $script:Exp.AddHours(1) -Now $script:Now
            (Clear-DEExpiredNonces -Path $p -Now $script:Exp.AddMinutes(30)) | Should -Be 1
            (Get-DEReplayStoreStatus -Path $p).Count | Should -Be 1
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 2) -ExpiresAt $script:Exp.AddHours(1) -Now $script:Exp.AddMinutes(30)).Code | Should -Be 'replayed_nonce'
        }
    }

    Context 'damage: one kind is repaired, the rest refuses' {
        It 'repairs a torn last line left by a crash and carries on' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            [IO.File]::AppendAllText($p, 'N1 2026-11-01T12:1')
            $r = Register-DEJobNonce -Path $p -Nonce (New-DENonce 2) -ExpiresAt $script:Exp -Now $script:Now
            $r.Ok | Should -Be $true -Because $r.Why
            $lines = @(Get-Content -LiteralPath $p)
            $lines.Count | Should -Be 2
            ($lines | Where-Object { $_ -notmatch '^N1 \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z [A-Za-z0-9_-]{22,86}$' }).Count | Should -Be 0
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now).Code | Should -Be 'replayed_nonce' -Because 'the nonce before the torn line is still remembered'
        }
        It 'a last line that parses but has no newline is rewritten cleanly, so the next append cannot glue onto it' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            [IO.File]::AppendAllText($p, ('N1 2026-11-01T12:10:00.000Z ' + (New-DENonce 5)))
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 6) -ExpiresAt $script:Exp -Now $script:Now).Ok | Should -Be $true
            @(Get-Content -LiteralPath $p).Count | Should -Be 3
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 5) -ExpiresAt $script:Exp -Now $script:Now).Code | Should -Be 'replayed_nonce'
        }
        It 'refuses on a bad line that is not the last (replay_store_unreadable), and never treats damage as empty' {
            $p = New-StorePath
            $null = Register-DEJobNonce -Path $p -Nonce (New-DENonce 1) -ExpiresAt $script:Exp -Now $script:Now
            [IO.File]::AppendAllText($p, "this is not an entry`nN1 2026-11-01T12:10:00.000Z $(New-DENonce 2)`n")
            $r = Register-DEJobNonce -Path $p -Nonce (New-DENonce 3) -ExpiresAt $script:Exp -Now $script:Now
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'replay_store_unreadable'
            (Get-DEReplayStoreStatus -Path $p).Readable | Should -Be $false
            { Clear-DEExpiredNonces -Path $p -Now $script:Now } | Should -Throw
        }
        It 'refuses a store that is not even text it can parse as entries (a tampered line)' {
            $p = New-StorePath
            $null = New-Item -ItemType Directory -Path (Split-Path -Parent $p) -Force
            [IO.File]::WriteAllText($p, "N1 2026-11-01T12:10:00.000Z short`nN1 2026-11-01T12:10:00.000Z $(New-DENonce 2)`n")
            (Register-DEJobNonce -Path $p -Nonce (New-DENonce 3) -ExpiresAt $script:Exp -Now $script:Now).Code | Should -Be 'replay_store_unreadable'
        }
    }

    Context 'malformed nonces never reach the file' {
        It 'refuses <why> (schema)' -TestCases @(
            @{ why = 'an empty nonce'; nonce = '' }
            @{ why = 'a short nonce'; nonce = 'tiny' }
            @{ why = 'a nonce with a space'; nonce = 'aaaaaaaaaaaaaaaaaaaa aa' }
            @{ why = 'a nonce with a newline'; nonce = "aaaaaaaaaaaaaaaaaaaaaa`nN1 2026-11-01T12:10:00.000Z bbbbbbbbbbbbbbbbbbbbbb" }
            @{ why = 'a nonce with a path separator'; nonce = 'aaaaaaaaaaaaaaaaaaaaa/..' }
            @{ why = 'a nonce that is too long'; nonce = ('a' * 87) }
        ) {
            param($why, $nonce)
            $p = New-StorePath
            $r = Register-DEJobNonce -Path $p -Nonce $nonce -ExpiresAt $script:Exp -Now $script:Now
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'schema'
            Test-Path -LiteralPath $p | Should -Be $false -Because 'a refused nonce writes nothing'
        }
    }
}
