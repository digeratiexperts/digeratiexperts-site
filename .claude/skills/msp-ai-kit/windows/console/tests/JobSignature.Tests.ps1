# Move 65: "Verify job signatures on the device, including expiry" (#783).
#
# DE.AgentTrust is what the DE Tech Agent checks before it believes a job (AGENT-THREAT-MODEL.md S2, S4, T1):
#   - the Ed25519 verifier is held to RFC 8032 test vectors (derive the public key, produce the signature,
#     verify it - all three must agree with the published bytes) AND to a vector the Hub's TypeScript signed,
#     so the two sides provably agree on bytes, encoding and key format;
#   - it refuses what must be refused: altered bytes, a flipped bit in R or in S, the wrong key, the
#     malleable S+L form, an invalid point, a wrong length - and never throws on any of them;
#   - the key comes only from the pin set, by key id: an unpinned id is refused even when the signature is
#     valid, a key swapped under a pinned id fails, and no parameter takes a key from anywhere else;
#   - the window is judged against a clock that cannot be set back (the time floor), fails closed when the
#     floor cannot be read, and the floor only ever moves forward.
#
# The hub-signed vector is copied from Intelligence-Hub agent/internal/jobs/testdata/hub-signed-job.json
# (a fixed, test-only key; public material only).
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentTrust: a job is believed only when its signature and window check out' {
    BeforeAll {
        Add-Type -AssemblyName System.Numerics
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentTrust.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-trust-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null

        function script:ConvertFrom-Hex { param([string]$Hex) if (-not $Hex) { return , (New-Object byte[] 0) }; $b = New-Object byte[] ($Hex.Length / 2); for ($i = 0; $i -lt $b.Length; $i++) { $b[$i] = [Convert]::ToByte($Hex.Substring($i * 2, 2), 16) }; return , $b }
        function script:ConvertTo-Hex { param([byte[]]$Bytes) return (($Bytes | ForEach-Object { $_.ToString('x2') }) -join '') }
        function script:ConvertTo-B64Url { param([byte[]]$Bytes) return ([Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')) }

        # a deterministic test key, and a second one for substitution
        $script:SeedA = [byte[]](1..32)
        $script:SeedB = [byte[]](101..132)
        $script:PubA = [DE.AgentTrust.Ed25519]::PublicKey($script:SeedA)
        $script:PubB = [DE.AgentTrust.Ed25519]::PublicKey($script:SeedB)
        $script:Pins = @{ 'job-2026-1' = (ConvertTo-B64Url $script:PubA) }

        function script:New-DESignedInput {
            param([string]$Text, [byte[]]$Seed = $script:SeedA)
            return (ConvertTo-B64Url ([DE.AgentTrust.Ed25519]::Sign($Seed, [Text.Encoding]::UTF8.GetBytes($Text))))
        }
        $script:Now = [datetime]::SpecifyKind([datetime]'2026-11-01T12:05:00', 'Utc')
        $script:Issued = '2026-11-01T12:00:00Z'
        $script:Expires = '2026-11-01T12:10:00Z'
        $script:SignedText = '{"jobId":"0b8f6d1e","note":"signed bytes"}'
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'the Ed25519 verifier is RFC 8032' {
        It 'derives the public key, signs and verifies RFC 8032 test <n>' -TestCases @(
            @{ n = 1; seed = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60'; pub = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'; msg = ''; sig = 'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b' }
            @{ n = 2; seed = '4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb'; pub = '3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c'; msg = '72'; sig = '92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00' }
        ) {
            param($n, $seed, $pub, $msg, $sig)
            $seedB = ConvertFrom-Hex $seed; $msgB = ConvertFrom-Hex $msg
            (ConvertTo-Hex ([DE.AgentTrust.Ed25519]::PublicKey($seedB))) | Should -Be $pub -Because 'the public key must derive from the seed exactly as published'
            (ConvertTo-Hex ([DE.AgentTrust.Ed25519]::Sign($seedB, $msgB))) | Should -Be $sig -Because 'the signature is deterministic and must match the published bytes'
            (Test-DEEd25519Signature -PublicKey (ConvertFrom-Hex $pub) -Message $msgB -Signature (ConvertFrom-Hex $sig)) | Should -Be $true
        }
        It 'verifies the signature the Hub''s TypeScript produced over a real job payload' {
            $v = @'
{
  "kid": "fe812c12f3ab4ce6",
  "publicKey": "6kpsY-KcUgq-9VB7Ey7F-ZVHdq6-vnuSQh7qaRRG0iw",
  "payloadSha256": "7c631da16e369ac5d53abdd238b5129e0ba2122162a01a0cd05df00056c27a06",
  "payload": "eyJzY2hlbWEiOiJkZS5lbmRwb2ludC5qb2IvdjEiLCJraWQiOiJmZTgxMmMxMmYzYWI0Y2U2Iiwiam9iSWQiOiJqb2JfMDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWYiLCJkZXZpY2VJZCI6ImRldl9mZWRjYmE5ODc2NTQzMjEwZmVkY2JhOTg3NjU0MzIxMCIsImFjY291bnRJZCI6NDIsImlzc3VlZEF0IjoiMjAyNi0xMC0wOFQxMjowMDowMC4wMDBaIiwiZXhwaXJlc0F0IjoiMjAyNi0xMC0wOFQxMjoxNTowMC4wMDBaIiwic2NyaXB0TmFtZSI6IlNheSBoZWxsbyIsInNoZWxsIjoicG93ZXJzaGVsbCIsInNjcmlwdCI6IldyaXRlLU91dHB1dCBcImhlbGxvICRlbnY6REVfUEFSQU1fTmFtZVwiIiwic2NyaXB0U2hhMjU2IjoiN2QzMWM0YTI4YTlkYzBhYzk4MTFkNWI1NDIzMzNiMThmODlkZjdmMmI1ZjBiY2U1NDM0NTYzNmJmMWUwZWIwYyIsInBhcmFtZXRlcnMiOnsiTmFtZSI6Ik1hcmlhIiwiQ291bnQiOjMsIkZvcmNlIjp0cnVlfSwicmlzayI6InJlYWRfb25seSIsInJ1bkFzIjoic3lzdGVtIiwidGltZW91dFNlY29uZHMiOjEyMCwidXNlck5vdGljZSI6IkNoZWNraW5nIHlvdXIgUEMiLCJyZXF1aXJlQ29uc2VudCI6ZmFsc2UsInJlcXVlc3RlZEJ5IjoidGVjaEBkaWdlcmF0aWV4cGVydHMuY29tIiwiYXBwcm92ZWRCeSI6bnVsbH0",
  "signature": "2cLK-QMZmckHAacaGUxWi2XtNEwesYZiQlOyFvZSqiZf-d_xpg1c1WbNjuQVFNC5wIsn8rmw6NNNuI20ED1WBQ"
}
'@ | ConvertFrom-Json
            $payload = ConvertFrom-DEAgentBase64Url $v.payload
            $sha = [Security.Cryptography.SHA256]::Create()
            (ConvertTo-Hex $sha.ComputeHash($payload)) | Should -Be $v.payloadSha256 -Because 'the base64url payload decodes to the very bytes the Hub hashed'
            $pub = ConvertFrom-DEAgentBase64Url $v.publicKey
            (Test-DEEd25519Signature -PublicKey $pub -Message $payload -Signature (ConvertFrom-DEAgentBase64Url $v.signature)) | Should -Be $true
            $altered = $payload.Clone(); $altered[10] = $altered[10] -bxor 1
            (Test-DEEd25519Signature -PublicKey $pub -Message $altered -Signature (ConvertFrom-DEAgentBase64Url $v.signature)) | Should -Be $false
            $text = [Text.Encoding]::UTF8.GetString($payload)
            $r = Test-DEJobSignature -SigningInput $text -Signature $v.signature -KeyId $v.kid -PinnedKeys @{ $v.kid = $v.publicKey }
            $r.Ok | Should -Be $true -Because $r.Why
        }
    }

    Context 'what the verifier must refuse, without throwing' {
        BeforeAll {
            $script:Msg = [Text.Encoding]::UTF8.GetBytes('a job the Hub signed')
            $script:Sig = [DE.AgentTrust.Ed25519]::Sign($script:SeedA, $script:Msg)
        }
        It 'accepts the genuine signature (so the refusals below mean something)' {
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature $script:Sig) | Should -Be $true
        }
        It 'refuses altered message bytes' {
            $m = $script:Msg.Clone(); $m[0] = $m[0] -bxor 1
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $m -Signature $script:Sig) | Should -Be $false
        }
        It 'refuses a flipped bit in R, and one in S' {
            $r = $script:Sig.Clone(); $r[3] = $r[3] -bxor 1
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature $r) | Should -Be $false
            $s = $script:Sig.Clone(); $s[40] = $s[40] -bxor 1
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature $s) | Should -Be $false
        }
        It 'refuses the wrong public key' {
            (Test-DEEd25519Signature -PublicKey $script:PubB -Message $script:Msg -Signature $script:Sig) | Should -Be $false
        }
        It 'refuses the malleable form with S replaced by S + L' {
            $L = [System.Numerics.BigInteger]::Pow(2, 252) + [System.Numerics.BigInteger]::Parse('27742317777372353535851937790883648493')
            $sBytes = New-Object byte[] 33; [Array]::Copy($script:Sig, 32, $sBytes, 0, 32)
            $s2 = ([System.Numerics.BigInteger]$sBytes) + $L
            $raw = $s2.ToByteArray(); $mall = $script:Sig.Clone(); [Array]::Clear($mall, 32, 32); [Array]::Copy($raw, 0, $mall, 32, [Math]::Min(32, $raw.Length))
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature $mall) | Should -Be $false -Because 'a signature whose S is not reduced mod L must not verify'
        }
        It 'refuses an R that is not a point on the curve, and a public key that is not' {
            $bad = $script:Sig.Clone(); [Array]::Copy(([byte[]](,0xff * 32)), 0, $bad, 0, 32)
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature $bad) | Should -Be $false
            (Test-DEEd25519Signature -PublicKey ([byte[]](,0xff * 32)) -Message $script:Msg -Signature $script:Sig) | Should -Be $false
        }
        It 'refuses wrong lengths and empty input, without throwing' {
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature ([byte[]](1..63))) | Should -Be $false
            (Test-DEEd25519Signature -PublicKey ([byte[]](1..31)) -Message $script:Msg -Signature $script:Sig) | Should -Be $false
            (Test-DEEd25519Signature -PublicKey $script:PubA -Message $script:Msg -Signature ([byte[]]@())) | Should -Be $false
            { Test-DEEd25519Signature -PublicKey $null -Message $null -Signature $null } | Should -Not -Throw
        }
    }

    Context 'the key comes only from the pin set' {
        It 'verifies a job signed by the pinned key' {
            $sig = New-DESignedInput -Text $script:SignedText
            $r = Test-DEJobSignature -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins
            $r.Ok | Should -Be $true -Because $r.Why
        }
        It 'refuses a valid signature under a key id nobody pinned (unknown_key)' {
            $sig = New-DESignedInput -Text $script:SignedText
            $r = Test-DEJobSignature -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2099-9' -PinnedKeys $script:Pins
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'unknown_key'
        }
        It 'refuses a job signed by another key that claims the pinned key id (bad_signature)' {
            $sig = New-DESignedInput -Text $script:SignedText -Seed $script:SeedB
            $r = Test-DEJobSignature -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins
            $r.Code | Should -Be 'bad_signature'
        }
        It 'refuses a signature over different bytes, and signatures of the wrong shape' {
            $sig = New-DESignedInput -Text $script:SignedText
            (Test-DEJobSignature -SigningInput ($script:SignedText + ' ') -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins).Code | Should -Be 'bad_signature'
            (Test-DEJobSignature -SigningInput $script:SignedText -Signature 'short' -KeyId 'job-2026-1' -PinnedKeys $script:Pins).Code | Should -Be 'bad_signature'
            (Test-DEJobSignature -SigningInput $script:SignedText -Signature '' -KeyId 'job-2026-1' -PinnedKeys $script:Pins).Code | Should -Be 'bad_signature'
            (Test-DEJobSignature -SigningInput $script:SignedText -Signature ('!' * 86) -KeyId 'job-2026-1' -PinnedKeys $script:Pins).Code | Should -Be 'bad_signature'
        }
        It 'treats a pin that is not a usable key as no pin' {
            $r = Test-DEJobSignature -SigningInput 'x' -Signature ('A' * 86) -KeyId 'k' -PinnedKeys @{ k = 'not-a-key' }
            $r.Code | Should -Be 'unknown_key'
        }
        It 'has no parameter that takes a key from the job, the server or the network' {
            foreach ($cmd in @('Test-DEJobSignature', 'Confirm-DEJobAuthentic')) {
                $names = @((Get-Command $cmd).Parameters.Keys)
                foreach ($forbidden in @('PublicKey', 'Key', 'Url', 'Uri', 'KeyUrl', 'TrustKey')) { $names | Should -Not -Contain $forbidden -Because "$cmd must not accept a key from outside the pin set" }
                $names | Should -Contain 'PinnedKeys'
            }
        }
        It 'reads the pin file, and refuses a missing, empty or malformed one' {
            $good = Join-Path $script:Work 'pins-good.json'
            Set-Content -LiteralPath $good -Value ('{ "job-2026-1": "' + (ConvertTo-B64Url $script:PubA) + '" }')
            (Read-DEPinnedJobKeys -Path $good)['job-2026-1'] | Should -Be (ConvertTo-B64Url $script:PubA)
            { Read-DEPinnedJobKeys -Path (Join-Path $script:Work 'nope.json') } | Should -Throw
            $empty = Join-Path $script:Work 'pins-empty.json'; Set-Content -LiteralPath $empty -Value '{}'
            { Read-DEPinnedJobKeys -Path $empty } | Should -Throw -Because 'an agent with no pinned key believes no job'
            $bad = Join-Path $script:Work 'pins-bad.json'; Set-Content -LiteralPath $bad -Value '{ "k": "tooshort" }'
            { Read-DEPinnedJobKeys -Path $bad } | Should -Throw
        }
    }

    Context 'the window is judged against a clock that cannot be set back' {
        It 'accepts a job inside its window' {
            (Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $script:Now).Ok | Should -Be $true
        }
        It 'refuses an expired job, including at the very end of the window' {
            (Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now ([datetime]::SpecifyKind([datetime]'2026-11-01T12:30:00', 'Utc'))).Code | Should -Be 'expired'
            (Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now ([datetime]::SpecifyKind([datetime]'2026-11-01T12:10:00', 'Utc'))).Code | Should -Be 'expired' -Because 'expiry is strict: no grace'
        }
        It 'refuses a job issued ahead of the clock beyond the skew, and accepts it at the edge' {
            $future = '2026-11-01T12:30:00Z'; $futureEnd = '2026-11-01T12:40:00Z'
            (Test-DEJobWindow -IssuedAt $future -ExpiresAt $futureEnd -Now $script:Now).Code | Should -Be 'not_yet_valid'
            $edge = '2026-11-01T12:10:00Z'; $edgeEnd = '2026-11-01T12:20:00Z'
            (Test-DEJobWindow -IssuedAt $edge -ExpiresAt $edgeEnd -Now $script:Now).Ok | Should -Be $true -Because 'exactly 300 seconds ahead is inside the skew'
            $over = '2026-11-01T12:10:01Z'; $overEnd = '2026-11-01T12:20:01Z'
            (Test-DEJobWindow -IssuedAt $over -ExpiresAt $overEnd -Now $script:Now).Code | Should -Be 'not_yet_valid'
        }
        It 'refuses a malformed, reversed or over-long window (bad_window)' {
            (Test-DEJobWindow -IssuedAt 'yesterday' -ExpiresAt $script:Expires -Now $script:Now).Code | Should -Be 'bad_window'
            (Test-DEJobWindow -IssuedAt '2026-13-45T12:00:00Z' -ExpiresAt $script:Expires -Now $script:Now).Code | Should -Be 'bad_window'
            (Test-DEJobWindow -IssuedAt $script:Expires -ExpiresAt $script:Issued -Now $script:Now).Code | Should -Be 'bad_window'
            (Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt '2026-11-01T12:30:00Z' -Now $script:Now).Code | Should -Be 'bad_window'
        }
        It 'a clock set back cannot revive an expired job: the floor wins' {
            $floor = [datetime]::SpecifyKind([datetime]'2026-11-01T13:00:00', 'Utc')
            $r = Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $script:Now -Floor $floor
            $r.Code | Should -Be 'expired' -Because 'the agent has already seen 13:00, so a 12:05 clock is a lie'
        }
        It 'a clock set back a little still lets an in-window job through (the floor is not a veto)' {
            $floor = [datetime]::SpecifyKind([datetime]'2026-11-01T12:07:00', 'Utc')
            (Test-DEJobWindow -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $script:Now -Floor $floor).Ok | Should -Be $true
        }
    }

    Context 'the time floor only moves forward, and fails closed' {
        It 'creates the floor, raises it, and never lowers it' {
            $p = Join-Path $script:Work 'floor-a\time-floor.txt'
            (Get-DETimeFloor -Path $p) | Should -BeNullOrEmpty
            $t1 = [datetime]::SpecifyKind([datetime]'2026-11-01T12:00:00', 'Utc')
            $t2 = [datetime]::SpecifyKind([datetime]'2026-11-01T12:30:00', 'Utc')
            (Update-DETimeFloor -Path $p -Now $t1) | Should -Be $t1
            (Update-DETimeFloor -Path $p -Now $t2) | Should -Be $t2
            (Update-DETimeFloor -Path $p -Now $t1) | Should -Be $t2 -Because 'a clock set back must not lower the floor'
            (Get-DETimeFloor -Path $p) | Should -Be $t2
        }
        It 'writes atomically: no temp file is left behind' {
            $p = Join-Path $script:Work 'floor-b\time-floor.txt'
            $null = Update-DETimeFloor -Path $p -Now $script:Now
            Test-Path -LiteralPath "$p.tmp" | Should -Be $false
            Test-Path -LiteralPath $p | Should -Be $true
        }
        It 'treats an unreadable floor as an error, never as no floor' {
            $p = Join-Path $script:Work 'floor-c.txt'
            Set-Content -LiteralPath $p -Value 'garbage'
            { Get-DETimeFloor -Path $p } | Should -Throw
            { Update-DETimeFloor -Path $p -Now $script:Now } | Should -Throw
        }
    }

    Context 'Confirm-DEJobAuthentic is the gate' {
        BeforeEach { $script:FloorPath = Join-Path $script:Work ('gate-' + [guid]::NewGuid().ToString('N') + '.txt') }
        It 'accepts a genuine, in-window job and raises the floor' {
            $sig = New-DESignedInput -Text $script:SignedText
            $r = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $script:Now -FloorPath $script:FloorPath
            $r.Ok | Should -Be $true -Because $r.Why
            (Get-DETimeFloor -Path $script:FloorPath) | Should -Be $script:Now
        }
        It 'judges the signature before the window: a forged job reports bad_signature even if it is also expired' {
            $sig = New-DESignedInput -Text $script:SignedText -Seed $script:SeedB
            $late = [datetime]::SpecifyKind([datetime]'2026-11-02T00:00:00', 'Utc')
            $r = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $late -FloorPath $script:FloorPath
            $r.Code | Should -Be 'bad_signature'
        }
        It 'reports expired for a genuine job past its window, and does not touch the floor' {
            $sig = New-DESignedInput -Text $script:SignedText
            $late = [datetime]::SpecifyKind([datetime]'2026-11-01T12:30:00', 'Utc')
            $r = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $late -FloorPath $script:FloorPath
            $r.Code | Should -Be 'expired'
            Test-Path -LiteralPath $script:FloorPath | Should -Be $false -Because 'a refused job must not move the floor'
        }
        It 'the floor holds after the clock is set back (replay inside the window is the nonce store, move 66)' {
            $sig = New-DESignedInput -Text $script:SignedText
            $ok = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now ([datetime]::SpecifyKind([datetime]'2026-11-01T12:09:00', 'Utc')) -FloorPath $script:FloorPath
            $ok.Ok | Should -Be $true
            $setBack = [datetime]::SpecifyKind([datetime]'2026-11-01T11:00:00', 'Utc')
            $again = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $setBack -FloorPath $script:FloorPath
            $again.Ok | Should -Be $true -Because 'still inside the window by the floor (12:09), which is the honest judgement'
            $afterEnd = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now ([datetime]::SpecifyKind([datetime]'2026-11-01T12:11:00', 'Utc')) -FloorPath $script:FloorPath
            $afterEnd.Code | Should -Be 'expired'
            $setBackAgain = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $setBack -FloorPath $script:FloorPath
            $setBackAgain.Ok | Should -Be $true -Because 'a refused attempt does not raise the floor, so the floor is still 12:09'
        }
        It 'fails closed when the floor cannot be read' {
            Set-Content -LiteralPath $script:FloorPath -Value 'garbage'
            $sig = New-DESignedInput -Text $script:SignedText
            $r = Confirm-DEJobAuthentic -SigningInput $script:SignedText -Signature $sig -KeyId 'job-2026-1' -PinnedKeys $script:Pins -IssuedAt $script:Issued -ExpiresAt $script:Expires -Now $script:Now -FloorPath $script:FloorPath
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'time_floor_unreadable'
        }
    }
}
