# Move 20: "Add a changelog entry per version, linked to its PR" (#738).
#
# The changelog is the release record: one entry per version, newest first, each linking the pull
# request or commit that shipped it. This check keeps it that way - a version bump without its
# entry fails here, so the entry lands in the same change as the bump.
#
# The parser guard matters: a heading that stops parsing (a dropped date, a missing link) would
# silently vanish from the entry list and make everything else look green, so the count of raw
# headings is asserted against the parsed entries.
#
# Source stays ASCII on purpose: Windows PowerShell 5.1 reads a BOM-less script as ANSI, so the
# heading separator is matched as \u2014 rather than a literal em dash.

Describe 'Every released version has a changelog entry linked to what shipped it' {
    BeforeAll {
        $script:Win = Split-Path -Parent $PSScriptRoot
        $script:LogPath = Join-Path $script:Win 'CHANGELOG.md'
        $script:Text = [IO.File]::ReadAllText($script:LogPath)
        $script:Entries = @([regex]::Matches($script:Text, '(?m)^##\s+(\d+\.\d+\.\d+)\s+\u2014\s+(\d{4}-\d{2}-\d{2})\s+\u2014\s+(.+?)\s*$') | ForEach-Object {
            [pscustomobject]@{ Version = $_.Groups[1].Value; Date = $_.Groups[2].Value; Link = $_.Groups[3].Value }
        })
    }

    It 'the newest entry is the version console/VERSION says is current' {
        $current = (Get-Content -LiteralPath (Join-Path $script:Win 'console\VERSION') -Raw).Trim()
        $script:Entries.Count | Should -BeGreaterThan 0 -Because 'the changelog must have entries'
        $script:Entries[0].Version | Should -Be $current -Because "a release of $current needs its entry at the top; add it to CHANGELOG.md in the same change as the bump"
    }

    It 'every heading parses as version, date and link (a malformed entry would hide from the checks)' {
        $headings = @([regex]::Matches($script:Text, '(?m)^##\s+')).Count
        $headings | Should -Be $script:Entries.Count -Because 'every entry heading must carry a version, an ISO date and its link'
    }

    It 'every entry links the pull request or commit that shipped it' {
        $bad = @($script:Entries | Where-Object { $_.Link -notmatch '(pull/\d+|commit/[0-9a-f]{7,40})\)?$' })
        ($bad | ForEach-Object { $_.Version }) -join ', ' | Should -BeNullOrEmpty -Because 'an entry without its PR or commit link is a rumour, not a record'
    }

    It 'entries are one per version, newest first' {
        $seen = @{}
        for ($i = 0; $i -lt $script:Entries.Count; $i++) {
            $v = $script:Entries[$i].Version
            $seen.ContainsKey($v) | Should -Be $false -Because "version $v appears twice"
            $seen[$v] = $true
            if ($i -gt 0) {
                ([version]$script:Entries[$i - 1].Version -gt [version]$v) | Should -Be $true -Because "entries must run newest first: $v follows $($script:Entries[$i - 1].Version)"
            }
        }
    }
}
