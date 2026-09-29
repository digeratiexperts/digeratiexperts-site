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
    .\Install-DETechConsole.ps1 -ZipPath C:\Temp\DE-TechTool-v1.5.0.zip -Sha256 <hash>
    .\Install-DETechConsole.ps1 -NoLaunch
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$ZipPath,
    [ValidatePattern('^([0-9a-fA-F]{64})?$')][string]$Sha256 = '',
    [string]$InstallDir,
    [switch]$NoLaunch
)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

function Write-Step { param([string]$Text, [string]$Color = 'Cyan') Write-Host $Text -ForegroundColor $Color }

# $PSScriptRoot is empty in param defaults on Windows PowerShell 5.1, so the default folder is worked out here
$here = $(if ($PSScriptRoot) { $PSScriptRoot } elseif ($MyInvocation.MyCommand.Path) { Split-Path -Parent $MyInvocation.MyCommand.Path } else { (Get-Location).Path })
if (-not $InstallDir) { $InstallDir = Join-Path $here 'DE-TechConsole' }
$stage = $null

try {
    if (-not $ZipPath) {
        $userHome = $(if ($env:USERPROFILE) { $env:USERPROFILE } else { $HOME })
        $places = @($here, (Get-Location).Path, $(if ($userHome) { Join-Path $userHome 'Downloads' })) | Where-Object { $_ } | Select-Object -Unique
        # DE-TechTool*.zip is the canonical package name; DE-TechConsole*.zip is what builds before 1.4 were called
        $found = @(foreach ($p in $places) { if (Test-Path -LiteralPath $p) { foreach ($pattern in @('DE-TechTool*.zip', 'DE-TechConsole*.zip')) { Get-ChildItem -LiteralPath $p -File -Filter $pattern -ErrorAction SilentlyContinue } } })
        if (-not $found.Count) { throw "No DE-TechTool*.zip (or older DE-TechConsole*.zip) found in: $($places -join '; '). Pass -ZipPath <file>." }
        $ZipPath = ($found | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
    }
    if (-not (Test-Path -LiteralPath $ZipPath)) { throw "Zip not found: $ZipPath" }
    Write-Step "Package: $ZipPath"

    $hash = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash
    if (-not $Sha256) { $side = "$ZipPath.sha256"; if (Test-Path -LiteralPath $side) { $Sha256 = ((Get-Content -LiteralPath $side -Raw -Encoding UTF8) -split '\s+')[0] } }
    if ($Sha256) {
        if ($hash -ne $Sha256.ToUpperInvariant()) { throw "sha256 mismatch: file is $hash, expected $($Sha256.ToUpperInvariant()). Re-download the package." }
        Write-Step "sha256 verified ($hash)" 'Green'
    } else { Write-Step "sha256 $hash (not checked: no -Sha256 given)" 'Yellow' }

    if (-not $PSCmdlet.ShouldProcess($InstallDir, 'install DE Tech Tool')) { return }
    # stage beside the install folder: a move within one volume cannot fail halfway (a TEMP-to-USB move can)
    $parent = Split-Path -Parent $InstallDir; if (-not $parent) { $parent = (Get-Location).Path }
    New-Item -ItemType Directory -Path $parent -Force | Out-Null
    $stage = Join-Path $parent (".de-install-{0}" -f ([guid]::NewGuid().ToString('N').Substring(0, 8)))
    Expand-Archive -LiteralPath $ZipPath -DestinationPath $stage -Force
    # Start-DETechTool.cmd is the canonical launcher; Start-DETechConsole.cmd is the compatibility alias older packages carry
    $launcher = @(foreach ($name in @('Start-DETechTool.cmd', 'Start-DETechConsole.cmd')) { Get-ChildItem -LiteralPath $stage -Recurse -File -Filter $name })
    if (-not $launcher.Count) { throw 'This zip contains neither Start-DETechTool.cmd nor Start-DETechConsole.cmd; it is not a DE Tech Tool package.' }
    $launcherName = $launcher[0].Name
    $kitRoot = Split-Path -Parent (Split-Path -Parent $launcher[0].FullName)   # ...\msp-ai-kit

    # swap safely: the old copy is set aside, the new one moved in, and only then is the older backup replaced;
    # if the move fails the old copy goes straight back, so there is always a working install
    $backup = "$InstallDir.previous"; $aside = "$InstallDir.replacing"
    if (Test-Path -LiteralPath $aside) { Remove-Item -LiteralPath $aside -Recurse -Force }
    $hadOld = Test-Path -LiteralPath $InstallDir
    if ($hadOld) { Move-Item -LiteralPath $InstallDir -Destination $aside }
    try { Move-Item -LiteralPath $kitRoot -Destination $InstallDir }
    catch { if ($hadOld -and -not (Test-Path -LiteralPath $InstallDir)) { Move-Item -LiteralPath $aside -Destination $InstallDir }; throw }
    if ($hadOld) {
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        Move-Item -LiteralPath $aside -Destination $backup
        Write-Step "Previous copy kept at $backup" 'Yellow'
    }
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    if ($env:OS -eq 'Windows_NT') { Get-ChildItem -LiteralPath $InstallDir -Recurse -File | Unblock-File }   # clears the downloaded-from-internet mark

    $versionFile = Join-Path $InstallDir 'windows\console\VERSION'
    $version = $(if (Test-Path -LiteralPath $versionFile) { (Get-Content -LiteralPath $versionFile -Raw -Encoding UTF8).Trim() } else { 'unknown' })
    $start = Join-Path (Join-Path $InstallDir 'windows') $launcherName
    Write-Step "Installed DE Tech Tool v$version to $InstallDir" 'Green'
    Write-Step "Start it any time with: $start"
    if (-not $NoLaunch) { Start-Process -FilePath $start -WorkingDirectory (Split-Path -Parent $start) | Out-Null }
    exit 0
} catch {
    Write-Step "Install failed: $($_.Exception.Message)" 'Red'
    if ($stage -and (Test-Path -LiteralPath $stage)) { Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue }
    exit 1
}
