#Requires -Version 5.1
<#
.SYNOPSIS
    DE boot rescue menu. Starts from WinPE (startnet.cmd) or by hand: powershell -ExecutionPolicy Bypass -File Start-DERescue.ps1

.DESCRIPTION
    Works with no network and no DE Tech Tool. Each step records what it did in a handoff that DE Tech Tool picks up
    on the next boot of this device and that can be sent to the Intelligence Hub. Recovery passwords and the Hub
    signing secret are typed when needed, used in memory, and never written anywhere.
#>
param([string]$Technician, [string]$HubUrl, [string]$HubAccountId, [switch]$NoClear)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })
Import-Module (Join-Path $here 'DE.Rescue.psm1') -Force -DisableNameChecking

# Defaults baked in by New-DERescueMedia (technician, Hub URL, optionally one client's Hub account number). Never secrets.
$cfgPath = Join-Path $here 'rescue.config.json'
if (Test-Path -LiteralPath $cfgPath) { $cfg = Get-Content -LiteralPath $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json; if (-not $Technician -and $cfg.PSObject.Properties['technician']) { $Technician = $cfg.technician }; if (-not $HubUrl -and $cfg.PSObject.Properties['hubUrl']) { $HubUrl = $cfg.hubUrl }; if (-not $HubAccountId -and $cfg.PSObject.Properties['hubAccountId']) { $HubAccountId = "$($cfg.hubAccountId)" } }

function Read-Choice { param([string]$Prompt, [string]$Default) $a = Read-Host "$Prompt$(if ($Default) { " [$Default]" })"; if (-not $a) { return $Default }; return $a.Trim() }
function Show-Title { param([string]$Text) if (-not $NoClear) { Clear-Host }; Write-Host "DE Boot Rescue $(Get-DERescueVersion)   $Text" -ForegroundColor Cyan; Write-Host ('-' * 72) }
function Pause-Menu { $null = Read-Host 'Enter to go back' }

$hw = Get-DERescueHardware
$serial = $hw.serial
while ($true) { try { $null = ConvertTo-DEDeviceKey -Manufacturer $hw.manufacturer -Serial $serial; break } catch { Write-Host $_.Exception.Message -ForegroundColor Yellow; $serial = Read-Host 'Serial from the chassis sticker' } }
if (-not $Technician) { $Technician = Read-Choice 'Technician (your DE username)' 'jrpetro' }
$handoff = New-DEHandoff -Serial $serial -Manufacturer $hw.manufacturer -Model $hw.model -Technician $Technician -Version (Get-DERescueVersion)
$state = @{ windows = $null; destination = $null; vols = @(); stale = $true; tzSet = $false }
try { $n = Install-DERescueRootCertificates; if ($n) { Write-Host "Added $n root certificate(s) for HTTPS." -ForegroundColor Gray } } catch { $null = Write-DERescueLog "certificates: $($_.Exception.Message)" }

function Update-Windows {
    # Reads the offline Windows once, and again only after something changed it (unlock, repair): loading hives on
    # every menu pass is slow and leaves more chances for a stuck hive.
    if (-not $state.stale) { return $state.vols }
    $vols = @(Get-DERescueVolumes)
    $w = Find-DEWindowsVolume -Volumes $vols
    if ($w) {
        $info = Get-DERescueOfflineInfo -Drive $w.drive
        $state.windows = $info
        $handoff.device.hostname = $info.hostname; $handoff.device.osBuild = $info.osBuild; $handoff.device.osDisplayVersion = $info.osDisplayVersion
        $handoff.windows = [ordered]@{ drive = $w.drive; bitlocker = $w.bitlocker; joinType = $info.joinType; jumpcloudAgent = [bool]$info.jumpcloudAgent; pendingUpdates = [bool]$info.pendingUpdates }
        if (-not $state.tzSet) { try { $tz = Set-DERescueTimeZone -Drive $w.drive; if ($tz) { $state.tzSet = $true } } catch { $null = Write-DERescueLog "time zone: $($_.Exception.Message)" } }
    } else {
        $locked = @($vols | Where-Object { $_.bitlocker -eq 'locked' })
        $handoff.windows = [ordered]@{ drive = $null; bitlocker = $(if ($locked.Count) { 'locked' } else { 'none' }); joinType = $null; jumpcloudAgent = $null; pendingUpdates = $null }
    }
    $state.vols = $vols; $state.stale = $false
    return $vols
}
function Read-Index {
    <# A number from 1 to Count, or $null: '0' or text must not silently pick the last item. #>
    param([string]$Prompt, [int]$Count, [string]$Default = '1')
    $a = Read-Choice $Prompt $Default
    $n = 0; if (-not [int]::TryParse($a, [ref]$n) -or $n -lt 1 -or $n -gt $Count) { Write-Host "Choose 1 to $Count." -ForegroundColor Yellow; return $null }
    return $n - 1
}
function Select-Destination {
    $d = @(Get-DERescueDestinations -WindowsDrive $(if ($state.windows) { $state.windows.drive }))
    if (-not $d.Count) { Write-Host 'No writable drive found. Plug in a USB drive (NTFS or exFAT for files over 4 GB) and try again.' -ForegroundColor Yellow; return $null }
    $i = 1; foreach ($v in $d) { Write-Host ("  {0}. {1} {2,-12} {3,-6} {4,8} GB free{5}" -f $i, $v.drive, $v.label, $v.fileSystem, $v.freeGB, $(if ($v.fat32) { '  (FAT32: 4 GB file limit)' })); $i++ }
    $i = Read-Index 'Save to which drive (number)' $d.Count; if ($null -eq $i) { return $null }
    $pick = $d[$i]; $state.destination = $pick; return $pick
}

while ($true) {
    try { $vols = @(Update-Windows) } catch { $vols = @(); $state.stale = $true; Write-Host "Could not read the disks: $($_.Exception.Message)" -ForegroundColor Red; $null = Write-DERescueLog "read disks: $($_.Exception.Message)" }
    Show-Title "$($hw.manufacturer) $($hw.model)   serial $serial   technician $Technician"
    foreach ($v in $vols) { Write-Host ("  {0} {1,-14} {2,-6} {3,8} GB  BitLocker {4,-9} {5}" -f $v.drive, $v.label, $v.fileSystem, $v.sizeGB, $v.bitlocker, $(if ($v.hasWindows) { '<- Windows' } elseif ($v.isBootMedia) { '(rescue media)' })) }
    if ($state.windows) { $w = $state.windows; Write-Host ("`n  Windows on {0}: {1} {2} build {3}, {4}; JumpCloud agent {5}; stuck updates {6}" -f $w.drive, $w.hostname, $w.product, $w.osBuild, $w.joinType, $(if ($w.jumpcloudAgent) { 'yes' } else { 'no' }), $(if ($w.pendingUpdates) { 'YES' } else { 'no' })) }
    Write-Host "`n  1. Unlock a BitLocker drive (type the recovery password)`n  2. Back up user profiles to USB`n  3. Export drivers to USB`n  4. Disk health`n  5. Repair boot files (bcdboot)`n  6. Revert stuck updates`n  7. Save handoff for DE Tech Tool (and send to the Hub)`n  8. Command prompt`n  9. Restart    0. Shut down"
    $c = Read-Choice "`nChoose" ''
    try {
        switch ($c) {
            '1' {
                $locked = @($vols | Where-Object { $_.bitlocker -eq 'locked' })
                if (-not $locked.Count) { Write-Host 'No locked BitLocker drive.'; Pause-Menu; break }
                $drv = Read-Choice 'Drive to unlock' $locked[0].drive
                $kid = Invoke-DERescueNative -FilePath 'manage-bde.exe' -Arguments @('-protectors', '-get', $drv, '-Type', 'RecoveryPassword')
                Write-Host (@($kid.Output | Where-Object { $_ -match 'ID:' }) -join "`n") -ForegroundColor Gray
                Write-Host 'Match the key ID above with the one in JumpCloud (Device > Security) or wherever the key is kept.'
                $pw = $null
                try { $pw = Read-Host 'Recovery password (48 digits; not shown, not saved)' -AsSecureString; $r = Unlock-DERescueVolume -Drive $drv -RecoveryPassword $pw -Confirm:$false }
                finally { if ($pw) { $pw.Dispose() } }
                $state.stale = $true
                $null = Add-DEHandoffAction -Handoff $handoff -Action 'unlock' -Result 'PASS' -Detail "$drv unlocked with a recovery password (not recorded)"
                Write-Host "$drv $r." -ForegroundColor Green; Pause-Menu
            }
            '2' {
                if (-not $state.windows) { Write-Host 'No readable Windows volume (unlock it first).' -ForegroundColor Yellow; Pause-Menu; break }
                $profiles = @($state.windows.profiles | Where-Object { $_.exists })
                $i = 1; foreach ($p in $profiles) { Write-Host ("  {0}. {1,-24} {2,-16} {3}" -f $i, $p.name, $p.kind, $p.sid); $i++ }
                $sel = Read-Choice 'Profiles to copy (numbers separated by commas, or all)' 'all'
                $chosen = $(if ($sel -eq 'all') { $profiles } else { @($sel -split ',' | ForEach-Object { $k = 0; if ([int]::TryParse($_.Trim(), [ref]$k) -and $k -ge 1 -and $k -le $profiles.Count) { $profiles[$k - 1] } }) })
                if (-not @($chosen).Count) { Write-Host 'Nothing chosen.'; Pause-Menu; break }
                $dest = Select-Destination; if (-not $dest) { Pause-Menu; break }
                foreach ($p in $chosen) {
                    Write-Host "Copying $($p.name) ..."
                    try {
                        # free space is re-read for every profile so several copies cannot overfill the drive
                        $free = $(try { [long](Get-Volume -DriveLetter $dest.drive.TrimEnd(':') -ErrorAction Stop).SizeRemaining } catch { [long]$dest.freeBytes })
                        $b = Backup-DERescueProfile -ProfilePath $p.path -DestinationRoot "$($dest.drive)\" -Serial $serial -DestinationFreeBytes $free -DestinationFat32:([bool]$dest.fat32) -Confirm:$false
                        $null = Add-DEHandoffAction -Handoff $handoff -Action 'profile-backup' -Result $b.result -Detail "$($p.name): $($b.detail)" -Path $b.path -ManifestSha256 $b.manifestSha256 -Files $b.files -Bytes $b.bytes
                        Write-Host "  $($b.result): $($b.detail)" -ForegroundColor $(if ($b.result -eq 'PASS') { 'Green' } else { 'Yellow' })
                    } catch { $null = Add-DEHandoffAction -Handoff $handoff -Action 'profile-backup' -Result 'FAIL' -Detail "$($p.name): $($_.Exception.Message)"; Write-Host "  FAIL: $($_.Exception.Message)" -ForegroundColor Red }
                }
                Pause-Menu
            }
            '3' {
                if (-not $state.windows) { Write-Host 'No readable Windows volume.' -ForegroundColor Yellow; Pause-Menu; break }
                $dest = Select-Destination; if (-not $dest) { Pause-Menu; break }
                $e = Export-DERescueDrivers -WindowsDrive $state.windows.drive -DestinationRoot "$($dest.drive)\" -Serial $serial -Confirm:$false
                $null = Add-DEHandoffAction -Handoff $handoff -Action 'driver-export' -Result $e.result -Detail $e.detail -Path $e.path -Files $e.files
                Write-Host "$($e.result): $($e.detail)"; Pause-Menu
            }
            '4' {
                $disks = @(Get-DERescueDiskHealth)
                $disks | Format-Table name, mediaType, health, sizeGB, wear, temperature, readErrors -AutoSize | Out-Host
                $handoff.disks = @($disks | ForEach-Object { [ordered]@{ name = $_.name; mediaType = $_.mediaType; health = $_.health; sizeGB = $_.sizeGB } })
                $bad = @($disks | Where-Object { "$($_.health)" -ne 'Healthy' })
                $null = Add-DEHandoffAction -Handoff $handoff -Action 'disk-health' -Result $(if ($bad.Count) { 'WARN' } else { 'PASS' }) -Detail (@($disks | ForEach-Object { "$($_.name): $($_.health)" }) -join '; ')
                Pause-Menu
            }
            { $_ -in @('5', '6') } {
                if (-not $state.windows) { Write-Host 'No readable Windows volume.' -ForegroundColor Yellow; Pause-Menu; break }
                $mode = $(if ($c -eq '5') { 'bcdboot' } else { 'revert-pending' })
                Write-Host "This changes the Windows install on $($state.windows.drive) ($mode). Back up profiles first." -ForegroundColor Yellow
                if ((Read-Host 'Type YES to continue') -cne 'YES') { break }
                $scratch = $(if ($state.destination) { "$($state.destination.drive)\DE-Rescue\dism-scratch" } else { $null }); if ($scratch) { New-Item -ItemType Directory -Path $scratch -Force | Out-Null }
                $r = Invoke-DERescueBootRepair -WindowsDrive $state.windows.drive -Mode $mode -ScratchDir $scratch -Confirm:$false
                $state.stale = $true
                $null = Add-DEHandoffAction -Handoff $handoff -Action $(if ($mode -eq 'bcdboot') { 'boot-repair' } else { 'revert-pending' }) -Result $r.result -Detail $r.detail
                Write-Host "$($r.result): $($r.detail)"; Pause-Menu
            }
            '7' {
                $dest = $(if ($state.destination) { $state.destination } else { Select-Destination }); if (-not $dest) { Pause-Menu; break }
                $toWin = $null; if ($state.windows -and (Read-Choice "Also leave it on $($state.windows.drive) for DE Tech Tool? (y/n)" 'y') -eq 'y') { $toWin = $state.windows.drive }
                $null = Add-DEHandoffAction -Handoff $handoff -Action 'inspect' -Result 'PASS' -Detail "volumes: $(@($vols | ForEach-Object { "$($_.drive) $($_.bitlocker)" }) -join ', ')"
                if ($HubUrl -and (Read-Choice "Send to the Hub ($HubUrl)? (y/n)" 'n') -eq 'y') {
                    $sec = $null
                    try {
                        # The Hub files every device under a client account and refuses an event without one.
                        $acct = "$HubAccountId".Trim()
                        while (-not (Test-DEHubAccountId $acct)) {
                            $acct = (Read-Host "Client's Hub account number (digits; Enter to skip sending)").Trim()
                            if (-not $acct) { break }
                            if (-not (Test-DEHubAccountId $acct)) { Write-Host 'That is not a Hub account number (digits only, not a name).' -ForegroundColor Yellow }
                        }
                        if (-not $acct) {
                            $null = Add-DEHandoffAction -Handoff $handoff -Action 'hub-sync' -Result 'WARN' -Detail 'not sent: no Hub account number given; the handoff is still saved for DE Tech Tool to review on the next boot'
                        } else {
                            $sec = Read-Host 'Hub signing secret (not shown, not saved)' -AsSecureString
                            $sr = Send-DERescueHandoffToHub -Handoff $handoff -HubUrl $HubUrl -AccountId $acct -Secret $sec
                            $null = Add-DEHandoffAction -Handoff $handoff -Action 'hub-sync' -Result $(if ($sr.sent) { 'PASS' } else { 'FAIL' }) -Detail $sr.detail
                            Write-Host $sr.detail -ForegroundColor $(if ($sr.sent) { 'Green' } else { 'Yellow' })
                        }
                    } catch { $null = Add-DEHandoffAction -Handoff $handoff -Action 'hub-sync' -Result 'FAIL' -Detail $_.Exception.Message } finally { if ($sec) { $sec.Dispose() } }
                }
                $paths = Save-DERescueHandoff -Handoff $handoff -DestinationRoot "$($dest.drive)\" -WindowsDrive $toWin
                Write-Host "Saved:`n  $($paths -join "`n  ")" -ForegroundColor Green
                foreach ($r in @($handoff.recommendations)) { Write-Host "  - $r" }
                Pause-Menu
            }
            '8' { & cmd.exe; $state.stale = $true }
            '9' { if ((Read-Host 'Restart now? Type YES') -ceq 'YES') { & wpeutil.exe reboot } }
            '0' { if ((Read-Host 'Shut down now? Type YES') -ceq 'YES') { & wpeutil.exe shutdown } }
            default { }
        }
    } catch { Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red; $null = Write-DERescueLog "error: $($_.Exception.Message)"; Pause-Menu }
}
