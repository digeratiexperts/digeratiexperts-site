<#
.SYNOPSIS
    DE Tech Tool: one shell for AI Toolkit, Endpoint Provisioning,
    Identity, JumpCloud, Security, Apps, OS baseline, Browser, Branding,
    Network, Vendor Admin Center, Audit / Repair and Evidence / Hub handoff.

.DESCRIPTION
    Interactive: a DE-styled WPF window. Headless (RMM / scripted): pass
    -Headless with -Mode and -Client; the console audits (or applies, with
    -Apply), exports the evidence bundle and exits with 0 ready, 1 failures,
    2 blocked. Engine work runs in a background runspace so the window stays
    responsive, shows progress and can be cancelled between steps.

.PARAMETER Page      Start page: Dashboard, Workflow, Discovery, Identity, Security, Apps, Browser, Baseline, Branding, Network, Vendors, AiToolkit, Evidence, Settings.
.PARAMETER Resume    Reopen after a restart and continue at the queued step.
.PARAMETER Headless  No window; requires -Client (profile id) and -Mode.
.PARAMETER Mode      audit | new | takeover | replacement | repair | co-managed | deprovision.
.PARAMETER Apply     Headless only: apply changes (default is audit, change nothing).
.PARAMETER DataDir   Override the data folder (default %ProgramData%\DE\TechConsole).
.PARAMETER SmokeTest Build the window and every page with -SmokeClient (default the alamo example), render each page
                     to PNG at 1440x900 and at 1366x768 with 125 percent scaling under -SmokeOut, never show the window, exit 0 when every
                     page built and 1 otherwise. Used by CI and windows\tests\Invoke-GuiSmoke.ps1.

.NOTES
    Windows PowerShell 5.1 or PowerShell 7 on Windows. Exit codes: 0, 1, 2 as above.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('Scan', 'Dashboard', 'Workflow', 'Discovery', 'Identity', 'Security', 'Apps', 'Browser', 'Baseline', 'Branding', 'Network', 'Toolbox', 'CommandLine', 'Migration', 'Vendors', 'AiToolkit', 'Evidence', 'Settings')]
    [string]$Page = 'Scan',
    [switch]$Resume,
    [switch]$Headless,
    [string]$Client,
    [ValidateSet('auto', 'audit', 'new', 'dropship', 'takeover', 'replacement', 'repair', 'co-managed', 'deprovision')]
    [string]$Mode = 'audit',
    [string]$Bundle,
    [string[]]$AddOn = @(),
    [string[]]$Solution = @(),
    [string]$Order,
    [switch]$PromptSecrets,
    [string]$ProfileFile,
    [string]$ResultFile,
    [switch]$Apply,
    [string]$Technician,   # asked once on this machine and remembered; RMM passes it
    [string]$DataDir,
    [switch]$SmokeTest,
    [string]$SmokeClient = 'alamo',
    [string]$SmokeOut,
    [string]$Toolbox,      # headless: run one Toolbox script by key (see the Command line page); -Apply to run it for real
    [string]$License       # install a DE licence token on this device (checked, never stored unless it verifies)
)
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

# ============================================================== host checks (before any module loads)
# Constrained Language Mode (WDAC/AppLocker without trust for this build) blocks the .NET calls the tool needs; refuse
# clearly instead of failing half way.
if ($ExecutionContext.SessionState.LanguageMode -ne 'FullLanguage') {
    $msg = "REFUSED: PowerShell is in $($ExecutionContext.SessionState.LanguageMode) (application control). Allow this signed build in the WDAC/AppLocker policy, then run it again."
    Write-Output $msg
    if ($ResultFile) { @{ overall = 'REFUSED'; exitCode = 2; message = $msg } | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding ASCII }
    exit 2
}
# A 32-bit host (many RMM agents) sees WOW6432Node and SysWOW64 instead of the real registry and System32: app
# detection, MDM, BitLocker, local accounts and branding would read and write the wrong place. Re-run in 64-bit
# Windows PowerShell, dot-sourced so the window's handlers still resolve at global scope, and pass the exit code on.
if ($env:OS -eq 'Windows_NT' -and -not [Environment]::Is64BitProcess -and [Environment]::Is64BitOperatingSystem) {
    $ps64 = Join-Path $env:WINDIR 'Sysnative\WindowsPowerShell\v1.0\powershell.exe'
    if (Test-Path -LiteralPath $ps64) {
        $lit = { param($v) "'" + ("$v" -replace "'", "''") + "'" }
        $parts = @(". $(& $lit $PSCommandPath)")
        foreach ($k in $PSBoundParameters.Keys) {
            $v = $PSBoundParameters[$k]
            if ($v -is [switch]) { $parts += "-$($k):`$$([bool]$v)" }
            elseif ($v -is [array]) { $parts += "-$k @($((@($v) | ForEach-Object { & $lit $_ }) -join ','))" }
            else { $parts += "-$k $(& $lit $v)" }
        }
        if ($WhatIfPreference) { $parts += '-WhatIf' }
        $cmd = ($parts -join ' ') + '; exit $LASTEXITCODE'
        $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
        $sta = $(if ($Headless) { @() } else { @('-Sta') })
        & $ps64 -NoProfile -ExecutionPolicy Bypass @sta -EncodedCommand $enc
        exit $LASTEXITCODE
    }
}
$ConsoleRoot = $PSScriptRoot
Import-Module (Join-Path $ConsoleRoot 'modules\DE.Workflow\DE.Workflow.psm1') -Force -DisableNameChecking
Import-DEConsoleModules -Root $ConsoleRoot

# ============================================================== headless
# the headless body runs in its own scope so its trap never touches the window path below
if ($Headless) { & {
    # One way out: every path prints RESULT and writes -ResultFile (JSON, no secrets) so RMM and first boot read the
    # outcome from data, never from stdout or from an exit code a wrapper might lose.
    function Exit-DEHeadless {
        param([int]$Code, [string]$Overall, [string]$Message = '', [string]$Next = '', [string]$Bundle = '', [switch]$RestartRequired)
        if ($Message) { Write-Host $Message }
        Write-Host ("RESULT: {0}{1}" -f $Overall, $(if ($Bundle) { "; bundle $Bundle" } else { '' }))
        if ($Next) { Write-Host "NEXT: $Next" }
        # no BOM in the result file: RMM and first boot parse it
        if ($ResultFile) { try { [ordered]@{ schema = 'de.techconsole.result/v1'; overall = $Overall; exitCode = $Code; restartRequired = [bool]$RestartRequired; message = (Protect-DEText $Message); next = (Protect-DEText $Next); bundle = $Bundle; at = (Get-Date).ToString('o') } | ConvertTo-Json | ForEach-Object { [IO.File]::WriteAllText($ResultFile, $_, (New-Object Text.UTF8Encoding $false)) } } catch { Write-Host "could not write $ResultFile : $($_.Exception.Message)" } }
        try { Clear-DESecrets } catch { }
        exit $Code
    }
    # an unexpected error still leaves by the one way out (RESULT line + -ResultFile), never as a bare crash with no result
    trap {
        $where = $(if ($_.InvocationInfo -and $_.InvocationInfo.ScriptLineNumber) { " ($([IO.Path]::GetFileName($_.InvocationInfo.ScriptName)) line $($_.InvocationInfo.ScriptLineNumber))" } else { '' })
        Exit-DEHeadless -Code 1 -Overall 'ERROR' -Message ("ERROR: {0}{1}. Nothing after this point ran." -f $_.Exception.Message, $where) -Next 'Send the console log and evidence folder to DE engineering; the run can be repeated once the cause is fixed.'
    }
    $null = Initialize-DEConsole -Root $ConsoleRoot -Mode $(if ($Apply) { 'Apply' } else { 'Audit' }) -DataDir $DataDir -DryRun:$WhatIfPreference
    $null = Clear-DERebootQueueIfRestarted   # restarts already done since they were queued no longer hold phases back
    # the technician is asked once per machine and remembered; an RMM run without -Technician is recorded as jrpetro
    $interactiveRun = [Environment]::UserInteractive; try { if ([Console]::IsInputRedirected) { $interactiveRun = $false } } catch { $interactiveRun = $false }
    if ($Technician) { Set-DEStateValue -Path 'settings.technician' -Value $Technician }
    else {
        $Technician = "$(Get-DEState -Path 'settings.technician')"
        if (-not $Technician -and $interactiveRun) { $t = "$(Read-Host -Prompt 'DE technician running this (press Enter for jrpetro)')".Trim(); $Technician = $(if ($t) { $t } else { 'jrpetro' }); Set-DEStateValue -Path 'settings.technician' -Value $Technician }
        if (-not $Technician) { $Technician = 'jrpetro'; Write-Host 'TECHNICIAN: not given; recorded as jrpetro (pass -Technician <name> from RMM)' }
    }
    $integrity = Write-DEIntegrityEvidence
    if ($License) { try { $ls = Set-DELicense -Token $License; Write-Host "LICENCE: $($ls.reason)" } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: $($_.Exception.Message)" } }
    $lic = Get-DELicenseStatus
    Write-Host ("LICENCE: {0} (policy {1}; build {2})" -f $(if ($lic.valid) { "$($lic.technician) until $($lic.expires)" } else { "none: $($lic.reason)" }), $lic.enforce, $lic.build)
    if ($Toolbox) {
        # one Toolbox script, then out: plan-only unless -Apply; scripts marked 'asks first' run only with -Apply (RMM means it)
        $r = $(if ($Apply) { Invoke-DECommunityScript -Key $Toolbox -Force -Confirm:$false } else { Invoke-DECommunityScript -Key $Toolbox -WhatIf })
        $code = $(switch ("$($r.result)") { 'PASS' { 0 } 'PLANNED' { 0 } 'FAIL' { 1 } default { 2 } })
        Exit-DEHeadless -Code $code -Overall "$($r.result)" -Message "TOOLBOX: $Toolbox $($r.result) $($r.detail)" -Bundle "$(if ($r.PSObject.Properties['log']) { $r.log })"
    }
    if ($Apply -and $integrity.status -eq 'tampered') { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message ('REFUSED: console files changed after packaging: ' + ($integrity.problems -join '; ')) -Next 'Re-download the signed package and compare its sha256.' }
    # powershell.exe -File passes '-Solution a,b' as one string: accept comma-separated lists from RMM command lines
    $AddOn = @($AddOn | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $Solution = @($Solution | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    # A dropship order (no secrets) names the client, bundle, end user and the exact device. An order from an
    # earlier run never carries over: without -Order this run has none.
    if (-not $Order) { Set-DEStateValue -Path 'order' -Value $null }
    if ($Order) {
        try { $ord = Import-DEOrderManifest -Path $Order } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: $($_.Exception.Message)" }
        if (-not $Client) { $Client = $ord['client'] }
        if (-not $Bundle -and $ord['bundle']) { $Bundle = $ord['bundle'] }
        if (-not @($AddOn | Where-Object { $_ }).Count -and $ord['addOns']) { $AddOn = @($ord['addOns']) }
        if (-not @($Solution | Where-Object { $_ }).Count -and $ord['solutions']) { $Solution = @($ord['solutions']) }
        if ($Mode -in @('audit', 'auto') -and $Apply) { $Mode = 'dropship' }
    }
    # -ProfileFile: a client profile shipped beside the tool (dropship kits), so the signed console tree is never edited
    $baseProfile = $null
    if ($ProfileFile) {
        try { $baseProfile = ConvertTo-DEHashtable (Get-Content -LiteralPath $ProfileFile -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: cannot read profile $ProfileFile ($($_.Exception.Message))" }
        $hits = @(Test-DEProfileHasSecrets -Profile $baseProfile); if ($hits.Count) { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: the profile file carries secret-looking fields ($($hits -join ', '))" }
        if ($Client -and $Client -ne "$($baseProfile['id'])") { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: the profile file is for '$($baseProfile['id'])', not '$Client'" }
        $Client = "$($baseProfile['id'])"
    }
    if (-not $Client) { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message 'REFUSED: -Headless needs -Client <profile id>, -ProfileFile <profile.json> or -Order <order.json>' }
    if (-not $baseProfile) { try { $baseProfile = Get-DEClientProfile -Id $Client } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: no client profile '$Client' ($($_.Exception.Message))" } }
    # RMM secure variables arrive as DE_SECRET_<NAME> environment variables; they move into the in-memory
    # SecureString store and are removed from the process environment straight away.
    foreach ($ev in @(Get-ChildItem Env: | Where-Object { $_.Name -like 'DE_SECRET_*' })) {
        Set-DESecret -Name ($ev.Name.Substring(10)) -Plain $ev.Value
        Remove-Item -LiteralPath ("Env:\" + $ev.Name) -ErrorAction SilentlyContinue
    }
    try { $clientProf = New-DEComposedProfile -ClientProfile $baseProfile -Bundle $Bundle -AddOn $AddOn -Solution $Solution } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: $($_.Exception.Message)" }
    $snap = Get-DEDiscoverySnapshot
    if ($Mode -eq 'auto') {
        $rec = Get-DERecommendedMode -Snapshot $snap -ClientProfile $clientProf
        $Mode = $rec.mode
        Write-Host ("MODE: {0} (recommended: {1})" -f $Mode, ($rec.reasons -join '; '))
        Add-DEEvidence -Step 'plan.mode' -Module 'plan' -Before 'auto' -ActionTaken "mode $Mode chosen from discovery" -Result 'INFO' -Verification ($rec.reasons -join '; ') | Out-Null
    }
    $ids = @(Initialize-DEWorkflow -ClientProfile $clientProf -Mode $Mode)
    $planName = $(if ($clientProf.plan.bundleName) { $clientProf.plan.bundleName } elseif (@($clientProf.plan.solutions).Count) { 'standalone: ' + (@($clientProf.plan.solutions) -join ', ') } else { 'client profile' })
    Write-Host ("PLAN: {0}; mode {1}; {2} step(s)" -f $planName, $Mode, $ids.Count)
    $null = New-DEProvisioningContext -Snapshot $snap -ClientId $Client -Mode $Mode -Technician $Technician
    if ($Order) {
        $null = Import-DEOrderManifest -Path $Order   # re-apply the order's end user over the discovered one
        $canAsk = [Environment]::UserInteractive; try { if ([Console]::IsInputRedirected) { $canAsk = $false } } catch { $canAsk = $false }
        if ($Apply -and -not "$(Get-DEHashPath -Object (Get-DEOrder) -Path 'device.serial')".Trim()) {
            # the order has no serial yet: the technician at the device reads it off the chassis sticker, and it must be
            # this machine's own serial; the order's model is still checked below. No console means no one to ask.
            $haveSerial = "$(Get-DEHashPath -Object $snap -Path 'device.serial')".Trim()
            if (-not $canAsk) { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message 'REFUSED: the order has no serial number and there is no one at the device to read it. Nothing was changed.' -Next 'Add the serial from the ship notice to order.json, or run FirstBoot at the device.' }
            $typed = "$(Read-Host -Prompt 'The order has no serial yet. Type the serial number from the sticker on this device')".Trim()
            if (-not $typed -or -not $haveSerial -or $typed -ine $haveSerial) {
                Add-DEEvidence -Step 'order.verify-device' -Module 'order' -Before 'order without serial' -ActionTaken 'serial typed at the device did not match' -Result 'BLOCKED' -Verification ("typed '{0}', device reports '{1}'" -f $typed, $haveSerial) | Out-Null
                Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message ("REFUSED: the serial typed ('{0}') is not this device's serial ('{1}'). Nothing was changed." -f $typed, $haveSerial) -Next 'Check you are at the right device and read the sticker again.'
            }
            $o = Get-DEOrder; $o['device']['serial'] = $haveSerial; $o['device']['serialSource'] = 'typed at first boot, matched the device'; Set-DEStateValue -Path 'order' -Value $o
            Add-DEEvidence -Step 'order.serial-confirmed' -Module 'order' -Before 'order without serial' -ActionTaken 'serial read from the sticker and matched the device' -Result 'PASS' -Verification "serial $haveSerial" | Out-Null
        }
        $match = Test-DEOrderMatch -Device (Get-DEHashPath -Object $snap -Path 'device')
        Write-Host ("ORDER: {0} ({1})" -f $match.Status, $match.Detail)
        if ($Apply -and $match.Status -ne 'PASS') {
            # the wrong (or an unidentifiable) unit is never provisioned: stop before any change, with evidence of why
            Add-DEEvidence -Step 'order.verify-device' -Module 'order' -Before 'order loaded' -ActionTaken 'provisioning refused' -Result 'BLOCKED' -Verification $match.Detail | Out-Null
            $b = Export-DEEvidenceBundle -Snapshot $snap -ClientProfile $clientProf
            Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message ("REFUSED: {0}. Nothing was changed." -f $match.Detail) -Bundle $b.zip -Next 'Check the serial on the chassis against the order; fix the order if the distributor shipped a different unit.'
        }
    }
    if ($PromptSecrets) {
        # A technician on the call types each runtime secret the plan needs (masked; memory only).
        # Without a console to type into (RMM, redirected input) Read-Host would end the process with exit 0
        # before any work, which a caller could read as READY; skip the prompts and let the gates say BLOCKED.
        $canPrompt = [Environment]::UserInteractive; try { if ([Console]::IsInputRedirected) { $canPrompt = $false } } catch { $canPrompt = $false }
        $needed = @(Get-DEActions -Mode $Mode | ForEach-Object { $_.RequiresSecrets } | Where-Object { $_ } | Select-Object -Unique)
        if (-not $canPrompt) { if ($needed.Count) { Write-Host ("SECRETS: no console to type into; not asked for {0}. Use DE_SECRET_<NAME> variables or the DE vault." -f ($needed -join ', ')) } }
        else { foreach ($n in $needed) { if (-not (Test-DESecret -Name $n)) { try { $sec = Read-Host -AsSecureString -Prompt "$n (runtime only, press Enter to skip)"; if ($sec -and $sec.Length -gt 0) { Set-DESecret -Name $n -SecureValue $sec } } catch { Write-Host "SECRETS: could not read $n ($($_.Exception.Message)); skipped" } } } }
    }
    $restart = $false
    if ($Apply -and $Mode -ne 'audit') {
        foreach ($ph in (Get-DEActions -Mode $Mode | ForEach-Object { $_.Phase } | Sort-Object -Unique)) {
            # a queued restart stops the run: later phases never apply on top of a pending restart
            if (@(Get-DERebootQueue).Count) { $restart = $true; break }
            $null = Invoke-DEPhase -Phase $ph -Mode $Mode
        }
        if (@(Get-DERebootQueue).Count) { $restart = $true }
    } else { $null = Invoke-DEAudit -Mode $Mode }
    $b = Export-DEEvidenceBundle -Snapshot $snap -ClientProfile $clientProf
    $null = Send-DEHubPayload -Payload (New-DEHubPayload -Record $b.record -BundleSha256 $b.sha256 -BundlePath $b.zip)
    $r = Get-DEReadiness
    $next = Get-DENextAction -Mode $Mode
    $nextText = $(if ($restart) { 'Restart the device, then run the same command again; it continues where it stopped. (' + ((@(Get-DERebootQueue) | ForEach-Object { $_['reason'] }) -join '; ') + ')' } else { "$($next.title) ($($next.why))" })
    # 0 only for READY; 2 when a gate, secret or elevation blocked the run (and nothing outright failed); 1 for anything unfinished
    $code = $(switch ($r.overall) { 'READY' { 0 } 'READY WITH EXCEPTIONS' { 0 } 'NOT READY' { $(if ($r.blocked) { 2 } else { 1 }) } default { 1 } })
    if ($restart -and $code -eq 0) { $code = 1 }
    Exit-DEHeadless -Code $code -Overall $(if ($restart -and $r.overall -like 'READY*') { 'RESTART REQUIRED' } else { $r.overall }) -Bundle "$($b.zip) (sha256 $($b.sha256))" -Next $nextText -RestartRequired:$restart
} }

# ============================================================== window
if ($env:OS -ne 'Windows_NT') { Write-Host 'The window needs Windows. Use -Headless on other platforms.'; exit 2 }
if (-not $SmokeTest -and -not [Environment]::UserInteractive) { Write-Output 'No desktop session (service, SYSTEM or RMM): the window cannot open here. Run with -Headless.'; exit 2 }
if ($SmokeTest -and -not $DataDir) { $DataDir = Join-Path ([IO.Path]::GetTempPath()) ("de-console-smoke-{0}" -f $PID) }
# The window's button handlers are closures that only see global-scope functions: started with '& script.ps1',
# 'Run with PowerShell' or the ISE, the script runs in a child scope and every button would fail. Relaunch via -File.
$atGlobalScope = [bool](Get-Variable -Name ConsoleRoot -Scope Global -ErrorAction SilentlyContinue)
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA' -or -not $atGlobalScope) {
    $exe = (Get-Process -Id $PID).Path
    # Start-Process joins -ArgumentList without quoting: quote every value that may hold a space (C:\Program Files\...)
    $q = { param($v) if ("$v" -match '\s' -and "$v" -notmatch '^".*"$') { '"' + $v + [regex]::Match("$v", '\\*$').Value + '"' } else { "$v" } }
    if ($SmokeTest) {
        $smokeArgs = @('-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-SmokeTest', '-SmokeClient', $SmokeClient, '-DataDir', $DataDir); if ($SmokeOut) { $smokeArgs += @('-SmokeOut', $SmokeOut) }
        $smokeArgs = @($smokeArgs | ForEach-Object { & $q $_ })
        $p = Start-Process -FilePath $exe -ArgumentList $smokeArgs -Wait -PassThru -NoNewWindow; exit $p.ExitCode
    }
    $argsList = @('-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Page', $Page); if ($Technician) { $argsList += @('-Technician', $Technician) }; if ($Resume) { $argsList += '-Resume' }; if ($DataDir) { $argsList += @('-DataDir', $DataDir) }
    $argsList = @($argsList | ForEach-Object { & $q $_ })
    Start-Process -FilePath $exe -ArgumentList $argsList | Out-Null; exit 0
}
# Per-monitor DPI awareness before WPF loads (crisp text at 150-200 percent scaling).
try {
    Add-Type -Namespace DE.Native -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);' -ErrorAction Stop
    [void][DE.Native.Dpi]::SetProcessDpiAwarenessContext([IntPtr](-4))
} catch { }
Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase, System.Windows.Forms

$null = Initialize-DEConsole -Root $ConsoleRoot -Mode Audit -DataDir $DataDir
$settingsPath = Join-Path (Get-DEConsole).Dirs.State 'gui-settings.json'
$Settings = @{ technician = "$Technician"; client = ''; mode = 'audit'; lastPage = $Page; hubEndpoint = ''; dryRun = $true }
if (Test-Path -LiteralPath $settingsPath) { try { $loaded = ConvertTo-DEHashtable (Get-Content -LiteralPath $settingsPath -Raw -Encoding UTF8 | ConvertFrom-Json); foreach ($k in $loaded.Keys) { $Settings[$k] = $loaded[$k] } } catch { } }
function Save-GuiSettings { try { $Settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8 } catch { } }
if ($Technician) { $Settings.technician = $Technician }
if (-not $Settings.technician) { $Settings.technician = "$(Get-DEState -Path 'settings.technician')" }
if ($Settings.hubEndpoint) { Set-DEStateValue -Path 'settings.hub.endpoint' -Value $Settings.hubEndpoint }

$highContrast = [System.Windows.SystemParameters]::HighContrast
$fontDir = Join-Path (Split-Path -Parent $ConsoleRoot) 'fonts'
$FontUi = 'Segoe UI'; $FontDisplay = 'Segoe UI Semibold'
if (Test-Path -LiteralPath (Join-Path $fontDir 'SpaceGrotesk-Variable.ttf')) { $FontUi = "file:///$($fontDir -replace '\\','/')/#Space Grotesk, Segoe UI"; $FontDisplay = "file:///$($fontDir -replace '\\','/')/#Oxanium, Segoe UI Semibold" }

$XamlText = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="DE Tech Tool" Width="1280" Height="800" MinWidth="800" MinHeight="520" WindowStartupLocation="CenterScreen"
        Background="#FF050312" Foreground="#FFF7F5F2" FontSize="13" UseLayoutRounding="True" SnapsToDevicePixels="True" TextOptions.TextFormattingMode="Ideal">
  <Window.Resources>
    <SolidColorBrush x:Key="Well" Color="#FF050312"/><SolidColorBrush x:Key="Surface" Color="#FF0A0A0A"/><SolidColorBrush x:Key="Raised" Color="#FF151217"/><SolidColorBrush x:Key="RaisedHover" Color="#FF1E1A22"/>
    <SolidColorBrush x:Key="Hairline" Color="#1AFFFFFF"/><SolidColorBrush x:Key="Paper" Color="#FFF7F5F2"/><SolidColorBrush x:Key="Muted" Color="#99F7F5F2"/>
    <SolidColorBrush x:Key="Magenta" Color="#FFD3126A"/><SolidColorBrush x:Key="MagentaHover" Color="#FFE8317F"/><SolidColorBrush x:Key="Violet" Color="#FF7C3AED"/><SolidColorBrush x:Key="Lavender" Color="#FFA78BFA"/>
    <SolidColorBrush x:Key="Pass" Color="#FF34D399"/><SolidColorBrush x:Key="Warn" Color="#FFF5B942"/>
    <Style x:Key="Card" TargetType="Border"><Setter Property="Background" Value="{StaticResource Raised}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="BorderThickness" Value="1"/><Setter Property="CornerRadius" Value="12"/><Setter Property="Padding" Value="14"/></Style>
    <Style x:Key="Eyebrow" TargetType="TextBlock"><Setter Property="Foreground" Value="{StaticResource Muted}"/><Setter Property="FontSize" Value="11"/><Setter Property="FontWeight" Value="SemiBold"/><Setter Property="Typography.Capitals" Value="AllSmallCaps"/></Style>
    <Style x:Key="Mono" TargetType="TextBlock"><Setter Property="FontFamily" Value="Cascadia Mono, Consolas"/><Setter Property="FontSize" Value="12"/><Setter Property="Foreground" Value="{StaticResource Muted}"/></Style>
    <Style x:Key="Btn" TargetType="Button">
      <Setter Property="Background" Value="Transparent"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="BorderThickness" Value="1"/>
      <Setter Property="Padding" Value="12,7"/><Setter Property="Margin" Value="0,0,8,8"/><Setter Property="Cursor" Value="Hand"/><Setter Property="FocusVisualStyle" Value="{x:Null}"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button">
        <Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="8" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Left" VerticalAlignment="Center"/></Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="Background" Value="{StaticResource RaisedHover}"/><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Lavender}"/></Trigger>
          <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Magenta}"/><Setter TargetName="Bd" Property="BorderThickness" Value="2"/></Trigger>
          <Trigger Property="IsEnabled" Value="False"><Setter TargetName="Bd" Property="Opacity" Value="0.35"/></Trigger>
        </ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter>
    </Style>
    <Style x:Key="Primary" TargetType="Button" BasedOn="{StaticResource Btn}"><Setter Property="Background" Value="{StaticResource Magenta}"/><Setter Property="BorderThickness" Value="0"/><Setter Property="FontWeight" Value="SemiBold"/></Style>
    <Style x:Key="Nav" TargetType="RadioButton">
      <Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="Margin" Value="0,1"/><Setter Property="Cursor" Value="Hand"/><Setter Property="FocusVisualStyle" Value="{x:Null}"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="RadioButton">
        <Border x:Name="Bd" Background="Transparent" CornerRadius="8" Padding="12,8"><Grid><Grid.ColumnDefinitions><ColumnDefinition Width="4"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
          <Border x:Name="Rail" Grid.Column="0" Background="Transparent" CornerRadius="2" Margin="0,0,8,0"/><ContentPresenter Grid.Column="1" Margin="8,0,0,0" VerticalAlignment="Center"/></Grid></Border>
        <ControlTemplate.Triggers>
          <Trigger Property="IsChecked" Value="True"><Setter TargetName="Bd" Property="Background" Value="{StaticResource Raised}"/><Setter TargetName="Rail" Property="Background" Value="{StaticResource Magenta}"/></Trigger>
          <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="Background" Value="{StaticResource RaisedHover}"/></Trigger>
          <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Magenta}"/><Setter TargetName="Bd" Property="BorderThickness" Value="1"/></Trigger>
        </ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter>
    </Style>
    <!-- text inputs: dark field, lavender on hover, magenta when focused (Windows' default template flashes system blue) -->
    <Style TargetType="TextBox"><Setter Property="Background" Value="{StaticResource Surface}"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="BorderThickness" Value="1"/><Setter Property="Padding" Value="8,5"/><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="CaretBrush" Value="{StaticResource Magenta}"/><Setter Property="SelectionBrush" Value="{StaticResource Violet}"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="TextBox"><Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="6"><ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}" Focusable="False"/></Border>
        <ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Lavender}"/></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Magenta}"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter TargetName="Bd" Property="Opacity" Value="0.45"/></Trigger><Trigger Property="IsReadOnly" Value="True"><Setter TargetName="Bd" Property="Background" Value="Transparent"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
    <Style TargetType="PasswordBox"><Setter Property="Background" Value="{StaticResource Surface}"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="BorderThickness" Value="1"/><Setter Property="Padding" Value="8,5"/><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="CaretBrush" Value="{StaticResource Magenta}"/><Setter Property="SelectionBrush" Value="{StaticResource Violet}"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="PasswordBox"><Border x:Name="Bd" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="6"><ScrollViewer x:Name="PART_ContentHost" Margin="{TemplateBinding Padding}" Focusable="False"/></Border>
        <ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Lavender}"/></Trigger><Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Magenta}"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
    <!-- drop-downs: Windows draws a light grey box and list on the dark window; this keeps both dark -->
    <Style TargetType="ComboBoxItem"><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="Background" Value="Transparent"/><Setter Property="Padding" Value="10,6"/><Setter Property="Cursor" Value="Hand"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="ComboBoxItem"><Border x:Name="Bd" Background="{TemplateBinding Background}" Padding="{TemplateBinding Padding}" CornerRadius="4"><ContentPresenter/></Border>
        <ControlTemplate.Triggers><Trigger Property="IsHighlighted" Value="True"><Setter TargetName="Bd" Property="Background" Value="{StaticResource RaisedHover}"/></Trigger><Trigger Property="IsSelected" Value="True"><Setter TargetName="Bd" Property="Background" Value="#337C3AED"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter Property="Foreground" Value="{StaticResource Muted}"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
    <Style TargetType="ComboBox"><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="MinHeight" Value="30"/><Setter Property="Cursor" Value="Hand"/><Setter Property="MaxDropDownHeight" Value="360"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="ComboBox"><Grid>
        <ToggleButton x:Name="Toggle" Focusable="False" ClickMode="Press" IsChecked="{Binding IsDropDownOpen, Mode=TwoWay, RelativeSource={RelativeSource TemplatedParent}}">
          <ToggleButton.Template><ControlTemplate TargetType="ToggleButton"><Border x:Name="Bd" Background="{StaticResource Surface}" BorderBrush="{StaticResource Hairline}" BorderThickness="1" CornerRadius="6"><Path HorizontalAlignment="Right" VerticalAlignment="Center" Margin="0,0,12,0" Data="M0,0 L4.5,4.5 L9,0" Stroke="{StaticResource Muted}" StrokeThickness="1.6"/></Border>
            <ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Lavender}"/></Trigger><Trigger Property="IsChecked" Value="True"><Setter TargetName="Bd" Property="BorderBrush" Value="{StaticResource Magenta}"/></Trigger></ControlTemplate.Triggers></ControlTemplate></ToggleButton.Template></ToggleButton>
        <ContentPresenter IsHitTestVisible="False" Margin="10,5,30,5" VerticalAlignment="Center" Content="{TemplateBinding SelectionBoxItem}" ContentTemplate="{TemplateBinding SelectionBoxItemTemplate}" TextBlock.Foreground="{TemplateBinding Foreground}"/>
        <Border x:Name="Focus" BorderBrush="{StaticResource Magenta}" BorderThickness="0" CornerRadius="6" IsHitTestVisible="False"/>
        <Popup IsOpen="{TemplateBinding IsDropDownOpen}" Placement="Bottom" AllowsTransparency="True" Focusable="False" PopupAnimation="Fade">
          <Border Background="{StaticResource Raised}" BorderBrush="{StaticResource Hairline}" BorderThickness="1" CornerRadius="8" Padding="4" Margin="0,4,0,0" MinWidth="{Binding ActualWidth, RelativeSource={RelativeSource TemplatedParent}}" MaxHeight="{TemplateBinding MaxDropDownHeight}"><ScrollViewer VerticalScrollBarVisibility="Auto"><ItemsPresenter KeyboardNavigation.DirectionalNavigation="Contained"/></ScrollViewer></Border></Popup></Grid>
        <ControlTemplate.Triggers><Trigger Property="IsKeyboardFocusWithin" Value="True"><Setter TargetName="Focus" Property="BorderThickness" Value="2"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter Property="Opacity" Value="0.45"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
    <!-- thin dark scrollbars (the default light-grey bars glare on the dark surfaces) -->
    <Style x:Key="ThumbStyle" TargetType="Thumb"><Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Thumb"><Border x:Name="T" Background="#40F7F5F2" CornerRadius="4"/><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="T" Property="Background" Value="#80F7F5F2"/></Trigger><Trigger Property="IsDragging" Value="True"><Setter TargetName="T" Property="Background" Value="{StaticResource Lavender}"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
    <Style TargetType="ScrollBar"><Setter Property="Background" Value="Transparent"/><Setter Property="Width" Value="10"/><Setter Property="MinWidth" Value="10"/>
      <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="ScrollBar"><Grid Background="Transparent"><Track x:Name="PART_Track" IsDirectionReversed="True" Margin="2"><Track.Thumb><Thumb Style="{StaticResource ThumbStyle}"/></Track.Thumb></Track></Grid></ControlTemplate></Setter.Value></Setter>
      <Style.Triggers><Trigger Property="Orientation" Value="Horizontal"><Setter Property="Width" Value="Auto"/><Setter Property="MinWidth" Value="0"/><Setter Property="Height" Value="10"/><Setter Property="MinHeight" Value="10"/>
        <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="ScrollBar"><Grid Background="Transparent"><Track x:Name="PART_Track" IsDirectionReversed="False" Margin="2"><Track.Thumb><Thumb Style="{StaticResource ThumbStyle}"/></Track.Thumb></Track></Grid></ControlTemplate></Setter.Value></Setter></Trigger></Style.Triggers></Style>
    <Style TargetType="ToolTip"><Setter Property="Background" Value="{StaticResource Raised}"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="Padding" Value="10,6"/><Setter Property="MaxWidth" Value="420"/></Style>
    <Style TargetType="CheckBox"><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="Margin" Value="0,4"/></Style>
    <Style TargetType="DataGrid"><Setter Property="Background" Value="Transparent"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderThickness" Value="0"/><Setter Property="RowBackground" Value="Transparent"/><Setter Property="AlternatingRowBackground" Value="#0DFFFFFF"/><Setter Property="GridLinesVisibility" Value="None"/><Setter Property="HeadersVisibility" Value="Column"/><Setter Property="AutoGenerateColumns" Value="False"/><Setter Property="CanUserAddRows" Value="False"/><Setter Property="IsReadOnly" Value="True"/><Setter Property="SelectionMode" Value="Single"/><Setter Property="RowHeaderWidth" Value="0"/></Style>
    <Style TargetType="DataGridColumnHeader"><Setter Property="Background" Value="Transparent"/><Setter Property="Foreground" Value="{StaticResource Muted}"/><Setter Property="FontSize" Value="11"/><Setter Property="Padding" Value="8,6"/><Setter Property="BorderThickness" Value="0,0,0,1"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/></Style>
    <Style TargetType="DataGridCell"><Setter Property="BorderThickness" Value="0"/><Setter Property="Padding" Value="8,5"/><Setter Property="Template"><Setter.Value><ControlTemplate TargetType="DataGridCell"><Border Padding="{TemplateBinding Padding}" Background="{TemplateBinding Background}"><ContentPresenter VerticalAlignment="Center"/></Border></ControlTemplate></Setter.Value></Setter>
      <Style.Triggers><Trigger Property="IsSelected" Value="True"><Setter Property="Background" Value="#337C3AED"/><Setter Property="Foreground" Value="{StaticResource Paper}"/></Trigger></Style.Triggers></Style>
    <Style TargetType="DataGridRow"><Setter Property="Background" Value="Transparent"/><Setter Property="Foreground" Value="{StaticResource Paper}"/>
      <Style.Triggers>
        <DataTrigger Binding="{Binding State}" Value="PASS"><Setter Property="Foreground" Value="{StaticResource Pass}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="NO CHANGE"><Setter Property="Foreground" Value="{StaticResource Pass}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="WARN"><Setter Property="Foreground" Value="{StaticResource Warn}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="DRIFT"><Setter Property="Foreground" Value="{StaticResource Warn}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="EXCEPTION"><Setter Property="Foreground" Value="{StaticResource Lavender}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="PLANNED"><Setter Property="Foreground" Value="{StaticResource Lavender}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="BLOCKED"><Setter Property="Foreground" Value="{StaticResource Magenta}"/></DataTrigger>
        <DataTrigger Binding="{Binding State}" Value="FAIL"><Setter Property="Foreground" Value="{StaticResource Magenta}"/></DataTrigger>
      </Style.Triggers></Style>
  </Window.Resources>
  <Grid Background="{Binding Background, RelativeSource={RelativeSource AncestorType=Window}}">
    <Grid.ColumnDefinitions><ColumnDefinition Width="232"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions>
    <!-- nav rail -->
    <Border Grid.Column="0" Background="#FF08061A" BorderBrush="{StaticResource Hairline}" BorderThickness="0,0,1,0" Padding="14,18">
      <DockPanel LastChildFill="True">
        <StackPanel DockPanel.Dock="Top" Margin="6,0,0,18">
          <Image x:Name="BrandLogo" Height="30" MaxWidth="188" HorizontalAlignment="Left" Stretch="Uniform" Margin="0,0,0,9" AutomationProperties.Name="Digerati Experts"/>
          <TextBlock Text="DE Tech Tool" FontSize="19" FontWeight="SemiBold" Margin="0,2,0,0"/>
          <TextBlock x:Name="TxtVersion" Style="{StaticResource Mono}" Margin="0,2,0,0"/>
        </StackPanel>
        <StackPanel DockPanel.Dock="Bottom" Margin="4,12,0,0">
          <TextBlock x:Name="TxtModeBadge" Style="{StaticResource Mono}"/>
        </StackPanel>
        <ScrollViewer VerticalScrollBarVisibility="Auto">
          <StackPanel x:Name="NavPanel" KeyboardNavigation.TabNavigation="Cycle"/>
        </ScrollViewer>
      </DockPanel>
    </Border>
    <!-- main -->
    <Grid Grid.Column="1" Margin="22,18,22,14">
      <Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
      <!-- identity header -->
      <Border Grid.Row="0" Style="{StaticResource Card}" Padding="16,12" Margin="0,0,0,14">
        <Grid><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
          <StackPanel Grid.Column="0"><TextBlock Text="Technician" Style="{StaticResource Eyebrow}"/><TextBlock x:Name="HdrTech" FontSize="15" FontWeight="SemiBold"/></StackPanel>
          <StackPanel Grid.Column="1"><TextBlock Text="Client" Style="{StaticResource Eyebrow}"/><TextBlock x:Name="HdrClient" FontSize="15" FontWeight="SemiBold"/><TextBlock x:Name="HdrClientWhy" Style="{StaticResource Mono}" TextTrimming="CharacterEllipsis"/></StackPanel>
          <StackPanel Grid.Column="2"><TextBlock Text="End user" Style="{StaticResource Eyebrow}"/><TextBlock x:Name="HdrUser" FontSize="15" FontWeight="SemiBold"/><TextBlock x:Name="HdrUserWhy" Style="{StaticResource Mono}"/></StackPanel>
          <StackPanel Grid.Column="3"><TextBlock Text="Device" Style="{StaticResource Eyebrow}"/><TextBlock x:Name="HdrDevice" FontSize="15" FontWeight="SemiBold"/><TextBlock x:Name="HdrDeviceSub" Style="{StaticResource Mono}" TextTrimming="CharacterEllipsis"/></StackPanel>
          <StackPanel Grid.Column="4" VerticalAlignment="Center" HorizontalAlignment="Right"><TextBlock Text="Readiness" Style="{StaticResource Eyebrow}" HorizontalAlignment="Right"/><TextBlock x:Name="HdrReady" FontSize="17" FontWeight="Bold" HorizontalAlignment="Right"/></StackPanel>
        </Grid>
      </Border>
      <ContentControl x:Name="PageHost" Grid.Row="1"/>
      <!-- footer: progress + log line -->
      <Grid Grid.Row="2" Margin="0,12,0,0"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="220"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
        <TextBlock x:Name="TxtStatus" Foreground="{StaticResource Muted}" VerticalAlignment="Center" TextTrimming="CharacterEllipsis"/>
        <ProgressBar x:Name="Progress" Grid.Column="1" Height="6" Margin="12,0" Minimum="0" Maximum="100" Foreground="{StaticResource Magenta}" Background="{StaticResource Raised}" BorderThickness="0" Visibility="Hidden"/>
        <Button x:Name="BtnCancel" Grid.Column="2" Style="{StaticResource Btn}" Content="Cancel" Margin="0" Visibility="Collapsed" AutomationProperties.Name="Cancel the running job"/>
      </Grid>
    </Grid>
  </Grid>
</Window>
"@
if ($highContrast) {
    # StaticResource brushes resolve once, at load: the high-contrast colours have to be in the XAML before it loads.
    $sysColor = @{ Well = 'WindowColor'; Surface = 'WindowColor'; Raised = 'WindowColor'; RaisedHover = 'ControlColor'; Hairline = 'WindowTextColor'; Paper = 'WindowTextColor'; Muted = 'GrayTextColor'
        Magenta = 'HighlightColor'; MagentaHover = 'HighlightColor'; Violet = 'HighlightColor'; Lavender = 'HighlightColor'; Pass = 'WindowTextColor'; Warn = 'WindowTextColor' }
    foreach ($k in $sysColor.Keys) { $XamlText = [regex]::Replace($XamlText, "(<SolidColorBrush x:Key=`"$k`" Color=`")#[0-9A-Fa-f]{6,8}(`"/>)", ('$1{x:Static SystemColors.' + $sysColor[$k] + '}$2')) }
    $XamlText = $XamlText -replace 'Background="#FF08061A"', 'Background="{x:Static SystemColors.WindowBrush}"' -replace 'Value="#337C3AED"', 'Value="{x:Static SystemColors.HighlightBrush}"' -replace 'Value="#0DFFFFFF"', 'Value="{x:Static SystemColors.ControlBrush}"'
    $XamlText = $XamlText -replace 'Background="#FF050312" Foreground="#FFF7F5F2"', 'Background="{x:Static SystemColors.WindowBrush}" Foreground="{x:Static SystemColors.WindowTextBrush}"'
    $XamlText = $XamlText -replace '<Setter Property="FocusVisualStyle" Value="\{x:Null\}"/>', ''   # keep the system focus rectangle
    $XamlText = $XamlText -replace 'Background="#40F7F5F2"', 'Background="{x:Static SystemColors.ControlDarkBrush}"' -replace 'Value="#80F7F5F2"', 'Value="{x:Static SystemColors.ControlDarkDarkBrush}"'
}
[xml]$Xaml = $XamlText
$Win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $Xaml))
# Fit the screen: at 1366x768 with 125-150 % scaling the work area is ~1093x582 or smaller (device-independent units).
$wa = [System.Windows.SystemParameters]::WorkArea
$Win.Width = [Math]::Min($Win.Width, [Math]::Max(800, $wa.Width - 16)); $Win.Height = [Math]::Min($Win.Height, [Math]::Max(520, $wa.Height - 16))
if ($wa.Width -lt 1100 -or $wa.Height -lt 700) { $Win.WindowState = 'Maximized' }
$Win.FontFamily = New-Object System.Windows.Media.FontFamily $FontUi
$UI = @{}
foreach ($n in @('NavPanel', 'PageHost', 'TxtVersion', 'TxtModeBadge', 'HdrTech', 'HdrClient', 'HdrClientWhy', 'HdrUser', 'HdrUserWhy', 'HdrDevice', 'HdrDeviceSub', 'HdrReady', 'TxtStatus', 'Progress', 'BtnCancel', 'BrandLogo')) { $UI[$n] = $Win.FindName($n) }
$UI.TxtVersion.Text = "v$((Get-DEConsole).ConsoleVersion)"; $bi = Get-DEBuildInfo; $Win.Title = "DE Tech Tool v$((Get-DEConsole).ConsoleVersion) · build $($bi.buildId) · issued to $($bi.issuedTo)"
$brandLogoPath = Join-Path $ConsoleRoot 'assets\brand\digerati-logo-reverse-2400.png'; if (-not (Test-Path -LiteralPath $brandLogoPath)) { $brandLogoPath = Join-Path $ConsoleRoot 'assets\brand\digerati-logo-reverse-600.png' }
$brandIconPath = Join-Path $ConsoleRoot 'assets\brand\digerati-mark-tile-64.png'
try {
    if ($UI.BrandLogo -and (Test-Path -LiteralPath $brandLogoPath)) {
        $bmp = New-Object System.Windows.Media.Imaging.BitmapImage
        $bmp.BeginInit(); $bmp.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad; $bmp.UriSource = New-Object System.Uri($brandLogoPath); $bmp.EndInit(); $bmp.Freeze()
        $UI.BrandLogo.Source = $bmp
    }
    if (Test-Path -LiteralPath $brandIconPath) {
        $ico = New-Object System.Windows.Media.Imaging.BitmapImage
        $ico.BeginInit(); $ico.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad; $ico.UriSource = New-Object System.Uri($brandIconPath); $ico.EndInit(); $ico.Freeze()
        $Win.Icon = $ico
    }
} catch { Write-DELog -Level WARN -Message "brand asset load failed: $($_.Exception.Message)" }

# ============================================================== session state
$S = @{ Profile = $null; Snapshot = $null; Mode = $Settings.mode; Job = $null; Timer = $null; LogPos = 0; CurrentPage = $Page; LastBundle = $null; LastJobError = $null; LogBox = $null }
function Get-Brush { param([string]$Key) return $Win.Resources[$Key] }
function Get-StateBrush { param([string]$State) switch -Regex ($State) { '^(PASS|NO CHANGE|READY)$' { Get-Brush 'Pass' } '^(WARN|DRIFT|IN PROGRESS|NOT RUN)$' { Get-Brush 'Warn' } '^(EXCEPTION|PLANNED|SKIPPED|NOT IN PLAN|READY WITH EXCEPTIONS)$' { Get-Brush 'Lavender' } default { Get-Brush 'Magenta' } } }
function Set-Status { param([string]$Text) $UI.TxtStatus.Text = (Protect-DEText $Text) }

function New-El {
    <# Tiny element factory to keep page code readable. #>
    param([string]$Type, [hashtable]$Props = @{}, [object[]]$Children = @())
    $el = New-Object "System.Windows.Controls.$Type"
    if ($Type -in @('TextBox', 'PasswordBox', 'ComboBox') -and $Props.ContainsKey('Width') -and -not $Props.ContainsKey('HorizontalAlignment')) { $el.HorizontalAlignment = 'Left' }   # a fixed width in a stretching panel would float to the middle
    foreach ($k in $Props.Keys) {
        if ($k -eq 'Style') { $el.Style = $Win.Resources[$Props[$k]] }
        elseif ($k -eq 'Name') { [System.Windows.Automation.AutomationProperties]::SetName($el, $Props[$k]) }
        elseif ($k -eq 'Click') { $el.Add_Click($Props[$k]) }
        elseif ($k -eq 'Grid.Column') { [System.Windows.Controls.Grid]::SetColumn($el, $Props[$k]) }
        elseif ($k -eq 'Grid.Row') { [System.Windows.Controls.Grid]::SetRow($el, $Props[$k]) }
        elseif ($k -eq 'Dock') { [System.Windows.Controls.DockPanel]::SetDock($el, $Props[$k]) }
        else { $el.$k = $Props[$k] }
    }
    if ($Children.Count) { if ($el -is [System.Windows.Controls.Panel]) { foreach ($c in $Children) { if ($null -ne $c) { [void]$el.Children.Add($c) } } } elseif ($el -is [System.Windows.Controls.Decorator] -or $el -is [System.Windows.Controls.ContentControl]) { $el.Child = $Children[0] } }
    return $el
}
function New-Card { param([object[]]$Children, [string]$Margin = '0,0,0,12') $b = New-Object System.Windows.Controls.Border; $b.Style = $Win.Resources['Card']; $b.Margin = $Margin; $sp = New-Object System.Windows.Controls.StackPanel; foreach ($c in $Children) { if ($null -ne $c) { [void]$sp.Children.Add($c) } }; $b.Child = $sp; return $b }
function New-Label { param([string]$Text) return (New-El TextBlock @{ Text = $Text; Style = 'Eyebrow'; Margin = '0,6,0,2' }) }
function New-Text { param([string]$Text, [double]$Size = 13, [switch]$Bold, [switch]$Muted, [switch]$Wrap) $t = New-El TextBlock @{ Text = $Text; FontSize = $Size }; if ($Bold) { $t.FontWeight = 'SemiBold' }; if ($Muted) { $t.Foreground = Get-Brush 'Muted' }; if ($Wrap) { $t.TextWrapping = 'Wrap' }; return $t }
function Invoke-GuiSafely {
    <# Runs a UI handler. An error is shown in the status bar and logged instead of escaping into WPF, where an
       unhandled exception in a PowerShell event handler closes the whole window. #>
    param([string]$Label, [scriptblock]$Action)
    try { & $Action }
    catch {
        $ex = $_.Exception; while ($ex.InnerException) { $ex = $ex.InnerException }
        $where = ''; if ($_.InvocationInfo -and $_.InvocationInfo.ScriptName) { $where = " ($(Split-Path -Leaf $_.InvocationInfo.ScriptName):$($_.InvocationInfo.ScriptLineNumber))" }
        $msg = "${Label}: $($ex.Message)$where"
        try { Write-DELog -Level FAIL -Message $msg } catch { }
        $S.LastJobError = $msg
        try { Set-Status $msg } catch { }
    }
}
function New-Button { param([string]$Text, [scriptblock]$OnClick, [switch]$Primary, [string]$A11y) $label = $Text; $handler = $OnClick; $safe = { Invoke-GuiSafely -Label $label -Action $handler }.GetNewClosure(); $b = New-El Button @{ Content = $Text; Style = $(if ($Primary) { 'Primary' } else { 'Btn' }); Click = $safe }; [System.Windows.Automation.AutomationProperties]::SetName($b, $(if ($A11y) { $A11y } else { $Text })); return $b }
function New-Wrap { param([object[]]$Children) $w = New-Object System.Windows.Controls.WrapPanel; foreach ($c in $Children) { if ($null -ne $c) { [void]$w.Children.Add($c) } }; return $w }
function Add-DEGridColumns {
    <# Columns for a read-only DataGrid: w is pixels or 'N*' (a share of what is left of a 900 px budget, which fits
       the page at the window's default size). Widths are fixed pixels, not WPF star sizing: star columns are only
       shared out after the grid is on screen, so they cannot be checked in the off-screen smoke render. Text wraps;
       a narrower window scrolls sideways instead of hiding a column. #>
    param([Parameter(Mandatory = $true)]$Grid, [Parameter(Mandatory = $true)][object[]]$Columns, [double]$Budget = 900)
    $fixed = 0.0; $shares = 0.0
    foreach ($c in $Columns) { $w = "$($c.w)"; if ($w -match '^(\d*\.?\d*)\*$') { $shares += $(if ($Matches[1]) { [double]$Matches[1] } else { 1.0 }) } else { $fixed += [double]$w } }
    $unit = $(if ($shares -gt 0) { [math]::Max(0, $Budget - $fixed) / $shares } else { 0 })
    foreach ($c in $Columns) {
        $col = New-Object System.Windows.Controls.DataGridTextColumn; $col.Header = $c.h; $col.Binding = New-Object System.Windows.Data.Binding $c.b
        $w = "$($c.w)"
        $px = $(if ($w -match '^(\d*\.?\d*)\*$') { [math]::Max(90, [math]::Floor($unit * $(if ($Matches[1]) { [double]$Matches[1] } else { 1.0 }))) } else { [double]$w })
        $col.Width = New-Object System.Windows.Controls.DataGridLength($px)
        $st = New-Object System.Windows.Style ([System.Windows.Controls.TextBlock]); $st.Setters.Add((New-Object System.Windows.Setter ([System.Windows.Controls.TextBlock]::TextWrappingProperty), ([System.Windows.TextWrapping]::Wrap))); $col.ElementStyle = $st
        [void]$Grid.Columns.Add($col)
    }
    $Grid.HorizontalScrollBarVisibility = 'Auto'
}

# ============================================================== background jobs (async, progress, cancel)
function Start-DEJob {
    <#
    Runs engine work in a separate runspace: re-imports the modules, restores context, secrets (as
    SecureString, never plaintext), the client profile and mode, then runs $Work. Evidence comes back and
    is merged; state and exceptions are file-backed and shared. The UI tails the log for live progress.
    #>
    param([Parameter(Mandatory = $true)][string]$Label, [Parameter(Mandatory = $true)][scriptblock]$Work, [hashtable]$Params = @{}, [scriptblock]$OnDone)
    if ($S.Job) { Set-Status 'A job is already running.'; return }
    $de = Get-DEConsole
    $plan = $null; if ($S.Profile -and $S.Profile.plan) { $plan = @{ bundle = "$($S.Profile.plan.bundle)"; addOns = @($S.Profile.plan.addOns | Where-Object { $_ }); solutions = @($S.Profile.plan.solutions | Where-Object { $_ }) } }
    $core = Start-DEBackgroundJob -Work $Work -Params $Params -ProfileId $(if ($S.Profile) { $S.Profile.id } else { $null }) -Mode $S.Mode -Plan $plan
    $S.Job = @{ core = $core; handle = $core.handle; label = $Label; started = $core.started; onDone = $OnDone }
    $UI.Progress.Visibility = 'Visible'; $UI.Progress.IsIndeterminate = $true; $UI.BtnCancel.Visibility = 'Visible'
    Set-Status "Running: $Label"
    try { $S.LogPos = (Get-Item -LiteralPath $de.LogFile).Length } catch { $S.LogPos = 0 }
    if (-not $S.Timer) {
        $S.Timer = New-Object System.Windows.Threading.DispatcherTimer; $S.Timer.Interval = [TimeSpan]::FromMilliseconds(400)
        $S.Timer.Add_Tick({ Update-DEJob })
    }
    $S.Timer.Start()
}
function Update-DEJob {
    if (-not $S.Job) { $S.Timer.Stop(); return }
    $de = Get-DEConsole
    try {
        $fs = [IO.File]::Open($de.LogFile, 'Open', 'Read', 'ReadWrite'); $null = $fs.Seek($S.LogPos, 'Begin'); $sr = New-Object IO.StreamReader($fs); $new = $sr.ReadToEnd(); $S.LogPos = $fs.Position; $sr.Close()
        $last = @($new -split "`r?`n" | Where-Object { $_ }) | Select-Object -Last 1
        if ($last) { Set-Status "$($S.Job.label): $($last -replace '^\S+ \S+ ', '')" }
        if ($S.LogBox) { foreach ($l in @($new -split "`r?`n" | Where-Object { $_ })) { $S.LogBox.AppendText((Protect-DEText $l) + "`r`n") }; $S.LogBox.ScrollToEnd() }
    } catch { }
    if (-not $S.Job.handle.IsCompleted) { return }
    $job = $S.Job; $S.Job = $null; $S.Timer.Stop()
    $UI.Progress.Visibility = 'Hidden'; $UI.BtnCancel.Visibility = 'Collapsed'
    $done = Complete-DEBackgroundJob -Job $job.core
    $result = $done.result; $failure = $done.failure
    if ($failure) {
        $msg = "$($job.label) failed: $(Protect-DEText $failure)"
        Write-DELog -Level FAIL -Message $msg
        $S.LastJobError = $msg
        Set-Status $msg
        Update-Header
        return
    }
    $S.LastJobError = $null
    $errs = @($done.warnings)
    if ($errs.Count) { Write-DELog -Level WARN -Message "$($job.label): $($errs.Count) non-fatal error(s); first: $($errs[0])" }
    Set-Status $(if ($errs.Count) { "$($job.label) finished with $($errs.Count) warning(s): $($errs[0])" } else { "$($job.label) finished in $([int]((Get-Date) - $job.started).TotalSeconds) s" })
    Update-Header
    if ($job.onDone) {
        try { & $job.onDone $result }
        catch { $m = "$($job.label): the page could not refresh: $(Protect-DEText $_.Exception.Message)"; Write-DELog -Level FAIL -Message $m; $S.LastJobError = $m; Set-Status $m }
    } else { Show-Page $S.CurrentPage }
}
$UI.BtnCancel.Add_Click({ if ($S.Job) { try { $null = $S.Job.core.ps.BeginStop($null, $null) } catch { }; Set-Status 'Cancel requested; the current step finishes or stops at its next checkpoint.' } })

# ============================================================== header + context
function Update-Header {
    $ctx = Get-DEContext
    $UI.HdrTech.Text = $(if ($ctx['technician']) { $ctx['technician'] } else { $Settings.technician })
    $UI.HdrClient.Text = $(if ($S.Profile) { $S.Profile.name } else { 'Not selected' })
    $UI.HdrUser.Text = $(if ($ctx['endUser']) { "$($ctx['endUser'])" } else { 'Not identified' })
    $UI.HdrUserWhy.Text = $(if ($ctx['localUserName']) { "local: $($ctx['localUserName'])  JC: $($ctx['jumpcloudUser'])" } else { '' })
    $dev = $(if ($S.Snapshot) { $S.Snapshot.device } else { $null })
    $UI.HdrDevice.Text = $(if ($dev) { $dev.hostname } else { $env:COMPUTERNAME })
    $UI.HdrDeviceSub.Text = $(if ($dev) { "$($dev.manufacturer) $($dev.model) · $($dev.serial) · $($S.Snapshot.identity.joinType)" } else { 'discovery not run' })
    $r = Get-DEReadiness
    $UI.HdrReady.Text = $r.overall; $UI.HdrReady.Foreground = Get-StateBrush $r.overall
    $modeTitle = (Get-DEModes)[$S.Mode].title
    $lic = $(try { Get-DELicenseStatus } catch { $null })
    $UI.TxtModeBadge.Text = "mode: $modeTitle$(if ((Get-DEConsole).DryRun) { ' · DRY RUN' }) · $(if ($lic -and $lic.valid) { "licensed: $($lic.technician)" } elseif ($lic -and $lic.enforce -eq 'required') { 'UNLICENSED: changes are locked' } else { 'UNLICENSED' })"
}
function Invoke-Discovery {
    param([switch]$Quick)
    Start-DEJob -Label 'Discovery' -Params @{ quick = [bool]$Quick } -Work {
        $snap = Get-DEDiscoverySnapshot -SkipApps:$JobParams.quick -SkipUpdates:$JobParams.quick
        Set-DEStateValue -Path 'lastSnapshotAt' -Value (Get-Date).ToString('o')
        $snap
    } -OnDone {
        param($r)
        $S.Snapshot = $r['out']
        $match = Resolve-DEClientContext -Snapshot $S.Snapshot
        if (-not $S.Profile -and $match.best) { $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $match.best.id); $UI.HdrClientWhy.Text = "detected ($($match.confidence)): $($match.best.reasons -join '; ')" }
        if ($S.Profile) {
            $null = New-DEProvisioningContext -Snapshot $S.Snapshot -ClientId $S.Profile.id -Mode $S.Mode -Technician $Settings.technician
            $null = Initialize-DEWorkflow -ClientProfile $S.Profile -Mode $S.Mode
        }
        Update-Header; Show-Page $S.CurrentPage
    }
}

# ============================================================== action grid (shared by module pages)
function New-ActionGrid {
    <# A grid of this module's actions with state, gates, secrets; buttons act on the selected row. Destructive runs ask first. #>
    param([string[]]$Modules, [string]$Title)
    $latest = @{}; foreach ($e in Get-DEEvidence) { $latest[$e.step] = $e }
    $rows = New-Object System.Collections.ObjectModel.ObservableCollection[object]
    foreach ($a in Get-DEActions -Mode $S.Mode | Where-Object { $_ -and $Modules -contains $_.Module }) {
        $e = $latest[$a.Id]
        $g = Test-DEGatesSatisfied -Ids $a.Gates
        $rows.Add([pscustomobject]@{ Id = $a.Id; Title = $a.Title; State = $(if ($e) { $e.result } else { 'NOT RUN' }); Detail = $(if ($e) { $e.verification } else { $a.Description }); Gates = $(if ($a.Gates.Count) { $(if ($g.Ok) { 'open' } else { 'locked: ' + (($g.Failing | ForEach-Object { $_.Title }) -join ', ') }) } else { '' }); Secrets = ($a.RequiresSecrets -join ', '); Destructive = $(if ($a.Destructive) { 'yes' } else { '' }) })
    }
    $grid = New-El DataGrid @{ Height = 380; Name = "$Title actions" }
    Add-DEGridColumns -Grid $grid -Columns @(@{ h = 'Action'; b = 'Title'; w = '2*' }, @{ h = 'State'; b = 'State'; w = 84 }, @{ h = 'Detail'; b = 'Detail'; w = '2.4*' }, @{ h = 'Gates'; b = 'Gates'; w = '1.3*' }, @{ h = 'Secrets'; b = 'Secrets'; w = '1*' }, @{ h = 'Destructive'; b = 'Destructive'; w = 86 })
    $grid.ItemsSource = $rows
    $sel = { $grid.SelectedItem }.GetNewClosure()
    $runSel = {
        param([string]$how)
        $row = & $sel; if (-not $row) { Set-Status 'Select an action first.'; return }
        $a = Get-DEAction -Id $row.Id
        if ($how -eq 'Apply' -and $a.Destructive -and -not (Confirm-Gui "Run '$($a.Title)'?" "This action changes identity or removes software. Rollback: $(if ($a.Rollback) { 'available' } else { 'none' }). Continue?")) { return }
        Start-DEJob -Label "$how $($a.Title)" -Params @{ id = $row.Id; how = $how } -Work { if ($JobParams.how -eq 'Rollback') { Invoke-DERollback -Id $JobParams.id } else { Invoke-DEAction -Id $JobParams.id -Mode $JobParams.how } }
    }.GetNewClosure()
    $buttons = New-Wrap @(
        (New-Button 'Audit selected' { & $runSel 'Audit' }.GetNewClosure() -A11y 'Audit the selected action')
        (New-Button 'Run selected' { & $runSel 'Apply' }.GetNewClosure() -Primary -A11y 'Run the selected action')
        (New-Button 'Audit all here' { $ids = @($rows | ForEach-Object { $_.Id }); Start-DEJob -Label "Audit $Title" -Params @{ ids = $ids } -Work { foreach ($i in $JobParams.ids) { $null = Invoke-DEAction -Id $i -Mode Audit } } }.GetNewClosure())
        (New-Button 'Rollback selected' { & $runSel 'Rollback' }.GetNewClosure())
        (New-Button 'Skip with reason' { $row = & $sel; if (-not $row) { return }; $why = Read-GuiText 'Skip reason' "Why is '$($row.Title)' being skipped?"; if ($why) { $null = Invoke-DEAction -Id $row.Id -SkipReason $why; Show-Page $S.CurrentPage } }.GetNewClosure())
        (New-Button 'Record exception' { $row = & $sel; if (-not $row) { return }; Show-ExceptionDialog -Target $row.Id }.GetNewClosure())
        $(if (@($rows | Where-Object { $_.Id -like 'plan.*' }).Count) { New-Button 'Confirm done' { $row = & $sel; if (-not $row -or $row.Id -notlike 'plan.*') { Set-Status 'Select a plan step (portal, people or handoff work) first.'; return }; Confirm-GuiPlanStep -Id $row.Id -Title $row.Title }.GetNewClosure() -A11y 'Confirm the selected plan step is done' })
    )
    return (New-Card @((New-Text $Title 15 -Bold), (New-Text 'Detect, compare, apply, verify, retry, remediate. Locked rows unlock when their gates pass; exceptions show as EXCEPTION, never PASS.' -Muted -Wrap), $buttons, $grid))
}
function Confirm-Gui { param([string]$Title, [string]$Message) return ([System.Windows.MessageBox]::Show($Win, $Message, $Title, 'YesNo', 'Warning', 'No') -eq 'Yes') }
function Confirm-GuiPlanStep {
    <# A plan step is work done off the device (a portal, a person, a handoff): the technician confirms it, with an optional note. #>
    param([string]$Id, [string]$Title)
    if (-not (Confirm-Gui 'Confirm done' "Confirm that this is done?`r`n`r`n$Title`r`n`r`nDE Tech Tool records who and when.")) { return }
    $note = Read-GuiText 'Confirm done' 'Optional note (ticket number, who confirmed). Never a password or key.'
    try { Confirm-DEPlanStep -Key $Id -Note "$note"; $null = Invoke-DEAction -Id $Id -Mode Audit; Set-Status "Confirmed: $Title"; Show-Page $S.CurrentPage } catch { Set-Status $_.Exception.Message }
}
function Get-LauncherPath { foreach ($n in @('Start-DETechTool.cmd', 'Start-DETechConsole.cmd')) { $p = Join-Path (Split-Path -Parent $ConsoleRoot) $n; if (Test-Path -LiteralPath $p) { return $p } }; return (Join-Path (Split-Path -Parent $ConsoleRoot) 'Start-DETechTool.cmd') }
function Read-GuiText {
    param([string]$Title, [string]$Prompt, [switch]$Secret, [string]$Default = '')
    $dlg = New-Object System.Windows.Window; $dlg.Title = $Title; $dlg.Width = 460; $dlg.SizeToContent = 'Height'; $dlg.WindowStartupLocation = 'CenterOwner'; $dlg.Owner = $Win; $dlg.Background = $Win.Background; $dlg.Foreground = $Win.Foreground; $dlg.FontFamily = $Win.FontFamily
    $sp = New-El StackPanel @{ Margin = '18' }
    [void]$sp.Children.Add((New-Text $Prompt -Wrap))
    $box = $(if ($Secret) { New-El PasswordBox @{ Name = $Prompt } } else { New-El TextBox @{ Name = $Prompt; Text = $Default } }); [void]$sp.Children.Add($box)
    $ok = New-Button 'OK' { $dlg.DialogResult = $true }.GetNewClosure() -Primary; $cancel = New-Button 'Cancel' { $dlg.DialogResult = $false }.GetNewClosure()
    [void]$sp.Children.Add((New-Wrap @($ok, $cancel))); $dlg.Content = $sp; $box.Focus() | Out-Null
    if ($dlg.ShowDialog()) { if ($Secret) { return $box.SecurePassword } else { return $box.Text } }
    return $null
}
function Show-ExceptionDialog {
    param([string]$Target)
    $reason = Read-GuiText 'Exception' "Reason for an exception on '$Target':"; if (-not $reason) { return }
    $approver = Read-GuiText 'Exception' 'Approver (name):'; if (-not $approver) { return }
    $days = Read-GuiText 'Exception' 'Review in how many days? (1-365)'; if (-not ($days -match '^\d+$')) { return }
    $fix = Read-GuiText 'Exception' 'Planned remediation:'
    try { $null = Add-DEException -Target $Target -Reason $reason -Approver $approver -ExpiresOn (Get-Date).AddDays([int]$days) -Remediation $fix; Reset-DEGateCache; Show-Page $S.CurrentPage } catch { Set-Status $_.Exception.Message }
}

# ============================================================== scan & fix (the main page)
# Launch scans every category without changing anything; the technician ticks what to act on and the buttons below
# the list act on the ticked items, in job order. The detail panel explains the focused item and takes its inputs.
$S.Selected = @{}; $S.Focus = $null; $S.ScanDone = $false; $S.ModeChosen = $false; $S.Lifecycle = $null; $S.RecommendedReason = ''
$DoneStates = @('PASS', 'NO CHANGE', 'EXCEPTION', 'SKIPPED', 'READY')

function Start-DEScan {
    <# Full discovery, client and mode detection, then a read-only check of every category. Changes nothing. #>
    Start-DEJob -Label 'Scanning the device (changes nothing)' -Work {
        $snap = Get-DEDiscoverySnapshot -SkipUpdates
        Set-DEStateValue -Path 'lastSnapshotAt' -Value (Get-Date).ToString('o')
        $snap
    } -OnDone {
        param($r)
        $S.Snapshot = $r['out']
        $S.Lifecycle = Get-DEDeviceLifecycle -Snapshot $S.Snapshot
        if (-not $S.Profile) { $match = Resolve-DEClientContext -Snapshot $S.Snapshot; if ($match.best) { $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $match.best.id); $UI.HdrClientWhy.Text = "detected ($($match.confidence)): $($match.best.reasons -join '; ')" } }
        if (-not $S.Profile) { Update-Header; Show-Page 'Scan'; Set-Status 'Scan finished. Pick the client so every category is checked against its plan.'; return }
        if (-not $S.ModeChosen) { $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile; $S.Mode = $rec.mode; $S.RecommendedReason = $rec.reason }
        $null = New-DEProvisioningContext -Snapshot $S.Snapshot -ClientId $S.Profile.id -Mode $S.Mode -Technician $Settings.technician
        $null = Initialize-DEWorkflow -ClientProfile $S.Profile -Mode $S.Mode
        Start-DEAuditAll
    }
}
function Start-DEAuditAll {
    <# Re-checks every step of the loaded plan (read-only) and refreshes the list. #>
    if (-not $S.Profile) { Set-Status 'Pick the client first.'; return }
    Start-DEJob -Label "Checking every category ($($S.Mode), changes nothing)" -Work { $null = Invoke-DEAudit -Mode $JobMode } -OnDone { param($r) $S.ScanDone = $true; Select-DEScanDefaults; Show-Page 'Scan' }
}
function Select-DEScanDefaults {
    <# Pre-ticks what can be fixed now: not in the desired state, has an automatic fix, not destructive (those stay an explicit choice). #>
    $S.Selected = @{}
    $rb = Get-DERunbook -Mode $S.Mode
    foreach ($st in @($rb.stages)) { foreach ($x in @($st.steps)) { if (-not $x.done -and $x.state -ne 'NOT RUN' -and $x.runnable -and -not $x.destructive) { $S.Selected[$x.id] = $true } } }
    if (-not $S.Focus -and $rb.current) { $S.Focus = $rb.current.id }
}
function Get-DESelectedInOrder { $rb = Get-DERunbook -Mode $S.Mode; return @($rb.stages | ForEach-Object { $_.steps } | Where-Object { $S.Selected[$_.id] }) }
function Invoke-DEScanBatch {
    <# Runs the ticked items in job order as one background job. Stops before the next item when a restart is queued. #>
    param([ValidateSet('Apply', 'Audit', 'Rollback')][string]$How)
    $items = @(Get-DESelectedInOrder)
    if (-not $items.Count) { Set-Status 'Tick at least one item first.'; return }
    $live = -not (Get-DEConsole).DryRun
    if ($How -eq 'Apply') {
        $destr = @($items | Where-Object { $_.destructive } | ForEach-Object { " - $($_.title)" })
        $msg = "{0} {1} item(s), in this order:`n`n{2}{3}" -f $(if ($live) { 'LIVE: change' } else { 'PLAN ONLY: plan (nothing changes)' }), $items.Count, ((@($items | Select-Object -First 25 | ForEach-Object { " - $($_.title)" })) -join "`n"), $(if ($destr.Count -and $live) { "`n`nThese change identity or remove software:`n$($destr -join "`n")" } else { '' })
        if (-not (Confirm-Gui $(if ($live) { 'Make these changes?' } else { 'Plan these changes?' }) $msg)) { return }
    }
    if ($How -eq 'Rollback' -and -not (Confirm-Gui 'Undo?' ("Undo {0} item(s)? Each rollback reports whether it proved the undo." -f $items.Count))) { return }
    $ids = @($items | ForEach-Object { $_.id })
    Start-DEJob -Label $(switch ($How) { 'Apply' { if ($live) { "Fixing $($ids.Count) item(s)" } else { "Planning $($ids.Count) item(s)" } } 'Audit' { "Checking $($ids.Count) item(s)" } default { "Undoing $($ids.Count) item(s)" } }) -Params @{ ids = $ids; how = $How } -Work {
        $done = 0
        foreach ($i in $JobParams.ids) {
            if ($JobParams.how -eq 'Apply' -and @(Get-DERebootQueue).Count) { Write-DELog -Level WARN -Message "stopped before $i : a restart is queued; restart, then run the rest"; break }
            if ($JobParams.how -eq 'Rollback') { $null = Invoke-DERollback -Id $i } else { $null = Invoke-DEAction -Id $i -Mode $JobParams.how }
            $done++
        }
        "$done of $($JobParams.ids.Count) done"
    } -OnDone { param($r) Reset-DEGateCache; Show-Page 'Scan'; if (@(Get-DERebootQueue).Count) { Set-Status 'A restart is queued: restart the device (the tool reopens where it stopped), then continue.' } }
}
function New-StateText { param([string]$State, [double]$Width = 104) $t = New-El TextBlock @{ Text = $(if ($State -eq 'NOT RUN') { 'NOT CHECKED' } else { $State }); Width = $Width; FontWeight = 'SemiBold'; VerticalAlignment = 'Top'; Margin = '0,1,8,0' }; $t.Foreground = Get-StateBrush $State; return $t }
function New-ModeSwitch {
    <# One big switch: PLAN ONLY (nothing changes) or LIVE (changes are made). Going live asks first. #>
    $live = -not (Get-DEConsole).DryRun
    $b = New-El Button @{ Style = $(if ($live) { 'Primary' } else { 'Btn' }); Padding = '14,9'; Content = $(if ($live) { 'LIVE: changes will be made   (switch to plan only)' } else { 'PLAN ONLY: nothing will change   (switch to live)' }) }
    [System.Windows.Automation.AutomationProperties]::SetName($b, $(if ($live) { 'Live mode is on; switch to plan only' } else { 'Plan only is on; switch to live' }))
    if (-not $live) { $b.BorderBrush = Get-Brush 'Lavender'; $b.BorderThickness = 2 }
    $b.Add_Click({ Invoke-GuiSafely -Label 'mode switch' -Action {
                $isLive = -not (Get-DEConsole).DryRun
                if (-not $isLive -and -not (Confirm-Gui 'Go live?' 'Fix selected will now change this device. Destructive steps still ask first. Continue?')) { return }
                $Settings.dryRun = $isLive; Save-GuiSettings; Set-DEMode -Mode $(if ($isLive) { 'Audit' } else { 'Apply' }) -DryRun:$isLive
                Show-Page 'Scan'; Set-Status $(if ($isLive) { 'Plan only: nothing will change.' } else { 'LIVE: Fix selected changes this device.' })
            } })
    return $b
}
function Update-ScanDetail {
    <# The right-hand panel for the focused item: what it is, why it matters, what the scan found, what it waits on, and its inputs. #>
    if (-not $S.DetailHost) { return }
    $rb = Get-DERunbook -Mode $S.Mode
    $x = @($rb.stages | ForEach-Object { $_.steps } | Where-Object { $_.id -eq $S.Focus }) | Select-Object -First 1
    $sp = New-El StackPanel
    if (-not $x) { [void]$sp.Children.Add((New-Text 'Click an item to see what it does, why, and what it is waiting on.' -Muted -Wrap)); $S.DetailHost.Content = $sp; return }
    $stage = @($rb.stages | Where-Object { $_.id -eq $x.stage }) | Select-Object -First 1
    [void]$sp.Children.Add((New-Label "Stage $($stage.number): $($stage.title)"))
    [void]$sp.Children.Add((New-Text $x.title 16 -Bold -Wrap))
    $row = New-El WrapPanel @{ Margin = '0,4,0,8' }; [void]$row.Children.Add((New-StateText $x.state 130)); if ($x.destructive) { [void]$row.Children.Add((New-El TextBlock @{ Text = 'changes identity or removes software'; Style = 'Mono' })) }; [void]$sp.Children.Add($row)
    if ($x.why) { [void]$sp.Children.Add((New-Label 'Why it matters')); [void]$sp.Children.Add((New-Text $x.why -Wrap)) }
    if ($x.detail) { [void]$sp.Children.Add((New-Label 'What the scan found')); [void]$sp.Children.Add((New-Text $x.detail -Wrap -Muted)) }
    if (@($x.blockers).Count) {
        [void]$sp.Children.Add((New-Label 'Waiting on'))
        foreach ($g in @($x.blockers)) { $t = New-Text ("{0} ({1}): {2}" -f $g.title, $g.status, $g.detail) -Wrap; $t.Foreground = Get-StateBrush $g.status; [void]$sp.Children.Add($t); if ($g.unblock) { [void]$sp.Children.Add((New-Text "How: $($g.unblock)" -Wrap -Muted)) } }
    }
    if ($x.manual -and -not $x.done) { [void]$sp.Children.Add((New-Label 'By hand')); [void]$sp.Children.Add((New-Text $x.manual -Wrap)) }
    # inputs the step needs, right here
    foreach ($n in @($x.secretsMissing)) {
        $pb = New-El PasswordBox @{ Width = 260; Name = $n }; $name = $n
        [void]$sp.Children.Add((New-Label "Needs $n (kept in memory for this session only)"))
        [void]$sp.Children.Add((New-Wrap @($pb, (New-Button 'Set' { if ($pb.SecurePassword.Length -gt 0) { Set-DESecret -Name $name -SecureValue $pb.SecurePassword.Copy(); $pb.Clear(); Reset-DEGateCache; Update-ScanDetail; Set-Status "$name set for this session." } }.GetNewClosure()))))
    }
    if ($x.inputs -contains 'mapping') {
        $ctx = Get-DEContext
        $tbS = New-El TextBox @{ Text = "$($ctx['sourcePrincipal'])"; Width = 240; Name = 'Source principal' }; $tbL = New-El TextBox @{ Text = "$($ctx['localUserName'])"; Width = 160; Name = 'Local user' }; $tbJ = New-El TextBox @{ Text = "$($ctx['jumpcloudUser'])"; Width = 160; Name = 'JumpCloud user' }
        [void]$sp.Children.Add((New-Label 'User mapping (source Windows account, new local account, JumpCloud username)'))
        [void]$sp.Children.Add((New-Wrap @($tbS, $tbL, $tbJ, (New-Button 'Save mapping' { Set-DEContext -Values @{ sourcePrincipal = $tbS.Text; localUserName = $tbL.Text; jumpcloudUser = $(if ($tbJ.Text) { $tbJ.Text } else { $tbL.Text }) }; Reset-DEGateCache; Update-Header; Show-Page 'Scan'; Set-Status 'Mapping saved.' }.GetNewClosure() -Primary))))
        if ($x.needsMapping) { [void]$sp.Children.Add((New-Text 'The local name must match the JumpCloud username exactly (20 characters at most).' -Muted -Wrap)) }
    }
    if ($x.inputs -contains 'bitlocker-escrow') {
        $ids = @(Get-DEHashPath -Object $S.Snapshot -Path 'bitlocker.os.recoveryProtectorIds' | Where-Object { $_ })
        $cbId = New-El ComboBox @{ Width = 330; Name = 'Recovery protector id' }; foreach ($i in $ids) { [void]$cbId.Items.Add("$i") }; if ($ids.Count) { $cbId.SelectedIndex = 0 }
        $cbLoc = New-El ComboBox @{ Width = 120; Name = 'Escrowed in' }; foreach ($l in @('jumpcloud', 'hudu', 'itglue', 'vault', 'entra', 'other')) { [void]$cbLoc.Items.Add($l) }; $cbLoc.SelectedIndex = 0
        [void]$sp.Children.Add((New-Label 'BitLocker: the protector id on this disk, and where its key is escrowed (never the password)'))
        [void]$sp.Children.Add((New-Wrap @($cbId, $cbLoc, (New-Button 'Record' { if ($cbId.SelectedItem) { Set-DEBitLockerExpectedProtector -ProtectorId "$($cbId.SelectedItem)" -Location "$($cbLoc.SelectedItem)" -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Scan' } }.GetNewClosure()), (New-Button 'Back up and prove now' { Start-DEJob -Label 'Back up the BitLocker recovery key' -Work { Invoke-DEAction -Id 'identity.bitlocker-backup' -Mode Apply } -OnDone { param($r) Reset-DEGateCache; Show-Page 'Scan' } }))))
    }
    if ($x.inputs -contains 'confirm:breakglass') { [void]$sp.Children.Add((New-Button 'I signed in as .\DE-BreakGlass: verify it' { if (-not (Test-DESecret -Name 'BREAKGLASS_PASSWORD')) { Set-Status 'Set BREAKGLASS_PASSWORD first.'; return }; $null = Confirm-DEBreakGlassVerified -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Scan' })) }
    if ($x.inputs -contains 'confirm:onedrive') { [void]$sp.Children.Add((New-Button "OneDrive shows 'Up to date' and sync is paused" { Confirm-DEOneDriveSynced; Reset-DEGateCache; Show-Page 'Scan' })) }
    if ($x.inputs -contains 'warranty-manual') {
        $serial = "$(Get-DEHashPath -Object $S.Snapshot -Path 'device.serial')"; $url = "$(Get-DEHashPath -Object (Get-DEState -Path 'warranty.current') -Path 'checkUrl')"
        $dp = New-El DatePicker @{ Width = 150; Name = 'Warranty end date' }; $note = New-El TextBox @{ Width = 220; Name = 'Where the date came from' }
        [void]$sp.Children.Add((New-Label "Warranty end for serial $serial (from the manufacturer's page)"))
        [void]$sp.Children.Add((New-Wrap @($dp, $note, (New-Button 'Record' { if (-not $dp.SelectedDate) { Set-Status 'Pick the end date.'; return }; Set-DEWarrantyManual -Serial $serial -End $dp.SelectedDate -Note $note.Text -Technician $Settings.technician; $S.Selected = @{ 'maint.warranty' = $true }; Invoke-DEScanBatch -How Audit }.GetNewClosure() -Primary), $(if ($url) { New-Button 'Open check page' { Start-Process $url }.GetNewClosure() }))))
    }
    if ($x.inputs -contains 'accept-profiles') { [void]$sp.Children.Add((New-Button 'Accept leftover profiles...' { $left = @(Get-DEUnmigratedDomainProfiles); if (-not $left.Count) { Set-Status 'No unmigrated Entra or domain profiles.'; return }; if (Confirm-Gui 'Leave these behind?' ("Nobody can sign in to these after the device leaves Microsoft:`n`n{0}`n`nOnly accept profiles nobody needs." -f (($left | ForEach-Object { $_.path }) -join "`n"))) { Confirm-DEStrandedProfilesAccepted -Paths @($left | ForEach-Object { $_.path }) -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Scan' } })) }
    # this item alone
    $id = $x.id
    [void]$sp.Children.Add((New-Label 'This item'))
    [void]$sp.Children.Add((New-Wrap @(
                (New-Button $(if ((Get-DEConsole).DryRun) { 'Plan this' } else { 'Fix this' }) { $S.Selected = @{ $id = $true }; Invoke-DEScanBatch -How Apply }.GetNewClosure() -Primary),
                (New-Button 'Check this' { $S.Selected = @{ $id = $true }; Invoke-DEScanBatch -How Audit }.GetNewClosure()),
                (New-Button 'Skip...' { $why = Read-GuiText 'Skip' "Why is '$($x.title)' skipped?"; if ($why) { $null = Invoke-DEAction -Id $id -SkipReason $why; Show-Page 'Scan' } }.GetNewClosure()),
                (New-Button 'Exception...' { Show-ExceptionDialog -Target $id }.GetNewClosure()),
                $(if ((Get-DEAction -Id $id).Rollback) { New-Button 'Undo' { $S.Selected = @{ $id = $true }; Invoke-DEScanBatch -How Rollback }.GetNewClosure() })
            )))
    $S.DetailHost.Content = $sp
}
function Build-Scan {
    <# Returns the whole page (it lays out its own scrolling: list and detail scroll separately, the button bar stays put). #>
    $page = New-Object System.Windows.Controls.Grid
    foreach ($h in @('Auto', '*', 'Auto')) { $rd = New-Object System.Windows.Controls.RowDefinition; $rd.Height = $(if ($h -eq '*') { New-Object System.Windows.GridLength(1, 'Star') } else { [System.Windows.GridLength]::Auto }); $page.RowDefinitions.Add($rd) }
    # --- top: device state, client, plan, mode, plan-only/live
    $profiles = @(Get-DEClientProfiles)
    $cbClient = New-El ComboBox @{ Name = 'Client'; Width = 250 }; foreach ($p in $profiles) { [void]$cbClient.Items.Add("$($p.name)") }; if ($S.Profile) { $cbClient.SelectedIndex = [array]::IndexOf(@($profiles | ForEach-Object { $_.id }), $S.Profile.id) }
    $plans = @([pscustomobject]@{ label = 'Client profile default'; bundle = ''; solution = '' }); foreach ($b in @(Get-DEBundles)) { $plans += [pscustomobject]@{ label = $b['name']; bundle = $b['id']; solution = '' } }; foreach ($so in @(Get-DESolutions)) { $plans += [pscustomobject]@{ label = "Standalone: $($so['name'])"; bundle = ''; solution = $so['id'] } }
    $cbPlan = New-El ComboBox @{ Name = 'Plan'; Width = 250 }; foreach ($pl in $plans) { [void]$cbPlan.Items.Add($pl.label) }; $cbPlan.SelectedIndex = 0
    if ($S.Profile -and $S.Profile.plan) { for ($i = 0; $i -lt $plans.Count; $i++) { if (($plans[$i].bundle -and $plans[$i].bundle -eq "$($S.Profile.plan.bundle)") -or ($plans[$i].solution -and -not $S.Profile.plan.bundle -and @($S.Profile.plan.solutions) -contains $plans[$i].solution)) { $cbPlan.SelectedIndex = $i; break } } }
    $modes = Get-DEModes; $cbMode = New-El ComboBox @{ Name = 'Mode'; Width = 200 }; foreach ($k in $modes.Keys) { [void]$cbMode.Items.Add($modes[$k].title) }; $cbMode.SelectedIndex = [array]::IndexOf(@($modes.Keys), $S.Mode)
    $load = New-Button 'Load and check' {
        if ($cbClient.SelectedIndex -lt 0) { Set-Status 'Pick the client.'; return }
        $pl = $plans[[Math]::Max(0, $cbPlan.SelectedIndex)]; $S.ModeChosen = $true
        Use-ClientAndMode -ProfileId $profiles[$cbClient.SelectedIndex].id -Mode @((Get-DEModes).Keys)[[Math]::Max(0, $cbMode.SelectedIndex)] -Technician $Settings.technician -Bundle $pl.bundle -Solution @($pl.solution | Where-Object { $_ })
        if ($S.Snapshot) { Start-DEAuditAll } else { Start-DEScan }
    }.GetNewClosure() -Primary
    $life = $S.Lifecycle
    $lifeText = $(if ($life) { "Device: $($life.title). $($life.reasons -join '; ')" } else { 'Device: not scanned yet' })
    $top = New-Card @(
        (New-Wrap @((New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Client'), $cbClient)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Plan'), $cbPlan)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Mode'), $cbMode)), (New-El StackPanel @{ Margin = '0,18,14,0' } @($load)), (New-El StackPanel @{ Margin = '0,18,0,0' } @((New-ModeSwitch))))),
        (New-Text $lifeText -Wrap),
        $(if ($S.RecommendedReason) { New-Text "Mode $($modes[$S.Mode].title) recommended: $($S.RecommendedReason)" -Muted -Wrap }),
        $(if ($life -and $life.stage -eq 'oobe') { New-Wrap @((New-Text 'At OOBE: machine-wide items can run now; items that need the user wait for the first sign-in.' -Muted -Wrap), (New-Button 'Continue after first sign-in' { Set-DEResume -Launcher (Get-LauncherPath) -NextAction $null -LoginAs ''; Set-Status 'The tool reopens after the next sign-in and continues.' })) })
    ) -Margin '0,0,0,10'
    [System.Windows.Controls.Grid]::SetRow($top, 0); [void]$page.Children.Add($top)
    # --- middle: the list (left) and the focused item (right)
    $mid = New-Object System.Windows.Controls.Grid
    $c1 = New-Object System.Windows.Controls.ColumnDefinition; $c1.Width = New-Object System.Windows.GridLength(1, 'Star'); $c2 = New-Object System.Windows.Controls.ColumnDefinition; $c2.Width = New-Object System.Windows.GridLength(0.8, 'Star'); $c2.MaxWidth = 460; $c2.MinWidth = 280; $mid.ColumnDefinitions.Add($c1); $mid.ColumnDefinitions.Add($c2)
    $list = New-El StackPanel
    $S.RowBorders = @{}; $S.RowChecks = @{}
    if (-not $S.Profile) {
        [void]$list.Children.Add((New-Card @((New-Text 'Pick the client above and press Load and check.' 15 -Bold), (New-Text 'The device scan runs on its own when the tool opens; every category is then checked against the client''s plan. Nothing changes until you tick items, go LIVE and press Fix selected.' -Muted -Wrap))))
    } else {
        $rb = Get-DERunbook -Mode $S.Mode
        $attention = @($rb.stages | ForEach-Object { $_.steps } | Where-Object { -not $_.done -and $_.state -ne 'NOT RUN' }).Count
        [void]$list.Children.Add((New-Text ("{0} of {1} in the desired state; {2} need attention; {3} not checked yet.{4}" -f $rb.done, $rb.total, $attention, $rb.notRun, $(if (-not $S.ScanDone -and $rb.notRun) { ' Press Scan again to check everything.' } else { '' })) -Wrap))
        foreach ($st in @($rb.stages)) {
            $stageIds = @($st.steps | ForEach-Object { $_.id })
            $hdrCb = New-El CheckBox @{ VerticalAlignment = 'Center'; Margin = '0,0,8,0' }; [System.Windows.Automation.AutomationProperties]::SetName($hdrCb, "Tick every item in stage $($st.number)")
            $hdrCb.IsChecked = (@($stageIds | Where-Object { $S.Selected[$_] }).Count -eq $stageIds.Count)
            $hdrCb.Add_Click({ param($src, $e) foreach ($i in $stageIds) { if ($src.IsChecked) { $S.Selected[$i] = $true } else { $S.Selected.Remove($i) }; if ($S.RowChecks[$i]) { $S.RowChecks[$i].IsChecked = [bool]$src.IsChecked } }; if ($S.SelCount) { $S.SelCount.Text = "$(@($S.Selected.Keys).Count) ticked" } }.GetNewClosure())
            $hdrText = New-Text ("{0}. {1}   {2}/{3}" -f $st.number, $st.title, $st.done, $st.total) 15 -Bold; $hdrText.Foreground = $(if ($st.state -eq 'done') { Get-Brush 'Pass' } elseif ($st.state -eq 'current') { Get-Brush 'Paper' } else { Get-Brush 'Muted' })
            $items = New-El StackPanel @{ Margin = '26,4,0,0' }
            foreach ($x in @($st.steps)) {
                $sid = $x.id
                $cb = New-El CheckBox @{ VerticalAlignment = 'Top'; Margin = '0,2,8,0'; IsChecked = [bool]$S.Selected[$sid] }; [System.Windows.Automation.AutomationProperties]::SetName($cb, "Tick $($x.title)")
                $cb.Add_Click({ param($src, $e) if ($src.IsChecked) { $S.Selected[$sid] = $true } else { $S.Selected.Remove($sid) }; if ($S.SelCount) { $S.SelCount.Text = "$(@($S.Selected.Keys).Count) ticked" } }.GetNewClosure())
                $txt = New-El StackPanel
                [void]$txt.Children.Add((New-Text $x.title -Bold -Wrap))
                $sub = @(); if ($x.detail -and -not $x.done) { $sub += $x.detail }; if (@($x.blockers).Count) { $sub += 'waiting on: ' + ((@($x.blockers) | ForEach-Object { $_.title }) -join ', ') }; if (@($x.secretsMissing).Count) { $sub += 'needs ' + ($x.secretsMissing -join ', ') }; if ($x.needsMapping) { $sub += 'needs the user mapping' }
                if ($sub.Count) { $d = New-Text ($sub -join ' · ') -Muted; $d.TextTrimming = 'CharacterEllipsis'; [void]$txt.Children.Add($d) }
                $rowGrid = New-El DockPanel; [void]$rowGrid.Children.Add($cb); [System.Windows.Controls.DockPanel]::SetDock($cb, 'Left'); $stt = New-StateText $x.state; [void]$rowGrid.Children.Add($stt); [System.Windows.Controls.DockPanel]::SetDock($stt, 'Left'); [void]$rowGrid.Children.Add($txt)
                $rowB = New-Object System.Windows.Controls.Border; $rowB.Padding = '8,6'; $rowB.CornerRadius = New-Object System.Windows.CornerRadius(8); $rowB.Cursor = [System.Windows.Input.Cursors]::Hand; $rowB.Child = $rowGrid; $rowB.BorderThickness = 1; $rowB.BorderBrush = [System.Windows.Media.Brushes]::Transparent; $rowB.Background = [System.Windows.Media.Brushes]::Transparent
                if ($S.Focus -eq $sid) { $rowB.Background = Get-Brush 'RaisedHover'; $rowB.BorderBrush = Get-Brush 'Lavender' }
                $S.RowBorders[$sid] = $rowB; $S.RowChecks[$sid] = $cb
                # focusing a row only swaps the highlight and the detail panel: the list keeps its scroll position
                $rowB.Add_MouseLeftButtonUp({ $old = $S.RowBorders[$S.Focus]; if ($old) { $old.Background = [System.Windows.Media.Brushes]::Transparent; $old.BorderBrush = [System.Windows.Media.Brushes]::Transparent }; $S.Focus = $sid; $me = $S.RowBorders[$sid]; if ($me) { $me.Background = Get-Brush 'RaisedHover'; $me.BorderBrush = Get-Brush 'Lavender' }; Update-ScanDetail }.GetNewClosure())
                [void]$items.Children.Add($rowB)
            }
            $stageCard = New-Card @((New-El DockPanel @{} @($hdrCb, $hdrText)), (New-Text $st.purpose -Muted -Wrap), $items) -Margin '0,8,10,0'
            [void]$list.Children.Add($stageCard)
        }
    }
    $lsv = New-Object System.Windows.Controls.ScrollViewer; $lsv.VerticalScrollBarVisibility = 'Auto'; $lsv.Content = $list; [System.Windows.Controls.Grid]::SetColumn($lsv, 0); [void]$mid.Children.Add($lsv)
    $S.DetailHost = New-El ContentControl
    $dcard = New-Object System.Windows.Controls.Border; $dcard.Style = $Win.Resources['Card']; $dcard.Margin = '0,8,0,0'; $dsv = New-Object System.Windows.Controls.ScrollViewer; $dsv.VerticalScrollBarVisibility = 'Auto'; $dsv.Content = $S.DetailHost; $dcard.Child = $dsv
    [System.Windows.Controls.Grid]::SetColumn($dcard, 1); [void]$mid.Children.Add($dcard)
    [System.Windows.Controls.Grid]::SetRow($mid, 1); [void]$page.Children.Add($mid)
    Update-ScanDetail
    # --- bottom: what to do with the ticked items
    $S.SelCount = New-El TextBlock @{ Text = "$(@($S.Selected.Keys).Count) ticked"; VerticalAlignment = 'Center'; Margin = '0,0,14,8'; FontWeight = 'SemiBold' }
    $live = -not (Get-DEConsole).DryRun
    $bar = New-Wrap @(
        $S.SelCount,
        (New-Button $(if ($live) { 'Fix selected' } else { 'Plan selected' }) { Invoke-DEScanBatch -How Apply } -Primary -A11y 'Act on the ticked items in job order'),
        (New-Button 'Check selected' { Invoke-DEScanBatch -How Audit }),
        (New-Button 'Skip selected...' { $items = @(Get-DESelectedInOrder); if (-not $items.Count) { return }; $why = Read-GuiText 'Skip' "Why are these $($items.Count) item(s) skipped?"; if ($why) { foreach ($it in $items) { $null = Invoke-DEAction -Id $it.id -SkipReason $why }; Show-Page 'Scan' } }),
        (New-Button 'Undo selected' { Invoke-DEScanBatch -How Rollback }),
        (New-Button 'Tick: needs attention' { Select-DEScanDefaults; Show-Page 'Scan' }),
        (New-Button 'Untick all' { $S.Selected = @{}; Show-Page 'Scan' }),
        (New-Button 'Scan again' { if ($S.Profile) { Start-DEScan } else { Start-DEScan } }),
        (New-Button 'Export evidence' { Show-Page 'Evidence' })
    )
    $barB = New-Object System.Windows.Controls.Border; $barB.Style = $Win.Resources['Card']; $barB.Margin = '0,10,0,0'; $barB.Padding = '12,10,12,2'; $barB.Child = $bar
    [System.Windows.Controls.Grid]::SetRow($barB, 2); [void]$page.Children.Add($barB)
    return $page
}

# ============================================================== pages
$Pages = [ordered]@{
    Scan = 'Scan & fix'; Dashboard = 'Session & readiness'; Discovery = 'Discovery'; Identity = 'Identity & migration'; Migration = 'Email migration'; Security = 'Security'; Apps = 'Applications'
    Browser = 'Browser configurator'; Baseline = 'OS baseline'; Branding = 'Branding'; Network = 'Network & site'; Toolbox = 'Toolbox (fix-it scripts)'; CommandLine = 'Command line'; Vendors = 'Vendor Admin Center'; AiToolkit = 'AI Toolkit'; Evidence = 'Evidence & Hub'; Settings = 'Settings & secrets'
}
$NavButtons = @{}
foreach ($k in $Pages.Keys) {
    if ($k -eq 'Dashboard') { [void]$UI.NavPanel.Children.Add((New-El TextBlock @{ Text = 'Advanced'; Style = 'Eyebrow'; Margin = '12,14,0,4' })) }
    $rb = New-Object System.Windows.Controls.RadioButton; $rb.Style = $Win.Resources['Nav']; $rb.Content = $Pages[$k]; $rb.GroupName = 'nav'; $rb.Tag = $k
    [System.Windows.Automation.AutomationProperties]::SetName($rb, "Open $($Pages[$k])")
    $rb.Add_Checked({ param($src, $e) Show-Page $src.Tag })
    [void]$UI.NavPanel.Children.Add($rb); $NavButtons[$k] = $rb
}

function Show-Page {
    param([string]$Name)
    if ($Name -eq 'Workflow' -or -not $Pages.Contains($Name)) { $Name = 'Scan' }   # the guided workflow became Scan & fix
    $S.CurrentPage = $Name; $Settings.lastPage = $Name; Save-GuiSettings
    if (-not $NavButtons[$Name].IsChecked) { $NavButtons[$Name].IsChecked = $true; return }
    $S.LogBox = $null
    if ($Name -eq 'Scan') { $UI.PageHost.Content = (Build-Scan); Update-Header; return }
    $S.DetailHost = $null
    $sv = New-Object System.Windows.Controls.ScrollViewer; $sv.VerticalScrollBarVisibility = 'Auto'
    $root = New-El StackPanel
    $needsProfile = $Name -notin @('Dashboard', 'Discovery', 'Toolbox', 'CommandLine', 'Migration', 'Vendors', 'AiToolkit', 'Settings')
    if ($needsProfile -and -not $S.Profile) { [void]$root.Children.Add((New-Card @((New-Text 'Choose a client profile first' 15 -Bold), (New-Text 'Open Dashboard, run discovery, and confirm or pick the client. Actions are built from the client profile.' -Muted -Wrap), (New-Button 'Go to Dashboard' { Show-Page 'Dashboard' } -Primary)))) }
    else {
        switch ($Name) {
            'Dashboard' { Build-Dashboard $root }
            'Workflow' { Build-Workflow $root }
            'Discovery' { Build-Discovery $root }
            'Identity' { Build-Identity $root }
            'Security' { [void]$root.Children.Add((New-ActionGrid -Modules @('security') -Title 'Security deployment')) ; Build-SecurityPosture $root }
            'Apps' { [void]$root.Children.Add((New-ActionGrid -Modules @('apps') -Title 'Applications')) ; Build-PackageCatalog $root }
            'Browser' { [void]$root.Children.Add((New-ActionGrid -Modules @('browser') -Title 'Browser configurator')) ; Build-BrowserPreview $root }
            'Baseline' { [void]$root.Children.Add((New-ActionGrid -Modules @('baseline') -Title 'DE Windows baseline')) }
            'Branding' { Build-Branding $root }
            'Network' { [void]$root.Children.Add((New-ActionGrid -Modules @('network', 'maintenance', 'operations') -Title 'Network, maintenance and operations')) ; Build-OpsConfirm $root }
            'Toolbox' { Build-Toolbox $root }
            'CommandLine' { Build-CommandLine $root }
            'Migration' { Build-Migration $root }
            'Vendors' { Build-Vendors $root }
            'AiToolkit' { Build-AiToolkit $root }
            'Evidence' { Build-Evidence $root }
            'Settings' { Build-Settings $root }
        }
    }
    $sv.Content = $root; $UI.PageHost.Content = $sv
    Update-Header
}

function Use-ClientAndMode {
    <# The Dashboard's "Use this client and mode": loads the profile, saves the choice, builds the action plan for
       the mode and, when discovery has run, the provisioning context. Shared with the smoke test. #>
    param([string]$ProfileId, [string]$Mode, [string]$Technician, [string]$Bundle, [string[]]$Solution = @())
    if (-not $ProfileId) { Set-Status 'Pick a client profile first.'; return }
    # the plan picker: a ProActive tier or variant, a standalone solution, or the client profile's own default
    $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $ProfileId) -Bundle $Bundle -Solution $Solution; $Settings.client = $S.Profile.id
    $Settings.planBundle = "$($S.Profile.plan.bundle)"; $Settings.planSolutions = @($S.Profile.plan.solutions | Where-Object { $_ })   # a restart or resume keeps the chosen plan
    if ($Mode) { $S.Mode = $Mode }; $Settings.mode = $S.Mode
    if ($S.Mode -ne 'dropship') { Set-DEStateValue -Path 'order' -Value $null }   # an order only applies to its dropship run
    if ($Technician) { $Settings.technician = $Technician }
    Save-GuiSettings
    $ids = @(Initialize-DEWorkflow -ClientProfile $S.Profile -Mode $S.Mode)
    if ($S.Snapshot) { $null = New-DEProvisioningContext -Snapshot $S.Snapshot -ClientId $S.Profile.id -Mode $S.Mode -Technician $Settings.technician }
    $planName = $(if ($S.Profile.plan.bundleName) { $S.Profile.plan.bundleName } elseif (@($S.Profile.plan.solutions).Count) { 'standalone ' + (@($S.Profile.plan.solutions) -join ', ') } else { 'client profile' })
    Set-Status ("Loaded {0}, {1} ({2}): {3} planned step(s)." -f $S.Profile.name, $planName, $S.Mode, $ids.Count)
    Show-Page $(if ($S.CurrentPage) { $S.CurrentPage } else { 'Scan' })
}

function Build-Dashboard {
    param($root)
    $profiles = @(Get-DEClientProfiles)
    $cbClient = New-El ComboBox @{ Name = 'Client profile'; Width = 280 }; foreach ($p in $profiles) { [void]$cbClient.Items.Add("$($p.id) · $($p.name) ($($p.source))") }
    if ($S.Profile) { $cbClient.SelectedIndex = [array]::IndexOf(@($profiles | ForEach-Object { $_.id }), $S.Profile.id) }
    $cbMode = New-El ComboBox @{ Name = 'Mode'; Width = 220 }; $modes = Get-DEModes; foreach ($k in $modes.Keys) { [void]$cbMode.Items.Add("$k · $($modes[$k].title)") }; $cbMode.SelectedIndex = [array]::IndexOf(@($modes.Keys), $S.Mode)
    $tbTech = New-El TextBox @{ Text = $Settings.technician; Width = 160; Name = 'Technician' }
    # plan picker: client default, the ProActive tiers and variants, then each standalone solution
    $plans = @([pscustomobject]@{ label = 'Client profile default'; bundle = ''; solution = '' })
    foreach ($b in @(Get-DEBundles)) { $plans += [pscustomobject]@{ label = $b['name']; bundle = $b['id']; solution = '' } }
    foreach ($so in @(Get-DESolutions)) { $plans += [pscustomobject]@{ label = "Standalone: $($so['name'])"; bundle = ''; solution = $so['id'] } }
    $cbPlan = New-El ComboBox @{ Name = 'Plan'; Width = 300 }; foreach ($pl in $plans) { [void]$cbPlan.Items.Add($pl.label) }
    $current = 0
    if ($S.Profile -and $S.Profile.plan) { for ($i = 0; $i -lt $plans.Count; $i++) { if (($plans[$i].bundle -and $plans[$i].bundle -eq "$($S.Profile.plan.bundle)") -or ($plans[$i].solution -and @($S.Profile.plan.solutions) -contains $plans[$i].solution -and -not $S.Profile.plan.bundle)) { $current = $i; break } } }
    $cbPlan.SelectedIndex = $current
    $apply = New-Button 'Use this client and mode' {
        $pid2 = $(if ($cbClient.SelectedIndex -ge 0) { $profiles[$cbClient.SelectedIndex].id } else { $null })
        $mode2 = $(if ($cbMode.SelectedIndex -ge 0) { @((Get-DEModes).Keys)[$cbMode.SelectedIndex] } else { $S.Mode })
        $pl = $plans[[Math]::Max(0, $cbPlan.SelectedIndex)]
        Use-ClientAndMode -ProfileId $pid2 -Mode $mode2 -Technician $tbTech.Text -Bundle $pl.bundle -Solution @($pl.solution | Where-Object { $_ })
    }.GetNewClosure() -Primary
    # recommended mode from what discovery found; the technician still decides
    $recCard = $null
    if ($S.Snapshot) {
        $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile
        $useRec = New-Button "Use $($rec.mode)" { $m = $rec.mode; $cbMode.SelectedIndex = [array]::IndexOf(@((Get-DEModes).Keys), $m); Set-Status "Mode set to $m (recommended). Choose Use this client and mode to load the plan." }.GetNewClosure() -A11y "Use the recommended mode $($rec.mode)"
        $recCard = New-Wrap @((New-Text ("Recommended mode: {0}. {1}" -f $rec.mode, $rec.reason) -Wrap), $useRec)
    }
    $modeDesc = New-Text ((Get-DEModes)[$S.Mode].description) -Muted -Wrap
    [void]$root.Children.Add((New-Card @(
                (New-Text 'Session' 15 -Bold),
                (New-Wrap @((New-El StackPanel @{ Margin = '0,0,16,0' } @((New-Label 'Client profile'), $cbClient)), (New-El StackPanel @{ Margin = '0,0,16,0' } @((New-Label 'Plan (ProActive tier or standalone solution)'), $cbPlan)), (New-El StackPanel @{ Margin = '0,0,16,0' } @((New-Label 'Mode'), $cbMode)), (New-El StackPanel @{} @((New-Label 'Technician (defaults to Joe, not the Windows session)'), $tbTech)))),
                $modeDesc,
                $recCard,
                (New-Wrap @($apply, (New-Button 'Run discovery' { Invoke-Discovery }), (New-Button 'Quick discovery' { Invoke-Discovery -Quick }), (New-Button 'Audit everything (change nothing)' { if (-not $S.Profile) { Set-Status 'Pick a client first.'; return }; Start-DEJob -Label 'Full audit' -Work { $null = Invoke-DEAudit -Mode $JobMode } })))
            )))
    # readiness cards
    $r = Get-DEReadiness
    $wrap = New-Object System.Windows.Controls.WrapPanel
    foreach ($c in $r.cards) {
        $b = New-Object System.Windows.Controls.Border; $b.Style = $Win.Resources['Card']; $b.Width = 200; $b.Margin = '0,0,12,12'
        $sp = New-El StackPanel; [void]$sp.Children.Add((New-El TextBlock @{ Text = $c.title; Style = 'Eyebrow' })); $st = New-El TextBlock @{ Text = $c.state; FontSize = 20; FontWeight = 'Bold'; Margin = '0,4,0,2' }; $st.FontFamily = New-Object System.Windows.Media.FontFamily $FontDisplay; $st.Foreground = Get-StateBrush $c.state; [void]$sp.Children.Add($st)
        [void]$sp.Children.Add((New-El TextBlock @{ Text = $(if ($c.last) { "$($c.count) checks · $(([datetime]$c.last).ToString('HH:mm'))" } else { 'not run' }); Style = 'Mono' }))
        $b.Child = $sp; [void]$wrap.Children.Add($b)
    }
    [void]$root.Children.Add((New-Card @((New-Text "Readiness: $($r.overall)" 15 -Bold), $wrap)))
    # next action
    if ($S.Profile) {
        $n = Get-DENextAction -Mode $S.Mode
        if ($n.id -like 'plan.*') { $go = New-Button 'Confirm done' { Confirm-GuiPlanStep -Id $n.id -Title $n.title }.GetNewClosure() -Primary }
        else { $go = New-Button $(if ($n.runnable) { 'Run it' } else { 'Show me' }) { if ($n.id -and $n.runnable) { $a = Get-DEAction -Id $n.id; if ($a.Destructive -and -not (Confirm-Gui "Run '$($a.Title)'?" 'This is a consequential step. Continue?')) { return }; Start-DEJob -Label $n.title -Params @{ id = $n.id } -Work { Invoke-DEAction -Id $JobParams.id -Mode Apply } } elseif ($n.module) { Show-Page (Get-PageForModule $n.module) } }.GetNewClosure() -Primary }
        [void]$root.Children.Add((New-Card @((New-Label 'Next recommended action'), (New-Text $n.title 17 -Bold -Wrap), (New-Text "Why: $($n.why)" -Muted -Wrap), $(if ($n.manual) { New-Text "Manual step: $($n.manual)" -Wrap }), $(if ($n.secrets.Count) { New-Text "Enter in Settings & secrets: $($n.secrets -join ', ')" -Wrap }), $go)))
        # gate board
        $gates = Get-DEGateBoard -Refresh
        $gridG = New-El DataGrid @{ Height = 250; Name = 'Gate board' }
        Add-DEGridColumns -Grid $gridG -Columns @(@{ h = 'Gate'; b = 'Title'; w = '1.6*' }, @{ h = 'State'; b = 'State'; w = 84 }, @{ h = 'Detail'; b = 'Detail'; w = '2.4*' }, @{ h = 'How to unlock'; b = 'Unblock'; w = '2*' })
        $gridG.ItemsSource = @($gates | ForEach-Object { [pscustomobject]@{ Title = $_.Title; State = $_.Status; Detail = $_.Detail; Unblock = $_.Unblock } })
        [void]$root.Children.Add((New-Card @((New-Text 'Gate engine' 15 -Bold), (New-Text 'Consequential actions stay disabled until their gates read PASS (or an approved, unexpired exception).' -Muted -Wrap), $gridG)))
    }
}
function Get-PageForModule { param([string]$Module) switch ($Module) { 'identity' { 'Identity' } 'jumpcloud' { 'Identity' } 'security' { 'Security' } 'apps' { 'Apps' } 'browser' { 'Browser' } 'baseline' { 'Baseline' } 'branding' { 'Branding' } default { 'Network' } } }

function Build-Workflow {
    param($root)
    $phases = @(Get-DEActions -Mode $S.Mode | Group-Object Phase | Sort-Object { [int]$_.Name })
    $phaseNames = @{ 0 = 'Plan prerequisites and order check'; 15 = 'Plan steps (portal and people work)'; 16 = 'Handoff'; 1 = 'Intake'; 2 = 'Hardware and readiness'; 3 = 'Updates and firmware'; 5 = 'Break-glass'; 6 = 'Encryption, OneDrive, Hello gates'; 7 = 'Identity and JumpCloud'; 8 = 'Security stack'; 9 = 'Applications'; 10 = 'Microsoft 365 and MFA'; 11 = 'Windows baseline'; 12 = 'Browser'; 13 = 'Branding'; 14 = 'Network, backup, remote support' }
    $n = Get-DENextAction -Mode $S.Mode
    [void]$root.Children.Add((New-Card @((New-Label 'Next'), (New-Text $n.title 17 -Bold -Wrap), (New-Text $n.why -Muted -Wrap), (New-Wrap @((New-Button $(if ($n.id -like 'plan.*') { 'Confirm done' } else { 'Run next' }) { if ($n.id -like 'plan.*') { Confirm-GuiPlanStep -Id $n.id -Title $n.title; return }; if ($n.runnable) { Start-DEJob -Label $n.title -Params @{ id = $n.id } -Work { Invoke-DEAction -Id $JobParams.id -Mode Apply } } else { Set-Status "Not runnable yet: $($n.why)" } }.GetNewClosure() -Primary), (New-Button 'Restart now and resume' { if (Confirm-Gui 'Restart?' 'The console will reopen after sign-in at the queued step.') { Set-DEResume -Launcher (Get-LauncherPath) -NextAction $n.id -LoginAs "$((Get-DEContext)['localUserName'])"; Invoke-DERestart -DelaySeconds 20 } }.GetNewClosure()), (New-Button 'Export evidence' { Show-Page 'Evidence' }))))))
    foreach ($ph in $phases) {
        $title = $phaseNames[[int]$ph.Name]; if (-not $title) { $title = "Phase $($ph.Name)" }
        $mods = @($ph.Group | ForEach-Object { $_.Module } | Select-Object -Unique)
        $card = New-ActionGrid -Modules $mods -Title "Phase $($ph.Name) · $title"
        $phaseNo = [int]$ph.Name
        $btn = New-Button "Run phase $phaseNo" { Start-DEJob -Label "Phase $phaseNo" -Params @{ phase = $phaseNo } -Work { Invoke-DEPhase -Phase $JobParams.phase -Mode $JobMode -StopOnBlocked } }.GetNewClosure()
        ($card.Child).Children.Insert(2, $btn)
        [void]$root.Children.Add($card)
    }
}

function Build-Discovery {
    param($root)
    [void]$root.Children.Add((New-Card @((New-Text 'Discovery' 15 -Bold), (New-Text 'Read-only: hardware, identity graph (dsregcmd), MDM authority, BitLocker, OneDrive, Hello, agents, browsers, network, updates, applications.' -Muted -Wrap), (New-Wrap @((New-Button 'Run full discovery' { Invoke-Discovery } -Primary), (New-Button 'Quick (skip apps and updates)' { Invoke-Discovery -Quick }))))))
    if (-not $S.Snapshot) { return }
    $snap = $S.Snapshot
    $sections = [ordered]@{ Device = $snap.device; 'Identity' = @{ joinType = $snap.identity.joinType; tenant = $snap.identity.dsreg.tenantName; tenantId = $snap.identity.dsreg.tenantId; prt = $snap.identity.dsreg.azureAdPrt; hello = $snap.identity.hello.pinConfigured; interactiveUser = $snap.identity.interactiveUser; currentPrincipal = $snap.identity.currentPrincipal; administrators = (@($snap.identity.administrators | ForEach-Object { $_.name }) -join ', '); unresolvedAdminSids = @($snap.identity.unresolvedAdministratorSids).Count; conflicts = ($snap.identity.conflicts -join '; ') }
        'MDM' = @{ authority = $snap.mdm.authority; enrollments = @($snap.mdm.enrollments).Count; stale = @($snap.mdm.staleEnrollments).Count; jumpcloudAgent = $snap.mdm.jumpcloud.installed; jumpcloudRegistered = $snap.mdm.jumpcloud.registered }
        'BitLocker' = @{ osEncrypted = $snap.bitlocker.osEncrypted; protectionOn = $snap.bitlocker.osProtectionOn; recoveryProtectorIds = (@($snap.bitlocker.os.recoveryProtectorIds) -join ', ') }
        'OneDrive' = @{ classification = $snap.onedrive.classification; running = $snap.onedrive.running; accounts = (@($snap.onedrive.accounts | ForEach-Object { "$($_.type):$($_.email)" }) -join ', ') }
        'Security agents' = @{ edr = ($snap.agents.edrPresent -join ', '); conflicting = ($snap.agents.conflictingEdr -join ', '); installed = (@($snap.agents.agents.Keys | Where-Object { $snap.agents.agents[$_].installed }) -join ', ') }
        'Browsers' = @{ default = $snap.browsers.defaultBrowser; chrome = $(if ($snap.browsers.chrome) { $snap.browsers.chrome.version } else { $null }); edge = $(if ($snap.browsers.edge) { $snap.browsers.edge.version } else { $null }) }
        'Network' = @{ gateway = $snap.network.gateway; dns = ($snap.network.dns -join ', '); wifiProfiles = ($snap.network.wifiProfiles -join ', ') }
    }
    $wrap = New-Object System.Windows.Controls.WrapPanel
    foreach ($k in $sections.Keys) {
        $sp = New-El StackPanel; [void]$sp.Children.Add((New-Text $k 14 -Bold))
        $h = $sections[$k]; foreach ($f in @($h.Keys | Where-Object { $null -ne $_ })) { $v = $h[$f]; if ($v -is [array]) { $v = ($v | ForEach-Object { if ($_ -is [hashtable]) { ($_.Values -join ' ') } else { "$_" } }) -join '; ' }; [void]$sp.Children.Add((New-El TextBlock @{ Text = "$f  $v"; Style = 'Mono'; TextWrapping = 'Wrap' })) }
        $b = New-Object System.Windows.Controls.Border; $b.Style = $Win.Resources['Card']; $b.Width = 440; $b.Margin = '0,0,12,12'; $b.Child = $sp; [void]$wrap.Children.Add($b)
    }
    [void]$root.Children.Add($wrap)
}

function Build-Identity {
    param($root)
    $ctx = Get-DEContext
    $tbSource = New-El TextBox @{ Text = "$($ctx['sourcePrincipal'])"; Width = 280; Name = 'Source principal' }
    $tbLocal = New-El TextBox @{ Text = "$($ctx['localUserName'])"; Width = 200; Name = 'Destination local user' }
    $tbJc = New-El TextBox @{ Text = "$($ctx['jumpcloudUser'])"; Width = 200; Name = 'JumpCloud user' }
    $tbEmail = New-El TextBox @{ Text = "$($ctx['endUserEmail'])"; Width = 260; Name = 'End user email or UPN' }
    $tbProt = New-El TextBox @{ Text = "$(Get-DEState -Path 'identity.bitlocker.expectedProtectorId')"; Width = 360; Name = 'BitLocker recovery protector id' }
    $save = New-Button 'Save mapping' { Set-DEContext -Values @{ sourcePrincipal = $tbSource.Text; localUserName = $tbLocal.Text; jumpcloudUser = $tbJc.Text; endUserEmail = $tbEmail.Text }; Reset-DEGateCache; Show-Page 'Identity' }.GetNewClosure() -Primary
    $check = New-Button 'Check preconditions' { $p = Test-DEMigrationPreconditions -SourcePrincipal $tbSource.Text -LocalUserName $tbLocal.Text; [System.Windows.MessageBox]::Show($Win, $(if ($p.ok) { "Ready.`n`nWarnings:`n$($p.warnings -join "`n")`n`nHello impact:`n$($p.helloImpact -join "`n")" } else { "Blocked:`n$($p.issues -join "`n")" }), 'Migration preconditions') | Out-Null }.GetNewClosure()
    $mapping = New-Button 'Check JumpCloud mapping' { Start-DEJob -Label 'JumpCloud mapping' -Params @{ u = $tbLocal.Text; s = $tbSource.Text } -Work { $m = Test-DEJumpCloudUserMapping -IntendedLocalUser $JobParams.u -SourcePrincipal $JobParams.s -QueryApi; Add-DEEvidence -Step 'jumpcloud.mapping-check' -Module 'jumpcloud' -Before 'mapping' -ActionTaken 'checked' -Result $(if ($m.status -eq 'READY') { 'PASS' } elseif ($m.status -eq 'WARN') { 'WARN' } else { 'BLOCKED' }) -Verification ($m.issues -join '; ') | Out-Null } }.GetNewClosure()
    $cbEscrow = New-El ComboBox @{ Width = 150; Name = 'Where the recovery key is escrowed' }; foreach ($loc in @('jumpcloud', 'hudu', 'itglue', 'vault', 'entra', 'other')) { [void]$cbEscrow.Items.Add($loc) }; $cbEscrow.SelectedIndex = 0
    $prot = New-Button 'Record protector id' { try { Set-DEBitLockerExpectedProtector -ProtectorId $tbProt.Text -Location "$($cbEscrow.SelectedItem)" -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Identity' } catch { Set-Status $_.Exception.Message } }.GetNewClosure()
    $blBackup = New-Button 'Back up BitLocker key' { Start-DEJob -Label 'Back up the BitLocker recovery key' -Params @{} -Work { Invoke-DEAction -Id 'identity.bitlocker-backup' -Mode Apply } } -A11y 'Back up the BitLocker recovery key to Entra and check JumpCloud holds it'
    $strandBtn = New-Button 'Accept leftover profiles' { $left = @(Get-DEUnmigratedDomainProfiles); if (-not $left.Count) { Set-Status 'No unmigrated Entra or domain profiles on this device.'; return }; $list = ($left | ForEach-Object { $_.path }) -join "`n"; if (Confirm-Gui 'Leave these profiles behind?' "These profiles still belong to an Entra or domain account. After the device leaves Microsoft nobody can sign in to them:`n`n$list`n`nOnly accept profiles nobody needs (for example an old admin sign-in). Migrate the end user's profile instead.") { Confirm-DEStrandedProfilesAccepted -Paths @($left | ForEach-Object { $_.path }) -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Identity' } }
    $bgv = New-Button 'Confirm break-glass verified' { if (-not (Test-DESecret -Name 'BREAKGLASS_PASSWORD')) { Set-Status 'Enter the break-glass password in Settings & secrets first.'; return }; if (Confirm-Gui 'Break-glass' "Did you just sign in interactively as .\DE-BreakGlass on this machine?") { $null = Confirm-DEBreakGlassVerified -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Identity' } }
    $odc = New-Button 'Confirm OneDrive synced and paused' { if (Confirm-Gui 'OneDrive' 'OneDrive shows Up to date and sync is paused?') { Confirm-DEOneDriveSynced; Reset-DEGateCache; Show-Page 'Identity' } }
    [void]$root.Children.Add((New-Card @(
                (New-Text 'Identity mapping' 15 -Bold), (New-Text 'Source is the Windows principal today (for example AzureAD\SuzetteThompson). Destination is the local account ADMU creates and JumpCloud takes over (for example sthompson). C:\Users\<source> is preserved (UpdateHomePath off).' -Muted -Wrap),
                (New-Wrap @((New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Source principal'), $tbSource)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Destination local user'), $tbLocal)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'JumpCloud user'), $tbJc)), (New-El StackPanel @{} @((New-Label 'Email / UPN'), $tbEmail)))),
                (New-Wrap @($save, $check, $mapping, $bgv, $odc)),
                (New-Wrap @((New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'BitLocker recovery protector id (verified against escrow; never the password)'), $tbProt)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Escrowed in'), $cbEscrow)), $prot, $blBackup, $strandBtn)),
                (New-Text 'Before JumpCloud owns the device it leaves Microsoft (Entra ID and any AD domain). That step waits for a verified migration, a BitLocker key proven outside Entra (JumpCloud, or an escrow you record) and no unmigrated profiles.' -Muted -Wrap)
            )))
    [void]$root.Children.Add((New-ActionGrid -Modules @('identity') -Title 'Identity: break-glass, gates, ADMU migration, Entra leave, MDM cleanup'))
    [void]$root.Children.Add((New-ActionGrid -Modules @('jumpcloud') -Title 'JumpCloud: agent, mapping, binding, groups, policies, components'))
}
function Build-SecurityPosture {
    param($root)
    if (-not $S.Profile) { return }
    $p = Get-DESecurityPosture -ClientProfile $S.Profile
    $lines = @("Guardz (primary): required $($p.guardz.required), installed $($p.guardz.installed), running $($p.guardz.running)", "SentinelOne: required $($p.sentinelone.required), installed $($p.sentinelone.installed), running $($p.sentinelone.running)", "Blackpoint (backup): deploy $($p.blackpoint.required), installed $($p.blackpoint.installed)", "PABX policy: required $($p.pabx.required), applied $($p.pabx.applied)", "Conflicting EDR: $(if ($p.conflictingEdr.Count) { $p.conflictingEdr -join ', ' } else { 'none' })")
    [void]$root.Children.Add((New-Card @((New-Text 'Posture' 15 -Bold), (New-El TextBlock @{ Text = ($lines -join "`n"); Style = 'Mono'; TextWrapping = 'Wrap' }))))
}
function Build-PackageCatalog {
    param($root)
    $grid = New-El DataGrid @{ Height = 320; Name = 'Package catalog' }
    Add-DEGridColumns -Grid $grid -Columns @(@{ h = 'Package'; b = 'Name'; w = '2*' }, @{ h = 'Category'; b = 'Category'; w = 100 }, @{ h = 'Source'; b = 'Source'; w = 80 }, @{ h = 'Trust'; b = 'Trust'; w = '2*' }, @{ h = 'Confirmed'; b = 'Confirmed'; w = 100 }, @{ h = 'Secrets'; b = 'Secrets'; w = '1*' })
    $grid.ItemsSource = @(Get-DEPackages | ForEach-Object { $src = $_.source; [pscustomobject]@{ Name = $_.name; Category = $_.category; Source = $src.type; Trust = $(if ($src.type -eq 'winget') { "winget $($src.id)" } else { "sha256: $(if ((Get-DEPkgProp $src 'sha256')) { 'set' } else { 'not set' }); publisher: $(Get-DEPkgProp $src 'publisher')" }); Confirmed = $(if ($_.confirmed) { 'yes' } else { 'confirm first' }); Secrets = (@(Get-DEPkgProp $_ 'secrets' | Where-Object { $null -ne $_ }) -join ', ') } })
    $folder = New-Button 'Open packages folder' { Start-Process (Get-DELocalPackagesDir) }
    [void]$root.Children.Add((New-Card @((New-Text 'Installer repository' 15 -Bold), (New-Text 'Put DE-supplied installers (Guardz MSI, SentinelOne managed installer, PABX script, MSP360 build) in the packages folder. Unverified files are refused unless you override with a reason, which is recorded as WARN.' -Muted -Wrap), $folder, $grid)))
}
function Build-BrowserPreview {
    param($root)
    $want = Get-DEBrowserDesiredPolicy -ClientProfile $S.Profile
    $text = "Default: $($want.default)`n`nEdge:`n" + (($want.edge.Keys | ForEach-Object { "  $_ = $(if ($_ -eq 'ManagedBookmarks') { '(bookmarks json, ' + $want.edge[$_].Length + ' chars)' } else { $want.edge[$_] })" }) -join "`n") + "`n`nLists:`n" + (($want.lists.edge.Keys | ForEach-Object { "  $_ : $(@($want.lists.edge[$_]).Count) item(s)" }) -join "`n")
    [void]$root.Children.Add((New-Card @((New-Text 'Policy preview (what will be written)' 15 -Bold), (New-El TextBlock @{ Text = $text; Style = 'Mono'; TextWrapping = 'Wrap' }))))
}
function Build-Branding {
    param($root)
    # the options edit the loaded profile for this session; 'Save to client profile' writes them to the client's profile file
    if (-not $S.Profile.branding) { $S.Profile.branding = @{} }
    if (-not $S.BrandTarget) { $S.BrandTarget = 'wallpaper' }
    $key = $S.BrandTarget
    if (-not $S.Profile.branding[$key]) { $S.Profile.branding[$key] = @{} }
    $o = Get-DEBrandingOptions -ClientProfile $S.Profile -LockScreen:($key -eq 'lockScreen')
    $set = { param($name, $value) $S.Profile.branding[$S.BrandTarget][$name] = $value }
    $combo = { param($label, $name, [string[]]$items, $current) $cb = New-El ComboBox @{ Width = 150; Name = $label }; foreach ($i in $items) { [void]$cb.Items.Add($i) }; $cb.SelectedIndex = [math]::Max(0, [array]::IndexOf($items, "$current")); $n = $name; $cb.Add_SelectionChanged({ & $set $n "$($cb.SelectedItem)" }.GetNewClosure()); New-El StackPanel @{ Margin = '0,0,12,0' } @((New-Label $label), $cb) }
    $slider = { param($label, $name, $min, $max, $current) $sl = New-El Slider @{ Minimum = $min; Maximum = $max; Value = [double]$current; Width = 170; TickFrequency = 1; IsSnapToTickEnabled = $true; Name = $label }; $lb = New-El TextBlock @{ Text = "$label  $([double]$current)%"; Style = 'Eyebrow'; Margin = '0,6,0,2' }; $n = $name; $sl.Add_ValueChanged({ & $set $n ([double]$sl.Value); $lb.Text = "$label  $([double]$sl.Value)%" }.GetNewClosure()); New-El StackPanel @{ Margin = '0,0,12,0' } @($lb, $sl) }
    $check = { param($label, $name, $current) $c = New-El CheckBox @{ Content = $label; IsChecked = [bool]$current; Margin = '0,4,14,4' }; $n = $name; $c.Add_Click({ & $set $n ([bool]$c.IsChecked) }.GetNewClosure()); $c }
    $text = { param($label, $name, $current, $w) $t = New-El TextBox @{ Text = "$current"; Width = $w; Name = $label }; $n = $name; $t.Add_LostFocus({ & $set $n $t.Text }.GetNewClosure()); New-El StackPanel @{ Margin = '0,0,12,0' } @((New-Label $label), $t) }
    $pick = { param($title, [scriptblock]$onFile) $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Filter = 'Images|*.png;*.jpg;*.jpeg'; $d.Title = $title; if ($d.ShowDialog() -eq 'OK') { & $onFile $d.FileName } }
    $img = New-El Image @{ Height = 440; Stretch = 'Uniform'; HorizontalAlignment = 'Left'; Margin = '0,8,0,8' }
    $info = New-El TextBlock @{ Style = 'Mono'; Text = 'No preview yet.' }
    $render = { param([switch]$Lock) try { $f = New-DEBrandedWallpaper -ClientProfile $S.Profile -LockScreen:$Lock; $bi = New-Object System.Windows.Media.Imaging.BitmapImage; $bi.BeginInit(); $bi.CacheOption = 'OnLoad'; $bi.UriSource = [uri]$f; $bi.EndInit(); $img.Source = $bi; $info.Text = "$(if ($Lock) { 'Lock screen' } else { 'Wallpaper' }) $($bi.PixelWidth)x$($bi.PixelHeight): $f" } catch { Set-Status $_.Exception.Message } }.GetNewClosure()
    $copyLogo = { param($src, $suffix) $dest = Join-Path (Get-DEConsole).Dirs.Profiles ("{0}-logo{1}{2}" -f $S.Profile.id, $suffix, [IO.Path]::GetExtension($src)); Copy-Item -LiteralPath $src -Destination $dest -Force; Split-Path -Leaf $dest }
    $targetSwitch = New-Wrap @(
        (New-Button $(if ($key -eq 'wallpaper') { '> Editing: wallpaper' } else { 'Edit wallpaper' }) { $S.BrandTarget = 'wallpaper'; Show-Page 'Branding' } -Primary:($key -eq 'wallpaper')),
        (New-Button $(if ($key -eq 'lockScreen') { '> Editing: lock screen' } else { 'Edit lock screen' }) { $S.BrandTarget = 'lockScreen'; Show-Page 'Branding' } -Primary:($key -eq 'lockScreen')))
    $look = New-Wrap @(
        (& $combo 'Background' 'theme' @('dark', 'light', 'accent', 'image') $o.theme),
        (& $text 'Background colour (#RRGGBB)' 'background' $o.background 120),
        (& $combo 'Position' 'position' @('lower-left', 'lower-center', 'lower-right', 'center', 'upper-left', 'upper-right') $o.position),
        (& $combo 'Logos' 'logos' @('both', 'client', 'de') $o.logos),
        (& $combo 'DE logo' 'deLogoStyle' @('horizontal', 'stacked', 'mark') $o.deLogoStyle),
        (& $combo 'Logo backing' 'logoPlate' @('auto', 'always', 'never') $o.logoPlate),
        (& $combo 'Resolution' 'resolution' @('auto', '1920x1080', '2560x1440', '3440x1440', '3840x2160', '5120x2880') $o.resolution))
    $sizes = New-Wrap @((& $slider 'Client logo height' 'logoHeightPct' 4 24 $o.logoHeightPct), (& $slider 'DE logo height (with client logo)' 'deLogoHeightPct' 3 18 $o.deLogoHeightPct), (& $slider 'Photo dimming' 'imageDim' 0 90 ([double]$o.imageDim * 100)))
    $lines = New-Wrap @((& $check 'Client name' 'showClientName' $o.showClientName), (& $check 'Managed by Digerati Experts' 'showManagedBy' $o.showManagedBy), (& $check 'Support line' 'showSupport' $o.showSupport), (& $check 'Hostname badge' 'showHostname' $o.showHostname), (& $check 'Accent bar' 'accentBar' $o.accentBar), (& $check 'Gradient glow' 'gradient' $o.gradient), (& $text 'Extra line' 'customLine' $o.customLine 300), (& $text 'Accent colour' 'accent' $o.accent 100))
    $files = New-Wrap @(
        (New-Button 'Client logo...' { & $pick 'Client logo (transparent PNG, at least 1200 px wide)' { param($f) $S.Profile.branding.clientLogo = (& $copyLogo $f ''); Set-Status 'Client logo set for this session.' } }.GetNewClosure()),
        (New-Button 'Client logo for dark backgrounds...' { & $pick 'Light or white version of the client logo' { param($f) $S.Profile.branding.clientLogoReverse = (& $copyLogo $f '-reverse'); Set-Status 'Dark-background logo set for this session.' } }.GetNewClosure()),
        (New-Button 'Background photo...' { & $pick 'Background photo (at least the screen resolution)' { param($f) & $set 'image' (Join-Path (Get-DEConsole).Dirs.Profiles (& $copyLogo $f '-background')); & $set 'theme' 'image'; Show-Page 'Branding' } }.GetNewClosure()),
        (New-El ComboBox @{ Width = 170; Name = 'About page logo' }))
    $oemCb = $files.Children[3]; foreach ($i in @('DE mark (About page)', 'Client logo (About page)', 'No About page logo')) { [void]$oemCb.Items.Add($i) }; $oemCb.SelectedIndex = [math]::Max(0, [array]::IndexOf(@('de', 'client', 'none'), "$(if ($S.Profile.branding.oemLogo) { $S.Profile.branding.oemLogo } else { 'de' })")); $oemCb.Add_SelectionChanged({ $S.Profile.branding.oemLogo = @('de', 'client', 'none')[[math]::Max(0, $oemCb.SelectedIndex)] }.GetNewClosure())
    $actions = New-Wrap @(
        (New-Button 'Preview wallpaper' { & $render } -Primary),
        (New-Button 'Preview lock screen' { & $render -Lock }),
        (New-Button 'Save to client profile' { try { $base = ConvertTo-DEHashtable (Get-DEClientProfile -Id $S.Profile.id); $base['branding'] = ConvertTo-DEHashtable $S.Profile.branding; $f = Save-DEClientProfile -Profile $base; Set-Status "Branding saved to $f" } catch { Set-Status $_.Exception.Message } }),
        (New-Button 'Reset these options' { $S.Profile.branding[$S.BrandTarget] = @{}; Show-Page 'Branding' }),
        (New-Button 'Apply wallpaper + branded lock screen' { if (Confirm-Gui 'Apply branding' 'Set the wallpaper, company-branded lock/sign-in screen and About-page info on this device now? Undo branding restores the previous look.') { Start-DEJob -Label 'Apply branding and lock screen' -Work { Invoke-DEAction -Id 'branding.apply' -Mode Apply } } }),
        (New-Button 'Undo branding' { if (Confirm-Gui 'Undo branding' 'Restore the previous wallpaper, lock screen and OEM info?') { Start-DEJob -Label 'Undo branding' -Work { Undo-DEBranding } } }))
    $tips = New-Text 'Tips: use transparent PNG logos at least 1200 px wide; give a light version for dark backgrounds (otherwise the logo gets a light backing plate automatically). The DE logo switches to its white version on dark backgrounds by itself. Apply writes the rendered company image as both the Windows lock/sign-in image and the PersonalizationCSP lock-screen image. For JumpCloud MDM fleets, also bind a Desktop and Lock Screen Settings policy so the branded image is continuously enforced; Windows Pro needs the JumpCloud/Microsoft SharedPC SetEduPolicies prerequisite for that MDM policy.' -Muted -Wrap
    [void]$root.Children.Add((New-Card @((New-Text 'Branding' 15 -Bold), (New-Text "Hostname pattern $($S.Profile.branding.hostnamePattern) -> $(New-DEHostname -ClientProfile $S.Profile)" -Muted), $targetSwitch, (New-Label 'Look'), $look, (New-Label 'Sizes'), $sizes, (New-Label 'Text'), $lines, (New-Label 'Files'), $files, $tips, $actions, $info, $img)))
    [void]$root.Children.Add((New-ActionGrid -Modules @('branding') -Title 'Branding actions'))
}
function Build-OpsConfirm {
    param($root)
    $mk = { param($label, $check) New-Button $label { if (Confirm-Gui 'Confirm' "$label now?") { Confirm-DEOperationalCheck -Check $check; Show-Page 'Network' } }.GetNewClosure() }
    [void]$root.Children.Add((New-Card @((New-Text 'Technician confirmations' 15 -Bold), (New-Text 'Recorded with time and technician; no credentials are stored.' -Muted), (New-Wrap @((& $mk 'Confirm first backup succeeded' 'operations.backup.firstBackupConfirmedAt'), (& $mk 'Confirm remote support session tested' 'operations.remoteSupport.testedAt'), (& $mk 'Confirm email security in place' 'operations.emailSecurity.confirmedAt'), (& $mk 'Confirm JumpCloud Protect enrolled' 'operations.mfa.jumpcloudProtectAt'), (& $mk 'Confirm Microsoft MFA registered' 'operations.mfa.microsoftAt'))))))
}
function Build-Toolbox {
    <# Proven MSP scripts (catalog\community.json), each pinned to a reviewed commit and hash-checked, run unmodified in their own 64-bit Windows PowerShell with the output kept as evidence. #>
    param($root)
    $names = @{ repair = 'Repair'; cleanup = 'Clean up'; 'takeover-removal' = 'Remove the previous MSP''s tools'; hardening = 'Hardening'; check = 'Checks'; setup = 'Setup' }
    $scripts = @(Get-DECommunityScripts)
    $live = -not (Get-DEConsole).DryRun
    [void]$root.Children.Add((New-Card @((New-Text 'Toolbox' 15 -Bold), (New-Text "Proven scripts from other MSPs. Each one is pinned to the commit DE reviewed and checked against its hash before it runs, in its own 64-bit PowerShell; the full output goes to Evidence. $(if ($live) { 'LIVE: Run changes the device.' } else { 'PLAN ONLY: Run shows what would happen; switch to LIVE on Scan & fix to run for real.' })" -Muted -Wrap))))
    if (-not $scripts.Count) { [void]$root.Children.Add((New-Card @((New-Text 'No toolbox scripts in the catalog.' -Muted)))); return }
    foreach ($cat in @($scripts | ForEach-Object { $_.category } | Select-Object -Unique)) {
        $sp = New-El StackPanel
        [void]$sp.Children.Add((New-El TextBlock @{ Text = $(if ($names[$cat]) { $names[$cat] } else { $cat }); Style = 'Eyebrow'; Margin = '0,0,0,6' }))
        foreach ($sc in @($scripts | Where-Object { $_.category -eq $cat })) {
            $row = New-El StackPanel @{ Margin = '0,4,0,8' }
            $flags = @(); if ($sc.confirm) { $flags += 'asks first' }; if ($sc.reboots) { $flags += 'may restart' }; if ($sc.needsInternet) { $flags += 'needs internet' }
            [void]$row.Children.Add((New-Text $sc.title -Bold))
            [void]$row.Children.Add((New-Text "$($sc.notes)" -Muted -Wrap))
            [void]$row.Children.Add((New-El TextBlock @{ Text = "$($sc.repo) @ $($sc.commit.Substring(0, 7)) · $($sc.path) · $($sc.license)$(if ($flags.Count) { ' · ' + ($flags -join ', ') })"; Style = 'Mono'; TextWrapping = 'Wrap' }))
            $key = $sc.key; $title = $sc.title; $needsYes = $sc.confirm
            $run = New-Button $(if ($live) { 'Run' } else { 'Plan' }) {
                if ($needsYes -and -not (Get-DEConsole).DryRun -and -not (Confirm-Gui -Title $title -Message "$title changes this device in ways that are hard to undo (it may uninstall software or restart). Run it now?")) { return }
                Start-DEJob -Label $title -Params @{ key = $key; dry = [bool](Get-DEConsole).DryRun } -Work { if ($JobParams.dry) { Invoke-DECommunityScript -Key $JobParams.key -WhatIf } else { Invoke-DECommunityScript -Key $JobParams.key -Force -Confirm:$false } } -OnDone { param($r) $x = @($r | Where-Object { $_ -and $_.PSObject.Properties['result'] }) | Select-Object -Last 1; if ($x) { Set-Status "$($x.key): $($x.result)$(if ($x.PSObject.Properties['log'] -and $x.log) { " (log: $($x.log))" })" } }
            }.GetNewClosure() -A11y "Run $($sc.title)"
            [void]$row.Children.Add((New-Wrap @($run)))
            [void]$sp.Children.Add($row)
        }
        [void]$root.Children.Add((New-Card @($sp)))
    }
}
function Build-CommandLine {
    <# Every command a technician or RMM needs, with Copy. Dangerous ones are marked; {root} is this install. #>
    param($root)
    $search = New-El TextBox @{ Width = 360; Name = 'Search commands' }
    $list = New-El StackPanel
    $render = {
        $list.Children.Clear()
        foreach ($g in @(Get-DECheatSheet -Search $search.Text)) {
            $sp = New-El StackPanel; [void]$sp.Children.Add((New-El TextBlock @{ Text = $g.title; Style = 'Eyebrow'; Margin = '0,0,0,6' }))
            foreach ($i in @($g.items)) {
                $row = New-El StackPanel @{ Margin = '0,4,0,8' }
                [void]$row.Children.Add((New-Text "$($i.title)$(if ($i.danger) { '   (changes the device)' })" -Bold))
                $cmdBox = New-El TextBox @{ Text = $i.command; IsReadOnly = $true; TextWrapping = 'Wrap'; FontFamily = 'Cascadia Mono, Consolas'; FontSize = 12; Name = $i.title }
                if ($i.danger) { $cmdBox.BorderBrush = Get-Brush 'Magenta' }
                [void]$row.Children.Add($cmdBox)
                $cmd = $i.command
                $copy = New-Button 'Copy' { [System.Windows.Clipboard]::SetText($cmd); Set-Status 'Copied.' }.GetNewClosure() -A11y "Copy: $($i.title)"
                [void]$row.Children.Add((New-Wrap @($copy, (New-El TextBlock @{ Text = "$($i.shell)$(if ($i.note) { ' · ' + $i.note })"; Style = 'Mono'; TextWrapping = 'Wrap'; VerticalAlignment = 'Center'; MaxWidth = 760 }))))
                [void]$sp.Children.Add($row)
            }
            [void]$list.Children.Add((New-Card @($sp)))
        }
    }.GetNewClosure()
    $search.Add_TextChanged({ & $render }.GetNewClosure())
    $all = New-Button 'Copy all as text' { $t = (@(Get-DECheatSheet -Search $search.Text) | ForEach-Object { "## $($_.title)"; foreach ($i in $_.items) { "# $($i.title)$(if ($i.note) { " - $($i.note)" })"; $i.command; '' } }) -join "`r`n"; [System.Windows.Clipboard]::SetText($t); Set-Status 'Cheat sheet copied.' }.GetNewClosure()
    [void]$root.Children.Add((New-Card @((New-Text 'Command line' 15 -Bold), (New-Text 'Start the tool, run it from RMM, install a licence, run Toolbox scripts, build rescue media and releases, Microsoft 365 admin, and the Windows commands used on takeovers. Exit codes: 0 done, 1 not finished, 2 blocked or refused.' -Muted -Wrap), (New-Wrap @((New-El StackPanel @{} @((New-Label 'Search'), $search)), $all)))))
    [void]$root.Children.Add($list); & $render
}
function Import-DEMsAdmin {
    <# DE Microsoft Admin ships beside the console (..\microsoft); the Migration page loads it the first time it is opened. #>
    if (Get-Module -Name 'DE-Microsoft-Admin') { return $true }
    $m = Join-Path (Split-Path -Parent $ConsoleRoot) 'microsoft\DE-Microsoft-Admin\DE-Microsoft-Admin.psd1'
    if (-not (Test-Path -LiteralPath $m)) { return $false }
    Import-Module $m -DisableNameChecking -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
    return $true
}
function New-DEGrid {
    <# A read-only DataGrid from rows and @(@{ h = header; b = property; w = width }). #>
    param([object[]]$Rows, [object[]]$Columns, [string]$Name, [double]$MaxHeight = 320)
    $g = New-El DataGrid @{ Name = $Name; MaxHeight = $MaxHeight; Margin = '0,4,0,4' }
    Add-DEGridColumns -Grid $g -Columns $Columns
    $g.ItemsSource = @($Rows)
    return $g
}
function Build-Migration {
    <#
        Gmail -> Microsoft 365 (MIGRATION-STANDARD.md). On a client PC: scan every Windows account for Gmail left in
        Outlook, Credential Manager, Thunderbird and scheduled scripts, and save the result for the project. On the
        admin PC that holds the project: where it stands, the next command, the checklist, mailboxes, devices, bounces.
        Tenant changes (batches, DNS, sign-off) stay in PowerShell with DE Microsoft Admin, where the sign-in is.
    #>
    param($root)
    if (-not (Import-DEMsAdmin)) { [void]$root.Children.Add((New-Card @((New-Text 'Email migration' 15 -Bold), (New-Text 'DE Microsoft Admin is missing from this copy of the tool (microsoft\DE-Microsoft-Admin). Reinstall DE Tech Tool from a release package.' -Wrap)))); return }
    $projects = @(Get-DEMigrationProject | Where-Object { $_ })
    $elevated = Test-DEIsElevated
    $tech = $(if ((Get-DEContext)['technician']) { (Get-DEContext)['technician'] } else { "$($Settings.technician)" })
    if (-not $S.ContainsKey('MigrationProject')) { $S.MigrationProject = $(if ($projects.Count) { $projects[-1].projectId } else { '' }) }
    if ($S.MigrationProject -and -not @($projects | Where-Object { $_.projectId -eq $S.MigrationProject }).Count) { $S.MigrationProject = '' }

    [void]$root.Children.Add((New-Card @((New-Text 'Email migration: Gmail to Microsoft 365' 15 -Bold), (New-Text 'On each PC the client uses, scan for Gmail that is still set up and save the result. On the PC that holds the migration project, see where it stands and the next command. Nothing here asks for or keeps a password: Gmail app passwords are typed only into the PowerShell command that needs them.' -Muted -Wrap))))

    # ---- project picker (only projects on this PC; they are created in PowerShell after signing in to the tenant)
    $cb = New-El ComboBox @{ Width = 360; Name = 'Migration project' }
    [void]$cb.Items.Add('No project on this PC (save the scan to a file)')
    foreach ($p in $projects) { [void]$cb.Items.Add("$($p.client) · $($p.projectId) · $($p.stage)") }
    $ids = @(''); $ids += @($projects | ForEach-Object { "$($_.projectId)" })
    $cb.SelectedIndex = [math]::Max(0, [array]::IndexOf($ids, "$($S.MigrationProject)"))
    $cb.Add_SelectionChanged({ $S.MigrationProject = $ids[[math]::Max(0, $cb.SelectedIndex)]; Show-Page 'Migration' }.GetNewClosure())

    # ---- this PC
    $all = New-El CheckBox @{ Content = 'Every Windows account on this PC'; IsChecked = $elevated; IsEnabled = $elevated; Margin = '0,6,0,6' }
    [System.Windows.Automation.AutomationProperties]::SetName($all, 'Scan every Windows account on this PC')
    $ms = Join-Path (Split-Path -Parent $ConsoleRoot) 'microsoft\DE-Microsoft-Admin\DE-Microsoft-Admin.psd1'
    $scan = New-Button 'Scan this PC for Gmail' {
        $dir = Join-Path (Get-DEConsole).Dirs.Evidence 'migration'
        $out = Join-Path $dir ("{0}-gmail-scan-{1}.json" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd-HHmmss'))
        Start-DEJob -Label 'Gmail scan' -Params @{ ms = $ms; all = [bool]$all.IsChecked; project = "$($S.MigrationProject)"; out = $out } -Work {
            Import-Module $JobParams.ms -DisableNameChecking -ErrorAction Stop -WarningAction SilentlyContinue | Out-Null
            $a = @{ AllProfiles = [bool]$JobParams.all }; if ($JobParams.project) { $a.ProjectId = $JobParams.project }
            $r = Get-DEMailClientInventory @a
            $null = Export-DEResult -Result $r -Path $JobParams.out
            Add-DEEvidence -Step 'migration.mail-clients' -Module 'migration' -Before '' -ActionTaken "Scanned $env:COMPUTERNAME for Gmail ($(if ($JobParams.all) { 'every Windows account' } else { 'this Windows account' }))$(if ($JobParams.project) { " for project $($JobParams.project)" })" -Result $(if ($r.status -eq 'Succeeded') { 'PASS' } else { 'WARN' }) -Verification "$($r.message)" -Remediation $(if (@($r.data).Count) { (@($r.data | ForEach-Object { "$($_.where): $($_.fix)" }) -join ' | ') } else { '' }) -Artifacts @($JobParams.out) | Out-Null
            [pscustomobject]@{ migrationScan = $r; file = $JobParams.out }
        } -OnDone { param($res) $x = @($res | Where-Object { $_ -and $_.PSObject.Properties['migrationScan'] }) | Select-Object -Last 1; if ($x) { $S.MigrationScan = $x; Set-Status "$($x.migrationScan.message)" }; Show-Page 'Migration' }
    }.GetNewClosure() -Primary -A11y 'Scan this PC for Gmail'
    $pc = New-El StackPanel
    [void]$pc.Children.Add((New-Text "This PC: $env:COMPUTERNAME" 14 -Bold))
    [void]$pc.Children.Add((New-Text $(if ($elevated) { 'Running as administrator, so every Windows account on this PC can be scanned. Saved Windows passwords (Credential Manager) are private to each account; for the others they are listed as not checked.' } else { 'Not running as administrator: only this Windows account can be scanned. Start DE Tech Tool as administrator to scan every account.' }) -Muted -Wrap))
    [void]$pc.Children.Add($all)
    [void]$pc.Children.Add((New-Wrap @((New-El StackPanel @{ Margin = '0,0,12,0' } @((New-Label 'Record the scan on'), $cb)), $scan)))
    $last = $S.MigrationScan
    if ($last -and "$($last.migrationScan.target)" -ieq $env:COMPUTERNAME) {
        $r = $last.migrationScan; $items = @($r.data | Where-Object { $_ })
        [void]$pc.Children.Add((New-Label "Last scan · $(([datetime]$r.at).ToLocalTime().ToString('g'))"))
        $tone = $(if ($r.status -eq 'Succeeded') { 'PASS' } else { 'WARN' })
        $msg = New-Text $(if ($items.Count) { "$($items.Count) place(s) still use Gmail." } else { 'Nothing on this PC still points at Gmail.' }) -Bold; $msg.Foreground = Get-StateBrush $tone; [void]$pc.Children.Add($msg)
        if ($items.Count) { [void]$pc.Children.Add((New-DEGrid -Name 'Gmail found on this PC' -Rows @($items | ForEach-Object { [pscustomobject]@{ Account = "$($_.account)"; Where = "$($_.where)"; Found = (Protect-DEText "$($_.what)"); Fix = "$($_.fix)" } }) -Columns @(@{ h = 'Account'; b = 'Account'; w = 110 }, @{ h = 'Where'; b = 'Where'; w = 200 }, @{ h = 'Found'; b = 'Found'; w = 260 }, @{ h = 'What to do'; b = 'Fix'; w = '*' }))) }
        foreach ($g in @($r.notChecked | Where-Object { $_ })) { [void]$pc.Children.Add((New-Text "Not checked: $g" -Muted -Wrap)) }
        $file = "$($last.file)"; $cmdkey = @($items | Where-Object { $_.fix -like 'remove it: cmdkey*' } | ForEach-Object { $_.fix -replace '^remove it: ', '' })
        $btns = @((New-Button 'Show the saved file' { if (Test-Path -LiteralPath $file) { Start-Process -FilePath 'explorer.exe' -ArgumentList "/select,`"$file`"" } else { Set-Status "The file is gone: $file" } }.GetNewClosure()))
        if ($cmdkey.Count) { $btns += New-Button 'Copy the Credential Manager commands' { [System.Windows.Clipboard]::SetText(($cmdkey -join "`r`n")); Set-Status 'Copied. Run them as the account they belong to.' }.GetNewClosure() }
        [void]$pc.Children.Add((New-Wrap $btns))
        [void]$pc.Children.Add((New-Text $(if ($S.MigrationProject) { "Recorded on project $($S.MigrationProject)." } else { "Saved to $file. On the PC with the project: Import-DEMailClientInventory -ProjectId <id> -Path <this file>, or Import a PC's scan below." }) -Muted -Wrap))
    }
    [void]$root.Children.Add((New-Card @($pc)))

    # ---- the project
    if (-not $S.MigrationProject) {
        [void]$root.Children.Add((New-Card @((New-Text 'Migration project' 14 -Bold), (New-Text $(if ($projects.Count) { 'Pick a project above to see where it stands.' } else { "No migration project on this PC. Projects are created on the technician's admin PC after signing in to the client's tenant, and kept in $env:ProgramData\DE\MicrosoftAdmin\migrations. This PC's part is the scan above." }) -Muted -Wrap), (New-Button 'Copy the command that starts a project' { [System.Windows.Clipboard]::SetText("Import-Module `"$ms`"; Connect-DEMicrosoft -TenantId <domain> -Scenario Read, Users, Migration; Connect-DEExchange -UserPrincipalName <admin UPN>; New-DEMigrationProject -ClientName '<client>' -TargetDomain <domain>"); Set-Status 'Copied.' }.GetNewClosure()))))
        return
    }
    $pid_ = "$($S.MigrationProject)"
    try { $p = Get-DEMigrationProject -ProjectId $pid_ } catch { [void]$root.Children.Add((New-Card @((New-Text "Project $pid_ could not be read: $($_.Exception.Message)" -Wrap)))); return }
    $next = Get-DEMigrationNextStep -ProjectId $pid_ -Technician $(if ($tech) { $tech } else { $env:USERNAME })
    $stages = @('Assessment', 'Provisioning', 'Preflight', 'Pilot', 'Batches', 'ContactsCalendar', 'Devices', 'DnsCutover', 'FinalDelta', 'Verification', 'SignedOff', 'Closed')
    $si = [array]::IndexOf($stages, "$($p.stage)")
    $head = New-El StackPanel
    [void]$head.Children.Add((New-Text "$($p.client) · $($p.targetDomain)" 15 -Bold))
    [void]$head.Children.Add((New-Text "$($p.sourceType) to Microsoft 365 over $($p.mailPath) · project $($p.projectId) · updated $(if ($p.updatedAt) { ([datetime]$p.updatedAt).ToLocalTime().ToString('g') } else { 'never' })" -Muted -Wrap))
    $bar = New-Object System.Windows.Controls.ProgressBar; $bar.Minimum = 0; $bar.Maximum = $stages.Count - 1; $bar.Value = [math]::Max(0, $si); $bar.Height = 6; $bar.Margin = '0,10,0,4'; [System.Windows.Automation.AutomationProperties]::SetName($bar, "Stage $($si + 1) of $($stages.Count): $($p.stage)")
    [void]$head.Children.Add($bar)
    [void]$head.Children.Add((New-Text "Stage $($si + 1) of $($stages.Count): $($p.stage)" -Muted))
    [void]$head.Children.Add((New-Label 'Next'))
    [void]$head.Children.Add((New-Text "$($next.step)" 14 -Bold))
    [void]$head.Children.Add((New-Text "$($next.why)" -Wrap))
    $nextCmd = "$($next.command)"
    [void]$head.Children.Add((New-El TextBox @{ Text = $nextCmd; IsReadOnly = $true; TextWrapping = 'Wrap'; FontFamily = 'Cascadia Mono, Consolas'; FontSize = 12; Name = 'Next command'; Margin = '0,6,0,6' }))
    [void]$head.Children.Add((New-Wrap @(
        (New-Button 'Copy the next command' { [System.Windows.Clipboard]::SetText("Import-Module `"$ms`"`r`n$nextCmd"); Set-Status 'Copied with the Import-Module line. Run it in PowerShell signed in to the tenant.' }.GetNewClosure() -Primary),
        (New-Button 'Refresh' { Show-Page 'Migration' })
    )))
    [void]$root.Children.Add((New-Card @($head)))

    # checklist
    $checkRows = @(foreach ($pr in @($p.verification.PSObject.Properties)) { $v = $pr.Value; [pscustomobject]@{ Check = $pr.Name; Status = $(switch ("$($v.status)") { 'Pass' { 'Passed' } 'Fail' { 'Failed' } 'NotApplicable' { 'Not applicable' } default { 'Not done' } }); Detail = "$($v.detail)"; By = $(if ($v.status -ne 'Pending' -and $v.by) { "$($v.by)" } else { '' }) } })
    $passed = @($checkRows | Where-Object { $_.Status -in @('Passed', 'Not applicable') }).Count
    [void]$root.Children.Add((New-Card @((New-Text "Sign-off checklist · $passed of $($checkRows.Count) done" 14 -Bold), (New-DEGrid -Name 'Sign-off checklist' -Rows $checkRows -Columns @(@{ h = 'Check'; b = 'Check'; w = 150 }, @{ h = 'Status'; b = 'Status'; w = 110 }, @{ h = 'Detail'; b = 'Detail'; w = '*' }, @{ h = 'By'; b = 'By'; w = 140 }) -MaxHeight 420))))

    # mailboxes
    $userRows = @(foreach ($u in @($p.users | Where-Object { $_ })) {
        [pscustomobject]@{
            From = "$($u.source)"; To = "$($u.destination)"
            Ready = $(if ($u.destinationReady) { 'Yes' } else { "No: $(@($u.destinationIssues) -join '; ')" })
            Preflight = $(if (-not $u.preflight) { 'Not run' } elseif ($u.preflight.ok) { "OK, $(@($u.preflight.folders).Count) folders" } else { "Failed: $($u.preflight.reason)" })
            Mail = $(if ($u.migration) { "$($u.migration.status)$(if ($null -ne $u.migration.synced) { ", $($u.migration.synced) items" })$(if ($u.migration.error) { " · $($u.migration.error)" })" } elseif ($u.batch) { "in $($u.batch)" } else { 'Not started' })
            Contacts = $(if ($u.contacts) { "$($u.contacts.imported) imported" } else { 'Not imported' })
            Calendar = $(if ($u.calendar) { "$($u.calendar.imported) imported" } else { 'Not imported' })
            MFA = $(if ($u.mfa) { $(if ($u.mfa.registered) { 'Registered' } else { 'Not registered' }) } else { 'Not checked' })
        }
    })
    [void]$root.Children.Add((New-Card @((New-Text "Mailboxes · $($userRows.Count)" 14 -Bold), $(if ($userRows.Count) { New-DEGrid -Name 'Mailboxes' -Rows $userRows -Columns @(@{ h = 'Gmail'; b = 'From'; w = 170 }, @{ h = 'Microsoft 365'; b = 'To'; w = 170 }, @{ h = 'Ready'; b = 'Ready'; w = 90 }, @{ h = 'Preflight'; b = 'Preflight'; w = 120 }, @{ h = 'Mail'; b = 'Mail'; w = '*' }, @{ h = 'Contacts'; b = 'Contacts'; w = 95 }, @{ h = 'Calendar'; b = 'Calendar'; w = 95 }, @{ h = 'MFA'; b = 'MFA'; w = 95 }) } else { New-Text 'No mailbox mapped yet.' -Muted }))))

    # devices
    $scannedDev = @($p.devices | Where-Object { $_ -isnot [string] -and $_.PSObject.Properties['checkedAt'] })
    $namedDev = @(@($p.devices | Where-Object { $_ -is [string] }) + @($p.users | ForEach-Object { @($_.devices) }) | Where-Object { $_ } | Select-Object -Unique)
    $devRows = @(foreach ($d in $scannedDev) { [pscustomobject]@{ Device = "$($d.name)"; Checked = ([datetime]$d.checkedAt).ToLocalTime().ToString('g'); Gmail = $(if (@($d.gmailReferences).Count) { "$(@($d.gmailReferences).Count) place(s): $(@($d.gmailReferences | ForEach-Object { $_.where }) -join '; ')" } else { 'None' }); Gaps = $(if ($d.PSObject.Properties['notChecked'] -and @($d.notChecked).Count) { "$(@($d.notChecked).Count) not checked" } else { '' }) } })
    foreach ($n in @($namedDev | Where-Object { @($scannedDev | ForEach-Object { "$($_.name)" }) -notcontains $_ })) { $devRows += [pscustomobject]@{ Device = "$n"; Checked = 'Not scanned'; Gmail = ''; Gaps = '' } }
    $importScan = New-Button "Import a PC's scan (.json)" {
        $d = New-Object Microsoft.Win32.OpenFileDialog; $d.Filter = 'Gmail scan (*.json)|*.json'; $d.Title = "Import a PC's Gmail scan"
        if ($d.ShowDialog($Win)) { $r = Import-DEMailClientInventory -ProjectId $pid_ -Path $d.FileName -Confirm:$false; Set-Status "$($r.message)"; Show-Page 'Migration' }
    }.GetNewClosure()
    [void]$root.Children.Add((New-Card @((New-Text "PCs · $($scannedDev.Count) of $($devRows.Count) scanned" 14 -Bold), $(if ($devRows.Count) { New-DEGrid -Name 'PCs' -Rows $devRows -Columns @(@{ h = 'PC'; b = 'Device'; w = 140 }, @{ h = 'Scanned'; b = 'Checked'; w = 140 }, @{ h = 'Gmail still set up'; b = 'Gmail'; w = '*' }, @{ h = 'Gaps'; b = 'Gaps'; w = 110 }) } else { New-Text 'No PC named or scanned yet.' -Muted }), (New-Wrap @($importScan)))))

    # bounces
    $bounces = @($p.bounce | Where-Object { $_ })
    $bp = New-El StackPanel
    [void]$bp.Children.Add((New-Text "Bounces · $(@($bounces | Where-Object { -not $_.resolved }).Count) open of $($bounces.Count)" 14 -Bold))
    [void]$bp.Children.Add((New-Text 'Save the bounce (non-delivery report) from Outlook as a .eml file and open it here. It says what is sending: a forward, a device retrying, a bounce of a bounce, or someone writing to a dead address. With Exchange connected in PowerShell, Invoke-DEBounceDiagnostic -MessageTrace also counts repeats.' -Muted -Wrap))
    foreach ($b in $bounces) {
        $row = New-El StackPanel @{ Margin = '0,8,0,4' }
        $t = New-Text "$($b.cause) · $($b.bouncedRecipient)$(if ($b.smtpStatus) { " · $($b.smtpStatus)" })$(if ($b.resolved) { ' · resolved' })" -Bold; $t.Foreground = Get-StateBrush $(if ($b.resolved) { 'PASS' } else { 'WARN' }); [void]$row.Children.Add($t)
        [void]$row.Children.Add((New-Text "$($b.why).$(if ($b.meaning) { " $($b.meaning)." })$(if (@($b.matchedDevices | Where-Object { $_ }).Count) { " Devices named in the headers: $(@($b.matchedDevices) -join ', ')." })$(if ($b.sendingClient) { " Sent by: $($b.sendingClient)." })" -Wrap))
        if ($b.resolved) { [void]$row.Children.Add((New-Text "Resolved by $($b.resolvedBy): $($b.resolution)" -Muted -Wrap)) }
        else {
            [void]$row.Children.Add((New-Text "Next: $($b.fix)" -Muted -Wrap))
            $fid = "$($b.id)"
            [void]$row.Children.Add((New-Wrap @((New-Button 'Record what was changed' {
                $what = Read-GuiText -Title 'Resolve the bounce' -Prompt 'What was changed to stop it (for example: removed the Gmail account from Outlook on HELENU)'
                if (-not $what) { return }
                $who = $(if ($tech) { $tech } else { Read-GuiText -Title 'Technician' -Prompt 'Your name' })
                if (-not $who) { return }
                $r = Resolve-DEMigrationBounce -ProjectId $pid_ -FindingId $fid -Resolution $what -Technician $who -Confirm:$false; Set-Status "$($r.message)"; Show-Page 'Migration'
            }.GetNewClosure() -A11y "Resolve bounce $fid"))))
        }
        [void]$bp.Children.Add($row)
    }
    [void]$bp.Children.Add((New-Wrap @((New-Button 'Diagnose a bounce (.eml)' {
        $d = New-Object Microsoft.Win32.OpenFileDialog; $d.Filter = 'Saved email (*.eml;*.txt)|*.eml;*.txt'; $d.Title = 'Open the bounce'
        if ($d.ShowDialog($Win)) { $r = Invoke-DEBounceDiagnostic -ProjectId $pid_ -Path $d.FileName; Set-Status "$($r.message)"; Show-Page 'Migration' }
    }.GetNewClosure()))))
    [void]$root.Children.Add((New-Card @($bp)))

    # the Hub record
    [void]$root.Children.Add((New-Card @((New-Text 'Intelligence Hub record' 14 -Bold), (New-Text 'The whole project as the Hub keeps it: identities, counts, checks, devices, bounces, sign-off and the event trail. It never holds a credential. Sending signs it with the Hub signing secret from Settings and files it under the client''s Hub account; the Hub keeps the newest record per project.' -Muted -Wrap), (New-Wrap @((New-Button 'Export the record' {
        $d = New-Object Microsoft.Win32.SaveFileDialog; $d.Filter = 'JSON (*.json)|*.json'; $d.FileName = "$pid_-record.json"; $d.Title = 'Save the migration record'
        if ($d.ShowDialog($Win)) { $r = Export-DEMigrationRecord -ProjectId $pid_ -Path $d.FileName; Set-Status "$($r.message)" }
    }.GetNewClosure()), (New-Button 'Send to Intelligence Hub' {
        $acct = "$((Get-DEContext)['hubAccountId'])"
        if ($acct -notmatch '^[1-9]\d*$') { $acct = Read-GuiText -Title 'Intelligence Hub account' -Prompt "The client's Intelligence Hub account number (from the account's page in the Hub)"; if (-not $acct) { return } }
        $out = Join-Path (Join-Path (Get-DEConsole).Dirs.Evidence 'migration') "$pid_-record.json"
        $null = Export-DEMigrationRecord -ProjectId $pid_ -Path $out
        if ((Get-DEConsole).DryRun) { $r = Send-DEHubMigrationRecord -Path $out -AccountId $acct -WhatIf; Set-Status "PLAN ONLY: would send $pid_ to the Hub as signed event $($r.eventId). Switch to LIVE on Scan & fix to send."; return }
        $r = Send-DEHubMigrationRecord -Path $out -AccountId $acct -Confirm:$false
        Set-Status "Sent $pid_ to the Intelligence Hub (event $($r.eventId), $($r.response.status))."
    }.GetNewClosure() -Primary))))))
}
function Build-Vendors {
    param($root)
    $search = New-El TextBox @{ Width = 320; Name = 'Search vendors' }
    $list = New-El StackPanel
    $render = {
        $list.Children.Clear()
        foreach ($c in Get-DEVendorCategories) {
            $vs = @(Get-DEVendors -Category $c.id -Search $search.Text); if (-not $vs.Count) { continue }
            $sp = New-El StackPanel; [void]$sp.Children.Add((New-El TextBlock @{ Text = $c.title; Style = 'Eyebrow'; Margin = '0,0,0,6' }))
            foreach ($v in $vs) {
                $row = New-El WrapPanel @{ Margin = '0,2' }
                $badge = New-El Border @{ CornerRadius = '6'; Padding = '6,1'; Margin = '0,0,8,0' }; $badge.Background = $(switch ($v.role) { 'primary' { Get-Brush 'Magenta' } 'backup' { Get-Brush 'Warn' } default { Get-Brush 'RaisedHover' } }); $badge.Child = (New-El TextBlock @{ Text = $v.role; FontSize = 10 })
                [void]$row.Children.Add($badge); [void]$row.Children.Add((New-El TextBlock @{ Text = $v.name; FontWeight = 'SemiBold'; Width = 260; VerticalAlignment = 'Center' }))
                foreach ($kind in @('admin', 'partner', 'client', 'docs', 'status', 'tenant')) {
                    $r = Resolve-DEVendorUrl -Vendor $v -Kind $kind -ClientProfile $S.Profile
                    if ($r -and $r.url) { $vid = $v.id; $k = $kind; [void]$row.Children.Add((New-Button $kind { $null = Open-DEVendor -Id $vid -Kind $k -ClientProfile $S.Profile }.GetNewClosure() -A11y "Open $($v.name) $kind")) }
                    elseif ($r -and $r.missing -and $r.missing.Count) { [void]$row.Children.Add((New-El TextBlock @{ Text = "needs $($r.missing -join ',')"; Style = 'Mono'; VerticalAlignment = 'Center'; Margin = '0,0,8,0' })) }
                }
                [void]$sp.Children.Add($row)
            }
            [void]$list.Children.Add((New-Card @($sp)))
        }
    }.GetNewClosure()
    $search.Add_TextChanged({ & $render }.GetNewClosure())
    $export = New-Button 'Export launcher page' { $f = Export-DEVendorLauncherHtml -Path (Join-Path (Get-DEConsole).Dirs.Base 'vendor-admin-center.html') -ClientProfile $S.Profile; Start-Process $f }
    $roles = (Get-DEVendorRoles | Where-Object { $_ -and ($_.primary.Count -or $_.backup.Count) } | ForEach-Object { "$($_.category): primary $($_.primary -join ', ')$(if ($_.backup.Count) { '; backup ' + ($_.backup -join ', ') })" }) -join "`n"
    [void]$root.Children.Add((New-Card @((New-Text 'Vendor Admin Center' 15 -Bold), (New-Text 'Eighteen categories with primary / backup roles. Tenant-specific links resolve from the client profile (vendorTenants); missing values are named instead of guessed.' -Muted -Wrap), (New-Wrap @((New-El StackPanel @{} @((New-Label 'Search'), $search)), $export)), (New-El TextBlock @{ Text = $roles; Style = 'Mono'; TextWrapping = 'Wrap'; Margin = '0,6,0,0' }))))
    [void]$root.Children.Add($list); & $render
}
function Build-AiToolkit {
    param($root)
    $loader = Join-Path (Split-Path -Parent $ConsoleRoot) 'Install-MspAiKit.ps1'
    $runLoader = { param($action, $extra) Start-DEJob -Label "AI Toolkit: $action" -Params @{ loader = $loader; action = $action; extra = $extra } -Work { $exe = (Get-Process -Id $PID).Path; if ($exe -notmatch 'powershell|pwsh') { $exe = 'powershell.exe' }; $out = & $exe -NoProfile -ExecutionPolicy Bypass -File $JobParams.loader -Action $JobParams.action -NonInteractive @($JobParams.extra) 2>&1 | ForEach-Object { "$_" }; foreach ($l in $out) { Write-DELog -Level INFO -Message $l }; Add-DEEvidence -Step "ai.$($JobParams.action.ToLower())" -Module 'ai-toolkit' -Before 'kit' -ActionTaken "loader $($JobParams.action)" -Result $(if ($LASTEXITCODE -eq 0) { 'PASS' } elseif ($LASTEXITCODE -eq 2) { 'BLOCKED' } else { 'FAIL' }) -Verification (($out | Select-Object -Last 1) -join '') | Out-Null } }.GetNewClosure()
    $log = New-El TextBox @{ Height = 260; IsReadOnly = $true; TextWrapping = 'NoWrap'; VerticalScrollBarVisibility = 'Auto'; HorizontalScrollBarVisibility = 'Auto'; Name = 'AI Toolkit log' }; $log.FontFamily = New-Object System.Windows.Media.FontFamily 'Cascadia Mono, Consolas'
    $S.LogBox = $log
    $packDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'DE\msp-ai-kit\digerati-experts'
    $copy = { param($i) $f = Join-Path $packDir 'chatgpt-custom-instructions.md'; if (-not (Test-Path -LiteralPath $f)) { Set-Status 'Build the packs first.'; return }; $m = [regex]::Matches((Get-Content -LiteralPath $f -Raw -Encoding UTF8), '```text\r?\n([\s\S]*?)\r?\n```'); if ($m.Count -ge 2) { [System.Windows.Clipboard]::SetText($m[$i].Groups[1].Value); Set-Status "ChatGPT block $(@('A','B')[$i]) copied ($($m[$i].Groups[1].Value.Length) chars)" } }.GetNewClosure()
    [void]$root.Children.Add((New-Card @(
                (New-Text 'AI Toolkit' 15 -Bold), (New-Text 'The MSP AI Kit: prompt packs for ChatGPT, Custom GPTs, Claude, Cursor and Copilot, skill install for Claude Code and Codex, and the upstream MSP kits. Runs in the background; the window stays usable.' -Muted -Wrap),
                (New-Wrap @((New-Button 'Build, install, verify' { & $runLoader 'All' @() }.GetNewClosure() -Primary), (New-Button 'Build packs' { & $runLoader 'Build' @() }.GetNewClosure()), (New-Button 'Install skill' { & $runLoader 'Install' @() }.GetNewClosure()), (New-Button 'Verify' { & $runLoader 'Verify' @() }.GetNewClosure()), (New-Button 'Fetch upstream kits' { & $runLoader 'Upstream' @() }.GetNewClosure()), (New-Button 'Check for update' { & $runLoader 'Update' @('-WhatIf') }.GetNewClosure()), (New-Button 'Clean old logs' { & $runLoader 'Cleanup' @() }.GetNewClosure()))),
                (New-Wrap @((New-Button 'Copy ChatGPT Block A' { & $copy 0 }.GetNewClosure()), (New-Button 'Copy ChatGPT Block B' { & $copy 1 }.GetNewClosure()), (New-Button 'Open packs folder' { if (Test-Path -LiteralPath $packDir) { Start-Process $packDir } else { Set-Status 'Build the packs first.' } }.GetNewClosure()), (New-Button 'Open cheat sheet' { $f = Join-Path $packDir 'cheat-sheet.html'; if (Test-Path -LiteralPath $f) { Start-Process $f } }.GetNewClosure()))),
                $log
            )))
}
function Build-Evidence {
    param($root)
    $status = New-Text $(if ($S.LastBundle) { "Last bundle: $($S.LastBundle.zip) (sha256 $($S.LastBundle.sha256))" } else { 'No bundle exported this session.' }) -Muted -Wrap
    # both run in the background: two headless-Edge PDF renders plus zip and hash (minutes), and a network call
    $export = New-Button 'Export evidence bundle' { if (-not $S.Snapshot) { Set-Status 'Run discovery first.'; return }; Start-DEJob -Label 'Exporting the evidence bundle' -Params @{ snap = $S.Snapshot } -Work { Export-DEEvidenceBundle -Snapshot $JobParams.snap -ClientProfile $JobProfile } -OnDone { param($r) $b = @($r | Where-Object { $_ -and $_.PSObject.Properties['zip'] -or ($_ -is [hashtable] -and $_.ContainsKey('zip')) }) | Select-Object -Last 1; if ($b) { $S.LastBundle = $b; Set-Status "Bundle: $($b.zip)" }; Show-Page 'Evidence' } } -Primary
    $open = New-Button 'Open internal report' { if ($S.LastBundle) { Start-Process (Join-Path $S.LastBundle.folder 'report-internal.html') } }
    $client = New-Button 'Open client report' { if ($S.LastBundle) { Start-Process (Join-Path $S.LastBundle.folder 'report-client.html') } }
    $hub = New-Button 'Send to Intelligence Hub' { if (-not $S.LastBundle) { Set-Status 'Export the bundle first.'; return }; $lb = $S.LastBundle; Start-DEJob -Label 'Sending to the Intelligence Hub' -Params @{ record = $lb.record; sha = $lb.sha256; zip = $lb.zip } -Work { Send-DEHubPayload -Payload (New-DEHubPayload -Record $JobParams.record -BundleSha256 $JobParams.sha -BundlePath $JobParams.zip) -Confirm:$false } -OnDone { param($r) $x = @($r | Where-Object { $_ -is [hashtable] -and $_.ContainsKey('sent') }) | Select-Object -Last 1; Set-Status $(if ($x -and $x.sent) { 'Sent to the Hub.' } elseif ($x) { "Saved for manual upload: $($x.file)" } else { 'Hub send finished; see Evidence.' }); Show-Page 'Evidence' } }
    $bundleCopy = New-Button 'Copy diagnostic bundle' { $txt = "DE Tech Tool $((Get-DEConsole).ConsoleVersion) · $env:COMPUTERNAME · mode $($S.Mode)`r`n" + ((Get-DEGapReport | ForEach-Object { "$($_.result) $($_.id) | $($_.detail) | fix: $($_.fix)" }) -join "`r`n"); [System.Windows.Clipboard]::SetText((Protect-DEText $txt)); Set-Status 'Gap report copied (redacted).' }
    [void]$root.Children.Add((New-Card @((New-Text 'Evidence and handoff' 15 -Bold), (New-Text 'Sanitized JSON, internal and client-safe HTML reports, redacted log, sha256 manifest, zipped and hashed. The Hub gets identity, mapping, state, verification times, exceptions and evidence references; never secrets.' -Muted -Wrap), (New-Wrap @($export, $open, $client, $hub, $bundleCopy)), $status)))
    $gaps = @(Get-DEGapReport)
    $grid = New-El DataGrid @{ Height = 380; Name = 'Gap report' }
    Add-DEGridColumns -Grid $grid -Columns @(@{ h = 'Phase'; b = 'phase'; w = 56 }, @{ h = 'Item'; b = 'title'; w = '2*' }, @{ h = 'State'; b = 'State'; w = 84 }, @{ h = 'Detail'; b = 'detail'; w = '2*' }, @{ h = 'Fix'; b = 'fix'; w = '2.4*' })
    $grid.ItemsSource = @($gaps | ForEach-Object { [pscustomobject]@{ phase = $_.phase; title = $_.title; State = $_.result; detail = $_.detail; fix = $_.fix } })
    [void]$root.Children.Add((New-Card @((New-Text "Gap report ($($gaps.Count) open)" 15 -Bold), $grid)))
    $ex = @(Get-DEExceptions)
    if ($ex.Count) { [void]$root.Children.Add((New-Card @((New-Text 'Active exceptions' 15 -Bold), (New-El TextBlock @{ Text = (($ex | ForEach-Object { "$($_.target): $($_.reason) · approved by $($_.approver) · review $(([datetime]$_.expiresOn).ToString('yyyy-MM-dd'))" }) -join "`n"); Style = 'Mono'; TextWrapping = 'Wrap' })))) }
}
function Build-LicenseCard {
    <# Licence status and the two ways to get one: activate this device with the Hub, or paste a licence from the Hub. #>
    param($root)
    $st = Get-DELicenseStatus; $bi = Get-DEBuildInfo
    $lines = @("Build $($bi.buildId), issued to $($bi.issuedTo)$(if ($bi.builtAt) { ", built $($bi.builtAt)" })", "Policy: $($st.enforce)$(if ($st.enforce -eq 'warn') { ' (runs work but are marked UNLICENSED)' } else { ' (changes need a licence)' })")
    if ($st.valid) { $lines += "Licensed to $($st.technician) until $($st.expires) · clients: $(@($st.clients) -join ', ') · features: $(@($st.features) -join ', ')" } else { $lines += "Not licensed: $($st.reason)" }
    $hubBox = New-El TextBox @{ Width = 360; Text = "$(Get-DEState -Path 'settings.hub.endpoint')"; Name = 'Hub URL for activation' }
    $tokBox = New-El PasswordBox @{ Width = 360; Name = 'Paste a licence' }
    $activate = New-Button 'Activate this device' {
        $hub = $hubBox.Text; if ($hub -notmatch '^https://') { Set-Status 'Enter the Hub URL (https://...).'; return }
        try { $a = Start-DELicenseActivation -HubUrl ([uri]$hub).GetLeftPart([UriPartial]::Authority) } catch { Set-Status "Activation not started: $($_.Exception.Message)"; return }
        [System.Windows.MessageBox]::Show($Win, "Open $($a.verificationUrl) on your phone or PC, sign in with your DE account, and enter:`n`n    $($a.userCode)`n`nDE Tech Tool finishes on its own when you approve.", 'Activate DE Tech Tool') | Out-Null
        Start-DEJob -Label 'Waiting for licence approval in the Hub' -Params @{ hub = ([uri]$hub).GetLeftPart([UriPartial]::Authority); code = $a.deviceCode; interval = $a.interval; ttl = $a.expiresIn } -Work { Complete-DELicenseActivation -HubUrl $JobParams.hub -DeviceCode $JobParams.code -Interval $JobParams.interval -TimeoutSeconds $JobParams.ttl } -OnDone { param($r) try { Import-DEState | Out-Null } catch { }; Update-Header; Show-Page 'Settings' }
    }.GetNewClosure() -Primary
    $paste = New-Button 'Use pasted licence' { $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($tokBox.SecurePassword); try { $t = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }; try { $null = Set-DELicense -Token $t; Set-Status 'Licence accepted.' } catch { Set-Status $_.Exception.Message }; Update-Header; Show-Page 'Settings' }.GetNewClosure()
    $clear = New-Button 'Remove licence' { Clear-DELicense; Update-Header; Show-Page 'Settings' }
    [void]$root.Children.Add((New-Card @((New-Text 'Licence' 15 -Bold), (New-Text 'A DE licence is issued by the Intelligence Hub to one technician for this device, for a few hours. It cannot be copied to another device, and it expires on its own.' -Muted -Wrap), (New-El TextBlock @{ Text = ($lines -join "`n"); Style = 'Mono'; TextWrapping = 'Wrap'; Margin = '0,4,0,8' }), (New-Label 'Hub URL'), $hubBox, (New-Label 'Or paste a licence from the Hub'), $tokBox, (New-Wrap @($activate, $paste, $clear)))))
}
function Build-Settings {
    param($root)
    Build-LicenseCard $root
    $known = @(
        @{ n = 'BREAKGLASS_PASSWORD'; d = 'DE-BreakGlass password (16+ characters)' }, @{ n = 'MIGRATION_TEMP_PASSWORD'; d = 'Temporary password for the new local account (ADMU)' },
        @{ n = 'JC_CONNECT_KEY'; d = 'JumpCloud connect key (agent install)' }, @{ n = 'JC_API_KEY'; d = 'JumpCloud API key (mapping, binding, groups, policies)' }, @{ n = 'JC_ORG_ID'; d = 'JumpCloud org id (multi-tenant admins)' },
        @{ n = 'S1_SITE_TOKEN'; d = 'SentinelOne site token' }, @{ n = 'GUARDZ_ORG_KEY'; d = 'Guardz organization key' }, @{ n = 'WAZUH_REG_PASSWORD'; d = 'Wazuh registration password' }, @{ n = 'DE_HUB_SIGNING_SECRET'; d = 'Intelligence Hub signing secret (signed events)' }, @{ n = 'DE_HUB_TOKEN'; d = 'Intelligence Hub integration token (legacy)' }, @{ n = 'DELL_API_KEY'; d = 'Dell TechDirect API key (warranty)' }, @{ n = 'DELL_API_SECRET'; d = 'Dell TechDirect API secret (warranty)' }
    )
    $sp = New-El StackPanel
    foreach ($k in $known) {
        $row = New-El WrapPanel @{ Margin = '0,2' }
        $pb = New-El PasswordBox @{ Width = 320; Name = $k.d }
        $state = New-El TextBlock @{ Text = $(if (Test-DESecret -Name $k.n) { 'set for this session' } else { 'not set' }); Style = 'Mono'; VerticalAlignment = 'Center'; Margin = '8,0' }
        $name = $k.n
        $set = New-Button 'Set' { if ($pb.SecurePassword.Length -gt 0) { Set-DESecret -Name $name -SecureValue $pb.SecurePassword.Copy(); $pb.Clear(); $state.Text = 'set for this session' } }.GetNewClosure()
        [void]$row.Children.Add((New-El TextBlock @{ Text = $k.d; Width = 380; VerticalAlignment = 'Center' })); [void]$row.Children.Add($pb); [void]$row.Children.Add($set); [void]$row.Children.Add($state)
        [void]$sp.Children.Add($row)
    }
    $clear = New-Button 'Clear all secrets now' { Clear-DESecrets; Show-Page 'Settings' }
    $vaultBox = New-El TextBox @{ Text = $(if ($Settings.ContainsKey('secretVault')) { $Settings.secretVault } else { '' }); Width = 240; Name = 'Secret vault name' }
    $allNames = @($known | ForEach-Object { $_.n })
    $vaultBtn = New-Button 'Load from vault' { if (-not $vaultBox.Text) { Set-Status 'Enter the SecretManagement vault name first.'; return }; $Settings.secretVault = $vaultBox.Text; Save-GuiSettings; try { $v = Get-SecretVault -Name $vaultBox.Text -ErrorAction SilentlyContinue; if ($v -and "$($v.ModuleName)" -match 'SecretStore' -and (Get-Command -Name 'Unlock-SecretStore' -ErrorAction SilentlyContinue)) { $pw = Read-GuiText -Title 'SecretStore' -Prompt "Password for the '$($vaultBox.Text)' SecretStore (a console prompt would be hidden behind this window)" -Secret; if (-not $pw) { return }; Unlock-SecretStore -Password $pw -PasswordTimeout 900 }; $rows = Import-DESecretsFromVault -Vault $vaultBox.Text -Names $allNames; Set-Status ('Vault: ' + (($rows | ForEach-Object { "$($_.name) $($_.status)" }) -join ', ')); Show-Page 'Settings' } catch { Set-Status $_.Exception.Message } }.GetNewClosure()
    $vaultRow = New-Wrap @((New-Label 'Approved secret vault (PowerShell SecretManagement)'), $vaultBox, $vaultBtn)
    [void]$root.Children.Add((New-Card @((New-Text 'Runtime secrets' 15 -Bold), (New-Text 'Held in memory as SecureString for this session only. Never written to state, logs, receipts, profiles or Hub payloads; anything that looks like one is redacted on screen. Cleared when the console closes.' -Muted -Wrap), $sp, $vaultRow, $clear)))
    $hubBox = New-El TextBox @{ Text = $Settings.hubEndpoint; Width = 520; Name = 'Hub endpoint' }
    $dry = New-El CheckBox @{ Content = 'Dry run (every action plans, nothing changes)'; IsChecked = [bool]$Settings.dryRun }
    $save = New-Button 'Save settings' { $Settings.hubEndpoint = $hubBox.Text; $Settings.dryRun = [bool]$dry.IsChecked; Save-GuiSettings; Set-DEStateValue -Path 'settings.hub.endpoint' -Value $hubBox.Text; Set-DEMode -Mode $(if ($dry.IsChecked) { 'Audit' } else { 'Apply' }) -DryRun:([bool]$dry.IsChecked); Update-Header; Set-Status 'Settings saved.' }.GetNewClosure() -Primary
    [void]$root.Children.Add((New-Card @((New-Text 'Console settings' 15 -Bold), (New-Label 'Intelligence Hub device endpoint (HTTPS)'), $hubBox, $dry, $save, (New-Text "Data folder: $((Get-DEConsole).Dirs.Base)" -Muted), (New-Button 'Open data folder' { Start-Process (Get-DEConsole).Dirs.Base }))))

    # Go-live wiring belongs in the tool instead of a forgotten chat transcript.
    $hubAccount = $(if ($S.Profile) { "$(Get-DEHashPath -Object $S.Profile -Path 'hub.accountId')" } else { '' })
    $hubAccountBox = New-El TextBox @{ Text = $hubAccount; Width = 180; Name = 'Intelligence Hub account number' }
    $saveHubAccount = New-Button 'Save Hub account to client profile' {
        if (-not $S.Profile) { Set-Status 'Select a client profile first.'; return }
        $acct = "$($hubAccountBox.Text)".Trim()
        if ($acct -and $acct -notmatch '^[1-9]\d*$') { Set-Status 'Hub account number must be a positive whole number.'; return }
        try {
            $base = ConvertTo-DEHashtable (Get-DEClientProfile -Id $S.Profile.id)
            if (-not $base.ContainsKey('hub') -or -not $base['hub']) { $base['hub'] = @{} }
            $base['hub']['accountId'] = $acct
            $f = Save-DEClientProfile -Profile $base
            $S.Profile = ConvertTo-DEHashtable $base
            Set-DEContext -Values @{ hubAccountId = $acct }
            Set-Status "Hub account $acct saved to $f"
        } catch { Set-Status $_.Exception.Message }
    }.GetNewClosure()

    $certs = @()
    foreach ($store in @('Cert:\CurrentUser\My', 'Cert:\LocalMachine\My')) {
        try { $certs += @(Get-ChildItem -Path $store -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.NotAfter -gt (Get-Date) -and $_.HasPrivateKey }) } catch { }
    }
    $certStatus = $(if ($certs.Count -eq 1) { "READY: $($certs[0].Subject) · expires $($certs[0].NotAfter.ToString('yyyy-MM-dd'))" } elseif ($certs.Count -gt 1) { "ACTION: $($certs.Count) valid code-signing certificates found; choose the release certificate thumbprint." } else { 'ACTION: no valid code-signing certificate with a private key found in CurrentUser or LocalMachine.' })
    $hubSecretStatus = $(if (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET') { 'READY: Hub signing secret is loaded for this session.' } else { 'ACTION: set DE_HUB_SIGNING_SECRET here. The server value is TECHCONSOLE_TO_HUB_SECRET and must match.' })
    $hubAccountStatus = $(if ($hubAccount -match '^[1-9]\d*$') { "READY: Hub account $hubAccount" } else { 'ACTION: save the client Intelligence Hub account number below.' })
    $signScript = Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'packaging\Sign-DETechConsole.ps1'
    $thumb = $(if ($certs.Count -eq 1) { $certs[0].Thumbprint } else { '<CERT_THUMBPRINT>' })
    $copyDeploy = New-Button 'Copy Hub deploy check' { [System.Windows.Clipboard]::SetText("ssh de-vps 'sudo cat /opt/intelligence-hub/current/RELEASE_SHA'"); Set-Status 'Hub RELEASE_SHA check copied. Expected release starts c622160e.' }
    $copySign = New-Button 'Copy signing command' { [System.Windows.Clipboard]::SetText("& '$signScript' -Thumbprint $thumb"); Set-Status 'Signing command copied.' }.GetNewClosure()
    $copyVerify = New-Button 'Copy signature verification' { [System.Windows.Clipboard]::SetText("& '$signScript' -Verify -RequireSignature"); Set-Status 'Signature verification command copied.' }.GetNewClosure()
    $checkText = "1. Hub deployment · expected RELEASE_SHA c622160e…" + [Environment]::NewLine +
        "2. Hub shared secret · $hubSecretStatus" + [Environment]::NewLine +
        "3. Client Hub account · $hubAccountStatus" + [Environment]::NewLine +
        "4. Code signing · $certStatus" + [Environment]::NewLine +
        "5. Verify signed package before client deployment"
    $goLive = @(
        (New-Text 'Go-live checklist' 15 -Bold),
        (New-Text 'These are the release steps for the installed DE Tech Tool and Intelligence Hub. Secrets stay runtime-only; the account number is non-secret client metadata.' -Muted -Wrap),
        (New-El TextBlock @{ Text = $checkText; Style = 'Mono'; TextWrapping = 'Wrap'; Margin = '0,6,0,8' }),
        (New-Wrap @((New-Label 'Hub account number'), $hubAccountBox, $saveHubAccount)),
        (New-Wrap @($copyDeploy, $copySign, $copyVerify)),
        (New-Text 'Signing uses packaging\Sign-DETechConsole.ps1 with SHA-256 Authenticode plus a timestamp. The certificate private key stays in the Windows certificate store. The Hub secret must be configured as TECHCONSOLE_TO_HUB_SECRET on the server and entered here as DE_HUB_SIGNING_SECRET.' -Muted -Wrap)
    )
    [void]$root.Children.Add((New-Card $goLive))

    $profileBtn = New-Button 'New client profile from template' { $id = Read-GuiText 'New profile' 'Profile id (lowercase, hyphens):'; if ($id) { $p = New-DEClientProfileTemplate -Id $id -Name $id; try { $f = Save-DEClientProfile -Profile $p; Start-Process notepad.exe $f } catch { Set-Status $_.Exception.Message } } }
    [void]$root.Children.Add((New-Card @((New-Text 'Client profiles' 15 -Bold), (New-Text 'Profiles hold tier, stack roles, apps, branding, sites, vendor tenant ids and detection rules. Saving one that contains a secret is refused.' -Muted -Wrap), $profileBtn)))
}

$Integrity = Write-DEIntegrityEvidence

# ============================================================== smoke test
if ($SmokeTest) {
    # Builds every page against a real client profile without a message loop or a visible window, then renders
    # each page at 96 and 192 DPI (100 and 200 percent) so layout faults and high-DPI clipping show up in CI.
    Set-DEMode -Mode Audit -DryRun
    if (-not $SmokeOut) { $SmokeOut = Join-Path (Get-DEConsole).Dirs.Base 'smoke' }
    New-Item -ItemType Directory -Path $SmokeOut -Force | Out-Null
    $failed = @()
    # Drive the same background-job path the buttons use (runspace, EndInvoke, OnDone) and fail on any job error.
    function Wait-SmokeJob {
        param([string]$Name)
        $deadline = (Get-Date).AddMinutes(8)
        while ($S.Job -and -not $S.Job.handle.IsCompleted -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if ($S.Job -and -not $S.Job.handle.IsCompleted) { return "${Name}: timed out" }
        if ($S.Job) { Update-DEJob }
        if ($S.LastJobError) { return "${Name}: $($S.LastJobError)" }
        return $null
    }
    try {
        $S.Mode = 'takeover'; $Settings.technician = $(if ($Technician) { $Technician } else { 'jrpetro' })
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician
        if ($S.LastJobError) { $failed += "use client and mode: $($S.LastJobError)" }
        if (-not @(Get-DEActions -Mode 'takeover').Count) { $failed += 'use client and mode: no plan was built' } else { Write-Host 'SMOKE PASS use client and mode' }
        # A failing button must report, not throw.
        Invoke-GuiSafely -Label 'smoke' -Action { throw 'handler error on purpose' }
        if ($S.LastJobError -notmatch 'on purpose') { $failed += 'button error guard did not report' } else { Write-Host 'SMOKE PASS button error guard'; $S.LastJobError = $null }
        Invoke-Discovery -Quick
        $e = Wait-SmokeJob 'discovery job'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS discovery job' }
        if (-not $S.Snapshot) { $failed += 'discovery job: no snapshot came back' }
        if (-not @(Get-DEActions).Count) { $failed += 'discovery job: no workflow actions registered' }
        Start-DEJob -Label 'Full audit' -Work { $null = Invoke-DEAudit -Mode $JobMode }
        $e = Wait-SmokeJob 'audit job'; if ($e) { $failed += $e } else { Write-Host ("SMOKE PASS audit job ({0} evidence rows)" -f @(Get-DEEvidence).Count) }
        # Scan & fix: the list builds from the runbook, rows and checkboxes exist, and a ticked batch runs through the job path
        $S.ScanDone = $true; Select-DEScanDefaults; Show-Page 'Scan'
        if (-not @($S.RowBorders.Keys).Count) { $failed += 'scan page: no rows' } else { Write-Host ("SMOKE PASS scan page ({0} rows, {1} pre-ticked)" -f @($S.RowBorders.Keys).Count, @($S.Selected.Keys).Count) }
        $S.Selected = @{}; foreach ($i in @(@($S.RowBorders.Keys) | Select-Object -First 2)) { $S.Selected[$i] = $true }
        Invoke-DEScanBatch -How Audit
        $e = Wait-SmokeJob 'scan batch'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS scan batch (check selected)' }
        $S.Focus = @($S.RowBorders.Keys)[0]; Update-ScanDetail; if (-not $S.DetailHost.Content) { $failed += 'scan detail panel empty' } else { Write-Host 'SMOKE PASS scan detail panel' }
        # the plan picker: a standalone solution loads as not DE managed, then a ProActive tier for the page renders
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'new' -Technician $Settings.technician -Solution @('identity_access')
        if ($S.Profile.plan.managed -ne $false -or -not @(Get-DEActions -Mode 'new').Count) { $failed += 'standalone plan did not load' } else { Write-Host 'SMOKE PASS standalone plan' }
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician -Bundle 'proactive-business'
        if ("$($S.Profile.plan.bundle)" -ne 'proactive-business') { $failed += 'ProActive plan did not load' } else { Write-Host 'SMOKE PASS ProActive plan' }
        $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile; if (-not $rec.mode) { $failed += 'no recommended mode' } else { Write-Host "SMOKE PASS recommended mode $($rec.mode)" }
        # Email migration: a mid-project fixture (no tenant needed), a real scan of this account, and the next step
        if (Import-DEMsAdmin) {
            $migDir = Join-Path $SmokeOut 'migrations'; New-Item -ItemType Directory -Path $migDir -Force | Out-Null; $null = Set-DEMigrationDirectory -Path $migDir
            $now = (Get-Date).ToUniversalTime()
            $chk = [pscustomobject]@{}; foreach ($c in @('Inbound mail', 'Outbound mail', 'Replies', 'Attachments', 'Folders', 'Contacts', 'Calendar', 'MFA', 'Outlook desktop', 'Outlook mobile', 'Shared mailbox', 'DNS and forwarding', 'Bounce diagnostic')) { $chk | Add-Member -NotePropertyName $c -NotePropertyValue ([pscustomobject]@{ status = 'Pending'; detail = ''; by = ''; at = $now.ToString('o') }) }
            $chk.'Shared mailbox' = [pscustomobject]@{ status = 'Pass'; detail = 'office@ : 4 members with Full Access and Send As, sign-in blocked'; by = 'smoke'; at = $now.ToString('o') }
            $chk.'Bounce diagnostic' = [pscustomobject]@{ status = 'Fail'; detail = '1 open bounce finding(s); latest: RetryingClient for helen.x@gmail.com'; by = 'smoke'; at = $now.ToString('o') }
            $fx = [pscustomobject][ordered]@{
                schema = 'de.email-migration.project/v1'; projectId = 'smoke-mail'; client = 'Alamo Industries'; tenantId = '00000000-0000-0000-0000-000000000000'; targetDomain = 'alamo-industries.com'
                sourceType = 'PersonalGmail'; mailPath = 'IMAP'; stage = 'Pilot'; requestedBy = 'smoke'; createdAt = $now.AddDays(-3).ToString('o'); updatedAt = $now.ToString('o')
                users = @(
                    [pscustomobject][ordered]@{ source = 'suzette.x@gmail.com'; destination = 'suzette@alamo-industries.com'; displayName = 'Suzette'; userId = '1'; sourceType = 'PersonalGmail'; devices = @('FRONTDESK'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..14 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 18211; storageKB = 5242880 }; batch = 'smoke-mail-pilot'; migration = [pscustomobject]@{ destination = 'suzette@alamo-industries.com'; status = 'Synced'; synced = 18190; skipped = 21; error = '' }; contacts = $null; calendar = $null; mfa = [pscustomobject]@{ registered = $true } }
                    [pscustomobject][ordered]@{ source = 'helen.x@gmail.com'; destination = 'helen@alamo-industries.com'; displayName = 'Helen'; userId = '2'; sourceType = 'PersonalGmail'; devices = @('HELENU'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..9 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 40377; storageKB = 9437184 }; batch = $null; migration = $null; contacts = $null; calendar = $null; mfa = $null }
                )
                sharedMailboxes = @([pscustomobject]@{ address = 'office@alamo-industries.com'; members = @('norma@alamo-industries.com', 'helen@alamo-industries.com', 'suzette@alamo-industries.com', 'mike@alamo-industries.com'); verified = $true; problems = @(); checkedAt = $now.ToString('o') })
                devices = @('FRONTDESK', 'HELENU'); batches = @([pscustomobject]@{ name = 'smoke-mail-pilot'; type = 'Pilot'; users = @('suzette@alamo-industries.com'); status = 'Synced'; startedAt = $now.AddDays(-1).ToString('o'); completedAt = $null; confirmedBy = $null; confirmedAt = $null; failed = 0 })
                dns = $null; bounce = @([pscustomobject]@{ id = 'b1'; file = 'bounce.eml'; cause = 'RetryingClient'; why = 'the original is 4 days older than the bounce: a device or app keeps retrying it'; bouncedRecipient = 'helen.x@gmail.com'; smtpStatus = '5.1.1'; meaning = 'the address does not exist'; matchedDevices = @('HELENU'); sendingClient = 'Microsoft Outlook 16.0'; fix = 'remove the Gmail account from Outlook on HELENU'; resolved = $false; resolution = $null; resolvedBy = $null })
                verification = $chk; signoff = $null; events = @()
            }
            [IO.File]::WriteAllText((Join-Path $migDir 'smoke-mail.json'), ($fx | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
            $S.MigrationProject = 'smoke-mail'
            $scan = Get-DEMailClientInventory -ProjectId 'smoke-mail'
            $S.MigrationScan = [pscustomobject]@{ migrationScan = $scan; file = (Join-Path $migDir 'scan.json') }
            $nx = Get-DEMigrationNextStep -ProjectId 'smoke-mail'
            if ($nx.step -notlike 'Confirm the pilot*') { $failed += "migration next step: '$($nx.step)'" } else { Write-Host "SMOKE PASS migration next step ($($nx.step)); scan: $($scan.message)" }
        } else { $failed += 'DE Microsoft Admin did not load' }
    } catch { $failed += "setup: $($_.Exception.Message)" }
    # Two layouts: the design size, and a 1366x768 laptop at 125 % scaling (1093x582 device-independent units less the
    # taskbar, rendered at 120 dpi). At the small size the footer (status and Cancel) must stay inside the window.
    $layouts = @(@{ tag = '96dpi'; w = 1440; h = 900; dpi = 96 }, @{ tag = 'small-120dpi'; w = 1093; h = 552; dpi = 120 })
    foreach ($name in @($Pages.Keys | Where-Object { $null -ne $_ })) {
        try {
            Show-Page $name
            if ($S.CurrentPage -ne $name -or -not $UI.PageHost.Content) { throw 'page did not load' }
            foreach ($l in $layouts) {
                $w = $l.w; $h = $l.h
                $Win.Content.Measure((New-Object System.Windows.Size($w, $h))); $Win.Content.Arrange((New-Object System.Windows.Rect(0, 0, $w, $h))); $Win.Content.UpdateLayout()
                if ($l.tag -like 'small*') {
                    foreach ($el in @($UI.TxtStatus, $UI.BtnCancel)) {
                        if (-not $el -or -not $el.IsVisible) { continue }
                        $pt = $el.TranslatePoint((New-Object System.Windows.Point(0, 0)), $Win.Content)
                        if ($pt.Y + $el.ActualHeight -gt $h + 1 -or $pt.X + $el.ActualWidth -gt $w + 1) { throw "$($el.Name) is off-screen at $w x $h" }
                    }
                }
                $scale = $l.dpi / 96
                $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap([int]($w * $scale), [int]($h * $scale), $l.dpi, $l.dpi, [System.Windows.Media.PixelFormats]::Pbgra32)
                $bmp.Render($Win.Content)
                $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
                $fs = [IO.File]::Create((Join-Path $SmokeOut ("{0}-{1}.png" -f $name, $l.tag))); try { $enc.Save($fs) } finally { $fs.Dispose() }
            }
            Write-Host ("SMOKE PASS {0}" -f $name)
        } catch { $failed += "${name}: $($_.Exception.Message)"; Write-Host ("SMOKE FAIL {0}: {1}" -f $name, $_.Exception.Message) }
    }
    Clear-DESecrets
    Write-Host ("SMOKE {0}: {1} page(s), {2} failure(s); renders in {3}" -f $(if ($failed.Count) { 'FAIL' } else { 'PASS' }), @($Pages.Keys).Count, $failed.Count, $SmokeOut)
    $failed | ForEach-Object { Write-Host "  $_" }
    exit $(if ($failed.Count) { 1 } else { 0 })
}

# ============================================================== start
if ($Settings.dryRun) { Set-DEMode -Mode Audit -DryRun } else { Set-DEMode -Mode Apply }
$Win.Add_Closed({ Clear-DESecrets; Save-GuiSettings })
# Last line of defence: anything that still escapes a handler is reported, never allowed to close the console.
$Win.Dispatcher.Add_UnhandledException({
    param($src, $e)
    $e.Handled = $true
    $msg = "Unexpected error: $($e.Exception.Message)"
    try { Write-DELog -Level FAIL -Message $msg } catch { }
    try { Set-Status $msg } catch { }
})
$Win.Add_ContentRendered({
    if (-not $Settings.technician -and -not $SmokeTest) {
        # first time on this machine: ask who is running the tool, once; evidence and the Hub record name this person
        $t = Read-GuiText 'Technician' 'Who is running DE Tech Tool on this machine? Evidence and the Hub record name this person.' -Default 'jrpetro'
        $Settings.technician = $(if ("$t".Trim()) { "$t".Trim() } else { 'jrpetro' }); Save-GuiSettings; Set-DEStateValue -Path 'settings.technician' -Value $Settings.technician
    }
    if (-not $Settings.technician) { $Settings.technician = 'jrpetro' }
    if ($Settings.client) { try { $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $Settings.client) -Bundle "$(Get-DEHashPath -Object $Settings -Path 'planBundle')" -Solution @(Get-DEHashPath -Object $Settings -Path 'planSolutions' | Where-Object { $_ }) } catch { } }
    if ($Resume) { $r = Resume-DEWorkflow; Set-Status "Resumed after restart. Next: $(Get-DEHashPath -Object $r -Path 'nextAction')"; $S.CurrentPage = 'Scan' }
    Show-Page $S.CurrentPage
    if ($Integrity.status -eq 'tampered') { Set-Status ('WARNING: console files changed after packaging; do not run changes from this copy. ' + (@($Integrity.problems | Select-Object -First 3) -join '; ')) }
    elseif ($Integrity.status -eq 'unsigned') { Set-Status 'Unsigned development build. Use the signed release for client work.' }
    if ($S.Profile) { $S.ModeChosen = [bool]$Resume }   # a resumed job keeps its mode; a fresh start follows what the scan recommends
    Start-DEScan   # every category is scanned on launch; nothing changes until the technician ticks items and goes live
})
$null = $Win.ShowDialog()
) { Set-Status 'Hub account number must be a positive whole number.'; return }
        try {
            $base = ConvertTo-DEHashtable (Get-DEClientProfile -Id $S.Profile.id); if (-not $base.ContainsKey('hub') -or -not $base['hub']) { $base['hub'] = @{} }; $base['hub']['accountId'] = $acct
            $f = Save-DEClientProfile -Profile $base; $S.Profile = ConvertTo-DEHashtable $base; Set-DEContext -Values @{ hubAccountId = $acct }; Set-Status "Hub account $acct saved to $f"
        } catch { Set-Status $_.Exception.Message }
    }.GetNewClosure()
    $certs = @(); foreach ($store in @('Cert:\\CurrentUser\\My', 'Cert:\\LocalMachine\\My')) { try { $certs += @(Get-ChildItem -Path $store -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.NotAfter -gt (Get-Date) -and $_.HasPrivateKey }) } catch { } }
    $certStatus = $(if ($certs.Count -eq 1) { "READY: $($certs[0].Subject) · expires $($certs[0].NotAfter.ToString('yyyy-MM-dd'))" } elseif ($certs.Count -gt 1) { "ACTION: $($certs.Count) valid code-signing certificates found; choose the release certificate thumbprint." } else { 'ACTION: no valid code-signing certificate with a private key found in CurrentUser or LocalMachine.' })
    $hubSecretStatus = $(if (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET') { 'READY: Hub signing secret is loaded for this session.' } else { 'ACTION: set DE_HUB_SIGNING_SECRET here. The server value is TECHCONSOLE_TO_HUB_SECRET and must match.' })
    $hubAccountStatus = $(if ($hubAccount -match '^[1-9]\\d* { $id = Read-GuiText 'New profile' 'Profile id (lowercase, hyphens):'; if ($id) { $p = New-DEClientProfileTemplate -Id $id -Name $id; try { $f = Save-DEClientProfile -Profile $p; Start-Process notepad.exe $f } catch { Set-Status $_.Exception.Message } } }
    [void]$root.Children.Add((New-Card @((New-Text 'Client profiles' 15 -Bold), (New-Text 'Profiles hold tier, stack roles, apps, branding, sites, vendor tenant ids and detection rules. Saving one that contains a secret is refused.' -Muted -Wrap), $profileBtn)))
}

$Integrity = Write-DEIntegrityEvidence

# ============================================================== smoke test
if ($SmokeTest) {
    # Builds every page against a real client profile without a message loop or a visible window, then renders
    # each page at 96 and 192 DPI (100 and 200 percent) so layout faults and high-DPI clipping show up in CI.
    Set-DEMode -Mode Audit -DryRun
    if (-not $SmokeOut) { $SmokeOut = Join-Path (Get-DEConsole).Dirs.Base 'smoke' }
    New-Item -ItemType Directory -Path $SmokeOut -Force | Out-Null
    $failed = @()
    # Drive the same background-job path the buttons use (runspace, EndInvoke, OnDone) and fail on any job error.
    function Wait-SmokeJob {
        param([string]$Name)
        $deadline = (Get-Date).AddMinutes(8)
        while ($S.Job -and -not $S.Job.handle.IsCompleted -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if ($S.Job -and -not $S.Job.handle.IsCompleted) { return "${Name}: timed out" }
        if ($S.Job) { Update-DEJob }
        if ($S.LastJobError) { return "${Name}: $($S.LastJobError)" }
        return $null
    }
    try {
        $S.Mode = 'takeover'; $Settings.technician = $(if ($Technician) { $Technician } else { 'jrpetro' })
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician
        if ($S.LastJobError) { $failed += "use client and mode: $($S.LastJobError)" }
        if (-not @(Get-DEActions -Mode 'takeover').Count) { $failed += 'use client and mode: no plan was built' } else { Write-Host 'SMOKE PASS use client and mode' }
        # A failing button must report, not throw.
        Invoke-GuiSafely -Label 'smoke' -Action { throw 'handler error on purpose' }
        if ($S.LastJobError -notmatch 'on purpose') { $failed += 'button error guard did not report' } else { Write-Host 'SMOKE PASS button error guard'; $S.LastJobError = $null }
        Invoke-Discovery -Quick
        $e = Wait-SmokeJob 'discovery job'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS discovery job' }
        if (-not $S.Snapshot) { $failed += 'discovery job: no snapshot came back' }
        if (-not @(Get-DEActions).Count) { $failed += 'discovery job: no workflow actions registered' }
        Start-DEJob -Label 'Full audit' -Work { $null = Invoke-DEAudit -Mode $JobMode }
        $e = Wait-SmokeJob 'audit job'; if ($e) { $failed += $e } else { Write-Host ("SMOKE PASS audit job ({0} evidence rows)" -f @(Get-DEEvidence).Count) }
        # Scan & fix: the list builds from the runbook, rows and checkboxes exist, and a ticked batch runs through the job path
        $S.ScanDone = $true; Select-DEScanDefaults; Show-Page 'Scan'
        if (-not @($S.RowBorders.Keys).Count) { $failed += 'scan page: no rows' } else { Write-Host ("SMOKE PASS scan page ({0} rows, {1} pre-ticked)" -f @($S.RowBorders.Keys).Count, @($S.Selected.Keys).Count) }
        $S.Selected = @{}; foreach ($i in @(@($S.RowBorders.Keys) | Select-Object -First 2)) { $S.Selected[$i] = $true }
        Invoke-DEScanBatch -How Audit
        $e = Wait-SmokeJob 'scan batch'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS scan batch (check selected)' }
        $S.Focus = @($S.RowBorders.Keys)[0]; Update-ScanDetail; if (-not $S.DetailHost.Content) { $failed += 'scan detail panel empty' } else { Write-Host 'SMOKE PASS scan detail panel' }
        # the plan picker: a standalone solution loads as not DE managed, then a ProActive tier for the page renders
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'new' -Technician $Settings.technician -Solution @('identity_access')
        if ($S.Profile.plan.managed -ne $false -or -not @(Get-DEActions -Mode 'new').Count) { $failed += 'standalone plan did not load' } else { Write-Host 'SMOKE PASS standalone plan' }
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician -Bundle 'proactive-business'
        if ("$($S.Profile.plan.bundle)" -ne 'proactive-business') { $failed += 'ProActive plan did not load' } else { Write-Host 'SMOKE PASS ProActive plan' }
        $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile; if (-not $rec.mode) { $failed += 'no recommended mode' } else { Write-Host "SMOKE PASS recommended mode $($rec.mode)" }
        # Email migration: a mid-project fixture (no tenant needed), a real scan of this account, and the next step
        if (Import-DEMsAdmin) {
            $migDir = Join-Path $SmokeOut 'migrations'; New-Item -ItemType Directory -Path $migDir -Force | Out-Null; $null = Set-DEMigrationDirectory -Path $migDir
            $now = (Get-Date).ToUniversalTime()
            $chk = [pscustomobject]@{}; foreach ($c in @('Inbound mail', 'Outbound mail', 'Replies', 'Attachments', 'Folders', 'Contacts', 'Calendar', 'MFA', 'Outlook desktop', 'Outlook mobile', 'Shared mailbox', 'DNS and forwarding', 'Bounce diagnostic')) { $chk | Add-Member -NotePropertyName $c -NotePropertyValue ([pscustomobject]@{ status = 'Pending'; detail = ''; by = ''; at = $now.ToString('o') }) }
            $chk.'Shared mailbox' = [pscustomobject]@{ status = 'Pass'; detail = 'office@ : 4 members with Full Access and Send As, sign-in blocked'; by = 'smoke'; at = $now.ToString('o') }
            $chk.'Bounce diagnostic' = [pscustomobject]@{ status = 'Fail'; detail = '1 open bounce finding(s); latest: RetryingClient for helen.x@gmail.com'; by = 'smoke'; at = $now.ToString('o') }
            $fx = [pscustomobject][ordered]@{
                schema = 'de.email-migration.project/v1'; projectId = 'smoke-mail'; client = 'Alamo Industries'; tenantId = '00000000-0000-0000-0000-000000000000'; targetDomain = 'alamo-industries.com'
                sourceType = 'PersonalGmail'; mailPath = 'IMAP'; stage = 'Pilot'; requestedBy = 'smoke'; createdAt = $now.AddDays(-3).ToString('o'); updatedAt = $now.ToString('o')
                users = @(
                    [pscustomobject][ordered]@{ source = 'suzette.x@gmail.com'; destination = 'suzette@alamo-industries.com'; displayName = 'Suzette'; userId = '1'; sourceType = 'PersonalGmail'; devices = @('FRONTDESK'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..14 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 18211; storageKB = 5242880 }; batch = 'smoke-mail-pilot'; migration = [pscustomobject]@{ destination = 'suzette@alamo-industries.com'; status = 'Synced'; synced = 18190; skipped = 21; error = '' }; contacts = $null; calendar = $null; mfa = [pscustomobject]@{ registered = $true } }
                    [pscustomobject][ordered]@{ source = 'helen.x@gmail.com'; destination = 'helen@alamo-industries.com'; displayName = 'Helen'; userId = '2'; sourceType = 'PersonalGmail'; devices = @('HELENU'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..9 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 40377; storageKB = 9437184 }; batch = $null; migration = $null; contacts = $null; calendar = $null; mfa = $null }
                )
                sharedMailboxes = @([pscustomobject]@{ address = 'office@alamo-industries.com'; members = @('norma@alamo-industries.com', 'helen@alamo-industries.com', 'suzette@alamo-industries.com', 'mike@alamo-industries.com'); verified = $true; problems = @(); checkedAt = $now.ToString('o') })
                devices = @('FRONTDESK', 'HELENU'); batches = @([pscustomobject]@{ name = 'smoke-mail-pilot'; type = 'Pilot'; users = @('suzette@alamo-industries.com'); status = 'Synced'; startedAt = $now.AddDays(-1).ToString('o'); completedAt = $null; confirmedBy = $null; confirmedAt = $null; failed = 0 })
                dns = $null; bounce = @([pscustomobject]@{ id = 'b1'; file = 'bounce.eml'; cause = 'RetryingClient'; why = 'the original is 4 days older than the bounce: a device or app keeps retrying it'; bouncedRecipient = 'helen.x@gmail.com'; smtpStatus = '5.1.1'; meaning = 'the address does not exist'; matchedDevices = @('HELENU'); sendingClient = 'Microsoft Outlook 16.0'; fix = 'remove the Gmail account from Outlook on HELENU'; resolved = $false; resolution = $null; resolvedBy = $null })
                verification = $chk; signoff = $null; events = @()
            }
            [IO.File]::WriteAllText((Join-Path $migDir 'smoke-mail.json'), ($fx | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
            $S.MigrationProject = 'smoke-mail'
            $scan = Get-DEMailClientInventory -ProjectId 'smoke-mail'
            $S.MigrationScan = [pscustomobject]@{ migrationScan = $scan; file = (Join-Path $migDir 'scan.json') }
            $nx = Get-DEMigrationNextStep -ProjectId 'smoke-mail'
            if ($nx.step -notlike 'Confirm the pilot*') { $failed += "migration next step: '$($nx.step)'" } else { Write-Host "SMOKE PASS migration next step ($($nx.step)); scan: $($scan.message)" }
        } else { $failed += 'DE Microsoft Admin did not load' }
    } catch { $failed += "setup: $($_.Exception.Message)" }
    # Two layouts: the design size, and a 1366x768 laptop at 125 % scaling (1093x582 device-independent units less the
    # taskbar, rendered at 120 dpi). At the small size the footer (status and Cancel) must stay inside the window.
    $layouts = @(@{ tag = '96dpi'; w = 1440; h = 900; dpi = 96 }, @{ tag = 'small-120dpi'; w = 1093; h = 552; dpi = 120 })
    foreach ($name in @($Pages.Keys | Where-Object { $null -ne $_ })) {
        try {
            Show-Page $name
            if ($S.CurrentPage -ne $name -or -not $UI.PageHost.Content) { throw 'page did not load' }
            foreach ($l in $layouts) {
                $w = $l.w; $h = $l.h
                $Win.Content.Measure((New-Object System.Windows.Size($w, $h))); $Win.Content.Arrange((New-Object System.Windows.Rect(0, 0, $w, $h))); $Win.Content.UpdateLayout()
                if ($l.tag -like 'small*') {
                    foreach ($el in @($UI.TxtStatus, $UI.BtnCancel)) {
                        if (-not $el -or -not $el.IsVisible) { continue }
                        $pt = $el.TranslatePoint((New-Object System.Windows.Point(0, 0)), $Win.Content)
                        if ($pt.Y + $el.ActualHeight -gt $h + 1 -or $pt.X + $el.ActualWidth -gt $w + 1) { throw "$($el.Name) is off-screen at $w x $h" }
                    }
                }
                $scale = $l.dpi / 96
                $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap([int]($w * $scale), [int]($h * $scale), $l.dpi, $l.dpi, [System.Windows.Media.PixelFormats]::Pbgra32)
                $bmp.Render($Win.Content)
                $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
                $fs = [IO.File]::Create((Join-Path $SmokeOut ("{0}-{1}.png" -f $name, $l.tag))); try { $enc.Save($fs) } finally { $fs.Dispose() }
            }
            Write-Host ("SMOKE PASS {0}" -f $name)
        } catch { $failed += "${name}: $($_.Exception.Message)"; Write-Host ("SMOKE FAIL {0}: {1}" -f $name, $_.Exception.Message) }
    }
    Clear-DESecrets
    Write-Host ("SMOKE {0}: {1} page(s), {2} failure(s); renders in {3}" -f $(if ($failed.Count) { 'FAIL' } else { 'PASS' }), @($Pages.Keys).Count, $failed.Count, $SmokeOut)
    $failed | ForEach-Object { Write-Host "  $_" }
    exit $(if ($failed.Count) { 1 } else { 0 })
}

# ============================================================== start
if ($Settings.dryRun) { Set-DEMode -Mode Audit -DryRun } else { Set-DEMode -Mode Apply }
$Win.Add_Closed({ Clear-DESecrets; Save-GuiSettings })
# Last line of defence: anything that still escapes a handler is reported, never allowed to close the console.
$Win.Dispatcher.Add_UnhandledException({
    param($src, $e)
    $e.Handled = $true
    $msg = "Unexpected error: $($e.Exception.Message)"
    try { Write-DELog -Level FAIL -Message $msg } catch { }
    try { Set-Status $msg } catch { }
})
$Win.Add_ContentRendered({
    if (-not $Settings.technician -and -not $SmokeTest) {
        # first time on this machine: ask who is running the tool, once; evidence and the Hub record name this person
        $t = Read-GuiText 'Technician' 'Who is running DE Tech Tool on this machine? Evidence and the Hub record name this person.' -Default 'jrpetro'
        $Settings.technician = $(if ("$t".Trim()) { "$t".Trim() } else { 'jrpetro' }); Save-GuiSettings; Set-DEStateValue -Path 'settings.technician' -Value $Settings.technician
    }
    if (-not $Settings.technician) { $Settings.technician = 'jrpetro' }
    if ($Settings.client) { try { $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $Settings.client) -Bundle "$(Get-DEHashPath -Object $Settings -Path 'planBundle')" -Solution @(Get-DEHashPath -Object $Settings -Path 'planSolutions' | Where-Object { $_ }) } catch { } }
    if ($Resume) { $r = Resume-DEWorkflow; Set-Status "Resumed after restart. Next: $(Get-DEHashPath -Object $r -Path 'nextAction')"; $S.CurrentPage = 'Scan' }
    Show-Page $S.CurrentPage
    if ($Integrity.status -eq 'tampered') { Set-Status ('WARNING: console files changed after packaging; do not run changes from this copy. ' + (@($Integrity.problems | Select-Object -First 3) -join '; ')) }
    elseif ($Integrity.status -eq 'unsigned') { Set-Status 'Unsigned development build. Use the signed release for client work.' }
    if ($S.Profile) { $S.ModeChosen = [bool]$Resume }   # a resumed job keeps its mode; a fresh start follows what the scan recommends
    Start-DEScan   # every category is scanned on launch; nothing changes until the technician ticks items and goes live
})
$null = $Win.ShowDialog()
) { "READY: Hub account $hubAccount" } else { 'ACTION: save the client Intelligence Hub account number below.' })
    $signScript = Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'packaging\\Sign-DETechConsole.ps1'
    $thumb = $(if ($certs.Count -eq 1) { $certs[0].Thumbprint } else { '<CERT_THUMBPRINT>' })
    $copyDeploy = New-Button 'Copy Hub deploy check' { [System.Windows.Clipboard]::SetText("ssh de-vps 'sudo cat /opt/intelligence-hub/current/RELEASE_SHA'"); Set-Status 'Hub RELEASE_SHA check copied. Expected release starts c622160e.' }
    $copySign = New-Button 'Copy signing command' { [System.Windows.Clipboard]::SetText("& '$signScript' -Thumbprint $thumb"); Set-Status 'Signing command copied.' }.GetNewClosure()
    $copyVerify = New-Button 'Copy signature verification' { [System.Windows.Clipboard]::SetText("& '$signScript' -Verify -RequireSignature"); Set-Status 'Signature verification command copied.' }.GetNewClosure()
    $goLive = @(
        (New-Text 'Go-live checklist' 15 -Bold),
        (New-Text 'These are the release steps for the installed DE Tech Tool and Intelligence Hub. Secrets stay runtime-only; the account number is non-secret client metadata.' -Muted -Wrap),
        (New-El TextBlock @{ Text = "1. Hub deployment · expected RELEASE_SHA c622160e…\\n2. Hub shared secret · $hubSecretStatus\\n3. Client Hub account · $hubAccountStatus\\n4. Code signing · $certStatus\\n5. Verify signed package before client deployment"; Style = 'Mono'; TextWrapping = 'Wrap'; Margin = '0,6,0,8' }),
        (New-Wrap @((New-Label 'Hub account number'), $hubAccountBox, $saveHubAccount)),
        (New-Wrap @($copyDeploy, $copySign, $copyVerify)),
        (New-Text 'Signing uses packaging\\Sign-DETechConsole.ps1 with SHA-256 Authenticode plus a timestamp. The certificate private key stays in the Windows certificate store. The Hub secret must be configured as TECHCONSOLE_TO_HUB_SECRET on the server and entered here as DE_HUB_SIGNING_SECRET.' -Muted -Wrap)
    )
    [void]$root.Children.Add((New-Card $goLive))
    $profileBtn = New-Button 'New client profile from template' { $id = Read-GuiText 'New profile' 'Profile id (lowercase, hyphens):'; if ($id) { $p = New-DEClientProfileTemplate -Id $id -Name $id; try { $f = Save-DEClientProfile -Profile $p; Start-Process notepad.exe $f } catch { Set-Status $_.Exception.Message } } }
    [void]$root.Children.Add((New-Card @((New-Text 'Client profiles' 15 -Bold), (New-Text 'Profiles hold tier, stack roles, apps, branding, sites, vendor tenant ids and detection rules. Saving one that contains a secret is refused.' -Muted -Wrap), $profileBtn)))
}

$Integrity = Write-DEIntegrityEvidence

# ============================================================== smoke test
if ($SmokeTest) {
    # Builds every page against a real client profile without a message loop or a visible window, then renders
    # each page at 96 and 192 DPI (100 and 200 percent) so layout faults and high-DPI clipping show up in CI.
    Set-DEMode -Mode Audit -DryRun
    if (-not $SmokeOut) { $SmokeOut = Join-Path (Get-DEConsole).Dirs.Base 'smoke' }
    New-Item -ItemType Directory -Path $SmokeOut -Force | Out-Null
    $failed = @()
    # Drive the same background-job path the buttons use (runspace, EndInvoke, OnDone) and fail on any job error.
    function Wait-SmokeJob {
        param([string]$Name)
        $deadline = (Get-Date).AddMinutes(8)
        while ($S.Job -and -not $S.Job.handle.IsCompleted -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 250 }
        if ($S.Job -and -not $S.Job.handle.IsCompleted) { return "${Name}: timed out" }
        if ($S.Job) { Update-DEJob }
        if ($S.LastJobError) { return "${Name}: $($S.LastJobError)" }
        return $null
    }
    try {
        $S.Mode = 'takeover'; $Settings.technician = $(if ($Technician) { $Technician } else { 'jrpetro' })
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician
        if ($S.LastJobError) { $failed += "use client and mode: $($S.LastJobError)" }
        if (-not @(Get-DEActions -Mode 'takeover').Count) { $failed += 'use client and mode: no plan was built' } else { Write-Host 'SMOKE PASS use client and mode' }
        # A failing button must report, not throw.
        Invoke-GuiSafely -Label 'smoke' -Action { throw 'handler error on purpose' }
        if ($S.LastJobError -notmatch 'on purpose') { $failed += 'button error guard did not report' } else { Write-Host 'SMOKE PASS button error guard'; $S.LastJobError = $null }
        Invoke-Discovery -Quick
        $e = Wait-SmokeJob 'discovery job'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS discovery job' }
        if (-not $S.Snapshot) { $failed += 'discovery job: no snapshot came back' }
        if (-not @(Get-DEActions).Count) { $failed += 'discovery job: no workflow actions registered' }
        Start-DEJob -Label 'Full audit' -Work { $null = Invoke-DEAudit -Mode $JobMode }
        $e = Wait-SmokeJob 'audit job'; if ($e) { $failed += $e } else { Write-Host ("SMOKE PASS audit job ({0} evidence rows)" -f @(Get-DEEvidence).Count) }
        # Scan & fix: the list builds from the runbook, rows and checkboxes exist, and a ticked batch runs through the job path
        $S.ScanDone = $true; Select-DEScanDefaults; Show-Page 'Scan'
        if (-not @($S.RowBorders.Keys).Count) { $failed += 'scan page: no rows' } else { Write-Host ("SMOKE PASS scan page ({0} rows, {1} pre-ticked)" -f @($S.RowBorders.Keys).Count, @($S.Selected.Keys).Count) }
        $S.Selected = @{}; foreach ($i in @(@($S.RowBorders.Keys) | Select-Object -First 2)) { $S.Selected[$i] = $true }
        Invoke-DEScanBatch -How Audit
        $e = Wait-SmokeJob 'scan batch'; if ($e) { $failed += $e } else { Write-Host 'SMOKE PASS scan batch (check selected)' }
        $S.Focus = @($S.RowBorders.Keys)[0]; Update-ScanDetail; if (-not $S.DetailHost.Content) { $failed += 'scan detail panel empty' } else { Write-Host 'SMOKE PASS scan detail panel' }
        # the plan picker: a standalone solution loads as not DE managed, then a ProActive tier for the page renders
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'new' -Technician $Settings.technician -Solution @('identity_access')
        if ($S.Profile.plan.managed -ne $false -or -not @(Get-DEActions -Mode 'new').Count) { $failed += 'standalone plan did not load' } else { Write-Host 'SMOKE PASS standalone plan' }
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician -Bundle 'proactive-business'
        if ("$($S.Profile.plan.bundle)" -ne 'proactive-business') { $failed += 'ProActive plan did not load' } else { Write-Host 'SMOKE PASS ProActive plan' }
        $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile; if (-not $rec.mode) { $failed += 'no recommended mode' } else { Write-Host "SMOKE PASS recommended mode $($rec.mode)" }
        # Email migration: a mid-project fixture (no tenant needed), a real scan of this account, and the next step
        if (Import-DEMsAdmin) {
            $migDir = Join-Path $SmokeOut 'migrations'; New-Item -ItemType Directory -Path $migDir -Force | Out-Null; $null = Set-DEMigrationDirectory -Path $migDir
            $now = (Get-Date).ToUniversalTime()
            $chk = [pscustomobject]@{}; foreach ($c in @('Inbound mail', 'Outbound mail', 'Replies', 'Attachments', 'Folders', 'Contacts', 'Calendar', 'MFA', 'Outlook desktop', 'Outlook mobile', 'Shared mailbox', 'DNS and forwarding', 'Bounce diagnostic')) { $chk | Add-Member -NotePropertyName $c -NotePropertyValue ([pscustomobject]@{ status = 'Pending'; detail = ''; by = ''; at = $now.ToString('o') }) }
            $chk.'Shared mailbox' = [pscustomobject]@{ status = 'Pass'; detail = 'office@ : 4 members with Full Access and Send As, sign-in blocked'; by = 'smoke'; at = $now.ToString('o') }
            $chk.'Bounce diagnostic' = [pscustomobject]@{ status = 'Fail'; detail = '1 open bounce finding(s); latest: RetryingClient for helen.x@gmail.com'; by = 'smoke'; at = $now.ToString('o') }
            $fx = [pscustomobject][ordered]@{
                schema = 'de.email-migration.project/v1'; projectId = 'smoke-mail'; client = 'Alamo Industries'; tenantId = '00000000-0000-0000-0000-000000000000'; targetDomain = 'alamo-industries.com'
                sourceType = 'PersonalGmail'; mailPath = 'IMAP'; stage = 'Pilot'; requestedBy = 'smoke'; createdAt = $now.AddDays(-3).ToString('o'); updatedAt = $now.ToString('o')
                users = @(
                    [pscustomobject][ordered]@{ source = 'suzette.x@gmail.com'; destination = 'suzette@alamo-industries.com'; displayName = 'Suzette'; userId = '1'; sourceType = 'PersonalGmail'; devices = @('FRONTDESK'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..14 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 18211; storageKB = 5242880 }; batch = 'smoke-mail-pilot'; migration = [pscustomobject]@{ destination = 'suzette@alamo-industries.com'; status = 'Synced'; synced = 18190; skipped = 21; error = '' }; contacts = $null; calendar = $null; mfa = [pscustomobject]@{ registered = $true } }
                    [pscustomobject][ordered]@{ source = 'helen.x@gmail.com'; destination = 'helen@alamo-industries.com'; displayName = 'Helen'; userId = '2'; sourceType = 'PersonalGmail'; devices = @('HELENU'); destinationReady = $true; destinationIssues = @(); preflight = [pscustomobject]@{ at = $now.ToString('o'); ok = $true; reason = ''; folders = @(1..9 | ForEach-Object { [pscustomobject]@{ name = "f$_"; messages = 10 } }); allMailCount = 40377; storageKB = 9437184 }; batch = $null; migration = $null; contacts = $null; calendar = $null; mfa = $null }
                )
                sharedMailboxes = @([pscustomobject]@{ address = 'office@alamo-industries.com'; members = @('norma@alamo-industries.com', 'helen@alamo-industries.com', 'suzette@alamo-industries.com', 'mike@alamo-industries.com'); verified = $true; problems = @(); checkedAt = $now.ToString('o') })
                devices = @('FRONTDESK', 'HELENU'); batches = @([pscustomobject]@{ name = 'smoke-mail-pilot'; type = 'Pilot'; users = @('suzette@alamo-industries.com'); status = 'Synced'; startedAt = $now.AddDays(-1).ToString('o'); completedAt = $null; confirmedBy = $null; confirmedAt = $null; failed = 0 })
                dns = $null; bounce = @([pscustomobject]@{ id = 'b1'; file = 'bounce.eml'; cause = 'RetryingClient'; why = 'the original is 4 days older than the bounce: a device or app keeps retrying it'; bouncedRecipient = 'helen.x@gmail.com'; smtpStatus = '5.1.1'; meaning = 'the address does not exist'; matchedDevices = @('HELENU'); sendingClient = 'Microsoft Outlook 16.0'; fix = 'remove the Gmail account from Outlook on HELENU'; resolved = $false; resolution = $null; resolvedBy = $null })
                verification = $chk; signoff = $null; events = @()
            }
            [IO.File]::WriteAllText((Join-Path $migDir 'smoke-mail.json'), ($fx | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false))
            $S.MigrationProject = 'smoke-mail'
            $scan = Get-DEMailClientInventory -ProjectId 'smoke-mail'
            $S.MigrationScan = [pscustomobject]@{ migrationScan = $scan; file = (Join-Path $migDir 'scan.json') }
            $nx = Get-DEMigrationNextStep -ProjectId 'smoke-mail'
            if ($nx.step -notlike 'Confirm the pilot*') { $failed += "migration next step: '$($nx.step)'" } else { Write-Host "SMOKE PASS migration next step ($($nx.step)); scan: $($scan.message)" }
        } else { $failed += 'DE Microsoft Admin did not load' }
    } catch { $failed += "setup: $($_.Exception.Message)" }
    # Two layouts: the design size, and a 1366x768 laptop at 125 % scaling (1093x582 device-independent units less the
    # taskbar, rendered at 120 dpi). At the small size the footer (status and Cancel) must stay inside the window.
    $layouts = @(@{ tag = '96dpi'; w = 1440; h = 900; dpi = 96 }, @{ tag = 'small-120dpi'; w = 1093; h = 552; dpi = 120 })
    foreach ($name in @($Pages.Keys | Where-Object { $null -ne $_ })) {
        try {
            Show-Page $name
            if ($S.CurrentPage -ne $name -or -not $UI.PageHost.Content) { throw 'page did not load' }
            foreach ($l in $layouts) {
                $w = $l.w; $h = $l.h
                $Win.Content.Measure((New-Object System.Windows.Size($w, $h))); $Win.Content.Arrange((New-Object System.Windows.Rect(0, 0, $w, $h))); $Win.Content.UpdateLayout()
                if ($l.tag -like 'small*') {
                    foreach ($el in @($UI.TxtStatus, $UI.BtnCancel)) {
                        if (-not $el -or -not $el.IsVisible) { continue }
                        $pt = $el.TranslatePoint((New-Object System.Windows.Point(0, 0)), $Win.Content)
                        if ($pt.Y + $el.ActualHeight -gt $h + 1 -or $pt.X + $el.ActualWidth -gt $w + 1) { throw "$($el.Name) is off-screen at $w x $h" }
                    }
                }
                $scale = $l.dpi / 96
                $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap([int]($w * $scale), [int]($h * $scale), $l.dpi, $l.dpi, [System.Windows.Media.PixelFormats]::Pbgra32)
                $bmp.Render($Win.Content)
                $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
                $fs = [IO.File]::Create((Join-Path $SmokeOut ("{0}-{1}.png" -f $name, $l.tag))); try { $enc.Save($fs) } finally { $fs.Dispose() }
            }
            Write-Host ("SMOKE PASS {0}" -f $name)
        } catch { $failed += "${name}: $($_.Exception.Message)"; Write-Host ("SMOKE FAIL {0}: {1}" -f $name, $_.Exception.Message) }
    }
    Clear-DESecrets
    Write-Host ("SMOKE {0}: {1} page(s), {2} failure(s); renders in {3}" -f $(if ($failed.Count) { 'FAIL' } else { 'PASS' }), @($Pages.Keys).Count, $failed.Count, $SmokeOut)
    $failed | ForEach-Object { Write-Host "  $_" }
    exit $(if ($failed.Count) { 1 } else { 0 })
}

# ============================================================== start
if ($Settings.dryRun) { Set-DEMode -Mode Audit -DryRun } else { Set-DEMode -Mode Apply }
$Win.Add_Closed({ Clear-DESecrets; Save-GuiSettings })
# Last line of defence: anything that still escapes a handler is reported, never allowed to close the console.
$Win.Dispatcher.Add_UnhandledException({
    param($src, $e)
    $e.Handled = $true
    $msg = "Unexpected error: $($e.Exception.Message)"
    try { Write-DELog -Level FAIL -Message $msg } catch { }
    try { Set-Status $msg } catch { }
})
$Win.Add_ContentRendered({
    if (-not $Settings.technician -and -not $SmokeTest) {
        # first time on this machine: ask who is running the tool, once; evidence and the Hub record name this person
        $t = Read-GuiText 'Technician' 'Who is running DE Tech Tool on this machine? Evidence and the Hub record name this person.' -Default 'jrpetro'
        $Settings.technician = $(if ("$t".Trim()) { "$t".Trim() } else { 'jrpetro' }); Save-GuiSettings; Set-DEStateValue -Path 'settings.technician' -Value $Settings.technician
    }
    if (-not $Settings.technician) { $Settings.technician = 'jrpetro' }
    if ($Settings.client) { try { $S.Profile = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $Settings.client) -Bundle "$(Get-DEHashPath -Object $Settings -Path 'planBundle')" -Solution @(Get-DEHashPath -Object $Settings -Path 'planSolutions' | Where-Object { $_ }) } catch { } }
    if ($Resume) { $r = Resume-DEWorkflow; Set-Status "Resumed after restart. Next: $(Get-DEHashPath -Object $r -Path 'nextAction')"; $S.CurrentPage = 'Scan' }
    Show-Page $S.CurrentPage
    if ($Integrity.status -eq 'tampered') { Set-Status ('WARNING: console files changed after packaging; do not run changes from this copy. ' + (@($Integrity.problems | Select-Object -First 3) -join '; ')) }
    elseif ($Integrity.status -eq 'unsigned') { Set-Status 'Unsigned development build. Use the signed release for client work.' }
    if ($S.Profile) { $S.ModeChosen = [bool]$Resume }   # a resumed job keeps its mode; a fresh start follows what the scan recommends
    Start-DEScan   # every category is scanned on launch; nothing changes until the technician ticks items and goes live
})
$null = $Win.ShowDialog()
