#Requires -Version 5.1
# Native DE storage engine. No third-party cleaner code or remote scripts.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

function Resolve-DEStoragePath {
    param([Parameter(Mandatory = $true)][string]$Path, [switch]$AllowMissing)
    if (-not [IO.Path]::IsPathRooted($Path) -or $Path -match '[\x00-\x1f]' -or $Path -match '^\\\\' -or $Path -match '^\\[?.]') { throw 'Use an absolute local filesystem path.' }
    $full = [IO.Path]::GetFullPath($Path)
    if ($env:OS -eq 'Windows_NT' -and $full.Substring(2).Contains(':')) { throw 'Alternate data stream paths are refused.' }
    $root = [IO.Path]::GetPathRoot($full)
    if ($full.Length -gt $root.Length) { $full = $full.TrimEnd([char[]]'\/') }
    $walk = $full
    while ($walk) {
        if ([IO.File]::Exists($walk) -or [IO.Directory]::Exists($walk)) {
            $attrs = [int][IO.File]::GetAttributes($walk)
            # Reparse, offline, recall-on-open and recall-on-data-access: never hydrate cloud data or follow links.
            if (($attrs -band (0x400 -bor 0x1000 -bor 0x40000 -bor 0x400000)) -ne 0) { throw "Linked, offline or cloud path refused: $walk" }
        }
        $parent = [IO.Path]::GetDirectoryName($walk)
        if ($parent -eq $walk) { break }; $walk = $parent
    }
    if (-not $AllowMissing -and -not ([IO.Directory]::Exists($full) -or [IO.File]::Exists($full))) { throw "Path does not exist: $full" }
    return $full
}
function Test-DEStorageWithin {
    param([string]$Path, [string]$Root)
    $cmp = [StringComparison]::OrdinalIgnoreCase
    return ($Path.Equals($Root, $cmp) -or $Path.StartsWith($Root.TrimEnd([char[]]'\/') + [IO.Path]::DirectorySeparatorChar, $cmp))
}
function Write-DEStorageProgress {
    param([int]$Done, [int]$Total, [string]$Message)
    if (Get-Command Write-DELog -ErrorAction SilentlyContinue) { Write-DELog -Level INFO -Message "DE_PROGRESS $Done/$Total $Message" }
}
function Assert-DEStorageWrite {
    if (-not (Get-Command Get-DEConsole -ErrorAction SilentlyContinue)) { throw 'Initialize DE Tech Tool before changing files.' }
    $de = Get-DEConsole
    if ($de.DryRun -or $de.Mode -eq 'Audit') { throw 'Apply is disabled in audit/dry-run mode.' }
    if (Get-Command Test-DEConsoleIntegrity -ErrorAction SilentlyContinue) {
        $integrity = Test-DEConsoleIntegrity
        if ($integrity.status -eq 'tampered') { throw 'Tool integrity failed. Install a verified DE package.' }
    }
    if (Get-Command Test-DELicenseFor -ErrorAction SilentlyContinue) {
        $lic = Test-DELicenseFor -Feature 'apply' -Client "$($de.Context['client'])"
        if (-not $lic.ok) { throw "Licence refused: $($lic.reason)" }
    }
}
function Save-DEStorageReceipt {
    param([Parameter(Mandatory = $true)]$Record)
    $de = Get-DEConsole
    $dir = Join-Path $de.Dirs.Base 'storage'
    [void][IO.Directory]::CreateDirectory($dir)
    $path = Join-Path $dir ("{0}-{1}.json" -f $Record.kind, [guid]::NewGuid().ToString('N'))
    [IO.File]::WriteAllText($path, ($Record | ConvertTo-Json -Depth 14), (New-Object Text.UTF8Encoding $false))
    $Record | Add-Member -NotePropertyName receiptPath -NotePropertyValue $path -Force
    return $Record
}
function Add-DEStorageEvidence {
    param([string]$Step, $Record)
    if (Get-Command Add-DEEvidence -ErrorAction SilentlyContinue) {
        $status = "$($Record.result)"; if ($status -notin @('PASS','WARN','FAIL','PLANNED','BLOCKED','NO CHANGE')) { $status = 'INFO' }
        $art = @(); if ($Record.receiptPath) { $art = @($Record.receiptPath) }
        # Detailed local paths stay in the local receipt. Hub/client summary contains counts and outcomes only.
        $null = Add-DEEvidence -Step $Step -Module storage -Before 'storage snapshot' -ActionTaken $Record.kind -Result $status -Verification $Record.summary -Artifacts $art -Data @{ files = $Record.fileCount; bytes = $Record.bytes; schema = 'de.storage.summary/v1' }
    }
}
function Remove-DEStorageVerifiedFile {
    param([string]$Path, [long]$Length, [long]$ModifiedTicks = 0, [long]$CreatedTicks = 0, [string]$Hash = '')
    if ($env:OS -ne 'Windows_NT') { throw 'Permanent deletion requires the Windows verified-handle implementation.' }
    $null = Resolve-DEStoragePath $Path
    if (-not ('DE.Storage.VerifiedFile' -as [type])) { Add-Type -TypeDefinition @'
// Original DE code: delete only the same local regular file verified through an open handle.
using System;
using System.IO;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using Microsoft.Win32.SafeHandles;
namespace DE.Storage {
    public static class VerifiedFile {
        [StructLayout(LayoutKind.Sequential)] struct Info {
            public uint Attributes;
            public System.Runtime.InteropServices.ComTypes.FILETIME Creation, Access, Write;
            public uint Volume, SizeHigh, SizeLow, Links, IndexHigh, IndexLow;
        }
        [StructLayout(LayoutKind.Sequential)] struct Disposition { [MarshalAs(UnmanagedType.U1)] public bool Delete; }
        [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
        static extern SafeFileHandle CreateFile(string name, uint access, uint share, IntPtr security, uint creation, uint flags, IntPtr template);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle, out Info info);
        [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetFileInformationByHandle(SafeFileHandle handle, int fileClass, ref Disposition info, uint size);
        static long Ticks(System.Runtime.InteropServices.ComTypes.FILETIME value) {
            long raw = ((long)(uint)value.dwHighDateTime << 32) | (uint)value.dwLowDateTime;
            return DateTime.FromFileTimeUtc(raw).Ticks;
        }
        public static void Delete(string path, long length, long writeTicks, long creationTicks, string expectedHash) {
            // READ + DELETE, share READ only: deny writes, renames and competing deletion while checking.
            using (SafeFileHandle handle = CreateFile(path, 0x80010000, 1, IntPtr.Zero, 3, 0x00200000, IntPtr.Zero)) {
                if (handle.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
                Info info;
                if (!GetFileInformationByHandle(handle, out info)) throw new Win32Exception(Marshal.GetLastWin32Error());
                long actualLength = ((long)info.SizeHigh << 32) | info.SizeLow;
                if ((info.Attributes & (0x10|0x400|0x1000|0x40000|0x400000|0x1|0x4)) != 0 || info.Links != 1)
                    throw new IOException("Protected/link/cloud/hardlinked file refused.");
                if (actualLength != length || (writeTicks != 0 && Ticks(info.Write) != writeTicks) || (creationTicks != 0 && Ticks(info.Creation) != creationTicks))
                    throw new IOException("File metadata changed after planning.");
                using (FileStream stream = new FileStream(handle, FileAccess.Read)) {
                    if (!String.IsNullOrEmpty(expectedHash)) {
                        using (SHA256 sha = SHA256.Create()) {
                            string hash = BitConverter.ToString(sha.ComputeHash(stream)).Replace("-", "").ToLowerInvariant();
                            if (!String.Equals(hash, expectedHash, StringComparison.OrdinalIgnoreCase)) throw new IOException("File hash changed; removal refused.");
                        }
                    }
                    Disposition disposition = new Disposition { Delete = true };
                    if (!SetFileInformationByHandle(handle, 4, ref disposition, (uint)Marshal.SizeOf(typeof(Disposition))))
                        throw new Win32Exception(Marshal.GetLastWin32Error());
                }
            }
        }
    }
}
'@
 }
    [DE.Storage.VerifiedFile]::Delete($Path, $Length, $ModifiedTicks, $CreatedTicks, $Hash)
}
function Get-DEStorageTopology {
    [CmdletBinding()]
    param()
    if ($env:OS -ne 'Windows_NT') { throw 'Drive technology discovery requires Windows Storage/CIM APIs.' }
    $issues = @(); $physical = @(); $hardware = @()
    try { $physical = @(Get-PhysicalDisk -ErrorAction Stop) } catch { $issues += 'Physical media inventory unavailable.' }
    try { $hardware = @(Get-CimInstance Win32_DiskDrive -ErrorAction Stop) } catch { $issues += 'Controller/model inventory unavailable.' }
    $volumes = @()
    foreach ($v in @(Get-Volume -ErrorAction Stop | Where-Object { $_.DriveLetter -and $_.DriveType -eq 'Fixed' })) {
        try {
            $parts = @(Get-Partition -DriveLetter $v.DriveLetter -ErrorAction Stop)
            $disks = @($parts | Get-Disk -ErrorAction Stop)
            $unique = @($disks | Sort-Object Number -Unique)
            if ($unique.Count -ne 1) { $issues += "Volume $($v.DriveLetter): ambiguous disk mapping."; continue }
            $disk = $unique[0]; $hw = @($hardware | Where-Object Index -eq $disk.Number) | Select-Object -First 1
            # DeviceId/Number are not interchangeable across Storage Spaces; match stable serials only.
            $serial = "$($disk.SerialNumber)".Trim()
            $pd = @($physical | Where-Object { $serial -and "$($_.SerialNumber)".Trim() -eq $serial })
            $media = 'Unknown'; if ($pd.Count -eq 1) { $media = "$($pd[0].MediaType)" }
            $bus = "$($disk.BusType)"; $confidence = $(if ($pd.Count -eq 1) { 'hardware-reported' } else { 'partial hardware facts' })
            if ($bus -eq 'NVMe' -and $media -eq 'Unknown') { $media = 'SSD'; $confidence = 'SSD inferred from NVMe bus' }
            $volumes += [pscustomobject]@{ path = "$($v.DriveLetter):\"; diskId = "$($disk.Number)"; model = "$($disk.FriendlyName)"; hardwareModel = "$($hw.Model)"; media = $media; bus = $bus; filesystem = "$($v.FileSystem)"; capacityBytes = [long]$v.Size; freeBytes = [long]$v.SizeRemaining; isOS = ("$($v.DriveLetter):" -eq $env:SystemDrive); isBootDisk = [bool]$disk.IsBoot; isSystemDisk = [bool]$disk.IsSystem; health = "$($v.HealthStatus)"; diskHealth = "$($disk.HealthStatus)"; confidence = $confidence; controllerPath = "$($hw.PNPDeviceID)"; measuredReadMBps = $null; measuredWriteMBps = $null }
        } catch { $issues += "Volume $($v.DriveLetter): $($_.Exception.Message)" }
    }
    return [pscustomobject]@{ schema = 'de.storage.topology/v1'; at = [DateTime]::UtcNow.ToString('o'); volumes = $volumes; issues = $issues; limits = 'Negotiated PCIe/USB link speed, shared controllers, thermal state and sustained throughput are not measured. RAID/virtual disk media may remain unknown.' }
}
function Get-DEStorageRecommendations {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$Topology, [hashtable]$CustomUse = @{})
    $roles = @(); $pairs = @(); $facts = @($Topology.volumes)
    foreach ($v in $facts) {
        $rank = 0; $type = 'Unknown'; $why = @(); $use = @('Inspect hardware before assigning a performance-sensitive role')
        if ($v.media -eq 'SSD' -and $v.bus -eq 'NVMe') { $rank = 3; $type = 'NVMe SSD'; $use = @('OS candidate','Active development / AI workspace','Scratch and application caches'); $why += 'Solid-state NVMe usually favors random IO and active workloads.' }
        elseif ($v.media -eq 'SSD') { $rank = 2; $type = 'SSD'; $use = @('Applications','Active data','Secondary development workspace'); $why += 'Solid-state media favors random IO; connection speed remains unknown.' }
        elseif ($v.media -eq 'HDD') { $rank = 1; $type = 'HDD'; $use = @('Bulk storage / archive','Backup destination candidate'); $why += 'Rotating media generally favors sequential bulk storage over many small files.' }
        if ($v.bus -eq 'USB') { $use = @($use | Where-Object { $_ -ne 'OS candidate' }); $why += 'External USB: negotiated USB speed and bridge/controller bottlenecks need verification.' }
        if ($v.bus -in @('RAID','Spaces','Virtual','File Backed Virtual','iSCSI')) { $rank = 0; $why += 'Logical/pooled/network backing: do not infer physical device speed from this volume.' }
        if ($v.isOS) { $use = @('Current Windows OS'); $why += 'Keep the active Windows profile/system on its supported installation.' }
        $freePct = $(if ($v.capacityBytes -gt 0) { 100 * $v.freeBytes / $v.capacityBytes } else { 0 })
        $state = 'READY'
        if ($v.freeBytes -lt 5GB -or $freePct -lt 2) { $state = 'CRITICAL'; $why += 'Very low free space: review cleanup or relocation before adding workloads.' }
        elseif ($v.freeBytes -lt 20GB -or $freePct -lt 10) { $state = 'LOW SPACE'; $why += 'Limited operating headroom: reserve space for updates, caches and workload growth.' }
        if ($v.health -ne 'Healthy' -or $v.diskHealth -ne 'Healthy') { $state = 'HEALTH REVIEW'; $why += 'Unhealthy/unknown health: verify backup and investigate before migration.' }
        if ($CustomUse.ContainsKey($v.path)) { $use = @("Custom requested role: $($CustomUse[$v.path])") + $use; $why += 'Custom role is a preference; validate required capacity, endurance and throughput.' }
        $roles += [pscustomobject]@{ path = $v.path; diskId = $v.diskId; technology = $type; bus = $v.bus; model = $v.model; role = ($use -join '; '); reasons = ($why -join ' '); state = $state; freeGB = [math]::Round($v.freeBytes/1GB,2); rank = $rank; confidence = $v.confidence }
    }
    foreach ($from in $roles) { foreach ($to in $roles) {
        if ($from.path -eq $to.path) { continue }
        $same = ($from.diskId -eq $to.diskId); $score = [math]::Min($from.rank, $to.rank)
        $reason = 'Technology-based relative estimate only; no measured MB/s.'
        if ($same) { $score = 0; $reason = 'Same physical/logical disk: a cross-volume copy competes for device IO and provides no independent backup.' }
        elseif ($from.rank -eq 0 -or $to.rank -eq 0) { $score = 0; $reason = 'Media or physical backing unknown: no speed ranking can be defended.' }
        elseif ($from.rank -eq 1 -or $to.rank -eq 1) { $reason = 'HDD endpoint is a likely bottleneck, especially with many small files.' }
        elseif ($from.rank -eq 3 -and $to.rank -eq 3) { $reason = 'Separate NVMe SSDs are the strongest candidate pair among known technologies; controller lanes and real throughput remain unmeasured.' }
        if ($from.bus -eq 'USB' -or $to.bus -eq 'USB') { $score = [math]::Min($score,1); $reason += ' USB bridge/link speed unverified.' }
        if ($to.state -ne 'READY') { $score = 0; $reason += ' Destination needs capacity/health review.' }
        $pairs += [pscustomobject]@{ source = $from.path; destination = $to.path; candidateRank = $score; sameDisk = $same; assessment = $reason; measuredMBps = $null }
    } }
    return [pscustomobject]@{ schema = 'de.storage.recommendations/v1'; kind = 'drive-recommendations'; result = $(if ($Topology.issues.Count) { 'WARN' } else { 'PASS' }); roles = $roles; transfers = @($pairs | Sort-Object candidateRank -Descending); issues = @($Topology.issues); fileCount = $facts.Count; bytes = 0; summary = "$($facts.Count) volumes assessed using explainable hardware rules; transfer speed is estimated, not benchmarked."; limits = $Topology.limits; backupRule = 'A second partition is not an independent backup. Verify recoverability and retain separate/offline/offsite copies.' }
}

function Get-DEStorageVolumes {
    foreach ($drive in [IO.DriveInfo]::GetDrives()) {
        try {
            if ($drive.IsReady -and $drive.DriveType -eq 'Fixed') {
                $free = $drive.AvailableFreeSpace; $total = $drive.TotalSize
                [pscustomobject]@{ path = $drive.Name; label = $drive.VolumeLabel; format = $drive.DriveFormat; totalBytes = $total; freeBytes = $free; freeGB = [math]::Round($free / 1GB, 2); freePercent = [math]::Round(100 * $free / $total, 1); status = $(if ($free -lt 5GB -or $free / $total -lt 0.02) { 'CRITICAL' } elseif ($free -lt 20GB -or $free / $total -lt 0.1) { 'LOW' } else { 'OK' }) }
            }
        } catch { Write-Warning "Volume $($drive.Name): $($_.Exception.Message)" }
    }
}
function Get-DEStorageInventory {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Path, [ValidateRange(1,2000000)][int]$MaxFiles = 250000, [switch]$IncludeFiles, [switch]$ProtectDevelopment)
    $root = Resolve-DEStoragePath $Path
    if (-not [IO.Directory]::Exists($root)) { throw 'Scan a directory.' }
    $stack = New-Object 'System.Collections.Generic.Stack[string]'; $stack.Push($root)
    $files = New-Object 'System.Collections.Generic.List[object]'
    $largest = New-Object 'System.Collections.Generic.List[object]'
    $folders = @{}; $folders[$root] = [long]0
    $issues = New-Object 'System.Collections.Generic.List[object]'
    $count = 0; $skipped = 0; $complete = $true; $bytes = [long]0
    while ($stack.Count) {
        $dir = $stack.Pop()
        try {
            $null = Resolve-DEStoragePath $dir
            if ($ProtectDevelopment -and (([IO.Directory]::Exists((Join-Path $dir '.git'))) -or [IO.File]::Exists((Join-Path $dir 'pyvenv.cfg')))) { $skipped++; continue }
            $children = (New-Object IO.DirectoryInfo $dir).EnumerateFileSystemInfos()
            foreach ($entry in $children) {
                try {
                    $attrs = [int]$entry.Attributes
                    if (($attrs -band (0x400 -bor 0x1000 -bor 0x40000 -bor 0x400000)) -ne 0) { $skipped++; if ($issues.Count -lt 100) { $issues.Add([pscustomobject]@{ path = $entry.FullName; reason = 'link/offline/cloud skipped' }) }; continue }
                    if ($ProtectDevelopment -and $entry.Name -match '^(\.git|\.ssh|\.aws|\.azure|\.config|\.env($|\.)|node_modules|\.venv|venv|\.ollama|\.claude|\.codex)$') { $skipped++; continue }
                    if ($entry -is [IO.DirectoryInfo]) { $stack.Push($entry.FullName); $folders[$entry.FullName] = [long]0; continue }
                    $count++; $bytes += $entry.Length
                    $row = [pscustomobject]@{ path = $entry.FullName; relative = $entry.FullName.Substring($root.Length).TrimStart([char[]]'\/'); length = [long]$entry.Length; modifiedTicks = $entry.LastWriteTimeUtc.Ticks; createdTicks = $entry.CreationTimeUtc.Ticks; attributes = $attrs }
                    if ($IncludeFiles) { $files.Add($row) }
                    $largest.Add($row); if ($largest.Count -gt 200) { $keep = @($largest | Sort-Object length -Descending | Select-Object -First 100); $largest.Clear(); foreach ($k in $keep) { $largest.Add($k) } }
                    $parent = $dir
                    while ($parent -and (Test-DEStorageWithin $parent $root)) { $folders[$parent] += $entry.Length; if ($parent -eq $root) { break }; $parent = [IO.Path]::GetDirectoryName($parent) }
                    if ($count % 1000 -eq 0) { Write-DEStorageProgress 0 0 "Scanned $count files; $([math]::Round($bytes/1GB,2)) GB logical data" }
                    if ($count -ge $MaxFiles) { $complete = $false; break }
                } catch { $complete = $false; if ($issues.Count -lt 100) { $issues.Add([pscustomobject]@{ path = $entry.FullName; reason = $_.Exception.Message }) } }
            }
        } catch { $complete = $false; if ($issues.Count -lt 100) { $issues.Add([pscustomobject]@{ path = $dir; reason = $_.Exception.Message }) } }
        if ($count -ge $MaxFiles) { break }
    }
    $folderRows = @($folders.Keys | ForEach-Object { [pscustomobject]@{ path = $_; bytes = $folders[$_] } } | Sort-Object bytes -Descending | Select-Object -First 100)
    return [pscustomobject]@{ schema = 'de.storage.inventory/v1'; kind = 'inventory'; root = $root; at = [DateTime]::UtcNow.ToString('o'); complete = $complete; fileCount = $count; bytes = $bytes; skipped = $skipped; issues = @($issues.ToArray()); files = @($files.ToArray()); largest = @($largest | Sort-Object length -Descending | Select-Object -First 100); folders = $folderRows; result = $(if ($complete -and -not $skipped) { 'PASS' } else { 'WARN' }); summary = "$count files, $skipped excluded; logical bytes, not reclaimable/allocated space" }
}
function Get-DEStorageCleanupRoots {
    # Fixed, narrow Windows locations. No wildcard profiles and no arbitrary cleanup root parameter.
    if ($env:OS -ne 'Windows_NT') { return @() }
    $rows = @()
    if ($env:WINDIR) { $rows += [pscustomobject]@{ id = 'windows-temp'; path = (Join-Path $env:WINDIR 'Temp'); days = 7 } }
    if ($env:LOCALAPPDATA) {
        $rows += [pscustomobject]@{ id = 'user-temp'; path = (Join-Path $env:LOCALAPPDATA 'Temp'); days = 7 }
        $rows += [pscustomobject]@{ id = 'crash-dumps'; path = (Join-Path $env:LOCALAPPDATA 'CrashDumps'); days = 30 }
    }
    return $rows
}
function New-DEStorageCleanupPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][ValidateSet('windows-temp','user-temp','crash-dumps')][string[]]$Category)
    $entries = New-Object 'System.Collections.Generic.List[object]'; $warnings = @(); $bytes = [long]0
    foreach ($cat in @($Category | Select-Object -Unique)) {
        $spec = @(Get-DEStorageCleanupRoots | Where-Object id -eq $cat) | Select-Object -First 1
        if (-not $spec -or -not [IO.Directory]::Exists($spec.path)) { $warnings += "$cat unavailable"; continue }
        $scan = Get-DEStorageInventory -Path $spec.path -IncludeFiles -ProtectDevelopment
        if (-not $scan.complete) { $warnings += "$cat partial scan" }; if ($scan.skipped) { $warnings += "$cat protected/link/cloud entries skipped" }
        $cutoff = [DateTime]::UtcNow.AddDays(-$spec.days).Ticks
        foreach ($f in $scan.files) {
            if ($f.modifiedTicks -ge $cutoff -or $f.createdTicks -ge $cutoff -or ($f.attributes -band (1 -bor 4)) -ne 0) { continue }
            if ($cat -eq 'crash-dumps' -and [IO.Path]::GetExtension($f.path) -ne '.dmp') { continue }
            $entries.Add([pscustomobject]@{ id = [guid]::NewGuid().ToString('N'); category = $cat; root = $scan.root; path = $f.path; length = $f.length; modifiedTicks = $f.modifiedTicks; createdTicks = $f.createdTicks }); $bytes += $f.length
        }
    }
    return [pscustomobject]@{ schema = 'de.storage.cleanup-plan/v1'; kind = 'cleanup-plan'; machine = $env:COMPUTERNAME; at = [DateTime]::UtcNow.ToString('o'); entries = @($entries.ToArray()); warnings = $warnings; fileCount = $entries.Count; bytes = $bytes; result = 'PLANNED'; summary = "$($entries.Count) old temporary files; $bytes logical bytes estimated. Deletion cannot be undone." }
}
function Invoke-DEStorageCleanup {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)]$Plan, [Parameter(Mandatory = $true)][string[]]$SelectedId)
    if ($Plan.schema -ne 'de.storage.cleanup-plan/v1' -or $Plan.machine -ne $env:COMPUTERNAME -or [math]::Abs(([DateTime]::UtcNow - [DateTime]::Parse($Plan.at).ToUniversalTime()).TotalHours) -gt 24) { throw 'Cleanup plan is invalid, stale or belongs to another machine.' }
    $rows = @($Plan.entries | Where-Object { $_.id -in $SelectedId })
    if (-not $rows.Count -or @($SelectedId | Where-Object { $_ -notin @($rows.id) }).Count) { throw 'Select valid planned file IDs.' }
    $space = @{}
    foreach ($f in $rows) {
        try { $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($f.path)); if (-not $space.ContainsKey($drive.Name)) { $space[$drive.Name] = [pscustomobject]@{ volume = $drive.Name; beforeFreeBytes = $drive.AvailableFreeSpace; afterFreeBytes = $null; observedDeltaBytes = $null } } } catch { }
    }
    $out = New-Object 'System.Collections.Generic.List[object]'; $removed = [long]0; $done = 0
    foreach ($f in $rows) {
        $state = 'SKIPPED'; $reason = ''; $stream = $null
        try {
            $path = Resolve-DEStoragePath $f.path
            $spec = @(Get-DEStorageCleanupRoots | Where-Object id -eq $f.category) | Select-Object -First 1
            if (-not $spec) { throw 'Cleanup category is no longer allowed.' }
            $root = Resolve-DEStoragePath $spec.path
            if ($root -ne $f.root -or -not (Test-DEStorageWithin $path $root) -or $path -eq $root) { throw 'File escaped the allowed cleanup root.' }
            $walk = [IO.Path]::GetDirectoryName($path)
            while (Test-DEStorageWithin $walk $root) {
                if ([IO.Directory]::Exists((Join-Path $walk '.git')) -or [IO.File]::Exists((Join-Path $walk 'pyvenv.cfg')) -or [IO.Path]::GetFileName($walk) -match '^(\.git|\.ssh|\.aws|\.azure|\.config|node_modules|\.venv|venv|\.ollama|\.claude|\.codex)$') { throw 'Protected development/configuration subtree.' }
                if ($walk -eq $root) { break }; $walk = [IO.Path]::GetDirectoryName($walk)
            }
            if ([IO.Path]::GetFileName($path) -match '^\.env($|\.)') { throw 'Protected configuration file.' }
            if ($f.category -eq 'crash-dumps' -and [IO.Path]::GetExtension($path) -ne '.dmp') { throw 'Only .dmp crash dumps are allowed.' }
            $info = New-Object IO.FileInfo $path
            if (-not $info.Exists -or $info.Length -ne $f.length -or $info.LastWriteTimeUtc.Ticks -ne $f.modifiedTicks -or $info.CreationTimeUtc.Ticks -ne $f.createdTicks -or $info.LastWriteTimeUtc -ge [DateTime]::UtcNow.AddDays(-$spec.days) -or $info.CreationTimeUtc -ge [DateTime]::UtcNow.AddDays(-$spec.days) -or ([int]$info.Attributes -band (1 -bor 4)) -ne 0) { throw 'File changed, is too new, or is protected; rescan.' }
            if ($PSCmdlet.ShouldProcess($path, 'Permanently delete reviewed old temporary file')) {
                Assert-DEStorageWrite
                Remove-DEStorageVerifiedFile -Path $path -Length $f.length -ModifiedTicks $f.modifiedTicks -CreatedTicks $f.createdTicks
                $state = 'DELETED'; $removed += $f.length
            } else { $state = 'PLANNED' }
        } catch { $state = 'SKIPPED'; $reason = $_.Exception.Message }
        finally { if ($stream) { $stream.Dispose() } }
        $out.Add([pscustomobject]@{ path = $f.path; state = $state; reason = $reason; bytes = $f.length }); $done++; Write-DEStorageProgress $done $rows.Count 'Temporary cleanup'
    }
    $failed = @($out | Where-Object state -eq 'SKIPPED').Count
    $planned = @($out | Where-Object state -eq 'PLANNED').Count
    foreach ($key in @($space.Keys)) { try { $drive = New-Object IO.DriveInfo $key; $space[$key].afterFreeBytes = $drive.AvailableFreeSpace; $space[$key].observedDeltaBytes = $space[$key].afterFreeBytes - $space[$key].beforeFreeBytes } catch { } }
    $r = [pscustomobject]@{ volumeObservations = @($space.Values); schema = 'de.storage.cleanup-result/v1'; kind = 'cleanup'; at = [DateTime]::UtcNow.ToString('o'); result = $(if ($WhatIfPreference -or $planned -eq $rows.Count) { 'PLANNED' } elseif ($failed) { 'WARN' } else { 'PASS' }); fileCount = @($out | Where-Object state -eq 'DELETED').Count; bytes = $removed; files = @($out.ToArray()); summary = "$removed logical bytes deleted; $failed skipped. Actual volume free-space delta may differ." }
    $r = Save-DEStorageReceipt $r; Add-DEStorageEvidence storage.cleanup $r; return $r
}
function Assert-DEStorageRelocationRoot {
    param([string]$Path, [switch]$AllowMissing)
    $full = Resolve-DEStoragePath $Path -AllowMissing:$AllowMissing
    if ($full -eq [IO.Path]::GetPathRoot($full)) { throw 'A volume root cannot be relocated.' }
    foreach ($base in @($env:WINDIR, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:ProgramData)) {
        if ($base -and (Test-DEStorageWithin $full ([IO.Path]::GetFullPath($base)))) { throw 'Windows/program/managed data folders cannot be relocated.' }
    }
    if ($env:OS -eq 'Windows_NT' -and $env:USERPROFILE) {
        $usersRoot = [IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($env:USERPROFILE))
        if ((Test-DEStorageWithin $full $usersRoot) -and [IO.Path]::GetDirectoryName($full) -eq $usersRoot) { throw 'An entire Windows user profile cannot be relocated.' }
        $relative = $full.Substring([math]::Min($usersRoot.Length, $full.Length)).TrimStart([char[]]'\/')
        if ((Test-DEStorageWithin $full $usersRoot) -and $relative -match '^[^\/]+[\/]AppData([\/]|$)') { throw 'User application settings cannot be relocated.' }
    }
    foreach ($base in @($env:USERPROFILE, $env:LOCALAPPDATA, $env:APPDATA)) {
        if ($base -and ((Test-DEStorageWithin ([IO.Path]::GetFullPath($base)) $full) -or (($base -ne $env:USERPROFILE) -and (Test-DEStorageWithin $full ([IO.Path]::GetFullPath($base)))))) { throw 'An active profile or application settings folder cannot be relocated.' }
    }
    if ([IO.Path]::GetFileName($full) -match '^(Windows|Users|Program Files( \(x86\))?|ProgramData|AppData|\.ssh|\.aws|\.azure|\.config|\.ollama|\.claude|\.codex)$') { throw 'Protected system/profile/configuration folder.' }
    return $full
}
function New-DEStorageRelocationPlan {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Source, [Parameter(Mandatory = $true)][string]$Destination)
    $src = Assert-DEStorageRelocationRoot $Source
    $dst = Assert-DEStorageRelocationRoot $Destination -AllowMissing
    if ((Test-DEStorageWithin $src $dst) -or (Test-DEStorageWithin $dst $src)) { throw 'Source and destination must be separate trees.' }
    $scan = Get-DEStorageInventory $src -IncludeFiles
    if (-not $scan.complete -or $scan.skipped -or $scan.issues.Count) { throw 'Relocation requires a complete scan with no links, offline/cloud entries, or access errors.' }
    if (-not $scan.fileCount) { throw 'Source contains no files.' }
    # A receipt is file-content preservation, not a full filesystem backup (ACLs/ADS/hardlinks are not copied).
    foreach ($file in $scan.files) {
        if ($env:OS -eq 'Windows_NT') {
            $streams = @(Get-Item -LiteralPath $file.path -Stream * -ErrorAction Stop)
            if (@($streams | Where-Object Stream -ne ':$DATA').Count) { throw "Alternate data streams need a backup tool: $($file.path)" }
            if (([int]$file.attributes -band 0x4000) -ne 0) { throw 'EFS-encrypted files require an EFS-aware backup.' }
        }
    }
    $drive = New-Object IO.DriveInfo ([IO.Path]::GetPathRoot($dst))
    if (-not $drive.IsReady -or $drive.DriveType -ne 'Fixed' -or $drive.AvailableFreeSpace -lt ($scan.bytes + 1GB)) { throw 'Destination must be a ready fixed volume with enough free space plus 1 GB reserve.' }
    return [pscustomobject]@{ schema = 'de.storage.relocation-plan/v1'; kind = 'relocation-plan'; machine = $env:COMPUTERNAME; at = [DateTime]::UtcNow.ToString('o'); source = $src; destination = $dst; files = $scan.files; directories = @($scan.folders.path); fileCount = $scan.fileCount; bytes = $scan.bytes; result = 'PLANNED'; summary = "Copy $($scan.fileCount) files ($($scan.bytes) bytes); SHA-256 verify; source remains. ACLs/hardlink relationships are not preserved." }
}
function Get-DEStorageFileHash {
    param([string]$Path)
    $null = Resolve-DEStoragePath $Path
    $stream = [IO.File]::Open($Path, 'Open', 'Read', 'Read'); $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}
function Test-DEStorageRelocation {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)]$Receipt)
    if ($Receipt.schema -ne 'de.storage.relocation-result/v1' -or $Receipt.machine -ne $env:COMPUTERNAME -or $Receipt.result -ne 'PASS') { throw 'A successful local relocation receipt is required.' }
    $src = Assert-DEStorageRelocationRoot $Receipt.source; $dst = Assert-DEStorageRelocationRoot $Receipt.destination
    if ((Test-DEStorageWithin $src $dst) -or (Test-DEStorageWithin $dst $src)) { throw 'Overlapping relocation trees.' }
    $scan = Get-DEStorageInventory $src -IncludeFiles; $destScan = Get-DEStorageInventory $dst -IncludeFiles
    if (-not $scan.complete -or $scan.skipped -or -not $destScan.complete -or $destScan.skipped -or $scan.fileCount -ne $Receipt.fileCount -or $destScan.fileCount -ne $Receipt.fileCount) { throw 'Source/destination changed or became unreadable; removal refused.' }
    $index = @{}; foreach ($f in $Receipt.files) { if ($index.ContainsKey($f.relative)) { throw 'Duplicate receipt path.' }; $index[$f.relative] = $f }
    foreach ($f in $scan.files) {
        $old = $index[$f.relative]; if (-not $old -or $old.relative -match '(^|[\/])\.\.([\/]|$)' -or [IO.Path]::IsPathRooted($old.relative)) { throw 'Receipt paths do not match source.' }
        $target = Join-Path $dst $f.relative
        if (-not (Test-DEStorageWithin ([IO.Path]::GetFullPath($target)) $dst) -or $f.length -ne $old.length -or (Get-DEStorageFileHash $f.path) -ne $old.sha256 -or (Get-DEStorageFileHash $target) -ne $old.sha256) { throw "SHA-256 verification failed: $($f.relative)" }
    }
    return $true
}
function Invoke-DEStorageRelocation {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)]$Plan)
    if ($Plan.schema -ne 'de.storage.relocation-plan/v1' -or $Plan.machine -ne $env:COMPUTERNAME) { throw 'Invalid relocation plan.' }
    if ([math]::Abs(([DateTime]::UtcNow - [DateTime]::Parse($Plan.at).ToUniversalTime()).TotalHours) -gt 24) { throw 'Relocation plan expired; preview again.' }
    # Regenerate and compare the complete reviewed file set; new/changed data requires a fresh preview.
    $fresh = New-DEStorageRelocationPlan -Source $Plan.source -Destination $Plan.destination
    if ($fresh.fileCount -ne $Plan.fileCount -or @($Plan.files).Count -ne $Plan.fileCount) { throw 'Source file set changed after preview; preview again.' }
    $reviewed = @{}
    foreach ($f in $Plan.files) { if ($reviewed.ContainsKey($f.relative)) { throw 'Duplicate reviewed file path.' }; $reviewed[$f.relative] = $f }
    foreach ($f in $fresh.files) {
        $old = $reviewed[$f.relative]
        if (-not $old -or $old.length -ne $f.length -or $old.modifiedTicks -ne $f.modifiedTicks -or $old.createdTicks -ne $f.createdTicks) { throw 'Source changed after preview; preview again.' }
    }
    if (-not $PSCmdlet.ShouldProcess($fresh.destination, "Copy and hash-verify $($fresh.fileCount) files; retain source")) { return $fresh }
    Assert-DEStorageWrite
    $dst = $fresh.destination; $src = $fresh.source
    $existing = $null
    if ([IO.Directory]::Exists($dst)) {
        $existing = Get-DEStorageInventory $dst -IncludeFiles
        if (-not $existing.complete -or $existing.skipped) { throw 'Destination has excluded/unreadable content.' }
        if (@($existing.files | Where-Object { $_.relative -notin @($fresh.files.relative) }).Count) { throw 'Destination contains unrelated files. Choose another folder.' }
    }
    [void][IO.Directory]::CreateDirectory($dst)
    $rows = New-Object 'System.Collections.Generic.List[object]'; $done = 0
    foreach ($f in $fresh.files) {
        $sourcePath = Resolve-DEStoragePath $f.path
        $target = Join-Path $dst $f.relative; $null = Resolve-DEStoragePath $target -AllowMissing
        [void][IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))
        $hash = Get-DEStorageFileHash $sourcePath
        if ([IO.File]::Exists($target)) {
            if ((Get-DEStorageFileHash $target) -ne $hash) { throw "Existing destination file differs; overwrite refused: $target" }
        } else {
            $stage = Join-Path ([IO.Path]::GetDirectoryName($dst)) ('.DE-transfer-' + [guid]::NewGuid().ToString('N') + '.partial')
            $null = Resolve-DEStoragePath $stage -AllowMissing
            $input = [IO.File]::Open($sourcePath, 'Open', 'Read', 'Read'); $output = $null
            try {
                $output = [IO.File]::Open($stage, 'CreateNew', 'Write', 'None')
                $buffer = New-Object byte[] (1MB)
                while (($read = $input.Read($buffer, 0, $buffer.Length)) -gt 0) { $output.Write($buffer, 0, $read) }
                $output.Flush()
            } catch { throw }
            finally { if ($output) { $output.Dispose() }; $input.Dispose() }
            if ((Get-DEStorageFileHash $stage) -ne $hash) { throw 'Staged copy failed SHA-256 verification; source retained.' }
            $null = Resolve-DEStoragePath $target -AllowMissing
            [IO.File]::Move($stage, $target)
            [IO.File]::SetLastWriteTimeUtc($target, (New-Object IO.FileInfo $sourcePath).LastWriteTimeUtc)
        }
        if ((Get-DEStorageFileHash $sourcePath) -ne $hash -or (Get-DEStorageFileHash $target) -ne $hash) { throw "File changed or copy did not verify: $sourcePath" }
        $rows.Add([pscustomobject]@{ relative = $f.relative; length = $f.length; sha256 = $hash }); $done++; Write-DEStorageProgress $done $fresh.fileCount 'Copy and SHA-256 verification'
    }
    $r = [pscustomobject]@{ schema = 'de.storage.relocation-result/v1'; kind = 'relocation'; machine = $env:COMPUTERNAME; at = [DateTime]::UtcNow.ToString('o'); source = $src; destination = $dst; files = @($rows.ToArray()); fileCount = $rows.Count; bytes = $fresh.bytes; result = 'PASS'; summary = "$($rows.Count) files copied and SHA-256 verified; source retained." }
    $null = Test-DEStorageRelocation $r
    $r = Save-DEStorageReceipt $r; Add-DEStorageEvidence storage.relocation $r; return $r
}
function Remove-DEStorageRelocationSource {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)]$Receipt, [Parameter(Mandatory = $true)][string]$ConfirmSource)
    if ($ConfirmSource -cne $Receipt.source) { throw 'Type the exact source path to authorize removal.' }
    $null = Test-DEStorageRelocation $Receipt
    if (-not $PSCmdlet.ShouldProcess($Receipt.source, 'Permanently remove verified source files (cannot undo)')) { return }
    Assert-DEStorageWrite
    $removed = 0
    foreach ($f in $Receipt.files) {
        $path = Join-Path $Receipt.source $f.relative; $target = Join-Path $Receipt.destination $f.relative
        $null = Resolve-DEStoragePath $path; $null = Resolve-DEStoragePath $target
        $destinationLock = [IO.File]::Open($target, 'Open', 'Read', 'Read'); $sha = [Security.Cryptography.SHA256]::Create()
        try {
            $destinationHash = ([BitConverter]::ToString($sha.ComputeHash($destinationLock))).Replace('-', '').ToLowerInvariant()
            if ($destinationHash -ne $f.sha256) { throw 'Destination changed during removal; stopped. Remaining source retained.' }
            Remove-DEStorageVerifiedFile -Path $path -Length $f.length -Hash $f.sha256
        } finally { $sha.Dispose(); $destinationLock.Dispose() }
        $removed++; Write-DEStorageProgress $removed $Receipt.fileCount 'Removing verified source files'
    }
    # No recursive folder delete: unexpected/new files and directories remain intact.
    $r = [pscustomobject]@{ kind = 'source-removal'; result = 'PASS'; at = [DateTime]::UtcNow.ToString('o'); fileCount = $removed; bytes = $Receipt.bytes; summary = "$removed verified source files removed; directories and new files retained." }
    $r = Save-DEStorageReceipt $r; Add-DEStorageEvidence storage.source-removal $r; return $r
}
function Invoke-DEStorageServicing {
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][ValidateSet('AnalyzeComponentStore','CheckHealth','ScanHealth','RestoreHealth','StartComponentCleanup','ResetBase')][string]$Action, [switch]$AcknowledgeResetBase)
    if ($env:OS -ne 'Windows_NT') { throw 'DISM servicing requires Windows.' }
    if ($Action -eq 'ResetBase' -and -not $AcknowledgeResetBase) { throw 'ResetBase prevents uninstalling existing update packages; explicit acknowledgement required.' }
    if (-not $PSCmdlet.ShouldProcess('Windows online image', "DISM $Action")) { return [pscustomobject]@{ kind = 'servicing'; result = 'PLANNED'; summary = $Action } }
    Assert-DEStorageWrite
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent(); $principal = New-Object Security.Principal.WindowsPrincipal $identity
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run elevated for DISM.' }
    if ($Action -in @('RestoreHealth','StartComponentCleanup','ResetBase') -and (Test-Path 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending')) { throw 'Restart pending; restart Windows before servicing.' }
    $args = @('/Online','/Cleanup-Image',"/$Action")
    if ($Action -eq 'ResetBase') { $args = @('/Online','/Cleanup-Image','/StartComponentCleanup','/ResetBase') }
    # No user-controlled executable or arbitrary command arguments; never stop servicing mid-operation.
    $output = @(& (Join-Path $env:WINDIR 'System32\dism.exe') @args 2>&1); $code = $LASTEXITCODE
    $r = [pscustomobject]@{ kind = 'servicing'; result = $(if ($code -in @(0,3010)) { 'PASS' } else { 'FAIL' }); at = [DateTime]::UtcNow.ToString('o'); exitCode = $code; restartRequired = ($code -eq 3010); action = $Action; fileCount = 0; bytes = 0; output = @($output | ForEach-Object { "$_" }); summary = "DISM $Action exit $code" }
    $r = Save-DEStorageReceipt $r; Add-DEStorageEvidence storage.servicing $r; return $r
}
Export-ModuleMember -Function Get-DEStorageTopology, Get-DEStorageRecommendations, Save-DEStorageReceipt, Add-DEStorageEvidence, Get-DEStorageVolumes, Get-DEStorageInventory, Get-DEStorageCleanupRoots, New-DEStorageCleanupPlan, Invoke-DEStorageCleanup, New-DEStorageRelocationPlan, Invoke-DEStorageRelocation, Test-DEStorageRelocation, Remove-DEStorageRelocationSource, Invoke-DEStorageServicing
