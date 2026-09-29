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
                     to PNG at 100 and 200 percent scale under -SmokeOut, never show the window, exit 0 when every
                     page built and 1 otherwise. Used by CI and windows\tests\Invoke-GuiSmoke.ps1.

.NOTES
    Windows PowerShell 5.1 or PowerShell 7 on Windows. Exit codes: 0, 1, 2 as above.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('Dashboard', 'Workflow', 'Discovery', 'Identity', 'Security', 'Apps', 'Browser', 'Baseline', 'Branding', 'Network', 'Vendors', 'AiToolkit', 'Evidence', 'Settings')]
    [string]$Page = 'Dashboard',
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
    [string]$SmokeOut
)
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ConsoleRoot = $PSScriptRoot
Import-Module (Join-Path $ConsoleRoot 'modules\DE.Workflow\DE.Workflow.psm1') -Force -DisableNameChecking
Import-DEConsoleModules -Root $ConsoleRoot

# ============================================================== headless
if ($Headless) {
    # One way out: every path prints RESULT and writes -ResultFile (JSON, no secrets) so RMM and first boot read the
    # outcome from data, never from stdout or from an exit code a wrapper might lose.
    function Exit-DEHeadless {
        param([int]$Code, [string]$Overall, [string]$Message = '', [string]$Next = '', [string]$Bundle = '', [switch]$RestartRequired)
        if ($Message) { Write-Host $Message }
        Write-Host ("RESULT: {0}{1}" -f $Overall, $(if ($Bundle) { "; bundle $Bundle" } else { '' }))
        if ($Next) { Write-Host "NEXT: $Next" }
        if ($ResultFile) { try { [ordered]@{ schema = 'de.techconsole.result/v1'; overall = $Overall; exitCode = $Code; restartRequired = [bool]$RestartRequired; message = (Protect-DEText $Message); next = (Protect-DEText $Next); bundle = $Bundle; at = (Get-Date).ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath $ResultFile -Encoding UTF8 -WhatIf:$false } catch { Write-Host "could not write $ResultFile : $($_.Exception.Message)" } }
        try { Clear-DESecrets } catch { }
        exit $Code
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
    if ($Apply -and $integrity.status -eq 'tampered') { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message ('REFUSED: console files changed after packaging: ' + ($integrity.problems -join '; ')) -Next 'Re-download the signed package and compare its sha256.' }
    # powershell.exe -File passes '-Solution a,b' as one string: accept comma-separated lists from RMM command lines
    $AddOn = @($AddOn | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $Solution = @($Solution | ForEach-Object { "$_" -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    # A dropship order (no secrets) names the client, bundle, end user and the exact device.
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
        try { $baseProfile = ConvertTo-DEHashtable (Get-Content -LiteralPath $ProfileFile -Raw | ConvertFrom-Json) } catch { Exit-DEHeadless -Code 2 -Overall 'REFUSED' -Message "REFUSED: cannot read profile $ProfileFile ($($_.Exception.Message))" }
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
}

# ============================================================== window
if ($env:OS -ne 'Windows_NT') { Write-Host 'The window needs Windows. Use -Headless on other platforms.'; exit 2 }
if ($SmokeTest -and -not $DataDir) { $DataDir = Join-Path ([IO.Path]::GetTempPath()) ("de-console-smoke-{0}" -f $PID) }
if ([Threading.Thread]::CurrentThread.GetApartmentState() -ne 'STA') {
    $exe = (Get-Process -Id $PID).Path
    # Start-Process joins -ArgumentList without quoting: quote every value that may hold a space (C:\Program Files\...)
    $q = { param($v) if ("$v" -match '\s' -and "$v" -notmatch '^".*"$') { '"' + $v + '"' } else { "$v" } }
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
if (Test-Path -LiteralPath $settingsPath) { try { $loaded = ConvertTo-DEHashtable (Get-Content -LiteralPath $settingsPath -Raw | ConvertFrom-Json); foreach ($k in $loaded.Keys) { $Settings[$k] = $loaded[$k] } } catch { } }
function Save-GuiSettings { try { $Settings | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8 } catch { } }
if ($Technician) { $Settings.technician = $Technician }
if (-not $Settings.technician) { $Settings.technician = "$(Get-DEState -Path 'settings.technician')" }
if ($Settings.hubEndpoint) { Set-DEStateValue -Path 'settings.hub.endpoint' -Value $Settings.hubEndpoint }

$highContrast = [System.Windows.SystemParameters]::HighContrast
$fontDir = Join-Path (Split-Path -Parent $ConsoleRoot) 'fonts'
$FontUi = 'Segoe UI'; $FontDisplay = 'Segoe UI Semibold'
if (Test-Path -LiteralPath (Join-Path $fontDir 'SpaceGrotesk-Variable.ttf')) { $FontUi = "file:///$($fontDir -replace '\\','/')/#Space Grotesk, Segoe UI"; $FontDisplay = "file:///$($fontDir -replace '\\','/')/#Oxanium, Segoe UI Semibold" }

[xml]$Xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="DE Tech Tool" Width="1440" Height="900" MinWidth="1180" MinHeight="720" WindowStartupLocation="CenterScreen"
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
    <Style TargetType="TextBox"><Setter Property="Background" Value="{StaticResource Surface}"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="Padding" Value="8,5"/><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="CaretBrush" Value="{StaticResource Magenta}"/></Style>
    <Style TargetType="PasswordBox"><Setter Property="Background" Value="{StaticResource Surface}"/><Setter Property="Foreground" Value="{StaticResource Paper}"/><Setter Property="BorderBrush" Value="{StaticResource Hairline}"/><Setter Property="Padding" Value="8,5"/><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="CaretBrush" Value="{StaticResource Magenta}"/></Style>
    <Style TargetType="ComboBox"><Setter Property="Margin" Value="0,2,0,8"/><Setter Property="Padding" Value="6,4"/></Style>
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
  <Grid>
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
$Win = [Windows.Markup.XamlReader]::Load((New-Object System.Xml.XmlNodeReader $Xaml))
$Win.FontFamily = New-Object System.Windows.Media.FontFamily $FontUi
if ($highContrast) {
    foreach ($k in @('Well', 'Surface', 'Raised', 'RaisedHover')) { $Win.Resources[$k] = [System.Windows.SystemColors]::WindowBrush }
    foreach ($k in @('Paper', 'Muted')) { $Win.Resources[$k] = [System.Windows.SystemColors]::WindowTextBrush }
    foreach ($k in @('Magenta', 'MagentaHover', 'Lavender', 'Violet')) { $Win.Resources[$k] = [System.Windows.SystemColors]::HighlightBrush }
    $Win.Background = [System.Windows.SystemColors]::WindowBrush; $Win.Foreground = [System.Windows.SystemColors]::WindowTextBrush
}
$UI = @{}
foreach ($n in @('NavPanel', 'PageHost', 'TxtVersion', 'TxtModeBadge', 'HdrTech', 'HdrClient', 'HdrClientWhy', 'HdrUser', 'HdrUserWhy', 'HdrDevice', 'HdrDeviceSub', 'HdrReady', 'TxtStatus', 'Progress', 'BtnCancel', 'BrandLogo')) { $UI[$n] = $Win.FindName($n) }
$UI.TxtVersion.Text = "v$((Get-DEConsole).ConsoleVersion)"; $Win.Title = "DE Tech Tool v$((Get-DEConsole).ConsoleVersion)"
$brandLogoPath = Join-Path $ConsoleRoot 'assets\brand\digerati-logo-reverse-600.png'
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
$UI.BtnCancel.Add_Click({ if ($S.Job) { try { $S.Job.core.ps.Stop() } catch { }; Set-Status 'Cancel requested; the current step finishes or stops at its next checkpoint.' } })

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
    $UI.TxtModeBadge.Text = "mode: $modeTitle$(if ((Get-DEConsole).DryRun) { ' · DRY RUN' })"
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
    foreach ($c in @(@{ h = 'Action'; b = 'Title'; w = 330 }, @{ h = 'State'; b = 'State'; w = 100 }, @{ h = 'Detail'; b = 'Detail'; w = 360 }, @{ h = 'Gates'; b = 'Gates'; w = 220 }, @{ h = 'Secrets'; b = 'Secrets'; w = 140 }, @{ h = 'Destructive'; b = 'Destructive'; w = 80 })) {
        $col = New-Object System.Windows.Controls.DataGridTextColumn; $col.Header = $c.h; $col.Binding = New-Object System.Windows.Data.Binding $c.b; $col.Width = $c.w; $grid.Columns.Add($col)
    }
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

# ============================================================== pages
$Pages = [ordered]@{
    Dashboard = 'Dashboard'; Workflow = 'Guided workflow'; Discovery = 'Discovery'; Identity = 'Identity & migration'; Security = 'Security'; Apps = 'Applications'
    Browser = 'Browser configurator'; Baseline = 'OS baseline'; Branding = 'Branding'; Network = 'Network & site'; Vendors = 'Vendor Admin Center'; AiToolkit = 'AI Toolkit'; Evidence = 'Evidence & Hub'; Settings = 'Settings & secrets'
}
$NavButtons = @{}
foreach ($k in $Pages.Keys) {
    $rb = New-Object System.Windows.Controls.RadioButton; $rb.Style = $Win.Resources['Nav']; $rb.Content = $Pages[$k]; $rb.GroupName = 'nav'; $rb.Tag = $k
    [System.Windows.Automation.AutomationProperties]::SetName($rb, "Open $($Pages[$k])")
    $rb.Add_Checked({ param($src, $e) Show-Page $src.Tag })
    [void]$UI.NavPanel.Children.Add($rb); $NavButtons[$k] = $rb
}

function Show-Page {
    param([string]$Name)
    $S.CurrentPage = $Name; $Settings.lastPage = $Name; Save-GuiSettings
    if (-not $NavButtons[$Name].IsChecked) { $NavButtons[$Name].IsChecked = $true; return }
    $S.LogBox = $null
    $sv = New-Object System.Windows.Controls.ScrollViewer; $sv.VerticalScrollBarVisibility = 'Auto'
    $root = New-El StackPanel
    $needsProfile = $Name -notin @('Dashboard', 'Discovery', 'Vendors', 'AiToolkit', 'Settings')
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
    if ($Technician) { $Settings.technician = $Technician }
    Save-GuiSettings
    $ids = @(Initialize-DEWorkflow -ClientProfile $S.Profile -Mode $S.Mode)
    if ($S.Snapshot) { $null = New-DEProvisioningContext -Snapshot $S.Snapshot -ClientId $S.Profile.id -Mode $S.Mode -Technician $Settings.technician }
    $planName = $(if ($S.Profile.plan.bundleName) { $S.Profile.plan.bundleName } elseif (@($S.Profile.plan.solutions).Count) { 'standalone ' + (@($S.Profile.plan.solutions) -join ', ') } else { 'client profile' })
    Set-Status ("Loaded {0}, {1} ({2}): {3} planned step(s). {4}" -f $S.Profile.name, $planName, $S.Mode, $ids.Count, $(if ($S.Snapshot) { 'Audit next to see what differs.' } else { 'Run discovery next.' }))
    Show-Page 'Dashboard'
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
        foreach ($c in @(@{ h = 'Gate'; b = 'Title'; w = 260 }, @{ h = 'State'; b = 'State'; w = 100 }, @{ h = 'Detail'; b = 'Detail'; w = 520 }, @{ h = 'How to unlock'; b = 'Unblock'; w = 360 })) { $col = New-Object System.Windows.Controls.DataGridTextColumn; $col.Header = $c.h; $col.Binding = New-Object System.Windows.Data.Binding $c.b; $col.Width = $c.w; $gridG.Columns.Add($col) }
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
        'Browsers' = @{ default = $snap.browsers.defaultBrowser; chrome = $(if ($snap.browsers.chrome) { $snap.browsers.chrome.version }); edge = $(if ($snap.browsers.edge) { $snap.browsers.edge.version }) }
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
    $prot = New-Button 'Record protector id' { try { Set-DEBitLockerExpectedProtector -ProtectorId $tbProt.Text; Reset-DEGateCache; Show-Page 'Identity' } catch { Set-Status $_.Exception.Message } }.GetNewClosure()
    $bgv = New-Button 'Confirm break-glass verified' { if (-not (Test-DESecret -Name 'BREAKGLASS_PASSWORD')) { Set-Status 'Enter the break-glass password in Settings & secrets first.'; return }; if (Confirm-Gui 'Break-glass' "Did you just sign in interactively as .\DE-BreakGlass on this machine?") { $null = Confirm-DEBreakGlassVerified -Technician $Settings.technician; Reset-DEGateCache; Show-Page 'Identity' } }
    $odc = New-Button 'Confirm OneDrive synced and paused' { if (Confirm-Gui 'OneDrive' 'OneDrive shows Up to date and sync is paused?') { Confirm-DEOneDriveSynced; Reset-DEGateCache; Show-Page 'Identity' } }
    [void]$root.Children.Add((New-Card @(
                (New-Text 'Identity mapping' 15 -Bold), (New-Text 'Source is the Windows principal today (for example AzureAD\SuzetteThompson). Destination is the local account ADMU creates and JumpCloud takes over (for example sthompson). C:\Users\<source> is preserved (UpdateHomePath off).' -Muted -Wrap),
                (New-Wrap @((New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Source principal'), $tbSource)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'Destination local user'), $tbLocal)), (New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'JumpCloud user'), $tbJc)), (New-El StackPanel @{} @((New-Label 'Email / UPN'), $tbEmail)))),
                (New-Wrap @($save, $check, $mapping, $bgv, $odc)),
                (New-Wrap @((New-El StackPanel @{ Margin = '0,0,14,0' } @((New-Label 'BitLocker recovery protector id (verified against escrow; never the password)'), $tbProt)), $prot))
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
    foreach ($c in @(@{ h = 'Package'; b = 'Name'; w = 280 }, @{ h = 'Category'; b = 'Category'; w = 110 }, @{ h = 'Source'; b = 'Source'; w = 110 }, @{ h = 'Trust'; b = 'Trust'; w = 240 }, @{ h = 'Confirmed'; b = 'Confirmed'; w = 90 }, @{ h = 'Secrets'; b = 'Secrets'; w = 150 })) { $col = New-Object System.Windows.Controls.DataGridTextColumn; $col.Header = $c.h; $col.Binding = New-Object System.Windows.Data.Binding $c.b; $col.Width = $c.w; $grid.Columns.Add($col) }
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
    $img = New-El Image @{ Height = 320; Stretch = 'Uniform'; HorizontalAlignment = 'Left'; Margin = '0,8,0,8' }
    $preview = New-Button 'Generate preview' { try { $f = New-DEBrandedWallpaper -ClientProfile $S.Profile -Width 1600 -Height 900; $bi = New-Object System.Windows.Media.Imaging.BitmapImage; $bi.BeginInit(); $bi.CacheOption = 'OnLoad'; $bi.UriSource = [uri]$f; $bi.EndInit(); $img.Source = $bi; Set-Status "preview: $f" } catch { Set-Status $_.Exception.Message } }.GetNewClosure() -Primary
    $logo = New-Button 'Choose client logo' { $d = New-Object System.Windows.Forms.OpenFileDialog; $d.Filter = 'Images|*.png;*.jpg;*.jpeg'; if ($d.ShowDialog() -eq 'OK') { $dest = Join-Path (Get-DEConsole).Dirs.Profiles ("{0}-logo{1}" -f $S.Profile.id, [IO.Path]::GetExtension($d.FileName)); Copy-Item -LiteralPath $d.FileName -Destination $dest -Force; $S.Profile.branding.clientLogo = (Split-Path -Leaf $dest); $null = Save-DEClientProfile -Profile $S.Profile; Set-Status "client logo saved to the profile" } }
    $undo = New-Button 'Undo branding' { if (Confirm-Gui 'Undo branding' 'Restore the previous wallpaper, lock screen and OEM info?') { Start-DEJob -Label 'Undo branding' -Work { Undo-DEBranding } } }
    [void]$root.Children.Add((New-Card @((New-Text 'Branding' 15 -Bold), (New-Text "Hostname pattern $($S.Profile.branding.hostnamePattern) -> $(New-DEHostname -ClientProfile $S.Profile)" -Muted), (New-Wrap @($preview, $logo, $undo)), $img)))
    [void]$root.Children.Add((New-ActionGrid -Modules @('branding') -Title 'Branding actions'))
}
function Build-OpsConfirm {
    param($root)
    $mk = { param($label, $check) New-Button $label { if (Confirm-Gui 'Confirm' "$label now?") { Confirm-DEOperationalCheck -Check $check; Show-Page 'Network' } }.GetNewClosure() }
    [void]$root.Children.Add((New-Card @((New-Text 'Technician confirmations' 15 -Bold), (New-Text 'Recorded with time and technician; no credentials are stored.' -Muted), (New-Wrap @((& $mk 'Confirm first backup succeeded' 'operations.backup.firstBackupConfirmedAt'), (& $mk 'Confirm remote support session tested' 'operations.remoteSupport.testedAt'), (& $mk 'Confirm email security in place' 'operations.emailSecurity.confirmedAt'), (& $mk 'Confirm JumpCloud Protect enrolled' 'operations.mfa.jumpcloudProtectAt'), (& $mk 'Confirm Microsoft MFA registered' 'operations.mfa.microsoftAt'))))))
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
    $copy = { param($i) $f = Join-Path $packDir 'chatgpt-custom-instructions.md'; if (-not (Test-Path -LiteralPath $f)) { Set-Status 'Build the packs first.'; return }; $m = [regex]::Matches((Get-Content -LiteralPath $f -Raw), '```text\r?\n([\s\S]*?)\r?\n```'); if ($m.Count -ge 2) { [System.Windows.Clipboard]::SetText($m[$i].Groups[1].Value); Set-Status "ChatGPT block $(@('A','B')[$i]) copied ($($m[$i].Groups[1].Value.Length) chars)" } }.GetNewClosure()
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
    $export = New-Button 'Export evidence bundle' { if (-not $S.Snapshot) { Set-Status 'Run discovery first.'; return }; $S.LastBundle = Export-DEEvidenceBundle -Snapshot $S.Snapshot -ClientProfile $S.Profile; Show-Page 'Evidence' } -Primary
    $open = New-Button 'Open internal report' { if ($S.LastBundle) { Start-Process (Join-Path $S.LastBundle.folder 'report-internal.html') } }
    $client = New-Button 'Open client report' { if ($S.LastBundle) { Start-Process (Join-Path $S.LastBundle.folder 'report-client.html') } }
    $hub = New-Button 'Send to Intelligence Hub' { if (-not $S.LastBundle) { Set-Status 'Export the bundle first.'; return }; $r = Send-DEHubPayload -Payload (New-DEHubPayload -Record $S.LastBundle.record -BundleSha256 $S.LastBundle.sha256 -BundlePath $S.LastBundle.zip); Set-Status $(if ($r.sent) { 'Sent to the Hub.' } else { "Saved for manual upload: $($r.file)" }); Show-Page 'Evidence' }
    $bundleCopy = New-Button 'Copy diagnostic bundle' { $txt = "DE Tech Tool $((Get-DEConsole).ConsoleVersion) · $env:COMPUTERNAME · mode $($S.Mode)`r`n" + ((Get-DEGapReport | ForEach-Object { "$($_.result) $($_.id) | $($_.detail) | fix: $($_.fix)" }) -join "`r`n"); [System.Windows.Clipboard]::SetText((Protect-DEText $txt)); Set-Status 'Gap report copied (redacted).' }
    [void]$root.Children.Add((New-Card @((New-Text 'Evidence and handoff' 15 -Bold), (New-Text 'Sanitized JSON, internal and client-safe HTML reports, redacted log, sha256 manifest, zipped and hashed. The Hub gets identity, mapping, state, verification times, exceptions and evidence references; never secrets.' -Muted -Wrap), (New-Wrap @($export, $open, $client, $hub, $bundleCopy)), $status)))
    $gaps = @(Get-DEGapReport)
    $grid = New-El DataGrid @{ Height = 380; Name = 'Gap report' }
    foreach ($c in @(@{ h = 'Phase'; b = 'phase'; w = 60 }, @{ h = 'Item'; b = 'title'; w = 340 }, @{ h = 'State'; b = 'State'; w = 100 }, @{ h = 'Detail'; b = 'detail'; w = 360 }, @{ h = 'Fix'; b = 'fix'; w = 360 })) { $col = New-Object System.Windows.Controls.DataGridTextColumn; $col.Header = $c.h; $col.Binding = New-Object System.Windows.Data.Binding $c.b; $col.Width = $c.w; $grid.Columns.Add($col) }
    $grid.ItemsSource = @($gaps | ForEach-Object { [pscustomobject]@{ phase = $_.phase; title = $_.title; State = $_.result; detail = $_.detail; fix = $_.fix } })
    [void]$root.Children.Add((New-Card @((New-Text "Gap report ($($gaps.Count) open)" 15 -Bold), $grid)))
    $ex = @(Get-DEExceptions)
    if ($ex.Count) { [void]$root.Children.Add((New-Card @((New-Text 'Active exceptions' 15 -Bold), (New-El TextBlock @{ Text = (($ex | ForEach-Object { "$($_.target): $($_.reason) · approved by $($_.approver) · review $(([datetime]$_.expiresOn).ToString('yyyy-MM-dd'))" }) -join "`n"); Style = 'Mono'; TextWrapping = 'Wrap' })))) }
}
function Build-Settings {
    param($root)
    $known = @(
        @{ n = 'BREAKGLASS_PASSWORD'; d = 'DE-BreakGlass password (16+ characters)' }, @{ n = 'MIGRATION_TEMP_PASSWORD'; d = 'Temporary password for the new local account (ADMU)' },
        @{ n = 'JC_CONNECT_KEY'; d = 'JumpCloud connect key (agent install)' }, @{ n = 'JC_API_KEY'; d = 'JumpCloud API key (mapping, binding, groups, policies)' }, @{ n = 'JC_ORG_ID'; d = 'JumpCloud org id (multi-tenant admins)' },
        @{ n = 'S1_SITE_TOKEN'; d = 'SentinelOne site token' }, @{ n = 'GUARDZ_ORG_KEY'; d = 'Guardz organization key' }, @{ n = 'WAZUH_REG_PASSWORD'; d = 'Wazuh registration password' }, @{ n = 'DE_HUB_TOKEN'; d = 'Intelligence Hub integration token' }
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
    $vaultBtn = New-Button 'Load from vault' { if (-not $vaultBox.Text) { Set-Status 'Enter the SecretManagement vault name first.'; return }; $Settings.secretVault = $vaultBox.Text; Save-GuiSettings; try { $rows = Import-DESecretsFromVault -Vault $vaultBox.Text -Names $allNames; Set-Status ('Vault: ' + (($rows | ForEach-Object { "$($_.name) $($_.status)" }) -join ', ')); Show-Page 'Settings' } catch { Set-Status $_.Exception.Message } }.GetNewClosure()
    $vaultRow = New-Wrap @((New-Label 'Approved secret vault (PowerShell SecretManagement)'), $vaultBox, $vaultBtn)
    [void]$root.Children.Add((New-Card @((New-Text 'Runtime secrets' 15 -Bold), (New-Text 'Held in memory as SecureString for this session only. Never written to state, logs, receipts, profiles or Hub payloads; anything that looks like one is redacted on screen. Cleared when the console closes.' -Muted -Wrap), $sp, $vaultRow, $clear)))
    $hubBox = New-El TextBox @{ Text = $Settings.hubEndpoint; Width = 520; Name = 'Hub endpoint' }
    $dry = New-El CheckBox @{ Content = 'Dry run (every action plans, nothing changes)'; IsChecked = [bool]$Settings.dryRun }
    $save = New-Button 'Save settings' { $Settings.hubEndpoint = $hubBox.Text; $Settings.dryRun = [bool]$dry.IsChecked; Save-GuiSettings; Set-DEStateValue -Path 'settings.hub.endpoint' -Value $hubBox.Text; Set-DEMode -Mode $(if ($dry.IsChecked) { 'Audit' } else { 'Apply' }) -DryRun:([bool]$dry.IsChecked); Update-Header; Set-Status 'Settings saved.' }.GetNewClosure() -Primary
    [void]$root.Children.Add((New-Card @((New-Text 'Console settings' 15 -Bold), (New-Label 'Intelligence Hub device endpoint (HTTPS)'), $hubBox, $dry, $save, (New-Text "Data folder: $((Get-DEConsole).Dirs.Base)" -Muted), (New-Button 'Open data folder' { Start-Process (Get-DEConsole).Dirs.Base }))))
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
        # the plan picker: a standalone solution loads as not DE managed, then a ProActive tier for the page renders
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'new' -Technician $Settings.technician -Solution @('identity_access')
        if ($S.Profile.plan.managed -ne $false -or -not @(Get-DEActions -Mode 'new').Count) { $failed += 'standalone plan did not load' } else { Write-Host 'SMOKE PASS standalone plan' }
        Use-ClientAndMode -ProfileId $SmokeClient -Mode 'takeover' -Technician $Settings.technician -Bundle 'proactive-business'
        if ("$($S.Profile.plan.bundle)" -ne 'proactive-business') { $failed += 'ProActive plan did not load' } else { Write-Host 'SMOKE PASS ProActive plan' }
        $rec = Get-DERecommendedMode -Snapshot $S.Snapshot -ClientProfile $S.Profile; if (-not $rec.mode) { $failed += 'no recommended mode' } else { Write-Host "SMOKE PASS recommended mode $($rec.mode)" }
    } catch { $failed += "setup: $($_.Exception.Message)" }
    $w = 1440; $h = 900
    foreach ($name in @($Pages.Keys | Where-Object { $null -ne $_ })) {
        try {
            Show-Page $name
            if ($S.CurrentPage -ne $name -or -not $UI.PageHost.Content) { throw 'page did not load' }
            $Win.Content.Measure((New-Object System.Windows.Size($w, $h))); $Win.Content.Arrange((New-Object System.Windows.Rect(0, 0, $w, $h))); $Win.Content.UpdateLayout()
            foreach ($dpi in @(96, 192)) {
                $scale = $dpi / 96
                $bmp = New-Object System.Windows.Media.Imaging.RenderTargetBitmap([int]($w * $scale), [int]($h * $scale), $dpi, $dpi, [System.Windows.Media.PixelFormats]::Pbgra32)
                $bmp.Render($Win.Content)
                $enc = New-Object System.Windows.Media.Imaging.PngBitmapEncoder; $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($bmp))
                $fs = [IO.File]::Create((Join-Path $SmokeOut ("{0}-{1}dpi.png" -f $name, $dpi))); try { $enc.Save($fs) } finally { $fs.Dispose() }
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
    if ($Resume) { $r = Resume-DEWorkflow; Set-Status "Resumed after restart. Next: $(Get-DEHashPath -Object $r -Path 'nextAction')"; $S.CurrentPage = 'Workflow' }
    Show-Page $S.CurrentPage
    if ($Integrity.status -eq 'tampered') { Set-Status ('WARNING: console files changed after packaging; do not run changes from this copy. ' + (@($Integrity.problems | Select-Object -First 3) -join '; ')) }
    elseif ($Integrity.status -eq 'unsigned') { Set-Status 'Unsigned development build. Use the signed release for client work.' }
    Invoke-Discovery -Quick
})
$null = $Win.ShowDialog()
