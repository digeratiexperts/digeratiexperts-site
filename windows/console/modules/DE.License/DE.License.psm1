#Requires -Version 5.1
<#
.SYNOPSIS
    DE Tech Tool licences: who may use this copy, on which device, for which clients and features, until when.

.DESCRIPTION
    A licence is a compact token (header.payload.signature, base64url) signed RS256 by the Intelligence Hub. The tool
    holds only public keys (trust\license-keys.json), so it can check a licence but never make one. A licence names
    the device it was issued for (dev = <maker>:<SERIAL>), so copying it to another machine does nothing; it expires
    within hours (technician) or with its order (dropship); the latest time this tool has seen is remembered, so
    turning the clock back does not revive it; revoked licence IDs are refused. trust\license-policy.json decides
    whether a missing licence only marks the run UNLICENSED ('warn') or stops changes ('required').
    This module cannot stop someone editing the scripts; see PROTECTING-THE-TOOL.md for why that is not the defence.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:ExtraKeys = @()          # session-only additions (tests, a Hub key fetched this session)
$script:PolicyOverride = $null
$script:Warned = @{}

function Get-DELicenseRoot { return (Join-Path (Get-DEConsole).Root 'trust') }
function Get-DELicensePolicy {
    if ($script:PolicyOverride) { return $script:PolicyOverride }
    $f = Join-Path (Get-DELicenseRoot) 'license-policy.json'
    $p = $(if (Test-Path -LiteralPath $f) { Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json } else { $null })
    $g = { param($n, $d) if ($p -and $p.PSObject.Properties[$n] -and $null -ne $p.$n) { $p.$n } else { $d } }
    return [pscustomobject]@{ enforce = "$(& $g 'enforce' 'warn')"; maxTechnicianHours = [double](& $g 'maxTechnicianHours' 12); maxOrderDays = [double](& $g 'maxOrderDays' 45); clockSkewMinutes = [double](& $g 'clockSkewMinutes' 5); issuer = "$(& $g 'issuer' 'de-hub')"; audience = "$(& $g 'audience' 'de-techtool')" }
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
function Test-DELicenseToken {
    <#
        Checks one licence: RS256 signature by a trusted key, issuer and audience, the validity window (with the
        policy's clock skew and maximum length), the device, the clock-rollback guard, and revocation.
        Returns @{ valid; state; reason; claims }. state: valid | invalid | expired | not-yet | wrong-device | clock | revoked.
    #>
    param([Parameter(Mandatory = $true)][string]$Token, [string]$DeviceKey = (Get-DEThisDeviceKey), [datetime]$Now = (Get-Date).ToUniversalTime())
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
    $rev = Join-Path (Get-DELicenseRoot) 'revoked.json'
    if ((Test-Path -LiteralPath $rev) -and (@((Get-Content -LiteralPath $rev -Raw -Encoding UTF8 | ConvertFrom-Json).jti) -contains "$($claims.jti)")) { return (& $bad 'revoked' "licence $($claims.jti) was revoked" $claims) }
    return [pscustomobject]@{ valid = $true; state = 'valid'; reason = "licensed to $($claims.sub) until $($exp.ToString('u'))"; claims = $claims; expires = $exp }
}
function Set-DELicense {
    <# Stores a licence after checking it (the data folder is SYSTEM/Administrators only). A licence that does not verify is never stored. #>
    param([Parameter(Mandatory = $true)][string]$Token)
    $t = Test-DELicenseToken -Token $Token
    if (-not $t.valid) { throw "licence not accepted: $($t.reason)" }
    Set-DEStateValue -Path 'license.token' -Value $Token.Trim()
    Set-DEStateValue -Path 'license.lastSeen' -Value (Get-Date).ToUniversalTime().ToString('o')
    $script:Warned = @{}
    Write-DELog -Level INFO -Message "licence accepted: $($t.reason) (id $($t.claims.jti))"
    return (Get-DELicenseStatus)
}
function Clear-DELicense { Set-DEStateValue -Path 'license.token' -Value $null; $script:Warned = @{} }
function Get-DELicenseStatus {
    <# The stored licence, checked now. Moves the clock-rollback mark forward when valid. #>
    $pol = Get-DELicensePolicy
    $tok = Get-DEState -Path 'license.token'
    $b = Get-DEBuildInfo
    if (-not $tok) { return [pscustomobject]@{ state = 'missing'; valid = $false; reason = 'no licence on this device'; technician = $null; clients = @(); features = @(); expires = $null; id = $null; enforce = $pol.enforce; build = $b.buildId } }
    $t = Test-DELicenseToken -Token $tok
    if ($t.valid) { $now = (Get-Date).ToUniversalTime(); $last = Get-DEState -Path 'license.lastSeen'; if (-not $last -or $now -gt ([datetime]$last).ToUniversalTime()) { Set-DEStateValue -Path 'license.lastSeen' -Value $now.ToString('o') } }
    $c = $t.claims
    return [pscustomobject]@{ state = $t.state; valid = $t.valid; reason = $t.reason; technician = $(if ($c) { "$($c.sub)" }); clients = @($(if ($c) { $c.clients })); features = @($(if ($c) { $c.features })); expires = $(if ($t.valid) { $t.expires.ToString('o') }); id = $(if ($c) { "$($c.jti)" }); enforce = $pol.enforce; build = $b.buildId }
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
        if ($r.license) { return (Set-DELicense -Token "$($r.license)") }
        if ("$($r.error)" -notin @('authorization_pending', 'slow_down')) { throw "activation refused: $($r.error)" }
        Start-Sleep -Seconds $Interval
    }
    throw 'activation code expired; start again'
}

Export-ModuleMember -Function Get-DELicensePolicy, Set-DELicensePolicyOverride, Get-DELicenseTrustedKeys, Add-DELicenseTrustedKey, ConvertFrom-DEBase64Url, ConvertTo-DEBase64Url, Get-DEThisDeviceKey, Test-DELicenseToken, Set-DELicense, Clear-DELicense, Get-DELicenseStatus, Test-DELicenseFor, Get-DEBuildInfo, Invoke-DELicenseHub, Start-DELicenseActivation, Complete-DELicenseActivation
