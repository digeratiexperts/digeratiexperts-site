# Shared by Console.Tests.ps1. Dot-sourced from each Describe's BeforeAll so it works under Pester 4 and 5
# (Pester 5 runs top-level file code only during discovery).
$script:ConsoleRoot = Split-Path -Parent $PSScriptRoot
$script:Fixtures = Join-Path $PSScriptRoot 'fixtures'

function Initialize-TestConsole {
    Import-Module (Join-Path $script:ConsoleRoot 'modules/DE.Workflow/DE.Workflow.psm1') -Force -DisableNameChecking
    Import-DEConsoleModules -Root $script:ConsoleRoot
    $dir = Join-Path ([IO.Path]::GetTempPath()) ("de-console-test-{0}" -f ([guid]::NewGuid()))
    $null = Initialize-DEConsole -Root $script:ConsoleRoot -Mode Audit -DataDir $dir
    return $dir
}
