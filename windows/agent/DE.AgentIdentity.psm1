# DE.AgentIdentity: what the DE Tech Agent does when the Hub says its identity is no longer good (move 75).
#
# The Hub revokes a stolen device key in its own table (the device-certificate design): the very next request gets
# 403 device_revoked. This module is the device's half, and the half that makes revocation END something:
#   - every answer from the Hub is mapped to ONE decision, and an answer nobody planned for is 'backoff', never 'continue';
#   - 'revoked' is written to disk, atomically, and from then on the agent does not call the Hub at all: a revoked agent
#     that kept asking would be probing for a way back in (AGENT-THREAT-MODEL.md S3, E5);
#   - the agent's LOCAL functions are unaffected (D3): revocation ends its relationship with the Hub, not the technician's tool;
#   - revocation is cleared by exactly one thing: a fresh enrolment (a new device identity). Not by time, not by a Hub
#     answer, not by a retry (revoke and re-enrol, never patch in place).
# No network access: the transport is the service's, over mTLS (move 63).

$script:StateName = 'state.json'

function Get-DEAgentIdentityPath {
    param([Parameter(Mandatory = $true)][string]$IdentityDir)
    return (Join-Path $IdentityDir $script:StateName)
}

function Get-DEAgentIdentityState {
    <# 'ok', 'revoked', 'expired' or 'inactive', with when and why. A missing file is ok (never revoked). A file that cannot be read is treated as REVOKED: unknown must not mean allowed. #>
    param([Parameter(Mandatory = $true)][string]$IdentityDir)
    $p = Get-DEAgentIdentityPath -IdentityDir $IdentityDir
    if (-not (Test-Path -LiteralPath $p)) { return [pscustomobject]@{ State = 'ok'; Reason = ''; At = $null } }
    try {
        $j = Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json
        if (@('ok', 'revoked', 'expired', 'inactive') -cnotcontains "$($j.state)") { throw 'unknown state' }
        return [pscustomobject]@{ State = "$($j.state)"; Reason = "$($j.reason)"; At = "$($j.at)" }
    } catch { return [pscustomobject]@{ State = 'revoked'; Reason = 'identity_state_unreadable'; At = $null } }
}

function Set-DEAgentIdentityState {
    param([string]$IdentityDir, [string]$State, [string]$Reason, [datetime]$Now)
    if (-not (Test-Path -LiteralPath $IdentityDir)) { New-Item -ItemType Directory -Path $IdentityDir -Force | Out-Null }
    $p = Get-DEAgentIdentityPath -IdentityDir $IdentityDir
    $tmp = "$p.tmp"
    [IO.File]::WriteAllText($tmp, ([ordered]@{ state = $State; reason = $Reason; at = $Now.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [Globalization.CultureInfo]::InvariantCulture) } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding $false))
    if (Test-Path -LiteralPath $p) { [IO.File]::Replace($tmp, $p, [NullString]::Value) } else { [IO.File]::Move($tmp, $p) }
}

function Resolve-DEHubAnswer {
    <#
        One decision per Hub answer. Action is one of: continue, backoff, revoked, expired, inactive, paused. BackoffSeconds says when
        to try again (0 when the agent should not try). Anything not listed is backoff: never continue.
    #>
    param([Parameter(Mandatory = $true)][int]$HttpStatus, [string]$ErrorCode = '', [int]$RetryAfterSeconds = 0)
    $d = { param($action, $why, $secs) [pscustomobject]@{ Action = $action; Why = $why; BackoffSeconds = $secs } }
    if ($HttpStatus -ge 200 -and $HttpStatus -lt 300) { return (& $d 'continue' 'accepted' 0) }
    switch ("$HttpStatus $ErrorCode") {
        '403 device_revoked' { return (& $d 'revoked' 'the Hub revoked this device' 0) }
        '403 certificate_unknown' { return (& $d 'expired' 'the Hub does not know this certificate: enrol again' 0) }
        '403 certificate_expired' { return (& $d 'expired' 'the certificate ran out: enrol again' 0) }
        '403 device_not_active' { return (& $d 'inactive' 'the device is pending or denied' 300) }
        '423 paused' { return (& $d 'paused' 'the Hub has paused delivery' $(if ($RetryAfterSeconds -gt 0) { $RetryAfterSeconds } else { 300 })) }
        '429 rate_limited' { return (& $d 'backoff' 'rate limited' $(if ($RetryAfterSeconds -gt 0) { $RetryAfterSeconds } else { 60 })) }
        '401 stale_request' { return (& $d 'backoff' 'the clock or the nonce was refused' 60) }
        '401 no_client_certificate' { return (& $d 'backoff' 'no valid client certificate was presented' 300) }
        '503 identity_store_unavailable' { return (& $d 'backoff' 'the Hub could not read its identity table' 120) }
    }
    return (& $d 'backoff' "unplanned answer $HttpStatus $ErrorCode" 120)
}

function Invoke-DEHubCall {
    <#
        Calls the Hub through -Transport (a scriptblock returning HttpStatus, ErrorCode and RetryAfterSeconds, or throwing) unless the
        identity is already revoked, expired or inactive, in which case it does NOT call. Records revoked and expired on the way. Returns
        Called, Decision and Answer. Local functions are never gated by this: see Test-DELocalFunctionsAllowed.
    #>
    param([Parameter(Mandatory = $true)][string]$IdentityDir, [Parameter(Mandatory = $true)][scriptblock]$Transport, [Parameter(Mandatory = $true)][datetime]$Now)
    $st = Get-DEAgentIdentityState -IdentityDir $IdentityDir
    if ($st.State -ne 'ok') {
        $action = if ($st.State -eq 'inactive') { 'inactive' } else { $st.State }
        return [pscustomobject]@{ Called = $false; Decision = [pscustomobject]@{ Action = $action; Why = "the agent is $($st.State) ($($st.Reason)): it does not call the Hub"; BackoffSeconds = 0 }; Answer = $null }
    }
    $answer = $null
    try { $answer = & $Transport } catch { return [pscustomobject]@{ Called = $true; Decision = (Resolve-DEHubAnswer -HttpStatus 0 -ErrorCode 'network'); Answer = $null } }
    $decision = Resolve-DEHubAnswer -HttpStatus ([int]$answer.HttpStatus) -ErrorCode "$($answer.ErrorCode)" -RetryAfterSeconds ([int]$answer.RetryAfterSeconds)
    if ($decision.Action -eq 'revoked') { Set-DEAgentIdentityState -IdentityDir $IdentityDir -State 'revoked' -Reason "$($answer.ErrorCode)" -Now $Now }
    elseif ($decision.Action -eq 'expired') { Set-DEAgentIdentityState -IdentityDir $IdentityDir -State 'expired' -Reason "$($answer.ErrorCode)" -Now $Now }
    return [pscustomobject]@{ Called = $true; Decision = $decision; Answer = $answer }
}

function Test-DELocalFunctionsAllowed {
    <# Always true. Revocation ends the agent's relationship with the Hub; the technician's local tool is not the Hub's to switch off (D3, move 76). #>
    param([string]$IdentityDir)
    return $true
}

function Clear-DEAgentRevocation {
    <# Clears revoked or expired, and only for a fresh enrolment: -NewEnrolmentId must differ from the one that was revoked. Not time, not an answer from the Hub, not a retry. #>
    param([Parameter(Mandatory = $true)][string]$IdentityDir, [Parameter(Mandatory = $true)][string]$NewEnrolmentId, [Parameter(Mandatory = $true)][string]$PreviousEnrolmentId, [Parameter(Mandatory = $true)][datetime]$Now)
    if ($NewEnrolmentId -cnotmatch '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') { throw 'a fresh enrolment id is a UUID' }
    if ($NewEnrolmentId -ceq $PreviousEnrolmentId) { throw 'revocation is cleared only by a NEW enrolment, not by the one that was revoked' }
    Set-DEAgentIdentityState -IdentityDir $IdentityDir -State 'ok' -Reason "re-enrolled as $NewEnrolmentId" -Now $Now
}

Export-ModuleMember -Function Get-DEAgentIdentityState, Resolve-DEHubAnswer, Invoke-DEHubCall, Test-DELocalFunctionsAllowed, Clear-DEAgentRevocation
