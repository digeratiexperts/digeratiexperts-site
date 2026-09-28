#Requires -Version 5.1
<#
.SYNOPSIS
    Client profiles (reusable, per client, no credentials) and provisioning
    context (technician, end user, device role, mode) for the DE Technician Console.

.DESCRIPTION
    A client profile describes what a finished endpoint looks like for that
    client: tier, security stack roles, browser policy profile, apps, branding,
    sites, vendor tenant identifiers, JumpCloud groups, cloud-storage standard,
    MDM authority and detection rules. Profiles are JSON under the console data
    folder (ProgramData\DE\TechConsole\profiles) and ship as templates under
    console\catalog\profiles. Saving a profile that contains a secret-looking
    value is refused.

    Machine-specific state (this device, this user, this run) lives in the
    core state store, never in the profile.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:ProfileSchemaVersion = 1
$script:Modes = @('new', 'takeover', 'replacement', 'repair', 'co-managed', 'audit', 'deprovision')
$script:Tiers = @('Office', 'Business', 'Enterprise')

function Get-DEProfileDirectories {
    $de = Get-DEConsole
    return @{ User = $de.Dirs.Profiles; Templates = (Join-Path $de.Root 'catalog\profiles') }
}

function New-DEClientProfileTemplate {
    <# Returns a complete, empty profile object with every supported key so the GUI can bind to it. #>
    param([string]$Id = 'new-client', [string]$Name = 'New client')
    return [ordered]@{
        schemaVersion = $script:ProfileSchemaVersion
        id = $Id; name = $Name; shortName = $Name
        tier = 'Business'                                  # Office | Business | Enterprise
        packages = @('Core IT', 'Security Operations')     # DE package lines included
        gcch = $false                                      # GCC High eligibility rules apply
        identity = @{ authority = 'jumpcloud'; jumpcloudDeviceTrust = $false; entraTenantName = ''; entraTenantId = ''; leaveEntra = $true; keepEntraRegistration = $false; jumpcloudSystemGroups = @(); jumpcloudUserGroups = @(); usernameConvention = 'first-initial-lastname' }
        mdm = @{ authority = 'jumpcloud'; allowCoManagement = $false; removeStaleEnrollments = $true }
        security = @{ mdr = @{ primary = 'guardz'; backup = 'blackpoint'; deploy = @('guardz') }; edr = 'sentinelone'; browserSecurity = @('pabx'); emailSecurity = 'mimecast'; siem = 'wazuh'; awareness = 'ninjio'; baselineProfile = 'de-windows-baseline' }
        cloudStorage = @{ standard = 'onedrive'; removeConflicting = $false; allowBoth = $false }   # onedrive | dropbox | both | none
        browser = @{ default = 'edge'; policyProfile = 'de-browser-policy'; homepage = 'https://portal.digeratiexperts.com/portal/login'; startupPages = @(); managedBookmarksFromVendors = $true; extraBookmarks = @() }
        apps = @{ required = @('m365-apps', 'teams', 'onedrive', 'edge', 'chrome', 'pdf-reader'); optional = @(); lineOfBusiness = @(); remove = @() }
        m365 = @{ tenantDomain = ''; licenseSku = ''; verifyUpn = $true }
        branding = @{ clientLogo = ''; wallpaperStyle = 'dual-logo'; accent = '#D3126A'; supportText = 'Support: support@digeratiexperts.com'; hostnamePattern = '{CLIENT}-{ROLE}-{SERIAL4}'; shortcuts = @('client-portal', 'support-ticket', 'remote-support') }
        network = @{ wifiProfiles = @(); printers = @(); shares = @(); certificates = @(); vpn = @(); sase = @{ provider = 'timus'; required = $false } }
        backup = @{ provider = 'msp360'; required = $true }
        remoteSupport = @{ provider = 'jumpcloud-remote-assist'; required = $true }
        rmm = @{ provider = 'msp360'; required = $false }
        sites = @()                                        # @{ id; name; address; wifi; gateway; notes }
        vendorTenants = @{ hudu_host = ''; wazuh_cloud_id = ''; qualys_platform_url = ''; s1_console = ''; pabx_console = ''; optix_portal = '' }
        detection = @{ hostnamePatterns = @(); entraTenantNames = @(); entraTenantIds = @(); jumpcloudSystemGroups = @(); profileFolderHints = @() }
        clientSafe = @{ serviceNames = @{ mdr = 'Managed detection and response'; edr = 'Endpoint protection'; backup = 'Managed backup'; emailSecurity = 'Email security' } }
        notes = ''
        updated = (Get-Date).ToString('o')
    }
}

function Test-DEProfileHasSecrets {
    param([Parameter(Mandatory = $true)]$Profile)
    $json = $Profile | ConvertTo-Json -Depth 12
    $hits = @()
    foreach ($m in [regex]::Matches($json, '"(?<k>[^"]+)"\s*:\s*"(?<v>[^"]{8,})"')) {
        if ($m.Groups['k'].Value -match '(?i)(password|passwd|secret|token|apikey|api_key|connectkey|connect_key|orgkey|org_key|sitetoken|site_token|recovery|credential)') { $hits += $m.Groups['k'].Value }
    }
    if ($json -match '\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b') { $hits += 'bitlocker-recovery-password' }
    return $hits
}

function Get-DEClientProfiles {
    <# Templates from the catalog plus saved profiles; saved ones win on id. #>
    $dirs = Get-DEProfileDirectories
    $map = [ordered]@{}
    foreach ($d in @($dirs.Templates, $dirs.User)) {
        if (-not (Test-Path -LiteralPath $d)) { continue }
        foreach ($f in @(Get-ChildItem -LiteralPath $d -Filter '*.json' -File | Where-Object { $_ -and $_.Name -notlike '_*' } | Sort-Object Name)) {
            try { $p = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 | ConvertFrom-Json; if ($p.id) { $map[$p.id] = [pscustomobject]@{ id = $p.id; name = $p.name; source = $(if ($d -eq $dirs.Templates) { 'template' } else { 'saved' }); path = $f.FullName; profile = $p } } } catch { Write-DELog -Level WARN -Message "profile $($f.Name) unreadable: $($_.Exception.Message)" }
        }
    }
    return @($map.Values)
}
function Get-DEClientProfile { param([Parameter(Mandatory = $true)][string]$Id) $p = Get-DEClientProfiles | Where-Object { $_ -and $_.id -eq $Id } | Select-Object -First 1; if (-not $p) { throw "client profile '$Id' not found" }; return $p.profile }

function Save-DEClientProfile {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Profile)
    if (-not $Profile.id -or "$($Profile.id)" -notmatch '^[a-z0-9][a-z0-9\-]*$') { throw 'profile.id must be a lowercase slug' }
    $secrets = Test-DEProfileHasSecrets -Profile $Profile
    if ($secrets.Count) { throw "refusing to save profile '$($Profile.id)': secret-looking keys present ($($secrets -join ', ')). Secrets are runtime-only." }
    $dirs = Get-DEProfileDirectories
    $path = Join-Path $dirs.User ("{0}.json" -f $Profile.id)
    if ($PSCmdlet.ShouldProcess($path, 'Save client profile')) {
        if ($Profile -is [System.Collections.IDictionary]) { $Profile['updated'] = (Get-Date).ToString('o') } else { $Profile | Add-Member -NotePropertyName updated -NotePropertyValue (Get-Date).ToString('o') -Force }
        New-Item -ItemType Directory -Path $dirs.User -Force | Out-Null
        $Profile | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $path -Encoding UTF8
        Add-DEEvidence -Step 'profile.save' -Module 'profiles' -Before 'profile' -ActionTaken "saved $($Profile.id)" -Result 'PASS' -Verification $path | Out-Null
    }
    return $path
}

function Resolve-DEClientContext {
    <#
    Matches a discovery snapshot against every profile's detection rules and returns the best
    candidate with the reasons, so the technician confirms the client rather than the tool assuming it.
    #>
    param([Parameter(Mandatory = $true)]$Snapshot)
    $candidates = @()
    $hostName = "$(Get-DEHashPath -Object $Snapshot -Path 'device.hostname')"
    $tenantName = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.dsreg.tenantName')"; $tenantId = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.dsreg.tenantId')"
    $profileNames = @(@(Get-DEHashPath -Object $Snapshot -Path 'identity.profiles') | Where-Object { $_ } | ForEach-Object { Split-Path -Leaf $_.path })
    foreach ($entry in Get-DEClientProfiles) {
        $p = $entry.profile; $score = 0; $why = @()
        $det = $p.detection
        if ($det) {
            foreach ($pat in @($det.hostnamePatterns)) { if ($pat -and $hostName -like $pat) { $score += 3; $why += "hostname matches $pat" } }
            foreach ($t in @($det.entraTenantIds)) { if ($t -and $tenantId -and $t -ieq $tenantId) { $score += 5; $why += 'Entra tenant id' } }
            foreach ($t in @($det.entraTenantNames)) { if ($t -and $tenantName -and $tenantName -like "*$t*") { $score += 4; $why += "Entra tenant name '$tenantName'" } }
            foreach ($h in @($det.profileFolderHints)) { if ($h -and ($profileNames | Where-Object { $_ -like "*$h*" })) { $score += 2; $why += "profile folder like $h" } }
        }
        if ($p.identity -and $p.identity.entraTenantName -and $tenantName -and $tenantName -like "*$($p.identity.entraTenantName)*") { $score += 4; $why += 'identity.entraTenantName' }
        if ($score -gt 0) { $candidates += [pscustomobject]@{ id = $p.id; name = $p.name; score = $score; reasons = $why } }
    }
    $best = $candidates | Sort-Object score -Descending | Select-Object -First 1
    return [pscustomobject]@{ best = $best; candidates = @($candidates | Sort-Object score -Descending); confidence = $(if (-not $best) { 'none' } elseif ($best.score -ge 5) { 'high' } elseif ($best.score -ge 3) { 'medium' } else { 'low' }) }
}

function Resolve-DEEndUser {
    <# Distinguishes the end user (owner of the main profile / interactive sign-in) from the technician running the console. #>
    param([Parameter(Mandatory = $true)]$Snapshot, [string]$Technician)
    $interactive = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.interactiveUser')"
    $current = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.currentPrincipal')"
    $tech = $Technician
    if (-not $tech) { $tech = $current }
    $allProfiles = @(@(Get-DEHashPath -Object $Snapshot -Path 'identity.profiles') | Where-Object { $_ })
    $profiles = @($allProfiles | Where-Object { $_ -and $_.path -notmatch '\\(Administrator|Default|Public|DE-BreakGlass|jrpetro)$' } | Sort-Object { $_.lastUse } -Descending)
    $mostUsed = $profiles | Select-Object -First 1
    $endUser = $null; $how = ''
    if ($interactive -and $interactive -ne $tech -and $interactive -notmatch '\\(jrpetro|DE-BreakGlass)$') { $endUser = $interactive; $how = 'interactive session' }
    elseif ($mostUsed) { $endUser = (Split-Path -Leaf $mostUsed.path); $how = 'most recently used profile' }
    $entraStyle = ($endUser -match '^AzureAD\\')
    return [pscustomobject]@{ technician = $tech; endUser = $endUser; endUserSource = $how; endUserIsEntraPrincipal = $entraStyle; endUserProfile = $(if ($endUser -and $allProfiles.Count) { @(Find-DEProfileForUser -UserName $endUser -Profiles $allProfiles) | Select-Object -First 1 } else { $null }) }
}

function New-DEProvisioningContext {
    <# Assembles the run context the workflow needs. Technician defaults to the DE default administrator, never the Windows session. #>
    param(
        [Parameter(Mandatory = $true)]$Snapshot,
        [string]$Technician = 'jrpetro',
        [string]$ClientId,
        [ValidateSet('new', 'takeover', 'replacement', 'repair', 'co-managed', 'audit', 'deprovision')][string]$Mode = 'audit',
        [string]$EndUser, [string]$EndUserEmail, [string]$JumpCloudUser, [string]$LocalUserName,
        [string]$Site = '', [string]$DeviceRole = 'laptop', [string]$AssetTag = '', [string]$OrderNumber = '', [string]$WarrantyEnd = '', [string]$DesiredHostname = ''
    )
    $client = $null
    if ($ClientId) { $client = Get-DEClientProfile -Id $ClientId } else { $r = Resolve-DEClientContext -Snapshot $Snapshot; if ($r.best) { $client = Get-DEClientProfile -Id $r.best.id } }
    $eu = Resolve-DEEndUser -Snapshot $Snapshot -Technician $Technician
    if (-not $EndUser) { $EndUser = $eu.endUser }
    if (-not $LocalUserName -and $EndUser) {
        $conv = $(if ($client -and $client.identity.usernameConvention) { $client.identity.usernameConvention } else { 'first-initial-lastname' })
        $LocalUserName = ConvertTo-DELocalUserName -DisplayOrPrincipal $EndUser -Convention $conv
    }
    if (-not $JumpCloudUser) { $JumpCloudUser = $LocalUserName }
    $ctx = @{
        technician = $Technician; mode = $Mode
        client = $(if ($client) { $client.id } else { $null }); clientName = $(if ($client) { $client.name } else { $null }); tier = $(if ($client) { $client.tier } else { $null }); site = $Site
        endUser = $EndUser; endUserEmail = $EndUserEmail; endUserSource = $eu.endUserSource; sourcePrincipal = $(if ($eu.endUserIsEntraPrincipal) { $eu.endUser } elseif ($EndUser -match '\\') { $EndUser } else { $null })
        localUserName = $LocalUserName; jumpcloudUser = $JumpCloudUser
        device = @{ hostname = (Get-DEHashPath -Object $Snapshot -Path 'device.hostname'); serial = (Get-DEHashPath -Object $Snapshot -Path 'device.serial'); model = (Get-DEHashPath -Object $Snapshot -Path 'device.model'); role = $DeviceRole; assetTag = $AssetTag; orderNumber = $OrderNumber; warrantyEnd = $WarrantyEnd; desiredHostname = $DesiredHostname }
        started = (Get-Date).ToString('o')
    }
    Set-DEContext -Values $ctx
    return $ctx
}

function ConvertTo-DELocalUserName {
    param([Parameter(Mandatory = $true)][string]$DisplayOrPrincipal, [string]$Convention = 'first-initial-lastname')
    $name = ($DisplayOrPrincipal -split '\\')[-1] -replace '@.*$', ''
    # split CamelCase or spaced names: SuzetteThompson -> Suzette Thompson
    $parts = @(($name -creplace '([a-z])([A-Z])', '$1 $2') -split '[\s._\-]+' | Where-Object { $_ })
    if ($parts.Count -lt 2) { return ($name.ToLowerInvariant() -replace '[^a-z0-9]', '') }
    $first = $parts[0].ToLowerInvariant(); $last = $parts[-1].ToLowerInvariant()
    switch ($Convention) {
        'first-initial-lastname' { return (($first.Substring(0, 1) + $last) -replace '[^a-z0-9]', '') }
        'firstname-lastname' { return (("$first.$last") -replace '[^a-z0-9.]', '') }
        'firstname' { return ($first -replace '[^a-z0-9]', '') }
        default { return (($first.Substring(0, 1) + $last) -replace '[^a-z0-9]', '') }
    }
}

function Get-DETierDefaults {
    <# DE package/tier awareness: what a tier includes by default and what is optional. Names only; no prices. #>
    param([Parameter(Mandatory = $true)][ValidateSet('Office', 'Business', 'Enterprise')][string]$Tier, [switch]$Gcch)
    $base = @{ identity = 'jumpcloud'; edr = 'sentinelone'; mdr = 'guardz'; browserSecurity = @('pabx'); baseline = 'de-windows-baseline'; backup = 'msp360'; emailSecurity = 'mimecast'; remoteSupport = 'jumpcloud-remote-assist'; awareness = 'ninjio' }
    $optional = @()
    switch ($Tier) {
        'Office' { $optional = @('siem', 'sase', 'vulnerability-scanning'); $base.mdr = 'guardz' }
        'Business' { $optional = @('sase', 'vulnerability-scanning'); $base.siem = 'wazuh' }
        'Enterprise' { $base.siem = 'wazuh'; $base.sase = 'timus'; $base.vulnerability = 'qualys'; $optional = @('blackpoint-mdr-backup') }
    }
    $rules = @('Security Foundation: MFA everywhere, EDR on every endpoint, encrypted disks, tested backups, email security, awareness training.')
    if ($Gcch) { $rules += 'GCC High: verify each vendor component is authorised for the GCCH boundary before deployment; commercial packaging does not transfer automatically.' }
    return @{ tier = $Tier; included = $base; optional = $optional; rules = $rules }
}

Export-ModuleMember -Function New-DEClientProfileTemplate, Test-DEProfileHasSecrets, Get-DEClientProfiles, Get-DEClientProfile, Save-DEClientProfile, Resolve-DEClientContext, Resolve-DEEndUser, New-DEProvisioningContext, ConvertTo-DELocalUserName, Get-DETierDefaults
