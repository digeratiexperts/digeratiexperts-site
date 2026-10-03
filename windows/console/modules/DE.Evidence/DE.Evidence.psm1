#Requires -Version 5.1
<#
.SYNOPSIS
    Evidence bundle (sanitized JSON + internal HTML + client-safe HTML +
    sha256 manifest), asset / documentation handoff record, Intelligence Hub
    push, readiness dashboard data and gap report.

.DESCRIPTION
    Every artifact passes through Remove-DESecretKeys and Protect-DEText
    before it is written. The client report uses DE-owned service names from
    the client profile and never shows vendors, costs, keys or internal
    metadata. The Hub payload carries device identity, mapping, state,
    verification timestamps, exceptions and evidence references only.
#>
# StrictMode 1.0: undefined variables still throw, but a property that real Windows data omits
# (registry, CIM, dsregcmd, JSON) reads as $null instead of crashing discovery; detectors treat $null as unknown.
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:Areas = [ordered]@{
    identity = @{ title = 'Identity'; prefixes = @('identity.', 'jumpcloud.user-mapping', 'jumpcloud.bind-user') }
    encryption = @{ title = 'Encryption'; prefixes = @('identity.bitlocker', 'maint.bitlocker-resume') }
    updates = @{ title = 'Updates'; prefixes = @('maint.windows-update', 'maint.oem') }
    jumpcloud = @{ title = 'JumpCloud'; prefixes = @('jumpcloud.') }
    guardz = @{ title = 'Guardz'; prefixes = @('security.guardz') }
    sentinelone = @{ title = 'SentinelOne'; prefixes = @('security.sentinelone', 'security.edr-conflicts') }
    blackpoint = @{ title = 'Blackpoint'; prefixes = @('security.blackpoint') }
    browser = @{ title = 'Browser security'; prefixes = @('security.pabx', 'browser.') }
    baseline = @{ title = 'Windows baseline'; prefixes = @('baseline.') }
    m365 = @{ title = 'Microsoft 365'; prefixes = @('apps.m365', 'apps.teams', 'apps.onedrive', 'ops.mfa') }
    apps = @{ title = 'Applications'; prefixes = @('apps.') }
    branding = @{ title = 'Branding'; prefixes = @('branding.') }
    backup = @{ title = 'Backup'; prefixes = @('ops.backup') }
    remote = @{ title = 'Remote support'; prefixes = @('ops.remote-support', 'jumpcloud.remote-assist') }
    network = @{ title = 'Network / site'; prefixes = @('net.') }
    plan = @{ title = 'Plan steps and handoff'; prefixes = @('plan.', 'order.') }   # confirm-to-complete steps count: never READY with one open
}

function Get-DEReadiness {
    <# Rolls the latest evidence per action into area cards and an overall readiness state. Never green on failure; EXCEPTION shows as its own state. #>
    $latest = @{}
    foreach ($e in Get-DEEvidence) { $latest[$e.step] = $e }
    $planActions = @(Get-DEActions | ForEach-Object { $_.Id })
    $cards = [ordered]@{}
    foreach ($k in $script:Areas.Keys) {
        $a = $script:Areas[$k]
        $recs = @($latest.Values | Where-Object { $r = $_; $r -and ($a.prefixes | Where-Object { $r.step -like "$_*" }) })
        $state = 'NOT RUN'
        # An area the loaded plan does not cover (bundle scope, standalone solution) is NOT IN PLAN, never a gap.
        if (-not $recs.Count -and $planActions.Count -and -not @($planActions | Where-Object { $id = $_; @($a.prefixes | Where-Object { $id -like "$_*" }).Count }).Count) { $state = 'NOT IN PLAN' }
        if ($recs.Count) {
            $results = @($recs | ForEach-Object { $_.result })
            if ($results -contains 'FAIL') { $state = 'FAIL' } elseif ($results -contains 'BLOCKED') { $state = 'BLOCKED' } elseif ($results -contains 'WARN') { $state = 'WARN' } elseif ($results -contains 'PLANNED') { $state = 'PLANNED' } elseif ($results -contains 'EXCEPTION') { $state = 'EXCEPTION' } elseif ($results -contains 'SKIPPED') { $state = 'SKIPPED' } elseif (-not ($results | Where-Object { $_ -notin @('PASS', 'NO CHANGE', 'INFO') })) { $state = 'PASS' } else { $state = 'WARN' }
        }
        $cards[$k] = [pscustomobject]@{ id = $k; title = $a.title; state = $state; count = $recs.Count; last = $(if ($recs.Count) { ($recs | Sort-Object timestamp -Descending | Select-Object -First 1).timestamp } else { $null }) }
    }
    # Overall comes from every in-plan action, not only the area cards: an in-plan check that never ran, was skipped,
    # or belongs to no card still counts, and any FAIL or BLOCKED on record (integrity, order match, a rollback) blocks READY.
    $mode = "$(Get-DEState -Path 'workflow.mode')"
    $inPlan = @($(if ($mode) { Get-DEActions -Mode $mode } else { Get-DEActions }) | ForEach-Object { $_.Id })
    $results = @($inPlan | ForEach-Object { if ($latest.ContainsKey($_)) { $latest[$_].result } else { 'NOT RUN' } })
    $failures = @($latest.Values | Where-Object { $_ -and $_.result -in @('FAIL', 'BLOCKED') } | ForEach-Object { $_.result })
    $all = @($results) + @($failures)
    $overall = if (-not $inPlan.Count -and -not $latest.Count) { 'NOT RUN' }
    elseif ($inPlan.Count -and -not @($results | Where-Object { $_ -ne 'NOT RUN' }).Count -and -not $failures.Count) { 'NOT RUN' }
    elseif ($all -contains 'FAIL' -or $all -contains 'BLOCKED') { 'NOT READY' }
    elseif ($all -contains 'WARN' -or $all -contains 'PLANNED' -or $all -contains 'NOT RUN') { 'IN PROGRESS' }
    elseif ($all -contains 'EXCEPTION' -or $all -contains 'SKIPPED') { 'READY WITH EXCEPTIONS' }
    else { 'READY' }
    $blocked = ($all -contains 'BLOCKED') -and -not ($all -contains 'FAIL')
    return [pscustomobject]@{ overall = $overall; cards = @($cards.Values); blocked = $blocked; notRun = @($results | Where-Object { $_ -eq 'NOT RUN' }).Count }
}

function Get-DEGapReport {
    <# Everything not in desired state after an audit, ordered by phase, with the fix. #>
    $latest = @{}; foreach ($e in Get-DEEvidence) { $latest[$e.step] = $e }
    $rows = @()
    foreach ($a in Get-DEActions) {
        $e = $latest[$a.Id]
        if (-not $e) { $rows += [pscustomobject]@{ phase = $a.Phase; id = $a.Id; module = $a.Module; title = $a.Title; result = 'NOT RUN'; detail = ''; fix = $a.ManualAction }; continue }
        if ($e.result -in @('PASS', 'NO CHANGE', 'INFO', 'SKIPPED')) { continue }
        $rows += [pscustomobject]@{ phase = $a.Phase; id = $a.Id; module = $a.Module; title = $a.Title; result = $e.result; detail = $e.verification; fix = $(if ($e.remediation) { $e.remediation } else { $a.ManualAction }) }
    }
    return @($rows | Sort-Object phase, id)
}

function New-DEAssetRecord {
    <# The documentation handoff: hardware, user, warranty, OS, encryption, management, agents, apps, network/site, readiness, technician, timestamps. #>
    param([Parameter(Mandatory = $true)]$Snapshot, $ClientProfile)
    $ctx = Get-DEContext
    $r = Get-DEReadiness
    $sec = Get-DEHashPath -Object $Snapshot -Path 'agents.agents'
    return [ordered]@{
        client = $ctx['client']; clientName = $ctx['clientName']; site = $ctx['site']; tier = $ctx['tier']
        assignedUser = $ctx['endUser']; localUserName = $ctx['localUserName']; jumpcloudUser = $ctx['jumpcloudUser']; email = $ctx['endUserEmail']
        hostname = (Get-DEHashPath -Object $Snapshot -Path 'device.hostname'); serial = (Get-DEHashPath -Object $Snapshot -Path 'device.serial'); manufacturer = (Get-DEHashPath -Object $Snapshot -Path 'device.manufacturer'); model = (Get-DEHashPath -Object $Snapshot -Path 'device.model')
        assetTag = (Get-DEHashPath -Object $ctx -Path 'device.assetTag'); orderNumber = (Get-DEHashPath -Object $ctx -Path 'device.orderNumber'); warrantyEnd = $(if (Get-DEHashPath -Object $ctx -Path 'device.warrantyEnd') { Get-DEHashPath -Object $ctx -Path 'device.warrantyEnd' } else { Get-DEState -Path 'warranty.current.end' }); warrantySource = (Get-DEState -Path 'warranty.current.source'); role = (Get-DEHashPath -Object $ctx -Path 'device.role')
        os = ((@((Get-DEHashPath -Object $Snapshot -Path 'device.osCaption'), (Get-DEHashPath -Object $Snapshot -Path 'device.osDisplayVersion')) | Where-Object { "$_".Trim() }) -join ' ') + $(if ("$(Get-DEHashPath -Object $Snapshot -Path 'device.osBuild')".Trim()) { " (build $(Get-DEHashPath -Object $Snapshot -Path 'device.osBuild'))" } else { '' })
        bios = (@((Get-DEHashPath -Object $Snapshot -Path 'device.biosVersion'), (Get-DEHashPath -Object $Snapshot -Path 'device.biosDate')) | Where-Object { "$_".Trim() }) -join ' '
        cpu = (Get-DEHashPath -Object $Snapshot -Path 'device.cpu'); ramGB = (Get-DEHashPath -Object $Snapshot -Path 'device.ramGB')
        encryption = @{ osEncrypted = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.osEncrypted'); protectionOn = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.osProtectionOn'); recoveryProtectorIds = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.os.recoveryProtectorIds') }
        identity = @{ joinType = (Get-DEHashPath -Object $Snapshot -Path 'identity.joinType'); tenant = (Get-DEHashPath -Object $Snapshot -Path 'identity.dsreg.tenantName') }
        management = @{ mdmAuthority = (Get-DEHashPath -Object $Snapshot -Path 'mdm.authority'); jumpcloudRegistered = (Get-DEHashPath -Object $Snapshot -Path 'mdm.jumpcloud.registered') }
        agents = $(if ($sec) { $o = [ordered]@{}; foreach ($k in $sec.Keys) { if ($sec[$k].installed) { $o[$k] = @{ running = $sec[$k].running } } }; $o } else { @{} })
        applications = @(@(Get-DEHashPath -Object $Snapshot -Path 'apps' | Where-Object { $null -ne $_ }) | Where-Object { $_ } | Select-Object -First 400 | ForEach-Object { "$($_.name) $($_.version)" })
        network = @{ gateway = (Get-DEHashPath -Object $Snapshot -Path 'network.gateway'); dns = (Get-DEHashPath -Object $Snapshot -Path 'network.dns') }
        readiness = $r.overall; areas = @($r.cards | ForEach-Object { @{ area = $_.title; state = $_.state } })
        exceptions = @(Get-DEExceptions | ForEach-Object { @{ target = $_.target; reason = $_.reason; approver = $_.approver; expiresOn = $_.expiresOn } })
        technician = $ctx['technician']; mode = $ctx['mode']; started = $ctx['started']; completed = (Get-Date).ToString('o')
    }
}

function ConvertTo-DEHtmlReport {
    <#
        The internal report (technical, for DE) or the client-safe handover summary (plain words, service names from the
        client profile, no vendor names, keys or internal detail). Both open with the overall readiness, show missing
        values as 'Not recorded', and print cleanly.
    #>
    param([Parameter(Mandatory = $true)]$Record, [switch]$ClientSafe, $ClientProfile, [array]$Gaps = @(), [array]$Evidence = @())
    $e = { param($s) [System.Net.WebUtility]::HtmlEncode("$s") }
    $none = '<span class="none">Not recorded</span>'
    $val = { param($s) $t = "$s".Trim(); if ($t -and $t -notmatch '^[\s(),.:-]*$') { & $e $t } else { $none } }
    $cls = { param($s) ("$s" -replace '[^A-Za-z]', '').ToLowerInvariant() }
    $clientWords = @{ 'PASS' = 'In place'; 'WARN' = 'Needs attention'; 'FAIL' = 'Not in place'; 'BLOCKED' = 'Not in place'; 'EXCEPTION' = 'Agreed exception'; 'NOT IN PLAN' = 'Not in plan'; 'NOT RUN' = 'Not checked'; 'PLANNED' = 'Planned'; 'NO CHANGE' = 'In place' }
    $overallWords = @{ 'READY' = 'Ready'; 'READY WITH EXCEPTIONS' = 'Ready, with agreed exceptions'; 'NOT READY' = 'Not ready yet'; 'IN PROGRESS' = 'In progress'; 'NOT RUN' = 'Not checked' }
    $pill = { param($state) $word = $(if ($ClientSafe -and $clientWords.ContainsKey("$state")) { $clientWords["$state"] } else { "$state" }); "<span class=`"pill $(& $cls $state)`">$(& $e $word)</span>" }
    $when = { param($iso) $d = [DateTimeOffset]::MinValue; if ([DateTimeOffset]::TryParse("$iso", [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) { $off = $d.Offset; $zone = $(if ($off -eq [TimeSpan]::Zero) { 'UTC' } else { 'UTC' + $(if ($off -lt [TimeSpan]::Zero) { '-' } else { '+' }) + $off.ToString('hh\:mm') }); $d.ToString('d MMM yyyy, HH:mm', [Globalization.CultureInfo]::InvariantCulture) + " $zone" } else { "$iso" } }
    $names = Get-DEHashPath -Object $ClientProfile -Path 'clientSafe.serviceNames'
    $named = { param($key, $fallback) $n = $(if ($names) { Get-DEHashPath -Object $names -Path $key } else { $null }); if ($n) { "$n" } else { $fallback } }
    $title = $(if ($ClientSafe) { 'Device handover summary' } else { 'Device provisioning report (internal)' })
    $areas = @($Record.areas | Where-Object { $_ })
    $areaRows = foreach ($a in $areas) {
        $label = $a.area
        if ($ClientSafe) {
            $label = switch -Regex ($a.area) {
                'Guardz' { & $named 'mdr' 'Managed detection and response' }
                'Blackpoint' { & $named 'mdrBackup' 'Backup detection and response' }
                'SentinelOne' { & $named 'edr' 'Endpoint protection' }
                'JumpCloud' { 'Device and sign-in management' }
                'Backup' { 'Managed backup' }
                'Browser security' { 'Safe browsing protection' }
                default { $a.area }
            }
        }
        $st = "$($a.state)"
        "<tr><td>$(& $e $label)</td><td class=`"state`">$(& $pill $st)</td></tr>"
    }
    $inPlace = @($areas | Where-Object { "$($_.state)" -in @('PASS', 'NO CHANGE', 'EXCEPTION') }).Count
    $attention = @($areas | Where-Object { "$($_.state)" -eq 'WARN' }).Count
    $missing = @($areas | Where-Object { "$($_.state)" -in @('FAIL', 'BLOCKED') }).Count
    $counted = @($areas | Where-Object { "$($_.state)" -notin @('NOT IN PLAN') }).Count
    $overall = "$($Record.readiness)"
    $overallText = $(if ($ClientSafe -and $overallWords.ContainsKey($overall)) { $overallWords[$overall] } else { $overall })
    $summaryParts = @("$inPlace of $counted $(if ($ClientSafe) { 'services in place' } else { 'areas passing' })"); if ($attention) { $summaryParts += "$attention $(if ($ClientSafe) { 'need attention' } else { 'warning' })" }; if ($missing) { $summaryParts += "$missing $(if ($ClientSafe) { 'not in place yet' } else { 'failing' })" }
    $device = (@($Record.manufacturer, $Record.model) | Where-Object { "$_".Trim() }) -join ' '
    $meta = (@($Record.clientName, $Record.site, $Record.hostname) | Where-Object { "$_".Trim() } | ForEach-Object { & $e $_ }) -join ' &middot; '
    $internal = ''
    if (-not $ClientSafe) {
        $yes = { param($b) if ($null -eq $b -or "$b" -eq '') { $none } elseif ($b -eq $true -or "$b" -eq 'True') { 'Yes' } else { 'No' } }
        $gapRows = (@($Gaps) | Where-Object { $_ } | ForEach-Object { "<tr><td class=`"mono`">$(& $e $_.id)</td><td class=`"state`">$(& $pill $_.result)</td><td>$(& $val $_.detail)</td><td>$(& $val $_.fix)</td></tr>" }) -join ''
        if (-not $gapRows) { $gapRows = '<tr><td colspan="4" class="none">Nothing open.</td></tr>' }
        $exRows = (@($Record.exceptions) | Where-Object { $_ } | ForEach-Object { "<tr><td class=`"mono`">$(& $e $_.target)</td><td>$(& $val $_.reason)</td><td>$(& $val $_.approver)</td><td>$(& $val $_.expiresOn)</td></tr>" }) -join ''
        if (-not $exRows) { $exRows = '<tr><td colspan="4" class="none">No exceptions.</td></tr>' }
        $evRows = (@($Evidence) | Where-Object { $_ } | Select-Object -Last 300 | ForEach-Object { $t = "$($_.timestamp)"; if ($t -match 'T(\d\d:\d\d:\d\d)') { $t = $Matches[1] }; "<tr><td class=`"mono`">$(& $e $t)</td><td class=`"mono`">$(& $e $_.step)</td><td class=`"state`">$(& $pill $_.result)</td><td>$(& $val $_.action)</td><td>$(& $val $_.verification)</td></tr>" }) -join ''
        $agentList = @(@($Record.agents.Keys) | ForEach-Object { "$_ ($(if ($Record.agents[$_].running) { 'running' } else { 'not running' }))" })
        $protectors = @(@($Record.encryption.recoveryProtectorIds) | Where-Object { $_ })
        $internal = @"
<h2>Identity and management</h2><table class="kv"><tr><th>Join type</th><td>$(& $val $Record.identity.joinType)</td></tr><tr><th>Tenant</th><td>$(& $val $Record.identity.tenant)</td></tr><tr><th>MDM authority</th><td>$(& $val $Record.management.mdmAuthority)</td></tr><tr><th>JumpCloud registered</th><td>$(& $yes $Record.management.jumpcloudRegistered)</td></tr><tr><th>Security agents</th><td>$(if ($agentList.Count) { & $e ($agentList -join ', ') } else { '<span class="none">None found</span>' })</td></tr><tr><th>BitLocker</th><td>Encrypted: $(& $yes $Record.encryption.osEncrypted) &middot; Protection on: $(& $yes $Record.encryption.protectionOn) &middot; Recovery protectors: $(if ($protectors.Count) { & $e ($protectors -join ', ') } else { 'none' })</td></tr></table>
<h2>Open items</h2><table class="grid"><tr><th>Item</th><th>State</th><th>Detail</th><th>Fix</th></tr>$gapRows</table>
<h2>Exceptions</h2><table class="grid"><tr><th>Item</th><th>Reason</th><th>Approver</th><th>Expires</th></tr>$exRows</table>
<h2>Evidence log</h2><table class="grid log"><tr><th>Time</th><th>Step</th><th>Result</th><th>Action</th><th>Verification</th></tr>$evRows</table>
"@
    }
    return @"
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>$(& $e $title)$(if ($Record.clientName) { " - $(& $e $Record.clientName)" })</title>
<style>
:root{--well:#050312;--paper:#f7f5f2;--mag:#D3126A;--ink:#1a1620;--muted:#6b6672;--line:#ebe8e4;--ok:#0f7a55;--okbg:#e6f4ee;--warn:#8a5a00;--warnbg:#fbf1dc;--bad:#b0104f;--badbg:#fbe6ee;--ex:#5b3fc4;--exbg:#eeeafb;--na:#6b6672;--nabg:#f1efec}
*{box-sizing:border-box}body{margin:0;font:14px/1.55 "Space Grotesk","Segoe UI",system-ui,sans-serif;color:var(--ink);background:var(--paper)}
header{background:var(--well);color:var(--paper);padding:28px 40px 24px;border-bottom:4px solid var(--mag)}
header .b{color:var(--mag);font:700 11px/1 Oxanium,"Space Grotesk","Segoe UI",sans-serif;letter-spacing:.14em}
header h1{margin:8px 0 6px;font-size:24px;line-height:1.2;font-weight:700}header p{margin:0;color:rgba(247,245,242,.72)}header p+p{margin-top:2px;font-size:13px}
main{padding:28px 40px 8px;max-width:1040px}
.summary{display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;background:#fff;border:1px solid var(--line);border-left:6px solid var(--na);border-radius:10px;padding:18px 22px}
.summary.ready{border-left-color:var(--ok)}.summary.readywithexceptions{border-left-color:var(--ex)}.summary.notready{border-left-color:var(--bad)}.summary.inprogress{border-left-color:var(--warn)}
.summary .label{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em}.summary .big{font-size:22px;font-weight:700}.summary .counts{color:var(--muted);flex-basis:100%}
h2{font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin:30px 0 10px}
table{border-collapse:collapse;width:100%;background:#fff;border:1px solid var(--line);border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 14px;border-bottom:1px solid var(--line);vertical-align:top}tr:last-child td,tr:last-child th{border-bottom:0}
.kv th{width:32%;color:var(--muted);font-weight:600}.st td.state,.grid td.state{width:1%;white-space:nowrap}
.grid th{background:#faf9f7;color:var(--muted);font-weight:600;font-size:12px}.log{font-size:12px}.mono{font-family:Consolas,"Cascadia Mono",monospace;font-size:12px;white-space:nowrap}
.pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:.02em;background:var(--nabg);color:var(--na)}
.pill.pass,.pill.nochange,.pill.ready{background:var(--okbg);color:var(--ok)}.pill.warn,.pill.planned,.pill.inprogress{background:var(--warnbg);color:var(--warn)}
.pill.fail,.pill.blocked,.pill.notready{background:var(--badbg);color:var(--bad)}.pill.exception,.pill.readywithexceptions{background:var(--exbg);color:var(--ex)}
.none{color:var(--muted);font-style:italic}
footer{padding:22px 40px 32px;color:var(--muted);font-size:12px;max-width:1040px}
@media (max-width:640px){header{padding:22px 18px}main{padding:20px 18px 4px}footer{padding:18px}.kv th{width:42%}th,td{padding:8px 10px}.grid{display:block;overflow-x:auto}}
@media print{body{background:#fff}header,.pill,.summary{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{break-inside:avoid}h2{break-after:avoid}main,footer{max-width:none}}
</style></head>
<body><header><div class="b">DIGERATI EXPERTS</div><h1>$(& $e $title)</h1>$(if ($meta) { "<p>$meta</p>" })<p>Completed $(& $e (& $when $Record.completed))</p></header><main>
<section class="summary $(& $cls $overall)"><div><div class="label">Overall</div><div class="big">$(& $e $overallText)</div></div><div class="counts">$(& $e ($summaryParts -join ' · '))</div></section>
<h2>Device</h2><table class="kv"><tr><th>Assigned user</th><td>$(& $val $Record.assignedUser)</td></tr><tr><th>Device</th><td>$(& $val $device)</td></tr><tr><th>Serial number</th><td>$(& $val $Record.serial)</td></tr><tr><th>Asset tag</th><td>$(& $val $Record.assetTag)</td></tr><tr><th>Operating system</th><td>$(& $val $Record.os)</td></tr><tr><th>Warranty until</th><td>$(& $val $Record.warrantyEnd)</td></tr></table>
<h2>$(if ($ClientSafe) { 'Services' } else { 'Readiness by area' })</h2><table class="st">$($areaRows -join '')</table>
$internal
</main><footer>$(if ($ClientSafe) { 'Prepared by Digerati Experts. Questions: support@digeratiexperts.com or portal.digeratiexperts.com.' } else { "Technician $(& $e $(if ($Record.technician) { $Record.technician } else { 'not recorded' })) &middot; mode $(& $e $Record.mode) &middot; Internal: contains technical detail; do not send to the client." })</footer></body></html>
"@
}
function Get-DEBundleFileHash {
    <# sha256 of a bundle file. Windows PowerShell's Get-FileHash returns nothing for a file it cannot open, so read
       it here with a short retry and fail with the file's name and the real reason instead of a null. #>
    param([Parameter(Mandatory = $true)][string]$Path, [int]$Attempts = 5)
    $last = $null
    for ($i = 1; $i -le $Attempts; $i++) {
        try {
            $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
            try { $sha = [Security.Cryptography.SHA256]::Create(); return (([BitConverter]::ToString($sha.ComputeHash($stream))) -replace '-', '').ToLowerInvariant() } finally { $stream.Dispose() }
        } catch { $last = $_.Exception.Message; if ($i -lt $Attempts) { Start-Sleep -Seconds 1 } }
    }
    throw ("cannot read {0} for the evidence manifest: {1}" -f [IO.Path]::GetFileName($Path), $last)
}

function Export-DEEvidenceBundle {
    <# Writes the bundle folder + zip: evidence.json, asset.json, gaps.json, report-internal.html, report-client.html, logs (redacted), manifest.sha256. #>
    param([Parameter(Mandatory = $true)]$Snapshot, $ClientProfile, [string]$OutDir)
    $de = Get-DEConsole
    $ctx = Get-DEContext
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    if (-not $OutDir) { $OutDir = Join-Path $de.Dirs.Evidence ("{0}-{1}-{2}" -f ($(if ($ctx['client']) { $ctx['client'] } else { 'unassigned' })), $env:COMPUTERNAME, $stamp) }
    New-Item -ItemType Directory -Path $OutDir -Force -WhatIf:$false | Out-Null
    $record = New-DEAssetRecord -Snapshot $Snapshot -ClientProfile $ClientProfile
    $gaps = Get-DEGapReport
    $evidence = @(Get-DEEvidence)
    Set-DEJsonFile -Path (Join-Path $OutDir 'evidence.json') -Object @{ generated = (Get-Date).ToString('o'); consoleVersion = $de.ConsoleVersion; context = $ctx; evidence = $evidence }
    Set-DEJsonFile -Path (Join-Path $OutDir 'asset.json') -Object $record
    Set-DEJsonFile -Path (Join-Path $OutDir 'gaps.json') -Object @{ gaps = $gaps }
    Set-DEJsonFile -Path (Join-Path $OutDir 'snapshot.json') -Object $Snapshot
    Set-Content -LiteralPath (Join-Path $OutDir 'report-internal.html') -Value (ConvertTo-DEHtmlReport -Record $record -ClientProfile $ClientProfile -Gaps $gaps -Evidence $evidence) -Encoding UTF8 -WhatIf:$false
    Set-Content -LiteralPath (Join-Path $OutDir 'report-client.html') -Value (ConvertTo-DEHtmlReport -Record $record -ClientProfile $ClientProfile -ClientSafe) -Encoding UTF8 -WhatIf:$false
    # PDF copies of both reports for email and the client file; skipped quietly when no Edge/Chrome is present.
    foreach ($r in @('report-client', 'report-internal')) { $null = Convert-DEHtmlToPdf -HtmlPath (Join-Path $OutDir "$r.html") -PdfPath (Join-Path $OutDir "$r.pdf") }
    if ($de.LogFile -and (Test-Path -LiteralPath $de.LogFile)) { (Get-Content -LiteralPath $de.LogFile | ForEach-Object { Protect-DEText $_ }) | Set-Content -LiteralPath (Join-Path $OutDir 'console.log') -Encoding UTF8 -WhatIf:$false }
    $manifest = @(Get-ChildItem -LiteralPath $OutDir -File | Where-Object { $_ -and $_.Name -ne 'manifest.sha256' } | Sort-Object Name | ForEach-Object { "{0}  {1}" -f (Get-DEBundleFileHash -Path $_.FullName), $_.Name })
    Set-Content -LiteralPath (Join-Path $OutDir 'manifest.sha256') -Value $manifest -Encoding ASCII -WhatIf:$false
    $zip = "$OutDir.zip"
    # the bundle is the local record of the run, a plan-only (-WhatIf) run included, so these writes never skip
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force -WhatIf:$false }
    Compress-Archive -Path (Join-Path $OutDir '*') -DestinationPath $zip -WhatIf:$false
    $bundleHash = Get-DEBundleFileHash -Path $zip
    # final secret sweep: refuse to hand over a bundle that still contains a registered secret
    $leak = $false
    foreach ($f in Get-ChildItem -LiteralPath $OutDir -File) {
        $txt = Get-Content -LiteralPath $f.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
        # the value as typed, and as JSON and HTML would escape it
        foreach ($v in $de.Redactions) { if ($v -and $txt) { foreach ($form in @($v, ($v | ConvertTo-Json -Compress).Trim('"'), [System.Net.WebUtility]::HtmlEncode($v))) { if ($form -and $txt.Contains($form)) { $leak = $true } } } }
    }
    # a withheld bundle leaves nothing behind: the zip and the unzipped folder both go
    if ($leak) { Remove-Item -LiteralPath $zip -Force -WhatIf:$false; Remove-Item -LiteralPath $OutDir -Recurse -Force -ErrorAction SilentlyContinue -WhatIf:$false; throw 'evidence bundle contained a registered secret and was withheld (zip and folder deleted); report this as a console bug' }
    Add-DEEvidence -Step 'evidence.bundle' -Module 'evidence' -Before 'no bundle' -ActionTaken 'bundle written' -Result 'INFO' -Verification "$zip sha256 $bundleHash" -Artifacts @($zip) | Out-Null
    return [pscustomobject]@{ folder = $OutDir; zip = $zip; sha256 = $bundleHash; record = $record; gaps = @($gaps).Count }
}

function Convert-DEHtmlToPdf {
    <# Prints an HTML report to PDF with headless Edge (or Chrome). Returns the PDF path, or $null when no browser is available. Never throws. #>
    param([Parameter(Mandatory = $true)][string]$HtmlPath, [Parameter(Mandatory = $true)][string]$PdfPath, [int]$TimeoutSeconds = 60)
    if ($env:OS -ne 'Windows_NT') { return $null }
    $candidates = @(
        (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'), (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
        (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'), (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'))
    $browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
    if (-not $browser) { return $null }
    # Edge prints to a temp file and only a readable copy lands beside the report, so a browser process that is
    # slow to let go (or was killed at the timeout) can never hold a file inside the evidence bundle.
    $profileDir = Join-Path ([IO.Path]::GetTempPath()) ("de-pdf-{0}" -f ([guid]::NewGuid()))
    $tmpPdf = "$profileDir.pdf"
    try {
        $uri = ([Uri](Resolve-Path -LiteralPath $HtmlPath).Path).AbsoluteUri
        $argList = @('--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=`"$profileDir`"", '--no-pdf-header-footer', "--print-to-pdf=`"$tmpPdf`"", $uri)
        $p = Start-Process -FilePath $browser -ArgumentList $argList -PassThru -WindowStyle Hidden -WhatIf:$false   # a local PDF of the report, part of the run's record
        if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
            # a timed-out print is never used: its PDF may be partial. End the whole browser tree, not just the launcher.
            try { $null = & taskkill.exe /PID $p.Id /T /F 2>&1 } catch { }
            try { $p.Kill() } catch { }
            return $null
        }
        for ($i = 1; $i -le 5; $i++) {
            if (Test-Path -LiteralPath $tmpPdf) { try { Copy-Item -LiteralPath $tmpPdf -Destination $PdfPath -Force -ErrorAction Stop -WhatIf:$false; return $PdfPath } catch { Remove-Item -LiteralPath $PdfPath -Force -ErrorAction SilentlyContinue -WhatIf:$false } }
            Start-Sleep -Seconds 1
        }
    } catch {
    } finally {
        Remove-Item -LiteralPath $tmpPdf -Force -ErrorAction SilentlyContinue -WhatIf:$false
        Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue -WhatIf:$false
    }
    return $null
}

function New-DEHubPayload {
    <# The Intelligence Hub device record: identity, mapping, onboarding state, controls, verification timestamps, evidence references, exceptions. No secrets. #>
    param([Parameter(Mandatory = $true)]$Record, [string]$BundleSha256 = '', [string]$BundlePath = '', [string]$Lifecycle)
    $de = Get-DEConsole
    # deviceKey (<maker>:<SERIAL>) is how the Hub, the boot rescue and this tool name the same device (contracts\device.schema.json).
    $key = $null; try { if ($Record.serial) { $key = ConvertTo-DEDeviceKey -Manufacturer "$($Record.manufacturer)" -Serial "$($Record.serial)" } } catch { $key = $null }
    $w = Get-DEState -Path 'warranty.current'
    $controls = @(Get-DEEvidence | Group-Object step | ForEach-Object { $last = $_.Group | Sort-Object timestamp -Descending | Select-Object -First 1; @{ control = $_.Name; module = $last.module; result = $last.result; verifiedAt = $last.timestamp } })
    return [ordered]@{
        schema = 'de.techconsole.device/v1'; source = "DETechConsole/$($de.ConsoleVersion)"; sentAt = (Get-Date).ToString('o')
        deviceKey = $key; lifecycle = $(if ($Lifecycle) { $Lifecycle } else { $null })
        # who ran which build under which licence: a copy that should not exist shows up here the first time it reports
        session = $(try { $ls = Get-DELicenseStatus; $bi = Get-DEBuildInfo; @{ technician = $ls.technician; licenseId = $ls.id; licenseState = $ls.state; buildId = $bi.buildId; issuedTo = $bi.issuedTo; integrity = "$(try { (Test-DEConsoleIntegrity).status } catch { 'unknown' })" } } catch { $null })
        warranty = $(if ($w) { @{ status = "$(Get-DEHashPath -Object $w -Path 'status')"; end = (Get-DEHashPath -Object $w -Path 'end'); source = (Get-DEHashPath -Object $w -Path 'source') } } else { $null })
        client = $Record.client; site = $Record.site; device = @{ hostname = $Record.hostname; serial = $Record.serial; manufacturer = $Record.manufacturer; model = $Record.model; assetTag = $Record.assetTag; role = $Record.role; os = $Record.os }
        user = @{ assigned = $Record.assignedUser; localUserName = $Record.localUserName; jumpcloudUser = $Record.jumpcloudUser; email = $Record.email }
        onboarding = @{ mode = $Record.mode; readiness = $Record.readiness; areas = $Record.areas; started = $Record.started; completed = $Record.completed; technician = $Record.technician }
        controls = $controls; exceptions = $Record.exceptions
        evidence = @{ bundleSha256 = $BundleSha256; bundleName = $(if ($BundlePath) { Split-Path -Leaf $BundlePath } else { '' }) }
    }
}
function Send-DEHubPayload {
    <#
    Sends the device record to the Intelligence Hub. URL comes from the console settings (hub.endpoint).
    Preferred: a signed de-sync event (device.observed) to <Hub>/api/integrations/v1/techconsole/events, signed with
    the runtime secret DE_HUB_SIGNING_SECRET (TECHCONSOLE_TO_HUB_SECRET on the Hub). Legacy: a Bearer POST to the
    configured URL with DE_HUB_TOKEN. Nothing is sent when neither is present; the payload is saved for manual upload.
    The Hub refuses a record with a secret-named key anywhere in it, so such keys (an apiToken a technician typed into
    a note field, say) are left out of what is sent and of the saved copy rather than kept as [REDACTED]; the evidence
    line names the keys that were left out. A refused send records the Hub's own reason, never the secret.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Payload, [string]$Endpoint)
    # Secret values are scrubbed as everywhere else, but secret-named keys are left out, not kept as [REDACTED]: the
    # Hub refuses a record with such a key whatever its value, so one stray apiToken used to fail every send closed.
    # Both name lists apply: the local scrub's and the contract's (the Hub's own, which also covers mfa, seed, pin).
    $droppedKeys = New-Object System.Collections.Generic.List[string]
    $Payload = Remove-DEContractSecretKeys -Object (Remove-DESecretKeys -Object $Payload -Drop -DroppedKeys $droppedKeys) -DroppedKeys $droppedKeys
    $dropped = @($droppedKeys | Select-Object -Unique)
    $leftOut = $(if ($dropped.Count) { " (left out secret-named field(s): $($dropped -join ', '))" } else { '' })
    $de = Get-DEConsole
    $file = Join-Path $de.Dirs.Evidence ("hub-payload-{0}-{1}.json" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Set-DEJsonFile -Path $file -Object $Payload
    if (-not $Endpoint) { $Endpoint = Get-DEState -Path 'settings.hub.endpoint' }
    if (-not $Endpoint) { Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'saved for manual upload (no Hub endpoint configured)' -Result 'WARN' -Verification $file -Remediation 'Set the Hub endpoint in Settings.' | Out-Null; return @{ sent = $false; file = $file } }
    if (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET') {
        $base = ([uri]$Endpoint).GetLeftPart([UriPartial]::Authority)
        if (-not $PSCmdlet.ShouldProcess($base, 'send signed device.observed event')) { return @{ sent = $false; planned = $true; file = $file } }
        try {
            if (-not $Payload.deviceKey) { throw 'the record has no usable serial, so it has no device key' }
            $acct = "$((Get-DEContext)['hubAccountId'])"; if ($acct -notmatch '^[1-9]\d*$') { throw 'the client profile has no hub.accountId (the client''s Intelligence Hub account number), so the Hub cannot file this device' }
            $ev = New-DEHubEvent -EventType 'device.observed' -EntityId $Payload.deviceKey -Payload $Payload -AccountId $acct
            $resp = Send-DEHubEvent -BaseUrl $base -Event $ev -Secret (Get-DESecretSecure -Name 'DE_HUB_SIGNING_SECRET')
            Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken "sent to Hub as signed event $($ev.eventId)$leftOut" -Result 'PASS' -Verification $base | Out-Null
            return @{ sent = $true; file = $file; response = $resp; eventId = $ev.eventId; leftOut = $dropped }
        } catch { $why = Get-DEHubErrorReason -ErrorRecord $_; Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken "signed send failed; saved for manual upload$leftOut" -Result 'FAIL' -Verification $why -Remediation $file | Out-Null; return @{ sent = $false; file = $file; error = $why; leftOut = $dropped } }
    }
    if (-not ((Test-DESecret -Name 'DE_HUB_TOKEN') -or $env:DE_HUB_TOKEN)) { Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'saved for manual upload (no Hub token this session)' -Result 'WARN' -Verification $file | Out-Null; return @{ sent = $false; file = $file } }
    if (-not $PSCmdlet.ShouldProcess($Endpoint, 'POST device record')) { return @{ sent = $false; planned = $true; file = $file } }
    try {
        $resp = Invoke-DEJsonPost -Uri $Endpoint -Body $Payload -TokenSecret 'DE_HUB_TOKEN' -TokenEnv 'DE_HUB_TOKEN'
        Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken "sent to Hub$leftOut" -Result 'PASS' -Verification "$Endpoint" | Out-Null
        return @{ sent = $true; file = $file; response = $resp }
    } catch { $why = Get-DEHubErrorReason -ErrorRecord $_; Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'send failed; saved for manual upload' -Result 'FAIL' -Verification $why -Remediation $file | Out-Null; return @{ sent = $false; file = $file; error = $why } }
}

function Send-DEHubMigrationRecord {
    <#
        Sends an email migration record (DE Microsoft Admin Export-DEMigrationRecord, contracts\migration.schema.json)
        to the Intelligence Hub as a signed email_migration.recorded event: the same endpoint (settings.hub.endpoint),
        signing secret (DE_HUB_SIGNING_SECRET, this session only) and account rule as the device record. The record is
        checked against its contract and for secret-looking keys before anything is signed (a migration record is built
        by Export-DEMigrationRecord, so a secret-named key there is a bug and stops the send). Throws with the reason;
        a refused send throws and records the Hub's own reason, never the secret.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Path, [string]$AccountId, [string]$Endpoint)
    if (-not (Test-Path -LiteralPath $Path)) { throw "no record at $Path" }
    $rec = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json
    if ("$($rec.schema)" -ne 'de.email-migration.record/v1') { throw "not a migration record (schema '$($rec.schema)')" }
    if (-not $Endpoint) { $Endpoint = Get-DEState -Path 'settings.hub.endpoint' }
    if (-not $Endpoint) { throw 'set the Intelligence Hub URL in Settings first' }
    if (-not (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET')) { throw 'set the Intelligence Hub signing secret in Settings first (it is kept for this session only)' }
    if (-not $AccountId) { $AccountId = "$((Get-DEContext)['hubAccountId'])" }
    if ($AccountId -notmatch '^[1-9]\d*$') { throw "the client's Intelligence Hub account number is needed (a whole number, from the account's page in the Hub)" }
    $base = ([uri]$Endpoint).GetLeftPart([UriPartial]::Authority)
    $ev = New-DEHubEvent -EventType 'email_migration.recorded' -EntityId "$($rec.projectId)" -Payload $rec -AccountId $AccountId
    if (-not $PSCmdlet.ShouldProcess($base, "send signed email_migration.recorded for $($rec.projectId)")) { return @{ sent = $false; planned = $true; eventId = $ev.eventId } }
    try { $resp = Send-DEHubEvent -BaseUrl $base -Event $ev -Secret (Get-DESecretSecure -Name 'DE_HUB_SIGNING_SECRET') }
    catch { $why = Get-DEHubErrorReason -ErrorRecord $_; Add-DEEvidence -Step 'hub.migration' -Module 'migration' -Before "record $($rec.projectId) ready" -ActionTaken 'signed send to the Hub failed' -Result 'FAIL' -Verification $why -Remediation $Path | Out-Null; throw "signed send to the Hub failed: $why" }
    Add-DEEvidence -Step 'hub.migration' -Module 'migration' -Before "record $($rec.projectId) ready" -ActionTaken "sent to the Hub as signed event $($ev.eventId)" -Result 'PASS' -Verification "$base : $($resp.status)" -Artifacts @($Path) | Out-Null
    return @{ sent = $true; eventId = $ev.eventId; response = $resp }
}

function Test-DEHubReachable {
    <# Anonymous liveness probe of the Hub (GET /api/healthz). Proves the Hub answers, not which release it runs. #>
    param([Parameter(Mandatory = $true)][string]$Endpoint, [int]$TimeoutSec = 10)
    if ($Endpoint -notmatch '^https://') { return [pscustomobject]@{ ok = $false; status = $null; detail = 'the Hub URL must start with https://' } }
    $base = ([uri]$Endpoint).GetLeftPart([UriPartial]::Authority)
    try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch { }
    try {
        $r = Invoke-WebRequest -Uri "$base/api/healthz" -UseBasicParsing -TimeoutSec $TimeoutSec -ErrorAction Stop
        return [pscustomobject]@{ ok = ([int]$r.StatusCode -eq 200); status = [int]$r.StatusCode; detail = "$base answered $([int]$r.StatusCode)" }
    } catch { return [pscustomobject]@{ ok = $false; status = $null; detail = "$base did not answer: $($_.Exception.Message)" } }
}
function Get-DEHubConnectionChecklist {
    <#
        What sending to the Intelligence Hub needs, in order, and whether each part is in place on this PC. The server
        side (TECHCONSOLE_TO_HUB_SECRET on the Hub) cannot be seen from here: it reads 'not checkable' until a signed
        send succeeds, which proves both halves match.
    #>
    param([string]$Endpoint)
    if (-not $Endpoint) { $Endpoint = "$(Get-DEState -Path 'settings.hub.endpoint')" }
    $acct = "$((Get-DEContext)['hubAccountId'])"
    $last = @(Get-DEEvidence | Where-Object { $_ -and $_.step -in @('hub.push', 'hub.migration') }) | Select-Object -Last 1
    $sentOk = [bool]($last -and $last.result -eq 'PASS' -and "$($last.action)" -match 'signed event')
    $items = @(
        [pscustomobject]@{ step = 'Hub URL (Settings > Console settings)'; ok = ($Endpoint -match '^https://'); detail = $(if ($Endpoint) { $Endpoint } else { 'not set' }) }
        [pscustomobject]@{ step = 'Signing secret for this session (Runtime secrets > Intelligence Hub signing secret)'; ok = [bool](Test-DESecret -Name 'DE_HUB_SIGNING_SECRET'); detail = $(if (Test-DESecret -Name 'DE_HUB_SIGNING_SECRET') { 'set for this session' } else { 'not set' }) }
        [pscustomobject]@{ step = "Client's Hub account number (client profile hub.accountId)"; ok = ($acct -match '^[1-9]\d*$'); detail = $(if ($acct) { $acct } else { 'the client profile has no hub.accountId; the Migration page asks for it when sending' }) }
        [pscustomobject]@{ step = 'The same secret on the Hub server (TECHCONSOLE_TO_HUB_SECRET)'; ok = $(if ($sentOk) { $true } else { $null }); detail = $(if ($sentOk) { "a signed send succeeded at $($last.timestamp)" } elseif ($last) { "last send: $($last.result) ($($last.verification))" } else { 'not checkable from here until a signed send succeeds; a Hub admin sets it on the server' }) }
    )
    return $items
}

Export-ModuleMember -Function Convert-DEHtmlToPdf, Get-DEReadiness, Get-DEGapReport, New-DEAssetRecord, ConvertTo-DEHtmlReport, Export-DEEvidenceBundle, New-DEHubPayload, Send-DEHubPayload, Send-DEHubMigrationRecord, Test-DEHubReachable, Get-DEHubConnectionChecklist
