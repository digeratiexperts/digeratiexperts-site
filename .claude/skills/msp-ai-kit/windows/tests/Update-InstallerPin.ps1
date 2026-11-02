<#
.SYNOPSIS
    Refresh the pin of an installer whose vendor changed the file (R5/R7/R10), as a reviewed change.

.DESCRIPTION
    A pinned URL source refuses once the vendor ships a new file. That refusal is correct, but it
    should not need a hand-edit of the catalog. This script turns it into a short reviewed change:

        1. downloads the source twice over TLS and refuses unless both downloads are identical
        2. where the catalog says the vendor signs (vendorSigns), refuses unless Authenticode is
           Valid and the signer matches the recorded publisher (R5 option C)
        3. prints old and new hash and the file versions
        4. with -Apply, rewrites ONLY that source's sha256 and its sha256From provenance in
           console\catalog\packages.json (exact-string edits, never a regex rewrite)

    It never commits and never installs anything. The catalog diff is the change a human reviews and
    merges (R10: nobody edits the catalog to make a refusal go away without review). It refreshes an
    existing pin only; the first pin of a source is made by hand with the same checks (move 41).

    Exit codes: 0 pin already current or refreshed (-Apply), 1 refused (signature, mismatch between
    downloads, or not a pinned url source), 2 could not run, 3 the file changed and -Apply was not
    given (review the printed hashes, then rerun with -Apply).

.PARAMETER Id
    The package id in packages.json.

.PARAMETER FilePath
    Use an already-downloaded copy instead of downloading (for a source that needs a browser or
    login to fetch). The provenance then says one download, not two.

.PARAMETER Apply
    Write the refreshed pin into packages.json.

.EXAMPLE
    powershell -File windows/tests/Update-InstallerPin.ps1 -Id m365-apps
    powershell -File windows/tests/Update-InstallerPin.ps1 -Id m365-apps -Apply
#>
[CmdletBinding()]
param(
    [string]$Id = '',
    [string]$CatalogPath = '',
    [string]$FilePath = '',
    [switch]$Apply
)

$ErrorActionPreference = 'Stop'

function ConvertTo-DEPublisherKey {
    <# 'JumpCloud Inc.' and 'CN=JumpCloud Inc' compare equal: letters and digits only, lowercase. #>
    param([string]$Text)
    return ("$Text" -replace '[^A-Za-z0-9]', '').ToLowerInvariant()
}

function Test-DESignerMatchesPublisher {
    <# The signer subject's CN must contain the recorded publisher (Wazuh matches Wazuh, Inc). #>
    param([string]$Subject, [string]$Publisher)
    $cn = [regex]::Match("$Subject", '(?:^|,\s*)CN=("([^"]*)"|[^,]*)')
    if (-not $cn.Success) { return $false }
    $name = if ($cn.Groups[2].Success) { $cn.Groups[2].Value } else { $cn.Groups[1].Value }
    $want = ConvertTo-DEPublisherKey $Publisher
    $have = ConvertTo-DEPublisherKey $name
    return ($want.Length -gt 0 -and $have.Contains($want))
}

function Get-DEPinUpdatedCatalogText {
    <# Returns the catalog text with one pinned url source's hash and provenance replaced, or throws.
       Exact-string edits on the one line that holds that source's url. #>
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$NewSha256,
        [Parameter(Mandatory = $true)][string]$NewProvenance
    )
    if ($NewSha256 -notmatch '^[0-9a-f]{64}$') { throw 'the new hash must be 64 lowercase hex characters' }
    $pkg = @(($Text | ConvertFrom-Json).packages | Where-Object { $_.id -eq $Id })
    if ($pkg.Count -ne 1) { throw "package '$Id' not found exactly once" }
    $src = $pkg[0].source
    if ("$($src.type)" -ne 'url') { throw "package '$Id' is not a url source" }
    if ($null -eq $src.sha256) { throw "package '$Id' has no pin to refresh; the first pin is made by hand (move 41)" }
    $lines = $Text -split "`n", -1
    $idx = @(0..($lines.Count - 1) | Where-Object { $lines[$_].Contains('"url": "' + $src.url + '"') })
    if ($idx.Count -ne 1) { throw "the url line for '$Id' was found $($idx.Count) times" }
    $line = $lines[$idx[0]]
    $oldHash = '"sha256": "' + $src.sha256 + '"'
    $oldFrom = '"sha256From": "' + $src.sha256From + '"'
    foreach ($old in @($oldHash, $oldFrom)) {
        if (([regex]::Matches($line, [regex]::Escape($old))).Count -ne 1) { throw "expected exactly one '$old' on the url line for '$Id'" }
    }
    $line = $line.Replace($oldHash, '"sha256": "' + $NewSha256 + '"').Replace($oldFrom, '"sha256From": "' + $NewProvenance + '"')
    $lines[$idx[0]] = $line
    $out = $lines -join "`n"
    $check = @(($out | ConvertFrom-Json).packages | Where-Object { $_.id -eq $Id })[0].source
    if ($check.sha256 -ne $NewSha256) { throw 'the rewritten catalog does not carry the new pin' }
    return $out
}

function Get-DEFileSha256Literal {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return (-join ($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') })) } finally { $sha.Dispose(); $fs.Dispose() }
}

# Dot-source guard: tests load the functions without running the refresh.
if ($MyInvocation.InvocationName -eq '.') { return }

if (-not $Id) { Write-Host 'usage: Update-InstallerPin.ps1 -Id <package id> [-Apply]'; exit 2 }

try {
    if (-not $CatalogPath) {
        $CatalogPath = Join-Path (Join-Path (Split-Path -Parent $PSScriptRoot) 'console') 'catalog\packages.json'
    }
    $bytes = [IO.File]::ReadAllBytes($CatalogPath)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    $text = [IO.File]::ReadAllText($CatalogPath)
    $pkg = @(($text | ConvertFrom-Json).packages | Where-Object { $_.id -eq $Id })
    if ($pkg.Count -ne 1) { Write-Host "refused: package '$Id' not found"; exit 1 }
    $src = $pkg[0].source
    if ("$($src.type)" -ne 'url' -or $null -eq $src.sha256) { Write-Host "refused: '$Id' is not a pinned url source (nothing to refresh)"; exit 1 }

    $work = Join-Path ([IO.Path]::GetTempPath()) ('de-pin-' + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $work -Force | Out-Null
    try {
        $files = @()
        if ($FilePath) { $files += $FilePath } else {
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { Write-Verbose 'TLS 1.2 flag not settable on this host' }
            foreach ($n in 1, 2) {
                $f = Join-Path $work "download$n.bin"
                Invoke-WebRequest -Uri $src.url -OutFile $f -UseBasicParsing -UserAgent 'DETechTool-PinRefresh/1'
                $files += $f
            }
        }
        $hashes = @($files | ForEach-Object { Get-DEFileSha256Literal -Path $_ })
        if (@($hashes | Select-Object -Unique).Count -ne 1) { Write-Host 'refused: the downloads differ from each other, so there is no stable file to pin'; exit 1 }
        $new = $hashes[0]
        $sig = Get-AuthenticodeSignature -LiteralPath $files[0]
        $signer = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { '' }
        $version = (Get-Item -LiteralPath $files[0]).VersionInfo.ProductVersion

        if ($src.vendorSigns) {
            if ($sig.Status -ne 'Valid') { Write-Host "refused: Authenticode is $($sig.Status) and the catalog says this vendor signs (R4/R5)"; exit 1 }
            if (-not (Test-DESignerMatchesPublisher -Subject $signer -Publisher "$($src.publisher)")) { Write-Host "refused: signer '$signer' is not the recorded publisher '$($src.publisher)'"; exit 1 }
        }

        Write-Host "package     : $Id ($($pkg[0].name))"
        Write-Host "recorded pin: $($src.sha256)"
        Write-Host "new file    : $new"
        Write-Host "file version: $version   signature: $($sig.Status)   signer: $signer"
        if ($new -eq $src.sha256) { Write-Host 'the pin is already current; nothing to change'; exit 0 }

        $date = (Get-Date).ToString('yyyy-MM-dd')
        $how = if ($FilePath) { 'one supplied file' } else { 'two identical TLS downloads' }
        $cn = [regex]::Match($signer, '(?:^|,\s*)CN=("([^"]*)"|[^,]*)')
        $cnName = if ($cn.Groups[2].Success) { $cn.Groups[2].Value } else { $cn.Groups[1].Value }
        $sigNote = if ($src.vendorSigns) { "Authenticode Valid, signer CN=$cnName (R5, option C)" } else { 'no vendor signature to check (R5, option A)' }
        $prov = "pinned-first-download $date`: refreshed by Update-InstallerPin.ps1 from $($src.url) ($how$(if ($version) { ", file version $version" })), $sigNote. Reviewed change (R10); the previous pin was $($src.sha256)"
        $updated = Get-DEPinUpdatedCatalogText -Text $text -Id $Id -NewSha256 $new -NewProvenance $prov
        if (-not $Apply) { Write-Host 'the file changed. Review the hashes above, then rerun with -Apply to write the new pin for review.'; exit 3 }
        [IO.File]::WriteAllText($CatalogPath, $updated, (New-Object System.Text.UTF8Encoding $hasBom))
        Write-Host "pin refreshed in $CatalogPath - review the diff and open a PR; nothing was committed."
        exit 0
    } finally {
        Remove-Item -LiteralPath $work -Recurse -Force -ErrorAction SilentlyContinue
    }
} catch {
    Write-Host ('pin refresh could not run: ' + $_.Exception.Message)
    exit 2
}
