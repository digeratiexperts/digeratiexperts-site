# Move 60: "Design the Hub job-queue endpoints: lease, acknowledge, result" (#778) - design only.
#
# HUB-JOB-QUEUE.md specifies endpoints that are not built. A design nobody checks drifts from itself, so
# this suite pins what can be checked without the Hub: the worked examples are real JSON and carry no
# secret-shaped keys, the lease example is internally consistent (the lease ends when the envelope does,
# inside the 900 second window), the refusal example uses a code the document defines, every error code a
# response names is in the error table, the local links resolve, and the document still says it is
# design only. Checking the examples against the job contract itself is move 65's job once the device
# side exists; this move deliberately does not depend on it.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'HUB-JOB-QUEUE.md (design only) is consistent with itself' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:DocPath = Join-Path $script:Win 'HUB-JOB-QUEUE.md'
        $script:Text = [IO.File]::ReadAllText($script:DocPath)

        function script:Get-DEDocExample {
            param([string]$Name)
            $m = [regex]::Match($script:Text, '<!-- example:' + [regex]::Escape($Name) + ' -->\s*```json\s*(.*?)```', 'Singleline')
            if (-not $m.Success) { throw "no example marked '$Name' in HUB-JOB-QUEUE.md" }
            return ($m.Groups[1].Value | ConvertFrom-Json)
        }
    }

    Context 'the worked examples' {
        It '<name> is valid JSON and carries no secret-shaped key or recovery-shaped value' -TestCases @(
            @{ name = 'lease-response' }
            @{ name = 'ack-refusal' }
            @{ name = 'result' }
        ) {
            param($name)
            $ex = Get-DEDocExample -Name $name
            $ex | Should -Not -BeNullOrEmpty
            $hits = @(Find-DEContractSecrets -Object $ex)
            ($hits -join ', ') | Should -BeNullOrEmpty
        }
        It 'the lease ends when the envelope does, and the window is inside 900 seconds' {
            $ex = Get-DEDocExample -Name 'lease-response'
            $ex.lease.jobId | Should -Be $ex.job.jobId
            $ex.lease.leaseExpiresAt | Should -Be $ex.job.expiresAt
            $ex.lease.leasedAt | Should -Be $ex.job.issuedAt
            $issued = [datetime]::Parse($ex.job.issuedAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal)
            $expires = [datetime]::Parse($ex.job.expiresAt, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal)
            ($expires - $issued).TotalSeconds | Should -BeLessOrEqual 900
            ($expires - $issued).TotalSeconds | Should -BeGreaterThan 0
        }
        It 'the envelope in the lease example is a job of a kind the contract knows' {
            $ex = Get-DEDocExample -Name 'lease-response'
            $ex.job.schema | Should -Be 'de.techconsole.job/v1'
            @((Get-DEContractSchema -Name 'job').properties.kind.enum) | Should -Contain $ex.job.kind
        }
        It 'the result example binds itself with a hash and says it was redacted' {
            $ex = Get-DEDocExample -Name 'result'
            $ex.resultSha256 | Should -Match '^[a-f0-9]{64}$'
            $ex.redacted | Should -Be $true
            @('succeeded', 'failed', 'cancelled', 'timed_out') | Should -Contain $ex.status
        }
    }

    Context 'refusals and errors' {
        It 'the refusal example uses a code the document defines' {
            $ex = Get-DEDocExample -Name 'ack-refusal'
            $m = [regex]::Match($script:Text, '`refusal\.code` is one of: (.*?)\. `detail`', 'Singleline')
            $m.Success | Should -Be $true -Because 'the refusal code list must be stated'
            $codes = @([regex]::Matches($m.Groups[1].Value, '`([a-z_]+)`') | ForEach-Object { $_.Groups[1].Value })
            $codes.Count | Should -BeGreaterThan 10
            $codes | Should -Contain $ex.refusal.code
        }
        It 'every error code a response names is in the error table' {
            $table = [regex]::Match($script:Text, '## 9\. Errors(.*?)## 10\.', 'Singleline').Groups[1].Value
            $tableCodes = @([regex]::Matches($table, '\|\s*`([a-z_]+)`\s*\|') | ForEach-Object { $_.Groups[1].Value })
            $tableCodes.Count | Should -BeGreaterThan 8
            $named = @([regex]::Matches($script:Text, '"error":\s*"([a-z_]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object -Unique)
            $named.Count | Should -BeGreaterThan 0
            $missing = @($named | Where-Object { $tableCodes -notcontains $_ })
            ($missing -join ', ') | Should -BeNullOrEmpty
        }
        It 'also names the conflict codes it uses in prose' {
            $table = [regex]::Match($script:Text, '## 9\. Errors(.*?)## 10\.', 'Singleline').Groups[1].Value
            foreach ($c in @('result_conflict', 'lease_expired', 'already_acknowledged', 'device_mismatch', 'stale_request')) {
                $table | Should -Match ('`' + $c + '`') -Because "$c is used in the endpoint text"
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
        It 'answers the threats it claims to' {
            foreach ($t in @('D1', 'R1', 'T1')) { $script:Text | Should -Match $t }
            $tm = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-THREAT-MODEL.md'))
            foreach ($t in @('D1', 'R1', 'T1')) { $tm | Should -Match ("\| $t \|") -Because "$t must exist in the threat model this design cites" }
        }
    }
}
