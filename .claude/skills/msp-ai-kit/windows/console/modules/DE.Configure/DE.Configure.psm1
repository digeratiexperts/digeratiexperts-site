#Requires -Version 5.1
<#
.SYNOPSIS
    OS Configurator (DE Windows baseline with before/after evidence and
    exceptions), Browser Configurator (Chrome/Edge policy, default browser,
    homepage, managed bookmarks from the vendor catalog, extension lists,
    private browsing, downloads, safe browsing), Branding engine (dual-logo
    wallpaper, lock screen, accent, support info, hostname, preview, undo) and
    the DE quick-control / support shortcuts.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')

function Get-DECfgProp { param($Object, [string]$Name) if ($null -eq $Object) { return $null }; if ($Object -is [System.Collections.IDictionary]) { if ($Object.Contains($Name)) { return $Object[$Name] }; return $null }; $p = $Object.PSObject.Properties[$Name]; if ($p) { return $p.Value }; return $null }
function Get-DECatalogJson { param([string]$Name) $de = Get-DEConsole; return (Get-Content -LiteralPath (Join-Path $de.Root "catalog\$Name") -Raw -Encoding UTF8 | ConvertFrom-Json) }

# ================================================================== BASELINE
function Get-DEBaselineControls { param([Alias('Profile')][string]$BaselineProfile = 'de-windows-baseline') $b = Get-DECatalogJson 'baseline.json'; $ids = @((Get-DECfgProp (Get-DECfgProp $b.profiles $BaselineProfile) 'controls')); return @($b.controls | Where-Object { $_ -and $ids -contains $_.id }) }

function Get-DEBaselineControlState {
    param([Parameter(Mandatory = $true)]$Control)
    $want = $Control.value; $have = $null; $ok = $false; $detail = ''
    switch ($Control.type) {
        'registry' { $have = Get-DERegistryValue -Path $Control.path -Name $Control.name; $ok = ("$have" -eq "$want"); $detail = "$($Control.path)\$($Control.name) = $have" }
        'firewall' { if ($script:IsWindowsHost) { try { $fp = Get-NetFirewallProfile -Name $Control.profile -ErrorAction Stop; $have = [bool]($fp.Enabled -eq 'True' -or $fp.Enabled -eq $true); $ok = ($have -eq [bool]$want); $detail = "$($Control.profile) enabled=$have" } catch { $detail = $_.Exception.Message } } }
        'localuser' { if ($script:IsWindowsHost) { try { $u = Get-LocalUser -Name $Control.name -ErrorAction Stop; $have = $(if ($u.Enabled) { 'Enabled' } else { 'Disabled' }); $ok = ($have -eq $want) } catch { $have = 'absent'; $ok = $true } ; $detail = "$($Control.name) $have" } }
        'netaccounts' { if ($script:IsWindowsHost) { $r = Invoke-DENative -FilePath 'net.exe' -Arguments @('accounts'); $line = switch ($Control.setting) { 'lockoutthreshold' { $r.Output | Where-Object { $_ -match 'Lockout threshold' } } 'minpwlen' { $r.Output | Where-Object { $_ -match 'Minimum password length' } } }; if ($line -and "$line" -match '(\d+|Never)\s*$') { $have = $Matches[1] }; $ok = ("$have" -ne 'Never' -and [int]("0$have" -replace '\D', '') -ge [int]$want -and ($Control.setting -ne 'lockoutthreshold' -or [int]("0$have" -replace '\D', '') -le [int]$want -and [int]("0$have" -replace '\D', '') -gt 0)); $detail = "$($Control.setting) = $have" } }
        'auditpol' { if ($script:IsWindowsHost) { $r = Invoke-DENative -FilePath 'auditpol.exe' -Arguments @('/get', "/subcategory:$($Control.subcategory)"); $have = "$($r.Output | Select-Object -Last 1)".Trim(); $ok = ($have -match [regex]::Escape($want)); $detail = $have } }
        'command' { if ($script:IsWindowsHost -and $Control.detect -like 'optionalfeature:*') { $f = $Control.detect.Split(':')[1]; try { $st = (Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction Stop).State; $have = "$st"; $ok = ($have -eq $want -or $have -eq 'DisabledWithPayloadRemoved') } catch { $have = 'unknown'; $detail = $_.Exception.Message } ; $detail = "$f $have" } }
    }
    return @{ id = $Control.id; title = $Control.title; cis = $Control.cis; want = $want; have = $have; ok = $ok; detail = $detail }
}

function Set-DEBaselineControl {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Control)
    if (-not $PSCmdlet.ShouldProcess($Control.title, "set to $($Control.value)")) { return 'planned' }
    switch ($Control.type) {
        'registry' { Set-DERegistryValue -Path $Control.path -Name $Control.name -Value $Control.value -Type $Control.valueType }
        'firewall' { Set-NetFirewallProfile -Name $Control.profile -Enabled $(if ($Control.value) { 'True' } else { 'False' }) }
        'localuser' { if ($Control.value -eq 'Disabled') { Disable-LocalUser -Name $Control.name -ErrorAction SilentlyContinue } else { Enable-LocalUser -Name $Control.name } }
        'netaccounts' { $flag = switch ($Control.setting) { 'lockoutthreshold' { "/lockoutthreshold:$($Control.value)" } 'minpwlen' { "/minpwlen:$($Control.value)" } }; $r = Invoke-DENative -FilePath 'net.exe' -Arguments @('accounts', $flag); if ($r.ExitCode -ne 0) { throw $r.Text } }
        'auditpol' { $r = Invoke-DENative -FilePath 'auditpol.exe' -Arguments @('/set', "/subcategory:$($Control.subcategory)", '/success:enable'); if ($r.ExitCode -ne 0) { throw $r.Text } }
        'command' { if ($Control.detect -like 'optionalfeature:*') { Disable-WindowsOptionalFeature -Online -FeatureName $Control.detect.Split(':')[1] -NoRestart | Out-Null } }
    }
    if (Get-DECfgProp $Control 'reboot') { Request-DEReboot -Reason "$($Control.title) takes effect after restart" -ResumeAction 'baseline.verify' | Out-Null }
    return 'set'
}

function Invoke-DEBaselineAssessment {
    <# Before/after snapshot of every control with the exception list applied; writes a baseline report into evidence. #>
    param([Alias('Profile')][string]$BaselineProfile = 'de-windows-baseline', [string]$Label = 'assessment')
    $rows = @()
    foreach ($c in Get-DEBaselineControls -Profile $BaselineProfile) {
        $s = Get-DEBaselineControlState -Control $c
        $ex = Get-DEException -Target "baseline.$($c.id)"
        $s.status = $(if ($s.ok) { 'PASS' } elseif ($ex) { 'EXCEPTION' } else { 'DRIFT' })
        $s.breaks = Get-DECfgProp $c 'breaks'
        $rows += $s
    }
    $de = Get-DEConsole
    $file = Join-Path $de.Dirs.Evidence ("baseline-{0}-{1}.json" -f $Label, (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $rows | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $file -Encoding UTF8 -WhatIf:$false
    return @{ rows = $rows; file = $file; pass = @($rows | Where-Object { $_ -and $_.status -eq 'PASS' }).Count; drift = @($rows | Where-Object { $_ -and $_.status -eq 'DRIFT' }).Count; exceptions = @($rows | Where-Object { $_ -and $_.status -eq 'EXCEPTION' }).Count }
}

function Register-DEBaselineActions {
    param($ClientProfile)
    $profileName = Get-DEHashPath -Object $ClientProfile -Path 'security.baselineProfile'; if (-not $profileName) { $profileName = 'de-windows-baseline' }
    $jcPatch = $true
    foreach ($c in Get-DEBaselineControls -Profile $profileName) {
        $ctl = $c
        if ($ctl.id -eq 'wu-auto' -and $jcPatch) { continue }  # JumpCloud patch policy is the update authority for DE-managed endpoints
        $gates = @('gate.elevated'); if ((Get-DECfgProp $ctl 'scope') -eq 'user') { $gates = @() }
        Register-DEAction -Id "baseline.$($ctl.id)" -Module 'baseline' -Title $ctl.title -Phase 11 -Gates $gates -RequiresElevation:((Get-DECfgProp $ctl 'scope') -ne 'user') `
            -Detect { $s = Get-DEBaselineControlState -Control $ctl; @{ ok = $s.ok; have = "$($s.have)"; detail = $s.detail } }.GetNewClosure() `
            -Desired { @{ ok = $true } } `
            -Apply { param($s) $bk = $null; if ($ctl.type -eq 'registry') { $bk = Backup-DERegistryKey -Key (($ctl.path -replace '^HKLM:', 'HKLM') -replace '^HKCU:', 'HKCU') -Label "baseline-$($ctl.id)" }; $r = Set-DEBaselineControl -Control $ctl; "$r$(if ($bk) { "; backup $bk" })" }.GetNewClosure() `
            -Rollback { param($s) 'Restore with reg import of the backup file named in the evidence record for this control.' } `
            -ManualAction $(if (Get-DECfgProp $ctl 'breaks') { "Known conflict: $($ctl.breaks) Record an exception with approver and expiry if the client needs it." } else { '' })
    }
}

# ================================================================== BROWSER
function Get-DEBrowserPolicyProfile { param([string]$Name = 'de-browser-policy') $b = Get-DECatalogJson 'browser-policy.json'; $p = Get-DECfgProp $b.profiles $Name; if (-not $p) { throw "browser policy profile '$Name' not found" }; return $p }

function Get-DEBrowserDesiredPolicy {
    <# Merges the policy profile, client overrides, homepage/startup and managed bookmarks into per-browser key/value sets. #>
    param($ClientProfile)
    $name = Get-DEHashPath -Object $ClientProfile -Path 'browser.policyProfile'; if (-not $name) { $name = 'de-browser-policy' }
    $p = Get-DEBrowserPolicyProfile -Name $name
    $out = @{ chrome = [ordered]@{}; edge = [ordered]@{}; lists = @{ chrome = @{}; edge = @{} } }
    foreach ($b in @('chrome', 'edge')) {
        foreach ($prop in @((Get-DECfgProp $p 'common').PSObject.Properties)) { $out[$b][$prop.Name] = $prop.Value }
        $spec = Get-DECfgProp $p $b; if ($spec) { foreach ($prop in @($spec.PSObject.Properties | Where-Object { $null -ne $_ })) { $out[$b][$prop.Name] = $prop.Value } }
        $homePage = Get-DEHashPath -Object $ClientProfile -Path 'browser.homepage'
        if ($homePage) { $out[$b]['HomepageLocation'] = $homePage; $out[$b]['HomepageIsNewTabPage'] = 0; $out[$b]['RestoreOnStartup'] = 4; $out.lists[$b]['RestoreOnStartupURLs'] = @(@($homePage) + @(Get-DEHashPath -Object $ClientProfile -Path 'browser.startupPages' | Where-Object { $null -ne $_ }) | Where-Object { $_ }) }
        $bookmarksJson = $null
        if ((Get-DEHashPath -Object $ClientProfile -Path 'browser.managedBookmarksFromVendors') -or (Get-DEHashPath -Object $ClientProfile -Path 'browser.extraBookmarks')) { $bookmarksJson = New-DEManagedBookmarks -ClientProfile $ClientProfile -IncludeReference:$false }
        if ($bookmarksJson -and -not (Get-DEHashPath -Object $ClientProfile -Path 'browser.managedBookmarksFromVendors')) {
            $extra = @(Get-DEHashPath -Object $ClientProfile -Path 'browser.extraBookmarks' | Where-Object { $null -ne $_ }); $bookmarksJson = (@(@{ toplevel_name = 'DE' }) + @($extra | ForEach-Object { @{ name = (Get-DECfgProp $_ 'name'); url = (Get-DECfgProp $_ 'url') } })) | ConvertTo-Json -Compress -Depth 4
        }
        if ($bookmarksJson) { $out[$b]['ManagedBookmarks'] = $bookmarksJson; $out[$b]['BookmarkBarEnabled'] = 1 }
        $ext = Get-DECfgProp $p 'extensions'
        $force = @(); foreach ($e in @(Get-DECfgProp $ext 'forceInstall' | Where-Object { $null -ne $_ })) { $id = Get-DECfgProp $e $b; if ($id) { $force += $(if ($b -eq 'chrome') { "$id;https://clients2.google.com/service/update2/crx" } else { "$id;https://edge.microsoft.com/extensionwebstorebase/v1/crx" }) } }
        $pabx = $null; try { $pabx = Get-DEPkgProp (Get-DEPkgProp (Get-DEPackage -Id 'pabx-policy') 'settings') "pabx_extension_id_$b" } catch { }
        if ($pabx) { $force += $(if ($b -eq 'chrome') { "$pabx;https://clients2.google.com/service/update2/crx" } else { "$pabx;https://edge.microsoft.com/extensionwebstorebase/v1/crx" }) }
        $out.lists[$b]['ExtensionInstallForcelist'] = $force
        $out.lists[$b]['ExtensionInstallAllowlist'] = @(Get-DECfgProp $ext 'allow' | Where-Object { $null -ne $_ })
        $out.lists[$b]['ExtensionInstallBlocklist'] = $(if ($force.Count -or @(Get-DECfgProp $ext 'allow' | Where-Object { $null -ne $_ }).Count) { @(Get-DECfgProp $ext 'block' | Where-Object { $null -ne $_ }) } else { @() })   # never block '*' with an empty allow/force list
        $out.lists[$b]['URLBlocklist'] = @(Get-DECfgProp $p 'urlBlocklist' | Where-Object { $null -ne $_ })
        $out.lists[$b]['URLAllowlist'] = @(Get-DECfgProp $p 'urlAllowlist' | Where-Object { $null -ne $_ })
    }
    $out.default = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'
    return $out
}

function Get-DEBrowserPolicyKey { param([ValidateSet('chrome', 'edge')][string]$Browser) if ($Browser -eq 'chrome') { return 'HKLM:\SOFTWARE\Policies\Google\Chrome' }; return 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' }

function Compare-DEBrowserPolicy {
    param($ClientProfile)
    $want = Get-DEBrowserDesiredPolicy -ClientProfile $ClientProfile
    $drift = @()
    foreach ($b in @('chrome', 'edge')) {
        $key = Get-DEBrowserPolicyKey -Browser $b
        foreach ($k in $want[$b].Keys) { $have = Get-DERegistryValue -Path $key -Name $k; if ("$have" -ne "$($want[$b][$k])") { $drift += "$b.$k" } }
        foreach ($list in $want.lists[$b].Keys) {
            $vals = @(); $sk = Join-Path $key $list
            if ($script:IsWindowsHost -and (Test-Path $sk)) { $vals = @((Get-ItemProperty $sk).PSObject.Properties | Where-Object { $_ -and $_.Name -notmatch '^PS' } | ForEach-Object { "$($_.Value)" }) }
            $w = @($want.lists[$b][$list] | Where-Object { $_ })
            if ((@($w) -join '|') -ne (@($vals) -join '|')) { $drift += "$b.$list" }
        }
    }
    return $drift
}

function Set-DEBrowserPolicy {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile)
    $want = Get-DEBrowserDesiredPolicy -ClientProfile $ClientProfile
    $backups = @()
    foreach ($b in @('chrome', 'edge')) {
        $key = Get-DEBrowserPolicyKey -Browser $b
        $bk = Backup-DERegistryKey -Key ($key -replace '^HKLM:', 'HKLM') -Label "browser-$b"; if ($bk) { $backups += $bk }
        if (-not $PSCmdlet.ShouldProcess($key, 'write browser policy')) { continue }
        foreach ($k in $want[$b].Keys) { $v = $want[$b][$k]; $t = $(if ($v -is [int] -or $v -is [long] -or "$v" -match '^\d+$') { 'DWord' } else { 'String' }); Set-DERegistryValue -Path $key -Name $k -Value $(if ($t -eq 'DWord') { [int]$v } else { "$v" }) -Type $t }
        foreach ($list in $want.lists[$b].Keys) {
            $sk = Join-Path $key $list
            if (Test-Path $sk) { Remove-Item -Path $sk -Recurse -Force }
            $vals = @($want.lists[$b][$list] | Where-Object { $_ })
            if ($vals.Count) { New-Item -Path $sk -Force | Out-Null; for ($i = 0; $i -lt $vals.Count; $i++) { New-ItemProperty -Path $sk -Name ([string]($i + 1)) -Value "$($vals[$i])" -PropertyType String -Force | Out-Null } }
        }
    }
    Set-DEStateValue -Path 'browser.policyBackups' -Value $backups
    return "policy written; backups: $($backups -join ', '); restart browsers to load"
}

function Set-DEDefaultBrowserAssociations {
    <# Windows blocks per-user default changes without the user; DE applies a DefaultAssociationsConfiguration XML (applies at next sign-in). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([ValidateSet('edge', 'chrome')][string]$Browser = 'edge')
    $de = Get-DEConsole
    $prog = $(if ($Browser -eq 'chrome') { 'ChromeHTML' } else { 'MSEdgeHTM' }); $app = $(if ($Browser -eq 'chrome') { 'Google Chrome' } else { 'Microsoft Edge' })
    $xml = @"
<?xml version="1.0" encoding="UTF-8"?>
<DefaultAssociations>
  <Association Identifier=".htm" ProgId="$prog" ApplicationName="$app" />
  <Association Identifier=".html" ProgId="$prog" ApplicationName="$app" />
  <Association Identifier="http" ProgId="$prog" ApplicationName="$app" />
  <Association Identifier="https" ProgId="$prog" ApplicationName="$app" />
</DefaultAssociations>
"@
    $file = Join-Path $de.Dirs.Base 'default-associations.xml'
    if ($PSCmdlet.ShouldProcess($file, "default browser $Browser")) {
        Set-Content -LiteralPath $file -Value $xml -Encoding UTF8
        Set-DERegistryValue -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'DefaultAssociationsConfiguration' -Value $file -Type String
    }
    return "default associations set to $Browser (applies at next sign-in)"
}

function Register-DEBrowserActions {
    param($ClientProfile)
    Register-DEAction -Id 'browser.policy' -Module 'browser' -Title 'Chrome and Edge policy (homepage, bookmarks, extensions, private browsing, downloads, safe browsing)' -Phase 12 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $d = @(Compare-DEBrowserPolicy -ClientProfile $ClientProfile); @{ driftCount = $d.Count; drift = (($d | Select-Object -First 12) -join ', ') } }.GetNewClosure() -Desired { @{ driftCount = 0 } } `
        -Apply { param($s) Set-DEBrowserPolicy -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) $b = @(Get-DEState -Path 'browser.policyBackups'); foreach ($f in $b) { if ($f -and (Test-Path -LiteralPath $f)) { $null = Invoke-DENative -FilePath 'reg.exe' -Arguments @('import', $f) } }; "restored $($b.Count) backup(s)" } `
        -ManualAction 'Restart Chrome and Edge, then open chrome://policy and edge://policy to confirm the values show as Machine / OK.'
    Register-DEAction -Id 'browser.default' -Module 'browser' -Title 'Default browser association' -Phase 12 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $want = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'; if (-not $want) { $want = 'edge' }; $cur = (Get-DEBrowserState).defaultBrowser; $cfg = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'DefaultAssociationsConfiguration'; @{ matches = ($cur -eq $want -or [bool]$cfg); current = $cur; want = $want } }.GetNewClosure() -Desired { @{ matches = $true } } `
        -Apply { param($s) $want = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'; if (-not $want) { $want = 'edge' }; Set-DEDefaultBrowserAssociations -Browser $want }.GetNewClosure()
    Register-DEAction -Id 'browser.updates' -Module 'browser' -Title 'Browsers present and current' -Phase 12 `
        -Detect { $b = Get-DEBrowserState; @{ edge = [bool]$b.edge; chrome = [bool]$b.chrome; edgeVersion = "$(Get-DEHashPath -Object $b -Path 'edge.version')"; chromeVersion = "$(Get-DEHashPath -Object $b -Path 'chrome.version')" } } -Desired { @{ edge = $true; chrome = $true } } `
        -ManualAction 'Install via Apps (edge / chrome packages); both self-update when the update policies are left at 1.'
}

# ================================================================== BRANDING
function Get-DEBrandingAssets {
    param($ClientProfile)
    $de = Get-DEConsole
    $deLogo = Join-Path $de.Root 'assets\brand\digerati-logo-600.png'
    if (-not (Test-Path -LiteralPath $deLogo)) { $deLogo = Join-Path $de.Root 'assets\de-logo.png' }
    $client = Get-DEHashPath -Object $ClientProfile -Path 'branding.clientLogo'
    if ($client -and $client -like 'asset:*') {
        $assetRel = $client.Substring(6).TrimStart('/', '\\').Replace('/', '\\')
        $client = Join-Path (Join-Path $de.Root 'assets') $assetRel
    } elseif ($client -and -not [IO.Path]::IsPathRooted($client)) {
        $client = Join-Path $de.Dirs.Profiles $client
    }
    return @{ deLogo = $(if (Test-Path -LiteralPath $deLogo) { $deLogo } else { $null }); clientLogo = $(if ($client -and (Test-Path -LiteralPath $client)) { $client } else { $null }) }
}

function New-DEBrandedWallpaper {
    <# Renders a 16:9 wallpaper (graphite, magenta rule, both logos, support line) with System.Drawing; returns the file path. #>
    param($ClientProfile, [int]$Width = 2560, [int]$Height = 1440, [string]$OutFile, [switch]$LockScreen)
    Add-Type -AssemblyName System.Drawing
    $de = Get-DEConsole
    if (-not $OutFile) { $OutFile = Join-Path $de.Dirs.Base ("branding\{0}-{1}.png" -f $(if ($LockScreen) { 'lockscreen' } else { 'wallpaper' }), (Get-Date -Format 'yyyyMMddHHmmss')) }
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force | Out-Null
    $assets = Get-DEBrandingAssets -ClientProfile $ClientProfile
    $accentHex = Get-DEHashPath -Object $ClientProfile -Path 'branding.accent'; if (-not $accentHex) { $accentHex = '#D3126A' }
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'
        $bg = [System.Drawing.ColorTranslator]::FromHtml('#050312'); $g.Clear($bg)
        $glow = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $Width, $Height), [System.Drawing.Color]::FromArgb(40, 124, 58, 237), [System.Drawing.Color]::FromArgb(0, 5, 3, 18))
        $g.FillRectangle($glow, 0, 0, $Width, $Height)
        $accent = [System.Drawing.ColorTranslator]::FromHtml($accentHex)
        $g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), [int]($Width * 0.08), [int]($Height * 0.72), 8, [int]($Height * 0.12))
        $x = [int]($Width * 0.08) + 40; $y = [int]($Height * 0.72)
        foreach ($logo in @($assets.clientLogo, $assets.deLogo)) {
            if (-not $logo) { continue }
            $img = [System.Drawing.Image]::FromFile($logo)
            try { $h = [int]($Height * 0.06); $w = [int]($img.Width * ($h / $img.Height)); $g.DrawImage($img, $x, $y, $w, $h); $x += $w + 60 } finally { $img.Dispose() }
        }
        $fontFamily = 'Segoe UI'; try { $null = New-Object System.Drawing.FontFamily 'Space Grotesk'; $fontFamily = 'Space Grotesk' } catch { }
        $f1 = New-Object System.Drawing.Font($fontFamily, [single]($Height * 0.022), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $f2 = New-Object System.Drawing.Font($fontFamily, [single]($Height * 0.016), [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
        $paper = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#F7F5F2'))
        $muted = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(160, 247, 245, 242))
        $name = "$(Get-DEHashPath -Object $ClientProfile -Path 'name')"
        $support = "$(Get-DEHashPath -Object $ClientProfile -Path 'branding.supportText')"; if (-not $support) { $support = 'Support: support@digeratiexperts.com' }
        $g.DrawString($(if ($name) { "$name  |  managed by Digerati Experts" } else { 'Managed by Digerati Experts' }), $f1, $paper, [single]([int]($Width * 0.08) + 40), [single]($y + [int]($Height * 0.075)))
        $g.DrawString($support, $f2, $muted, [single]([int]($Width * 0.08) + 40), [single]($y + [int]($Height * 0.105)))
        if (-not $LockScreen) { $g.DrawString($env:COMPUTERNAME, $f2, $muted, [single]($Width - [int]($Width * 0.08) - 300), [single]($Height - [int]($Height * 0.06))) }
    } finally { $g.Dispose() }
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    return $OutFile
}

function Get-DEBrandingState {
    $wall = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP' -Name 'DesktopImagePath'
    $lock = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP' -Name 'LockScreenImagePath'
    $oem = @{ manufacturer = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'Manufacturer'); supportUrl = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'SupportURL'); supportPhone = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'SupportPhone') }
    return @{ wallpaper = $wall; lockScreen = $lock; applied = [bool]($wall -and "$wall" -match '\\DE\\'); oem = $oem; hostname = $env:COMPUTERNAME }
}

function Set-DEBranding {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile, [string]$Wallpaper, [string]$LockScreen)
    $de = Get-DEConsole
    $before = Get-DEBrandingState
    Set-DEStateValue -Path 'branding.previous' -Value $before
    $dest = Join-Path $env:ProgramData 'DE\Branding'
    if (-not $PSCmdlet.ShouldProcess('desktop and lock screen', 'apply DE branding')) { return 'planned' }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    if (-not $Wallpaper) { $Wallpaper = New-DEBrandedWallpaper -ClientProfile $ClientProfile }
    if (-not $LockScreen) { $LockScreen = New-DEBrandedWallpaper -ClientProfile $ClientProfile -LockScreen }
    $w = Join-Path $dest 'wallpaper.png'; $l = Join-Path $dest 'lockscreen.png'
    Copy-Item -LiteralPath $Wallpaper -Destination $w -Force; Copy-Item -LiteralPath $LockScreen -Destination $l -Force
    $csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
    Set-DERegistryValue -Path $csp -Name 'DesktopImagePath' -Value $w -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageUrl' -Value $w -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageStatus' -Value 1 -Type DWord
    Set-DERegistryValue -Path $csp -Name 'LockScreenImagePath' -Value $l -Type String; Set-DERegistryValue -Path $csp -Name 'LockScreenImageUrl' -Value $l -Type String; Set-DERegistryValue -Path $csp -Name 'LockScreenImageStatus' -Value 1 -Type DWord
    $oem = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation'
    Set-DERegistryValue -Path $oem -Name 'Manufacturer' -Value 'Managed by Digerati Experts' -Type String
    Set-DERegistryValue -Path $oem -Name 'SupportURL' -Value 'https://portal.digeratiexperts.com/portal/login' -Type String
    Set-DERegistryValue -Path $oem -Name 'SupportHours' -Value 'Monday to Friday, 8:00 to 17:00 (Arizona)' -Type String
    return "wallpaper $w; lock screen $l; OEM support info set (applies at next sign-in)"
}

function Undo-DEBranding {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $prev = Get-DEState -Path 'branding.previous'
    if (-not $PSCmdlet.ShouldProcess('branding', 'restore previous')) { return 'planned' }
    $csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
    foreach ($n in @('DesktopImagePath', 'DesktopImageUrl', 'DesktopImageStatus', 'LockScreenImagePath', 'LockScreenImageUrl', 'LockScreenImageStatus')) { Remove-ItemProperty -Path $csp -Name $n -ErrorAction SilentlyContinue }
    if ($prev -and (Get-DECfgProp $prev 'wallpaper')) { Set-DERegistryValue -Path $csp -Name 'DesktopImagePath' -Value (Get-DECfgProp $prev 'wallpaper') -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageStatus' -Value 1 -Type DWord }
    $oem = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation'
    foreach ($n in @('Manufacturer', 'SupportURL', 'SupportHours')) { $pv = Get-DEHashPath -Object $prev -Path "oem.$($n.Substring(0,1).ToLower() + $n.Substring(1))"; if ($pv) { Set-DERegistryValue -Path $oem -Name $n -Value $pv -Type String } else { Remove-ItemProperty -Path $oem -Name $n -ErrorAction SilentlyContinue } }
    return 'branding restored to the recorded previous state'
}

function New-DEHostname {
    param($ClientProfile, [string]$Role = 'LAP')
    $pattern = Get-DEHashPath -Object $ClientProfile -Path 'branding.hostnamePattern'; if (-not $pattern) { $pattern = '{CLIENT}-{ROLE}-{SERIAL4}' }
    $serial = "$((Get-DEDeviceInventory).serial)" -replace '[^A-Za-z0-9]', ''
    $client = "$(Get-DEHashPath -Object $ClientProfile -Path 'shortName')" -replace '[^A-Za-z0-9]', ''
    $name = $pattern.Replace('{CLIENT}', $client.ToUpperInvariant()).Replace('{ROLE}', $Role.ToUpperInvariant()).Replace('{SERIAL4}', $(if ($serial.Length -ge 4) { $serial.Substring($serial.Length - 4).ToUpperInvariant() } else { $serial.ToUpperInvariant() })).Replace('{SERIAL}', $serial.ToUpperInvariant())
    if ($name.Length -gt 15) { $name = $name.Substring(0, 15) }
    return $name.TrimEnd('-')
}

# ------------------------------------------------------------------ quick control / support shortcuts
function Get-DEShortcutDefinitions {
    param($ClientProfile)
    $all = @(
        @{ id = 'client-portal'; name = 'DE Client Portal'; url = 'https://portal.digeratiexperts.com/portal/login' }
        @{ id = 'support-ticket'; name = 'DE Support - open a ticket'; url = 'https://portal.digeratiexperts.com/portal/login' }
        @{ id = 'remote-support'; name = 'DE Remote Support'; url = 'https://console.jumpcloud.com/userconsole' }
        @{ id = 'book-time'; name = 'DE - book time'; url = 'https://meet.digerati-experts.com/' }
    )
    $want = @(Get-DEHashPath -Object $ClientProfile -Path 'branding.shortcuts' | Where-Object { $null -ne $_ }); if (-not $want.Count) { $want = @('client-portal', 'support-ticket', 'remote-support') }
    return @($all | Where-Object { $_ -and $want -contains $_.id })
}
function Set-DESupportShortcuts {
    <# One Start-menu folder and one desktop shortcut, not a desktop covered in icons. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile)
    $defs = Get-DEShortcutDefinitions -ClientProfile $ClientProfile
    $start = Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts'
    $desk = Join-Path $env:PUBLIC 'Desktop'
    if (-not $PSCmdlet.ShouldProcess($start, "create $($defs.Count) shortcut(s)")) { return 'planned' }
    New-Item -ItemType Directory -Path $start -Force | Out-Null
    foreach ($d in $defs) { Set-Content -LiteralPath (Join-Path $start "$($d.name).url") -Value "[InternetShortcut]`r`nURL=$($d.url)`r`n" -Encoding ASCII }
    $primary = $defs | Select-Object -First 1
    if ($primary) { Set-Content -LiteralPath (Join-Path $desk 'DE Support.url') -Value "[InternetShortcut]`r`nURL=$($primary.url)`r`n" -Encoding ASCII }
    return "Start menu folder with $($defs.Count) shortcut(s); one desktop shortcut"
}

function Register-DEBrandingActions {
    param($ClientProfile)
    Register-DEAction -Id 'branding.apply' -Module 'branding' -Title 'DE and client branding (wallpaper, lock screen, OEM support info)' -Phase 13 -Gates @('gate.elevated') -RequiresElevation -Modes @('new', 'dropship', 'takeover', 'replacement', 'repair') `
        -Detect { $s = Get-DEBrandingState; @{ applied = $s.applied } } -Desired { @{ applied = $true } } `
        -Apply { param($s) Set-DEBranding -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) Undo-DEBranding } -ManualAction 'Preview the wallpaper in the Branding page before applying.'
    Register-DEAction -Id 'branding.shortcuts' -Module 'branding' -Title 'DE support shortcuts (Start folder + one desktop link)' -Phase 13 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { @{ present = (Test-Path -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts')) } } -Desired { @{ present = $true } } `
        -Apply { param($s) Set-DESupportShortcuts -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) Remove-Item -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts') -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Join-Path $env:PUBLIC 'Desktop\DE Support.url') -Force -ErrorAction SilentlyContinue; 'removed' }
    Register-DEAction -Id 'branding.hostname' -Module 'branding' -Title 'Hostname follows the client pattern' -Phase 13 -Gates @('gate.elevated') -RequiresElevation -RequiresReboot -Modes @('new', 'dropship', 'replacement') `
        -Detect { $ctx = Get-DEContext; $want = $(if ($ctx['device'] -and $ctx['device'].desiredHostname) { $ctx['device'].desiredHostname } else { New-DEHostname -ClientProfile $ClientProfile -Role "$(if ($ctx['device']) { $ctx['device'].role } else { 'LAP' })".Substring(0, 3) }); @{ matches = ($env:COMPUTERNAME -ieq $want); want = $want } }.GetNewClosure() -Desired { @{ matches = $true } } `
        -Apply { param($s) $want = $s.Detected.want; Rename-Computer -NewName $want -Force; "renamed to $want (restart required)" }
}

Export-ModuleMember -Function Get-DEBaselineControls, Get-DEBaselineControlState, Set-DEBaselineControl, Invoke-DEBaselineAssessment, Register-DEBaselineActions, Get-DEBrowserPolicyProfile, Get-DEBrowserDesiredPolicy, Compare-DEBrowserPolicy, Set-DEBrowserPolicy, Set-DEDefaultBrowserAssociations, Register-DEBrowserActions, Get-DEBrandingAssets, New-DEBrandedWallpaper, Get-DEBrandingState, Set-DEBranding, Undo-DEBranding, New-DEHostname, Get-DEShortcutDefinitions, Set-DESupportShortcuts, Register-DEBrandingActions
