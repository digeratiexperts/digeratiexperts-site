#Requires -Version 5.1
<#
    Disposable Windows CI only. Builds an older synthetic full payload, then
    exercises the actual setup executables and native Windows ACLs. Neither
    payload is a signed release or evidence of a real DE laptop acceptance.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$SetupPath,
    [Parameter(Mandatory = $true)][string]$PayloadDir,
    [Parameter(Mandatory = $true)][string]$CompilerPath,
    [Parameter(Mandatory = $true)][string]$OutDir
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0
if ($env:GITHUB_ACTIONS -ne 'true' -or -not $env:RUNNER_TEMP) {
    throw 'This destructive installer regression is restricted to a disposable GitHub Actions runner.'
}
foreach ($file in @($SetupPath, $CompilerPath)) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Required file missing: $file" }
}
$install = Join-Path ([Environment]::GetFolderPath('ProgramFiles')) 'Digerati Experts\DE Tech Tool'
$registration = 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{EB058878-62D7-4AD0-B4E1-61F731EB7003}_is1'
if ((Test-Path -LiteralPath $install) -or (Test-Path -LiteralPath $registration)) {
    throw 'Runner is not clean; refusing to replace an existing DE Tech Tool installation.'
}
$version = [version](Get-Content (Join-Path $PayloadDir 'windows\console\VERSION') -Raw).Trim()
if ($version.Build -gt 0) { $older = '{0}.{1}.{2}' -f $version.Major, $version.Minor, ($version.Build - 1) }
elseif ($version.Minor -gt 0) { $older = '{0}.{1}.65534' -f $version.Major, ($version.Minor - 1) }
elseif ($version.Major -gt 0) { $older = '{0}.65534.65534' -f ($version.Major - 1) }
else { throw 'Need a positive product version for an actual older-version setup.' }

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}
function Invoke-Setup {
    param([string]$File, [string]$Name, [switch]$Refused)
    # Deliberately no /DIR override: validate the real protected Program Files path.
    $log = Join-Path $OutDir ($Name + '.log')
    $p = Start-Process -FilePath $File -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', ('/LOG="' + $log + '"')) -Wait -PassThru
    if ($Refused) {
        Assert-True ($p.ExitCode -ne 0) 'Actual older-version installer was accepted over a newer installation.'
        Assert-True (Select-String -LiteralPath $log -SimpleMatch 'REFUSED: newer DE Tech Tool version already installed' -Quiet) 'Downgrade failed for an unexpected reason.'
    } else { Assert-True ($p.ExitCode -eq 0) ("$Name exit $($p.ExitCode)") }
}
function Assert-ProtectedPath {
    param([string]$Path)
    $acl = Get-Acl -LiteralPath $Path
    $unprivileged = @('S-1-1-0', 'S-1-5-11', 'S-1-5-32-545', 'S-1-5-32-546')
    $writeMask = [Security.AccessControl.FileSystemRights]::Write -bor
        [Security.AccessControl.FileSystemRights]::Delete -bor
        [Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles -bor
        [Security.AccessControl.FileSystemRights]::ChangePermissions -bor
        [Security.AccessControl.FileSystemRights]::TakeOwnership
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -in $unprivileged) {
            Assert-True (([int]$rule.FileSystemRights -band [int]$writeMask) -eq 0) ("Unprivileged write grant on $Path to $($rule.IdentityReference.Value): $($rule.FileSystemRights)")
        }
    }
    return [ordered]@{ path = $Path; sddl = $acl.Sddl; broadUnprivilegedWrite = $false }
}
function Get-PayloadFingerprint {
    param([string]$Root)
    $rows = @(Get-ChildItem -LiteralPath $Root -Recurse -File | Sort-Object FullName | ForEach-Object {
        '{0} {1}' -f $_.FullName.Substring($Root.Length), (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    })
    return ($rows -join "`n")
}

$oldRoot = Join-Path $env:RUNNER_TEMP 'de-installer-older-payload'
Assert-True (-not (Test-Path -LiteralPath $oldRoot)) 'Older-payload scratch path is not empty.'
Copy-Item -LiteralPath $PayloadDir -Destination $oldRoot -Recurse
Set-Content -LiteralPath (Join-Path $oldRoot 'windows\console\VERSION') -Value $older -Encoding ASCII
$buildPath = Join-Path $oldRoot 'windows\console\BUILD.json'
if (Test-Path -LiteralPath $buildPath) {
    $build = Get-Content -LiteralPath $buildPath -Raw | ConvertFrom-Json
    $build.version = $older
    $build | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $buildPath -Encoding UTF8
}
$obsoleteRelative = 'windows\console\obsolete-ci-control.ps1'
Set-Content -LiteralPath (Join-Path $oldRoot $obsoleteRelative) -Value '# EXAMPLE obsolete packaged code; never executed' -Encoding ASCII
$signer = Join-Path $PSScriptRoot '..\packaging\Sign-DETechConsole.ps1'
& $signer -Root (Join-Path $oldRoot 'windows') -SkipSigning
Assert-True ($LASTEXITCODE -eq 0) 'Could not rebuild the older unsigned integrity manifest.'
$oldOut = Join-Path $OutDir 'older-test-build'
New-Item -ItemType Directory -Path $oldOut | Out-Null
$recipe = Join-Path $PSScriptRoot '..\packaging\DETechTool.iss'
& $CompilerPath "/DPayloadDir=$oldRoot" "/DProductVersion=$older" "/DOutputPath=$oldOut" $recipe
Assert-True ($LASTEXITCODE -eq 0) 'Could not compile the actual older test installer.'
$oldSetup = @(Get-ChildItem -LiteralPath $oldOut -Filter '*.exe')
Assert-True ($oldSetup.Count -eq 1) 'Expected one older setup executable.'

$userRoot = [Environment]::GetFolderPath('LocalApplicationData')
$userData = Join-Path $userRoot ('DE\InstallerCI-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $userData -Force | Out-Null
$retained = Join-Path $userData 'existing-evidence.txt'
[IO.File]::WriteAllText($retained, 'EXAMPLE retained technician evidence')
$evidenceHash = (Get-FileHash -LiteralPath $retained -Algorithm SHA256).Hash
$code = Join-Path $install 'msp-ai-kit'
$console = Join-Path $code 'windows\console\DETechConsole.ps1'
$results = [ordered]@{ scope = 'Unsigned synthetic version lifecycle on disposable Windows CI'; previousVersion = $older; currentVersion = "$version"; checks = @(); acls = @() }
$installed = $false
try {
    Invoke-Setup -File $oldSetup[0].FullName -Name 'install-older'
    $installed = $true
    Assert-True ((Get-ItemProperty -LiteralPath $registration).DisplayVersion -eq $older) 'Older setup version registration mismatch.'
    Assert-True (Test-Path -LiteralPath (Join-Path $code $obsoleteRelative)) 'Older payload fixture was not installed.'
    Assert-True ((Get-Content (Join-Path $code 'windows\console\VERSION') -Raw).Trim() -eq $older) 'Older payload was not the installed payload.'
    $results.checks += 'actual older version installed'

    Invoke-Setup -File $SetupPath -Name 'upgrade-current'
    Assert-True ((Get-ItemProperty -LiteralPath $registration).DisplayVersion -eq "$version") 'Upgrade did not register the current version.'
    Assert-True ((Get-Content (Join-Path $code 'windows\console\VERSION') -Raw).Trim() -eq "$version") 'Upgrade left the old payload version.'
    Assert-True (-not (Test-Path -LiteralPath (Join-Path $code $obsoleteRelative))) 'Upgrade retained obsolete executable code.'
    Assert-True ((Get-FileHash -LiteralPath $retained -Algorithm SHA256).Hash -eq $evidenceHash) 'Upgrade changed external evidence.'
    $results.checks += 'upgrade removes obsolete code and preserves external data'

    $fingerprint = Get-PayloadFingerprint -Root $code
    Invoke-Setup -File $oldSetup[0].FullName -Name 'actual-downgrade-refusal' -Refused
    Assert-True ((Get-PayloadFingerprint -Root $code) -eq $fingerprint) 'Refused downgrade changed installed payload bytes.'
    Assert-True ((Get-ItemProperty -LiteralPath $registration).DisplayVersion -eq "$version") 'Refused downgrade changed registration.'
    $results.checks += 'actual older setup refused without byte or registration changes'
    Invoke-Setup -File $SetupPath -Name 'same-version-reinstall'
    Assert-True ((Get-PayloadFingerprint -Root $code) -eq $fingerprint) 'Same-version reinstall changed payload bytes.'
    $results.checks += 'same version reinstall is byte stable'

    foreach ($path in @($install, $code, $console)) { $results.acls += Assert-ProtectedPath -Path $path }
    Assert-True ($userData.StartsWith($userRoot + '\', [StringComparison]::OrdinalIgnoreCase)) 'Explicit per-user data path escaped LocalAppData.'
    Assert-True (-not $userData.StartsWith($install, [StringComparison]::OrdinalIgnoreCase)) 'Mutable data is inside installed code.'
    $results.acls += Assert-ProtectedPath -Path $userData
    $results.checks += 'default Program Files install and explicit per-user data override have no broad unprivileged write grants'

    $launcher = Join-Path $code 'windows\DE-TechTool.exe'
    $probe = Start-Process -FilePath $launcher -ArgumentList '--check' -Wait -PassThru
    Assert-True ($probe.ExitCode -eq 0) 'Installed native launcher path check failed.'
    $probe = Start-Process -FilePath $launcher -ArgumentList '--invalid-option' -Wait -PassThru
    Assert-True ($probe.ExitCode -eq 2) 'Native launcher accepted an unknown option.'
    $integrity = Get-Content (Join-Path $code 'windows\integrity.json') -Raw | ConvertFrom-Json
    Assert-True (@($integrity.files | Where-Object path -eq 'DE-TechTool.exe').Count -eq 1) 'Launcher missing from integrity manifest.'
    Assert-True (Test-Path -LiteralPath (Join-Path $code 'scripts\build.mjs')) 'Parent kit dependency missing.'
    & $console -Headless -Client alamo -Mode audit -DataDir $userData -ResultFile (Join-Path $OutDir 'installed-audit.json')
    Assert-True ($LASTEXITCODE -in @(0, 1, 2)) 'Installed audit crashed.'
    Assert-True (Test-Path -LiteralPath (Join-Path $OutDir 'installed-audit.json')) 'Installed audit result missing.'
    Assert-True (@(Get-ChildItem (Join-Path $userData 'evidence') -Recurse -Filter '*.zip').Count -gt 0) 'Installed audit evidence missing.'
    $results.checks += 'installed launcher and headless audit passed'

    # Preserve the established protected machine-state boundary. The generic
    # per-user statement in #620 does not authorize moving trusted elevated
    # exception/profile state into an ordinary user-writable directory.
    Import-Module (Join-Path $code 'windows\console\modules\DE.Core\DE.Core.psm1') -Force -DisableNameChecking
    $dirs = Initialize-DEConsole -Root (Join-Path $code 'windows\console') -Mode Audit
    Assert-True ($dirs.Base -eq (Join-Path $env:ProgramData 'DE\TechConsole')) 'Established default machine-data boundary changed.'
    $results.acls += Assert-ProtectedPath -Path $dirs.Base
    $results.defaultDataModel = 'Protected machine ProgramData; per-user DataDir is explicit. Requirement clarification remains open.'
    $machineMarker = Join-Path $dirs.Base 'installer-ci-retain.txt'
    [IO.File]::WriteAllText($machineMarker, 'EXAMPLE machine evidence retained through uninstall')
    $uninstall = Start-Process -FilePath (Join-Path $install 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -Wait -PassThru
    Assert-True ($uninstall.ExitCode -eq 0) 'Uninstall failed.'
    $installed = $false
    Assert-True (-not (Test-Path -LiteralPath $console)) 'Uninstall left console code behind.'
    Assert-True (-not (Test-Path -LiteralPath $registration)) 'Uninstall left version registration behind.'
    Assert-True ((Get-FileHash -LiteralPath $retained -Algorithm SHA256).Hash -eq $evidenceHash) 'Uninstall changed per-user evidence.'
    Assert-True (Test-Path -LiteralPath $machineMarker) 'Uninstall removed protected machine evidence.'
    $results.checks += 'uninstall removes code and registration while preserving both external data locations'
    $results.passed = $true
} catch {
    $results.passed = $false
    $results.failure = $_.Exception.Message
    throw
} finally {
    $results | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir 'installer-lifecycle.json') -Encoding UTF8
    if ($installed -and (Test-Path -LiteralPath (Join-Path $install 'unins000.exe'))) {
        $null = Start-Process -FilePath (Join-Path $install 'unins000.exe') -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART') -Wait -PassThru
    }
}
Write-Host ($results | ConvertTo-Json -Depth 10)
exit 0
