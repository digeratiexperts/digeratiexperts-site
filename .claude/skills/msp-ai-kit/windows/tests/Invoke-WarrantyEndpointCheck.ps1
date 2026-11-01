<#
.SYNOPSIS
    Monitor the vendor warranty endpoints for changes (move 88, issue 806).

.DESCRIPTION
    The warranty lookup depends on pages and APIs DE does not own. When a vendor moves a page or
    changes a response shape, the lookup silently degrades to "manual" and nobody notices. This
    check probes every endpoint in catalog/warranty.json and compares what it finds with the pinned
    snapshot in catalog/warranty-endpoints.snapshot.json.

    What counts as a change worth failing on:
      - the endpoint stops answering, or answers 5xx;
      - it starts redirecting to another host (a moved or parked page);
      - the content type class changes (html <-> json <-> text);
      - a marker string the parsers rely on disappears from a 2xx body.
    An exact status change (200 -> 403 bot wall, say) is reported as a note, not a failure: those
    flip with vendor bot heuristics and would cry wolf.

    Cache policy (the other half of move 88) lives with the data it governs: catalog/warranty.json
    `cacheDays` (7). Get-DEWarranty serves a cached lookup inside that window unless -Refresh, and
    never caches a fallback to the maker's check page.

    No secrets are used or sent: probes are unauthenticated GETs of public endpoints. An API that
    needs a key (Dell TechDirect) still answers its shape when probed without one (401/403), which
    is enough to notice the endpoint moving.

.PARAMETER SnapshotPath
    The pinned baseline. Defaults to catalog/warranty-endpoints.snapshot.json beside warranty.json.

.PARAMETER Update
    Rewrite the snapshot from this run. Run it from a DE machine when the vendor legitimately changed
    an endpoint and the change has been reviewed.

.PARAMETER ReportOnly
    Print the report but never fail the run (for a scheduled sweep).

.PARAMETER ResponseDir
    Offline mode for tests: read <vendor>__<field>.json fixtures ({status, contentType, finalUri,
    body}) from this directory instead of fetching.

.EXAMPLE
    powershell -File windows/tests/Invoke-WarrantyEndpointCheck.ps1

.EXAMPLE
    powershell -File windows/tests/Invoke-WarrantyEndpointCheck.ps1 -Update
#>
[CmdletBinding()]
param(
    [string]$CatalogPath = '',
    [string]$SnapshotPath = '',
    [string]$ResponseDir = '',
    [switch]$Update,
    [switch]$ReportOnly,
    [int]$TimeoutSec = 20
)
$ErrorActionPreference = 'Stop'

$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })
$windows = Split-Path -Parent $here
if (-not $CatalogPath) { $CatalogPath = Join-Path (Join-Path (Join-Path $windows 'console') 'catalog') 'warranty.json' }
if (-not $SnapshotPath) { $SnapshotPath = Join-Path (Split-Path -Parent $CatalogPath) 'warranty-endpoints.snapshot.json' }

# One probe serial per template: a real serial shape so template substitution is exercised, never a
# client device. The response for it is meaningless; only the endpoint's behaviour is watched.
$ProbeSerial = 'PF3ABC12'

function Get-DEWarrantyProbes {
    <# Every endpoint worth watching for one vendor: the check page always, plus the public data
       URLs. The OAuth token endpoint is not probed: it is an auth call, and its shape changes
       nothing the parsers read. #>
    param($Vendor)
    $probes = @()
    foreach ($field in @('checkUrl', 'productsUrl', 'warrantyUrl', 'entitlementsUrl')) {
        $u = "$($Vendor.$field)"
        if (-not $u) { continue }
        if ($field -eq 'warrantyUrl') { continue }   # needs a productId from productsUrl first
        $u = $u -replace '\{serial\}', $ProbeSerial
        $probes += [pscustomobject]@{ key = "$($Vendor.key).$field"; url = $u }
    }
    return $probes
}

function Get-DEWarrantyMarkers {
    <# Marker strings the parsers depend on, checked only on 2xx bodies. #>
    param([string]$Key)
    switch -Regex ($Key) {
        'lenovo\.productsUrl$' { return @('"Id"', '"Serial"') }
        'dell\.entitlementsUrl$' { return @('entitlements') }
        default { return @() }
    }
}

function Invoke-DEWarrantyProbe {
    param([Parameter(Mandatory = $true)][string]$Url, [Parameter(Mandatory = $true)][string]$Key)
    if ($ResponseDir) {
        $fixture = Join-Path $ResponseDir (($Key -replace '\.', '_') + '.json')
        if (-not (Test-Path -LiteralPath $fixture)) { $fixture = Join-Path $ResponseDir ($Key + '.json') }
        if (-not (Test-Path -LiteralPath $fixture)) { return [pscustomobject]@{ ok = $false; key = $Key; url = $Url; error = 'no fixture' } }
        $f = Get-Content -LiteralPath $fixture -Raw -Encoding UTF8 | ConvertFrom-Json
        return [pscustomobject]@{ ok = $true; key = $Key; url = $Url; status = [int]$f.status; contentType = "$($f.contentType)"; finalUri = "$($f.finalUri)"; body = "$($f.body)" }
    }
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { $null = $null }
    try {
        $r = Invoke-WebRequest -Uri $Url -Method Get -UseBasicParsing -TimeoutSec $TimeoutSec -MaximumRedirection 5 -Headers @{ 'User-Agent' = 'DE-TechTool (Digerati Experts; warranty endpoint check)' }
        return [pscustomobject]@{ ok = $true; key = $Key; url = $Url; status = [int]$r.StatusCode; contentType = "$($r.Headers['Content-Type'])"; finalUri = "$($r.BaseResponse.ResponseUri)"; body = "$($r.Content)" }
    } catch {
        $status = 0; try { $status = [int]$_.Exception.Response.StatusCode } catch { $null = $null }
        return [pscustomobject]@{ ok = ($status -gt 0); key = $Key; url = $Url; status = $status; contentType = ''; finalUri = ''; body = ''; error = $_.Exception.Message }
    }
}

function Test-DEWarrantyEndpointState {
    <# One probe against its pinned state: returns @{ failures; notes } where failures is what the
       monitor fails on and notes is what it only reports. #>
    param($Probe, $Pinned)
    $failures = @(); $notes = @()
    if (-not $Probe.ok -and -not $Probe.status) {
        if ($Pinned -and $Pinned.status -and [int]$Pinned.status -gt 0) { return @{ failures = @("unreachable: $($Probe.error)"); notes = @() } }
        return @{ failures = @(); notes = @("still unreachable (was $(if ($Pinned) { $Pinned.status } else { 'not recorded' }))") }
    }
    if ($Probe.status -ge 500) { $failures += "answers $($Probe.status)" }
    elseif ($Probe.status -eq 404 -or $Probe.status -eq 410) { $failures += "the page is gone ($($Probe.status))" }
    elseif ($Pinned -and $Pinned.status -and ([int]$Probe.status -ne [int]$Pinned.status)) { $notes += "status $($Pinned.status) -> $($Probe.status)" }
    $hostNow = $(try { ([uri]$Probe.finalUri).Host } catch { '' })
    $hostPinned = $(if ($Pinned) { "$($Pinned.host)" } else { '' })
    if ($hostNow -and $hostPinned -and ($hostNow -ne $hostPinned)) { $failures += "redirected to another host ($hostPinned -> $hostNow)" }
    $classNow = ("$($Probe.contentType)" -split ';')[0].Trim().ToLowerInvariant() -replace '^application/(x-)?', ''
    $classPinned = $(if ($Pinned) { ("$($Pinned.contentType)" -split ';')[0].Trim().ToLowerInvariant() -replace '^application/(x-)?', '' } else { '' })
    if ($classNow -and $classPinned -and ($classNow -ne $classPinned)) { $failures += "content type changed ($classPinned -> $classNow)" }
    if ($Probe.status -ge 200 -and $Probe.status -lt 300) {
        foreach ($m in @(Get-DEWarrantyMarkers -Key $Probe.key)) {
            if ($Probe.body -notlike "*$m*") { $failures += "parser marker '$m' is gone" }
        }
    }
    return @{ failures = $failures; notes = $notes }
}

# ------------------------------------------------------------------ run
$catalog = Get-Content -LiteralPath $CatalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$pinned = $null
if ((-not $Update) -and (Test-Path -LiteralPath $SnapshotPath)) { $pinned = Get-Content -LiteralPath $SnapshotPath -Raw -Encoding UTF8 | ConvertFrom-Json }
$byKey = @{}
foreach ($e in @($pinned.endpoints)) { if ($e) { $byKey["$($e.key)"] = $e } }

$report = @(); $changed = 0
foreach ($v in @($catalog.vendors | Where-Object { $null -ne $_ })) {
    foreach ($probe in @(Get-DEWarrantyProbes -Vendor $v)) {
        $r = Invoke-DEWarrantyProbe -Url $probe.url -Key $probe.key
        $state = Test-DEWarrantyEndpointState -Probe $r -Pinned $byKey[$probe.key]
        if (@($state.failures).Count) { $changed++ }
        $report += [pscustomobject]@{ key = $probe.key; url = $probe.url; status = $r.status; contentType = $r.contentType; result = $(if (@($state.failures).Count) { 'CHANGED' } elseif (@($state.notes).Count) { 'note' } else { 'ok' }); detail = (@($state.failures) + @($state.notes) -join '; ') }
    }
}

foreach ($row in $report) { Write-Host ('{0,-7} {1,-28} {2,3}  {3}' -f $row.result, $row.key, $row.status, $row.detail) }

if ($Update) {
    $snapshot = [ordered]@{ version = 1; recorded = (Get-Date).ToString('o'); note = 'Pinned by Invoke-WarrantyEndpointCheck.ps1 -Update. Exact status is informational; the check fails on unreachable, 5xx, a host change, a content-type class change, or a parser marker disappearing.'; endpoints = @(foreach ($row in $report) { [ordered]@{ key = $row.key; url = $row.url; host = $(try { ([uri]$row.url).Host } catch { '' }); status = $row.status; contentType = $(if ($row.contentType) { $row.contentType } else { '' }) } }) }
    $snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $SnapshotPath -Encoding UTF8
    Write-Host ("snapshot written: {0} endpoint(s) -> {1}" -f $report.Count, $SnapshotPath)
    exit 0
}

if (-not $pinned) { Write-Host 'no snapshot pinned yet; run with -Update from a DE machine to record the baseline'; exit 0 }
if ($changed -and -not $ReportOnly) { Write-Host ("{0} warranty endpoint(s) changed shape or moved." -f $changed) -ForegroundColor Red; exit 1 }
Write-Host ("all {0} warranty endpoints match the pinned snapshot." -f $report.Count) -ForegroundColor Green
exit 0
