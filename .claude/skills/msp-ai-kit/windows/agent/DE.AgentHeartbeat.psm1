# DE.AgentHeartbeat: what the DE Tech Agent tells the Hub it is, and how its inventory changes (move 69).
#
# Two rules decide everything here (AGENT-THREAT-MODEL.md D1, I5):
#   - the heartbeat is built from an ALLOWLIST of device facts and agent state, so a field that identifies a person
#     (a user name, an email, a profile path) cannot reach it by being present in the input: it is dropped, and only the
#     COUNT of dropped fields is reported, never their names or values;
#   - an inventory is sent as a DELTA against the last one the Hub acknowledged, and only when something changed; a full
#     inventory goes when the Hub asks (needFull) or when a delta would be no smaller than the whole inventory.
# No network access: this module builds the bodies. The transport is the service's, over mTLS (move 63).

$script:FactFields = @('hostname', 'serial', 'manufacturer', 'model', 'os', 'osBuild', 'biosVersion', 'cpu', 'ramGB', 'diskGB', 'tpmPresent', 'tpmVersion', 'secureBoot', 'domainState')
$script:States = @('unenrolled', 'enrolled_idle', 'paused', 'revoked', 'state_unsafe')
$script:RecoveryShape = '(?<!\d)\d{6}([- ]?\d{6}){7}(?!\d)'
$script:MaxHeartbeatBytes = 8192

function ConvertTo-DEFactValue {
    # a fact value the Hub can take: a short single-line string, a number or a boolean; anything else, or anything shaped like a recovery password, is not a fact
    param($Value)
    if ($null -eq $Value) { return $null }
    if ($Value -is [bool] -or $Value -is [int] -or $Value -is [long] -or $Value -is [double]) { return $Value }
    if ($Value -isnot [string]) { return $null }
    $s = ($Value -replace '[\x00-\x1f\x7f]', ' ').Trim()
    if ($s.Length -gt 128) { $s = $s.Substring(0, 128) }
    if ($s -match $script:RecoveryShape) { return $null }
    if ($s -eq '') { return $null }
    return $s
}

function Get-DEInventorySnapshot {
    <# The device facts out of -Facts that the allowlist admits, normalised. Dropped is how many input fields were not admitted (names and values are never kept). #>
    param([Parameter(Mandatory = $true)]$Facts)
    $kept = [ordered]@{}
    $dropped = 0
    $keys = @(if ($Facts -is [System.Collections.IDictionary]) { $Facts.Keys } else { $Facts.PSObject.Properties.Name })
    foreach ($k in $keys) {
        $v = if ($Facts -is [System.Collections.IDictionary]) { $Facts[$k] } else { $Facts.$k }
        $name = $script:FactFields | Where-Object { $_ -ceq "$k" } | Select-Object -First 1
        if (-not $name) { $dropped++; continue }
        $n = ConvertTo-DEFactValue -Value $v
        if ($null -eq $n) { $dropped++; continue }
        $kept[$name] = $n
    }
    $sorted = [ordered]@{}
    foreach ($k in ($kept.Keys | Sort-Object)) { $sorted[$k] = $kept[$k] }
    return [pscustomobject]@{ Facts = $sorted; Dropped = $dropped }
}

function Compare-DEInventory {
    <# What changed between two snapshots' Facts: Added, Changed (from and to), Removed (names), and Empty when nothing did. #>
    param($Previous, [Parameter(Mandatory = $true)]$Current)
    $added = [ordered]@{}; $changed = [ordered]@{}; $removed = New-Object System.Collections.Generic.List[string]
    $prev = if ($null -eq $Previous) { @{} } else { $Previous }
    foreach ($k in $Current.Keys) {
        if (-not $prev.Contains($k)) { $added[$k] = $Current[$k] }
        elseif ("$($prev[$k])" -cne "$($Current[$k])") { $changed[$k] = [ordered]@{ from = $prev[$k]; to = $Current[$k] } }
    }
    foreach ($k in $prev.Keys) { if (-not $Current.Contains($k)) { $removed.Add($k) } }
    return [pscustomobject]@{ Added = $added; Changed = $changed; Removed = @($removed); Empty = ($added.Count -eq 0 -and $changed.Count -eq 0 -and $removed.Count -eq 0) }
}

function New-DEHeartbeat {
    <#
        The heartbeat body (a JSON string) and what to remember if the Hub accepts it. -Previous is the Facts of the last
        inventory the Hub acknowledged; -NeedFull is the Hub asking for everything. A delta is attached only when something
        changed, and a delta over its size cap becomes a full inventory. Returns Body, Mode (none, delta, full) and Facts.
    #>
    param(
        [Parameter(Mandatory = $true)][string]$AgentVersion, [Parameter(Mandatory = $true)][string]$State, [Parameter(Mandatory = $true)][string]$DeviceKey,
        [Parameter(Mandatory = $true)]$Facts, $Previous, [switch]$NeedFull, [Parameter(Mandatory = $true)][datetime]$Now,
        [AllowNull()][Nullable[datetime]]$CertNotAfter = $null, [string]$CatalogSha256 = '', [string[]]$PinnedJobKeyIds = @(),
        [int]$ReplayCount = 0, [int]$QueueItems = 0, [long]$QueueBytes = 0, [long]$UptimeSeconds = 0
    )
    if ($script:States -cnotcontains $State) { throw "unknown agent state '$State'" }
    if ($DeviceKey -cnotmatch '^[a-z0-9-]+:[A-Z0-9-]+$') { throw 'the device key is not <maker>:<SERIAL>' }
    $snap = Get-DEInventorySnapshot -Facts $Facts
    $hb = [ordered]@{
        schema = 'de.techagent.heartbeat/v1'; agentVersion = $AgentVersion; state = $State; deviceKey = $DeviceKey
        sentAt = $Now.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture)
        uptimeSeconds = $UptimeSeconds
        certDaysLeft = $(if ($null -ne $CertNotAfter) { [int][Math]::Floor((([datetime]$CertNotAfter).ToUniversalTime() - $Now.ToUniversalTime()).TotalDays) } else { $null })
        catalogSha256 = $(if ($CatalogSha256 -cmatch '^[a-f0-9]{64}$') { $CatalogSha256 } else { $null })
        pinnedJobKeyIds = @($PinnedJobKeyIds | Where-Object { $_ -cmatch '^[A-Za-z0-9._-]{1,64}$' } | Sort-Object)
        replayStoreCount = $ReplayCount; queueItems = $QueueItems; queueBytes = $QueueBytes
        droppedFields = $snap.Dropped
    }
    $mode = 'none'
    if ($NeedFull -or $null -eq $Previous) { $mode = 'full'; $hb['inventory'] = $snap.Facts }
    else {
        $d = Compare-DEInventory -Previous $Previous -Current $snap.Facts
        if (-not $d.Empty) {
            $delta = [ordered]@{}
            if ($d.Added.Count) { $delta['added'] = $d.Added }
            if ($d.Changed.Count) { $delta['changed'] = $d.Changed }
            if ($d.Removed.Count) { $delta['removed'] = $d.Removed }
            # a delta no smaller than the whole inventory is not worth sending: send the whole inventory
            if (($delta | ConvertTo-Json -Depth 5 -Compress).Length -ge ($snap.Facts | ConvertTo-Json -Depth 3 -Compress).Length) { $mode = 'full'; $hb['inventory'] = $snap.Facts }
            else { $mode = 'delta'; $hb['inventoryDelta'] = $delta }
        }
    }
    $hb['inventoryMode'] = $mode
    $body = $hb | ConvertTo-Json -Depth 6 -Compress
    if ($body.Length -gt $script:MaxHeartbeatBytes) { throw "the heartbeat is $($body.Length) bytes, over the $($script:MaxHeartbeatBytes) cap" }
    return [pscustomobject]@{ Body = $body; Mode = $mode; Facts = $snap.Facts }
}

Export-ModuleMember -Function Get-DEInventorySnapshot, Compare-DEInventory, New-DEHeartbeat
