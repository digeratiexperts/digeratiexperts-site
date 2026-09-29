#Requires -Version 5.1
<#
.SYNOPSIS
    Builds the DE boot rescue media (ISO and/or USB) from the Windows ADK + WinPE add-on.

.DESCRIPTION
    Run elevated on a DE build PC with the Windows ADK and the Windows PE add-on installed. Steps come from
    Get-DERescueBuildPlan (see -WhatIf for the full list): copype, mount boot.wim, add WMI / .NET / PowerShell /
    storage / DISM / BitLocker (SecureStartup) components with en-us language packs, optional drivers, copy the DE
    rescue and shared contracts to X:\DE, start the menu from startnet.cmd, save, then write the ISO and/or USB.
    Writing a USB FORMATS it; that needs -UsbDrive and -ConfirmFormat together. rescue.config.json carries only the
    technician default and the Hub URL; secrets are typed at the rescue prompt.

.EXAMPLE
    .\New-DERescueMedia.ps1 -IsoPath C:\DE\DE-Rescue.iso -WhatIf
    .\New-DERescueMedia.ps1 -IsoPath C:\DE\DE-Rescue.iso -HubUrl https://techsales.digerati-experts.com -Technician jrpetro
    .\New-DERescueMedia.ps1 -UsbDrive E: -ConfirmFormat -DriverPath C:\Drivers\WinPE
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$IsoPath,
    [ValidatePattern('^[A-Za-z]:$')][string]$UsbDrive,
    [switch]$ConfirmFormat,
    [string]$DriverPath,
    [string]$WorkDir = (Join-Path $env:TEMP 'DE-WinPE'),
    [string]$AdkRoot = (Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Assessment and Deployment Kit'),
    [string]$HubUrl,
    [string]$Technician
)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })
$windowsRoot = Split-Path -Parent $here
Import-Module (Join-Path $here 'DE.Rescue.psm1') -Force -DisableNameChecking

if (-not $IsoPath -and -not $UsbDrive) { throw 'Pass -IsoPath and/or -UsbDrive.' }
if ($UsbDrive -and -not $ConfirmFormat) { throw "-UsbDrive $UsbDrive formats that drive. Add -ConfirmFormat if that is what you want." }
if ($HubUrl -and $HubUrl -notmatch '^https://') { throw 'The Hub URL must be https://' }
if (-not (Test-Path -LiteralPath (Join-Path $AdkRoot 'Windows Preinstallation Environment'))) { throw "Windows PE add-on not found under $AdkRoot. Install the Windows ADK and the Windows PE add-on (learn.microsoft.com/windows-hardware/get-started/adk-install), or pass -AdkRoot." }
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run this from an elevated PowerShell (DISM needs administrator rights).' }
if (Test-Path -LiteralPath $WorkDir) { throw "$WorkDir already exists; remove it or pass another -WorkDir (copype needs an empty folder)." }

$plan = Get-DERescueBuildPlan -AdkRoot $AdkRoot -WorkDir $WorkDir -WindowsRoot $windowsRoot -IsoPath $IsoPath -UsbDrive $UsbDrive -DriverPath $DriverPath
$mount = Join-Path $WorkDir 'mount'
$mounted = $false
try {
    foreach ($s in $plan) {
        if (-not $PSCmdlet.ShouldProcess($s.id, $s.what)) { continue }
        Write-Host "==> $($s.what)" -ForegroundColor Cyan
        if ($s.ContainsKey('cmd')) { & $s.cmd @($s.args); if ($LASTEXITCODE -ne 0) { throw "$($s.id) failed (exit $LASTEXITCODE)" } }
        elseif ($s.ContainsKey('cmdlet')) { $p = $s.params; & $s.cmdlet @p | Out-Null; if ($s.id -eq 'mount') { $mounted = $true }; if ($s.id -eq 'unmount') { $mounted = $false } }
        elseif ($s.ContainsKey('copy')) { foreach ($c in $s.copy) { $parent = Split-Path -Parent $c.to; New-Item -ItemType Directory -Path $parent -Force | Out-Null; Copy-Item -LiteralPath $c.from -Destination $c.to -Recurse -Force } ; $cfg = [ordered]@{ technician = $Technician; hubUrl = $HubUrl; builtAt = (Get-Date).ToString('o') }; $cfg | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $mount 'DE\rescue\rescue.config.json') -Encoding UTF8 }
        elseif ($s.ContainsKey('write')) { [IO.File]::WriteAllText($s.write.path, $s.write.text, [Text.Encoding]::ASCII) }
    }
} finally {
    if ($mounted) { Write-Warning 'Build stopped with boot.wim mounted; discarding changes.'; Dismount-WindowsImage -Path $mount -Discard | Out-Null }
}
if ($IsoPath -and (Test-Path -LiteralPath $IsoPath)) { $h = (Get-FileHash -LiteralPath $IsoPath -Algorithm SHA256).Hash.ToLowerInvariant(); Set-Content -LiteralPath "$IsoPath.sha256" -Value "$h  $(Split-Path -Leaf $IsoPath)" -Encoding ASCII; Write-Host "ISO: $IsoPath (sha256 $h)" -ForegroundColor Green }
if ($UsbDrive) { Write-Host "Rescue USB written to $UsbDrive. Use a second NTFS/exFAT USB drive for profile backups (the rescue USB is FAT32)." -ForegroundColor Green }
