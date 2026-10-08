#Requires -Version 5.1
<#
.SYNOPSIS
    DE canonical identity, device, location and net-new address-plan helpers.
.DESCRIPTION
    Projection of the Intelligence Hub canonical standard:
    docs/de-canonical/08_DE_IDENTITY_LOCATION_NETWORK_STANDARD.md version 1.0.0.

    These helpers are pure policy projections. They do not create accounts,
    allocate a client's global CIDR, write network devices, or renumber an
    inherited environment.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:DECanonicalNamingVersion = '1.0.0'
$script:DEEndpointRecoveryAccount = 'DE-BreakGlass'
$script:DETenantEmergencyAccounts = @('emergency-admin-01', 'emergency-admin-02')
$script:DEDeviceRoleCodes = @('LAP', 'DSK', 'SRV', 'KSK', 'POS', 'TAB', 'VDI', 'NET', 'PRN', 'IOT')
$script:DEStandardNetworkSegments = @(
    [pscustomobject]@{ slot = 0;  vlanId = 10;  key = 'management';                label = 'Management' }
    [pscustomobject]@{ slot = 1;  vlanId = 20;  key = 'infrastructure';            label = 'Infrastructure / servers' }
    [pscustomobject]@{ slot = 2;  vlanId = 30;  key = 'corp-wired';                label = 'Corporate wired' }
    [pscustomobject]@{ slot = 3;  vlanId = 40;  key = 'corp-wireless';             label = 'Corporate wireless' }
    [pscustomobject]@{ slot = 4;  vlanId = 50;  key = 'voice';                     label = 'Voice' }
    [pscustomobject]@{ slot = 5;  vlanId = 60;  key = 'printers-iot';              label = 'Printers / IoT' }
    [pscustomobject]@{ slot = 6;  vlanId = 70;  key = 'cameras-physical-security'; label = 'Cameras / physical security' }
    [pscustomobject]@{ slot = 7;  vlanId = 80;  key = 'guest';                     label = 'Guest' }
    [pscustomobject]@{ slot = 8;  vlanId = 90;  key = 'ot-warehouse';              label = 'OT / warehouse' }
    [pscustomobject]@{ slot = 9;  vlanId = 100; key = 'pos-kiosk';                 label = 'POS / kiosk' }
    [pscustomobject]@{ slot = 10; vlanId = 110; key = 'security-tooling';          label = 'Security tooling' }
    [pscustomobject]@{ slot = 11; vlanId = 120; key = 'dmz';                       label = 'DMZ / published services' }
    [pscustomobject]@{ slot = 12; vlanId = 130; key = 'transit-vpn';               label = 'Transit / VPN' }
)

function Get-DECanonicalNamingPolicy {
    return [pscustomobject][ordered]@{
        id = 'de-identity-location-network'
        version = $script:DECanonicalNamingVersion
        internalPrimaryPattern = 'firstname.lastname@clientdomain'
        externalPrimaryPattern = 'firstname.lastname-ext@clientdomain'
        adminSuffix = '-admin'
        privilegedSuffix = '-priv'
        externalSuffix = '-ext'
        endpointRecoveryAccount = $script:DEEndpointRecoveryAccount
        tenantEmergencyAccounts = @($script:DETenantEmergencyAccounts)
        devicePattern = '<CLIENT>-<ROLE>-<ASSET4>'
        locationPattern = '<COUNTRY>-<REGION>-<CITY>-S##[-B##][-F##][-R####][-(D|C)###]'
        networkModes = @('de-net-new', 'adopt-existing')
        roomDeskEncodedInIp = $false
        inheritedNetworksAreRenumberedForConventionOnly = $false
    }
}

function ConvertTo-DEAscii {
    param([Parameter(Mandatory = $true)][string]$Value)
    $norm = $Value.Normalize([Text.NormalizationForm]::FormD)
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $norm.ToCharArray()) {
        $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
        if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($ch)
        }
    }
    return $sb.ToString().Normalize([Text.NormalizationForm]::FormC)
}

function ConvertTo-DEAccountToken {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [string]$Field = 'value'
    )
    $out = (ConvertTo-DEAscii -Value $Value).ToLowerInvariant()
    $out = $out -replace "[’']", ''
    $out = $out -replace '[^a-z0-9]', ''
    if (-not $out) { throw "$Field must contain at least one ASCII letter or number" }
    return $out
}

function Test-DEIdentityDomain {
    param([Parameter(Mandatory = $true)][string]$Domain)
    $d = (ConvertTo-DEAscii -Value $Domain).ToLowerInvariant().Trim().TrimStart('@')
    if (
        $d.Length -gt 253 -or
        $d -notmatch '^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$' -or
        $d -notmatch '\.' -or
        $d -match '\.\.'
    ) {
        throw "invalid identity domain '$Domain'"
    }
    return $d
}

function New-DEHumanAccountStem {
    param(
        [Parameter(Mandatory = $true)][string]$FirstName,
        [Parameter(Mandatory = $true)][string]$LastName,
        [string]$MiddleName = '',
        [ValidateSet('internal', 'external')][string]$PersonClass = 'internal',
        [ValidateSet('daily', 'admin', 'priv')][string]$AccountKind = 'daily',
        [ValidateRange(0, 999)][int]$Collision = 0
    )

    $first = ConvertTo-DEAccountToken -Value $FirstName -Field 'firstName'
    $last = ConvertTo-DEAccountToken -Value $LastName -Field 'lastName'
    $middle = $(if ($MiddleName) { ConvertTo-DEAccountToken -Value $MiddleName -Field 'middleName' } else { '' })

    $base = "$first.$last"
    if ($Collision -eq 1 -and $middle) {
        $base = "$first.$($middle.Substring(0, 1)).$last"
    } elseif ($Collision -gt 0) {
        $number = $(if ($middle) { $Collision } else { $Collision + 1 })
        $base = "$first.$last$number"
    }

    $privilegeSuffix = switch ($AccountKind) {
        'admin' { '-admin' }
        'priv' { '-priv' }
        default { '' }
    }
    $personSuffix = $(if ($PersonClass -eq 'external') { '-ext' } else { '' })
    return "$base$privilegeSuffix$personSuffix"
}

function Get-DEHumanIdentityCandidates {
    param(
        [Parameter(Mandatory = $true)][string]$FirstName,
        [Parameter(Mandatory = $true)][string]$LastName,
        [string]$MiddleName = '',
        [ValidateSet('internal', 'external')][string]$PersonClass = 'internal',
        [ValidateSet('daily', 'admin', 'priv')][string]$AccountKind = 'daily',
        [ValidateRange(0, 20)][int]$NumericCandidates = 3
    )

    $out = New-Object System.Collections.Generic.List[string]
    $out.Add((New-DEHumanAccountStem -FirstName $FirstName -LastName $LastName -MiddleName $MiddleName -PersonClass $PersonClass -AccountKind $AccountKind))

    if ($MiddleName) {
        $out.Add((New-DEHumanAccountStem -FirstName $FirstName -LastName $LastName -MiddleName $MiddleName -PersonClass $PersonClass -AccountKind $AccountKind -Collision 1))
    }

    $collision = $(if ($MiddleName) { 2 } else { 1 })
    $targetCount = 1 + $(if ($MiddleName) { 1 } else { 0 }) + $NumericCandidates
    while ($out.Count -lt $targetCount) {
        $candidate = New-DEHumanAccountStem -FirstName $FirstName -LastName $LastName -MiddleName $MiddleName -PersonClass $PersonClass -AccountKind $AccountKind -Collision $collision
        if (-not $out.Contains($candidate)) { $out.Add($candidate) }
        $collision++
    }
    return @($out)
}

function New-DEHumanPrincipal {
    param(
        [Parameter(Mandatory = $true)][string]$FirstName,
        [Parameter(Mandatory = $true)][string]$LastName,
        [Parameter(Mandatory = $true)][string]$Domain,
        [string]$MiddleName = '',
        [ValidateSet('internal', 'external')][string]$PersonClass = 'internal',
        [ValidateSet('daily', 'admin', 'priv')][string]$AccountKind = 'daily',
        [ValidateRange(0, 999)][int]$Collision = 0
    )

    $stem = New-DEHumanAccountStem -FirstName $FirstName -LastName $LastName -MiddleName $MiddleName -PersonClass $PersonClass -AccountKind $AccountKind -Collision $Collision
    $domain = Test-DEIdentityDomain -Domain $Domain
    return "$stem@$domain"
}

function Get-DETenantEmergencyPrincipals {
    param([Parameter(Mandatory = $true)][string]$NativeDomain)
    $domain = Test-DEIdentityDomain -Domain $NativeDomain
    return @($script:DETenantEmergencyAccounts | ForEach-Object { "$_@$domain" })
}

function New-DEServiceIdentity {
    param(
        [Parameter(Mandatory = $true)][string]$System,
        [Parameter(Mandatory = $true)][string]$Purpose
    )
    $systemToken = ConvertTo-DEAccountToken -Value $System -Field 'system'
    $purposeToken = ConvertTo-DEAccountToken -Value $Purpose -Field 'purpose'
    return "svc-$systemToken-$purposeToken"
}

function ConvertTo-DEDeviceRoleCode {
    param([Parameter(Mandatory = $true)][string]$Role)
    $r = $Role.Trim().ToUpperInvariant()
    if ($script:DEDeviceRoleCodes -contains $r) { return $r }

    switch -Regex ($r) {
        '^LAP(TOP)?$' { return 'LAP' }
        '^(DESKTOP|WORKSTATION|DESK)$' { return 'DSK' }
        '^SERVER$' { return 'SRV' }
        '^KIOSK$' { return 'KSK' }
        '^(POS|POINT.?OF.?SALE)$' { return 'POS' }
        '^TABLET$' { return 'TAB' }
        '^(VDI|VIRTUAL.?DESKTOP)$' { return 'VDI' }
        '^(NETWORK|SWITCH|FIREWALL|ROUTER|ACCESS.?POINT|AP)$' { return 'NET' }
        '^PRINTER$' { return 'PRN' }
        '^IOT$' { return 'IOT' }
        default { throw "unsupported device role '$Role'" }
    }
}

function New-DECanonicalHostname {
    param(
        [Parameter(Mandatory = $true)][string]$ClientCode,
        [Parameter(Mandatory = $true)][string]$Role,
        [Parameter(Mandatory = $true)][string]$AssetToken
    )

    $client = ((ConvertTo-DEAscii -Value $ClientCode).ToUpperInvariant() -replace '[^A-Z0-9]', '')
    $asset = ((ConvertTo-DEAscii -Value $AssetToken).ToUpperInvariant() -replace '[^A-Z0-9]', '')
    $roleCode = ConvertTo-DEDeviceRoleCode -Role $Role

    if ($client.Length -lt 2 -or $client.Length -gt 5) {
        throw 'clientCode must be 2-5 ASCII letters/numbers'
    }
    if ($asset -notmatch '^[A-Z0-9]{4}$') {
        throw 'assetToken must be exactly four ASCII letters/numbers'
    }

    $hostname = "$client-$roleCode-$asset"
    if ($hostname.Length -gt 15) {
        throw 'canonical Windows hostname exceeds 15 characters'
    }
    return $hostname
}

function ConvertTo-DELocationToken {
    param(
        [Parameter(Mandatory = $true)][string]$Value,
        [Parameter(Mandatory = $true)][string]$Field,
        [int]$Min = 2,
        [int]$Max = 5
    )

    $out = ((ConvertTo-DEAscii -Value $Value).ToUpperInvariant() -replace '[^A-Z0-9]', '')
    if ($out.Length -lt $Min -or $out.Length -gt $Max) {
        throw "$Field must be $Min-$Max ASCII letters/numbers"
    }
    return $out
}

function Format-DELocationOrdinal {
    param(
        [Parameter(Mandatory = $true)][string]$Prefix,
        [Parameter(Mandatory = $true)][int]$Value,
        [Parameter(Mandatory = $true)][int]$Width,
        [Parameter(Mandatory = $true)][string]$Field
    )

    $max = [int]([Math]::Pow(10, $Width) - 1)
    if ($Value -lt 0 -or $Value -gt $max) {
        throw "$Field must be an integer from 0 to $max"
    }
    return "$Prefix$($Value.ToString(('0' * $Width)))"
}

function New-DELocationCode {
    param(
        [Parameter(Mandatory = $true)][string]$Country,
        [Parameter(Mandatory = $true)][string]$Region,
        [string]$City = '',
        [Nullable[int]]$Site,
        [Nullable[int]]$Building,
        [Nullable[int]]$Floor,
        [Nullable[int]]$Room,
        [ValidateSet('desk', 'cube')][string]$StationType,
        [Nullable[int]]$Station,
        [switch]$Remote
    )

    $parts = New-Object System.Collections.Generic.List[string]
    $parts.Add((ConvertTo-DELocationToken -Value $Country -Field 'country' -Min 2 -Max 2))
    $parts.Add((ConvertTo-DELocationToken -Value $Region -Field 'region' -Min 2 -Max 3))

    if ($Remote) {
        if ($null -ne $Site -or $null -ne $Building -or $null -ne $Floor -or $null -ne $Room -or $null -ne $Station) {
            throw 'remote location must not encode site/building/floor/room/station'
        }
        $parts.Add('REM')
        return ($parts -join '-')
    }

    if (-not $City) { throw 'city is required for a physical location' }
    if ($null -eq $Site) { throw 'site is required for a physical location' }

    $parts.Add((ConvertTo-DELocationToken -Value $City -Field 'city' -Min 3 -Max 5))
    $parts.Add((Format-DELocationOrdinal -Prefix 'S' -Value $Site -Width 2 -Field 'site'))

    if ($null -ne $Building) { $parts.Add((Format-DELocationOrdinal -Prefix 'B' -Value $Building -Width 2 -Field 'building')) }
    if ($null -ne $Floor) { $parts.Add((Format-DELocationOrdinal -Prefix 'F' -Value $Floor -Width 2 -Field 'floor')) }
    if ($null -ne $Room) { $parts.Add((Format-DELocationOrdinal -Prefix 'R' -Value $Room -Width 4 -Field 'room')) }

    if ($null -ne $Station -or $StationType) {
        if ($null -eq $Station -or -not $StationType) {
            throw 'station and stationType must be supplied together'
        }
        $prefix = $(if ($StationType -eq 'desk') { 'D' } else { 'C' })
        $parts.Add((Format-DELocationOrdinal -Prefix $prefix -Value $Station -Width 3 -Field 'station'))
    }

    return ($parts -join '-')
}

function Get-DECanonicalNetworkSegments {
    return @($script:DEStandardNetworkSegments | ForEach-Object {
        [pscustomobject][ordered]@{
            slot = $_.slot
            vlanId = $_.vlanId
            key = $_.key
            label = $_.label
        }
    })
}

function New-DESiteNetworkPlan {
    param(
        [Parameter(Mandatory = $true)][string]$ClientCidr,
        [Parameter(Mandatory = $true)][ValidateRange(1, 16)][int]$SiteOrdinal
    )

    $match = [regex]::Match($ClientCidr.Trim(), '^(\d{1,3})\.(\d{1,3})\.0\.0/16$')
    if (-not $match.Success) {
        throw 'net-new client CIDR must be an IPv4 /16 aligned on x.y.0.0/16'
    }

    $a = [int]$match.Groups[1].Value
    $b = [int]$match.Groups[2].Value
    if ($a -gt 255 -or $b -gt 255) { throw 'invalid IPv4 /16' }

    $private = ($a -eq 10) -or ($a -eq 172 -and $b -ge 16 -and $b -le 31) -or ($a -eq 192 -and $b -eq 168)
    if (-not $private) {
        throw 'net-new client CIDR must use RFC1918 private address space'
    }

    $siteStart = ($SiteOrdinal - 1) * 16
    $segments = @(Get-DECanonicalNetworkSegments | ForEach-Object {
        [pscustomobject][ordered]@{
            slot = $_.slot
            vlanId = $_.vlanId
            key = $_.key
            label = $_.label
            cidr = "$a.$b.$($siteStart + $_.slot).0/24"
        }
    })

    return [pscustomobject][ordered]@{
        mode = 'de-net-new'
        clientCidr = "$a.$b.0.0/16"
        siteOrdinal = $SiteOrdinal
        siteCode = "S$($SiteOrdinal.ToString('00'))"
        siteCidr = "$a.$b.$siteStart.0/20"
        segments = $segments
        hostRange = [pscustomobject][ordered]@{
            gateway = '.1'
            infrastructureStatic = '.2-.49'
            ordinaryDhcp = '.50-.229'
            reservations = '.230-.249'
            networkHaReserve = '.250-.254'
        }
        roomDeskEncodedInAddress = $false
    }
}

Export-ModuleMember -Function Get-DECanonicalNamingPolicy, ConvertTo-DEAscii, ConvertTo-DEAccountToken, Test-DEIdentityDomain, New-DEHumanAccountStem, Get-DEHumanIdentityCandidates, New-DEHumanPrincipal, Get-DETenantEmergencyPrincipals, New-DEServiceIdentity, ConvertTo-DEDeviceRoleCode, New-DECanonicalHostname, New-DELocationCode, Get-DECanonicalNetworkSegments, New-DESiteNetworkPlan
