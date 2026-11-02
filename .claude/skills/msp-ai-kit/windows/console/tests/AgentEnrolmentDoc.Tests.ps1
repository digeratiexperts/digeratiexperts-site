# Move 61: "Design the one-time enrolment token exchange" (#779) - design only.
#
# AGENT-ENROLMENT.md specifies an exchange that is not built. This suite pins what can be checked without the
# Hub: the worked examples are valid JSON; the DEVICE messages (the enrolment request and the response) carry no
# secret-shaped key or recovery-shaped value, because the whole design rests on the code travelling in a header and
# never in a body; the example code has the format the document defines; the request names the proof and CSR the
# flow needs; every error code a response names is in the error table; local links resolve; and the document
# still says it is design only.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'AGENT-ENROLMENT.md (design only) is consistent with itself' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Text = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-ENROLMENT.md'))

        function script:Get-DEDocExample {
            param([string]$Name)
            $m = [regex]::Match($script:Text, '<!-- example:' + [regex]::Escape($Name) + ' -->\s*```json\s*(.*?)```', 'Singleline')
            if (-not $m.Success) { throw "no example marked '$Name' in AGENT-ENROLMENT.md" }
            return ($m.Groups[1].Value | ConvertFrom-Json)
        }
    }

    Context 'the worked examples' {
        It '<name> is valid JSON' -TestCases @(
            @{ name = 'token-create' }
            @{ name = 'enrol-request' }
            @{ name = 'enrol-response' }
        ) {
            param($name)
            (Get-DEDocExample -Name $name) | Should -Not -BeNullOrEmpty
        }
        It 'the device messages carry no secret-shaped key, and the code never rides in a body' {
            foreach ($name in @('enrol-request', 'enrol-response')) {
                $ex = Get-DEDocExample -Name $name
                $hits = @(Find-DEContractSecrets -Object $ex)
                ($hits -join ', ') | Should -BeNullOrEmpty -Because "$name is a device message and must carry no secret"
                $json = $ex | ConvertTo-Json -Depth 10 -Compress
                $json | Should -Not -Match 'dete_' -Because 'the enrolment code goes in the Authorization header only'
            }
        }
        It 'the example code has the format the document defines (dete_ plus 43 base64url characters)' {
            $ex = Get-DEDocExample -Name 'token-create'
            $ex.response.code | Should -Match '^dete_[A-Za-z0-9_-]{43}$'
            $ex.response.shownOnce | Should -Be $true
        }
        It 'the token request uses the defaults and limits the document states' {
            $ex = Get-DEDocExample -Name 'token-create'
            $ex.request.maxUses | Should -Be 1
            $ex.request.expiresInHours | Should -Be 24
            $ex.request.requireApproval | Should -Be $true
            $ex.request.accountId | Should -Match '^[1-9][0-9]{0,17}$' -Because 'the Hub account number is a positive whole number'
        }
        It 'the enrolment request carries the proof of possession and facts without people' {
            $ex = Get-DEDocExample -Name 'enrol-request'
            $ex.csr | Should -Not -BeNullOrEmpty
            $ex.proof | Should -Not -BeNullOrEmpty
            @('tpm', 'software') | Should -Contain $ex.keyStorage
            $names = @($ex.facts.PSObject.Properties.Name)
            foreach ($personal in @('user', 'userName', 'username', 'email', 'assignedUser', 'profilePath')) {
                $names | Should -Not -Contain $personal -Because 'facts name the device, not a person (I5)'
            }
        }
        It 'a response answers pending or active, and says when to poll' {
            $ex = Get-DEDocExample -Name 'enrol-response'
            @('pending', 'active') | Should -Contain $ex.status
            $ex.deviceKey | Should -Match '^[a-z0-9-]+:[A-Z0-9-]+$'
            [int]$ex.pollAfterSeconds | Should -BeGreaterThan 0
        }
    }

    Context 'errors' {
        It 'every error code a response names is in the error table' {
            $table = [regex]::Match($script:Text, '## 6\. Errors(.*?)## 7\.', 'Singleline').Groups[1].Value
            $tableCodes = @([regex]::Matches($table, '\|\s*`([a-z_]+)`\s*\|') | ForEach-Object { $_.Groups[1].Value })
            $tableCodes.Count | Should -BeGreaterThan 10
            $named = @([regex]::Matches($script:Text, '`(token_invalid|stale_request|account_not_mapped|already_enrolled|csr_invalid|key_type_not_allowed|proof_invalid|serial_unusable|enrolment_pending|enrolment_denied|enrolment_expired|rate_limited|bad_request)`') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
            $missing = @($named | Where-Object { $tableCodes -notcontains $_ })
            ($missing -join ', ') | Should -BeNullOrEmpty
            foreach ($c in @('token_invalid', 'proof_invalid', 'already_enrolled', 'serial_unusable', 'enrolment_denied')) {
                $tableCodes | Should -Contain $c
            }
        }
        It 'every token failure has the same status, so the endpoint is not an oracle' {
            $table = [regex]::Match($script:Text, '## 6\. Errors(.*?)## 7\.', 'Singleline').Groups[1].Value
            $table | Should -Match 'One answer for all four'
            $script:Text | Should -Match 'answers every failure of steps 2 to 4 with the same `token_invalid`'
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
            foreach ($t in @('S1', 'R4', 'S2', 'S3', 'I5')) {
                $script:Text | Should -Match $t
                $tm | Should -Match ("\| $t \|") -Because "$t must exist in the threat model this design cites"
            }
        }
    }
}
