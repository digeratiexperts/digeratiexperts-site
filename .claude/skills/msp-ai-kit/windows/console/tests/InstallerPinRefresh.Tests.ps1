# Follow-up to move 41: a pinned installer refuses when the vendor ships a new file (R7), and the way
# forward must be a reviewed change, not a hand-edit. Update-InstallerPin.ps1 produces that change;
# these tests pin its judgement offline (no network): which catalog text it rewrites, that it touches
# nothing else, that it refuses what it should, and how the time-boxed recheck acknowledgement behaves
# (a known-unfetchable source is acknowledged until a stated date, then becomes a finding again, so
# the exception cannot quietly become permanent).

Describe 'Pin refresh and recheck acknowledgement' {
    BeforeAll {
        $script:Windows = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        . (Join-Path (Join-Path $script:Windows 'tests') 'Update-InstallerPin.ps1')
        $script:Recheck = Join-Path (Join-Path $script:Windows 'tests') 'Invoke-InstallerSourceRecheck.ps1'
        $script:Old = 'a' * 64
        $script:New = 'b' * 64
        $script:Catalog = @'
{
  "packages": [
    {
      "id": "alpha",
      "name": "Alpha",
      "source": { "type": "url", "url": "https://vendor.example/alpha.msi", "publisher": "Alpha Inc.", "sha256": "AAAA", "sha256Verified": true, "sha256Label": "pinned-first-download", "sha256From": "pinned-first-download 2026-11-02: old note" }
    },
    {
      "id": "beta",
      "name": "Beta",
      "source": { "type": "url", "url": "https://vendor.example/beta.msi", "sha256": "AAAA", "sha256Verified": true, "sha256From": "pinned-first-download 2026-11-02: other" }
    },
    {
      "id": "gamma",
      "name": "Gamma",
      "source": { "type": "url", "url": "https://vendor.example/gamma.msi", "sha256": null, "sha256Verified": false, "sha256From": "UNPINNED: no file" }
    },
    {
      "id": "delta",
      "name": "Delta",
      "source": { "type": "local", "localPath": "delta.msi", "sha256": null, "sha256Verified": false, "sha256From": "intake" }
    }
  ]
}
'@.Replace('AAAA', $script:Old)
    }

    Context 'the catalog rewrite touches exactly one source' {
        It 'replaces the hash and the provenance of the named source and nothing else' {
            $out = Get-DEPinUpdatedCatalogText -Text $script:Catalog -Id 'alpha' -NewSha256 $script:New -NewProvenance 'pinned-first-download 2026-12-01: refreshed'
            $pk = ($out | ConvertFrom-Json).packages
            ($pk | Where-Object id -eq 'alpha').source.sha256 | Should -Be $script:New
            ($pk | Where-Object id -eq 'alpha').source.sha256From | Should -Be 'pinned-first-download 2026-12-01: refreshed'
            ($pk | Where-Object id -eq 'beta').source.sha256 | Should -Be $script:Old -Because 'another package sharing the same old hash must not be touched'
            ($pk | Where-Object id -eq 'beta').source.sha256From | Should -Be 'pinned-first-download 2026-11-02: other'
            $beforeLines = $script:Catalog -split "`n"
            $afterLines = $out -split "`n"
            $afterLines.Count | Should -Be $beforeLines.Count
            @(0..($beforeLines.Count - 1) | Where-Object { $beforeLines[$_] -ne $afterLines[$_] }).Count | Should -Be 1 -Because 'one line, the source line, changes'
        }
        It 'refuses a source that has no pin: the first pin is made by hand' {
            { Get-DEPinUpdatedCatalogText -Text $script:Catalog -Id 'gamma' -NewSha256 $script:New -NewProvenance 'x' } | Should -Throw '*no pin to refresh*'
        }
        It 'refuses a non-url source and an unknown id' {
            { Get-DEPinUpdatedCatalogText -Text $script:Catalog -Id 'delta' -NewSha256 $script:New -NewProvenance 'x' } | Should -Throw '*not a url source*'
            { Get-DEPinUpdatedCatalogText -Text $script:Catalog -Id 'nope' -NewSha256 $script:New -NewProvenance 'x' } | Should -Throw '*not found*'
        }
        It 'refuses a malformed hash' {
            { Get-DEPinUpdatedCatalogText -Text $script:Catalog -Id 'alpha' -NewSha256 'ABC' -NewProvenance 'x' } | Should -Throw '*64 lowercase hex*'
        }
    }

    Context 'the signer must be the recorded publisher' {
        It 'matches a legal-form suffix and a quoted CN, and rejects a different company' {
            Test-DESignerMatchesPublisher -Subject 'CN=JumpCloud Inc, O=JumpCloud Inc, L=Louisville' -Publisher 'JumpCloud Inc.' | Should -Be $true
            Test-DESignerMatchesPublisher -Subject 'CN="Wazuh, Inc", O="Wazuh, Inc", L=San Jose' -Publisher 'Wazuh' | Should -Be $true
            Test-DESignerMatchesPublisher -Subject 'CN=Microsoft Corporation, O=Microsoft Corporation' -Publisher 'Microsoft Corporation' | Should -Be $true
            Test-DESignerMatchesPublisher -Subject 'CN=Evil Corp, O=JumpCloud Inc' -Publisher 'JumpCloud Inc.' | Should -Be $false -Because 'only the CN counts, not the O field'
            Test-DESignerMatchesPublisher -Subject '' -Publisher 'JumpCloud Inc.' | Should -Be $false
            Test-DESignerMatchesPublisher -Subject 'CN=Anyone' -Publisher '' | Should -Be $false -Because 'no recorded publisher means nothing to match'
        }
    }

    Context 'a known-unfetchable source is acknowledged until a stated date' {
        BeforeAll {
            . $script:Recheck
            $script:Src = [pscustomobject]@{ Id = 'ra'; Name = 'Remote Assist'; Type = 'url'; Version = ''; Location = 'https://x/y.msi'; Sha256 = $null; Sha256Verified = $false; Sha256From = 'UNPINNED'; AckReason = 'URL needs confirming with JumpCloud admin access'; AckUntil = '2026-12-01' }
        }
        It 'is acknowledged, not a finding, before the date' {
            $r = Compare-DESourceFile -Source $script:Src -Failure 'The remote server returned an error: (403) Forbidden.' -Today ([datetime]'2026-11-15')
            $r.finding | Should -Be 'acknowledged'
            $r.detail | Should -Match '2026-12-01'
            $r.detail | Should -Match 'URL needs confirming'
        }
        It 'is acknowledged on the last day and a finding the day after' {
            (Compare-DESourceFile -Source $script:Src -Failure '403' -Today ([datetime]'2026-12-01')).finding | Should -Be 'acknowledged'
            $r = Compare-DESourceFile -Source $script:Src -Failure '403' -Today ([datetime]'2026-12-02')
            $r.finding | Should -Be 'download-failed' -Because 'an expired acknowledgement is a finding again'
            $r.detail | Should -Match 'expired'
        }
        It 'never hides anything but a failed download' {
            $withHash = $script:Src.PSObject.Copy(); $withHash.Sha256 = 'a' * 64
            (Compare-DESourceFile -Source $withHash -ActualSha256 ('b' * 64) -Today ([datetime]'2026-11-15')).finding | Should -Be 'hash-mismatch' -Because 'a changed file is never acknowledged away'
        }
        It 'a source with no acknowledgement still fails the same way' {
            $plain = $script:Src.PSObject.Copy(); $plain.AckUntil = ''; $plain.AckReason = ''
            (Compare-DESourceFile -Source $plain -Failure '403' -Today ([datetime]'2026-11-15')).finding | Should -Be 'download-failed'
        }
        It 'the runner does not count an acknowledged source as a finding' {
            $r = Invoke-DEInstallerSourceRecheck -Sources @($script:Src) -DelaySeconds 0 -Offline
            @($r.findings).Count | Should -Be 0
        }
    }

    Context 'Remote Assist uses the documented managed deployment model' {
        It 'is not fetched or counted as a failed installer download' {
            $catalogPath = Join-Path (Join-Path $script:Windows 'console') 'catalog\packages.json'
            $ra = Get-DERecheckSources -Catalog $catalogPath | Where-Object { $_.Id -eq 'jumpcloud-remote-assist' }
            $ra.Type | Should -Be 'managed'
            $ra.Location | Should -Be 'https://www.jumpcloud.com/support/get-started-remote-assist'
            $ra.ManagedBy | Should -Be 'JumpCloud'
            $ra.AckUntil | Should -BeNullOrEmpty
            $result = Compare-DESourceFile -Source $ra -Today ([datetime]'2026-11-15')
            $result.finding | Should -Be 'managed'
            $result.detail | Should -Match 'device check-in'
            (Compare-DESourceFile -Source $ra -Failure '403' -Today ([datetime]'2026-11-15')).finding | Should -Be 'download-failed' -Because 'a managed capability must never use the download acknowledgement path'
            Mock Invoke-WebRequest { throw 'a managed capability must never be fetched' }
            $run = Invoke-DEInstallerSourceRecheck -Sources @($ra) -DelaySeconds 0
            $run.checked | Should -Be 0
            $run.findings | Should -BeNullOrEmpty
            $run.rows[0].finding | Should -Be 'managed'
            Should -Invoke Invoke-WebRequest -Times 0
        }
    }

    Context 'the catalog states its acknowledgements properly' {
        It 'every acknowledgement has a reason and an ISO date, and only sits on a url source' {
            $cat = (Get-Content -LiteralPath (Join-Path (Join-Path $script:Windows 'console') 'catalog\packages.json') -Raw -Encoding UTF8 | ConvertFrom-Json).packages
            foreach ($p in $cat) {
                $a = $p.source.recheckAcknowledged
                if ($null -eq $a) { continue }
                "$($p.source.type)" | Should -Be 'url' -Because "$($p.id): only a url source can be unfetchable"
                "$($a.reason)".Trim() | Should -Not -BeNullOrEmpty -Because "$($p.id) must say why"
                "$($a.until)" | Should -Match '^\d{4}-\d{2}-\d{2}$' -Because "$($p.id) must say until when"
                $null -eq $p.source.sha256 | Should -Be $true -Because "$($p.id): an acknowledgement is for a source with nothing pinned; a pinned source that fails to download must stay a finding"
            }
        }
    }
}
