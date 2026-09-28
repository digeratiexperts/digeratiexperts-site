#Requires -Version 5.1
<#
.SYNOPSIS
    DE Technician Console core: state, evidence, secrets runtime, gate engine,
    action framework (detect / desired / apply / verify / retry / remediate /
    rollback), reboot-resume, exceptions, hashing and signature checks, HTTP.

.DESCRIPTION
    Every functional module (Discovery, Identity, JumpCloud, Security, Browser,
    Baseline, Apps, Branding, Maintenance, Network, Evidence, Workflows)
    registers its gates and actions here and never writes state, logs or
    evidence on its own. Rules enforced by this module, not by convention:

      * Secrets live only in memory (Set-DESecret / Get-DESecretPlain) and are
        registered for redaction; state, receipts, profiles and Hub payloads
        are scrubbed before they are written (Protect-DEText, Remove-DESecretKeys).
      * An action is BLOCKED while any of its gates is not PASS unless an
        approved, unexpired exception exists, and then the result is EXCEPTION,
        never PASS. Nothing turns a failed control green.
      * Every action runs Detect -> compare with Desired -> Apply (ShouldProcess)
        -> Verify -> retry -> Remediate -> retry -> (Rollback on request) and
        writes an evidence record for each attempt.
      * Reboot-required actions queue a resume entry (RunOnce + state) so the
        console reopens on the next step automatically.

    Windows PowerShell 5.1 compatible. No external modules.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:DE = @{
    Root         = $null
    ConsoleVersion = '0.9.0'
    IsWindows    = ($env:OS -eq 'Windows_NT')
    Mode         = 'Audit'          # Audit (detect only) | Apply
    DryRun       = $false
    Dirs         = @{}
    LogFile      = $null
    LogSink      = $null
    Secrets      = @{}              # name -> SecureString
    SecretNames  = @()
    Redactions   = New-Object System.Collections.Generic.List[string]
    Evidence     = New-Object System.Collections.ArrayList
    Actions      = [ordered]@{}
    Gates        = [ordered]@{}
    GateCache    = @{}
    Exceptions   = @{}              # id -> exception record
    State        = @{}
    Context      = @{}              # technician, client, site, endUser, device, mode
    ExitCode     = 0
}

# ------------------------------------------------------------------ paths and init
function Get-DEProgramData {
    if ($script:DE.IsWindows -and $env:ProgramData) { return (Join-Path $env:ProgramData 'DE\TechConsole') }
    return (Join-Path $HOME '.de/techconsole')
}

function Initialize-DEConsole {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Root,
        [ValidateSet('Audit', 'Apply')][string]$Mode = 'Audit',
        [switch]$DryRun,
        [string]$DataDir
    )
    $script:DE.Root = (Resolve-Path -LiteralPath $Root).Path
    $script:DE.Mode = $Mode
    $script:DE.DryRun = [bool]$DryRun
    $base = $DataDir
    if (-not $base) { $base = Get-DEProgramData }
    $dirs = @{ Base = $base; State = (Join-Path $base 'state'); Logs = (Join-Path $base 'logs'); Profiles = (Join-Path $base 'profiles'); Evidence = (Join-Path $base 'evidence'); Packages = (Join-Path $base 'packages'); Backups = (Join-Path $base 'backups') }
    foreach ($d in $dirs.Values) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force -WhatIf:$false | Out-Null } }
    $script:DE.Dirs = $dirs
    $script:DE.LogFile = Join-Path $dirs.Logs ("techconsole-{0}.log" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $script:DE.Evidence.Clear()
    $script:DE.GateCache = @{}
    Import-DEState | Out-Null
    Import-DEExceptions | Out-Null
    Write-DELog -Level STEP -Message ("DE Technician Console {0} initialised; mode {1}; dry run {2}; data {3}" -f $script:DE.ConsoleVersion, $Mode, [bool]$DryRun, $base)
    return $script:DE.Dirs
}

function Get-DEConsole { return $script:DE }
function Set-DEMode { param([ValidateSet('Audit', 'Apply')][string]$Mode, [switch]$DryRun) $script:DE.Mode = $Mode; $script:DE.DryRun = [bool]$DryRun }
function Set-DEContext {
    param([hashtable]$Values)
    foreach ($k in $Values.Keys) { $script:DE.Context[$k] = $Values[$k] }
    Set-DEStateValue -Path 'context' -Value (Remove-DESecretKeys -Object $script:DE.Context) | Out-Null
}
function Get-DEContext { return $script:DE.Context }

# ------------------------------------------------------------------ logging and redaction
function Register-DERedaction {
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value)
    if ($Value.Length -ge 4 -and -not $script:DE.Redactions.Contains($Value)) { $script:DE.Redactions.Add($Value) }
}

function Protect-DEText {
    param([AllowNull()][AllowEmptyString()][string]$Text)
    if (-not $Text) { return $Text }
    $t = $Text
    foreach ($v in $script:DE.Redactions) { if ($v) { $t = $t.Replace($v, '[REDACTED]') } }
    $t = [regex]::Replace($t, '(?i)\b(api[_ -]?key|token|secret|password|passwd|pwd|connect[_ -]?key|site[_ -]?token|org(anization)?[_ -]?key|recovery ?password|tap|temporary access pass)\b(\s*[:=]\s*)\S+', '$1$2[REDACTED]')
    $t = [regex]::Replace($t, '(?i)\bBearer\s+[A-Za-z0-9\-\._~\+\/]+=*', 'Bearer [REDACTED]')
    $t = [regex]::Replace($t, '\b\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}-\d{6}\b', '[REDACTED BITLOCKER KEY]')
    $t = [regex]::Replace($t, '\b(AKIA|ASIA)[A-Z0-9]{16}\b', '[REDACTED AWS KEY]')
    $t = [regex]::Replace($t, '\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b', '[REDACTED JWT]')
    $t = [regex]::Replace($t, '(?i)(-k|--key|/key[:=]|SITE_TOKEN=|ORG_KEY=|JCINSTALLERARGUMENTS=)\s*"?[A-Za-z0-9+/=_\-]{16,}', '$1 [REDACTED]')
    return $t
}

function Write-DELog {
    param([Parameter(Mandatory = $true)][string]$Message, [ValidateSet('INFO', 'PASS', 'WARN', 'FAIL', 'STEP', 'PLAN', 'DEBUG')][string]$Level = 'INFO')
    $line = "{0} [{1}] {2}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, (Protect-DEText $Message)
    if ($script:DE.LogFile) { try { Add-Content -LiteralPath $script:DE.LogFile -Value $line -WhatIf:$false } catch { } }
    if ($script:DE.LogSink) { try { & $script:DE.LogSink $line $Level } catch { } }
    if ($Level -ne 'DEBUG') {
        $color = switch ($Level) { 'PASS' { 'Green' } 'WARN' { 'Yellow' } 'FAIL' { 'Red' } 'STEP' { 'Cyan' } 'PLAN' { 'DarkGray' } default { 'Gray' } }
        Write-Host $line -ForegroundColor $color
    }
}

# ------------------------------------------------------------------ secrets runtime
function Set-DESecret {
    <# Stores a secret in memory only, registers its plaintext for redaction. Accepts a SecureString or -Plain (from a PasswordBox). #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Name, [System.Security.SecureString]$SecureValue, [string]$Plain)
    if ($Plain) { $SecureValue = ConvertTo-SecureString -String $Plain -AsPlainText -Force; Register-DERedaction -Value $Plain; $Plain = $null }
    if (-not $SecureValue) { throw "Set-DESecret ${Name}: no value supplied" }
    $script:DE.Secrets[$Name] = $SecureValue
    if ($script:DE.SecretNames -notcontains $Name) { $script:DE.SecretNames += $Name }
    Write-DELog -Level DEBUG -Message "secret '$Name' set for this session (value not logged)"
}
function Import-DESecretsFromVault {
    <#
    Loads runtime secrets from an approved secret store instead of a technician pasting them. Uses
    Microsoft.PowerShell.SecretManagement (any registered vault: SecretStore, Azure Key Vault, 1Password,
    Keeper, etc.). Values arrive as SecureString, are registered for redaction, and stay in memory only.
    Returns one row per requested name: loaded | missing | error. Never throws for a single missing secret.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Vault, [Parameter(Mandatory = $true)][string[]]$Names, [string]$Prefix = '')
    if (-not (Get-Command -Name Get-Secret -ErrorAction SilentlyContinue)) {
        try { Import-Module Microsoft.PowerShell.SecretManagement -ErrorAction Stop } catch { throw 'Microsoft.PowerShell.SecretManagement is not installed; install it and register the DE vault first' }
    }
    $rows = @()
    foreach ($n in $Names) {
        try {
            $sec = Get-Secret -Name ($Prefix + $n) -Vault $Vault -ErrorAction Stop
            if ($sec -is [string]) { Set-DESecret -Name $n -Plain $sec }
            elseif ($sec -is [System.Security.SecureString]) {
                Set-DESecret -Name $n -SecureValue $sec
                $null = Get-DESecretPlain -Name $n   # registers the value for redaction; the return value is discarded
            } else { throw "unsupported secret type $($sec.GetType().Name)" }
            $rows += [pscustomobject]@{ name = $n; status = 'loaded' }
        } catch {
            $msg = "$($_.Exception.Message)"
            $rows += [pscustomobject]@{ name = $n; status = $(if ($msg -match 'not found|could not be found|does not exist') { 'missing' } else { 'error' }); detail = (Protect-DEText $msg) }
        }
    }
    Add-DEEvidence -Step 'secrets.vault' -Module 'core' -Before 'runtime secrets' -ActionTaken "loaded from vault '$Vault'" -Result $(if (@($rows | Where-Object { $_.status -ne 'loaded' }).Count) { 'WARN' } else { 'INFO' }) -Verification (($rows | ForEach-Object { "$($_.name)=$($_.status)" }) -join ', ') | Out-Null
    return $rows
}
function Test-DESecret { param([Parameter(Mandatory = $true)][string]$Name) return $script:DE.Secrets.ContainsKey($Name) }
function Get-DESecretPlain {
    <# Returns the plaintext for the duration of an action. Callers must never persist it. #>
    param([Parameter(Mandatory = $true)][string]$Name)
    if (-not $script:DE.Secrets.ContainsKey($Name)) { throw "secret '$Name' has not been provided this session" }
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($script:DE.Secrets[$Name])
    try { $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    Register-DERedaction -Value $plain
    return $plain
}
function Clear-DESecrets { foreach ($k in @($script:DE.Secrets.Keys)) { try { $script:DE.Secrets[$k].Dispose() } catch { } }; $script:DE.Secrets = @{}; [GC]::Collect(); Write-DELog -Level DEBUG -Message 'secrets cleared' }
function Get-DESecretNames { return @($script:DE.SecretNames) }

$script:SecretKeyPattern = '(?i)(password|passwd|secret|token|apikey|api_key|connectkey|connect_key|orgkey|org_key|sitetoken|site_token|recoverypassword|recovery_password|tap\b|bearer|credential)'
function Remove-DESecretKeys {
    <# Deep-copies an object and drops any key whose name looks like a secret; scrubs string values. #>
    param([Parameter(Mandatory = $true)][AllowNull()]$Object)
    if ($null -eq $Object) { return $null }
    if ($Object -is [string]) { return (Protect-DEText $Object) }
    if ($Object -is [System.Collections.IDictionary]) {
        $o = [ordered]@{}
        foreach ($k in $Object.Keys) { if ("$k" -match $script:SecretKeyPattern) { $o[$k] = '[REDACTED]' } else { $o[$k] = Remove-DESecretKeys -Object $Object[$k] } }
        return $o
    }
    if ($Object -is [System.Collections.IEnumerable] -and -not ($Object -is [string])) { return @($Object | ForEach-Object { Remove-DESecretKeys -Object $_ }) }
    if ($Object -is [pscustomobject]) {
        $o = [ordered]@{}
        foreach ($p in $Object.PSObject.Properties) { if ($p.Name -match $script:SecretKeyPattern) { $o[$p.Name] = '[REDACTED]' } else { $o[$p.Name] = Remove-DESecretKeys -Object $p.Value } }
        return [pscustomobject]$o
    }
    return $Object
}

# ------------------------------------------------------------------ state (non-secret, per machine)
function Get-DEStatePath { return (Join-Path $script:DE.Dirs.State ("{0}.json" -f ($env:COMPUTERNAME, 'machine' | Where-Object { $_ } | Select-Object -First 1))) }
function Import-DEState {
    $p = Get-DEStatePath
    if (Test-Path -LiteralPath $p) { try { $script:DE.State = ConvertTo-DEHashtable (Get-Content -LiteralPath $p -Raw | ConvertFrom-Json) } catch { $script:DE.State = @{} } } else { $script:DE.State = @{} }
    if (-not $script:DE.State.ContainsKey('created')) { $script:DE.State['created'] = (Get-Date).ToString('o') }
    return $script:DE.State
}
function Save-DEState {
    $clean = Remove-DESecretKeys -Object $script:DE.State
    $clean['updated'] = (Get-Date).ToString('o')
    $clean['consoleVersion'] = $script:DE.ConsoleVersion
    $json = $clean | ConvertTo-Json -Depth 12
    if ($json -match $script:SecretKeyPattern -and $json -notmatch '\[REDACTED\]') { Write-DELog -Level WARN -Message 'state contains a secret-like key name; scrubbed before write' }
    Set-Content -LiteralPath (Get-DEStatePath) -Value $json -Encoding UTF8 -WhatIf:$false
}
function Get-DEState { param([string]$Path) if (-not $Path) { return $script:DE.State }; return (Get-DEHashPath -Object $script:DE.State -Path $Path) }
function Set-DEStateValue { param([Parameter(Mandatory = $true)][string]$Path, [AllowNull()]$Value) Set-DEHashPath -Object $script:DE.State -Path $Path -Value $Value; Save-DEState }
function Get-DEHashPath { param($Object, [string]$Path) $cur = $Object; foreach ($k in $Path.Split('.')) { if ($null -eq $cur) { return $null }; if ($cur -is [System.Collections.IDictionary]) { if ($cur.Contains($k)) { $cur = $cur[$k] } else { return $null } } else { $p = $cur.PSObject.Properties[$k]; if ($p) { $cur = $p.Value } else { return $null } } }; return $cur }
function Set-DEHashPath { param([System.Collections.IDictionary]$Object, [string]$Path, $Value) $ks = $Path.Split('.'); $cur = $Object; for ($i = 0; $i -lt $ks.Length - 1; $i++) { if (-not $cur.Contains($ks[$i]) -or -not ($cur[$ks[$i]] -is [System.Collections.IDictionary])) { $cur[$ks[$i]] = @{} }; $cur = $cur[$ks[$i]] }; $cur[$ks[$ks.Length - 1]] = $Value }
function ConvertTo-DEHashtable {
    param([AllowNull()]$InputObject)
    if ($null -eq $InputObject) { return $null }
    if ($InputObject -is [System.Collections.IDictionary]) { $h = @{}; foreach ($k in $InputObject.Keys) { $h[$k] = ConvertTo-DEHashtable $InputObject[$k] }; return $h }
    if ($InputObject -is [System.Collections.IEnumerable] -and -not ($InputObject -is [string])) { return @($InputObject | ForEach-Object { ConvertTo-DEHashtable $_ }) }
    if ($InputObject -is [pscustomobject]) { $h = @{}; foreach ($p in $InputObject.PSObject.Properties) { $h[$p.Name] = ConvertTo-DEHashtable $p.Value }; return $h }
    return $InputObject
}

# ------------------------------------------------------------------ evidence
function Add-DEEvidence {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Step,
        [string]$Module = 'core',
        [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Before,
        [Parameter(Mandatory = $true)][string]$ActionTaken,
        [Parameter(Mandatory = $true)][ValidateSet('PASS', 'WARN', 'BLOCKED', 'FAIL', 'NO CHANGE', 'SKIPPED', 'PLANNED', 'EXCEPTION', 'INFO')][string]$Result,
        [string]$Verification = '',
        [string]$Remediation = '',
        [string[]]$Artifacts = @(),
        [hashtable]$Data = @{}
    )
    $rec = [pscustomobject]@{
        timestamp    = (Get-Date).ToString('o')
        step         = $Step
        module       = $Module
        before       = (Protect-DEText $Before)
        action       = (Protect-DEText $ActionTaken)
        result       = $Result
        verification = (Protect-DEText $Verification)
        remediation  = (Protect-DEText $Remediation)
        artifacts    = @($Artifacts)
        data         = (Remove-DESecretKeys -Object $Data)
        technician   = "$($script:DE.Context['technician'])"
        client       = "$($script:DE.Context['client'])"
    }
    $null = $script:DE.Evidence.Add($rec)
    $level = switch ($Result) { 'PASS' { 'PASS' } 'NO CHANGE' { 'PASS' } 'PLANNED' { 'PLAN' } 'WARN' { 'WARN' } 'EXCEPTION' { 'WARN' } 'SKIPPED' { 'INFO' } 'INFO' { 'INFO' } default { 'FAIL' } }
    $suffix = ''; if ($Remediation) { $suffix = " | fix: $Remediation" }
    Write-DELog -Level $level -Message ("{0}: {1} ({2}){3}" -f $Step, $Result, $ActionTaken, $suffix)
    if ($Result -eq 'FAIL' -and $script:DE.ExitCode -eq 0) { $script:DE.ExitCode = 1 }
    if ($Result -eq 'BLOCKED' -and $script:DE.ExitCode -eq 0) { $script:DE.ExitCode = 2 }
    return $rec
}
function Get-DEEvidence { return @($script:DE.Evidence) }
function Clear-DEEvidence { $script:DE.Evidence.Clear(); $script:DE.ExitCode = 0 }

# ------------------------------------------------------------------ exceptions
function Get-DEExceptionsPath { return (Join-Path $script:DE.Dirs.State 'exceptions.json') }
function Import-DEExceptions { $p = Get-DEExceptionsPath; $script:DE.Exceptions = @{}; if (Test-Path -LiteralPath $p) { try { $list = Get-Content -LiteralPath $p -Raw | ConvertFrom-Json; foreach ($e in @($list | Where-Object { $null -ne $_ })) { $script:DE.Exceptions[$e.target] = $e } } catch { } }; return $script:DE.Exceptions }
function Save-DEExceptions { @($script:DE.Exceptions.Values) | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Get-DEExceptionsPath) -Encoding UTF8 -WhatIf:$false }
function Add-DEException {
    <# Records an approved exception for a gate or action. The item never reads PASS; it reads EXCEPTION until the expiry. #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Target, [Parameter(Mandatory = $true)][string]$Reason, [Parameter(Mandatory = $true)][string]$Approver, [Parameter(Mandatory = $true)][datetime]$ExpiresOn, [string]$Remediation = '', [string]$Technician = '')
    if ($ExpiresOn -le (Get-Date)) { throw 'an exception needs a future expiry date' }
    $rec = [pscustomobject]@{ target = $Target; reason = $Reason; approver = $Approver; technician = $(if ($Technician) { $Technician } else { "$($script:DE.Context['technician'])" }); created = (Get-Date).ToString('o'); expiresOn = $ExpiresOn.ToString('o'); remediation = $Remediation }
    $script:DE.Exceptions[$Target] = $rec
    Save-DEExceptions
    Add-DEEvidence -Step "exception.$Target" -Before 'no exception' -ActionTaken ("exception approved by {0} until {1}" -f $Approver, $ExpiresOn.ToString('yyyy-MM-dd')) -Result 'EXCEPTION' -Verification $Reason -Remediation $Remediation | Out-Null
    return $rec
}
function Remove-DEException { param([Parameter(Mandatory = $true)][string]$Target) if ($script:DE.Exceptions.ContainsKey($Target)) { $script:DE.Exceptions.Remove($Target); Save-DEExceptions } }
function Get-DEException { param([Parameter(Mandatory = $true)][string]$Target) if (-not $script:DE.Exceptions.ContainsKey($Target)) { return $null }; $e = $script:DE.Exceptions[$Target]; if ([datetime]$e.expiresOn -le (Get-Date)) { return $null }; return $e }
function Get-DEExceptions { return @($script:DE.Exceptions.Values | Where-Object { [datetime]$_.expiresOn -gt (Get-Date) }) }

# ------------------------------------------------------------------ gates
function Register-DEGate {
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][string]$Id, [Parameter(Mandatory = $true)][string]$Title, [string]$Module = 'core', [Parameter(Mandatory = $true)][scriptblock]$Check, [string]$Unblock = '')
    $script:DE.Gates[$Id] = [pscustomobject]@{ Id = $Id; Title = $Title; Module = $Module; Check = $Check; Unblock = $Unblock }
}
function Test-DEGate {
    <# Returns @{Id; Status = PASS|WARN|BLOCKED|READY|EXCEPTION; Detail; Unblock}. Results are cached until Reset-DEGateCache. #>
    param([Parameter(Mandatory = $true)][string]$Id, [switch]$Refresh)
    if (-not $script:DE.Gates.Contains($Id)) { return [pscustomobject]@{ Id = $Id; Status = 'BLOCKED'; Detail = 'gate not registered'; Unblock = '' } }
    if (-not $Refresh -and $script:DE.GateCache.ContainsKey($Id)) { return $script:DE.GateCache[$Id] }
    $g = $script:DE.Gates[$Id]
    $r = $null
    try { $r = & $g.Check } catch { $r = @{ Status = 'BLOCKED'; Detail = "gate check failed: $($_.Exception.Message)" } }
    if ($null -eq $r) { $r = @{ Status = 'BLOCKED'; Detail = 'gate returned nothing' } }
    $status = "$($r.Status)"; if ($status -notin @('PASS', 'WARN', 'BLOCKED', 'READY')) { $status = 'BLOCKED' }
    $detail = "$($r.Detail)"
    if ($status -ne 'PASS') { $ex = Get-DEException -Target $Id; if ($ex) { $status = 'EXCEPTION'; $detail = "$detail | exception by $($ex.approver) until $(([datetime]$ex.expiresOn).ToString('yyyy-MM-dd')): $($ex.reason)" } }
    $res = [pscustomobject]@{ Id = $Id; Title = $g.Title; Module = $g.Module; Status = $status; Detail = (Protect-DEText $detail); Unblock = $g.Unblock; CheckedAt = (Get-Date).ToString('o') }
    $script:DE.GateCache[$Id] = $res
    return $res
}
function Reset-DEGateCache { $script:DE.GateCache = @{} }
function Get-DEGateBoard { param([switch]$Refresh) return @($script:DE.Gates.Keys | ForEach-Object { Test-DEGate -Id $_ -Refresh:$Refresh }) }
function Test-DEGatesSatisfied { param([string[]]$Ids) $bad = @(); foreach ($id in @($Ids | Where-Object { $null -ne $_ })) { $g = Test-DEGate -Id $id; if ($g.Status -notin @('PASS', 'EXCEPTION')) { $bad += $g } }; return [pscustomobject]@{ Ok = ($bad.Count -eq 0); Failing = $bad; ViaException = @(@($Ids) | ForEach-Object { Test-DEGate -Id $_ } | Where-Object { $_ -and $_.Status -eq 'EXCEPTION' }) }
}

# ------------------------------------------------------------------ actions
function Register-DEAction {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Module,
        [Parameter(Mandatory = $true)][string]$Title,
        [int]$Phase = 99,
        [string[]]$Gates = @(),
        [string[]]$RequiresSecrets = @(),
        [switch]$Destructive,
        [switch]$RequiresReboot,
        [switch]$RequiresElevation,
        [string[]]$Modes = @('new', 'takeover', 'replacement', 'repair', 'co-managed', 'audit', 'deprovision'),
        [Parameter(Mandatory = $true)][scriptblock]$Detect,
        [scriptblock]$Desired = { @{ ok = $true } },
        [scriptblock]$Compare,
        [scriptblock]$Apply,
        [scriptblock]$Verify,
        [scriptblock]$Remediate,
        [scriptblock]$Rollback,
        [string]$ManualAction = '',
        [string]$Description = ''
    )
    $script:DE.Actions[$Id] = [pscustomobject]@{
        Id = $Id; Module = $Module; Title = $Title; Phase = $Phase; Gates = $Gates; RequiresSecrets = $RequiresSecrets; Destructive = [bool]$Destructive; RequiresReboot = [bool]$RequiresReboot; RequiresElevation = [bool]$RequiresElevation; Modes = $Modes
        Detect = $Detect; Desired = $Desired; Compare = $Compare; Apply = $Apply; Verify = $Verify; Remediate = $Remediate; Rollback = $Rollback; ManualAction = $ManualAction; Description = $Description
    }
}
function Get-DEActions { param([string]$Module, [string]$Mode) $all = @($script:DE.Actions.Values); if ($Module) { $all = @($all | Where-Object { $_ -and $_.Module -eq $Module }) }; if ($Mode) { $all = @($all | Where-Object { $_ -and $_.Modes -contains $Mode }) }; return @($all | Sort-Object Phase, Id) }
function Get-DEAction { param([Parameter(Mandatory = $true)][string]$Id) if (-not $script:DE.Actions.Contains($Id)) { throw "action '$Id' is not registered" }; return $script:DE.Actions[$Id] }

function Test-DEIsElevated {
    if (-not $script:DE.IsWindows) { return $false }
    try { $id = [Security.Principal.WindowsIdentity]::GetCurrent(); return (New-Object Security.Principal.WindowsPrincipal($id)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) } catch { return $false }
}

function Compare-DEDesired {
    <# Default comparison: every key in Desired must equal Detected. Modules can supply -Compare for richer logic. #>
    param($Detected, $Desired)
    $drift = @()
    if ($null -eq $Desired) { return @() }
    $dkeys = if ($Desired -is [System.Collections.IDictionary]) { $Desired.Keys } else { $Desired.PSObject.Properties.Name }
    foreach ($k in $dkeys) {
        $want = if ($Desired -is [System.Collections.IDictionary]) { $Desired[$k] } else { $Desired.$k }
        $have = Get-DEHashPath -Object $Detected -Path $k
        if ("$have" -ne "$want") { $drift += "$k is '$have', want '$want'" }
    }
    return $drift
}

function Get-DEActionState {
    <# Detect + Desired without changing anything. Returns Status PASS (no drift) | DRIFT | UNKNOWN plus details. #>
    param([Parameter(Mandatory = $true)][string]$Id)
    $a = Get-DEAction -Id $Id
    try {
        $detected = & $a.Detect
        $desired = & $a.Desired
        # @() outside the if: an if-expression unrolls a one-item array to a scalar, and StrictMode then throws on .Count
        $drift = @(if ($a.Compare) { & $a.Compare $detected $desired } else { Compare-DEDesired -Detected $detected -Desired $desired })
        return [pscustomobject]@{ Id = $Id; Status = $(if ($drift.Count -eq 0) { 'PASS' } else { 'DRIFT' }); Drift = $drift; Detected = (Remove-DESecretKeys -Object $detected); Desired = $desired }
    } catch {
        return [pscustomobject]@{ Id = $Id; Status = 'UNKNOWN'; Drift = @("detect failed: $($_.Exception.Message)"); Detected = $null; Desired = $null }
    }
}

function Invoke-DEAction {
    <#
    Runs one registered action through the full lifecycle. Returns the final evidence record.
      -Mode Audit : Detect and compare only (never Apply), regardless of the console mode.
      -Mode Apply : Apply when drift exists and gates pass; honours -WhatIf / console DryRun.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [ValidateSet('Audit', 'Apply')][string]$Mode,
        [int]$MaxRetries = 2,
        [switch]$Rollback,
        [string]$SkipReason
    )
    $a = Get-DEAction -Id $Id
    if (-not $Mode) { $Mode = $script:DE.Mode }
    $step = $Id
    if ($SkipReason) { return (Add-DEEvidence -Step $step -Module $a.Module -Before 'not run' -ActionTaken 'skipped by technician' -Result 'SKIPPED' -Verification $SkipReason) }

    # 1. gates (audit never changes anything, so it detects even when gates are closed and reports them)
    $gateCheck = Test-DEGatesSatisfied -Ids $a.Gates
    if ($Mode -eq 'Audit') {
        $gateNote = ''
        if (-not $gateCheck.Ok) { $gateNote = ' | gates not passed: ' + (($gateCheck.Failing | ForEach-Object { "$($_.Id)=$($_.Status)" }) -join ', ') }
        # A check that needs a runtime secret nobody entered was not verified; it did not fail. Say which secret opens it.
        $auditMissing = @($a.RequiresSecrets | Where-Object { $_ -and -not (Test-DESecret -Name $_) })
        if ($auditMissing.Count) { return (Add-DEEvidence -Step $step -Module $a.Module -Before 'not checked' -ActionTaken 'audit: not verified' -Result 'WARN' -Verification ("needs runtime secret(s): " + ($auditMissing -join ', ') + $gateNote) -Remediation ('Enter ' + ($auditMissing -join ', ') + ' on the Settings page (runtime only), then audit again.')) }
        $st = Get-DEActionState -Id $Id
        $bf = if ($st.Detected) { (($st.Detected | ConvertTo-Json -Compress -Depth 4) -replace '\s+', ' ') } else { 'unknown' }
        if ($bf.Length -gt 400) { $bf = $bf.Substring(0, 400) + '...' }
        switch ($st.Status) {
            'PASS' { return (Add-DEEvidence -Step $step -Module $a.Module -Before $bf -ActionTaken 'audit: in desired state' -Result 'PASS' -Verification "desired state matched$gateNote" -Data @{ detected = $st.Detected }) }
            'DRIFT' { return (Add-DEEvidence -Step $step -Module $a.Module -Before $bf -ActionTaken 'audit: drift' -Result 'WARN' -Verification (($st.Drift -join '; ') + $gateNote) -Remediation $(if ($a.ManualAction) { $a.ManualAction } else { 'Run in Apply mode once the gates pass.' }) -Data @{ detected = $st.Detected; drift = $st.Drift }) }
            default { return (Add-DEEvidence -Step $step -Module $a.Module -Before 'unknown' -ActionTaken 'audit: detect failed' -Result 'FAIL' -Verification (($st.Drift -join '; ') + $gateNote)) }
        }
    }
    if (-not $gateCheck.Ok) {
        $names = ($gateCheck.Failing | ForEach-Object { "$($_.Id)=$($_.Status)" }) -join ', '
        $fix = ($gateCheck.Failing | Where-Object { $_ -and $_.Unblock } | ForEach-Object { $_.Unblock }) -join '; '
        return (Add-DEEvidence -Step $step -Module $a.Module -Before 'gated' -ActionTaken 'refused: prerequisite gates not passed' -Result 'BLOCKED' -Verification $names -Remediation $fix)
    }
    $viaException = @($gateCheck.ViaException).Count -gt 0

    # 2. secrets and elevation
    $missingSecrets = @($a.RequiresSecrets | Where-Object { -not (Test-DESecret -Name $_) })
    if ($Mode -eq 'Apply' -and $missingSecrets.Count) {
        return (Add-DEEvidence -Step $step -Module $a.Module -Before 'secrets missing' -ActionTaken 'refused: runtime secret not provided' -Result 'BLOCKED' -Verification ($missingSecrets -join ', ') -Remediation 'Enter the secret in the console (runtime only); it is never stored.')
    }
    if ($Mode -eq 'Apply' -and $a.RequiresElevation -and -not (Test-DEIsElevated)) {
        return (Add-DEEvidence -Step $step -Module $a.Module -Before 'not elevated' -ActionTaken 'refused: needs an elevated session' -Result 'BLOCKED' -Remediation 'Relaunch the console as administrator.')
    }

    # 3. detect and compare
    $state = Get-DEActionState -Id $Id
    $before = if ($state.Detected) { (($state.Detected | ConvertTo-Json -Compress -Depth 4) -replace '\s+', ' ') } else { 'unknown' }
    if ($before.Length -gt 400) { $before = $before.Substring(0, 400) + '...' }
    if ($state.Status -eq 'UNKNOWN') { return (Add-DEEvidence -Step $step -Module $a.Module -Before 'unknown' -ActionTaken 'detect' -Result 'FAIL' -Verification ($state.Drift -join '; ') -Remediation 'Detection failed; fix the detector or the machine state before applying.') }
    if ($state.Status -eq 'PASS') {
        $r = if ($viaException) { 'EXCEPTION' } else { 'NO CHANGE' }
        return (Add-DEEvidence -Step $step -Module $a.Module -Before $before -ActionTaken 'detect: already in desired state' -Result $r -Verification 'desired state matched before any change' -Data @{ detected = $state.Detected })
    }
    if ($Mode -eq 'Audit' -or -not $a.Apply) {
        $why = if (-not $a.Apply) { 'no apply step; manual action required' } else { 'audit mode' }
        return (Add-DEEvidence -Step $step -Module $a.Module -Before $before -ActionTaken "detect: drift ($why)" -Result 'WARN' -Verification ($state.Drift -join '; ') -Remediation $(if ($a.ManualAction) { $a.ManualAction } else { 'Run in Apply mode.' }) -Data @{ detected = $state.Detected; drift = $state.Drift })
    }

    # 4. apply with retry, verify, remediate
    $target = "$($a.Title) [$Id]"
    $dry = $script:DE.DryRun -or $WhatIfPreference
    if ($dry -or -not $PSCmdlet.ShouldProcess($target, 'Apply')) {
        return (Add-DEEvidence -Step $step -Module $a.Module -Before $before -ActionTaken 'apply (planned)' -Result 'PLANNED' -Verification ($state.Drift -join '; ') -Data @{ drift = $state.Drift })
    }
    if ($a.Destructive) { Write-DELog -Level WARN -Message "destructive action $Id starting; rollback available: $([bool]$a.Rollback)" }
    $attempt = 0; $lastError = ''; $verified = $false; $remediated = $false
    while ($attempt -le $MaxRetries -and -not $verified) {
        $attempt++
        try {
            $applyOut = & $a.Apply $state
            $after = Get-DEActionState -Id $Id
            $verifyOk = $true; $verifyDetail = ''
            if ($a.Verify) { $v = & $a.Verify $after; if ($v -is [bool]) { $verifyOk = $v } elseif ($v -is [System.Collections.IDictionary] -or $v -is [pscustomobject]) { $verifyOk = [bool]$v.ok; $verifyDetail = "$($v.detail)" } else { $verifyOk = [bool]$v } }
            if ($verifyOk -and $after.Status -ne 'PASS' -and -not $a.Verify) { $verifyOk = $false; $verifyDetail = 'desired state not reached: ' + ($after.Drift -join '; ') }
            if ($verifyOk) {
                $verified = $true
                $res = if ($viaException) { 'EXCEPTION' } else { 'PASS' }
                $rec = Add-DEEvidence -Step $step -Module $a.Module -Before $before -ActionTaken ("applied (attempt {0}{1})" -f $attempt, $(if ($remediated) { ', after remediation' } else { '' })) -Result $res -Verification $(if ($verifyDetail) { $verifyDetail } else { 'verified: desired state reached' }) -Data @{ before = $state.Detected; after = $after.Detected; output = "$applyOut" }
                if ($a.RequiresReboot) { Request-DEReboot -Reason "$($a.Title) requires a restart" -ResumeAction $Id | Out-Null }
                return $rec
            }
            $lastError = $verifyDetail
        } catch { $lastError = $_.Exception.Message }
        Write-DELog -Level WARN -Message "$Id attempt $attempt failed: $lastError"
        if (-not $remediated -and $a.Remediate) { try { & $a.Remediate $state | Out-Null; $remediated = $true; Write-DELog -Level INFO -Message "$Id remediation step ran" } catch { Write-DELog -Level WARN -Message "$Id remediation failed: $($_.Exception.Message)" } }
    }
    if ($Rollback -and $a.Rollback) { try { & $a.Rollback $state | Out-Null; Write-DELog -Level WARN -Message "$Id rolled back" } catch { Write-DELog -Level FAIL -Message "$Id rollback failed: $($_.Exception.Message)" } }
    return (Add-DEEvidence -Step $step -Module $a.Module -Before $before -ActionTaken ("apply failed after {0} attempt(s)" -f $attempt) -Result 'FAIL' -Verification $lastError -Remediation $(if ($a.ManualAction) { $a.ManualAction } else { 'See the log; fix the cause and rerun.' }) -Data @{ drift = $state.Drift })
}

function Invoke-DERollback {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Id)
    $a = Get-DEAction -Id $Id
    if (-not $a.Rollback) { return (Add-DEEvidence -Step "$Id.rollback" -Module $a.Module -Before 'n/a' -ActionTaken 'rollback requested' -Result 'SKIPPED' -Verification 'no rollback defined for this action') }
    if ($script:DE.DryRun -or -not $PSCmdlet.ShouldProcess($a.Title, 'Rollback')) { return (Add-DEEvidence -Step "$Id.rollback" -Module $a.Module -Before 'n/a' -ActionTaken 'rollback (planned)' -Result 'PLANNED') }
    try { $out = & $a.Rollback (Get-DEActionState -Id $Id); return (Add-DEEvidence -Step "$Id.rollback" -Module $a.Module -Before 'applied' -ActionTaken 'rolled back' -Result 'PASS' -Verification "$out") }
    catch { return (Add-DEEvidence -Step "$Id.rollback" -Module $a.Module -Before 'applied' -ActionTaken 'rollback' -Result 'FAIL' -Verification $_.Exception.Message) }
}

# ------------------------------------------------------------------ reboot and resume
function Request-DEReboot {
    param([Parameter(Mandatory = $true)][string]$Reason, [string]$ResumeAction = '', [string]$LoginAs = '')
    $pending = @(Get-DEState -Path 'reboot.pending'); if ($null -eq $pending) { $pending = @() }
    $entry = @{ reason = $Reason; resumeAction = $ResumeAction; requested = (Get-Date).ToString('o'); loginAs = $LoginAs }
    Set-DEStateValue -Path 'reboot.pending' -Value (@($pending) + @($entry))
    Write-DELog -Level WARN -Message "restart required: $Reason (resume: $ResumeAction)"
    return $entry
}
function Get-DERebootQueue {
    <# Restarts the console itself queued this session (Request-DEReboot). Machine-level pending reboots are Get-DEPendingReboot in DE.Discovery. #>
    $p = Get-DEState -Path 'reboot.pending'; if ($null -eq $p) { return @() }; return @($p) }
function Set-DEResume {
    <# Registers the console to reopen after the next sign-in (HKLM RunOnce when elevated, else HKCU) and records who should sign in. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Launcher, [string]$NextAction = '', [string]$LoginAs = '', [string]$Arguments = '-Resume')
    Set-DEStateValue -Path 'resume' -Value @{ nextAction = $NextAction; loginAs = $LoginAs; set = (Get-Date).ToString('o'); launcher = $Launcher }
    if (-not $script:DE.IsWindows) { return }
    $hive = if (Test-DEIsElevated) { 'HKLM:' } else { 'HKCU:' }
    $key = "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce"
    if ($PSCmdlet.ShouldProcess($key, 'Register DETechConsole resume')) {
        New-Item -Path $key -Force | Out-Null
        New-ItemProperty -Path $key -Name 'DETechConsoleResume' -Value ("cmd /c start `"DE`" `"{0}`" {1}" -f $Launcher, $Arguments) -PropertyType String -Force | Out-Null
    }
}
function Clear-DEResume {
    Set-DEStateValue -Path 'resume' -Value $null
    Set-DEStateValue -Path 'reboot.pending' -Value @()
    if ($script:DE.IsWindows) { foreach ($hive in @('HKLM:', 'HKCU:')) { try { Remove-ItemProperty -Path "$hive\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce" -Name 'DETechConsoleResume' -ErrorAction SilentlyContinue } catch { } } }
}
function Get-DEResume { return (Get-DEState -Path 'resume') }
function Invoke-DERestart {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([int]$DelaySeconds = 30, [string]$Comment = 'DE Technician Console: restart required to continue provisioning')
    if (-not $script:DE.IsWindows) { Write-DELog -Level WARN -Message 'restart skipped: not Windows'; return }
    if ($script:DE.DryRun -or -not $PSCmdlet.ShouldProcess($env:COMPUTERNAME, "Restart in $DelaySeconds s")) { Add-DEEvidence -Step 'reboot' -Before 'pending' -ActionTaken 'restart (planned)' -Result 'PLANNED' | Out-Null; return }
    Add-DEEvidence -Step 'reboot' -Before 'pending' -ActionTaken "shutdown /r /t $DelaySeconds" -Result 'INFO' -Verification $Comment | Out-Null
    & shutdown.exe /r /t $DelaySeconds /c $Comment | Out-Null
}

# ------------------------------------------------------------------ helpers: native, hashing, signatures, http, json
function Invoke-DENative {
    param([Parameter(Mandatory = $true)][string]$FilePath, [string[]]$Arguments = @(), [string]$WorkingDirectory, [int]$TimeoutSeconds = 0)
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $output = @()
    try {
        if ($WorkingDirectory) { Push-Location -LiteralPath $WorkingDirectory }
        $output = @(& $FilePath @Arguments 2>&1 | ForEach-Object { "$_" })
        $code = $LASTEXITCODE
    } finally { if ($WorkingDirectory) { Pop-Location }; $ErrorActionPreference = $prev }
    Write-DELog -Level DEBUG -Message ("native: {0} {1} -> exit {2}" -f $FilePath, (($Arguments | ForEach-Object { Protect-DEText $_ }) -join ' '), $code)
    return [pscustomobject]@{ ExitCode = $code; Output = $output; Text = ($output -join "`n") }
}
function Get-DEFileSha256 { param([Parameter(Mandatory = $true)][string]$Path) return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Test-DEFileHash { param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Sha256) if (-not (Test-Path -LiteralPath $Path)) { return $false }; return ((Get-DEFileSha256 -Path $Path) -eq $Sha256.ToLowerInvariant()) }
function Test-DEAuthenticode {
    <# Returns @{Ok; Status; Publisher; Detail}. Ok requires a Valid signature and, when -Publisher is given, a subject containing it. #>
    param([Parameter(Mandatory = $true)][string]$Path, [string]$Publisher)
    if (-not $script:DE.IsWindows) { return [pscustomobject]@{ Ok = $false; Status = 'Unsupported'; Publisher = ''; Detail = 'Authenticode checks need Windows' } }
    try {
        $sig = Get-AuthenticodeSignature -LiteralPath $Path
        $subject = ''; if ($sig.SignerCertificate) { $subject = $sig.SignerCertificate.Subject }
        $ok = ($sig.Status -eq 'Valid') -and ((-not $Publisher) -or ($subject -like "*$Publisher*"))
        return [pscustomobject]@{ Ok = $ok; Status = "$($sig.Status)"; Publisher = $subject; Detail = "$($sig.StatusMessage)" }
    } catch { return [pscustomobject]@{ Ok = $false; Status = 'Error'; Publisher = ''; Detail = $_.Exception.Message } }
}
function Test-DEConsoleIntegrity {
    <#
    Checks the console's own scripts before it runs anything. Two layers:
      1. integrity.json (written by packaging\Sign-DETechConsole.ps1): every listed file must match its sha256.
      2. Authenticode (Windows): HashMismatch or an untrusted signer means the file changed after signing.
    Returns @{ status = signed | unsigned | tampered | unknown; files; problems }. Never throws.
    #>
    param([string]$Root = $script:DE.Root)
    $problems = @(); $files = @()
    try {
        $base = Split-Path -Parent $Root
        $manifestPath = Join-Path $base 'integrity.json'
        if (Test-Path -LiteralPath $manifestPath) {
            $m = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
            foreach ($f in @($m.files | Where-Object { $null -ne $_ })) {
                $full = Join-Path $base ($f.path -replace '/', [IO.Path]::DirectorySeparatorChar)
                if (-not (Test-Path -LiteralPath $full)) { $problems += "missing: $($f.path)"; continue }
                $h = (Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash.ToLowerInvariant()
                if ($h -ne "$($f.sha256)".ToLowerInvariant()) { $problems += "changed since packaging: $($f.path)" }
            }
        }
        $signed = 0; $unsigned = 0
        # Filter by extension: Windows PowerShell 5.1 ignores -Include with -LiteralPath, and Authenticode reports
        # non-script files (json, txt, fonts) as unsupported, which would read as tampering on a clean copy.
        foreach ($f in @(Get-ChildItem -LiteralPath $Root -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.ps1', '.psm1', '.psd1') })) {
            $files += $f.FullName
            if (-not $script:DE.IsWindows) { continue }
            $sig = Get-AuthenticodeSignature -LiteralPath $f.FullName
            switch ("$($sig.Status)") {
                'Valid' { $signed++ }
                'NotSigned' { $unsigned++ }
                'HashMismatch' { $problems += "signature hash mismatch: $($f.Name)" }
                default { $problems += "signature $($sig.Status): $($f.Name)" }
            }
        }
        $status = if ($problems.Count) { 'tampered' } elseif (-not $script:DE.IsWindows) { 'unknown' } elseif ($unsigned -eq 0 -and $signed -gt 0) { 'signed' } else { 'unsigned' }
        return [pscustomobject]@{ status = $status; files = $files.Count; signed = $signed; unsigned = $unsigned; problems = $problems }
    } catch { return [pscustomobject]@{ status = 'unknown'; files = $files.Count; signed = 0; unsigned = 0; problems = @("integrity check failed: $($_.Exception.Message)") } }
}
function Write-DEIntegrityEvidence {
    <# Records the integrity result: tampered is FAIL, unsigned is WARN, signed is PASS, unknown is INFO. #>
    $i = Test-DEConsoleIntegrity
    $res = switch ($i.status) { 'tampered' { 'FAIL' } 'unsigned' { 'WARN' } 'signed' { 'PASS' } default { 'INFO' } }
    $fix = switch ($i.status) { 'tampered' { 'Do not run changes from this copy. Re-download the signed package and compare its sha256.' } 'unsigned' { 'Use the signed release build for client work (packaging\Sign-DETechConsole.ps1).' } default { '' } }
    Add-DEEvidence -Step 'console.integrity' -Module 'core' -Before "$($i.files) script file(s)" -ActionTaken 'integrity check' -Result $res -Verification $(if ($i.problems.Count) { ($i.problems | Select-Object -First 10) -join '; ' } else { "status $($i.status); signed $($i.signed); unsigned $($i.unsigned)" }) -Remediation $fix | Out-Null
    return $i
}
function Test-DEPackageTrust {
    <# Applies the catalog trust policy to a file: sha256 must match when given; Authenticode must be valid and match the publisher when given; otherwise refuse unless -AllowUnverified. #>
    param([Parameter(Mandatory = $true)][string]$Path, [string]$Sha256, [string]$Publisher, [switch]$AllowUnverified)
    $reasons = @()
    if (-not (Test-Path -LiteralPath $Path)) { return [pscustomobject]@{ Ok = $false; Reasons = @('file not found'); Sha256 = ''; Signature = $null } }
    $hash = Get-DEFileSha256 -Path $Path
    if ($Sha256 -and $hash -ne $Sha256.ToLowerInvariant()) { $reasons += "sha256 mismatch (have $hash)" }
    $sig = $null
    if ($Publisher -or ($Path -match '\.(exe|msi|ps1|dll|msix|appx)$')) { $sig = Test-DEAuthenticode -Path $Path -Publisher $Publisher; if ($Publisher -and -not $sig.Ok) { $reasons += "signature: $($sig.Status) $($sig.Publisher)" } }
    if (-not $Sha256 -and -not $Publisher) { $reasons += 'catalog entry has neither sha256 nor publisher' }
    $ok = ($reasons.Count -eq 0) -or ($AllowUnverified -and -not ($Sha256 -and $hash -ne $Sha256.ToLowerInvariant()))
    return [pscustomobject]@{ Ok = $ok; Reasons = $reasons; Sha256 = $hash; Signature = $sig; Overridden = ($AllowUnverified -and $reasons.Count -gt 0) }
}
function Invoke-DEJsonPost {
    <# POSTs a scrubbed JSON body. Bearer token comes from -TokenEnv (an environment variable name) or a runtime secret name, never from a file. #>
    param([Parameter(Mandatory = $true)][string]$Uri, [Parameter(Mandatory = $true)]$Body, [string]$TokenEnv = '', [string]$TokenSecret = '', [int]$TimeoutSeconds = 30)
    if ($Uri -notmatch '^https://') { throw 'refusing to post to a non-HTTPS endpoint' }
    $headers = @{ 'Content-Type' = 'application/json'; 'User-Agent' = "DETechConsole/$($script:DE.ConsoleVersion)" }
    $token = $null
    if ($TokenSecret -and (Test-DESecret -Name $TokenSecret)) { $token = Get-DESecretPlain -Name $TokenSecret }
    elseif ($TokenEnv -and (Get-Item -Path "env:$TokenEnv" -ErrorAction SilentlyContinue)) { $token = (Get-Item -Path "env:$TokenEnv").Value; Register-DERedaction -Value $token }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    $json = (Remove-DESecretKeys -Object $Body) | ConvertTo-Json -Depth 12
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    $resp = Invoke-RestMethod -Uri $Uri -Method Post -Headers $headers -Body $json -TimeoutSec $TimeoutSeconds
    $token = $null
    return $resp
}
function Get-DEJsonFile { param([Parameter(Mandatory = $true)][string]$Path) return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) }
function Set-DEJsonFile { param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Object, [switch]$AllowSecretsForbidden) $clean = Remove-DESecretKeys -Object $Object; New-Item -ItemType Directory -Path (Split-Path -Parent $Path) -Force -WhatIf:$false | Out-Null; $clean | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $Path -Encoding UTF8 -WhatIf:$false }
function Get-DERegistryValue { param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Name) try { $i = Get-ItemProperty -Path $Path -Name $Name -ErrorAction Stop; return $i.$Name } catch { return $null } }
function Set-DERegistryValue {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)]$Value, [ValidateSet('String', 'DWord', 'QWord', 'MultiString', 'ExpandString', 'Binary')][string]$Type = 'DWord')
    if ($PSCmdlet.ShouldProcess("$Path\$Name", "Set $Type = $Value")) {
        if (-not (Test-Path -Path $Path)) { New-Item -Path $Path -Force | Out-Null }
        New-ItemProperty -Path $Path -Name $Name -Value $Value -PropertyType $Type -Force | Out-Null
    }
}
function Backup-DERegistryKey {
    <# reg export of a key into the backups folder; returns the file path (used by rollback). #>
    param([Parameter(Mandatory = $true)][string]$Key, [string]$Label = 'key')
    if (-not $script:DE.IsWindows) { return $null }
    $file = Join-Path $script:DE.Dirs.Backups ("{0}-{1}.reg" -f ($Label -replace '[^\w\-]', '_'), (Get-Date -Format 'yyyyMMdd-HHmmss'))
    $r = Invoke-DENative -FilePath 'reg.exe' -Arguments @('export', $Key, $file, '/y')
    if ($r.ExitCode -eq 0) { return $file }
    return $null
}

Export-ModuleMember -Function *-DE*, Get-DEConsole, Get-DEContext, Set-DEContext, Set-DEMode, Protect-DEText, Write-DELog, Register-DERedaction, Remove-DESecretKeys, ConvertTo-DEHashtable, Compare-DEDesired
