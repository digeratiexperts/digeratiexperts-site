# DE.AgentCatalog: the second key of the two-key check (move 67).
#
# A job may run an action only when BOTH keys accept it (AGENT-THREAT-MODEL.md section 7): the job kind's allowlist
# (move 59) and the signed local catalog (this module, T2, E1). The "signed local catalog" is the shipped tree as
# integrity.json pins it, and its identity is the SHA-256 of integrity.json. A job names the catalog it was built
# against (catalogSha256); the device refuses it unless
#   1. the device can vouch for its own catalog: integrity.json exists and the tree is 'signed' (an unsigned
#      development copy takes no jobs; -AllowUnsigned is an explicit, named rehearsal switch), and it has not been
#      tampered with (the existing Test-DEConsoleIntegrity verdict);
#   2. the hash in the job is the hash of THIS device's catalog;
#   3. every action id is, byte for byte, an id the device has registered. No wildcard, no case folding, no trimming:
#      an id that is not exactly a registered id is not in the catalog.
# Refusal codes are the agent's ack refusals: catalog_unavailable, catalog_tampered, catalog_mismatch,
# action_not_in_catalog, schema. This module has no network access and changes nothing.

$script:ActionIdPattern = '^[a-z0-9]+(\.[A-Za-z0-9-]+)+$'

function Get-DECatalogSha256 {
    <# The catalog's identity: SHA-256 (lowercase hex) of integrity.json's bytes. Throws when there is no integrity.json: a copy that cannot name its catalog cannot be matched to a job. #>
    param([Parameter(Mandatory = $true)][string]$IntegrityPath)
    if (-not (Test-Path -LiteralPath $IntegrityPath)) { throw "no integrity.json at ${IntegrityPath}: this copy cannot name its catalog" }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $bytes = [IO.File]::ReadAllBytes($IntegrityPath); return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '') }
    finally { $sha.Dispose() }
}

function Get-DESafeId {
    # An id for a refusal message: control characters and anything long are neutralised, so a hostile id cannot forge a log line.
    param([AllowNull()][string]$Id)
    $s = "$Id" -replace '[\x00-\x1f\x7f]', '?'
    if ($s.Length -gt 64) { $s = $s.Substring(0, 64) + '...' }
    return $s
}

function Test-DEJobCatalog {
    <#
        The pure decision, with every input explicit so it can be tested without a console. -IntegrityStatus is the verdict of
        Test-DEConsoleIntegrity (signed, unsigned, tampered, unknown). Returns Ok, Code, Why and Rejected (the action ids that
        are not in the catalog, neutralised for logging, at most 20).
    #>
    param(
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][AllowNull()][string[]]$ActionIds,
        [Parameter(Mandatory = $true)][AllowEmptyString()][AllowNull()][string]$JobCatalogSha256,
        [Parameter(Mandatory = $true)][AllowEmptyString()][AllowNull()][string]$LocalCatalogSha256,
        [Parameter(Mandatory = $true)][AllowEmptyString()][AllowNull()][string]$IntegrityStatus,
        [Parameter(Mandatory = $true)][AllowEmptyCollection()][string[]]$RegisteredActionIds,
        [switch]$AllowUnsigned
    )
    $result = { param($ok, $code, $why, $rejected) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why; Rejected = @($rejected) } }
    if ("$IntegrityStatus" -eq 'tampered') { return (& $result $false 'catalog_tampered' 'this copy reports itself tampered, so its catalog cannot be trusted' @()) }
    $statusOk = ("$IntegrityStatus" -eq 'signed') -or ($AllowUnsigned -and "$IntegrityStatus" -eq 'unsigned')
    if (-not $statusOk) { return (& $result $false 'catalog_unavailable' "this copy is '$IntegrityStatus', not a signed build, so it takes no jobs" @()) }
    if ("$LocalCatalogSha256" -cnotmatch '^[a-f0-9]{64}$') { return (& $result $false 'catalog_unavailable' 'this copy cannot name its own catalog' @()) }
    if ("$JobCatalogSha256" -cne "$LocalCatalogSha256") { return (& $result $false 'catalog_mismatch' 'the job was built against a different catalog than this device holds' @()) }
    $ids = @($ActionIds | Where-Object { $null -ne $_ })
    if (-not $ids.Count) { return (& $result $false 'schema' 'a job with no actions is refused' @()) }
    $registered = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::Ordinal)
    foreach ($r in $RegisteredActionIds) { [void]$registered.Add($r) }
    $rejected = New-Object System.Collections.Generic.List[string]
    foreach ($id in $ids) {
        if ($id -cnotmatch $script:ActionIdPattern -or -not $registered.Contains($id)) { $rejected.Add((Get-DESafeId $id)) }
    }
    if ($rejected.Count) { return (& $result $false 'action_not_in_catalog' "$($rejected.Count) action id(s) are not in this device's signed catalog" @($rejected | Select-Object -First 20)) }
    return (& $result $true '' 'every action id is in the signed local catalog' @())
}

function Confirm-DEJobCatalog {
    <#
        The live check, for the service: gathers this device's integrity verdict, catalog hash and registered action ids from
        the console it runs beside, then decides with Test-DEJobCatalog. Never throws: anything it cannot establish is
        catalog_unavailable. Needs the console modules loaded and the workflow initialised for the job's client profile.
    #>
    param(
        [Parameter(Mandatory = $true)][AllowNull()][string[]]$ActionIds, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$JobCatalogSha256,
        [switch]$AllowUnsigned
    )
    $unavailable = { param($why) [pscustomobject]@{ Ok = $false; Code = 'catalog_unavailable'; Why = $why; Rejected = @() } }
    try {
        $integrity = Test-DEConsoleIntegrity
        $local = ''
        $manifest = Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'integrity.json'
        if (Test-Path -LiteralPath $manifest) { $local = Get-DECatalogSha256 -IntegrityPath $manifest }
        $registered = @(Get-DEActions | ForEach-Object { $_.Id })
        if (-not $registered.Count) { return (& $unavailable 'no actions are registered: the workflow is not initialised') }
        return (Test-DEJobCatalog -ActionIds $ActionIds -JobCatalogSha256 $JobCatalogSha256 -LocalCatalogSha256 $local -IntegrityStatus "$($integrity.status)" -RegisteredActionIds $registered -AllowUnsigned:$AllowUnsigned)
    } catch { return (& $unavailable "could not establish this device's catalog: $($_.Exception.Message)") }
}

Export-ModuleMember -Function Get-DECatalogSha256, Test-DEJobCatalog, Confirm-DEJobCatalog
