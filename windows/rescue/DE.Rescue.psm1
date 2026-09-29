#Requires -Version 5.1
<#
.SYNOPSIS
    DE boot rescue: runs from WinPE (or any Windows PE-style environment) against a Windows install that will not boot
    or must not be booted.

.DESCRIPTION
    Inspect the offline Windows (build, name, join type, JumpCloud agent, stuck updates, profiles), unlock BitLocker
    with a recovery password the technician types (checked for typos first, held only in memory, never written or
    logged), copy user profiles to a USB drive with a manifest, export drivers, read disk health, repair boot files or
    revert stuck updates (each confirmed), and leave a de.techconsole.handoff/v1 record on the USB and on the Windows
    volume for DE Tech Tool, optionally signed and sent to the Intelligence Hub. Nothing on the Windows volume is
    deleted; boot repair and update revert only run when the technician types YES.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:RescueRoot = $PSScriptRoot
$script:ConsoleRoot = Join-Path (Split-Path -Parent $PSScriptRoot) 'console'
Import-Module (Join-Path $script:ConsoleRoot 'modules\DE.Contracts\DE.Contracts.psm1') -Force -Global -DisableNameChecking
$script:Version = $(try { (Get-Content -LiteralPath (Join-Path $script:ConsoleRoot 'VERSION') -Raw -Encoding UTF8).Trim() } catch { '0.0.0' })
$script:Log = New-Object System.Collections.Generic.List[string]

function Get-DERescueVersion { return $script:Version }
function Join-DEWinPath {
    <# Windows path join that does not check the drive exists (the build plan and the offline volume are described, not opened). #>
    param([Parameter(Mandatory = $true)][string]$Base, [Parameter(Mandatory = $true)][string]$Child)
    return ($Base.TrimEnd('\', '/') + '\' + $Child.TrimStart('\', '/'))
}
function Write-DERescueLog {
    <# Keeps a session log for the handoff folder. Never pass a key or password here. #>
    param([Parameter(Mandatory = $true)][string]$Message)
    $line = '{0} {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($Message -replace '(?<!\d)\d{6}(-\d{6}){7}(?!\d)', '[recovery password removed]')
    $script:Log.Add($line)
    return $line
}
function Get-DERescueLog { return @($script:Log) }
function Invoke-DERescueNative {
    <# The only place native tools run, so tests replace it. Returns @{ ExitCode; Output; Text }. #>
    param([Parameter(Mandatory = $true)][string]$FilePath, [string[]]$Arguments = @())
    # Windows PowerShell 5.1 turns a redirected stderr line into a terminating error under 'Stop' (reg.exe writes
    # ERROR: there), losing the exit code; so run with Continue and judge by the exit code.
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    try { $out = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" }); $code = $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
    return [pscustomobject]@{ ExitCode = $code; Output = $out; Text = ($out -join "`n") }
}

# ------------------------------------------------------------------ BitLocker
function Test-DERecoveryPasswordFormat {
    <#
        A BitLocker recovery password is 8 groups of 6 digits; every group is a multiple of 11 below 720896. Checking
        that catches a mistyped group before manage-bde counts a failed attempt. Returns @{ ok; reason; badGroup }.
    #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    $v = ($Value -replace '\s', '').Trim()
    if ($v -notmatch '^\d{6}(-?\d{6}){7}$') { return @{ ok = $false; reason = 'expected 48 digits in 8 groups of 6 (dashes optional)'; badGroup = 0 } }
    $groups = @([regex]::Matches(($v -replace '-', ''), '\d{6}') | ForEach-Object { $_.Value })
    for ($i = 0; $i -lt 8; $i++) {
        $n = [int]$groups[$i]
        if (($n % 11) -ne 0 -or $n -ge 720896) { return @{ ok = $false; reason = "group $($i + 1) ($($groups[$i])) is not valid: check it against the key"; badGroup = $i + 1 } }
    }
    return @{ ok = $true; reason = ''; badGroup = 0; normalized = ($groups -join '-') }
}
function ConvertFrom-DEManageBdeStatus {
    <# Parses 'manage-bde -status' (English) into one record per volume. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $vols = @(); $cur = $null
    foreach ($raw in ($Text -split "`r?`n")) {
        $line = $raw.Trim()
        $m = [regex]::Match($line, '^Volume ([A-Z]:)\s*(\[(.*)\])?')
        if ($m.Success) { if ($cur) { $vols += [pscustomobject]$cur }; $cur = [ordered]@{ drive = $m.Groups[1].Value; label = $m.Groups[3].Value; conversion = ''; percent = $null; protection = ''; lock = ''; locked = $false; encrypted = $false }; continue }
        # a volume without a letter (Volume \\?\Volume{GUID}\) must not overwrite the previous lettered volume's status
        if ($line -match '^Volume ') { if ($cur) { $vols += [pscustomobject]$cur }; $cur = $null; continue }
        if (-not $cur) { continue }
        $kv = [regex]::Match($line, '^([A-Za-z ]+):\s*(.*)$'); if (-not $kv.Success) { continue }
        $val = $kv.Groups[2].Value.Trim()
        switch ($kv.Groups[1].Value.Trim()) {
            'Conversion Status' { $cur.conversion = $val; $cur.encrypted = ($val -notmatch '^Fully Decrypted') }
            'Percentage Encrypted' { $p = [regex]::Match($val, '[\d.]+'); if ($p.Success) { $cur.percent = [double]::Parse($p.Value, [Globalization.CultureInfo]::InvariantCulture) } }
            'Protection Status' { $cur.protection = $val }
            'Lock Status' { $cur.lock = $val; $cur.locked = ($val -match '^Locked') }
        }
    }
    if ($cur) { $vols += [pscustomobject]$cur }
    return $vols
}
function Get-DERescueBitLocker {
    $r = Invoke-DERescueNative -FilePath 'manage-bde.exe' -Arguments @('-status')
    return @(ConvertFrom-DEManageBdeStatus -Text $r.Text)
}
function Unlock-DERescueVolume {
    <# Unlocks -Drive with a typed recovery password (SecureString). The password is checked, used once, and dropped. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z]:$')][string]$Drive, [Parameter(Mandatory = $true)][securestring]$RecoveryPassword)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($RecoveryPassword)
    try {
        $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
        $fmt = Test-DERecoveryPasswordFormat -Value $plain
        if (-not $fmt.ok) { throw "not tried: $($fmt.reason)" }
        if (-not $PSCmdlet.ShouldProcess($Drive, 'unlock with the typed recovery password')) { return 'planned' }
        $r = Invoke-DERescueNative -FilePath 'manage-bde.exe' -Arguments @('-unlock', $Drive, '-RecoveryPassword', $fmt.normalized)
    } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $plain = $null; $fmt = $null }
    if ($r.ExitCode -ne 0) { throw "manage-bde could not unlock $Drive (exit $($r.ExitCode)); check the key ID shown on the recovery screen matches the key you have" }
    $null = Write-DERescueLog "unlocked $Drive with a recovery password (not recorded)"
    return 'unlocked'
}

# ------------------------------------------------------------------ volumes and the offline Windows
function Get-DERescueVolumes {
    <# Every lettered volume: file system, size, free space, BitLocker lock, whether it holds Windows. #>
    $bl = @{}; foreach ($b in @(Get-DERescueBitLocker)) { $bl[$b.drive] = $b }
    $out = @()
    foreach ($v in @(Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter })) {
        $d = "$($v.DriveLetter):"
        $b = $bl[$d]
        $locked = [bool]($b -and $b.locked)
        $out += [pscustomobject]@{
            drive = $d; label = "$($v.FileSystemLabel)"; fileSystem = "$($v.FileSystem)"; driveType = "$($v.DriveType)"
            sizeGB = [math]::Round($v.Size / 1GB, 1); freeGB = [math]::Round($v.SizeRemaining / 1GB, 1); freeBytes = [long]$v.SizeRemaining
            bitlocker = $(if (-not $b -or -not $b.encrypted) { 'none' } elseif ($locked) { 'locked' } else { 'unlocked' })
            hasWindows = ((-not $locked) -and (Test-Path -LiteralPath "$d\Windows\System32\config\SYSTEM"))
            isBootMedia = (($d -eq "$env:SystemDrive") -or (Test-Path -LiteralPath "$d\sources\boot.wim"))   # X: and the rescue USB itself
        }
    }
    return $out
}
function Find-DEWindowsVolume { param([array]$Volumes = @(Get-DERescueVolumes)) return (@($Volumes | Where-Object { $_.hasWindows -and -not $_.isBootMedia }) | Select-Object -First 1) }
function Get-DERescueDestinations {
    <# Where a backup may go: any writable volume that is not the rescue media or the Windows volume. FAT32 is flagged (4 GB file limit). #>
    param([array]$Volumes = @(Get-DERescueVolumes), [string]$WindowsDrive)
    return @($Volumes | Where-Object { -not $_.isBootMedia -and $_.drive -ne $WindowsDrive -and $_.bitlocker -ne 'locked' -and $_.freeBytes -gt 0 } | ForEach-Object { $_ | Add-Member -NotePropertyName fat32 -NotePropertyValue ("$($_.fileSystem)" -match '^FAT') -PassThru -Force })
}
function Invoke-DEOfflineHive {
    <# Loads <Drive>\Windows\System32\config\<Hive> under HKLM\DE_RESCUE_<Hive>, runs -ScriptBlock with the key path, always unloads. #>
    param([Parameter(Mandatory = $true)][string]$Drive, [Parameter(Mandatory = $true)][ValidateSet('SOFTWARE', 'SYSTEM')][string]$Hive, [Parameter(Mandatory = $true)][scriptblock]$ScriptBlock)
    $name = "DE_RESCUE_$Hive"
    # a hive left loaded by an earlier crash would make every load fail (and block DISM /Image) until reboot
    if (Test-Path -LiteralPath "Registry::HKEY_LOCAL_MACHINE\$name") { $null = Remove-DEOfflineHive -Name $name }
    $r = Invoke-DERescueNative -FilePath 'reg.exe' -Arguments @('load', "HKLM\$name", "$Drive\Windows\System32\config\$Hive")
    if ($r.ExitCode -ne 0) { throw "could not load the offline $Hive hive from $Drive (exit $($r.ExitCode)): $($r.Text)" }
    try { return (& $ScriptBlock "Registry::HKEY_LOCAL_MACHINE\$name") }
    finally { if (-not (Remove-DEOfflineHive -Name $name)) { $null = Write-DERescueLog "warning: HKLM\$name could not be unloaded; restart the rescue before running DISM on this drive" } }
}
function Remove-DEOfflineHive {
    <# Unloads HKLM\<Name>, retrying: PowerShell's registry provider keeps key handles until they are finalised. #>
    param([Parameter(Mandatory = $true)][string]$Name)
    for ($i = 0; $i -lt 6; $i++) {
        [GC]::Collect(); [GC]::WaitForPendingFinalizers()
        $r = Invoke-DERescueNative -FilePath 'reg.exe' -Arguments @('unload', "HKLM\$Name")
        if ($r.ExitCode -eq 0) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}
function Set-DERescueTimeZone {
    <#
        WinPE assumes Pacific time and reads the hardware clock as local time, so every UTC timestamp (handoff, Hub
        signature) is off by the client's offset unless the zone matches the installed Windows. Sets it with tzutil.
    #>
    param([Parameter(Mandatory = $true)][string]$Drive)
    $tz = Invoke-DEOfflineHive -Drive $Drive -Hive SYSTEM -ScriptBlock { param($k) $cur = Get-DERegValue "$k\Select" 'Current'; if (-not $cur) { $cur = 1 }; Get-DERegValue ("$k\ControlSet{0:d3}\Control\TimeZoneInformation" -f [int]$cur) 'TimeZoneKeyName' }
    if (-not $tz) { return $null }
    $r = Invoke-DERescueNative -FilePath 'tzutil.exe' -Arguments @('/s', "$tz")
    if ($r.ExitCode -ne 0) { $null = Write-DERescueLog "time zone '$tz' not set (tzutil exit $($r.ExitCode))"; return $null }
    $null = Write-DERescueLog "time zone set to $tz (from the installed Windows)"
    return "$tz"
}
function Install-DERescueRootCertificates {
    <# WinPE ships a minimal root store and never updates it; certificates baked into X:\DE\certs make HTTPS to the Hub trustworthy. #>
    param([string]$Directory = (Join-Path (Split-Path -Parent $PSScriptRoot) 'certs'))
    $n = 0
    foreach ($c in @(Get-ChildItem -LiteralPath $Directory -Include '*.cer', '*.crt' -File -Recurse -ErrorAction SilentlyContinue)) {
        $r = Invoke-DERescueNative -FilePath 'certutil.exe' -Arguments @('-addstore', 'Root', $c.FullName)
        if ($r.ExitCode -eq 0) { $n++ } else { $null = Write-DERescueLog "certificate $($c.Name) not added (certutil exit $($r.ExitCode))" }
    }
    return $n
}
function Get-DERegValue { param([string]$Path, [string]$Name) try { $p = Get-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction Stop; return $p.$Name } catch { return $null } }
function ConvertTo-DEOfflineProfile {
    <# One ProfileList entry mapped onto the offline drive letter; kind is entra (S-1-12-1), domain, local or system. #>
    param([Parameter(Mandatory = $true)][string]$Sid, [AllowEmptyString()][string]$ImagePath, [Parameter(Mandatory = $true)][string]$Drive)
    $kind = $(if ($Sid -like 'S-1-12-1-*') { 'entra' } elseif ($Sid -match '^S-1-5-(18|19|20)$') { 'system' } elseif ($Sid -match '^S-1-5-21-') { 'local-or-domain' } else { 'other' })
    $mapped = $(if ($ImagePath) { $ImagePath -replace '^(%SystemDrive%|[A-Za-z]:)', $Drive } else { '' })
    return [pscustomobject]@{ sid = $Sid; kind = $kind; name = $(if ($mapped) { Split-Path -Leaf $mapped } else { '' }); path = $mapped; exists = [bool]($mapped -and (Test-Path -LiteralPath $mapped)) }
}
function Get-DERescueOfflineInfo {
    <# Reads the offline Windows on -Drive without starting it. #>
    param([Parameter(Mandatory = $true)][string]$Drive)
    $soft = Invoke-DEOfflineHive -Drive $Drive -Hive SOFTWARE -ScriptBlock {
        param($k)
        $cv = "$k\Microsoft\Windows NT\CurrentVersion"
        $profiles = @(Get-ChildItem -LiteralPath "$cv\ProfileList" -ErrorAction SilentlyContinue | ForEach-Object { @{ sid = $_.PSChildName; path = "$(Get-DERegValue -Path $_.PSPath -Name 'ProfileImagePath')" } })
        @{ build = (Get-DERegValue $cv 'CurrentBuild'); ubr = (Get-DERegValue $cv 'UBR'); displayVersion = (Get-DERegValue $cv 'DisplayVersion'); product = (Get-DERegValue $cv 'ProductName'); profiles = $profiles }
    }
    $sys = Invoke-DEOfflineHive -Drive $Drive -Hive SYSTEM -ScriptBlock {
        param($k)
        $cur = Get-DERegValue "$k\Select" 'Current'; if (-not $cur) { $cur = 1 }
        $cs = "$k\ControlSet{0:d3}" -f [int]$cur
        $join = @(Get-ChildItem -LiteralPath "$cs\Control\CloudDomainJoin\JoinInfo" -ErrorAction SilentlyContinue).Count
        @{ hostname = (Get-DERegValue "$cs\Control\ComputerName\ComputerName" 'ComputerName'); entraJoined = ($join -gt 0); domain = (Get-DERegValue "$cs\Services\Tcpip\Parameters" 'Domain') }
    }
    $profiles = @($soft.profiles | ForEach-Object { ConvertTo-DEOfflineProfile -Sid $_.sid -ImagePath $_.path -Drive $Drive } | Where-Object { $_.kind -ne 'system' })
    return [pscustomobject]@{
        drive = $Drive; hostname = $sys.hostname; osBuild = $(if ($soft.build) { "$($soft.build).$($soft.ubr)" } else { $null }); osDisplayVersion = $soft.displayVersion; product = $soft.product
        joinType = $(if ($sys.entraJoined) { 'entra' } elseif ($sys.domain) { "ad ($($sys.domain))" } else { 'workgroup or unknown' })
        jumpcloudAgent = (Test-Path -LiteralPath "$Drive\Program Files\JumpCloud\jumpcloud-agent.exe")
        pendingUpdates = (Test-Path -LiteralPath "$Drive\Windows\WinSxS\pending.xml")
        profiles = $profiles
    }
}
function Get-DERescueHardware {
    <# Serial, maker and model from firmware (works in WinPE with the WMI component). #>
    $bios = $null; $cs = $null
    try { $bios = Get-CimInstance -ClassName Win32_BIOS -ErrorAction Stop } catch { $bios = $null }
    try { $cs = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction Stop } catch { $cs = $null }
    return [pscustomobject]@{ serial = "$(if ($bios) { $bios.SerialNumber })".Trim(); manufacturer = "$(if ($cs) { $cs.Manufacturer })".Trim(); model = "$(if ($cs) { $cs.Model })".Trim() }
}
function Get-DERescueDiskHealth {
    $out = @()
    try {
        foreach ($d in @(Get-PhysicalDisk -ErrorAction Stop)) {
            $rel = $null; try { $rel = $d | Get-StorageReliabilityCounter -ErrorAction Stop } catch { $rel = $null }
            $out += [pscustomobject]@{ name = "$($d.FriendlyName)"; mediaType = "$($d.MediaType)"; health = "$($d.HealthStatus)"; sizeGB = [math]::Round($d.Size / 1GB, 0)
                wear = $(if ($rel) { $rel.Wear }); temperature = $(if ($rel) { $rel.Temperature }); readErrors = $(if ($rel) { $rel.ReadErrorsUncorrected }) }
        }
    } catch { $out += [pscustomobject]@{ name = 'unknown'; mediaType = ''; health = "not readable here: $($_.Exception.Message)"; sizeGB = $null; wear = $null; temperature = $null; readErrors = $null } }
    return $out
}

# ------------------------------------------------------------------ profile backup and driver export
function Get-DEProfileExcludes {
    <# Caches and temp folders that are rebuilt on their own; copying them only costs time and space. #>
    param([Parameter(Mandatory = $true)][string]$ProfilePath)
    return @('AppData\Local\Temp', 'AppData\Local\Microsoft\Windows\INetCache', 'AppData\Local\Microsoft\Windows\WebCache', 'AppData\Local\CrashDumps',
        'AppData\Local\Google\Chrome\User Data\Default\Cache', 'AppData\Local\Google\Chrome\User Data\Default\Code Cache', 'AppData\Local\Microsoft\Edge\User Data\Default\Cache', 'AppData\Local\Microsoft\Edge\User Data\Default\Code Cache',
        'AppData\Local\Microsoft\Teams\Cache', 'AppData\Local\D3DSCache', 'AppData\Local\NVIDIA\DXCache') | ForEach-Object { Join-Path $ProfilePath ($_.Replace('\', [string][IO.Path]::DirectorySeparatorChar)) }
}
function Test-DERobocopyExit {
    <# Robocopy exit codes are bit flags: below 8 nothing failed; 8 and above some files were not copied. #>
    param([Parameter(Mandatory = $true)][int]$Code)
    if ($Code -lt 0) { return @{ ok = $false; meaning = "robocopy did not run (exit $Code)" } }
    $parts = @(); if ($Code -band 1) { $parts += 'files copied' }; if ($Code -band 2) { $parts += 'extra files at the destination' }; if ($Code -band 4) { $parts += 'mismatched files' }
    if ($Code -band 8) { $parts += 'some files could not be copied' }; if ($Code -band 16) { $parts += 'fatal error' }
    if (-not $parts.Count) { $parts = @('nothing to copy') }
    return @{ ok = ($Code -lt 8); meaning = ($parts -join ', ') }
}
function Get-DEFolderStats {
    param([Parameter(Mandatory = $true)][string]$Path, [string[]]$Exclude = @())
    $files = 0; [long]$bytes = 0; [long]$largest = 0
    foreach ($f in @(Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue)) {
        $skip = $false; foreach ($x in $Exclude) { if ($f.FullName -like ($x + [IO.Path]::DirectorySeparatorChar + '*')) { $skip = $true; break } }; if ($skip) { continue }
        $files++; $bytes += $f.Length; if ($f.Length -gt $largest) { $largest = $f.Length }
    }
    return @{ files = $files; bytes = $bytes; largest = $largest }
}
function Backup-DERescueProfile {
    <#
        Copies one profile to <DestinationRoot>\DE-Rescue\<serial>\profiles\<name> with robocopy (timestamps and
        attributes kept, junctions skipped), writes a manifest (relative path, size, UTC time) and its sha256, and
        compares file counts. Refuses when the destination is too small or FAT32 cannot hold a file. Never deletes.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProfilePath, [Parameter(Mandatory = $true)][string]$DestinationRoot, [Parameter(Mandatory = $true)][string]$Serial, [long]$DestinationFreeBytes = -1, [switch]$DestinationFat32)
    if (-not (Test-Path -LiteralPath $ProfilePath)) { throw "profile folder $ProfilePath not found" }
    $name = Split-Path -Leaf $ProfilePath
    $exclude = @(Get-DEProfileExcludes -ProfilePath $ProfilePath)
    $src = Get-DEFolderStats -Path $ProfilePath -Exclude $exclude
    if ($DestinationFat32 -and $src.largest -ge 4GB) { throw "the destination is FAT32 and $name has a file of $([math]::Round($src.largest / 1GB, 1)) GB (FAT32 stops at 4 GB): use an NTFS or exFAT drive" }
    if ($DestinationFreeBytes -ge 0 -and $DestinationFreeBytes -lt [long]($src.bytes * 1.05)) { throw "not enough space: $name needs about $([math]::Round($src.bytes / 1GB, 1)) GB, the destination has $([math]::Round($DestinationFreeBytes / 1GB, 1)) GB free" }
    $safeSerial = ($Serial -replace '[^A-Za-z0-9-]', '_')
    $base = Join-Path (Join-Path (Join-Path $DestinationRoot 'DE-Rescue') $safeSerial) 'profiles'
    $dest = Join-Path $base $name
    if (-not $PSCmdlet.ShouldProcess($ProfilePath, "copy $($src.files) files ($([math]::Round($src.bytes / 1GB, 2)) GB) to $dest")) { return @{ result = 'SKIPPED'; detail = 'planned'; path = $dest } }
    New-Item -ItemType Directory -Path $dest -Force -WhatIf:$false | Out-Null
    $log = Join-Path $base "robocopy-$name.log"
        # /B: backup mode (WinPE runs as SYSTEM with SeBackupPrivilege) gets past profile ACLs. /XA:O skips OneDrive
    # online-only files: their content is in the cloud and cannot be read without the OneDrive driver.
    $rcArgs = @($ProfilePath, $dest, '/E', '/B', '/COPY:DAT', '/DCOPY:T', '/R:1', '/W:1', '/XJ', '/XA:O', '/MT:8', '/NP', '/NFL', '/NDL', "/LOG:$log", '/XD') + $exclude
    $r = Invoke-DERescueNative -FilePath 'robocopy.exe' -Arguments $rcArgs
    $rc = Test-DERobocopyExit -Code $r.ExitCode
    $manifest = Join-Path $base "manifest-$name.csv"
    $rows = @(Get-ChildItem -LiteralPath $dest -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ path = $_.FullName.Substring($dest.Length).TrimStart('\', '/'); bytes = $_.Length; modifiedUtc = $_.LastWriteTimeUtc.ToString('o') } })
    if ($rows.Count) { $rows | Export-Csv -LiteralPath $manifest -NoTypeInformation -Encoding UTF8 } else { [IO.File]::WriteAllText($manifest, "`"path`",`"bytes`",`"modifiedUtc`"`r`n") }
    $sha = (Get-FileHash -LiteralPath $manifest -Algorithm SHA256).Hash.ToLowerInvariant()
    [long]$copiedBytes = 0; foreach ($x in $rows) { $copiedBytes += [long]$x.bytes }
    $result = $(if (-not $rc.ok) { 'FAIL' } elseif ($rows.Count -lt $src.files) { 'WARN' } else { 'PASS' })
    $detail = "robocopy: $($rc.meaning); copied $($rows.Count) of $($src.files) files ($([math]::Round($copiedBytes / 1GB, 2)) GB)$(if ($result -ne 'PASS') { "; see $log" })"
    $null = Write-DERescueLog "profile $name -> $dest : $result ($detail)"
    return @{ result = $result; detail = $detail; path = $dest; files = $rows.Count; bytes = $copiedBytes; manifestSha256 = $sha; log = $log }
}
function Export-DERescueDrivers {
    <# Exports the offline Windows' third-party drivers (DISM) so a reinstall can put them straight back. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$WindowsDrive, [Parameter(Mandatory = $true)][string]$DestinationRoot, [Parameter(Mandatory = $true)][string]$Serial)
    $dest = Join-Path (Join-Path (Join-Path $DestinationRoot 'DE-Rescue') ($Serial -replace '[^A-Za-z0-9-]', '_')) 'drivers'
    if (-not $PSCmdlet.ShouldProcess($WindowsDrive, "export drivers to $dest")) { return @{ result = 'SKIPPED'; detail = 'planned'; path = $dest } }
    New-Item -ItemType Directory -Path $dest -Force -WhatIf:$false | Out-Null
    $scratch = Join-Path (Split-Path -Parent $dest) 'dism-scratch'; New-Item -ItemType Directory -Path $scratch -Force -WhatIf:$false | Out-Null
    $r = Invoke-DERescueNative -FilePath 'dism.exe' -Arguments @("/Image:$WindowsDrive\", '/Export-Driver', "/Destination:$dest", "/ScratchDir:$scratch")
    $infs = @(Get-ChildItem -LiteralPath $dest -Recurse -Filter '*.inf' -File -ErrorAction SilentlyContinue).Count
    $result = $(if ($r.ExitCode -ne 0) { 'FAIL' } elseif ($infs -eq 0) { 'WARN' } else { 'PASS' })
    return @{ result = $result; detail = "dism exit $($r.ExitCode); $infs driver package(s)"; path = $dest; files = $infs }
}
function Invoke-DERescueBootRepair {
    <# bcdboot rebuilds the boot files from the offline Windows; revert-pending undoes updates stuck mid-install. Both need -Confirm or YES in the menu. #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$WindowsDrive, [Parameter(Mandatory = $true)][ValidateSet('bcdboot', 'revert-pending')][string]$Mode, [string]$ScratchDir)
    if ($Mode -eq 'bcdboot') {
        # Target the system partition on the SAME disk as Windows (never the rescue USB): EFI partition on GPT, active partition on MBR.
        $sp = Get-DERescueSystemPartition -WindowsDrive $WindowsDrive
        if (-not $PSCmdlet.ShouldProcess("$WindowsDrive\Windows", "rebuild boot files on $($sp.letter) ($($sp.firmware))")) { return @{ result = 'SKIPPED'; detail = 'planned' } }
        $letter = $sp.letter
        if (-not $letter) { $letter = Add-DERescueSystemPartitionLetter -Partition $sp.partition }
        $r = Invoke-DERescueNative -FilePath 'bcdboot.exe' -Arguments @("$WindowsDrive\Windows", '/s', $letter, '/f', $sp.firmware)
    } else {
        if (-not $PSCmdlet.ShouldProcess("$WindowsDrive\", 'revert pending update actions (DISM /RevertPendingActions)')) { return @{ result = 'SKIPPED'; detail = 'planned' } }
        $dargs = @("/Image:$WindowsDrive\", '/Cleanup-Image', '/RevertPendingActions'); if ($ScratchDir) { $dargs += "/ScratchDir:$ScratchDir" }
        $r = Invoke-DERescueNative -FilePath 'dism.exe' -Arguments $dargs
    }
    $res = $(if ($r.ExitCode -eq 0) { 'PASS' } else { 'FAIL' })
    $null = Write-DERescueLog "$Mode on $WindowsDrive : exit $($r.ExitCode)"
    return @{ result = $res; detail = "$Mode exit $($r.ExitCode): $(@($r.Output) | Select-Object -Last 2)" }
}

function Get-DERescueSystemPartition {
    <# The Windows disk's EFI system partition (GPT -> UEFI) or active partition (MBR -> BIOS). #>
    param([Parameter(Mandatory = $true)][string]$WindowsDrive)
    $win = Get-Partition -DriveLetter $WindowsDrive.TrimEnd(':') -ErrorAction Stop
    $disk = Get-Disk -Number $win.DiskNumber -ErrorAction Stop
    if ("$($disk.PartitionStyle)" -eq 'GPT') {
        $p = @(Get-Partition -DiskNumber $win.DiskNumber | Where-Object { "$($_.GptType)" -eq '{c12a7328-f81f-11d2-ba4b-00a0c93ec93b}' }) | Select-Object -First 1
        if (-not $p) { throw "no EFI system partition on disk $($win.DiskNumber); bcdboot would write to the wrong place" }
        $fw = 'UEFI'
    } else {
        $p = @(Get-Partition -DiskNumber $win.DiskNumber | Where-Object { $_.IsActive }) | Select-Object -First 1
        if (-not $p) { $p = $win }
        $fw = 'BIOS'
    }
    return [pscustomobject]@{ partition = $p; letter = $(if ($p.DriveLetter -and "$($p.DriveLetter)" -match '^[A-Z]$') { "$($p.DriveLetter):" } else { $null }); firmware = $fw; disk = $win.DiskNumber }
}
function Add-DERescueSystemPartitionLetter {
    <# Gives the system partition a free letter (S: first) for bcdboot. #>
    param([Parameter(Mandatory = $true)]$Partition)
    $used = @(Get-Volume -ErrorAction SilentlyContinue | Where-Object { $_.DriveLetter } | ForEach-Object { "$($_.DriveLetter)" })
    $free = @('S', 'T', 'U', 'V', 'W', 'R', 'Q', 'P') | Where-Object { $used -notcontains $_ } | Select-Object -First 1
    if (-not $free) { throw 'no free drive letter for the system partition' }
    $Partition | Add-PartitionAccessPath -AccessPath "${free}:\" -ErrorAction Stop
    return "${free}:"
}

# ------------------------------------------------------------------ handoff
function Get-DERescueRecommendations {
    <# What the next person should do, from what the rescue saw and did. #>
    param([Parameter(Mandatory = $true)]$Handoff)
    $rec = @()
    $acts = @($Handoff.actions)
    $w = $Handoff.windows
    if (@($acts | Where-Object { $_.action -eq 'unlock' -and $_.result -eq 'PASS' }).Count) { $rec += 'The BitLocker recovery password was used: once Windows starts, add a new recovery password, escrow it (JumpCloud, then Entra if still joined), and remove the used one.' }
    if ($w -and $w.pendingUpdates -and -not @($acts | Where-Object { $_.action -eq 'revert-pending' -and $_.result -eq 'PASS' }).Count) { $rec += 'Updates were stuck mid-install (pending.xml). If Windows loops on "undoing changes", revert pending actions from the rescue menu.' }
    if ($w -and "$($w.joinType)" -eq 'entra' -and $w.jumpcloudAgent) { $rec += 'Entra-joined with the JumpCloud agent installed: run the takeover flow in DE Tech Tool (Scan & fix) after boot.' }
    foreach ($b in @($acts | Where-Object { $_.action -eq 'profile-backup' })) { if ($b.result -eq 'PASS') { $rec += "Profile copy at $($b.path) (manifest sha256 $($b.manifestSha256.Substring(0, 12))...). Keep the USB until the user confirms their files." } else { $rec += "Profile copy to $($b.path) is $($b.result): $($b.detail)" } }
    foreach ($d in @($Handoff.disks | Where-Object { $_ -and "$($_.health)" -notmatch '^Healthy$' })) { $rec += "Disk '$($d.name)' reports $($d.health): replace it before returning the device." }
    return $rec
}
function Save-DERescueHandoff {
    <# Writes the handoff to the USB (always) and to the Windows volume for DE Tech Tool (when -WindowsDrive is given and unlocked). #>
    param([Parameter(Mandatory = $true)]$Handoff, [Parameter(Mandatory = $true)][string]$DestinationRoot, [string]$WindowsDrive)
    $Handoff.recommendations = @(Get-DERescueRecommendations -Handoff $Handoff)
    $ts = Get-Date -Format 'yyyyMMdd-HHmmss'
    $safe = ($Handoff.device.serial -replace '[^A-Za-z0-9-]', '_')
    $paths = @(Join-Path (Join-Path (Join-Path $DestinationRoot 'DE-Rescue') $safe) "handoff-$ts.json")
    if ($WindowsDrive) { $paths += (Join-DEWinPath $WindowsDrive "ProgramData\DE\TechConsole\handoff\rescue-$ts.json") }
    $written = @(Save-DEHandoff -Handoff $Handoff -Path $paths)
    $logFile = Join-Path (Split-Path -Parent $paths[0]) "rescue-log-$ts.txt"
    [IO.File]::WriteAllLines($logFile, [string[]]@(Get-DERescueLog), (New-Object Text.UTF8Encoding $false))
    return $written
}

# ------------------------------------------------------------------ media build plan
function Get-DERescueBuildPlan {
    <#
        The ordered steps New-DERescueMedia.ps1 runs on a DE build PC with the Windows ADK and WinPE add-on. Pure: it
        only describes the work, so it can be reviewed (-WhatIf) and tested. Optional components are added with their
        en-us language packs, in dependency order.
    #>
    param([Parameter(Mandatory = $true)][string]$AdkRoot, [Parameter(Mandatory = $true)][string]$WorkDir, [Parameter(Mandatory = $true)][string]$WindowsRoot, [string]$IsoPath, [string]$UsbDrive, [string]$DriverPath, [string]$Arch = 'amd64', [string[]]$RootCertificate = @(), [switch]$SecureBoot2023)
    $pe = Join-DEWinPath $AdkRoot 'Windows Preinstallation Environment'
    $ocs = Join-DEWinPath (Join-DEWinPath $pe $Arch) 'WinPE_OCs'
    $mount = Join-DEWinPath $WorkDir 'mount'
    $steps = New-Object System.Collections.Generic.List[object]
    $steps.Add(@{ id = 'copype'; what = "copy the base WinPE ($Arch) to $WorkDir"; cmd = 'cmd.exe'; args = @('/c', "call `"$(Join-DEWinPath $AdkRoot 'Deployment Tools\DandISetEnv.bat')`" && copype $Arch `"$WorkDir`"") })
    $steps.Add(@{ id = 'mount'; what = 'mount boot.wim'; cmdlet = 'Mount-WindowsImage'; params = @{ ImagePath = (Join-DEWinPath $WorkDir 'media\sources\boot.wim'); Index = 1; Path = $mount } })
    foreach ($oc in @('WinPE-WMI', 'WinPE-NetFx', 'WinPE-Scripting', 'WinPE-PowerShell', 'WinPE-StorageWMI', 'WinPE-DismCmdlets', 'WinPE-SecureStartup', 'WinPE-EnhancedStorage')) {
        $steps.Add(@{ id = "oc:$oc"; what = "add $oc"; cmdlet = 'Add-WindowsPackage'; params = @{ Path = $mount; PackagePath = (Join-DEWinPath $ocs "$oc.cab") } })
        $steps.Add(@{ id = "oc:$oc-en-us"; what = "add $oc (en-us)"; cmdlet = 'Add-WindowsPackage'; params = @{ Path = $mount; PackagePath = (Join-DEWinPath (Join-DEWinPath $ocs 'en-us') "${oc}_en-us.cab") } })
    }
    if ($DriverPath) { $steps.Add(@{ id = 'drivers'; what = "add storage/network drivers from $DriverPath"; cmdlet = 'Add-WindowsDriver'; params = @{ Path = $mount; Driver = $DriverPath; Recurse = $true } }) }
    $steps.Add(@{ id = 'copy-rescue'; what = 'copy DE rescue, contracts and DE.Contracts to X:\DE'; copy = @(
        @{ from = (Join-DEWinPath $WindowsRoot 'rescue'); to = (Join-DEWinPath $mount 'DE\rescue') },
        @{ from = (Join-DEWinPath $WindowsRoot 'console\modules\DE.Contracts'); to = (Join-DEWinPath $mount 'DE\console\modules\DE.Contracts') },
        @{ from = (Join-DEWinPath $WindowsRoot 'console\contracts'); to = (Join-DEWinPath $mount 'DE\console\contracts') },
        @{ from = (Join-DEWinPath $WindowsRoot 'console\VERSION'); to = (Join-DEWinPath $mount 'DE\console\VERSION') }) })
    if ($RootCertificate.Count) { $steps.Add(@{ id = 'certs'; what = 'add root certificates for HTTPS to the Hub (installed at rescue start)'; copy = @($RootCertificate | ForEach-Object { @{ from = $_; to = (Join-DEWinPath $mount "DE\certs\$(Split-Path -Leaf $_)") } }) }) }
    $steps.Add(@{ id = 'scratch'; what = 'raise WinPE scratch space to 512 MB (DISM and robocopy need it)'; cmd = 'dism.exe'; args = @("/Image:$mount", '/Set-ScratchSpace:512') })
    $steps.Add(@{ id = 'startnet'; what = 'start the DE rescue menu at boot'; write = @{ path = (Join-DEWinPath $mount 'Windows\System32\startnet.cmd'); text = "wpeinit`r`nX:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -File X:\DE\rescue\Start-DERescue.ps1`r`n" } })
    $steps.Add(@{ id = 'unmount'; what = 'save and unmount boot.wim'; cmdlet = 'Dismount-WindowsImage'; params = @{ Path = $mount; Save = $true } })
    $mk = Join-DEWinPath $pe 'MakeWinPEMedia.cmd'
    if ($IsoPath) { $steps.Add(@{ id = 'iso'; what = "write ISO $IsoPath"; cmd = 'cmd.exe'; args = @('/c', "call `"$(Join-DEWinPath $AdkRoot 'Deployment Tools\DandISetEnv.bat')`" && `"$mk`"$(if ($SecureBoot2023) { ' /bootex' }) /ISO /F `"$WorkDir`" `"$IsoPath`"") }) }
    if ($UsbDrive) { $steps.Add(@{ id = 'usb'; what = "FORMAT $UsbDrive and write the rescue USB (everything on $UsbDrive is erased)"; destructive = $true; cmd = 'cmd.exe'; args = @('/c', "call `"$(Join-DEWinPath $AdkRoot 'Deployment Tools\DandISetEnv.bat')`" && `"$mk`"$(if ($SecureBoot2023) { ' /bootex' }) /UFD /F `"$WorkDir`" $UsbDrive") }) }
    return , $steps.ToArray()
}

Export-ModuleMember -Function Get-DERescueVersion, Join-DEWinPath, Write-DERescueLog, Get-DERescueLog, Invoke-DERescueNative, Test-DERecoveryPasswordFormat, ConvertFrom-DEManageBdeStatus, Get-DERescueBitLocker, Unlock-DERescueVolume, Get-DERescueVolumes, Find-DEWindowsVolume, Get-DERescueDestinations, Invoke-DEOfflineHive, Remove-DEOfflineHive, Set-DERescueTimeZone, Install-DERescueRootCertificates, Get-DERescueSystemPartition, Add-DERescueSystemPartitionLetter, Get-DERegValue, ConvertTo-DEOfflineProfile, Get-DERescueOfflineInfo, Get-DERescueHardware, Get-DERescueDiskHealth, Get-DEProfileExcludes, Test-DERobocopyExit, Get-DEFolderStats, Backup-DERescueProfile, Export-DERescueDrivers, Invoke-DERescueBootRepair, Get-DERescueRecommendations, Save-DERescueHandoff, Get-DERescueBuildPlan
