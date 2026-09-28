<#
.SYNOPSIS
    Signs DE Tech Tool and MSP AI Kit loader scripts and writes integrity.json.

.DESCRIPTION
    Release step, run on the DE build workstation that holds the code-signing certificate.
      1. Finds the code-signing certificate (by -Thumbprint, else the only valid CodeSigning cert in
         Cert:\CurrentUser\My, then Cert:\LocalMachine\My).
      2. Authenticode-signs every .ps1 / .psm1 / .psd1 under windows\ with SHA256 and an RFC 3161 timestamp.
      3. Writes windows\integrity.json: sha256 of every shipped file (scripts, catalog, fonts, launchers).
         The console checks this at start and reports any file changed since packaging as tampered.
    -Verify re-checks an existing package without signing. -WhatIf shows what would be signed.
    The certificate's private key never leaves the certificate store; nothing secret is written.

.EXAMPLE
    .\Sign-DETechConsole.ps1 -Thumbprint 0123ABCD... -WhatIf
    .\Sign-DETechConsole.ps1 -Thumbprint 0123ABCD...
    .\Sign-DETechConsole.ps1 -Verify
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Thumbprint,
    [string]$TimestampServer = 'http://timestamp.digicert.com',
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [switch]$Verify,
    [switch]$SkipSigning
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptExt = @('.ps1', '.psm1', '.psd1')
$shipExt = @('.ps1', '.psm1', '.psd1', '.json', '.cmd', '.ttf', '.txt', '.md', '.xaml')
$skipDirs = @('tests', 'packaging\out', 'packaging/out')

function Get-ShippedFile {
    Get-ChildItem -LiteralPath $Root -Recurse -File | Where-Object {
        $rel = $_.FullName.Substring($Root.Length).TrimStart('\', '/')
        ($shipExt -contains $_.Extension.ToLowerInvariant()) -and ($rel -ne 'integrity.json') -and -not ($skipDirs | Where-Object { $rel -like "$_*" })
    }
}

if ($Verify) {
    $manifest = Join-Path $Root 'integrity.json'
    if (-not (Test-Path -LiteralPath $manifest)) { Write-Host 'integrity.json not found; package was not signed.'; exit 2 }
    $m = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
    $bad = @()
    foreach ($f in @($m.files)) {
        $full = Join-Path $Root $f.path
        if (-not (Test-Path -LiteralPath $full)) { $bad += "missing $($f.path)"; continue }
        if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant() -ne $f.sha256) { $bad += "changed $($f.path)" }
        if ($env:OS -eq 'Windows_NT' -and ($scriptExt -contains [IO.Path]::GetExtension($full).ToLowerInvariant())) {
            $s = Get-AuthenticodeSignature -LiteralPath $full; if ($s.Status -ne 'Valid') { $bad += "signature $($s.Status) $($f.path)" }
        }
    }
    if ($bad.Count) { $bad | ForEach-Object { Write-Host "FAIL $_" }; exit 1 }
    Write-Host ("PASS {0} file(s) match integrity.json (version {1}, signed by {2})" -f @($m.files).Count, $m.version, $m.signer); exit 0
}

$cert = $null
if (-not $SkipSigning) {
    if ($env:OS -ne 'Windows_NT') { throw 'Signing needs Windows. Use -SkipSigning to write integrity.json only.' }
    $stores = @('Cert:\CurrentUser\My', 'Cert:\LocalMachine\My')
    $candidates = @(foreach ($st in $stores) { Get-ChildItem -Path $st -CodeSigningCert -ErrorAction SilentlyContinue | Where-Object { $_.NotAfter -gt (Get-Date) -and $_.HasPrivateKey } })
    if ($Thumbprint) { $candidates = @($candidates | Where-Object { $_.Thumbprint -eq ($Thumbprint -replace '\s', '').ToUpperInvariant() }) }
    if ($candidates.Count -ne 1) { throw ("Need exactly one valid code-signing certificate with a private key; found {0}. Pass -Thumbprint." -f $candidates.Count) }
    $cert = $candidates[0]
    Write-Host ("Signing with {0} (thumbprint {1}, expires {2:yyyy-MM-dd})" -f $cert.Subject, $cert.Thumbprint, $cert.NotAfter)
    foreach ($f in Get-ShippedFile | Where-Object { $scriptExt -contains $_.Extension.ToLowerInvariant() }) {
        if ($PSCmdlet.ShouldProcess($f.FullName, 'Authenticode sign (SHA256, timestamped)')) {
            $r = Set-AuthenticodeSignature -LiteralPath $f.FullName -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $TimestampServer -IncludeChain NotRoot
            if ($r.Status -ne 'Valid') { throw "signing failed for $($f.FullName): $($r.StatusMessage)" }
        }
    }
}

$version = '0.0.0'
$vf = Join-Path (Split-Path -Parent $Root) 'kit.version'; if (Test-Path -LiteralPath $vf) { $version = (Get-Content -LiteralPath $vf -Raw).Trim() }
$entries = @(foreach ($f in Get-ShippedFile | Sort-Object FullName) {
    [ordered]@{ path = ($f.FullName.Substring($Root.Length).TrimStart('\', '/') -replace '\\', '/'); sha256 = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256).Hash.ToLowerInvariant(); bytes = $f.Length }
})
$doc = [ordered]@{ schema = 'de.techconsole.integrity/v1'; version = $version; created = (Get-Date).ToString('o'); signer = $(if ($cert) { $cert.Subject } else { 'unsigned' }); thumbprint = $(if ($cert) { $cert.Thumbprint } else { '' }); files = $entries }
if ($PSCmdlet.ShouldProcess((Join-Path $Root 'integrity.json'), "write $($entries.Count) file hashes")) {
    $doc | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $Root 'integrity.json') -Encoding UTF8
    Write-Host ("Wrote integrity.json: {0} file(s), version {1}" -f $entries.Count, $version)
}
exit 0
