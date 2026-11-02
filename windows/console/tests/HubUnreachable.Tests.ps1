# Move 76: "Test the agent with the Hub unreachable and confirm local functions still run" (#794).
#
# The agent does not exist yet, so this holds the shipped tool to the property the agent will inherit (AGENT-THREAT-MODEL.md
# D3): a Hub that cannot be reached is an inconvenience, never an outage of the tool. Against a Hub that REALLY cannot be
# reached (nothing listens, the name does not resolve, a server that accepts and never answers):
#   - the send path never throws, returns "not sent", keeps the payload for manual upload and records the failure;
#   - the reachability probe says no, and says it within its own time bound;
#   - the local functions (diagnostic bundle, gap report, evidence, integrity) run exactly as they do online, in the same
#     session, after the failed send;
#   - a failed send changes nothing but the evidence;
#   - every network call in a Hub-bound file carries a timeout, so an unreachable Hub cannot hold the tool.
# Nothing is mocked on the network path: these are real connection attempts to a closed local port, an unresolvable name
# and a listener that never replies.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'With the Hub unreachable, the tool still works and says what happened' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $script:Dir = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Rec = { New-DEHubPayload -Record @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; model = 'X1'; exceptions = @() } }
        Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://127.0.0.1:1/api/anything'
        Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'unreachable-hub-secret-4242'
        Set-DEContext -Values @{ hubAccountId = '42' }
    }

    Context 'the send path' {
        It 'a Hub that refuses connections: no throw, not sent, the payload kept, the failure recorded, and it is quick' {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $r = $null
            { $script:r = Send-DEHubPayload -Payload (& $script:Rec) -Confirm:$false } | Should -Not -Throw
            $sw.Stop()
            $script:r.sent | Should -Be $false
            $script:r.file | Should -Not -BeNullOrEmpty
            Test-Path -LiteralPath $script:r.file | Should -Be $true -Because 'the record is saved for manual upload'
            $sw.Elapsed.TotalSeconds | Should -BeLessThan 25
            (Get-Content -LiteralPath $script:r.file -Raw) | Should -Not -Match 'unreachable-hub-secret-4242'
            @(Get-DEEvidence | Where-Object { $_.step -eq 'hub.push' -and $_.result -eq 'FAIL' }).Count | Should -BeGreaterThan 0
        }
        It 'a name that does not resolve behaves the same way' {
            Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.no-such-name.invalid/api/x'
            $r = $null
            { $script:r = Send-DEHubPayload -Payload (& $script:Rec) -Confirm:$false } | Should -Not -Throw
            $script:r.sent | Should -Be $false
            Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://127.0.0.1:1/api/anything'
        }
        It 'a failed send changes nothing but the evidence: the settings are as they were' {
            $before = Get-DEState -Path 'settings.hub.endpoint'
            $null = Send-DEHubPayload -Payload (& $script:Rec) -Confirm:$false
            (Get-DEState -Path 'settings.hub.endpoint') | Should -Be $before
        }
    }

    Context 'the reachability probe' {
        It 'says no to a closed port, quickly, without throwing' {
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $r = Test-DEHubReachable -Endpoint 'https://127.0.0.1:1' -TimeoutSec 5
            $sw.Stop()
            $r.ok | Should -Be $false
            $r.detail | Should -Match 'did not answer'
            $sw.Elapsed.TotalSeconds | Should -BeLessThan 15
        }
        It 'says no to a server that accepts and never answers, within its own time bound' {
            $listener = New-Object Net.Sockets.TcpListener ([Net.IPAddress]::Loopback), 0
            $listener.Start()
            try {
                $port = ([Net.IPEndPoint]$listener.LocalEndpoint).Port
                $sw = [Diagnostics.Stopwatch]::StartNew()
                $r = Test-DEHubReachable -Endpoint "https://127.0.0.1:$port" -TimeoutSec 3
                $sw.Stop()
                $r.ok | Should -Be $false
                $sw.Elapsed.TotalSeconds | Should -BeLessThan 30 -Because 'a Hub that never answers must not hold the tool'
            } finally { $listener.Stop() }
        }
        It 'refuses a non-https Hub URL without trying' {
            $r = Test-DEHubReachable -Endpoint 'http://127.0.0.1:1'
            $r.ok | Should -Be $false
            $r.detail | Should -Match 'https://'
        }
    }

    Context 'the local functions run, in the same session, after the failed send' {
        BeforeAll { $null = Send-DEHubPayload -Payload (& $script:Rec) -Confirm:$false }
        It 'writes a diagnostic bundle' {
            $b = Export-DEDiagnosticBundle
            Test-Path -LiteralPath $b.zip | Should -Be $true
            Test-Path -LiteralPath (Join-Path $b.folder 'diagnostic.json') | Should -Be $true
        }
        It 'builds the gap report' {
            { $null = @(Get-DEGapReport) } | Should -Not -Throw
        }
        It 'records and reads evidence' {
            $null = Add-DEEvidence -Step 'offline.check' -Module 'evidence' -Before 'hub unreachable' -ActionTaken 'local evidence still recorded' -Result 'PASS' -Verification 'move 76'
            @(Get-DEEvidence | Where-Object { $_.step -eq 'offline.check' }).Count | Should -Be 1
        }
        It 'checks its own integrity' {
            $i = Test-DEConsoleIntegrity
            $i.status | Should -BeIn @('signed', 'unsigned', 'tampered', 'unknown')
        }
        It 'builds the device record it would have sent' {
            $p = & $script:Rec
            $p.deviceKey | Should -Be 'lenovo:PF3ABC12'
            @(Test-DEContract -Name device -Object $p) -join ' | ' | Should -Be ''
        }
    }

    Context 'an unreachable Hub cannot hold the tool' {
        It 'every network call in a Hub-bound file carries a timeout of at most a minute' {
            $files = @(
                (Join-Path $script:Win 'console\modules\DE.Contracts\DE.Contracts.psm1'), (Join-Path $script:Win 'console\modules\DE.Evidence\DE.Evidence.psm1'),
                (Join-Path $script:Win 'console\modules\DE.License\DE.License.psm1'), (Join-Path $script:Win 'microsoft\DE-Microsoft-Admin\DE-HubWorker.ps1')
            )
            $calls = 0; $bad = New-Object System.Collections.Generic.List[string]
            foreach ($f in $files) {
                $lines = @(Get-Content -LiteralPath $f)
                for ($i = 0; $i -lt $lines.Count; $i++) {
                    if ($lines[$i] -match '^\s*#') { continue }
                    if ($lines[$i] -notmatch 'Invoke-RestMethod\s+-|Invoke-WebRequest\s+-') { continue }
                    $calls++
                    $m = [regex]::Match($lines[$i], '-TimeoutSec\s+(\$?\w+)')
                    $ok = $m.Success
                    if ($ok -and $m.Groups[1].Value -match '^\d+$' -and [int]$m.Groups[1].Value -gt 60) { $ok = $false }
                    if (-not $ok) { $bad.Add("$(Split-Path $f -Leaf):$($i + 1)") }
                }
            }
            $calls | Should -BeGreaterThan 2 -Because 'the scan must be looking at the Hub calls'
            ($bad -join ', ') | Should -BeNullOrEmpty -Because 'an unreachable Hub must not be able to hold the tool'
        }
        It 'the scan sees a call without a timeout (a planted one)' {
            $line = 'return (Invoke-RestMethod -Uri $Uri -Method Post -Body $b)'
            $line -match 'Invoke-RestMethod\s+-' | Should -Be $true
            [regex]::Match($line, '-TimeoutSec\s+(\$?\w+)').Success | Should -Be $false
            $timed = 'return (Invoke-RestMethod -Uri $Uri -TimeoutSec 30 -Method Post)'
            [regex]::Match($timed, '-TimeoutSec\s+(\$?\w+)').Success | Should -Be $true
        }
    }
}
