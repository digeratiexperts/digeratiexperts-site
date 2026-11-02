# Move 40: "For each, record the URL, the vendor-published hash and whether it is verified" (#758).
#
# The record is the machine-readable half of section C's argument: every installer source carries
# the URL (source.url / source.localPath / source.id), the vendor-published hash (source.sha256,
# null where the vendor publishes none) and whether it is verified (source.sha256Verified), with
# source.sha256From saying where the answer came from. INSTALLER-SOURCES.md is the human half and
# these tests keep the two in step: the inventory's per-row hash and verified cells must match the
# catalog exactly, so neither can quietly drift from the other.
#
# Honest emptiness is the point: a null hash with sha256Verified false and a non-empty note is a
# complete record. A record that is missing, self-contradictory (verified without a hash) or
# unlabelled (a hash with no provenance) is what fails here - those are how a "we verify
# everything" claim turns into a lie.

Describe 'Installer trust records (move 40)' {
    BeforeAll {
        $script:Console = Split-Path -Parent $PSScriptRoot
        $script:Windows = Split-Path -Parent $script:Console
        $script:InventoryText = Get-Content -LiteralPath (Join-Path $script:Windows 'INSTALLER-SOURCES.md') -Raw -Encoding UTF8
        $script:Packages = @((Get-Content -LiteralPath (Join-Path $script:Console 'catalog\packages.json') -Raw -Encoding UTF8 | ConvertFrom-Json).packages)

        # Section A rows: | `id` | name | type | location | publisher | hash | verified |
        # Parsed from the right because the Dell Command | Update name cell holds an escaped pipe.
        function Get-InventoryRecords {
            $section = [regex]::Match($script:InventoryText, '(?ms)^## A\..*?(?=^## B\.)').Value
            $rows = @{}
            foreach ($m in [regex]::Matches($section, '(?m)^\|(.+)\|$')) {
                $cells = @($m.Groups[1].Value -split '\|' | ForEach-Object { $_.Trim() })
                if ($cells.Count -lt 7 -or $cells[0] -notmatch '^`([^`]+)`$') { continue }
                $rows[$Matches[1]] = [pscustomobject]@{
                    Id       = $Matches[1]
                    Hash     = $cells[$cells.Count - 2]
                    Verified = $cells[$cells.Count - 1]
                }
            }
            return $rows
        }
    }

    Context 'every installer source carries a complete trust record' {
        It 'each source records where its hash answer came from' {
            foreach ($p in $script:Packages) {
                "$($p.source.sha256From)".Trim() | Should -Not -BeNullOrEmpty -Because "$($p.id) must say where its hash answer came from (vendor-published, or why not)"
            }
        }
        It 'a source with no hash is not marked verified' {
            foreach ($p in $script:Packages) {
                if ($null -eq $p.source.sha256) {
                    $p.source.sha256Verified | Should -Be $false -Because "$($p.id) has no recorded hash, so nothing is verified"
                }
            }
        }
        It 'a recorded hash is 64 lowercase hex characters' {
            foreach ($p in $script:Packages) {
                if ($null -ne $p.source.sha256) {
                    $p.source.sha256 | Should -Match '^[0-9a-f]{64}$' -Because "$($p.id) hash must be one sha256 in lowercase hex"
                }
            }
        }
        It 'a source marked verified has a hash to verify against' {
            foreach ($p in $script:Packages) {
                if ($p.source.sha256Verified) {
                    $p.source.sha256 | Should -Not -BeNullOrEmpty -Because "$($p.id) cannot be verified without a recorded hash"
                }
            }
        }
        It 'the record names the URL, the local path or the winget id it describes' {
            foreach ($p in $script:Packages) {
                $location = switch ("$($p.source.type)") {
                    'url' { "$($p.source.url)" }
                    'local' { "$($p.source.localPath)" }
                    'winget' { "$($p.source.id)" }
                    default { '' }
                }
                $location | Should -Not -BeNullOrEmpty -Because "$($p.id) source must carry its location"
            }
        }
    }

    Context 'the inventory and the catalog record the same facts' {
        It 'every package row exists in the inventory with a hash and a verified cell' {
            $records = Get-InventoryRecords
            foreach ($p in $script:Packages) {
                $records.ContainsKey($p.id) | Should -Be $true -Because "$($p.id) must have a trust-record row in the inventory"
            }
            $records.Count | Should -Be $script:Packages.Count
        }
        It "a row's hash cell matches the catalog's recorded hash" {
            $records = Get-InventoryRecords
            foreach ($p in $script:Packages) {
                $want = if ($null -eq $p.source.sha256) { 'none' } else { "$($p.source.sha256)" }
                $records[$p.id].Hash | Should -Be $want -Because "$($p.id) inventory hash cell must match packages.json"
            }
        }
        It "a row's verified cell matches the catalog's verified flag" {
            $records = Get-InventoryRecords
            foreach ($p in $script:Packages) {
                $want = if ($p.source.sha256Verified) { 'yes' } else { 'no' }
                $records[$p.id].Verified | Should -Be $want -Because "$($p.id) inventory verified cell must match packages.json"
            }
        }
    }

    # Move 41 (#759): R5 as decided in move 48 - no vendor hash means a pin on first trusted download,
    # behind Authenticode where the vendor signs, and every pin says so. The failure these tests stop
    # is a pin passing for a vendor-published hash, or a signed vendor pinned without the signature check.
    Context 'pins are labelled and gated (move 41)' {
        It 'every recorded hash carries a label, and no label sits without a hash' {
            foreach ($p in $script:Packages) {
                $label = "$($p.source.sha256Label)"
                if ($null -ne $p.source.sha256) {
                    $label | Should -BeIn @('pinned-first-download', 'vendor-published') -Because "$($p.id) must say what kind of hash it holds"
                } else {
                    $label | Should -BeNullOrEmpty -Because "$($p.id) has no hash to label"
                }
            }
        }
        It 'a pinned-first-download hash is never described as vendor-published' {
            foreach ($p in $script:Packages) {
                if ("$($p.source.sha256Label)" -eq 'pinned-first-download') {
                    $p.source.sha256From | Should -Match '^pinned-first-download' -Because "$($p.id) provenance must lead with the pin label"
                    $p.source.sha256From | Should -Not -Match 'vendor-published' -Because "$($p.id) must not borrow the vendor-published label"
                }
            }
        }
        It 'a pinned source whose vendor signs was pinned behind a valid Authenticode check' {
            foreach ($p in $script:Packages) {
                if ($null -ne $p.source.sha256 -and $p.source.vendorSigns) {
                    $p.source.sha256Verified | Should -Be $true -Because "$($p.id) pin is recorded from a checked file"
                    $p.source.sha256From | Should -Match 'Authenticode Valid, signer CN=' -Because "$($p.id) must record the signature check the pin sat behind (R5 option C)"
                    $p.source.signatureFrom | Should -Match 'Authenticode Valid' -Because "$($p.id) must carry the signer record (R4)"
                }
            }
        }
        It 'a url source with no pin says UNPINNED instead of staying silently empty' {
            foreach ($p in $script:Packages) {
                if ("$($p.source.type)" -eq 'url' -and $null -eq $p.source.sha256) {
                    $p.source.sha256From | Should -Match '^UNPINNED' -Because "$($p.id) downloads without a hash and the record must say why"
                }
            }
        }
        It 'a url source with a pin is checked at download: the catalog hash reaches the trust check' {
            foreach ($p in $script:Packages) {
                if ("$($p.source.type)" -eq 'url' -and $null -ne $p.source.sha256) {
                    $p.source.sha256 | Should -Match '^[0-9a-f]{64}$'
                    $p.source.sha256Verified | Should -Be $true
                }
            }
        }
    }
}

