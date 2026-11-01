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
    # Settle the PHI decision so vendor gates are deterministic in tests. Default is NOT restricted,
    # so existing suites keep exercising the ordinary path; a test that wants the restricted case
    # settles it itself (see Phi.Tests.ps1).
    Set-DEPhiDecision ([pscustomobject]@{ restricted = $false; vertical = 'not-healthcare'; client = $false; override = $false; reason = 'test default: not restricted' })
    return $dir
}

# Pester 4 and 5 match -Throw messages differently (substring versus wildcard); tests read the message and use -Match.
function Get-DEThrown { param([Parameter(Mandatory = $true)][scriptblock]$Script) try { $null = & $Script; return '<no exception>' } catch { return $_.Exception.Message } }

# ---------------------------------------------------------------- restricted client-output fields
# What must never reach anything a client sees (moves 12 and 13). Vendor sourcing and internal
# detail are DE's, not the client's; keys and recovery material are nobody's to publish. The
# cost/margin patterns guard an invariant the catalog already keeps ("No prices" in bundles.json)
# so that adding one later fails here instead of silently shipping.
function Get-DERestrictedPatterns {
    return @(
        [pscustomobject]@{ Kind = 'vendor'; Pattern = 'Guardz|SentinelOne|Blackpoint|JumpCloud|MSP360|Wazuh|Timus|Prisma'; Why = 'vendor sourcing' }
        [pscustomobject]@{ Kind = 'internal-section'; Pattern = 'Evidence log|Identity and management|Open items|Exceptions'; Why = 'internal report sections' }
        [pscustomobject]@{ Kind = 'key'; Pattern = '(?i)\b(api[_ -]?key|access[_ -]?token|refresh[_ -]?token|secret|password|passwd|passphrase|private[_ -]?key)\b'; Why = 'secret-shaped key names' }
        [pscustomobject]@{ Kind = 'key'; Pattern = '(?<!\d)\d{6}([- ]?\d{6}){7}(?!\d)'; Why = 'BitLocker recovery password' }
        [pscustomobject]@{ Kind = 'key'; Pattern = '\b(AKIA|ASIA)[A-Z0-9]{16}\b'; Why = 'AWS access key' }
        [pscustomobject]@{ Kind = 'key'; Pattern = '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b'; Why = 'JWT' }
        [pscustomobject]@{ Kind = 'key'; Pattern = '(?i)\bBearer\s+[A-Za-z0-9\-\._~\+\/]+=*'; Why = 'bearer token' }
        [pscustomobject]@{ Kind = 'money'; Pattern = '(?i)\b(price|pricing|cost|margin|msrp|our cost|sell price|wholesale|discount|revenue|profit)\b'; Why = 'commercial terms' }
        [pscustomobject]@{ Kind = 'money'; Pattern = '(?<![A-Za-z0-9])[$]\s?\d'; Why = 'money amount' }
        [pscustomobject]@{ Kind = 'sourcing'; Pattern = 'https?://'; Why = 'vendor or internal URL' }
    )
}

# Scans text for the restricted patterns above. Returns one row per hit: Kind, Why, Pattern, Sample.
#
# <style> and <script> blocks are stripped first: they are presentation, never client-visible
# content, and their declarations (margin:0, cost, colour names) would otherwise trip the
# commercial-terms check on every single report. Pass -IncludePresentation to scan them too.
function Find-DERestrictedContent {
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text,
        [string[]]$Kind = @(),
        [switch]$IncludePresentation
    )
    $scan = $Text
    if (-not $IncludePresentation) {
        $scan = [regex]::Replace($scan, '(?is)<(style|script)\b.*?</\1>', ' ')
    }
    $hits = @()
    foreach ($p in Get-DERestrictedPatterns) {
        if ($Kind.Count -and $p.Kind -notin $Kind) { continue }
        foreach ($m in [regex]::Matches($scan, $p.Pattern)) {
            $sample = $m.Value
            if ($sample.Length -gt 60) { $sample = $sample.Substring(0, 60) + '...' }
            $hits += [pscustomobject]@{ Kind = $p.Kind; Why = $p.Why; Pattern = $p.Pattern; Sample = $sample }
        }
    }
    return $hits
}

# Golden-file normalising: strip anything that legitimately varies between runs (timestamps, ids,
# hashes, machine and temp paths) so a comparison is about the report's shape and wording only.
function ConvertTo-DENormalizedReport {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Html)
    $t = $Html
    $t = [regex]::Replace($t, '\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?', '<TIMESTAMP>')
    $t = [regex]::Replace($t, '\d{1,2} \w{3} \d{4}, \d{2}:\d{2}(:\d{2})?( UTC([+-]\d{2}:\d{2})?)?', '<WHEN>')
    $t = [regex]::Replace($t, '\b[0-9a-fA-F]{64}\b', '<SHA256>')
    $t = [regex]::Replace($t, '\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b', '<GUID>')
    $t = [regex]::Replace($t, '\b[0-9a-fA-F]{6,}\b', '<ID>')
    $t = [regex]::Replace($t, '(?i)[A-Z]:\\[^\s"<>]*', '<PATH>')
    $t = [regex]::Replace($t, '\s+', ' ')
    return $t.Trim()
}

# ---------------------------------------------------------------- move 14 recovery-password redaction
# A BitLocker recovery password is 48 digits in 8 groups of 6 (dashes, spaces or none). Matching the
# bare 48 digits after stripping separators catches every form it can persist in, so the surface
# tests assert an empty result - and can report what survived when one is not. Digit runs shorter
# than 48, and anything with a letter or punctuation in between, are left alone.
function Find-DERecoveryPasswordIn {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    if (-not $Text) { return @() }
    $flat = $Text -replace '[-\s]', ''
    return @([regex]::Matches($flat, '(?<!\d)\d{48}(?!\d)') | ForEach-Object { $_.Value })
}
