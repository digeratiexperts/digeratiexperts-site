# Move 23: "Test that the contracts refuse secret-shaped keys" (#741).
#
# The contracts' promise is blunt: "No secrets: validators refuse secret-looking keys and any value
# shaped like a BitLocker recovery password." That promise is the last line between a careless
# caller and a secret on the wire, so every shape the refusal recognises gets a case here - and the
# shapes it deliberately does NOT recognise get one too, so the policy cannot silently widen or
# narrow.
#
# The key-shape families (DE.Contracts $script:SecretKey): passw, secret, token, api.?key,
# recovery.?pass, recovery.?key, connect.?key, private.?key, mfa, seed, and the exact-key anchors
# ^tap$ and ^pin$. The value shapes ($script:RecoveryShape): 48 digits in 8 groups of 6, dashes,
# spaces or nothing between them.
#
# Everything runs through Test-DEContract - the refusal the wire path uses - not the helper alone.

Describe 'The contracts refuse secret-shaped keys and recovery-shaped values' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole

        function script:New-DECleanWarranty {
            return [ordered]@{ serial = 'PF3ABC12'; source = 'dell'; status = 'active'; detail = 'a normal record' }
        }
        function script:Get-DESecretRefusal {
            param([Parameter(Mandatory = $true)]$Object)
            return @((Test-DEContract -Name 'warranty' -Object $Object) -join ' | ')
        }
    }

    Context 'every secret-key shape is refused, whatever the casing' {
        It 'refuses a record carrying the key <key>' -TestCases @(
            @{ key = 'password' }
            @{ key = 'Password' }
            @{ key = 'passwd' }
            @{ key = 'db_password' }
            @{ key = 'secret' }
            @{ key = 'clientSecret' }
            @{ key = 'SECRET' }
            @{ key = 'token' }
            @{ key = 'accessToken' }
            @{ key = 'refresh_token' }
            @{ key = 'apiKey' }
            @{ key = 'api_key' }
            @{ key = 'api-key' }
            @{ key = 'APIKEY' }
            @{ key = 'recoveryPassword' }
            @{ key = 'recovery_password' }
            @{ key = 'recoveryPass' }
            @{ key = 'recoveryKey' }
            @{ key = 'recovery_key' }
            @{ key = 'connectKey' }
            @{ key = 'connect_key' }
            @{ key = 'privateKey' }
            @{ key = 'private_key' }
            @{ key = 'mfa' }
            @{ key = 'MFA' }
            @{ key = 'seed' }
            @{ key = 'tap' }
            @{ key = 'pin' }
        ) {
            param($key)
            $o = New-DECleanWarranty
            $o[$key] = 'x'
            $msg = Get-DESecretRefusal -Object $o
            $msg | Should -Match 'secrets never go in a warranty record' -Because "the key '$key' must be refused"
        }
    }

    Context 'the refusals stop exactly where the policy says' {
        It 'a near-name the anchors exclude is not refused: <key>' -TestCases @(
            @{ key = 'pinCode' }   # ^pin$ is exact on purpose
            @{ key = 'staple' }    # ^tap$ is exact on purpose
            @{ key = 'mint' }
            @{ key = 'detail' }
            @{ key = 'hostname' }
        ) {
            param($key)
            $o = New-DECleanWarranty
            $o[$key] = 'x'
            $msg = Get-DESecretRefusal -Object $o
            $msg | Should -Not -Match 'secrets never go in' -Because "'$key' matches no secret family; a refusal here would redact ordinary fields"
        }
        It 'an unanchored family still catches its substring neighbours (the policy as written)' {
            $o = New-DECleanWarranty
            $o['mfaEnabled'] = $true
            (Get-DESecretRefusal -Object $o) | Should -Match 'secrets never go in' -Because 'mfa is unanchored in $SecretKey: mfaEnabled is refused, and this pins that being deliberate'
        }
    }

    Context 'recovery-password-shaped values are refused under any key' {
        It 'refuses the 48 digits in the <form> form' -TestCases @(
            @{ form = 'dashed'; value = '111111-222222-333333-444444-555555-666666-777777-888888' }
            @{ form = 'spaced'; value = '111111 222222 333333 444444 555555 666666 777777 888888' }
            @{ form = 'bare'; value = '111111222222333333444444555555666666777777888888' }
        ) {
            param($form, $value)
            $o = New-DECleanWarranty
            $o['note'] = "saved from the chassis: $value"
            $msg = Get-DESecretRefusal -Object $o
            $msg | Should -Match 'recovery-password-shaped value' -Because "the $form form must be refused even under an innocent key"
        }
        It 'and finds it at the bottom of a deep object' {
            $deep = @{ note = ('111111' * 8) }
            for ($i = 0; $i -lt 22; $i++) { $deep = @{ n = $deep } }
            $o = New-DECleanWarranty
            $o['payload'] = $deep
            (Get-DESecretRefusal -Object $o) | Should -Match 'recovery-password-shaped value' -Because 'depth is not a hiding place'
        }
    }

    Context 'where refusal is impossible, the key is dropped and named' {
        It 'Remove-DEContractSecretKeys drops the secret keys, keeps the rest, and lists what it dropped' {
            $o = [ordered]@{ serial = 'PF3ABC12'; apiKey = 'MARKER-A'; nested = @{ token = 'MARKER-B'; host = 'fs01' } }
            $dropped = New-Object System.Collections.Generic.List[string]
            $clean = Remove-DEContractSecretKeys -Object $o -DroppedKeys $dropped
            ($dropped -join ',') | Should -Match 'apiKey'
            ($dropped -join ',') | Should -Match 'token'
            $json = ($clean | ConvertTo-Json -Depth 10 -Compress)
            $json | Should -Not -Match 'MARKER-' -Because 'the secret values must not survive the drop'
            $json | Should -Match 'serial' -Because 'the safe fields travel'
            (Get-DESecretRefusal -Object $clean) | Should -Not -Match 'secrets never go in' -Because 'what remains must pass the very check the original failed'
        }
    }
}
