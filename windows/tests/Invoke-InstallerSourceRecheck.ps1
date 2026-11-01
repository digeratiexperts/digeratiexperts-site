<#
.SYNOPSIS
    Re-check every installer source against its recorded trust record (R6, rate-limited).

.DESCRIPTION
    Move 42 of the 104-move tracker (#760). The automated re-check behind R6 of
    INSTALLER-TRUST-POLICY.md: every installer source is re-fetched from its official
    location and compared with the trust record in console\catalog\packages.json. A
    difference is a FINDING, never a silent update (R7).

    Findings per source:
        ok              the file matches the recorded hash
        unpinned        no hash recorded yet (move 41 pins these; a finding until then)
        hash-mismatch   the file does not match the recorded hash - refuse and raise (R3/R7)
        download-failed the source could not be fetched - a finding, not a pass
        not-checkable   winget / local sources have nothing to fetch (recorded, not verified)

    Rate limiting: sources are fetched one at a time with -DelaySeconds between downloads
    (default 30) so a vendor's CDN is never hammered. The CI workflow runs this weekly.

    Exit codes: 0 all sources match the record, 1 findings raised, 2 the run could not complete.

.PARAMETER DelaySeconds
    Pause between downloads. Default 30. CI passes 30; tests pass 0.

.PARAMETER Offline
    Validate the trust-record shapes only; fetch nothing. Used by the test suite.

.PARAMETER CatalogPath
    Which packages.json to read. Defaults to the one next to this script's tree.

.EXAMPLE
    powershell -File windows/tests/Invoke-InstallerSourceRecheck.ps1

.EXAMPLE
    powershell -File windows/tests/Invoke-InstallerSourceRecheck.ps1 -Offline
#>
[CmdletBinding()]
param(
    [int]$DelaySeconds = 30,
    [switch]$Offline,
    [string]$CatalogPath = '',
    [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')

function Get-DERecheckSources {
    <# The re-check plan: one row per installer source with its trust record. #>
    param([Parameter(Mandatory = $true)][string]$Catalog)
    $pkgs = @((Get-Content -LiteralPath $Catalog -Raw -Encoding UTF8 | ConvertFrom-Json).packages)
    $rows = @()
    foreach ($p in $pkgs) {
        $src = $p.source
        $rows += [pscustomobject]@{
            Id            = $p.id
            Name          = $p.name
            Type          = "$($src.type)"
            Location      = $(switch ("$($src.type)") { 'url' { "$($src.url)" } 'local' { "$($src.localPath)" } 'winget' { "$($src.id)" } default { '' } })
            Sha256        = $src.sha256
            Sha256Verified = [bool]$src.sha256Verified
            Sha256From    = "$($src.sha256From)"
        }
    }
    return $rows
}

function Compare-DESourceFile {
    <# One source's file against its record. Returns @{ id; finding; detail }. Never throws. #>
    param(
        [Parameter(Mandatory = $true)]$Source,
        [string]$ActualSha256 = '',
        [string]$Failure = ''
    )
    if ($Failure) { return @{ id = $Source.Id; finding = 'download-failed'; detail = $Failure } }
    if ($Source.Type -eq 'winget' -or $Source.Type -eq 'local') { return @{ id = $Source.Id; finding = 'not-checkable'; detail = "$($Source.Type) source has nothing to re-fetch; checked at install time instead" } }
    if (-not $ActualSha256) { return @{ id = $Source.Id; finding = 'not-checkable'; detail = 'nothing fetched in this run (offline)' } }
    if (-not $Source.Sha256) { return @{ id = $Source.Id; finding = 'unpinned'; detail = "no hash recorded ($($Source.Sha256From))" } }
    if ($ActualSha256.ToLowerInvariant() -eq "$($Source.Sha256)".ToLowerInvariant()) {
        return @{ id = $Source.Id; finding = 'ok'; detail = "sha256 matches the record" }
    }
    return @{ id = $Source.Id; finding = 'hash-mismatch'; detail = "sha256 mismatch for $($Source.Name) (have $ActualSha256, want $($Source.Sha256))" }
}

function Get-DEFileSha256Literal {
    param([Parameter(Mandatory = $true)][string]$Path)
    $fs = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, ([IO.FileShare]::ReadWrite -bor [IO.FileShare]::Delete))
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return (-join ($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') })) } finally { $sha.Dispose(); $fs.Dispose() }
}

function Invoke-DEInstallerSourceRecheck {
    <# Runs the plan. Returns @{ rows; findings; checked }. #>
    param(
        [Parameter(Mandatory = $true)][array]$Sources,
        [int]$DelaySeconds = 30,
        [switch]$Offline,
        [string]$WorkDir = ''
    )
    $rows = @(); $findings = @(); $checked = 0
    foreach ($s in $Sources) {
        if ($Offline -or $s.Type -ne 'url') {
            $r = Compare-DESourceFile -Source $s
            $rows += $r; if ($r.finding -notin @('ok', 'not-checkable')) { $findings += $r }
            continue
        }
        if (-not $WorkDir) { $WorkDir = Join-Path ([IO.Path]::GetTempPath()) ('de-recheck-' + [guid]::NewGuid()) }
        New-Item -ItemType Directory -Path $WorkDir -Force | Out-Null
        $tmp = Join-Path $WorkDir ($s.Id + '.bin')
        $failure = ''
        try {
            try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
            Invoke-WebRequest -Uri $s.Location -OutFile $tmp -UseBasicParsing -UserAgent 'DETechTool-SourceRecheck/1'
            $checked++
            $actual = Get-DEFileSha256Literal -Path $tmp
        } catch {
            $failure = $_.Exception.Message; $actual = ''
        } finally {
            if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
        }
        $r = Compare-DESourceFile -Source $s -ActualSha256 $actual -Failure $failure
        $rows += $r; if ($r.finding -notin @('ok', 'not-checkable')) { $findings += $r }
        if ($DelaySeconds -gt 0) { Start-Sleep -Seconds $DelaySeconds }   # R6: never hammer a vendor CDN
    }
    return @{ rows = $rows; findings = $findings; checked = $checked }
}

# Dot-source guard: tests load the functions without running the re-check.
if ($MyInvocation.InvocationName -eq '.') { return }

function Write-DERecheckLine([string]$Line) { Write-Host $Line; if ($script:OutFile) { Add-Content -LiteralPath $script:OutFile -Value $Line -Encoding UTF8 } }

try {
    if (-not $CatalogPath) {
        $windows = Split-Path -Parent $PSScriptRoot
        $CatalogPath = Join-Path (Join-Path $windows 'console') 'catalog\packages.json'
    }
    $sources = Get-DERecheckSources -Catalog $CatalogPath
    Write-DERecheckLine ('installer source re-check: ' + $sources.Count + ' source(s); ' + $(if ($Offline) { 'offline (shapes only)' } else { 'download, delay ' + $DelaySeconds + 's' }))
    $result = Invoke-DEInstallerSourceRecheck -Sources $sources -DelaySeconds $DelaySeconds -Offline:$Offline
    foreach ($r in $result.rows) { Write-DERecheckLine ('  [' + $r.finding + '] ' + $r.id + ' - ' + $r.detail) }
    Write-DERecheckLine ('checked ' + $result.checked + ' download(s); ' + $result.findings.Count + ' finding(s)')
    if ($result.findings.Count -gt 0) { Write-DERecheckLine 'FINDINGS PRESENT - a difference is a finding, not a silent update (R6/R7).'; exit 1 }
    exit 0
} catch {
    Write-DERecheckLine ('re-check could not complete: ' + $_.Exception.Message)
    exit 2
}
