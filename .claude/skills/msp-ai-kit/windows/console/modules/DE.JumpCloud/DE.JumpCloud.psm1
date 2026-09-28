#Requires -Version 5.1
<#
.SYNOPSIS
    JumpCloud controller: agent install / repair / registration verification,
    user and account mapping checks, device-user binding (with primary user
    and admin/standard role), system and user groups, policy results,
    Remote Assist / Protect / Go / Chrome extension / Password Manager presence.

.DESCRIPTION
    API access uses the JumpCloud REST API (v1 and v2) with the runtime-only
    secret JC_API_KEY (x-api-key header). Nothing is assumed from an installer
    exit code: registration is verified through jcagent.conf plus a system
    lookup, binding through the association list, groups and policies through
    their own endpoints. All write calls honour -WhatIf.
#>
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$script:JcApi = 'https://console.jumpcloud.com/api'

function Get-DEJcProp { param($Object, [string]$Name) if ($null -eq $Object) { return $null }; if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] }; return $null }; $p = $Object.PSObject.Properties[$Name]; if ($p) { return $p.Value }; return $null }

function Invoke-DEJumpCloudApi {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][ValidateSet('GET', 'POST', 'PUT', 'DELETE')][string]$Method, [Parameter(Mandatory = $true)][string]$Path, $Body, [switch]$V2)
    if (-not (Test-DESecret -Name 'JC_API_KEY')) { throw 'JumpCloud API key not provided this session (secret JC_API_KEY)' }
    $key = Get-DESecretPlain -Name 'JC_API_KEY'
    $uri = "$script:JcApi$(if ($V2) { '/v2' })$Path"
    $headers = @{ 'x-api-key' = $key; 'Accept' = 'application/json'; 'Content-Type' = 'application/json' }
    $orgId = $null; if (Test-DESecret -Name 'JC_ORG_ID') { $orgId = Get-DESecretPlain -Name 'JC_ORG_ID'; $headers['x-org-id'] = $orgId }
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    if ($Method -ne 'GET' -and -not $PSCmdlet.ShouldProcess($uri, $Method)) { return $null }
    $json = $null; if ($null -ne $Body) { $json = ($Body | ConvertTo-Json -Depth 8 -Compress) }
    Write-DELog -Level DEBUG -Message "jumpcloud $Method $uri"
    try {
        if ($json) { return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -Body $json -TimeoutSec 60 }
        return Invoke-RestMethod -Method $Method -Uri $uri -Headers $headers -TimeoutSec 60
    } finally { $key = $null }
}

function Get-DEJumpCloudSystem {
    <# This device's JumpCloud system record, by systemKey from jcagent.conf, falling back to hostname. #>
    $agent = Get-DEJumpCloudAgentState
    if ($agent.systemKey) { try { return (Invoke-DEJumpCloudApi -Method GET -Path "/systems/$($agent.systemKey)") } catch { Write-DELog -Level WARN -Message "system lookup by key failed: $($_.Exception.Message)" } }
    $r = Invoke-DEJumpCloudApi -Method GET -Path "/search/systems" -Body @{ filter = @{ hostname = $env:COMPUTERNAME } }
    if ($r -and (Get-DEJcProp $r 'results')) { return @($r.results) | Select-Object -First 1 }
    return $null
}
function Get-DEJumpCloudUser { param([Parameter(Mandatory = $true)][string]$Username) $r = Invoke-DEJumpCloudApi -Method GET -Path "/search/systemusers" -Body @{ filter = @{ username = $Username } }; if ($r -and (Get-DEJcProp $r 'results')) { return @($r.results) | Select-Object -First 1 }; return $null }
function Get-DEJumpCloudBoundUsers { param([Parameter(Mandatory = $true)][string]$SystemId) return @(Invoke-DEJumpCloudApi -Method GET -Path "/systems/$SystemId/users" -V2) }
function Get-DEJumpCloudSystemGroupsOf { param([Parameter(Mandatory = $true)][string]$SystemId) return @(Invoke-DEJumpCloudApi -Method GET -Path "/systems/$SystemId/memberof" -V2) }
function Get-DEJumpCloudGroupByName { param([Parameter(Mandatory = $true)][string]$Name, [ValidateSet('system', 'user')][string]$Type = 'system') $r = @(Invoke-DEJumpCloudApi -Method GET -Path ("/{0}groups?filter=name:eq:{1}" -f $Type, [uri]::EscapeDataString($Name)) -V2); return ($r | Select-Object -First 1) }
function Get-DEJumpCloudPolicyResults { param([Parameter(Mandatory = $true)][string]$SystemId) return @(Invoke-DEJumpCloudApi -Method GET -Path "/systems/$SystemId/policystatuses" -V2) }

function Test-DEJumpCloudUserMapping {
    <#
    The exact failure found on Alamo: JC user sthompson, local mapping showing the wrong owner, actual Windows
    principal AzureAD\SuzetteThompson. Returns a verdict the takeover gate uses: READY only when the intended
    local account exists, owns the intended profile, and is not an Entra principal.
    #>
    param([Parameter(Mandatory = $true)][string]$IntendedLocalUser, [string]$SourcePrincipal, [switch]$QueryApi)
    $identity = Get-DEIdentityState
    $local = @($identity.localUsers | Where-Object { $_ -and $_.name -ieq $IntendedLocalUser }) | Select-Object -First 1
    $localProfile = @(Find-DEProfileForUser -UserName $IntendedLocalUser -Profiles $identity.profiles) | Select-Object -First 1
    $sourceProfile = $null; if ($SourcePrincipal) { $sourceProfile = @(Find-DEProfileForUser -UserName $SourcePrincipal -Profiles $identity.profiles) | Select-Object -First 1 }
    $issues = @()
    if (-not $local) { $issues += "local account '$IntendedLocalUser' does not exist yet" }
    if ($local -and -not $local.enabled) { $issues += "local account '$IntendedLocalUser' is disabled" }
    if ($SourcePrincipal -and $identity.interactiveUser -and $identity.interactiveUser -ieq $SourcePrincipal) { $issues += "source user $SourcePrincipal is signed in; migration must run from break-glass or the technician session" }
    if ($sourceProfile -and $localProfile -and $sourceProfile.path -ne $localProfile.path) { $issues += "two profiles present ($($sourceProfile.path) and $($localProfile.path)); ADMU must preserve the source profile, expect a collision" }
    $jc = @{ userExists = $null; bound = $null; boundUsers = @(); systemFound = $null; primaryUser = $null }
    if ($QueryApi -and (Test-DESecret -Name 'JC_API_KEY')) {
        try {
            $u = Get-DEJumpCloudUser -Username $IntendedLocalUser; $jc.userExists = [bool]$u
            if (-not $u) { $issues += "JumpCloud user '$IntendedLocalUser' not found" }
            $sys = Get-DEJumpCloudSystem; $jc.systemFound = [bool]$sys
            if ($sys) {
                $bound = Get-DEJumpCloudBoundUsers -SystemId $sys._id
                $jc.boundUsers = @($bound | ForEach-Object { $_.id })
                $jc.bound = [bool]($u -and ($jc.boundUsers -contains $u._id))
                $jc.primaryUser = Get-DEJcProp (Get-DEJcProp $sys 'primarySystemUser') 'id'
                if ($u -and -not $jc.bound) { $issues += "JumpCloud user '$IntendedLocalUser' is not bound to this system" }
                $others = @($bound | Where-Object { -not $u -or $_.id -ne $u._id })
                if ($others.Count) { $issues += "$($others.Count) other user(s) bound to this system" }
            } else { $issues += 'this device is not registered in JumpCloud' }
        } catch { $issues += "JumpCloud API: $($_.Exception.Message)" }
    }
    $status = if ($issues.Count -eq 0) { 'READY' } elseif ($local -and $localProfile) { 'WARN' } else { 'BLOCKED' }
    return @{ status = $status; intendedLocalUser = $IntendedLocalUser; localAccount = $local; profile = $localProfile; sourcePrincipal = $SourcePrincipal; sourceProfile = $sourceProfile; jumpcloud = $jc; issues = $issues }
}

function Set-DEJumpCloudUserBinding {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Username, [switch]$Administrator, [switch]$SetPrimary)
    $u = Get-DEJumpCloudUser -Username $Username; if (-not $u) { throw "JumpCloud user '$Username' not found" }
    $sys = Get-DEJumpCloudSystem; if (-not $sys) { throw 'device not registered in JumpCloud' }
    $bound = Get-DEJumpCloudBoundUsers -SystemId $sys._id
    $already = [bool]($bound | Where-Object { $_ -and $_.id -eq $u._id })
    $body = @{ op = $(if ($already) { 'update' } else { 'add' }); type = 'user'; id = $u._id; attributes = @{ sudo = @{ enabled = [bool]$Administrator; withoutPassword = $false } } }
    if ($PSCmdlet.ShouldProcess("$Username -> $($sys.hostname)", "bind ($(if ($Administrator) { 'admin' } else { 'standard' }))")) {
        $null = Invoke-DEJumpCloudApi -Method POST -Path "/systems/$($sys._id)/associations" -Body $body -V2
        if ($SetPrimary) { $null = Invoke-DEJumpCloudApi -Method PUT -Path "/systems/$($sys._id)" -Body @{ primarySystemUser = @{ id = $u._id } } }
    }
    $after = Get-DEJumpCloudBoundUsers -SystemId $sys._id
    return @{ bound = [bool]($after | Where-Object { $_ -and $_.id -eq $u._id }); systemId = $sys._id; userId = $u._id }
}
function Add-DEJumpCloudSystemToGroup {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$GroupName)
    $g = Get-DEJumpCloudGroupByName -Name $GroupName -Type system; if (-not $g) { throw "system group '$GroupName' not found" }
    $sys = Get-DEJumpCloudSystem; if (-not $sys) { throw 'device not registered in JumpCloud' }
    $member = [bool]((Get-DEJumpCloudSystemGroupsOf -SystemId $sys._id) | Where-Object { $_ -and $_.id -eq $g.id })
    if ($member) { return @{ member = $true; changed = $false } }
    if ($PSCmdlet.ShouldProcess($GroupName, "add system $($sys.hostname)")) { $null = Invoke-DEJumpCloudApi -Method POST -Path "/systemgroups/$($g.id)/members" -Body @{ op = 'add'; type = 'system'; id = $sys._id } -V2 }
    return @{ member = [bool]((Get-DEJumpCloudSystemGroupsOf -SystemId $sys._id) | Where-Object { $_ -and $_.id -eq $g.id }); changed = $true }
}
function Add-DEJumpCloudUserToGroup {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Username, [Parameter(Mandatory = $true)][string]$GroupName)
    $u = Get-DEJumpCloudUser -Username $Username; if (-not $u) { throw "user '$Username' not found" }
    $g = Get-DEJumpCloudGroupByName -Name $GroupName -Type user; if (-not $g) { throw "user group '$GroupName' not found" }
    $members = @(Invoke-DEJumpCloudApi -Method GET -Path "/usergroups/$($g.id)/members" -V2)
    if ($members | Where-Object { (Get-DEJcProp (Get-DEJcProp $_ 'to') 'id') -eq $u._id }) { return @{ member = $true; changed = $false } }
    if ($PSCmdlet.ShouldProcess($GroupName, "add user $Username")) { $null = Invoke-DEJumpCloudApi -Method POST -Path "/usergroups/$($g.id)/members" -Body @{ op = 'add'; type = 'user'; id = $u._id } -V2 }
    return @{ member = $true; changed = $true }
}
function Get-DEJumpCloudPolicySummary {
    $sys = Get-DEJumpCloudSystem; if (-not $sys) { return @{ registered = $false; policies = @(); failed = @() } }
    $res = Get-DEJumpCloudPolicyResults -SystemId $sys._id
    $failed = @($res | Where-Object { "$(Get-DEJcProp $_ 'success')" -eq 'False' -or "$(Get-DEJcProp $_ 'exitCode')" -notin @('0', '') })
    return @{ registered = $true; systemId = $sys._id; policies = @($res | ForEach-Object { @{ policy = (Get-DEJcProp (Get-DEJcProp $_ 'policy') 'name'); success = (Get-DEJcProp $_ 'success'); exitCode = (Get-DEJcProp $_ 'exitCode'); at = (Get-DEJcProp $_ 'created') } }); failed = @($failed | ForEach-Object { Get-DEJcProp (Get-DEJcProp $_ 'policy') 'name' }) }
}
function Get-DEJumpCloudComponents {
    <# Presence of the JumpCloud client-side pieces beyond the agent. #>
    $apps = Get-DEInstalledApps
    $ra = Get-DEServiceState -Name 'jumpcloud-remote-assist'
    $protect = $null  # JumpCloud Protect is a mobile app; the device-side signal is the MFA requirement on the user, checked via API
    $go = @(Find-DEApp -NamePattern 'JumpCloud Go' -Apps $apps).Count -gt 0
    $pm = @(Find-DEApp -NamePattern 'JumpCloud Password Manager' -Apps $apps).Count -gt 0
    $ext = @()
    foreach ($k in @('HKLM:\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist', 'HKLM:\SOFTWARE\Policies\Microsoft\Edge\ExtensionInstallForcelist')) { if ($env:OS -eq 'Windows_NT' -and (Test-Path $k)) { $ext += @((Get-ItemProperty $k).PSObject.Properties | Where-Object { $_ -and $_.Name -notmatch '^PS' } | ForEach-Object { "$($_.Value)" }) } }
    return @{ remoteAssist = $ra; go = $go; passwordManager = $pm; forcedExtensions = $ext; jumpcloudGoExtensionForced = [bool]($ext | Where-Object { $_ -match 'jumpcloud' }) }
}

function Register-DEJumpCloudActions {
    param($ClientProfile)
    $groups = @(Get-DEHashPath -Object $ClientProfile -Path 'identity.jumpcloudSystemGroups')
    $userGroups = @(Get-DEHashPath -Object $ClientProfile -Path 'identity.jumpcloudUserGroups')

    Register-DEAction -Id 'jumpcloud.agent' -Module 'jumpcloud' -Title 'JumpCloud agent installed and registered' -Phase 7 -Gates @('gate.elevated', 'gate.connectivity') -RequiresElevation -RequiresSecrets @('JC_CONNECT_KEY') `
        -Detect { $a = Get-DEJumpCloudAgentState; @{ installed = $a.installed; running = ($a.service.status -eq 'Running'); registered = $a.registered } } `
        -Desired { @{ installed = $true; running = $true; registered = $true } } `
        -Apply { param($s) $r = Invoke-DEPackageInstall -Id 'jumpcloud-agent' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEJcProp $r 'planned')) { throw $r.detail }; Start-Sleep -Seconds 20; try { Start-Service -Name 'jumpcloud-agent' -ErrorAction SilentlyContinue } catch { }; $r.detail }.GetNewClosure() `
        -Remediate { param($s) try { Restart-Service -Name 'jumpcloud-agent' -ErrorAction Stop; Start-Sleep -Seconds 15 } catch { $null = Invoke-DEPackageInstall -Id 'jumpcloud-agent' -ClientProfile $ClientProfile -Repair } }.GetNewClosure() `
        -Verify { param($after) $a = Get-DEJumpCloudAgentState; @{ ok = ($a.installed -and $a.registered); detail = "service $($a.service.status); systemKey $(if ($a.systemKey) { 'present' } else { 'missing' })" } }

    Register-DEAction -Id 'jumpcloud.user-mapping' -Module 'jumpcloud' -Title 'JumpCloud user mapping matches the intended local account' -Phase 7 `
        -Detect { $ctx = Get-DEContext; $m = Test-DEJumpCloudUserMapping -IntendedLocalUser "$($ctx['localUserName'])" -SourcePrincipal "$($ctx['sourcePrincipal'])" -QueryApi; @{ status = $m.status; issues = ($m.issues -join '; ') } } `
        -Desired { @{ status = 'READY' } } `
        -ManualAction 'Fix the mapping in the JumpCloud console or run the identity migration first; takeover stays locked until this reads READY.'

    Register-DEAction -Id 'jumpcloud.bind-user' -Module 'jumpcloud' -Title 'Bind the intended user to this device (standard user, primary)' -Phase 7 -Gates @('gate.jc-mapping', 'gate.connectivity') -RequiresSecrets @('JC_API_KEY') `
        -Detect { $ctx = Get-DEContext; $m = Test-DEJumpCloudUserMapping -IntendedLocalUser "$($ctx['jumpcloudUser'])" -QueryApi; @{ bound = [bool]$m.jumpcloud.bound } } `
        -Desired { @{ bound = $true } } `
        -Apply { param($s) $ctx = Get-DEContext; $r = Set-DEJumpCloudUserBinding -Username "$($ctx['jumpcloudUser'])" -SetPrimary; if (-not $r.bound) { throw 'binding not visible after the call' }; "bound user $($r.userId) to system $($r.systemId)" } `
        -Verify { param($after) $ctx = Get-DEContext; $m = Test-DEJumpCloudUserMapping -IntendedLocalUser "$($ctx['jumpcloudUser'])" -QueryApi; @{ ok = [bool]$m.jumpcloud.bound; detail = ($m.issues -join '; ') } }

    foreach ($g in $groups) {
        $gn = $g
        Register-DEAction -Id "jumpcloud.group.$($gn -replace '[^\w]', '-')" -Module 'jumpcloud' -Title "System in JumpCloud group '$gn'" -Phase 7 -Gates @('gate.connectivity') -RequiresSecrets @('JC_API_KEY') `
            -Detect { $sys = Get-DEJumpCloudSystem; if (-not $sys) { @{ member = $false } } else { $grp = Get-DEJumpCloudGroupByName -Name $gn -Type system; @{ member = [bool]($grp -and ((Get-DEJumpCloudSystemGroupsOf -SystemId $sys._id) | Where-Object { $_ -and $_.id -eq $grp.id })) } } }.GetNewClosure() `
            -Desired { @{ member = $true } } -Apply { param($s) $r = Add-DEJumpCloudSystemToGroup -GroupName $gn; if (-not $r.member) { throw 'not a member after the call' }; 'added' }.GetNewClosure()
    }
    foreach ($g in $userGroups) {
        $gn = $g
        Register-DEAction -Id "jumpcloud.usergroup.$($gn -replace '[^\w]', '-')" -Module 'jumpcloud' -Title "End user in JumpCloud user group '$gn'" -Phase 7 -Gates @('gate.connectivity') -RequiresSecrets @('JC_API_KEY') `
            -Detect { $ctx = Get-DEContext; $u = Get-DEJumpCloudUser -Username "$($ctx['jumpcloudUser'])"; $grp = Get-DEJumpCloudGroupByName -Name $gn -Type user; if (-not $u -or -not $grp) { @{ member = $false } } else { $m = @(Invoke-DEJumpCloudApi -Method GET -Path "/usergroups/$($grp.id)/members" -V2); @{ member = [bool]($m | Where-Object { (Get-DEJcProp (Get-DEJcProp $_ 'to') 'id') -eq $u._id }) } } }.GetNewClosure() `
            -Desired { @{ member = $true } } -Apply { param($s) $ctx = Get-DEContext; $r = Add-DEJumpCloudUserToGroup -Username "$($ctx['jumpcloudUser'])" -GroupName $gn; 'added' }.GetNewClosure()
    }

    Register-DEAction -Id 'jumpcloud.policies' -Module 'jumpcloud' -Title 'JumpCloud policies applied without failures' -Phase 8 -Gates @('gate.connectivity') -RequiresSecrets @('JC_API_KEY') `
        -Detect { $p = Get-DEJumpCloudPolicySummary; @{ registered = $p.registered; failedCount = @($p.failed).Count; failed = (@($p.failed) -join ', ') } } -Desired { @{ registered = $true; failedCount = 0 } } `
        -ManualAction 'Open the system in the JumpCloud console > Policies and read the failing policy result; patch and software policies report here too.'

    Register-DEAction -Id 'jumpcloud.remote-assist' -Module 'jumpcloud' -Title 'JumpCloud Remote Assist installed' -Phase 8 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $c = Get-DEJumpCloudComponents; @{ installed = $c.remoteAssist.present } } -Desired { @{ installed = $true } } `
        -Apply { param($s) $r = Invoke-DEPackageInstall -Id 'jumpcloud-remote-assist' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEJcProp $r 'planned')) { throw $r.detail }; $r.detail }.GetNewClosure()

    Register-DEAction -Id 'jumpcloud.go-extension' -Module 'jumpcloud' -Title 'JumpCloud Go browser extension force-installed' -Phase 8 `
        -Detect { $c = Get-DEJumpCloudComponents; @{ forced = $c.jumpcloudGoExtensionForced } } -Desired { @{ forced = $true } } `
        -ManualAction 'Apply through the Browser Configurator (extension allow/force list) or a JumpCloud browser policy.'
}

Export-ModuleMember -Function Invoke-DEJumpCloudApi, Get-DEJumpCloudSystem, Get-DEJumpCloudUser, Get-DEJumpCloudBoundUsers, Get-DEJumpCloudSystemGroupsOf, Get-DEJumpCloudGroupByName, Get-DEJumpCloudPolicyResults, Test-DEJumpCloudUserMapping, Set-DEJumpCloudUserBinding, Add-DEJumpCloudSystemToGroup, Add-DEJumpCloudUserToGroup, Get-DEJumpCloudPolicySummary, Get-DEJumpCloudComponents, Register-DEJumpCloudActions
