#Requires -Version 5.1
<#
.SYNOPSIS
    Vendor Admin Center: the DE vendor / admin launcher catalog with categories,
    primary / backup roles, tenant-specific URL resolution, managed-bookmark
    generation for the Browser Configurator and an HTML launcher page.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

function Get-DEVendorCatalog {
    $de = Get-DEConsole
    $path = Join-Path $de.Root 'catalog\vendors.json'
    if (-not (Test-Path -LiteralPath $path)) { throw "vendor catalog missing: $path" }
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}
function Get-DEProp { param($Object, [string]$Name) if ($null -eq $Object) { return $null }; if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] }; return $null }; $p = $Object.PSObject.Properties[$Name]; if ($p) { return $p.Value }; return $null }
function Get-DEVendorCategories { return @((Get-DEVendorCatalog).categories | Sort-Object order) }
function Get-DEVendors {
    param([string]$Category, [string]$Role, [string]$Search)
    $v = @((Get-DEVendorCatalog).vendors)
    if ($Category) { $v = @($v | Where-Object { $_ -and $_.category -eq $Category }) }
    if ($Role) { $v = @($v | Where-Object { $_ -and $_.role -eq $Role }) }
    if ($Search) { $v = @($v | Where-Object { "$(Get-DEProp $_ 'name') $(Get-DEProp $_ 'deService') $(Get-DEProp $_ 'notes')" -match [regex]::Escape($Search) }) }
    return $v
}
function Resolve-DEVendorUrl {
    <# Picks the URL of the requested kind and fills {placeholders} from the client profile's vendorTenants. Returns $null when a required tenant value is missing. #>
    param([Parameter(Mandatory = $true)]$Vendor, [ValidateSet('admin', 'partner', 'client', 'support', 'docs', 'status', 'tenant')][string]$Kind = 'admin', $ClientProfile)
    $url = $null
    $template = Get-DEProp $Vendor 'tenantUrlTemplate'
    $urls = Get-DEProp $Vendor 'urls'
    if ($Kind -eq 'tenant') { $url = $template } elseif ($urls) { $url = Get-DEProp $urls $Kind }
    if (-not $url -and $Kind -eq 'admin' -and $template) { $url = $template }
    if (-not $url) { return $null }
    # Resolve placeholders with a plain loop: a regex callback scriptblock runs in a child scope, so
    # appending to an outer array there silently loses the missing keys and would open a literal {placeholder}.
    $missing = New-Object System.Collections.Generic.List[string]
    $tenants = $null; if ($ClientProfile) { $tenants = Get-DEProp $ClientProfile 'vendorTenants' }
    $resolved = $url
    foreach ($m in [regex]::Matches($url, '\{(\w+)\}')) {
        $key = $m.Groups[1].Value; $val = $null
        if ($tenants) { $val = Get-DEProp $tenants $key }
        if (-not $val) { if (-not $missing.Contains($key)) { $missing.Add($key) }; continue }
        $resolved = $resolved.Replace($m.Value, "$val")
    }
    if ($missing.Count) { return [pscustomobject]@{ url = $null; missing = @($missing); template = $url } }
    if ($resolved -notmatch '^https://') { return [pscustomobject]@{ url = $null; missing = @(); template = $url; error = 'not https' } }
    return [pscustomobject]@{ url = $resolved; missing = @(); template = $url }
}
function Open-DEVendor {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Id, [ValidateSet('admin', 'partner', 'client', 'support', 'docs', 'status', 'tenant')][string]$Kind = 'admin', $ClientProfile)
    $v = Get-DEVendors | Where-Object { $_ -and $_.id -eq $Id } | Select-Object -First 1
    if (-not $v) { throw "vendor '$Id' not in catalog" }
    $r = Resolve-DEVendorUrl -Vendor $v -Kind $Kind -ClientProfile $ClientProfile
    if (-not $r -or -not $r.url) { $why = $(if ($r -and $r.missing) { "missing tenant value(s): $($r.missing -join ', ')" } else { "no $Kind URL" }); Add-DEEvidence -Step "vendor.open.$Id" -Module 'vendors' -Before 'launcher' -ActionTaken "open $Kind" -Result 'SKIPPED' -Verification $why -Remediation 'Fill the value under the client profile > vendorTenants.' | Out-Null; return $null }
    if ($PSCmdlet.ShouldProcess($r.url, 'Open in default browser')) { Start-Process $r.url | Out-Null; Add-DEEvidence -Step "vendor.open.$Id" -Module 'vendors' -Before 'launcher' -ActionTaken "opened $Kind" -Result 'INFO' -Verification $r.url | Out-Null }
    return $r.url
}
function Get-DEVendorRoles {
    <# Primary / backup pairs per DE service category, so the console can say "Guardz is primary, Blackpoint is backup" instead of listing favourites. #>
    $out = @()
    foreach ($c in Get-DEVendorCategories) {
        $vs = Get-DEVendors -Category $c.id
        $out += [pscustomobject]@{ category = $c.title; primary = @($vs | Where-Object { $_ -and $_.role -eq 'primary' } | ForEach-Object { $_.name }); backup = @($vs | Where-Object { $_ -and $_.role -eq 'backup' } | ForEach-Object { $_.name }); alternate = @($vs | Where-Object { $_ -and $_.role -eq 'alternate' } | ForEach-Object { $_.name }) }
    }
    return $out
}
function New-DEManagedBookmarks {
    <# Chrome/Edge ManagedBookmarks JSON: one folder per category (admin URLs only, resolved for the client), plus profile extras. Reference-role entries are left out to keep the bar sane. #>
    param($ClientProfile, [string]$ToplevelName = 'DE', [switch]$IncludeReference)
    $folders = @()
    foreach ($c in Get-DEVendorCategories) {
        $items = @()
        foreach ($v in Get-DEVendors -Category $c.id) {
            if (-not $IncludeReference -and $v.role -eq 'reference') { continue }
            $r = Resolve-DEVendorUrl -Vendor $v -Kind 'admin' -ClientProfile $ClientProfile
            if ($r -and $r.url) { $items += @{ name = $v.name; url = $r.url } }
        }
        if ($items.Count) { $folders += @{ name = $c.title; children = $items } }
    }
    $browser = Get-DEProp $ClientProfile 'browser'
    $extra = Get-DEProp $browser 'extraBookmarks'
    if ($extra) { foreach ($b in @($extra)) { if (Get-DEProp $b 'url') { $folders = @(@{ name = (Get-DEProp $b 'name'); url = (Get-DEProp $b 'url') }) + $folders } } }
    $list = @(@{ toplevel_name = $ToplevelName }) + $folders
    return ($list | ConvertTo-Json -Depth 6 -Compress)
}
function Export-DEVendorLauncherHtml {
    <# A single-file launcher page (DE tokens) the technician can pin; resolved for the client when given. #>
    param([Parameter(Mandatory = $true)][string]$Path, $ClientProfile)
    $esc = { param($s) [System.Net.WebUtility]::HtmlEncode("$s") }
    $sections = foreach ($c in Get-DEVendorCategories) {
        $rows = foreach ($v in Get-DEVendors -Category $c.id) {
            $links = foreach ($k in @('admin', 'partner', 'client', 'support', 'docs', 'status')) { $r = Resolve-DEVendorUrl -Vendor $v -Kind $k -ClientProfile $ClientProfile; if ($r -and $r.url) { "<a href=`"$(& $esc $r.url)`" target=`"_blank`" rel=`"noopener`">$k</a>" } }
            $tenant = ''; if (Get-DEProp $v 'tenantUrlTemplate') { $r = Resolve-DEVendorUrl -Vendor $v -Kind 'tenant' -ClientProfile $ClientProfile; $tenant = $(if ($r -and $r.url) { "<a href=`"$(& $esc $r.url)`" target=`"_blank`" rel=`"noopener`">tenant</a>" } else { "<span class=miss>tenant value needed</span>" }) }
            "<li><span class=`"role $($v.role)`">$($v.role)</span><strong>$(& $esc $v.name)</strong><span class=svc>$(& $esc $v.deService)</span><span class=links>$($links -join ' ') $tenant</span></li>"
        }
        "<section><h2>$(& $esc $c.title)</h2><ul>$($rows -join '')</ul></section>"
    }
    $html = @"
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>DE Vendor Admin Center</title>
<style>:root{--well:#050312;--raised:#151217;--paper:#f7f5f2;--mag:#D3126A;--lav:#A78BFA;--muted:rgba(247,245,242,.6)}body{margin:0;background:var(--well);color:var(--paper);font:14px/1.5 "Space Grotesk","Segoe UI",sans-serif}header{padding:24px 32px;border-bottom:3px solid var(--mag)}header h1{margin:0;font-size:24px}header p{margin:4px 0 0;color:var(--muted)}main{padding:16px 32px;display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:14px}section{background:var(--raised);border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px 16px}h2{margin:0 0 8px;font-size:14px;color:var(--lav);text-transform:uppercase;letter-spacing:.06em}ul{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:70px 1fr;gap:4px 10px;padding:6px 0;border-top:1px solid rgba(255,255,255,.06)}.role{font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:2px 6px;border-radius:6px;align-self:start;text-align:center}.role.primary{background:var(--mag);color:#fff}.role.backup{background:#F5B942;color:#111}.role.alternate{background:rgba(167,139,250,.25);color:var(--lav)}.role.reference{background:rgba(255,255,255,.08);color:var(--muted)}.svc{grid-column:2;color:var(--muted);font-size:12px}.links{grid-column:2;font-size:12px}.links a{color:var(--paper);margin-right:10px;text-decoration:none;border-bottom:1px solid var(--mag)}.miss{color:#F5B942}</style></head>
<body><header><h1>DE Vendor Admin Center</h1><p>Primary and backup providers per category. Tenant links resolve from the client profile$(if ($ClientProfile) { ": $(& $esc $ClientProfile.name)" }).</p></header><main>$($sections -join '')</main></body></html>
"@
    Set-Content -LiteralPath $Path -Value $html -Encoding UTF8
    return $Path
}

Export-ModuleMember -Function Get-DEProp, Get-DEVendorCatalog, Get-DEVendorCategories, Get-DEVendors, Resolve-DEVendorUrl, Open-DEVendor, Get-DEVendorRoles, New-DEManagedBookmarks, Export-DEVendorLauncherHtml
