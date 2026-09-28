#Requires -Version 5.1
<#
.SYNOPSIS
    Identity engine: DE break-glass administrator, BitLocker / OneDrive / Hello
    gates, Entra -> JumpCloud migration through JumpCloud ADMU, Entra leave,
    stale MDM cleanup, post-reboot verification and rollback notes.

.DESCRIPTION
    Every consequential step is an action with gates. The migration itself calls
    the JumpCloud ADMU PowerShell module (Start-Migration) with UpdateHomePath
    off so C:\Users\<SourceUser> is preserved, refuses to run while the source
    user is signed in, and requires a verified break-glass administrator and a
    passing BitLocker gate first. Passwords and recovery keys are runtime-only.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')
$script:BreakGlassName = 'DE-BreakGlass'
$script:NormalAdmin = 'jrpetro'

# ------------------------------------------------------------------ break-glass
function Get-DEBreakGlassState {
    param([string]$Name = $script:BreakGlassName)
    $u = $null; $isAdmin = $false; $hidden = $null
    if ($script:IsWindowsHost) {
        try { $u = Get-LocalUser -Name $Name -ErrorAction Stop } catch { $u = $null }
        if ($u) { try { $isAdmin = [bool](Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction Stop | Where-Object { $_ -and $_.SID.Value -eq $u.SID.Value }) } catch { $r = Invoke-DENative -FilePath 'net.exe' -Arguments @('localgroup', 'Administrators'); $isAdmin = [bool]($r.Output | Where-Object { $_ -and $_.Trim() -ieq $Name }) } }
        $hidden = (Get-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList' -Name $Name)
    }
    $verified = Get-DEState -Path 'identity.breakGlass.verifiedAt'
    return @{
        exists = [bool]$u; enabled = $(if ($u) { [bool]$u.Enabled } else { $false }); administrator = $isAdmin
        passwordRequired = $(if ($u) { [bool]$u.PasswordRequired } else { $false }); passwordNeverExpires = $(if ($u -and $u.PasswordExpires) { $false } elseif ($u) { $true } else { $null })
        hiddenFromLogon = ($hidden -eq 0); localOnly = $(if ($u) { "$($u.PrincipalSource)" -eq 'Local' } else { $false })
        verifiedAt = $verified; verified = [bool]$verified
        normalAdminIsNotBreakGlass = ($Name -ne $script:NormalAdmin)
    }
}

function New-DEBreakGlassAccount {
    <# Creates or repairs DE-BreakGlass: local-only, enabled, Administrators, password required, never expires, hidden from the sign-in tiles. Password is the runtime secret BREAKGLASS_PASSWORD. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([string]$Name = $script:BreakGlassName)
    if ($Name -ieq $script:NormalAdmin) { throw "$($script:NormalAdmin) is the normal JumpCloud-managed DE administrator and must never be the break-glass identity" }
    if (-not (Test-DESecret -Name 'BREAKGLASS_PASSWORD')) { throw 'break-glass password not provided this session (secret BREAKGLASS_PASSWORD)' }
    $plain = Get-DESecretPlain -Name 'BREAKGLASS_PASSWORD'
    if ($plain.Length -lt 16) { $plain = $null; throw 'break-glass password must be at least 16 characters' }
    $secure = ConvertTo-SecureString -String $plain -AsPlainText -Force; $plain = $null
    $state = Get-DEBreakGlassState -Name $Name
    if ($PSCmdlet.ShouldProcess($Name, $(if ($state.exists) { 'repair break-glass account' } else { 'create break-glass account' }))) {
        if (-not $state.exists) { New-LocalUser -Name $Name -Password $secure -Description 'DE local break-glass administrator (independent of JumpCloud and Entra)' -PasswordNeverExpires -AccountNeverExpires -UserMayNotChangePassword | Out-Null }
        else { Set-LocalUser -Name $Name -Password $secure -PasswordNeverExpires $true -UserMayChangePassword $false | Out-Null }
        Enable-LocalUser -Name $Name
        if (-not $state.administrator) { Add-LocalGroupMember -SID 'S-1-5-32-544' -Member $Name -ErrorAction SilentlyContinue }
        Set-DERegistryValue -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon\SpecialAccounts\UserList' -Name $Name -Value 0 -Type DWord
        Set-DEStateValue -Path 'identity.breakGlass.createdAt' -Value (Get-Date).ToString('o')
        Set-DEStateValue -Path 'identity.breakGlass.verifiedAt' -Value $null   # a new password invalidates any earlier verification
    }
    $secure = $null
    return (Get-DEBreakGlassState -Name $Name)
}

function Test-DEBreakGlassLogon {
    <# Verifies the credential against the local SAM (LogonUser) without an interactive session; the technician still performs one real interactive sign-in and confirms it in the console. #>
    param([string]$Name = $script:BreakGlassName)
    if (-not $script:IsWindowsHost) { return @{ ok = $false; detail = 'Windows only' } }
    if (-not (Test-DESecret -Name 'BREAKGLASS_PASSWORD')) { return @{ ok = $false; detail = 'password not in session' } }
    $plain = Get-DESecretPlain -Name 'BREAKGLASS_PASSWORD'
    try {
        if (-not ('DE.Native.Logon' -as [type])) {
            Add-Type -Namespace DE.Native -Name Logon -MemberDefinition @'
[DllImport("advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
public static extern bool LogonUser(string lpszUsername, string lpszDomain, string lpszPassword, int dwLogonType, int dwLogonProvider, out IntPtr phToken);
[DllImport("kernel32.dll", SetLastError = true)]
public static extern bool CloseHandle(IntPtr handle);
'@
        }
        $token = [IntPtr]::Zero
        $ok = [DE.Native.Logon]::LogonUser($Name, '.', $plain, 2, 0, [ref]$token)  # LOGON32_LOGON_INTERACTIVE
        $err = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        if ($token -ne [IntPtr]::Zero) { [DE.Native.Logon]::CloseHandle($token) | Out-Null }
        return @{ ok = [bool]$ok; detail = $(if ($ok) { 'credential accepted by the local security authority' } else { "LogonUser failed (Win32 $err)" }) }
    } catch { return @{ ok = $false; detail = $_.Exception.Message } } finally { $plain = $null }
}
function Confirm-DEBreakGlassVerified {
    <# Records that the technician completed an interactive sign-in as .\DE-BreakGlass (the only proof that counts for the gate). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([string]$Technician = '')
    $cred = Test-DEBreakGlassLogon
    if (-not $cred.ok) { Add-DEEvidence -Step 'identity.breakglass.verify' -Module 'identity' -Before 'unverified' -ActionTaken 'credential check' -Result 'FAIL' -Verification $cred.detail | Out-Null; return $false }
    if ($PSCmdlet.ShouldProcess($script:BreakGlassName, 'mark interactive sign-in verified')) {
        Set-DEStateValue -Path 'identity.breakGlass.verifiedAt' -Value (Get-Date).ToString('o')
        Set-DEStateValue -Path 'identity.breakGlass.verifiedBy' -Value $(if ($Technician) { $Technician } else { "$((Get-DEContext)['technician'])" })
        Add-DEEvidence -Step 'identity.breakglass.verify' -Module 'identity' -Before 'unverified' -ActionTaken 'interactive sign-in confirmed by technician; credential check passed' -Result 'PASS' -Verification $cred.detail | Out-Null
    }
    return $true
}

# ------------------------------------------------------------------ BitLocker gate helpers
function Test-DEBitLockerGate {
    <# OS volume encrypted, protection on, TPM and RecoveryPassword protectors present, protector id matches the independently stored record (id only). #>
    param([string]$ExpectedProtectorId)
    $bl = Get-DEBitLockerState
    $os = $bl.os
    if (-not $os) { return @{ Status = 'BLOCKED'; Detail = 'no BitLocker OS volume information (not Windows, or BitLocker unavailable)' } }
    $issues = @()
    if ($os.status -ne 'FullyEncrypted') { $issues += "OS volume $($os.status) ($($os.encryptionPercentage)%)" }
    if ($os.protection -ne 'On') { $issues += "protection $($os.protection)" }
    if (-not $os.hasTpm) { $issues += 'no TPM protector' }
    if (-not $os.hasRecoveryPassword) { $issues += 'no RecoveryPassword protector' }
    $expected = $ExpectedProtectorId; if (-not $expected) { $expected = Get-DEState -Path 'identity.bitlocker.expectedProtectorId' }
    if (-not $expected) { $issues += 'recovery protector id not yet recorded against the escrow record (enter the id, never the password)' }
    elseif (@($os.recoveryProtectorIds | ForEach-Object { "$_".Trim('{', '}').ToUpperInvariant() }) -notcontains "$expected".Trim('{', '}').ToUpperInvariant()) { $issues += "recovery protector id $expected not present on the volume" }
    if ($issues.Count) { return @{ Status = $(if ($os.status -eq 'FullyEncrypted' -and $os.protection -eq 'On') { 'WARN' } else { 'BLOCKED' }); Detail = ($issues -join '; ') } }
    return @{ Status = 'PASS'; Detail = "OS volume encrypted ($($os.method)), protection on, TPM + recovery protector $expected verified" }
}
function Set-DEBitLockerExpectedProtector {
    <# Records the RecoveryPassword protector ID that the technician verified against the escrow (JumpCloud / Hudu / Entra). Only the ID is stored. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProtectorId)
    if ($ProtectorId -match '\d{6}-\d{6}') { throw 'that looks like a recovery password, not a protector id; only the id is stored' }
    if ($PSCmdlet.ShouldProcess($ProtectorId, 'record verified protector id')) { Set-DEStateValue -Path 'identity.bitlocker.expectedProtectorId' -Value $ProtectorId; Set-DEStateValue -Path 'identity.bitlocker.verifiedAt' -Value (Get-Date).ToString('o') }
}
function Suspend-DEBitLockerForFirmware {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([int]$RebootCount = 1)
    if ($PSCmdlet.ShouldProcess('C:', "Suspend-BitLocker for $RebootCount reboot(s)")) { Suspend-BitLocker -MountPoint 'C:' -RebootCount $RebootCount | Out-Null; Add-DEEvidence -Step 'identity.bitlocker.suspend' -Module 'identity' -Before 'protection on' -ActionTaken "suspended for $RebootCount reboot(s) around firmware work" -Result 'WARN' -Remediation 'Resume-DEBitLocker after the firmware update and verify protection is On.' | Out-Null }
}
function Resume-DEBitLocker { [CmdletBinding(SupportsShouldProcess = $true)] param() if ($PSCmdlet.ShouldProcess('C:', 'Resume-BitLocker')) { Resume-BitLocker -MountPoint 'C:' | Out-Null }; return (Get-DEBitLockerState).osProtectionOn }

# ------------------------------------------------------------------ OneDrive gate
function Test-DEOneDriveGate {
    <#
    OneDrive accounts live in the signed-in user's HKCU, and migration runs with the end user signed out, so HKCU is the
    technician's. The end user's OneDrive is also read from their profile folder ("OneDrive - <tenant>" folders): if
    either shows a business account, the technician must confirm the sync (done while the user was still signed in).
    #>
    $od = Get-DEOneDriveState
    $confirmed = Get-DEState -Path 'identity.onedrive.syncConfirmedAt'
    $src = "$((Get-DEContext)['sourcePrincipal'])"
    $srcFolders = @()
    if ($src) {
        $srcProfile = @(Find-DEProfileForUser -UserName $src | Where-Object { $_ }) | Select-Object -First 1
        if ($srcProfile -and $srcProfile.path -and (Test-Path -LiteralPath $srcProfile.path)) { $srcFolders = @(Get-ChildItem -LiteralPath $srcProfile.path -Directory -Filter 'OneDrive - *' -ErrorAction SilentlyContinue | ForEach-Object { $_.Name }) }
    }
    if ($od.businessAccounts.Count -eq 0 -and -not $srcFolders.Count) { return @{ Status = 'PASS'; Detail = "OneDrive $($od.classification); no business account in this session$(if ($src) { " or in $src's profile" })" } }
    if ($confirmed) { return @{ Status = 'PASS'; Detail = "business OneDrive present; sync confirmed $confirmed" } }
    $detail = "$($od.classification); accounts: $((@(@($od.businessAccounts | ForEach-Object { $_.email }) + $srcFolders) | Where-Object { $_ }) -join ', ')"
    if ($od.businessAccounts.Count -and -not $od.running) { return @{ Status = 'BLOCKED'; Detail = "$detail; client not running, sync state unknown" } }
    if (-not $confirmed) { return @{ Status = 'WARN'; Detail = "$detail; technician must confirm 'Up to date' in the OneDrive client and pause sync before identity changes" } }
    return @{ Status = 'PASS'; Detail = "$detail; sync confirmed $confirmed" }
}
function Confirm-DEOneDriveSynced { [CmdletBinding(SupportsShouldProcess = $true)] param() if ($PSCmdlet.ShouldProcess('OneDrive', 'record sync confirmed and paused')) { Set-DEStateValue -Path 'identity.onedrive.syncConfirmedAt' -Value (Get-Date).ToString('o'); Add-DEEvidence -Step 'identity.onedrive.confirm' -Module 'identity' -Before 'unknown sync' -ActionTaken 'technician confirmed Up to date and paused sync' -Result 'PASS' | Out-Null } }

# ------------------------------------------------------------------ Windows Hello
function Get-DEHelloImpact {
    $id = Get-DEIdentityState
    $impact = @()
    if ($id.hello.pinConfigured) { $impact += 'Windows Hello PIN is tied to the Entra identity and stops working after the device leaves Entra; the user signs in with the new local password first, then re-enrols a PIN' }
    if ($id.dsreg.azureAdPrt) { $impact += 'Entra PRT and SSO tokens are dropped at leave; Office apps will ask for a fresh sign-in' }
    return @{ pinConfigured = $id.hello.pinConfigured; ngcFolderPresent = $id.hello.ngcFolderPresent; impact = $impact }
}
function Clear-DEHelloContainer {
    <# Removes the NGC container so no stale PIN blocks the first local sign-in. Destructive for PIN only; passwords are untouched. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $ngc = Join-Path $env:SystemRoot 'ServiceProfiles\LocalService\AppData\Local\Microsoft\Ngc'
    if (-not (Test-Path -LiteralPath $ngc)) { return 'no NGC container' }
    if ($PSCmdlet.ShouldProcess($ngc, 'take ownership and remove NGC container')) {
        $null = Invoke-DENative -FilePath 'takeown.exe' -Arguments @('/f', $ngc, '/r', '/d', 'y')
        $null = Invoke-DENative -FilePath 'icacls.exe' -Arguments @($ngc, '/grant', 'Administrators:F', '/t')
        Remove-Item -LiteralPath $ngc -Recurse -Force
        return 'NGC container removed; users re-enrol Hello after first sign-in'
    }
}

# ------------------------------------------------------------------ ADMU migration
function Get-DEAdmuState {
    $mod = Get-Module -ListAvailable -Name 'JumpCloud.ADMU' | Sort-Object Version -Descending | Select-Object -First 1
    return @{ installed = [bool]$mod; version = $(if ($mod) { "$($mod.Version)" } else { $null }); reverseAvailable = [bool](Get-Command -Name 'Start-Migration' -ErrorAction SilentlyContinue) }
}
function Install-DEAdmu {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    if ((Get-DEAdmuState).installed) { return 'present' }
    if ($PSCmdlet.ShouldProcess('JumpCloud.ADMU', 'Install-Module from PSGallery')) {
        try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
        if (-not (Get-PackageProvider -Name NuGet -ErrorAction SilentlyContinue)) { Install-PackageProvider -Name NuGet -Force -Scope AllUsers | Out-Null }
        Install-Module -Name 'JumpCloud.ADMU' -Scope AllUsers -Force -AllowClobber
        return "installed $((Get-DEAdmuState).version)"
    }
}
function Test-DEMigrationPreconditions {
    <# The full gate board for Entra -> JumpCloud migration, as one verdict with reasons. #>
    param([Parameter(Mandatory = $true)][string]$SourcePrincipal, [Parameter(Mandatory = $true)][string]$LocalUserName)
    $id = Get-DEIdentityState
    $issues = @(); $warnings = @()
    if ($id.joinType -notin @('entra-joined', 'hybrid-entra-joined', 'entra-registered')) { $warnings += "device is $($id.joinType); ADMU migration targets Entra-joined devices" }
    if ($id.interactiveUser -and $id.interactiveUser -ieq $SourcePrincipal) { $issues += 'source user is signed in; sign out and run from the break-glass or technician session' }
    if (@($id.localUsers | Where-Object { $_ -and $_.name -ieq $LocalUserName }).Count) { $issues += "local account '$LocalUserName' already exists (username collision); pick another name or remove the stale account after confirming it owns no data" }
    $srcCandidates = @(Find-DEProfileForUser -UserName $SourcePrincipal -Profiles $id.profiles | Where-Object { $_ })
    $srcProfile = $srcCandidates | Select-Object -First 1
    if (-not $srcProfile) { $issues += "no profile folder found for $SourcePrincipal" }
    elseif ($srcCandidates.Count -gt 1) { $issues += "several profile folders could belong to $SourcePrincipal ($((@($srcCandidates | ForEach-Object { $_.path })) -join ', ')); confirm the right one by SID before migrating" }
    $dstProfile = @(Find-DEProfileForUser -UserName $LocalUserName -Profiles $id.profiles) | Select-Object -First 1
    if ($dstProfile) { $issues += "a profile folder already exists for '$LocalUserName' ($($dstProfile.path)); SID/profile collision" }
    if ($srcProfile -and $srcProfile.loaded) { $issues += 'source profile is loaded (user still has a session)' }
    $bg = Test-DEGate -Id 'gate.breakglass' -Refresh; if ($bg.Status -notin @('PASS', 'EXCEPTION')) { $issues += "break-glass gate $($bg.Status): $($bg.Detail)" }
    $bl = Test-DEGate -Id 'gate.bitlocker' -Refresh; if ($bl.Status -notin @('PASS', 'EXCEPTION')) { $issues += "BitLocker gate $($bl.Status): $($bl.Detail)" }
    $od = Test-DEGate -Id 'gate.onedrive' -Refresh; if ($od.Status -notin @('PASS', 'EXCEPTION')) { $issues += "OneDrive gate $($od.Status): $($od.Detail)" }
    if (-not (Test-DEIsElevated)) { $issues += 'console is not elevated' }
    if ((Get-DEPendingReboot).pending) { $issues += 'a reboot is already pending; restart first' }
    $admu = Get-DEAdmuState; if (-not $admu.installed) { $warnings += 'JumpCloud.ADMU module not installed yet (the action installs it)' }
    $hello = Get-DEHelloImpact
    return @{ ok = ($issues.Count -eq 0); issues = $issues; warnings = $warnings; sourceProfile = $srcProfile; helloImpact = $hello.impact; joinType = $id.joinType }
}

function Start-DEIdentityMigration {
    <#
    Runs JumpCloud ADMU Start-Migration: AzureAD\Source -> local user, profile preserved (UpdateHomePath false),
    optional Entra leave, no forced reboot here (the console's reboot-resume handles it). Temp password is the
    runtime secret MIGRATION_TEMP_PASSWORD; API key / connect key only if autobind is requested.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$SourcePrincipal,
        [Parameter(Mandatory = $true)][string]$LocalUserName,
        [switch]$LeaveEntra,
        [switch]$AutobindJumpCloudUser,
        [switch]$BindAsAdmin,
        [switch]$UpdateHomePath
    )
    $pre = Test-DEMigrationPreconditions -SourcePrincipal $SourcePrincipal -LocalUserName $LocalUserName
    if (-not $pre.ok) { throw "migration preconditions failed: $($pre.issues -join '; ')" }
    if (-not (Test-DESecret -Name 'MIGRATION_TEMP_PASSWORD')) { throw 'temporary password for the new local account not provided (secret MIGRATION_TEMP_PASSWORD)' }
    if ($AutobindJumpCloudUser -and -not (Test-DESecret -Name 'JC_API_KEY')) { throw 'autobind needs JC_API_KEY' }
    # a planned run changes nothing: no module install, no import, no state, no backup
    if (-not $PSCmdlet.ShouldProcess("$SourcePrincipal -> $LocalUserName", "ADMU Start-Migration (LeaveDomain=$([bool]$LeaveEntra), UpdateHomePath=$([bool]$UpdateHomePath))")) { return @{ planned = $true } }
    $null = Install-DEAdmu
    Import-Module JumpCloud.ADMU -ErrorAction Stop
    $temp = Get-DESecretPlain -Name 'MIGRATION_TEMP_PASSWORD'
    $params = @{ JumpCloudUserName = $LocalUserName; SelectedUserName = $SourcePrincipal; TempPassword = $temp; LeaveDomain = [bool]$LeaveEntra; ForceReboot = $false; UpdateHomePath = [bool]$UpdateHomePath; InstallJCAgent = $false; AutobindJCUser = [bool]$AutobindJumpCloudUser; BindAsAdmin = [bool]$BindAsAdmin; SetDefaultWindowsUser = $true }
    if ($AutobindJumpCloudUser) { $params.JumpCloudAPIKey = Get-DESecretPlain -Name 'JC_API_KEY'; if (Test-DESecret -Name 'JC_ORG_ID') { $params.JumpCloudOrgID = Get-DESecretPlain -Name 'JC_ORG_ID' } }
    # the rollback point is recorded first; no backup, no migration
    $backup = Backup-DERegistryKey -Key 'HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' -Label 'ProfileList-pre-migration'
    if (-not $backup) { $temp = $null; $params = $null; throw 'ProfileList registry backup failed; refusing to migrate without a rollback point' }
    Set-DEStateValue -Path 'identity.migration' -Value @{ source = $SourcePrincipal; target = $LocalUserName; startedAt = (Get-Date).ToString('o'); sourceProfilePath = $pre.sourceProfile.path; profileListBackup = $backup; leaveEntra = [bool]$LeaveEntra; status = 'running' }
    try {
        Write-DELog -Level STEP -Message "ADMU Start-Migration $SourcePrincipal -> $LocalUserName (profile preserved: $(-not $UpdateHomePath))"
        Start-Migration @params
        Set-DEStateValue -Path 'identity.migration.status' -Value 'migrated-pending-reboot'
        Request-DEReboot -Reason 'ADMU migration completed; restart to load the new local profile' -ResumeAction 'identity.verify-migration' -LoginAs ".\$LocalUserName (or .\$($script:BreakGlassName))" | Out-Null
        return @{ ok = $true; detail = 'Start-Migration returned; restart required before verification' }
    } catch {
        Set-DEStateValue -Path 'identity.migration.status' -Value "failed: $($_.Exception.Message)"
        throw
    } finally { $temp = $null; $params = $null; [GC]::Collect() }
}

function Test-DEMigrationResult {
    <# Post-reboot verification: local account exists, profile path preserved, ProfileList points the new SID at the old folder, Entra state as requested. #>
    $m = Get-DEState -Path 'identity.migration'
    if (-not $m) { return @{ ok = $false; detail = 'no migration recorded' } }
    $id = Get-DEIdentityState
    $checks = @()
    $local = @($id.localUsers | Where-Object { $_ -and $_.name -ieq $m.target }) | Select-Object -First 1
    $checks += @{ name = "local account $($m.target) exists and enabled"; ok = [bool]($local -and $local.enabled) }
    $prof = @($id.profiles | Where-Object { $_ -and $_.path -ieq $m.sourceProfilePath }) | Select-Object -First 1
    $checks += @{ name = "profile folder preserved ($($m.sourceProfilePath))"; ok = [bool]($prof -or (Test-Path -LiteralPath "$($m.sourceProfilePath)")) }
    $checks += @{ name = 'profile owned by the new local SID'; ok = [bool]($prof -and $local -and $prof.sid -eq $local.sid) }
    if ($m.leaveEntra) { $checks += @{ name = 'device left Entra'; ok = ($id.joinType -notin @('entra-joined', 'hybrid-entra-joined', 'unknown', '')) } }   # unknown (dsregcmd failed) is not proof of leaving
    $ok = -not ($checks | Where-Object { -not $_.ok })
    if ($ok) { Set-DEStateValue -Path 'identity.migration.status' -Value 'verified' }
    return @{ ok = $ok; checks = $checks; detail = (($checks | ForEach-Object { "$(if ($_.ok) { 'PASS' } else { 'FAIL' }) $($_.name)" }) -join '; ') }
}

function Invoke-DEEntraLeave {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $id = Get-DEIdentityState
    if ($id.joinType -notin @('entra-joined', 'hybrid-entra-joined', 'entra-registered')) { return 'not Entra joined' }
    $bg = Test-DEGate -Id 'gate.breakglass' -Refresh; $bl = Test-DEGate -Id 'gate.bitlocker' -Refresh; $od = Test-DEGate -Id 'gate.onedrive' -Refresh
    foreach ($g in @($bg, $bl, $od)) { if ($g.Status -notin @('PASS', 'EXCEPTION')) { throw "refusing Entra leave: $($g.Id) is $($g.Status)" } }
    if ($PSCmdlet.ShouldProcess($env:COMPUTERNAME, 'dsregcmd /leave')) {
        $r = Invoke-DENative -FilePath 'dsregcmd.exe' -Arguments @('/leave')
        if ($r.ExitCode -ne 0) { throw "dsregcmd /leave exit $($r.ExitCode): $($r.Text)" }
        Request-DEReboot -Reason 'device left Entra; restart to complete' -ResumeAction 'identity.verify-migration' | Out-Null
        return 'left Entra; restart pending'
    }
}

function Remove-DEStaleMdmEnrollments {
    <# Removes stale (no policy provider, no scheduled task) enrollments only, after a registry backup. Never touches the active authority. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $mdm = Get-DEMdmState
    $removed = @(); $kept = @()
    foreach ($e in @($mdm.staleEnrollments | Where-Object { $null -ne $_ })) {
        $key = "HKLM\SOFTWARE\Microsoft\Enrollments\$($e.id)"
        if ($PSCmdlet.ShouldProcess($key, 'remove stale MDM enrollment')) {
            # no backup, no delete: an enrollment we cannot restore is left in place and reported
            $backup = Backup-DERegistryKey -Key $key -Label "enrollment-$($e.id)"
            if (-not $backup) { $kept += $e.id; Write-DELog -Level WARN -Message "stale enrollment $($e.id) kept: registry backup failed"; continue }
            Remove-Item -Path "HKLM:\SOFTWARE\Microsoft\Enrollments\$($e.id)" -Recurse -Force -ErrorAction SilentlyContinue
            foreach ($p in @("HKLM:\SOFTWARE\Microsoft\EnterpriseResourceManager\Tracked\$($e.id)", "HKLM:\SOFTWARE\Microsoft\PolicyManager\AdmxInstalled\$($e.id)", "HKLM:\SOFTWARE\Microsoft\Provisioning\OMADM\Accounts\$($e.id)")) { Remove-Item -Path $p -Recurse -Force -ErrorAction SilentlyContinue }
            $removed += $e.id
        }
    }
    if ($kept.Count) { throw "removed $($removed.Count) stale enrollment(s); kept $($kept.Count) whose registry backup failed ($($kept -join ', '))" }
    return "removed $($removed.Count) stale enrollment(s): $($removed -join ', ')"
}

# ------------------------------------------------------------------ gates + actions
function Register-DEIdentityGates {
    Register-DEGate -Id 'gate.elevated' -Title 'Console is elevated' -Module 'identity' -Check { if (Test-DEIsElevated) { @{ Status = 'PASS'; Detail = 'running as administrator' } } else { @{ Status = 'BLOCKED'; Detail = 'not elevated' } } } -Unblock 'Relaunch the console as administrator.'
    Register-DEGate -Id 'gate.connectivity' -Title 'Cloud endpoints reachable' -Module 'network' -Check { $c = Test-DEConnectivity -Hosts @('console.jumpcloud.com', 'login.microsoftonline.com'); if ($c.allOk) { @{ Status = 'PASS'; Detail = 'JumpCloud and Microsoft reachable' } } else { @{ Status = 'BLOCKED'; Detail = (($c.targets | Where-Object { -not $_.https } | ForEach-Object { "$($_.host): $($_.detail)" }) -join '; ') } } } -Unblock 'Fix DNS / proxy / firewall egress on 443.'
    Register-DEGate -Id 'gate.breakglass' -Title 'DE break-glass administrator verified' -Module 'identity' -Check {
        $s = Get-DEBreakGlassState
        if (-not $s.exists) { return @{ Status = 'BLOCKED'; Detail = "$($script:BreakGlassName) does not exist" } }
        $missing = @(); if (-not $s.enabled) { $missing += 'disabled' }; if (-not $s.administrator) { $missing += 'not administrator' }; if (-not $s.passwordRequired) { $missing += 'no password required' }; if (-not $s.hiddenFromLogon) { $missing += 'visible on sign-in tiles' }; if (-not $s.localOnly) { $missing += 'not local-only' }
        if ($missing.Count) { return @{ Status = 'BLOCKED'; Detail = ($missing -join ', ') } }
        if (-not $s.verified) { return @{ Status = 'WARN'; Detail = 'account correct but interactive sign-in not yet verified' } }
        @{ Status = 'PASS'; Detail = "verified $($s.verifiedAt)" }
    } -Unblock "Run 'Create break-glass', sign in once as .\$($script:BreakGlassName), then press 'Confirm break-glass verified'."
    Register-DEGate -Id 'gate.bitlocker' -Title 'BitLocker migration gate' -Module 'identity' -Check { Test-DEBitLockerGate } -Unblock 'Encrypt the OS volume, turn protection on, add a recovery password protector, verify its id against the escrow record and enter the id.'
    Register-DEGate -Id 'gate.onedrive' -Title 'OneDrive sync safe' -Module 'identity' -Check { Test-DEOneDriveGate } -Unblock "Open OneDrive, confirm 'Up to date', pause sync, then press 'Confirm OneDrive synced'."
    Register-DEGate -Id 'gate.source-user-signed-out' -Title 'Source user not signed in' -Module 'identity' -Check { $ctx = Get-DEContext; $src = "$($ctx['sourcePrincipal'])"; $id = Get-DEIdentityState; if ($src -and $id.interactiveUser -and $id.interactiveUser -ieq $src) { @{ Status = 'BLOCKED'; Detail = "$src is signed in" } } else { @{ Status = 'PASS'; Detail = $(if ($src) { "$src not in the interactive session" } else { 'no source principal set' }) } } } -Unblock 'Sign the end user out; run from the break-glass or technician session.'
    Register-DEGate -Id 'gate.jc-mapping' -Title 'JumpCloud user mapping correct' -Module 'jumpcloud' -Check { $ctx = Get-DEContext; if (-not $ctx['localUserName']) { return @{ Status = 'BLOCKED'; Detail = 'no intended local user set' } }; $m = Test-DEJumpCloudUserMapping -IntendedLocalUser "$($ctx['localUserName'])" -SourcePrincipal "$($ctx['sourcePrincipal'])" -QueryApi:(Test-DESecret -Name 'JC_API_KEY'); if ($m.status -eq 'READY') { @{ Status = 'PASS'; Detail = "local account and profile ready for $($m.intendedLocalUser)" } } else { @{ Status = $(if ($m.status -eq 'WARN') { 'WARN' } else { 'BLOCKED' }); Detail = ($m.issues -join '; ') } } } -Unblock 'Complete the identity migration so the intended local account owns the profile, then fix the JumpCloud binding.'
    Register-DEGate -Id 'gate.no-dual-mdm' -Title 'Single MDM authority' -Module 'identity' -Check { $m = Get-DEMdmState; if ($m.authority -like 'dual*') { @{ Status = 'BLOCKED'; Detail = $m.authority } } else { @{ Status = 'PASS'; Detail = "authority: $($m.authority); stale: $($m.staleEnrollments.Count)" } } } -Unblock 'Remove the stale enrollment (Identity > Clean stale MDM) or decide the authority in the client profile.'
    Register-DEGate -Id 'gate.security-verified' -Title 'Security stack verified' -Module 'security' -Check { $ids = @('security.guardz', 'security.sentinelone', 'security.pabx'); $bad = @(); foreach ($i in $ids) { try { $s = Get-DEActionState -Id $i; if ($s.Status -ne 'PASS') { $bad += "$i=$($s.Status)" } } catch { $bad += "$i=missing" } }; if ($bad.Count) { @{ Status = 'BLOCKED'; Detail = ($bad -join ', ') } } else { @{ Status = 'PASS'; Detail = 'Guardz, SentinelOne and PABX verified' } } } -Unblock 'Run the Security actions until each verifies.'
}

function Register-DEIdentityActions {
    param($ClientProfile)
    # Entra leave never happens blindly: by default it is its own step, run only after 'Verify migration' passes.
    # identity.leaveEntra = false keeps the device joined (no leave step at all); identity.leaveEntraDuringMigration = true
    # restores the one-step ADMU behaviour (LeaveDomain inside Start-Migration) for clients that ask for it.
    $leave = [bool](Get-DEHashPath -Object $ClientProfile -Path 'identity.leaveEntra'); if ($null -eq (Get-DEHashPath -Object $ClientProfile -Path 'identity.leaveEntra')) { $leave = $true }
    $leaveDuring = $leave -and [bool](Get-DEHashPath -Object $ClientProfile -Path 'identity.leaveEntraDuringMigration')
    $removeStale = [bool](Get-DEHashPath -Object $ClientProfile -Path 'mdm.removeStaleEnrollments')

    Register-DEAction -Id 'identity.breakglass' -Module 'identity' -Title "Create or repair $($script:BreakGlassName) (local admin, hidden, password required)" -Phase 5 -Gates @('gate.elevated') -RequiresElevation -RequiresSecrets @('BREAKGLASS_PASSWORD') `
        -Detect { $s = Get-DEBreakGlassState; @{ exists = $s.exists; enabled = $s.enabled; administrator = $s.administrator; passwordRequired = $s.passwordRequired; hiddenFromLogon = $s.hiddenFromLogon; localOnly = $s.localOnly } } `
        -Desired { @{ exists = $true; enabled = $true; administrator = $true; passwordRequired = $true; hiddenFromLogon = $true; localOnly = $true } } `
        -Apply { param($s) $r = New-DEBreakGlassAccount; "exists=$($r.exists) admin=$($r.administrator) hidden=$($r.hiddenFromLogon)" } `
        -ManualAction "After creation sign in once as .\$($script:BreakGlassName) and press 'Confirm break-glass verified'."
    Register-DEAction -Id 'identity.breakglass.verify' -Module 'identity' -Title 'Break-glass interactive sign-in verified' -Phase 5 -Gates @() -RequiresSecrets @('BREAKGLASS_PASSWORD') `
        -Detect { $s = Get-DEBreakGlassState; @{ verified = $s.verified } } -Desired { @{ verified = $true } } `
        -ManualAction "Sign in once, interactively, as .\$($script:BreakGlassName). Then press 'Confirm break-glass verified' on the Identity page: that runs the credential check and records who confirmed the sign-in. No automated step can confirm it." 
    Register-DEAction -Id 'identity.bitlocker' -Module 'identity' -Title 'BitLocker gate (encrypted, protection on, protector id verified)' -Phase 6 -Gates @('gate.elevated') `
        -Detect { $g = Test-DEBitLockerGate; @{ status = $g.Status; detail = $g.Detail } } -Desired { @{ status = 'PASS' } } `
        -ManualAction 'Enable BitLocker with TPM + recovery password, escrow the key, then record the protector id (Identity > BitLocker protector id).'
    Register-DEAction -Id 'identity.onedrive' -Module 'identity' -Title 'OneDrive sync confirmed before identity change' -Phase 6 `
        -Detect { $g = Test-DEOneDriveGate; @{ status = $g.Status; detail = $g.Detail } } -Desired { @{ status = 'PASS' } } `
        -ManualAction "Confirm 'Up to date' and pause sync, then press 'Confirm OneDrive synced'."
    Register-DEAction -Id 'identity.hello' -Module 'identity' -Title 'Windows Hello impact reviewed' -Phase 6 `
        -Detect { $h = Get-DEHelloImpact; @{ pinConfigured = $h.pinConfigured; reviewed = [bool](Get-DEState -Path 'identity.hello.reviewedAt') } } -Desired { @{ reviewed = $true } } `
        -Apply { param($s) Set-DEStateValue -Path 'identity.hello.reviewedAt' -Value (Get-Date).ToString('o'); 'impact acknowledged: ' + ((Get-DEHelloImpact).impact -join ' | ') } `
        -ManualAction 'Tell the user the PIN stops working after migration and will be re-enrolled after the first local sign-in.'
    Register-DEAction -Id 'identity.migrate' -Module 'identity' -Title 'Migrate Entra user to local account (JumpCloud ADMU, profile preserved)' -Phase 7 -Destructive -RequiresElevation -RequiresReboot -Modes @('takeover', 'co-managed', 'audit') `
        -Gates @('gate.elevated', 'gate.breakglass', 'gate.bitlocker', 'gate.onedrive', 'gate.source-user-signed-out', 'gate.no-dual-mdm') -RequiresSecrets @('MIGRATION_TEMP_PASSWORD') `
        -Detect { $m = Get-DEState -Path 'identity.migration'; $ctx = Get-DEContext; $id = Get-DEIdentityState; @{ migrated = [bool]($m -and "$($m.status)" -in @('migrated-pending-reboot', 'verified')); sourceIsEntra = [bool]("$($ctx['sourcePrincipal'])" -match '^AzureAD\\'); localExists = [bool]($id.localUsers | Where-Object { $_ -and $_.name -ieq "$($ctx['localUserName'])" }) } } `
        -Desired { @{ migrated = $true } } `
        -Apply { param($s) $ctx = Get-DEContext; if (-not $ctx['sourcePrincipal'] -or -not $ctx['localUserName']) { throw 'source principal and local user name must be set in the provisioning context' }; $r = Start-DEIdentityMigration -SourcePrincipal "$($ctx['sourcePrincipal'])" -LocalUserName "$($ctx['localUserName'])" -LeaveEntra:$leaveDuring; if (Get-DEHashPath -Object $r -Path 'planned') { 'planned' } else { $r.detail } }.GetNewClosure() `
        -Verify { param($after) $m = Get-DEState -Path 'identity.migration'; $ctx = Get-DEContext; $localOk = [bool](@((Get-DEIdentityState).localUsers | Where-Object { $_ -and $_.name -ieq "$($ctx['localUserName'])" }).Count); @{ ok = [bool]($m -and "$($m.status)" -in @('migrated-pending-reboot', 'verified') -and $localOk); detail = "status $($m.status); local account $($ctx['localUserName']) $(if ($localOk) { 'created' } else { 'NOT found' }); restart then run 'Verify migration'" } } `
        -Rollback { param($s) 'ADMU keeps the source profile and its registry hive; to revert, sign in as break-glass, remove the new local account without deleting the profile folder, and restore ProfileList from the backup recorded in state (identity.migration.profileListBackup). Do not delete C:\Users\<source>.' } `
        -ManualAction 'Restart, sign in as the new local user (or break-glass), reopen the console; it resumes at Verify migration.'
    Register-DEAction -Id 'identity.verify-migration' -Module 'identity' -Title 'Verify migration after restart (account, profile, ownership, Entra state)' -Phase 7 -Modes @('takeover', 'co-managed', 'audit') `
        -Detect { $r = Test-DEMigrationResult; @{ ok = $r.ok; detail = $r.detail } } -Desired { @{ ok = $true } } `
        -ManualAction 'If a check fails, do not proceed to JumpCloud takeover; review the ADMU log under C:\Windows\Temp\jcAdmu.log.'
    if ($leave -and -not $leaveDuring) {
        Register-DEAction -Id 'identity.entra-leave' -Module 'identity' -Title 'Leave Entra (only after migration is verified)' -Phase 7 -Destructive -RequiresElevation -RequiresReboot -Modes @('takeover', 'co-managed', 'audit') -Gates @('gate.elevated', 'gate.breakglass', 'gate.bitlocker', 'gate.onedrive') `
            -Detect { $id = Get-DEIdentityState; $m = Get-DEState -Path 'identity.migration'; @{ joined = $(if ("$($id.joinType)" -in @('unknown', '')) { $null } else { $id.joinType -in @('entra-joined', 'hybrid-entra-joined') }); migrationVerified = [bool]($m -and "$($m.status)" -eq 'verified') } } `
            -Desired { @{ joined = $false } } -Compare { param($d, $w) if ($null -eq $d.joined) { @('join state unknown (dsregcmd gave no answer); cannot confirm the device left Entra') } elseif ($d.joined -and -not $d.migrationVerified) { @('device still joined and migration not verified; leave is locked') } elseif ($d.joined) { @('device still joined') } else { @() } } `
            -Apply { param($s) if (-not $s.Detected.migrationVerified) { throw 'migration not verified; refusing to leave Entra' }; Invoke-DEEntraLeave } `
            -ManualAction 'Only when the client profile keeps the device Entra-joined should this stay untouched.'
    }
    Register-DEAction -Id 'identity.mdm-cleanup' -Module 'identity' -Title 'Remove stale MDM enrollments' -Phase 7 -Destructive -RequiresElevation -Gates @('gate.elevated') -Modes @('takeover', 'repair', 'replacement') `
        -Detect { $m = Get-DEMdmState; @{ stale = $m.staleEnrollments.Count; authority = $m.authority } } -Desired { @{ stale = 0 } } `
        -Apply { param($s) if (-not $removeStale) { throw 'client profile disables stale MDM removal' }; Remove-DEStaleMdmEnrollments }.GetNewClosure() `
        -ManualAction 'Only stale enrollments (no policy provider, no scheduled task) are removed; an active Intune enrollment needs a deliberate authority decision.'
    Register-DEAction -Id 'identity.hello-reset' -Module 'identity' -Title 'Clear stale Windows Hello container (after migration)' -Phase 8 -Destructive -RequiresElevation -Gates @('gate.elevated') -Modes @('takeover', 'repair') `
        -Detect { $h = Get-DEHelloImpact; $m = Get-DEState -Path 'identity.migration'; @{ ngcPresent = [bool]$h.ngcFolderPresent; migrated = [bool]($m -and "$($m.status)" -eq 'verified'); resetForThisMigration = [bool]($m -and (Get-DEState -Path 'identity.hello.resetAt') -and "$(Get-DEState -Path 'identity.hello.resetFor')" -eq "$($m.startedAt)") } } -Desired { @{ ngcPresent = $false } } `
        -Compare { param($d, $w) if ($d.ngcPresent -and $d.migrated -and -not $d.resetForThisMigration) { @('NGC container remains after migration') } else { @() } } `
        -Apply { param($s) $r = Clear-DEHelloContainer; $m = Get-DEState -Path 'identity.migration'; Set-DEStateValue -Path 'identity.hello.resetAt' -Value (Get-Date).ToString('o'); Set-DEStateValue -Path 'identity.hello.resetFor' -Value "$($m.startedAt)"; $r }
}

Export-ModuleMember -Function Get-DEBreakGlassState, New-DEBreakGlassAccount, Test-DEBreakGlassLogon, Confirm-DEBreakGlassVerified, Test-DEBitLockerGate, Set-DEBitLockerExpectedProtector, Suspend-DEBitLockerForFirmware, Resume-DEBitLocker, Test-DEOneDriveGate, Confirm-DEOneDriveSynced, Get-DEHelloImpact, Clear-DEHelloContainer, Get-DEAdmuState, Install-DEAdmu, Test-DEMigrationPreconditions, Start-DEIdentityMigration, Test-DEMigrationResult, Invoke-DEEntraLeave, Remove-DEStaleMdmEnrollments, Register-DEIdentityGates, Register-DEIdentityActions
