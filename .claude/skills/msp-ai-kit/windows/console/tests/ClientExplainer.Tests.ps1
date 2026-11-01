# Move 90 (issue 808): the one-page client explainer and its guard rails. The explainer is client-facing
# text, so it is held to the same restricted-field rules as client reports (moves 12 and 13): no costs
# or commercial terms, no vendor sourcing, no secret-shaped words or values, no internal sections, no
# URLs. This test is what keeps it that way when someone edits it later. Compatible with Pester 4.10
# and 5.x.

Describe 'Client explainer of what the tool changes' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $global:DEExplainer = [IO.File]::ReadAllText((Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'CLIENT-EXPLAINER.md'))
    }
    It 'carries none of the restricted client-output fields' {
        $hits = @(Find-DERestrictedContent -Text $global:DEExplainer)
        $hits.Count | Should -Be 0 -Because (($hits | ForEach-Object { "$($_.Kind) [$($_.Sample)]" }) -join '; ')
    }
    It 'is one page, not a manual' {
        $lines = @(Get-Content -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'CLIENT-EXPLAINER.md'))
        $lines.Count | Should -BeLessThan 80 -Because 'a client explainer is one page'
        $global:DEExplainer.Length | Should -BeLessThan 6000
    }
    It 'tells the client the things they will ask about' {
        $global:DEExplainer | Should -Match 'What it may change'
        $global:DEExplainer | Should -Match 'What it does not do'
        $global:DEExplainer | Should -Match 'What is recorded'
        $global:DEExplainer | Should -Match '13 months'
        $global:DEExplainer | Should -Match 'your data\s+stays yours'
    }
}
