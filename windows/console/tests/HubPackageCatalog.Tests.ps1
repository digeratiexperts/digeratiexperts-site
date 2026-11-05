# Cross-repo review 2026-11-04, step 5 ("One endpoint runtime"): the Tech Tool reads the Intelligence Hub's
# install-kit catalog when the Hub is configured, and falls back to the bundled catalog\packages.json when it is
# not, when it is offline, or when its answer would weaken a pin.
#
# What must stay true whichever source wins:
#   - the request is the signed techconsole GET (TECHCONSOLE_TO_HUB_SECRET on the Hub), never an unsigned call;
#   - a Hub entry may move a pin but never drop or weaken one the bundled catalog has;
#   - one bad entry rejects the whole Hub answer (no mixed catalogs);
#   - the sha256 and Authenticode checks in Get-DEPackageFile run on Hub entries exactly as on bundled ones.

Describe 'Package catalog: the Hub install-kit catalog first, the bundled packages.json as fallback' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:BundledJson = (Get-DEPackageCatalog -Bundled | ConvertTo-Json -Depth 20)
        # a Hub answer that is the bundled catalog, re-labelled: the same packages and the same pins
        $script:NewHubCatalog = {
            $c = $script:BundledJson | ConvertFrom-Json
            $o = [ordered]@{ schema = 'de.techtool.package-catalog/v1'; generatedAt = '2026-11-05T00:00:00.000Z'; packages = @($c.packages) }
            return ([pscustomobject]$o | ConvertTo-Json -Depth 20 | ConvertFrom-Json)
        }
        $script:Configure = {
            Mock -ModuleName DE.Apps Get-DEState { 'https://hub.example/api/integrations/v1/techconsole/events' } -ParameterFilter { $Path -eq 'settings.hub.endpoint' }
            Mock -ModuleName DE.Apps Test-DESecret { $true } -ParameterFilter { $Name -eq 'DE_HUB_SIGNING_SECRET' }
            Mock -ModuleName DE.Apps Get-DESecretSecure { ConvertTo-SecureString 'test-signing-value' -AsPlainText -Force } -ParameterFilter { $Name -eq 'DE_HUB_SIGNING_SECRET' }
        }
    }
    BeforeEach { Reset-DEPackageCatalogCache }

    Context 'not configured: the bundled catalog, and no call to the Hub' {
        It 'uses packages.json when no Hub endpoint or signing secret is set' {
            Mock -ModuleName DE.Apps Get-DEState { $null } -ParameterFilter { $Path -eq 'settings.hub.endpoint' }
            Mock -ModuleName DE.Apps Get-DEHubSigned { throw 'must not be called' }
            $cat = Get-DEPackageCatalog
            @($cat.packages).Count | Should -Be @((Get-DEPackageCatalog -Bundled).packages).Count
            (Get-DEPackageCatalogSource).Source | Should -Be 'bundled'
            (Get-DEPackageCatalogSource).Reason | Should -Be 'not configured'
            Should -Invoke Get-DEHubSigned -ModuleName DE.Apps -Times 0
        }
        It 'an endpoint without the signing secret is not configured either: nothing unsigned is sent' {
            Mock -ModuleName DE.Apps Get-DEState { 'https://hub.example' } -ParameterFilter { $Path -eq 'settings.hub.endpoint' }
            Mock -ModuleName DE.Apps Test-DESecret { $false } -ParameterFilter { $Name -eq 'DE_HUB_SIGNING_SECRET' }
            Mock -ModuleName DE.Apps Get-DEHubSigned { throw 'must not be called' }
            $null = Get-DEPackageCatalog
            (Get-DEPackageCatalogSource).Source | Should -Be 'bundled'
            Should -Invoke Get-DEHubSigned -ModuleName DE.Apps -Times 0
        }
    }

    Context 'configured: the Hub is primary' {
        It 'reads the catalog with the signed techconsole GET on the Hub origin, and uses it' {
            & $script:Configure
            $hub = & $script:NewHubCatalog
            $hub.packages[0].notes = 'served by the Hub'
            Mock -ModuleName DE.Apps Get-DEHubSigned { $hub }
            $cat = Get-DEPackageCatalog
            $cat.packages[0].notes | Should -Be 'served by the Hub'
            (Get-DEPackageCatalogSource).Source | Should -Be 'hub'
            Should -Invoke Get-DEHubSigned -ModuleName DE.Apps -Times 1 -ParameterFilter { $BaseUrl -eq 'https://hub.example' -and $Path -eq '/api/techtool/install-kits/catalog' -and $Secret -is [securestring] }
        }
        It 'caches a good answer, so listing packages does not call the Hub once per package' {
            & $script:Configure
            $hub = & $script:NewHubCatalog
            Mock -ModuleName DE.Apps Get-DEHubSigned { $hub }
            $null = Get-DEPackages; $null = Get-DEPackages; $null = Get-DEPackage -Id 'jumpcloud-agent'
            Should -Invoke Get-DEHubSigned -ModuleName DE.Apps -Times 1 -Exactly
        }
        It 'a Hub-only package version with a new pin is accepted (the Hub may move a pin)' {
            & $script:Configure
            $hub = & $script:NewHubCatalog
            ($hub.packages | Where-Object id -eq 'jumpcloud-agent').source.sha256 = ('a' * 64)
            Mock -ModuleName DE.Apps Get-DEHubSigned { $hub }
            (Get-DEPackage -Id 'jumpcloud-agent').source.sha256 | Should -Be ('a' * 64)
            (Get-DEPackageCatalogSource).Source | Should -Be 'hub'
        }
    }

    Context 'offline: the bundled catalog, with a short backoff' {
        It 'falls back to packages.json when the Hub cannot be reached, and does not ask again inside the backoff' {
            & $script:Configure
            Mock -ModuleName DE.Apps Get-DEHubSigned { throw 'Unable to connect to the remote server' }
            $cat = Get-DEPackageCatalog
            @($cat.packages).Count | Should -Be @((Get-DEPackageCatalog -Bundled).packages).Count
            (Get-DEPackageCatalogSource).Source | Should -Be 'bundled'
            (Get-DEPackageCatalogSource).Reason | Should -Match 'unreachable'
            $null = Get-DEPackages; $null = Get-DEPackages
            Should -Invoke Get-DEHubSigned -ModuleName DE.Apps -Times 1 -Exactly
        }
        It 'a Hub that does not have the route yet (404) is the same as offline' {
            & $script:Configure
            Mock -ModuleName DE.Apps Get-DEHubSigned { throw 'Response status code does not indicate success: 404 (Not Found).' }
            $null = Get-DEPackageCatalog
            (Get-DEPackageCatalogSource).Source | Should -Be 'bundled'
        }
    }

    Context 'a Hub answer that would weaken a pin is refused whole, and the bundled catalog is used' {
        BeforeEach { & $script:Configure }
        It '<Case>' -TestCases @(
            @{ Case = 'dropping a publisher the bundled entry has'; Change = { param($h) ($h.packages | Where-Object id -eq 'wazuh-agent').source.publisher = $null }; Want = 'drops the bundled publisher' }
            @{ Case = 'changing the publisher'; Change = { param($h) ($h.packages | Where-Object id -eq 'wazuh-agent').source.publisher = 'Someone Else' }; Want = 'changes the publisher' }
            @{ Case = 'turning vendorSigns off'; Change = { param($h) ($h.packages | Where-Object id -eq 'jumpcloud-agent').source.vendorSigns = $false }; Want = 'turns vendorSigns off' }
            @{ Case = 'swapping a pinned installer for winget'; Change = { param($h) $s = ($h.packages | Where-Object id -eq 'm365-apps').source; $s.type = 'winget'; $s | Add-Member -NotePropertyName id -NotePropertyValue 'Microsoft.Office' -Force }; Want = 'moves from a pinned installer to winget' }
            @{ Case = 'a plain-http download'; Change = { param($h) ($h.packages | Where-Object id -eq 'jumpcloud-agent').source.url = 'http://cdn02.jumpcloud.com/x.msi' }; Want = 'not https' }
            @{ Case = 'a local path that leaves the packages folder'; Change = { param($h) ($h.packages | Where-Object id -eq 'guardz-agent').source.localPath = '..\..\Windows\evil.msi' }; Want = 'bare file name' }
            @{ Case = 'a malformed sha256'; Change = { param($h) ($h.packages | Where-Object id -eq 'jumpcloud-agent').source.sha256 = 'abc123' }; Want = '64 hex' }
            @{ Case = 'an unknown install type'; Change = { param($h) ($h.packages | Where-Object id -eq 'jumpcloud-agent').install.type = 'shell' }; Want = 'install type' }
            @{ Case = 'the wrong schema'; Change = { param($h) $h.schema = 'something/v9' }; Want = 'schema' }
            @{ Case = 'a duplicate package id'; Change = { param($h) $h.packages = @($h.packages) + @($h.packages[0]) }; Want = 'listed twice' }
        ) {
            param($Case, $Change, $Want)
            $hub = & $script:NewHubCatalog
            & $Change $hub
            Mock -ModuleName DE.Apps Get-DEHubSigned { $hub }
            $cat = Get-DEPackageCatalog
            (Get-DEPackageCatalogSource).Source | Should -Be 'bundled' -Because "a Hub catalog $Case must not be used"
            (Get-DEPackageCatalogSource).Reason | Should -Match ([regex]::Escape($Want))
            ($cat | ConvertTo-Json -Depth 20) | Should -Be $script:BundledJson -Because 'the fallback is the bundled catalog, unchanged'
        }
        It 'a new Hub-only package with neither sha256 nor publisher is refused' {
            $hub = & $script:NewHubCatalog
            $extra = [pscustomobject]@{ id = 'new-tool'; name = 'New tool'; source = [pscustomobject]@{ type = 'url'; url = 'https://vendor.example/new.msi'; sha256 = $null }; install = [pscustomobject]@{ type = 'msi'; args = '/quiet' } }
            $hub.packages = @($hub.packages) + @($extra)
            $problems = @(Test-DEHubPackageCatalog -Catalog $hub -Bundled (Get-DEPackageCatalog -Bundled))
            ($problems -join '; ') | Should -Match 'new-tool has neither sha256 nor publisher'
        }
        It 'the bundled catalog itself passes the same check (the rule matches what ships)' {
            $b = Get-DEPackageCatalog -Bundled
            $asHub = [pscustomobject]@{ schema = 'de.techtool.package-catalog/v1'; packages = @($b.packages) }
            @(Test-DEHubPackageCatalog -Catalog $asHub -Bundled $b) | Should -BeNullOrEmpty
        }
    }

    Context 'the pin and Authenticode checks run on Hub entries exactly as on bundled ones' {
        It 'a Hub-served local installer whose bytes do not match its pin is a hard refusal' {
            & $script:Configure
            $hub = & $script:NewHubCatalog
            $guardz = $hub.packages | Where-Object id -eq 'guardz-agent'
            $guardz.source.sha256 = ('0' * 64)
            Mock -ModuleName DE.Apps Get-DEHubSigned { $hub }
            $pkg = Get-DEPackage -Id 'guardz-agent'
            (Get-DEPackageCatalogSource).Source | Should -Be 'hub'
            $dir = Get-DELocalPackagesDir
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $dir $pkg.source.localPath) -Value 'not the pinned bytes'
            try {
                $file = Get-DEPackageFile -Package $pkg
                $file.trust.Ok | Should -Be $false
                $file.trust.HardRefusal | Should -Be $true -Because 'R3: a hash mismatch is never overridable, whichever catalog named the pin'
                ($file.trust.Reasons -join '; ') | Should -Match 'sha256 mismatch'
            } finally { Remove-Item -LiteralPath (Join-Path $dir $pkg.source.localPath) -Force -ErrorAction SilentlyContinue }
        }
    }
}
