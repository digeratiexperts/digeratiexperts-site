#Requires -Version 5.1
# Offline native regression suite, also called by Pester/Windows CI. Uses only isolated temporary fixtures.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$console = Split-Path -Parent $PSScriptRoot
Import-Module (Join-Path $console 'modules/DE.Core/DE.Core.psm1') -Force -DisableNameChecking
Import-Module (Join-Path $console 'modules/DE.Storage/DE.Storage.psm1') -Force -DisableNameChecking
$root = Join-Path ([IO.Path]::GetTempPath()) ('de-storage-regression-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($root)
$null = Initialize-DEConsole -Root $console -Mode Apply -DataDir (Join-Path $root 'evidence')
$script:passed = 0
function Assert-Storage { param([bool]$Condition,[string]$Name) if (-not $Condition) { throw "FAIL: $Name" }; $script:passed++; Write-Output "PASS: $Name" }
function Assert-StorageThrows { param([scriptblock]$Work,[string]$Name) $threw = $false; try { & $Work | Out-Null } catch { $threw = $true }; Assert-Storage $threw $Name }
try {
    $src = Join-Path $root 'source'; $dst = Join-Path $root 'destination'
    [void][IO.Directory]::CreateDirectory((Join-Path $src 'nested'))
    [IO.File]::WriteAllText((Join-Path $src 'one[1].txt'), 'literal-path-content')
    [IO.File]::WriteAllText((Join-Path $src 'nested/two.txt'), 'second-file-content')
    $r = Get-DEStorageInventory $src -IncludeFiles
    Assert-Storage ($r.complete -and $r.fileCount -eq 2 -and $r.bytes -gt 0) 'scan counts files and preserves literal bracket paths'
    Assert-Storage ((Get-DEStorageInventory $src -MaxFiles 1).complete -eq $false) 'scan limit reports partial result'
    Assert-StorageThrows { Get-DEStorageInventory 'relative/path' } 'relative root refused'
    Assert-StorageThrows { New-DEStorageRelocationPlan -Source $src -Destination (Join-Path $src 'inside') } 'nested destination refused'
    Assert-StorageThrows { New-DEStorageRelocationPlan -Source $src -Destination $root } 'ancestor destination refused'
    Assert-StorageThrows { New-DEStorageRelocationPlan -Source ([IO.Path]::GetPathRoot($src)) -Destination $dst } 'drive root refused'
    $plan = New-DEStorageRelocationPlan -Source $src -Destination $dst
    $dry = Invoke-DEStorageRelocation $plan -WhatIf -Confirm:$false
    Assert-Storage (-not [IO.Directory]::Exists($dst) -and $dry.result -eq 'PLANNED') 'copy WhatIf writes no destination'
    Set-DEMode -Mode Audit -DryRun
    Assert-StorageThrows { Invoke-DEStorageRelocation $plan -Confirm:$false } 'audit mode blocks live copy'
    Set-DEMode -Mode Apply
    $copy = Invoke-DEStorageRelocation $plan -Confirm:$false
    Assert-Storage ($copy.result -eq 'PASS' -and [IO.File]::Exists($copy.receiptPath)) 'copy writes successful durable receipt'
    Assert-Storage ([IO.File]::Exists((Join-Path $src 'one[1].txt'))) 'copy retains source'
    Assert-Storage (Test-DEStorageRelocation $copy) 'full content verification passes'
    $resume = Invoke-DEStorageRelocation $plan -Confirm:$false
    Assert-Storage ($resume.result -eq 'PASS') 'identical existing destination resumes without overwrite'
    [IO.File]::WriteAllText((Join-Path $dst 'one[1].txt'), 'tampered')
    Assert-StorageThrows { Test-DEStorageRelocation $copy } 'destination tamper prevents verification'
    Assert-StorageThrows { Invoke-DEStorageRelocation $plan -Confirm:$false } 'different destination content never overwritten'
    [IO.File]::WriteAllText((Join-Path $dst 'one[1].txt'), 'literal-path-content')
    [IO.File]::WriteAllText((Join-Path $dst 'unrelated.txt'), 'keep')
    Assert-StorageThrows { Invoke-DEStorageRelocation $plan -Confirm:$false } 'unrelated destination content refused'
    [IO.File]::Delete((Join-Path $dst 'unrelated.txt'))
    Assert-StorageThrows { Remove-DEStorageRelocationSource $copy -ConfirmSource 'wrong' -Confirm:$false } 'source removal requires exact source confirmation'
    [IO.File]::WriteAllText((Join-Path $src 'new.txt'), 'new content after copy')
    Assert-StorageThrows { Remove-DEStorageRelocationSource $copy -ConfirmSource $copy.source -Confirm:$false } 'new source content prevents removal'
    [IO.File]::Delete((Join-Path $src 'new.txt'))
    Remove-DEStorageRelocationSource $copy -ConfirmSource $copy.source -WhatIf -Confirm:$false
    Assert-Storage ([IO.File]::Exists((Join-Path $src 'one[1].txt'))) 'source removal WhatIf retains source'
    $protected = Join-Path $root 'protected'; [void][IO.Directory]::CreateDirectory((Join-Path $protected '.git'))
    [IO.File]::WriteAllText((Join-Path $protected 'important.txt'),'keep project')
    Assert-Storage ((Get-DEStorageInventory $protected -ProtectDevelopment -IncludeFiles).fileCount -eq 0) 'cleanup scan excludes git projects'
    $stale = [pscustomobject]@{ schema = 'de.storage.cleanup-plan/v1'; machine = $env:COMPUTERNAME; at = [DateTime]::UtcNow.AddDays(-2).ToString('o'); entries = @() }
    Assert-StorageThrows { Invoke-DEStorageCleanup $stale -SelectedId x -WhatIf -Confirm:$false } 'stale cleanup plan refused'
    $fake = [pscustomobject]@{ schema = 'de.storage.cleanup-plan/v1'; machine = $env:COMPUTERNAME; at = [DateTime]::UtcNow.ToString('o'); entries = @([pscustomobject]@{ id = 'bad'; category = 'user-temp'; root = $src; path = (Join-Path $src 'one[1].txt'); length = 20 }) }
    $bad = Invoke-DEStorageCleanup $fake -SelectedId bad -Confirm:$false
    Assert-Storage ($bad.fileCount -eq 0 -and [IO.File]::Exists((Join-Path $src 'one[1].txt'))) 'forged cleanup target outside allowed roots not deleted'
    if ($env:OS -eq 'Windows_NT') {
        # Verified native deletion: destination stays intact, source files removed only after hashes pass.
        $removed = Remove-DEStorageRelocationSource $copy -ConfirmSource $copy.source -Confirm:$false
        Assert-Storage ($removed.fileCount -eq 2 -and -not [IO.File]::Exists((Join-Path $src 'one[1].txt')) -and [IO.File]::Exists((Join-Path $dst 'one[1].txt'))) 'Windows handle deletion removes only verified source files'
        $lockFile = Join-Path $root 'locked.txt'; [IO.File]::WriteAllText($lockFile,'locked')
        $held = [IO.File]::Open($lockFile,'Open','ReadWrite','None')
        try { Assert-StorageThrows { & (Get-Module DE.Storage) { param($path) Remove-DEStorageVerifiedFile -Path $path -Length 6 } $lockFile } 'locked file cannot be removed' } finally { $held.Dispose() }
        $adsFile = Join-Path $dst 'one[1].txt'; Set-Content -LiteralPath $adsFile -Stream zone 'test'
        Assert-StorageThrows { New-DEStorageRelocationPlan -Source $dst -Destination (Join-Path $root 'ads-copy') } 'alternate data streams prevent lossy relocation'
    }
    $linkRoot = Join-Path $root 'links'; [void][IO.Directory]::CreateDirectory($linkRoot)
    $link = Join-Path $linkRoot 'linked'
    try {
        $null = New-Item -ItemType SymbolicLink -Path $link -Target $dst -ErrorAction Stop
        $linkScan = Get-DEStorageInventory $linkRoot
        Assert-Storage ($linkScan.skipped -eq 1 -and $linkScan.fileCount -eq 0) 'linked subtree is never traversed'
        Assert-StorageThrows { New-DEStorageRelocationPlan -Source $linkRoot -Destination (Join-Path $root 'link-copy') } 'excluded link blocks whole-folder relocation'
    } catch { if ($_.Exception.Message -match 'FAIL:') { throw }; Write-Output 'SKIP: symlink fixture unavailable (privilege/filesystem).' }
    $topology = [pscustomobject]@{ issues = @(); limits = 'not measured'; volumes = @(
        [pscustomobject]@{ path='C:\'; diskId='0'; model='OS NVMe'; media='SSD'; bus='NVMe'; isOS=$true; capacityBytes=256GB; freeBytes=1GB; health='Healthy'; diskHealth='Healthy'; confidence='reported' },
        [pscustomobject]@{ path='J:\'; diskId='1'; model='NVMe'; media='SSD'; bus='NVMe'; isOS=$false; capacityBytes=1TB; freeBytes=400GB; health='Healthy'; diskHealth='Healthy'; confidence='reported' },
        [pscustomobject]@{ path='I:\'; diskId='2'; model='NVMe'; media='SSD'; bus='NVMe'; isOS=$false; capacityBytes=1TB; freeBytes=900GB; health='Healthy'; diskHealth='Healthy'; confidence='reported' },
        [pscustomobject]@{ path='D:\'; diskId='3'; model='HDD'; media='HDD'; bus='SATA'; isOS=$false; capacityBytes=8TB; freeBytes=7TB; health='Healthy'; diskHealth='Healthy'; confidence='reported' },
        [pscustomobject]@{ path='G:\'; diskId='1'; model='same NVMe'; media='SSD'; bus='NVMe'; isOS=$false; capacityBytes=1TB; freeBytes=900GB; health='Healthy'; diskHealth='Healthy'; confidence='reported' },
        [pscustomobject]@{ path='H:\'; diskId='4'; model='Unknown USB'; media='Unknown'; bus='USB'; isOS=$false; capacityBytes=8TB; freeBytes=1TB; health='Healthy'; diskHealth='Healthy'; confidence='partial' }
    ) }
    $rec = Get-DEStorageRecommendations -Topology $topology -CustomUse @{'I:\'='DE_WORK'}
    Assert-Storage (@($rec.roles | Where-Object { $_.path -eq 'C:\' -and $_.state -eq 'CRITICAL' }).Count -eq 1) 'nearly full system SSD identified as critical'
    Assert-Storage (@($rec.roles | Where-Object { $_.path -eq 'D:\' -and $_.role -match 'archive' }).Count -eq 1) 'HDD recommends bulk/archive role'
    Assert-Storage (@($rec.roles | Where-Object { $_.path -eq 'I:\' -and $_.role -match 'DE_WORK' }).Count -eq 1) 'custom role retained with technology reasoning'
    $pair = @($rec.transfers | Where-Object { $_.source -eq 'J:\' -and $_.destination -eq 'I:\' })[0]
    Assert-Storage ($pair.candidateRank -eq 3 -and $null -eq $pair.measuredMBps) 'separate NVMe pair ranked without invented throughput'
    Assert-Storage (@($rec.transfers | Where-Object { $_.source -eq 'J:\' -and $_.destination -eq 'G:\' -and $_.sameDisk -and $_.candidateRank -eq 0 }).Count -eq 1) 'same disk partitions not treated as independent fast pair'
    Assert-Storage (@($rec.transfers | Where-Object { $_.destination -eq 'H:\' -and $_.candidateRank -ne 0 }).Count -eq 0) 'unknown USB media not assigned a speed ranking'
    Write-Output "Storage regression: $script:passed checks passed."
} finally {
    # Fixtures only. Link directory is removed non-recursively before the remaining fixture tree.
    if ([IO.Directory]::Exists((Join-Path $root 'links/linked'))) { try { [IO.Directory]::Delete((Join-Path $root 'links/linked')) } catch {} }
    Remove-Item -LiteralPath $root -Recurse -Force -ErrorAction SilentlyContinue
}
