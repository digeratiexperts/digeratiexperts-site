# Move 71: "Queue evidence offline with a size bound; never drop it silently" (#789).
#
# DE.AgentQueue holds evidence on disk, in order, while the Hub is unreachable (AGENT-THREAT-MODEL.md D3, I1). The rule
# the suite exists to protect: evidence is never dropped silently.
#   - the queue is bounded by items and by bytes, and a full queue turns NEW evidence away - it never deletes queued
#     evidence to make room - and every turning-away is logged and counted so the heartbeat can report it;
#   - the queue is FIFO and survives a restart (it is files; there is no in-memory state to lose);
#   - the same job and content queued twice is one item;
#   - an item leaves only when the caller says it was uploaded, and that is logged;
#   - rot, tampering, orphaned data and half-written files are accounted for: partials removed (they were never queued),
#     everything that could be evidence quarantined and counted, never deleted;
#   - metadata holds hashes, sizes, times and a sanitised name: never a path, never content.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentQueue: bounded, ordered, and evidence is never dropped silently' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentQueue.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-queue-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:T0 = [datetime]::SpecifyKind([datetime]'2026-11-01T12:00:00', 'Utc')
        $script:Job = '0b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f'
        $script:Seed = 0
        function script:New-Root { return (Join-Path $script:Work ([guid]::NewGuid().ToString('N'))) }
        function script:New-Evidence {
            param([int]$Bytes = 100, [string]$Name = 'bundle.zip')
            $script:Seed++
            $dir = Join-Path $script:Work ('src' + $script:Seed); New-Item -ItemType Directory -Path $dir -Force | Out-Null
            $p = Join-Path $dir $Name
            $b = New-Object byte[] $Bytes; (New-Object Random $script:Seed).NextBytes($b); [IO.File]::WriteAllBytes($p, $b)
            return $p
        }
        function script:Add-Test { param($Root, $Path, [int]$Minute = 0, [int]$MaxItems = 200, [long]$MaxBytes = 536870912, [string]$Job = $script:Job) return (Add-DEQueuedEvidence -Root $Root -Path $Path -JobId $Job -Now $script:T0.AddMinutes($Minute) -MaxItems $MaxItems -MaxBytes $MaxBytes) }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'queuing, in order' {
        It 'queues a copy of the evidence and lists it oldest first' {
            $root = New-Root
            $a = New-Evidence -Bytes 300; $b = New-Evidence -Bytes 200; $c = New-Evidence -Bytes 100
            $null = Add-Test -Root $root -Path $b -Minute 5
            $null = Add-Test -Root $root -Path $a -Minute 1
            $null = Add-Test -Root $root -Path $c -Minute 9
            $items = @(Get-DEQueuedEvidence -Root $root)
            $items.Count | Should -Be 3
            @($items | ForEach-Object { $_.Size }) -join ',' | Should -Be '300,200,100' -Because 'FIFO by the time each was queued'
            [Convert]::ToBase64String([IO.File]::ReadAllBytes($items[0].DataPath)) | Should -Be ([Convert]::ToBase64String([IO.File]::ReadAllBytes($a)))
        }
        It 'the same job and content queued twice is one item' {
            $root = New-Root
            $p = New-Evidence
            $first = Add-Test -Root $root -Path $p
            $again = Add-Test -Root $root -Path $p -Minute 3
            $again.Code | Should -Be 'already_queued'
            $again.Id | Should -Be $first.Id
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 1
            (Add-Test -Root $root -Path $p -Minute 4 -Job '1b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f').Code | Should -Be 'queued' -Because 'another job is another item'
        }
        It 'metadata holds hashes, sizes, times and a sanitised name, never a path or content' {
            $root = New-Root
            $p = New-Evidence -Name 'my report (final) & more.zip'
            $r = Add-Test -Root $root -Path $p
            $raw = Get-Content -LiteralPath (Join-Path $root "items\$($r.Id).json") -Raw
            $raw | Should -Not -Match ([regex]::Escape((Split-Path -Parent $p)))
            (@(Get-DEQueuedEvidence -Root $root)[0]).Name | Should -Be 'my_report__final____more.zip'
            @(($raw | ConvertFrom-Json).PSObject.Properties.Name | Sort-Object) -join ',' | Should -Be 'fileSha256,id,jobId,name,queuedAt,size'
        }
        It 'refuses a missing file' {
            (Add-Test -Root (New-Root) -Path (Join-Path $script:Work 'nope.zip')).Code | Should -Be 'missing_file'
        }
        It 'survives a restart: it is only files' {
            $root = New-Root
            $null = Add-Test -Root $root -Path (New-Evidence)
            Import-Module (Join-Path $script:Win 'agent\DE.AgentQueue.psm1') -Force
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 1
        }
    }

    Context 'bounded, and never silently dropping' {
        It 'a full queue (by items) turns new evidence away, keeps every queued item, and says so' {
            $root = New-Root
            1..3 | ForEach-Object { $null = Add-Test -Root $root -Path (New-Evidence) -Minute $_ -MaxItems 3 }
            $before = @(Get-DEQueuedEvidence -Root $root | ForEach-Object { $_.Id })
            $r = Add-Test -Root $root -Path (New-Evidence) -Minute 9 -MaxItems 3
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'queue_full'
            (@(Get-DEQueuedEvidence -Root $root | ForEach-Object { $_.Id }) -join ',') | Should -Be ($before -join ',') -Because 'nothing queued was removed to make room'
            (Get-DEQueueStatus -Root $root).Overflowed | Should -Be 1
            (Get-Content -LiteralPath (Join-Path $root 'queue.log') -Raw) | Should -Match 'queue_full job=0b8f6d1e'
        }
        It 'a full queue (by bytes) does the same, and an item that fits exactly is accepted' {
            $root = New-Root
            (Add-Test -Root $root -Path (New-Evidence -Bytes 600) -MaxBytes 1000).Code | Should -Be 'queued'
            (Add-Test -Root $root -Path (New-Evidence -Bytes 401) -Minute 1 -MaxBytes 1000).Code | Should -Be 'queue_full'
            (Add-Test -Root $root -Path (New-Evidence -Bytes 400) -Minute 2 -MaxBytes 1000).Code | Should -Be 'queued' -Because '600 + 400 is exactly the bound'
            (Get-DEQueueStatus -Root $root).Bytes | Should -Be 1000
        }
        It 'evidence bigger than the whole queue is turned away and counted too' {
            $root = New-Root
            (Add-Test -Root $root -Path (New-Evidence -Bytes 2000) -MaxBytes 1000).Code | Should -Be 'too_large'
            (Get-DEQueueStatus -Root $root).Overflowed | Should -Be 1
            (Get-Content -LiteralPath (Join-Path $root 'queue.log') -Raw) | Should -Match 'too_large'
        }
        It 'counts every turning-away until the Hub has been told, then clears the counter and keeps the log' {
            $root = New-Root
            $null = Add-Test -Root $root -Path (New-Evidence) -MaxItems 1
            1..3 | ForEach-Object { $null = Add-Test -Root $root -Path (New-Evidence) -Minute $_ -MaxItems 1 }
            (Get-DEQueueStatus -Root $root).Overflowed | Should -Be 3
            Clear-DEQueueOverflow -Root $root
            (Get-DEQueueStatus -Root $root).Overflowed | Should -Be 0
            @(Get-Content -LiteralPath (Join-Path $root 'queue.log') | Where-Object { $_ -match 'queue_full' }).Count | Should -Be 3
        }
        It 'reports items, bytes and the oldest item for the heartbeat' {
            $root = New-Root
            $null = Add-Test -Root $root -Path (New-Evidence -Bytes 10) -Minute 2
            $null = Add-Test -Root $root -Path (New-Evidence -Bytes 20) -Minute 1
            $s = Get-DEQueueStatus -Root $root
            $s.Items | Should -Be 2
            $s.Bytes | Should -Be 30
            $s.Oldest | Should -Be $script:T0.AddMinutes(1)
        }
    }

    Context 'an item leaves only when it has been uploaded' {
        It 'refuses to remove without -Uploaded, and removes and logs with it' {
            $root = New-Root
            $r = Add-Test -Root $root -Path (New-Evidence)
            { Remove-DEQueuedEvidence -Root $root -Id $r.Id -Now $script:T0 } | Should -Throw
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 1
            (Remove-DEQueuedEvidence -Root $root -Id $r.Id -Uploaded -Now $script:T0) | Should -Be $true
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 0
            Test-Path -LiteralPath (Join-Path $root "items\$($r.Id).data") | Should -Be $false
            (Get-Content -LiteralPath (Join-Path $root 'queue.log') -Raw) | Should -Match "uploaded_removed id=$($r.Id)"
        }
        It 'refuses an id that is not a queue item id (no path games)' {
            { Remove-DEQueuedEvidence -Root (New-Root) -Id '..\..\x' -Uploaded -Now $script:T0 } | Should -Throw
        }
    }

    Context 'damage is accounted for, never silently dropped' {
        It 'quarantines an item whose bytes no longer match what was queued' {
            $root = New-Root
            $r = Add-Test -Root $root -Path (New-Evidence -Bytes 500)
            $data = Join-Path $root "items\$($r.Id).data"
            $b = [IO.File]::ReadAllBytes($data); $b[5] = $b[5] -bxor 1; [IO.File]::WriteAllBytes($data, $b)
            $fix = Repair-DEQueue -Root $root -Now $script:T0
            $fix.Quarantined | Should -Be 1
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 0
            Test-Path -LiteralPath (Join-Path $root "quarantine\$($r.Id).data") | Should -Be $true -Because 'quarantined, not deleted'
            (Get-DEQueueStatus -Root $root).Quarantined | Should -Be 1
            (Get-Content -LiteralPath (Join-Path $root 'queue.log') -Raw) | Should -Match 'quarantined_mismatch'
        }
        It 'quarantines data that has no metadata, and removes only half-written files' {
            $root = New-Root
            $null = Add-Test -Root $root -Path (New-Evidence)
            Set-Content -LiteralPath (Join-Path $root 'items\0000000000000000001-deadbeef.data') -Value 'orphan'
            Set-Content -LiteralPath (Join-Path $root 'items\0000000000000000002-cafebabe.data.tmp') -Value 'partial'
            $fix = Repair-DEQueue -Root $root -Now $script:T0
            $fix.RemovedPartials | Should -Be 1
            $fix.Quarantined | Should -Be 1
            Test-Path -LiteralPath (Join-Path $root 'quarantine\0000000000000000001-deadbeef.data') | Should -Be $true
            Test-Path -LiteralPath (Join-Path $root 'items\0000000000000000002-cafebabe.data.tmp') | Should -Be $false
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 1 -Because 'the healthy item is untouched'
        }
        It 'quarantines metadata it cannot read, with its data, instead of skipping it silently' {
            $root = New-Root
            $r = Add-Test -Root $root -Path (New-Evidence -Bytes 50)
            $keep = Add-Test -Root $root -Path (New-Evidence -Bytes 60) -Minute 1
            Set-Content -LiteralPath (Join-Path $root "items\$($r.Id).json") -Value 'not json {'
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 1 -Because 'the listing cannot show what it cannot read'
            $fix = Repair-DEQueue -Root $root -Now $script:T0
            $fix.Quarantined | Should -Be 1
            Test-Path -LiteralPath (Join-Path $root "quarantine\$($r.Id).json") | Should -Be $true
            Test-Path -LiteralPath (Join-Path $root "quarantine\$($r.Id).data") | Should -Be $true -Because 'the evidence itself is kept'
            (Get-DEQueueStatus -Root $root).Quarantined | Should -Be 1
            @(Get-DEQueuedEvidence -Root $root)[0].Id | Should -Be $keep.Id
            (Get-Content -LiteralPath (Join-Path $root 'queue.log') -Raw) | Should -Match 'quarantined_unreadable_metadata'
        }
        It 'leaves a healthy queue exactly as it was' {
            $root = New-Root
            1..3 | ForEach-Object { $null = Add-Test -Root $root -Path (New-Evidence) -Minute $_ }
            $fix = Repair-DEQueue -Root $root -Now $script:T0
            $fix.Quarantined | Should -Be 0
            $fix.RemovedPartials | Should -Be 0
            @(Get-DEQueuedEvidence -Root $root).Count | Should -Be 3
        }
    }
}
