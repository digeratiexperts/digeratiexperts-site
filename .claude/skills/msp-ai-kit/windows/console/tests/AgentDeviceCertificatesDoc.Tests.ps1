# Move 62: "Issue per-device client certificates in the Hub; support revocation" (#780) - design only.
#
# AGENT-DEVICE-CERTIFICATES.md specifies a credential nobody has built yet. This suite pins what can be checked without the Hub: the certificate profile is a client-auth-only, non-CA, short-lived ECDSA P-256 certificate whose identity is the account and device key (never a hostname), the revoke example uses a reason the document lists, revocation is checked against the Hub table on every request and fails closed, the CA key is kept apart from the job key, and every error the text names is in the error table.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'AGENT-DEVICE-CERTIFICATES.md (design only) is consistent with itself' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Text = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-DEVICE-CERTIFICATES.md'))
        $script:Flat = $script:Text -replace '\s+', ' '

        function script:Get-DEDocExample {
            param([string]$Name)
            $m = [regex]::Match($script:Text, '<!-- example:' + [regex]::Escape($Name) + ' -->\s*```json\s*(.*?)```', 'Singleline')
            if (-not $m.Success) { throw "no example marked '$Name' in AGENT-DEVICE-CERTIFICATES.md" }
            return ($m.Groups[1].Value | ConvertFrom-Json)
        }
    }

    Context 'the worked examples' {
        It '<name> is valid JSON and carries no secret-shaped key or recovery-shaped value' -TestCases @(
            @{ name = 'cert-profile' }
            @{ name = 'revoke' }
        ) {
            param($name)
            $ex = Get-DEDocExample -Name $name
            $ex | Should -Not -BeNullOrEmpty
            $hits = @(Find-DEContractSecrets -Object $ex)
            ($hits -join ', ') | Should -BeNullOrEmpty
        }
    }

    Context 'what this document fixes' {
        It 'the certificate profile is a client-auth-only, non-CA, short-lived ECDSA P-256 certificate' {
            $p = Get-DEDocExample -Name 'cert-profile'
            $p.keyAlgorithm | Should -Be 'ECDSA-P256'
            $p.basicConstraintsCA | Should -Be $false
            @($p.extendedKeyUsage) -join ',' | Should -Be 'clientAuth'
            @($p.keyUsage) -join ',' | Should -Be 'digitalSignature'
            [int]$p.validityDays | Should -BeLessOrEqual 90
            [int]$p.renewAfterDays | Should -BeLessThan ([int]$p.validityDays)
            [int]$p.renewAfterDays | Should -BeGreaterThan 0
        }
        It 'the identity is the account and the device key, never the hostname' {
            $p = Get-DEDocExample -Name 'cert-profile'
            $p.subjectAltNameUri | Should -Match '^urn:de:techagent:account:[1-9][0-9]{0,17}:device:[a-z0-9-]+:[A-Z0-9-]+$'
            $p.subject.commonName | Should -Match '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' -Because 'the common name is the enrolment id, not a hostname'
        }
        It 'the revoke example uses a reason the document lists, and cancels what the text says it cancels' {
            $r = Get-DEDocExample -Name 'revoke'
            $m = [regex]::Match($script:Text, '`reason` is one of ([^.]*)\.', 'Singleline')
            $m.Success | Should -Be $true
            $reasons = @([regex]::Matches($m.Groups[1].Value, '`([a-z_]+)`') | ForEach-Object { $_.Groups[1].Value })
            $reasons.Count | Should -Be 5
            $reasons | Should -Contain $r.request.reason
            $r.response.status | Should -Be 'revoked'
            [int]$r.response.certificatesRevoked | Should -BeGreaterThan 0
        }
        It 'says revocation is checked against the Hub table on every request and fails closed' {
            $script:Flat | Should -Match 'consults its own table on every request'
            $script:Flat | Should -Match 'cannot read the table refuses every request \(fail closed\)'
            $script:Flat | Should -Match '\*\*There is no CRL or OCSP\.\*\*'
        }
        It 'keeps the CA key apart from the job key' {
            $script:Flat | Should -Match '\*\*never the same key as the job key\*\*'
        }
        It 'every error code the text names is in the error table' {
            $table = [regex]::Match($script:Text, '## 7\. Errors(.*?)## 8\.', 'Singleline').Groups[1].Value
            $tableCodes = @([regex]::Matches($table, '\|\s*`([a-z_]+)`\s*\|') | ForEach-Object { $_.Groups[1].Value })
            $named = @([regex]::Matches($script:Text, '`(no_client_certificate|certificate_unknown|certificate_expired|device_revoked|device_not_active|device_mismatch|identity_store_unavailable)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
            $named.Count | Should -BeGreaterThan 5
            ($named | Where-Object { $tableCodes -notcontains $_ }) -join ', ' | Should -BeNullOrEmpty
            foreach ($c in @('no_client_certificate', 'certificate_unknown', 'certificate_expired', 'device_revoked', 'device_not_active', 'device_mismatch', 'identity_store_unavailable')) {
                $tableCodes | Should -Contain $c -Because "$c is part of the contract"
            }
            $script:Flat | Should -Match 'answered `403 device_revoked`'
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
            foreach ($t in @('S3', 'I4', 'E5')) {
                $script:Text | Should -Match $t
                $tm | Should -Match ("\| $t \|") -Because "$t must exist in the threat model this design cites"
            }
        }
    }
}