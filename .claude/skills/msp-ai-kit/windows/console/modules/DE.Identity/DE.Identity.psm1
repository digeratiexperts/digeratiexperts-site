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
# Putting JumpCloud on means taking the device off Microsoft (Entra ID, AD domain). A client profile can opt out
# with identity.leaveEntra = false; Register-DEIdentityActions sets this from the profile.
$script:LeaveMicrosoft = $true

# ------------------------------------------------------------------ break-glass
function Get-DEBreakGlassState {
    param([string]$Name = $script:BreakGlassName)
    $u = $null; $isAdmin = $false; $hidden = $null
    if ($script:IsWindowsHost) {
        try { $u = Get-LocalUser -Name $Name -ErrorAction Stop } catch { $u = $null }
        if ($u) { try { $isAdmin = [bool](Get-LocalGroupMember -SID 'S-1-5-32-544' -ErrorAction Stop | Where-Object { $_ -and $_.SID.Value -eq $u.SID.Value }) } catch { $r = Invoke-DENative -FilePath 'net.exe' -Arguments @('localgroup', (Get-DEAdministratorsGroupName)); $isAdmin = [bool]($r.Output | Where-Object { $_ -and $_.Trim() -ieq $Name }) } }
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
    if (-not $expected) { $expected = Get-DEState -Path 'identity.bitlocker.jumpcloudEscrow.protectorId' }   # proven by the backup step against JumpCloud
    if (-not $expected) { $issues += 'recovery protector id not yet recorded against the escrow record (enter the id, never the password)' }
    elseif (@($os.recoveryProtectorIds | ForEach-Object { "$_".Trim('{', '}').ToUpperInvariant() }) -notcontains "$expected".Trim('{', '}').ToUpperInvariant()) { $issues += "recovery protector id $expected not present on the volume" }
    if ($issues.Count) { return @{ Status = $(if ($os.status -eq 'FullyEncrypted' -and $os.protection -eq 'On') { 'WARN' } else { 'BLOCKED' }); Detail = ($issues -join '; ') } }
    return @{ Status = 'PASS'; Detail = "OS volume encrypted ($($os.method)), protection on, TPM + recovery protector $expected verified" }
}
function Set-DEBitLockerExpectedProtector {
    <# Records the RecoveryPassword protector ID the technician verified in an escrow, and where (JumpCloud, Hudu, IT Glue,
       password vault, Entra or other). Only the ID and the location are stored, never the recovery password. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProtectorId, [ValidateSet('jumpcloud', 'hudu', 'itglue', 'vault', 'entra', 'other')][string]$Location = 'other', [string]$Technician)
    if ($ProtectorId -match '\d{6}-\d{6}') { throw 'that looks like a recovery password, not a protector id; only the id is stored' }
    if ($PSCmdlet.ShouldProcess($ProtectorId, "record verified protector id ($Location)")) {
        $now = (Get-Date).ToString('o'); $by = $(if ($Technician) { $Technician } else { "$(Get-DEState -Path 'settings.technician')" })
        Set-DEStateValue -Path 'identity.bitlocker.expectedProtectorId' -Value $ProtectorId; Set-DEStateValue -Path 'identity.bitlocker.verifiedAt' -Value $now
        Set-DEStateValue -Path 'identity.bitlocker.escrow' -Value @{ protectorId = $ProtectorId; location = $Location; by = $by; at = $now }
    }
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
    # the console runs in the technician's session, so without a mapped end user their OneDrive has not been looked at
    if (-not $src -and -not $confirmed) { $left = @(Get-DEUnmigratedDomainProfiles); if ($left.Count) { return @{ Status = 'WARN'; Detail = "end user not mapped yet, so their OneDrive was not checked ($(($left | ForEach-Object { $_.path }) -join ', ')): save the mapping on the Identity page" } } }
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
        # by SID: 'takeown /d y' needs the localized Yes letter and the group name is translated on non-English Windows
        $null = Invoke-DENative -FilePath 'icacls.exe' -Arguments @($ngc, '/setowner', '*S-1-5-32-544', '/t', '/c')
        $null = Invoke-DENative -FilePath 'icacls.exe' -Arguments @($ngc, '/grant', '*S-1-5-32-544:F', '/t', '/c')
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
    # ADMU's own refusals, checked before anything changes
    if ($LocalUserName.Length -gt 20) { $issues += "local user name '$LocalUserName' is longer than 20 characters (Windows limit; ADMU refuses it)" }
    if (Test-DESecret -Name 'JC_API_KEY') {
        try {
            $m = Test-DEJumpCloudUserMapping -IntendedLocalUser $LocalUserName -QueryApi
            if ($m.jumpcloud.bound -and -not $m.localAccount) { $issues += "JumpCloud user '$LocalUserName' is already bound to this device: the agent can create an empty local '$LocalUserName' before the migration, and ADMU then refuses. Unbind it in JumpCloud until the migration is verified" }
            if ($m.jumpcloud.userExists -eq $false) { $issues += "JumpCloud has no user '$LocalUserName'; the local name must match the JumpCloud username exactly" }
            if ("$($m.jumpcloud.userState)" -match 'STAGED|SUSPENDED') { $warnings += "JumpCloud user '$LocalUserName' is $($m.jumpcloud.userState): activate it (set a password) before binding" }
        } catch { $warnings += "JumpCloud not checked: $($_.Exception.Message)" }
    } else { $warnings += 'JumpCloud not checked (enter JC_API_KEY): the user must exist, be active and not yet bound to this device' }
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

# ------------------------------------------------------------------ Microsoft joins and BitLocker backup (before JumpCloud owns the device)
function Get-DEMicrosoftJoinState {
    <# Every Microsoft join JumpCloud replaces: Entra ID join, on-prem AD domain (hybrid is both), and an Entra registration. #>
    $id = Get-DEIdentityState
    $ds = Get-DEHashPath -Object $id -Path 'dsreg'
    $jt = "$(Get-DEHashPath -Object $id -Path 'joinType')"
    $entra = ($jt -in @('entra-joined', 'hybrid-entra-joined')) -or [bool](Get-DEHashPath -Object $ds -Path 'azureAdJoined')
    $domain = ($jt -in @('ad-domain-joined', 'hybrid-entra-joined')) -or [bool](Get-DEHashPath -Object $ds -Path 'domainJoined')
    $registered = ($jt -eq 'entra-registered') -or [bool](Get-DEHashPath -Object $ds -Path 'workplaceJoined')
    $what = @(); if ($entra) { $what += "Entra ID$(if (Get-DEHashPath -Object $ds -Path 'tenantName') { " ($(Get-DEHashPath -Object $ds -Path 'tenantName'))" })" }; if ($domain) { $what += "AD domain $(Get-DEHashPath -Object $ds -Path 'domainName')".Trim() }
    return @{ known = ($jt -notin @('unknown', '')); joinType = $jt; entraJoined = $entra; domainJoined = $domain; registered = $registered; any = ($entra -or $domain); summary = ($what -join ' + ')
        tenant = "$(Get-DEHashPath -Object $ds -Path 'tenantName')"; domainName = "$(Get-DEHashPath -Object $ds -Path 'domainName')" }
}
function Get-DEUnmigratedDomainProfiles {
    <# Profiles still owned by an Entra (S-1-12-1-...) or domain account. Leaving Microsoft now would strand them:
       nobody could sign in to them. Profiles the technician accepted as disposable are left out. #>
    param($Identity)
    if (-not $Identity) { $Identity = Get-DEIdentityState }
    $localDomains = @(@(Get-DEHashPath -Object $Identity -Path 'localUsers') | Where-Object { $_ -and "$(Get-DEHashPath -Object $_ -Path 'sid')" -match '^S-1-5-21-' } | ForEach-Object { "$(Get-DEHashPath -Object $_ -Path 'sid')" -replace '-\d+$', '' } | Select-Object -Unique)
    $accepted = @(Get-DEState -Path 'identity.leave.acceptedProfiles' | Where-Object { $_ })
    return @(@(Get-DEHashPath -Object $Identity -Path 'profiles') | Where-Object { $_ } | Where-Object {
            $sid = "$(Get-DEHashPath -Object $_ -Path 'sid')"
            ($sid -like 'S-1-12-1-*') -or ($sid -match '^S-1-5-21-' -and $localDomains.Count -and ($localDomains -notcontains ($sid -replace '-\d+$', '')))
        } | Where-Object { $accepted -notcontains "$(Get-DEHashPath -Object $_ -Path 'path')" } | ForEach-Object { @{ path = "$(Get-DEHashPath -Object $_ -Path 'path')"; sid = "$(Get-DEHashPath -Object $_ -Path 'sid')" } })
}
function Confirm-DEStrandedProfilesAccepted {
    <# The technician confirms leftover Entra/domain profiles (for example an old admin sign-in) may be left behind. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string[]]$Paths, [string]$Technician)
    if ($PSCmdlet.ShouldProcess(($Paths -join ', '), 'accept as left behind when the device leaves Microsoft')) {
        $all = @(@(Get-DEState -Path 'identity.leave.acceptedProfiles' | Where-Object { $_ }) + $Paths | Select-Object -Unique)
        Set-DEStateValue -Path 'identity.leave.acceptedProfiles' -Value $all
        Add-DEEvidence -Step 'identity.leave.accept-profiles' -Module 'identity' -Before 'unmigrated profiles' -ActionTaken 'technician accepted them as left behind' -Result 'INFO' -Verification (($Paths -join ', ') + " by $(if ($Technician) { $Technician } else { Get-DEState -Path 'settings.technician' })") | Out-Null
    }
}
function Get-DEBitLockerRecoveryPasswords {
    <# In memory only, for comparing with an escrowed key; never returned by an exported function, logged or stored. #>
    if (-not $script:IsWindowsHost) { return @() }
    try { return @((Get-BitLockerVolume -MountPoint $env:SystemDrive -ErrorAction Stop).KeyProtector | Where-Object { $_ -and "$($_.KeyProtectorType)" -eq 'RecoveryPassword' } | ForEach-Object { @{ id = "$($_.KeyProtectorId)"; password = "$($_.RecoveryPassword)" } }) } catch { return @() }
}
function Test-DEBitLockerKeyInJumpCloud {
    <# Reads the BitLocker key JumpCloud holds for this system (GET /v2/systems/{id}/fdekey) and compares it, in memory, with the
       OS volume's recovery passwords. Returns the matching protector id and a detail line, never a key. #>
    $sys = Get-DEJumpCloudSystem
    if (-not $sys) { return @{ ok = $false; detail = 'this device is not registered in JumpCloud yet' } }
    $sysId = "$(Get-DEJcProp $sys '_id')"; if (-not $sysId) { $sysId = "$(Get-DEJcProp $sys 'id')" }
    $r = $null
    try { $r = Invoke-DEJumpCloudApi -Method GET -V2 -Path "/systems/$sysId/fdekey" } catch { return @{ ok = $false; detail = "JumpCloud holds no BitLocker key for this device ($($_.Exception.Message))" } }
    $key = "$(Get-DEJcProp $r 'key')"
    if (-not $key) { return @{ ok = $false; detail = 'JumpCloud holds no BitLocker key for this device yet' } }
    Register-DERedaction -Value $key
    $digits = { param($v) ("$v" -replace '[^0-9]', '') }
    $match = $null
    foreach ($p in @(Get-DEBitLockerRecoveryPasswords)) { if ($p.password) { Register-DERedaction -Value $p.password; if ((& $digits $p.password) -eq (& $digits $key)) { $match = $p.id } } }
    $key = $null
    if ($match) { return @{ ok = $true; protectorId = $match; detail = "JumpCloud holds the recovery key for protector $match (checked against the volume)" } }
    return @{ ok = $false; detail = 'the key JumpCloud holds does not match any recovery protector on the OS volume (rotated since it was escrowed?)' }
}
function Backup-DEBitLockerToEntra {
    <# While the device is still Entra joined: BackupToAAD-BitLockerKeyProtector for each recovery protector. Returns the ids backed up. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    if (-not (Get-DEMicrosoftJoinState).entraJoined) { return @() }
    $done = @()
    foreach ($kp in @((Get-DEBitLockerState).os.recoveryProtectorIds | Where-Object { $_ })) {
        if ($PSCmdlet.ShouldProcess("$kp", 'BackupToAAD-BitLockerKeyProtector')) { BackupToAAD-BitLockerKeyProtector -MountPoint $env:SystemDrive -KeyProtectorId "$kp" -ErrorAction Stop | Out-Null; $done += "$kp" }
    }
    if ($done.Count) { Set-DEStateValue -Path 'identity.bitlocker.entraBackup' -Value @{ protectorIds = $done; at = (Get-Date).ToString('o') } }
    return $done
}
function Test-DEBitLockerBackupGate {
    <# The recovery key is backed up somewhere DE can prove. Leaving Microsoft needs a copy outside Entra ID: JumpCloud
       (checked against the volume) or an escrow the technician recorded that is not Entra. A device the client keeps
       Entra joined can rely on the Entra backup. #>
    param([switch]$Offline)
    $os = (Get-DEBitLockerState).os
    if (-not $os) { return @{ Status = 'BLOCKED'; Detail = 'no BitLocker OS volume information (not Windows, or BitLocker unavailable)' } }
    if ($os.status -ne 'FullyEncrypted' -or -not $os.hasRecoveryPassword) { return @{ Status = 'BLOCKED'; Detail = "OS volume $($os.status) $(if (-not $os.hasRecoveryPassword) { 'without a recovery password protector' }): encrypt with TPM + recovery password first" } }
    $norm = { param($v) "$v".Trim('{', '}').ToUpperInvariant() }
    $ids = @($os.recoveryProtectorIds | Where-Object { $_ } | ForEach-Object { & $norm $_ })
    $notes = @()
    if (-not $Offline -and (Test-DESecret -Name 'JC_API_KEY')) {
        $jc = $null; try { $jc = Test-DEBitLockerKeyInJumpCloud } catch { $jc = @{ ok = $false; detail = "JumpCloud check failed: $($_.Exception.Message)" } }
        if ($jc.ok) { Set-DEStateValue -Path 'identity.bitlocker.jumpcloudEscrow' -Value @{ protectorId = $jc.protectorId; verifiedAt = (Get-Date).ToString('o') }; return @{ Status = 'PASS'; Detail = $jc.detail } }
        $notes += $jc.detail
    } elseif (-not $Offline) { $notes += 'JumpCloud not checked (no JC_API_KEY this session)' }
    $rec = Get-DEState -Path 'identity.bitlocker.escrow'
    $recOk = [bool]($rec -and ($ids -contains (& $norm (Get-DEHashPath -Object $rec -Path 'protectorId'))))
    $recWhere = "$(Get-DEHashPath -Object $rec -Path 'location')"
    if ($recOk -and $recWhere -ne 'entra') { return @{ Status = 'PASS'; Detail = "recovery key for protector $(Get-DEHashPath -Object $rec -Path 'protectorId') recorded in $recWhere by $(Get-DEHashPath -Object $rec -Path 'by')" } }
    $eb = Get-DEState -Path 'identity.bitlocker.entraBackup'
    $ebOk = [bool]($eb -and @(@(Get-DEHashPath -Object $eb -Path 'protectorIds') | Where-Object { $ids -contains (& $norm $_) }).Count) -or ($recOk -and $recWhere -eq 'entra')
    if ($ebOk -and -not $script:LeaveMicrosoft) { return @{ Status = 'PASS'; Detail = 'recovery key backed up to Entra ID; the client keeps this device joined' } }
    if ($ebOk) { $notes += 'backed up to Entra ID only, which is not enough before leaving Entra' }
    return @{ Status = $(if ($ebOk) { 'WARN' } else { 'BLOCKED' }); Detail = ((@('no proven backup of the recovery key outside Entra ID') + $notes) -join '; ') }
}
function Invoke-DEDomainUnjoin {
    <# Leaves the on-prem AD domain for WORKGROUP without deleting the AD computer object, so no domain credential or DC is needed. Returns the WMI code (0 = done). #>
    $cs = Get-CimInstance -ClassName Win32_ComputerSystem
    $r = Invoke-CimMethod -InputObject $cs -MethodName UnjoinDomainOrWorkgroup -Arguments @{ FUnjoinOptions = [uint32]0 }
    return [int]$r.ReturnValue
}
function Invoke-DEMicrosoftLeave {
    <# Takes the device off Microsoft before JumpCloud owns it: leaves Entra ID (dsregcmd /leave) and any on-prem AD domain.
       Refuses while the break-glass, BitLocker backup or OneDrive gates are closed, while the join state is unknown, or
       while an Entra/domain profile has not been migrated (it would be stranded). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    $j = Get-DEMicrosoftJoinState
    if (-not $j.known) { throw 'join state unknown (dsregcmd gave no answer); refusing to change joins blind' }
    if (-not $j.any) { return $(if ($j.registered) { 'not joined to Entra ID or a domain; a work account registration remains (remove it in that user''s Settings > Access work or school)' } else { 'not joined to Entra ID or a domain' }) }
    foreach ($gid in @('gate.breakglass', 'gate.bitlocker-backup', 'gate.onedrive')) { $g = Test-DEGate -Id $gid -Refresh; if ($g.Status -notin @('PASS', 'EXCEPTION')) { throw "refusing to leave Microsoft: $gid is $($g.Status) ($($g.Detail))" } }
    $stranded = @(Get-DEUnmigratedDomainProfiles)
    if ($stranded.Count) { throw ("refusing to leave Microsoft: {0} profile(s) still belong to an Entra or domain account and would be stranded: {1}. Migrate them first, or accept them as left behind on the Identity page." -f $stranded.Count, (($stranded | ForEach-Object { $_.path }) -join ', ')) }
    $done = @()
    if ($j.entraJoined -and $PSCmdlet.ShouldProcess($env:COMPUTERNAME, "dsregcmd /leave (leave Entra ID $($j.tenant))")) {
        $r = Invoke-DENative -FilePath 'dsregcmd.exe' -Arguments @('/leave') -TimeoutSeconds 180
        if ($r.ExitCode -ne 0) { throw "dsregcmd /leave exit $($r.ExitCode): $($r.Text)" }
        $done += "left Entra ID$(if ($j.tenant) { " ($($j.tenant))" })"
    }
    if ($j.domainJoined -and $PSCmdlet.ShouldProcess($env:COMPUTERNAME, "leave AD domain $($j.domainName) for WORKGROUP (the AD computer object stays)")) {
        $rc = Invoke-DEDomainUnjoin
        if ($rc -ne 0) { throw "leaving AD domain $($j.domainName) failed (UnjoinDomainOrWorkgroup returned $rc)" }
        $done += "left AD domain $($j.domainName)"
    }
    if (-not $done.Count) { return 'planned' }
    Set-DEStateValue -Path 'identity.leftMicrosoft' -Value @{ at = (Get-Date).ToString('o'); entra = $j.entraJoined; domain = $j.domainJoined; tenant = $j.tenant; domainName = $j.domainName }
    Request-DEReboot -Reason 'device left Microsoft (Entra ID / AD domain); restart to finish' -ResumeAction 'identity.entra-leave' | Out-Null
    return (($done -join '; ') + '; restart pending')
}
function Invoke-DEEntraLeave {
    <# Kept for callers of the earlier name; leaving Entra alone is no longer enough, so it runs the full Microsoft leave. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    Invoke-DEMicrosoftLeave @PSBoundParameters
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
    Register-DEGate -Id 'gate.source-user-signed-out' -Title 'Source user not signed in' -Module 'identity' -Check {
        $ctx = Get-DEContext; $src = "$($ctx['sourcePrincipal'])"; $id = Get-DEIdentityState
        # no mapped end user is not a pass while an Entra or domain profile is still waiting to be migrated
        if (-not $src) { $left = @(Get-DEUnmigratedDomainProfiles -Identity $id); if ($left.Count) { return @{ Status = 'BLOCKED'; Detail = "end user not mapped yet ($(($left | ForEach-Object { $_.path }) -join ', ') still to migrate): save the mapping on the Identity page" } }; return @{ Status = 'PASS'; Detail = 'no Entra or domain user on this device to migrate' } }
        if ($id.interactiveUser -and $id.interactiveUser -ieq $src) { @{ Status = 'BLOCKED'; Detail = "$src is signed in" } } else { @{ Status = 'PASS'; Detail = "$src not in the interactive session" } }
    } -Unblock 'Sign the end user out completely (Task Manager > Users > Sign off); run the console from the break-glass or technician session.'
    Register-DEGate -Id 'gate.jc-mapping' -Title 'JumpCloud user mapping correct' -Module 'jumpcloud' -Check { $ctx = Get-DEContext; if (-not $ctx['localUserName']) { return @{ Status = 'BLOCKED'; Detail = 'no intended local user set' } }; $m = Test-DEJumpCloudUserMapping -IntendedLocalUser "$($ctx['localUserName'])" -SourcePrincipal "$($ctx['sourcePrincipal'])" -QueryApi:(Test-DESecret -Name 'JC_API_KEY'); if ($m.status -eq 'READY') { @{ Status = 'PASS'; Detail = "local account and profile ready for $($m.intendedLocalUser)" } } else { @{ Status = $(if ($m.status -eq 'WARN') { 'WARN' } else { 'BLOCKED' }); Detail = ($m.issues -join '; ') } } } -Unblock 'Complete the identity migration so the intended local account owns the profile, then fix the JumpCloud binding.'
    Register-DEGate -Id 'gate.user-session' -Title 'A real user has signed in' -Module 'identity' -Check { $life = Get-DEDeviceLifecycle -Snapshot @{ setup = (Get-DESetupState); identity = (Get-DEIdentityState); mdm = @{ authority = (Get-DEMdmState).authority } }; if ($life.stage -eq 'oobe') { @{ Status = 'BLOCKED'; Detail = "this step needs the user's own session: $($life.reasons -join '; ')" } } else { @{ Status = 'PASS'; Detail = "$($life.userCount) user profile(s) on this device" } } } -Unblock "Finish OOBE and let the user sign in once (or press 'Continue after first sign-in' so the tool reopens then); per-user steps run in that session."
    Register-DEGate -Id 'gate.bitlocker-backup' -Title 'BitLocker recovery key backed up (outside Entra before leaving it)' -Module 'identity' -NoException -Check { Test-DEBitLockerBackupGate } -Unblock "Run 'Back up the BitLocker recovery key': it backs the key up to Entra while still joined and checks JumpCloud holds it. If JumpCloud has no key, apply the JumpCloud BitLocker policy to this device, or record the protector id and where the key is escrowed on the Identity page."
    Register-DEGate -Id 'gate.microsoft-left' -Title 'Device off Microsoft (Entra ID / AD domain)' -Module 'identity' -Check { if (-not $script:LeaveMicrosoft) { return @{ Status = 'PASS'; Detail = 'the client profile keeps this device joined (identity.leaveEntra = false)' } }; $j = Get-DEMicrosoftJoinState; if (-not $j.known) { @{ Status = 'BLOCKED'; Detail = 'join state unknown (dsregcmd gave no answer)' } } elseif ($j.any) { @{ Status = 'BLOCKED'; Detail = "still joined to $($j.summary)" } } else { @{ Status = 'PASS'; Detail = 'not joined to Entra ID or an AD domain' } } } -Unblock "Run 'Disconnect from Microsoft' after the migration is verified and the BitLocker key is backed up, then restart."
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
    $script:LeaveMicrosoft = $leave

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
    Register-DEAction -Id 'identity.bitlocker-backup' -Module 'identity' -Title 'Back up the BitLocker recovery key (Entra while joined; proven in JumpCloud)' -Phase 6 -RequiresElevation -Gates @('gate.elevated') `
        -Detect { $g = Test-DEBitLockerBackupGate; $j = Get-DEMicrosoftJoinState; $eb = Get-DEState -Path 'identity.bitlocker.entraBackup'; @{ status = $g.Status; detail = $g.Detail; entraJoined = [bool]$j.entraJoined; entraBackedUp = [bool]$eb } } `
        -Desired { @{ status = 'PASS' } } `
        -Apply { param($s) $out = @(); if ($s.Detected.entraJoined -and -not $s.Detected.entraBackedUp) { $b = @(Backup-DEBitLockerToEntra); if ($b.Count) { $out += "backed up protector(s) $($b -join ', ') to Entra ID" } }; Reset-DEGateCache; $g = Test-DEBitLockerBackupGate; if ($g.Status -ne 'PASS') { throw ("$($g.Detail). Apply the JumpCloud BitLocker policy to this device and wait for its key to appear, or record the protector id and where the key is escrowed on the Identity page.") }; ($out + $g.Detail) -join '; ' } `
        -Verify { param($after) $g = Test-DEBitLockerBackupGate; @{ ok = ($g.Status -eq 'PASS'); detail = $g.Detail } } `
        -ManualAction 'Apply the JumpCloud BitLocker policy (it escrows the key in JumpCloud), or record the protector id and the escrow (Hudu, IT Glue, vault) on the Identity page. Never type the recovery password into the console.'
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
        # The id stays identity.entra-leave for existing plans and evidence; it now leaves every Microsoft join.
        Register-DEAction -Id 'identity.entra-leave' -Module 'identity' -Title 'Disconnect from Microsoft: leave Entra ID and any AD domain (after migration and BitLocker backup)' -Phase 7 -Destructive -RequiresElevation -Modes @('takeover', 'co-managed', 'audit', 'new', 'replacement', 'repair') -Gates @('gate.elevated', 'gate.breakglass', 'gate.bitlocker-backup', 'gate.onedrive') `
            -Detect { $j = Get-DEMicrosoftJoinState; $st = @(Get-DEUnmigratedDomainProfiles); @{ joined = $(if (-not $j.known) { $null } else { [bool]$j.any }); joinedTo = $j.summary; strandedProfiles = $st.Count; strandedPaths = (($st | ForEach-Object { $_.path }) -join ', '); leaveRecorded = [bool](Get-DEState -Path 'identity.leftMicrosoft') } } `
            -Desired { @{ joined = $false } } -Compare { param($d, $w) if ($null -eq $d.joined) { @('join state unknown (dsregcmd gave no answer); cannot confirm the device is off Microsoft') } elseif ($d.joined -and $d.strandedProfiles) { @("still joined to $($d.joinedTo); $($d.strandedProfiles) profile(s) not migrated yet ($($d.strandedPaths)): leave is locked") } elseif ($d.joined) { @("still joined to $($d.joinedTo)") } else { @() } } `
            -Apply { param($s) Invoke-DEMicrosoftLeave } `
            -Verify { param($after) $j = Get-DEMicrosoftJoinState; $queued = [bool](@(Get-DERebootQueue).Count); @{ ok = ((-not $j.any) -or ([bool](Get-DEState -Path 'identity.leftMicrosoft') -and $queued)); detail = $(if (-not $j.any) { 'not joined to Entra ID or an AD domain' } else { "leave done; restart pending to finish (still reports $($j.summary) until then)" }) } } `
            -ManualAction 'Only a client profile with identity.leaveEntra = false keeps the device joined. After the restart the console resumes here and confirms the device is off Microsoft.'
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

Export-ModuleMember -Function Get-DEMicrosoftJoinState, Get-DEUnmigratedDomainProfiles, Confirm-DEStrandedProfilesAccepted, Test-DEBitLockerKeyInJumpCloud, Backup-DEBitLockerToEntra, Test-DEBitLockerBackupGate, Invoke-DEDomainUnjoin, Invoke-DEMicrosoftLeave, Get-DEBreakGlassState, New-DEBreakGlassAccount, Test-DEBreakGlassLogon, Confirm-DEBreakGlassVerified, Test-DEBitLockerGate, Set-DEBitLockerExpectedProtector, Suspend-DEBitLockerForFirmware, Resume-DEBitLocker, Test-DEOneDriveGate, Confirm-DEOneDriveSynced, Get-DEHelloImpact, Clear-DEHelloContainer, Get-DEAdmuState, Install-DEAdmu, Test-DEMigrationPreconditions, Start-DEIdentityMigration, Test-DEMigrationResult, Invoke-DEEntraLeave, Remove-DEStaleMdmEnrollments, Register-DEIdentityGates, Register-DEIdentityActions
