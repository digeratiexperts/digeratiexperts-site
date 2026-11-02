# DE.AgentEvidence: resumable, idempotent evidence upload (move 70).
#
# An evidence bundle leaves the device in fixed-size chunks, each acknowledged before the next is sent, so an
# interruption costs at most one chunk and the next attempt resumes where the Hub last said yes:
#   - the IDEMPOTENCY KEY is derived from the job and the bundle's SHA-256, so the same bundle always has the same key and
#     the Hub can recognise a repeat (AGENT-THREAT-MODEL.md D1, T4, R1); a finished upload is never sent again;
#   - progress is persisted after every acknowledged chunk (atomic write); the state holds hashes and counts only;
#   - a file that changed since the upload began cannot be glued onto its old chunks: the stale state is discarded and the
#     upload starts over under the new bundle's key;
#   - retries back off exponentially and are bounded; a server answer of 'conflict' (different content under this key) is
#     never retried, because retrying could not make it true;
#   - nothing leaves unless the caller says it was redacted (-Redacted) AND a text bundle holds nothing shaped like a
#     BitLocker recovery password: redact before egress, not after (C9, move 14).
# The transport is a scriptblock the service supplies (mTLS, move 63); this module has no network access of its own.

$script:RecoveryShape = '(?<!\d)\d{6}([- ]?\d{6}){7}(?!\d)'
$script:TextExtensions = @('.txt', '.json', '.log', '.html', '.htm', '.md', '.csv', '.xml', '.sha256')

function Get-DEFileSha256Hex {
    param([Parameter(Mandatory = $true)][string]$Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    $fs = [IO.File]::OpenRead($Path)
    try { return (($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $fs.Dispose(); $sha.Dispose() }
}

function Get-DEUploadKey {
    <# The idempotency key: SHA-256 of the job and the bundle hash. Same bundle, same key; another job or another content, another key. #>
    param([Parameter(Mandatory = $true)][string]$JobId, [Parameter(Mandatory = $true)][string]$FileSha256)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return (($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes("de-evidence-v1|$JobId|$FileSha256")) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $sha.Dispose() }
}

function Write-DEUploadState {
    param([string]$Path, $State)
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $tmp = "$Path.tmp"
    [IO.File]::WriteAllText($tmp, ($State | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($tmp, $Path, [NullString]::Value) } else { [IO.File]::Move($tmp, $Path) }
}

function Get-DEUploadState {
    <# The saved progress of an upload, or $null. A state file that cannot be read is treated as no state (the upload starts over; the Hub's idempotency key makes that safe). #>
    param([Parameter(Mandatory = $true)][string]$StatePath)
    if (-not (Test-Path -LiteralPath $StatePath)) { return $null }
    try { return (Get-Content -LiteralPath $StatePath -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Send-DEEvidenceFile {
    <#
        Uploads -Path through -Transport, resuming from -StatePath. The transport is called as & $Transport $request and returns an
        object with Status (ok, duplicate, retry, conflict); an exception counts as retry. A request has Kind (chunk or complete),
        Key, JobId, Index, Count, Offset, Bytes, ChunkSha256 and FileSha256, FileSize.
        Returns Ok, Code (uploaded, already_uploaded, not_redacted, recovery_shaped, too_large, missing_file, upload_interrupted,
        result_conflict), Key, Sent (chunks sent this call), Resumed and NextChunk.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$JobId, [Parameter(Mandatory = $true)][string]$StatePath,
        [Parameter(Mandatory = $true)][scriptblock]$Transport, [switch]$Redacted,
        [int]$ChunkBytes = 262144, [int]$MaxAttemptsPerChunk = 5, [int]$BackoffMs = 500, [long]$MaxBytes = 67108864,
        [scriptblock]$SleepScript = { param($ms) Start-Sleep -Milliseconds $ms }
    )
    $result = { param($ok, $code, $key, $sent, $resumed, $next) [pscustomobject]@{ Ok = $ok; Code = $code; Key = $key; Sent = $sent; Resumed = $resumed; NextChunk = $next } }
    if (-not $Redacted) { return (& $result $false 'not_redacted' '' 0 $false 0) }
    if (-not (Test-Path -LiteralPath $Path)) { return (& $result $false 'missing_file' '' 0 $false 0) }
    $size = (Get-Item -LiteralPath $Path).Length
    if ($size -gt $MaxBytes) { return (& $result $false 'too_large' '' 0 $false 0) }
    if ($script:TextExtensions -contains ([IO.Path]::GetExtension($Path).ToLowerInvariant())) {
        if ([IO.File]::ReadAllText($Path) -match $script:RecoveryShape) { return (& $result $false 'recovery_shaped' '' 0 $false 0) }
    }
    $fileSha = Get-DEFileSha256Hex -Path $Path
    $key = Get-DEUploadKey -JobId $JobId -FileSha256 $fileSha
    $count = [int][Math]::Ceiling($size / [double]$ChunkBytes)
    $state = Get-DEUploadState -StatePath $StatePath
    if ($state -and ("$($state.fileSha256)" -ne $fileSha -or [long]$state.size -ne $size -or [int]$state.chunkBytes -ne $ChunkBytes -or "$($state.jobId)" -ne $JobId)) { $state = $null }
    if ($state -and [bool]$state.completed) { return (& $result $true 'already_uploaded' $key 0 $true $count) }
    $next = if ($state) { [int]$state.nextChunk } else { 0 }
    $resumed = ($next -gt 0)
    $save = { param($n, $done) Write-DEUploadState -Path $StatePath -State ([ordered]@{ jobId = $JobId; fileSha256 = $fileSha; size = $size; chunkBytes = $ChunkBytes; key = $key; nextChunk = $n; completed = $done }) }
    $attempt = {
        param($request)
        for ($a = 1; $a -le $MaxAttemptsPerChunk; $a++) {
            $answer = $null
            try { $answer = & $Transport $request } catch { $answer = [pscustomobject]@{ Status = 'retry' } }
            $status = "$($answer.Status)"
            if ($status -eq 'ok' -or $status -eq 'duplicate') { return 'ok' }
            if ($status -eq 'conflict') { return 'conflict' }
            if ($a -lt $MaxAttemptsPerChunk) { & $SleepScript ([int][Math]::Min($BackoffMs * [Math]::Pow(2, $a - 1), 30000)) }
        }
        return 'gave_up'
    }
    $sent = 0
    $fs = [IO.File]::OpenRead($Path)
    try {
        for ($i = $next; $i -lt $count; $i++) {
            $offset = [long]$i * $ChunkBytes
            $len = [int][Math]::Min([long]$ChunkBytes, $size - $offset)
            $buf = New-Object byte[] $len
            [void]$fs.Seek($offset, [IO.SeekOrigin]::Begin)
            $read = 0; while ($read -lt $len) { $n = $fs.Read($buf, $read, $len - $read); if ($n -le 0) { break }; $read += $n }
            $sha = [Security.Cryptography.SHA256]::Create()
            $chunkSha = (($sha.ComputeHash($buf) | ForEach-Object { $_.ToString('x2') }) -join ''); $sha.Dispose()
            $req = [pscustomobject]@{ Kind = 'chunk'; Key = $key; JobId = $JobId; Index = $i; Count = $count; Offset = $offset; Bytes = $buf; ChunkSha256 = $chunkSha; FileSha256 = $fileSha; FileSize = $size }
            $r = & $attempt $req
            if ($r -eq 'conflict') { return (& $result $false 'result_conflict' $key $sent $resumed $i) }
            if ($r -ne 'ok') { return (& $result $false 'upload_interrupted' $key $sent $resumed $i) }
            $sent++
            & $save ($i + 1) $false
        }
    } finally { $fs.Dispose() }
    $done = [pscustomobject]@{ Kind = 'complete'; Key = $key; JobId = $JobId; Index = $count; Count = $count; Offset = $size; Bytes = (New-Object byte[] 0); ChunkSha256 = ''; FileSha256 = $fileSha; FileSize = $size }
    $r = & $attempt $done
    if ($r -eq 'conflict') { return (& $result $false 'result_conflict' $key $sent $resumed $count) }
    if ($r -ne 'ok') { return (& $result $false 'upload_interrupted' $key $sent $resumed $count) }
    & $save $count $true
    return (& $result $true 'uploaded' $key $sent $resumed $count)
}

Export-ModuleMember -Function Get-DEUploadKey, Get-DEUploadState, Send-DEEvidenceFile
