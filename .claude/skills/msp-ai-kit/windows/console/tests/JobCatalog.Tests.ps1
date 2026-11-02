# Move 67: "Reject any action ID not in the signed local catalog" (#785).
#
# DE.AgentCatalog is the second key of the two-key check (AGENT-THREAT-MODEL.md section 7; threats T2 and E1): a job
# runs an action only when the job kind allows it (move 59) AND the signed local catalog contains it. The suite pins:
#   - the catalog is vouched for first: a tampered copy, an unsigned development copy, or a copy that cannot name its
#     own catalog takes no jobs (unsigned only via the explicit -AllowUnsigned rehearsal switch);
#   - the job must name THIS device's catalog (the SHA-256 of integrity.json), or it is refused;
#   - an action id is in the catalog only if it is, byte for byte, a registered id: no wildcard, no case folding, no
#     trimming, no look-alike; and what the refusal echoes is neutralised so a hostile id cannot forge a log line;
#   - against the REAL registry: every registered action id is accepted, and an id that is not registered is refused;
#   - the live wrapper fails closed in a development checkout (there is no integrity.json) and never throws.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentCatalog: an action id not in the signed local catalog is refused' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $script:Dir = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentCatalog.psm1') -Force
        $script:Hash = ('ab' * 32)
        $script:Registered = @('net.time', 'net.connectivity', 'maint.hardware', 'baseline.fw-domain', 'jumpcloud.usergroup.Alamo---Users')
        function script:Test-Cat {
            param([string[]]$Ids, [string]$JobHash = $script:Hash, [string]$Local = $script:Hash, [string]$Status = 'signed', [switch]$AllowUnsigned)
            return (Test-DEJobCatalog -ActionIds $Ids -JobCatalogSha256 $JobHash -LocalCatalogSha256 $Local -IntegrityStatus $Status -RegisteredActionIds $script:Registered -AllowUnsigned:$AllowUnsigned)
        }
    }

    Context 'the catalog is vouched for first' {
        It 'accepts registered ids from a signed copy with a matching catalog hash' {
            $r = Test-Cat -Ids @('net.time', 'jumpcloud.usergroup.Alamo---Users')
            $r.Ok | Should -Be $true -Because $r.Why
        }
        It 'refuses a tampered copy, whatever else is true (catalog_tampered)' {
            (Test-Cat -Ids @('net.time') -Status 'tampered').Code | Should -Be 'catalog_tampered'
            (Test-Cat -Ids @('net.time') -Status 'tampered' -AllowUnsigned).Code | Should -Be 'catalog_tampered' -Because 'AllowUnsigned never excuses tampering'
        }
        It 'refuses an unsigned or unknown copy by default (catalog_unavailable)' {
            (Test-Cat -Ids @('net.time') -Status 'unsigned').Code | Should -Be 'catalog_unavailable'
            (Test-Cat -Ids @('net.time') -Status 'unknown').Code | Should -Be 'catalog_unavailable'
            (Test-Cat -Ids @('net.time') -Status '').Code | Should -Be 'catalog_unavailable'
        }
        It 'takes an unsigned copy only when asked by name, and still never an unknown one' {
            (Test-Cat -Ids @('net.time') -Status 'unsigned' -AllowUnsigned).Ok | Should -Be $true
            (Test-Cat -Ids @('net.time') -Status 'unknown' -AllowUnsigned).Code | Should -Be 'catalog_unavailable'
        }
        It 'refuses a copy that cannot name its own catalog' {
            (Test-Cat -Ids @('net.time') -Local '').Code | Should -Be 'catalog_unavailable'
            (Test-Cat -Ids @('net.time') -Local 'not-a-hash').Code | Should -Be 'catalog_unavailable'
        }
    }

    Context 'the job must name this device''s catalog' {
        It 'refuses a different catalog hash (catalog_mismatch)' {
            (Test-Cat -Ids @('net.time') -JobHash ('cd' * 32)).Code | Should -Be 'catalog_mismatch'
        }
        It 'refuses an empty or malformed hash from the job, and a hash that differs only in case' {
            (Test-Cat -Ids @('net.time') -JobHash '').Code | Should -Be 'catalog_mismatch'
            (Test-Cat -Ids @('net.time') -JobHash 'garbage').Code | Should -Be 'catalog_mismatch'
            (Test-Cat -Ids @('net.time') -JobHash $script:Hash.ToUpperInvariant()).Code | Should -Be 'catalog_mismatch'
        }
        It 'judges tampering before the hash, so the reason is the root cause' {
            (Test-Cat -Ids @('net.time') -Status 'tampered' -JobHash ('cd' * 32)).Code | Should -Be 'catalog_tampered'
        }
    }

    Context 'an action id is in the catalog only if it is exactly a registered id' {
        It 'refuses <why> (action_not_in_catalog)' -TestCases @(
            @{ why = 'an id nobody registered'; id = 'net.nothing' }
            @{ why = 'a wildcard'; id = 'net.*' }
            @{ why = 'a family name alone'; id = 'net' }
            @{ why = 'a different case'; id = 'Net.Time' }
            @{ why = 'a registered id with a trailing space'; id = 'net.time ' }
            @{ why = 'a registered id with a leading space'; id = ' net.time' }
            @{ why = 'a registered id with a path suffix'; id = 'net.time/../x' }
            @{ why = 'script text'; id = 'Invoke-Expression "calc"' }
            @{ why = 'a command separator'; id = 'net.time; calc' }
            @{ why = 'a capital-letter variant of a registered group id'; id = 'jumpcloud.usergroup.alamo---users' }
        ) {
            param($why, $id)
            $r = Test-Cat -Ids @($id)
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'action_not_in_catalog'
        }
        It 'refuses the whole job when only one of its actions is unknown, and names which' {
            $r = Test-Cat -Ids @('net.time', 'net.nothing', 'maint.hardware', 'also.missing')
            $r.Code | Should -Be 'action_not_in_catalog'
            @($r.Rejected).Count | Should -Be 2
            $r.Rejected | Should -Contain 'net.nothing'
            $r.Rejected | Should -Contain 'also.missing'
        }
        It 'refuses an empty job (schema)' {
            (Test-Cat -Ids @()).Code | Should -Be 'schema'
        }
        It 'neutralises what a refusal echoes, so a hostile id cannot forge a log line or flood one' {
            $r = Test-Cat -Ids @("net.time`nINFO job approved by joe", ('x' * 500))
            $r.Code | Should -Be 'action_not_in_catalog'
            foreach ($e in @($r.Rejected)) {
                $e | Should -Not -Match '[\x00-\x1f\x7f]'
                $e.Length | Should -BeLessOrEqual 67
            }
        }
        It 'caps how many rejected ids it reports' {
            $r = Test-Cat -Ids @(1..40 | ForEach-Object { "fake.id$_" })
            @($r.Rejected).Count | Should -Be 20
        }
    }

    Context 'the catalog identity' {
        It 'is the SHA-256 of integrity.json, stable, and changes when the file changes' {
            $p = Join-Path $script:Dir 'integrity.json'
            Set-Content -LiteralPath $p -Value '{"files":[{"path":"a.ps1","sha256":"00"}]}'
            $a = Get-DECatalogSha256 -IntegrityPath $p
            $a | Should -Match '^[a-f0-9]{64}$'
            (Get-DECatalogSha256 -IntegrityPath $p) | Should -Be $a
            (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() | Should -Be $a
            Add-Content -LiteralPath $p -Value ' '
            (Get-DECatalogSha256 -IntegrityPath $p) | Should -Not -Be $a
        }
        It 'throws when there is no integrity.json, so a copy that cannot name its catalog is never matched' {
            { Get-DECatalogSha256 -IntegrityPath (Join-Path $script:Dir 'absent.json') } | Should -Throw
        }
    }

    Context 'against the real action registry' {
        BeforeAll {
            $script:Real = @{}
            $prof = Get-DEClientProfile -Id 'alamo'
            foreach ($mode in @('takeover', 'deprovision')) {
                $null = @(Initialize-DEWorkflow -ClientProfile $prof -Mode $mode)
                foreach ($a in @(Get-DEActions)) { if (-not $script:Real.ContainsKey($a.Id)) { $script:Real[$a.Id] = $true } }
            }
        }
        It 'the registry is really loaded (the checks below would pass on an empty one)' {
            $script:Real.Count | Should -BeGreaterThan 90
        }
        It 'accepts every registered action id, so the catalog never refuses its own actions' {
            $ids = @($script:Real.Keys)
            $r = Test-DEJobCatalog -ActionIds $ids -JobCatalogSha256 $script:Hash -LocalCatalogSha256 $script:Hash -IntegrityStatus 'signed' -RegisteredActionIds $ids
            $r.Ok | Should -Be $true -Because "rejected: $(@($r.Rejected) -join ', ')"
        }
        It 'refuses an id that is not registered, even next to registered ones' {
            $ids = @($script:Real.Keys)
            $r = Test-DEJobCatalog -ActionIds @($ids[0], 'deprov.everything') -JobCatalogSha256 $script:Hash -LocalCatalogSha256 $script:Hash -IntegrityStatus 'signed' -RegisteredActionIds $ids
            $r.Code | Should -Be 'action_not_in_catalog'
        }
    }

    Context 'the live wrapper fails closed' {
        It 'a development checkout has no integrity.json, so it takes no jobs, and the wrapper never throws' {
            { $script:r = Confirm-DEJobCatalog -ActionIds @('net.time') -JobCatalogSha256 $script:Hash } | Should -Not -Throw
            $script:r.Ok | Should -Be $false
            $script:r.Code | Should -BeIn @('catalog_unavailable', 'catalog_tampered')
        }
        It 'reports catalog_unavailable when nothing is registered (the workflow is not initialised)' {
            Mock -ModuleName DE.AgentCatalog Get-DEActions { @() }
            Mock -ModuleName DE.AgentCatalog Test-DEConsoleIntegrity { [pscustomobject]@{ status = 'signed' } }
            Mock -ModuleName DE.AgentCatalog Get-DEConsole { [pscustomobject]@{ Root = (Join-Path $script:Dir 'console') } }
            $r = Confirm-DEJobCatalog -ActionIds @('net.time') -JobCatalogSha256 $script:Hash
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'catalog_unavailable'
        }
    }
}
