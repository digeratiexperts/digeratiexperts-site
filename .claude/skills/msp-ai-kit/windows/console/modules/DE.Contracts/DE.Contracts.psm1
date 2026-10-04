#Requires -Version 5.1
<#
.SYNOPSIS
    The contracts the three DE Tech Tool components share: online (Hub), on-device (console) and boot rescue (WinPE).

.DESCRIPTION
    contracts\*.schema.json are the single source of truth (JSON Schema; the Hub validates with the same files).
    This module validates the subset those files use (type, const, enum, pattern, minLength, required, properties,
    items), refuses secret-looking keys and BitLocker-recovery-password-shaped values anywhere in a record, builds
    the shared deviceKey, and reads and writes boot rescue handoffs. It depends on nothing else in the console so
    the WinPE rescue can load it on its own.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:ContractsRoot = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'contracts'
$script:SecretKey = '(?i)(passw|secret|token|api.?key|recovery.?pass|recovery.?key|connect.?key|private.?key|mfa|seed|^tap$|^pin$)'
$script:RecoveryShape = '(?<!\d)\d{6}([- ]?\d{6}){7}(?!\d)'   # dashes, spaces or nothing between the groups

function Get-DEContractsRoot { return $script:ContractsRoot }
function Get-DEContractSchema {
    param([Parameter(Mandatory = $true)][ValidateSet('device', 'order', 'handoff', 'warranty', 'job', 'migration')][string]$Name)
    return (Get-Content -LiteralPath (Join-Path $script:ContractsRoot "$Name.schema.json") -Raw -Encoding UTF8 | ConvertFrom-Json)
}
function Get-DEJsonKind {
    param($Value)
    if ($null -eq $Value) { return 'null' }
    if ($Value -is [bool]) { return 'boolean' }
    if ($Value -is [int] -or $Value -is [long] -or $Value -is [int16] -or $Value -is [byte] -or $Value -is [sbyte] -or $Value -is [uint16] -or $Value -is [uint32] -or $Value -is [uint64]) { return 'integer' }
    if ($Value -is [double] -or $Value -is [decimal] -or $Value -is [single]) { if ([math]::Floor([double]$Value) -eq [double]$Value) { return 'integer' }; return 'number' }
    if ($Value -is [string] -or $Value -is [datetime] -or $Value -is [char] -or $Value -is [guid]) { return 'string' }
    # PSCustomObject, not [pscustomobject] (= PSObject): an array element from the pipeline is PSObject-wrapped
    if ($Value -is [System.Collections.IDictionary] -or $Value -is [System.Management.Automation.PSCustomObject]) { return 'object' }
    if ($Value -is [System.Collections.IEnumerable]) { return 'array' }
    return 'object'
}
function Get-DEContractProp {
    param($Object, [string]$Name)
    # Plain assignments: $( ) would unroll a one-element array into its element.
    $has = $false; $v = $null
    if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { $has = $true; $v = $Object[$Name] } }
    else { $p = $Object.PSObject.Properties[$Name]; if ($p) { $has = $true; $v = $p.Value } }
    return @{ has = $has; value = $v }
}
function Get-DEContractKeys {
    # Named keys only. Windows PowerShell 5.1 writes an unset value ($() that produced nothing) as {} and reads {} back
    # as an object whose property list holds one nameless entry; emitting it as "" makes JSON 5.1 cannot read again.
    param($Object)
    if ($Object -is [System.Collections.IDictionary]) { return @($Object.Keys | ForEach-Object { "$_" } | Where-Object { $_ -ne '' }) }
    return @($Object.PSObject.Properties | ForEach-Object { "$($_.Name)" } | Where-Object { $_ -ne '' })
}
function Test-DEContractNode {
    param($Node, $Schema, [string]$Path)
    $out = New-Object System.Collections.Generic.List[string]
    $kind = Get-DEJsonKind $Node
    $sp = { param($n) $q = $Schema.PSObject.Properties[$n]; if ($q) { return $q.Value }; return $null }
    $const = $Schema.PSObject.Properties['const']
    if ($const -and "$Node" -cne "$($const.Value)") { $out.Add("${Path}: must be '$($const.Value)', is '$Node'"); return $out }
    $types = & $sp 'type'
    if ($null -ne $types) {
        $ok = $false
        foreach ($t in @($types)) { if ($t -eq $kind -or ($t -eq 'number' -and $kind -eq 'integer')) { $ok = $true } }
        if (-not $ok) { $out.Add("${Path}: expected $(@($types) -join ' or '), got $kind"); return $out }
    }
    $enum = $Schema.PSObject.Properties['enum']
    if ($enum) { $hit = $false; foreach ($e in @($enum.Value)) { if (($null -eq $e -and $null -eq $Node) -or ($null -ne $e -and $null -ne $Node -and "$e" -ceq "$Node")) { $hit = $true } }; if (-not $hit) { $out.Add("${Path}: '$Node' is not one of $(@($enum.Value | ForEach-Object { if ($null -eq $_) { 'null' } else { $_ } }) -join ', ')") } }
    if ($kind -eq 'string' -and $Node -isnot [datetime]) {
        $pat = & $sp 'pattern'; if ($pat -and "$Node" -cnotmatch $pat) { $out.Add("${Path}: '$Node' does not match $pat") }
        $min = & $sp 'minLength'; if ($null -ne $min -and "$Node".Length -lt [int]$min) { $out.Add("${Path}: shorter than $min") }
    }
    if ($kind -eq 'object') {
        foreach ($r in @(& $sp 'required')) { if ($r -and -not (Get-DEContractProp $Node $r).has) { $out.Add("${Path}.${r}: required") } }
        $props = & $sp 'properties'
        if ($props) { foreach ($pp in $props.PSObject.Properties) { $v = Get-DEContractProp $Node $pp.Name; if ($v.has) { foreach ($m in (Test-DEContractNode -Node $v.value -Schema $pp.Value -Path "$Path.$($pp.Name)")) { $out.Add($m) } } } }
    }
    if ($kind -eq 'array') {
        $items = & $sp 'items'
        if ($items) { $i = 0; foreach ($el in @($Node)) { foreach ($m in (Test-DEContractNode -Node $el -Schema $items -Path "$Path[$i]")) { $out.Add($m) }; $i++ } }
    }
    return $out
}
function Find-DEContractSecrets {
    <# Paths of keys that look like secrets and of values shaped like a BitLocker recovery password. #>
    param($Object, [string]$Path = '$')
    $hits = @()
    $kind = Get-DEJsonKind $Object
    if ($kind -eq 'object') {
        foreach ($k in (Get-DEContractKeys $Object)) {
            if ($k -match $script:SecretKey) { $hits += "$Path.$k" }
            $hits += @(Find-DEContractSecrets -Object (Get-DEContractProp $Object $k).value -Path "$Path.$k")
        }
    } elseif ($kind -eq 'array') { $i = 0; foreach ($el in @($Object)) { $hits += @(Find-DEContractSecrets -Object $el -Path "$Path[$i]"); $i++ } }
    elseif ($kind -eq 'string' -and "$Object" -match $script:RecoveryShape) { $hits += "$Path (recovery-password-shaped value)" }
    return $hits
}
function Remove-DEContractSecretKeys {
    <#
        A deep copy of -Object without the keys a contract refuses (the secret-looking names Find-DEContractSecrets
        reports). Values are kept as they are: a recovery-password-shaped value still stops New-DEHubEvent. Dictionaries
        come back as ordered dictionaries, objects as objects, lists as lists (also with one or no item). -DroppedKeys,
        when given, collects the names of the keys left out.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$Object, [AllowNull()][System.Collections.Generic.List[string]]$DroppedKeys)
    switch (Get-DEJsonKind $Object) {
        'object' {
            $o = [ordered]@{}
            foreach ($k in (Get-DEContractKeys $Object)) {
                if ($k -match $script:SecretKey) { if ($null -ne $DroppedKeys) { $DroppedKeys.Add($k) } }
                else { $o[$k] = Remove-DEContractSecretKeys -Object (Get-DEContractProp $Object $k).value -DroppedKeys $DroppedKeys }
            }
            if ($Object -is [System.Collections.IDictionary]) { return $o }
            return [pscustomobject]$o
        }
        'array' { $list = New-Object System.Collections.Generic.List[object]; foreach ($el in @($Object)) { $list.Add((Remove-DEContractSecretKeys -Object $el -DroppedKeys $DroppedKeys)) }; return , $list.ToArray() }
        default { return $Object }
    }
}
function Get-DEHubErrorReason {
    <#
        What to record when a call to the Intelligence Hub failed: the Hub's own reason from its response body
        (-ErrorRecord's ErrorDetails.Message; the JSON 'error' and 'message' fields when it is JSON, its text otherwise)
        followed by the .NET message, e.g. "Hub refused: account not mapped (The remote server returned an error:
        (422) Unprocessable Entity.)". The response body is the Hub's answer, never the signed request; control
        characters are flattened, a recovery-password-shaped value is masked, and the result is at most 400 characters.
    #>
    param([Parameter(Mandatory = $true)]$ErrorRecord)
    $why = $(if ($ErrorRecord -is [System.Management.Automation.ErrorRecord]) { "$($ErrorRecord.Exception.Message)" } elseif ($ErrorRecord -is [Exception]) { "$($ErrorRecord.Message)" } else { "$ErrorRecord" })
    $hub = $null
    if ($ErrorRecord -is [System.Management.Automation.ErrorRecord] -and $ErrorRecord.ErrorDetails -and $ErrorRecord.ErrorDetails.Message) {
        $hub = "$($ErrorRecord.ErrorDetails.Message)"
        try { $j = $hub | ConvertFrom-Json -ErrorAction Stop; if ($j -is [System.Management.Automation.PSCustomObject]) { $hub = (@($j.PSObject.Properties['error'], $j.PSObject.Properties['message']) | Where-Object { $_ -and $_.Value } | ForEach-Object { "$($_.Value)" }) -join ': ' } } catch { $null = $_ }   # not JSON: keep the Hub's text as it came
        $hub = ($hub -replace '[\x00-\x1f\x7f]+', ' ').Trim()
        if ($hub.Length -gt 300) { $hub = $hub.Substring(0, 300) + '...' }
    }
    $detail = $(if ($hub) { "Hub refused: $hub ($why)" } else { $why })
    $detail = $detail -replace $script:RecoveryShape, '[REDACTED]'
    if ($detail.Length -gt 400) { $detail = $detail.Substring(0, 400) }
    return $detail
}
function Test-DEContract {
    <# Problems with -Object against contract -Name; an empty list means valid. Secrets are always a problem. #>
    param([Parameter(Mandatory = $true)][ValidateSet('device', 'order', 'handoff', 'warranty', 'job', 'migration')][string]$Name, [Parameter(Mandatory = $true)]$Object)
    # Round-trip so hashtables, ordered dictionaries and objects all validate the same way they will be read.
    $node = $Object | ConvertTo-Json -Depth 20 | ConvertFrom-Json
    $problems = @(Test-DEContractNode -Node $node -Schema (Get-DEContractSchema -Name $Name) -Path '$')
    # secrets are looked for in the caller's object: the round trip flattens anything deeper than 20 levels, and the
    # canonical JSON that is sent does not
    $problems += @(Find-DEContractSecrets -Object $Object | ForEach-Object { "${_}: secrets never go in a $Name record" })
    return $problems
}
function ConvertTo-DEDeviceKey {
    <# <maker>:<SERIAL>, the same on the device, in WinPE and in the Hub. Maker comes from the manufacturer string. #>
    param([string]$Manufacturer, [Parameter(Mandatory = $true)][string]$Serial)
    $s = ($Serial.Trim().ToUpperInvariant() -replace '[^A-Z0-9-]', '')
    if (-not $s -or $s -match '^(TOBEFILLEDBYOEM|DEFAULTSTRING|SYSTEMSERIALNUMBER|0+|NONE|NA)$') { throw "serial '$Serial' is not usable as a device key (blank or an OEM placeholder); type it from the chassis sticker" }
    $m = "$Manufacturer".Trim().ToLowerInvariant()
    $maker = switch -Regex ($m) {
        '^dell' { 'dell' } '^lenovo' { 'lenovo' } '^(hp|hewlett)' { 'hp' } '^microsoft' { 'microsoft' } '^apple' { 'apple' } '^acer' { 'acer' } '^asus' { 'asus' }
        '^(dynabook|toshiba)' { 'dynabook' } '^samsung' { 'samsung' } '^panasonic' { 'panasonic' } '^framework' { 'framework' } '^(micro-star|msi)' { 'msi' } '^getac' { 'getac' } '^gigabyte' { 'gigabyte' }
        default { $x = ($m -replace '[^a-z0-9]+', '-').Trim('-'); if ($x) { $x } else { 'unknown' } }
    }
    return "${maker}:$s"
}

# ------------------------------------------------------------------ boot rescue handoff
function New-DEHandoff {
    param([Parameter(Mandatory = $true)][string]$Serial, [string]$Manufacturer, [string]$Model, [string]$Hostname, [string]$Technician, [string]$Client, [string]$Version = '0.0.0')
    return [ordered]@{
        schema = 'de.techconsole.handoff/v1'; source = "DERescue/$Version"; createdAt = (Get-Date).ToString('o'); handoffId = [guid]::NewGuid().ToString()
        deviceKey = (ConvertTo-DEDeviceKey -Manufacturer $Manufacturer -Serial $Serial); technician = $Technician; client = $Client
        device = [ordered]@{ serial = $Serial; manufacturer = $Manufacturer; model = $Model; hostname = $Hostname; osBuild = $null; osDisplayVersion = $null }
        windows = $null; disks = @(); actions = @(); recommendations = @(); reviewedBy = $null; reviewedAt = $null
    }
}
function Add-DEHandoffAction {
    param([Parameter(Mandatory = $true)]$Handoff, [Parameter(Mandatory = $true)][string]$Action, [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARN', 'FAIL', 'SKIPPED')][string]$Result, [string]$Detail, [string]$Path, [string]$ManifestSha256, [Nullable[int]]$Files, [Nullable[long]]$Bytes)
    $a = [ordered]@{ action = $Action; result = $Result; at = (Get-Date).ToString('o'); detail = $Detail }
    if ($Path) { $a.path = $Path }; if ($ManifestSha256) { $a.manifestSha256 = $ManifestSha256 }; if ($null -ne $Files) { $a.files = [int]$Files }; if ($null -ne $Bytes) { $a.bytes = [long]$Bytes }
    $Handoff.actions = @($Handoff.actions) + @($a)
    return $a
}
function Save-DEHandoff {
    <# Validates and writes the handoff as UTF-8 JSON to each -Path (a file path). Refuses when it does not validate. #>
    param([Parameter(Mandatory = $true)]$Handoff, [Parameter(Mandatory = $true)][string[]]$Path)
    $problems = @(Test-DEContract -Name 'handoff' -Object $Handoff)
    if ($problems.Count) { throw "handoff not saved: $($problems -join '; ')" }
    $json = $Handoff | ConvertTo-Json -Depth 20
    $written = @()
    foreach ($p in $Path) {
        $dir = Split-Path -Parent $p; if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
        [IO.File]::WriteAllText($p, $json, (New-Object Text.UTF8Encoding $false)); $written += $p
    }
    return $written
}
function Get-DEHandoffs {
    <# Handoff files in -Directory, newest first: @{ path; handoff; problems; reviewed }. Unreadable files are listed with the reason. #>
    param([Parameter(Mandatory = $true)][string]$Directory)
    if (-not (Test-Path -LiteralPath $Directory)) { return @() }
    $out = @()
    foreach ($f in @(Get-ChildItem -LiteralPath $Directory -Filter '*.json' -File | Sort-Object LastWriteTime -Descending)) {
        try { $h = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; $pr = @(Test-DEContract -Name 'handoff' -Object $h) }
        catch { $h = $null; $pr = @("unreadable: $($_.Exception.Message)") }
        $out += [pscustomobject]@{ path = $f.FullName; handoff = $h; problems = $pr; reviewed = [bool]($h -and $h.PSObject.Properties['reviewedBy'] -and $h.reviewedBy) }
    }
    return $out
}
function Confirm-DEHandoffReviewed {
    <# Records who reviewed a handoff and when; the file stays as the record. #>
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Technician)
    $h = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $h.reviewedBy = $Technician; $h.reviewedAt = (Get-Date).ToString('o')
    $null = Save-DEHandoff -Handoff $h -Path $Path
    return $h
}

# ------------------------------------------------------------------ signed events to the Intelligence Hub
# The Hub (artifacts/api-server/src/lib/de-sync-auth.ts) verifies HMAC-SHA256 over
# "METHOD\npath\ntimestamp\neventId\nsha256hex(body)" where body is JSON.stringify of the parsed request. So the
# bytes sent must already be exactly what JSON.stringify produces: compact, keys in order, only " \ and control
# characters escaped. ConvertTo-Json differs between Windows PowerShell 5.1 and 7 (5.1 escapes < > & '), so this
# module writes that JSON itself.
$script:HubEventsPath = '/api/integrations/v1/techconsole/events'
function ConvertTo-DEJsonString {
    param([string]$Text)
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('"')
    foreach ($ch in $Text.ToCharArray()) {
        $c = [int]$ch
        switch ($c) {
            34 { [void]$sb.Append('\"') } 92 { [void]$sb.Append('\\') } 8 { [void]$sb.Append('\b') } 12 { [void]$sb.Append('\f') }
            10 { [void]$sb.Append('\n') } 13 { [void]$sb.Append('\r') } 9 { [void]$sb.Append('\t') }
            default { if ($c -lt 32) { [void]$sb.Append(('\u{0:x4}' -f $c)) } else { [void]$sb.Append($ch) } }
        }
    }
    [void]$sb.Append('"')
    return $sb.ToString()
}
function ConvertTo-DEJsNumber {
    <# A number exactly as JavaScript writes it (JSON.stringify / Number.prototype.toString): shortest round-trip
       digits, plain notation from 1e-7 to 1e21, exponent 'e+N' / 'e-N' outside it, NaN and Infinity as null. #>
    param([Parameter(Mandatory = $true)][double]$Value)
    if ([double]::IsNaN($Value) -or [double]::IsInfinity($Value)) { return 'null' }
    if ($Value -eq 0) { return '0' }
    $inv = [Globalization.CultureInfo]::InvariantCulture
    $s = $Value.ToString('R', $inv)
    # .NET Framework 'R' can give 17 digits where 16 round-trip (JavaScript prints the shortest)
    $g16 = $Value.ToString('G16', $inv); if ([double]::Parse($g16, $inv) -eq $Value -and $g16.Length -lt $s.Length) { $s = $g16 }
    $neg = ''; if ($s.StartsWith('-')) { $neg = '-'; $s = $s.Substring(1) }
    $exp = 0; $i = $s.IndexOfAny([char[]]'Ee'); if ($i -ge 0) { $exp = [int]::Parse($s.Substring($i + 1), $inv); $s = $s.Substring(0, $i) }
    $dot = $s.IndexOf('.'); if ($dot -ge 0) { $exp += $dot; $s = $s.Remove($dot, 1) } else { $exp += $s.Length }
    $lead = $s.Length - $s.TrimStart('0').Length; $dg = $s.Trim('0'); $n = $exp - $lead; $k = $dg.Length
    if ($k -le $n -and $n -le 21) { return $neg + $dg + ('0' * ($n - $k)) }
    if (0 -lt $n -and $n -le 21) { return $neg + $dg.Substring(0, $n) + '.' + $dg.Substring($n) }
    if (-6 -lt $n -and $n -le 0) { return $neg + '0.' + ('0' * (-$n)) + $dg }
    $e = $n - 1; return $neg + $dg.Substring(0, 1) + $(if ($k -gt 1) { '.' + $dg.Substring(1) }) + 'e' + $(if ($e -ge 0) { "+$e" } else { "$e" })
}
function Get-DEJsKeyOrder {
    <# JavaScript enumerates array-index keys ('0'..'4294967294') first in ascending order, then the rest in insertion order. #>
    param([string[]]$Keys)
    $idx = @($Keys | Where-Object { $_ -match '^(0|[1-9]\d{0,9})$' -and [double]$_ -lt 4294967295 } | Sort-Object { [double]$_ })
    return @($idx) + @($Keys | Where-Object { $idx -notcontains $_ })
}
function ConvertTo-DECanonicalJson {
    <# JSON exactly as JavaScript's JSON.stringify writes it (no whitespace, insertion order kept, nulls kept). #>
    param([AllowNull()]$Object)
    $kind = Get-DEJsonKind $Object
    switch ($kind) {
        'null' { return 'null' }
        'boolean' { if ($Object) { return 'true' }; return 'false' }
        # the Hub re-serialises the parsed body with JSON.stringify, so every number is written as a JavaScript double would be
        'integer' { return (ConvertTo-DEJsNumber ([double]$Object)) }
        'number' { return (ConvertTo-DEJsNumber ([double]$Object)) }
        'string' { if ($Object -is [datetime]) { return (ConvertTo-DEJsonString $Object.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)) }; return (ConvertTo-DEJsonString "$Object") }
        'array' { return '[' + ((@($Object) | ForEach-Object { ConvertTo-DECanonicalJson $_ }) -join ',') + ']' }
        default {
            # an empty object has no keys: passing an empty list on would bind as $null and come back as one nameless key
            $keys = @(Get-DEContractKeys $Object); if (-not $keys.Count) { return '{}' }
            return '{' + ((Get-DEJsKeyOrder $keys | ForEach-Object { (ConvertTo-DEJsonString $_) + ':' + (ConvertTo-DECanonicalJson (Get-DEContractProp $Object $_).value) }) -join ',') + '}'
        }
    }
}
function Get-DEHubSignature {
    param([Parameter(Mandatory = $true)][string]$Method, [Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Timestamp, [Parameter(Mandatory = $true)][string]$EventId, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Body, [Parameter(Mandatory = $true)][string]$Secret)
    $utf8 = New-Object Text.UTF8Encoding $false
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $bodyHash = -join ($sha.ComputeHash($utf8.GetBytes($Body)) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose() }
    $canonical = @($Method.ToUpperInvariant(), $Path, $Timestamp, $EventId, $bodyHash) -join "`n"
    $h = New-Object Security.Cryptography.HMACSHA256 (, $utf8.GetBytes($Secret))
    try { return -join ($h.ComputeHash($utf8.GetBytes($canonical)) | ForEach-Object { $_.ToString('x2') }) } finally { $h.Dispose() }
}
function New-DEHubEvent {
    <# The Hub's de-sync envelope (version 1, source techconsole). Payloads are checked against their contract and for secrets first. #>
    param(
        [Parameter(Mandatory = $true)][ValidateSet('device.observed', 'device.rescue_handoff', 'device.warranty', 'email_migration.recorded')][string]$EventType,
        [Parameter(Mandatory = $true)][string]$EntityId, [Parameter(Mandatory = $true)]$Payload, [string]$CorrelationId, [string]$AccountId
    )
    $contract = @{ 'device.observed' = 'device'; 'device.rescue_handoff' = 'handoff'; 'device.warranty' = 'warranty'; 'email_migration.recorded' = 'migration' }[$EventType]
    $problems = @(Test-DEContract -Name $contract -Object $Payload)
    if ($problems.Count) { throw "not sending $EventType : $($problems -join '; ')" }
    return [ordered]@{
        eventId = [guid]::NewGuid().ToString(); eventType = $EventType; version = 1; source = 'techconsole'
        occurredAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)   # invariant: ':' is the culture's time separator otherwise (fi-FI writes '.')
        correlationId = $(if ($CorrelationId) { $CorrelationId } else { [guid]::NewGuid().ToString() })
        entityType = $(if ($contract -eq 'migration') { 'email_migration' } else { 'device' }); entityId = $EntityId; canonicalAccountId = $(if ($AccountId) { $AccountId } else { $null }); originEventId = $null
        payload = $Payload
    }
}
function Invoke-DEHubHttp {
    <# The only network call for Hub events, so tests replace it. Sends the exact bytes that were signed. #>
    param([Parameter(Mandatory = $true)][string]$Uri, [Parameter(Mandatory = $true)][hashtable]$Headers, [Parameter(Mandatory = $true)][string]$Body)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($Body)
    return (Invoke-RestMethod -Uri $Uri -Method Post -Headers $Headers -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -UseBasicParsing)
}
function Send-DEHubEvent {
    <#
        Signs and POSTs one event to <BaseUrl>/api/integrations/v1/techconsole/events. -Secret is the per-direction
        signing secret (TECHCONSOLE_TO_HUB_SECRET on the Hub), held as a SecureString and only unwrapped here in memory.
        HTTPS only. Returns the Hub's response.
    #>
    param([Parameter(Mandatory = $true)][string]$BaseUrl, [Parameter(Mandatory = $true)]$Event, [Parameter(Mandatory = $true)][securestring]$Secret)
    if ($BaseUrl -notmatch '^https://') { throw "Hub URL must be https:// (got '$BaseUrl')" }
    $body = ConvertTo-DECanonicalJson $Event
    $ts = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr); $sig = Get-DEHubSignature -Method 'POST' -Path $script:HubEventsPath -Timestamp $ts -EventId $Event.eventId -Body $body -Secret $plain }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $plain = $null }
    $headers = @{ 'X-DE-Event-ID' = $Event.eventId; 'X-DE-Timestamp' = $ts; 'X-DE-Source' = 'techconsole'; 'X-DE-Signature' = $sig }
    return (Invoke-DEHubHttp -Uri ($BaseUrl.TrimEnd('/') + $script:HubEventsPath) -Headers $headers -Body $body)
}

Export-ModuleMember -Function ConvertTo-DECanonicalJson, Get-DEHubSignature, New-DEHubEvent, Invoke-DEHubHttp, Send-DEHubEvent, Get-DEHubErrorReason, Get-DEContractsRoot, Get-DEContractSchema, Test-DEContract, Find-DEContractSecrets, Remove-DEContractSecretKeys, ConvertTo-DEDeviceKey, New-DEHandoff, Add-DEHandoffAction, Save-DEHandoff, Get-DEHandoffs, Confirm-DEHandoffReviewed
