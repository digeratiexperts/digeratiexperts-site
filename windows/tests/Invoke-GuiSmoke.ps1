<#
.SYNOPSIS
    CI / technician smoke test for the DE Technician Console window.
.DESCRIPTION
    Parses the console, verifies the XAML loads, then runs DETechConsole.ps1 -SmokeTest, which builds every
    page against the alamo example profile and renders each at 100 and 200 percent scale without showing the
    window. Exit 0 when everything built; 1 otherwise. PNG renders land in -OutDir for visual review.
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\windows\tests\Invoke-GuiSmoke.ps1 -OutDir $env:TEMP\de-smoke
#>
[CmdletBinding()]
param([string]$OutDir = (Join-Path ([IO.Path]::GetTempPath()) 'de-console-smoke'), [string]$Client = 'alamo')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$console = Join-Path (Split-Path -Parent $PSScriptRoot) 'console\DETechConsole.ps1'
if ($env:OS -ne 'Windows_NT') { Write-Host 'GUI smoke needs Windows (WPF); skipped.'; exit 0 }

$errs = $null
[void][System.Management.Automation.Language.Parser]::ParseFile($console, [ref]$null, [ref]$errs)
if (@($errs).Count) { $errs | ForEach-Object { Write-Host "parse: line $($_.Extent.StartLineNumber) $($_.Message)" }; exit 1 }

$exe = (Get-Process -Id $PID).Path
$data = Join-Path ([IO.Path]::GetTempPath()) ("de-smoke-data-{0}" -f ([guid]::NewGuid()))
$p = Start-Process -FilePath $exe -ArgumentList @('-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', $console, '-SmokeTest', '-SmokeClient', $Client, '-SmokeOut', $OutDir, '-DataDir', $data) -Wait -PassThru -NoNewWindow
$pngs = @(Get-ChildItem -LiteralPath $OutDir -Filter '*.png' -ErrorAction SilentlyContinue)
Write-Host ("GUI smoke exit {0}; {1} render(s) in {2}" -f $p.ExitCode, $pngs.Count, $OutDir)
if ($p.ExitCode -ne 0) { exit $p.ExitCode }
if ($pngs.Count -lt 28) { Write-Host 'expected 14 pages x 2 scales of renders'; exit 1 }
exit 0
