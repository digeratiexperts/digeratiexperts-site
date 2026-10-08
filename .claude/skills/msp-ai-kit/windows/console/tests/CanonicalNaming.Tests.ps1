# Canonical DE identity, privileged-account, device, location, and network naming.
# Pester 5.x, Windows PowerShell 5.1 compatible. Pure generators run on every CI OS.

Describe 'DE canonical identity, location and network standard' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DECanonicalTest = @{ Dir = Initialize-TestConsole }
    }

    It 'pins the Hub projection at version 1.0.0' {
        $p = Get-DECanonicalNamingPolicy
        $p.id | Should -Be 'de-identity-location-network'
        $p.version | Should -Be '1.0.0'
        $p.internalPrimaryPattern | Should -Be 'firstname.lastname@clientdomain'
        $p.externalPrimaryPattern | Should -Be 'firstname.lastname-ext@clientdomain'
        $p.roomDeskEncodedInIp | Should -Be $false
        $p.inheritedNetworksAreRenumberedForConventionOnly | Should -Be $false
    }

    It 'generates employee and external principals with the class suffix last' {
        New-DEHumanPrincipal -FirstName Jane -LastName Smith -Domain clientcompany.com |
            Should -Be 'jane.smith@clientcompany.com'
        New-DEHumanPrincipal -FirstName John -LastName Doe -Domain clientcompany.com -PersonClass external |
            Should -Be 'john.doe-ext@clientcompany.com'
        New-DEHumanPrincipal -FirstName John -LastName Doe -Domain clientcompany.com -PersonClass external -AccountKind admin |
            Should -Be 'john.doe-admin-ext@clientcompany.com'
        New-DEHumanPrincipal -FirstName John -LastName Doe -Domain clientcompany.com -PersonClass external -AccountKind priv |
            Should -Be 'john.doe-priv-ext@clientcompany.com'
    }

    It 'uses middle initial then numeric collisions and never moves -ext away from the end' {
        $c = @(Get-DEHumanIdentityCandidates -FirstName John -MiddleName Quincy -LastName Smith -PersonClass external -NumericCandidates 3)
        $c[0] | Should -Be 'john.smith-ext'
        $c[1] | Should -Be 'john.q.smith-ext'
        $c[2] | Should -Be 'john.smith2-ext'
        $c[3] | Should -Be 'john.smith3-ext'
    }

    It 'normalizes ordinary names and refuses unusable names or domains' {
        New-DEHumanPrincipal -FirstName 'José' -LastName "O'Neil" -Domain '@Example.COM' |
            Should -Be 'jose.oneil@example.com'
        { New-DEHumanPrincipal -FirstName '***' -LastName Smith -Domain example.com } | Should -Throw
        { New-DEHumanPrincipal -FirstName Jane -LastName Smith -Domain not-a-domain } | Should -Throw
    }

    It 'keeps endpoint break glass distinct from two tenant emergency identities' {
        (Get-DECanonicalNamingPolicy).endpointRecoveryAccount | Should -Be 'DE-BreakGlass'
        @(Get-DETenantEmergencyPrincipals -NativeDomain tenant.onmicrosoft.com) | Should -Be @(
            'emergency-admin-01@tenant.onmicrosoft.com',
            'emergency-admin-02@tenant.onmicrosoft.com'
        )
    }

    It 'creates service identities without pretending a service is a person' {
        New-DEServiceIdentity -System 'Backup Platform' -Purpose 'Agent Worker' |
            Should -Be 'svc-backupplatform-agentworker'
    }

    It 'maps human device roles and builds a stable 15-character-or-less hostname' {
        ConvertTo-DEDeviceRoleCode -Role laptop | Should -Be 'LAP'
        ConvertTo-DEDeviceRoleCode -Role workstation | Should -Be 'DSK'
        ConvertTo-DEDeviceRoleCode -Role firewall | Should -Be 'NET'
        New-DECanonicalHostname -ClientCode ALAMO -Role laptop -AssetToken 0047 |
            Should -Be 'ALAMO-LAP-0047'
        (New-DECanonicalHostname -ClientCode ACME -Role desktop -AssetToken A132).Length |
            Should -BeLessOrEqual 15
        { New-DECanonicalHostname -ClientCode TOOLONG -Role laptop -AssetToken 0047 } | Should -Throw
    }

    It 'builds optional-depth physical locations and privacy-safe remote locations' {
        New-DELocationCode -Country US -Region AZ -City CHD -Site 1 -Building 1 -Floor 2 -Room 215 -StationType desk -Station 7 |
            Should -Be 'US-AZ-CHD-S01-B01-F02-R0215-D007'
        New-DELocationCode -Country US -Region AZ -Remote | Should -Be 'US-AZ-REM'
        { New-DELocationCode -Country US -Region AZ -Remote -Room 1 } | Should -Throw
    }

    It 'derives /20 sites and functional /24s from an allocated private /16' {
        $p = New-DESiteNetworkPlan -ClientCidr '10.32.0.0/16' -SiteOrdinal 2
        $p.siteCode | Should -Be 'S02'
        $p.siteCidr | Should -Be '10.32.16.0/20'
        $p.roomDeskEncodedInAddress | Should -Be $false
        ($p.segments | Where-Object key -eq management).vlanId | Should -Be 10
        ($p.segments | Where-Object key -eq management).cidr | Should -Be '10.32.16.0/24'
        ($p.segments | Where-Object key -eq guest).vlanId | Should -Be 80
        ($p.segments | Where-Object key -eq guest).cidr | Should -Be '10.32.23.0/24'
    }

    It 'refuses public/misaligned net-new blocks instead of inventing an allocation' {
        { New-DESiteNetworkPlan -ClientCidr '8.8.0.0/16' -SiteOrdinal 1 } | Should -Throw
        { New-DESiteNetworkPlan -ClientCidr '10.32.1.0/16' -SiteOrdinal 1 } | Should -Throw
        { New-DESiteNetworkPlan -ClientCidr '10.32.0.0/16' -SiteOrdinal 17 } | Should -Throw
    }

    It 'gives new client profiles the canonical convention and adopt-existing network safety default' {
        $p = New-DEClientProfileTemplate -Id acme -Name 'Acme Company'
        $p.schemaVersion | Should -Be 2
        $p.identity.usernameConvention | Should -Be 'firstname.lastname'
        $p.identity.naming.standardVersion | Should -Be '1.0.0'
        $p.identity.naming.techLevelIsRbac | Should -Be $true
        $p.branding.hostnamePattern | Should -Be '{CLIENT}-{ROLE}-{ASSET4}'
        $p.network.addressPlan.mode | Should -Be 'adopt-existing'
    }

    It 'validates profile identity and net-new address-plan settings before saving' {
        $p = New-DEClientProfileTemplate -Id bad-domain -Name 'Bad Domain'
        $p.shortName = 'BAD'
        $p.identity.primaryDomain = 'not-a-domain'
        { Save-DEClientProfile -Profile $p -Confirm:$false } | Should -Throw

        $p = New-DEClientProfileTemplate -Id bad-net -Name 'Bad Net'
        $p.shortName = 'BN'
        $p.network.addressPlan.mode = 'de-net-new'
        $p.network.addressPlan.clientCidr = ''
        { Save-DEClientProfile -Profile $p -Confirm:$false } | Should -Throw

        $p = New-DEClientProfileTemplate -Id too-long-code -Name 'Too Long Code'
        $p.shortName = 'TOOLONG'
        { Save-DEClientProfile -Profile $p -Confirm:$false } | Should -Throw
    }

    It 'uses canonical first.last for new users but preserves the recorded Alamo takeover mapping' {
        ConvertTo-DELocalUserName -DisplayOrPrincipal 'AzureAD\SuzetteThompson' |
            Should -Be 'suzette.thompson'
        ConvertTo-DELocalUserName -DisplayOrPrincipal 'AzureAD\ExternalWorker' -PersonClass external |
            Should -Be 'external.worker-ext'

        $snap = @{
            device = @{ hostname = 'ALAMO-LAP-0231'; serial = 'ABC1234'; model = 'Latitude 7450' }
            identity = @{
                dsreg = @{ tenantName = 'Alamo'; tenantId = '' }
                interactiveUser = 'AzureAD\SuzetteThompson'
                currentPrincipal = 'ALAMO-LAP-0231\DE-BreakGlass'
                profiles = @(@{ path = 'C:\Users\SuzetteThompson'; sid = 'S-1-12-1-1'; lastUse = '2026-09-27' })
            }
            mdm = @{ authority = 'jumpcloud' }
        }
        $takeover = New-DEProvisioningContext -Snapshot $snap -ClientId alamo -Mode takeover -Technician jrpetro
        $takeover.localUserName | Should -Be 'sthompson'
        $takeover.namingStatus | Should -Be 'inherited-exception'

        $new = New-DEProvisioningContext -Snapshot $snap -ClientId alamo -Mode new -Technician jrpetro
        $new.localUserName | Should -Be 'suzette.thompson'
        $new.namingStatus | Should -Be 'canonical'
    }

    It 'uses a four-character asset tag when available and serial fallback otherwise' {
        $p = New-DEClientProfileTemplate -Id acme -Name 'Acme'
        $p.shortName = 'ACME'
        Mock -ModuleName DE.Configure Get-DEDeviceInventory { @{ serial = 'ABC1234' } }

        Set-DEContext -Values @{ device = @{ assetTag = '0047' } }
        New-DEHostname -ClientProfile $p -Role laptop | Should -Be 'ACME-LAP-0047'

        Set-DEContext -Values @{ device = @{ assetTag = '' } }
        New-DEHostname -ClientProfile $p -Role laptop | Should -Be 'ACME-LAP-1234'
    }
}
