#Requires -Version 5.1
<#
.SYNOPSIS
    DE Tech Tool discovery engines: device, identity (dsregcmd), MDM
    authority, BitLocker, OneDrive, Windows Hello, updates, installed apps,
    management and security agents, network, pending reboot.

.DESCRIPTION
    Read-only. Every function returns a hashtable and never throws for a
    missing subsystem; unknowns are reported as $null / 'unknown' so the gate
    engine can say BLOCKED instead of guessing. Pure parsers (ConvertFrom-*)
    are separated from collectors so they can be unit-tested with fixtures on
    any platform. Windows PowerShell 5.1 compatible; CIM instead of WMIC.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')

function Invoke-DEDiscoveryNative {
    param([string]$FilePath, [string[]]$Arguments = @())
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE } catch { $out = @("$($_.Exception.Message)"); $code = -1 } finally { $ErrorActionPreference = $prev }
    return [pscustomobject]@{ ExitCode = $code; Output = $out; Text = ($out -join "`n") }
}
function Get-DECim { param([string]$Class, [string]$Namespace = 'root/cimv2', [string]$Filter) try { if ($Filter) { return @(Get-CimInstance -ClassName $Class -Namespace $Namespace -Filter $Filter -ErrorAction Stop) }; return @(Get-CimInstance -ClassName $Class -Namespace $Namespace -ErrorAction Stop) } catch { return @() } }
function Get-DEReg { param([string]$Path, [string]$Name) try { $i = Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop; return $i.$Name } catch { return $null } }

# ------------------------------------------------------------------ device
function Get-DEDeviceInventory {
    <# Manufacturer, model, serial, BIOS, OS, CPU, RAM, disks, TPM, Secure Boot, hostname, docks/displays, adapters. #>
    $cs = Get-DECim Win32_ComputerSystem | Select-Object -First 1
    $bios = Get-DECim Win32_BIOS | Select-Object -First 1
    $os = Get-DECim Win32_OperatingSystem | Select-Object -First 1
    $cpu = Get-DECim Win32_Processor | Select-Object -First 1
    $disks = Get-DECim Win32_LogicalDisk -Filter "DriveType=3"
    $tpm = Get-DECim -Class Win32_Tpm -Namespace 'root/cimv2/Security/MicrosoftTpm' | Select-Object -First 1
    $secureBoot = $null
    if ($script:IsWindowsHost) { try { $secureBoot = Confirm-SecureBootUEFI -ErrorAction Stop } catch { $secureBoot = $null } }
    $activation = $null
    if ($script:IsWindowsHost) { $lic = Get-DECim Win32_SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL AND ApplicationID='55c92734-d682-4d71-983e-d6ec3f16059f'" | Select-Object -First 1; if ($lic) { $activation = switch ($lic.LicenseStatus) { 1 { 'Licensed' } 0 { 'Unlicensed' } 2 { 'OOB grace' } 3 { 'OOT grace' } 4 { 'Non-genuine grace' } 5 { 'Notification' } 6 { 'Extended grace' } default { "status $($lic.LicenseStatus)" } } } }
    $build = $null; $ubr = Get-DEReg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'UBR'; $displayVersion = Get-DEReg 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'DisplayVersion'
    if ($os) { $build = "$($os.Version)"; if ($ubr) { $build = "$build.$ubr" } }
    $monitors = @(Get-DECim -Class WmiMonitorID -Namespace 'root/wmi' | ForEach-Object { $n = ''; if ($_.UserFriendlyName) { $n = -join ($_.UserFriendlyName | Where-Object { $_ -ne 0 } | ForEach-Object { [char]$_ }) }; $n } | Where-Object { $_ })
    $docks = @(Get-DECim Win32_PnPEntity | Where-Object { $_ -and $_.Name -match 'Dock|Thunderbolt|USB4|DisplayLink' } | Select-Object -ExpandProperty Name -Unique)
    $adapters = @(Get-DECim Win32_NetworkAdapter -Filter "PhysicalAdapter=True" | ForEach-Object { @{ name = $_.Name; mac = $_.MACAddress; enabled = [bool]$_.NetEnabled; type = $(if ($_.Name -match 'Wi-?Fi|Wireless|802\.11') { 'wifi' } elseif ($_.Name -match 'Bluetooth') { 'bluetooth' } else { 'ethernet' }) } })
    return @{
        hostname       = $env:COMPUTERNAME
        manufacturer   = $(if ($cs) { $cs.Manufacturer } else { $null })
        model          = $(if ($cs) { $cs.Model } else { $null })
        serial         = $(if ($bios) { $bios.SerialNumber } else { $null })
        biosVersion    = $(if ($bios) { $bios.SMBIOSBIOSVersion } else { $null })
        biosDate       = $(if ($bios -and $bios.ReleaseDate) { ([datetime]$bios.ReleaseDate).ToString('yyyy-MM-dd') } else { $null })
        osCaption      = $(if ($os) { $os.Caption } else { $null })
        osBuild        = $build
        osDisplayVersion = $displayVersion
        osArchitecture = $(if ($os) { $os.OSArchitecture } else { $null })
        activation     = $activation
        cpu            = $(if ($cpu) { $cpu.Name } else { $null })
        ramGB          = $(if ($cs) { [math]::Round($cs.TotalPhysicalMemory / 1GB, 1) } else { $null })
        disks          = @($disks | ForEach-Object { @{ drive = $_.DeviceID; sizeGB = [math]::Round($_.Size / 1GB, 0); freeGB = [math]::Round($_.FreeSpace / 1GB, 0) } })
        tpmPresent     = [bool]$tpm
        tpmVersion     = $(if ($tpm) { "$($tpm.SpecVersion)" } else { $null })
        tpmReady       = $(if ($tpm) { [bool]$tpm.IsEnabled_InitialValue -and [bool]$tpm.IsActivated_InitialValue } else { $null })
        secureBoot     = $secureBoot
        displays       = $monitors
        docks          = $docks
        adapters       = $adapters
        lastBoot       = $(if ($os -and $os.LastBootUpTime) { ([datetime]$os.LastBootUpTime).ToString('o') } else { $null })
        collectedAt    = (Get-Date).ToString('o')
    }
}

function Get-DEPendingReboot {
    $reasons = @()
    if ($script:IsWindowsHost) {
        if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending') { $reasons += 'CBS' }
        if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired') { $reasons += 'WindowsUpdate' }
        if (Get-DEReg 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager' 'PendingFileRenameOperations') { $reasons += 'PendingFileRename' }
        $active = Get-DEReg 'HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ActiveComputerName' 'ComputerName'; $pending = Get-DEReg 'HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName' 'ComputerName'
        if ($active -and $pending -and $active -ne $pending) { $reasons += 'ComputerRename' }
        if (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Services\Pending') { $reasons += 'WUServices' }
    }
    return @{ pending = ($reasons.Count -gt 0); reasons = $reasons }
}

# ------------------------------------------------------------------ identity
function ConvertFrom-DEDsregcmd {
    <# Pure parser for `dsregcmd /status` text. Returns a hashtable of the key fields plus a joinType classification. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $kv = @{}
    foreach ($line in ($Text -split "`r?`n")) {
        $m = [regex]::Match($line, '^\s*([A-Za-z][A-Za-z0-9 \-]*?)\s*:\s*(.*?)\s*$')
        if ($m.Success) { $k = $m.Groups[1].Value.Trim(); if (-not $kv.ContainsKey($k)) { $kv[$k] = $m.Groups[2].Value.Trim() } }
    }
    $yes = { param($k) return ("$($kv[$k])" -match '^(YES|TRUE)$') }
    $azureJoined = & $yes 'AzureAdJoined'; $domainJoined = & $yes 'DomainJoined'; $workplace = & $yes 'WorkplaceJoined'; $enterpriseJoined = & $yes 'EnterpriseJoined'
    $joinType = 'unknown'
    # local-workgroup needs dsregcmd to have actually answered the join questions; stray 'key : value' lines
    # (an error banner, a localized message) are not enough and leave the join type unknown
    if ($kv.ContainsKey('AzureAdJoined') -and $kv.ContainsKey('DomainJoined')) {
        if ($azureJoined -and $domainJoined) { $joinType = 'hybrid-entra-joined' }
        elseif ($azureJoined) { $joinType = 'entra-joined' }
        elseif ($domainJoined) { $joinType = 'ad-domain-joined' }
        elseif ($workplace) { $joinType = 'entra-registered' }
        else { $joinType = 'local-workgroup' }
        if ($enterpriseJoined) { $joinType = 'enterprise-joined' }
    }
    return @{
        joinType         = $joinType
        azureAdJoined    = $azureJoined
        domainJoined     = $domainJoined
        workplaceJoined  = $workplace
        enterpriseJoined = $enterpriseJoined
        tenantName       = $kv['TenantName']
        tenantId         = $kv['TenantId']
        deviceId         = $kv['DeviceId']
        domainName       = $kv['DomainName']
        mdmUrl           = $kv['MdmUrl']
        mdmEnrollmentUrl = $kv['MdmEnrollmentUrl']
        azureAdPrt       = (& $yes 'AzureAdPrt')
        ngcSet           = (& $yes 'NgcSet')
        workplaceTenant  = $kv['WorkplaceTenantName']
        deviceAuthStatus = $kv['DeviceAuthStatus']
        keyProvider      = $kv['KeyProvider']
        tpmProtected     = (& $yes 'TpmProtected')
        executingAccountName = $kv['Executing Account Name']
        raw              = $kv
    }
}

function Get-DEIdentityState {
    <# dsregcmd + current principal + local users/admins + profiles + Hello + conflicts. #>
    $text = ''
    if ($script:IsWindowsHost) { $r = Invoke-DEDiscoveryNative -FilePath 'dsregcmd.exe' -Arguments @('/status'); $text = $r.Text }
    $ds = ConvertFrom-DEDsregcmd -Text $text
    $principal = $null; $sid = $null
    try { $id = [Security.Principal.WindowsIdentity]::GetCurrent(); $principal = $id.Name; $sid = $id.User.Value } catch { }
    $interactive = $null
    if ($script:IsWindowsHost) { $cs = Get-DECim Win32_ComputerSystem | Select-Object -First 1; if ($cs) { $interactive = $cs.UserName } }
    $localUsers = @(); $admins = @(); $unresolvedAdmins = @()
    if ($script:IsWindowsHost) {
        try { $localUsers = @(Get-LocalUser -ErrorAction Stop | ForEach-Object { @{ name = $_.Name; enabled = [bool]$_.Enabled; sid = $_.SID.Value; passwordRequired = [bool]$_.PasswordRequired; lastLogon = $(if ($_.LastLogon) { $_.LastLogon.ToString('o') } else { $null }); description = $_.Description } }) } catch { }
        try {
            foreach ($m in @(Get-LocalGroupMember -Group 'Administrators' -ErrorAction Stop)) {
                $entry = @{ name = $m.Name; sid = $m.SID.Value; source = "$($m.PrincipalSource)"; objectClass = $m.ObjectClass }
                if ($m.Name -match '^S-1-\d+' -or -not $m.Name) { $unresolvedAdmins += $entry } else { $admins += $entry }
            }
        } catch {
            # Get-LocalGroupMember fails on some Entra-joined machines with orphaned SIDs; fall back to net localgroup
            $r = Invoke-DEDiscoveryNative -FilePath 'net.exe' -Arguments @('localgroup', 'Administrators')
            $names = @($r.Output | Where-Object { $_ -and $_ -notmatch '^(Alias name|Comment|Members|-+|The command completed)' })
            foreach ($n in $names) { if ($n -match '^S-1-\d+') { $unresolvedAdmins += @{ name = $n; sid = $n; source = 'unresolved' } } else { $admins += @{ name = $n.Trim(); sid = ''; source = 'net localgroup' } } }
        }
    }
    # the owning account (AzureAD\Name, DOMAIN\name, PC\name) lets the console map the end user even from the technician's session
    $profiles = @(Get-DECim Win32_UserProfile -Filter "Special=False" | ForEach-Object { $acct = $null; try { $acct = (New-Object System.Security.Principal.SecurityIdentifier($_.SID)).Translate([System.Security.Principal.NTAccount]).Value } catch { }; @{ path = $_.LocalPath; sid = $_.SID; account = $acct; loaded = [bool]$_.Loaded; lastUse = $(if ($_.LastUseTime) { ([datetime]$_.LastUseTime).ToString('o') } else { $null }) } })
    $hello = @{ ngcSet = $ds.ngcSet; pinConfigured = $false; ngcFolderPresent = $false }
    if ($script:IsWindowsHost) {
        $ngc = Join-Path $env:SystemRoot 'ServiceProfiles\LocalService\AppData\Local\Microsoft\Ngc'
        try { $hello.ngcFolderPresent = (Test-Path -LiteralPath $ngc -ErrorAction Stop) } catch { $hello.ngcFolderPresent = $null }
        $hello.pinConfigured = [bool]$ds.ngcSet
        $hello.passportPolicy = Get-DEReg 'HKLM:\SOFTWARE\Policies\Microsoft\PassportForWork' 'Enabled'
    }
    $conflicts = @()
    if ($ds.azureAdJoined -and $ds.workplaceJoined) { $conflicts += 'device is both Entra joined and workplace registered' }
    if ($ds.domainJoined -and -not $ds.domainName) { $conflicts += 'domain joined without a domain name' }
    if ($unresolvedAdmins.Count) { $conflicts += "$($unresolvedAdmins.Count) unresolved SID(s) in Administrators" }
    if ($interactive -and $interactive -match '^AzureAD\\' -and $ds.joinType -eq 'local-workgroup') { $conflicts += 'AzureAD principal signed in on a workgroup device' }
    return @{
        joinType = $ds.joinType; dsreg = $ds; currentPrincipal = $principal; currentSid = $sid; interactiveUser = $interactive
        localUsers = $localUsers; administrators = $admins; unresolvedAdministratorSids = $unresolvedAdmins; profiles = $profiles; hello = $hello; conflicts = $conflicts
        collectedAt = (Get-Date).ToString('o')
    }
}

function Find-DEProfileForUser {
    <# Locates the profile folder and SID for a user name (e.g. SuzetteThompson or AzureAD\SuzetteThompson). #>
    param([Parameter(Mandatory = $true)][string]$UserName, [array]$Profiles)
    if (-not $Profiles) { $Profiles = (Get-DEIdentityState).profiles }
    $short = ($UserName -split '\\')[-1]
    # the exact folder name wins; 'name.DOMAIN' style folders count only when there is no exact match (callers treat several as ambiguous)
    $exact = @($Profiles | Where-Object { $_ -and (Split-Path -Leaf $_.path) -ieq $short })
    if ($exact.Count) { return $exact }
    return @($Profiles | Where-Object { $_ -and (Split-Path -Leaf $_.path) -like "$short.*" })
}

# ------------------------------------------------------------------ MDM authority
function Get-DEMdmState {
    <# Enrollment GUIDs and providers under HKLM\SOFTWARE\Microsoft\Enrollments; JumpCloud agent; Intune indicators; stale enrollments. #>
    $enrollments = @()
    if ($script:IsWindowsHost) {
        $base = 'HKLM:\SOFTWARE\Microsoft\Enrollments'
        if (Test-Path $base) {
            foreach ($k in @(Get-ChildItem $base -ErrorAction SilentlyContinue)) {
                if ($k.PSChildName -notmatch '^[0-9a-fA-F\-]{36}$') { continue }
                $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
                $provider = $null; $upn = $null; $type = $null; $server = $null
                if ($p) { $provider = $p.ProviderID; $upn = $p.UPN; $type = $p.EnrollmentType; $server = $p.DiscoveryServiceFullURL }
                $hasPolicy = Test-Path ("HKLM:\SOFTWARE\Microsoft\PolicyManager\Providers\{0}" -f $k.PSChildName)
                $hasTask = $false
                try { $hasTask = (Test-Path ("$env:SystemRoot\System32\Tasks\Microsoft\Windows\EnterpriseMgmt\{0}" -f $k.PSChildName)) } catch { }
                $enrollments += @{ id = $k.PSChildName; providerId = $provider; upn = $upn; type = $type; server = $server; policyProviderPresent = $hasPolicy; scheduledTaskPresent = $hasTask; stale = (-not $hasPolicy -and -not $hasTask) }
            }
        }
    }
    $intune = @($enrollments | Where-Object { "$($_.providerId)" -match 'MS DM Server|Intune' -or "$($_.server)" -match 'manage\.microsoft\.com' })
    $jc = Get-DEJumpCloudAgentState
    $authority = 'none'
    if ($jc.installed -and $intune.Count -gt 0) { $authority = 'dual (JumpCloud + Intune)' }
    elseif ($jc.installed) { $authority = 'jumpcloud' }
    elseif ($intune.Count -gt 0) { $authority = 'intune' }
    elseif ($enrollments.Count -gt 0) { $authority = 'other-mdm' }
    return @{ authority = $authority; enrollments = $enrollments; intuneEnrollments = $intune; staleEnrollments = @($enrollments | Where-Object { $_ -and $_.stale }); jumpcloud = $jc; collectedAt = (Get-Date).ToString('o') }
}

# ------------------------------------------------------------------ agents
function Get-DEServiceState { param([string]$Name) try { $s = Get-Service -Name $Name -ErrorAction Stop; return @{ present = $true; status = "$($s.Status)"; startType = "$($s.StartType)" } } catch { return @{ present = $false; status = 'absent'; startType = $null } }
}
function Get-DEJumpCloudAgentState {
    $svc = Get-DEServiceState -Name 'jumpcloud-agent'
    $conf = $null; $systemKey = $null
    if ($script:IsWindowsHost) {
        $confPath = Join-Path $env:ProgramFiles 'JumpCloud\Plugins\Contrib\jcagent.conf'
        if (Test-Path -LiteralPath $confPath) { try { $conf = Get-Content -LiteralPath $confPath -Raw | ConvertFrom-Json; $systemKey = $conf.systemKey } catch { } }
    }
    $version = $null
    if ($script:IsWindowsHost) { $exe = Join-Path $env:ProgramFiles 'JumpCloud\jumpcloud-agent.exe'; if (Test-Path -LiteralPath $exe) { try { $version = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion } catch { } } }
    return @{ installed = ($svc.present -or [bool]$version); service = $svc; version = $version; systemKey = $systemKey; registered = [bool]$systemKey }
}
function Get-DESecurityAgentState {
    <# Presence, service and process state for the DE stack and known competing EDR/AV products. #>
    $agents = [ordered]@{}
    $defs = @(
        @{ id = 'sentinelone'; name = 'SentinelOne'; services = @('SentinelAgent', 'SentinelHelperService', 'SentinelStaticEngine'); processes = @('SentinelAgent', 'SentinelServiceHost'); paths = @("$env:ProgramFiles\SentinelOne") }
        @{ id = 'guardz'; name = 'Guardz Device Agent'; services = @('GuardzAgent', 'Guardz Agent', 'guardz-agent'); processes = @('GuardzAgent', 'guardz-agent'); paths = @("$env:ProgramFiles\Guardz", "${env:ProgramFiles(x86)}\Guardz") }
        @{ id = 'blackpoint'; name = 'Blackpoint SNAP'; services = @('SnapAgent', 'Blackpoint SNAP Agent', 'SnapApp'); processes = @('SnapAgent', 'snapapp'); paths = @("$env:ProgramFiles\Blackpoint", "${env:ProgramFiles(x86)}\Blackpoint") }
        @{ id = 'jumpcloud'; name = 'JumpCloud Agent'; services = @('jumpcloud-agent'); processes = @('jumpcloud-agent'); paths = @("$env:ProgramFiles\JumpCloud") }
        @{ id = 'jumpcloud-protect'; name = 'JumpCloud Remote Assist'; services = @('jumpcloud-remote-assist'); processes = @('jumpcloud-remote-assist'); paths = @("$env:ProgramFiles\JumpCloud Remote Assist") }
        @{ id = 'defender'; name = 'Microsoft Defender Antivirus'; services = @('WinDefend'); processes = @('MsMpEng'); paths = @() }
        @{ id = 'crowdstrike'; name = 'CrowdStrike Falcon'; services = @('CSFalconService'); processes = @('CSFalconService'); paths = @() }
        @{ id = 'sophos'; name = 'Sophos'; services = @('Sophos Endpoint Defense Service', 'Sophos MCS Client'); processes = @('SEDService'); paths = @() }
        @{ id = 'webroot'; name = 'Webroot'; services = @('WRSVC'); processes = @('WRSA'); paths = @() }
        @{ id = 'huntress'; name = 'Huntress'; services = @('HuntressAgent'); processes = @('HuntressAgent'); paths = @() }
        @{ id = 'bitdefender'; name = 'Bitdefender'; services = @('EPSecurityService', 'EPProtectedService'); processes = @('EPSecurityService'); paths = @() }
        @{ id = 'msp360'; name = 'MSP360 Backup / RMM'; services = @('Online Backup Service', 'CloudBerry Backup', 'MSP360 RMM Agent', 'CBRMMAgent'); processes = @('CBBackupPlan', 'CBRMMAgent'); paths = @("$env:ProgramFiles\Online Backup", "$env:ProgramFiles\MSP360") }
        @{ id = 'timus'; name = 'Timus Connect'; services = @('TimusConnect', 'Timus Connect'); processes = @('TimusConnect'); paths = @("$env:ProgramFiles\Timus") }
        @{ id = 'controlone'; name = 'ControlOne'; services = @('ControlOne', 'Cytracom ControlOne'); processes = @('ControlOne'); paths = @("$env:ProgramFiles\Cytracom") }
        @{ id = 'wazuh'; name = 'Wazuh Agent'; services = @('WazuhSvc', 'Wazuh'); processes = @('wazuh-agent'); paths = @("$env:ProgramFiles (x86)\ossec-agent") }
        @{ id = 'qualys'; name = 'Qualys Cloud Agent'; services = @('QualysAgent'); processes = @('QualysAgent'); paths = @() }
    )
    foreach ($d in $defs) {
        $svc = $null
        foreach ($s in $d.services) { $st = Get-DEServiceState -Name $s; if ($st.present) { $svc = @{ name = $s } + $st; break } }
        $proc = $false
        foreach ($p in $d.processes) { if (Get-Process -Name $p -ErrorAction SilentlyContinue) { $proc = $true; break } }
        $pathHit = @($d.paths | Where-Object { $_ -and (Test-Path -LiteralPath $_ -ErrorAction SilentlyContinue) })
        $agents[$d.id] = @{ name = $d.name; installed = ([bool]$svc -or $pathHit.Count -gt 0); service = $svc; running = $proc; paths = $pathHit }
    }
    $edrIds = @('sentinelone', 'crowdstrike', 'sophos', 'webroot', 'huntress', 'bitdefender')
    $edrPresent = @($edrIds | Where-Object { $agents[$_].installed })
    $defenderMode = $null
    if ($script:IsWindowsHost) { try { $mp = Get-MpComputerStatus -ErrorAction Stop; $defenderMode = @{ realTime = [bool]$mp.RealTimeProtectionEnabled; passive = [bool]$mp.AMRunningMode -and "$($mp.AMRunningMode)" -match 'Passive'; runningMode = "$($mp.AMRunningMode)"; signatureAge = $mp.AntivirusSignatureAge } } catch { } }
    return @{ agents = $agents; edrPresent = $edrPresent; conflictingEdr = @($edrPresent | Where-Object { $_ -ne 'sentinelone' }); defender = $defenderMode; collectedAt = (Get-Date).ToString('o') }
}

# ------------------------------------------------------------------ BitLocker
function Get-DEBitLockerState {
    $vols = @()
    if ($script:IsWindowsHost) {
        try {
            foreach ($v in @(Get-BitLockerVolume -ErrorAction Stop)) {
                $prot = @($v.KeyProtector | ForEach-Object { @{ type = "$($_.KeyProtectorType)"; id = "$($_.KeyProtectorId)" } })  # never the RecoveryPassword value
                $vols += @{ mount = $v.MountPoint; volumeType = "$($v.VolumeType)"; status = "$($v.VolumeStatus)"; protection = "$($v.ProtectionStatus)"; encryptionPercentage = $v.EncryptionPercentage; method = "$($v.EncryptionMethod)"; protectors = $prot; hasTpm = [bool]($prot | Where-Object { $_ -and $_.type -match 'Tpm' }); hasRecoveryPassword = [bool]($prot | Where-Object { $_ -and $_.type -eq 'RecoveryPassword' }); recoveryProtectorIds = @($prot | Where-Object { $_ -and $_.type -eq 'RecoveryPassword' } | ForEach-Object { $_.id }) }
            }
        } catch { }
    }
    $osVol = $vols | Where-Object { $_ -and $_.volumeType -eq 'OperatingSystem' } | Select-Object -First 1
    return @{ volumes = $vols; os = $osVol; osEncrypted = [bool]($osVol -and $osVol.status -eq 'FullyEncrypted'); osProtectionOn = [bool]($osVol -and $osVol.protection -eq 'On'); collectedAt = (Get-Date).ToString('o') }
}

# ------------------------------------------------------------------ OneDrive
function Get-DEOneDriveState {
    <# Accounts under HKCU\Software\Microsoft\OneDrive\Accounts, KFM, process, sync-health hints (never treats a running process as health). #>
    $accounts = @(); $running = $false
    if ($script:IsWindowsHost) {
        $running = [bool](Get-Process -Name 'OneDrive' -ErrorAction SilentlyContinue)
        $base = 'HKCU:\Software\Microsoft\OneDrive\Accounts'
        if (Test-Path $base) {
            foreach ($k in @(Get-ChildItem $base -ErrorAction SilentlyContinue)) {
                $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
                if (-not $p) { continue }
                $folder = $p.UserFolder
                $kfm = @{ desktop = [bool]($p.KfmFoldersProtectedNow -band 2); documents = [bool]($p.KfmFoldersProtectedNow -band 1); pictures = [bool]($p.KfmFoldersProtectedNow -band 4) }
                if (-not $p.PSObject.Properties['KfmFoldersProtectedNow']) { $kfm = @{ desktop = $null; documents = $null; pictures = $null } }
                $size = $null; $files = $null
                if ($folder -and (Test-Path -LiteralPath $folder)) { try { $items = @(Get-ChildItem -LiteralPath $folder -Recurse -File -Force -ErrorAction SilentlyContinue | Select-Object -First 5000); $files = $items.Count; $size = [math]::Round((($items | Measure-Object Length -Sum).Sum) / 1MB, 0) } catch { } }
                $accounts += @{ key = $k.PSChildName; type = $(if ($k.PSChildName -eq 'Personal') { 'personal' } else { 'business' }); email = $p.UserEmail; tenant = $p.DisplayName; folder = $folder; configured = [bool]$folder; kfm = $kfm; sampleFiles = $files; sampleSizeMB = $size; lastSignIn = $p.LastSignInTime }
            }
        }
    }
    $shellFolders = @{}
    if ($script:IsWindowsHost) { foreach ($n in @('Desktop', 'Personal', 'My Pictures')) { $shellFolders[$n] = Get-DEReg 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders' $n } }
    $business = @($accounts | Where-Object { $_ -and $_.type -eq 'business' -and $_.configured })
    $classification = 'dormant-or-unconfigured'
    if ($business.Count) {
        $anyKfm = [bool]($business | Where-Object { $_ -and $_.kfm.desktop -or $_.kfm.documents -or $_.kfm.pictures })
        $meaningful = [bool]($business | Where-Object { $_ -and $_.sampleFiles -gt 20 })
        if ($anyKfm) { $classification = 'active-with-kfm' } elseif ($meaningful) { $classification = 'active-without-kfm' } else { $classification = 'configured-little-data' }
    }
    if ($accounts.Count -and -not $running) { $classification = "$classification (client not running)" }
    return @{ running = $running; accounts = $accounts; businessAccounts = $business; shellFolders = $shellFolders; classification = $classification; healthKnown = $false; collectedAt = (Get-Date).ToString('o') }
}

function Get-DEDropboxState {
    $running = $false; $installed = $false; $folder = $null
    if ($script:IsWindowsHost) {
        $running = [bool](Get-Process -Name 'Dropbox' -ErrorAction SilentlyContinue)
        $installed = (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA 'Dropbox\Client\Dropbox.exe')) -or (Test-Path -LiteralPath (Join-Path $env:ProgramFiles 'Dropbox\Client\Dropbox.exe')) -or (Test-Path -LiteralPath (Join-Path ${env:ProgramFiles(x86)} 'Dropbox\Client\Dropbox.exe'))
        $info = Join-Path $env:LOCALAPPDATA 'Dropbox\info.json'
        if (Test-Path -LiteralPath $info) { try { $j = Get-Content -LiteralPath $info -Raw | ConvertFrom-Json; foreach ($p in $j.PSObject.Properties) { $folder = $p.Value.path } } catch { } }
    }
    return @{ installed = $installed; running = $running; folder = $folder }
}

# ------------------------------------------------------------------ updates and apps
function Get-DEWindowsUpdateState {
    $pending = $null; $lastInstall = $null; $lastSearch = $null; $errors = @()
    if ($script:IsWindowsHost) {
        try {
            $session = New-Object -ComObject Microsoft.Update.Session
            $searcher = $session.CreateUpdateSearcher()
            $result = $searcher.Search("IsInstalled=0 and IsHidden=0")
            $pending = @($result.Updates | ForEach-Object { @{ title = $_.Title; severity = "$($_.MsrcSeverity)"; kb = @($_.KBArticleIDs) -join ','; rebootRequired = [bool]$_.RebootRequired } })
        } catch { $errors += "search: $($_.Exception.Message)" }
        try { $au = New-Object -ComObject Microsoft.Update.AutoUpdate; $lastInstall = $au.Results.LastInstallationSuccessDate; $lastSearch = $au.Results.LastSearchSuccessDate } catch { }
    }
    $policy = @{ wuServer = Get-DEReg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' 'WUServer'; noAutoUpdate = Get-DEReg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' 'NoAutoUpdate'; auOptions = Get-DEReg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate\AU' 'AUOptions'; deferQuality = Get-DEReg 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\WindowsUpdate' 'DeferQualityUpdatesPeriodInDays' }
    return @{ pendingCount = $(if ($null -ne $pending) { @($pending).Count } else { $null }); pending = $pending; lastInstall = $(if ($lastInstall) { ([datetime]$lastInstall).ToString('o') } else { $null }); lastSearch = $(if ($lastSearch) { ([datetime]$lastSearch).ToString('o') } else { $null }); policy = $policy; errors = $errors; collectedAt = (Get-Date).ToString('o') }
}

function Get-DEInstalledApps {
    <# Uninstall registry (HKLM 64/32 + HKCU) plus provisioned Appx names. Returns name, version, publisher, source. #>
    $apps = @()
    if ($script:IsWindowsHost) {
        foreach ($root in @('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall', 'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall', 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall')) {
            if (-not (Test-Path $root)) { continue }
            foreach ($k in @(Get-ChildItem $root -ErrorAction SilentlyContinue)) {
                $p = Get-ItemProperty $k.PSPath -ErrorAction SilentlyContinue
                if ($p -and $p.DisplayName -and -not $p.SystemComponent) { $apps += @{ name = $p.DisplayName; version = "$($p.DisplayVersion)"; publisher = "$($p.Publisher)"; source = $(if ($root -like 'HKCU*') { 'user' } elseif ($root -like '*WOW6432Node*') { 'machine-x86' } else { 'machine' }); uninstall = "$($p.UninstallString)"; quietUninstall = "$($p.QuietUninstallString)"; installDate = "$($p.InstallDate)" } }
            }
        }
        try { $apps += @(Get-AppxPackage -ErrorAction Stop | Where-Object { -not $_.IsFramework } | ForEach-Object { @{ name = $_.Name; version = "$($_.Version)"; publisher = "$($_.Publisher)"; source = 'appx'; uninstall = ''; installDate = '' } }) } catch { }
    }
    return @($apps | Sort-Object { $_.name } -Unique)
}
function Find-DEApp { param([Parameter(Mandatory = $true)][string]$NamePattern, [array]$Apps) if (-not $Apps) { $Apps = @(Get-DEInstalledApps) }; return @($Apps | Where-Object { $_ -and $_.name -match $NamePattern }) }

# ------------------------------------------------------------------ network
function Get-DENetworkState {
    $adapters = @(); $dns = @(); $gateway = $null; $wifi = @(); $vpn = @()
    if ($script:IsWindowsHost) {
        try { $adapters = @(Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_ -and $_.NetAdapter.Status -eq 'Up' } | ForEach-Object { @{ alias = $_.InterfaceAlias; ipv4 = @($_.IPv4Address | ForEach-Object { $_.IPAddress }); gateway = @($_.IPv4DefaultGateway | ForEach-Object { $_.NextHop }); dns = @($_.DNSServer | ForEach-Object { $_.ServerAddresses } | ForEach-Object { $_ }) } }) } catch { }
        $gateway = ($adapters | ForEach-Object { $_.gateway } | Where-Object { $_ } | Select-Object -First 1)
        $dns = @($adapters | ForEach-Object { $_.dns } | Where-Object { $_ } | Select-Object -Unique)
        $r = Invoke-DEDiscoveryNative -FilePath 'netsh.exe' -Arguments @('wlan', 'show', 'profiles'); $wifi = @($r.Output | Where-Object { $_ -match 'All User Profile\s*:\s*(.+)$' } | ForEach-Object { $Matches[1].Trim() })
        try { $vpn = @(Get-VpnConnection -AllUserConnection -ErrorAction Stop | ForEach-Object { @{ name = $_.Name; server = $_.ServerAddress; type = "$($_.TunnelType)" } }) } catch { }
    }
    return @{ adapters = $adapters; gateway = $gateway; dns = $dns; wifiProfiles = $wifi; vpnConnections = $vpn; collectedAt = (Get-Date).ToString('o') }
}
function Test-DEConnectivity {
    <# DNS + HTTPS reachability for the endpoints provisioning depends on; returns per-target results. #>
    param([string[]]$Hosts = @('console.jumpcloud.com', 'kickstart.jumpcloud.com', 'app.us.guardz.com', 'login.microsoftonline.com', 'graph.microsoft.com', 'techsales.digerati-experts.com', 'www.msftconnecttest.com'))
    $results = @()
    foreach ($h in $Hosts) {
        $dnsOk = $false; $httpsOk = $false; $ms = $null; $detail = ''
        try { $null = [System.Net.Dns]::GetHostAddresses($h); $dnsOk = $true } catch { $detail = 'dns failed' }
        if ($dnsOk) {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            try { $client = New-Object System.Net.Sockets.TcpClient; $ar = $client.BeginConnect($h, 443, $null, $null); if ($ar.AsyncWaitHandle.WaitOne(4000)) { $client.EndConnect($ar); $httpsOk = $true } else { $detail = 'tcp 443 timeout' }; $client.Close() } catch { $detail = "tcp 443: $($_.Exception.Message)" }
            $sw.Stop(); $ms = $sw.ElapsedMilliseconds
        }
        $results += @{ host = $h; dns = $dnsOk; https = $httpsOk; ms = $ms; detail = $detail }
    }
    return @{ targets = $results; allOk = -not [bool]($results | Where-Object { -not $_.https }); collectedAt = (Get-Date).ToString('o') }
}

# ------------------------------------------------------------------ browsers
function Get-DEBrowserState {
    $chrome = $null; $edge = $null
    if ($script:IsWindowsHost) {
        foreach ($p in @("$env:ProgramFiles\Google\Chrome\Application\chrome.exe", "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe")) { if (Test-Path -LiteralPath $p) { $chrome = @{ path = $p; version = (Get-Item -LiteralPath $p).VersionInfo.ProductVersion }; break } }
        foreach ($p in @("$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe", "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe")) { if (Test-Path -LiteralPath $p) { $edge = @{ path = $p; version = (Get-Item -LiteralPath $p).VersionInfo.ProductVersion }; break } }
    }
    $default = Get-DEReg 'HKCU:\Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice' 'ProgId'
    $policies = @{}
    foreach ($b in @(@{ id = 'chrome'; key = 'HKLM:\SOFTWARE\Policies\Google\Chrome' }, @{ id = 'edge'; key = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' })) {
        $vals = @{}
        if ($script:IsWindowsHost -and (Test-Path $b.key)) {
            $p = Get-ItemProperty $b.key -ErrorAction SilentlyContinue
            foreach ($prop in $p.PSObject.Properties) { if ($prop.Name -notmatch '^PS') { $vals[$prop.Name] = $prop.Value } }
            foreach ($sub in @('ExtensionInstallForcelist', 'ExtensionInstallBlocklist', 'ExtensionInstallAllowlist', 'ManagedBookmarks', 'URLBlocklist', 'URLAllowlist')) {
                $sk = Join-Path $b.key $sub
                if (Test-Path $sk) { $sp = Get-ItemProperty $sk -ErrorAction SilentlyContinue; $vals[$sub] = @($sp.PSObject.Properties | Where-Object { $_ -and $_.Name -notmatch '^PS' } | ForEach-Object { $_.Value }) }
            }
        }
        $policies[$b.id] = $vals
    }
    return @{ chrome = $chrome; edge = $edge; defaultHttpsProgId = $default; defaultBrowser = $(if ("$default" -match 'Chrome') { 'chrome' } elseif ("$default" -match 'Edge') { 'edge' } elseif ($default) { "$default" } else { 'unknown' }); policies = $policies; collectedAt = (Get-Date).ToString('o') }
}

# ------------------------------------------------------------------ full snapshot
function Get-DEDiscoverySnapshot {
    <# Everything above in one object; the workflow, gates and evidence use this. Slow parts (apps, updates) can be skipped. #>
    param([switch]$SkipApps, [switch]$SkipUpdates, [switch]$SkipConnectivity)
    $snap = [ordered]@{
        device = Get-DEDeviceInventory
        pendingReboot = Get-DEPendingReboot
        identity = Get-DEIdentityState
        mdm = Get-DEMdmState
        agents = Get-DESecurityAgentState
        bitlocker = Get-DEBitLockerState
        onedrive = Get-DEOneDriveState
        dropbox = Get-DEDropboxState
        browsers = Get-DEBrowserState
        network = Get-DENetworkState
    }
    if (-not $SkipUpdates) { $snap.updates = Get-DEWindowsUpdateState }
    if (-not $SkipApps) { $snap.apps = Get-DEInstalledApps }
    if (-not $SkipConnectivity) { $snap.connectivity = Test-DEConnectivity }
    $snap.collectedAt = (Get-Date).ToString('o')
    return $snap
}

Export-ModuleMember -Function Get-DEDeviceInventory, Get-DEPendingReboot, ConvertFrom-DEDsregcmd, Get-DEIdentityState, Find-DEProfileForUser, Get-DEMdmState, Get-DEJumpCloudAgentState, Get-DESecurityAgentState, Get-DEServiceState, Get-DEBitLockerState, Get-DEOneDriveState, Get-DEDropboxState, Get-DEWindowsUpdateState, Get-DEInstalledApps, Find-DEApp, Get-DENetworkState, Test-DEConnectivity, Get-DEBrowserState, Get-DEDiscoverySnapshot
