# Move 69: "Implement heartbeat and inventory deltas" (#787).
#
# DE.AgentHeartbeat builds what the agent tells the Hub (AGENT-THREAT-MODEL.md D1, I5). The suite pins:
#   - an ALLOWLIST: a person-identifying field in the input (user name, email, profile path, anything unknown) never
#     reaches the heartbeat, and only the COUNT of dropped fields is reported, never names or values;
#   - values are facts, not payloads: single-line, short, and nothing shaped like a recovery password;
#   - deltas: only what changed, only when something changed, key order irrelevant; a full inventory when the Hub asks,
#     on the first beat, or when a delta would be too big to be worth sending;
#   - the body is bounded, the state is one of the known states, and the device key must be a real one.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentHeartbeat: allowlisted facts, deltas only when something changed' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentHeartbeat.psm1') -Force
        $script:Now = [datetime]::SpecifyKind([datetime]'2026-11-01T12:00:00', 'Utc')
        $script:Facts = [ordered]@{ hostname = 'ALAMO-LAP-0231'; serial = 'ABC123'; manufacturer = 'Dell Inc.'; model = 'Latitude 7450'; os = 'Windows 11 Pro'; osBuild = '26100'; ramGB = 16; tpmPresent = $true }
        function script:New-Beat {
            param($Facts = $script:Facts, $Previous = $null, [switch]$NeedFull, $State = 'enrolled_idle', $CertNotAfter = $null)
            return (New-DEHeartbeat -AgentVersion '0.1.0' -State $State -DeviceKey 'dell:ABC123' -Facts $Facts -Previous $Previous -NeedFull:$NeedFull -Now $script:Now -CertNotAfter $CertNotAfter)
        }
    }

    Context 'only device facts get in' {
        It 'drops every field the allowlist does not name, and reports only how many' {
            $in = [ordered]@{ hostname = 'ALAMO-LAP-0231'; assignedUser = 'alice'; email = 'alice@example.com'; userName = 'alice'; profilePath = 'C:\Users\alice'; localUserName = 'alice'; favouriteColour = 'blue' }
            $s = Get-DEInventorySnapshot -Facts $in
            @($s.Facts.Keys) -join ',' | Should -Be 'hostname'
            $s.Dropped | Should -Be 6
            ($s | ConvertTo-Json -Depth 4 -Compress) | Should -Not -Match 'alice|profilePath|favouriteColour'
        }
        It 'the heartbeat body carries no personal value and no personal field name' {
            $in = [ordered]@{ hostname = 'ALAMO-LAP-0231'; assignedUser = 'alice'; email = 'alice@example.com'; profilePath = 'C:\Users\alice' }
            $b = New-Beat -Facts $in
            $b.Body | Should -Not -Match 'alice|assignedUser|email|profilePath'
            ($b.Body | ConvertFrom-Json).droppedFields | Should -Be 3
        }
        It 'the allowlist is case-sensitive: a differently cased name is not a fact' {
            (Get-DEInventorySnapshot -Facts ([ordered]@{ Hostname = 'x'; SERIAL = 'y' })).Dropped | Should -Be 2
        }
        It 'accepts a plain object as well as a dictionary' {
            $s = Get-DEInventorySnapshot -Facts ([pscustomobject]@{ hostname = 'H1'; model = 'M' })
            @($s.Facts.Keys) -join ',' | Should -Be 'hostname,model'
        }
    }

    Context 'values are facts, not payloads' {
        It 'drops a value shaped like a BitLocker recovery password, in every form' {
            foreach ($v in @('111111-222222-333333-444444-555555-666666-777777-888888', '111111 222222 333333 444444 555555 666666 777777 888888', '111111222222333333444444555555666666777777888888')) {
                $s = Get-DEInventorySnapshot -Facts ([ordered]@{ model = "x $v y" })
                $s.Facts.Count | Should -Be 0
                $s.Dropped | Should -Be 1
            }
        }
        It 'flattens control characters, caps length and drops empty and structured values' {
            $s = Get-DEInventorySnapshot -Facts ([ordered]@{ hostname = "A`nB`tC"; model = ('m' * 300); cpu = '   '; os = @('a', 'b'); osBuild = @{ x = 1 } })
            $s.Facts['hostname'] | Should -Be 'A B C'
            $s.Facts['model'].Length | Should -Be 128
            $s.Facts.Contains('cpu') | Should -Be $false
            $s.Facts.Contains('os') | Should -Be $false
            $s.Facts.Contains('osBuild') | Should -Be $false
            $s.Dropped | Should -Be 3
        }
        It 'keeps numbers and booleans as they are' {
            $s = Get-DEInventorySnapshot -Facts ([ordered]@{ ramGB = 16; tpmPresent = $false })
            $s.Facts['ramGB'] | Should -Be 16
            $s.Facts['tpmPresent'] | Should -Be $false
        }
    }

    Context 'deltas' {
        It 'compares: added, changed with from and to, removed, and empty when nothing changed' {
            $a = [ordered]@{ hostname = 'H1'; model = 'M1'; os = 'W10' }
            $b = [ordered]@{ hostname = 'H1'; model = 'M2'; osBuild = '1' }
            $d = Compare-DEInventory -Previous $a -Current $b
            $d.Changed['model'].from | Should -Be 'M1'
            $d.Changed['model'].to | Should -Be 'M2'
            @($d.Added.Keys) -join ',' | Should -Be 'osBuild'
            ($d.Removed -join ',') | Should -Be 'os'
            $d.Empty | Should -Be $false
            (Compare-DEInventory -Previous $a -Current $a).Empty | Should -Be $true
        }
        It 'the first beat sends everything; a beat with nothing changed sends no inventory at all' {
            $first = New-Beat
            $first.Mode | Should -Be 'full'
            ($first.Body | ConvertFrom-Json).inventory.hostname | Should -Be 'ALAMO-LAP-0231'
            $second = New-Beat -Previous $first.Facts
            $second.Mode | Should -Be 'none'
            $j = $second.Body | ConvertFrom-Json
            $j.PSObject.Properties.Name | Should -Not -Contain 'inventory'
            $j.PSObject.Properties.Name | Should -Not -Contain 'inventoryDelta'
        }
        It 'a change sends only the change, and key order does not matter' {
            $first = New-Beat
            $reordered = [ordered]@{}
            foreach ($k in @($script:Facts.Keys | Sort-Object -Descending)) { $reordered[$k] = $script:Facts[$k] }
            (New-Beat -Facts $reordered -Previous $first.Facts).Mode | Should -Be 'none'
            $changed = [ordered]@{}; foreach ($k in $script:Facts.Keys) { $changed[$k] = $script:Facts[$k] }; $changed['osBuild'] = '26200'
            $b = New-Beat -Facts $changed -Previous $first.Facts
            $b.Mode | Should -Be 'delta'
            $j = $b.Body | ConvertFrom-Json
            $j.inventoryDelta.changed.osBuild.to | Should -Be '26200'
            $j.PSObject.Properties.Name | Should -Not -Contain 'inventory'
            $b.Body | Should -Not -Match 'ALAMO-LAP-0231' -Because 'unchanged facts are not resent'
        }
        It 'sends everything again when the Hub asks' {
            $first = New-Beat
            (New-Beat -Previous $first.Facts -NeedFull).Mode | Should -Be 'full'
        }
        It 'sends the full inventory when a delta would be no smaller than it, and a delta when it is smaller' {
            $a = [ordered]@{}; $b = [ordered]@{}
            foreach ($k in @('hostname', 'serial', 'manufacturer', 'model', 'os', 'osBuild', 'biosVersion', 'cpu')) { $a[$k] = ('a' * 128); $b[$k] = ('b' * 128) }
            $beat = New-Beat -Facts $b -Previous $a
            $beat.Mode | Should -Be 'full' -Because 'every field changed, so from and to together are bigger than the inventory'
            ($beat.Body | ConvertFrom-Json).inventoryMode | Should -Be 'full'
            $one = [ordered]@{}; foreach ($k in $a.Keys) { $one[$k] = $a[$k] }; $one['hostname'] = 'changed'
            (New-Beat -Facts $one -Previous $a).Mode | Should -Be 'delta'
        }
    }

    Context 'the rest of the heartbeat' {
        It 'reports state, version, device key, a send time, and the days left on the certificate' {
            $b = New-Beat -CertNotAfter ([datetime]::SpecifyKind([datetime]'2027-01-30T12:00:00', 'Utc'))
            $j = $b.Body | ConvertFrom-Json
            $j.schema | Should -Be 'de.techagent.heartbeat/v1'
            $j.state | Should -Be 'enrolled_idle'
            $j.deviceKey | Should -Be 'dell:ABC123'
            $j.sentAt | Should -Be '2026-11-01T12:00:00Z'
            $j.certDaysLeft | Should -Be 90
        }
        It 'reports a null certificate age rather than a made-up one, and pins only well-formed ids and hashes' {
            $b = New-DEHeartbeat -AgentVersion '0.1.0' -State 'unenrolled' -DeviceKey 'dell:ABC123' -Facts $script:Facts -Now $script:Now -CatalogSha256 'not-a-hash' -PinnedJobKeyIds @('job-2026-1', 'bad id with spaces', 'k2')
            $j = $b.Body | ConvertFrom-Json
            $j.certDaysLeft | Should -BeNullOrEmpty
            $j.catalogSha256 | Should -BeNullOrEmpty
            (@($j.pinnedJobKeyIds) -join ',') | Should -Be 'job-2026-1,k2'
        }
        It 'refuses an unknown state and a device key that is not a real one' {
            { New-Beat -State 'running_actions' } | Should -Throw
            { New-DEHeartbeat -AgentVersion '0.1.0' -State 'unenrolled' -DeviceKey 'ALAMO-LAP-0231' -Facts $script:Facts -Now $script:Now } | Should -Throw
        }
        It 'knows every state the service can be in' {
            foreach ($s in @('unenrolled', 'enrolled_idle', 'paused', 'revoked', 'state_unsafe')) { { New-Beat -State $s } | Should -Not -Throw }
        }
        It 'stays small' {
            (New-Beat).Body.Length | Should -BeLessThan 2000
        }
    }
}
