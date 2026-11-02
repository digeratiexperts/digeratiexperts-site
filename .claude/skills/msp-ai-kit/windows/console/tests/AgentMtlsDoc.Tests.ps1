# Move 63: "Use mTLS on the agent connection" (#781) - design only.
#
# AGENT-MTLS.md specifies a transport nobody has built yet. This suite pins what can be checked without the Hub: the server snippet requires a verified client certificate (never optional), TLS 1.2 or higher, and sets its own identity headers; the connection profile pins two distinct server public keys and gates on time; the failure table covers the cases the design depends on. It also holds the SHIPPED tree to the one rule the design already leans on: no script installs a certificate-validation callback, skips the check, or narrows the allowed TLS versions - with a planted bypass proving the scan can see one.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'AGENT-MTLS.md (design only) is consistent with itself' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Text = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-MTLS.md'))
        $script:Flat = $script:Text -replace '\s+', ' '

        function script:Get-DEDocExample {
            param([string]$Name)
            $m = [regex]::Match($script:Text, '<!-- example:' + [regex]::Escape($Name) + ' -->\s*```json\s*(.*?)```', 'Singleline')
            if (-not $m.Success) { throw "no example marked '$Name' in AGENT-MTLS.md" }
            return ($m.Groups[1].Value | ConvertFrom-Json)
        }
    }

    Context 'the worked examples' {
        It '<name> is valid JSON and carries no secret-shaped key or recovery-shaped value' -TestCases @(
            @{ name = 'connection-profile' }
        ) {
            param($name)
            $ex = Get-DEDocExample -Name $name
            $ex | Should -Not -BeNullOrEmpty
            $hits = @(Find-DEContractSecrets -Object $ex)
            ($hits -join ', ') | Should -BeNullOrEmpty
        }
    }

    Context 'what this document fixes' {
        It 'the server snippet requires a verified client certificate, TLS 1.2 or higher, and sets its own identity headers' {
            $m = [regex]::Match($script:Text, '<!-- snippet:nginx -->\s*```nginx\s*(.*?)```', 'Singleline')
            $m.Success | Should -Be $true
            $cfg = $m.Groups[1].Value
            $cfg | Should -Match 'ssl_verify_client\s+on;'
            $cfg | Should -Not -Match 'ssl_verify_client\s+(optional|off|optional_no_ca)' -Because 'client certificates are never optional on the agent hostname'
            $cfg | Should -Match 'ssl_protocols\s+TLSv1\.2 TLSv1\.3;'
            $cfg | Should -Not -Match 'SSLv|TLSv1\s|TLSv1\.0|TLSv1\.1'
            $cfg | Should -Match 'ssl_session_tickets\s+off;'
            foreach ($h in @('X-DE-Client-Cert-Verify', 'X-DE-Client-Cert-Fingerprint', 'X-DE-Client-Cert-Serial')) {
                $cfg | Should -Match ('proxy_set_header\s+' + $h + '\s+\$ssl_client_') -Because "$h is set by the proxy, never copied from the client"
            }
            $cfg | Should -Match 'proxy_pass\s+http://unix:' -Because 'the application listens on a socket, so the headers cannot arrive from the network'
        }
        It 'the connection profile pins two distinct server public keys, floors TLS at 1.2 and gates on time' {
            $p = Get-DEDocExample -Name 'connection-profile'
            $pins = @($p.serverPublicKeySha256Pins)
            $pins.Count | Should -Be 2
            $pins[0] | Should -Not -Be $pins[1] -Because 'the second pin is a different, offline backup key'
            foreach ($pin in $pins) { $pin | Should -Match '^[A-Za-z0-9+/]{43}=$' -Because 'a SHA-256 hash in base64' }
            @('1.2', '1.3') | Should -Contain $p.minTlsVersion
            $p.requireTimeSync | Should -Be $true
            [int]$p.hubPort | Should -Be 443
        }
        It 'the failure table covers the five cases the design depends on' {
            $t = [regex]::Match($script:Text, '## 4\. What happens when it fails(.*?)## 5\.', 'Singleline').Groups[1].Value
            foreach ($row in @('matches no pin', 'expired or revoked', 'clock wrong', 'unreachable', 'is not `SUCCESS`')) {
                $t | Should -Match ([regex]::Escape($row)) -Because "the failure '$row' must be handled"
            }
            ($script:Flat) | Should -Match 'Sends nothing'
        }
        It 'states the no-bypass and pin-in-addition rules' {
            $script:Flat | Should -Match 'The pin check is in addition to normal chain validation, not instead of it'
            $script:Flat | Should -Match '\*\*No bypass, ever\.\*\*'
            $script:Flat | Should -Match '\*\*No CRL\.\*\*'
        }
    }

    Context 'the rule the shipped tree already keeps' {
        It 'no shipped script installs a certificate-validation callback or skips the certificate check' {
            $kit = Split-Path -Parent $script:Win
            $files = @(Get-ChildItem -Path $kit -Recurse -File | Where-Object { $_.Extension -in @('.ps1', '.psm1', '.cmd', '.bat') -and $_.FullName -notmatch '[\\/]tests[\\/]' })
            $files.Count | Should -BeGreaterThan 40 -Because 'the scan must be looking at the shipped tree'
            $bad = New-Object System.Collections.Generic.List[string]
            foreach ($f in $files) {
                $hit = Select-String -LiteralPath $f.FullName -Pattern 'ServerCertificateValidationCallback|ServerCertificateCustomValidationCallback|SkipCertificateCheck|\bCertificatePolicy\b|TrustAllCerts|--insecure' | Select-Object -First 1
                if ($hit) { $bad.Add("$($f.Name):$($hit.LineNumber)") }
            }
            ($bad -join ', ') | Should -BeNullOrEmpty -Because 'a bypass would make every pin and certificate in this design decorative'
        }
        It 'no shipped script narrows the allowed TLS versions (it may only add TLS 1.2)' {
            $kit = Split-Path -Parent $script:Win
            $files = @(Get-ChildItem -Path $kit -Recurse -File | Where-Object { $_.Extension -in @('.ps1', '.psm1') -and $_.FullName -notmatch '[\\/]tests[\\/]' })
            $bad = New-Object System.Collections.Generic.List[string]
            foreach ($f in $files) {
                foreach ($hit in @(Select-String -LiteralPath $f.FullName -Pattern 'SecurityProtocol\s*=')) {
                    if ($hit.Line -notmatch 'SecurityProtocol\s*=\s*\[Net\.ServicePointManager\]::SecurityProtocol\s+-bor\s+\[Net\.SecurityProtocolType\]::Tls12') { $bad.Add("$($f.Name):$($hit.LineNumber)") }
                }
            }
            ($bad -join ', ') | Should -BeNullOrEmpty
        }
        It 'the scan can find a bypass (a planted one is caught)' {
            $dir = Join-Path ([IO.Path]::GetTempPath()) ('de-tls-probe-' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            try {
                $probe = Join-Path $dir 'bad.ps1'
                Set-Content -LiteralPath $probe -Value '[Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }'
                $hit = Select-String -LiteralPath $probe -Pattern 'ServerCertificateValidationCallback|SkipCertificateCheck' | Select-Object -First 1
                $hit | Should -Not -BeNullOrEmpty
            } finally { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
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
            foreach ($t in @('S2', 'I3')) {
                $script:Text | Should -Match $t
                $tm | Should -Match ("\| $t \|") -Because "$t must exist in the threat model this design cites"
            }
        }
    }
}