#Requires -Version 5.1
<#
.SYNOPSIS
    Builds one watermarked DE Tech Tool release zip for a named recipient.

.DESCRIPTION
    Every build is traceable (PROTECTING-THE-TOOL.md):
      1. copies the kit (msp-ai-kit\) to a staging folder, leaving out build output and VCS files;
      2. writes console\BUILD.json: build ID, time, source commit and who the copy is issued to; the tool shows it
         in the title and puts it in every evidence bundle and Hub record;
      3. writes console\trust\license-keys.json from the Hub's public keys (JWKS: -PublicKeysFile or -HubUrl), with
         -HubUrl also console\trust\revoked.json from the Hub's revocation list, and the licence policy
         (-Enforce = 'required');
      4. stages the pinned community tools (community\) so offline and OOBE runs work;
      5. writes integrity.json and signs (Sign-DETechConsole.ps1; -Thumbprint, or -SkipSigning for test builds);
      6. zips it as DE-TechTool-v<version>-<buildId>.zip with a .sha256, and appends the build to
         packaging\out\build-register.csv (build ID, recipient, time, sha256): the list that names a leaked copy.
    No private key, secret or client data goes into a build.

.EXAMPLE
    .\New-DEReleasePackage.ps1 -IssuedTo 'rmm-channel' -HubUrl https://techsales.digerati-experts.com -Enforce -Thumbprint 0123ABCD...
    .\New-DEReleasePackage.ps1 -IssuedTo 'jrpetro' -SkipSigning        # test build, policy warn, no Hub keys
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._@-]{2,64}$')][string]$IssuedTo,
    [string]$OutDir,
    [string]$PublicKeysFile,
    [string]$HubUrl,
    [switch]$Enforce,
    [string]$Thumbprint,
    [switch]$SkipSigning,
    [switch]$NoCommunity,
    [string]$Channel = 'release'
)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })
$windows = Split-Path -Parent $here; $kit = Split-Path -Parent $windows
if (-not $OutDir) { $OutDir = Join-Path $here 'out' }
if (-not $SkipSigning -and -not $Thumbprint) { throw 'Pass -Thumbprint of the DE code-signing certificate, or -SkipSigning for a test build.' }
if ($HubUrl -and $HubUrl -notmatch '^https://') { throw 'The Hub URL must be https://' }
if ($Enforce -and -not ($PublicKeysFile -or $HubUrl)) { throw '-Enforce needs the Hub public keys (-PublicKeysFile or -HubUrl); otherwise no licence could ever verify.' }
$version = (Get-Content -LiteralPath (Join-Path $windows 'console\VERSION') -Raw -Encoding UTF8).Trim()
$buildId = 'DE-{0}-{1}-{2}' -f $version, (Get-Date).ToUniversalTime().ToString('yyyyMMddHHmm'), ([guid]::NewGuid().ToString('N').Substring(0, 6))
$commit = $null; try { $commit = (& git -C $kit rev-parse HEAD 2>$null) } catch { $commit = $null }

$stage = Join-Path ([IO.Path]::GetTempPath()) "de-release-$buildId"
$dst = Join-Path $stage 'msp-ai-kit'
New-Item -ItemType Directory -Path $dst -Force | Out-Null
$skip = '[\\/](\.git|node_modules|out|community|tests)([\\/]|$)'   # tests stay in the repo (integrity.json never covered them)
foreach ($f in @(Get-ChildItem -LiteralPath $kit -Recurse -File -Force | Where-Object { $_.FullName.Substring($kit.Length) -notmatch $skip -and $_.Name -ne 'integrity.json' -and $_.Name -ne 'BUILD.json' })) {
    $rel = $f.FullName.Substring($kit.Length).TrimStart('\', '/'); $to = Join-Path $dst $rel
    $d = Split-Path -Parent $to; if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null }
    Copy-Item -LiteralPath $f.FullName -Destination $to
}
$sw = Join-Path $dst 'windows'; $sc = Join-Path $sw 'console'
$utf8 = New-Object Text.UTF8Encoding $false
[IO.File]::WriteAllText((Join-Path $sc 'BUILD.json'), ([ordered]@{ buildId = $buildId; version = $version; builtAt = (Get-Date).ToUniversalTime().ToString('o'); issuedTo = $IssuedTo; channel = $Channel; sourceCommit = $commit } | ConvertTo-Json), $utf8)

# public keys only: a JWKS from the Hub; anything carrying a private component is refused
$jwks = $null
if ($PublicKeysFile) { $jwks = Get-Content -LiteralPath $PublicKeysFile -Raw -Encoding UTF8 | ConvertFrom-Json }
elseif ($HubUrl) { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12; $jwks = Invoke-RestMethod -Uri ($HubUrl.TrimEnd('/') + '/api/techtool/license/jwks') -UseBasicParsing -TimeoutSec 30 }
if ($jwks) {
    $keys = @($jwks.keys | Where-Object { $_ -and "$($_.kty)" -eq 'RSA' })
    foreach ($k in $keys) { foreach ($priv in @('d', 'p', 'q', 'dp', 'dq', 'qi')) { if ($k.PSObject.Properties[$priv]) { throw "key $($k.kid) contains a private component ($priv); only public keys may go into a build" } } }
    if (-not $keys.Count) { throw 'the JWKS holds no RSA keys' }
    $doc = [ordered]@{ about = "Public keys that verify DE Tech Tool licences (RS256), from the Hub JWKS at build $buildId."; keys = @($keys | ForEach-Object { [ordered]@{ kid = "$($_.kid)"; n = "$($_.n)"; e = "$($_.e)" } }) }
    [IO.File]::WriteAllText((Join-Path $sc 'trust\license-keys.json'), ($doc | ConvertTo-Json -Depth 5), $utf8)
}
# the Hub's revocation list ships as trust\revoked.json (covered by integrity.json); the tool also downloads it at run time
if ($HubUrl) {
    if (-not (Get-Command -Name ConvertFrom-DELicenseRevocationList -ErrorAction SilentlyContinue)) { Import-Module (Join-Path $windows 'console\modules\DE.License\DE.License.psm1') -DisableNameChecking }
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $rvBody = Invoke-WebRequest -Uri ($HubUrl.TrimEnd('/') + '/api/techtool/license/revocations') -UseBasicParsing -TimeoutSec 30
    try { $rv = ConvertFrom-DELicenseRevocationList -Json "$($rvBody.Content)" } catch { throw "the Hub's revocation list was refused: $($_.Exception.Message)" }
    $doc = [ordered]@{ about = "Licence IDs revoked on the Intelligence Hub, from the Hub at build $buildId. The tool also downloads the current list at run time into its data folder; this file is never changed after the build."; updatedAt = $rv.updatedAt; jti = @($rv.jti) }
    [IO.File]::WriteAllText((Join-Path $sc 'trust\revoked.json'), ($doc | ConvertTo-Json -Depth 4), $utf8)
}
if ($Enforce) {
    $polPath = Join-Path $sc 'trust\license-policy.json'; $pol = Get-Content -LiteralPath $polPath -Raw -Encoding UTF8 | ConvertFrom-Json; $pol.enforce = 'required'
    [IO.File]::WriteAllText($polPath, ($pol | ConvertTo-Json -Depth 5), $utf8)
}

if (-not $NoCommunity) {
    Import-Module (Join-Path $sc 'modules\DE.Workflow\DE.Workflow.psm1') -Force -DisableNameChecking
    Import-DEConsoleModules -Root $sc
    $null = Initialize-DEConsole -Root $sc -Mode Audit -DataDir (Join-Path $stage 'data')
    foreach ($id in @((Get-DECommunityCatalog).tools | Where-Object { $_.use -in @('module', 'scripts') } | ForEach-Object { $_.id })) { $null = Save-DECommunityTool -Id $id -Destination (Join-Path $sw 'community') }
    Remove-Item -LiteralPath (Join-Path $stage 'data') -Recurse -Force -ErrorAction SilentlyContinue
}

$signArgs = @{ Root = $sw }; if ($SkipSigning) { $signArgs.SkipSigning = $true } else { $signArgs.Thumbprint = $Thumbprint }
& (Join-Path $sw 'packaging\Sign-DETechConsole.ps1') @signArgs | Out-Null
if ($LASTEXITCODE) { throw "signing failed (exit $LASTEXITCODE)" }

New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
$zip = Join-Path $OutDir "DE-TechTool-v$version-$buildId.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path $dst -DestinationPath $zip
$fs = [IO.File]::OpenRead($zip); $sha = [Security.Cryptography.SHA256]::Create(); try { $hash = -join ($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') }) } finally { $sha.Dispose(); $fs.Dispose() }
[IO.File]::WriteAllText("$zip.sha256", "$hash  $(Split-Path -Leaf $zip)`n", $utf8)
$reg = Join-Path $OutDir 'build-register.csv'
if (-not (Test-Path -LiteralPath $reg)) { [IO.File]::WriteAllText($reg, "buildId,issuedTo,channel,builtAt,version,sourceCommit,enforce,signed,sha256`n", $utf8) }
[IO.File]::AppendAllText($reg, ('{0},{1},{2},{3},{4},{5},{6},{7},{8}' -f $buildId, $IssuedTo, $Channel, (Get-Date).ToUniversalTime().ToString('o'), $version, $commit, $(if ($Enforce) { 'required' } else { 'warn' }), (-not $SkipSigning), $hash) + "`n", $utf8)
Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Built $zip"; Write-Host "sha256 $hash"; Write-Host "build $buildId issued to $IssuedTo (policy $(if ($Enforce) { 'required' } else { 'warn' }))"
[pscustomobject]@{ zip = $zip; sha256 = $hash; buildId = $buildId; issuedTo = $IssuedTo; enforce = $(if ($Enforce) { 'required' } else { 'warn' }) }
