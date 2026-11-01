# Move 22: "Add a Pester test for every contract schema's validators" (#740).
#
# The contract validators (DE.Contracts Test-DEContract) enforce the wire shapes every component
# trusts: device records, rescue handoffs, Hub jobs, orders, warranties, migration records. This
# suite exercises every schema's validators generically - the conforming sample and each violation
# are GENERATED from the schema itself, so every declared rule gets a case:
#
#   required -> the property is dropped        const   -> the value is wrong
#   enum     -> a value outside the enum       pattern -> a value that does not match
#   minLength-> too short                      type    -> a value of another JSON kind
#   items    -> one bad element
#
# Three guards keep it from going hollow:
#   - every *.schema.json in the contracts folder must be reachable through Get-DEContractSchema's
#     ValidateSet (a schema file added without wiring in fails here), and vice versa;
#   - every string pattern the schemas use needs a known-good sample in $PatternSamples (a new
#     pattern fails here until its sample is added, rather than the case being skipped);
#   - a sanity case asserts the generator produced every rule kind for a known schema, so a
#     generator bug cannot pass by generating nothing.
#
# Nested object rules are enforced by the same walker this exercises at the top level; the cases
# here cover each rule kind once per schema plus the array items rules.

Describe 'Every contract schema has its validators under test' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Contracts = Join-Path (Split-Path -Parent $PSScriptRoot) 'contracts'

        # known-good values for the string patterns the schemas declare; a pattern without a sample
        # here is a loud failure, not a silent skip
        $script:PatternSamples = @{
            '^(DETechConsole|DERescue|DEHub)/'   = 'DETechConsole/x'
            '^DERescue/'                         = 'DERescue/x'
            '^[a-z0-9-]+:[A-Z0-9-]+$'            = 'dell:ABC123'
            '^[A-Za-z0-9-]{1,64}$'               = 'proj-1'
            '^[a-z0-9.-]+\.[a-z]{2,}$'           = 'acme.example'
            '^[a-z0-9]+(\.[a-z0-9-]+)+$'         = 'security.guardz'
        }
        # one value per JSON kind, for the type-mismatch cases
        $script:KindSamples = @{
            string = 'x'; integer = 1; number = 1.5; boolean = $true; object = @{}; array = @(1); null = $null
        }

        function script:New-DEConformingSample {
            <# The smallest object the schema accepts: required properties only, each generated
               from its own rules (const, enum, pattern, minLength, type), recursively. #>
            param($Schema)
            if ($Schema.PSObject.Properties['const']) { return $Schema.const }
            if ($Schema.PSObject.Properties['enum']) { return @($Schema.enum)[0] }
            $types = @()
            if ($Schema.PSObject.Properties['type']) { $types = @($Schema.type) }
            $t = @($types | Where-Object { $_ -ne 'null' }) | Select-Object -First 1
            if ($t -eq 'object') {
                $o = @{}
                foreach ($r in @($Schema.required | Where-Object { $_ })) {
                    $sp = $Schema.properties.PSObject.Properties[$r]
                    if (-not $sp) { throw "schema requires '$r' but declares no property for it" }
                    $o[$r] = New-DEConformingSample -Schema $sp.Value
                }
                return $o
            }
            # the comma keeps an empty array an array: return @() unrolls to nothing, and the
            # validator would then see a null where the schema demands an array
            if ($t -eq 'array') { return , @() }
            if ($t -eq 'string') {
                $pat = $null; if ($Schema.PSObject.Properties['pattern']) { $pat = $Schema.pattern }
                if ($pat) {
                    if (-not $script:PatternSamples.ContainsKey($pat)) { throw "no known-good sample for pattern '$pat'; add one to PatternSamples" }
                    return $script:PatternSamples[$pat]
                }
                $min = 0; if ($Schema.PSObject.Properties['minLength']) { $min = [int]$Schema.minLength }
                return ('x' * [Math]::Max(1, $min))
            }
            if ($t) { return $script:KindSamples[$t] }
            return 'x'
        }

        function script:New-DEWrongKind {
            param($Schema)
            $types = @(); if ($Schema.PSObject.Properties['type']) { $types = @($Schema.type) }
            foreach ($k in @('string', 'integer', 'object', 'array', 'boolean', 'number')) {
                if ($types -notcontains $k) { return $script:KindSamples[$k] }
            }
            return $null
        }

        function script:New-DEViolationCases {
            <# One case per declared rule on each top-level property (and per items rule): the case
               carries the mutated object and the message fragment the validator must produce. #>
            param($Schema)
            $cases = New-Object System.Collections.Generic.List[object]
            $base = New-DEConformingSample -Schema $Schema
            foreach ($r in @($Schema.required | Where-Object { $_ })) {
                $m = @{} + $base; $m.Remove($r)
                $cases.Add([pscustomobject]@{ Why = "required '$r' dropped"; Object = $m; Fragment = "${r}: required" })
            }
            foreach ($p in $Schema.properties.PSObject.Properties) {
                $name = $p.Name; $sp = $p.Value
                $one = { param($value, $why, $fragment)
                    $m = @{} + $base; $m[$name] = $value
                    $cases.Add([pscustomobject]@{ Why = "$name $why"; Object = $m; Fragment = $fragment })
                }
                if ($sp.PSObject.Properties['const']) { & $one 'wrong-value' 'const violated' 'must be' }
                if ($sp.PSObject.Properties['enum']) { & $one 'not-in-the-enum' 'enum violated' 'is not one of' }
                if ($sp.PSObject.Properties['pattern']) {
                    foreach ($bad in @('!! BAD !!', 'Bad Value!', '0000')) {
                        if ("$($script:PatternSamples[$sp.pattern])" -cne $bad -and $bad -cnotmatch $sp.pattern) { & $one $bad 'pattern violated' 'does not match'; break }
                    }
                }
                if ($sp.PSObject.Properties['minLength']) { & $one '' 'shorter than minLength' 'shorter than' }
                # a const prop is refused on its const before its type is ever looked at, so the
                # wrong-kind case belongs to the const-free props only
                if ($sp.PSObject.Properties['type'] -and -not $sp.PSObject.Properties['const']) {
                    $bad = New-DEWrongKind -Schema $sp
                    if ($null -ne $bad -or @($sp.type) -notcontains 'null') { & $one $bad 'wrong type' 'expected' }
                }
                if ($sp.PSObject.Properties['items'] -and $sp.items.PSObject.Properties['pattern']) {
                    & $one @('!! BAD !!') 'item pattern violated' 'does not match'
                }
                if ($sp.PSObject.Properties['items'] -and $sp.items.PSObject.Properties['type'] -and -not $sp.items.PSObject.Properties['pattern']) {
                    & $one @((New-DEWrongKind -Schema $sp.items)) 'item type violated' 'expected'
                }
            }
            return $cases
        }
    }

    Context 'every schema file is wired into the validators' {
        It 'each *.schema.json is reachable through Get-DEContractSchema, and every ValidateSet name has a file' {
            $files = @(Get-ChildItem -Path $script:Contracts -Filter '*.schema.json' | ForEach-Object { $_.BaseName -replace '\.schema$', '' })
            $files.Count | Should -BeGreaterThan 0
            foreach ($n in $files) { { Get-DEContractSchema -Name $n } | Should -Not -Throw -Because "the schema file '$n.schema.json' must be wired into Get-DEContractSchema's ValidateSet" }
            foreach ($n in @('device', 'order', 'handoff', 'warranty', 'job', 'migration')) {
                $files -contains $n | Should -Be $true -Because "ValidateSet offers '$n' but the contracts folder has no such schema"
            }
        }
    }

    Context 'every schema accepts its conforming sample and rejects every rule violation' {
        It '<name> validators all bite' -TestCases @(
            @{ name = 'device' }, @{ name = 'order' }, @{ name = 'handoff' }, @{ name = 'warranty' }, @{ name = 'job' }, @{ name = 'migration' }
        ) {
            param($name)
            $schema = Get-DEContractSchema -Name $name
            $good = New-DEConformingSample -Schema $schema
            $clean = @(Test-DEContract -Name $name -Object $good)
            ($clean -join ' | ') | Should -BeNullOrEmpty -Because "the conforming sample must validate clean, or the generator is wrong: $($clean -join ' | ')"
            $missed = New-Object System.Collections.Generic.List[string]
            foreach ($c in @(New-DEViolationCases -Schema $schema)) {
                $msgs = @((Test-DEContract -Name $name -Object $c.Object) -join ' | ')
                if (-not ($msgs -match [regex]::Escape($c.Fragment))) { $missed.Add($c.Why) }
            }
            ($missed -join '; ') | Should -BeNullOrEmpty -Because 'these declared rules did not refuse their violation'
        }
    }

    Context 'the case generator itself is not hollow' {
        It 'produces every rule kind for job.schema (the generator generating nothing must fail)' {
            $cases = @(New-DEViolationCases -Schema (Get-DEContractSchema -Name job))
            $cases.Count | Should -BeGreaterThan 10 -Because 'job.schema declares required, const, enum, pattern, minLength, type and items rules'
            # @() everywhere: a single Where-Object result is a bare object whose .Count is $null
            # under Windows PowerShell 5.1, which would read as "no case" instead of "one case"
            @($cases | Where-Object { $_.Fragment -like '*: required' }).Count | Should -BeGreaterThan 0
            @($cases | Where-Object { $_.Fragment -eq 'must be' }).Count | Should -BeGreaterThan 0
            @($cases | Where-Object { $_.Fragment -eq 'is not one of' }).Count | Should -BeGreaterThan 0
            @($cases | Where-Object { $_.Fragment -eq 'does not match' }).Count | Should -BeGreaterThan 0
            @($cases | Where-Object { $_.Fragment -eq 'shorter than' }).Count | Should -BeGreaterThan 0
            @($cases | Where-Object { $_.Fragment -eq 'expected' }).Count | Should -BeGreaterThan 0
        }
    }
}
