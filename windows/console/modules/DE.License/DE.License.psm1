#Requires -Version 5.1
<#
.SYNOPSIS
    DE Tech Tool licences: who may use this copy, on which device, for which clients and features, until when.

.DESCRIPTION
    A licence is a compact token (header.payload.signature, base64url) signed RS256 by the Intelligence Hub. The tool
    holds only public keys (trust\license-keys.json), so it can check a licence but never make one. A licence names
    the device it was issued for (dev = <maker>:<SERIAL>), so copying it to another machine does nothing; it expires
    within hours (technician) or with its order (dropship); the latest time this tool has seen is remembered, so
    turning the clock back does not revive it; revoked licence IDs are refused, from the list shipped with the build
    (trust\revoked.json) and the list downloaded from the Hub (data folder); a licence pinned to a build (bid) works
    only in that build. trust\license-policy.json decides whether a missing licence only marks the run UNLICENSED
    ('warn') or stops changes ('required').
    This module cannot stop someone editing the scripts; see PROTECTING-THE-TOOL.md for why that is not the defence.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:ExtraKeys = @()          # session-only additions (tests, a Hub key fetched this session)
$script:PolicyOverride = $null
$script:Warned = @{}
$script:RevocationWarned = @{}     # an unreadable revocation list is logged once per file, not on every check
$script:RevocationMaxChars = 1048576
$script:RevocationMaxIds = 20000
$script:RevocationIdPattern = '^[A-Za-z0-9._:-]{1,128}$'

function Get-DELicenseRoot { return (Join-Path (Get-DEConsole).Root 'trust') }
function Get-DELicensePolicy {
    if ($script:PolicyOverride) { return $script:PolicyOverride }
    $f = Join-Path (Get-DELicenseRoot) 'license-policy.json'
    $p = $(if (Test-Path -LiteralPath $f) { Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null })
    $g = { param($n, $d) if ($p -and $p.PSObject.Properties[$n] -and $null -ne $p.$n) { $p.$n } else { $d } }
    return [pscustomobject]@{ enforce = $(if ("$(& $g 'enforce' 'warn')".Trim() -ieq 'warn') { 'warn' } else { 'required' }); maxTechnicianHours = [double](& $g 'maxTechnicianHours' 12); maxOrderDays = [double](& $g 'maxOrderDays' 45); clockSkewMinutes = [double](& $g 'clockSkewMinutes' 5); issuer = "$(& $g 'issuer' 'de-hub')"; audience = "$(& $g 'audience' 'de-techtool')" }
}
function Set-DELicensePolicyOverride { <# Session only (tests, rehearsals). #> param($Policy) $script:PolicyOverride = $Policy; $script:Warned = @{} }
function Get-DELicenseTrustedKeys {
    $f = Join-Path (Get-DELicenseRoot) 'license-keys.json'
    $keys = @(); if (Test-Path -LiteralPath $f) { $keys = @((Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json).keys | Where-Object { $_ -and $_.kid -and $_.n -and $_.e }) }
    return @($keys + $script:ExtraKeys)
}
function Add-DELicenseTrustedKey {
    <# Adds a public key (kid, n, e as base64url) for this session only. Never persisted by the tool. #>
    param([Parameter(Mandatory = $true)][string]$Kid, [Parameter(Mandatory = $true)][string]$Modulus, [Parameter(Mandatory = $true)][string]$Exponent)
    $script:ExtraKeys = @($script:ExtraKeys | Where-Object { $_.kid -ne $Kid }) + @([pscustomobject]@{ kid = $Kid; n = $Modulus; e = $Exponent })
}
function ConvertFrom-DEBase64Url {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $s = $Text.Replace('-', '+').Replace('_', '/'); switch ($s.Length % 4) { 2 { $s += '==' } 3 { $s += '=' } 1 { throw 'invalid base64url' } }
    return [Convert]::FromBase64String($s)
}
function ConvertTo-DEBase64Url { param([Parameter(Mandatory = $true)][byte[]]$Bytes) return ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')) }
function Get-DEThisDeviceKey {
    try { $inv = Get-DEDeviceInventory; return (ConvertTo-DEDeviceKey -Manufacturer "$($inv.manufacturer)" -Serial "$($inv.serial)") } catch { return $null }
}

# ------------------------------------------------------------------ revocation lists
function ConvertTo-DELicenseIsoTime {
    <# A time from a revocation list as ISO 8601 UTC, or $null. PowerShell 7 reads ISO strings in JSON as dates, 5.1 keeps them as text. #>
    param([AllowNull()]$Value)
    if ($null -eq $Value -or "$Value" -eq '') { return $null }
    if ($Value -is [datetime]) { return $Value.ToUniversalTime().ToString('o') }
    $dt = [datetime]::MinValue
    if (-not [datetime]::TryParse("$Value", [Globalization.CultureInfo]::InvariantCulture, ([Globalization.DateTimeStyles]::AdjustToUniversal -bor [Globalization.DateTimeStyles]::AssumeUniversal), [ref]$dt)) { throw "'$Value' is not a time" }
    return $dt.ToString('o')
}
function ConvertFrom-DELicenseRevocationList {
    <#
        Reads a revocation list: { "jti": [licence ids], "updatedAt": "<iso>" | null }, the shape of trust\revoked.json and
        of the Hub's GET /api/techtool/license/revocations. Throws with the reason when the text is too large, is not
        JSON, has no jti list, or holds an entry that is not a licence id. Returns @{ jti; updatedAt; fetchedAt }.
        Needs no console, so the release build uses it too.
    #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Json)
    if ($Json.Length -gt $script:RevocationMaxChars) { throw "the revocation list is larger than $($script:RevocationMaxChars) characters" }
    if (-not $Json.Trim()) { throw 'the revocation list is empty' }
    try { $o = $Json | ConvertFrom-Json } catch { throw 'the revocation list is not JSON' }
    if ($null -eq $o -or $o -is [array] -or $o -is [string] -or -not $o.PSObject.Properties['jti']) { throw 'the revocation list has no jti list' }
    $list = $o.jti
    if ($null -eq $list -or $list -isnot [array]) { throw 'jti in the revocation list is not a list' }
    if ($list.Count -gt $script:RevocationMaxIds) { throw "the revocation list holds $($list.Count) ids, more than $($script:RevocationMaxIds)" }
    foreach ($j in $list) { if ($j -isnot [string] -or $j -notmatch $script:RevocationIdPattern) { throw 'the revocation list holds an entry that is not a licence id' } }
    try { $upd = ConvertTo-DELicenseIsoTime $(if ($o.PSObject.Properties['updatedAt']) { $o.updatedAt }) } catch { throw "updatedAt in the revocation list: $($_.Exception.Message)" }
    $fetched = $null; try { $fetched = ConvertTo-DELicenseIsoTime $(if ($o.PSObject.Properties['fetchedAt']) { $o.fetchedAt }) } catch { $fetched = $null }
    return [pscustomobject]@{ jti = [string[]]@($list | Select-Object -Unique); updatedAt = $upd; fetchedAt = $fetched }
}
function Get-DELicenseRevocationFile {
    <# Where the list downloaded from the Hub is kept: the data folder (SYSTEM/Administrators only), never trust\, which integrity.json covers. #>
    $d = (Get-DEConsole).Dirs
    if (-not $d -or -not $d['State']) { return $null }
    return (Join-Path $d['State'] 'license-revocations.json')
}
function Read-DELicenseRevocationFile {
    <# One list file, or $null when it is missing or unreadable (logged once per file). Never throws. #>
    param([AllowNull()][string]$Path)
    if (-not $Path -or -not (Test-Path -LiteralPath $Path)) { return $null }
    try { return (ConvertFrom-DELicenseRevocationList -Json (Get-Content -LiteralPath $Path -Raw -Encoding UTF8)) }
    catch {
        if (-not $script:RevocationWarned.ContainsKey($Path)) { $script:RevocationWarned[$Path] = $true; try { Write-DELog -Level WARN -Message "revocation list $Path is unreadable ($($_.Exception.Message)); ignored" } catch { } }
        return $null
    }
}
function Get-DELicenseRevocations {
    <#
        The licence IDs this tool refuses: the list shipped with the build (trust\revoked.json) plus the list last
        downloaded from the Hub (Update-DELicenseRevocations). Returns @{ jti; shipped; downloaded; updatedAt; fetchedAt }.
    #>
    $shipped = Read-DELicenseRevocationFile -Path (Join-Path (Get-DELicenseRoot) 'revoked.json')
    $down = Read-DELicenseRevocationFile -Path (Get-DELicenseRevocationFile)
    $s = @($(if ($shipped) { $shipped.jti })); $d = @($(if ($down) { $down.jti }))
    return [pscustomobject]@{ jti = @(@($s + $d) | Select-Object -Unique); shipped = $s.Count; downloaded = $d.Count; updatedAt = $(if ($down) { $down.updatedAt } else { $null }); fetchedAt = $(if ($down) { $down.fetchedAt } else { $null }) }
}
function Test-DELicenseToken {
    <#
        Checks one licence: RS256 signature by a trusted key, issuer and audience, the validity window (with the
        policy's clock skew and maximum length), the device, the clock-rollback guard, revocation (the shipped list and
        the one downloaded from the Hub), and the build pin (bid; a licence without one works in any build).
        Returns @{ valid; state; reason; claims }.
        state: valid | invalid | expired | not-yet | wrong-device | clock | revoked | wrong-build.
        -BuildId defaults to this copy's build (Get-DEBuildInfo), read only when the licence names one.
    #>
    param([Parameter(Mandatory = $true)][string]$Token, [string]$DeviceKey = (Get-DEThisDeviceKey), [datetime]$Now = (Get-Date).ToUniversalTime(), [string]$BuildId)
    $bad = { param($state, $why, $c) return [pscustomobject]@{ valid = $false; state = $state; reason = $why; claims = $c } }
    $pol = Get-DELicensePolicy
    $parts = $Token.Trim().Split('.')
    if ($parts.Count -ne 3) { return (& $bad 'invalid' 'not a licence token' $null) }
    try { $hdr = [Text.Encoding]::UTF8.GetString((ConvertFrom-DEBase64Url $parts[0])) | ConvertFrom-Json; $claims = [Text.Encoding]::UTF8.GetString((ConvertFrom-DEBase64Url $parts[1])) | ConvertFrom-Json; $sig = ConvertFrom-DEBase64Url $parts[2] } catch { return (& $bad 'invalid' 'licence token is not readable' $null) }
    if ("$($hdr.alg)" -ne 'RS256') { return (& $bad 'invalid' "algorithm '$($hdr.alg)' is not accepted (RS256 only)" $claims) }
    $key = @(Get-DELicenseTrustedKeys | Where-Object { $_.kid -eq "$($hdr.kid)" }) | Select-Object -First 1
    if (-not $key) { return (& $bad 'invalid' "signed by an unknown key '$($hdr.kid)'" $claims) }
    $rsa = [Security.Cryptography.RSA]::Create()
    try {
        $prm = New-Object Security.Cryptography.RSAParameters; $prm.Modulus = ConvertFrom-DEBase64Url $key.n; $prm.Exponent = ConvertFrom-DEBase64Url $key.e; $rsa.ImportParameters($prm)
        $ok = $rsa.VerifyData([Text.Encoding]::ASCII.GetBytes("$($parts[0]).$($parts[1])"), $sig, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
    } finally { $rsa.Dispose() }
    if (-not $ok) { return (& $bad 'invalid' 'signature does not verify' $claims) }
    if ("$($claims.iss)" -ne $pol.issuer -or "$($claims.aud)" -ne $pol.audience) { return (& $bad 'invalid' "issued by '$($claims.iss)' for '$($claims.aud)'" $claims) }
    $epoch = New-Object DateTime 1970, 1, 1, 0, 0, 0, ([DateTimeKind]::Utc)
    try { $iat = $epoch.AddSeconds([double]$claims.iat); $nbf = $epoch.AddSeconds([double]$(if ($claims.PSObject.Properties['nbf']) { $claims.nbf } else { $claims.iat })); $exp = $epoch.AddSeconds([double]$claims.exp) } catch { return (& $bad 'invalid' 'iat/nbf/exp missing' $claims) }
    $skew = [TimeSpan]::FromMinutes($pol.clockSkewMinutes)
    $order = ("$($claims.typ)" -eq 'order')
    $maxLen = $(if ($order) { [TimeSpan]::FromDays($pol.maxOrderDays) } else { [TimeSpan]::FromHours($pol.maxTechnicianHours) })
    if (($exp - $iat) -gt ($maxLen + $skew)) { return (& $bad 'invalid' "valid for longer than policy allows ($([math]::Round(($exp - $iat).TotalHours, 1)) h)" $claims) }
    $last = $null; try { $ls = Get-DEState -Path 'license.lastSeen'; if ($ls) { $last = ([datetime]$ls).ToUniversalTime() } } catch { $last = $null }
    if ($last -and $Now -lt $last.Add(-$skew)) { return (& $bad 'clock' "the clock is earlier than a time this tool has already seen ($($last.ToString('u'))); set the right time" $claims) }
    if ($Now -lt $nbf.Add(-$skew)) { return (& $bad 'not-yet' "not valid before $($nbf.ToString('u'))" $claims) }
    if ($Now -gt $exp.Add($skew)) { return (& $bad 'expired' "expired $($exp.ToString('u'))" $claims) }
    $dev = @($claims.dev | Where-Object { $_ })
    if (-not $dev.Count -or $dev -contains '*') { return (& $bad 'invalid' 'a licence must name its device' $claims) }
    if (-not $DeviceKey -or $dev -notcontains $DeviceKey) { return (& $bad 'wrong-device' "issued for $($dev -join ', '), this device is $(if ($DeviceKey) { $DeviceKey } else { 'unknown (no usable serial)' })" $claims) }
    if (-not "$($claims.jti)") { return (& $bad 'invalid' 'licence has no id (jti), so it could never be revoked' $claims) }
    if (@((Get-DELicenseRevocations).jti) -contains "$($claims.jti)") { return (& $bad 'revoked' "licence $($claims.jti) was revoked" $claims) }
    $pin = $(if ($claims.PSObject.Properties['bid']) { "$($claims.bid)".Trim() } else { '' })
    if ($pin) {
        if (-not $PSBoundParameters.ContainsKey('BuildId')) { $BuildId = "$((Get-DEBuildInfo).buildId)" }
        if ($pin -cne $BuildId) { return (& $bad 'wrong-build' "this licence is for DE Tech Tool build $pin, and this copy is build $BuildId; run the build it was issued for, or activate this copy again" $claims) }
    }
    return [pscustomobject]@{ valid = $true; state = 'valid'; reason = "licensed to $($claims.sub) until $($exp.ToString('u'))"; claims = $claims; expires = $exp }
}
# ------------------------------------------------------------------ the stored licence
# The token lives in its own file in the data folder (state\license.jws, SYSTEM/Administrators only by the folder's ACL),
# never in the state file, logs, evidence, bundles, the Hub record or a profile. State keeps only metadata about it.
function Get-DELicenseTokenFile {
    <# Where the stored licence token is kept, or $null before Initialize-DEConsole. #>
    $d = (Get-DEConsole).Dirs
    if (-not $d -or -not $d['State']) { return $null }
    return (Join-Path $d['State'] 'license.jws')
}
function Write-DELicenseFile {
    <# Write-then-replace (UTF-8 without BOM), so a power cut never leaves half a file. The file inherits the data folder's ACL. #>
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $tmp = "$Path.tmp"
    [IO.File]::WriteAllText($tmp, $Text, (New-Object Text.UTF8Encoding $false))
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($tmp, $Path, [NullString]::Value) } else { [IO.File]::Move($tmp, $Path) }
}
function Read-DELicenseToken {
    <# The stored licence token, or $null when there is none or the file cannot be read. Never throws; the caller re-verifies it. #>
    $f = Get-DELicenseTokenFile
    if (-not $f -or -not (Test-Path -LiteralPath $f)) { return $null }
    try { $t = ([IO.File]::ReadAllText($f)).Trim(); if ($t) { return $t } } catch { try { Write-DELog -Level WARN -Message "the stored licence could not be read ($($_.Exception.Message)); treated as no licence" } catch { } }
    return $null
}
function Remove-DELicenseLegacyToken {
    <# Builds before 1.10.0 kept the token in state, where the state scrub saved it as [REDACTED]. Drop that key (no licence, no crash). #>
    $l = Get-DEState -Path 'license'
    if ($l -is [System.Collections.IDictionary] -and $l.Contains('token')) { $l.Remove('token'); Save-DEState }
}
function Set-DELicense {
    <# Stores a licence after checking it: the token in state\license.jws, metadata in state. A licence that does not verify is never stored. #>
    param([Parameter(Mandatory = $true)][string]$Token)
    $t = Test-DELicenseToken -Token $Token
    if (-not $t.valid) { throw "licence not accepted: $($t.reason)" }
    $f = Get-DELicenseTokenFile
    if (-not $f) { throw 'licence not stored: the data folder is not set up (Initialize-DEConsole)' }
    Write-DELicenseFile -Path $f -Text $Token.Trim()
    Remove-DELicenseLegacyToken
    $c = $t.claims
    Set-DEStateValue -Path 'license.current' -Value ([ordered]@{ jti = "$($c.jti)"; sub = "$($c.sub)"; dev = @($c.dev | Where-Object { $_ } | ForEach-Object { "$_" }); exp = $t.expires.ToString('o'); features = @($c.features | Where-Object { $_ } | ForEach-Object { "$_" }); clients = @($c.clients | Where-Object { $_ } | ForEach-Object { "$_" }); state = 'valid'; storedAt = (Get-Date).ToUniversalTime().ToString('o') })
    Set-DEStateValue -Path 'license.lastSeen' -Value (Get-Date).ToUniversalTime().ToString('o')
    $script:Warned = @{}
    Write-DELog -Level INFO -Message "licence accepted: $($t.reason) (id $($c.jti))"
    return (Get-DELicenseStatus)
}
function Clear-DELicense {
    <# Removes the stored licence: the token file and its metadata. #>
    $f = Get-DELicenseTokenFile
    if ($f) { foreach ($x in @($f, "$f.tmp")) { if (Test-Path -LiteralPath $x) { [IO.File]::Delete($x) } } }
    Remove-DELicenseLegacyToken
    if (Get-DEState -Path 'license.current') { Set-DEStateValue -Path 'license.current' -Value $null }
    $script:Warned = @{}
}
function Get-DELicenseStatus {
    <# The stored licence (state\license.jws), re-verified now. Moves the clock-rollback mark forward when valid. #>
    $pol = Get-DELicensePolicy
    Remove-DELicenseLegacyToken
    $tok = Read-DELicenseToken
    $b = Get-DEBuildInfo
    if (-not $tok) { return [pscustomobject]@{ state = 'missing'; valid = $false; reason = 'no licence on this device'; technician = $null; clients = @(); features = @(); expires = $null; id = $null; enforce = $pol.enforce; build = $b.buildId } }
    $t = Test-DELicenseToken -Token $tok
    if ($t.valid) { $now = (Get-Date).ToUniversalTime(); $last = Get-DEState -Path 'license.lastSeen'; if (-not $last -or $now -gt ([datetime]$last).ToUniversalTime()) { Set-DEStateValue -Path 'license.lastSeen' -Value $now.ToString('o') } }
    $meta = Get-DEState -Path 'license.current'
    if ($meta -is [System.Collections.IDictionary] -and "$($meta['state'])" -ne $t.state) { $meta['state'] = $t.state; Save-DEState }
    $c = $t.claims
    return [pscustomobject]@{ state = $t.state; valid = $t.valid; reason = $t.reason; technician = $(if ($c) { "$($c.sub)" } else { $null }); clients = @($(if ($c) { $c.clients })); features = @($(if ($c) { $c.features })); expires = $(if ($t.valid) { $t.expires.ToString('o') } else { $null }); id = $(if ($c) { "$($c.jti)" } else { $null }); enforce = $pol.enforce; build = $b.buildId }
}
function Test-DELicenseFor {
    <#
        May this session do -Feature (for -Client)? Returns @{ ok; licensed; reason }. Under policy 'warn' an unlicensed
        use is allowed and logged once per feature; under 'required' it is refused.
    #>
    param([Parameter(Mandatory = $true)][ValidateSet('apply', 'toolbox', 'clients', 'rescue', 'msadmin')][string]$Feature, [string]$Client)
    $s = Get-DELicenseStatus
    $why = $null
    if (-not $s.valid) { $why = $s.reason }
    elseif (@($s.features) -notcontains $Feature -and @($s.features) -notcontains '*') { $why = "the licence for $($s.technician) does not include '$Feature'" }
    elseif ($Client -and @($s.clients) -notcontains $Client -and @($s.clients) -notcontains '*') { $why = "the licence for $($s.technician) does not include client '$Client'" }
    if (-not $why) { return [pscustomobject]@{ ok = $true; licensed = $true; reason = $s.reason } }
    if ($s.enforce -eq 'required') { return [pscustomobject]@{ ok = $false; licensed = $false; reason = "UNLICENSED: $why. Activate this device in DE Tech Tool (Settings > Licence) with your DE account." } }
    if (-not $script:Warned.ContainsKey($Feature)) { $script:Warned[$Feature] = $true; try { Add-DEEvidence -Step "license.$Feature" -Module 'license' -Before 'unlicensed' -ActionTaken "allowed under policy 'warn': $why" -Result 'WARN' -Remediation 'Activate a DE licence on this device.' | Out-Null } catch { } }
    return [pscustomobject]@{ ok = $true; licensed = $false; reason = "UNLICENSED (policy warn): $why" }
}
function Get-DEBuildInfo {
    <# The build watermark written by New-DEReleasePackage.ps1: build ID, when, and who the copy was issued to. #>
    $f = Join-Path (Get-DEConsole).Root 'BUILD.json'
    if (Test-Path -LiteralPath $f) { try { $b = Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json; return [pscustomobject]@{ buildId = "$($b.buildId)"; builtAt = "$($b.builtAt)"; issuedTo = "$($b.issuedTo)"; channel = "$($b.channel)" } } catch { } }
    return [pscustomobject]@{ buildId = 'dev'; builtAt = $null; issuedTo = 'development checkout'; channel = 'dev' }
}

# ------------------------------------------------------------------ activation with the Hub (device code)
function Invoke-DELicenseHub { <# The only network call for licences, so tests replace it. #> param([Parameter(Mandatory = $true)][string]$Uri, [Parameter(Mandatory = $true)][hashtable]$Body) try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }; return (Invoke-RestMethod -Uri $Uri -Method Post -Body ((New-Object Text.UTF8Encoding $false).GetBytes(($Body | ConvertTo-Json -Compress))) -ContentType 'application/json; charset=utf-8' -TimeoutSec 30 -UseBasicParsing) }
function Start-DELicenseActivation {
    <# Asks the Hub for a device code for THIS device. The technician approves it in the Hub (signed in with their DE account). #>
    param([Parameter(Mandatory = $true)][string]$HubUrl)
    if ($HubUrl -notmatch '^https://') { throw 'the Hub URL must be https://' }
    $dk = Get-DEThisDeviceKey; if (-not $dk) { throw 'this device has no usable serial, so it cannot be licensed; fix the serial in firmware first' }
    $b = Get-DEBuildInfo
    $r = Invoke-DELicenseHub -Uri ($HubUrl.TrimEnd('/') + '/api/techtool/license/device-code') -Body @{ deviceKey = $dk; buildId = $b.buildId; hostname = "$env:COMPUTERNAME" }
    return [pscustomobject]@{ userCode = "$($r.userCode)"; verificationUrl = "$($r.verificationUrl)"; deviceCode = "$($r.deviceCode)"; interval = [int]$(if ($r.interval) { $r.interval } else { 5 }); expiresIn = [int]$(if ($r.expiresIn) { $r.expiresIn } else { 600 }) }
}
function Complete-DELicenseActivation {
    <# Polls until the technician approves (or the code expires), then stores the licence. #>
    param([Parameter(Mandatory = $true)][string]$HubUrl, [Parameter(Mandatory = $true)][string]$DeviceCode, [int]$Interval = 5, [int]$TimeoutSeconds = 600)
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        $r = Invoke-DELicenseHub -Uri ($HubUrl.TrimEnd('/') + '/api/techtool/license/token') -Body @{ deviceCode = $DeviceCode }
        if ($r.license) {
            $s = Set-DELicense -Token "$($r.license)"
            $null = Update-DELicenseRevocations -HubUrl $HubUrl   # best effort; never undoes the activation
            return $s
        }
        if ("$($r.error)" -notin @('authorization_pending', 'slow_down')) { throw "activation refused: $($r.error)" }
        Start-Sleep -Seconds $Interval
    }
    throw 'activation code expired; start again'
}

# ------------------------------------------------------------------ the Hub's revocation list
function Invoke-DELicenseHubGet { <# The only licence GET (the revocation list), so tests replace it. Returns the body as text. #> param([Parameter(Mandatory = $true)][string]$Uri) try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }; $r = Invoke-WebRequest -Uri $Uri -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop; return "$($r.Content)" }
function Get-DELicenseHubUrl {
    <# The Hub's base URL (https://host) from Settings (settings.hub.endpoint), or $null when none is set or it is not https. #>
    $ep = "$(Get-DEState -Path 'settings.hub.endpoint')".Trim()
    if ($ep -notmatch '^https://') { return $null }
    try { return ([uri]$ep).GetLeftPart([UriPartial]::Authority) } catch { return $null }
}
function Update-DELicenseRevocations {
    <#
        Downloads the Hub's revocation list (GET <hub>/api/techtool/license/revocations, https only), checks its shape and
        saves it in the data folder (SYSTEM/Administrators only) by write-then-replace; trust\ is never written at run
        time (integrity.json covers it). Best effort: no network, a non-https URL, a malformed or an older answer changes
        nothing (the last saved list stays) and is logged without secrets. Never throws, never makes a licence valid.
        Returns @{ ok; updated; count; updatedAt; reason }.
    #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$HubUrl)
    $res = { param($ok, $updated, $count, $at, $why) [pscustomobject]@{ ok = $ok; updated = $updated; count = $count; updatedAt = $at; reason = $why } }
    try {
        if ($HubUrl -notmatch '^https://') { Write-DELog -Level WARN -Message 'revocation list not downloaded: the Hub URL must be https://'; return (& $res $false $false 0 $null 'the Hub URL must be https://') }
        $base = ([uri]$HubUrl).GetLeftPart([UriPartial]::Authority)
        $target = Get-DELicenseRevocationFile
        if (-not $target) { return (& $res $false $false 0 $null 'the data folder is not set up (Initialize-DEConsole)') }
        $saved = Read-DELicenseRevocationFile -Path $target
        try { $body = Invoke-DELicenseHubGet -Uri ($base + '/api/techtool/license/revocations') }
        catch { $why = "the Hub did not answer ($($_.Exception.Message))"; Write-DELog -Level WARN -Message "revocation list not downloaded from ${base}: $why; the last saved list stays"; return (& $res $false $false $(if ($saved) { @($saved.jti).Count } else { 0 }) $(if ($saved) { $saved.updatedAt }) $why) }
        try { $list = ConvertFrom-DELicenseRevocationList -Json $body }
        catch { $why = "refused the answer: $($_.Exception.Message)"; Write-DELog -Level WARN -Message "revocation list from ${base}: $why; the last saved list stays"; return (& $res $false $false $(if ($saved) { @($saved.jti).Count } else { 0 }) $(if ($saved) { $saved.updatedAt }) $why) }
        # never step back to an older list than the one saved (a stale cache or a replayed answer)
        if ($saved -and $saved.updatedAt -and (-not $list.updatedAt -or ([datetime]$list.updatedAt).ToUniversalTime() -lt ([datetime]$saved.updatedAt).ToUniversalTime())) {
            Write-DELog -Level WARN -Message "revocation list from ${base} is older than the saved one ($($saved.updatedAt)); the saved list stays"
            return (& $res $true $false @($saved.jti).Count $saved.updatedAt 'the Hub answered with an older list; the saved list stays')
        }
        $doc = [ordered]@{ about = 'Licence IDs revoked on the Intelligence Hub, downloaded by DE Tech Tool (Update-DELicenseRevocations). Checked together with trust\revoked.json.'; source = $base; fetchedAt = (Get-Date).ToUniversalTime().ToString('o'); updatedAt = $list.updatedAt; jti = @($list.jti) }
        Write-DELicenseFile -Path $target -Text ($doc | ConvertTo-Json -Depth 4)
        Write-DELog -Level INFO -Message ("revocation list downloaded from {0}: {1} revoked licence id(s), updated {2}" -f $base, @($list.jti).Count, $(if ($list.updatedAt) { $list.updatedAt } else { 'never' }))
        return (& $res $true $true @($list.jti).Count $list.updatedAt '')
    } catch {
        $why = "could not save the revocation list ($($_.Exception.Message))"
        try { Write-DELog -Level WARN -Message "$why; the last saved list stays" } catch { }
        return (& $res $false $false 0 $null $why)
    }
}

Export-ModuleMember -Function Get-DELicensePolicy, Set-DELicensePolicyOverride, Get-DELicenseTrustedKeys, Add-DELicenseTrustedKey, ConvertFrom-DEBase64Url, ConvertTo-DEBase64Url, Get-DEThisDeviceKey, Test-DELicenseToken, Set-DELicense, Clear-DELicense, Get-DELicenseStatus, Test-DELicenseFor, Get-DEBuildInfo, Invoke-DELicenseHub, Start-DELicenseActivation, Complete-DELicenseActivation, ConvertFrom-DELicenseRevocationList, Get-DELicenseRevocationFile, Get-DELicenseRevocations, Get-DELicenseTokenFile, Invoke-DELicenseHubGet, Get-DELicenseHubUrl, Update-DELicenseRevocations
