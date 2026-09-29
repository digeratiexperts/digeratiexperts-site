#Requires -Version 5.1
<#
.SYNOPSIS
    Warranty lookups by manufacturer: when does this device's warranty end, where did the answer come from.

.DESCRIPTION
    Automatic sources talk only to the manufacturer (catalog\warranty.json): Dell TechDirect (API key, runtime secret),
    Lenovo's public support site, and HP's warranty API once its endpoints and key are configured. Every other maker
    gets the manufacturer's check page and a technician-recorded end date (with who recorded it). Results are cached in
    state for catalog cacheDays; API keys never leave memory. Written for DE; endpoints are public facts, no code was
    copied from other projects.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Windows PowerShell 5.1 downloads run many times slower with the progress bar

function Get-DEWarrantyCatalog { return (Get-Content -LiteralPath (Join-Path (Get-DEConsole).Root 'catalog\warranty.json') -Raw -Encoding UTF8 | ConvertFrom-Json) }
function Get-DEWarrantyVendor {
    <# The catalog entry for a manufacturer, or $null when the maker is not listed. #>
    param([string]$Manufacturer)
    foreach ($v in @((Get-DEWarrantyCatalog).vendors)) { if ("$Manufacturer" -match $v.match) { return $v } }
    return $null
}
function Invoke-DEWarrantyWeb {
    <# One place for web calls, so tests replace it and every call has a timeout. #>
    param([Parameter(Mandatory = $true)][string]$Uri, [ValidateSet('GET', 'POST')][string]$Method = 'GET', $Body, [hashtable]$Headers = @{}, [switch]$Raw)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $h = @{ 'User-Agent' = 'DE-TechTool (Digerati Experts; warranty lookup)' }; foreach ($k in $Headers.Keys) { $h[$k] = $Headers[$k] }
    if ($Raw) { return (Invoke-WebRequest -Uri $Uri -Method $Method -Headers $h -Body $Body -UseBasicParsing -TimeoutSec 30).Content }
    return (Invoke-RestMethod -Uri $Uri -Method $Method -Headers $h -Body $Body -TimeoutSec 30 -UseBasicParsing)
}
function ConvertTo-DEWarrantyDate { param($Value) if (-not $Value) { return $null }; try { return ([datetime]::Parse("$Value", [Globalization.CultureInfo]::InvariantCulture)).Date } catch { return $null } }
function New-DEWarrantyResult {
    <# One shape for every source: status active/expired/unknown/manual/not-applicable, the end date and days left. #>
    param([string]$Serial, [string]$Manufacturer, [string]$Vendor, [string]$Source, [array]$Entitlements = @(), [string]$CheckUrl, [string]$Detail, [string]$Status)
    $ends = @($Entitlements | Where-Object { $_ -and $_.end } | ForEach-Object { $_.end })
    $starts = @($Entitlements | Where-Object { $_ -and $_.start } | ForEach-Object { $_.start })
    $end = $(if ($ends.Count) { ($ends | Sort-Object -Descending)[0] } else { $null })
    $start = $(if ($starts.Count) { ($starts | Sort-Object)[0] } else { $null })
    $days = $(if ($end) { [int]($end - (Get-Date).Date).TotalDays } else { $null })
    if (-not $Status) { $Status = $(if ($null -eq $days) { 'unknown' } elseif ($days -ge 0) { 'active' } else { 'expired' }) }
    return [pscustomobject]@{
        serial = $Serial; manufacturer = $Manufacturer; vendor = $Vendor; source = $Source; status = $Status
        start = $(if ($start) { $start.ToString('yyyy-MM-dd') } else { $null }); end = $(if ($end) { $end.ToString('yyyy-MM-dd') } else { $null }); daysLeft = $days
        entitlements = @($Entitlements | ForEach-Object { [pscustomobject]@{ name = $_.name; start = $(if ($_.start) { $_.start.ToString('yyyy-MM-dd') }); end = $(if ($_.end) { $_.end.ToString('yyyy-MM-dd') }) } })
        checkUrl = $CheckUrl; detail = $Detail; fetchedAt = (Get-Date).ToString('o')
    }
}
function ConvertFrom-DELenovoWarrantyPage {
    <# Lenovo's warranty page carries its data as 'var ds_warranties = window.ds_warranties || {...};'. Returns @{ name; start; end } items. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Html)
    $m = [regex]::Match($Html, 'var\s+ds_warranties\s*=\s*window\.ds_warranties\s*\|\|\s*(\{.*?\})\s*;\s*(?:\r?\n|$)', 'Singleline')
    if (-not $m.Success) { return @() }
    $data = $m.Groups[1].Value | ConvertFrom-Json
    $out = @()
    foreach ($group in @('BaseWarranties', 'UpmaWarranties', 'ContractWarranties', 'AodWarranties', 'InstantWarranties', 'SaeWarranties')) {
        $p = $data.PSObject.Properties[$group]; if (-not $p -or -not $p.Value) { continue }
        foreach ($w in @($p.Value)) {
            $name = @('Name', 'Description', 'SLA', 'WarrantyType', 'WarrentyType', 'ChargeCode') | ForEach-Object { $q = $w.PSObject.Properties[$_]; if ($q -and $q.Value) { "$($q.Value)" } } | Select-Object -First 1
            $out += @{ name = "$(if ($name) { $name } else { $group })"; start = (ConvertTo-DEWarrantyDate $w.Start); end = (ConvertTo-DEWarrantyDate $w.End) }
        }
    }
    return $out
}
function ConvertFrom-DEDellEntitlements {
    <# Dell asset-entitlements response -> @{ name; start; end } items (plus the ship date as a fallback start). #>
    param($Response)
    $rec = @($Response) | Select-Object -First 1
    if (-not $rec) { return @() }
    $out = @()
    foreach ($e in @($rec.entitlements | Where-Object { $_ })) { $out += @{ name = "$($e.serviceLevelDescription)"; start = (ConvertTo-DEWarrantyDate $e.startDate); end = (ConvertTo-DEWarrantyDate $e.endDate) } }
    if (-not $out.Count -and $rec.shipDate) { $out += @{ name = 'shipped'; start = (ConvertTo-DEWarrantyDate $rec.shipDate); end = $null } }
    return $out
}
function Get-DEWarranty {
    <#
    Warranty for a serial number. Uses the cache unless -Refresh; returns the manual result (check page and any recorded
    end date) when the maker has no automatic source or its key is missing. Never throws for a lookup failure: the result
    says why in 'detail'.
    #>
    param([string]$Serial, [string]$Manufacturer, [string]$Model, [switch]$Refresh)
    if (-not $Serial -or -not $Manufacturer) { $inv = Get-DEDeviceInventory; if (-not $Serial) { $Serial = "$($inv.serial)" }; if (-not $Manufacturer) { $Manufacturer = "$($inv.manufacturer)" }; if (-not $Model) { $Model = "$($inv.model)" } }
    $cat = Get-DEWarrantyCatalog
    $Serial = "$Serial".Trim()
    if ("$Model $Manufacturer" -match $cat.virtualModels) { return (New-DEWarrantyResult -Serial $Serial -Manufacturer $Manufacturer -Vendor 'virtual' -Source 'none' -Status 'not-applicable' -Detail 'virtual machine: no hardware warranty') }
    if (-not $Serial -or $Serial -match '^(0+|to be filled.*|default string|system serial number|none)$') { return (New-DEWarrantyResult -Serial $Serial -Manufacturer $Manufacturer -Vendor '' -Source 'none' -Status 'unknown' -Detail 'the firmware reports no usable serial number') }
    $cacheKey = "warranty.lookups.$($Serial -replace '[^A-Za-z0-9]', '')"
    if (-not $Refresh) {
        $c = Get-DEState -Path $cacheKey
        if ($c -and $c.fetchedAt -and ((Get-Date) - [datetime]$c.fetchedAt).TotalDays -lt [double]$cat.cacheDays) { $r = [pscustomobject]$c; $r | Add-Member -NotePropertyName cached -NotePropertyValue $true -Force; return $r }
    }
    $v = Get-DEWarrantyVendor -Manufacturer $Manufacturer
    $check = $(if ($v -and $v.checkUrl) { "$($v.checkUrl)".Replace('{serial}', [uri]::EscapeDataString($Serial)) } else { $null })
    $manual = {
        param($why)
        $rec = Get-DEState -Path "warranty.manual.$($Serial -replace '[^A-Za-z0-9]', '')"
        $ents = @(); if ($rec) { $ents += @{ name = "recorded by $($rec.by)$(if ($rec.note) { ": $($rec.note)" })"; start = (ConvertTo-DEWarrantyDate $rec.start); end = (ConvertTo-DEWarrantyDate $rec.end) } }
        $st = $(if ($rec) { $null } else { 'manual' })
        New-DEWarrantyResult -Serial $Serial -Manufacturer $Manufacturer -Vendor $(if ($v) { $v.key } else { 'unknown' }) -Source $(if ($rec) { 'technician' } else { 'manual' }) -Entitlements $ents -CheckUrl $check -Status $st -Detail $(if ($rec) { "recorded by $($rec.by) on $($rec.at)" } else { "$why Check $(if ($check) { $check } else { 'the manufacturer site' }) and record the end date." })
    }   # called with & in this function's scope, so it sees $Serial, $v and $check (a closure could not reach the private helpers)
    $result = $null
    try {
        switch ("$(if ($v) { $v.method } else { 'manual' })") {
            'lenovo-support-site' {
                $prod = Invoke-DEWarrantyWeb -Uri ($v.productsUrl.Replace('{serial}', [uri]::EscapeDataString($Serial)))
                $pid2 = "$(@($prod)[0].Id)"; if (-not $pid2) { $pid2 = "$(@($prod)[0].id)" }
                if (-not $pid2) { $result = & $manual 'Lenovo does not know this serial.'; break }
                $html = Invoke-DEWarrantyWeb -Uri ($v.warrantyUrl.Replace('{productId}', $pid2.ToLowerInvariant())) -Raw
                $ents = @(ConvertFrom-DELenovoWarrantyPage -Html $html)
                if (-not $ents.Count) { $result = & $manual 'Lenovo returned no warranty data (the page layout may have changed).'; break }
                $result = New-DEWarrantyResult -Serial $Serial -Manufacturer $Manufacturer -Vendor 'lenovo' -Source 'lenovo-support-site' -Entitlements $ents -CheckUrl $check -Detail "product $pid2"
            }
            'dell-techdirect' {
                if (-not ((Test-DESecret -Name 'DELL_API_KEY') -and (Test-DESecret -Name 'DELL_API_SECRET'))) { $result = & $manual 'No Dell TechDirect API key this session.'; break }
                $key = Get-DESecretPlain -Name 'DELL_API_KEY'; $sec = Get-DESecretPlain -Name 'DELL_API_SECRET'
                $tok = Invoke-DEWarrantyWeb -Uri $v.tokenUrl -Method POST -Body @{ grant_type = 'client_credentials'; client_id = $key; client_secret = $sec }
                $key = $null; $sec = $null
                if (-not $tok.access_token) { $result = & $manual 'Dell did not issue a token (check the TechDirect key).'; break }
                Register-DERedaction -Value "$($tok.access_token)"
                $resp = Invoke-DEWarrantyWeb -Uri ($v.entitlementsUrl.Replace('{serial}', [uri]::EscapeDataString($Serial))) -Headers @{ Authorization = "Bearer $($tok.access_token)"; Accept = 'application/json' }
                $ents = @(ConvertFrom-DEDellEntitlements -Response $resp)
                if (-not @($ents | Where-Object { $_.end }).Count) { $result = & $manual 'Dell returned no entitlements for this service tag.'; break }
                $result = New-DEWarrantyResult -Serial $Serial -Manufacturer $Manufacturer -Vendor 'dell' -Source 'dell-techdirect' -Entitlements $ents -CheckUrl $check -Detail "$(@($resp)[0].productLineDescription)"
            }
            default { $result = & $manual "$(if ($v) { "$($v.name) has no public warranty API." } else { "No warranty source for '$Manufacturer'." })" }
        }
    } catch { $result = & $manual "Lookup failed: $($_.Exception.Message)." }
    if ($result.source -notin @('manual')) { Set-DEStateValue -Path $cacheKey -Value (ConvertTo-DEHashtable ($result | ConvertTo-Json -Depth 5 | ConvertFrom-Json)) }
    return $result
}
function Set-DEWarrantyManual {
    <# The technician records the end date from the manufacturer's page (and where it came from). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Serial, [Parameter(Mandatory = $true)][datetime]$End, [datetime]$Start, [string]$Note, [string]$Technician)
    if ($PSCmdlet.ShouldProcess($Serial, "record warranty end $($End.ToString('yyyy-MM-dd'))")) {
        $by = $(if ($Technician) { $Technician } else { "$(Get-DEState -Path 'settings.technician')" })
        Set-DEStateValue -Path "warranty.manual.$($Serial -replace '[^A-Za-z0-9]', '')" -Value @{ end = $End.ToString('yyyy-MM-dd'); start = $(if ($Start) { $Start.ToString('yyyy-MM-dd') }); note = $Note; by = $by; at = (Get-Date).ToString('o') }
        Set-DEStateValue -Path "warranty.lookups.$($Serial -replace '[^A-Za-z0-9]', '')" -Value $null
    }
}
function Register-DEWarrantyActions {
    param($ClientProfile)
    Register-DEAction -Id 'maint.warranty' -Module 'maintenance' -Title 'Hardware warranty known and active' -Phase 3 `
        -Detect { $w = Get-DEWarranty; Set-DEStateValue -Path 'warranty.current' -Value @{ end = $w.end; status = $w.status; source = $w.source; checkUrl = $w.checkUrl }; @{ status = $w.status; end = $w.end; daysLeft = $w.daysLeft; source = $w.source; checkUrl = $w.checkUrl; detail = $w.detail } } `
        -Desired { @{ status = 'active' } } `
        -Compare { param($d, $w) $warn = [int](Get-DEWarrantyCatalog).warnDays
            switch ($d.status) {
                'not-applicable' { @() }
                'expired' { @("warranty ended $($d.end) ($(-$d.daysLeft) days ago)") }
                'active' { if ($d.daysLeft -lt $warn) { @("warranty ends $($d.end), in $($d.daysLeft) days") } else { @() } }
                default { @("warranty end not known: $($d.detail)") }
            } } `
        -ManualAction 'Open the check page from the detail, then record the end date (Scan & fix > this item). Expired or ending soon: quote a renewal or plan the replacement.'
}

Export-ModuleMember -Function Get-DEWarrantyCatalog, Get-DEWarrantyVendor, Invoke-DEWarrantyWeb, ConvertFrom-DELenovoWarrantyPage, ConvertFrom-DEDellEntitlements, Get-DEWarranty, Set-DEWarrantyManual, Register-DEWarrantyActions
