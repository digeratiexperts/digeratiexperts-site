<#
.SYNOPSIS
    One-file installer for the DE Tech Tool: unpack the newest zip, unblock it, replace the old copy,
    and launch the console.

.DESCRIPTION
    Put this file next to the DE-TechConsole-and-MSP-AI-Kit-*.zip you downloaded (or pass -ZipPath), then run:

        powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Install-DETechConsole.ps1

    It:
      1. picks the newest DE-TechTool*.zip next to this script, in the current folder or in Downloads;
      2. checks its sha256 when you pass -Sha256 (or when a matching .sha256 file sits next to it);
      3. moves any previous copy aside (one backup kept), so an old build can never be run by mistake;
      4. unpacks, clears the "downloaded from the internet" block on every file (Unblock-File);
      5. prints the version and opens the console (it asks for administrator rights).
    Nothing is sent anywhere and no secret is asked for here.

.EXAMPLE
    .\Install-DETechConsole.ps1
    .\Install-DETechConsole.ps1 -ZipPath C:\Temp\DE-TechConsole-and-MSP-AI-Kit-v1.3.4.zip -Sha256 <hash>
    .\Install-DETechConsole.ps1 -NoLaunch
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ZipPath,
    [ValidatePattern('^([0-9a-fA-F]{64})?$')][string]$Sha256 = '',
    [string]$InstallDir = (Join-Path $(if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path }) 'DE-TechConsole'),
    [switch]$NoLaunch
)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

function Write-Step { param([string]$Text, [string]$Color = 'Cyan') Write-Host $Text -ForegroundColor $Color }

try {
    if (-not $ZipPath) {
        $here = $(if ($PSScriptRoot) { $PSScriptRoot } else { (Get-Location).Path })
        $places = @($here, (Get-Location).Path, (Join-Path $env:USERPROFILE 'Downloads')) | Select-Object -Unique
        $found = @(foreach ($p in $places) { if (Test-Path -LiteralPath $p) { Get-ChildItem -LiteralPath $p -File -Filter 'DE-TechTool*.zip' -ErrorAction SilentlyContinue } })
        if (-not $found.Count) { throw "No DE-TechTool*.zip found in: $($places -join '; '). Pass -ZipPath <file>." }
        $ZipPath = ($found | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    }
    if (-not (Test-Path -LiteralPath $ZipPath)) { throw "Zip not found: $ZipPath" }
    Write-Step "Package: $ZipPath"

    $hash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
    if (-not $Sha256) { $side = "$ZipPath.sha256"; if (Test-Path -LiteralPath $side) { $Sha256 = ((Get-Content -LiteralPath $side -Raw) -split '\s+')[0] } }
    if ($Sha256) {
        if ($hash -ne $Sha256.ToUpperInvariant()) { throw "sha256 mismatch: file is $hash, expected $($Sha256.ToUpperInvariant()). Re-download the package." }
        Write-Step "sha256 verified ($hash)" 'Green'
    } else { Write-Step "sha256 $hash (not checked: no -Sha256 given)" 'Yellow' }

    if (-not $PSCmdlet.ShouldProcess($InstallDir, 'install DE Tech Tool')) { return }
    $stage = Join-Path ([IO.Path]::GetTempPath()) ("de-techconsole-{0}" -f ([guid]::NewGuid()))
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $stage -Force
    $launcher = @(Get-ChildItem -LiteralPath $stage -Recurse -File -Filter 'Start-DETechTool.cmd' | Select-Object -First 1)
    if (-not $launcher.Count) { throw 'This zip does not contain Start-DETechTool.cmd; it is not a DE Tech Tool package.' }
    $kitRoot = Split-Path -Parent (Split-Path -Parent $launcher[0].FullName)   # ...\msp-ai-kit

    if (Test-Path -LiteralPath $InstallDir) {
        $backup = "$InstallDir.previous"
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        Move-Item -LiteralPath $InstallDir -Destination $backup
        Write-Step "Previous copy kept at $backup" 'Yellow'
    }
    New-Item -ItemType Directory -Path (Split-Path -Parent $InstallDir) -Force | Out-Null
    Move-Item -LiteralPath $kitRoot -Destination $InstallDir
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    if ($env:OS -eq 'Windows_NT') { Get-ChildItem -LiteralPath $InstallDir -Recurse -File | Unblock-File }   # clears the downloaded-from-internet mark

    $versionFile = Join-Path $InstallDir 'windows\console\VERSION'
    $version = $(if (Test-Path -LiteralPath $versionFile) { (Get-Content -LiteralPath $versionFile -Raw).Trim() } else { 'unknown' })
    $start = Join-Path $InstallDir 'windows\Start-DETechTool.cmd'
    Write-Step "Installed DE Tech Tool v$version to $InstallDir" 'Green'
    Write-Step "Start it any time with: $start"
    if (-not $NoLaunch) { Start-Process -FilePath $start -WorkingDirectory (Split-Path -Parent $start) | Out-Null }
    exit 0
} catch {
    Write-Step "Install failed: $($_.Exception.Message)" 'Red'
    exit 1
}
