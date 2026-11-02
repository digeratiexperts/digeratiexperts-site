# DE.AgentInstall: install, upgrade and uninstall of the DE Tech Agent, each signature-checked (move 72).
#
# Nothing is installed from a package that has not been verified first (AGENT-THREAT-MODEL.md T3, D6):
#   - the package manifest (agent-manifest.json) must match a SHA-256 the caller holds from the signed release record
#     (-ExpectedManifestSha256, always required): the anchor that makes the manifest mean something;
#   - every file in the package must be listed, present and exactly the listed hash (an extra file is refused), and a path
#     that escapes the package is refused;
#   - every code file (.ps1 .psm1 .exe .dll) must carry a valid Authenticode signature. An unsigned package is refused
#     unless -AllowUnsigned (an explicit rehearsal switch); a signature that is present but not valid is never excused;
#   - an UPGRADE must be strictly newer, is self-tested on the staged copy BEFORE the service is touched, and is rolled back
#     if the new version is not healthy; the previous version is kept for one release;
#   - UNINSTALL removes the service and the program but keeps the agent's state unless told to purge it.
# The service operations go through a controller object so the logic is testable without installing a service; the default
# controller uses the Windows service manager. This module has no network access and runs no job.

$script:ServiceName = 'DETechAgent'
$script:CodeExtensions = @('.ps1', '.psm1', '.exe', '.dll')

function Get-DEFileHashHex {
    param([string]$Path)
    $sha = [Security.Cryptography.SHA256]::Create(); $fs = [IO.File]::OpenRead($Path)
    try { return (($sha.ComputeHash($fs) | ForEach-Object { $_.ToString('x2') }) -join '') } finally { $fs.Dispose(); $sha.Dispose() }
}

function New-DEAgentServiceController {
    <# The real service operations, by the Windows service manager. Tests pass their own object with the same members. #>
    return [pscustomobject]@{
        Exists    = { param($name) [bool](Get-Service -Name $name -ErrorAction SilentlyContinue) }
        Create    = { param($name, $binaryPath) New-Service -Name $name -BinaryPathName $binaryPath -DisplayName 'DE Tech Agent' -StartupType Automatic -Description 'DE Tech Agent (outbound-only management agent)' | Out-Null }
        Start     = { param($name) Start-Service -Name $name }
        Stop      = { param($name) Stop-Service -Name $name -Force -ErrorAction SilentlyContinue }
        Delete    = { param($name) & sc.exe delete $name | Out-Null }
        IsRunning = { param($name) ((Get-Service -Name $name -ErrorAction SilentlyContinue).Status -eq 'Running') }
    }
}

function Get-DEAuthenticodeStatus {
    <# The default signature check: the Authenticode status of one file (Valid, NotSigned, HashMismatch, UnknownError ...). #>
    param([string]$Path)
    try { return "$((Get-AuthenticodeSignature -LiteralPath $Path).Status)" } catch { return 'UnknownError' }
}

function Test-DEAgentPackage {
    <# Verifies a package directory. Returns Ok, Code, Why, Version and Host (the service executable, relative). Codes: manifest_mismatch, manifest_invalid, unsafe_path, file_missing, file_changed, file_unlisted, unsigned, bad_signature. #>
    param(
        [Parameter(Mandatory = $true)][string]$PackageDir, [Parameter(Mandatory = $true)][string]$ExpectedManifestSha256,
        [scriptblock]$SignatureCheck = { param($p) Get-DEAuthenticodeStatus -Path $p }, [switch]$AllowUnsigned
    )
    $r = { param($ok, $code, $why, $ver, $hostExe) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why; Version = $ver; Host = $hostExe } }
    $manifestPath = Join-Path $PackageDir 'agent-manifest.json'
    if (-not (Test-Path -LiteralPath $manifestPath)) { return (& $r $false 'manifest_invalid' 'the package has no agent-manifest.json' $null $null) }
    if ((Get-DEFileHashHex -Path $manifestPath) -cne "$ExpectedManifestSha256".ToLowerInvariant()) { return (& $r $false 'manifest_mismatch' 'the manifest is not the one the signed release record names' $null $null) }
    $m = $null
    try { $m = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return (& $r $false 'manifest_invalid' 'the manifest is not valid JSON' $null $null) }
    $ver = [version]'0.0'
    if ("$($m.schema)" -ne 'de.techagent.package/v1' -or -not [version]::TryParse("$($m.version)", [ref]$ver) -or -not $m.host -or @($m.files).Count -eq 0) { return (& $r $false 'manifest_invalid' 'the manifest is not a de.techagent.package/v1 with a version, a host and files' $null $null) }
    $root = [IO.Path]::GetFullPath($PackageDir).TrimEnd('\') + '\'
    $listed = New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($f in @($m.files)) {
        $rel = "$($f.path)"
        $full = $null
        if ($rel -notmatch '^[\\/]|^[A-Za-z]:|(^|[\\/])\.\.([\\/]|$)|[<>|"*?]') { try { $full = [IO.Path]::GetFullPath((Join-Path $PackageDir $rel)) } catch { $full = $null } }
        if (-not $full -or -not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { return (& $r $false 'unsafe_path' "'$rel' leaves the package" $null $null) }
        [void]$listed.Add($full)
        if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { return (& $r $false 'file_missing' "'$rel' is listed but not in the package" $null $null) }
        if ((Get-DEFileHashHex -Path $full) -cne "$($f.sha256)".ToLowerInvariant()) { return (& $r $false 'file_changed' "'$rel' is not the file the manifest lists" $null $null) }
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $PackageDir -Recurse -File)) {
        if ($file.FullName -ieq [IO.Path]::GetFullPath($manifestPath)) { continue }
        if (-not $listed.Contains($file.FullName)) { return (& $r $false 'file_unlisted' "'$($file.Name)' is in the package but not in the manifest" $null $null) }
    }
    foreach ($f in @($m.files)) {
        $full = [IO.Path]::GetFullPath((Join-Path $PackageDir "$($f.path)"))
        if ($script:CodeExtensions -notcontains [IO.Path]::GetExtension($full).ToLowerInvariant()) { continue }
        $status = "$(& $SignatureCheck $full)"
        if ($status -eq 'Valid') { continue }
        if ($status -eq 'NotSigned') { if ($AllowUnsigned) { continue }; return (& $r $false 'unsigned' "'$($f.path)' is not signed" $null $null) }
        return (& $r $false 'bad_signature' "'$($f.path)' has a signature that is not valid ($status)" $null $null)
    }
    if ("$($m.host)" -notin @($m.files | ForEach-Object { "$($_.path)" })) { return (& $r $false 'manifest_invalid' 'the host executable is not one of the package files' $null $null) }
    return (& $r $true '' 'the package verified' $ver "$($m.host)")
}

function Assert-DEInstallDir {
    param([string]$InstallDir)
    $full = [IO.Path]::GetFullPath($InstallDir)
    if (-not [IO.Path]::IsPathRooted($InstallDir) -or $InstallDir -match '(^|[\\/])\.\.([\\/]|$)' -or $null -eq [IO.Path]::GetDirectoryName($full.TrimEnd('\')) -or [IO.Path]::GetFileName($full.TrimEnd('\')).Length -lt 3) { throw "the install directory '$InstallDir' is not a safe, specific absolute path" }
}

function Get-DEInstalledAgentVersion {
    <# The installed version, from the manifest copied into the install directory, or $null. #>
    param([Parameter(Mandatory = $true)][string]$InstallDir)
    $p = Join-Path $InstallDir 'agent-manifest.json'
    if (-not (Test-Path -LiteralPath $p)) { return $null }
    try { return [version]"$((Get-Content -LiteralPath $p -Raw -Encoding UTF8 | ConvertFrom-Json).version)" } catch { return $null }
}

function Wait-DEAgentHealthy {
    param($Controller, [int]$Attempts, [int]$DelayMs)
    for ($i = 0; $i -lt $Attempts; $i++) { if (& $Controller.IsRunning $script:ServiceName) { return $true }; if ($DelayMs) { Start-Sleep -Milliseconds $DelayMs } }
    return [bool](& $Controller.IsRunning $script:ServiceName)
}

function Install-DEAgent {
    <# First install. Refuses an existing install (use Update-DEAgent), verifies the package, copies it, creates the service and starts it; if it does not come up healthy it is removed again. #>
    param(
        [Parameter(Mandatory = $true)][string]$PackageDir, [Parameter(Mandatory = $true)][string]$InstallDir, [Parameter(Mandatory = $true)][string]$ExpectedManifestSha256,
        $Controller = (New-DEAgentServiceController), [scriptblock]$SignatureCheck = { param($p) Get-DEAuthenticodeStatus -Path $p }, [switch]$AllowUnsigned, [int]$HealthAttempts = 20, [int]$HealthDelayMs = 500
    )
    $r = { param($ok, $code, $why, $ver) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why; Version = $ver } }
    Assert-DEInstallDir -InstallDir $InstallDir
    if ((Test-Path -LiteralPath $InstallDir) -and @(Get-ChildItem -LiteralPath $InstallDir -Force).Count) { return (& $r $false 'already_installed' 'the install directory is not empty: use Update-DEAgent' $null) }
    if (& $Controller.Exists $script:ServiceName) { return (& $r $false 'already_installed' 'the service already exists: use Update-DEAgent' $null) }
    $v = Test-DEAgentPackage -PackageDir $PackageDir -ExpectedManifestSha256 $ExpectedManifestSha256 -SignatureCheck $SignatureCheck -AllowUnsigned:$AllowUnsigned
    if (-not $v.Ok) { return (& $r $false $v.Code $v.Why $null) }
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path (Join-Path $PackageDir '*') -Destination $InstallDir -Recurse -Force
    & $Controller.Create $script:ServiceName (Join-Path $InstallDir $v.Host)
    & $Controller.Start $script:ServiceName
    if (-not (Wait-DEAgentHealthy -Controller $Controller -Attempts $HealthAttempts -DelayMs $HealthDelayMs)) {
        & $Controller.Stop $script:ServiceName; & $Controller.Delete $script:ServiceName
        Remove-Item -LiteralPath $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
        return (& $r $false 'unhealthy' 'the service did not come up; the install was removed' $null)
    }
    return (& $r $true 'installed' 'installed and running' $v.Version)
}

function Update-DEAgent {
    <# Upgrade: verified, strictly newer, self-tested on a staged copy before the service is touched, rolled back if the new version is not healthy. #>
    param(
        [Parameter(Mandatory = $true)][string]$PackageDir, [Parameter(Mandatory = $true)][string]$InstallDir, [Parameter(Mandatory = $true)][string]$ExpectedManifestSha256,
        $Controller = (New-DEAgentServiceController), [scriptblock]$SignatureCheck = { param($p) Get-DEAuthenticodeStatus -Path $p }, [switch]$AllowUnsigned,
        [scriptblock]$SelfTest = { param($dir) $true }, [int]$HealthAttempts = 20, [int]$HealthDelayMs = 500
    )
    $r = { param($ok, $code, $why, $ver) [pscustomobject]@{ Ok = $ok; Code = $code; Why = $why; Version = $ver } }
    Assert-DEInstallDir -InstallDir $InstallDir
    $current = Get-DEInstalledAgentVersion -InstallDir $InstallDir
    if ($null -eq $current) { return (& $r $false 'not_installed' 'there is no installed agent to upgrade: use Install-DEAgent' $null) }
    $v = Test-DEAgentPackage -PackageDir $PackageDir -ExpectedManifestSha256 $ExpectedManifestSha256 -SignatureCheck $SignatureCheck -AllowUnsigned:$AllowUnsigned
    if (-not $v.Ok) { return (& $r $false $v.Code $v.Why $current) }
    if ($v.Version -le $current) { return (& $r $false 'not_newer' "version $($v.Version) is not newer than the installed $current" $current) }
    $staged = "$InstallDir.new"; $previous = "$InstallDir.previous"
    if (Test-Path -LiteralPath $staged) { Remove-Item -LiteralPath $staged -Recurse -Force }
    New-Item -ItemType Directory -Path $staged -Force | Out-Null
    Copy-Item -Path (Join-Path $PackageDir '*') -Destination $staged -Recurse -Force
    $ok = $false
    try { $ok = [bool](& $SelfTest $staged) } catch { $ok = $false }
    if (-not $ok) { Remove-Item -LiteralPath $staged -Recurse -Force -ErrorAction SilentlyContinue; return (& $r $false 'self_test_failed' 'the new version failed its self-test; nothing was changed' $current) }
    & $Controller.Stop $script:ServiceName
    if (Test-Path -LiteralPath $previous) { Remove-Item -LiteralPath $previous -Recurse -Force }
    Move-Item -LiteralPath $InstallDir -Destination $previous
    Move-Item -LiteralPath $staged -Destination $InstallDir
    & $Controller.Start $script:ServiceName
    if (-not (Wait-DEAgentHealthy -Controller $Controller -Attempts $HealthAttempts -DelayMs $HealthDelayMs)) {
        & $Controller.Stop $script:ServiceName
        $failed = "$InstallDir.failed"; if (Test-Path -LiteralPath $failed) { Remove-Item -LiteralPath $failed -Recurse -Force }
        Move-Item -LiteralPath $InstallDir -Destination $failed
        Move-Item -LiteralPath $previous -Destination $InstallDir
        & $Controller.Start $script:ServiceName
        return (& $r $false 'unhealthy' "version $($v.Version) did not come up; rolled back to $current" $current)
    }
    return (& $r $true 'upgraded' "upgraded from $current to $($v.Version); the previous version is kept for one release" $v.Version)
}

function Uninstall-DEAgent {
    <# Removes the service and the program. The agent's state is kept unless -PurgeState (which needs -StateRoot). Tolerates a missing service. #>
    param([Parameter(Mandatory = $true)][string]$InstallDir, $Controller = (New-DEAgentServiceController), [string]$StateRoot, [switch]$PurgeState)
    Assert-DEInstallDir -InstallDir $InstallDir
    if ($PurgeState) { if (-not $StateRoot) { throw '-PurgeState needs -StateRoot' }; Assert-DEInstallDir -InstallDir $StateRoot }
    if (& $Controller.Exists $script:ServiceName) { & $Controller.Stop $script:ServiceName; & $Controller.Delete $script:ServiceName }
    foreach ($d in @($InstallDir, "$InstallDir.new", "$InstallDir.previous", "$InstallDir.failed")) { if (Test-Path -LiteralPath $d) { Remove-Item -LiteralPath $d -Recurse -Force } }
    $purged = $false
    if ($PurgeState -and (Test-Path -LiteralPath $StateRoot)) { Remove-Item -LiteralPath $StateRoot -Recurse -Force; $purged = $true }
    return [pscustomobject]@{ Ok = $true; Code = 'uninstalled'; StateKept = (-not $purged) }
}

Export-ModuleMember -Function New-DEAgentServiceController, Test-DEAgentPackage, Get-DEInstalledAgentVersion, Install-DEAgent, Update-DEAgent, Uninstall-DEAgent
