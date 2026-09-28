<#
.SYNOPSIS
    Windows loader for the Digerati Experts MSP AI Kit.

.DESCRIPTION
    One tool for a technician or the RMM: checks the machine, builds the
    instruction packs, installs the kit as a Claude Code / Codex skill for the
    current user, copies the ChatGPT blocks to the clipboard, fetches the
    optional upstream kits, verifies, and writes a receipt.

    Follows the DE scripting conventions (references\de-scripting-msp-skill-pack.md):
    pre-check, plan, apply, verify, report; idempotent; no prompts when
    -NonInteractive; -WhatIf / -DryRun everywhere a change is made; secrets are
    never read or written; timestamped log plus a JSON receipt.

.PARAMETER Action
    Menu (default: the DE Technician Console window at its AI Toolkit page when
    interactive on Windows, else the text menu), Gui (force the window),
    Console (force the text menu), Build, Install, Clipboard, Upstream, Verify,
    Uninstall, All (Build + Install + Verify), Update (check and apply a newer
    kit), Cleanup (retention), Version (print local and remote versions).

.PARAMETER KitRoot
    Folder that holds kit.config.json and scripts\build.mjs. Default: the
    parent of this script's folder.

.PARAMETER OutDir
    Where the packs are written. Default: %USERPROFILE%\Documents\DE\msp-ai-kit\<profile>.

.PARAMETER ConfigPath
    Alternative kit.config.json (a second brand or profile).

.PARAMETER Only, Skip, Targets, Set
    Passed through to build.mjs as --only, --skip, --targets, --set.

.PARAMETER CursorRepo
    A repository folder; the built Cursor rule is copied to <repo>\.cursor\rules\.

.PARAMETER VendorDir
    Where upstream kits are cloned. Default: %LOCALAPPDATA%\DE\msp-ai-kit\vendor.

.PARAMETER UpstreamKits
    Subset of rtfm, servosity, wyre, cmmc. Default: all four.

.PARAMETER InstallNode
    Allow winget to install Node.js LTS when Node is missing (asks unless -NonInteractive).

.PARAMETER Force
    Replace an existing skill folder or junction that is not this kit.

.PARAMETER NonInteractive
    Never prompt. Menu becomes Build. Clipboard writes text files instead of waiting.

.PARAMETER DryRun
    Same as -WhatIf for the whole run.

.PARAMETER ReceiptUploadUrl
    HTTPS webhook that receives the JSON receipt after every run (falls back to
    distribution.receipt_url in kit.config.json). Bearer token from the
    environment variable DE_RECEIPT_TOKEN when set. Receipts contain no secrets.

.PARAMETER UpdateUrl, UpdateSha256
    Action Update: zip that contains the msp-ai-kit folder (falls back to
    distribution.update_url) and its expected sha256. The current kit is backed
    up next to itself before files are replaced; kit.config.json and profiles
    are kept.

.PARAMETER RetentionDays
    Action Cleanup: delete logs, receipts and old pack folders older than this
    (falls back to distribution.retention_days, default 90).

.PARAMETER Latest
    Action Upstream: take each upstream default branch head instead of the
    commits pinned in upstream.lock.

.EXAMPLE
    .\Install-MspAiKit.ps1
    Interactive menu.

.EXAMPLE
    .\Install-MspAiKit.ps1 -Action All -NonInteractive
    RMM-friendly: build, install for the current user, verify, exit code tells the result.

.EXAMPLE
    .\Install-MspAiKit.ps1 -Action Build -Set 'sla.confirmed=true' -WhatIf

.NOTES
    Exit codes: 0 success, 1 failure, 2 bad input / wrong runtime / missing dependency, 3 reboot required (unused).
    Requires Windows PowerShell 5.1 or PowerShell 7. Node.js 18+ for Build/Verify; git for Upstream.
    Log: %ProgramData%\DE\logs\msp-ai-kit-<timestamp>.log (falls back to %LOCALAPPDATA%\DE\logs).
    Tested on: PowerShell 7.4 (parse, dry run, build, install, verify); Windows PowerShell 5.1 syntax kept
    (no ternary, no null-coalescing, no multi-child Join-Path).
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [ValidateSet('Menu', 'Gui', 'Console', 'Build', 'Install', 'Clipboard', 'Upstream', 'Verify', 'Uninstall', 'All', 'Update', 'Cleanup', 'Version')]
    [string]$Action = 'Menu',
    [string]$KitRoot,
    [string]$OutDir,
    [string]$ConfigPath,
    [string[]]$Only,
    [string[]]$Skip,
    [string[]]$Targets,
    [string[]]$Set,
    [string]$CursorRepo,
    [string]$VendorDir,
    [ValidateSet('rtfm', 'servosity', 'wyre', 'cmmc')]
    [string[]]$UpstreamKits = @('rtfm', 'servosity', 'wyre', 'cmmc'),
    [switch]$InstallNode,
    [switch]$Force,
    [switch]$NonInteractive,
    [switch]$DryRun,
    [string]$ReceiptUploadUrl,
    [string]$UpdateUrl,
    [string]$UpdateSha256,
    [int]$RetentionDays = 0,
    [switch]$Latest
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($DryRun) { $WhatIfPreference = $true }

$script:ToolName = 'msp-ai-kit loader'
$script:ToolVersion = '1.1.0'
$script:Evidence = New-Object System.Collections.ArrayList
$script:ExitCode = 0
$script:IsWindowsHost = ($env:OS -eq 'Windows_NT')
$script:LogSink = $null
$script:GuiFile = Join-Path $PSScriptRoot 'console\DETechConsole.ps1'

# ------------------------------------------------------------------ logging
function Get-LogDirectory {
    $candidates = @()
    if ($script:IsWindowsHost) {
        if ($env:ProgramData) { $candidates += (Join-Path $env:ProgramData 'DE\logs') }
        if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'DE\logs') }
    }
    $candidates += (Join-Path $HOME '.de/logs')
    foreach ($c in $candidates) {
        try {
            if (-not (Test-Path -LiteralPath $c)) { New-Item -ItemType Directory -Path $c -Force -WhatIf:$false | Out-Null }
            $probe = Join-Path $c '.write-test'
            Set-Content -LiteralPath $probe -Value 'ok' -WhatIf:$false
            Remove-Item -LiteralPath $probe -Force -WhatIf:$false
            return $c
        } catch { continue }
    }
    return $null
}

$script:LogDir = Get-LogDirectory
$script:LogFile = $null
if ($script:LogDir) {
    $script:LogFile = Join-Path $script:LogDir ("msp-ai-kit-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
}

function Write-KitLog {
    param(
        [Parameter(Mandatory = $true)][string]$Message,
        [ValidateSet('INFO', 'PASS', 'WARN', 'FAIL', 'STEP', 'PLAN')][string]$Level = 'INFO'
    )
    $line = "{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    if ($script:LogFile) { try { Add-Content -LiteralPath $script:LogFile -Value $line -WhatIf:$false } catch { } }
    if ($script:LogSink) { try { & $script:LogSink $line $Level } catch { } }
    $color = switch ($Level) { 'PASS' { 'Green' } 'WARN' { 'Yellow' } 'FAIL' { 'Red' } 'STEP' { 'Cyan' } 'PLAN' { 'DarkGray' } default { 'Gray' } }
    Write-Host $line -ForegroundColor $color
}

function Add-Evidence {
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [Parameter(Mandatory = $true)][string]$Before,
        [Parameter(Mandatory = $true)][string]$ActionTaken,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARN', 'BLOCKED', 'FAIL', 'NO CHANGE', 'SKIPPED', 'PLANNED', 'INFO')][string]$Result,
        [string]$Verification = '',
        [string]$Remediation = ''
    )
    $null = $script:Evidence.Add([pscustomobject]@{
            timestamp    = (Get-Date).ToString('o')
            step         = $Step
            before       = $Before
            action       = $ActionTaken
            result       = $Result
            verification = $Verification
            remediation  = $Remediation
        })
    $level = switch ($Result) { 'PASS' { 'PASS' } 'NO CHANGE' { 'PASS' } 'PLANNED' { 'PLAN' } 'WARN' { 'WARN' } 'SKIPPED' { 'INFO' } 'INFO' { 'INFO' } default { 'FAIL' } }
    $suffix = ''
    if ($Remediation) { $suffix = " | fix: $Remediation" }
    Write-KitLog -Level $level -Message ("{0}: {1} ({2}){3}" -f $Step, $Result, $ActionTaken, $suffix)
    if ($Result -eq 'FAIL' -and $script:ExitCode -eq 0) { $script:ExitCode = 1 }
    if ($Result -eq 'BLOCKED' -and $script:ExitCode -eq 0) { $script:ExitCode = 2 }
}

# --------------------------------------------------------------- utilities
function Invoke-Native {
    # Runs a native command without letting stderr become a terminating error on 5.1.
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments = @(),
        [string]$WorkingDirectory
    )
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $output = @()
    try {
        if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
        $output = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally {
        if ($WorkingDirectory) { Pop-Location }
        $ErrorActionPreference = $prev
    }
    return [pscustomobject]@{ ExitCode = $code; Output = $output }
}

function Get-CommandPath {
    param([Parameter(Mandatory = $true)][string]$Name)
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) { return $null }
    return $cmd.Source
}

function Confirm-Interactive {
    param([Parameter(Mandatory = $true)][string]$Question)
    if ($NonInteractive) { return $false }
    $answer = Read-Host ("{0} [y/N]" -f $Question)
    return ($answer -match '^(y|yes)$')
}

function Get-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json)
}

# --------------------------------------------------------------- pre-check
function Resolve-KitRoot {
    param([string]$Requested)
    $root = $Requested
    if (-not $root) { $root = Split-Path -Parent $PSScriptRoot }
    $root = (Resolve-Path -LiteralPath $root -ErrorAction SilentlyContinue)
    if ($null -eq $root) { return $null }
    $root = $root.Path
    $build = Join-Path $root 'scripts\build.mjs'
    $config = Join-Path $root 'kit.config.json'
    if ((Test-Path -LiteralPath $build) -and (Test-Path -LiteralPath $config)) { return $root }
    return $null
}

function Get-NodeVersion {
    $node = Get-CommandPath 'node'
    if ($null -eq $node) { return $null }
    $r = Invoke-Native -FilePath $node -Arguments @('--version')
    if ($r.ExitCode -ne 0 -or $r.Output.Count -eq 0) { return $null }
    if ($r.Output[0] -match 'v(\d+)\.(\d+)\.(\d+)') { return [version]("{0}.{1}.{2}" -f $Matches[1], $Matches[2], $Matches[3]) }
    return $null
}

function Install-NodeWithWinget {
    <#
    Installs Node.js without needing elevation when possible: winget --scope user first, then the
    official portable zip from nodejs.org into %LOCALAPPDATA%\DE\node, verified against the release's
    SHASUMS256.txt. Machine-wide winget is the last resort and needs elevation.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([string]$Version = '22.14.0')
    $winget = Get-CommandPath 'winget'
    if ($winget -and $PSCmdlet.ShouldProcess('Node.js LTS (per user)', 'winget install OpenJS.NodeJS.LTS --scope user')) {
        $r = Invoke-Native -FilePath $winget -Arguments @('install', '--id', 'OpenJS.NodeJS.LTS', '-e', '--silent', '--scope', 'user', '--accept-source-agreements', '--accept-package-agreements')
        foreach ($c in @((Join-Path $env:LOCALAPPDATA 'Programs\nodejs'), (Join-Path $env:ProgramFiles 'nodejs'))) { if ($c -and (Test-Path -LiteralPath $c)) { $env:Path = "$c;$env:Path" } }
        $v = Get-NodeVersion
        if ($null -ne $v) { Add-Evidence -Step 'node' -Before 'missing' -ActionTaken 'winget install --scope user' -Result 'PASS' -Verification ("node {0}" -f $v); return $true }
        Write-KitLog -Level WARN -Message ("winget per-user install exit {0}; trying the portable build" -f $r.ExitCode)
    }
    $arch = $(if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' })
    $name = "node-v$Version-win-$arch"
    $base = "https://nodejs.org/dist/v$Version"
    $dest = Join-Path $env:LOCALAPPDATA 'DE\node'
    if (-not $PSCmdlet.ShouldProcess("$base/$name.zip", "download portable Node.js to $dest")) { Add-Evidence -Step 'node' -Before 'missing' -ActionTaken "portable Node.js $Version" -Result 'PLANNED'; return $false }
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        $zip = Join-Path $dest "$name.zip"
        Invoke-WebRequest -Uri "$base/$name.zip" -OutFile $zip -UseBasicParsing
        $sums = (Invoke-WebRequest -Uri "$base/SHASUMS256.txt" -UseBasicParsing).Content
        $want = ($sums -split "`n" | Where-Object { $_ -match [regex]::Escape("$name.zip") } | Select-Object -First 1) -replace '\s+.*$', ''
        $have = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        if (-not $want -or $have -ne $want.ToLowerInvariant()) { Remove-Item -LiteralPath $zip -Force; throw "sha256 mismatch for $name.zip (have $have, want $want)" }
        Expand-Archive -LiteralPath $zip -DestinationPath $dest -Force
        Remove-Item -LiteralPath $zip -Force
        $bin = Join-Path $dest $name
        $env:Path = "$bin;$env:Path"
        $userPath = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($userPath -notlike "*$bin*") { [Environment]::SetEnvironmentVariable('Path', "$bin;$userPath", 'User') }
        $v = Get-NodeVersion
        Add-Evidence -Step 'node' -Before 'missing' -ActionTaken "portable Node.js $Version (sha256 verified)" -Result $(if ($v) { 'PASS' } else { 'FAIL' }) -Verification $bin
        return [bool]$v
    } catch {
        Add-Evidence -Step 'node' -Before 'missing' -ActionTaken 'portable Node.js' -Result 'BLOCKED' -Verification $_.Exception.Message -Remediation 'Install Node.js LTS from https://nodejs.org, then rerun.'
        return $false
    }
}

function Test-Prerequisites {
    param([switch]$NeedNode, [switch]$NeedGit)
    $ok = $true
    $ps = $PSVersionTable.PSVersion
    if ($ps.Major -lt 5 -or ($ps.Major -eq 5 -and $ps.Minor -lt 1)) {
        Add-Evidence -Step 'powershell' -Before ("{0}" -f $ps) -ActionTaken 'version check' -Result 'BLOCKED' -Remediation 'Windows PowerShell 5.1 or PowerShell 7 is required.'
        $ok = $false
    } else {
        Add-Evidence -Step 'powershell' -Before ("{0}" -f $ps) -ActionTaken 'version check' -Result 'PASS'
    }
    if ($NeedNode) {
        $v = Get-NodeVersion
        $nodeWanted = '22.14.0'
        if ($script:Cfg -and $script:Cfg.PSObject.Properties['distribution'] -and $script:Cfg.distribution.PSObject.Properties['node_version'] -and $script:Cfg.distribution.node_version) { $nodeWanted = $script:Cfg.distribution.node_version }
        if ($null -eq $v -and $InstallNode) { if (Install-NodeWithWinget -Version $nodeWanted) { $v = Get-NodeVersion } }
        if ($null -eq $v -and -not $InstallNode -and -not $NonInteractive) {
            if (Confirm-Interactive 'Node.js is not installed. Install Node.js LTS with winget now?') { if (Install-NodeWithWinget) { $v = Get-NodeVersion } }
        }
        if ($null -eq $v) {
            Add-Evidence -Step 'node' -Before 'missing' -ActionTaken 'version check' -Result 'BLOCKED' -Remediation 'Install Node.js 18 or newer (https://nodejs.org) or rerun with -InstallNode.'
            $ok = $false
        } elseif ($v.Major -lt 18) {
            Add-Evidence -Step 'node' -Before ("node {0}" -f $v) -ActionTaken 'version check' -Result 'BLOCKED' -Remediation 'Node.js 18 or newer is required.'
            $ok = $false
        } else {
            Add-Evidence -Step 'node' -Before ("node {0}" -f $v) -ActionTaken 'version check' -Result 'PASS'
        }
    }
    if ($NeedGit) {
        $git = Get-CommandPath 'git'
        if ($null -eq $git) {
            Add-Evidence -Step 'git' -Before 'missing' -ActionTaken 'presence check' -Result 'BLOCKED' -Remediation 'Install Git for Windows (winget install Git.Git) to fetch upstream kits.'
            $ok = $false
        } else {
            Add-Evidence -Step 'git' -Before $git -ActionTaken 'presence check' -Result 'PASS'
        }
    }
    return $ok
}

# ------------------------------------------------------------------ actions
function Get-DefaultOutDir {
    param([Parameter(Mandatory = $true)][string]$ProfileName)
    $docs = $null
    if ($script:IsWindowsHost) { try { $docs = [Environment]::GetFolderPath('MyDocuments') } catch { $docs = $null } }
    if (-not $docs) { $docs = Join-Path $HOME 'Documents' }
    return (Join-Path (Join-Path (Join-Path $docs 'DE') 'msp-ai-kit') $ProfileName)
}

function Invoke-KitBuild {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Destination, [string]$Config)
    $node = Get-CommandPath 'node'
    $buildScript = Join-Path $Root 'scripts\build.mjs'
    $buildArgs = @($buildScript, '--out', $Destination, '--quiet')
    if ($Config) { $buildArgs += @('--config', $Config) }
    if ($Only) { $buildArgs += @('--only', ($Only -join ',')) }
    if ($Skip) { $buildArgs += @('--skip', ($Skip -join ',')) }
    if ($Targets) { $buildArgs += @('--targets', ($Targets -join ',')) }
    foreach ($s in @($Set)) { if ($s) { $buildArgs += @('--set', $s) } }

    $before = 'no pack'
    $index = Join-Path $Destination 'INDEX.md'
    if (Test-Path -LiteralPath $index) { $before = 'pack present' }

    # plan: dry run through the builder itself so budgets and modules are reported without writing
    $plan = Invoke-Native -FilePath $node -Arguments ($buildArgs + @('--dry-run')) -WorkingDirectory $Root
    if ($plan.ExitCode -ne 0) {
        Add-Evidence -Step 'build.plan' -Before $before -ActionTaken 'build.mjs --dry-run' -Result 'FAIL' -Verification (($plan.Output | Select-Object -Last 5) -join ' / ') -Remediation 'Fix kit.config.json or the module reported above.'
        return $false
    }
    Add-Evidence -Step 'build.plan' -Before $before -ActionTaken 'build.mjs --dry-run' -Result 'PASS'

    if (-not $PSCmdlet.ShouldProcess($Destination, 'Write MSP AI Kit packs')) {
        Add-Evidence -Step 'build.apply' -Before $before -ActionTaken ("node build.mjs --out {0}" -f $Destination) -Result 'PLANNED'
        return $true
    }
    $r = Invoke-Native -FilePath $node -Arguments $buildArgs -WorkingDirectory $Root
    if ($r.ExitCode -ne 0) {
        Add-Evidence -Step 'build.apply' -Before $before -ActionTaken 'node build.mjs' -Result 'FAIL' -Verification (($r.Output | Select-Object -Last 5) -join ' / ')
        return $false
    }
    # verify
    $manifest = Join-Path $Destination 'manifest.json'
    if ((Test-Path -LiteralPath $index) -and (Test-Path -LiteralPath $manifest)) {
        $m = Get-JsonFile -Path $manifest
        $count = @(Get-ChildItem -LiteralPath $Destination -Recurse -File).Count
        Add-Evidence -Step 'build.verify' -Before $before -ActionTaken 'INDEX.md + manifest.json present' -Result 'PASS' -Verification ("profile {0}, {1} files, config {2}" -f $m.profile, $count, $m.configHash)
        return $true
    }
    Add-Evidence -Step 'build.verify' -Before $before -ActionTaken 'INDEX.md + manifest.json present' -Result 'FAIL' -Remediation 'Builder exited 0 but the pack is incomplete; rerun with -Verbose and check the log.'
    return $false
}

function Get-LinkTarget {
    param([Parameter(Mandatory = $true)][string]$Path)
    $item = Get-Item -LiteralPath $Path -Force -ErrorAction SilentlyContinue
    if ($null -eq $item) { return $null }
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
        $t = $item.Target
        if ($t -is [array]) { $t = $t[0] }
        return "$t"
    }
    return ''
}

function Install-SkillLink {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string]$Destination, [Parameter(Mandatory = $true)][string]$Label)
    $parent = Split-Path -Parent $Destination
    $existing = Get-LinkTarget -Path $Destination
    if ($null -ne $existing) {
        $same = $false
        if ($existing) {
            try { $same = ((Resolve-Path -LiteralPath $existing -ErrorAction Stop).Path.TrimEnd('\', '/') -eq $Root.TrimEnd('\', '/')) } catch { $same = $false }
        }
        if ($same) { Add-Evidence -Step $Label -Before 'linked to this kit' -ActionTaken 'none' -Result 'NO CHANGE' -Verification $Destination; return $true }
        if (-not $Force) {
            Add-Evidence -Step $Label -Before 'other content present' -ActionTaken 'kept' -Result 'WARN' -Verification $Destination -Remediation 'Rerun with -Force to replace it with a link to this kit.'
            return $true
        }
        if ($PSCmdlet.ShouldProcess($Destination, 'Remove existing skill entry (-Force)')) {
            if ($existing) { (Get-Item -LiteralPath $Destination -Force).Delete() } else { Remove-Item -LiteralPath $Destination -Recurse -Force }
        } else {
            Add-Evidence -Step $Label -Before 'other content present' -ActionTaken 'replace (-Force)' -Result 'PLANNED'; return $true
        }
    }
    if (-not $PSCmdlet.ShouldProcess($Destination, "Link to $Root")) {
        Add-Evidence -Step $Label -Before 'absent' -ActionTaken 'create junction' -Result 'PLANNED' -Verification $Destination
        return $true
    }
    if (-not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    $created = $false
    if ($script:IsWindowsHost) {
        try { New-Item -ItemType Junction -Path $Destination -Target $Root | Out-Null; $created = $true } catch { $created = $false }
    }
    if (-not $created) {
        try { New-Item -ItemType SymbolicLink -Path $Destination -Target $Root | Out-Null; $created = $true } catch { $created = $false }
    }
    if (-not $created) {
        # last resort: a copy (works everywhere, but edits to the kit do not follow)
        Copy-Item -LiteralPath $Root -Destination $Destination -Recurse -Force
        Add-Evidence -Step $Label -Before 'absent' -ActionTaken 'copied (link not permitted)' -Result 'WARN' -Verification $Destination -Remediation 'Enable Developer Mode or run once elevated to get a live link instead of a copy.'
        return $true
    }
    $check = Join-Path $Destination 'SKILL.md'
    if (Test-Path -LiteralPath $check) {
        Add-Evidence -Step $Label -Before 'absent' -ActionTaken 'created link' -Result 'PASS' -Verification $Destination
        return $true
    }
    Add-Evidence -Step $Label -Before 'absent' -ActionTaken 'created link' -Result 'FAIL' -Verification 'SKILL.md not reachable through the link'
    return $false
}

function Install-Kit {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Root, [string]$PackDir)
    $ok = $true
    $ok = (Install-SkillLink -Root $Root -Destination (Join-Path (Join-Path $HOME '.claude') 'skills\msp-ai-kit') -Label 'install.claude-skill') -and $ok
    $ok = (Install-SkillLink -Root $Root -Destination (Join-Path (Join-Path $HOME '.agents') 'skills\msp-ai-kit') -Label 'install.agents-skill') -and $ok
    if ($CursorRepo) {
        $rule = $null
        if ($PackDir) { $rule = Join-Path $PackDir 'cursor\msp-ai-kit.mdc' }
        if (-not $rule -or -not (Test-Path -LiteralPath $rule)) {
            $rule = Join-Path $Root 'examples\digerati-experts\cursor\msp-ai-kit.mdc'
        }
        $dest = Join-Path (Join-Path $CursorRepo '.cursor') 'rules\msp-ai-kit.mdc'
        if (-not (Test-Path -LiteralPath $rule)) {
            Add-Evidence -Step 'install.cursor-rule' -Before 'no built rule' -ActionTaken 'copy' -Result 'SKIPPED' -Remediation 'Run Build first.'
        } elseif ((Test-Path -LiteralPath $dest) -and ((Get-FileHash -LiteralPath $dest).Hash -eq (Get-FileHash -LiteralPath $rule).Hash)) {
            Add-Evidence -Step 'install.cursor-rule' -Before 'identical rule present' -ActionTaken 'none' -Result 'NO CHANGE' -Verification $dest
        } elseif ($PSCmdlet.ShouldProcess($dest, 'Copy Cursor rule')) {
            New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
            Copy-Item -LiteralPath $rule -Destination $dest -Force
            Add-Evidence -Step 'install.cursor-rule' -Before 'absent or different' -ActionTaken 'copied' -Result 'PASS' -Verification $dest
        } else {
            Add-Evidence -Step 'install.cursor-rule' -Before 'absent or different' -ActionTaken 'copy' -Result 'PLANNED' -Verification $dest
        }
    }
    return $ok
}

function Uninstall-Kit {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Root)
    foreach ($dest in @((Join-Path (Join-Path $HOME '.claude') 'skills\msp-ai-kit'), (Join-Path (Join-Path $HOME '.agents') 'skills\msp-ai-kit'))) {
        $existing = Get-LinkTarget -Path $dest
        if ($null -eq $existing) { Add-Evidence -Step 'uninstall' -Before 'absent' -ActionTaken 'none' -Result 'NO CHANGE' -Verification $dest; continue }
        if ($existing -eq '') { Add-Evidence -Step 'uninstall' -Before 'real folder (not a link)' -ActionTaken 'kept' -Result 'WARN' -Verification $dest -Remediation 'Delete it by hand if it is a copy of this kit.'; continue }
        if ($PSCmdlet.ShouldProcess($dest, 'Remove skill link')) {
            (Get-Item -LiteralPath $dest -Force).Delete()
            Add-Evidence -Step 'uninstall' -Before 'linked' -ActionTaken 'removed link' -Result 'PASS' -Verification $dest
        } else {
            Add-Evidence -Step 'uninstall' -Before 'linked' -ActionTaken 'remove link' -Result 'PLANNED' -Verification $dest
        }
    }
    return $true
}

function Get-ChatGptBlocks {
    param([Parameter(Mandatory = $true)][string]$PackDir)
    $file = Join-Path $PackDir 'chatgpt-custom-instructions.md'
    if (-not (Test-Path -LiteralPath $file)) { return $null }
    $text = Get-Content -LiteralPath $file -Raw -Encoding UTF8
    $blocks = [regex]::Matches($text, '```text\r?\n([\s\S]*?)\r?\n```')
    if ($blocks.Count -lt 2) { return $null }
    return @($blocks[0].Groups[1].Value, $blocks[1].Groups[1].Value)
}

function Copy-ChatGptBlocks {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$PackDir)
    $blocks = Get-ChatGptBlocks -PackDir $PackDir
    if ($null -eq $blocks) {
        Add-Evidence -Step 'clipboard' -Before 'no pack' -ActionTaken 'read chatgpt-custom-instructions.md' -Result 'SKIPPED' -Remediation 'Run Build first.'
        return $false
    }
    $canClip = ($null -ne (Get-Command Set-Clipboard -ErrorAction SilentlyContinue))
    $labels = @('Block A (what ChatGPT should know about you)', 'Block B (how ChatGPT should respond)')
    for ($i = 0; $i -lt 2; $i++) {
        $out = Join-Path $PackDir ("chatgpt-block-{0}.txt" -f @('A', 'B')[$i])
        if ($PSCmdlet.ShouldProcess($out, 'Write block text file')) { Set-Content -LiteralPath $out -Value $blocks[$i] -Encoding UTF8 -NoNewline }
        $copied = $false
        if ($canClip -and -not $NonInteractive) {
            try { Set-Clipboard -Value $blocks[$i]; $copied = $true } catch { $copied = $false }
        }
        if ($copied) {
            Write-Host ""
            Write-Host ("{0} is on the clipboard ({1} chars). Paste it into ChatGPT > Settings > Personalization > Custom instructions." -f $labels[$i], $blocks[$i].Length) -ForegroundColor Green
            if ($i -eq 0) { Read-Host 'Press Enter when Block A is pasted to load Block B' | Out-Null }
            Add-Evidence -Step ("clipboard.{0}" -f @('A', 'B')[$i]) -Before 'pack present' -ActionTaken 'Set-Clipboard' -Result 'PASS' -Verification ("{0} chars; also saved to {1}" -f $blocks[$i].Length, $out)
        } else {
            Add-Evidence -Step ("clipboard.{0}" -f @('A', 'B')[$i]) -Before 'pack present' -ActionTaken 'saved to file (clipboard unavailable or non-interactive)' -Result 'PASS' -Verification $out
        }
    }
    return $true
}

function Get-UpstreamLock {
    param([Parameter(Mandatory = $true)][string]$Root)
    $lock = Join-Path $Root 'upstream.lock'
    $notes = @{ rtfm = 'Use to run your own MSP; do not resell or copy its text into DE repositories.'; servosity = 'Read skills\<name>\install.ps1 before running it; connector credentials come from environment variables.'; wyre = 'Install in Claude Code: /plugin marketplace add wyre-technology/msp-claude-plugins'; cmmc = 'Linked as ~/.claude/skills/cmmc-advisor.' }
    $out = @()
    foreach ($line in @(Get-Content -LiteralPath $lock)) {
        if ($line -match '^\s*#' -or -not $line.Trim()) { continue }
        $f = @($line.Trim() -split '\s+')
        $out += [pscustomobject]@{ Id = $f[0]; Url = $f[1]; Commit = $f[2]; License = $f[3]; Links = $f[4]; Note = $notes[$f[0]] }
    }
    return $out
}

function Install-UpstreamKits {
    <# Clones each kit at the commit pinned in upstream.lock (or the head with -Latest), copies its LICENSE, links Claude Code skills (RTFM skills/*, cmmc-advisor). Nothing is executed. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Vendor, [Parameter(Mandatory = $true)][string]$Root)
    $git = Get-CommandPath 'git'
    $ok = $true
    $licDir = Join-Path $Vendor 'LICENSES'
    if ($PSCmdlet.ShouldProcess($Vendor, 'Create vendor directory')) { New-Item -ItemType Directory -Path $licDir -Force | Out-Null }
    foreach ($kit in Get-UpstreamLock -Root $Root) {
        if ($UpstreamKits -notcontains $kit.Id) { continue }
        $target = Join-Path $Vendor $kit.Id
        $step = "upstream.{0}" -f $kit.Id
        $ref = $(if ($Latest) { 'HEAD' } else { $kit.Commit })
        if (-not $PSCmdlet.ShouldProcess($target, ("fetch {0} @ {1} ({2})" -f $kit.Url, $ref.Substring(0, [Math]::Min(12, $ref.Length)), $kit.License))) { Add-Evidence -Step $step -Before 'n/a' -ActionTaken "fetch @ $ref" -Result 'PLANNED' -Verification $kit.License; continue }
        if (-not (Test-Path -LiteralPath (Join-Path $target '.git'))) { $null = Invoke-Native -FilePath $git -Arguments @('init', '--quiet', $target); $null = Invoke-Native -FilePath $git -Arguments @('-C', $target, 'remote', 'add', 'origin', $kit.Url) }
        $r = Invoke-Native -FilePath $git -Arguments @('-C', $target, 'fetch', '--depth', '1', '--quiet', 'origin', $ref)
        if ($r.ExitCode -eq 0) { $r = Invoke-Native -FilePath $git -Arguments @('-C', $target, 'checkout', '--quiet', '--force', 'FETCH_HEAD') }
        if ($r.ExitCode -ne 0) { Add-Evidence -Step $step -Before 'n/a' -ActionTaken "fetch @ $ref" -Result 'FAIL' -Verification (($r.Output | Select-Object -Last 3) -join ' / ') -Remediation 'Check network access to github.com and rerun.'; $ok = $false; continue }
        $head = ((Invoke-Native -FilePath $git -Arguments @('-C', $target, 'rev-parse', 'HEAD')).Output -join '').Trim()
        if (-not $Latest -and $head -ne $kit.Commit) { Add-Evidence -Step $step -Before 'n/a' -ActionTaken 'pin check' -Result 'FAIL' -Verification "wanted $($kit.Commit) got $head"; $ok = $false; continue }
        $lic = Get-ChildItem -LiteralPath $target -Filter 'LICENSE*' -File -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($lic) { Copy-Item -LiteralPath $lic.FullName -Destination (Join-Path $licDir "$($kit.Id)-LICENSE.txt") -Force }
        Add-Evidence -Step $step -Before 'n/a' -ActionTaken ("checked out {0}" -f $head.Substring(0, 12)) -Result 'PASS' -Verification ("{0}; {1}; license file {2}" -f $kit.License, $kit.Note, $(if ($lic) { 'copied' } else { 'not found' }))
        if ($kit.Links -and $kit.Links -ne '-') {
            foreach ($g in $kit.Links.Split(':')) {
                $dirs = $(if ($g -eq '.') { @(Get-Item -LiteralPath $target) } else { @(Get-ChildItem -Path (Join-Path $target $g) -Directory -ErrorAction SilentlyContinue) })
                foreach ($d in $dirs) {
                    if (-not (Test-Path -LiteralPath (Join-Path $d.FullName 'SKILL.md'))) { continue }
                    $name = $(if ($g -eq '.') { "$($kit.Id)-advisor" } else { $d.Name })
                    $null = Install-SkillLink -Root $d.FullName -Destination (Join-Path (Join-Path $HOME '.claude') "skills\$name") -Label "upstream.$($kit.Id).link.$name"
                }
            }
        }
    }
    Write-KitLog -Level INFO -Message 'Upstream kits are cloned at pinned commits only. Read each README and LICENSE; nothing from them was executed.'
    return $ok
}

# ------------------------------------------------------------------ version, update, cleanup, receipt upload
function Get-KitVersionInfo {
    param([Parameter(Mandatory = $true)][string]$Root, $Config)
    $local = $null; $vf = Join-Path $Root 'kit.version'; if (Test-Path -LiteralPath $vf) { $local = (Get-Content -LiteralPath $vf -Raw).Trim() }
    $remote = $null; $url = $null
    if ($Config -and $Config.PSObject.Properties['distribution'] -and $Config.distribution.PSObject.Properties['version_url']) { $url = $Config.distribution.version_url }
    if ($url -and $url -match '^https://') { try { $remote = (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 20).Content.Trim() } catch { Write-KitLog -Level WARN -Message "version check failed: $($_.Exception.Message)" } }
    $newer = $false; if ($local -and $remote) { try { $newer = ([version]$remote -gt [version]$local) } catch { $newer = ($remote -ne $local) } }
    return [pscustomobject]@{ local = $local; remote = $remote; updateAvailable = $newer; versionUrl = $url }
}

function Update-Kit {
    <# Downloads the kit zip, checks its sha256, backs up the current kit, replaces files, keeps kit.config.json and profiles/. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Root, $Config)
    $info = Get-KitVersionInfo -Root $Root -Config $Config
    $url = $UpdateUrl; if (-not $url -and $Config -and $Config.PSObject.Properties['distribution'] -and $Config.distribution.PSObject.Properties['update_url']) { $url = $Config.distribution.update_url }
    if (-not $url) { Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken 'check' -Result 'SKIPPED' -Verification 'no update_url configured' -Remediation 'Set distribution.update_url (and version_url) in kit.config.json or pass -UpdateUrl.'; return $false }
    if ($url -notmatch '^https://') { Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken 'check' -Result 'BLOCKED' -Verification 'update URL must be HTTPS'; return $false }
    if ($info.versionUrl -and -not $info.updateAvailable -and -not $UpdateUrl) { Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken 'check' -Result 'NO CHANGE' -Verification "remote $($info.remote)"; return $true }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("msp-ai-kit-update-{0}" -f ([guid]::NewGuid()))
    if (-not $PSCmdlet.ShouldProcess($Root, "update from $url")) { Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken "download $url" -Result 'PLANNED' -Verification "remote $($info.remote)"; return $true }
    try {
        New-Item -ItemType Directory -Path $tmp -Force | Out-Null
        $zip = Join-Path $tmp 'kit.zip'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
        $have = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($UpdateSha256 -and $have -ne $UpdateSha256.ToLowerInvariant()) { throw "sha256 mismatch (have $have)" }
        if (-not $UpdateSha256) { Write-KitLog -Level WARN -Message "no expected sha256 given; downloaded file sha256 $have" }
        Expand-Archive -LiteralPath $zip -DestinationPath $tmp -Force
        $newRoot = Get-ChildItem -LiteralPath $tmp -Directory -Recurse | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'scripts\build.mjs') } | Select-Object -First 1
        if (-not $newRoot) { throw 'the zip does not contain an msp-ai-kit folder (scripts\build.mjs missing)' }
        $sig = Get-AuthenticodeSignature -LiteralPath (Join-Path $newRoot.FullName 'windows\Install-MspAiKit.ps1') -ErrorAction SilentlyContinue
        if ($sig -and $sig.Status -eq 'HashMismatch') { throw 'the new loader signature does not match its content' }
        $backup = "$Root.bak-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Copy-Item -LiteralPath $Root -Destination $backup -Recurse -Force
        $keep = @('kit.config.json', 'profiles')
        foreach ($item in Get-ChildItem -LiteralPath $newRoot.FullName -Force) { if ($keep -contains $item.Name -and (Test-Path -LiteralPath (Join-Path $Root $item.Name))) { continue }; Copy-Item -LiteralPath $item.FullName -Destination $Root -Recurse -Force }
        $after = Get-KitVersionInfo -Root $Root -Config $Config
        Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken "updated from $url" -Result 'PASS' -Verification ("now {0}; sha256 {1}; backup {2}; kit.config.json and profiles kept" -f $after.local, $have, $backup)
        return $true
    } catch { Add-Evidence -Step 'update' -Before "local $($info.local)" -ActionTaken 'update' -Result 'FAIL' -Verification $_.Exception.Message -Remediation 'The previous kit is untouched unless a backup path was reported.'; return $false }
    finally { Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

function Invoke-Cleanup {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param($Config, [string]$PackDir)
    $days = $RetentionDays
    if (-not $days -and $Config -and $Config.PSObject.Properties['distribution'] -and $Config.distribution.PSObject.Properties['retention_days']) { $days = [int]$Config.distribution.retention_days }
    if (-not $days) { $days = 90 }
    $cut = (Get-Date).AddDays(-$days)
    $targets = @()
    if ($script:LogDir) { $targets += @(Get-ChildItem -LiteralPath $script:LogDir -File -Filter 'msp-ai-kit*' -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cut -and $_.FullName -ne $script:LogFile }) }
    $base = Split-Path -Parent $PackDir
    if ($base -and (Test-Path -LiteralPath $base)) { $targets += @(Get-ChildItem -LiteralPath $base -Directory -ErrorAction SilentlyContinue | Where-Object { $_.FullName -ne $PackDir -and $_.LastWriteTime -lt $cut -and (Test-Path -LiteralPath (Join-Path $_.FullName 'manifest.json')) }) }
    $root = Split-Path -Parent $PSScriptRoot
    $targets += @(Get-ChildItem -LiteralPath (Split-Path -Parent $root) -Directory -Filter "$(Split-Path -Leaf $root).bak-*" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -lt $cut })
    $removed = 0
    foreach ($t in $targets) { if ($PSCmdlet.ShouldProcess($t.FullName, "remove (older than $days days)")) { Remove-Item -LiteralPath $t.FullName -Recurse -Force -ErrorAction SilentlyContinue; $removed++ } }
    Add-Evidence -Step 'cleanup' -Before ("{0} item(s) older than {1} days" -f $targets.Count, $days) -ActionTaken 'retention' -Result $(if ($targets.Count -eq 0) { 'NO CHANGE' } elseif ($WhatIfPreference) { 'PLANNED' } else { 'PASS' }) -Verification ("removed {0}" -f $removed)
    return $removed
}

function Send-Receipt {
    <# POSTs the receipt JSON (no secrets) to the configured webhook. Failure is a WARN, never a crash. #>
    param([Parameter(Mandatory = $true)][string]$ReceiptPath, $Config)
    $url = $ReceiptUploadUrl
    if (-not $url -and $Config -and $Config.PSObject.Properties['distribution'] -and $Config.distribution.PSObject.Properties['receipt_url']) { $url = $Config.distribution.receipt_url }
    if (-not $url) { return }
    if ($url -notmatch '^https://') { Write-KitLog -Level WARN -Message 'receipt upload skipped: URL must be HTTPS'; return }
    if ($WhatIfPreference) { Write-KitLog -Level PLAN -Message "would upload receipt to $url"; return }
    try {
        $headers = @{ 'Content-Type' = 'application/json' }
        if ($env:DE_RECEIPT_TOKEN) { $headers['Authorization'] = "Bearer $($env:DE_RECEIPT_TOKEN)" }
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        $null = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body (Get-Content -LiteralPath $ReceiptPath -Raw) -TimeoutSec 30
        Write-KitLog -Level PASS -Message "receipt uploaded to $url"
    } catch { Write-KitLog -Level WARN -Message "receipt upload failed: $($_.Exception.Message)" }
}

function Test-Kit {
    param([Parameter(Mandatory = $true)][string]$Root)
    $node = Get-CommandPath 'node'
    $ok = $true
    $check = Invoke-Native -FilePath $node -Arguments @((Join-Path $Root 'scripts\build.mjs'), '--check', '--quiet') -WorkingDirectory $Root
    if ($check.ExitCode -eq 0) { Add-Evidence -Step 'verify.check' -Before 'kit present' -ActionTaken 'build.mjs --check' -Result 'PASS' -Verification ($check.Output -join ' ') }
    else { Add-Evidence -Step 'verify.check' -Before 'kit present' -ActionTaken 'build.mjs --check' -Result 'FAIL' -Verification (($check.Output | Select-Object -Last 5) -join ' / '); $ok = $false }
    $testFile = Join-Path $Root 'scripts\build.test.mjs'
    if (Test-Path -LiteralPath $testFile) {
        $tests = Invoke-Native -FilePath $node -Arguments @('--test', $testFile) -WorkingDirectory $Root
        $summary = ($tests.Output | Where-Object { $_ -match '^# (pass|fail) ' }) -join ', '
        if ($tests.ExitCode -eq 0) { Add-Evidence -Step 'verify.tests' -Before 'kit present' -ActionTaken 'node --test build.test.mjs' -Result 'PASS' -Verification $summary }
        else { Add-Evidence -Step 'verify.tests' -Before 'kit present' -ActionTaken 'node --test build.test.mjs' -Result 'FAIL' -Verification $summary; $ok = $false }
    }
    return $ok
}

# --------------------------------------------------------------- reporting
function Write-Receipt {
    param([string]$PackDir)
    $summary = [pscustomobject]@{
        tool      = $script:ToolName
        version   = $script:ToolVersion
        machine   = $env:COMPUTERNAME
        user      = $env:USERNAME
        when      = (Get-Date).ToString('o')
        dryRun    = [bool]$WhatIfPreference
        exitCode  = $script:ExitCode
        log       = $script:LogFile
        packDir   = $PackDir
        steps     = @($script:Evidence)
    }
    $receiptPath = $null
    if ($script:LogDir) {
        $receiptPath = Join-Path $script:LogDir ("msp-ai-kit-receipt-{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
        try { $summary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $receiptPath -Encoding UTF8 -WhatIf:$false } catch { $receiptPath = $null }
    }
    Write-Host ""
    Write-Host ("{0} {1} summary" -f $script:ToolName, $script:ToolVersion) -ForegroundColor Cyan
    $script:Evidence | Format-Table -Property step, result, action, verification -AutoSize -Wrap | Out-Host
    $worst = 'PASS'
    if ($script:ExitCode -eq 1) { $worst = 'FAIL' } elseif ($script:ExitCode -eq 2) { $worst = 'BLOCKED' }
    if ($WhatIfPreference) { Write-Host 'DRY RUN: nothing was changed.' -ForegroundColor Yellow }
    if ($PackDir) { Write-Host ("Packs: {0}  (start with INDEX.md)" -f $PackDir) }
    if ($script:LogFile) { Write-Host ("Log: {0}" -f $script:LogFile) }
    if ($receiptPath) { Write-Host ("Receipt: {0}" -f $receiptPath) }
    Write-Host ("RESULT: {0} (exit {1})" -f $worst, $script:ExitCode) -ForegroundColor $(if ($script:ExitCode -eq 0) { 'Green' } else { 'Red' })
    return $receiptPath
}

# ------------------------------------------------------------------- menu
function Show-Header {
    param([string]$Root, [string]$ProfileName, [string]$PackDir)
    $nodeV = Get-NodeVersion
    $nodeText = 'BLOCKED  Node.js missing'
    if ($null -ne $nodeV) { $nodeText = "PASS     Node.js $nodeV" }
    $linkText = 'not installed'
    $link = Get-LinkTarget -Path (Join-Path (Join-Path $HOME '.claude') 'skills\msp-ai-kit')
    if ($null -ne $link) { $linkText = 'installed for this user' }
    $packText = 'not built'
    if ($PackDir -and (Test-Path -LiteralPath (Join-Path $PackDir 'INDEX.md'))) { $packText = "built at $PackDir" }
    Clear-Host
    Write-Host '==============================================================' -ForegroundColor DarkCyan
    Write-Host ' Digerati Experts MSP AI Kit  |  Windows loader' -ForegroundColor Cyan
    Write-Host '==============================================================' -ForegroundColor DarkCyan
    Write-Host (" Machine   {0}    User  {1}" -f $env:COMPUTERNAME, $env:USERNAME)
    Write-Host (" Kit       {0}" -f $Root)
    Write-Host (" Profile   {0}" -f $ProfileName)
    Write-Host (" Node      {0}" -f $nodeText)
    Write-Host (" Skill     {0}" -f $linkText)
    Write-Host (" Packs     {0}" -f $packText)
    Write-Host ''
}

function Show-Menu {
    param([string]$Root, [string]$ProfileName, [string]$PackDir, [string]$Config)
    while ($true) {
        Show-Header -Root $Root -ProfileName $ProfileName -PackDir $PackDir
        Write-Host ' 1  Build the packs           (ChatGPT, Custom GPT, Claude, Cursor, Copilot, prompts)'
        Write-Host ' 2  Install as a skill        (Claude Code and Codex for this user)'
        Write-Host ' 3  ChatGPT blocks            (copy Block A, then Block B to the clipboard)'
        Write-Host ' 4  Open the packs folder'
        Write-Host ' 5  Verify                    (config check + tests)'
        Write-Host ' 6  Fetch upstream kits       (RTFM, Servosity, WYRE, cmmc-advisor; clone only)'
        Write-Host ' 7  Everything                (1 + 2 + 5)'
        Write-Host ' 8  Dry run of everything     (shows the plan, changes nothing)'
        Write-Host ' 9  Uninstall the skill links'
        Write-Host ' L  Open the log folder'
        Write-Host ' Q  Quit'
        Write-Host ''
        $choice = (Read-Host ' Choose').Trim().ToUpperInvariant()
        switch ($choice) {
            '1' { if (Test-Prerequisites -NeedNode) { $null = Invoke-KitBuild -Root $Root -Destination $PackDir -Config $Config } }
            '2' { $null = Install-Kit -Root $Root -PackDir $PackDir }
            '3' { $null = Copy-ChatGptBlocks -PackDir $PackDir }
            '4' { if (Test-Path -LiteralPath $PackDir) { Invoke-Item -LiteralPath $PackDir } else { Write-KitLog -Level WARN -Message 'Build first.' } }
            '5' { if (Test-Prerequisites -NeedNode) { $null = Test-Kit -Root $Root } }
            '6' { if (Test-Prerequisites -NeedGit) { $null = Install-UpstreamKits -Vendor $script:VendorPath -Root $Root } }
            '7' { if (Test-Prerequisites -NeedNode) { if (Invoke-KitBuild -Root $Root -Destination $PackDir -Config $Config) { $null = Install-Kit -Root $Root -PackDir $PackDir; $null = Test-Kit -Root $Root } } }
            '8' {
                $saved = $WhatIfPreference; $WhatIfPreference = $true
                try { if (Test-Prerequisites -NeedNode) { $null = Invoke-KitBuild -Root $Root -Destination $PackDir -Config $Config; $null = Install-Kit -Root $Root -PackDir $PackDir } } finally { $WhatIfPreference = $saved }
            }
            '9' { $null = Uninstall-Kit -Root $Root }
            'L' { if ($script:LogDir) { Invoke-Item -LiteralPath $script:LogDir } }
            'Q' { return }
            default { Write-KitLog -Level WARN -Message "Unknown choice '$choice'." }
        }
        Write-Host ''
        Read-Host ' Press Enter to return to the menu' | Out-Null
    }
}

function Test-GuiAvailable {
    if ($NonInteractive) { return $false }
    if (-not $script:IsWindowsHost) { return $false }
    if (-not (Test-Path -LiteralPath $script:GuiFile)) { return $false }
    try { Add-Type -AssemblyName PresentationFramework -ErrorAction Stop; return $true } catch { return $false }
}

# -------------------------------------------------------------------- main
function Main {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param()
    Write-KitLog -Level STEP -Message ("{0} {1} starting; action {2}; dry run {3}" -f $script:ToolName, $script:ToolVersion, $Action, [bool]$WhatIfPreference)
    if (-not $script:LogFile) { Write-KitLog -Level WARN -Message 'No writable log directory found; console output only.' }

    $root = Resolve-KitRoot -Requested $KitRoot
    if (-not $root) {
        Add-Evidence -Step 'kit' -Before 'not found' -ActionTaken 'locate kit.config.json and scripts\build.mjs' -Result 'BLOCKED' -Remediation 'Run this from the msp-ai-kit\windows folder of the extracted zip, or pass -KitRoot.'
        $null = Write-Receipt
        return
    }
    $config = $ConfigPath
    if (-not $config) { $config = Join-Path $root 'kit.config.json' }
    if (-not (Test-Path -LiteralPath $config)) {
        Add-Evidence -Step 'config' -Before 'missing' -ActionTaken 'read' -Result 'BLOCKED' -Verification $config -Remediation 'Point -ConfigPath at a kit.config.json.'
        $null = Write-Receipt
        return
    }
    $cfg = $null
    try { $cfg = Get-JsonFile -Path $config } catch {
        Add-Evidence -Step 'config' -Before 'unreadable' -ActionTaken 'parse JSON' -Result 'BLOCKED' -Verification $_.Exception.Message -Remediation 'Fix the JSON syntax in kit.config.json.'
        $null = Write-Receipt
        return
    }
    $script:Cfg = $cfg
    $profileName = "$($cfg.profile)"
    if (-not $profileName) { $profileName = 'default' }
    Add-Evidence -Step 'kit' -Before $root -ActionTaken ("profile {0}" -f $profileName) -Result 'PASS' -Verification $config

    $packDir = $OutDir
    if (-not $packDir) { $packDir = Get-DefaultOutDir -ProfileName $profileName }
    $script:VendorPath = $VendorDir
    if (-not $script:VendorPath) {
        $base = $env:LOCALAPPDATA
        if (-not $base) { $base = Join-Path $HOME '.local/share' }
        $script:VendorPath = Join-Path (Join-Path (Join-Path $base 'DE') 'msp-ai-kit') 'vendor'
    }

    $effective = $Action
    if ($effective -eq 'Menu' -and $NonInteractive) { $effective = 'Build' }
    if ($effective -eq 'Menu') { $effective = $(if (Test-GuiAvailable) { 'Gui' } else { 'Console' }) }
    if ($effective -eq 'Gui' -and -not (Test-GuiAvailable)) {
        Write-KitLog -Level WARN -Message 'The window needs Windows with PresentationFramework and an interactive session; falling back to the text menu.'
        $effective = 'Console'
    }

    switch ($effective) {
        'Console' { Show-Menu -Root $root -ProfileName $profileName -PackDir $packDir -Config $config }
        'Gui' {
            $exe = (Get-Process -Id $PID).Path
            if ($PSCmdlet.ShouldProcess($script:GuiFile, 'open the DE Technician Console (AI Toolkit page)')) { Start-Process -FilePath $exe -ArgumentList @('-NoProfile', '-Sta', '-ExecutionPolicy', 'Bypass', '-File', $script:GuiFile, '-Page', 'AiToolkit') | Out-Null }
            Add-Evidence -Step 'gui' -Before 'loader' -ActionTaken 'opened the DE Technician Console' -Result 'INFO'
        }
        'Update' { $null = Update-Kit -Root $root -Config $cfg }
        'Cleanup' { $null = Invoke-Cleanup -Config $cfg -PackDir $packDir }
        'Version' { $v = Get-KitVersionInfo -Root $root -Config $cfg; Write-Host ("local {0}; remote {1}; update available {2}" -f $v.local, $(if ($v.remote) { $v.remote } else { 'unknown' }), $v.updateAvailable); Add-Evidence -Step 'version' -Before $v.local -ActionTaken 'compare' -Result 'INFO' -Verification ("remote {0}" -f $v.remote) }
        'Build' { if (Test-Prerequisites -NeedNode) { $null = Invoke-KitBuild -Root $root -Destination $packDir -Config $config } }
        'Install' { if (Test-Prerequisites) { $null = Install-Kit -Root $root -PackDir $packDir } }
        'Clipboard' { $null = Copy-ChatGptBlocks -PackDir $packDir }
        'Upstream' { if (Test-Prerequisites -NeedGit) { $null = Install-UpstreamKits -Vendor $script:VendorPath -Root $root } }
        'Verify' { if (Test-Prerequisites -NeedNode) { $null = Test-Kit -Root $root } }
        'Uninstall' { $null = Uninstall-Kit -Root $root }
        'All' {
            if (Test-Prerequisites -NeedNode) {
                if (Invoke-KitBuild -Root $root -Destination $packDir -Config $config) {
                    $null = Install-Kit -Root $root -PackDir $packDir
                    $null = Test-Kit -Root $root
                }
            }
        }
    }
    $receipt = Write-Receipt -PackDir $packDir
    if ($receipt) { Send-Receipt -ReceiptPath $receipt -Config $cfg }
}

try {
    Main -WhatIf:$WhatIfPreference
} catch {
    Add-Evidence -Step 'loader' -Before 'running' -ActionTaken 'unhandled error' -Result 'FAIL' -Verification $_.Exception.Message -Remediation 'See the log; rerun with -Verbose.'
    Write-KitLog -Level FAIL -Message ($_.ScriptStackTrace)
    if ($script:ExitCode -eq 0) { $script:ExitCode = 1 }
}
exit $script:ExitCode
