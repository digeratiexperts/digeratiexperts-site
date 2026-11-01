# Move 97 (issue 815): export a diagnostic bundle with a test that it contains no secrets. The bundle
# is what a technician hands to DE engineering when something is wrong, so it is held to the same rule
# as the evidence bundle (moves 14/15): every file goes through the redaction, and a final sweep
# deletes the bundle rather than hand over anything that still contains a registered secret - typed,
# JSON-escaped or HTML-encoded. Compatible with Pester 4.10 and 5.x.

Describe 'Diagnostic bundle export' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
    }
    It 'exports the support bundle with its parts, a manifest and a zip' {
        $r = Export-DEDiagnosticBundle
        Test-Path -LiteralPath $r.zip | Should -Be $true
        foreach ($f in @('diagnostic.json', 'gaps.txt', 'manifest.sha256')) { Test-Path -LiteralPath (Join-Path $r.folder $f) | Should -Be $true }
        (Get-Content -LiteralPath (Join-Path $r.folder 'manifest.sha256') -Raw) | Should -Match 'diagnostic\.json'
        $d = Get-Content -LiteralPath (Join-Path $r.folder 'diagnostic.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $d.consoleVersion | Should -Not -BeNullOrEmpty
    }
    It 'carries no secret: planted secret values and recovery-password shapes are redacted' {
        Set-DESecret -Name 'S1_SITE_TOKEN' -Plain 'very-secret-token-value-1234567890'
        Add-Content -LiteralPath (Get-DEConsole).LogFile -Value 'planted very-secret-token-value-1234567890 in a log line'
        Add-Content -LiteralPath (Get-DEConsole).LogFile -Value 'planted 111111-222222-333333-444444-555555-666666-000011-719873 recovery'
        $r = Export-DEDiagnosticBundle
        $all = ''
        foreach ($f in Get-ChildItem -LiteralPath $r.folder -File) { $all += [IO.File]::ReadAllText($f.FullName) }
        $all | Should -Not -Match 'very-secret-token-value' -Because 'the registered secret value must never leave the device'
        $all | Should -Not -Match '111111-222222' -Because 'a recovery-password shape must never leave the device'
        $all | Should -Match 'REDACTED'
    }
    It 'carries no secret values in what it exports (a support bundle may say the word, never the value)' {
        $r = Export-DEDiagnosticBundle
        $all = ''
        foreach ($f in Get-ChildItem -LiteralPath $r.folder -File) { $all += [IO.File]::ReadAllText($f.FullName) }
        # the bare-word row is a client-copy rule (a report must not discuss secrets at all); a support
        # bundle legitimately contains the tool's own prose. What must never appear is a secret VALUE.
        $hits = @(Find-DERestrictedContent -Text $all -Kind 'key' | Where-Object { $_.Sample -notmatch '^(?i)(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|passwd|passphrase|private[_ -]?key)$' })
        $hits.Count | Should -Be 0 -Because (($hits | ForEach-Object { "$($_.Why) [$($_.Sample)]" }) -join '; ')
    }
    It 'withholds and deletes the bundle when a secret survives redaction in an escaped form' {
        Set-DESecret -Name 'WEIRD' -Plain 'a&b<c>d'
        # the HTML-encoded form is what a report renderer could leave behind; Protect-DEText only knows
        # the typed value, so the sweep has to catch this one
        Add-Content -LiteralPath (Get-DEConsole).LogFile -Value ('escaped ' + [System.Net.WebUtility]::HtmlEncode('a&b<c>d') + ' form')
        $evi = (Get-DEConsole).Dirs.Evidence
        $before = @(Get-ChildItem -LiteralPath $evi -Filter 'diagnostic-*' -ErrorAction SilentlyContinue).Count
        (Get-DEThrown { Export-DEDiagnosticBundle }) | Should -Match 'withheld'
        @(Get-ChildItem -LiteralPath $evi -Filter 'diagnostic-*' -ErrorAction SilentlyContinue).Count | Should -Be $before -Because 'a withheld bundle leaves nothing behind: zip and folder both go'
    }
}
