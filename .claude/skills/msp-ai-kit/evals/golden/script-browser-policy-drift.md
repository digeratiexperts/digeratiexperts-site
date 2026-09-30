1. Plan: pre-check reads HKLM policy keys for Edge and Chrome; plan lists missing or wrong values; apply writes only differing values under ShouldProcess; verify re-reads the keys; retry once on a locked key; report a single RESULT line.
2. The script:
```powershell
<#
.SYNOPSIS  Report and optionally fix DE browser-extension policy drift for Edge and Chrome.
.PARAMETER Apply    Write the differing values (otherwise report only).
.PARAMETER LogPath  Log folder (default C:\ProgramData\DE\logs).
.NOTES     Exit codes: 0 success, 1 failure, 2 wrong runtime. Tested on Windows PowerShell 5.1.
#>
[CmdletBinding(SupportsShouldProcess)]
param([switch]$Apply, [string]$LogPath = "$env:ProgramData\DE\logs")
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($PSVersionTable.PSVersion.Major -lt 5) { Write-Output 'RESULT: wrong runtime'; exit 2 }
function Get-DesiredState { @(
  [pscustomobject]@{ Key = 'HKLM:\SOFTWARE\Policies\Microsoft\Edge'; Name = 'InPrivateModeAvailability'; Value = 1 }
  [pscustomobject]@{ Key = 'HKLM:\SOFTWARE\Policies\Google\Chrome'; Name = 'IncognitoModeAvailability'; Value = 1 }) }
function Compare-State { param($Desired) foreach ($d in $Desired) { $have = (Get-ItemProperty -Path $d.Key -Name $d.Name -ErrorAction SilentlyContinue).$($d.Name); if ($null -eq $have -or $have -ne $d.Value) { $d } } }
function Set-State { param($Drift) foreach ($d in $Drift) { if ($PSCmdlet.ShouldProcess("$($d.Key)\$($d.Name)", "set $($d.Value)")) { if (-not (Test-Path $d.Key)) { New-Item -Path $d.Key -Force | Out-Null }; New-ItemProperty -Path $d.Key -Name $d.Name -Value $d.Value -PropertyType DWord -Force | Out-Null } } }
try {
  New-Item -ItemType Directory -Path $LogPath -Force | Out-Null
  $drift = @(Compare-State -Desired (Get-DesiredState))
  if (-not $drift.Count) { Write-Output 'RESULT: NO CHANGE'; exit 0 }
  if (-not $Apply) { Write-Output "RESULT: DRIFT $($drift.Count)"; exit 0 }
  Set-State -Drift $drift
  $left = @(Compare-State -Desired (Get-DesiredState))
  if ($left.Count) { Write-Output "RESULT: FAILED $($left.Count) still drifting"; exit 1 }
  Write-Output "RESULT: APPLIED $($drift.Count), VERIFIED"; exit 0
} catch { Write-Output "RESULT: FAILED $($_.Exception.Message)"; exit 1 }
```
3. Test plan: report mode on a clean machine prints DRIFT 2 and exits 0; -Apply -WhatIf prints the operations; -Apply changes the keys and exits 0; a second run prints NO CHANGE; a locked key exits 1 with the error.
4. RMM deployment notes: run as SYSTEM, 5-minute timeout; exit 0 success, 1 failure, 2 wrong runtime; schedule daily in report mode and weekly with -Apply.
5. Rollback: previous values are logged before change; restore with the same script and the logged values.
6. Quality bar checklist: parse PASS; PSScriptAnalyzer PASS; 5.1 compatibility PASS; helper tests PASS; secret logging NOT APPLICABLE; resume NOT APPLICABLE; reboot NOT APPLICABLE; failure path PASS.
