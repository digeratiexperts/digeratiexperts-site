#Requires -Version 5.1
<#
.SYNOPSIS
    Community PowerShell tools, pinned and hash-checked: LSUClient (Lenovo updates) and HardeningKitty (CIS audit).

.DESCRIPTION
    catalog\community.json names each tool's repository, the one commit DE reviewed, its licence and a sha256 for
    every file DE loads or runs. Files are fetched from raw.githubusercontent.com at that commit (or found pre-staged
    next to the console or on a USB kit) and each is checked before use; a single mismatch refuses it. 'module' tools
    are imported (LSUClient, HardeningKitty); 'scripts' entries are proven MSP scripts run unmodified in their own
    64-bit Windows PowerShell process (the Toolbox); 'reference' repos were read, not used. DE uses these internally
    and does not redistribute them, so the licence is recorded, not a gate. No third-party code is copied into this file.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # Windows PowerShell 5.1 downloads run many times slower with the progress bar

function Get-DECommunityCatalog { return (Get-Content -LiteralPath (Join-Path (Get-DEConsole).Root 'catalog\community.json') -Raw -Encoding UTF8 | ConvertFrom-Json) }
function Get-DECommunityTool {
    param([Parameter(Mandatory = $true)][string]$Id)
    $t = @((Get-DECommunityCatalog).tools | Where-Object { $_.id -eq $Id }) | Select-Object -First 1
    if (-not $t) { throw "community tool '$Id' is not in catalog\community.json" }
    return $t
}
function Invoke-DECommunityDownload {
    <# One place for downloads, so tests replace it. Writes the bytes to -OutFile. #>
    param([Parameter(Mandatory = $true)][string]$Uri, [Parameter(Mandatory = $true)][string]$OutFile)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    # three tries with backoff: one dropped connection must not fail a 350-file folder
    for ($i = 1; $i -le 3; $i++) {
        try { Invoke-WebRequest -Uri $Uri -OutFile $OutFile -UseBasicParsing -TimeoutSec 60 -Headers @{ 'User-Agent' = 'DE-TechTool (Digerati Experts; pinned community tool)' }; return }
        catch { if ($i -eq 3) { throw }; Start-Sleep -Seconds (2 * $i) }
    }
}
function Test-DECommunityToolFiles {
    <# Checks every catalog file under -Path against its sha256. Returns @{ ok; missing; mismatched }. #>
    param([Parameter(Mandatory = $true)]$Tool, [Parameter(Mandatory = $true)][string]$Path)
    $missing = @(); $bad = @()
    foreach ($f in @($Tool.files)) {
        $p = Join-Path $Path ($f.path -replace '/', [IO.Path]::DirectorySeparatorChar)
        if (-not (Test-Path -LiteralPath $p)) { $missing += $f.path; continue }
        if (-not (Test-DEFileHash -Path $p -Sha256 $f.sha256)) { $bad += $f.path }
    }
    return @{ ok = ($missing.Count -eq 0 -and $bad.Count -eq 0 -and @($Tool.files).Count -gt 0); missing = $missing; mismatched = $bad }
}
function Get-DECommunityCacheDir { param([Parameter(Mandatory = $true)]$Tool) return (Join-Path (Join-Path (Join-Path (Get-DEConsole).Dirs.Base 'community') $Tool.id) $Tool.commit) }
function Get-DECommunityToolPath {
    <#
        The folder holding a verified copy of the tool. Looks in -StagedPath, then community\<id> beside the console folder
        (staged by the release or dropship build; outside console\ so integrity.json and signing cover DE code only),
        then the data cache; downloads into the cache only when none verifies and -Offline is not set. Throws when no
        verified copy can be had: a tool that does not match its pin is never used.
    #>
    param([Parameter(Mandatory = $true)][string]$Id, [string[]]$StagedPath = @(), [switch]$Offline)
    $t = Get-DECommunityTool -Id $Id
    if ("$($t.use)" -notin @('module', 'scripts')) { throw "$($t.name) is a '$($t.use)' entry, not a module DE imports" }
    if (-not @($t.files).Count) { throw "$($t.name) has no pinned files in the catalog$(if ("$($t.use)" -ne 'module') { ' (not a module DE imports)' })" }
    $candidates = @($StagedPath) + @((Join-Path (Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'community') $t.id), (Get-DECommunityCacheDir -Tool $t)) | Where-Object { $_ }
    foreach ($c in $candidates) { if ((Test-Path -LiteralPath $c) -and (Test-DECommunityToolFiles -Tool $t -Path $c).ok) { return $c } }
    if ($Offline) { throw "no verified copy of $($t.name) at $($candidates -join '; ') and offline: stage it with Save-DECommunityTool first" }
    $dest = Get-DECommunityCacheDir -Tool $t
    $tmp = "$dest.download"
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -WhatIf:$false }
    New-Item -ItemType Directory -Path $tmp -Force -WhatIf:$false | Out-Null
    try {
        foreach ($f in @($t.files)) {
            $out = Join-Path $tmp ($f.path -replace '/', [IO.Path]::DirectorySeparatorChar)
            $dir = Split-Path -Parent $out; if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
            $uri = (Get-DECommunityCatalog).rawBase -replace '\{repo\}', $t.repo -replace '\{commit\}', $t.commit -replace '\{path\}', $f.path
            Invoke-DECommunityDownload -Uri $uri -OutFile $out
            if (-not (Test-DEFileHash -Path $out -Sha256 $f.sha256)) { throw "$($t.name): $($f.path) does not match the reviewed sha256 (pinned commit $($t.commit.Substring(0, 12))); refusing the tool" }
        }
        if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force -WhatIf:$false }
        Move-Item -LiteralPath $tmp -Destination $dest -WhatIf:$false
    } catch {
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force -WhatIf:$false -ErrorAction SilentlyContinue }
        throw
    }
    Write-DELog -Level INFO -Message "community tool $($t.name) $($t.version) fetched at $($t.commit.Substring(0, 12)) and verified ($(@($t.files).Count) files)"
    return $dest
}
function Save-DECommunityTool {
    <# Copies a verified tool to -Destination\<id> (a USB rescue kit or a dropship bundle) so OOBE and offline runs can use it. #>
    param([Parameter(Mandatory = $true)][string]$Id, [Parameter(Mandatory = $true)][string]$Destination)
    $t = Get-DECommunityTool -Id $Id
    $to = Join-Path $Destination $Id
    if (Test-Path -LiteralPath $to) { Remove-Item -LiteralPath $to -Recurse -Force -WhatIf:$false }
    New-Item -ItemType Directory -Path $Destination -Force -WhatIf:$false | Out-Null
    if (@($t.files | Where-Object { $_ }).Count) {
        Copy-Item -LiteralPath (Get-DECommunityToolPath -Id $Id) -Destination $to -Recurse -WhatIf:$false
        $check = Test-DECommunityToolFiles -Tool $t -Path $to
        if (-not $check.ok) { throw "copy of $Id at $to did not verify (missing $($check.missing -join ', '); changed $($check.mismatched -join ', '))" }
    }
    foreach ($sc in @($t.scripts | Where-Object { $_ -and -not @($t.files | Where-Object { $_ }).Count })) {
        $from = Get-DECommunityScriptPath -Key "$Id/$($sc.id)"
        $dest = Join-Path $to ($sc.path -replace '/', [IO.Path]::DirectorySeparatorChar)
        $dir = Split-Path -Parent $dest; if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
        Copy-Item -LiteralPath $from -Destination $dest -Force -WhatIf:$false
        if (-not (Test-DEFileHash -Path $dest -Sha256 $sc.sha256)) { throw "staged $Id/$($sc.id) did not verify" }
    }
    return $to
}
function Import-DECommunityTool {
    <# Imports a verified 'ship' tool's module globally and returns the module. #>
    param([Parameter(Mandatory = $true)][string]$Id, [switch]$Offline)
    $t = Get-DECommunityTool -Id $Id
    if ("$($t.use)" -ne 'module') { throw "$($t.name) is a '$($t.use)' entry, not a module DE imports" }
    $path = Get-DECommunityToolPath -Id $Id -Offline:$Offline
    return (Import-Module (Join-Path $path $t.module) -Force -Global -PassThru -DisableNameChecking -WarningAction SilentlyContinue)
}

# ------------------------------------------------------------------ Toolbox: proven MSP scripts, run unmodified
function Get-DECommunityScripts {
    <# Every runnable script in the catalog, flattened: key <tool>/<id>, what it does, how it is run, what it can do to the device. #>
    param([string]$Category)
    $out = @()
    foreach ($t in @((Get-DECommunityCatalog).tools)) {
        foreach ($sc in @($t.scripts | Where-Object { $_ })) {
            $p = { param($n, $d) $q = $sc.PSObject.Properties[$n]; if ($q -and $null -ne $q.Value) { $q.Value } else { $d } }
            $o = [pscustomobject]@{
                key = "$($t.id)/$($sc.id)"; tool = $t.id; toolName = $t.name; repo = $t.repo; commit = $t.commit; license = $t.license
                id = $sc.id; title = $sc.title; category = (& $p 'category' 'repair'); path = $sc.path; sha256 = $sc.sha256
                arguments = @(& $p 'arguments' @()); confirm = [bool](& $p 'confirm' $false); reboots = [bool](& $p 'reboots' $false)
                needsInternet = [bool](& $p 'needsInternet' $false); timeoutSeconds = [int](& $p 'timeoutSeconds' 1800); successExitCodes = @(& $p 'successExitCodes' @(0))
                notes = (& $p 'notes' ''); bundle = [bool]@($t.files | Where-Object { $_ }).Count
            }
            if (-not $Category -or $o.category -eq $Category) { $out += $o }
        }
    }
    return $out
}
function Get-DECommunityScript { param([Parameter(Mandatory = $true)][string]$Key) $s = @(Get-DECommunityScripts | Where-Object { $_.key -eq $Key }) | Select-Object -First 1; if (-not $s) { throw "no toolbox script '$Key' in catalog\community.json" }; return $s }
function Get-DECommunityScriptPath {
    <# A verified local copy of one script: staged (community\<tool>\<path> beside console\), else the data cache, else downloaded at the pinned commit. #>
    param([Parameter(Mandatory = $true)][string]$Key, [switch]$Offline)
    $s = Get-DECommunityScript -Key $Key
    # a script that needs its whole repo folder (Win11Debloat): the folder is pinned file by file and verified as one
    if ($s.bundle) { $root = Get-DECommunityToolPath -Id $s.tool -Offline:$Offline; $f = Join-Path $root ($s.path -replace '/', [IO.Path]::DirectorySeparatorChar); if (-not (Test-DEFileHash -Path $f -Sha256 $s.sha256)) { throw "$Key does not match the reviewed sha256" }; return $f }
    $rel = $s.path -replace '/', [IO.Path]::DirectorySeparatorChar
    $staged = Join-Path (Join-Path (Join-Path (Split-Path -Parent (Get-DEConsole).Root) 'community') $s.tool) $rel
    $cache = Join-Path (Join-Path (Join-Path (Join-Path (Get-DEConsole).Dirs.Base 'community') $s.tool) $s.commit) $rel
    foreach ($c in @($staged, $cache)) { if ((Test-Path -LiteralPath $c) -and (Test-DEFileHash -Path $c -Sha256 $s.sha256)) { return $c } }
    if ($Offline) { throw "no verified copy of $Key and offline: stage it first (dropship kits and the release zip carry the toolbox)" }
    $dir = Split-Path -Parent $cache; if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
    $tmp = "$cache.download"
    $uri = (Get-DECommunityCatalog).rawBase -replace '\{repo\}', $s.repo -replace '\{commit\}', $s.commit -replace '\{path\}', ($s.path -replace ' ', '%20')
    try {
        Invoke-DECommunityDownload -Uri $uri -OutFile $tmp
        if (-not (Test-DEFileHash -Path $tmp -Sha256 $s.sha256)) { throw "$Key does not match the reviewed sha256 (pinned commit $($s.commit.Substring(0, 12))); refusing to run it" }
        Move-Item -LiteralPath $tmp -Destination $cache -Force -WhatIf:$false
    } finally { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -WhatIf:$false -ErrorAction SilentlyContinue } }
    return $cache
}
function Test-DEInteractiveHost {
    <# $true when someone can answer a prompt: an interactive session not started with -NonInteractive (RMM, scheduled tasks and first boot are not). #>
    return ([Environment]::UserInteractive -and -not (@([Environment]::GetCommandLineArgs()) -match '^-NonI'))
}
function Get-DEWindowsPowerShellPath {
    <# 64-bit Windows PowerShell even when DE Tech Tool was started by a 32-bit RMM agent (Sysnative), so scripts see the real System32 and registry. #>
    if ($env:OS -ne 'Windows_NT') { return 'pwsh' }
    $sysnative = Join-Path $env:WINDIR 'Sysnative\WindowsPowerShell\v1.0\powershell.exe'
    if (-not [Environment]::Is64BitProcess -and [Environment]::Is64BitOperatingSystem -and (Test-Path -LiteralPath $sysnative)) { return $sysnative }
    return (Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe')
}
function Invoke-DECommunityScript {
    <#
        Runs one toolbox script, unmodified, in its own Windows PowerShell process with its catalog arguments, a
        timeout, and its full output saved to evidence. PASS only on a catalog success exit code; anything else is
        FAIL with the log. Scripts marked confirm (they uninstall, reboot or change partitions) need -Force
        (the technician already confirmed in the GUI, or RMM means it) or an interactive yes; headless without -Force
        they are skipped, never run by surprise.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
    param([Parameter(Mandatory = $true)][string]$Key, [string[]]$ExtraArguments = @(), [switch]$Offline, [switch]$Force)
    $s = Get-DECommunityScript -Key $Key
    $what = "run $($s.title) ($($s.toolName) $($s.commit.Substring(0, 7)))$(if ($s.reboots) { ' - may restart the device' })"
    if ($s.confirm -and -not $Force -and -not $WhatIfPreference) {
        if (-not (Test-DEInteractiveHost) -or -not $PSCmdlet.ShouldContinue($what, 'This script changes the device in ways that are hard to undo')) { return [pscustomobject]@{ key = $Key; result = 'SKIPPED'; detail = 'needs confirmation (-Force)' } }
    }
    if (-not $PSCmdlet.ShouldProcess($s.key, $what)) { return [pscustomobject]@{ key = $Key; result = 'PLANNED'; detail = $what } }
    $path = Get-DECommunityScriptPath -Key $Key -Offline:$Offline
    $psArgs = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $path) + @($s.arguments) + @($ExtraArguments)
    $r = Invoke-DENative -FilePath (Get-DEWindowsPowerShellPath) -Arguments $psArgs -WorkingDirectory (Split-Path -Parent $path) -TimeoutSeconds $s.timeoutSeconds
    $log = Join-Path (Get-DEConsole).Dirs.Evidence ("toolbox-{0}-{1}.log" -f ($s.key -replace '[^A-Za-z0-9-]', '_'), (Get-Date -Format 'yyyyMMdd-HHmmss'))
    [IO.File]::WriteAllText($log, (Protect-DEText ("$($s.title)`r`n$($s.repo)@$($s.commit) $($s.path)`r`nexit $($r.ExitCode)$(if ($r.TimedOut) { " (killed after $($s.timeoutSeconds) s)" })`r`n`r`n" + $r.Text)), (New-Object Text.UTF8Encoding $false))
    $ok = (-not $r.TimedOut) -and (@($s.successExitCodes | ForEach-Object { [int]$_ }) -contains [int]$r.ExitCode)
    $tail = (@($r.Output | Where-Object { $_ }) | Select-Object -Last 3) -join ' | '
    Add-DEEvidence -Step "toolbox.$($s.key)" -Module 'toolbox' -Before 'run requested' -ActionTaken "$($s.title): exit $($r.ExitCode)" -Result $(if ($ok) { 'PASS' } else { 'FAIL' }) -Verification $log -Remediation $(if ($ok) { '' } else { "read $log" }) | Out-Null
    return [pscustomobject]@{ key = $Key; result = $(if ($ok) { 'PASS' } else { 'FAIL' }); exitCode = $r.ExitCode; timedOut = $r.TimedOut; log = $log; detail = $tail; reboots = $s.reboots }
}

# ------------------------------------------------------------------ LSUClient (Lenovo)
function Invoke-DELsuClient {
    <# The only place DE calls LSUClient, so tests replace it. Get: applicable, not yet installed packages. Install: results. #>
    param([Parameter(Mandatory = $true)][ValidateSet('Get', 'Install')][string]$Operation, [array]$Packages = @())
    $null = Import-DECommunityTool -Id 'lsuclient'
    if ($Operation -eq 'Get') { return @(& (Get-Command -Name 'Get-LSUpdate' -Module 'LSUClient')) }
    $install = Get-Command -Name 'Install-LSUpdate' -Module 'LSUClient'
    return @($Packages | & $install -SaveBIOSUpdateInfoToRegistry)
}
function Get-DELenovoUpdates {
    <# Lenovo packages this machine needs, as plain records. firmware = BIOS/firmware (needs BitLocker suspended); unattended = LSUClient can install it silently. #>
    $out = @()
    foreach ($p in @(Invoke-DELsuClient -Operation Get)) {
        if ($null -eq $p) { continue }
        $unattended = $true; $inst = $p.PSObject.Properties['Installer']; if ($inst -and $inst.Value -and $null -ne $inst.Value.PSObject.Properties['Unattended']) { $unattended = [bool]$inst.Value.Unattended }
        $out += [pscustomobject]@{ id = "$($p.ID)"; title = "$($p.Title)"; type = "$($p.Type)"; category = "$($p.Category)"; severity = "$($p.Severity)"; version = "$($p.Version)"; firmware = ("$($p.Type)" -in @('BIOS', 'Firmware')); unattended = $unattended; package = $p }
    }
    return $out
}
function Install-DELenovoUpdates {
    <#
        Installs the given Get-DELenovoUpdates records through LSUClient. Returns @{ installed; failed; pending; manual }.
        pending lists SHUTDOWN / REBOOT_MANDATORY / REBOOT_SUGGESTED; the caller requests the restart and throws on failures.
    #>
    param([Parameter(Mandatory = $true)][array]$Updates)
    $results = @(Invoke-DELsuClient -Operation Install -Packages @($Updates | ForEach-Object { $_.package }))
    $ok = @($results | Where-Object { $_ -and $_.Success })
    $failed = @($results | Where-Object { $_ -and -not $_.Success } | ForEach-Object { "$($_.Title) ($(if ($_.FailureReason) { $_.FailureReason } else { "exit $($_.ExitCode)" }))" })
    $pending = @($ok | Where-Object { "$($_.PendingAction)" -in @('SHUTDOWN', 'REBOOT_MANDATORY', 'REBOOT_SUGGESTED') } | ForEach-Object { "$($_.PendingAction)" } | Select-Object -Unique)
    return @{ installed = @($ok | ForEach-Object { "$($_.Title)" }); failed = $failed; pending = $pending; shutdown = ($pending -contains 'SHUTDOWN') }
}

# ------------------------------------------------------------------ HardeningKitty (CIS / Microsoft baseline audit)
function Get-DECisBenchmark {
    <# The benchmark to audit against: the client profile's baseline.cisBenchmark, else by Windows version (11 24H2+ -> CIS Win11 24H2, 10 -> CIS Win10 22H2). #>
    param($ClientProfile, [string]$Key)
    $hk = Get-DECommunityTool -Id 'hardeningkitty'
    if (-not $Key -and $ClientProfile) { $Key = "$(Get-DEHashPath -Object $ClientProfile -Path 'baseline.cisBenchmark')" }
    if (-not $Key) {
        $build = 0; try { $build = [int]"0$((Get-DEDeviceInventory).osBuild)".Split('.')[0] } catch { $build = 0 }
        $Key = $(if ($build -gt 0 -and $build -lt 22000) { 'cis-win10-22h2' } else { 'cis-win11-24h2' })
    }
    $b = @($hk.benchmarks | Where-Object { $_.key -eq $Key }) | Select-Object -First 1
    if (-not $b) { throw "unknown benchmark '$Key' (catalog has: $((@($hk.benchmarks) | ForEach-Object { $_.key }) -join ', '))" }
    return $b
}
function ConvertFrom-DEHardeningKittyReport {
    <# Summarises a HardeningKitty CSV report: counts by severity and the High findings by name. #>
    param([Parameter(Mandatory = $true)][string]$Path)
    $rows = @(Import-Csv -LiteralPath $Path)
    $count = { param($s) @($rows | Where-Object { "$($_.Severity)" -eq $s }).Count }
    $passed = & $count 'Passed'
    return [pscustomobject]@{
        total = $rows.Count; passed = $passed; low = (& $count 'Low'); medium = (& $count 'Medium'); high = (& $count 'High')
        percentPassed = $(if ($rows.Count) { [math]::Round(100 * $passed / $rows.Count) } else { 0 })
        highFindings = @($rows | Where-Object { "$($_.Severity)" -eq 'High' } | ForEach-Object { "$($_.ID) $($_.Name)" } | Select-Object -First 25)
    }
}
function Invoke-DECisAudit {
    <# Read-only audit (HardeningKitty -Mode Audit) of the machine settings against one benchmark. Report CSV goes into evidence; the summary into state. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($ClientProfile, [string]$Benchmark)
    $b = Get-DECisBenchmark -ClientProfile $ClientProfile -Key $Benchmark
    if (-not $PSCmdlet.ShouldProcess($b.name, 'read-only HardeningKitty audit')) { return 'planned' }
    $mod = Import-DECommunityTool -Id 'hardeningkitty'
    $list = Join-Path $mod.ModuleBase ($b.machine -replace '/', [IO.Path]::DirectorySeparatorChar)
    $report = Join-Path (Get-DEConsole).Dirs.Evidence ("hardeningkitty-{0}-{1}.csv" -f $b.key, (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $hk = Get-Command -Name 'Invoke-HardeningKitty' -Module 'HardeningKitty'
    $null = & $hk -Mode Audit -FileFindingList $list -Report -ReportFile $report 6>$null
    if (-not (Test-Path -LiteralPath $report)) { throw "HardeningKitty produced no report at $report" }
    $s = ConvertFrom-DEHardeningKittyReport -Path $report
    $rec = @{ benchmark = $b.key; name = $b.name; at = (Get-Date).ToString('o'); report = $report; total = $s.total; passed = $s.passed; low = $s.low; medium = $s.medium; high = $s.high; percentPassed = $s.percentPassed; highFindings = $s.highFindings }
    Set-DEStateValue -Path 'baseline.cisAudit' -Value $rec
    return $rec
}

function Register-DECommunityActions {
    param($ClientProfile)
    Register-DEAction -Id 'baseline.cis-audit' -Module 'baseline' -Title 'CIS / Microsoft baseline audit (read-only report)' -Phase 11 -Gates @('gate.elevated') -RequiresElevation `
        -Detect {
            $a = Get-DEState -Path 'baseline.cisAudit'
            $want = $null; try { $want = (Get-DECisBenchmark -ClientProfile $ClientProfile).key } catch { $want = $null }
            if (-not $a) { @{ audited = $false; benchmark = $want; detail = 'not audited yet' } }
            else { @{ audited = ("$(Get-DEHashPath -Object $a -Path 'benchmark')" -eq "$want"); benchmark = "$(Get-DEHashPath -Object $a -Path 'benchmark')"; percentPassed = (Get-DEHashPath -Object $a -Path 'percentPassed'); high = (Get-DEHashPath -Object $a -Path 'high'); medium = (Get-DEHashPath -Object $a -Path 'medium'); detail = "audited $(Get-DEHashPath -Object $a -Path 'at')" } }
        }.GetNewClosure() -Desired { @{ audited = $true } } `
        -Apply { param($s) $r = Invoke-DECisAudit -ClientProfile $ClientProfile; if ($r -eq 'planned') { return $r }; "$($r.name): $($r.percentPassed)% passed; $($r.high) high, $($r.medium) medium, $($r.low) low findings (report in evidence)" }.GetNewClosure() `
        -ManualAction 'The audit changes nothing. High findings are fixed through the DE baseline controls or JumpCloud policies, then re-audited.'
}

Export-ModuleMember -Function Test-DEInteractiveHost, Get-DECommunityScripts, Get-DECommunityScript, Get-DECommunityScriptPath, Get-DEWindowsPowerShellPath, Invoke-DECommunityScript, Get-DECommunityCatalog, Get-DECommunityTool, Invoke-DECommunityDownload, Test-DECommunityToolFiles, Get-DECommunityToolPath, Save-DECommunityTool, Import-DECommunityTool, Invoke-DELsuClient, Get-DELenovoUpdates, Install-DELenovoUpdates, Get-DECisBenchmark, ConvertFrom-DEHardeningKittyReport, Invoke-DECisAudit, Register-DECommunityActions
