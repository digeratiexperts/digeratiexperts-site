# Move 24: "Fuzz the Hub payload builder with malformed input" (#742).
#
# New-DEHubPayload turns a device record into the Intelligence Hub's device record. It runs at the
# worst possible moment - after an incident, on a machine in a strange state - so its contract is
# blunt: whatever it is handed, it never throws, it always produces the envelope, it always
# produces JSON the Hub can read, and no field that identifies a person survives (the personal
# field class is stripped at this boundary, move 92).
#
# The fuzz is deterministic on purpose: a fixed seed builds 25 junk records from a kind pool, and
# named hostile cases cover the shapes a random walk rarely reaches (64KB strings, control chars,
# quote soup, 40-deep nesting, 2000-wide arrays, recovery-shaped values). A failing case prints its
# seed and index, and the generator is pure, so the exact record can be rebuilt.
#
# What is NOT asserted: that a garbage record validates against the device contract. Garbage in is
# allowed to be garbage out; the Hub's own validation is the gate for that. What must never happen
# is a crash, a broken envelope, unserialisable output, or a person's name leaking through.

Describe 'The Hub payload builder survives malformed input' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Seed = 20261101
        $script:PersonalNames = @('assignedUser', 'localUserName', 'jumpcloudUser', 'email', 'endUser', 'endUserEmail', 'assigned', 'username', 'userName', 'user', 'samAccountName', 'upn', 'displayName', 'fullName')

        function script:Invoke-DEPayloadBuild {
            <# Builds the payload and reports how it went, never throwing outward. #>
            param($Record, [string]$BundleSha256 = '', [string]$BundlePath = '')
            try {
                $p = New-DEHubPayload -Record $Record -BundleSha256 $BundleSha256 -BundlePath $BundlePath
                return [pscustomobject]@{ Ok = $true; Payload = $p; Error = '' }
            } catch {
                return [pscustomobject]@{ Ok = $false; Payload = $null; Error = "$_" }
            }
        }

        function script:Assert-DEPayloadInvariants {
            <# The things that must hold for every input. Returns the violations.
               Personal handling follows Remove-DEPersonalFields' contract exactly: a personal LEAF
               is left out entirely (key and value), a personal key holding a container keeps its
               key and each leaf inside is withheld on its own terms. So the check is on the values
               the fuzz planted as strings under personal names: none may appear anywhere, and the
               key itself must be gone. #>
            param($Result, $Record)
            $bad = New-Object System.Collections.Generic.List[string]
            if (-not $Result.Ok) { $bad.Add("threw: $($Result.Error)"); return $bad }
            $p = $Result.Payload
            if ("$($p.schema)" -ne 'de.techconsole.device/v1') { $bad.Add("envelope broken: schema=$($p.schema)") }
            if ("$($p.source)" -notmatch '^DETechConsole/') { $bad.Add("envelope broken: source=$($p.source)") }
            if (-not "$($p.sentAt)") { $bad.Add('envelope broken: sentAt empty') }
            $json = $null
            try { $json = ($p | ConvertTo-Json -Depth 25 -Compress) } catch { $bad.Add("unserialisable: $_"); return $bad }
            if ($Record -is [System.Collections.IDictionary]) {
                foreach ($k in @($Record.Keys)) {
                    if ($script:PersonalNames -notcontains "$k") { continue }
                    $v = $Record[$k]
                    if ($v -is [string] -and $v) {
                        if ($json.Contains($v)) { $bad.Add("personal value survived under '$k'") }
                        # the key may appear only as a container (the builder's blocks recurse by
                        # design); a personal key carrying any leaf value is a leak whatever the kind
                        if ($json -match ('"' + [regex]::Escape("$k") + '":') -and $json -notmatch ('"' + [regex]::Escape("$k") + '":\s*[{[]')) {
                            $bad.Add("personal leaf survived: $k")
                        }
                    }
                }
            }
            return $bad
        }
    }

    Context 'named hostile records' {
        It '<case> never breaks the builder' -TestCases @(
            @{ case = 'an empty record'; record = @{} }
            @{ case = 'every field null'; record = @{ serial = $null; hostname = $null; manufacturer = $null; model = $null; client = $null; site = $null; email = $null; assignedUser = $null; exceptions = $null } }
            @{ case = 'numbers where strings belong'; record = @{ serial = 12345; hostname = 1.5; manufacturer = $true; client = 42; site = 0 } }
            @{ case = 'objects where strings belong'; record = @{ serial = @{ a = 1 }; hostname = @{ b = @(@{ c = 2 }) }; client = @('x') } }
            @{ case = 'a 64KB field'; record = @{ hostname = ('A' * 65536); serial = 'PF3ABC12' } }
            @{ case = 'control characters'; record = @{ hostname = ((1..31 | ForEach-Object { [char]$_ }) -join ''); serial = 'PF3ABC12' } }
            @{ case = 'quote and backslash soup'; record = @{ hostname = '"\"''`n`t${}$()|&;'; serial = 'PF3ABC12' } }
            @{ case = '40-deep nesting in exceptions'; record = @{ serial = 'PF3ABC12'; exceptions = $( $e = @{ note = 'x' }; for ($i = 0; $i -lt 40; $i++) { $e = @{ n = $e } }; $e ) } }
            @{ case = 'a 2000-wide array in exceptions'; record = @{ serial = 'PF3ABC12'; exceptions = @(1..2000 | ForEach-Object { @{ target = "t$_"; reason = 'r' } }) } }
            @{ case = 'recovery-shaped values smuggled into notes'; record = @{ serial = 'PF3ABC12'; exceptions = @(@{ target = 'x'; reason = '111111-222222-333333-444444-555555-666666-777777-888888' }) } }
            @{ case = 'personal names stuffed everywhere'; record = @{ serial = 'PF3ABC12'; email = 'a@b.c'; assignedUser = 'alice'; localUserName = 'alice'; jumpcloudUser = 'alice'; user = 'alice'; displayName = 'Alice A'; exceptions = @(@{ target = 'email'; reason = 'x' }) } }
        ) {
            param($case, $record)
            $r = Invoke-DEPayloadBuild -Record $record
            $bad = Assert-DEPayloadInvariants -Result $r -Record $record
            ($bad -join '; ') | Should -BeNullOrEmpty -Because "the builder's contract must hold for $case"
        }
    }

    Context 'seeded random junk (rebuild any case from the seed and index)' {
        It '25 random records never break the builder' {
            $rng = New-Object System.Random $script:Seed
            $fields = @('serial', 'hostname', 'manufacturer', 'model', 'assetTag', 'role', 'os', 'client', 'site', 'assignedUser', 'localUserName', 'jumpcloudUser', 'email', 'mode', 'readiness', 'technician', 'exceptions', 'areas')
            $misses = New-Object System.Collections.Generic.List[string]
            for ($i = 0; $i -lt 25; $i++) {
                $rec = @{}
                $count = $rng.Next(0, $fields.Count + 1)
                for ($j = 0; $j -lt $count; $j++) {
                    $f = $fields[$rng.Next(0, $fields.Count)]
                    $kind = $rng.Next(0, 6)
                    # strings are unique tokens so the value check cannot match a longer plant by accident
                    $rec[$f] = switch ($kind) {
                        0 { $null }
                        1 { '' }
                        2 { 'PX-{0}-{1}-{2}' -f $script:Seed, $i, $j }
                        3 { $rng.Next(-100000, 100000) }
                        4 { @() }
                        default { @{ junk = 'PX-{0}-{1}-{2}' -f $script:Seed, $i, $j } }
                    }
                }
                $r = Invoke-DEPayloadBuild -Record $rec
                $bad = Assert-DEPayloadInvariants -Result $r -Record $rec
                foreach ($b in $bad) { $misses.Add("case ${i}: $b") }
            }
            ($misses -join '; ') | Should -BeNullOrEmpty -Because "seed $($script:Seed) reproduces each case exactly"
        }
    }

    Context 'the well-formed case is contract-clean (the positive anchor)' {
        It 'a complete record produces a payload the device contract accepts' {
            $rec = @{
                serial = 'PF3ABC12'; hostname = 'ALAMO-LAP-0231'; manufacturer = 'Dell'; model = 'Latitude 7450'
                assetTag = ''; role = 'staff'; os = 'Windows 11 Pro (build 26100)'
                client = 'Alamo'; site = ''; mode = 'takeover'; readiness = 'oobe'; areas = @('identity'); started = '2026-11-01T00:00:00Z'; completed = $null; technician = 'jrpetro'
                exceptions = @(@{ target = 'identity.leave'; reason = 'left behind'; approver = 'Joe'; expiresOn = '2027-01-01T00:00:00Z' })
            }
            $r = Invoke-DEPayloadBuild -Record $rec
            $r.Ok | Should -Be $true -Because $r.Error
            (Assert-DEPayloadInvariants -Result $r -Record $rec) -join '; ' | Should -BeNullOrEmpty
            $problems = @((Test-DEContract -Name 'device' -Object $r.Payload) -join ' | ')
            $problems | Should -BeNullOrEmpty -Because "a well-formed record must produce a contract-clean payload: $problems"
        }
    }
}
