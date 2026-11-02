# DE.AgentTrust: what the DE Tech Agent checks before it believes a job (move 65).
#
# Three small, separate checks, each of which refuses by default:
#   1. Test-DEEd25519Signature  - a managed Ed25519 verifier (RFC 8032). Windows PowerShell 5.1 and .NET
#      Framework have no Ed25519, and the Hub signs jobs with it, so the verifier is carried here.
#   2. Test-DEJobSignature      - verifies the exact signed bytes against a key PINNED by key id. There is no
#      parameter that takes a key from the job, the server or the network: a key id with no pin is refused.
#   3. Test-DEJobWindow         - issued/expiry checks against a clock that cannot be set back: the effective
#      time is never earlier than the latest time the agent has seen (the time floor).
# Confirm-DEJobAuthentic composes them and reports the first refusal as a code the agent sends back.
#
# This module has no network access, writes only the time floor file it is pointed at, and is not loaded by
# the interactive console. The service that uses it is move 68.

$script:Ed25519Source = @'
using System;
using System.Numerics;
using System.Security.Cryptography;

namespace DE.AgentTrust
{
    public static class Ed25519
    {
        static readonly BigInteger P = BigInteger.Pow(2, 255) - 19;
        static readonly BigInteger L = BigInteger.Pow(2, 252) + BigInteger.Parse("27742317777372353535851937790883648493");
        static readonly BigInteger D = Mod(-121665 * ModInv(121666));
        static readonly BigInteger SqrtM1 = BigInteger.ModPow(2, (P - 1) / 4, P);
        static readonly Pt G = MakeBase();

        struct Pt { public BigInteger X, Y, Z, T; }

        static BigInteger Mod(BigInteger a) { BigInteger r = a % P; return r.Sign < 0 ? r + P : r; }
        static BigInteger ModInv(BigInteger a) { return BigInteger.ModPow(Mod(a), P - 2, P); }

        static Pt Add(Pt p, Pt q)
        {
            BigInteger a = Mod((p.Y - p.X) * (q.Y - q.X));
            BigInteger b = Mod((p.Y + p.X) * (q.Y + q.X));
            BigInteger c = Mod(p.T * 2 * D * q.T);
            BigInteger d = Mod(p.Z * 2 * q.Z);
            BigInteger e = b - a, f = d - c, g = d + c, h = b + a;
            Pt r; r.X = Mod(e * f); r.Y = Mod(g * h); r.Z = Mod(f * g); r.T = Mod(e * h);
            return r;
        }

        static Pt Mul(BigInteger s, Pt p)
        {
            Pt q; q.X = 0; q.Y = 1; q.Z = 1; q.T = 0;
            while (s > 0)
            {
                if (!s.IsEven) q = Add(q, p);
                p = Add(p, p);
                s >>= 1;
            }
            return q;
        }

        static bool Equal(Pt p, Pt q)
        {
            if (Mod(p.X * q.Z - q.X * p.Z) != 0) return false;
            if (Mod(p.Y * q.Z - q.Y * p.Z) != 0) return false;
            return true;
        }

        static BigInteger RecoverX(BigInteger y, int sign)
        {
            if (y >= P) return -1;
            BigInteger x2 = Mod((y * y - 1) * ModInv(D * y * y + 1));
            if (x2.IsZero) { return sign == 1 ? BigInteger.MinusOne : BigInteger.Zero; }
            BigInteger x = BigInteger.ModPow(x2, (P + 3) / 8, P);
            if (Mod(x * x - x2) != 0) x = Mod(x * SqrtM1);
            if (Mod(x * x - x2) != 0) return -1;
            if ((x.IsEven ? 0 : 1) != sign) x = P - x;
            return x;
        }

        static Pt MakeBase()
        {
            BigInteger gy = Mod(4 * ModInv(5));
            BigInteger gx = RecoverX(gy, 0);
            Pt g; g.X = gx; g.Y = gy; g.Z = 1; g.T = Mod(gx * gy);
            return g;
        }

        static BigInteger FromLe(byte[] b, int offset, int count)
        {
            byte[] t = new byte[count + 1];
            Array.Copy(b, offset, t, 0, count);
            return new BigInteger(t);
        }

        static byte[] ToLe32(BigInteger v)
        {
            byte[] raw = v.ToByteArray();
            byte[] r = new byte[32];
            Array.Copy(raw, r, Math.Min(32, raw.Length));
            return r;
        }

        static byte[] Compress(Pt p)
        {
            BigInteger zi = ModInv(p.Z);
            BigInteger x = Mod(p.X * zi), y = Mod(p.Y * zi);
            byte[] r = ToLe32(y);
            if (!x.IsEven) r[31] |= 0x80;
            return r;
        }

        static bool Decompress(byte[] s, out Pt p)
        {
            p = new Pt();
            if (s == null || s.Length != 32) return false;
            byte[] t = (byte[])s.Clone();
            int sign = (t[31] >> 7) & 1;
            t[31] &= 0x7f;
            BigInteger y = FromLe(t, 0, 32);
            BigInteger x = RecoverX(y, sign);
            if (x.Sign < 0) return false;
            p.X = x; p.Y = y; p.Z = 1; p.T = Mod(x * y);
            return true;
        }

        static BigInteger HashToInt(params byte[][] parts)
        {
            using (SHA512 sha = SHA512.Create())
            {
                int total = 0;
                foreach (byte[] part in parts) total += part.Length;
                byte[] all = new byte[total];
                int off = 0;
                foreach (byte[] part in parts) { Array.Copy(part, 0, all, off, part.Length); off += part.Length; }
                byte[] h = sha.ComputeHash(all);
                return FromLe(h, 0, 64);
            }
        }

        static void Expand(byte[] seed, out BigInteger a, out byte[] prefix)
        {
            byte[] h;
            using (SHA512 sha = SHA512.Create()) { h = sha.ComputeHash(seed); }
            byte[] lo = new byte[32];
            Array.Copy(h, lo, 32);
            lo[0] &= 248; lo[31] &= 127; lo[31] |= 64;
            a = FromLe(lo, 0, 32);
            prefix = new byte[32];
            Array.Copy(h, 32, prefix, 0, 32);
        }

        public static byte[] PublicKey(byte[] seed)
        {
            if (seed == null || seed.Length != 32) throw new ArgumentException("an Ed25519 seed is 32 bytes");
            BigInteger a; byte[] prefix;
            Expand(seed, out a, out prefix);
            return Compress(Mul(a, G));
        }

        public static byte[] Sign(byte[] seed, byte[] message)
        {
            if (seed == null || seed.Length != 32) throw new ArgumentException("an Ed25519 seed is 32 bytes");
            BigInteger a; byte[] prefix;
            Expand(seed, out a, out prefix);
            byte[] pub = Compress(Mul(a, G));
            BigInteger r = HashToInt(prefix, message) % L;
            byte[] rs = Compress(Mul(r, G));
            BigInteger k = HashToInt(rs, pub, message) % L;
            BigInteger s = (r + k * a) % L;
            byte[] sig = new byte[64];
            Array.Copy(rs, 0, sig, 0, 32);
            Array.Copy(ToLe32(s), 0, sig, 32, 32);
            return sig;
        }

        public static bool Verify(byte[] publicKey, byte[] message, byte[] signature)
        {
            try
            {
                if (publicKey == null || publicKey.Length != 32) return false;
                if (signature == null || signature.Length != 64) return false;
                if (message == null) return false;
                Pt a, r;
                if (!Decompress(publicKey, out a)) return false;
                byte[] rs = new byte[32];
                Array.Copy(signature, 0, rs, 0, 32);
                if (!Decompress(rs, out r)) return false;
                BigInteger s = FromLe(signature, 32, 32);
                if (s >= L) return false;
                BigInteger h = HashToInt(rs, publicKey, message) % L;
                Pt sb = Mul(s, G);
                Pt ha = Add(r, Mul(h, a));
                return Equal(sb, ha);
            }
            catch (Exception) { return false; }
        }
    }
}
'@

if (-not ('DE.AgentTrust.Ed25519' -as [type])) {
    Add-Type -TypeDefinition $script:Ed25519Source -ReferencedAssemblies 'System.Numerics' -Language CSharp
}

function ConvertFrom-DEBase64Url {
    <# base64url, with or without padding, to bytes. Returns $null for anything that is not base64url. #>
    param([AllowNull()][AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrEmpty($Text)) { return $null }
    if ($Text -notmatch '^[A-Za-z0-9_-]+={0,2}$') { return $null }
    $t = $Text.TrimEnd('=').Replace('-', '+').Replace('_', '/')
    switch ($t.Length % 4) { 2 { $t += '==' } 3 { $t += '=' } 1 { return $null } }
    try { return , [Convert]::FromBase64String($t) } catch { return $null }
}

function Test-DEEd25519Signature {
    <# True only for a valid Ed25519 signature (RFC 8032) over exactly -Message by exactly -PublicKey. Never throws. #>
    param([byte[]]$PublicKey, [byte[]]$Message, [byte[]]$Signature)
    return [DE.AgentTrust.Ed25519]::Verify($PublicKey, $Message, $Signature)
}

function Read-DEPinnedJobKeys {
    <#
        The job keys this agent trusts, from the pin file written at build or enrolment: { "<keyId>": "<base64url public key>" }.
        Anything malformed is an error, and an empty set is an error: an agent with no pinned key believes no job.
    #>
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { throw "no pinned job keys at $Path" }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    $keys = @{}
    foreach ($p in $raw.PSObject.Properties) {
        $b = ConvertFrom-DEBase64Url "$($p.Value)"
        if ($null -eq $b -or $b.Length -ne 32) { throw "pinned key '$($p.Name)' is not a base64url Ed25519 public key" }
        $keys[$p.Name] = "$($p.Value)"
    }
    if (-not $keys.Count) { throw 'the pin file holds no keys' }
    return $keys
}

function Test-DEJobSignature {
    <#
        Verifies the exact signed bytes. The key comes ONLY from -PinnedKeys (key id -> base64url public key): a key id with
        no pin is refused, and there is deliberately no parameter that takes a key from the job or the server (S2).
        Returns Ok, Code (unknown_key, bad_signature, malformed_payload) and Why.
    #>
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$SigningInput,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Signature,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$KeyId,
        [Parameter(Mandatory = $true)]$PinnedKeys
    )
    $result = { param($ok, $code, $why) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why } }
    $pin = $null
    if ($PinnedKeys -is [System.Collections.IDictionary]) { if ($PinnedKeys.Contains($KeyId)) { $pin = $PinnedKeys[$KeyId] } }
    elseif ($null -ne $PinnedKeys) { $pp = $PinnedKeys.PSObject.Properties[$KeyId]; if ($pp) { $pin = $pp.Value } }
    if (-not $pin) { return (& $result $false 'unknown_key' "key id '$KeyId' is not pinned on this device") }
    $pub = ConvertFrom-DEBase64Url "$pin"
    if ($null -eq $pub -or $pub.Length -ne 32) { return (& $result $false 'unknown_key' "the pin for '$KeyId' is not a usable Ed25519 key") }
    $sig = ConvertFrom-DEBase64Url $Signature
    if ($null -eq $sig -or $sig.Length -ne 64) { return (& $result $false 'bad_signature' 'the signature is not a base64url Ed25519 signature') }
    $bytes = [Text.Encoding]::UTF8.GetBytes($SigningInput)
    if (-not (Test-DEEd25519Signature -PublicKey $pub -Message $bytes -Signature $sig)) { return (& $result $false 'bad_signature' 'the signature does not match the signed bytes') }
    return (& $result $true '' 'signature verified against the pinned key')
}

function Get-DETimeFloor {
    <# The latest UTC time this agent has seen, or $null when it has none. Throws on a file it cannot read: an unreadable floor must not mean "no floor". #>
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    $text = (Get-Content -LiteralPath $Path -Raw -Encoding UTF8).Trim()
    $t = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($text, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$t)) {
        throw "the time floor at $Path is unreadable"
    }
    return $t
}

function Update-DETimeFloor {
    <# Raises the floor to -Now if -Now is later than it; never lowers it. Writes atomically (temp file, then move). Returns the floor now in force. #>
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][datetime]$Now)
    $utc = $Now.ToUniversalTime()
    $current = Get-DETimeFloor -Path $Path
    if ($null -ne $current -and $current -ge $utc) { return $current }
    $dir = Split-Path -Parent $Path
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $tmp = "$Path.tmp"
    [IO.File]::WriteAllText($tmp, $utc.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", [Globalization.CultureInfo]::InvariantCulture), (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath $tmp -Destination $Path -Force
    return $utc
}

function Test-DEJobWindow {
    <#
        The job's window against a clock that cannot be set back: the effective time is the later of -Now and -Floor.
        Codes: bad_window (not real UTC times, not after each other, or longer than -MaxLifetimeSeconds), not_yet_valid
        (issued more than -MaxSkewSeconds ahead of the effective time), expired (the effective time is at or past the end).
    #>
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$IssuedAt, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$ExpiresAt,
        [Parameter(Mandatory = $true)][datetime]$Now, [Nullable[datetime]]$Floor = $null,
        [int]$MaxLifetimeSeconds = 900, [int]$MaxSkewSeconds = 300
    )
    $result = { param($ok, $code, $why) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why } }
    $formats = [string[]]@("yyyy-MM-dd'T'HH:mm:ss'Z'", "yyyy-MM-dd'T'HH:mm:ss.f'Z'", "yyyy-MM-dd'T'HH:mm:ss.ff'Z'", "yyyy-MM-dd'T'HH:mm:ss.fff'Z'")
    $styles = [Globalization.DateTimeStyles]::AssumeUniversal -bor [Globalization.DateTimeStyles]::AdjustToUniversal
    $issued = [datetime]::MinValue; $expires = [datetime]::MinValue
    if (-not [datetime]::TryParseExact($IssuedAt, $formats, [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$issued)) { return (& $result $false 'bad_window' 'issuedAt is not a real UTC time') }
    if (-not [datetime]::TryParseExact($ExpiresAt, $formats, [Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$expires)) { return (& $result $false 'bad_window' 'expiresAt is not a real UTC time') }
    if ($expires -le $issued) { return (& $result $false 'bad_window' 'expiresAt is not after issuedAt') }
    if (($expires - $issued).TotalSeconds -gt $MaxLifetimeSeconds) { return (& $result $false 'bad_window' "the window is longer than $MaxLifetimeSeconds seconds") }
    $effective = $Now.ToUniversalTime()
    if ($null -ne $Floor -and ([datetime]$Floor).ToUniversalTime() -gt $effective) { $effective = ([datetime]$Floor).ToUniversalTime() }
    if ($issued -gt $effective.AddSeconds($MaxSkewSeconds)) { return (& $result $false 'not_yet_valid' "issued more than $MaxSkewSeconds seconds ahead of the clock") }
    if ($effective -ge $expires) { return (& $result $false 'expired' 'the job has expired (judged against a clock that cannot go back)') }
    return (& $result $true '' 'inside its window')
}

function Confirm-DEJobAuthentic {
    <#
        The agent's authenticity gate: signature first (a window nobody signed means nothing), then the window against the
        time floor. Returns the first refusal, or Ok. A refusal Code is what the agent sends back (the job queue design's ack
        refusal): unknown_key, bad_signature, bad_window, not_yet_valid, expired, time_floor_unreadable. On success the floor
        is raised to the effective time, so the clock can never move behind a job the agent has accepted.
    #>
    param(
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$SigningInput, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Signature,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$KeyId, [Parameter(Mandatory = $true)]$PinnedKeys,
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$IssuedAt, [Parameter(Mandatory = $true)][AllowEmptyString()][string]$ExpiresAt,
        [Parameter(Mandatory = $true)][datetime]$Now, [Parameter(Mandatory = $true)][string]$FloorPath,
        [int]$MaxLifetimeSeconds = 900, [int]$MaxSkewSeconds = 300
    )
    $sig = Test-DEJobSignature -SigningInput $SigningInput -Signature $Signature -KeyId $KeyId -PinnedKeys $PinnedKeys
    if (-not $sig.Ok) { return $sig }
    $floor = $null
    try { $floor = Get-DETimeFloor -Path $FloorPath } catch { return [pscustomobject]@{ Ok = $false; Code = 'time_floor_unreadable'; Why = "$($_.Exception.Message)" } }
    $win = Test-DEJobWindow -IssuedAt $IssuedAt -ExpiresAt $ExpiresAt -Now $Now -Floor $floor -MaxLifetimeSeconds $MaxLifetimeSeconds -MaxSkewSeconds $MaxSkewSeconds
    if (-not $win.Ok) { return $win }
    $null = Update-DETimeFloor -Path $FloorPath -Now $Now
    return [pscustomobject]@{ Ok = $true; Code = ''; Why = 'authentic and inside its window' }
}

Export-ModuleMember -Function ConvertFrom-DEBase64Url, Test-DEEd25519Signature, Read-DEPinnedJobKeys, Test-DEJobSignature, Get-DETimeFloor, Update-DETimeFloor, Test-DEJobWindow, Confirm-DEJobAuthentic
