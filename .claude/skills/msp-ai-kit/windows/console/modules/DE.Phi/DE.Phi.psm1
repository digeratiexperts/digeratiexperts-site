# ------------------------------------------------------------------ PHI-restricted mode
#
# Decided by Joe, 2026-11-01 (issue #890). When a client is healthcare - or a device may hold PHI -
# DE Tech Tool runs restricted:
#
#   1. system metadata only: discovery never looks inside a user's data folders
#   2. evidence encrypted at rest for the whole retention window (design: PHI-ENCRYPTION-AT-REST.md)
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
    factsCache     = @{}    # accountId -> @{ facts; fetchedAt }  (a good answer, kept for the tolerance window)
    failures       = @{}    # accountId -> last failed attempt, so an offline Hub is not asked on every call
    deviceOverride = @{}    # deviceKey -> $true (a device may only ADD restriction)
    decision       = $null  # the settled decision for this session, set by Set-DEPhiDecision
}

function Get-DEPhiCacheToleranceHours { return 24 }
function Get-DEPhiFailureBackoffMinutes { return 5 }

function Set-DEPhiDecision {
    <# Records the settled decision for this session so the vendor gates and discovery do not each need
       the client profile plumbed through them. Called once per profile, by Initialize-DEPhiDecision. #>
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
       restricted, because nothing may open on a device nobody has cleared. #>
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

function Get-DEClientPhiFacts {
    <#
        What the Hub says about this client account: @{ vertical; phiRestricted; basis }, or $null when
        that cannot be determined. The ONE place the tool asks, so tests replace it and no caller reaches
        for the network on its own.

        The Hub route is GET /api/techtool/account/:id/profile, signed like the event intake with the
        runtime secret DE_HUB_SIGNING_SECRET. No secret, no endpoint, no account id, a refusal, a timeout or
        an answer that is not shaped as expected all return $null - which every caller must treat as the
        restricted case.

        A good answer is used for Get-DEPhiCacheToleranceHours. A failure is remembered for
        Get-DEPhiFailureBackoffMinutes so an offline Hub costs one short wait, not one per call, and a
        stale good answer is kept in preference to none.

        Never throws: an unreachable Hub is 'unknown', not a crash.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$ClientProfile)
    $accountId = "$(Get-DEHashPath -Object $ClientProfile -Path 'hub.accountId')".Trim()
    if ($accountId -notmatch '^[1-9]\d*$') { return $null }   # no usable account means no vertical: unknown

    $hit = $script:Phi.factsCache[$accountId]
    if ($hit -and ((Get-Date) - $hit.fetchedAt).TotalHours -lt (Get-DEPhiCacheToleranceHours)) { return $hit.facts }
    $failedAt = $script:Phi.failures[$accountId]
    if ($failedAt -and ((Get-Date) - $failedAt).TotalMinutes -lt (Get-DEPhiFailureBackoffMinutes)) { return $(if ($hit) { $hit.facts } else { $null }) }

    $stale = $(if ($hit) { $hit.facts } else { $null })
    try {
        $endpoint = "$(Get-DEState -Path 'settings.hub.endpoint')".Trim()
        if (-not $endpoint -or -not (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET')) { return $stale }   # nothing to ask with; not a failure to back off from
        $base = ([uri]$endpoint).GetLeftPart([UriPartial]::Authority)
        $body = Get-DEHubSigned -BaseUrl $base -Path ('/api/techtool/account/{0}/profile' -f $accountId) -Secret (Get-DESecretSecure -Name 'DE_HUB_SIGNING_SECRET')
        $vertical = "$($body.vertical)".Trim()
        # the Hub must answer with a boolean; anything else is an answer we do not understand
        if (-not $vertical -or $body.phiRestricted -isnot [bool]) { throw 'the Hub answer is not shaped as expected' }
        $facts = [pscustomobject]@{ vertical = $vertical; phiRestricted = [bool]$body.phiRestricted; basis = "$($body.basis)" }
        $script:Phi.factsCache[$accountId] = @{ facts = $facts; fetchedAt = (Get-Date) }
        $script:Phi.failures.Remove($accountId)
        return $facts
    } catch {
        $script:Phi.failures[$accountId] = Get-Date
        return $stale
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

            restricted = false  only when the Hub answered, the vertical is known and is not healthcare,
                                the Hub says phiRestricted is false, AND no override asked for more
            restricted = true   in every other case: healthcare, the Hub saying so for any other reason
                                (a healthcare deal restricts whatever the vertical field says), an
                                override, or no usable answer at all

        The last clause is the fail-closed one: unknown vertical, unreachable Hub, no signing secret and
        a malformed answer all land on restricted, because the cost of being wrong in the permissive
        direction is a PHI leak.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$ClientProfile, [string]$DeviceKey = '')
    $facts = Get-DEClientPhiFacts -ClientProfile $ClientProfile
    $vertical = $(if ($facts) { "$($facts.vertical)".Trim() } else { '' })
    $clientRestricted = $true
    $why = ''
    if (-not $facts -or -not $vertical) {
        $why = "the client's vertical could not be determined (unknown, or the Hub is unreachable); treating the device as PHI-restricted"
    } elseif ($vertical -ieq 'healthcare') {
        $why = "the client account's vertical is healthcare"
    } elseif ($facts.phiRestricted -ne $false) {
        $why = "the Hub marks the account PHI-restricted ($($facts.basis)), whatever its vertical ('$vertical')"
    } else {
        $clientRestricted = $false
        $why = "the client account's vertical is '$vertical', not healthcare, and the Hub does not mark it PHI-restricted"
    }

    $override = $false
    if ($DeviceKey -and $script:Phi.deviceOverride.ContainsKey($DeviceKey)) { $override = [bool]$script:Phi.deviceOverride[$DeviceKey] }
    if ($override -and -not $clientRestricted) { $why = "$why; a per-device override made it restricted" }

    return [pscustomobject]@{
        restricted = [bool]($clientRestricted -or $override)
        vertical   = $(if ($vertical) { $vertical } else { 'unknown' })
        client     = [bool]$clientRestricted
        override   = [bool]$override
        reason     = $why
    }
}

function Initialize-DEPhiDecision {
    <#
        Settles the session's PHI decision for this client and records it, so discovery, the vendor gates
        and the evidence bundle all act on the same answer. Called at each production entry point once the
        client profile is known (the headless run, the window, and a background job's own runspace, which
        does not share this module's state).

        A caller with no profile yet does not call it, and the session stays undecided - which reads as
        restricted. So the first discovery of a window, run before the client is detected, is the
        conservative one.
    #>
    param([Parameter(Mandatory = $true)][AllowNull()]$ClientProfile, [string]$DeviceKey = '')
    $state = Get-DEPhiState -ClientProfile $ClientProfile -DeviceKey $DeviceKey
    Set-DEPhiDecision -State $state
    Write-DELog -Level $(if ($state.restricted) { 'WARN' } else { 'INFO' }) -Message "PHI mode: $(if ($state.restricted) { 'RESTRICTED' } else { 'not restricted' }) - $($state.reason)"
    try { Add-DEEvidence -Step 'phi.decision' -Module 'phi' -Before 'undecided' -ActionTaken "$(if ($state.restricted) { 'PHI-restricted' } else { 'not PHI-restricted' }): $($state.reason)" -Result 'INFO' -Verification "vertical $($state.vertical)" | Out-Null } catch { Write-DELog -Level DEBUG -Message "PHI decision not added to the evidence: $($_.Exception.Message)" }
    return $state
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

Export-ModuleMember -Function Get-DEClientPhiFacts, Set-DEPhiDeviceOverride, Get-DEPhiState, Set-DEPhiDecision, Get-DEPhiDecision, Get-DEPhiRestricted, Initialize-DEPhiDecision, Get-DEVendorFromUri, Get-DEVendorBaaStatus, Test-DEVendorBaaAllowed
