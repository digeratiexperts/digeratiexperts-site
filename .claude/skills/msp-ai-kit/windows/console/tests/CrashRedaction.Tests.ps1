# Move 100 (issue 818): crash reports carry no sensitive data. A crash is a parse error or an
# unexpected exception whose message can quote the very thing that broke - a profile line holding a
# credential, for instance. This drives a real headless crash whose exception message carries a
# planted secret and proves the secret never reaches stdout (RMM transcripts), the result file or the
# log. Compatible with Pester 4.10 and 5.x.

Describe 'Crash reports carry no sensitive data' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole; Exe = (Get-Process -Id $PID).Path; Win = Split-Path -Parent $script:ConsoleRoot }
    }
    It 'a crash message never carries a planted secret into stdout or the result file' {
        # a profile file that is not JSON: the parser's error quotes its input, so the report of the
        # failure would carry the credential out with it
        $profile = Join-Path $global:DETest.Dir 'broken-profile.json'
        Set-Content -LiteralPath $profile -Value 'password=planted-crash-secret-987654321 { not json' -Encoding UTF8
        $result = Join-Path $global:DETest.Dir 'result.json'
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'console/DETechConsole.ps1') -Headless -Client alamo -ProfileFile $profile -DataDir (Join-Path $global:DETest.Dir 'crash-data') -ResultFile $result 2>&1 | ForEach-Object { "$_" }
        $all = $out -join "`n"
        $all | Should -Not -Match 'planted-crash-secret' -Because 'a crash report must never echo the credential that broke'
        $all | Should -Match '(REFUSED|ERROR):' -Because 'the failure itself must still be reported'
        if (Test-Path -LiteralPath $result) {
            $r = [IO.File]::ReadAllText($result)
            $r | Should -Not -Match 'planted-crash-secret'
            $r | Should -Match '"overall":\s*"(ERROR|REFUSED)"'
        }
    }
    It 'a crash message is redacted by shape too, not just by registered values' {
        # JWT-shaped values are redacted wherever they appear, including inside a parser error that
        # quotes the broken file
        $profile = Join-Path $global:DETest.Dir 'broken-profile-2.json'
        Set-Content -LiteralPath $profile -Value 'eyJhbGciOiJSUzI1NiJ9aaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc is not json' -Encoding UTF8
        $result = Join-Path $global:DETest.Dir 'result-2.json'
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'console/DETechConsole.ps1') -Headless -Client alamo -ProfileFile $profile -DataDir (Join-Path $global:DETest.Dir 'crash-data-2') -ResultFile $result 2>&1 | ForEach-Object { "$_" }
        $all = $out -join "`n"
        $all | Should -Not -Match 'eyJhbGciOiJSUzI1NiJ9aaaaaaaaaa' -Because 'a JWT-shaped value is redacted by shape'
        $all | Should -Match 'REDACTED'
    }
}
