# Move 14: "Redaction tests: BitLocker recovery passwords never reach logs, state or receipts". Pester 4.10 and 5.x.
# Move 15: "Test that Guardz keys and SentinelOne tokens are never persisted".
#
# Three surfaces persist what the tool sees: the log (Write-DELog into the log file and the console
# sink), the per-machine state file (Save-DEState) and the storage receipts (Save-DEStorageReceipt).
# Logs and state scrub every value through Protect-DEText / Remove-DESecretKeys before it touches
# disk; the receipt writer persisted its record verbatim, so a recovery password saved as a file
# name (inventories list them) or echoed into servicing output landed on disk exactly as written.
# That write is redacted now, and these tests pin all three surfaces end to end: real console
# operations, real files read back from disk.
#
# Find-DERecoveryPasswordIn (TestHelpers.ps1) matches the bare 48 digits in any of the three forms
# a recovery password can persist in. The last Context proves the detector fails on a real leak -
# without that, a broken comparison passes everything silently, which is how #836 hid behind a
# no-exception assertion.

Describe 'BitLocker recovery passwords never reach logs, state or receipts' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:RedT = @{ Dir = Initialize-TestConsole; Pw = '111111-222222-333333-444444-555555-666666-777777-888888' }
    }

    Context 'move 14: the three persistence surfaces stay clean' {
        It 'the log stream and log file never hold the password, in any of its forms' {
            $pw = $global:RedT.Pw
            $de = Get-DEConsole
            $global:RedT.Sink = New-Object System.Collections.Generic.List[string]
            $de.LogSink = { param($line, $level) $global:RedT.Sink.Add("$line") }
            try {
                Write-DELog -Level INFO -Message "escrow check with recovery password $pw"
                Write-DELog -Level WARN -Message ('key ' + ($pw -replace '-', ' '))
                Write-DELog -Level DEBUG -Message ('key ' + ($pw -replace '\D', ''))
            } finally { $de.LogSink = $null }
            $log = Get-Content -LiteralPath $de.LogFile -Raw
            @(Find-DERecoveryPasswordIn -Text $log).Count | Should -Be 0 -Because ('the log file leaked: ' + ((Find-DERecoveryPasswordIn -Text $log) -join ', '))
            $log | Should -Match '\[REDACTED' -Because 'the line must be rewritten by the redactor, not dropped'
            foreach ($line in $global:RedT.Sink) {
                @(Find-DERecoveryPasswordIn -Text $line).Count | Should -Be 0 -Because "the console stream leaked: $line"
            }
        }

        It 'the state file never holds the password and marks what it withheld' {
            $pw = $global:RedT.Pw
            Set-DEStateValue -Path 'identity.bitlocker.backup' -Value @{ recoveryPassword = $pw; note = "escrowed $pw"; protectorId = 'ABCDEF12-3456-7890-ABCD-EF1234567890' } | Out-Null
            $state = Get-Content -LiteralPath (Get-DEStatePath) -Raw
            @(Find-DERecoveryPasswordIn -Text $state).Count | Should -Be 0 -Because ('the state file leaked: ' + ((Find-DERecoveryPasswordIn -Text $state) -join ', '))
            $state | Should -Match '\[REDACTED\]' -Because 'a withheld secret-named key is marked, not silently dropped'
            $state | Should -Match 'ABCDEF12' -Because 'protector ids are metadata; redaction must not take them'
        }

        It 'a storage receipt never holds the password, not even in scanned file names' {
            $pw = $global:RedT.Pw
            $record = [pscustomobject]@{
                schema    = 'de.storage.inventory/v1'
                kind      = 'inventory'
                result    = 'WARN'
                summary   = "1 file holding the recovery password $pw"
                files     = @([pscustomobject]@{ name = "recovery-key-$pw.txt"; length = 48 })
                output    = @("manage-bde: protector backed up ($pw)")
                fileCount = 1
                bytes     = 48
            }
            $saved = Save-DEStorageReceipt -Record $record
            $json = Get-Content -LiteralPath $saved.receiptPath -Raw
            @(Find-DERecoveryPasswordIn -Text $json).Count | Should -Be 0 -Because ('the receipt leaked: ' + ((Find-DERecoveryPasswordIn -Text $json) -join ', '))
            $json | Should -Match '\[REDACTED' -Because 'the receipt must show that something was withheld'
            $saved.summary | Should -Match ([regex]::Escape($pw)) -Because 'redaction is on the write; the record handed back to the caller is left exactly as given'
        }

        It 'the flow that reads recovery passwords registers them before anything can write them' {
            # Test-DEBitLockerKeyInJumpCloud reads the volume key and the escrowed key, compares them
            # in memory and registers both for redaction. That registration - not anyone remembering
            # to scrub at the call site - is what keeps later writes clean.
            $pw = $global:RedT.Pw
            Mock -ModuleName DE.Identity Get-DEJumpCloudSystem { [pscustomobject]@{ _id = 'jc-sys-1' } }
            Mock -ModuleName DE.Identity Invoke-DEJumpCloudApi { [pscustomobject]@{ key = $global:RedT.Pw } }
            Mock -ModuleName DE.Identity Get-DEBitLockerRecoveryPasswords { @(@{ id = 'ABCDEF12-3456-7890-ABCD-EF1234567890'; password = $global:RedT.Pw }) }
            $r = Test-DEBitLockerKeyInJumpCloud
            $r.ok | Should -Be $true
            $r.detail | Should -Not -Match '111111' -Because 'the answer names the protector, never the key'
            Set-DEStateValue -Path 'scratch.note' -Value "key seen: $pw" | Out-Null
            Write-DELog -Level INFO -Message "compared against $pw"
            $state = Get-Content -LiteralPath (Get-DEStatePath) -Raw
            $log = Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw
            @(Find-DERecoveryPasswordIn -Text $state).Count | Should -Be 0 -Because ('state leaked after the real read path: ' + ((Find-DERecoveryPasswordIn -Text $state) -join ', '))
            @(Find-DERecoveryPasswordIn -Text $log).Count | Should -Be 0 -Because ('the log leaked after the real read path: ' + ((Find-DERecoveryPasswordIn -Text $log) -join ', '))
        }
    }

    Context 'the detector itself catches a leak' {
        It 'catches the password in <form>' -TestCases @(
            @{ text = 'key 111111-222222-333333-444444-555555-666666-777777-888888 escrowed'; form = 'dashed groups' }
            @{ text = 'key 111111 222222 333333 444444 555555 666666 777777 888888 escrowed'; form = 'spaced groups' }
            @{ text = 'key 111111222222333333444444555555666666777777888888 escrowed'; form = 'bare digits' }
            @{ text = '{"file":"recovery-key-111111-222222-333333-444444-555555-666666-777777-888888.txt"}'; form = 'a file name inside JSON' }
        ) {
            param($text, $form)
            @(Find-DERecoveryPasswordIn -Text $text).Count | Should -BeGreaterThan 0 -Because "$form must be detected, or the surface tests above prove nothing"
        }
        It 'does not cry wolf over ordinary machine content' {
            $noise = 'ALAMO-LAP-0231 PF3ABC12 Windows 11 Pro 26100 2026-10-26T19:50:07.1234567-07:00 sha256 3a7f 192.168.10.0/24'
            @(Find-DERecoveryPasswordIn -Text $noise).Count | Should -Be 0
        }
    }
}

# Move 15, and the redactor's own output shape. The evidence record and the data bag are their own
# surface: Add-DEEvidence runs Protect-DEText over the text fields and Remove-DESecretKeys over
# data, so a secret can reach a receipt through either.
Describe 'Guardz keys and SentinelOne tokens are never persisted' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:RedT2 = @{ Dir = Initialize-TestConsole; GuardzKey = 'gd-live-9f8e7d6c5b4a3210fedcba9876543210'; S1Token = 's1-token-0a1b2c3d4e5f60718293a4b5c6d7e8f9' }
    }

    Context 'move 15: the vendor credentials never land on disk' {
        It 'the sinks are populated, or nothing here is proven' {
            $g = $global:RedT2.GuardzKey; $s = $global:RedT2.S1Token
            Register-DERedaction -Value $g
            Register-DERedaction -Value $s
            Clear-DEEvidence
            Write-DELog -Level INFO -Message ("configured guardz with " + $g + " and sentinelone with " + $s)
            Add-DEEvidence -Step 'security.guardz' -Module 'security' -Before ("key " + $g) -ActionTaken 'install' -Result 'PASS' -Verification ("token " + $s) -Data @{ guardzKey = $g; sentineloneToken = $s } | Out-Null
            Set-DEStateValue -Path 'security.guardz.key' -Value $g | Out-Null
            Set-DEStateValue -Path 'security.sentinelone.token' -Value $s | Out-Null
            Save-DEState
            $global:RedT2.Log = Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw
            $global:RedT2.State = Get-Content -LiteralPath (Get-DEStatePath) -Raw
            $global:RedT2.Rec = @(Get-DEEvidence) | Where-Object { $_.step -eq 'security.guardz' } | Select-Object -First 1
            $global:RedT2.Json = ($global:RedT2.Rec | ConvertTo-Json -Depth 8)
            $global:RedT2.Log | Should -Not -BeNullOrEmpty
            $global:RedT2.State | Should -Not -BeNullOrEmpty
            $global:RedT2.Rec | Should -Not -BeNullOrEmpty
        }
        It 'the Guardz key is not in the log, state or the record' {
            $g = [regex]::Escape($global:RedT2.GuardzKey)
            foreach ($sink in @($global:RedT2.Log, $global:RedT2.State, $global:RedT2.Json)) {
                $sink | Should -Not -Match $g
            }
        }
        It 'the SentinelOne token is not in the log, state or the record' {
            $s = [regex]::Escape($global:RedT2.S1Token)
            foreach ($sink in @($global:RedT2.Log, $global:RedT2.State, $global:RedT2.Json)) {
                $sink | Should -Not -Match $s
            }
        }
        It 'a secret-named key keeps its name but loses its value' {
            # the key stays so a reader can see something was withheld; only the value goes
            $global:RedT2.Rec.data.Keys | Should -Contain 'guardzKey'
            $global:RedT2.Rec.data['guardzKey'] | Should -Be '[REDACTED]'
        }
        It 'a token-shaped value is scrubbed even when never registered' {
            $unregistered = 'tok-aabbccddeeff00112233445566778899'
            Write-DELog -Level INFO -Message ("access token: " + $unregistered)
            Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw | Should -Not -Match ([regex]::Escape($unregistered))
        }
    }

    Context 'the redactor keeps its output readable' {
        It 'keeps the key name and separator, so the log still says what was withheld' {
            # Protect-DEText's secret-shape regex once had a nested capturing group
            # (org(anization)?), so the replacement referred to the wrong group and ate the
            # separator: 'password=x' became 'password[REDACTED]' rather than 'password=[REDACTED]'.
            # The secret still went, but the log lost the context saying what kind it was.
            Protect-DEText 'password=hunter2hunter2' | Should -Be 'password=[REDACTED]'
            Protect-DEText 'api_key: abc123def456ghi78' | Should -Be 'api_key: [REDACTED]'
            Protect-DEText 'organization-key = orgsecretvalue012345' | Should -Be 'organization-key = [REDACTED]'
        }
        It 'leaves ordinary words alone' {
            Protect-DEText 'the token count is 5' | Should -Be 'the token count is 5'
        }
    }
}
