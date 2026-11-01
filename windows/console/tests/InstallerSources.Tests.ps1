# Move 39: "Inventory every installer source in the catalog and playbooks" (#757).
#
# windows\INSTALLER-SOURCES.md is the inventory this test keeps honest. It is the subject list of
# R1 in INSTALLER-TRUST-POLICY.md, so it must be complete in both directions: every source that
# exists is listed, and everything listed still exists. Without this guard the inventory silently
# rots the first time someone adds a package, and section C's whole argument ("we know every file
# the tool touches") goes with it.
#
# The playbook checks pin the structural claim the inventory rests on: a playbook is a generated
# launcher that delegates to the console catalog, so it cannot smuggle in a source the catalog
# does not have. A URL, a winget call or an installer filename in a playbook is a new installer
# source - it must go through the catalog and into the inventory, not through a launcher.

Describe 'Installer source inventory (move 39)' {
    BeforeAll {
        $script:Console = Split-Path -Parent $PSScriptRoot
        $script:Windows = Split-Path -Parent $script:Console
        $script:Inventory = Join-Path $script:Windows 'INSTALLER-SOURCES.md'
        $script:InventoryText = Get-Content -LiteralPath $script:Inventory -Raw -Encoding UTF8
        $script:Packages = @(Get-Content -LiteralPath (Join-Path $script:Console 'catalog\packages.json') -Raw -Encoding UTF8 | ConvertFrom-Json).packages
        $script:Community = Get-Content -LiteralPath (Join-Path $script:Console 'catalog\community.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $script:Vendors = Get-Content -LiteralPath (Join-Path $script:Console 'catalog\vendors.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $script:Playbooks = @(Get-ChildItem -LiteralPath (Join-Path $script:Windows 'playbooks') -Filter '*.ps1' -File)

        # First cell of every table row inside one '## <letter>.' section: | `id` | ...
        function Get-InventorySectionIds([string]$Letter) {
            $section = [regex]::Match($script:InventoryText, "(?ms)^## $Letter\..*?(?=^## [A-Z]\.|^## Where|\z)").Value
            return @([regex]::Matches($section, '(?m)^\|\s*`([^`]+)`\s*\|') | ForEach-Object { $_.Groups[1].Value })
        }
        $script:GetInventorySectionIds = ${function:Get-InventorySectionIds}
    }

    Context 'the package catalog is inventoried completely' {
        It 'every packages.json entry is listed, and the inventory lists nothing else' {
            $listed = @(& $script:GetInventorySectionIds 'A')
            $have = @($script:Packages | ForEach-Object { $_.id })
            @($listed | Where-Object { $have -notcontains $_ }) | Should -BeNullOrEmpty -Because "an inventoried id must still exist in packages.json: $(@($listed | Where-Object { $have -notcontains $_ }) -join ', ')"
            @($have | Where-Object { $listed -notcontains $_ }) | Should -BeNullOrEmpty -Because "every package must be inventoried: $(@($have | Where-Object { $listed -notcontains $_ }) -join ', ')"
            $listed.Count | Should -Be $have.Count
        }
        It 'each package source location is recorded in the inventory' {
            foreach ($p in $script:Packages) {
                $src = $p.source
                $location = switch ("$($src.type)") {
                    'url' { "$($src.url)" }
                    'local' { "$($src.localPath)" }
                    'winget' { "$($src.id)" }
                    default { throw "package $($p.id) has unknown source type '$($src.type)'" }
                }
                $script:InventoryText.Contains($location) | Should -Be $true -Because "$($p.id) source '$location' must appear in the inventory"
            }
        }
    }

    Context 'the community catalog is inventoried completely' {
        It 'every community.json tool is listed, and the inventory lists nothing else' {
            $listed = @(& $script:GetInventorySectionIds 'B')
            $have = @($script:Community.tools | ForEach-Object { $_.id })
            @($listed | Where-Object { $have -notcontains $_ }) | Should -BeNullOrEmpty
            @($have | Where-Object { $listed -notcontains $_ }) | Should -BeNullOrEmpty -Because "every community tool must be inventoried: $(@($have | Where-Object { $listed -notcontains $_ }) -join ', ')"
            $listed.Count | Should -Be $have.Count
        }
        It 'the pinned-file and pinned-script totals in the inventory match the catalog' {
            $files = 0; $scripts = 0
            foreach ($t in $script:Community.tools) {
                if ($t.PSObject.Properties['files'] -and $t.files) { $files += @($t.files | Where-Object { $_ }).Count }
                if ($t.PSObject.Properties['scripts'] -and $t.scripts) { $scripts += @($t.scripts | Where-Object { $_ }).Count }
            }
            $script:InventoryText.Contains("($files pinned files, $scripts pinned scripts)") | Should -Be $true -Because "the scope table must state the real totals ($files files, $scripts scripts)"
        }
        It 'every community tool repository is recorded in the inventory' {
            foreach ($t in $script:Community.tools) {
                $script:InventoryText.Contains($t.repo) | Should -Be $true -Because "$($t.id) repository $($t.repo) must appear in the inventory"
            }
        }
    }

    Context 'the playbooks are inventoried and contribute no installer source' {
        It 'every playbook file is listed, and the inventory lists nothing else' {
            $listed = @(& $script:GetInventorySectionIds 'C')
            $have = @($script:Playbooks | ForEach-Object { $_.Name })
            @($listed | Where-Object { $have -notcontains $_ }) | Should -BeNullOrEmpty
            @($have | Where-Object { $listed -notcontains $_ }) | Should -BeNullOrEmpty -Because "every playbook must be inventoried: $(@($have | Where-Object { $listed -notcontains $_ }) -join ', ')"
            $listed.Count | Should -Be $have.Count
        }
        It 'a playbook contains no URL, installer filename, msiexec or winget call' {
            foreach ($b in $script:Playbooks) {
                $text = Get-Content -LiteralPath $b.FullName -Raw
                $text | Should -Not -Match 'https?://' -Because "$($b.Name) must name no download source of its own"
                $text | Should -Not -Match '(?i)\.msi\b' -Because "$($b.Name) must name no installer file of its own"
                $text | Should -Not -Match '(?i)\bmsiexec\b' -Because "$($b.Name) must not install anything directly"
                $text | Should -Not -Match '(?i)\bwinget\b' -Because "$($b.Name) must install only through the console catalog"
            }
        }
        It 'a playbook references no executable except powershell.exe to host the console' {
            foreach ($b in $script:Playbooks) {
                $text = Get-Content -LiteralPath $b.FullName -Raw
                $exes = @([regex]::Matches($text, '[A-Za-z0-9_\-]+\.exe') | ForEach-Object { $_.Value.ToLowerInvariant() } | Sort-Object -Unique)
                @($exes | Where-Object { $_ -ne 'powershell.exe' }) | Should -BeNullOrEmpty -Because "$($b.Name) may only relaunch through powershell.exe; found: $($exes -join ', ')"
            }
        }
    }

    Context 'the vendor catalog contributes no installer source' {
        It 'vendors.json holds no download URL' {
            $urls = @()
            foreach ($v in $script:Vendors.vendors) {
                foreach ($p in $v.urls.PSObject.Properties) { $urls += "$($p.Value)" }
                if ($v.PSObject.Properties['tenantUrlTemplate'] -and $v.tenantUrlTemplate) { $urls += "$($v.tenantUrlTemplate)" }
            }
            @($urls | Where-Object { $_ -match '(?i)\.(msi|exe|msix|appx|zip|ps1)(\?|$)' }) | Should -BeNullOrEmpty -Because 'a vendor catalog URL must be a portal, never a download; a download belongs in packages.json or community.json with a trust record'
            $urls.Count | Should -BeGreaterThan 0 -Because 'the scan must actually see the vendor URLs to mean anything'
        }
    }
}
