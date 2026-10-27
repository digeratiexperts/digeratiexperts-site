<#
.SYNOPSIS
    Run the same checks CI runs before pushing DE Tech Tool changes.

.DESCRIPTION
    Local pre-push gate for the windows/ tree. Mirrors the "Windows loader and Technician
    Console (PowerShell 5.1 + WPF)" job in .github/workflows/msp-ai-kit.yml:

      1. PSScriptAnalyzer with windows/tests/PSScriptAnalyzerSettings.psd1  (errors fail)
      2. A parse pass over every *.ps1 / *.psm1 under Windows PowerShell 5.1
      3. The Pester suite over windows/tests and windows/console/tests

    If this passes locally, the CI job should pass. The one thing it cannot reproduce is
    environment-dependent behaviour (ACLs, installed agents), which is how issues #834 and
    #835 hid from CI - so a green local run is necessary, not sufficient.

    Install as a git hook so it runs on every push:

        $hook = Join-Path (git rev-parse --git-dir) 'hooks/pre-push'
        Copy-Item 'windows/tests/Invoke-PrePushCheck.ps1' $hook   # or symlink

    or just run it by hand:

        powershell -File windows/tests/Invoke-PrePushCheck.ps1

.PARAMETER SkipPester
    Analyzer and parse only. Use while iterating; run the full check before pushing.

.PARAMETER SkipAnalyzer
    Pester only. Use when a test failure is the thing under investigation.

.PARAMETER WarningsAllowed
    Analyzer warnings at or below this count pass. Default -1 means "report but do not
    block". Set it to the current known count to stop the warning total creeping back up.

.PARAMETER FailuresAllowed
    Pester failures at or below this count pass. Default 0 - strict. Raise it to
    acknowledge a known set of failures (for example environment-dependent ones that only
    reproduce on certain hosts) so the gate still blocks anything NEW. Lower it back to 0
    once they are fixed.

.EXAMPLE
    powershell -File windows/tests/Invoke-PrePushCheck.ps1

.EXAMPLE
    powershell -File windows/tests/Invoke-PrePushCheck.ps1 -SkipPester
#>
[CmdletBinding()]
param(
    [switch]$SkipPester,
    [switch]$SkipAnalyzer,
    [int]$WarningsAllowed = -1,
    [int]$FailuresAllowed = 0
)

$ErrorActionPreference = 'Stop'
$script:Failed = $false

# windows/tests -> windows -> msp-ai-kit
$Windows = Split-Path -Parent $PSScriptRoot
$Kit = Split-Path -Parent $Windows
$Settings = Join-Path $PSScriptRoot 'PSScriptAnalyzerSettings.psd1'
$TestPaths = @((Join-Path $Windows 'tests'), (Join-Path $Windows 'console\tests'))

function Write-Step([string]$Name) { Write-Host ''; Write-Host ('=== ' + $Name + ' ===') -ForegroundColor Cyan }
function Write-Ok([string]$Msg) { Write-Host ('  OK   ' + $Msg) -ForegroundColor Green }
function Write-Bad([string]$Msg) { Write-Host ('  FAIL ' + $Msg) -ForegroundColor Red; $script:Failed = $true }

# ------------------------------------------------------------------ 1. PSScriptAnalyzer
if (-not $SkipAnalyzer) {
    Write-Step 'PSScriptAnalyzer (same invocation as CI)'
    if (-not (Get-Module -ListAvailable -Name PSScriptAnalyzer)) {
        Write-Bad 'PSScriptAnalyzer is not installed. Run: Install-Module PSScriptAnalyzer -Scope CurrentUser -Force'
    } else {
        Import-Module PSScriptAnalyzer
        $results = @(Invoke-ScriptAnalyzer -Path $Windows -Recurse -Settings $Settings)
        $errors = @($results | Where-Object Severity -eq 'Error')
        $warnings = @($results | Where-Object Severity -eq 'Warning')
        Write-Host ('  ' + $results.Count + ' finding(s): ' + $errors.Count + ' error(s), ' + $warnings.Count + ' warning(s)')
        foreach ($r in $results) {
            $tag = if ($r.Severity -eq 'Error') { 'ERROR' } else { 'warn ' }
            Write-Host ('    [' + $tag + '] ' + (Split-Path $r.ScriptPath -Leaf) + ':' + $r.Line + ' ' + $r.RuleName)
        }
        if ($errors.Count) { Write-Bad ('PSScriptAnalyzer reported ' + $errors.Count + ' error(s)') }
        else { Write-Ok 'no analyzer errors' }

        if ($WarningsAllowed -ge 0) {
            if ($warnings.Count -gt $WarningsAllowed) {
                Write-Bad ('warnings grew from ' + $WarningsAllowed + ' to ' + $warnings.Count + '; new ones should be justified')
            } else {
                Write-Ok ('warnings ' + $warnings.Count + ' is at or under the allowed ' + $WarningsAllowed)
            }
        }
    }

    # -------------------------------------------------------------- 2. parse under 5.1
    Write-Step ('Parse every script under Windows PowerShell ' + $PSVersionTable.PSVersion)
    $parseErrors = 0
    foreach ($f in @(Get-ChildItem -Path $Windows -Recurse -Include *.ps1, *.psm1 -File)) {
        $errs = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$null, [ref]$errs)
        if ($errs.Count) {
            $parseErrors += $errs.Count
            foreach ($e in $errs) { Write-Bad ($f.Name + ':' + $e.Extent.StartLineNumber + ' ' + $e.Message) }
        }
    }
    if ($parseErrors -eq 0) { Write-Ok 'every script parses' }
}

# ------------------------------------------------------------------ 3. Pester
if (-not $SkipPester) {
    Write-Step 'Pester (same paths as CI)'
    if (-not (Get-Module -ListAvailable -Name Pester)) {
        Write-Bad 'Pester is not installed. Run: Install-Module Pester -MinimumVersion 5.5 -MaximumVersion 5.99.99 -Scope CurrentUser -Force'
    } else {
        Import-Module Pester -MinimumVersion 5.5 -MaximumVersion 5.99.99 -ErrorAction Stop
        $cfg = New-PesterConfiguration
        $cfg.Run.Path = $TestPaths
        $cfg.Run.PassThru = $true
        $cfg.Run.Exit = $false
        $cfg.Output.Verbosity = 'Normal'
        $r = Invoke-Pester -Configuration $cfg
        Write-Host ('  ' + $r.PassedCount + ' passed, ' + $r.FailedCount + ' failed, ' + $r.SkippedCount + ' skipped')
        foreach ($t in @($r.Failed)) {
            if ($r.FailedCount -le $FailuresAllowed) { Write-Host ('  known  ' + $t.ExpandedPath) -ForegroundColor Yellow }
            else { Write-Bad $t.ExpandedPath }
        }
        if ($r.FailedCount -eq 0) { Write-Ok 'Pester suite green' }
        elseif ($r.FailedCount -le $FailuresAllowed) {
            Write-Ok ($r.FailedCount + ' known failure(s) acknowledged (allowance ' + $FailuresAllowed + ')')
        }
    }
}

Write-Host ''
if ($script:Failed) {
    Write-Host 'PRE-PUSH CHECK FAILED - do not push yet.' -ForegroundColor Red
    exit 1
}
Write-Host 'PRE-PUSH CHECK PASSED - safe to push.' -ForegroundColor Green
exit 0
