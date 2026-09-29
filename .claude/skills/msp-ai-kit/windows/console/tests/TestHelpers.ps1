# Shared by Console.Tests.ps1. Dot-sourced from each Describe's BeforeAll so it works under Pester 4 and 5
# (Pester 5 runs top-level file code only during discovery).
$script:ConsoleRoot = Split-Path -Parent $PSScriptRoot
$script:Fixtures = Join-Path $PSScriptRoot 'fixtures'

function Initialize-TestConsole {
    # Pester 5 runs every test file in one session: drop console modules another test imported from a copy, or
    # 'Mock -ModuleName DE.Core' refuses to run with two modules of that name loaded
    Get-Module -Name 'DE.*' | Where-Object { $_.Path -and $_.Path -notlike "$script:ConsoleRoot*" } | Remove-Module -Force -ErrorAction SilentlyContinue
    Import-Module (Join-Path $script:ConsoleRoot 'modules/DE.Workflow/DE.Workflow.psm1') -Force -DisableNameChecking
    Import-DEConsoleModules -Root $script:ConsoleRoot
    $dir = Join-Path ([IO.Path]::GetTempPath()) ("de-console-test-{0}" -f ([guid]::NewGuid()))
    $null = Initialize-DEConsole -Root $script:ConsoleRoot -Mode Audit -DataDir $dir
    return $dir
}

# Pester 4 and 5 match -Throw messages differently (substring versus wildcard); tests read the message and use -Match.
function Get-DEThrown { param([Parameter(Mandatory = $true)][scriptblock]$Script) try { $null = & $Script; return '<no exception>' } catch { return $_.Exception.Message } }
