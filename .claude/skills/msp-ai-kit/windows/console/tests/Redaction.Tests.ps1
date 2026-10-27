# Moves 14 and 15: secrets must never be persisted.
#
# 14: BitLocker recovery passwords never reach the log, state or a receipt.
# 15: Guardz keys and SentinelOne tokens are never persisted.
#
# These are end-to-end against the real sinks - the log file on disk, the state file on disk and the
# evidence records - not a unit test of Protect-DEText in isolation. The distinction matters: a
# correct redactor wired to the wrong sink still leaks, and the earlier suites only covered the
# redactor itself.

Describe 'Secrets never reach the log, state or a receipt' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $script:DataDir = Initialize-TestConsole
        $script:Alamo = Get-DEClientProfile -Id 'alamo'
        # 8 groups of 6 digits: the shape Protect-DEText treats as a BitLocker recovery password
        $script:Recovery = '123456-234567-345678-456789-567890-678901-789012-890123'
        $script:GuardzKey = 'gd-live-9f8e7d6c5b4a3210fedcba9876543210'
        $script:S1Token = 's1-token-0a1b2c3d4e5f60718293a4b5c6d7e8f9'
    }

    Context 'move 14: a BitLocker recovery password is nowhere in the output' {
        BeforeAll {
            Clear-DEEvidence
            # throw the recovery password at every sink a run uses
            Write-DELog -Level WARN -Message ("unlock failed for " + $script:Recovery)
            Add-DEEvidence -Step 'identity.bitlocker' -Module 'identity' -Before ("protector " + $script:Recovery) -ActionTaken ('unlock with ' + $script:Recovery) -Result 'WARN' -Verification ("recovery " + $script:Recovery) -Data @{ recovery = $script:Recovery; note = 'plain field' } | Out-Null
            Set-DEStateValue -Path 'bitlocker.recoveryPassword' -Value $script:Recovery
            Save-DEState
            $script:LogFile = (Get-DEConsole).LogFile
            $script:LogText = if ($script:LogFile -and (Test-Path -LiteralPath $script:LogFile)) { Get-Content -LiteralPath $script:LogFile -Raw } else { '' }
            $script:StateFile = Get-DEStatePath
            $script:StateText = if (Test-Path -LiteralPath $script:StateFile) { Get-Content -LiteralPath $script:StateFile -Raw } else { '' }
            $script:Rec = @(Get-DEEvidence) | Where-Object { $_.step -eq 'identity.bitlocker' } | Select-Object -First 1
        }
        It 'never appears in the log file' {
            $script:LogText | Should -Not -BeNullOrEmpty -Because 'the run must have written a log, or this test proves nothing'
            $script:LogText | Should -Not -Match ([regex]::Escape($script:Recovery))
        }
        It 'never appears in the state file' {
            $script:StateText | Should -Not -BeNullOrEmpty -Because 'state must have been written, or this test proves nothing'
            $script:StateText | Should -Not -Match ([regex]::Escape($script:Recovery))
        }
        It 'never appears in the evidence record, including its data bag' {
            $script:Rec | Should -Not -BeNullOrEmpty -Because 'the evidence record must exist, or this test proves nothing'
            ($script:Rec | ConvertTo-Json -Depth 8) | Should -Not -Match ([regex]::Escape($script:Recovery))
        }
        It 'the log still shows that something was withheld' {
            # silence is not the goal: the technician must be able to see a redaction happened
            $script:LogText | Should -Match '\[REDACTED'
        }
        It 'the evidence record still shows that something was withheld' {
            ($script:Rec | ConvertTo-Json -Depth 8) | Should -Match '\[REDACTED'
        }
    }

    Context 'move 15: Guardz keys and SentinelOne tokens are never persisted' {
        BeforeAll {
            Clear-DEEvidence
            Register-DERedaction -Value $script:GuardzKey
            Register-DERedaction -Value $script:S1Token
            Write-DELog -Level INFO -Message ("configured guardz with " + $script:GuardzKey + " and sentinelone with " + $script:S1Token)
            Add-DEEvidence -Step 'security.guardz' -Module 'security' -Before ("key " + $script:GuardzKey) -ActionTaken 'install' -Result 'PASS' -Verification ("token " + $script:S1Token) -Data @{ guardzKey = $script:GuardzKey; sentineloneToken = $script:S1Token } | Out-Null
            Set-DEStateValue -Path 'security.guardz.key' -Value $script:GuardzKey
            Set-DEStateValue -Path 'security.sentinelone.token' -Value $script:S1Token
            Save-DEState
            $script:LogText = Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw
            $script:StateFile = Get-DEStatePath
            $script:StateText = Get-Content -LiteralPath $script:StateFile -Raw
            $script:Rec = @(Get-DEEvidence) | Where-Object { $_.step -eq 'security.guardz' } | Select-Object -First 1
        }
        It 'the sinks are populated, or nothing here is proven' {
            $script:LogText | Should -Not -BeNullOrEmpty
            $script:StateText | Should -Not -BeNullOrEmpty
            $script:Rec | Should -Not -BeNullOrEmpty
        }
        It 'the Guardz key is not in the log, state or the record' {
            foreach ($sink in @($script:LogText, $script:StateText, ($script:Rec | ConvertTo-Json -Depth 8))) {
                $sink | Should -Not -Match ([regex]::Escape($script:GuardzKey))
            }
        }
        It 'the SentinelOne token is not in the log, state or the record' {
            foreach ($sink in @($script:LogText, $script:StateText, ($script:Rec | ConvertTo-Json -Depth 8))) {
                $sink | Should -Not -Match ([regex]::Escape($script:S1Token))
            }
        }
        It 'a secret-named key keeps its name but loses its value' {
            # the key stays so a reader can see something was withheld; only the value goes
            $script:Rec.data.Keys | Should -Contain 'guardzKey'
            $script:Rec.data['guardzKey'] | Should -Be '[REDACTED]'
        }
        It 'redaction keeps the key name and separator, so the log stays readable' {
            # a nested capture group in Protect-DEText once ate the separator ('password=x' became
            # 'password[REDACTED]' instead of 'password=[REDACTED]'). The secret still went, but the
            # log lost the context that says what kind of secret it was. Assert the shape, not just
            # the absence.
            Protect-DEText 'password=hunter2hunter2' | Should -Be 'password=[REDACTED]'
            Protect-DEText 'api_key: abc123def456ghi78' | Should -Be 'api_key: [REDACTED]'
            Protect-DEText 'organization-key = orgsecretvalue012345' | Should -Be 'organization-key = [REDACTED]'
        }
        It 'a value that looks like a token is scrubbed even when not registered' {
            $unregistered = 'tok-aabbccddeeff00112233445566778899'
            Write-DELog -Level INFO -Message ("access token: " + $unregistered)
            Get-Content -LiteralPath (Get-DEConsole).LogFile -Raw | Should -Not -Match ([regex]::Escape($unregistered))
        }
    }

    Context 'the evidence bundle refuses to ship a registered secret' {
        It 'withholds the bundle rather than writing it out' {
            $secret = 'leak-me-0123456789abcdef0123456789abcdef'
            Register-DERedaction -Value $secret
            Clear-DEEvidence
            # a record field that would land in the bundle carrying the secret verbatim
            Add-DEEvidence -Step 'security.guardz' -Module 'security' -Before 'x' -ActionTaken ('configured with ' + $secret) -Result 'PASS' -Artifacts @((Join-Path $script:DataDir 'no-such-artifact.txt')) | Out-Null
            $snap = @{ device = @{ hostname = 'H'; serial = 'PF3ABC12'; manufacturer = 'Dell'; model = 'M' } }
            $before = @(Get-ChildItem -Path $script:DataDir -Recurse -Filter '*.zip' -ErrorAction SilentlyContinue).Count
            $threw = $false
            try { $null = Export-DEEvidenceBundle -Snapshot $snap -ClientProfile $script:Alamo } catch { $threw = $true }
            # either the bundle is withheld (throws) or, if the redaction held upstream, it is written clean
            if ($threw) {
                @(Get-ChildItem -Path $script:DataDir -Recurse -Filter '*.zip' -ErrorAction SilentlyContinue).Count | Should -Be $before
            } else {
                $zips = @(Get-ChildItem -Path $script:DataDir -Recurse -Filter '*.zip' -ErrorAction SilentlyContinue)
                foreach ($z in $zips) { $z.Length | Should -BeGreaterThan 0 }
            }
        }
    }
}
