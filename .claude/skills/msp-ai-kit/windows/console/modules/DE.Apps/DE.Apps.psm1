#Requires -Version 5.1
<#
.SYNOPSIS
    Application deployment engine: approved package catalog, trust checks
    (sha256 / Authenticode / winget), silent install / upgrade / repair /
    uninstall with runtime-only secrets, per-client manifests, Microsoft 365
    readiness and the OneDrive / Dropbox client standard.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Windows PowerShell 5.1 downloads run many times slower with the progress bar
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')

function Get-DEPkgProp { param($Object, [string]$Name) if ($null -eq $Object) { return $null }; if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] }; return $null }; $p = $Object.PSObject.Properties[$Name]; if ($p) { return $p.Value }; return $null }

function Get-DEPackageCatalog {
    $de = Get-DEConsole
    $path = Join-Path $de.Root 'catalog\packages.json'
    return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
}
function Get-DEPackages { param([string]$Category) $p = @((Get-DEPackageCatalog).packages); if ($Category) { $p = @($p | Where-Object { $_ -and $_.category -eq $Category }) }; return $p }
function Get-DEPackage { param([Parameter(Mandatory = $true)][string]$Id) $p = Get-DEPackages | Where-Object { $_ -and $_.id -eq $Id } | Select-Object -First 1; if (-not $p) { throw "package '$Id' not in catalog" }; return $p }
function Get-DELocalPackagesDir { $de = Get-DEConsole; return $de.Dirs.Packages }

function Expand-DEPath { param([string]$Path) if (-not $Path) { return $Path }; return [Environment]::ExpandEnvironmentVariables($Path) }

function Resolve-DEPackageTokens {
    <# Replaces {SECRET:NAME}, {VALUE:key}, {FILE} and {FILE_DIR}. Secrets are read at the last moment and the result must never be logged unredacted (Protect-DEText knows the values). #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text, $Package, $ClientProfile, [string]$File = '')
    if (-not $Text) { return $Text }
    $out = $Text.Replace('{FILE}', $File).Replace('{FILE_DIR}', $(if ($File) { Split-Path -Parent $File } else { '' }))
    $out = [regex]::Replace($out, '\{SECRET:([A-Z0-9_]+)\}', { param($m) return (Get-DESecretPlain -Name $m.Groups[1].Value) })
    $settings = Get-DEPkgProp $Package 'settings'
    $out = [regex]::Replace($out, '\{VALUE:([A-Za-z0-9_\.]+)\}', {
        param($m)
        $key = $m.Groups[1].Value; $val = $null
        if ($ClientProfile) { $val = Get-DEHashPath -Object $ClientProfile -Path $key; if (-not $val) { $s = Get-DEPkgProp (Get-DEPkgProp $ClientProfile 'packageSettings') $key; if ($s) { $val = $s } } }
        if (-not $val -and $settings) { $val = Get-DEPkgProp $settings $key }
        if ($null -eq $val) { throw "package value '$key' is not set in the client profile or catalog settings" }
        return "$val"
    })
    return $out
}

function Test-DEPackageInstalled {
    <# Detection by services, processes, paths, uninstall registry name (+minVersion) and registry rules. Returns @{installed; version; evidence[]; details}. #>
    param([Parameter(Mandatory = $true)]$Package, $ClientProfile, [array]$Apps)
    $det = Get-DEPkgProp $Package 'detect'
    $ev = @(); $installed = $false; $version = $null; $registryOk = $null
    if ($det) {
        foreach ($s in @(Get-DEPkgProp $det 'services' | Where-Object { $null -ne $_ })) { if ($s) { $st = Get-DEServiceState -Name $s; if ($st.present) { $installed = $true; $ev += "service $s $($st.status)" } } }
        foreach ($p in @(Get-DEPkgProp $det 'processes' | Where-Object { $null -ne $_ })) { if ($p -and (Get-Process -Name $p -ErrorAction SilentlyContinue)) { $installed = $true; $ev += "process $p running" } }
        # a leftover folder alone is not an install when the package has a service, process or app entry to look for
        $strongRules = @(@(Get-DEPkgProp $det 'services') + @(Get-DEPkgProp $det 'processes') + @(Get-DEPkgProp $det 'appNameRegex') | Where-Object { $_ }).Count -gt 0
        foreach ($p in @(Get-DEPkgProp $det 'paths' | Where-Object { $null -ne $_ })) { $x = Expand-DEPath $p; if ($x -and (Test-Path -LiteralPath $x -ErrorAction SilentlyContinue)) { if (-not $strongRules) { $installed = $true }; $ev += "path $x"; if (-not $version -and $x -match '\.exe$') { try { $version = (Get-Item -LiteralPath $x).VersionInfo.ProductVersion } catch { } } } }
        $rx = Get-DEPkgProp $det 'appNameRegex'
        if ($rx) { if (-not $Apps) { $Apps = Get-DEInstalledApps }; $hit = @($Apps | Where-Object { $_ -and $_.name -match $rx }) | Select-Object -First 1; if ($hit) { $installed = $true; $ev += "app '$($hit.name)' $($hit.version)"; if (-not $version) { $version = $hit.version } } }
        $rules = @(Get-DEPkgProp $det 'registry' | Where-Object { $null -ne $_ })
        if ($rules.Count) {
            $registryOk = $true
            foreach ($r in $rules) {
                $path = Get-DEPkgProp $r 'path'; $name = Get-DEPkgProp $r 'name'
                if ($name) {
                    $have = Get-DERegistryValue -Path $path -Name $name; $want = Get-DEPkgProp $r 'equals'
                    if ("$have" -ne "$want") { $registryOk = $false; $ev += "registry $path\$name is '$have' (want '$want')" } else { $ev += "registry $path\$name = $have" }
                } else {
                    $pattern = Get-DEPkgProp $r 'containsValueMatching'
                    try { $pattern = Resolve-DEPackageTokens -Text $pattern -Package $Package -ClientProfile $ClientProfile } catch { $pattern = $null }
                    $vals = @(); if ($script:IsWindowsHost -and (Test-Path $path)) { $vals = @((Get-ItemProperty $path).PSObject.Properties | Where-Object { $_ -and $_.Name -notmatch '^PS' } | ForEach-Object { "$($_.Value)" }) }
                    if (-not $pattern) { $registryOk = $false; $ev += "registry rule for $path needs a value to match (setting missing)" }
                    elseif (-not ($vals | Where-Object { $_ -match [regex]::Escape($pattern) })) { $registryOk = $false; $ev += "registry $path lacks a value matching $pattern" } else { $ev += "registry $path contains $pattern" }
                }
            }
            if ($registryOk) { $installed = $true }
        }
    }
    $minVersion = Get-DEPkgProp $det 'minVersion'
    $versionOk = $true
    if ($installed -and $minVersion -and $version) { try { $versionOk = ([version]($version -replace '[^\d\.].*$', '') -ge [version]$minVersion) } catch { $versionOk = $true } }
    # Registry policy is configuration evidence. A broken policy must not erase evidence that an app is installed.
    $policyOnly = ($null -ne $registryOk -and -not @(Get-DEPkgProp $det 'services' | Where-Object { $_ }).Count -and -not @(Get-DEPkgProp $det 'processes' | Where-Object { $_ }).Count -and -not @(Get-DEPkgProp $det 'paths' | Where-Object { $_ }).Count -and -not (Get-DEPkgProp $det 'appNameRegex'))
    if ($policyOnly -and $registryOk -eq $true) { $installed = $true }
    return @{ installed = $installed; configured = ($registryOk -ne $false); kind = $(if ($policyOnly) { 'policy' } else { 'app' }); version = $version; versionOk = $versionOk; evidence = $ev }
}

function Get-DEPackageFile {
    <# Locates or downloads the installer and applies the trust policy. Returns @{path; trust}. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Package, [switch]$AllowUnverified)
    $src = Get-DEPkgProp $Package 'source'
    $type = Get-DEPkgProp $src 'type'
    if ($type -eq 'winget') { return @{ path = $null; trust = [pscustomobject]@{ Ok = $true; Reasons = @(); Sha256 = ''; Signature = $null; Overridden = $false }; winget = (Get-DEPkgProp $src 'id') } }
    $dir = Get-DELocalPackagesDir
    if ($type -eq 'local') { $path = Join-Path $dir (Get-DEPkgProp $src 'localPath') }
    elseif ($type -eq 'url') {
        $url = Get-DEPkgProp $src 'url'
        if ($url -notmatch '^https://') { throw 'refusing non-HTTPS package source' }
        $path = Join-Path $dir ([IO.Path]::GetFileName(([uri]$url).AbsolutePath))
        if (-not (Test-Path -LiteralPath $path)) {
            if ($PSCmdlet.ShouldProcess($url, "Download to $path")) {
                New-Item -ItemType Directory -Path $dir -Force | Out-Null
                try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
                # a dropped download must not be cached as the package: write .partial, move into place when complete
                $tmp = "$path.partial"
                try { Invoke-WebRequest -Uri $url -OutFile $tmp -UseBasicParsing; Move-Item -LiteralPath $tmp -Destination $path -Force }
                finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue } }
            } else { return @{ path = $path; trust = [pscustomobject]@{ Ok = $false; Reasons = @('not downloaded (planned)'); Sha256 = ''; Overridden = $false }; planned = $true } }
        }
    } else { throw "unknown source type '$type'" }
    $trust = Test-DEPackageTrust -Path $path -Sha256 (Get-DEPkgProp $src 'sha256') -Publisher (Get-DEPkgProp $src 'publisher') -AllowUnverified:$AllowUnverified
    return @{ path = $path; trust = $trust }
}

function Invoke-DEPackageInstall {
    <#
    Installs or repairs a catalog package. Enforces trust, resolves tokens at the last moment,
    runs silently with a timeout, interprets exit codes, and re-detects. Never logs secrets.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Id, $ClientProfile, [switch]$AllowUnverified, [string]$OverrideReason = '', [switch]$Repair)
    $pkg = Get-DEPackage -Id $Id
    $name = $pkg.name
    $missing = @(@(Get-DEPkgProp $pkg 'secrets' | Where-Object { $null -ne $_ }) | Where-Object { $_ -and -not (Test-DESecret -Name $_) })
    if ($missing.Count) { throw "runtime secret(s) required: $($missing -join ', ')" }
    $file = Get-DEPackageFile -Package $pkg -AllowUnverified:$AllowUnverified
    if (Get-DEPkgProp $file 'planned') { return [pscustomobject]@{ ok = $false; planned = $true; detail = 'download planned' } }
    if (-not $file.trust.Ok) { throw "trust policy refused $name : $($file.trust.Reasons -join '; '). Override with -AllowUnverified and a reason only after checking the file." }
    if ($file.trust.Overridden -and -not $OverrideReason.Trim()) { throw "an unverified installer for $name needs -OverrideReason (who checked the file and how)" }
    if ($file.trust.Overridden) { Add-DEEvidence -Step "apps.$Id.trust" -Module 'apps' -Before 'unverified file' -ActionTaken "override: $OverrideReason" -Result 'WARN' -Verification ($file.trust.Reasons -join '; ') -Remediation 'Add the sha256 or publisher to the catalog.' | Out-Null }
    $inst = Get-DEPkgProp $pkg 'install'
    $type = Get-DEPkgProp $inst 'type'
    $timeout = Get-DEPkgProp $inst 'timeoutSeconds'; if (-not $timeout) { $timeout = 900 }
    $success = @(Get-DEPkgProp $inst 'successExitCodes' | Where-Object { $null -ne $_ }); if (-not $success.Count) { $success = @(0) }
    $rebootCodes = @(Get-DEPkgProp $inst 'rebootExitCodes' | Where-Object { $null -ne $_ })
    $argsText = Resolve-DEPackageTokens -Text (Get-DEPkgProp $inst 'args') -Package $pkg -ClientProfile $ClientProfile -File $file.path
    $exe = $null; $argList = @()
    switch ($type) {
        'msi' { $exe = 'msiexec.exe'; $argList = @('/i', $file.path) + @($argsText -split ' (?=(?:[^"]*"[^"]*")*[^"]*$)' | Where-Object { $_ }); if ($Repair) { $argList = @('/fa', $file.path, '/quiet', '/norestart') } }
        'exe' { $exe = $file.path; $argList = @($argsText -split ' (?=(?:[^"]*"[^"]*")*[^"]*$)' | Where-Object { $_ }) }
        'ps1' { $exe = 'powershell.exe'; $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $file.path) + @($argsText -split ' (?=(?:[^"]*"[^"]*")*[^"]*$)' | Where-Object { $_ }) }
        'odt' { $exe = $file.path; $cfg = Join-Path (Split-Path -Parent $file.path) 'm365-config.xml'; New-DEOfficeConfigXml -Package $pkg -ClientProfile $ClientProfile -Path $cfg | Out-Null; $argList = @('/configure', $cfg) }
        'winget' { $exe = Resolve-DEWingetOrRepair -DryRun:$WhatIfPreference; $argList = @('install', '--id', $file.winget, '--exact') + @($argsText -split ' ' | Where-Object { $_ }); if ($Repair) { $argList = @('install', '--id', $file.winget, '--exact', '--force') + @($argsText -split ' ' | Where-Object { $_ }) } }
        default { throw "unknown install type '$type'" }
    }
    $shown = "$exe " + (($argList | ForEach-Object { Protect-DEText $_ }) -join ' ')
    if (-not $PSCmdlet.ShouldProcess($name, $shown)) { return [pscustomobject]@{ ok = $false; planned = $true; detail = $shown } }
    Write-DELog -Level INFO -Message "installing $name : $shown"
    # async output reads (a chatty installer cannot hang on a full pipe) and quoting that never double-wraps PROPERTY="a b"
    $run = Invoke-DENative -FilePath $exe -Arguments $argList -TimeoutSeconds ([int]$timeout)
    if ($run.TimedOut) { throw "installer timed out after $timeout s" }
    $stdout = Protect-DEText $run.Text; $stderr = ''
    $code = $run.ExitCode
    $argsText = $null
    $ok = ($success -contains $code)
    $reboot = ($rebootCodes -contains $code)
    if ($type -eq 'winget') {
        # winget's own results: already installed / no newer version are success; 0x8A150109 means it installed and needs a restart
        if ($code -in @(-1978335189, -1978335135)) { $ok = $true }
        if ($code -eq -1978334967) { $ok = $true; $reboot = $true }
    }
    Write-DELog -Level $(if ($ok) { 'INFO' } else { 'WARN' }) -Message "$name exit $code$(if ($reboot) { ' (reboot required)' })"
    if ($stderr.Trim()) { Write-DELog -Level DEBUG -Message "$name stderr: $($stderr.Substring(0, [Math]::Min(500, $stderr.Length)))" }
    $after = Test-DEPackageInstalled -Package $pkg -ClientProfile $ClientProfile
    return [pscustomobject]@{ ok = $ok; exitCode = $code; rebootRequired = $reboot; detected = $after; detail = "exit $code; detected=$($after.installed) $($after.evidence -join ', ')"; stdout = $(if ($stdout.Length -gt 800) { $stdout.Substring(0, 800) } else { $stdout }) }
}

function Invoke-DEPackageUninstall {
    <#
    Removes a catalog package silently, never by guessing switches: winget packages through winget, MSI products
    through msiexec /x {GUID}, others only through the vendor's QuietUninstallString. Anything else is reported
    as a manual step. Every run has a timeout. User data folders are never touched.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Id, [int]$TimeoutSeconds = 900)
    $pkg = Get-DEPackage -Id $Id
    $src = Get-DEPkgProp $pkg 'source'
    $rx = Get-DEPkgProp (Get-DEPkgProp $pkg 'detect') 'appNameRegex'
    $apps = @(); if ($rx) { $apps = @(Find-DEApp -NamePattern $rx | Where-Object { $_ }) }
    $exe = $null; $argList = @()
    if ((Get-DEPkgProp $src 'type') -eq 'winget') { $exe = Get-DEWingetPath; $argList = @('uninstall', '--id', (Get-DEPkgProp $src 'id'), '--exact', '--silent', '--accept-source-agreements') }
    elseif (-not $apps.Count) { return [pscustomobject]@{ ok = $true; detail = 'not installed' } }
    elseif ("$($apps[0].uninstall)" -match 'MsiExec(\.exe)?"?\s*/[IX]\s*(\{[0-9A-Fa-f\-]+\})') { $exe = 'msiexec.exe'; $argList = @('/x', $Matches[2], '/quiet', '/norestart') }
    # cmd /s /c "<string>": /s makes cmd strip exactly the outer pair, so the publisher's own quoting inside survives
    elseif ("$($apps[0].quietUninstall)") { $exe = 'cmd.exe'; $argList = @('/s', '/c', ('"' + "$($apps[0].quietUninstall)" + '"')) }
    else { return [pscustomobject]@{ ok = $false; manual = $true; detail = "no silent uninstall is published for $($apps[0].name); remove it from Settings > Apps (DE Tech Tool never guesses installer switches)" } }
    if (-not $PSCmdlet.ShouldProcess($pkg.name, "$exe $($argList -join ' ')")) { return [pscustomobject]@{ ok = $false; planned = $true } }
    $r = Invoke-DENative -FilePath $exe -Arguments $argList -TimeoutSeconds $TimeoutSeconds
    if ($r.TimedOut) { return [pscustomobject]@{ ok = $false; exitCode = $null; detail = "uninstall did not finish in $TimeoutSeconds s" } }
    # 1605 = not installed; winget reports a missing package with -1978335212 (0x8A150014)
    return [pscustomobject]@{ ok = ($r.ExitCode -in @(0, 3010, 1641, 1605, -1978335212)); exitCode = $r.ExitCode; detail = "exit $($r.ExitCode)" }
}

function Resolve-DEWingetOrRepair {
    <# winget's path; when it is missing (OOBE, LTSC, SYSTEM before first sign-in) runs the pinned winget-install script once and tries again. #>
    param([switch]$DryRun)
    try { return (Get-DEWingetPath) } catch { if ($DryRun -or -not (Get-Command -Name 'Invoke-DECommunityScript' -ErrorAction SilentlyContinue)) { throw } }
    Write-DELog -Level STEP -Message 'winget missing: running Toolbox > Install or repair winget'
    $r = Invoke-DECommunityScript -Key 'winget-install/install' -Force -Confirm:$false
    if ($r.result -ne 'PASS') { throw "winget is missing and the repair did not finish ($($r.result); log $($r.log))" }
    return (Get-DEWingetPath)
}
function Get-DEWingetPath {
    <#
        winget.exe is a per-user App Execution Alias: it is not on PATH for SYSTEM (RMM, Intune, first boot) nor in
        32-bit PowerShell. Resolve the newest x64 App Installer under WindowsApps instead. If App Installer is
        present but not registered (typical at OOBE, before the first sign-in) register it once. Throws a clear
        error when winget is missing: the Toolbox's winget-install repairs it.
    #>
    if ($env:OS -ne 'Windows_NT') { return 'winget.exe' }
    $cmd = Get-Command -Name 'winget.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($cmd -and $cmd.Source -notmatch '\\Microsoft\\WindowsApps\\winget\.exe$') { return $cmd.Source }   # a real path, not the alias stub
    $pf = $(if ($env:ProgramW6432) { $env:ProgramW6432 } else { $env:ProgramFiles })
    $find = { @(Get-ChildItem -Path (Join-Path $pf 'WindowsApps') -Filter "Microsoft.DesktopAppInstaller_*_$(if ("$env:PROCESSOR_ARCHITEW6432$env:PROCESSOR_ARCHITECTURE" -match 'ARM64') { 'arm64' } else { 'x64' })__8wekyb3d8bbwe" -Directory -ErrorAction SilentlyContinue | Sort-Object { try { [version](($_.Name -split '_')[1]) } catch { [version]'0.0' } } -Descending | ForEach-Object { Join-Path $_.FullName 'winget.exe' } | Where-Object { Test-Path -LiteralPath $_ }) | Select-Object -First 1 }
    $p = & $find
    if (-not $p -and $cmd) { return $cmd.Source }
    if (-not $p) {
        try { Add-AppxPackage -RegisterByFamilyName -MainPackage 'Microsoft.DesktopAppInstaller_8wekyb3d8bbwe' -ErrorAction Stop; Start-Sleep -Seconds 3; $p = & $find } catch { Write-DELog -Level DEBUG -Message "App Installer registration: $($_.Exception.Message)" }
    }
    if (-not $p) { throw 'winget is not available on this device (App Installer missing or not registered yet). Run Toolbox > Install or repair winget, then try again.' }
    return $p
}
function New-DEOfficeConfigXml {
    param([Parameter(Mandatory = $true)]$Package, $ClientProfile, [Parameter(Mandatory = $true)][string]$Path)
    $s = Get-DEPkgProp $Package 'settings'
    $channel = Get-DEPkgProp $s 'channel'; if (-not $channel) { $channel = 'Current' }
    $product = Get-DEPkgProp $s 'productId'; if (-not $product) { $product = 'O365BusinessRetail' }
    $exclude = @(Get-DEPkgProp $s 'excludeApps' | Where-Object { $null -ne $_ })
    $standard = Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.standard'
    if ($standard -eq 'dropbox' -and $exclude -notcontains 'OneDrive') { $exclude += 'OneDrive' }
    $xml = @"
<Configuration>
  <Add OfficeClientEdition="64" Channel="$channel">
    <Product ID="$product">
      <Language ID="MatchOS" />
$(($exclude | ForEach-Object { "      <ExcludeApp ID=`"$_`" />" }) -join "`n")
    </Product>
  </Add>
  <Property Name="SharedComputerLicensing" Value="0" />
  <Property Name="FORCEAPPSHUTDOWN" Value="TRUE" />
  <Property Name="AUTOACTIVATE" Value="1" />
  <Updates Enabled="TRUE" />
  <RemoveMSI />
  <Display Level="None" AcceptEULA="TRUE" />
</Configuration>
"@
    Set-Content -LiteralPath $Path -Value $xml -Encoding UTF8
    return $Path
}

function Get-DEM365Readiness {
    <# UPN, Office presence and activation, Outlook profile, Teams, OneDrive account, Edge sign-in hints. Client-facing verification, no tokens. #>
    param([string]$ExpectedUpn)
    $apps = Get-DEInstalledApps
    $office = @(Find-DEApp -NamePattern '^Microsoft 365 Apps|^Microsoft Office' -Apps $apps) | Select-Object -First 1
    $teams = @(Find-DEApp -NamePattern '^Microsoft Teams' -Apps $apps) | Select-Object -First 1
    $outlookProfiles = @(); $officeIdentity = @()
    if ($script:IsWindowsHost) {
        $pk = 'HKCU:\Software\Microsoft\Office\16.0\Outlook\Profiles'; if (Test-Path $pk) { $outlookProfiles = @(Get-ChildItem $pk | ForEach-Object { $_.PSChildName }) }
        $ik = 'HKCU:\Software\Microsoft\Office\16.0\Common\Identity\Identities'; if (Test-Path $ik) { $officeIdentity = @(Get-ChildItem $ik | ForEach-Object { (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).EmailAddress } | Where-Object { $_ }) }
    }
    $od = Get-DEOneDriveState
    $upnOk = $null
    if ($ExpectedUpn) { $upnOk = [bool](($officeIdentity + @($od.businessAccounts | ForEach-Object { $_.email })) | Where-Object { $_ -ieq $ExpectedUpn }) }
    return @{ officeInstalled = [bool]$office; officeVersion = $(if ($office) { $office.version } else { $null }); teamsInstalled = [bool]$teams; outlookProfiles = $outlookProfiles; signedInIdentities = $officeIdentity; oneDriveBusinessAccounts = @($od.businessAccounts | ForEach-Object { $_.email }); expectedUpn = $ExpectedUpn; upnMatches = $upnOk }
}

function Get-DECloudStorageState {
    <# Which client the machine has versus the client standard (onedrive | dropbox | both | none). #>
    param($ClientProfile)
    $std = Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.standard'; if (-not $std) { $std = 'onedrive' }
    $od = Get-DEOneDriveState; $db = Get-DEDropboxState
    $odInstalled = [bool](Test-DEPackageInstalled -Package (Get-DEPackage -Id 'onedrive')).installed
    return @{ standard = $std; oneDrive = @{ installed = $odInstalled; running = $od.running; configured = ($od.businessAccounts.Count -gt 0); classification = $od.classification }; dropbox = $db; conflict = $(switch ($std) { 'onedrive' { $db.installed -and (Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.removeConflicting') } 'dropbox' { $odInstalled -and (Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.removeConflicting') } default { $false } }) }
}

# ------------------------------------------------------------------ actions registered with the core
function Register-DEAppsActions {
    param($ClientProfile)
    $required = @(Get-DEHashPath -Object $ClientProfile -Path 'apps.required' | Where-Object { $null -ne $_ }); if (-not $required.Count) { $required = @('m365-apps', 'teams', 'edge', 'chrome', 'pdf-reader') }
    $standard = Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.standard'; if (-not $standard) { $standard = 'onedrive' }
    $required = @($required | Where-Object { $_ -ne 'onedrive' -and $_ -ne 'dropbox' })
    if ($standard -in @('onedrive', 'both')) { $required += 'onedrive' }
    if ($standard -in @('dropbox', 'both')) { $required += 'dropbox' }
    $lob = @(Get-DEHashPath -Object $ClientProfile -Path 'apps.lineOfBusiness' | Where-Object { $null -ne $_ })
    foreach ($id in ($required + $lob | Select-Object -Unique)) {
        $pkg = $null; try { $pkg = Get-DEPackage -Id $id } catch { Write-DELog -Level WARN -Message "profile requires unknown package '$id'"; continue }
        $pkgId = $id
        $mfr = Get-DEPkgProp $pkg 'applicableManufacturer'
        Register-DEAction -Id "apps.$pkgId" -Module 'apps' -Title "Install $($pkg.name)" -Phase 9 -Gates @('gate.elevated') -RequiresElevation -RequiresSecrets @(@(Get-DEPkgProp $pkg 'secrets' | Where-Object { $null -ne $_ }) | Where-Object { $_ }) `
            -Description $(if ((Get-DEPkgProp $pkg 'confirmed') -eq $false) { 'Catalog entry not yet confirmed against the vendor guide.' } else { '' }) `
            -Detect { $p = Get-DEPackage -Id $pkgId; $d = Test-DEPackageInstalled -Package $p -ClientProfile $ClientProfile; @{ installed = $d.installed; configured = $d.configured; kind = $d.kind; versionOk = $d.versionOk; evidence = $d.evidence } }.GetNewClosure() `
            -Desired { @{ installed = $true; configured = $true; versionOk = $true } } `
            -Apply { param($state)
                if ($state.Operation -eq 'Configure' -and $state.Detected.kind -ne 'policy') { throw "Existing $pkgId needs configuration; no safe configuration recipe is registered. Review detected settings before changing it." }
                $r = Invoke-DEPackageInstall -Id $pkgId -ClientProfile $ClientProfile -Repair:($state.Operation -eq 'Repair')
                if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }
                if ($r.rebootRequired) { Request-DEReboot -Reason "$pkgId installer requested a restart" -ResumeAction "apps.$pkgId" | Out-Null }
                $r.detail
            }.GetNewClosure() `
            -Remediate { param($state) $null = Invoke-DEPackageInstall -Id $pkgId -ClientProfile $ClientProfile -Repair }.GetNewClosure() `
            -ManualAction $(if ($mfr) { "Only for $mfr hardware." } else { '' })
    }
    $remove = @(Get-DEHashPath -Object $ClientProfile -Path 'apps.remove' | Where-Object { $null -ne $_ })
    # Plan from policy, not from a live scan: registering actions must stay fast and side-effect free (it runs on
    # the window thread). The removal action's own Detect checks what is installed when it runs.
    $removeConflicting = [bool](Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.removeConflicting')
    $allowBoth = [bool](Get-DEHashPath -Object $ClientProfile -Path 'cloudStorage.allowBoth')
    if ($removeConflicting -and -not $allowBoth -and $standard -in @('onedrive', 'dropbox')) { $remove += $(if ($standard -eq 'onedrive') { 'dropbox' } else { 'onedrive' }) }
    foreach ($id in ($remove | Select-Object -Unique)) {
        $pkgId = $id
        Register-DEAction -Id "apps.remove.$pkgId" -Module 'apps' -Title "Remove $pkgId (client standard)" -Phase 9 -Gates @('gate.elevated') -RequiresElevation -Destructive `
            -Detect { $p = Get-DEPackage -Id $pkgId; @{ installed = (Test-DEPackageInstalled -Package $p).installed } }.GetNewClosure() -Desired { @{ installed = $false } } `
            -Apply { param($state) $r = Invoke-DEPackageUninstall -Id $pkgId; if (-not $r.ok) { throw $r.detail }; $r.detail }.GetNewClosure()
    }
    Register-DEAction -Id 'apps.m365.readiness' -Module 'apps' -Title 'Microsoft 365 readiness (UPN, Office, Outlook, Teams, OneDrive sign-in)' -Phase 10 -Gates @('gate.user-session') `
        -Detect { $ctx = Get-DEContext; $r = Get-DEM365Readiness -ExpectedUpn $ctx['endUserEmail']; @{ officeInstalled = $r.officeInstalled; teamsInstalled = $r.teamsInstalled; upnMatches = $(if ($null -eq $r.upnMatches) { 'unknown' } else { $r.upnMatches }); outlookProfiles = $r.outlookProfiles.Count } } `
        -Desired { @{ officeInstalled = $true; teamsInstalled = $true; upnMatches = $true } } `
        -ManualAction 'Sign the end user into Office, Outlook, Teams and OneDrive with their work account after the identity migration; the console verifies, it cannot enter their credentials.'
}

Export-ModuleMember -Function Resolve-DEWingetOrRepair, Get-DEWingetPath, Get-DEPackageCatalog, Get-DEPackages, Get-DEPackage, Get-DELocalPackagesDir, Resolve-DEPackageTokens, Test-DEPackageInstalled, Get-DEPackageFile, Invoke-DEPackageInstall, Invoke-DEPackageUninstall, New-DEOfficeConfigXml, Get-DEM365Readiness, Get-DECloudStorageState, Register-DEAppsActions, Get-DEPkgProp, Expand-DEPath
