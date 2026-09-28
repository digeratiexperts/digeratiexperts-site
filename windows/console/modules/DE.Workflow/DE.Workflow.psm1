#Requires -Version 5.1
<#
.SYNOPSIS
    Guided technician workflow: loads every module's gates and actions for the
    selected client profile and mode, picks the next recommended action with
    the reason, runs a phase or the whole plan, handles audit-only, repair and
    deprovision modes, and resumes after a restart.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:ModeActions = @{
    audit = @{ title = 'Audit only'; apply = $false; description = 'Detect everything, change nothing, produce a gap report. For inherited or takeover machines before any work.' }
    new = @{ title = 'New machine'; apply = $true; description = 'Out-of-box device for a known user: full provisioning.' }
    takeover = @{ title = 'Takeover'; apply = $true; description = 'Device inherited from another provider or Entra-only: identity migration, stale MDM cleanup, then the DE stack.' }
    replacement = @{ title = 'Replacement machine'; apply = $true; description = 'New device replacing an old one for the same user; same profile, new hardware record.' }
    repair = @{ title = 'Repair / reprovision'; apply = $true; description = 'Existing DE endpoint: health assessment, fix only what is missing or broken.' }
    'co-managed' = @{ title = 'Co-managed'; apply = $true; description = 'Client IT keeps parts of the stack; the client profile decides which DE actions run.' }
    deprovision = @{ title = 'Deprovision / offboarding'; apply = $true; description = 'Remove DE management and branding safely, preserve data, produce evidence.' }
}
function Get-DEModes { return $script:ModeActions }

function Import-DEConsoleModules {
    param([Parameter(Mandatory = $true)][string]$Root)
    foreach ($m in @('DE.Core', 'DE.Discovery', 'DE.Profiles', 'DE.Vendors', 'DE.Apps', 'DE.JumpCloud', 'DE.Identity', 'DE.Security', 'DE.Configure', 'DE.Operations', 'DE.Evidence')) {
        Import-Module (Join-Path $Root "modules\$m\$m.psm1") -Force -Global -DisableNameChecking
    }
}

function Initialize-DEWorkflow {
    <# Registers gates and all actions for this client profile. Returns the list of action ids in phase order. #>
    param($ClientProfile, [string]$Mode = 'audit')
    $de = Get-DEConsole
    $de.Actions.Clear(); $de.Gates.Clear(); Reset-DEGateCache
    Register-DEIdentityGates
    Register-DEOperationsActions -ClientProfile $ClientProfile
    Register-DEIdentityActions -ClientProfile $ClientProfile
    Register-DEJumpCloudActions -ClientProfile $ClientProfile
    Register-DESecurityActions -ClientProfile $ClientProfile
    Register-DEAppsActions -ClientProfile $ClientProfile
    Register-DEBaselineActions -ClientProfile $ClientProfile
    Register-DEBrowserActions -ClientProfile $ClientProfile
    Register-DEBrandingActions -ClientProfile $ClientProfile
    if ($Mode -eq 'deprovision') { Register-DEDeprovisionActions -ClientProfile $ClientProfile }
    $ids = @(Get-DEActions -Mode $Mode | ForEach-Object { $_.Id })
    Set-DEStateValue -Path 'workflow' -Value @{ mode = $Mode; client = (Get-DEHashPath -Object $ClientProfile -Path 'id'); actions = $ids.Count; initialised = (Get-Date).ToString('o') }
    return $ids
}

function Get-DENextAction {
    <#
    The next recommended action: first action in phase order that is not in desired state, whose gates pass,
    and whose secrets are present; otherwise the first blocked one with the unblock step. Returns why.
    #>
    param([string]$Mode = 'takeover')
    $latest = @{}; foreach ($e in Get-DEEvidence) { $latest[$e.step] = $e }
    $blocked = $null
    foreach ($a in Get-DEActions -Mode $Mode) {
        $e = $latest[$a.Id]
        if ($e -and $e.result -in @('PASS', 'NO CHANGE', 'EXCEPTION', 'SKIPPED')) { continue }
        $gates = Test-DEGatesSatisfied -Ids $a.Gates
        $missing = @($a.RequiresSecrets | Where-Object { $_ -and -not (Test-DESecret -Name $_) })
        if ($gates.Ok -and -not $missing.Count) {
            $why = if ($e) { "last result $($e.result): $($e.verification)" } else { 'not run yet' }
            return [pscustomobject]@{ id = $a.Id; title = $a.Title; module = $a.Module; phase = $a.Phase; runnable = $true; why = $why; manual = $a.ManualAction; destructive = $a.Destructive; secrets = @() }
        }
        if (-not $blocked) {
            $why = @(); if (-not $gates.Ok) { $why += 'waiting on: ' + (($gates.Failing | ForEach-Object { $_.Title }) -join ', ') }; if ($missing.Count) { $why += 'needs runtime secret(s): ' + ($missing -join ', ') }
            $blocked = [pscustomobject]@{ id = $a.Id; title = $a.Title; module = $a.Module; phase = $a.Phase; runnable = $false; why = ($why -join '; '); manual = (($gates.Failing | Where-Object { $_ -and $_.Unblock } | ForEach-Object { $_.Unblock }) -join ' ' ); destructive = $a.Destructive; secrets = $missing }
        }
    }
    if ($blocked) { return $blocked }
    return [pscustomobject]@{ id = $null; title = 'All actions for this mode are in desired state'; module = ''; phase = 99; runnable = $false; why = 'export the evidence bundle and push to the Hub'; manual = ''; destructive = $false; secrets = @() }
}

function Invoke-DEAudit {
    <# Runs every action in Audit mode (detect only). #>
    param([string]$Mode = 'audit')
    foreach ($a in Get-DEActions -Mode $(if ($Mode -eq 'audit') { 'audit' } else { $Mode })) { $null = Invoke-DEAction -Id $a.Id -Mode Audit }
    return (Get-DEGapReport)
}

function Invoke-DEPhase {
    [Diagnostics.CodeAnalysis.SuppressMessageAttribute('PSShouldProcess', '', Justification = 'WhatIf is forwarded to Invoke-DEAction, which calls ShouldProcess per action.')]
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][int]$Phase, [string]$Mode = 'takeover', [switch]$StopOnBlocked)
    $out = @()
    foreach ($a in Get-DEActions -Mode $Mode | Where-Object { $_ -and $_.Phase -eq $Phase }) {
        $r = Invoke-DEAction -Id $a.Id -Mode Apply -WhatIf:$WhatIfPreference
        $out += $r
        if ($StopOnBlocked -and $r.result -in @('BLOCKED', 'FAIL')) { break }
        if (@(Get-DERebootQueue | Where-Object { $_ }).Count) { Write-DELog -Level WARN -Message "restart queued during phase $Phase; stopping so the technician can restart"; break }
    }
    return $out
}

function Resume-DEWorkflow {
    <# Called when the console starts with -Resume: reloads context, clears the RunOnce, re-audits and returns the next action. #>
    $r = Get-DEResume
    Clear-DEResume
    $ctx = Get-DEState -Path 'context'; if ($ctx) { Set-DEContext -Values (ConvertTo-DEHashtable $ctx) }
    return $r
}

# ------------------------------------------------------------------ deprovision
function Register-DEDeprovisionActions {
    param($ClientProfile)
    Register-DEAction -Id 'deprov.data-preserved' -Module 'deprovision' -Title 'User data preserved (profile export or confirmed synced)' -Phase 1 -Modes @('deprovision') `
        -Detect { @{ confirmed = [bool](Get-DEState -Path 'deprovision.dataConfirmedAt') } } -Desired { @{ confirmed = $true } } `
        -ManualAction 'Confirm OneDrive / backup holds the user data or copy the profile to the client share; the console never deletes profiles.'
    Register-DEAction -Id 'deprov.branding' -Module 'deprovision' -Title 'Remove DE branding and shortcuts' -Phase 2 -Modes @('deprovision') -Gates @('gate.elevated') -RequiresElevation `
        -Detect { @{ applied = (Get-DEBrandingState).applied; shortcuts = (Test-Path -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts')) } } -Desired { @{ applied = $false; shortcuts = $false } } `
        -Apply { param($s) $null = Undo-DEBranding; Remove-Item -LiteralPath (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Digerati Experts') -Recurse -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath (Join-Path $env:PUBLIC 'Desktop\DE Support.url') -Force -ErrorAction SilentlyContinue; 'branding and shortcuts removed' }
    Register-DEAction -Id 'deprov.agents' -Module 'deprovision' -Title 'Remove DE-managed agents (with vendor uninstall tokens where required)' -Phase 3 -Modes @('deprovision') -Gates @('gate.elevated', 'deprov.gate.data') -RequiresElevation -Destructive `
        -Detect { $a = Get-DESecurityAgentState; @{ remaining = @(@('guardz', 'sentinelone', 'blackpoint', 'msp360', 'wazuh', 'timus') | Where-Object { $a.agents[$_].installed }).Count } } -Desired { @{ remaining = 0 } } `
        -ManualAction 'SentinelOne needs the passphrase from the console (enter as runtime secret S1_UNINSTALL_PASSPHRASE) or uninstall from the S1 console; Guardz and Blackpoint uninstall from their portals first so the device leaves the tenant cleanly.'
    Register-DEAction -Id 'deprov.jumpcloud' -Module 'deprovision' -Title 'Release the device from JumpCloud (keep the local account)' -Phase 4 -Modes @('deprovision') -Gates @('gate.elevated', 'deprov.gate.data') -RequiresElevation -Destructive `
        -Detect { @{ installed = (Get-DEJumpCloudAgentState).installed } } -Desired { @{ installed = $false } } `
        -ManualAction 'Delete the system from the JumpCloud console with "keep local users"; then uninstall the agent. The local account and its data stay.'
    Register-DEAction -Id 'deprov.breakglass' -Module 'deprovision' -Title 'Remove DE break-glass access' -Phase 5 -Modes @('deprovision') -Gates @('gate.elevated', 'deprov.gate.data') -RequiresElevation -Destructive `
        -Detect { @{ exists = (Get-DEBreakGlassState).exists } } -Desired { @{ exists = $false } } `
        -Apply { param($s) Remove-LocalUser -Name 'DE-BreakGlass'; Remove-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList' -Name 'DE-BreakGlass' -ErrorAction SilentlyContinue; 'break-glass removed' } `
        -ManualAction 'Only after the client has its own administrator on the device.'
    Register-DEGate -Id 'deprov.gate.data' -Title 'User data preservation confirmed' -Module 'deprovision' -Check { if (Get-DEState -Path 'deprovision.dataConfirmedAt') { @{ Status = 'PASS'; Detail = 'confirmed' } } else { @{ Status = 'BLOCKED'; Detail = 'data preservation not confirmed' } } } -Unblock 'Confirm data preservation first.'
}

# ------------------------------------------------------------------ background jobs (UI-independent)
function Start-DEBackgroundJob {
    <#
    Runs engine work in its own runspace so a window stays responsive. The runspace re-imports the modules and
    restores the data folder, context, secrets (SecureString only), redactions, client profile and mode, then
    runs $Work with $JobParams, $JobProfile and $JobMode in scope. Complete with Complete-DEBackgroundJob.
    #>
    param([Parameter(Mandatory = $true)][scriptblock]$Work, [hashtable]$Params = @{}, $ProfileId, [string]$Mode = 'audit')
    $de = Get-DEConsole
    $rs = [RunspaceFactory]::CreateRunspace(); $rs.ApartmentState = 'MTA'; $rs.Open()
    $vars = @{ JobRoot = $de.Root; JobDataDir = $de.Dirs.Base; JobSecrets = $de.Secrets; JobRedactions = @($de.Redactions); JobContext = $de.Context; JobProfileId = $ProfileId; JobMode = $Mode; JobDryRun = [bool]$de.DryRun; JobParams = $Params; JobLogFile = $de.LogFile }
    foreach ($k in $vars.Keys) { $rs.SessionStateProxy.SetVariable($k, $vars[$k]) }
    $prelude = {
        $ErrorActionPreference = 'Stop'
        Import-Module (Join-Path (Join-Path (Join-Path $JobRoot 'modules') 'DE.Workflow') 'DE.Workflow.psm1') -Force -DisableNameChecking
        Import-DEConsoleModules -Root $JobRoot
        $null = Initialize-DEConsole -Root $JobRoot -Mode $(if ($JobDryRun) { 'Audit' } else { 'Apply' }) -DataDir $JobDataDir -DryRun:$JobDryRun
        $c = Get-DEConsole; if ($JobLogFile) { $c.LogFile = $JobLogFile }
        foreach ($k in @($JobSecrets.Keys | Where-Object { $null -ne $_ })) { Set-DESecret -Name $k -SecureValue $JobSecrets[$k] }
        foreach ($r in $JobRedactions) { Register-DERedaction -Value $r }
        if ($JobContext) { Set-DEContext -Values $JobContext }
        $JobProfile = $null; if ($JobProfileId) { $JobProfile = Get-DEClientProfile -Id $JobProfileId; $null = Initialize-DEWorkflow -ClientProfile $JobProfile -Mode $JobMode }
    }
    $script = [scriptblock]::Create($prelude.ToString() + "`n" + '$__out = & {' + $Work.ToString() + '}' + "`n" + '@{ out = $__out; evidence = @(Get-DEEvidence); context = (Get-DEContext) }')
    $ps = [PowerShell]::Create(); $ps.Runspace = $rs
    [void]$ps.AddScript($script)
    return @{ ps = $ps; rs = $rs; handle = $ps.BeginInvoke(); started = Get-Date }
}
function Complete-DEBackgroundJob {
    <#
    Collects a finished job. Returns @{ ok; result = @{out; evidence; context}; failure; warnings }. A job that threw
    or returned nothing is ok = $false with the innermost error and its script line. Merges evidence and context
    into this session. Always disposes the runspace. Never throws.
    #>
    param([Parameter(Mandatory = $true)][hashtable]$Job, [switch]$NoMerge)
    $result = $null; $failure = $null; $warnings = @()
    try {
        $out = $Job.ps.EndInvoke($Job.handle)
        $items = @($out | ForEach-Object { if ($_ -is [System.Management.Automation.PSObject]) { $_.PSObject.BaseObject } else { $_ } })
        $result = @($items | Where-Object { $_ -is [System.Collections.IDictionary] -and $_.Contains('evidence') }) | Select-Object -Last 1
        $warnings = @($Job.ps.Streams.Error | ForEach-Object { Protect-DEText "$_" })
        if ($null -eq $result) { $failure = $(if ($warnings.Count) { $warnings[0] } else { 'the job returned no result' }) }
    } catch {
        $ex = $_.Exception; while ($ex.InnerException) { $ex = $ex.InnerException }
        $where = ''
        if ($ex -is [System.Management.Automation.IContainsErrorRecord] -and $ex.ErrorRecord -and $ex.ErrorRecord.InvocationInfo -and $ex.ErrorRecord.InvocationInfo.ScriptName) { $where = " (at $(Split-Path -Leaf $ex.ErrorRecord.InvocationInfo.ScriptName):$($ex.ErrorRecord.InvocationInfo.ScriptLineNumber))" }
        $failure = Protect-DEText "$($ex.Message)$where"
    } finally {
        try { $Job.ps.Dispose() } catch { }
        try { $Job.rs.Close(); $Job.rs.Dispose() } catch { }
    }
    if ($result -and -not $NoMerge) {
        $de = Get-DEConsole
        foreach ($e in @($result['evidence'])) { if ($e) { [void]$de.Evidence.Add($e); if ($e.result -eq 'FAIL' -and $de.ExitCode -eq 0) { $de.ExitCode = 1 } } }
        if ($result['context']) { Set-DEContext -Values (ConvertTo-DEHashtable $result['context']) }
    }
    return @{ ok = (-not $failure); result = $result; failure = $failure; warnings = $warnings }
}

Export-ModuleMember -Function Start-DEBackgroundJob, Complete-DEBackgroundJob, Get-DEModes, Import-DEConsoleModules, Initialize-DEWorkflow, Get-DENextAction, Invoke-DEAudit, Invoke-DEPhase, Resume-DEWorkflow, Register-DEDeprovisionActions
