<#
.SYNOPSIS
    CI / technician smoke test for the DE Technician Console window.
.DESCRIPTION
    Parses the console, verifies the XAML loads, then runs DETechConsole.ps1 -SmokeTest, which builds every
    page against the alamo example profile and renders each at 1440x900 and at a 1366x768 laptop's 125 percent
    layout (failing if the footer falls off-screen) without showing the window. Exit 0 when everything built; 1 otherwise. PNG renders land in -OutDir for visual review.
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
# stale renders from an earlier run must not satisfy the count
if (Test-Path -LiteralPath $OutDir) { Get-ChildItem -LiteralPath $OutDir -Filter '*.png' -ErrorAction SilentlyContinue | Remove-Item -Force }
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
# Start-Process joins arguments without quoting: quote anything with a space (C:\Users\Joe Smith\...)
$q = { param($v) if ("$v" -match '\s') { '"' + $v + [regex]::Match("$v", '\\*$').Value + '"' } else { "$v" } }
$argList = @(@('-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', $console, '-SmokeTest', '-SmokeClient', $Client, '-SmokeOut', $OutDir, '-DataDir', $data) | ForEach-Object { & $q $_ })
$p = Start-Process -FilePath $exe -ArgumentList $argList -Wait -PassThru -NoNewWindow
$big = @(Get-ChildItem -LiteralPath $OutDir -Filter '*-96dpi.png' -ErrorAction SilentlyContinue)
$small = @(Get-ChildItem -LiteralPath $OutDir -Filter '*-small-120dpi.png' -ErrorAction SilentlyContinue)
Write-Host ("GUI smoke exit {0}; {1} page(s) rendered at 1440x900 and {2} at 1366x768/125% in {3}" -f $p.ExitCode, $big.Count, $small.Count, $OutDir)
if ($p.ExitCode -ne 0) { exit $p.ExitCode }
if ($big.Count -lt 15 -or $small.Count -ne $big.Count) { Write-Host 'expected every page rendered at both sizes'; exit 1 }
exit 0
