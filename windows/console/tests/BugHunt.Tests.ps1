# Regressions for the bug hunt (Windows PowerShell 5.1 behaviour, Hub signing, fail-closed checks). Pester 4.10 and 5.x.
Describe 'Hub records: JSON.stringify bytes, secrets at any depth, invariant timestamps' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:BhT = @{ Dir = Initialize-TestConsole } }
    It 'writes numbers, keys, GUIDs and nested arrays exactly as JavaScript does' {
        ConvertTo-DECanonicalJson ([ordered]@{ a = 0.00001; b = 1e21; c = [decimal]5.00; d = [uint32]7; e = 1e-7 }) | Should -Be '{"a":0.00001,"b":1e+21,"c":5,"d":7,"e":1e-7}'
        ConvertTo-DECanonicalJson ([ordered]@{ z = 1; '10' = 2; '2' = 3 }) | Should -Be '{"2":3,"10":2,"z":1}'
        ConvertTo-DECanonicalJson ([guid]'0f8fad5b-d9cb-469f-a165-70867728950e') | Should -Be '"0f8fad5b-d9cb-469f-a165-70867728950e"'
        ConvertTo-DECanonicalJson ('[[1,2],[{"k":"v"}]]' | ConvertFrom-Json) | Should -Be '[[1,2],[{"k":"v"}]]'
    }
    It 'formats timestamps the same under a culture whose time separator is not a colon' {
        $c = [Globalization.CultureInfo]::InvariantCulture.Clone(); $c.DateTimeFormat.TimeSeparator = '.'
        $dt = [datetime]::SpecifyKind([datetime]'2026-09-29 05:17:12', 'Utc')
        $out = & { $old = [Threading.Thread]::CurrentThread.CurrentCulture; [Threading.Thread]::CurrentThread.CurrentCulture = $c; try { ConvertTo-DECanonicalJson $dt } finally { [Threading.Thread]::CurrentThread.CurrentCulture = $old } }
        $out | Should -Be '"2026-09-29T05:17:12.000Z"'
    }
    It 'finds a secret deeper than 20 levels and a recovery password without dashes' {
        $deep = @{ apiToken = 'x' }; for ($i = 0; $i -lt 22; $i++) { $deep = @{ n = $deep } }
        @(Test-DEContract -Name 'warranty' -Object @{ nested = $deep }) -join ' ' | Should -Match 'apiToken: secrets never'
        @(Find-DEContractSecrets -Object @{ note = ('123456' * 8) }).Count | Should -Be 1
        @(Find-DEContractSecrets -Object @{ note = (@('123456') * 8 -join ' ') }).Count | Should -Be 1
        Protect-DEText ('key ' + (@('111111') * 8 -join ' ')) | Should -Not -Match '111111'
    }
}

Describe 'Fail closed: engine, integrity, per-user controls' {
    BeforeAll { . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $global:BhT = @{ Dir = Initialize-TestConsole } }
    It 'an apply that queues a restart is recorded once as WARN, not re-applied, remediated and failed' {
        $global:BhT.Applies = 0; $global:BhT.Rem = 0
        Register-DEAction -Id 't.firmware' -Module 'test' -Title 'Firmware' -Detect { @{ current = $false } } -Desired { @{ current = $true } } -Apply { param($s) $global:BhT.Applies++; $null = Request-DEReboot -Reason 'firmware staged' -ResumeAction 't.firmware'; 'staged' } -Remediate { param($s) $global:BhT.Rem++ }
        $r = Invoke-DEAction -Id 't.firmware' -Mode Apply
        $r.result | Should -Be 'WARN'; $r.action | Should -Match 'restart queued'
        $global:BhT.Applies | Should -Be 1; $global:BhT.Rem | Should -Be 0
        Set-DEStateValue -Path 'reboot.pending' -Value @()
    }
    It 'a listed file that cannot be read is tampering, not unknown' {
        $base = Join-Path $global:BhT.Dir 'pkg'; $root = Join-Path $base 'console'; New-Item -ItemType Directory -Path $root -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $root 'a.ps1') -Value '1'
        Set-Content -LiteralPath (Join-Path $base 'integrity.json') -Value '{"files":[{"path":"console/a.ps1","sha256":"00"}]}'
        Mock -ModuleName DE.Core Get-DEFileSha256 { throw 'The process cannot access the file because it is being used by another process.' }
        $i = Test-DEConsoleIntegrity -Root $root
        $i.status | Should -Be 'tampered'; ($i.problems -join ' ') | Should -Match 'unreadable: console/a.ps1'
    }
    It 'a profile whose hive did not load is never reported as set for all profiles' {
        Mock -ModuleName DE.Configure Open-DEUserHives { @{ targets = @(@{ sid = 'S-1-5-21-1-2-3-1001'; root = 'Registry::HKEY_USERS\X'; name = 'alice' }); loaded = @(); failed = @('bob') } }
        Mock -ModuleName DE.Configure Close-DEUserHives { }
        Mock -ModuleName DE.Configure Get-DERegistryValue { 1 }
        InModuleScope DE.Configure {
            $s = Get-DEUserScopeState -Control @{ path = 'HKCU:\Software\X'; name = 'V'; value = 1 }
            $s.ok | Should -Be $false; $s.detail | Should -Match 'bob \(hive not loaded\)'; $s.have | Should -Be '1 of 2 profiles'
        }
    }
    It 'JumpCloud lists are unrolled even when Invoke-RestMethod hands back the array as one object (5.1)' {
        Mock -ModuleName DE.JumpCloud Test-DESecret { $true }
        Mock -ModuleName DE.JumpCloud Get-DESecretPlain { 'k' }
        Mock -ModuleName DE.JumpCloud Invoke-RestMethod { Write-Output -NoEnumerate @([pscustomobject]@{ to = [pscustomobject]@{ id = 'G1' } }, [pscustomobject]@{ to = [pscustomobject]@{ id = 'G2' } }) }
        $l = @(Get-DEJumpCloudList -Path '/users/U1/memberof')
        $l.Count | Should -Be 2; $l[1].to.id | Should -Be 'G2'
    }
}

Describe 'Boot rescue never writes key digits' {
    BeforeAll { Import-Module (Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'rescue/DE.Rescue.psm1') -Force -DisableNameChecking }
    It 'names the bad group without echoing it' {
        $r = Test-DERecoveryPasswordFormat -Value '123457-000000-000000-000000-000000-000000-000000-000000'
        $r.ok | Should -Be $false; $r.badGroup | Should -Be 1; $r.reason | Should -Not -Match '\d{6}'
    }
}

Describe 'Windows PowerShell 5.1: an unset value is {} in JSON' {
    It 'no object literal holds $(if ...) without an else (5.1 writes the empty result as {}, which reads back as a truthy object and breaks Hub contracts)' {
        $root = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $files = @(Get-ChildItem -LiteralPath (Join-Path $root 'console/modules'), (Join-Path $root 'microsoft'), (Join-Path $root 'rescue') -Recurse -Include '*.ps1', '*.psm1' -File) + @(Get-Item -LiteralPath (Join-Path $root 'console/DETechConsole.ps1'))
        $hits = foreach ($f in $files) {
            $t = $null; $e = $null
            $ast = [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$t, [ref]$e)
            foreach ($h in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.HashtableAst] }, $true)) {
                foreach ($kv in $h.KeyValuePairs) {
                    $v = $kv.Item2
                    if (-not ($v -is [System.Management.Automation.Language.PipelineAst] -and $v.PipelineElements.Count -eq 1)) { continue }
                    $x = $v.PipelineElements[0].Expression
                    if ($x -isnot [System.Management.Automation.Language.SubExpressionAst]) { continue }
                    $st = @($x.SubExpression.Statements)
                    if ($st.Count -eq 1 -and $st[0] -is [System.Management.Automation.Language.IfStatementAst] -and -not $st[0].ElseClause) { "$($f.Name):$($kv.Item1.Extent.StartLineNumber) $($kv.Item1.Extent.Text)" }
                }
            }
        }
        @($hits) -join '; ' | Should -Be ''
    }
}
