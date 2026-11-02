# Move 70: "Upload evidence with resumable retries and idempotency keys" (#788).
#
# DE.AgentEvidence moves a bundle off the device in acknowledged chunks (AGENT-THREAT-MODEL.md D1, T4, R1). A fake Hub in
# these tests keeps what it is sent, so the suite can prove the properties that matter end to end:
#   - the Hub reassembles exactly the bytes that were sent, and the idempotency key is stable per job and bundle;
#   - an interruption costs at most one chunk: the next attempt resumes where the Hub last said yes and sends only the rest;
#   - retries back off exponentially and are bounded, and a conflict is never retried;
#   - a finished upload is never sent again, and a file that changed since the upload began starts over under a new key;
#   - nothing leaves unredacted, recovery-shaped, oversized or missing, and the saved state holds hashes and counts only.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentEvidence: resumable, idempotent, and redacted before it leaves' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentEvidence.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-evidence-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:Job = '0b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f'
        $script:Chunk = 262144
        $script:NoSleep = { param($ms) }

        function script:New-TestFile {
            param([int]$Bytes, [string]$Name = ([guid]::NewGuid().ToString('N') + '.bin'))
            $p = Join-Path $script:Work $Name
            $b = New-Object byte[] $Bytes; (New-Object Random 42).NextBytes($b)
            [IO.File]::WriteAllBytes($p, $b)
            return $p
        }
        # a fake Hub: keeps chunks by key, can be told to fail, conflict or call a hook; Calls counts every request it saw
        function script:New-FakeHub {
            param([int]$FailFromIndex = -1, [string]$Answer = 'ok', [int]$FailTimes = 0)
            $hub = [pscustomobject]@{ Chunks = @{}; Completed = @{}; Calls = 0; Requests = (New-Object System.Collections.Generic.List[object]); FailFromIndex = $FailFromIndex; Answer = $Answer; FailTimes = $FailTimes; Failed = 0 }
            $hub | Add-Member -NotePropertyName Transport -NotePropertyValue ({
                    param($r)
                    $hub.Calls++
                    $hub.Requests.Add($r)
                    if ($hub.FailFromIndex -ge 0 -and $r.Kind -eq 'chunk' -and $r.Index -ge $hub.FailFromIndex) { throw 'network down' }
                    if ($hub.Failed -lt $hub.FailTimes) { $hub.Failed++; throw 'transient' }
                    if ($hub.Answer -ne 'ok') { return [pscustomobject]@{ Status = $hub.Answer } }
                    if ($r.Kind -eq 'chunk') {
                        if (-not $hub.Chunks.ContainsKey($r.Key)) { $hub.Chunks[$r.Key] = @{} }
                        $hub.Chunks[$r.Key][$r.Index] = $r.Bytes
                    } else { $hub.Completed[$r.Key] = $true }
                    return [pscustomobject]@{ Status = 'ok' }
                }.GetNewClosure())
            return $hub
        }
        function script:Join-HubBytes {
            param($Hub, [string]$Key)
            $ms = New-Object IO.MemoryStream
            foreach ($i in ($Hub.Chunks[$Key].Keys | Sort-Object)) { $b = $Hub.Chunks[$Key][$i]; $ms.Write($b, 0, $b.Length) }
            return , $ms.ToArray()
        }
        function script:Send-Test {
            param($Path, $Hub, [string]$State = (Join-Path $script:Work ([guid]::NewGuid().ToString('N') + '.state')), [switch]$NoRedacted, [int]$MaxAttempts = 5, [scriptblock]$Sleep = $script:NoSleep, [long]$MaxBytes = 67108864)
            return (Send-DEEvidenceFile -Path $Path -JobId $script:Job -StatePath $State -Transport $Hub.Transport -Redacted:(-not $NoRedacted) -ChunkBytes $script:Chunk -MaxAttemptsPerChunk $MaxAttempts -SleepScript $Sleep -MaxBytes $MaxBytes)
        }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'a clean upload' {
        It 'sends the bundle in chunks and the Hub reassembles exactly the bytes sent' {
            $p = New-TestFile -Bytes 600000
            $hub = New-FakeHub
            $r = Send-Test -Path $p -Hub $hub
            $r.Ok | Should -Be $true -Because $r.Code
            $r.Code | Should -Be 'uploaded'
            $r.Sent | Should -Be 3
            $got = Join-HubBytes -Hub $hub -Key $r.Key
            [Convert]::ToBase64String($got) | Should -Be ([Convert]::ToBase64String([IO.File]::ReadAllBytes($p)))
            $hub.Completed.ContainsKey($r.Key) | Should -Be $true
            $hub.Requests[$hub.Requests.Count - 1].Kind | Should -Be 'complete'
        }
        It 'splits on exact boundaries: a file of two full chunks is two chunks' {
            $p = New-TestFile -Bytes (2 * $script:Chunk)
            $hub = New-FakeHub
            $r = Send-Test -Path $p -Hub $hub
            $r.Sent | Should -Be 2
            @($hub.Requests | Where-Object { $_.Kind -eq 'chunk' } | ForEach-Object { $_.Bytes.Length }) -join ',' | Should -Be "$($script:Chunk),$($script:Chunk)"
        }
        It 'an empty file is no chunks and one completion' {
            $p = New-TestFile -Bytes 0
            $hub = New-FakeHub
            $r = Send-Test -Path $p -Hub $hub
            $r.Ok | Should -Be $true
            $r.Sent | Should -Be 0
            $hub.Calls | Should -Be 1
        }
        It 'every chunk carries its own hash, the file hash, its place and the idempotency key' {
            $p = New-TestFile -Bytes 300000
            $hub = New-FakeHub
            $r = Send-Test -Path $p -Hub $hub
            $first = $hub.Requests[0]
            $first.Key | Should -Be $r.Key
            $first.Index | Should -Be 0
            $first.Count | Should -Be 2
            $first.ChunkSha256 | Should -Match '^[a-f0-9]{64}$'
            $first.FileSha256 | Should -Be ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant())
            $hub.Requests[1].Offset | Should -Be $script:Chunk
        }
        It 'treats a duplicate answer as accepted' {
            $p = New-TestFile -Bytes 1000
            (Send-Test -Path $p -Hub (New-FakeHub -Answer 'duplicate')).Ok | Should -Be $true
        }
    }

    Context 'the idempotency key' {
        It 'is stable for a job and bundle, and differs for another job or other content' {
            $a = Get-DEUploadKey -JobId $script:Job -FileSha256 ('a' * 64)
            $a | Should -Match '^[a-f0-9]{64}$'
            (Get-DEUploadKey -JobId $script:Job -FileSha256 ('a' * 64)) | Should -Be $a
            (Get-DEUploadKey -JobId '1b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f' -FileSha256 ('a' * 64)) | Should -Not -Be $a
            (Get-DEUploadKey -JobId $script:Job -FileSha256 ('b' * 64)) | Should -Not -Be $a
        }
    }

    Context 'an interruption costs at most one chunk' {
        It 'resumes where the Hub last said yes and sends only the rest' {
            $p = New-TestFile -Bytes 700000
            $state = Join-Path $script:Work 'resume.state'
            $hub = New-FakeHub -FailFromIndex 2
            $first = Send-Test -Path $p -Hub $hub -State $state -MaxAttempts 2
            $first.Ok | Should -Be $false
            $first.Code | Should -Be 'upload_interrupted'
            $first.Sent | Should -Be 2
            $first.NextChunk | Should -Be 2
            (Get-DEUploadState -StatePath $state).nextChunk | Should -Be 2
            $hub.FailFromIndex = -1
            $before = $hub.Calls
            $second = Send-Test -Path $p -Hub $hub -State $state
            $second.Ok | Should -Be $true
            $second.Resumed | Should -Be $true
            $second.Sent | Should -Be 1 -Because 'only the chunk the Hub never acknowledged is sent'
            ($hub.Calls - $before) | Should -Be 2 -Because 'the missing chunk and the completion, nothing resent'
            [Convert]::ToBase64String((Join-HubBytes -Hub $hub -Key $second.Key)) | Should -Be ([Convert]::ToBase64String([IO.File]::ReadAllBytes($p)))
        }
        It 'a file that changed since the upload began starts over under a new key, never glued to the old chunks' {
            $p = New-TestFile -Bytes 600000
            $state = Join-Path $script:Work 'changed.state'
            $hub = New-FakeHub -FailFromIndex 1
            $first = Send-Test -Path $p -Hub $hub -State $state -MaxAttempts 1
            $first.Code | Should -Be 'upload_interrupted'
            $b = [IO.File]::ReadAllBytes($p); $b[10] = $b[10] -bxor 1; [IO.File]::WriteAllBytes($p, $b)
            $hub.FailFromIndex = -1
            $second = Send-Test -Path $p -Hub $hub -State $state
            $second.Ok | Should -Be $true
            $second.Resumed | Should -Be $false
            $second.Sent | Should -Be 3
            $second.Key | Should -Not -Be $first.Key
            [Convert]::ToBase64String((Join-HubBytes -Hub $hub -Key $second.Key)) | Should -Be ([Convert]::ToBase64String([IO.File]::ReadAllBytes($p)))
        }
        It 'an unreadable state file means start over (the key makes that safe), not fail' {
            $p = New-TestFile -Bytes 1000
            $state = Join-Path $script:Work 'garbage.state'; Set-Content -LiteralPath $state -Value 'not json {'
            (Send-Test -Path $p -Hub (New-FakeHub) -State $state).Ok | Should -Be $true
        }
        It 'the saved state holds hashes and counts only, never the path or the bytes' {
            $p = New-TestFile -Bytes 500000 -Name 'secret-looking-name-do-not-save.bin'
            $state = Join-Path $script:Work 'content.state'
            $null = Send-Test -Path $p -Hub (New-FakeHub) -State $state
            $raw = Get-Content -LiteralPath $state -Raw
            $raw | Should -Not -Match 'secret-looking-name'
            @((Get-DEUploadState -StatePath $state).PSObject.Properties.Name | Sort-Object) -join ',' | Should -Be 'chunkBytes,completed,fileSha256,jobId,key,nextChunk,size'
        }
    }

    Context 'retries are bounded and back off; conflicts are not retried' {
        It 'backs off exponentially between attempts' {
            $p = New-TestFile -Bytes 1000
            $script:Sleeps = New-Object System.Collections.Generic.List[int]
            $sleep = { param($ms) $script:Sleeps.Add($ms) }
            $hub = New-FakeHub -FailTimes 3
            $r = Send-Test -Path $p -Hub $hub -Sleep $sleep
            $r.Ok | Should -Be $true
            ($script:Sleeps -join ',') | Should -Be '500,1000,2000'
        }
        It 'gives up after the attempt limit with the state kept, having called exactly that many times' {
            $p = New-TestFile -Bytes 1000
            $script:Sleeps = New-Object System.Collections.Generic.List[int]
            $hub = New-FakeHub -FailFromIndex 0
            $r = Send-Test -Path $p -Hub $hub -MaxAttempts 3 -Sleep { param($ms) $script:Sleeps.Add($ms) }
            $r.Code | Should -Be 'upload_interrupted'
            $hub.Calls | Should -Be 3
            $script:Sleeps.Count | Should -Be 2 -Because 'no sleep after the last attempt'
        }
        It 'a conflict is reported at once and never retried' {
            $p = New-TestFile -Bytes 1000
            $hub = New-FakeHub -Answer 'conflict'
            $r = Send-Test -Path $p -Hub $hub
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'result_conflict'
            $hub.Calls | Should -Be 1
        }
        It 'a retry answer is retried like a failure' {
            $p = New-TestFile -Bytes 1000
            $hub = New-FakeHub -Answer 'retry'
            (Send-Test -Path $p -Hub $hub -MaxAttempts 2).Code | Should -Be 'upload_interrupted'
            $hub.Calls | Should -Be 2
        }
    }

    Context 'a finished upload is never sent again' {
        It 'a repeat of the same bundle sends nothing and says so' {
            $p = New-TestFile -Bytes 400000
            $state = Join-Path $script:Work 'done.state'
            $hub = New-FakeHub
            $null = Send-Test -Path $p -Hub $hub -State $state
            $calls = $hub.Calls
            $again = Send-Test -Path $p -Hub $hub -State $state
            $again.Ok | Should -Be $true
            $again.Code | Should -Be 'already_uploaded'
            $hub.Calls | Should -Be $calls
        }
    }

    Context 'nothing leaves that should not' {
        It 'refuses a bundle the caller did not say was redacted' {
            $p = New-TestFile -Bytes 1000
            $hub = New-FakeHub
            (Send-Test -Path $p -Hub $hub -NoRedacted).Code | Should -Be 'not_redacted'
            $hub.Calls | Should -Be 0
        }
        It 'refuses a text bundle holding anything shaped like a recovery password, in any form' {
            foreach ($v in @('111111-222222-333333-444444-555555-666666-777777-888888', '111111 222222 333333 444444 555555 666666 777777 888888', '111111222222333333444444555555666666777777888888')) {
                $p = Join-Path $script:Work ([guid]::NewGuid().ToString('N') + '.log')
                Set-Content -LiteralPath $p -Value "line one`nkey $v`nline three"
                $hub = New-FakeHub
                (Send-Test -Path $p -Hub $hub).Code | Should -Be 'recovery_shaped'
                $hub.Calls | Should -Be 0
            }
        }
        It 'refuses an oversized bundle and a missing file' {
            $hub = New-FakeHub
            (Send-Test -Path (New-TestFile -Bytes 5000) -Hub $hub -MaxBytes 1000).Code | Should -Be 'too_large'
            (Send-Test -Path (Join-Path $script:Work 'nope.bin') -Hub $hub).Code | Should -Be 'missing_file'
            $hub.Calls | Should -Be 0
        }
    }
}
