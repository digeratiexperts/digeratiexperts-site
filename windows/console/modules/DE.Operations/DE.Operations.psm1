#Requires -Version 5.1
<#
.SYNOPSIS
    Windows / OEM maintenance, network and site configuration, backup, RMM,
    remote support, email security and MFA/authentication checkpoints.

.DESCRIPTION
    Windows Update through the Windows Update Agent COM API, Dell Command |
    Update (or the OEM tool present) for BIOS / drivers / dock firmware with
    BitLocker suspension around firmware, Wi-Fi profile deployment, printers,
    shares, certificates, connectivity and SASE client checks, backup / RMM /
    remote agent verification. MFA and TAP steps record completion only; the
    console never holds an end user's credentials.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')

function Get-DEOpsProp { param($Object, [string]$Name) if ($null -eq $Object) { return $null }; if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] }; return $null }; $p = $Object.PSObject.Properties[$Name]; if ($p) { return $p.Value }; return $null }

# ------------------------------------------------------------------ Windows Update
function Install-DEWindowsUpdates {
    <# Searches, downloads and installs software updates (no drivers, no preview). Returns counts and whether a restart is required. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([switch]$IncludeDrivers)
    $session = New-Object -ComObject Microsoft.Update.Session
    $searcher = $session.CreateUpdateSearcher()
    $criteria = "IsInstalled=0 and IsHidden=0 and Type='Software'"; if ($IncludeDrivers) { $criteria = 'IsInstalled=0 and IsHidden=0' }
    $result = $searcher.Search($criteria)
    $list = New-Object -ComObject Microsoft.Update.UpdateColl
    foreach ($u in $result.Updates) { if ($u.Title -match 'Preview') { continue }; [void]$list.Add($u) }
    if ($list.Count -eq 0) { return @{ found = 0; installed = 0; rebootRequired = $false } }
    if (-not $PSCmdlet.ShouldProcess("$($list.Count) update(s)", 'download and install')) { return @{ found = $list.Count; installed = 0; planned = $true } }
    foreach ($u in $list) { if (-not $u.EulaAccepted) { $u.AcceptEula() } }   # only on a real run
    $dl = $session.CreateUpdateDownloader(); $dl.Updates = $list; $null = $dl.Download()
    $inst = $session.CreateUpdateInstaller(); $inst.Updates = $list; $r = $inst.Install()
    $ok = 0; for ($i = 0; $i -lt $list.Count; $i++) { if ($r.GetUpdateResult($i).ResultCode -eq 2) { $ok++ } }
    if ($r.RebootRequired) { Request-DEReboot -Reason 'Windows updates installed' -ResumeAction 'maint.windows-update' | Out-Null }
    return @{ found = $list.Count; installed = $ok; rebootRequired = [bool]$r.RebootRequired; resultCode = $r.ResultCode }
}

# ------------------------------------------------------------------ OEM
function Get-DEOemTool {
    $mfr = "$((Get-DEDeviceInventory).manufacturer)"
    $dcu = @("$env:ProgramFiles\Dell\CommandUpdate\dcu-cli.exe", "${env:ProgramFiles(x86)}\Dell\CommandUpdate\dcu-cli.exe") | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    $hpia = @("$env:ProgramFiles\HP\HPIA\HPImageAssistant.exe", "${env:ProgramFiles(x86)}\HP\HPIA\HPImageAssistant.exe") | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    $lsu = @("${env:ProgramFiles(x86)}\Lenovo\System Update\tvsu.exe") | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    return @{ manufacturer = $mfr; dell = $dcu; hp = $hpia; lenovo = $lsu; applicable = $(if ($mfr -match 'Dell') { 'dell' } elseif ($mfr -match 'HP|Hewlett') { 'hp' } elseif ($mfr -match 'Lenovo') { 'lenovo' } else { 'none' }) }
}
function Invoke-DEOemScan {
    <# What the OEM tool says this machine needs. current: $true up to date, $false updates waiting, $null could not tell. #>
    $t = Get-DEOemTool
    if ($t.applicable -eq 'dell' -and $t.dell) { $r = Invoke-DENative -FilePath $t.dell -Arguments @('/scan', '-silent'); return @{ tool = 'dcu'; exitCode = $r.ExitCode; current = ($r.ExitCode -eq 500); updatesAvailable = ($r.ExitCode -eq 0 -and $r.Text -match 'available'); output = ($r.Output | Select-Object -Last 15) } }
    if ($t.applicable -eq 'lenovo') {
        # LSUClient (MIT, pinned in catalog\community.json) reads Lenovo's own update catalog; Lenovo System Update is not needed.
        try { $u = @(Get-DELenovoUpdates) } catch { return @{ tool = 'lsuclient'; exitCode = $null; current = $null; updatesAvailable = $null; output = @("Lenovo update check failed: $($_.Exception.Message)") } }
        return @{ tool = 'lsuclient'; exitCode = 0; current = ($u.Count -eq 0); updatesAvailable = ($u.Count -gt 0); count = $u.Count; firmware = @($u | Where-Object { $_.firmware }).Count; output = @($u | ForEach-Object { "$($_.type): $($_.title)$(if (-not $_.unattended) { ' (needs a technician)' })" }) }
    }
    if ($t.applicable -eq 'hp' -and $t.hp) {
        # HP Image Assistant exit codes (HP's HPIA user guide): 0 done / recommendations found, 256 no recommendations, 3010 restart needed, 3020 an install failed, 4096 platform not supported.
        $report = Join-Path (Get-DEConsole).Dirs.Logs 'hpia-analyze'
        $r = Invoke-DENative -FilePath $t.hp -Arguments @('/Operation:Analyze', '/Action:List', '/Category:All', '/Selection:All', '/Silent', "/ReportFolder:$report")
        return @{ tool = 'hpia'; exitCode = $r.ExitCode; current = $(if ($r.ExitCode -eq 256) { $true } elseif ($r.ExitCode -eq 0) { $false } else { $null }); updatesAvailable = ($r.ExitCode -eq 0); output = @("HPIA analyze exit $($r.ExitCode)") }
    }
    if ($t.applicable -eq 'dell') { return @{ tool = 'dcu'; exitCode = $null; current = $false; updatesAvailable = $null; output = @('Dell Command | Update is not installed') } }
    return @{ tool = $t.applicable; exitCode = $null; current = $null; updatesAvailable = $null; output = @('no supported OEM tool installed') }
}
function Invoke-DEOemUpdate {
    <#
        Applies OEM updates (Dell Command | Update, Lenovo through LSUClient, HP Image Assistant). Suspends BitLocker for one
        restart when BIOS/firmware is included, then records that protection must be verified On after the restart.
        Any package that fails throws after the restart request is recorded: a partial update is never reported as done.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([switch]$IncludeBios)
    $t = Get-DEOemTool
    $suspend = { if ((Get-DEBitLockerState).osProtectionOn) { Suspend-DEBitLockerForFirmware -RebootCount 1; Set-DEStateValue -Path 'maintenance.bitlockerResumeRequired' -Value $true } }
    switch ($t.applicable) {
        'lenovo' {
            $all = @(Get-DELenovoUpdates)
            $pick = @($all | Where-Object { $_.unattended -and ($IncludeBios -or -not $_.firmware) })
            $manual = @($all | Where-Object { -not $_.unattended } | ForEach-Object { $_.title })
            if (-not $pick.Count) { return "Lenovo: nothing to install silently$(if ($manual.Count) { "; install by hand: $($manual -join '; ')" })" }
            if (-not $PSCmdlet.ShouldProcess('Lenovo (LSUClient)', "install $($pick.Count) package(s): $((@($pick | ForEach-Object { $_.title })) -join '; ')")) { return 'planned' }
            if (@($pick | Where-Object { $_.firmware }).Count) { & $suspend }
            $r = Install-DELenovoUpdates -Updates $pick
            if ($r.pending.Count) { Request-DEReboot -Reason $(if ($r.shutdown) { 'Lenovo BIOS update finishes on a full shutdown, then power on' } else { 'Lenovo updates require a restart' }) -ResumeAction 'maint.oem' | Out-Null }
            if ($r.failed.Count) { throw "Lenovo: $($r.failed.Count) package(s) failed: $($r.failed -join '; ')" }
            return "Lenovo: installed $($r.installed.Count)$(if ($r.pending.Count) { "; pending $($r.pending -join ', ')" })$(if ($manual.Count) { "; install by hand: $($manual -join '; ')" })"
        }
        'hp' {
            if (-not $t.hp) { throw 'HP Image Assistant is not installed: install HPIA from hp.com/go/hpia, then run this again' }
            $cats = $(if ($IncludeBios) { 'All' } else { 'Drivers,Software,Accessories' })
            if (-not $PSCmdlet.ShouldProcess('HP Image Assistant', "install ($cats)")) { return 'planned' }
            if ($IncludeBios) { & $suspend }
            $base = Join-Path (Get-DEConsole).Dirs.Packages 'hpia'
            $r = Invoke-DENative -FilePath $t.hp -Arguments @('/Operation:Analyze', '/Action:Install', "/Category:$cats", '/Selection:All', '/Silent', "/ReportFolder:$base\report", "/SoftpaqDownloadFolder:$base\softpaqs")
            if ($r.ExitCode -eq 3010) { Request-DEReboot -Reason 'HP updates require a restart' -ResumeAction 'maint.oem' | Out-Null }
            if ($r.ExitCode -notin @(0, 256, 3010)) { throw "HP Image Assistant exit $($r.ExitCode) (3020 = an install failed, 4096 = platform not supported); report in $base\report" }
            return "HP Image Assistant exit $($r.ExitCode)"
        }
        'dell' {
            if (-not $t.dell) { throw 'Dell Command | Update is not installed' }
            $types = 'driver,application,utility'; if ($IncludeBios) { $types = 'bios,firmware,driver,application,utility' }
            if (-not $PSCmdlet.ShouldProcess('Dell Command | Update', "applyUpdates ($types)")) { return 'planned' }
            if ($IncludeBios) { & $suspend }
            $r = Invoke-DENative -FilePath $t.dell -Arguments @('/applyUpdates', "-updateType=$types", '-reboot=disable', '-silent')
            # DCU exit codes: 0 ok, 1 reboot required, 5 reboot pending, 500 no updates
            if ($r.ExitCode -in @(1, 5)) { Request-DEReboot -Reason 'OEM updates require a restart' -ResumeAction 'maint.oem' | Out-Null }
            if ($r.ExitCode -notin @(0, 1, 5, 500)) { throw "dcu-cli exit $($r.ExitCode)" }
            return "dcu-cli exit $($r.ExitCode)"
        }
        default { throw "no automated OEM update path for $($t.manufacturer); use the vendor tool manually" }
    }
}

function Get-DEBatteryHealth {
    if (-not $script:IsWindowsHost) { return $null }
    $full = Get-CimInstance -Namespace root/wmi -ClassName BatteryFullChargedCapacity -ErrorAction SilentlyContinue | Select-Object -First 1
    $design = Get-CimInstance -Namespace root/wmi -ClassName BatteryStaticData -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $full -or -not $design -or -not $design.DesignedCapacity) { return @{ present = $false } }
    return @{ present = $true; healthPercent = [math]::Round(100 * $full.FullChargedCapacity / $design.DesignedCapacity, 0) }
}

# ------------------------------------------------------------------ network / site
function Add-DEWifiProfile {
    <# Wi-Fi profile from the client site record; the PSK is a runtime secret named WIFI_<SITE>_PSK and is written only into the WLAN profile store. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Ssid, [ValidateSet('WPA2PSK', 'WPA3SAE', 'WPA2')][string]$Auth = 'WPA2PSK', [string]$SecretName)
    $key = ''; if ($SecretName) { $key = Get-DESecretPlain -Name $SecretName }
    $keyXml = ''; if ($key) { $keyXml = "<sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>$([Security.SecurityElement]::Escape($key))</keyMaterial></sharedKey>" }
    $xml = "<?xml version=`"1.0`"?><WLANProfile xmlns=`"http://www.microsoft.com/networking/WLAN/profile/v1`"><name>$([Security.SecurityElement]::Escape($Ssid))</name><SSIDConfig><SSID><name>$([Security.SecurityElement]::Escape($Ssid))</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode><MSM><security><authEncryption><authentication>$Auth</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption>$keyXml</security></MSM></WLANProfile>"
    $tmp = Join-Path $env:TEMP ("de-wlan-{0}.xml" -f ([guid]::NewGuid()))
    if (-not $PSCmdlet.ShouldProcess($Ssid, 'add Wi-Fi profile (all users)')) { return 'planned' }
    try { Set-Content -LiteralPath $tmp -Value $xml -Encoding UTF8; $r = Invoke-DENative -FilePath 'netsh.exe' -Arguments @('wlan', 'add', 'profile', "filename=$tmp", 'user=all'); if ($r.ExitCode -ne 0) { throw $r.Text }; return "Wi-Fi profile $Ssid added" }
    finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }; $key = $null; $xml = $null }
}
function Add-DEPrinter { [CmdletBinding(SupportsShouldProcess = $true)] param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][string]$Address, [string]$Driver = 'Microsoft IPP Class Driver') if (-not $PSCmdlet.ShouldProcess($Name, "add printer at $Address")) { return 'planned' }; $port = "IP_$Address"; if (-not (Get-PrinterPort -Name $port -ErrorAction SilentlyContinue)) { Add-PrinterPort -Name $port -PrinterHostAddress $Address }; if (-not (Get-Printer -Name $Name -ErrorAction SilentlyContinue)) { Add-Printer -Name $Name -DriverName $Driver -PortName $port }; return "printer $Name on $Address" }
function Import-DECertificate { [CmdletBinding(SupportsShouldProcess = $true)] param([Parameter(Mandatory = $true)][string]$Path, [ValidateSet('Root', 'CA', 'My', 'TrustedPublisher')][string]$Store = 'Root', [string]$ExpectedThumbprint) if ($Store -in @('Root', 'CA', 'TrustedPublisher') -and -not $ExpectedThumbprint) { throw "adding to LocalMachine\$Store needs -ExpectedThumbprint (checked against the client's record)" }; $all = New-Object System.Security.Cryptography.X509Certificates.X509Certificate2Collection; $all.Import($Path); if ($all.Count -ne 1) { throw "$Path holds $($all.Count) certificates; import exactly one, checked by thumbprint" }; $c = $all[0]; if ($ExpectedThumbprint -and $c.Thumbprint -ne $ExpectedThumbprint.ToUpperInvariant()) { throw "certificate thumbprint $($c.Thumbprint) does not match the expected $ExpectedThumbprint" }; if (-not $PSCmdlet.ShouldProcess($c.Subject, "import into LocalMachine\$Store")) { return 'planned' }; Import-Certificate -FilePath $Path -CertStoreLocation "Cert:\LocalMachine\$Store" | Out-Null; return "imported $($c.Subject) ($($c.Thumbprint))" }
function Test-DESiteResources {
    param($ClientProfile, [string]$SiteId)
    $net = Get-DENetworkState
    $shares = @(Get-DEHashPath -Object $ClientProfile -Path 'network.shares' | Where-Object { $null -ne $_ }); $printers = @(Get-DEHashPath -Object $ClientProfile -Path 'network.printers' | Where-Object { $null -ne $_ }); $wifi = @(Get-DEHashPath -Object $ClientProfile -Path 'network.wifiProfiles' | Where-Object { $null -ne $_ })
    $shareResults = @($shares | Where-Object { $_ } | ForEach-Object { $p = "$(Get-DEOpsProp $_ 'path')"; @{ path = $p; reachable = $(if ($p) { Test-Path -LiteralPath $p -ErrorAction SilentlyContinue } else { $false }) } })
    $printerResults = @($printers | Where-Object { $_ } | ForEach-Object { $n = "$(Get-DEOpsProp $_ 'name')"; @{ name = $n; installed = [bool](Get-Printer -Name $n -ErrorAction SilentlyContinue) } })
    $wifiResults = @($wifi | Where-Object { $_ } | ForEach-Object { $s = "$(Get-DEOpsProp $_ 'ssid')"; @{ ssid = $s; present = ($net.wifiProfiles -contains $s) } })
    return @{ gateway = $net.gateway; dns = $net.dns; shares = $shareResults; printers = $printerResults; wifi = $wifiResults; connectivity = (Test-DEConnectivity) }
}

# ------------------------------------------------------------------ actions
function Register-DEOperationsActions {
    param($ClientProfile)
    Register-DEAction -Id 'maint.pending-reboot' -Module 'maintenance' -Title 'No pending restart before provisioning' -Phase 2 `
        -Detect { $p = Get-DEPendingReboot; @{ pending = $p.pending; reasons = ($p.reasons -join ', ') } } -Desired { @{ pending = $false } } `
        -ManualAction 'Restart before identity or security changes; the console resumes where it left off.'
    Register-DEAction -Id 'maint.hardware' -Module 'maintenance' -Title 'Hardware readiness (TPM 2.0, Secure Boot, disk space, RAM)' -Phase 2 `
        -Detect { $d = Get-DEDeviceInventory; $free = @($d.disks | Where-Object { $_ -and $_.drive -eq 'C:' } | ForEach-Object { $_.freeGB }) | Select-Object -First 1; @{ tpm2 = ("$($d.tpmVersion)" -match '^2'); secureBoot = [bool]$d.secureBoot; diskOk = ([int]"0$free" -ge 20); ramOk = ([double]"0$($d.ramGB)" -ge 8); freeGB = $free } } `
        -Desired { @{ tpm2 = $true; secureBoot = $true; diskOk = $true } } `
        -ManualAction 'Enable TPM and Secure Boot in firmware setup; free disk space before updates.'
    Register-DEAction -Id 'maint.windows-update' -Module 'maintenance' -Title 'Windows updates installed' -Phase 3 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $w = Get-DEWindowsUpdateState; @{ pending = $(if ($null -eq $w.pendingCount) { -1 } else { $w.pendingCount }); lastInstall = $w.lastInstall } } `
        -Desired { @{ pending = 0 } } -Apply { param($s) $r = Install-DEWindowsUpdates; "found $($r.found), installed $($r.installed), restart $($r.rebootRequired)" } `
        -ManualAction 'Large feature updates are left to the client''s update authority (JumpCloud patch policy by default).'
    # Who keeps updates flowing after handoff: JumpCloud patch management by default; Intune for Microsoft-only clients;
    # 'windows' when DE Tech Tool itself sets the automatic-update policy (the wu-auto baseline control). Always checked.
    $updAuthority = "$(Get-DEHashPath -Object $ClientProfile -Path 'updates.authority')"; if (-not $updAuthority) { $updAuthority = 'jumpcloud' }
    Register-DEAction -Id 'maint.update-authority' -Module 'maintenance' -Title "Update authority in place ($updAuthority)" -Phase 3 `
        -Detect {
            switch ($updAuthority) {
                'jumpcloud' {
                    $agent = (Get-DEJumpCloudAgentState).installed
                    $policy = $null
                    if (Test-DESecret -Name 'JC_API_KEY') { try { $p = Get-DEJumpCloudPolicySummary; $names = @($p.policies | ForEach-Object { "$($_.policy)" } | Where-Object { $_ -match '(?i)patch|update' }); $policy = ($names.Count -gt 0 -and -not @($p.failed | Where-Object { "$_" -match '(?i)patch|update' }).Count) } catch { $policy = $null } }
                    @{ authority = 'jumpcloud'; ready = $(if (-not $agent) { $false } elseif ($null -eq $policy) { $null } else { $policy }); detail = $(if (-not $agent) { 'JumpCloud agent not installed' } elseif ($null -eq $policy) { 'patch policy not checked (enter JC_API_KEY)' } elseif ($policy) { 'JumpCloud patch policy applied' } else { 'no successful JumpCloud patch/update policy on this system' }) }
                }
                'intune' { $m = Get-DEMdmState; @{ authority = 'intune'; ready = ("$($m.authority)" -match 'intune'); detail = "MDM authority: $($m.authority)" } }
                'windows' { $c = @(Get-DEBaselineControls | Where-Object { $_.id -eq 'wu-auto' }) | Select-Object -First 1; $st = $(if ($c) { Get-DEBaselineControlState -Control $c } else { $null }); @{ authority = 'windows'; ready = [bool]($st -and $st.ok); detail = $(if ($st) { $st.detail } else { 'wu-auto control missing from the baseline catalog' }) } }
                default { @{ authority = $updAuthority; ready = $false; detail = "unknown updates.authority '$updAuthority' (use jumpcloud, intune or windows)" } }
            }
        }.GetNewClosure() -Desired { @{ ready = $true } } `
        -ManualAction $(switch ($updAuthority) { 'jumpcloud' { 'Assign the client''s Windows patch policy to this system in JumpCloud (Policies > Patch Management).' } 'intune' { 'Assign the Windows Update ring / feature update policy to this device in Intune.' } 'windows' { 'Apply the DE Windows baseline (wu-auto control) from the Baseline page.' } default { 'Set updates.authority in the client profile.' } })
    Register-DEAction -Id 'maint.oem' -Module 'maintenance' -Title 'OEM drivers, firmware and dock updates' -Phase 3 -Gates @('gate.elevated') -RequiresElevation `
        -Detect {
            $t = Get-DEOemTool
            $auto = ($t.applicable -in @('dell', 'lenovo')) -or ($t.applicable -eq 'hp' -and $t.hp)
            if (-not $auto) { @{ applicable = $false; current = $(if (Get-DEState -Path 'maintenance.oemConfirmedAt') { $true } else { $null }); vendor = "$($t.manufacturer)" } }
            else { $s = Invoke-DEOemScan; @{ applicable = $true; vendor = "$($t.manufacturer)"; tool = $s.tool; current = $s.current; waiting = $(if ($s.ContainsKey('count')) { $s.count } else { $null }); detail = (@($s.output) | Select-Object -First 6) -join ' | ' } }
        } `
        -Desired { @{ current = $true } } -Apply { param($s) if (-not $s.Detected.applicable) { throw "no automated OEM update for $($s.Detected.vendor): run the vendor tool, then confirm it on the Network page" }; Invoke-DEOemUpdate -IncludeBios } `
        -Remediate { param($s) if ((Get-DEOemTool).applicable -eq 'dell') { $null = Invoke-DEPackageInstall -Id 'dell-command-update' } } `
        -ManualAction 'Dell: Dell Command | Update. Lenovo: LSUClient (pinned, needs internet). HP: install HP Image Assistant first. Other makers: run the vendor tool; after BIOS updates confirm BitLocker protection is back On.'
    Register-DEAction -Id 'maint.bitlocker-resume' -Module 'maintenance' -Title 'BitLocker protection resumed after firmware work' -Phase 3 -Gates @('gate.elevated') `
        -Detect { @{ protectionOn = (Get-DEBitLockerState).osProtectionOn; required = [bool](Get-DEState -Path 'maintenance.bitlockerResumeRequired') } } -Desired { @{ protectionOn = $true } } `
        -Compare { param($d, $w) if ($d.required -and -not $d.protectionOn) { @('protection still suspended') } else { @() } } `
        -Apply { param($s) if (Resume-DEBitLocker) { Set-DEStateValue -Path 'maintenance.bitlockerResumeRequired' -Value $false; 'resumed' } else { throw 'protection did not resume' } }
    Register-DEAction -Id 'net.connectivity' -Module 'network' -Title 'Connectivity, DNS and cloud endpoints' -Phase 2 `
        -Detect { $c = Test-DEConnectivity; @{ allOk = $c.allOk; failing = (($c.targets | Where-Object { $_ -and -not $_.https } | ForEach-Object { $_.host }) -join ', ') } } -Desired { @{ allOk = $true } } `
        -ManualAction 'Check DNS, proxy and firewall egress on 443; SASE clients can block enrolment endpoints until the device is authorised.'
    Register-DEAction -Id 'net.site' -Module 'network' -Title 'Site resources (Wi-Fi, printers, shares)' -Phase 14 `
        -Detect { $r = Test-DESiteResources -ClientProfile $ClientProfile; @{ wifiMissing = @($r.wifi | Where-Object { $_ -and -not $_.present }).Count; printersMissing = @($r.printers | Where-Object { $_ -and -not $_.installed }).Count; sharesUnreachable = @($r.shares | Where-Object { $_ -and -not $_.reachable }).Count } }.GetNewClosure() `
        -Desired { @{ wifiMissing = 0; printersMissing = 0; sharesUnreachable = 0 } } `
        -ManualAction 'Add Wi-Fi profiles (PSK entered at run time), printers and certificates from the Network page.'
    $sase = Get-DEHashPath -Object $ClientProfile -Path 'network.sase'
    if ($sase -and (Get-DEOpsProp $sase 'required')) {
        Register-DEAction -Id 'net.sase' -Module 'network' -Title "SASE client ($((Get-DEOpsProp $sase 'provider')))" -Phase 14 -Gates @('gate.elevated') -RequiresElevation `
                -Detect { $a = Get-DESecurityAgentState; $p = "$(Get-DEHashPath -Object $ClientProfile -Path 'network.sase.provider')"; @{ installed = [bool]$a.agents[$(if ($p -eq 'controlone') { 'controlone' } else { 'timus' })].installed; provider = $p } }.GetNewClosure() -Desired { @{ installed = $true } } `
            -Apply { param($s) if ("$($s.Detected.provider)" -eq 'controlone') { throw 'ControlOne is deployed from its own console; DE Tech Tool has no ControlOne package to install' }; $r = Invoke-DEPackageInstall -Id 'timus-connect' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }; $r.detail }.GetNewClosure()
    }
    if (Get-DEHashPath -Object $ClientProfile -Path 'backup.required') {
        Register-DEAction -Id 'ops.backup' -Module 'operations' -Title 'Backup agent installed and healthy' -Phase 14 -Gates @('gate.elevated') -RequiresElevation `
            -Detect { $a = Get-DESecurityAgentState; @{ installed = $a.agents['msp360'].installed; running = [bool]$a.agents['msp360'].running; firstBackupConfirmed = [bool](Get-DEState -Path 'operations.backup.firstBackupConfirmedAt') } } `
            -Desired { @{ installed = $true; firstBackupConfirmed = $true } } `
            -Apply { param($s) if (-not $s.Detected.installed) { $r = Invoke-DEPackageInstall -Id 'msp360-backup' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail } }; 'agent installed; confirm the first successful backup in console.msp360.com, then press Confirm first backup' }.GetNewClosure() `
            -Verify { param($after) @{ ok = [bool](Get-DEState -Path 'operations.backup.firstBackupConfirmedAt'); detail = 'installation alone is not protection; first backup must be confirmed' } } `
            -ManualAction 'Assign the backup plan in MSP360 for this client, wait for the first successful run, then confirm it in the console.'
    }
    Register-DEAction -Id 'ops.remote-support' -Module 'operations' -Title 'Remote support agent linked to the client' -Phase 14 `
        -Detect { $ra = Get-DEServiceState -Name 'jumpcloud-remote-assist'; @{ installed = $ra.present; tested = [bool](Get-DEState -Path 'operations.remoteSupport.testedAt') } } -Desired { @{ installed = $true; tested = $true } } `
        -ManualAction 'Start a Remote Assist session from the JumpCloud console to this device and confirm it connects; record the test in the console.'
    Register-DEAction -Id 'ops.email-security' -Module 'operations' -Title 'Email security in place for the user' -Phase 14 `
        -Detect { @{ confirmed = [bool](Get-DEState -Path 'operations.emailSecurity.confirmedAt') } } -Desired { @{ confirmed = $true } } `
        -ManualAction 'Confirm the mailbox is protected in the email-security console (Mimecast for DE clients) and any Outlook add-in is deployed.'
    Register-DEAction -Id 'ops.mfa' -Module 'operations' -Title 'MFA registered (JumpCloud Protect and Microsoft Authenticator as required)' -Phase 10 `
        -Detect { @{ jumpcloudProtect = [bool](Get-DEState -Path 'operations.mfa.jumpcloudProtectAt'); microsoft = [bool](Get-DEState -Path 'operations.mfa.microsoftAt') } } -Desired { @{ jumpcloudProtect = $true; microsoft = $true } } `
        -ManualAction 'Walk the user through JumpCloud Protect enrolment and https://aka.ms/mfasetup (issue a Temporary Access Pass from Entra if needed; never write it down in the ticket). Record completion in the console.'
}

function Confirm-DEOperationalCheck {
    <# Records a technician-confirmed check (first backup, remote-assist test, MFA done). Stores a timestamp and who, never a secret. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][ValidateSet('maintenance.oemConfirmedAt', 'operations.backup.firstBackupConfirmedAt', 'operations.remoteSupport.testedAt', 'operations.emailSecurity.confirmedAt', 'operations.mfa.jumpcloudProtectAt', 'operations.mfa.microsoftAt')][string]$Check, [string]$Note = '')
    if ($PSCmdlet.ShouldProcess($Check, 'record confirmation')) { Set-DEStateValue -Path $Check -Value (Get-Date).ToString('o'); Add-DEEvidence -Step "confirm.$Check" -Module 'operations' -Before 'unconfirmed' -ActionTaken 'technician confirmed' -Result 'PASS' -Verification $Note | Out-Null }
}

Export-ModuleMember -Function Install-DEWindowsUpdates, Get-DEOemTool, Invoke-DEOemScan, Invoke-DEOemUpdate, Get-DEBatteryHealth, Add-DEWifiProfile, Add-DEPrinter, Import-DECertificate, Test-DESiteResources, Register-DEOperationsActions, Confirm-DEOperationalCheck
