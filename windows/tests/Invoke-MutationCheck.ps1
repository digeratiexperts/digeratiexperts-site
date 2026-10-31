<#
.SYNOPSIS
    Mutation-check the DE Tech Tool licence and fail-closed paths (move 16, #734).

.DESCRIPTION
    Every mutant below is a small, deliberate break of the licence or fail-closed logic, applied to
    a throwaway copy of the windows/ tree. The named Pester tests then run against that copy:

        KILLED     a test that passed on the unmutated copy now fails  -> the suite noticed the break
        SURVIVED   every test still passes  -> the suite would ship this break; a weak spot
        STALE      the mutation anchor no longer exists  -> the code drifted; update this list

    The baseline run comes first for a reason: tests that already fail unmutated (the environment-
    dependent ones, #834/#835) cannot kill anything, so only tests green before the break count as
    kills. A mutant is killed by name, so the report says exactly which assertion noticed.

    Ratchet: exit 0 only when every mutant is KILLED. Run it before pushing changes to the licence,
    the gate engine, integrity checks - or to the tests below:

        powershell -File windows/tests/Invoke-MutationCheck.ps1
        powershell -File windows/tests/Invoke-MutationCheck.ps1 -Mutant gate-throws-passes

.PARAMETER Mutant
    Run a single mutant by name, while iterating on the test that should kill it.

.PARAMETER Keep
    Keep each mutated copy on disk for inspection instead of deleting it.
#>
[CmdletBinding()]
param(
    [string]$Mutant = '',
    [switch]$Keep
)

$ErrorActionPreference = 'Stop'
$Windows = Split-Path -Parent $PSScriptRoot    # windows/
$FailClosed = 'windows/console/tests/FailClosed.Tests.ps1'
$BugHunt = 'windows/console/tests/BugHunt.Tests.ps1'

# One mutant per row: where it cuts, what it becomes, and the tests that must notice. Anchors are
# literal strings from the sources; a missing anchor is reported as STALE rather than skipped, so
# silent drift cannot make the check look green.
$script:Mutants = @(
    [pscustomobject]@{
        Name = 'licence-required-allowed'; File = 'windows/console/modules/DE.License/DE.License.psm1'
        Find = "if (`$s.enforce -eq 'required') { return [pscustomobject]@{ ok = `$false;"
        Replace = "if (`$s.enforce -eq 'required') { return [pscustomobject]@{ ok = `$true;"
        Why = 'policy required would stop refusing unlicensed use'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'licence-feature-scope-ignored'; File = 'windows/console/modules/DE.License/DE.License.psm1'
        Find = "elseif (@(`$s.features) -notcontains `$Feature -and @(`$s.features) -notcontains '*') { `$why = `"the licence for `$(`$s.technician) does not include '`$Feature'`" }"
        Replace = 'elseif ($false) { $why = ''feature'' }'
        Why = 'a licence without a feature would still allow that feature'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'licence-client-scope-ignored'; File = 'windows/console/modules/DE.License/DE.License.psm1'
        Find = "elseif (`$Client -and @(`$s.clients) -notcontains `$Client -and @(`$s.clients) -notcontains '*') { `$why = `"the licence for `$(`$s.technician) does not include client '`$Client'`" }"
        Replace = 'elseif ($false) { $why = ''client'' }'
        Why = 'a licence for other clients would still allow this client'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'licence-invalid-accepted'; File = 'windows/console/modules/DE.License/DE.License.psm1'
        Find = 'if (-not $s.valid) { $why = $s.reason }'
        Replace = 'if ($false) { $why = $s.reason }'
        Why = 'an invalid licence would no longer be a reason to refuse'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'storage-apply-unlicensed'; File = 'windows/console/modules/DE.Storage/DE.Storage.psm1'
        Find = 'if (-not $lic.ok) { throw "Licence refused: $($lic.reason)" }'
        Replace = 'if ($false) { throw "Licence refused: $($lic.reason)" }'
        Why = 'storage changes would run while unlicensed'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gate-throws-passes'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = 'catch { $r = @{ Status = ''BLOCKED''; Detail = "gate check failed: $($_.Exception.Message)" } }'
        Replace = 'catch { $r = @{ Status = ''PASS''; Detail = "gate check failed: $($_.Exception.Message)" } }'
        Why = 'a gate whose check throws would read PASS'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gate-nothing-passes'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = "if (`$null -eq `$r) { `$r = @{ Status = 'BLOCKED'; Detail = 'gate returned nothing' } }"
        Replace = "if (`$null -eq `$r) { `$r = @{ Status = 'PASS'; Detail = 'gate returned nothing' } }"
        Why = 'a gate that answers nothing would read PASS'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gate-unknown-status-accepted'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = "if (`$status -notin @('PASS', 'WARN', 'BLOCKED', 'READY')) { `$status = 'BLOCKED' }"
        Replace = 'if ($false) { $status = ''BLOCKED'' }'
        Why = 'a gate inventing its own status would not be forced to BLOCKED'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gate-unregistered-passes'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = "Status = 'BLOCKED'; Detail = 'gate not registered'"
        Replace = "Status = 'PASS'; Detail = 'gate not registered'"
        Why = 'an unknown gate id would read PASS'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gate-noexception-bypassed'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = "if (`$status -ne 'PASS' -and -not `$g.NoException) { `$ex = Get-DEException -Target `$Id;"
        Replace = "if (`$status -ne 'PASS' -and `$true) { `$ex = Get-DEException -Target `$Id;"
        Why = 'an approval could open a -NoException safety gate'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'gates-always-satisfied'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = 'return [pscustomobject]@{ Ok = ($bad.Count -eq 0); Failing = $bad;'
        Replace = 'return [pscustomobject]@{ Ok = $true; Failing = $bad;'
        Why = 'Test-DEGatesSatisfied would report satisfied while a gate is blocked'
        Tests = @($FailClosed)
    }
    [pscustomobject]@{
        Name = 'integrity-changed-ignored'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = 'if ($h -ne "$($f.sha256)".ToLowerInvariant()) { $problems += "changed since packaging: $($f.path)" }'
        Replace = 'if ($false) { $problems += "changed since packaging: $($f.path)" }'
        Why = 'a console file changed since packaging would go unnoticed'
        Tests = @($FailClosed, $BugHunt)
    }
    [pscustomobject]@{
        Name = 'integrity-unreadable-assumed-clean'; File = 'windows/console/modules/DE.Core/DE.Core.psm1'
        Find = 'try { $h = Get-DEFileSha256 -Path $full } catch { $h = $null }'
        Replace = 'try { $h = Get-DEFileSha256 -Path $full } catch { $h = "$($f.sha256)" }'
        Why = 'a file another process holds open would be assumed unchanged instead of flagged'
        Tests = @($FailClosed, $BugHunt)
    }
)

function Copy-KitWindows {
    <# A throwaway copy of windows/, so a mutation can never touch the working tree. Returns the
       copy's root: the folder that holds 'windows', mirroring the kit root the mutant and test
       paths are relative to. #>
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ("de-mutation-{0}" -f ([guid]::NewGuid().ToString('N')))
    New-Item -ItemType Directory -Path $tmp | Out-Null
    Copy-Item -LiteralPath $Windows -Destination $tmp -Recurse
    return @{ Root = $tmp; Tmp = $tmp }
}

function Invoke-MutationSuite {
    param([Parameter(Mandatory = $true)][string]$CopyWindows, [Parameter(Mandatory = $true)][string[]]$Tests)
    $paths = @($Tests | ForEach-Object { Join-Path $CopyWindows ($_ -replace '/', [IO.Path]::DirectorySeparatorChar) })
    foreach ($p in $paths) { if (-not (Test-Path -LiteralPath $p)) { throw "test file not found in copy: $p" } }
    $cfg = New-PesterConfiguration
    $cfg.Run.Path = $paths
    $cfg.Run.PassThru = $true
    $cfg.Run.Exit = $false
    $cfg.Output.Verbosity = 'None'
    return (Invoke-Pester -Configuration $cfg)
}

Import-Module Pester -MinimumVersion 5.5 -MaximumVersion 5.99.99

$selected = @($script:Mutants)
if ($Mutant) {
    $selected = @($script:Mutants | Where-Object { $_.Name -eq $Mutant })
    if (-not $selected) { Write-Host "no mutant named '$Mutant'"; exit 2 }
}

# Baseline first: the union of the test files every selected mutant uses, on an unmutated copy.
# Anything red here is environmental and can never count as a kill.
$union = @($selected | ForEach-Object { $_.Tests } | Select-Object -Unique)
$base = Copy-KitWindows
try {
    Write-Host "baseline: $($union -join ', ')"
    $b = Invoke-MutationSuite -CopyWindows $base.Root -Tests $union
    $greenBefore = @($b.Passed | ForEach-Object { $_.ExpandedPath })
    Write-Host ("baseline: {0} passed, {1} failed (failing tests are excluded from kills)" -f $b.PassedCount, $b.FailedCount)
} finally {
    if (-not $Keep) { Remove-Item -LiteralPath $base.Tmp -Recurse -Force -ErrorAction SilentlyContinue }
}

$bad = 0
Write-Host ''
foreach ($m in $selected) {
    $copy = Copy-KitWindows
    try {
        $target = Join-Path $copy.Root ($m.File -replace '/', [IO.Path]::DirectorySeparatorChar)
        $text = [IO.File]::ReadAllText($target)
        if (-not $text.Contains($m.Find)) {
            $bad++
            Write-Host ("STALE     {0,-32} anchor not found - the code drifted; update Invoke-MutationCheck.ps1" -f $m.Name)
            continue
        }
        [IO.File]::WriteAllText($target, $text.Replace($m.Find, $m.Replace), (New-Object Text.UTF8Encoding $false))
        $r = Invoke-MutationSuite -CopyWindows $copy.Root -Tests $m.Tests
        if ($r.TotalCount -eq 0) {
            $bad++
            Write-Host ("STALE     {0,-32} no tests ran - the suite paths are wrong" -f $m.Name)
            continue
        }
        $killers = @($r.Failed | Where-Object { $greenBefore -contains $_.ExpandedPath } | ForEach-Object { $_.ExpandedPath })
        if ($killers.Count) {
            Write-Host ("KILLED    {0,-32} by: {1}" -f $m.Name, ($killers -join '; '))
        } else {
            $bad++
            Write-Host ("SURVIVED  {0,-32} {1}" -f $m.Name, $m.Why)
        }
    } finally {
        if (-not $Keep) { Remove-Item -LiteralPath $copy.Tmp -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

Write-Host ''
if ($bad) {
    Write-Host "MUTATION CHECK FAILED - $bad mutant(s) not killed. The suite would ship that break."
    exit 1
}
Write-Host "MUTATION CHECK PASSED - every licence and fail-closed break is caught."
exit 0
