# Move 42: "Re-check installer hashes automatically in CI, rate-limited" (#760).
#
# The re-check behind R6: every installer source is re-fetched from its official location and
# compared with the trust record. These tests pin the comparison logic offline (no network in
# CI's test phase) so the weekly workflow's judgement cannot drift: a difference is always a
# finding (R7), an unpinned source is a finding until move 41 pins it, and winget/local sources
# are honestly reported as not re-fetchable rather than waved through as verified.
#
# Rate limiting is asserted structurally: the runner sleeps -DelaySeconds between downloads, so
# the tests pass 0 and CI passes 30 - the knob exists and the default is conservative.

Describe 'Installer source re-check (move 42)' {
    BeforeAll {
        $script:Windows = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        . (Join-Path (Join-Path $script:Windows 'tests') 'Invoke-InstallerSourceRecheck.ps1')
    }

    Context 'the re-check plan comes from the trust record' {
        It 'every package source becomes one re-check row with its record' {
            $catalog = Join-Path (Join-Path $script:Windows 'console') 'catalog\packages.json'
            $rows = Get-DERecheckSources -Catalog $catalog
            $rows.Count | Should -Be 18
            foreach ($r in $rows) {
                $r.Location | Should -Not -BeNullOrEmpty -Because "$($r.Id) must know what to re-fetch"
                "$($r.Sha256From)" | Should -Not -BeNullOrEmpty -Because "$($r.Id) must carry its provenance"
            }
        }
    }

    Context 'every outcome is judged, none is waved through' {
        It 'a matching file reads ok' {
            $s = [pscustomobject]@{ Id = 'wazuh-agent'; Name = 'Wazuh Agent'; Type = 'url'; Location = 'https://example/x.msi'; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'vendor' }
            $r = Compare-DESourceFile -Source $s -ActualSha256 ('A' * 64)
            $r.finding | Should -Be 'ok' -Because 'the comparison is case-insensitive on hex'
        }
        It 'a changed file is a hash-mismatch finding with both hashes in the message' {
            $s = [pscustomobject]@{ Id = 'wazuh-agent'; Name = 'Wazuh Agent'; Type = 'url'; Location = 'https://example/x.msi'; Version = ''; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'vendor' }
            $r = Compare-DESourceFile -Source $s -ActualSha256 ('b' * 64)
            $r.finding | Should -Be 'hash-mismatch' -Because 'R7: a change is a finding, not a silent update'
            $r.detail | Should -Match ('have ' + ('b' * 64))
            $r.detail | Should -Match ('want ' + ('a' * 64))
        }
        It 'a file changed without changing its version is the R7 ALERT' {
            $s = [pscustomobject]@{ Id = 'wazuh-agent'; Name = 'Wazuh Agent'; Type = 'url'; Location = 'https://example/x.msi'; Version = '4.9.2'; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'vendor' }
            $r = Compare-DESourceFile -Source $s -ActualSha256 ('b' * 64) -ActualVersion '4.9.2'
            $r.finding | Should -Be 'silent-change' -Because 'same version, different bytes: that is how a compromised upstream shows up'
            $r.detail | Should -Match 'CHANGED WITHOUT CHANGING ITS VERSION'
            $r.detail | Should -Match 'ALERT'
        }
        It 'a file changed along with its version is a version-change finding' {
            $s = [pscustomobject]@{ Id = 'wazuh-agent'; Name = 'Wazuh Agent'; Type = 'url'; Location = 'https://example/x.msi'; Version = '4.9.2'; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'vendor' }
            $r = Compare-DESourceFile -Source $s -ActualSha256 ('b' * 64) -ActualVersion '4.10.0'
            $r.finding | Should -Be 'version-change' -Because 'the version moved: still a finding, but a different kind from the silent one'
            $r.detail | Should -Match '4\.9\.2 -> 4\.10\.0'
        }
        It 'when a version is unknown the mismatch stays a plain hash-mismatch' {
            $s = [pscustomobject]@{ Id = 'x'; Name = 'X'; Type = 'url'; Location = 'https://example/x'; Version = ''; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'pin' }
            (Compare-DESourceFile -Source $s -ActualSha256 ('b' * 64) -ActualVersion '1.0').finding | Should -Be 'hash-mismatch'
            (Compare-DESourceFile -Source $s -ActualSha256 ('b' * 64)).finding | Should -Be 'hash-mismatch'
        }
        It 'an unpinned source is a finding until it is pinned' {
            $s = [pscustomobject]@{ Id = 'jumpcloud-agent'; Name = 'JumpCloud Agent'; Type = 'url'; Location = 'https://example/x.msi'; Sha256 = $null; Sha256Verified = $false; Sha256From = 'no vendor hash (R5 pins on first trusted download)' }
            $r = Compare-DESourceFile -Source $s -ActualSha256 ('c' * 64)
            $r.finding | Should -Be 'unpinned' -Because 'no hash recorded means the re-check has nothing to confirm; that is a finding, not a pass'
        }
        It 'a failed download is a finding, not a pass' {
            $s = [pscustomobject]@{ Id = 'm365-apps'; Name = 'M365'; Type = 'url'; Location = 'https://example/x.exe'; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'pin' }
            $r = Compare-DESourceFile -Source $s -Failure 'the remote server returned an error: (404) Not Found'
            $r.finding | Should -Be 'download-failed' -Because 'an unreachable source must never read as verified'
        }
        It 'winget and local sources say they are not re-fetchable instead of pretending' {
            foreach ($type in @('winget', 'local')) {
                $s = [pscustomobject]@{ Id = 'x'; Name = 'X'; Type = $type; Location = 'y'; Sha256 = $null; Sha256Verified = $false; Sha256From = 'note' }
                $r = Compare-DESourceFile -Source $s
                $r.finding | Should -Be 'not-checkable' -Because "$type has no URL to re-fetch; R8/R9 check it at install time"
            }
        }
    }

    Context 'the runner only raises findings, never counts the rest' {
        It 'an offline run judges nothing fetched as not-checkable and raises no findings' {
            $r = Invoke-DEInstallerSourceRecheck -Sources @(
                [pscustomobject]@{ Id = 'a'; Name = 'A'; Type = 'url'; Location = 'https://example/a'; Sha256 = 'a' * 64; Sha256Verified = $true; Sha256From = 'pin' }
                [pscustomobject]@{ Id = 'b'; Name = 'B'; Type = 'local'; Location = 'b.msi'; Sha256 = $null; Sha256Verified = $false; Sha256From = 'intake' }
            ) -DelaySeconds 0 -Offline
            $r.rows.Count | Should -Be 2
            $r.findings.Count | Should -Be 0 -Because 'nothing fetched is honestly not-checkable, and not-checkable is not a finding'
            $r.checked | Should -Be 0
        }
    }
}
