#Requires -Version 5.1
<#
.SYNOPSIS
    Security deployment engine: Guardz Device Agent (primary), SentinelOne
    (EDR), Blackpoint SNAP (backup MDR when the client profile says so),
    Prisma Browser Extension / PABX policy, conflicting-EDR detection,
    Defender passive-mode expectation, sanitized installer diagnostics.

.DESCRIPTION
    All installs go through the package catalog (DE.Apps) so the trust policy
    and runtime-only secrets apply. Verification is service/process/policy
    state, never the installer's exit code. Organization keys and site tokens
    are never persisted.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

function Get-DESecurityPosture {
    <# One view for the dashboard: each component installed / running / verified plus conflicts. #>
    param($ClientProfile)
    $agents = Get-DESecurityAgentState
    $want = @{
        guardz = (@(Get-DEHashPath -Object $ClientProfile -Path 'security.mdr.deploy' | Where-Object { $null -ne $_ }) -contains 'guardz') -or (-not (Get-DEHashPath -Object $ClientProfile -Path 'security.mdr.deploy'))
        blackpoint = (@(Get-DEHashPath -Object $ClientProfile -Path 'security.mdr.deploy' | Where-Object { $null -ne $_ }) -contains 'blackpoint')
        sentinelone = ((Get-DEHashPath -Object $ClientProfile -Path 'security.edr') -in @('sentinelone', $null, ''))
        pabx = (@(Get-DEHashPath -Object $ClientProfile -Path 'security.browserSecurity' | Where-Object { $null -ne $_ }) -contains 'pabx') -or (-not (Get-DEHashPath -Object $ClientProfile -Path 'security.browserSecurity'))
    }
    $pabx = Test-DEPackageInstalled -Package (Get-DEPackage -Id 'pabx-policy') -ClientProfile $ClientProfile
    return @{
        guardz = @{ required = $want.guardz; installed = $agents.agents['guardz'].installed; running = $agents.agents['guardz'].running; role = 'primary' }
        sentinelone = @{ required = $want.sentinelone; installed = $agents.agents['sentinelone'].installed; running = $agents.agents['sentinelone'].running }
        blackpoint = @{ required = $want.blackpoint; installed = $agents.agents['blackpoint'].installed; running = $agents.agents['blackpoint'].running; role = 'backup' }
        pabx = @{ required = $want.pabx; applied = $pabx.installed; evidence = $pabx.evidence }
        conflictingEdr = $agents.conflictingEdr
        defender = $agents.defender
        wazuh = @{ installed = $agents.agents['wazuh'].installed; running = $agents.agents['wazuh'].running }
    }
}

function Get-DESanitizedInstallerDiagnostics {
    <# Last lines of vendor installer logs with secrets redacted, for the diagnostic bundle. #>
    $files = @("$env:ProgramData\Sentinel\Logs\*.log", "$env:ProgramFiles\Guardz\*.log", "$env:ProgramData\Guardz\*.log", "$env:TEMP\*Sentinel*.log", "$env:TEMP\*guardz*.log", "$env:TEMP\MSI*.LOG")
    $out = @()
    foreach ($g in $files) { foreach ($f in @(Get-ChildItem -Path $g -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 2)) { try { $tail = @(Get-Content -LiteralPath $f.FullName -Tail 40 -ErrorAction Stop) | ForEach-Object { Protect-DEText $_ }; $out += @{ file = $f.FullName; modified = $f.LastWriteTime.ToString('o'); tail = $tail } } catch { } } }
    return $out
}

function Register-DESecurityActions {
    param($ClientProfile)
    $deployBlackpoint = (@(Get-DEHashPath -Object $ClientProfile -Path 'security.mdr.deploy' | Where-Object { $null -ne $_ }) -contains 'blackpoint')

    Register-DEAction -Id 'security.edr-conflicts' -Module 'security' -Title 'No conflicting EDR / AV before SentinelOne' -Phase 8 `
        -Detect { $a = Get-DESecurityAgentState; @{ conflicts = @($a.conflictingEdr).Count; names = (@($a.conflictingEdr) -join ', ') } } -Desired { @{ conflicts = 0 } } `
        -ManualAction 'Uninstall the competing product with its vendor tool (Apps > Remove) before installing SentinelOne; two kernel EDR agents on one machine is a support ticket waiting to happen.'

    Register-DEAction -Id 'security.sentinelone' -Module 'security' -Title 'SentinelOne agent installed, running, current' -Phase 8 -Gates @('gate.elevated') -RequiresElevation -RequiresSecrets @('S1_SITE_TOKEN') `
        -Detect { $p = Get-DEPackage -Id 'sentinelone-agent'; $d = Test-DEPackageInstalled -Package $p -ClientProfile $ClientProfile; $svc = Get-DEServiceState -Name 'SentinelAgent'; @{ installed = $d.installed; running = ($svc.status -eq 'Running'); versionOk = $d.versionOk; version = $d.version } }.GetNewClosure() `
        -Desired { @{ installed = $true; running = $true; versionOk = $true } } `
        -Apply { param($s) $a = Get-DESecurityAgentState; if (@($a.conflictingEdr).Count) { throw "conflicting EDR present: $($a.conflictingEdr -join ', ')" }; $r = Invoke-DEPackageInstall -Id 'sentinelone-agent' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }; if ($r.rebootRequired) { Request-DEReboot -Reason 'SentinelOne requested a restart' -ResumeAction 'security.sentinelone' | Out-Null }; Start-Sleep -Seconds 30; $r.detail }.GetNewClosure() `
        -Remediate { param($s) try { Start-Service -Name 'SentinelAgent' -ErrorAction Stop } catch { $null = Invoke-DEPackageInstall -Id 'sentinelone-agent' -ClientProfile $ClientProfile -Repair } }.GetNewClosure() `
        -Verify { param($after) $svc = Get-DEServiceState -Name 'SentinelAgent'; @{ ok = ($svc.present -and $svc.status -eq 'Running'); detail = "SentinelAgent $($svc.status)" } } `
        -Description 'Site token is runtime-only. Console health (Sentinels > this device) is the final word on registration.'

    Register-DEAction -Id 'security.guardz' -Module 'security' -Title 'Guardz Device Agent installed and running (primary security platform)' -Phase 8 -Gates @('gate.elevated') -RequiresElevation -RequiresSecrets @('GUARDZ_ORG_KEY') `
        -Detect { $p = Get-DEPackage -Id 'guardz-agent'; $d = Test-DEPackageInstalled -Package $p -ClientProfile $ClientProfile; $a = Get-DESecurityAgentState; @{ installed = $d.installed; running = $a.agents['guardz'].running } }.GetNewClosure() `
        -Desired { @{ installed = $true; running = $true } } `
        -Apply { param($s) $r = Invoke-DEPackageInstall -Id 'guardz-agent' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }; Start-Sleep -Seconds 20; $r.detail }.GetNewClosure() `
        -Remediate { param($s) $null = Invoke-DEPackageInstall -Id 'guardz-agent' -ClientProfile $ClientProfile -Repair }.GetNewClosure() `
        -Verify { param($after) $a = Get-DESecurityAgentState; @{ ok = ($a.agents['guardz'].installed -and $a.agents['guardz'].running); detail = "guardz installed=$($a.agents['guardz'].installed) running=$($a.agents['guardz'].running)" } } `
        -Description 'Organization key is runtime-only. Organization association is confirmed in app.us.guardz.com/msp > Devices; the console records the check, it cannot query Guardz without an API.'

    if ($deployBlackpoint) {
        Register-DEAction -Id 'security.blackpoint' -Module 'security' -Title 'Blackpoint SNAP agent installed (backup MDR per client profile)' -Phase 8 -Gates @('gate.elevated') -RequiresElevation `
            -Detect { $a = Get-DESecurityAgentState; @{ installed = $a.agents['blackpoint'].installed; running = $a.agents['blackpoint'].running } } -Desired { @{ installed = $true; running = $true } } `
            -Apply { param($s) $r = Invoke-DEPackageInstall -Id 'blackpoint-snap' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }; $r.detail }.GetNewClosure()
    } else {
        Register-DEAction -Id 'security.blackpoint' -Module 'security' -Title 'Blackpoint not deployed (Guardz is primary; Blackpoint is the approved backup)' -Phase 8 `
            -Detect { $a = Get-DESecurityAgentState; @{ installed = $a.agents['blackpoint'].installed } } -Desired { @{ installed = $false } } `
            -ManualAction 'If Blackpoint is present from a previous provider, decide with the client whether it stays (add blackpoint to security.mdr.deploy) or is removed.'
    }

    Register-DEAction -Id 'security.pabx' -Module 'security' -Title 'Prisma Browser Extension policy applied (forced extension, no private browsing)' -Phase 8 -Gates @('gate.elevated') -RequiresElevation `
        -Detect { $p = Get-DEPackage -Id 'pabx-policy'; $d = Test-DEPackageInstalled -Package $p -ClientProfile $ClientProfile; @{ applied = $d.installed; evidence = ($d.evidence -join '; ') } }.GetNewClosure() -Desired { @{ applied = $true } } `
        -Apply { param($s) $r = Invoke-DEPackageInstall -Id 'pabx-policy' -ClientProfile $ClientProfile; if (-not $r.ok -and -not (Get-DEPkgProp $r 'planned')) { throw $r.detail }; $r.detail }.GetNewClosure() `
        -Verify { param($after) $d = Test-DEPackageInstalled -Package (Get-DEPackage -Id 'pabx-policy') -ClientProfile $ClientProfile; @{ ok = $d.installed; detail = ($d.evidence -join '; ') } }.GetNewClosure() `
        -Description 'Runs the DE-supplied install-pabx_no-private-browsing.ps1 from the packages folder; browsers must be restarted for the policy to load.'

    Register-DEAction -Id 'security.defender-passive' -Module 'security' -Title 'Microsoft Defender in passive mode alongside the EDR' -Phase 8 `
        -Detect { $a = Get-DESecurityAgentState; $s1 = $a.agents['sentinelone'].installed; $mode = "$(Get-DEHashPath -Object $a -Path 'defender.runningMode')"; @{ acceptable = (-not $s1) -or ($mode -match 'Passive|Not running|EDR Block') -or (-not $mode); mode = $mode } } -Desired { @{ acceptable = $true } } `
        -ManualAction 'Defender should drop to passive automatically once a third-party EDR registers with Windows Security Center; if it stays active, check Security Center registration of the EDR.'
}

Export-ModuleMember -Function Get-DESecurityPosture, Get-DESanitizedInstallerDiagnostics, Register-DESecurityActions
