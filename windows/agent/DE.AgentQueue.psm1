# DE.AgentQueue: the DE Tech Agent's offline evidence queue (move 71).
#
# When the Hub cannot be reached, evidence waits here, on disk, in order. The rule that decides the design
# (AGENT-THREAT-MODEL.md D3, I1): evidence is NEVER dropped silently.
#   - the queue is bounded (items and bytes), but a full queue refuses NEW evidence; it never deletes queued evidence to
#     make room, and every refusal is written to a log and counted, so the heartbeat can say "I turned evidence away";
#   - an item exists only once its metadata is written (data first, metadata last, both atomically), so a crash leaves
#     either a whole item or a leftover that Repair-DEQueue accounts for;
#   - an item whose bytes no longer match what was queued (rot, tampering), or data with no metadata, is QUARANTINED, moved
#     aside and counted, never deleted;
#   - an item leaves the queue only when the caller says it was uploaded (-Uploaded), and that is logged;
#   - metadata holds hashes, sizes, times and a sanitised file name; never a path, never content.
# No network access. The directory and its ACL belong to the service (move 68); the upload is move 70.

$script:Safe = '[^A-Za-z0-9._-]'

function Get-DEQueuePaths {
    param([Parameter(Mandatory = $true)][string]$Root)
    return [pscustomobject]@{ Root = $Root; Items = (Join-Path $Root 'items'); Quarantine = (Join-Path $Root 'quarantine'); Log = (Join-Path $Root 'queue.log'); Overflow = (Join-Path $Root 'overflow.json') }
}

function Write-DEQueueLog {
    param([string]$Root, [string]$Line)
    $p = Get-DEQueuePaths -Root $Root
    [IO.File]::AppendAllText($p.Log, ($Line + "`n"), (New-Object Text.UTF8Encoding $false))
}

function Get-DEQueueFileSha {
    param([string]$Path)
    $sha = [Security.Cryptography.SHA256]::Create(); $fs = [IO.File]::OpenRead($Path)
    try { return (($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $fs.Dispose(); $sha.Dispose() }
}

function Get-DEQueuedEvidence {
    <# The queued items, oldest first (wrap the call in @()). Each has Id, JobId, FileSha256, Size, QueuedAt, Name and DataPath. An item with unreadable metadata is not listed here; Repair-DEQueue accounts for it. #>
    param([Parameter(Mandatory = $true)][string]$Root)
    $p = Get-DEQueuePaths -Root $Root
    if (-not (Test-Path -LiteralPath $p.Items)) { return @() }
    $out = New-Object System.Collections.Generic.List[object]
    foreach ($f in (Get-ChildItem -LiteralPath $p.Items -Filter '*.json' -File)) {
        try {
            $m = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
            $out.Add([pscustomobject]@{ Id = "$($m.id)"; JobId = "$($m.jobId)"; FileSha256 = "$($m.fileSha256)"; Size = [long]$m.size; QueuedAt = [datetime]::Parse("$($m.queuedAt)", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind); Name = "$($m.name)"; DataPath = (Join-Path $p.Items "$($m.id).data") })
        } catch { Write-Verbose "unreadable queue metadata $($f.Name): Repair-DEQueue quarantines it" }
    }
    return @($out | Sort-Object QueuedAt, Id)
}

function Get-DEQueueStatus {
    <# What the heartbeat reports: items, bytes, the oldest item, how many were turned away (Overflowed, until acknowledged) and how many are quarantined. #>
    param([Parameter(Mandatory = $true)][string]$Root)
    $p = Get-DEQueuePaths -Root $Root
    $items = @(Get-DEQueuedEvidence -Root $Root)
    $over = 0
    if (Test-Path -LiteralPath $p.Overflow) { try { $over = [int](Get-Content -LiteralPath $p.Overflow -Raw | ConvertFrom-Json).count } catch { $over = 1 } }
    $quarantined = if (Test-Path -LiteralPath $p.Quarantine) { @(Get-ChildItem -LiteralPath $p.Quarantine -File -Filter '*.data').Count } else { 0 }
    return [pscustomobject]@{ Items = $items.Count; Bytes = [long](($items | Measure-Object -Property Size -Sum).Sum); Oldest = $(if ($items.Count) { $items[0].QueuedAt } else { $null }); Overflowed = $over; Quarantined = $quarantined }
}

function Add-DEQueuedEvidence {
    <#
        Queues -Path for later upload. Returns Ok and Code: queued, already_queued (same job and content), queue_full (turned away:
        logged and counted, nothing queued is removed), too_large (bigger than the whole queue), missing_file.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$JobId,
        [Parameter(Mandatory = $true)][datetime]$Now, [int]$MaxItems = 200, [long]$MaxBytes = 536870912
    )
    $result = { param($ok, $code, $id) [pscustomobject]@{ Ok = $ok; Code = $code; Id = $id } }
    if (-not (Test-Path -LiteralPath $Path)) { return (& $result $false 'missing_file' '') }
    $p = Get-DEQueuePaths -Root $Root
    foreach ($d in @($p.Root, $p.Items, $p.Quarantine)) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
    $size = (Get-Item -LiteralPath $Path).Length
    $sha = Get-DEQueueFileSha -Path $Path
    $turnAway = {
        param($code)
        $n = 0; if (Test-Path -LiteralPath $p.Overflow) { try { $n = [int](Get-Content -LiteralPath $p.Overflow -Raw | ConvertFrom-Json).count } catch { $n = 0 } }
        [IO.File]::WriteAllText($p.Overflow, (([ordered]@{ count = ($n + 1); lastAt = $Now.ToUniversalTime().ToString('o') }) | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
        Write-DEQueueLog -Root $Root -Line ("{0} {1} job={2} sha={3} size={4}" -f $Now.ToUniversalTime().ToString('o'), $code, $JobId, $sha, $size)
        return (& $result $false $code '')
    }
    $existing = @(Get-DEQueuedEvidence -Root $Root)
    if ($existing | Where-Object { $_.JobId -ceq $JobId -and $_.FileSha256 -ceq $sha }) { return (& $result $true 'already_queued' (($existing | Where-Object { $_.JobId -ceq $JobId -and $_.FileSha256 -ceq $sha } | Select-Object -First 1).Id)) }
    if ($size -gt $MaxBytes) { return (& $turnAway 'too_large') }
    $bytes = [long](($existing | Measure-Object -Property Size -Sum).Sum)
    if ($existing.Count -ge $MaxItems -or ($bytes + $size) -gt $MaxBytes) { return (& $turnAway 'queue_full') }
    $id = ('{0:D19}-{1}' -f $Now.ToUniversalTime().Ticks, $sha.Substring(0, 8))
    $tmp = Join-Path $p.Items "$id.data.tmp"
    Copy-Item -LiteralPath $Path -Destination $tmp -Force
    [IO.File]::Move($tmp, (Join-Path $p.Items "$id.data"))
    $name = ([IO.Path]::GetFileName($Path) -replace $script:Safe, '_'); if ($name.Length -gt 64) { $name = $name.Substring(0, 64) }
    $meta = [ordered]@{ id = $id; jobId = $JobId; fileSha256 = $sha; size = $size; queuedAt = $Now.ToUniversalTime().ToString('o'); name = $name }
    $mtmp = Join-Path $p.Items "$id.json.tmp"
    [IO.File]::WriteAllText($mtmp, ($meta | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
    [IO.File]::Move($mtmp, (Join-Path $p.Items "$id.json"))
    return (& $result $true 'queued' $id)
}

function Remove-DEQueuedEvidence {
    <# Takes an item out of the queue. It requires -Uploaded: the only reason evidence leaves the queue is that the Hub has it. Logged. #>
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Id, [switch]$Uploaded, [Parameter(Mandatory = $true)][datetime]$Now)
    if (-not $Uploaded) { throw 'queued evidence is removed only once it has been uploaded (-Uploaded)' }
    if ($Id -cnotmatch '^\d{19}-[a-f0-9]{8}$') { throw 'not a queue item id' }
    $p = Get-DEQueuePaths -Root $Root
    $meta = Join-Path $p.Items "$Id.json"
    if (-not (Test-Path -LiteralPath $meta)) { return $false }
    Remove-Item -LiteralPath $meta -Force
    Remove-Item -LiteralPath (Join-Path $p.Items "$Id.data") -Force -ErrorAction SilentlyContinue
    Write-DEQueueLog -Root $Root -Line ("{0} uploaded_removed id={1}" -f $Now.ToUniversalTime().ToString('o'), $Id)
    return $true
}

function Clear-DEQueueOverflow {
    <# Resets the "turned away" counter once the Hub has been told. The log keeps the history. #>
    param([Parameter(Mandatory = $true)][string]$Root)
    $p = Get-DEQueuePaths -Root $Root
    if (Test-Path -LiteralPath $p.Overflow) { Remove-Item -LiteralPath $p.Overflow -Force }
}

function Repair-DEQueue {
    <#
        Accounts for what a crash or rot left behind, deleting nothing that could be evidence: partial files (*.tmp, never queued)
        are removed; an item whose bytes no longer match its hash, and data with no metadata, and metadata that cannot be read (with its data), are moved to quarantine and logged.
        Returns counts: RemovedPartials, Quarantined.
    #>
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][datetime]$Now)
    $p = Get-DEQueuePaths -Root $Root
    $partials = 0; $quar = 0
    if (-not (Test-Path -LiteralPath $p.Items)) { return [pscustomobject]@{ RemovedPartials = 0; Quarantined = 0 } }
    if (-not (Test-Path -LiteralPath $p.Quarantine)) { New-Item -ItemType Directory -Path $p.Quarantine -Force | Out-Null }
    foreach ($t in @(Get-ChildItem -LiteralPath $p.Items -Filter '*.tmp' -File)) { Remove-Item -LiteralPath $t.FullName -Force; $partials++ }
    foreach ($f in @(Get-ChildItem -LiteralPath $p.Items -Filter '*.json' -File)) {
        $bad = $false
        try { $null = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop } catch { $bad = $true }
        if (-not $bad) { continue }
        Move-Item -LiteralPath $f.FullName -Destination (Join-Path $p.Quarantine $f.Name) -Force
        $data = Join-Path $p.Items ($f.BaseName + '.data')
        if (Test-Path -LiteralPath $data) { Move-Item -LiteralPath $data -Destination (Join-Path $p.Quarantine ($f.BaseName + '.data')) -Force }
        $quar++; Write-DEQueueLog -Root $Root -Line ("{0} quarantined_unreadable_metadata id={1}" -f $Now.ToUniversalTime().ToString('o'), $f.BaseName)
    }
    $metaIds = @(Get-ChildItem -LiteralPath $p.Items -Filter '*.json' -File | ForEach-Object { $_.BaseName })
    foreach ($d in @(Get-ChildItem -LiteralPath $p.Items -Filter '*.data' -File)) {
        if ($metaIds -cnotcontains $d.BaseName) { Move-Item -LiteralPath $d.FullName -Destination (Join-Path $p.Quarantine $d.Name) -Force; $quar++; Write-DEQueueLog -Root $Root -Line ("{0} quarantined_orphan id={1}" -f $Now.ToUniversalTime().ToString('o'), $d.BaseName) }
    }
    foreach ($item in @(Get-DEQueuedEvidence -Root $Root)) {
        $ok = (Test-Path -LiteralPath $item.DataPath) -and ((Get-DEQueueFileSha -Path $item.DataPath) -ceq $item.FileSha256)
        if (-not $ok) {
            if (Test-Path -LiteralPath $item.DataPath) { Move-Item -LiteralPath $item.DataPath -Destination (Join-Path $p.Quarantine "$($item.Id).data") -Force }
            Move-Item -LiteralPath (Join-Path $p.Items "$($item.Id).json") -Destination (Join-Path $p.Quarantine "$($item.Id).json") -Force
            $quar++; Write-DEQueueLog -Root $Root -Line ("{0} quarantined_mismatch id={1}" -f $Now.ToUniversalTime().ToString('o'), $item.Id)
        }
    }
    return [pscustomobject]@{ RemovedPartials = $partials; Quarantined = $quar }
}

Export-ModuleMember -Function Add-DEQueuedEvidence, Get-DEQueuedEvidence, Get-DEQueueStatus, Remove-DEQueuedEvidence, Clear-DEQueueOverflow, Repair-DEQueue
