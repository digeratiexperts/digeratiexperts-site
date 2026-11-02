# Move 64: "Add certificate rotation" (#782) - design only.
#
# AGENT-ROTATION.md specifies procedures nobody has built yet. This suite pins what can be checked without the Hub: the rotation policy renews well before expiry and alerts after renewal was due; the renewal request carries a CSR for a new key; the response keeps the old certificate active through the overlap and issues a different serial; every error is in the table; the rules that make rotation safe (a new key every time, never delete the working key until the new one has worked, no grace after expiry, a pin is only ever removed by a signed upgrade, the Hub switches last behind a 99 percent gate) are stated; all four keys have their own section.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'AGENT-ROTATION.md (design only) is consistent with itself' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Text = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-ROTATION.md'))
        $script:Flat = $script:Text -replace '\s+', ' '

        function script:Get-DEDocExample {
            param([string]$Name)
            $m = [regex]::Match($script:Text, '<!-- example:' + [regex]::Escape($Name) + ' -->\s*```json\s*(.*?)```', 'Singleline')
            if (-not $m.Success) { throw "no example marked '$Name' in AGENT-ROTATION.md" }
            return ($m.Groups[1].Value | ConvertFrom-Json)
        }
    }

    Context 'the worked examples' {
        It '<name> is valid JSON and carries no secret-shaped key or recovery-shaped value' -TestCases @(
            @{ name = 'rotation-policy' }
            @{ name = 'renew-request' }
            @{ name = 'renew-response' }
        ) {
            param($name)
            $ex = Get-DEDocExample -Name $name
            $ex | Should -Not -BeNullOrEmpty
            $hits = @(Find-DEContractSecrets -Object $ex)
            ($hits -join ', ') | Should -BeNullOrEmpty
        }
    }

    Context 'what this document fixes' {
        It 'the rotation policy renews well before expiry and alerts before the end' {
            $p = Get-DEDocExample -Name 'rotation-policy'
            [int]$p.renewAfterDays | Should -BeLessThan ([int]$p.validityDays)
            ([int]$p.renewAfterDays + [int]$p.renewJitterDays) | Should -BeLessThan ([int]$p.validityDays) -Because 'even the latest jittered renewal starts before expiry'
            [int]$p.staleAlertDaysLeft | Should -BeLessThan ([int]$p.validityDays - [int]$p.renewAfterDays - [int]$p.renewJitterDays) -Because 'the stale alert must fire after renewal was due, not before it'
            [int]$p.staleAlertDaysLeft | Should -BeGreaterThan 0
            [int]$p.minHoursBetweenRenewals | Should -BeGreaterThan 0
            $p.newKeyEveryRenewal | Should -Be $true
        }
        It 'the renewal request carries a CSR for a new key and names the certificate it replaces' {
            $r = Get-DEDocExample -Name 'renew-request'
            $r.csr | Should -Not -BeNullOrEmpty
            $r.currentSerial | Should -Match '^[0-9a-f]{32}$'
            @('tpm', 'software') | Should -Contain $r.keyStorage
        }
        It 'the renewal response keeps the old certificate active through the overlap, and issues a different serial' {
            $r = Get-DEDocExample -Name 'renew-response'
            $p = Get-DEDocExample -Name 'rotation-policy'
            $r.status | Should -Be 'issued'
            $r.previousStatus | Should -Be 'active' -Because 'the old certificate keeps working until the new one is proven'
            $r.newSerial | Should -Match '^[0-9a-f]{32}$'
            $r.newSerial | Should -Not -Be $r.previousSerial
            [int]$r.confirmWithinMinutes | Should -Be ([int]$p.overlapMinutes)
            [datetime]::Parse($r.notAfter, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal) | Should -BeOfType [datetime]
        }
        It 'every error code is in the error table' {
            $table = [regex]::Match($script:Text, '## 6\. Errors(.*?)## 7\.', 'Singleline').Groups[1].Value
            $codes = @([regex]::Matches($table, '\|\s*`([a-z_]+)`\s*\|') | ForEach-Object { $_.Groups[1].Value })
            foreach ($c in @('device_revoked', 'device_not_active', 'certificate_expired', 'renew_too_soon', 'csr_invalid', 'key_reused', 'key_type_not_allowed')) {
                $codes | Should -Contain $c -Because "$c is part of the contract"
            }
            $named = @([regex]::Matches($script:Text, '`(renew_too_soon|key_reused|certificate_expired|csr_invalid)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
            $named.Count | Should -BeGreaterThan 2
            ($named | Where-Object { $codes -notcontains $_ }) -join ', ' | Should -BeNullOrEmpty
        }
        It 'states the rules that make rotation safe' {
            foreach ($phrase in @(
                'The agent never\s+deletes its working key until the new one has worked',
                'A job or response can never remove a pin',
                'at least 99 percent of\s+active devices',
                'does \*\*not\*\* stop renewal',
                '\*\*No grace after expiry\.\*\*',
                '\*\*Compromise is not rotation\.\*\*',
                'the Hub again acts last',
                '\*\*the Hub switches last\*\*',
                'Reusing the old key is\s+refused'
            )) {
                $script:Text | Should -Match $phrase
            }
        }
        It 'covers all four keys, each with its own section' {
            foreach ($h in @('## 1\. Device certificate renewal', '## 2\. The device intermediate CA', '## 3\. The Hub''s pinned server key', '## 4\. The job-signing key')) {
                $script:Text | Should -Match $h
            }
        }
    }



    Context 'the document itself' {
        It 'says it is design only, so nobody reads it as built' {
            $script:Text | Should -Match '\*\*Design only\.\*\*'
        }
        It 'every local link resolves to a file that exists' {
            $missing = New-Object System.Collections.Generic.List[string]
            foreach ($m in [regex]::Matches($script:Text, '\]\(([A-Za-z0-9._-]+\.md)\)')) {
                if (-not (Test-Path -LiteralPath (Join-Path $script:Win $m.Groups[1].Value))) { $missing.Add($m.Groups[1].Value) }
            }
            ($missing -join ', ') | Should -BeNullOrEmpty
        }
        It 'answers the threats it claims to, and they exist in the threat model' {
            $tm = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-THREAT-MODEL.md'))
            foreach ($t in @('S3', 'E5')) {
                $script:Text | Should -Match $t
                $tm | Should -Match ("\| $t \|") -Because "$t must exist in the threat model this design cites"
            }
        }
    }
}