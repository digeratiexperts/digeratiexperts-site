<#
.SYNOPSIS
    Stages the DE Tech Tool as an Intune Win32 app (.intunewin) with install, uninstall and detection.

.DESCRIPTION
    Writes packaging\out\intune\source with:
      windows\            the console (copy of this package, tests excluded)
      install.cmd         copies to %ProgramFiles%\DE\TechConsole and adds a Start menu shortcut
      uninstall.cmd       removes the install folder and shortcut (client data under %ProgramData%\DE is kept)
    and packaging\out\intune\Detect-DETechConsole.ps1 for the Intune detection rule (custom script).
    When -IntuneWinAppUtil points at Microsoft's IntuneWinAppUtil.exe the .intunewin is built too; otherwise the
    command to run is printed. DE devices are normally JumpCloud-managed; use this only for Intune-managed or
    co-managed clients where Intune is the agreed MDM authority.

.EXAMPLE
    .\New-DEIntunePackage.ps1 -IntuneWinAppUtil C:\Tools\IntuneWinAppUtil.exe
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Root,
    [string]$OutDir,
    [string]$IntuneWinAppUtil
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })   # $PSScriptRoot can be empty in param defaults on Windows PowerShell 5.1
if (-not $Root) { $Root = Split-Path -Parent $here }
if (-not $OutDir) { $OutDir = Join-Path (Join-Path $here 'out') 'intune' }
$version = '0.0.0'; $vf = Join-Path (Split-Path -Parent $Root) 'kit.version'; if (Test-Path -LiteralPath $vf) { $version = (Get-Content -LiteralPath $vf -Raw).Trim() }
$src = Join-Path $OutDir 'source'
if (-not $PSCmdlet.ShouldProcess($OutDir, "stage Intune package $version")) { return }
if (Test-Path -LiteralPath $src) { Remove-Item -LiteralPath $src -Recurse -Force }
New-Item -ItemType Directory -Path (Join-Path $src 'windows') -Force | Out-Null
foreach ($item in Get-ChildItem -LiteralPath $Root) {
    if ($item.Name -in @('tests')) { continue }
    if ($item.Name -eq 'packaging') {
        # every packaging script is listed in integrity.json, so ship them all (never the out\ build folder)
        New-Item -ItemType Directory -Path (Join-Path $src 'windows\packaging') -Force | Out-Null
        Get-ChildItem -LiteralPath $item.FullName -File | Copy-Item -Destination (Join-Path $src 'windows\packaging')
        continue
    }
    Copy-Item -LiteralPath $item.FullName -Destination (Join-Path $src 'windows') -Recurse -Force
}
Set-Content -LiteralPath (Join-Path $src 'windows\VERSION') -Value $version -Encoding ASCII

$install = @'
@echo off
rem DE Tech Tool - Intune install (runs as SYSTEM)
set "DEST=%ProgramFiles%\DE\TechConsole"
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy "%~dp0windows\*" "%DEST%\" /e /i /q /y >nul || exit /b 1
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut(\"$env:ProgramData\Microsoft\Windows\Start Menu\Programs\DE Tech Tool.lnk\"); $s.TargetPath=\"$env:ProgramFiles\DE\TechConsole\Start-DETechTool.cmd\"; $s.WorkingDirectory=\"$env:ProgramFiles\DE\TechConsole\"; $s.Save()"
exit /b 0
'@
$uninstall = @'
@echo off
rem DE Tech Tool - Intune uninstall. Client evidence under %ProgramData%\DE is kept on purpose.
del /q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\DE Tech Tool.lnk" 2>nul
if exist "%ProgramFiles%\DE\TechConsole" rmdir /s /q "%ProgramFiles%\DE\TechConsole"
exit /b 0
'@
$detect = @"
# Intune detection rule for the DE Tech Tool $version. Exit 0 with output = installed.
`$dir = Join-Path `$env:ProgramFiles 'DE\TechConsole'
`$v = Join-Path `$dir 'VERSION'
if ((Test-Path -LiteralPath (Join-Path `$dir 'console\DETechConsole.ps1')) -and (Test-Path -LiteralPath `$v) -and ((Get-Content -LiteralPath `$v -Raw).Trim() -eq '$version')) { Write-Output 'DE Tech Tool $version installed'; exit 0 }
exit 1
"@
Set-Content -LiteralPath (Join-Path $src 'install.cmd') -Value $install -Encoding ASCII
Set-Content -LiteralPath (Join-Path $src 'uninstall.cmd') -Value $uninstall -Encoding ASCII
Set-Content -LiteralPath (Join-Path $OutDir 'Detect-DETechConsole.ps1') -Value $detect -Encoding UTF8
Write-Host "Staged $src (version $version)"
Write-Host "Intune: install command 'install.cmd', uninstall command 'uninstall.cmd', install behavior System, detection = custom script Detect-DETechConsole.ps1"
if ($IntuneWinAppUtil) {
    if (-not (Test-Path -LiteralPath $IntuneWinAppUtil)) { throw "IntuneWinAppUtil not found at $IntuneWinAppUtil" }
    & $IntuneWinAppUtil -c $src -s 'install.cmd' -o $OutDir -q
    if ($LASTEXITCODE -ne 0) { throw "IntuneWinAppUtil exit $LASTEXITCODE" }
    Write-Host "Built $(Join-Path $OutDir 'install.intunewin')"
} else {
    Write-Host "To build the .intunewin: IntuneWinAppUtil.exe -c `"$src`" -s install.cmd -o `"$OutDir`" -q"
}
