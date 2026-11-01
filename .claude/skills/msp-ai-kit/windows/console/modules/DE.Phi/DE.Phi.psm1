# ------------------------------------------------------------------ PHI-restricted mode
#
# Decided by Joe, 2026-11-01 (issue #890). When a client is healthcare - or a device may hold PHI -
# DE Tech Tool runs restricted:
#
#   1. system metadata only: no file contents, no document names, no user data
#   2. evidence encrypted at rest for the whole retention window
#   3. nothing sent to a vendor without a confirmed BAA
#
# Three decisions in that, and each one is the conservative answer:
#
#   - 'is healthcare' is the CLIENT ACCOUNT'S VERTICAL in the Hub profile. It applies to every
#     device that account owns.
#   - a per-device override can only make it MORE restrictive. A device cannot talk its way out of a
#     restricted client.
#   - if the vertical is unknown, or the Hub is unreachable, the answer is restricted. Fail closed.

Set-StrictMode -Version 3.0

$script:Phi = @{
    verticalCache = @{}     # accountId -> @{ vertical; fetchedAt }
    deviceOverride = @{}    # deviceKey -> $true (a device may only ADD restriction)
    decision = $null        # the settled decision for this session, set by Set-DEPhiDecision
}

function Set-DEPhiDecision {
    <# Records the settled decision for this session so the vendor gates do not each need the client
       profile plumbed through them. Called once, when the device decides. #>
    param([Parameter(Mandatory = $true)]$State)
    $script:Phi.decision = $State
}

function Get-DEPhiDecision {
    <# The settled decision, or $null when nobody has decided yet. A gate reading $null must treat
       the device as restricted - nobody has said it is not. #>
    return $script:Phi.decision
}

function Get-DEPhiRestricted {
    <# Shorthand for the gates: is this session restricted? Unknown (no decision recorded) is
       restricted, because the gate must not open on a device nobody has cleared. #>
    $d = $script:Phi.decision
    if ($null -eq $d) { return $true }
    return [bool]$d.restricted
}

function Get-DEVendorFromUri {
    <# Which vendor a URL belongs to, for the BAA gate. Unknown hosts return 'unknown', which the
       gate blocks on a restricted device. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Uri)
    $u = "$Uri".ToLowerInvariant()
    if ($u -match '(^|//|\.)dell\.com') { return 'Dell' }
    if ($u -match '(^|//|\.)lenovo\.com') { return 'Lenovo' }
    if ($u -match '(^|//|\.)hp\.com' -or $u -match '(^|//|\.)hpe\.com') { return 'HP' }
    return 'unknown'
}

function Get-DEPhiCacheToleranceHours { return 24 }

function Get-DEClientVertical {
    <#
        The client account's vertical from the Hub, for example 'healthcare'. The ONE place the tool
        asks, so tests can replace it and no caller reaches for the network on its own.

        Returns the vertical string, or $null when it cannot be determined - which every caller must
        treat as the restricted case. A cached value is used for Get-DEPhiCacheToleranceHours;
        beyond that the Hub is asked again, and a failure keeps the stale answer only if there is
        one to keep.

        Never throws: an unreachable Hub is 'unknown', not a crash.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$ClientProfile, [int]$TimeoutSec = 5)
    $accountId = Get-DEHashPath -Object $ClientProfile -Path 'hub.accountId'
    $key = "$accountId"
    if (-not "$accountId".Trim()) { return $null }   # no account means no vertical: unknown

    $hit = $script:Phi.verticalCache[$key]
    if ($hit -and $hit.fetchedAt -and ((Get-Date) - $hit.fetchedAt).TotalHours -lt (Get-DEPhiCacheToleranceHours)) {
        return "$($hit.vertical)"
    }

    $hub = Get-DEHubConnectionChecklist
    $endpoint = "$($hub.endpoint)".Trim()
    if (-not $endpoint -or $endpoint -notmatch '^https://') { return $(if ($hit) { "$($hit.vertical)" } else { $null }) }

    # The single Hub read for a vertical. Kept here, and here only, so a test replaces this function
    # rather than stubbing an HTTP stack.
    try {
        $r = Invoke-WebRequest -Uri ("$endpoint/api/techtool/account/{0}/profile" -f [uri]::EscapeDataString("$accountId")) -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        $body = $r.Content | ConvertFrom-Json
        $vertical = "$($body.vertical)".Trim()
        $script:Phi.verticalCache[$key] = @{ vertical = $vertical; fetchedAt = (Get-Date) }
        return $vertical
    } catch {
        # unreachable, refused or malformed: keep a stale answer if there is one, else unknown
        if ($hit) { return "$($hit.vertical)" }
        return $null
    }
}

function Set-DEPhiDeviceOverride {
    <#
        A per-device override. It can only make a device MORE restricted, never less: passing
        -Restricted:$false is refused rather than silently unrestricting a healthcare client's device.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$DeviceKey, [switch]$Restricted)
    if (-not $Restricted) {
        Write-DELog -Level WARN -Message "a per-device override cannot remove PHI restriction; '$DeviceKey' left as the client's setting"
        return
    }
    $script:Phi.deviceOverride[$DeviceKey] = $true
}

function Get-DEPhiState {
    <#
        Is this device PHI-restricted, and why? The answer is a decision record, not a boolean, so
        the reason reaches the evidence bundle and someone can check the call.

            restricted = true   the client's vertical is healthcare, or the device override added it,
                                or the vertical could not be determined at all
            restricted = false  only when the vertical is known AND is not healthcare AND no override
                                asked for more

        The third clause is the fail-closed one: unknown vertical and unreachable Hub both land on
        restricted, because the cost of being wrong in the permissive direction is a PHI leak.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$ClientProfile, [string]$DeviceKey = '')
    $vertical = Get-DEClientVertical -ClientProfile $ClientProfile
    $known = "$vertical".Trim()
    $clientRestricted = $true
    $why = ''
    if (-not $known) {
        $why = "the client's vertical could not be determined (unknown, or the Hub is unreachable); treating the device as PHI-restricted"
    } elseif ($known -ieq 'healthcare') {
        $clientRestricted = $true
        $why = "the client account's vertical is healthcare"
    } else {
        $clientRestricted = $false
        $why = "the client account's vertical is '$known', not healthcare"
    }

    $override = $false
    if ($DeviceKey -and $script:Phi.deviceOverride.ContainsKey($DeviceKey)) {
        $override = [bool]$script:Phi.deviceOverride[$DeviceKey]
    }
    if ($override -and -not $clientRestricted) { $why = "$why; a per-device override made it restricted" }

    return [pscustomobject]@{
        restricted = [bool]($clientRestricted -or $override)
        vertical   = $(if ($known) { $known } else { 'unknown' })
        client     = [bool]$clientRestricted
        override   = [bool]$override
        reason     = $why
    }
}

function Get-DEVendorBaaStatus {
    <# One vendor's BAA status from console/catalog/vendor-baa.json. Returns 'confirmed' | 'unconfirmed'
       | 'unknown'. A vendor nobody has written down is 'unknown', which is not 'confirmed'. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Vendor)
    $f = Join-Path (Get-DEConsole).Root 'catalog\vendor-baa.json'
    $map = $null
    try { if (Test-Path -LiteralPath $f) { $map = Get-Content -LiteralPath $f -Raw -Encoding UTF8 | ConvertFrom-Json } } catch { $map = $null }
    if (-not $map) { return 'unknown' }
    $name = "$Vendor".Trim()
    foreach ($p in $map.PSObject.Properties) {
        if ($p.Name -ieq $name) {
            $s = "$($p.Value)".Trim().ToLowerInvariant()
            if ($s -eq 'confirmed') { return 'confirmed' }
            if ($s -eq 'unconfirmed') { return 'unconfirmed' }
            return 'unknown'
        }
    }
    return 'unknown'
}

function Test-DEVendorBaaAllowed {
    <#
        Gate 3: nothing goes to a vendor whose BAA is not confirmed. Returns @{ allowed; status;
        reason }.

        The blank cell in the register is load-bearing here - under the PHI rule a blank is a BLOCK,
        not merely unknown. BAA confirmations are Joe's to record in the register; this function only
        enforces what the register says.
    #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Vendor, [switch]$PhiRestricted)
    $status = Get-DEVendorBaaStatus -Vendor $Vendor
    if (-not $PhiRestricted) {
        return [pscustomobject]@{ allowed = $true; status = $status; reason = 'not a PHI-restricted device; the register is recorded, not enforced' }
    }
    if ($status -eq 'confirmed') {
        return [pscustomobject]@{ allowed = $true; status = $status; reason = 'BAA confirmed in console/catalog/vendor-baa.json' }
    }
    return [pscustomobject]@{
        allowed = $false
        status  = $status
        reason  = "PHI-restricted device: the BAA for '$Vendor' is $status, and an unconfirmed vendor is blocked rather than warned"
    }
}

Export-ModuleMember -Function Get-DEClientVertical, Set-DEPhiDeviceOverride, Get-DEPhiState, Set-DEPhiDecision, Get-DEPhiDecision, Get-DEPhiRestricted, Get-DEVendorFromUri, Get-DEVendorBaaStatus, Test-DEVendorBaaAllowed
