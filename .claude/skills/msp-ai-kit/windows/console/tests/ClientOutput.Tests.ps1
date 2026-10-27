# Moves 12 and 13: nothing a client sees may carry costs, margins, keys or vendor sourcing.
#
# 13 is the automated restricted-field check (Find-DERestrictedContent in TestHelpers.ps1).
# 12 is the golden-file guard, so a change to what the client report emits is visible rather than
# accidental.
#
# The second Context is a test of the test: it feeds known-bad content through the same scanner and
# requires it to be caught. Without that, a broken pattern would pass these checks silently - which
# is exactly how the PDF bug (issue #836) survived behind a weak assertion.

Describe 'Client output carries none of the restricted fields' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Alamo = Get-DEClientProfile -Id 'alamo'
        $script:Snap = @{
            device    = @{ hostname = 'ALAMO-LAP-0231'; serial = 'PF3ABC12'; manufacturer = 'Dell'; model = 'Latitude 7450'; osCaption = 'Windows 11 Pro'; osBuild = '26100' }
            bitlocker = @{ osEncrypted = $true; osProtectionOn = $true; os = @{ recoveryProtectorIds = @('ABCDEF12-3456-7890-ABCD-EF1234567890') } }
        }
        # a record with plenty in it, so a leak would have somewhere to come from
        Add-DEEvidence -Step 'security.guardz' -Module 'security' -Before 'x' -ActionTaken 'install' -Result 'PASS' | Out-Null
        Add-DEEvidence -Step 'security.sentinelone' -Module 'security' -Before 'x' -ActionTaken 'install' -Result 'WARN' -Verification 'needs attention' | Out-Null
        Add-DEEvidence -Step 'jumpcloud.bind-user' -Module 'jumpcloud' -Before 'x' -ActionTaken 'bind' -Result 'PASS' | Out-Null
        $script:Record = New-DEAssetRecord -Snapshot $script:Snap -ClientProfile $script:Alamo
        $script:ClientHtml = ConvertTo-DEHtmlReport -Record $script:Record -ClientProfile $script:Alamo -ClientSafe
    }

    Context 'move 13: the restricted-field check finds nothing in client output' {
        It 'the client report has no vendor sourcing, keys, money or internal sections' {
            $hits = @(Find-DERestrictedContent -Text $script:ClientHtml)
            $hits.Count | Should -Be 0 -Because ('client output leaked: ' + (@($hits | ForEach-Object { $_.Kind + ' (' + $_.Why + '): ' + $_.Sample }) -join ' | '))
        }
        It 'the client report names none of the DE-stack vendors' {
            $script:ClientHtml | Should -Not -Match 'Guardz|SentinelOne|Blackpoint|JumpCloud|MSP360|Wazuh|Timus|Prisma'
        }
        It 'the client report contains no URL' {
            $script:ClientHtml | Should -Not -Match 'https?://'
        }
        It 'the client report contains no commercial terms' {
            @(Find-DERestrictedContent -Text $script:ClientHtml -Kind 'money').Count | Should -Be 0
        }
        It 'the client report carries no secret-shaped key name or recovery material' {
            @(Find-DERestrictedContent -Text $script:ClientHtml -Kind 'key').Count | Should -Be 0
        }
    }

    Context 'the restricted-field check actually detects leaks' {
        It 'catches <why>' -TestCases @(
            @{ text = 'Powered by Guardz and SentinelOne'; why = 'vendor sourcing' }
            @{ text = 'See the Evidence log and Open items below'; why = 'internal report sections' }
            @{ text = 'api_key = abc123 and refresh_token = xyz'; why = 'secret-shaped key names' }
            @{ text = 'BitLocker recovery 123456-123456-123456-123456-123456-123456-123456-123456'; why = 'BitLocker recovery password' }
            @{ text = 'AWS AKIAIOSFODNN7EXAMPLE'; why = 'AWS access key' }
            @{ text = 'Bearer abcdefghijklmnop'; why = 'bearer token' }
            @{ text = 'our cost 12.50, sell price 24.99, margin 40%'; why = 'commercial terms' }
            @{ text = 'total $24.99 per seat'; why = 'money amount' }
            @{ text = 'download from https://cdn.example.com/x.msi'; why = 'vendor or internal URL' }
        ) {
            param($text, $why)
            $hits = @(Find-DERestrictedContent -Text $text)
            $hits.Count | Should -BeGreaterThan 0 -Because "$why must be caught, or the check is not protecting anything"
            (@($hits | ForEach-Object { $_.Why }) -join '; ') | Should -Match ([regex]::Escape($why))
        }
        It 'reports the sample so a failure is diagnosable' {
            $hits = @(Find-DERestrictedContent -Text 'we use Guardz here')
            $hits[0].Sample | Should -Be 'Guardz'
            $hits[0].Kind | Should -Be 'vendor'
        }
        It 'does not read CSS declarations as commercial terms' {
            # the report's stylesheet legitimately says margin:0 and similar; scanning presentation
            # would flag every report and make the check useless
            $css = '<style>body{margin:0;padding:0}h2{margin:30px 0 10px}.cost{color:#fff}</style><p>All fine</p>'
            @(Find-DERestrictedContent -Text $css -Kind 'money').Count | Should -Be 0
        }
        It 'but still scans presentation when asked, so nothing hides there' {
            $css = '<style>body{margin:0}</style><p>our cost 9.99</p>'
            @(Find-DERestrictedContent -Text $css -Kind 'money' -IncludePresentation).Count | Should -BeGreaterThan 0
        }
        It 'the internal report is still allowed to name vendors and sections' {
            # the check is for client output only; the internal report is DE's and must keep its detail
            $internal = ConvertTo-DEHtmlReport -Record $script:Record -ClientProfile $script:Alamo -Evidence (Get-DEEvidence)
            $internal | Should -Match 'Evidence log'
            $internal | Should -Match 'pill'
        }
    }

    Context 'move 12: the client report matches the golden file' {
        It 'matches the reviewed golden file, so a wording change is a deliberate one' {
            $golden = Join-Path $PSScriptRoot 'fixtures\client-report.golden.html'
            $normalized = ConvertTo-DENormalizedReport -Html $script:ClientHtml
            if (-not (Test-Path -LiteralPath $golden)) {
                Set-Content -LiteralPath $golden -Value $normalized -Encoding utf8
                throw "golden file did not exist and has been written to $golden. Review it, then commit it so this test has something to compare against."
            }
            $expected = (Get-Content -LiteralPath $golden -Raw).TrimEnd("`r", "`n", ' ')
            $normalized | Should -Be $expected -Because 'the client-facing report changed; review the diff and regenerate the golden file deliberately'
        }
    }
}
