# DE.AgentReplay: the DE Tech Agent's replay store of job nonces (move 66).
#
# A job is accepted once. Its nonce goes into this store BEFORE any action runs (a ledger entry before the work
# starts, as the Hub's own agent does), so a crash after registering loses the job and never replays it. The store:
#   - is a plain text file of "N1 <expiresAt UTC> <nonce>" lines, appended with write-through and flushed to disk;
#   - serialises concurrent callers on a lock file, so two registrations of one nonce cannot both win;
#   - forgets a nonce only after its job's expiry plus the skew has passed, when the window check refuses the job
#     anyway (AGENT-THREAT-MODEL.md S4); it NEVER evicts a live nonce to make room: when it is full of live nonces it
#     refuses new jobs (replay_store_full), because an eviction would be a replay hole;
#   - tolerates exactly one kind of damage, a torn last line left by a crash mid-append, and repairs it; any other
#     bad line, or a file it cannot read, is replay_store_unreadable: the agent refuses jobs, it never reads "damaged"
#     as "empty".
# No network access. The directory and its ACL (SYSTEM and Administrators only, TB4) belong to the service (move 68).

$script:LinePattern = '^N1 (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) ([A-Za-z0-9_-]{22,86})$'
$script:NoncePattern = '^[A-Za-z0-9_-]{22,86}$'
$script:TimeFormat = "yyyy-MM-dd'T'HH:mm:ss.fff'Z'"

function Get-DEReplayLock {
    # An exclusive lock for the whole read-decide-write, held on a sibling file. Retries briefly: another caller is mid-operation.
    param([string]$Path)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    for ($i = 0; $i -lt 200; $i++) {
        try { return (New-Object IO.FileStream("$Path.lock", [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)) }
        catch [IO.IOException] { Start-Sleep -Milliseconds 25 }
    }
    throw "could not lock the replay store at $Path"
}

function Read-DEReplayEntries {
    # Parses the store. Returns Entries (nonce -> expiry), Torn (a torn last line was dropped) and Error ($null or why it is unreadable).
    param([string]$Path)
    $entries = New-Object 'System.Collections.Generic.Dictionary[string,datetime]' ([StringComparer]::Ordinal)
    if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{ Entries = $entries; Torn = $false; Error = $null } }
    $text = $null
    try { $text = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) } catch { return [pscustomobject]@{ Entries = $entries; Torn = $false; Error = "cannot read the store: $($_.Exception.Message)" } }
    # no trailing newline means a crash cut the last append: the file is rewritten cleanly even if that last line still parses,
    # because the next append would otherwise glue onto it
    $endsClean = ($text.Length -eq 0) -or $text.EndsWith("`n")
    $torn = -not $endsClean
    $lines = @($text -split "`n")
    if ($lines.Count -gt 0 -and $lines[-1] -eq '') { $lines = @($lines[0..($lines.Count - 2)]) }
    if ($text.Length -eq 0) { $lines = @() }
    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = $lines[$i].TrimEnd("`r")
        $m = [regex]::Match($line, $script:LinePattern)
        if (-not $m.Success) {
            if ($i -eq ($lines.Count - 1) -and -not $endsClean) { continue }
            return [pscustomobject]@{ Entries = $entries; Torn = $false; Error = "line $($i + 1) is not a valid replay entry" }
        }
        $t = [datetime]::ParseExact($m.Groups[1].Value, $script:TimeFormat, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal)
        $entries[$m.Groups[2].Value] = $t
    }
    return [pscustomobject]@{ Entries = $entries; Torn = $torn; Error = $null }
}

function Write-DEReplayAtomic {
    # Replaces the store with exactly these entries: a temp file, flushed, then swapped in.
    param([string]$Path, $Entries)
    $tmp = "$Path.tmp"
    $sb = New-Object Text.StringBuilder
    foreach ($k in ($Entries.Keys | Sort-Object { $Entries[$_] }, { $_ })) { [void]$sb.Append("N1 $($Entries[$k].ToString($script:TimeFormat, [Globalization.CultureInfo]::InvariantCulture)) $k`n") }
    $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($sb.ToString())
    $fs = New-Object IO.FileStream($tmp, [IO.FileMode]::Create, [IO.FileAccess]::Write, [IO.FileShare]::None, 4096, [IO.FileOptions]::WriteThrough)
    try { $fs.Write($bytes, 0, $bytes.Length); $fs.Flush($true) } finally { $fs.Dispose() }
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($tmp, $Path, [NullString]::Value) } else { [IO.File]::Move($tmp, $Path) }
}

function Register-DEJobNonce {
    <#
        Records -Nonce as used, once. Ok is true only for the first registration of a nonce that is well formed, while the
        store is readable and has room. Codes: replayed_nonce, schema (not a nonce), replay_store_full, replay_store_unreadable.
        Call it after the job's signature and window are verified and BEFORE any action runs.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Nonce,
        [Parameter(Mandatory = $true)][datetime]$ExpiresAt, [Parameter(Mandatory = $true)][datetime]$Now,
        [int]$MaxEntries = 5000, [int]$SkewSeconds = 300
    )
    $result = { param($ok, $code, $why, $count) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why; Count = $count } }
    if ($Nonce -cnotmatch $script:NoncePattern) { return (& $result $false 'schema' 'the nonce is not 22 to 86 base64url characters' 0) }
    $lock = Get-DEReplayLock -Path $Path
    try {
        $store = Read-DEReplayEntries -Path $Path
        if ($store.Error) { return (& $result $false 'replay_store_unreadable' $store.Error 0) }
        $entries = $store.Entries
        $horizon = $Now.ToUniversalTime().AddSeconds(-$SkewSeconds)
        $expired = @($entries.Keys | Where-Object { $entries[$_] -lt $horizon })
        foreach ($k in $expired) { [void]$entries.Remove($k) }
        if ($entries.ContainsKey($Nonce)) {
            if ($expired.Count -or $store.Torn) { Write-DEReplayAtomic -Path $Path -Entries $entries }
            return (& $result $false 'replayed_nonce' 'this nonce has already been used' $entries.Count)
        }
        if ($entries.Count -ge $MaxEntries) { return (& $result $false 'replay_store_full' "the store holds $MaxEntries live nonces and never evicts one" $entries.Count) }
        if ($expired.Count -or $store.Torn) {
            $entries[$Nonce] = $ExpiresAt.ToUniversalTime()
            Write-DEReplayAtomic -Path $Path -Entries $entries
        } else {
            $line = "N1 $($ExpiresAt.ToUniversalTime().ToString($script:TimeFormat, [Globalization.CultureInfo]::InvariantCulture)) $Nonce`n"
            $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($line)
            $fs = New-Object IO.FileStream($Path, [IO.FileMode]::Append, [IO.FileAccess]::Write, [IO.FileShare]::Read, 4096, [IO.FileOptions]::WriteThrough)
            try { $fs.Write($bytes, 0, $bytes.Length); $fs.Flush($true) } finally { $fs.Dispose() }
            $entries[$Nonce] = $ExpiresAt.ToUniversalTime()
        }
        return (& $result $true '' 'recorded' $entries.Count)
    } finally { $lock.Dispose() }
}

function Clear-DEExpiredNonces {
    <# Housekeeping for the service: drops nonces whose job expired more than the skew ago. Returns how many were dropped; throws if the store is unreadable. #>
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][datetime]$Now, [int]$SkewSeconds = 300)
    $lock = Get-DEReplayLock -Path $Path
    try {
        $store = Read-DEReplayEntries -Path $Path
        if ($store.Error) { throw "replay store unreadable: $($store.Error)" }
        $horizon = $Now.ToUniversalTime().AddSeconds(-$SkewSeconds)
        $expired = @($store.Entries.Keys | Where-Object { $store.Entries[$_] -lt $horizon })
        foreach ($k in $expired) { [void]$store.Entries.Remove($k) }
        if ($expired.Count -or $store.Torn) { Write-DEReplayAtomic -Path $Path -Entries $store.Entries }
        return $expired.Count
    } finally { $lock.Dispose() }
}

function Get-DEReplayStoreStatus {
    <# What the store holds, for the heartbeat and the support bundle: never the nonces themselves. #>
    param([Parameter(Mandatory = $true)][string]$Path)
    $store = Read-DEReplayEntries -Path $Path
    if ($store.Error) { return [pscustomobject]@{ Readable = $false; Count = 0; Latest = $null; Error = $store.Error } }
    $latest = $null
    if ($store.Entries.Count) { $latest = ($store.Entries.Values | Measure-Object -Maximum).Maximum }
    return [pscustomobject]@{ Readable = $true; Count = $store.Entries.Count; Latest = $latest; Error = $null }
}

Export-ModuleMember -Function Register-DEJobNonce, Clear-DEExpiredNonces, Get-DEReplayStoreStatus
