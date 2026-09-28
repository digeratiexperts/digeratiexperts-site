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
        foreach ($p in @(Get-DEPkgProp $det 'paths' | Where-Object { $null -ne $_ })) { $x = Expand-DEPath $p; if ($x -and (Test-Path -LiteralPath $x -ErrorAction SilentlyContinue)) { $installed = $true; $ev += "path $x"; if (-not $version -and $x -match '\.exe$') { try { $version = (Get-Item -LiteralPath $x).VersionInfo.ProductVersion } catch { } } } }
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
                Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
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
        'winget' { $exe = 'winget.exe'; $argList = @('install', '--id', $file.winget, '--exact') + @($argsText -split ' ' | Where-Object { $_ }); if ($Repair) { $argList = @('install', '--id', $file.winget, '--exact', '--force') + @($argsText -split ' ' | Where-Object { $_ }) } }
        default { throw "unknown install type '$type'" }
    }
    $shown = "$exe " + (($argList | ForEach-Object { Protect-DEText $_ }) -join ' ')
    if (-not $PSCmdlet.ShouldProcess($name, $shown)) { return [pscustomobject]@{ ok = $false; planned = $true; detail = $shown } }
    Write-DELog -Level INFO -Message "installing $name : $shown"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $exe; $psi.Arguments = (($argList | ForEach-Object { if ($_ -match '\s' -and $_ -notmatch '^".*"$') { '"' + $_ + '"' } else { $_ } }) -join ' '); $psi.UseShellExecute = $false; $psi.CreateNoWindow = $true; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $proc = [System.Diagnostics.Process]::Start($psi)
    $done = $proc.WaitForExit([int]$timeout * 1000)
    if (-not $done) { try { $proc.Kill() } catch { }; throw "installer timed out after $timeout s" }
    $stdout = Protect-DEText ($proc.StandardOutput.ReadToEnd()); $stderr = Protect-DEText ($proc.StandardError.ReadToEnd())
    $code = $proc.ExitCode
    $argsText = $null
    $ok = ($success -contains $code)
    $reboot = ($rebootCodes -contains $code)
    Write-DELog -Level $(if ($ok) { 'INFO' } else { 'WARN' }) -Message "$name exit $code$(if ($reboot) { ' (reboot required)' })"
    if ($stderr.Trim()) { Write-DELog -Level DEBUG -Message "$name stderr: $($stderr.Substring(0, [Math]::Min(500, $stderr.Length)))" }
    $after = Test-DEPackageInstalled -Package $pkg -ClientProfile $ClientProfile
    return [pscustomobject]@{ ok = $ok; exitCode = $code; rebootRequired = $reboot; detected = $after; detail = "exit $code; detected=$($after.installed) $($after.evidence -join ', ')"; stdout = $(if ($stdout.Length -gt 800) { $stdout.Substring(0, 800) } else { $stdout }) }
}

function Invoke-DEPackageUninstall {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Id)
    $pkg = Get-DEPackage -Id $Id
    $rx = Get-DEPkgProp (Get-DEPkgProp $pkg 'detect') 'appNameRegex'
    $apps = @(); if ($rx) { $apps = @(Find-DEApp -NamePattern $rx) }
    if (-not $apps.Count) { $src = Get-DEPkgProp $pkg 'source'; if ((Get-DEPkgProp $src 'type') -eq 'winget' -and $PSCmdlet.ShouldProcess($pkg.name, 'winget uninstall')) { $r = Invoke-DENative -FilePath 'winget.exe' -Arguments @('uninstall', '--id', (Get-DEPkgProp $src 'id'), '--exact', '--silent'); return [pscustomobject]@{ ok = ($r.ExitCode -eq 0); detail = "winget exit $($r.ExitCode)" } }; return [pscustomobject]@{ ok = $true; detail = 'not installed' } }
    $app = $apps[0]
    $cmd = "$($app.uninstall)"
    if (-not $cmd) { return [pscustomobject]@{ ok = $false; detail = 'no uninstall string' } }
    if ($cmd -match 'MsiExec\.exe\s*/[IX]\s*(\{[0-9A-Fa-f\-]+\})') { $exe = 'msiexec.exe'; $argList = @('/x', $Matches[1], '/quiet', '/norestart') }
    else { $exe = 'cmd.exe'; $argList = @('/c', "$cmd /quiet /norestart") }
    if (-not $PSCmdlet.ShouldProcess($app.name, "$exe $($argList -join ' ')")) { return [pscustomobject]@{ ok = $false; planned = $true } }
    $r = Invoke-DENative -FilePath $exe -Arguments $argList
    return [pscustomobject]@{ ok = ($r.ExitCode -in @(0, 3010, 1605)); exitCode = $r.ExitCode; detail = "exit $($r.ExitCode)" }
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
    Register-DEAction -Id 'apps.m365.readiness' -Module 'apps' -Title 'Microsoft 365 readiness (UPN, Office, Outlook, Teams, OneDrive sign-in)' -Phase 10 `
        -Detect { $ctx = Get-DEContext; $r = Get-DEM365Readiness -ExpectedUpn $ctx['endUserEmail']; @{ officeInstalled = $r.officeInstalled; teamsInstalled = $r.teamsInstalled; upnMatches = $(if ($null -eq $r.upnMatches) { 'unknown' } else { $r.upnMatches }); outlookProfiles = $r.outlookProfiles.Count } } `
        -Desired { @{ officeInstalled = $true; teamsInstalled = $true; upnMatches = $true } } `
        -ManualAction 'Sign the end user into Office, Outlook, Teams and OneDrive with their work account after the identity migration; the console verifies, it cannot enter their credentials.'
}

Export-ModuleMember -Function Get-DEPackageCatalog, Get-DEPackages, Get-DEPackage, Get-DELocalPackagesDir, Resolve-DEPackageTokens, Test-DEPackageInstalled, Get-DEPackageFile, Invoke-DEPackageInstall, Invoke-DEPackageUninstall, New-DEOfficeConfigXml, Get-DEM365Readiness, Get-DECloudStorageState, Register-DEAppsActions, Get-DEPkgProp, Expand-DEPath
