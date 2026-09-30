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
        (Complete-DELicenseActivation -HubUrl 'https://hub.example' -DeviceCode 'dc-1' -Interval 1 -TimeoutSeconds 30).valid | Should -Be $true
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
}
