# Move 75: "Test that a stolen device key can be revoked and stops working" (#793).
#
# The Hub revokes in its own table (the device-certificate design); DE.AgentIdentity is the device's half, and the half
# that makes revocation END something (AGENT-THREAT-MODEL.md S3, E5). A fake Hub applies the Hub's rule - a serial that is
# not active is refused 403 device_revoked - so the suite can run the whole story:
#   the device works; staff revoke; the next call is refused; the agent records it and from then on never calls the Hub;
#   a thief using the same key from elsewhere is refused by the Hub too; local functions are untouched; and the only way
#   back is a fresh enrolment (not time, not an answer, not a retry).
# It also pins the decision table (an unplanned answer is backoff, never continue) and fail-closed state handling
# (an unreadable identity state is treated as revoked).
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentIdentity: a revoked agent stops, stays stopped, and only a new enrolment brings it back' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentIdentity.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-identity-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:Now = [datetime]::SpecifyKind([datetime]'2026-11-01T12:00:00', 'Utc')
        function script:New-IdDir { return (Join-Path $script:Work ([guid]::NewGuid().ToString('N'))) }
        # the Hub's rule from the device-certificate design: only an ACTIVE serial gets through; a revoked one is 403 device_revoked
        function script:New-FakeHub {
            $h = [pscustomobject]@{ Active = @{ 'serialA' = $true }; Calls = 0 }
            $h | Add-Member -NotePropertyName Handle -NotePropertyValue ({ param($serial) $h.Calls++; if ($h.Active.ContainsKey($serial) -and $h.Active[$serial]) { [pscustomobject]@{ HttpStatus = 200; ErrorCode = ''; RetryAfterSeconds = 0 } } else { [pscustomobject]@{ HttpStatus = 403; ErrorCode = 'device_revoked'; RetryAfterSeconds = 0 } } }.GetNewClosure())
            return $h
        }
        function script:New-Transport { param($Hub, [string]$Serial = 'serialA') return ({ & $Hub.Handle $Serial }.GetNewClosure()) }
        function script:New-Answer { param([int]$Status, [string]$Code = '', [int]$After = 0) return ({ [pscustomobject]@{ HttpStatus = $Status; ErrorCode = $Code; RetryAfterSeconds = $After } }.GetNewClosure()) }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'a stolen key, revoked' {
        It 'the device works, staff revoke it, the next call is refused, and the agent never calls the Hub again' {
            $dir = New-IdDir; $hub = New-FakeHub; $t = New-Transport -Hub $hub
            $r1 = Invoke-DEHubCall -IdentityDir $dir -Transport $t -Now $script:Now
            $r1.Called | Should -Be $true
            $r1.Decision.Action | Should -Be 'continue'
            $hub.Active['serialA'] = $false
            $r2 = Invoke-DEHubCall -IdentityDir $dir -Transport $t -Now $script:Now
            $r2.Called | Should -Be $true
            $r2.Decision.Action | Should -Be 'revoked'
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'revoked'
            $calls = $hub.Calls
            foreach ($i in 1..5) {
                $again = Invoke-DEHubCall -IdentityDir $dir -Transport $t -Now $script:Now
                $again.Called | Should -Be $false
                $again.Decision.Action | Should -Be 'revoked'
            }
            $hub.Calls | Should -Be $calls -Because 'a revoked agent that kept asking would be probing for a way back in'
        }
        It 'a thief who holds the same key and calls from elsewhere is refused by the Hub as well' {
            $hub = New-FakeHub
            $hub.Active['serialA'] = $false
            $stolen = & $hub.Handle 'serialA'
            $stolen.HttpStatus | Should -Be 403
            $stolen.ErrorCode | Should -Be 'device_revoked'
            (Resolve-DEHubAnswer -HttpStatus $stolen.HttpStatus -ErrorCode $stolen.ErrorCode).Action | Should -Be 'revoked'
        }
        It 'revocation survives a restart: it is on disk' {
            $dir = New-IdDir; $hub = New-FakeHub; $hub.Active['serialA'] = $false
            $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now
            Import-Module (Join-Path $script:Win 'agent\DE.AgentIdentity.psm1') -Force
            $calls = $hub.Calls
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now).Called | Should -Be $false
            $hub.Calls | Should -Be $calls
            (Get-DEAgentIdentityState -IdentityDir $dir).Reason | Should -Be 'device_revoked'
        }
        It 'an identity state it cannot read is treated as revoked: unknown must not mean allowed' {
            $dir = New-IdDir; New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $dir 'state.json') -Value 'garbage {'
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'revoked'
            $hub = New-FakeHub
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now).Called | Should -Be $false
            $hub.Calls | Should -Be 0
            Set-Content -LiteralPath (Join-Path $dir 'state.json') -Value '{"state":"allowed-by-me"}'
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'revoked' -Because 'only the known states are believed'
        }
        It 'leaves no temp file behind when it records the revocation' {
            $dir = New-IdDir; $hub = New-FakeHub; $hub.Active['serialA'] = $false
            $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now
            Test-Path -LiteralPath (Join-Path $dir 'state.json.tmp') | Should -Be $false
        }
    }

    Context 'local functions are not the Hub''s to switch off' {
        It 'stay allowed whatever the identity state' {
            $dir = New-IdDir; $hub = New-FakeHub; $hub.Active['serialA'] = $false
            $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now
            (Test-DELocalFunctionsAllowed -IdentityDir $dir) | Should -Be $true
        }
    }

    Context 'the only way back is a new enrolment' {
        It 'clears revocation for a fresh enrolment id, and the agent talks to the Hub again' {
            $dir = New-IdDir; $hub = New-FakeHub; $hub.Active['serialA'] = $false
            $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now
            $old = '3c9b1f28-5d4e-4a7b-8f60-2e1d9a7c5b34'; $new = '4d0c2a39-6e5f-4b8c-9a71-3f2e0b8d6c45'
            Clear-DEAgentRevocation -IdentityDir $dir -NewEnrolmentId $new -PreviousEnrolmentId $old -Now $script:Now
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'ok'
            $hub.Active['serialB'] = $true
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub -Serial 'serialB') -Now $script:Now).Decision.Action | Should -Be 'continue'
        }
        It 'refuses to clear it for the enrolment that was revoked, or for something that is not an enrolment id' {
            $dir = New-IdDir; $same = '3c9b1f28-5d4e-4a7b-8f60-2e1d9a7c5b34'
            { Clear-DEAgentRevocation -IdentityDir $dir -NewEnrolmentId $same -PreviousEnrolmentId $same -Now $script:Now } | Should -Throw
            { Clear-DEAgentRevocation -IdentityDir $dir -NewEnrolmentId 'not-a-uuid' -PreviousEnrolmentId $same -Now $script:Now } | Should -Throw
        }
        It 'a Hub answer of success does not undo a revocation' {
            $dir = New-IdDir; $hub = New-FakeHub; $hub.Active['serialA'] = $false
            $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now
            $hub.Active['serialA'] = $true
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now).Called | Should -Be $false
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'revoked'
        }
    }

    Context 'an expired certificate ends the same way, by a different road' {
        It 'records expired, stops calling, and needs a new enrolment' {
            $dir = New-IdDir
            $r = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Answer -Status 403 -Code 'certificate_expired') -Now $script:Now
            $r.Decision.Action | Should -Be 'expired'
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'expired'
            $hub = New-FakeHub
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Transport -Hub $hub) -Now $script:Now).Called | Should -Be $false
            $hub.Calls | Should -Be 0
        }
    }

    Context 'every answer maps to one decision, and an unplanned one is never continue' {
        It '<status> <code> is <action>' -TestCases @(
            @{ status = 200; code = ''; action = 'continue' }
            @{ status = 204; code = ''; action = 'continue' }
            @{ status = 403; code = 'device_revoked'; action = 'revoked' }
            @{ status = 403; code = 'certificate_expired'; action = 'expired' }
            @{ status = 403; code = 'certificate_unknown'; action = 'expired' }
            @{ status = 403; code = 'device_not_active'; action = 'inactive' }
            @{ status = 423; code = 'paused'; action = 'paused' }
            @{ status = 429; code = 'rate_limited'; action = 'backoff' }
            @{ status = 401; code = 'stale_request'; action = 'backoff' }
            @{ status = 401; code = 'no_client_certificate'; action = 'backoff' }
            @{ status = 503; code = 'identity_store_unavailable'; action = 'backoff' }
        ) {
            param($status, $code, $action)
            (Resolve-DEHubAnswer -HttpStatus $status -ErrorCode $code).Action | Should -Be $action
        }
        It 'an answer nobody planned for is backoff, never continue' {
            foreach ($s in @(@(301, ''), @(400, 'bad_request'), @(403, 'something_new'), @(404, 'not_found'), @(409, 'lease_expired'), @(418, ''), @(500, ''), @(502, ''), @(0, 'network'))) {
                $d = Resolve-DEHubAnswer -HttpStatus $s[0] -ErrorCode $s[1]
                $d.Action | Should -Be 'backoff' -Because "$($s[0]) $($s[1]) was not planned for"
                $d.BackoffSeconds | Should -BeGreaterThan 0
            }
        }
        It 'honours the Hub''s Retry-After for rate limits and pauses, and gives sane defaults without it' {
            (Resolve-DEHubAnswer -HttpStatus 429 -ErrorCode 'rate_limited' -RetryAfterSeconds 17).BackoffSeconds | Should -Be 17
            (Resolve-DEHubAnswer -HttpStatus 423 -ErrorCode 'paused' -RetryAfterSeconds 900).BackoffSeconds | Should -Be 900
            (Resolve-DEHubAnswer -HttpStatus 423 -ErrorCode 'paused').BackoffSeconds | Should -Be 300
            (Resolve-DEHubAnswer -HttpStatus 429 -ErrorCode 'rate_limited').BackoffSeconds | Should -Be 60
        }
        It 'a paused, pending, rate-limited or failed call does not record anything: the agent will ask again' {
            foreach ($a in @(@(423, 'paused'), @(403, 'device_not_active'), @(429, 'rate_limited'), @(503, 'identity_store_unavailable'))) {
                $dir = New-IdDir
                $null = Invoke-DEHubCall -IdentityDir $dir -Transport (New-Answer -Status $a[0] -Code $a[1]) -Now $script:Now
                (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'ok' -Because "$($a[0]) $($a[1]) is not an ending"
            }
        }
        It 'a network failure is backoff, is not recorded as anything, and a later success carries on' {
            $dir = New-IdDir
            $r = Invoke-DEHubCall -IdentityDir $dir -Transport { throw 'no route to host' } -Now $script:Now
            $r.Called | Should -Be $true
            $r.Decision.Action | Should -Be 'backoff'
            (Get-DEAgentIdentityState -IdentityDir $dir).State | Should -Be 'ok'
            (Invoke-DEHubCall -IdentityDir $dir -Transport (New-Answer -Status 200) -Now $script:Now).Decision.Action | Should -Be 'continue'
        }
    }
}
