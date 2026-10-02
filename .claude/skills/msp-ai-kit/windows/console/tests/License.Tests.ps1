# Licences, watermarked builds and the command-line cheat sheet (PROTECTING-THE-TOOL.md). Pester 4.10 and 5.x.
Describe 'Licences: device-bound, short-lived, Hub-signed' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:LicT = @{ Dir = Initialize-TestConsole }
        # a throwaway key pair: the public half is trusted for this session only, the private half signs test licences
        $global:LicT.Rsa = [Security.Cryptography.RSA]::Create(); try { $global:LicT.Rsa.KeySize = 2048 } catch { }
        $pub = $global:LicT.Rsa.ExportParameters($false)
        Add-DELicenseTrustedKey -Kid 'test-1' -Modulus (ConvertTo-DEBase64Url $pub.Modulus) -Exponent (ConvertTo-DEBase64Url $pub.Exponent)
        function global:New-TestLicense {
            param([hashtable]$Claims = @{}, [string]$Kid = 'test-1', [string]$Alg = 'RS256', [switch]$Tamper)
            $now = [int][double]::Parse((Get-Date -UFormat %s), [Globalization.CultureInfo]::InvariantCulture)
            $c = [ordered]@{ iss = 'de-hub'; aud = 'de-techtool'; sub = 'jrpetro'; typ = 'technician'; dev = @('lenovo:PF3ABC12'); clients = @('alamo'); features = @('apply', 'toolbox', 'clients'); iat = $now; nbf = $now; exp = $now + 8 * 3600; jti = [guid]::NewGuid().ToString() }
            foreach ($k in $Claims.Keys) { $c[$k] = $Claims[$k] }
            $h = ConvertTo-DEBase64Url ([Text.Encoding]::UTF8.GetBytes((@{ alg = $Alg; kid = $Kid; typ = 'DE-LIC' } | ConvertTo-Json -Compress)))
            $p = ConvertTo-DEBase64Url ([Text.Encoding]::UTF8.GetBytes(($c | ConvertTo-Json -Compress -Depth 4)))
            $sig = $global:LicT.Rsa.SignData([Text.Encoding]::ASCII.GetBytes("$h.$p"), [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
            if ($Tamper) { $c.clients = @('*'); $p = ConvertTo-DEBase64Url ([Text.Encoding]::UTF8.GetBytes(($c | ConvertTo-Json -Compress -Depth 4))) }
            return "$h.$p.$(ConvertTo-DEBase64Url $sig)"
        }
    }
    AfterAll { Set-DELicensePolicyOverride $null; Clear-DELicense }
    It 'refuses a licence without an id (it could never be revoked)' {
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ jti = '' }) -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'no id'
    }
    It 'ships public keys only and the policy in warn until the Hub issues licences' {
        $k = Get-Content -LiteralPath (Join-Path (Get-DEConsole).Root 'trust/license-keys.json') -Raw | ConvertFrom-Json
        foreach ($x in @($k.keys)) { foreach ($priv in 'd', 'p', 'q', 'dp', 'dq', 'qi') { $x.PSObject.Properties[$priv] | Should -BeNullOrEmpty } }
        (Get-DELicensePolicy).enforce | Should -Be 'warn'
    }
    It 'accepts a valid licence for this device and rejects every forgery and misuse' {
        $now = [int][double]::Parse((Get-Date -UFormat %s), [Globalization.CultureInfo]::InvariantCulture)
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'dell:OTHER1').state | Should -Be 'wrong-device'
        (Test-DELicenseToken -Token (New-TestLicense -Tamper) -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'signature'
        (Test-DELicenseToken -Token (New-TestLicense -Kid 'nobody') -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'unknown key'
        (Test-DELicenseToken -Token (New-TestLicense -Alg 'none') -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'RS256 only'
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ exp = $now - 3600; iat = $now - 7200; nbf = $now - 7200 }) -DeviceKey 'lenovo:PF3ABC12').state | Should -Be 'expired'
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ exp = $now + 30 * 86400 }) -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'longer than policy'
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ typ = 'order'; exp = $now + 30 * 86400 }) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ dev = @('*') }) -DeviceKey 'lenovo:PF3ABC12').reason | Should -Match 'name its device'
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ aud = 'someone-else' }) -DeviceKey 'lenovo:PF3ABC12').state | Should -Be 'invalid'
        (Test-DELicenseToken -Token 'not.a.licence.at.all' -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $false
    }
    It 'refuses a licence revoked in the list shipped with the build (trust/revoked.json)' {
        # a copy of trust/ so the repository's own folder is never written
        $global:LicT.Trust = Join-Path $global:LicT.Dir 'trust-copy'; New-Item -ItemType Directory -Path $global:LicT.Trust -Force | Out-Null
        Copy-Item -Path (Join-Path (Join-Path (Get-DEConsole).Root 'trust') '*.json') -Destination $global:LicT.Trust
        [IO.File]::WriteAllText((Join-Path $global:LicT.Trust 'revoked.json'), '{"jti":["shipped-revoked-1"],"updatedAt":null}')
        Mock -ModuleName DE.License Get-DELicenseRoot { $global:LicT.Trust }
        $t = Test-DELicenseToken -Token (New-TestLicense -Claims @{ jti = 'shipped-revoked-1' }) -DeviceKey 'lenovo:PF3ABC12'
        $t.state | Should -Be 'revoked'; $t.valid | Should -Be $false
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        (Get-DELicenseRevocations).shipped | Should -Be 1
    }
    It "downloads the Hub's revocation list into the data folder, never trust/, and refuses what it lists" {
        $trust = Join-Path (Get-DEConsole).Root 'trust'
        $before = @(Get-ChildItem -LiteralPath $trust -File | ForEach-Object { "$($_.Name):$((Get-FileHash -LiteralPath $_.FullName).Hash)" }) -join ','
        Mock -ModuleName DE.License Invoke-DELicenseHubGet { '{"jti":["hub-revoked-1","hub-revoked-2"],"updatedAt":"2026-10-02T12:00:00.000Z"}' }
        $r = Update-DELicenseRevocations -HubUrl 'https://hub.example/api/integrations/v1/techconsole/events'
        $r.ok | Should -Be $true; $r.updated | Should -Be $true; $r.count | Should -Be 2
        Assert-MockCalled -ModuleName DE.License Invoke-DELicenseHubGet -Times 1 -Exactly -Scope It -ParameterFilter { $Uri -eq 'https://hub.example/api/techtool/license/revocations' }
        $f = Get-DELicenseRevocationFile
        $f | Should -BeLike "$((Get-DEConsole).Dirs.Base)*"
        Test-Path -LiteralPath $f | Should -Be $true
        Test-Path -LiteralPath "$f.tmp" | Should -Be $false
        $bytes = [IO.File]::ReadAllBytes($f); ($bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB) | Should -Be $false   # UTF-8 without BOM
        (Get-Content -LiteralPath $f -Raw) | Should -Not -Match 'eyJ'                                            # no licence token in the file
        (@(Get-ChildItem -LiteralPath $trust -File | ForEach-Object { "$($_.Name):$((Get-FileHash -LiteralPath $_.FullName).Hash)" }) -join ',') | Should -Be $before
        $t = Test-DELicenseToken -Token (New-TestLicense -Claims @{ jti = 'hub-revoked-2' }) -DeviceKey 'lenovo:PF3ABC12'
        $t.state | Should -Be 'revoked'; $t.reason | Should -Match 'hub-revoked-2'
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        $rv = Get-DELicenseRevocations; $rv.downloaded | Should -Be 2; $rv.fetchedAt | Should -Not -BeNullOrEmpty
        Remove-Item -LiteralPath $f -Force
    }
    It 'a failed download keeps the last saved list and never makes a valid licence invalid' {
        $global:LicT.Net = 'up'
        Mock -ModuleName DE.License Invoke-DELicenseHubGet { if ($global:LicT.Net -eq 'down') { throw 'Unable to connect to the remote server' } else { '{"jti":["kept-1"],"updatedAt":"2026-10-02T12:00:00.000Z"}' } }
        (Update-DELicenseRevocations -HubUrl 'https://hub.example').updated | Should -Be $true
        $global:LicT.Net = 'down'
        $r = Update-DELicenseRevocations -HubUrl 'https://hub.example'
        $r.ok | Should -Be $false; $r.updated | Should -Be $false; $r.reason | Should -Match 'did not answer'; $r.count | Should -Be 1
        @((Get-DELicenseRevocations).jti) | Should -Contain 'kept-1'
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ jti = 'kept-1' }) -DeviceKey 'lenovo:PF3ABC12').state | Should -Be 'revoked'
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        # an unreadable saved list is ignored (logged), never a reason to refuse a valid licence
        [IO.File]::WriteAllText((Get-DELicenseRevocationFile), '{ torn')
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        Remove-Item -LiteralPath (Get-DELicenseRevocationFile) -Force
    }
    It 'refuses a Hub that is not https, and any answer that is not a revocation list, keeping the saved list' {
        $global:LicT.Body = '{"jti":["good-1"],"updatedAt":"2026-10-02T12:00:00.000Z"}'
        Mock -ModuleName DE.License Invoke-DELicenseHubGet { $global:LicT.Body }
        (Update-DELicenseRevocations -HubUrl 'https://hub.example').updated | Should -Be $true
        $r = Update-DELicenseRevocations -HubUrl 'http://hub.example'
        $r.ok | Should -Be $false; $r.reason | Should -Match 'https'
        Assert-MockCalled -ModuleName DE.License Invoke-DELicenseHubGet -Times 1 -Exactly -Scope It   # the http URL was never fetched
        $bad = @('not json', '', '[]', '{"jti":"good-2"}', '{"jti":null}', '{"nope":[]}', '{"jti":[1,2]}', '{"jti":["has space"]}', '{"jti":[{"id":"x"}]}', '{"jti":["x"],"updatedAt":"not a time"}', ('{"jti":["' + ('a' * 1048600) + '"]}'), ('{"jti":[' + ((1..20001 | ForEach-Object { '"j' + $_ + '"' }) -join ',') + ']}'))
        foreach ($b in $bad) {
            $global:LicT.Body = $b
            $r = Update-DELicenseRevocations -HubUrl 'https://hub.example'
            $r.ok | Should -Be $false -Because "body: $($b.Substring(0, [math]::Min(40, $b.Length)))"
            $r.reason | Should -Match 'refused'
            (@((Get-DELicenseRevocations).jti) -join ',') | Should -Be 'good-1'
        }
        # an answer older than the saved list does not replace it
        $global:LicT.Body = '{"jti":[],"updatedAt":"2026-09-01T00:00:00.000Z"}'
        $r = Update-DELicenseRevocations -HubUrl 'https://hub.example'
        $r.updated | Should -Be $false; (@((Get-DELicenseRevocations).jti) -join ',') | Should -Be 'good-1'
        # a newer one does, also when it is empty
        $global:LicT.Body = '{"jti":[],"updatedAt":"2026-10-03T00:00:00.000Z"}'
        (Update-DELicenseRevocations -HubUrl 'https://hub.example').updated | Should -Be $true
        @((Get-DELicenseRevocations).jti).Count | Should -Be 0
        Remove-Item -LiteralPath (Get-DELicenseRevocationFile) -Force
    }
    It 'a licence pinned to a build (bid) works only in that build; without bid it works in any build' {
        $pin = 'DE-1.10.0-202610021200-a1b2c3'
        $tok = New-TestLicense -Claims @{ bid = $pin }
        $t = Test-DELicenseToken -Token $tok -DeviceKey 'lenovo:PF3ABC12'   # this checkout is build 'dev'
        $t.valid | Should -Be $false; $t.state | Should -Be 'wrong-build'
        $t.reason | Should -Match ([regex]::Escape($pin)); $t.reason | Should -Match 'this copy is build dev'
        (Test-DELicenseToken -Token $tok -DeviceKey 'lenovo:PF3ABC12' -BuildId 'DE-1.10.0-202610021200-ffffff').state | Should -Be 'wrong-build'
        (Test-DELicenseToken -Token $tok -DeviceKey 'lenovo:PF3ABC12' -BuildId $pin).valid | Should -Be $true
        Mock -ModuleName DE.License Get-DEBuildInfo { [pscustomobject]@{ buildId = 'DE-1.10.0-202610021200-a1b2c3'; builtAt = $null; issuedTo = 'test'; channel = 'release' } }
        (Test-DELicenseToken -Token $tok -DeviceKey 'lenovo:PF3ABC12').valid | Should -Be $true
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12' -BuildId 'DE-anything').valid | Should -Be $true
        (Test-DELicenseToken -Token (New-TestLicense -Claims @{ bid = '' }) -DeviceKey 'lenovo:PF3ABC12' -BuildId 'DE-anything').valid | Should -Be $true
    }
    It 'a wrong-build licence is never stored, and the status and Hub record say wrong-build' {
        Mock -ModuleName DE.License Get-DEThisDeviceKey { 'lenovo:PF3ABC12' }
        (Get-DEThrown { Set-DELicense -Token (New-TestLicense -Claims @{ bid = 'DE-1.10.0-202610021200-a1b2c3' }) }) | Should -Match 'not accepted: this licence is for DE Tech Tool build'
        # a licence stored before the copy changed (an upgrade, or a pinned licence moved to another build) reports wrong-build
        try {
            Set-DEStateValue -Path 'license.token' -Value (New-TestLicense -Claims @{ bid = 'DE-1.10.0-202610021200-a1b2c3' })
            $s = Get-DELicenseStatus; $s.state | Should -Be 'wrong-build'; $s.valid | Should -Be $false; $s.reason | Should -Match 'build'
            (Test-DELicenseFor -Feature apply).licensed | Should -Be $false
            (New-DEHubPayload -Record @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @() }).session.licenseState | Should -Be 'wrong-build'
        } finally { Clear-DELicense }
    }
    It 'turning the clock back does not revive a licence' {
        Set-DEStateValue -Path 'license.lastSeen' -Value (Get-Date).ToUniversalTime().AddDays(2).ToString('o')
        (Test-DELicenseToken -Token (New-TestLicense) -DeviceKey 'lenovo:PF3ABC12').state | Should -Be 'clock'
        Set-DEStateValue -Path 'license.lastSeen' -Value $null
    }
    It 'stores only a licence that verifies, and reports who it is for' {
        Mock -ModuleName DE.License Get-DEThisDeviceKey { 'lenovo:PF3ABC12' }
        (Get-DEThrown { Set-DELicense -Token (New-TestLicense -Tamper) })| Should -Match 'not accepted'
        (Get-DELicenseStatus).state | Should -Be 'missing'
        $s = Set-DELicense -Token (New-TestLicense)
        $s.valid | Should -Be $true; $s.technician | Should -Be 'jrpetro'; @($s.clients) | Should -Contain 'alamo'
        Clear-DELicense
    }
    It "policy 'warn' lets an unlicensed change run and records it; 'required' refuses changes, Toolbox scripts and other clients" {
        Mock -ModuleName DE.License Get-DEThisDeviceKey { 'lenovo:PF3ABC12' }
        Clear-DELicense
        (Test-DELicenseFor -Feature apply -Client alamo).ok | Should -Be $true
        (Test-DELicenseFor -Feature apply -Client alamo).licensed | Should -Be $false
        Set-DELicensePolicyOverride ([pscustomobject]@{ enforce = 'required'; maxTechnicianHours = 12; maxOrderDays = 45; clockSkewMinutes = 5; issuer = 'de-hub'; audience = 'de-techtool' })
        (Test-DELicenseFor -Feature apply -Client alamo).reason | Should -Match 'UNLICENSED'
        Register-DEAction -Id 't.licensed' -Module 'test' -Title 'licensed change' -Phase 99 -Detect { @{ ok = $false } } -Desired { @{ ok = $true } } -Apply { param($s) 'changed' }
        Set-DEContext -Values @{ client = 'alamo' }
        (Invoke-DEAction -Id 't.licensed' -Mode Apply -Confirm:$false).result | Should -Be 'BLOCKED'
        (Invoke-DECommunityScript -Key 'limehawk-rmm-scripts/print-queue-reset' -Confirm:$false).result | Should -Be 'REFUSED'
        (Get-DEThrown { Get-DEClientProfile -Id 'alamo' }) | Should -Match 'UNLICENSED'
        $null = Set-DELicense -Token (New-TestLicense)
        (Invoke-DEAction -Id 't.licensed' -Mode Apply -Confirm:$false).result | Should -Not -Be 'BLOCKED'
        (Get-DEClientProfile -Id 'alamo').id | Should -Be 'alamo'
        (Test-DELicenseFor -Feature apply -Client 'someone-else').ok | Should -Be $false
        (Test-DELicenseFor -Feature rescue).reason | Should -Match "does not include 'rescue'"
        Set-DELicensePolicyOverride $null; Clear-DELicense
    }
    It 'the Hub record carries technician, licence, build and integrity' {
        $p = New-DEHubPayload -Record @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @() }
        $p.session.buildId | Should -Be 'dev'; $p.session.licenseState | Should -Be 'missing'
        @(Test-DEContract -Name device -Object $p) -join ' | ' | Should -Be ''
    }
    It 'activation asks the Hub for a code for this device and stores the approved licence' {
        Mock -ModuleName DE.License Get-DEThisDeviceKey { 'lenovo:PF3ABC12' }
        Mock -ModuleName DE.License Start-Sleep { }
        Mock -ModuleName DE.License Invoke-DELicenseHub { @{ userCode = 'ABCD-1234'; verificationUrl = 'https://hub.example/activate'; deviceCode = 'dc-1'; interval = 1; expiresIn = 60 } } -ParameterFilter { $Uri -like '*device-code' }
        $a = Start-DELicenseActivation -HubUrl 'https://hub.example'
        $a.userCode | Should -Be 'ABCD-1234'
        Assert-MockCalled -ModuleName DE.License Invoke-DELicenseHub -Times 1 -ParameterFilter { $Body.deviceKey -eq 'lenovo:PF3ABC12' }
        $global:LicT.Polls = 0; $global:LicT.Tok = New-TestLicense
        Mock -ModuleName DE.License Invoke-DELicenseHub { $global:LicT.Polls++; if ($global:LicT.Polls -lt 2) { @{ error = 'authorization_pending' } } else { @{ license = $global:LicT.Tok } } } -ParameterFilter { $Uri -like '*token' }
        Mock -ModuleName DE.License Invoke-DELicenseHubGet { throw 'the Hub is offline' }   # a failed refresh never undoes the activation
        (Complete-DELicenseActivation -HubUrl 'https://hub.example' -DeviceCode 'dc-1' -Interval 1 -TimeoutSeconds 30).valid | Should -Be $true
        Assert-MockCalled -ModuleName DE.License Invoke-DELicenseHubGet -Times 1 -Exactly -Scope It -ParameterFilter { $Uri -eq 'https://hub.example/api/techtool/license/revocations' }
        (Get-DELicenseStatus).valid | Should -Be $true
        (Get-DEThrown { Start-DELicenseActivation -HubUrl 'http://hub.example' }) | Should -Match 'https'
        Clear-DELicense
    }
}

Describe 'Watermarked builds and the command-line cheat sheet' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:LicT = @{ Dir = Initialize-TestConsole }
    }
    It 'the cheat sheet fills in this install, lists every Toolbox key, and searches' {
        $g = @(Get-DECheatSheet)
        $root = Split-Path -Parent (Get-DEConsole).Root
        @($g | ForEach-Object { $_.items } | Where-Object { $_.command -match '\{root\}' }).Count | Should -Be 0
        ($g | Where-Object { $_.id -eq 'toolbox-keys' }).items.Count | Should -Be @(Get-DECommunityScripts).Count
        @(Get-DECheatSheet -Search 'dsregcmd /leave').Count | Should -Be 1
        # every DE file a command points at exists in this build
        foreach ($i in @($g | ForEach-Object { $_.items })) {
            foreach ($m in [regex]::Matches($i.command, [regex]::Escape($root) + '\\([^"\s;]+\.(ps1|cmd|psd1|psm1))')) { Test-Path -LiteralPath (Join-Path $root ($m.Groups[1].Value -replace '\\', [IO.Path]::DirectorySeparatorChar)) | Should -Be $true -Because $i.title }
        }
    }
    It 'the build watermark defaults to a development copy' { (Get-DEBuildInfo).buildId | Should -Be 'dev' }
    It 'a release is watermarked, registered, and refuses private keys' {
        $out = Join-Path $global:LicT.Dir 'rel'
        $pk = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'packaging/New-DEReleasePackage.ps1'
        $r = & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out
        Test-Path -LiteralPath $r.zip | Should -Be $true
        $x = Join-Path $out 'x'; Expand-Archive -LiteralPath $r.zip -DestinationPath $x
        $b = Get-Content -LiteralPath (Join-Path $x 'msp-ai-kit/windows/console/BUILD.json') -Raw | ConvertFrom-Json
        $b.issuedTo | Should -Be 'test-tech'; $b.buildId | Should -Be $r.buildId
        Test-Path -LiteralPath (Join-Path $x 'msp-ai-kit/windows/integrity.json') | Should -Be $true
        (Get-Content -LiteralPath (Join-Path $out 'build-register.csv') -Raw) | Should -Match ([regex]::Escape($r.buildId) + ',test-tech,')
        $jwks = Join-Path $global:LicT.Dir 'jwks.json'
        '{"keys":[{"kty":"RSA","kid":"k1","n":"AQAB","e":"AQAB","d":"secret"}]}' | Set-Content -LiteralPath $jwks
        (Get-DEThrown { & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out -PublicKeysFile $jwks }) | Should -Match 'private component'
        (Get-DEThrown { & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out -Enforce }) | Should -Match 'public keys'
    }
    It "a release with -HubUrl ships the Hub's revocation list as trust/revoked.json, covered by integrity.json" {
        $out = Join-Path $global:LicT.Dir 'rel-hub'
        $pk = Join-Path (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)) 'packaging/New-DEReleasePackage.ps1'
        Mock Invoke-RestMethod { [pscustomobject]@{ keys = @([pscustomobject]@{ kty = 'RSA'; kid = 'k1'; n = 'AQAB'; e = 'AQAB' }) } } -ParameterFilter { $Uri -eq 'https://hub.example/api/techtool/license/jwks' }
        $global:LicT.RelBody = '{"jti":["rel-revoked-1"],"updatedAt":"2026-10-02T12:00:00.000Z"}'
        Mock Invoke-WebRequest { [pscustomobject]@{ Content = $global:LicT.RelBody } } -ParameterFilter { $Uri -eq 'https://hub.example/api/techtool/license/revocations' }
        $r = & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out -HubUrl 'https://hub.example'
        $x = Join-Path $out 'x'; Expand-Archive -LiteralPath $r.zip -DestinationPath $x
        $w = Join-Path $x 'msp-ai-kit/windows'
        $rv = Get-Content -LiteralPath (Join-Path $w 'console/trust/revoked.json') -Raw | ConvertFrom-Json
        @($rv.jti) -join ',' | Should -Be 'rel-revoked-1'
        (@((Get-Content -LiteralPath (Join-Path $w 'integrity.json') -Raw | ConvertFrom-Json).files | ForEach-Object { "$($_.path)" -replace '\\', '/' }) -join ' ') | Should -Match 'console/trust/revoked\.json'
        Test-Path -LiteralPath (Join-Path (Get-DEConsole).Root 'trust/revoked.json') | Should -Be $false   # the repository copy is untouched
        $global:LicT.RelBody = '{"jti":"rel-revoked-1"}'
        (Get-DEThrown { & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out -HubUrl 'https://hub.example' }) | Should -Match 'revocation list was refused'
        (Get-DEThrown { & $pk -IssuedTo 'test-tech' -SkipSigning -NoCommunity -OutDir $out -HubUrl 'http://hub.example' }) | Should -Match 'https'
    }
}
