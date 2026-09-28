<#
.SYNOPSIS
    RMM deployment of the DE Tech Tool: download, verify, install, optionally run headless.

.DESCRIPTION
    Built for MSP360 / JumpCloud Commands / any RMM that runs PowerShell as SYSTEM.
      1. Downloads the release zip over HTTPS (or takes -PackagePath) and refuses it unless its sha256
         equals -Sha256. There is no "skip the hash" switch.
      2. Extracts to a staging folder, runs packaging\Sign-DETechConsole.ps1 -Verify (integrity.json and,
         when -RequireSignature, Authenticode) and only then swaps it into -InstallDir, keeping one backup.
      3. With -Client, runs the console headless: audit by default, -Apply to change the machine.
    Runtime secrets: define RMM secure variables named DE_SECRET_<NAME> (for example DE_SECRET_JC_CONNECT_KEY,
    DE_SECRET_S1_SITE_TOKEN, DE_SECRET_GUARDZ_ORG_KEY). The console moves them into memory and clears them
    from the environment; they are never passed on a command line, logged or written to disk.
    Exit codes: 0 ready / installed, 1 not ready, 2 blocked or refused, 3 download or verification failure.

.EXAMPLE
    .\Deploy-DETechConsole.ps1 -PackageUrl https://downloads.example/de-techconsole-1.1.0.zip -Sha256 <hash>
    .\Deploy-DETechConsole.ps1 -PackageUrl ... -Sha256 ... -Client alamo -Mode takeover
    .\Deploy-DETechConsole.ps1 -PackageUrl ... -Sha256 ... -Client alamo -Mode repair -Apply
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$PackageUrl,
    [string]$PackagePath,
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9a-fA-F]{64}$')][string]$Sha256,
    [string]$InstallDir = (Join-Path $env:ProgramFiles 'DE\TechConsole'),
    [switch]$RequireSignature,
    [string]$Client,
    [ValidateSet('auto', 'audit', 'new', 'dropship', 'takeover', 'replacement', 'repair', 'co-managed', 'deprovision')][string]$Mode = 'audit',
    [string]$Bundle,
    [string[]]$Solution = @(),
    [switch]$Apply
)
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$logDir = Join-Path $env:ProgramData 'DE\TechConsole\logs'; New-Item -ItemType Directory -Path $logDir -Force | Out-Null
$log = Join-Path $logDir ("deploy-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
function Write-DeployLog { param([string]$Level, [string]$Message) $line = "{0:yyyy-MM-dd HH:mm:ss} [{1}] {2}" -f (Get-Date), $Level, $Message; Write-Host $line; Add-Content -LiteralPath $log -Value $line }

try {
    if (-not $PackagePath) {
        if (-not $PackageUrl -or $PackageUrl -notmatch '^https://') { Write-DeployLog FAIL 'need -PackageUrl (https) or -PackagePath'; exit 3 }
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $PackagePath = Join-Path $env:TEMP ("de-techconsole-{0}.zip" -f ([guid]::NewGuid()))
        Write-DeployLog STEP "downloading $PackageUrl"
        Invoke-WebRequest -Uri $PackageUrl -OutFile $PackagePath -UseBasicParsing
    }
    $hash = (Get-FileHash -LiteralPath $PackagePath -Algorithm SHA256).Hash
    if ($hash -ne $Sha256.ToUpperInvariant()) { Write-DeployLog FAIL "sha256 mismatch: got $hash, expected $($Sha256.ToUpperInvariant()); package refused"; exit 3 }
    Write-DeployLog PASS "package sha256 verified ($hash)"

    $stage = Join-Path $env:TEMP ("de-techconsole-stage-{0}" -f ([guid]::NewGuid()))
    Expand-Archive -LiteralPath $PackagePath -DestinationPath $stage -Force
    $winRoot = @(Get-ChildItem -LiteralPath $stage -Recurse -Filter 'DETechConsole.ps1' | Select-Object -First 1)
    if (-not $winRoot.Count) { Write-DeployLog FAIL 'package does not contain console\DETechConsole.ps1'; exit 3 }
    $pkgWindows = Split-Path -Parent (Split-Path -Parent $winRoot[0].FullName)
    $verifier = Join-Path $pkgWindows 'packaging\Sign-DETechConsole.ps1'
    if (Test-Path -LiteralPath (Join-Path $pkgWindows 'integrity.json')) {
        & $verifier -Verify -Root $pkgWindows -RequireSignature:$RequireSignature
        if ($LASTEXITCODE -ne 0) { Write-DeployLog FAIL 'integrity or signature verification failed; package refused'; exit 3 }
    } elseif ($RequireSignature) { Write-DeployLog FAIL 'package has no integrity.json and -RequireSignature was given; refused'; exit 3 }
    else { Write-DeployLog WARN 'package has no integrity.json (unsigned development build)' }

    if ($PSCmdlet.ShouldProcess($InstallDir, 'install DE Tech Tool')) {
        $backup = "$InstallDir.previous"
        if (Test-Path -LiteralPath $backup) { Remove-Item -LiteralPath $backup -Recurse -Force }
        if (Test-Path -LiteralPath $InstallDir) { Move-Item -LiteralPath $InstallDir -Destination $backup }
        New-Item -ItemType Directory -Path (Split-Path -Parent $InstallDir) -Force | Out-Null
        Move-Item -LiteralPath $pkgWindows -Destination $InstallDir
        Write-DeployLog PASS "installed to $InstallDir (previous copy kept at $backup)"
    }
    Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    if ($PackageUrl) { Remove-Item -LiteralPath $PackagePath -Force -ErrorAction SilentlyContinue }

    if (-not $Client) { exit 0 }
    $console = Join-Path $InstallDir 'console\DETechConsole.ps1'
    # a child process with -File: splatting '-Headless' strings to an in-process script binds them by position (to -Page)
    $argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $console, '-Headless', '-Client', $Client, '-Mode', $Mode)
    if ($Bundle) { $argList += @('-Bundle', $Bundle) }
    if (@($Solution | Where-Object { $_ }).Count) { $argList += @('-Solution', (($Solution | Where-Object { $_ }) -join ',')) }
    if ($Apply) { $argList += '-Apply' }
    Write-DeployLog STEP ("running console headless: client {0}, mode {1}, {2}" -f $Client, $Mode, $(if ($Apply) { 'apply' } else { 'audit only' }))
    $shell = Join-Path $PSHOME $(if ($PSVersionTable.PSEdition -eq 'Core') { 'pwsh.exe' } else { 'powershell.exe' }); if (-not (Test-Path -LiteralPath $shell)) { $shell = 'powershell.exe' }
    if ($PSCmdlet.ShouldProcess($console, ($argList -join ' '))) { & $shell @argList; $code = $LASTEXITCODE; Write-DeployLog INFO "console exit $code"; exit $code }
    exit 0
} catch {
    Write-DeployLog FAIL $_.Exception.Message
    exit 3
}
