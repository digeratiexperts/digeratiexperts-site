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

# ---- per-user policy: every real profile's hive plus Default (new users), never just the hive of whoever runs the tool
function Open-DEUserHives {
    <#
        Registry roots for per-user settings: each real user's hive (loaded ones under HKU; unloaded ones loaded from
        NTUSER.DAT) and the Default profile so new users get the setting too. Running as SYSTEM, from RMM, or as the
        technician, HKCU is the wrong account. Returns @{ targets; loaded } ; pass it to Close-DEUserHives.
    #>
    $targets = @(); $loaded = @(); $failed = @()
    if (-not $script:IsWindowsHost) { return @{ targets = $targets; loaded = $loaded; failed = $failed } }
    $real = '^S-1-(5-21-\d+-\d+-\d+-\d+|12-1-\d+-\d+-\d+-\d+)$'
    $present = @(Get-ChildItem -Path 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Where-Object { $_ -match $real })
    foreach ($sid in $present) { $targets += @{ sid = $sid; root = "Registry::HKEY_USERS\$sid"; name = $sid } }
    foreach ($p in @(Get-ChildItem -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' -ErrorAction SilentlyContinue)) {
        $sid = $p.PSChildName; if ($sid -notmatch $real -or $present -contains $sid) { continue }
        $dir = (Get-ItemProperty -LiteralPath $p.PSPath -Name 'ProfileImagePath' -ErrorAction SilentlyContinue).ProfileImagePath
        $hive = $(if ($dir) { Join-Path ([Environment]::ExpandEnvironmentVariables($dir)) 'NTUSER.DAT' } else { $null })
        if (-not $hive -or -not (Test-Path -LiteralPath $hive)) { continue }
        $mount = "DE_$($sid -replace '-', '_')"
        $r = Invoke-DENative -FilePath 'reg.exe' -Arguments @('load', "HKU\$mount", $hive)
        if ($r.ExitCode -eq 0) { $loaded += $mount; $targets += @{ sid = $sid; root = "Registry::HKEY_USERS\$mount"; name = (Split-Path -Leaf $dir) } } else { $failed += (Split-Path -Leaf $dir) }
    }
    $def = Join-Path $env:SystemDrive 'Users\Default\NTUSER.DAT'
    if (Test-Path -LiteralPath $def) { $r = Invoke-DENative -FilePath 'reg.exe' -Arguments @('load', 'HKU\DE_Default', $def); if ($r.ExitCode -eq 0) { $loaded += 'DE_Default'; $targets += @{ sid = 'Default'; root = 'Registry::HKEY_USERS\DE_Default'; name = 'Default (new users)' } } }
    return @{ targets = $targets; loaded = $loaded; failed = $failed }
}
function Close-DEUserHives {
    param([Parameter(Mandatory = $true)]$Hives)
    foreach ($m in @($Hives.loaded)) { for ($i = 0; $i -lt 5; $i++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers(); $r = Invoke-DENative -FilePath 'reg.exe' -Arguments @('unload', "HKU\$m"); if ($r.ExitCode -eq 0) { break }; Start-Sleep -Milliseconds 400 } }
}
function Clear-DEStaleUserHives {
    <# Unloads any HKU\DE_* hive this tool left loaded (a crash between load and unload); ADMU cannot migrate a profile whose NTUSER.DAT is loaded. Returns what is still loaded. #>
    if (-not $script:IsWindowsHost) { return @() }
    $left = @(Get-ChildItem -Path 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Where-Object { $_ -like 'DE_*' })
    if ($left.Count) { Close-DEUserHives -Hives @{ loaded = $left } }
    return @(Get-ChildItem -Path 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Where-Object { $_ -like 'DE_*' })
}
function Get-DEUserPolicyPath { param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Path) return ($Root + '\' + ($Path -replace '^HKCU:\\?', '')) }
function Get-DEUserScopeState {
    <# A per-user registry control across every profile: ok only when all of them have the value. $null when there is nothing to check (not Windows). #>
    param([Parameter(Mandatory = $true)]$Control)
    $h = Open-DEUserHives
    try {
        $failed = @($h['failed'] | Where-Object { $_ })
        if (-not $h.targets.Count -and -not $failed.Count) { return $null }
        # a profile whose hive could not be loaded (locked or corrupt NTUSER.DAT) was not checked: never 'set for all'
        $miss = @($failed | ForEach-Object { "$_ (hive not loaded)" }); foreach ($t in $h.targets) { $v = Get-DERegistryValue -Path (Get-DEUserPolicyPath -Root $t.root -Path $Control.path) -Name $Control.name; if ("$v" -ne "$($Control.value)") { $miss += $t.name } }
        return @{ ok = (-not $miss.Count); have = "$($h.targets.Count + $failed.Count - $miss.Count) of $($h.targets.Count + $failed.Count) profiles"; detail = $(if ($miss.Count) { "missing for: $($miss -join ', ')" } else { "set for all $($h.targets.Count) profiles including Default" }) }
    } finally { Close-DEUserHives -Hives $h }
}
function Set-DEUserScopeControl {
    <# Writes a per-user registry control into every profile (recording each previous value for rollback). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Control)
    if (-not $PSCmdlet.ShouldProcess($Control.title, "set for every user profile and Default")) { return 'planned' }
    $h = Open-DEUserHives
    try {
        $prev = @{}; $n = 0
        foreach ($t in $h.targets) {
            $path = Get-DEUserPolicyPath -Root $t.root -Path $Control.path
            $old = Get-DERegistryValue -Path $path -Name $Control.name; $prev[$t.sid] = @{ existed = ($null -ne $old); value = $old }
            Set-DERegistryValue -Path $path -Name $Control.name -Value $Control.value -Type $Control.valueType -Confirm:$false; $n++
        }
        if (-not (Get-DEState -Path "baseline.previous.$($Control.id)")) { Set-DEStateValue -Path "baseline.previous.$($Control.id)" -Value @{ users = $prev } }
        return "set for $n profile(s) including Default"
    } finally { Close-DEUserHives -Hives $h }
}
function Undo-DEUserScopeControl {
    param([Parameter(Mandatory = $true)]$Control)
    $pv = Get-DEState -Path "baseline.previous.$($Control.id)"; $users = $(if ($pv) { Get-DEHashPath -Object $pv -Path 'users' } else { $null })
    if (-not $users) { return @{ ok = $false; detail = 'no previous values were recorded before the change' } }
    $h = Open-DEUserHives; $bad = @()
    try {
        foreach ($t in $h.targets) {
            $u = Get-DEHashPath -Object $users -Path $t.sid; if (-not $u) { continue }
            $path = Get-DEUserPolicyPath -Root $t.root -Path $Control.path
            if (Get-DEHashPath -Object $u -Path 'existed') { Set-DERegistryValue -Path $path -Name $Control.name -Value (Get-DEHashPath -Object $u -Path 'value') -Type $Control.valueType -Confirm:$false } else { Remove-ItemProperty -Path $path -Name $Control.name -ErrorAction SilentlyContinue }
            $now = Get-DERegistryValue -Path $path -Name $Control.name
            $ok = $(if (Get-DEHashPath -Object $u -Path 'existed') { "$now" -eq "$(Get-DEHashPath -Object $u -Path 'value')" } else { $null -eq $now }); if (-not $ok) { $bad += $t.name }
        }
    } finally { Close-DEUserHives -Hives $h }
    if (-not $bad.Count) { Set-DEStateValue -Path "baseline.previous.$($Control.id)" -Value $null }
    return @{ ok = (-not $bad.Count); detail = $(if ($bad.Count) { "not restored for: $($bad -join ', ')" } else { 'previous values restored for every profile' }) }
}

function Get-DEBaselineControlState {
    param([Parameter(Mandatory = $true)]$Control)
    $want = $Control.value; $have = $null; $ok = $false; $detail = ''
    if ($Control.type -eq 'registry' -and "$($Control.scope)" -eq 'user') { $u = Get-DEUserScopeState -Control $Control; if ($u) { return @{ id = $Control.id; title = $Control.title; cis = $Control.cis; want = $want; have = $u.have; ok = $u.ok; detail = $u.detail } } }
    switch ($Control.type) {
        'registry' { $have = Get-DERegistryValue -Path $Control.path -Name $Control.name; $ok = ("$have" -eq "$want"); $detail = "$($Control.path)\$($Control.name) = $have" }
        'firewall' { if ($script:IsWindowsHost) { try { $fp = Get-NetFirewallProfile -Name $Control.profile -ErrorAction Stop; $have = [bool]($fp.Enabled -eq 'True' -or $fp.Enabled -eq $true); $ok = ($have -eq [bool]$want); $detail = "$($Control.profile) enabled=$have" } catch { $detail = $_.Exception.Message } } }
        'localuser' { if ($script:IsWindowsHost) { try { $u = Get-LocalUser -Name $Control.name -ErrorAction Stop; $have = $(if ($u.Enabled) { 'Enabled' } else { 'Disabled' }); $ok = ($have -eq $want) } catch { if ($_.Exception.GetType().Name -eq 'UserNotFoundException' -or "$($_.FullyQualifiedErrorId)" -like 'UserNotFound*') { $have = 'absent'; $ok = $true } else { $have = "unknown ($($_.Exception.Message))"; $ok = $false } } ; $detail = "$($Control.name) $have" } }
        'netaccounts' { if ($script:IsWindowsHost) { $sp = Get-DELocalSecurityPolicy; $n = $(if ($Control.setting -eq 'lockoutthreshold') { $sp['LockoutBadCount'] } else { $sp['MinimumPasswordLength'] }); $have = $(if ($null -eq $n) { 'unknown' } else { [int]$n }); $ok = ($have -is [int] -and $(if ($Control.setting -eq 'lockoutthreshold') { $have -gt 0 -and $have -le [int]$want } else { $have -ge [int]$want })); $detail = "$($Control.setting) = $have (secedit)" } }
        'auditpol' { if ($script:IsWindowsHost) { $v = Get-DEAuditSettingValue -Subcategory $Control.subcategory; $have = $(switch ($v) { 0 { 'No Auditing' } 1 { 'Success' } 2 { 'Failure' } 3 { 'Success and Failure' } default { 'unknown' } }); $ok = ($null -ne $v -and ($(if ($want -match 'Failure') { ($v -band 2) } else { $true })) -and ($(if ($want -match 'Success') { ($v -band 1) } else { $true }))); $detail = "$($Control.subcategory) = $have (setting value $v)" } }
        'command' { if ($script:IsWindowsHost -and $Control.detect -like 'optionalfeature:*') { $f = $Control.detect.Split(':')[1]; try { $feat = Get-WindowsOptionalFeature -Online -FeatureName $f -ErrorAction Stop; $have = $(if ($feat) { "$($feat.State)" } else { 'absent' }); $ok = ($have -eq $want -or $have -in @('DisabledWithPayloadRemoved', 'absent')) } catch { $have = 'unknown'; $detail = $_.Exception.Message } ; $detail = "$f $have$(if ($have -eq 'absent') { ' (removed from this Windows build)' })" } }
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

# ---- Windows pre-logon authorized-use notice
$script:LogonNoticePath = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
$script:LogonNoticeCaptionName = 'LegalNoticeCaption'
$script:LogonNoticeTextName = 'LegalNoticeText'

function ConvertTo-DELogonNoticeText {
    param([AllowNull()][AllowEmptyString()][string]$Text)
    if ($null -eq $Text) { return '' }
    return (($Text -replace "`r`n", "`n" -replace "`r", "`n").Trim())
}

function Get-DELogonNoticeDesired {
    param([Parameter(Mandatory = $true)]$ClientProfile)
    $cfg = Get-DEHashPath -Object $ClientProfile -Path 'windows.logonNotice'
    $mode = "$(Get-DECfgProp $cfg 'mode')".Trim().ToLowerInvariant()
    if (-not $mode) { $mode = 'default' }
    if ($mode -notin @('default', 'custom', 'disabled')) { throw "windows.logonNotice.mode must be default, custom, or disabled (got '$mode')" }
    if ($mode -eq 'disabled') {
        $reason = "$(Get-DECfgProp $cfg 'disabledReason')".Trim()
        if (-not $reason) { throw 'windows.logonNotice.disabledReason is required when mode is disabled' }
        return [pscustomobject][ordered]@{ mode = $mode; enabled = $false; caption = ''; text = ''; disabledReason = $reason }
    }

    $caption = "$(Get-DECfgProp $cfg 'caption')".Trim()
    if (-not $caption) { $caption = 'AUTHORIZED USE & SECURITY MONITORING NOTICE' }
    if ($caption.IndexOf([char]0) -ge 0) { throw 'windows.logonNotice.caption cannot contain a NUL character' }

    $body = "$(Get-DECfgProp $cfg 'body')"
    if ($mode -eq 'custom') {
        $body = ConvertTo-DELogonNoticeText -Text $body
        if (-not $body) { throw 'windows.logonNotice.body is required when mode is custom' }
    } else {
        $organization = "$(Get-DEHashPath -Object $ClientProfile -Path 'name')".Trim()
        if (-not $organization) { $organization = 'this organization' }
        $isDE = ($organization -ieq 'Digerati Experts')
        $providerParagraph = $(if ($isDE) { 'Security and system activity may be collected, retained, and reviewed by authorized Digerati Experts personnel and approved technology service providers for the protection and operation of this environment.' } else { 'Security and system activity may be collected, retained, and reviewed by authorized personnel and approved technology service providers, including Digerati Experts where applicable, for the protection and operation of this environment.' })
        $contactParagraph = $(if ($isDE) { 'If you are not an authorized user, do not continue. Contact Digerati Experts for assistance.' } else { "If you are not an authorized user, do not continue. Contact $organization or Digerati Experts for assistance." })
        $paragraphs = @(
            "This computer system and associated resources are for authorized $organization business use only. Access or use without authorization, or beyond the scope of granted authorization, is prohibited.",
            'By selecting OK and continuing, you acknowledge that use of this system may be monitored, logged, inspected, and remotely administered for cybersecurity, technical support, system management, compliance, and incident investigation purposes, consistent with applicable law and organizational policy.',
            $providerParagraph,
            'Unauthorized or improper use may result in loss of access or other action permitted by organizational policy or applicable law. Information concerning suspected unlawful activity may be preserved or disclosed as permitted or required by law.',
            $contactParagraph
        )
        $body = ConvertTo-DELogonNoticeText -Text ($paragraphs -join "`r`n`r`n")
    }
    if ($body.IndexOf([char]0) -ge 0) { throw 'windows.logonNotice.body cannot contain a NUL character' }
    return [pscustomobject][ordered]@{ mode = $mode; enabled = $true; caption = $caption; text = $body }
}

function Get-DELogonNoticeState {
    param([Parameter(Mandatory = $true)]$ClientProfile)
    $want = Get-DELogonNoticeDesired -ClientProfile $ClientProfile
    $caption = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeCaptionName
    $text = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeTextName
    $haveCaption = $(if ($null -eq $caption) { '' } else { "$caption".Trim() })
    $haveText = ConvertTo-DELogonNoticeText -Text $(if ($null -eq $text) { '' } else { "$text" })
    $ok = $(if (-not $want.enabled) { (-not $haveCaption -and -not $haveText) } else { ($haveCaption -ceq $want.caption) -and ($haveText -ceq $want.text) })
    $detail = $(if ($ok -and $want.enabled) { "pre-logon notice matches the $($want.mode) client policy" } elseif ($ok) { 'pre-logon notice is disabled by client policy and no notice is configured' } elseif (-not $want.enabled) { 'client policy disables the pre-logon notice, but Windows still has notice text configured' } elseif (-not $haveCaption -and -not $haveText) { 'Windows has no pre-logon notice configured' } else { 'Windows pre-logon notice differs from the client policy' })
    return [pscustomobject][ordered]@{ ok = [bool]$ok; mode = $want.mode; enabled = [bool]$want.enabled; caption = $haveCaption; text = $haveText; desiredCaption = $want.caption; desiredText = $want.text; detail = $detail }
}

function Set-DELogonNotice {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$ClientProfile)
    $want = Get-DELogonNoticeDesired -ClientProfile $ClientProfile
    if (-not $PSCmdlet.ShouldProcess('Windows sign-in', $(if ($want.enabled) { 'set the pre-logon authorized-use notice' } else { 'remove the pre-logon notice per client policy' }))) { return 'planned' }
    if (-not (Get-DEState -Path 'logonNotice.previous')) {
        $oldCaption = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeCaptionName
        $oldText = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeTextName
        $backup = Backup-DERegistryKey -Key 'HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -Label 'logon-notice'
        Set-DEStateValue -Path 'logonNotice.previous' -Value @{ caption = @{ existed = ($null -ne $oldCaption); value = $oldCaption }; text = @{ existed = ($null -ne $oldText); value = $oldText }; backup = $backup; at = (Get-Date).ToString('o') }
    }
    if ($want.enabled) {
        Set-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeCaptionName -Value $want.caption -Type String -Confirm:$false
        Set-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeTextName -Value $want.text -Type String -Confirm:$false
    } else {
        Remove-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeCaptionName -Confirm:$false
        Remove-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeTextName -Confirm:$false
    }
    $after = Get-DELogonNoticeState -ClientProfile $ClientProfile
    if (-not $after.ok) { throw "pre-logon notice did not verify after apply: $($after.detail)" }
    return $after.detail
}

function Undo-DELogonNotice {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    if (-not $PSCmdlet.ShouldProcess('Windows sign-in', 'restore the pre-DE pre-logon notice values')) { return 'planned' }
    $prev = Get-DEState -Path 'logonNotice.previous'
    if (-not $prev) { return @{ ok = $false; detail = 'no previous pre-logon notice values were recorded' } }
    foreach ($pair in @(
        @{ name = $script:LogonNoticeCaptionName; key = 'caption' },
        @{ name = $script:LogonNoticeTextName; key = 'text' }
    )) {
        $entry = Get-DEHashPath -Object $prev -Path $pair.key
        if (Get-DEHashPath -Object $entry -Path 'existed') { Set-DERegistryValue -Path $script:LogonNoticePath -Name $pair.name -Value "$(Get-DEHashPath -Object $entry -Path 'value')" -Type String -Confirm:$false } else { Remove-DERegistryValue -Path $script:LogonNoticePath -Name $pair.name -Confirm:$false }
    }
    $captionPrev = Get-DEHashPath -Object $prev -Path 'caption'; $textPrev = Get-DEHashPath -Object $prev -Path 'text'
    $captionNow = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeCaptionName; $textNow = Get-DERegistryValue -Path $script:LogonNoticePath -Name $script:LogonNoticeTextName
    $captionOk = $(if (Get-DEHashPath -Object $captionPrev -Path 'existed') { "$captionNow" -ceq "$(Get-DEHashPath -Object $captionPrev -Path 'value')" } else { $null -eq $captionNow })
    $textOk = $(if (Get-DEHashPath -Object $textPrev -Path 'existed') { (ConvertTo-DELogonNoticeText -Text "$textNow") -ceq (ConvertTo-DELogonNoticeText -Text "$(Get-DEHashPath -Object $textPrev -Path 'value')") } else { $null -eq $textNow })
    $ok = [bool]($captionOk -and $textOk)
    if ($ok) { Set-DEStateValue -Path 'logonNotice.previous' -Value $null }
    return @{ ok = $ok; detail = $(if ($ok) { 'pre-DE pre-logon notice values restored' } else { 'pre-logon notice rollback could not be verified' }) }
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
    # the Windows automatic-update setting is DE Tech Tool's to enforce only when the client's update authority is
    # 'windows'; JumpCloud (the default) and Intune enforce their own, and maint.update-authority checks whichever it is
    $authority = "$(Get-DEHashPath -Object $ClientProfile -Path 'updates.authority')"; if (-not $authority) { $authority = 'jumpcloud' }
    Register-DEAction -Id 'baseline.logon-notice' -Module 'baseline' -Title 'Pre-logon authorized-use and security-monitoring notice' -Phase 11 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $s = Get-DELogonNoticeState -ClientProfile $ClientProfile; @{ ok = $s.ok; mode = $s.mode; enabled = $s.enabled; detail = $s.detail } }.GetNewClosure() `
        -Desired { @{ ok = $true } } `
        -Compare { param($d, $w) if ($d.ok) { @() } else { @("$($d.detail)") } } `
        -Verify { param($after) $s = Get-DELogonNoticeState -ClientProfile $ClientProfile; @{ ok = $s.ok; detail = $s.detail } }.GetNewClosure() `
        -Apply { param($s) Set-DELogonNotice -ClientProfile $ClientProfile -Confirm:$false }.GetNewClosure() `
        -Rollback { param($s) Undo-DELogonNotice -Confirm:$false } `
        -ManualAction 'Default wording is DE-maintained. Client-specific approved wording lives in windows.logonNotice; custom mode requires an explicit body.'
    foreach ($c in Get-DEBaselineControls -Profile $profileName) {
        $ctl = $c
        if ($ctl.id -eq 'wu-auto' -and $authority -ne 'windows') { continue }
        $gates = @('gate.elevated')   # per-user controls too: they write every profile's hive, not just the current user's
        Register-DEAction -Id "baseline.$($ctl.id)" -Module 'baseline' -Title $ctl.title -Phase 11 -Gates $gates -RequiresElevation `
            -Detect { $s = Get-DEBaselineControlState -Control $ctl; @{ ok = $s.ok; have = "$($s.have)"; detail = $s.detail } }.GetNewClosure() `
            -Desired { @{ ok = $true } } `
            -Apply { param($s) if ($ctl.type -eq 'registry' -and "$($ctl.scope)" -eq 'user' -and $env:OS -eq 'Windows_NT') { return (Set-DEUserScopeControl -Control $ctl) }; $bk = $null; if ($ctl.type -eq 'registry') { $bk = Backup-DERegistryKey -Key (($ctl.path -replace '^HKLM:', 'HKLM') -replace '^HKCU:', 'HKCU') -Label "baseline-$($ctl.id)"; if (-not (Get-DEState -Path "baseline.previous.$($ctl.id)")) { Set-DEStateValue -Path "baseline.previous.$($ctl.id)" -Value @{ existed = ($null -ne (Get-DERegistryValue -Path $ctl.path -Name $ctl.name)); value = (Get-DERegistryValue -Path $ctl.path -Name $ctl.name); backup = $bk } } }; $r = Set-DEBaselineControl -Control $ctl; "$r$(if ($bk) { "; backup $bk" })" }.GetNewClosure() `
            -Rollback { param($s) if ($ctl.type -eq 'registry' -and "$($ctl.scope)" -eq 'user' -and $env:OS -eq 'Windows_NT') { return (Undo-DEUserScopeControl -Control $ctl) }; if ($ctl.type -ne 'registry') { return "Undo '$($ctl.title)' by hand: $($ctl.type) controls have no automatic rollback." }; $pv = Get-DEState -Path "baseline.previous.$($ctl.id)"; if (-not $pv) { return @{ ok = $false; detail = 'no previous value was recorded before the change' } }; if ($pv['existed']) { Set-DERegistryValue -Path $ctl.path -Name $ctl.name -Value $pv['value'] -Type $ctl.valueType } else { Remove-ItemProperty -Path $ctl.path -Name $ctl.name -ErrorAction SilentlyContinue }; $now = Get-DERegistryValue -Path $ctl.path -Name $ctl.name; $ok = $(if ($pv['existed']) { "$now" -eq "$($pv['value'])" } else { $null -eq $now }); if ($ok) { Set-DEStateValue -Path "baseline.previous.$($ctl.id)" -Value $null }; @{ ok = $ok; detail = "$($ctl.path)\$($ctl.name) is now '$now' (before DE: $(if ($pv['existed']) { "'$($pv['value'])'" } else { 'not set' }))" } }.GetNewClosure() `
            -ManualAction $(if (Get-DECfgProp $ctl 'breaks') { "Known conflict: $($ctl.breaks) Record an exception with approver and expiry if the client needs it." } else { '' })
    }
}

# ================================================================== BROWSER
function Get-DEBrowserPolicyProfile { param([string]$Name = 'de-browser-policy') $b = Get-DECatalogJson 'browser-policy.json'; $p = Get-DECfgProp $b.profiles $Name; if (-not $p) { throw "browser policy profile '$Name' not found" }; return $p }

function Get-DEBrowserControlCatalog { return (Get-DECfgProp (Get-DECatalogJson 'browser-policy.json') 'control') }
function Get-DEChromiumBrowsers {
    <# Chromium browsers DE manages: Chrome and Edge always (policy is harmless when absent), Brave when installed or listed by the client. #>
    param($ClientProfile)
    $list = @('chrome', 'edge')
    $want = @(Get-DEHashPath -Object $ClientProfile -Path 'browser.browsers' | Where-Object { $_ })
    $braveHere = $script:IsWindowsHost -and ((Test-Path -LiteralPath "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe") -or (Test-Path -LiteralPath "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe"))
    if ($braveHere -or $want -contains 'brave') { $list += 'brave' }
    return $list
}
function Get-DEBrowserExtensionPlan {
    <#
    What each browser forces, allows and blocks for this client. DE services (PABX, JumpCloud Go) and the client's approved
    login manager are forced in; other login managers, coupon injectors and free VPN/proxy extensions are blocked; in
    approved-only mode everything else is blocked too. Store ids the catalog has not confirmed are listed in 'unconfirmed'.
    #>
    param($ClientProfile)
    $ctl = Get-DEBrowserControlCatalog
    $name = Get-DEHashPath -Object $ClientProfile -Path 'browser.policyProfile'; if (-not $name) { $name = 'de-browser-policy' }
    $pext = Get-DECfgProp (Get-DEBrowserPolicyProfile -Name $name) 'extensions'
    $mode = "$(Get-DEHashPath -Object $ClientProfile -Path 'browser.extensions.mode')"; if (-not $mode) { $mode = "$(Get-DECfgProp $pext 'mode')" }; if (-not $mode) { $mode = 'blocklist' }
    $lmKey = "$(Get-DEHashPath -Object $ClientProfile -Path 'browser.loginManager')".ToLowerInvariant()
    $managers = Get-DECfgProp $ctl 'loginManagers'
    $lm = $(if ($lmKey -and $lmKey -ne 'builtin') { Get-DECfgProp $managers $lmKey } else { $null })
    if ($lmKey -and $lmKey -ne 'builtin' -and -not $lm) { throw "browser.loginManager '$lmKey' is not in the catalog (choose: $((@($managers.PSObject.Properties | ForEach-Object { $_.Name }) + 'builtin') -join ', '))" }
    $pkgId = { param($ref) if (-not $ref) { return $null }; $pkg, $setting = "$ref" -split ':', 2; try { Get-DEPkgProp (Get-DEPkgProp (Get-DEPackage -Id $pkg) 'settings') $setting } catch { $null } }
    $clientApproved = @(@(Get-DECfgProp $pext 'approved') + @(Get-DEHashPath -Object $ClientProfile -Path 'browser.extensions.approved') | Where-Object { $_ })
    $clientBlocked = @(@(Get-DECfgProp $pext 'blocked') + @(Get-DEHashPath -Object $ClientProfile -Path 'browser.extensions.blocked') | Where-Object { $_ })
    $browsers = @{}
    foreach ($b in @(@(Get-DEChromiumBrowsers -ClientProfile $ClientProfile) + 'firefox')) {
        $store = $(if ($b -eq 'brave') { 'chrome' } else { $b })   # Brave installs from the Chrome Web Store
        $force = @(); $allow = @(); $block = @(); $missing = @(); $unconfirmed = @()
        # forced entries: DE services first, then the login manager. Edge takes a Chrome Web Store id when it has no Add-ons id.
        $wanted = @()
        foreach ($svc in @(Get-DECfgProp $ctl 'deServices' | Where-Object { $_ })) {
            $id = Get-DECfgProp $svc $store; if (-not $id) { $id = & $pkgId (Get-DECfgProp $svc "$($store)FromPackage") }
            $wanted += @{ entry = $svc; id = $id; chromeId = $(if (Get-DECfgProp $svc 'chrome') { Get-DECfgProp $svc 'chrome' } else { & $pkgId (Get-DECfgProp $svc 'chromeFromPackage') }) }
        }
        if ($lm) { $wanted += @{ entry = $lm; id = (Get-DECfgProp $lm $store); chromeId = (Get-DECfgProp $lm 'chrome') } }
        foreach ($w in $wanted) {
            $nm = "$(Get-DECfgProp $w.entry 'name')"; $id = $w.id; $from = $store
            if (-not $id -and $b -eq 'edge' -and $w.chromeId) { $id = $w.chromeId; $from = 'chrome' }
            if (-not $id) { $missing += $nm; continue }
            $force += [pscustomobject]@{ id = "$id"; name = $nm; store = $from; slug = "$(Get-DECfgProp $w.entry 'firefoxSlug')" }
            if ((Get-DECfgProp $w.entry 'confirmed') -eq $false) { $unconfirmed += $nm }
        }
        foreach ($x in $clientApproved) { $allow += [pscustomobject]@{ id = "$x"; name = "$x"; store = $store } }
        foreach ($grp in @(Get-DECfgProp $ctl 'blockedGroups' | Where-Object { $_ })) {
            $items = @(); if (Get-DECfgProp $grp 'fromLoginManagers') { foreach ($pp in @($managers.PSObject.Properties)) { if ($pp.Name -ne $lmKey) { $items += $pp.Value } } } else { $items = @(Get-DECfgProp $grp 'items' | Where-Object { $_ }) }
            foreach ($it in $items) { foreach ($idKey in @($store, $(if ($b -eq 'edge') { 'chrome' }))) { if (-not $idKey) { continue }; $id = Get-DECfgProp $it $idKey; if ($id) { $block += [pscustomobject]@{ id = "$id"; name = "$(Get-DECfgProp $it 'name') ($(Get-DECfgProp $grp 'name'))"; store = $idKey } } } }
        }
        foreach ($x in $clientBlocked) { $block += [pscustomobject]@{ id = "$x"; name = "$x (client blocked list)"; store = $store } }
        $keep = @(@($force) + @($allow) | ForEach-Object { $_.id })
        $block = @($block | Where-Object { $keep -notcontains $_.id } | Sort-Object id -Unique)
        $browsers[$b] = [pscustomobject]@{ force = $force; allow = $allow; block = $block; blockAll = ($mode -eq 'approved-only'); missing = @($missing | Select-Object -Unique); unconfirmed = @($unconfirmed | Select-Object -Unique) }
    }
    return [pscustomobject]@{ mode = $mode; loginManager = $(if ($lm) { Get-DECfgProp $lm 'name' } elseif ($lmKey -eq 'builtin') { 'built-in browser manager' } else { '' }); loginManagerKey = $lmKey; builtinAllowed = ($lmKey -eq 'builtin'); browsers = $browsers }
}
function ConvertTo-DEChromiumForceEntry { param($Item) $url = $(if ($Item.store -eq 'edge') { 'https://edge.microsoft.com/extensionwebstorebase/v1/crx' } else { 'https://clients2.google.com/service/update2/crx' }); return "$($Item.id);$url" }

function Get-DEBrowserDesiredPolicy {
    <# Merges the policy profile, client overrides, homepage/startup and managed bookmarks into per-browser key/value sets. #>
    param($ClientProfile)
    $name = Get-DEHashPath -Object $ClientProfile -Path 'browser.policyProfile'; if (-not $name) { $name = 'de-browser-policy' }
    $p = Get-DEBrowserPolicyProfile -Name $name
    $plan = Get-DEBrowserExtensionPlan -ClientProfile $ClientProfile
    $chromium = @(Get-DEChromiumBrowsers -ClientProfile $ClientProfile)
    $out = @{ browsers = $chromium; plan = $plan; lists = @{} }
    foreach ($b in $chromium) { $out[$b] = [ordered]@{}; $out.lists[$b] = @{} }
    $autofillOn = ("$(Get-DEHashPath -Object $ClientProfile -Path 'browser.autofill')" -eq 'on')
    foreach ($b in $chromium) {
        foreach ($prop in @((Get-DECfgProp $p 'common').PSObject.Properties)) { $out[$b][$prop.Name] = $prop.Value }
        $spec = Get-DECfgProp $p $(if ($b -eq 'brave') { 'chrome' } else { $b }); if ($spec) { foreach ($prop in @($spec.PSObject.Properties | Where-Object { $null -ne $_ })) { $out[$b][$prop.Name] = $prop.Value } }
        $homePage = Get-DEHashPath -Object $ClientProfile -Path 'browser.homepage'
        if ($homePage) { $out[$b]['HomepageLocation'] = $homePage; $out[$b]['HomepageIsNewTabPage'] = 0; $out[$b]['RestoreOnStartup'] = 4; $out.lists[$b]['RestoreOnStartupURLs'] = @(@($homePage) + @(Get-DEHashPath -Object $ClientProfile -Path 'browser.startupPages' | Where-Object { $null -ne $_ }) | Where-Object { $_ }) }
        $bookmarksJson = $null
        if ((Get-DEHashPath -Object $ClientProfile -Path 'browser.managedBookmarksFromVendors') -or (Get-DEHashPath -Object $ClientProfile -Path 'browser.extraBookmarks')) { $bookmarksJson = New-DEManagedBookmarks -ClientProfile $ClientProfile -IncludeReference:$false }
        if ($bookmarksJson -and -not (Get-DEHashPath -Object $ClientProfile -Path 'browser.managedBookmarksFromVendors')) {
            $extra = @(Get-DEHashPath -Object $ClientProfile -Path 'browser.extraBookmarks' | Where-Object { $null -ne $_ }); $bmList = @(@{ toplevel_name = 'DE' }) + @($extra | ForEach-Object { @{ name = (Get-DECfgProp $_ 'name'); url = (Get-DECfgProp $_ 'url') } }); $bookmarksJson = ConvertTo-Json -InputObject $bmList -Compress -Depth 4   # -InputObject keeps a one-item list an array
        }
        # Edge names these ManagedFavorites / FavoritesBarEnabled; Chrome and Brave use ManagedBookmarks / BookmarkBarEnabled
        if ($bookmarksJson) { if ($b -eq 'edge') { $out[$b]['ManagedFavorites'] = $bookmarksJson; $out[$b]['FavoritesBarEnabled'] = 1 } else { $out[$b]['ManagedBookmarks'] = $bookmarksJson; $out[$b]['BookmarkBarEnabled'] = 1 } }
        # the approved login manager replaces the browser's own password manager and autofill
        $out[$b]['PasswordManagerEnabled'] = $(if ($plan.builtinAllowed) { 1 } else { 0 })
        $out[$b]['AutofillAddressEnabled'] = $(if ($autofillOn) { 1 } else { 0 }); $out[$b]['AutofillCreditCardEnabled'] = $(if ($autofillOn) { 1 } else { 0 })
        if ($b -eq 'brave') { foreach ($k in @('IncognitoModeAvailability', 'ChromeCleanupEnabled')) { $out[$b].Remove($k) } }
        $bp = $plan.browsers[$b]
        $out.lists[$b]['ExtensionInstallForcelist'] = @($bp.force | ForEach-Object { ConvertTo-DEChromiumForceEntry -Item $_ })
        $out.lists[$b]['ExtensionInstallAllowlist'] = @(@($bp.force) + @($bp.allow) | ForEach-Object { $_.id } | Select-Object -Unique)
        # approved-only blocks '*' (force and allow lists still win); never block '*' when nothing is forced or allowed
        $blockIds = @(); if ($bp.blockAll -and ($bp.force.Count -or $bp.allow.Count)) { $blockIds += '*' }; $blockIds += @($bp.block | ForEach-Object { $_.id }); $out.lists[$b]['ExtensionInstallBlocklist'] = @($blockIds | Where-Object { $_ } | Select-Object -Unique)
        $out.lists[$b]['URLBlocklist'] = @(Get-DECfgProp $p 'urlBlocklist' | Where-Object { $null -ne $_ })
        $out.lists[$b]['URLAllowlist'] = @(Get-DECfgProp $p 'urlAllowlist' | Where-Object { $null -ne $_ })
    }
    $out.default = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'
    return $out
}

function Get-DEBrowserPolicyKey { param([ValidateSet('chrome', 'edge', 'brave')][string]$Browser) switch ($Browser) { 'chrome' { 'HKLM:\SOFTWARE\Policies\Google\Chrome' } 'brave' { 'HKLM:\SOFTWARE\Policies\BraveSoftware\Brave' } default { 'HKLM:\SOFTWARE\Policies\Microsoft\Edge' } } }

function Compare-DEBrowserPolicy {
    param($ClientProfile)
    $want = Get-DEBrowserDesiredPolicy -ClientProfile $ClientProfile
    $drift = @()
    foreach ($b in @($want.browsers)) {
        $key = Get-DEBrowserPolicyKey -Browser $b
        foreach ($k in $want[$b].Keys) { $have = Get-DERegistryValue -Path $key -Name $k; if ("$have" -ne "$($want[$b][$k])") { $drift += "$b.$k" } }
        foreach ($list in $want.lists[$b].Keys) {
            $vals = @(); $sk = Join-Path $key $list
            if ($script:IsWindowsHost -and (Test-Path $sk)) { $vals = @((Get-ItemProperty $sk).PSObject.Properties | Where-Object { $_ -and $_.Name -notmatch '^PS' } | ForEach-Object { "$($_.Value)" }) }
            $w = @($want.lists[$b][$list] | Where-Object { $_ })
            if (-not $w.Count) { continue }   # Set-DEBrowserPolicy leaves an empty list to PABX, JumpCloud or the client
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
    foreach ($b in @($want.browsers)) {
        $key = Get-DEBrowserPolicyKey -Browser $b
        if (-not $PSCmdlet.ShouldProcess($key, 'write browser policy')) { continue }
        # the first backup is the client's own policy: later applies never replace it with DE's
        if (-not (Get-DEState -Path "browser.policyOriginal.$b")) { $bk = Backup-DERegistryKey -Key ($key -replace '^HKLM:', 'HKLM') -Label "browser-$b"; Set-DEStateValue -Path "browser.policyOriginal.$b" -Value @{ existed = [bool](Test-Path -Path $key); backup = $bk; at = (Get-Date).ToString('o') }; if ($bk) { $backups += $bk } }
        foreach ($k in $want[$b].Keys) { $v = $want[$b][$k]; $t = $(if ($v -is [int] -or $v -is [long] -or "$v" -match '^\d+$') { 'DWord' } else { 'String' }); Set-DERegistryValue -Path $key -Name $k -Value $(if ($t -eq 'DWord') { [int]$v } else { "$v" }) -Type $t }
        foreach ($list in $want.lists[$b].Keys) {
            $sk = Join-Path $key $list
            $vals = @($want.lists[$b][$list] | Where-Object { $_ })
            if (-not $vals.Count) { continue }   # DE sets nothing here: lists written by PABX, JumpCloud or the client stay
            if (Test-Path $sk) { Remove-Item -Path $sk -Recurse -Force }
            if ($vals.Count) { New-Item -Path $sk -Force | Out-Null; for ($i = 0; $i -lt $vals.Count; $i++) { New-ItemProperty -Path $sk -Name ([string]($i + 1)) -Value "$($vals[$i])" -PropertyType String -Force | Out-Null } }
        }
    }
    return "policy written$(if ($backups.Count) { "; original policy backed up: $($backups -join ', ')" }); restart browsers to load"
}

function Test-DEFirefoxInstalled { return [bool]($script:IsWindowsHost -and ((Test-Path -LiteralPath "$env:ProgramFiles\Mozilla Firefox\firefox.exe") -or (Test-Path -LiteralPath "${env:ProgramFiles(x86)}\Mozilla Firefox\firefox.exe"))) }
function Get-DEFirefoxDesiredPolicy {
    <# Firefox machine policy (HKLM\SOFTWARE\Policies\Mozilla\Firefox): built-in logins and autofill off unless the client keeps them, and ExtensionSettings (JSON) with the same forced/blocked lists. #>
    param($ClientProfile)
    $plan = Get-DEBrowserExtensionPlan -ClientProfile $ClientProfile
    $fp = $plan.browsers['firefox']
    $autofillOn = ("$(Get-DEHashPath -Object $ClientProfile -Path 'browser.autofill')" -eq 'on')
    $settings = [ordered]@{}
    if ($fp.blockAll -and ($fp.force.Count -or $fp.allow.Count)) { $settings['*'] = @{ installation_mode = 'blocked'; blocked_install_message = 'Extensions are managed by Digerati Experts. Ask support@digeratiexperts.com.' } }
    foreach ($x in @($fp.block)) { $settings[$x.id] = @{ installation_mode = 'blocked' } }
    foreach ($x in @($fp.allow)) { $settings[$x.id] = @{ installation_mode = 'allowed' } }
    foreach ($x in @($fp.force)) { if ($x.slug) { $settings[$x.id] = @{ installation_mode = 'force_installed'; install_url = "https://addons.mozilla.org/firefox/downloads/latest/$($x.slug)/latest.xpi" } } else { $settings[$x.id] = @{ installation_mode = 'allowed' } } }
    $values = [ordered]@{ PasswordManagerEnabled = $(if ($plan.builtinAllowed) { 1 } else { 0 }); OfferToSaveLogins = $(if ($plan.builtinAllowed) { 1 } else { 0 }); AutofillAddressEnabled = $(if ($autofillOn) { 1 } else { 0 }); AutofillCreditCardEnabled = $(if ($autofillOn) { 1 } else { 0 }) }
    if ($settings.Count) { $values['ExtensionSettings'] = ($settings | ConvertTo-Json -Compress -Depth 4) }
    return $values
}
function Compare-DEFirefoxPolicy {
    param($ClientProfile)
    $want = Get-DEFirefoxDesiredPolicy -ClientProfile $ClientProfile
    return @(foreach ($k in $want.Keys) { $have = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox' -Name $k; if ("$have" -ne "$($want[$k])") { "firefox.$k" } })
}
function Set-DEFirefoxPolicy {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile)
    $key = 'HKLM:\SOFTWARE\Policies\Mozilla\Firefox'
    $want = Get-DEFirefoxDesiredPolicy -ClientProfile $ClientProfile
    if (-not $PSCmdlet.ShouldProcess($key, 'write Firefox policy')) { return 'planned' }
    $bk = $null; if (-not (Get-DEState -Path 'browser.policyOriginal.firefox')) { $bk = Backup-DERegistryKey -Key ($key -replace '^HKLM:', 'HKLM') -Label 'browser-firefox'; Set-DEStateValue -Path 'browser.policyOriginal.firefox' -Value @{ existed = [bool](Test-Path -Path $key); backup = $bk; at = (Get-Date).ToString('o') } }
    foreach ($k in $want.Keys) { $v = $want[$k]; if ($v -is [int]) { Set-DERegistryValue -Path $key -Name $k -Value $v -Type DWord } else { Set-DERegistryValue -Path $key -Name $k -Value "$v" -Type String } }
    return "Firefox policy written$(if ($bk) { "; original backed up: $bk" }); restart Firefox to load"
}
function Get-DEInstalledBrowserExtensions {
    <# Extensions installed in every local user profile (Chrome, Edge, Brave, Firefox), read from the profile folders; no browser has to run. #>
    param([string]$UsersRoot = "$env:SystemDrive\Users")
    $out = @()
    if (-not $script:IsWindowsHost -and -not (Test-Path -LiteralPath $UsersRoot)) { return $out }
    $roots = [ordered]@{ chrome = 'AppData\Local\Google\Chrome\User Data'; edge = 'AppData\Local\Microsoft\Edge\User Data'; brave = 'AppData\Local\BraveSoftware\Brave-Browser\User Data' }
    foreach ($u in @(Get-ChildItem -LiteralPath $UsersRoot -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @('Public', 'Default', 'Default User', 'All Users') })) {
        foreach ($b in $roots.Keys) {
            $ud = Join-Path $u.FullName $roots[$b]; if (-not (Test-Path -LiteralPath $ud)) { continue }
            foreach ($prof in @(Get-ChildItem -LiteralPath $ud -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq 'Default' -or $_.Name -like 'Profile *' })) {
                $ext = Join-Path $prof.FullName 'Extensions'; if (-not (Test-Path -LiteralPath $ext)) { continue }
                foreach ($e in @(Get-ChildItem -LiteralPath $ext -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^[a-p]{32}$' })) {
                    $nm = ''
                    try { $mf = @(Get-ChildItem -LiteralPath $e.FullName -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'manifest.json' } | Where-Object { Test-Path -LiteralPath $_ }) | Select-Object -First 1; if ($mf) { $nm = "$((Get-Content -LiteralPath $mf -Raw -Encoding UTF8 | ConvertFrom-Json).name)"; if ($nm -like '__MSG_*') { $nm = '' } } } catch { }
                    $out += [pscustomobject]@{ user = $u.Name; browser = $b; profile = $prof.Name; id = $e.Name; name = $nm }
                }
            }
        }
        $ff = Join-Path $u.FullName 'AppData\Roaming\Mozilla\Firefox\Profiles'
        if (Test-Path -LiteralPath $ff) { foreach ($x in @(Get-ChildItem -LiteralPath $ff -Recurse -Filter '*.xpi' -ErrorAction SilentlyContinue | Where-Object { $_.Directory.Name -eq 'extensions' })) { $out += [pscustomobject]@{ user = $u.Name; browser = 'firefox'; profile = $x.Directory.Parent.Name; id = $x.BaseName; name = '' } } }
    }
    return $out
}
function Test-DEBrowserExtensionConflicts {
    <# Installed extensions the client's policy does not allow: on the blocked list, or anything unapproved in approved-only mode. Browsers remove them at their next start once the policy is in place. #>
    param($ClientProfile, [array]$Installed)
    if ($null -eq $Installed) { $Installed = @(Get-DEInstalledBrowserExtensions) }
    $plan = Get-DEBrowserExtensionPlan -ClientProfile $ClientProfile
    $out = @()
    foreach ($x in @($Installed | Where-Object { $_ })) {
        $bp = $plan.browsers[$x.browser]; if (-not $bp) { continue }
        $ok = @(@($bp.force) + @($bp.allow) | ForEach-Object { $_.id })
        $hit = @($bp.block | Where-Object { $_.id -eq $x.id }) | Select-Object -First 1
        if ($hit) { $out += [pscustomobject]@{ user = $x.user; browser = $x.browser; id = $x.id; name = $(if ($x.name) { $x.name } else { $hit.name }); reason = "blocked: $($hit.name)" } }
        elseif ($bp.blockAll -and $ok -notcontains $x.id) { $out += [pscustomobject]@{ user = $x.user; browser = $x.browser; id = $x.id; name = $x.name; reason = 'not on the approved list' } }
    }
    return $out
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
    Register-DEAction -Id 'browser.policy' -Module 'browser' -Title 'Chrome, Edge and Brave policy (logins, autofill, extensions, homepage, bookmarks, private browsing, downloads, safe browsing)' -Phase 12 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $d = @(Compare-DEBrowserPolicy -ClientProfile $ClientProfile); @{ driftCount = $d.Count; drift = (($d | Select-Object -First 12) -join ', ') } }.GetNewClosure() -Desired { @{ driftCount = 0 } } `
        -Apply { param($s) Set-DEBrowserPolicy -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s)
            # reg import only merges, so DE's keys are removed first and the client's original policy imported back
            $done = @(); $bad = @()
            foreach ($b in @('chrome', 'edge', 'brave')) {
                $orig = Get-DEState -Path "browser.policyOriginal.$b"; if (-not $orig) { continue }
                $key = Get-DEBrowserPolicyKey -Browser $b
                if (Test-Path -Path $key) { Remove-Item -Path $key -Recurse -Force }
                if ($orig['existed']) { if ($orig['backup'] -and (Test-Path -LiteralPath $orig['backup'])) { $r = Invoke-DENative -FilePath 'reg.exe' -Arguments @('import', $orig['backup'], '/reg:64') -TimeoutSeconds 60; if ($r.ExitCode -eq 0) { $done += $b } else { $bad += "$b import exit $($r.ExitCode)" } } else { $bad += "$b backup missing" } }
                else { if (-not (Test-Path -Path $key)) { $done += $b } else { $bad += "$b key still present" } }
            }
            @{ ok = ($bad.Count -eq 0 -and $done.Count -gt 0); detail = "restored: $($done -join ', ')$(if ($bad.Count) { "; problems: $($bad -join '; ')" })" }
        } `
        -ManualAction 'Restart Chrome and Edge, then open chrome://policy and edge://policy to confirm the values show as Machine / OK.'
    Register-DEAction -Id 'browser.login-manager' -Module 'browser' -Title 'Approved login manager chosen (replaces built-in password managers and autofill)' -Phase 12 `
        -Detect { $pl = Get-DEBrowserExtensionPlan -ClientProfile $ClientProfile; @{ chosen = [bool]$pl.loginManagerKey; name = $pl.loginManager; unconfirmed = ((@($pl.browsers.Values | ForEach-Object { $_.unconfirmed }) | Select-Object -Unique) -join ', '); missing = ((@($pl.browsers.Values | ForEach-Object { $_.missing }) | Select-Object -Unique) -join ', ') } }.GetNewClosure() `
        -Desired { @{ chosen = $true } } `
        -ManualAction "Set browser.loginManager in the client profile (keeper, bitwarden, onepassword, lastpass, dashlane, or builtin). Until then every built-in browser password manager stays off. Fill any missing or unconfirmed store ids in catalog\browser-policy.json."
    Register-DEAction -Id 'browser.firefox' -Module 'browser' -Title 'Firefox policy (logins, autofill, extensions)' -Phase 12 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $inst = Test-DEFirefoxInstalled; $d = @(if ($inst) { Compare-DEFirefoxPolicy -ClientProfile $ClientProfile }); @{ installed = $inst; driftCount = $d.Count; drift = ($d -join ', ') } }.GetNewClosure() -Desired { @{ driftCount = 0 } } `
        -Apply { param($s) Set-DEFirefoxPolicy -ClientProfile $ClientProfile }.GetNewClosure() `
        -ManualAction 'Restart Firefox and open about:policies to confirm the values are Active.'
    Register-DEAction -Id 'browser.extensions' -Module 'browser' -Title 'No unapproved or conflicting browser extensions installed (all users)' -Phase 12 `
        -Detect { $c = @(Test-DEBrowserExtensionConflicts -ClientProfile $ClientProfile); @{ conflicts = $c.Count; list = (($c | Select-Object -First 12 | ForEach-Object { "$($_.browser):$(if ($_.name) { $_.name } else { $_.id }) ($($_.user); $($_.reason))" }) -join '; ') } }.GetNewClosure() -Desired { @{ conflicts = 0 } } `
        -ManualAction 'Apply the browser policy, then restart each browser: Chrome, Edge, Brave and Firefox remove blocked and unapproved extensions at their next start. Run this check again to confirm.'
    Register-DEAction -Id 'browser.default' -Module 'browser' -Title 'Default browser association' -Phase 12 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $want = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'; if (-not $want) { $want = 'edge' }; $cur = (Get-DEBrowserState).defaultBrowser; $cfg = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System' -Name 'DefaultAssociationsConfiguration'; $prog = $(if ($want -eq 'chrome') { 'ChromeHTML' } else { 'MSEdgeHTM' }); $cfgOk = [bool]($cfg -and (Test-Path -LiteralPath "$cfg") -and ((Get-Content -LiteralPath "$cfg" -Raw -Encoding UTF8) -match [regex]::Escape($prog))); @{ matches = ($cur -eq $want -or $cfgOk); current = $cur; want = $want; policyFile = $cfgOk } }.GetNewClosure() -Desired { @{ matches = $true } } `
        -Apply { param($s) $want = Get-DEHashPath -Object $ClientProfile -Path 'browser.default'; if (-not $want) { $want = 'edge' }; Set-DEDefaultBrowserAssociations -Browser $want }.GetNewClosure()
    Register-DEAction -Id 'browser.updates' -Module 'browser' -Title 'Browsers present and current' -Phase 12 `
        -Detect { $b = Get-DEBrowserState; @{ edge = [bool]$b.edge; chrome = [bool]$b.chrome; edgeVersion = "$(Get-DEHashPath -Object $b -Path 'edge.version')"; chromeVersion = "$(Get-DEHashPath -Object $b -Path 'chrome.version')" } } -Desired { @{ edge = $true; chrome = $true } } `
        -ManualAction 'Install via Apps (edge / chrome packages); both self-update when the update policies are left at 1.'
}

# ================================================================== BRANDING
function Get-DEColorLuminance {
    <# Relative luminance (0 black .. 1 white) of a #RRGGBB colour, WCAG formula. #>
    param([Parameter(Mandatory = $true)][string]$Hex)
    $h = $Hex.TrimStart('#'); if ($h.Length -ne 6) { throw "colour '$Hex' is not #RRGGBB" }
    $lin = foreach ($i in 0, 2, 4) { $c = [Convert]::ToInt32($h.Substring($i, 2), 16) / 255.0; if ($c -le 0.03928) { $c / 12.92 } else { [math]::Pow(($c + 0.055) / 1.055, 2.4) } }
    return [math]::Round(0.2126 * $lin[0] + 0.7152 * $lin[1] + 0.0722 * $lin[2], 4)
}
function Get-DEBrandingOptions {
    <#
    Wallpaper and lock-screen options: DE defaults, then the client profile's branding.wallpaper (and .lockScreen for the
    lock screen). Every knob the Branding page offers lives here.
    #>
    param($ClientProfile, [switch]$LockScreen)
    $o = [ordered]@{
        theme = 'dark'; background = ''; image = ''; imageDim = 0.45; gradient = $true
        position = 'lower-left'; logos = 'both'; deLogoStyle = 'horizontal'; logoHeightPct = 9.0; deLogoHeightPct = 6.0; logoPlate = 'auto'
        showClientName = $true; showManagedBy = $true; showSupport = $true; showHostname = $true; customLine = ''
        accent = '#D3126A'; accentBar = $true; resolution = 'auto'
    }
    if ($LockScreen) { $o.position = 'center'; $o.logoHeightPct = 13.0; $o.deLogoHeightPct = 8.0; $o.showHostname = $false }
    $acc = Get-DEHashPath -Object $ClientProfile -Path 'branding.accent'; if ($acc) { $o.accent = "$acc" }
    foreach ($src in @('branding.wallpaper', $(if ($LockScreen) { 'branding.lockScreen' }))) {
        if (-not $src) { continue }
        $set = Get-DEHashPath -Object $ClientProfile -Path $src; if (-not $set) { continue }
        $keys = $(if ($set -is [System.Collections.IDictionary]) { @($set.Keys) } else { @($set.PSObject.Properties | ForEach-Object { $_.Name }) })
        foreach ($k in $keys) { if ($o.Contains($k)) { $o[$k] = Get-DEHashPath -Object $set -Path $k } }
    }
    if (-not $o.background) { $o.background = switch ($o.theme) { 'light' { '#F7F5F2' } 'accent' { $o.accent } default { '#050312' } } }
    return $o
}
function Get-DEBrandingAssets {
    <# Logo files: the client's logo (and optional reverse variant for dark backgrounds) and the DE logo in the variant that reads on the background. #>
    param($ClientProfile, [string]$Background = '#050312', [ValidateSet('horizontal', 'stacked', 'mark')][string]$DeLogoStyle = 'horizontal')
    $de = Get-DEConsole
    $brand = Join-Path (Join-Path $de.Root 'assets') 'brand'
    $dark = (Get-DEColorLuminance -Hex $Background) -lt 0.4
    $candidates = switch ($DeLogoStyle) {
        'stacked' { @($(if ($dark) { 'digerati-logo-stacked-reverse-1600.png' } else { 'digerati-logo-stacked-1600.png' })) }
        'mark' { @('digerati-mark-1024.png', 'digerati-mark-tile-256.png') }
        default { @($(if ($dark) { 'digerati-logo-reverse-2400.png'; 'digerati-logo-reverse-600.png' } else { 'digerati-logo-2400.png'; 'digerati-logo-600.png' })) }
    }
    $deLogo = @($candidates | ForEach-Object { Join-Path $brand $_ } | Where-Object { Test-Path -LiteralPath $_ }) | Select-Object -First 1
    if (-not $deLogo) { $deLogo = Join-Path (Join-Path $de.Root 'assets') 'de-logo.png' }
    $resolve = { param($spec) if (-not $spec) { return $null }; $spec = "$spec"
        if ($spec -like 'asset:*') { $pth = Join-Path $de.Root 'assets'; foreach ($seg in @($spec.Substring(6) -split '[\\/]' | Where-Object { $_ })) { $pth = Join-Path $pth $seg }; return $pth }
        if (-not [IO.Path]::IsPathRooted($spec)) { return (Join-Path $de.Dirs.Profiles $spec) }
        return $spec }
    $client = & $resolve (Get-DEHashPath -Object $ClientProfile -Path 'branding.clientLogo')
    $clientRev = & $resolve (Get-DEHashPath -Object $ClientProfile -Path 'branding.clientLogoReverse')
    if ($dark -and $clientRev -and (Test-Path -LiteralPath $clientRev)) { $client = $clientRev }
    return @{ deLogo = $(if (Test-Path -LiteralPath $deLogo) { $deLogo } else { $null }); clientLogo = $(if ($client -and (Test-Path -LiteralPath $client)) { $client } else { $null }); onDark = $dark }
}
function Get-DEBrandingLayout {
    <#
    Where everything goes, before anything is drawn (so the layout is testable anywhere): logo boxes sized from the screen
    height, text lines and sizes, the accent bar, and the hostname badge, anchored by the chosen position.
    LogoSizes: @{ client = @(w, h); de = @(w, h) } in source pixels (missing logos are left out).
    #>
    param([int]$Width, [int]$Height, $Options, [hashtable]$LogoSizes = @{}, [string[]]$Lines = @())
    $margin = [int]($Height * 0.07); $gap = [int]($Height * 0.03)
    $boxes = @()
    $order = switch ($Options.logos) { 'client' { @('client') } 'de' { @('de') } default { @('client', 'de') } }
    foreach ($k in $order) {
        $sz = $LogoSizes[$k]; if (-not $sz) { continue }
        $h = [int]($Height * ([double]$(if ($k -eq 'de' -and @($order).Count -gt 1 -and $LogoSizes['client']) { $Options.deLogoHeightPct } else { $Options.logoHeightPct }) / 100))
        $w = [int]($sz[0] * ($h / [double]$sz[1]))
        if ($w -gt [int]($Width * 0.42)) { $w = [int]($Width * 0.42); $h = [int]($sz[1] * ($w / [double]$sz[0])) }   # very wide wordmarks stay inside the screen
        $boxes += @{ kind = 'logo'; which = $k; w = $w; h = $h }
    }
    $big = [int]($Height * 0.026); $small = [int]($Height * 0.018)
    $text = @(); for ($i = 0; $i -lt $Lines.Count; $i++) { $sz = $(if ($i -eq 0) { $big } else { $small }); $text += @{ kind = 'text'; text = $Lines[$i]; size = $sz; muted = ($i -gt 0); w = [int]($Lines[$i].Length * $sz * 0.56); h = [int]($sz * 1.45) } }
    $rowH = [int](@($boxes | ForEach-Object { $_.h } | Measure-Object -Maximum).Maximum); if (-not $rowH) { $rowH = 0 }
    $rowW = [int](@($boxes | ForEach-Object { $_.w } | Measure-Object -Sum).Sum) + [math]::Max(0, @($boxes).Count - 1) * [int]($Height * 0.045)
    $textH = [int](@($text | ForEach-Object { $_.h } | Measure-Object -Sum).Sum)
    $blockW = [math]::Max($rowW, [int](@($text | ForEach-Object { $_.w } | Measure-Object -Maximum).Maximum)); $blockH = $rowH + $(if ($text.Count -and $rowH) { $gap } else { 0 }) + $textH
    $bar = $(if ($Options.accentBar -and $Options.position -notlike '*center*') { [int]([math]::Max(6, $Height * 0.006)) } else { 0 }); $barGap = $(if ($bar) { [int]($Height * 0.02) } else { 0 })
    $pos = "$($Options.position)"
    $x0 = switch -Regex ($pos) { 'left' { $margin + $bar + $barGap } 'right' { $Width - $margin - $blockW } default { [int](($Width - $blockW) / 2) } }
    $y0 = switch -Regex ($pos) { '^upper' { $margin } '^lower' { $Height - $margin - $blockH - $(if ($Options.showHostname) { [int]($Height * 0.03) } else { 0 }) } default { [int](($Height - $blockH) / 2) } }
    $centered = ($pos -eq 'center' -or $pos -eq 'lower-center')
    $x = $(if ($centered) { [int](($Width - $rowW) / 2) } else { $x0 }); $y = $y0
    foreach ($b in $boxes) { $b.x = $x; $b.y = $y + [int](($rowH - $b.h) / 2); $x += $b.w + [int]($Height * 0.045) }
    $ty = $y0 + $rowH + $(if ($rowH -and $text.Count) { $gap } else { 0 })
    foreach ($t in $text) { $t.x = $(if ($centered) { [int](($Width - $t.w) / 2) } elseif ($pos -like '*right') { $Width - $margin - $t.w } else { $x0 }); $t.y = $ty; $ty += $t.h }
    $out = @{ width = $Width; height = $Height; margin = $margin; centered = $centered; alignRight = ($pos -like '*right'); items = @(@($boxes) + @($text)); block = @{ x = $x0; y = $y0; w = $blockW; h = $blockH } }
    if ($bar) { $out.accentBar = @{ x = $(if ($pos -like '*right') { $Width - $margin + $barGap } else { $margin }); y = $y0; w = $bar; h = $blockH } }
    if ($Options.showHostname) { $hs = [int]($Height * 0.016); $out.hostname = @{ size = $hs; x = $Width - $margin - [int]($env:COMPUTERNAME.Length * $hs * 0.62); y = $Height - [int]($margin * 0.6) } }
    return $out
}
function Get-DEPrimaryScreenSize {
    <# The native resolution of the primary display (what the wallpaper is rendered at), 2560x1440 when unknown. #>
    $w = 0; $h = 0
    try { $v = @(Get-CimInstance -ClassName Win32_VideoController -ErrorAction Stop | Where-Object { $_.CurrentHorizontalResolution }) | Sort-Object CurrentHorizontalResolution -Descending | Select-Object -First 1; if ($v) { $w = [int]$v.CurrentHorizontalResolution; $h = [int]$v.CurrentVerticalResolution } } catch { }
    if ($w -lt 1280 -or $h -lt 720) { $w = 2560; $h = 1440 }
    return @($w, $h)
}
function New-DEBrandedWallpaper {
    <#
    Renders the wallpaper (or lock screen) with System.Drawing: background by theme (graphite, paper, accent or the
    client's photo dimmed), the DE logo in the variant that reads on that background, the client logo on a contrasting
    plate when it would otherwise blend in, the accent bar, the text lines and the hostname badge, at native resolution.
    #>
    param($ClientProfile, [int]$Width, [int]$Height, [string]$OutFile, [switch]$LockScreen)
    Add-Type -AssemblyName System.Drawing
    $de = Get-DEConsole
    $o = Get-DEBrandingOptions -ClientProfile $ClientProfile -LockScreen:$LockScreen
    if (-not $Width -or -not $Height) {
        if ("$($o.resolution)" -match '^(\d{3,5})x(\d{3,5})$') { $Width = [int]$Matches[1]; $Height = [int]$Matches[2] } else { $sz = Get-DEPrimaryScreenSize; $Width = $sz[0]; $Height = $sz[1] }
    }
    $Width = [math]::Min(7680, [math]::Max(1280, $Width)); $Height = [math]::Min(4320, [math]::Max(720, $Height))
    if (-not $OutFile) { $OutFile = Join-Path $de.Dirs.Base ("branding\{0}-{1}x{2}-{3}.png" -f $(if ($LockScreen) { 'lockscreen' } else { 'wallpaper' }), $Width, $Height, (Get-Date -Format 'yyyyMMddHHmmss')) }
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force -WhatIf:$false | Out-Null
    $assets = Get-DEBrandingAssets -ClientProfile $ClientProfile -Background $o.background -DeLogoStyle $o.deLogoStyle
    $imgs = @{}; $sizes = @{}
    foreach ($k in @('client', 'de')) { $f = $(if ($k -eq 'client') { $assets.clientLogo } else { $assets.deLogo }); if ($f) { $imgs[$k] = [System.Drawing.Image]::FromFile($f); $sizes[$k] = @($imgs[$k].Width, $imgs[$k].Height) } }
    $name = "$(Get-DEHashPath -Object $ClientProfile -Path 'name')"
    $support = "$(Get-DEHashPath -Object $ClientProfile -Path 'branding.supportText')"; if (-not $support) { $support = 'Support: support@digeratiexperts.com' }
    $lines = @(); $first = @(); if ($o.showClientName -and $name) { $first += $name }; if ($o.showManagedBy) { $first += 'managed by Digerati Experts' }; if ($first.Count) { $lines += ($first -join '  |  ') }
    if ($o.showSupport) { $lines += $support }; if ($o.customLine) { $lines += "$($o.customLine)" }
    $layout = Get-DEBrandingLayout -Width $Width -Height $Height -Options $o -LogoSizes $sizes -Lines $lines
    $bgColor = [System.Drawing.ColorTranslator]::FromHtml($o.background)
    $onDark = $assets.onDark
    $ink = $(if ($onDark) { [System.Drawing.ColorTranslator]::FromHtml('#F7F5F2') } else { [System.Drawing.ColorTranslator]::FromHtml('#1A1620') })
    $bmp = New-Object System.Drawing.Bitmap $Width, $Height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
        $g.SmoothingMode = 'AntiAlias'; $g.TextRenderingHint = 'AntiAliasGridFit'; $g.InterpolationMode = 'HighQualityBicubic'; $g.PixelOffsetMode = 'HighQuality'
        $g.Clear($bgColor)
        if ($o.theme -eq 'image' -and $o.image -and (Test-Path -LiteralPath "$($o.image)")) {
            $photo = [System.Drawing.Image]::FromFile("$($o.image)")
            try { $scale = [math]::Max($Width / $photo.Width, $Height / $photo.Height); $pw = [int]($photo.Width * $scale); $ph = [int]($photo.Height * $scale); $g.DrawImage($photo, [int](($Width - $pw) / 2), [int](($Height - $ph) / 2), $pw, $ph) } finally { $photo.Dispose() }
            $dim = [double]$o.imageDim; if ($dim -gt 1) { $dim = $dim / 100 }   # the Branding page slider stores percent
            $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb([int](255 * [math]::Min(0.95, [math]::Max(0, $dim))), $bgColor))), 0, 0, $Width, $Height)
        } elseif ($o.gradient) {
            $glow = New-Object System.Drawing.Drawing2D.LinearGradientBrush((New-Object System.Drawing.Point 0, 0), (New-Object System.Drawing.Point $Width, $Height), [System.Drawing.Color]::FromArgb($(if ($onDark) { 46 } else { 22 }), 124, 58, 237), [System.Drawing.Color]::FromArgb(0, $bgColor))
            $g.FillRectangle($glow, 0, 0, $Width, $Height); $glow.Dispose()
        }
        $accent = [System.Drawing.ColorTranslator]::FromHtml($o.accent)
        if ($layout.accentBar) { $g.FillRectangle((New-Object System.Drawing.SolidBrush $accent), $layout.accentBar.x, $layout.accentBar.y, $layout.accentBar.w, $layout.accentBar.h) }
        $fontFamily = 'Segoe UI'; try { $null = New-Object System.Drawing.FontFamily 'Space Grotesk'; $fontFamily = 'Space Grotesk' } catch { }
        foreach ($it in $layout.items) {
            if ($it.kind -eq 'logo') {
                $img = $imgs[$it.which]
                # a logo whose own colours sit too close to the background gets a contrasting plate behind it
                $needPlate = "$($o.logoPlate)" -eq 'always'
                if ("$($o.logoPlate)" -eq 'auto') { $needPlate = [math]::Abs((Get-DEImageLuminance -Image $img) - (Get-DEColorLuminance -Hex $o.background)) -lt 0.3 }
                if ($needPlate) {
                    $pad = [int]($it.h * 0.18); $plate = $(if ($onDark) { [System.Drawing.ColorTranslator]::FromHtml('#F7F5F2') } else { [System.Drawing.ColorTranslator]::FromHtml('#050312') })
                    $path = New-DERoundedRectPath -X ($it.x - $pad) -Y ($it.y - $pad) -W ($it.w + 2 * $pad) -H ($it.h + 2 * $pad) -R ([int]($pad * 1.2))
                    $g.FillPath((New-Object System.Drawing.SolidBrush $plate), $path); $path.Dispose()
                }
                $g.DrawImage($img, $it.x, $it.y, $it.w, $it.h)
            } else {
                $f = New-Object System.Drawing.Font($fontFamily, [single]$it.size, $(if ($it.muted) { [System.Drawing.FontStyle]::Regular } else { [System.Drawing.FontStyle]::Bold }), [System.Drawing.GraphicsUnit]::Pixel)
                $br = New-Object System.Drawing.SolidBrush ($(if ($it.muted) { [System.Drawing.Color]::FromArgb(185, $ink) } else { $ink }))
                # the layout estimated the width; centred and right-aligned lines use the measured width of this font
                $tx = [single]$it.x; $mw = $g.MeasureString($it.text, $f).Width
                if ($layout.centered) { $tx = [single](($Width - $mw) / 2) } elseif ($layout.alignRight) { $tx = [single]($Width - $layout.margin - $mw) }
                $g.DrawString($it.text, $f, $br, $tx, [single]$it.y); $f.Dispose(); $br.Dispose()
            }
        }
        if ($layout.hostname) { $hf = New-Object System.Drawing.Font('Consolas', [single]$layout.hostname.size, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel); $hw = $g.MeasureString($env:COMPUTERNAME, $hf).Width; $g.DrawString($env:COMPUTERNAME, $hf, (New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(150, $ink))), [single]($Width - $layout.margin - $hw), [single]$layout.hostname.y); $hf.Dispose() }
    } finally { $g.Dispose(); foreach ($i in $imgs.Values) { $i.Dispose() } }
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    return $OutFile
}
function Get-DEImageLuminance {
    <# Average luminance of an image's visible (non-transparent) pixels, sampled on a small copy. #>
    param([Parameter(Mandatory = $true)]$Image)
    $thumb = New-Object System.Drawing.Bitmap $Image, 32, 32
    try {
        $sum = 0.0; $n = 0
        for ($x = 0; $x -lt 32; $x++) { for ($y = 0; $y -lt 32; $y++) { $c = $thumb.GetPixel($x, $y); if ($c.A -gt 64) { $sum += (0.2126 * $c.R + 0.7152 * $c.G + 0.0722 * $c.B) / 255.0; $n++ } } }
        if (-not $n) { return 0.5 }
        return [math]::Round($sum / $n, 3)
    } finally { $thumb.Dispose() }
}
function New-DERoundedRectPath { param([int]$X, [int]$Y, [int]$W, [int]$H, [int]$R) $p = New-Object System.Drawing.Drawing2D.GraphicsPath; $d = [math]::Max(2, 2 * $R); $p.AddArc($X, $Y, $d, $d, 180, 90); $p.AddArc($X + $W - $d, $Y, $d, $d, 270, 90); $p.AddArc($X + $W - $d, $Y + $H - $d, $d, $d, 0, 90); $p.AddArc($X, $Y + $H - $d, $d, $d, 90, 90); $p.CloseFigure(); return $p }
function New-DEOemLogo {
    <# The 120x120 BMP Windows shows on Settings > System > About ("Managed by"): the DE mark (or the client's logo when branding.oemLogo = 'client'). #>
    param($ClientProfile, [string]$OutFile)
    Add-Type -AssemblyName System.Drawing
    $de = Get-DEConsole
    if (-not $OutFile) { $OutFile = Join-Path $de.Dirs.Base 'branding\oem-logo.bmp' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $OutFile) -Force -WhatIf:$false | Out-Null
    $src = Join-Path (Join-Path (Join-Path $de.Root 'assets') 'brand') 'digerati-mark-1024.png'
    if ("$(Get-DEHashPath -Object $ClientProfile -Path 'branding.oemLogo')" -eq 'client') { $a = Get-DEBrandingAssets -ClientProfile $ClientProfile -Background '#FFFFFF'; if ($a.clientLogo) { $src = $a.clientLogo } }
    $bmp = New-Object System.Drawing.Bitmap 120, 120; $g = [System.Drawing.Graphics]::FromImage($bmp)
    try { $g.Clear([System.Drawing.Color]::White); $g.InterpolationMode = 'HighQualityBicubic'; $img = [System.Drawing.Image]::FromFile($src); try { $s = [math]::Min(104 / $img.Width, 104 / $img.Height); $w = [int]($img.Width * $s); $h = [int]($img.Height * $s); $g.DrawImage($img, [int]((120 - $w) / 2), [int]((120 - $h) / 2), $w, $h) } finally { $img.Dispose() } } finally { $g.Dispose() }
    $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Bmp); $bmp.Dispose()
    return $OutFile
}

function Get-DEBrandingState {
    $wall = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP' -Name 'DesktopImagePath'
    $lock = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP' -Name 'LockScreenImagePath'
    $oem = @{ manufacturer = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'Manufacturer'); supportUrl = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'SupportURL'); supportPhone = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'SupportPhone'); logo = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'Logo'); supportHours = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation' -Name 'SupportHours') }
    $policyLock = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization' -Name 'LockScreenImage'
    return @{ wallpaper = $wall; lockScreen = $lock; policyLockScreen = $policyLock; applied = [bool]($wall -and "$wall" -match '\\DE\\'); oem = $oem; hostname = $env:COMPUTERNAME }
}

function Set-DEBranding {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile, [string]$Wallpaper, [string]$LockScreen)
    $de = Get-DEConsole
    $before = Get-DEBrandingState
    $dest = Join-Path $env:ProgramData 'DE\Branding'
    if (-not $PSCmdlet.ShouldProcess('desktop and lock screen', 'apply DE branding')) { return 'planned' }
    # keep the client's original look for Undo: a re-run over DE branding must not overwrite it with DE's own
    if (-not $before.applied -or -not (Get-DEState -Path 'branding.previous')) { Set-DEStateValue -Path 'branding.previous' -Value $before }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    if (-not $Wallpaper) { $Wallpaper = New-DEBrandedWallpaper -ClientProfile $ClientProfile }
    $w = Join-Path $dest 'wallpaper.png'
    Copy-Item -LiteralPath $Wallpaper -Destination $w -Force
    $csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
    Set-DERegistryValue -Path $csp -Name 'DesktopImagePath' -Value $w -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageUrl' -Value $w -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageStatus' -Value 1 -Type DWord
    # the lock screen is its own enforced step (image, policy, Spotlight off for every profile); Windows Home is reported, not failed here
    $lockNote = $(try { Set-DELockScreen -ClientProfile $ClientProfile -Image $LockScreen -Confirm:$false } catch { "lock screen not set: $($_.Exception.Message)" })
    $oem = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation'
    Set-DERegistryValue -Path $oem -Name 'Manufacturer' -Value 'Managed by Digerati Experts' -Type String
    Set-DERegistryValue -Path $oem -Name 'SupportURL' -Value 'https://portal.digeratiexperts.com/portal/login' -Type String
    Set-DERegistryValue -Path $oem -Name 'SupportHours' -Value 'Monday to Friday, 8:00 to 17:00 (Arizona)' -Type String
    $logoNote = ''
    if ("$(Get-DEHashPath -Object $ClientProfile -Path 'branding.oemLogo')" -ne 'none') { try { $lb = Join-Path $dest 'oem-logo.bmp'; Copy-Item -LiteralPath (New-DEOemLogo -ClientProfile $ClientProfile) -Destination $lb -Force; Set-DERegistryValue -Path $oem -Name 'Logo' -Value $lb -Type String; $logoNote = '; About-page logo set' } catch { $logoNote = "; About-page logo skipped ($($_.Exception.Message))" } }
    return "wallpaper $w; $lockNote; OEM support info set$logoNote (applies at next sign-in)"
}

function Undo-DEBranding {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $prev = Get-DEState -Path 'branding.previous'
    if (-not $PSCmdlet.ShouldProcess('branding', 'restore previous')) { return 'planned' }
    $csp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
    foreach ($n in @('DesktopImagePath', 'DesktopImageUrl', 'DesktopImageStatus')) { Remove-ItemProperty -Path $csp -Name $n -ErrorAction SilentlyContinue }
    if ($prev -and (Get-DECfgProp $prev 'wallpaper')) { Set-DERegistryValue -Path $csp -Name 'DesktopImagePath' -Value (Get-DECfgProp $prev 'wallpaper') -Type String; Set-DERegistryValue -Path $csp -Name 'DesktopImageStatus' -Value 1 -Type DWord }
    if (Get-DEState -Path 'lockscreen.previous') { $null = Undo-DELockScreen -Confirm:$false }
    else {
        # applied before the lock screen was its own step: restore the image path and the policy path recorded with branding
        if ($prev -and (Get-DECfgProp $prev 'lockScreen')) { Set-DERegistryValue -Path $csp -Name 'LockScreenImagePath' -Value (Get-DECfgProp $prev 'lockScreen') -Type String; Set-DERegistryValue -Path $csp -Name 'LockScreenImageStatus' -Value 1 -Type DWord }
        $policy = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization'; $oldPolicyLock = $(if ($prev) { Get-DECfgProp $prev 'policyLockScreen' } else { $null })
        if ($oldPolicyLock) { Set-DERegistryValue -Path $policy -Name 'LockScreenImage' -Value $oldPolicyLock -Type String } else { Remove-ItemProperty -Path $policy -Name 'LockScreenImage' -ErrorAction SilentlyContinue }
    }
    $oem = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\OEMInformation'
    foreach ($n in @('Manufacturer', 'SupportURL', 'SupportHours', 'Logo')) { $pv = Get-DEHashPath -Object $prev -Path "oem.$($n.Substring(0,1).ToLower() + $n.Substring(1))"; if ($pv) { Set-DERegistryValue -Path $oem -Name $n -Value $pv -Type String } else { Remove-ItemProperty -Path $oem -Name $n -ErrorAction SilentlyContinue } }
    Set-DEStateValue -Path 'branding.previous' -Value $null   # the next apply records the look it replaces again
    return 'branding restored to the recorded previous state'
}

# ------------------------------------------------------------------ company-branded lock screen
# Machine: PersonalizationCSP (the image), the Personalization policy (the same image, users cannot change it, it shows
# behind the sign-in box). Every profile and Default: Windows Spotlight rotation and its "fun facts" overlay off, so
# Windows does not paint over the company image. Windows Home ignores lock-screen policy; it is reported, never passed.
$script:LockCsp = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\PersonalizationCSP'
$script:LockPolicy = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization'
$script:LockSystemPolicy = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\System'
$script:LockUserPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager'
$script:LockUserValues = [ordered]@{ RotatingLockScreenEnabled = 0; RotatingLockScreenOverlayEnabled = 0; 'SubscribedContent-338387Enabled' = 0 }
function Get-DEWindowsEdition { $e = Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' -Name 'EditionID'; return $(if ($e) { "$e" } else { 'unknown' }) }
function Get-DELockScreenState {
    <# What the lock screen is set to, per layer: image, policy, and Spotlight for every profile. ok only when all hold. #>
    $img = Join-Path $env:ProgramData 'DE\Branding\lockscreen.png'
    $want = "$(Get-DEState -Path 'lockscreen.sha256')"
    $have = $(if (Test-Path -LiteralPath $img) { try { Get-DEFileSha256 -Path $img } catch { $null } } else { $null })
    $edition = Get-DEWindowsEdition
    $isHome = ($edition -match '^Core')
    $csp = ("$(Get-DERegistryValue -Path $script:LockCsp -Name 'LockScreenImagePath')" -ieq $img) -and ("$(Get-DERegistryValue -Path $script:LockCsp -Name 'LockScreenImageStatus')" -eq '1')
    $policy = ("$(Get-DERegistryValue -Path $script:LockPolicy -Name 'LockScreenImage')" -ieq $img) -and ("$(Get-DERegistryValue -Path $script:LockPolicy -Name 'NoChangingLockScreen')" -eq '1')
    $spot = @(); $unchecked = @()
    # Windows Home ignores the policy, so there is nothing per user to check: do not load every profile's hive
    if ($script:IsWindowsHost -and -not $isHome) {
        $h = Open-DEUserHives
        try {
            $unchecked = @($h['failed'] | Where-Object { $_ })
            foreach ($t in $h.targets) {
                $path = Get-DEUserPolicyPath -Root $t.root -Path $script:LockUserPath
                foreach ($n in $script:LockUserValues.Keys) { if ("$(Get-DERegistryValue -Path $path -Name $n)" -ne "$($script:LockUserValues[$n])") { $spot += $t.name; break } }
            }
        } finally { Close-DEUserHives -Hives $h }
    }
    $imageOk = [bool]($have -and $want -and $have -eq $want)
    $spotOk = (-not $spot.Count -and -not $unchecked.Count)
    return [pscustomobject][ordered]@{
        ok = ($imageOk -and $csp -and $policy -and $spotOk -and -not $isHome); image = $img; imageOk = $imageOk; csp = $csp; policy = $policy
        spotlightOff = $spotOk; spotlightOn = @($spot); notChecked = @($unchecked); edition = $edition; supported = (-not $isHome)
        detail = $(if ($isHome) { "Windows $edition ignores lock screen policy: upgrade to Pro, or set the picture by hand in Settings > Personalization > Lock screen" } elseif (-not $imageOk) { 'the company lock screen image is not in place' } elseif (-not $csp -or -not $policy) { 'the lock screen policy does not point at the company image' } elseif ($unchecked.Count) { "not checked (profile could not be loaded): $($unchecked -join ', ')" } elseif ($spot.Count) { "Windows Spotlight still rotates the lock screen for: $($spot -join ', ')" } else { 'company lock screen set, users cannot change it, Spotlight off for every profile' })
    }
}
function Set-DELockScreen {
    <#
        Sets the company-branded lock screen: renders it from the client profile (or uses -Image), stores it in
        %ProgramData%\DE\Branding\lockscreen.png, points PersonalizationCSP and the Personalization policy at it, stops
        users changing it, shows it behind the sign-in box, and turns Windows Spotlight off for every profile and Default.
        Previous values are recorded once for Undo-DELockScreen. Applies at the next lock.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile, [string]$Image)
    $edition = Get-DEWindowsEdition
    if ($edition -match '^Core') { throw "Windows $edition ignores lock screen policy; upgrade the device to Pro, or set the picture by hand in Settings > Personalization > Lock screen" }
    if (-not $PSCmdlet.ShouldProcess('lock screen', 'set the company-branded lock screen')) { return 'planned' }
    $dest = Join-Path $env:ProgramData 'DE\Branding'; New-Item -ItemType Directory -Path $dest -Force | Out-Null
    if (-not $Image) { $Image = New-DEBrandedWallpaper -ClientProfile $ClientProfile -LockScreen }
    $img = Join-Path $dest 'lockscreen.png'
    if ([IO.Path]::GetFullPath($Image) -ne [IO.Path]::GetFullPath($img)) { Copy-Item -LiteralPath $Image -Destination $img -Force }
    # record what was there once, so a re-run over DE's own lock screen never overwrites the client's original
    if (-not (Get-DEState -Path 'lockscreen.previous')) {
        $machine = @{}
        foreach ($p in @(@{ k = 'csp'; path = $script:LockCsp; names = @('LockScreenImagePath', 'LockScreenImageUrl', 'LockScreenImageStatus') }, @{ k = 'policy'; path = $script:LockPolicy; names = @('LockScreenImage', 'NoChangingLockScreen') }, @{ k = 'system'; path = $script:LockSystemPolicy; names = @('DisableLogonBackgroundImage') })) {
            $vals = @{}; foreach ($n in $p.names) { $v = Get-DERegistryValue -Path $p.path -Name $n; $vals[$n] = @{ existed = ($null -ne $v); value = $v } }; $machine[$p.k] = $vals
        }
        $users = @{}
        $h = Open-DEUserHives
        try { foreach ($t in $h.targets) { $path = Get-DEUserPolicyPath -Root $t.root -Path $script:LockUserPath; $vals = @{}; foreach ($n in $script:LockUserValues.Keys) { $v = Get-DERegistryValue -Path $path -Name $n; $vals[$n] = @{ existed = ($null -ne $v); value = $v } }; $users[$t.sid] = $vals } }
        finally { Close-DEUserHives -Hives $h }
        Set-DEStateValue -Path 'lockscreen.previous' -Value @{ machine = $machine; users = $users }
    }
    Set-DERegistryValue -Path $script:LockCsp -Name 'LockScreenImagePath' -Value $img -Type String -Confirm:$false
    Set-DERegistryValue -Path $script:LockCsp -Name 'LockScreenImageUrl' -Value $img -Type String -Confirm:$false
    Set-DERegistryValue -Path $script:LockCsp -Name 'LockScreenImageStatus' -Value 1 -Type DWord -Confirm:$false
    Set-DERegistryValue -Path $script:LockPolicy -Name 'LockScreenImage' -Value $img -Type String -Confirm:$false
    Set-DERegistryValue -Path $script:LockPolicy -Name 'NoChangingLockScreen' -Value 1 -Type DWord -Confirm:$false
    Set-DERegistryValue -Path $script:LockSystemPolicy -Name 'DisableLogonBackgroundImage' -Value 0 -Type DWord -Confirm:$false
    $n = 0; $failed = @()
    $h = Open-DEUserHives
    try {
        $failed = @($h['failed'] | Where-Object { $_ })
        foreach ($t in $h.targets) { $path = Get-DEUserPolicyPath -Root $t.root -Path $script:LockUserPath; foreach ($k in $script:LockUserValues.Keys) { Set-DERegistryValue -Path $path -Name $k -Value $script:LockUserValues[$k] -Type DWord -Confirm:$false }; $n++ }
    } finally { Close-DEUserHives -Hives $h }
    Set-DEStateValue -Path 'lockscreen.sha256' -Value (Get-DEFileSha256 -Path $img)
    return "company lock screen $img; users cannot change it; shown at sign-in; Spotlight off for $n profile(s) including Default$(if ($failed.Count) { "; not set for $($failed -join ', ') (profile could not be loaded)" }) (applies at the next lock)"
}
function Undo-DELockScreen {
    <# Restores every lock-screen value recorded before Set-DELockScreen, and removes the ones that did not exist. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    if (-not $PSCmdlet.ShouldProcess('lock screen', 'restore the previous lock screen')) { return 'planned' }
    $prev = Get-DEState -Path 'lockscreen.previous'
    $restore = { param($path, $vals, $types) foreach ($n in @($vals.Keys)) { $e = $vals[$n]; if (Get-DEHashPath -Object $e -Path 'existed') { Set-DERegistryValue -Path $path -Name $n -Value (Get-DEHashPath -Object $e -Path 'value') -Type $(if ($types.Contains($n)) { $types[$n] } else { 'String' }) -Confirm:$false } else { Remove-ItemProperty -Path $path -Name $n -ErrorAction SilentlyContinue } } }
    $dw = @{ LockScreenImageStatus = 'DWord'; NoChangingLockScreen = 'DWord'; DisableLogonBackgroundImage = 'DWord' }
    if ($prev) {
        $m = Get-DEHashPath -Object $prev -Path 'machine'
        foreach ($pair in @(@('csp', $script:LockCsp), @('policy', $script:LockPolicy), @('system', $script:LockSystemPolicy))) { $v = Get-DEHashPath -Object $m -Path $pair[0]; if ($v) { & $restore $pair[1] (ConvertTo-DEHashtable $v) $dw } }
        $users = Get-DEHashPath -Object $prev -Path 'users'
        $uw = @{}; foreach ($k in $script:LockUserValues.Keys) { $uw[$k] = 'DWord' }
        $h = Open-DEUserHives
        try { foreach ($t in $h.targets) { $u = Get-DEHashPath -Object $users -Path $t.sid; if ($u) { & $restore (Get-DEUserPolicyPath -Root $t.root -Path $script:LockUserPath) (ConvertTo-DEHashtable $u) $uw } } }
        finally { Close-DEUserHives -Hives $h }
    } else {
        # nothing recorded (applied by an older version): take DE's values out rather than leave a locked lock screen
        foreach ($n in @('LockScreenImagePath', 'LockScreenImageUrl', 'LockScreenImageStatus')) { Remove-ItemProperty -Path $script:LockCsp -Name $n -ErrorAction SilentlyContinue }
        foreach ($n in @('LockScreenImage', 'NoChangingLockScreen')) { Remove-ItemProperty -Path $script:LockPolicy -Name $n -ErrorAction SilentlyContinue }
    }
    Set-DEStateValue -Path 'lockscreen.previous' -Value $null; Set-DEStateValue -Path 'lockscreen.sha256' -Value $null
    return 'lock screen restored to the recorded previous state'
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
    Register-DEAction -Id 'branding.lockscreen' -Module 'branding' -Title 'Company-branded lock screen (users cannot change it, no Spotlight)' -Phase 13 -Gates @('gate.elevated') -RequiresElevation -Modes @('new', 'dropship', 'takeover', 'replacement', 'repair') `
        -Detect { $s = Get-DELockScreenState; @{ applied = $s.ok; supported = $s.supported; detail = $s.detail } } -Desired { @{ applied = $true } } `
        -Compare { param($d, $w) if ($d.applied) { @() } else { @("$($d.detail)") } } `
        -Verify { param($after) $s = Get-DELockScreenState; @{ ok = $s.ok; detail = $s.detail } } `
        -Apply { param($s) Set-DELockScreen -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) Undo-DELockScreen -Confirm:$false } -ManualAction 'Preview the lock screen in the Branding page (Edit lock screen, then Preview lock screen) before applying. Windows Home ignores lock screen policy.'
    Register-DEAction -Id 'branding.apply' -Module 'branding' -Title 'DE and client branding (wallpaper, lock screen, OEM support info)' -Phase 13 -Gates @('gate.elevated') -RequiresElevation -Modes @('new', 'dropship', 'takeover', 'replacement', 'repair') `
        -Detect { $s = Get-DEBrandingState; @{ applied = $s.applied } } -Desired { @{ applied = $true } } `
        -Apply { param($s) Set-DEBranding -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) Undo-DEBranding } -ManualAction 'Preview the wallpaper in the Branding page before applying.'
    Register-DEAction -Id 'branding.shortcuts' -Module 'branding' -Title 'DE support shortcuts (Start folder + one desktop link)' -Phase 13 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { @{ present = (Test-Path -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts')) } } -Desired { @{ present = $true } } `
        -Apply { param($s) Set-DESupportShortcuts -ClientProfile $ClientProfile }.GetNewClosure() `
        -Rollback { param($s) Remove-Item -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts') -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Join-Path $env:PUBLIC 'Desktop\DE Support.url') -Force -ErrorAction SilentlyContinue; 'removed' }
    Register-DEAction -Id 'branding.hostname' -Module 'branding' -Title 'Hostname follows the client pattern' -Phase 13 -Gates @('gate.elevated') -RequiresElevation -RequiresReboot -Modes @('new', 'dropship', 'replacement') `
        -Detect { $ctx = Get-DEContext; $role = "$(if ($ctx['device'] -and $ctx['device'].role) { $ctx['device'].role } else { 'LAP' })"; $role = $role.Substring(0, [Math]::Min(3, $role.Length)); $want = $(if ($ctx['desiredHostname']) { "$($ctx['desiredHostname'])" } elseif ($ctx['device'] -and $ctx['device'].desiredHostname) { "$($ctx['device'].desiredHostname)" } else { New-DEHostname -ClientProfile $ClientProfile -Role $role }); $pending = Get-DERegistryValue -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\ComputerName\ComputerName' -Name 'ComputerName'; @{ matches = (($env:COMPUTERNAME -ieq $want) -or ("$pending" -ieq $want)); want = $want; restartPending = ("$pending" -ieq $want -and $env:COMPUTERNAME -ine $want) } }.GetNewClosure() -Desired { @{ matches = $true } } `
        -Apply { param($s) $want = $s.Detected.want; Rename-Computer -NewName $want -Force; "renamed to $want (restart required)" }
}

Export-ModuleMember -Function ConvertTo-DELogonNoticeText, Get-DELogonNoticeDesired, Get-DELogonNoticeState, Set-DELogonNotice, Undo-DELogonNotice, Get-DEWindowsEdition, Get-DELockScreenState, Set-DELockScreen, Undo-DELockScreen, Clear-DEStaleUserHives, Open-DEUserHives, Close-DEUserHives, Get-DEUserScopeState, Set-DEUserScopeControl, Undo-DEUserScopeControl, Get-DEColorLuminance, Get-DEBrandingOptions, Get-DEBrandingLayout, Get-DEPrimaryScreenSize, Get-DEImageLuminance, New-DEOemLogo, Get-DEBrowserControlCatalog, Get-DEChromiumBrowsers, Get-DEBrowserExtensionPlan, ConvertTo-DEChromiumForceEntry, Test-DEFirefoxInstalled, Get-DEFirefoxDesiredPolicy, Compare-DEFirefoxPolicy, Set-DEFirefoxPolicy, Get-DEInstalledBrowserExtensions, Test-DEBrowserExtensionConflicts, Get-DEBaselineControls, Get-DEBaselineControlState, Set-DEBaselineControl, Invoke-DEBaselineAssessment, Register-DEBaselineActions, Get-DEBrowserPolicyProfile, Get-DEBrowserDesiredPolicy, Compare-DEBrowserPolicy, Set-DEBrowserPolicy, Set-DEDefaultBrowserAssociations, Register-DEBrowserActions, Get-DEBrandingAssets, New-DEBrandedWallpaper, Get-DEBrandingState, Set-DEBranding, Undo-DEBranding, New-DEHostname, Get-DEShortcutDefinitions, Set-DESupportShortcuts, Register-DEBrandingActions
