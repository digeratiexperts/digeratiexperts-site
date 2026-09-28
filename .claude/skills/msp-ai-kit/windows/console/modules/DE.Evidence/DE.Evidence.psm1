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
}

function Get-DEReadiness {
    <# Rolls the latest evidence per action into area cards and an overall readiness state. Never green on failure; EXCEPTION shows as its own state. #>
    $latest = @{}
    foreach ($e in Get-DEEvidence) { $latest[$e.step] = $e }
    $cards = [ordered]@{}
    foreach ($k in $script:Areas.Keys) {
        $a = $script:Areas[$k]
        $recs = @($latest.Values | Where-Object { $r = $_; $r -and ($a.prefixes | Where-Object { $r.step -like "$_*" }) })
        $state = 'NOT RUN'
        if ($recs.Count) {
            $results = @($recs | ForEach-Object { $_.result })
            if ($results -contains 'FAIL') { $state = 'FAIL' } elseif ($results -contains 'BLOCKED') { $state = 'BLOCKED' } elseif ($results -contains 'WARN') { $state = 'WARN' } elseif ($results -contains 'PLANNED') { $state = 'PLANNED' } elseif ($results -contains 'EXCEPTION') { $state = 'EXCEPTION' } elseif (-not ($results | Where-Object { $_ -notin @('PASS', 'NO CHANGE', 'SKIPPED', 'INFO') })) { $state = 'PASS' } else { $state = 'WARN' }
        }
        $cards[$k] = [pscustomobject]@{ id = $k; title = $a.title; state = $state; count = $recs.Count; last = $(if ($recs.Count) { ($recs | Sort-Object timestamp -Descending | Select-Object -First 1).timestamp } else { $null }) }
    }
    $states = @($cards.Values | Where-Object { $_ -and $_.state -ne 'NOT RUN' } | ForEach-Object { $_.state })
    $overall = if (-not $states.Count) { 'NOT RUN' } elseif ($states -contains 'FAIL' -or $states -contains 'BLOCKED') { 'NOT READY' } elseif ($states -contains 'WARN' -or $states -contains 'PLANNED') { 'IN PROGRESS' } elseif ($states -contains 'EXCEPTION') { 'READY WITH EXCEPTIONS' } else { 'READY' }
    return [pscustomobject]@{ overall = $overall; cards = @($cards.Values) }
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
        assetTag = (Get-DEHashPath -Object $ctx -Path 'device.assetTag'); orderNumber = (Get-DEHashPath -Object $ctx -Path 'device.orderNumber'); warrantyEnd = (Get-DEHashPath -Object $ctx -Path 'device.warrantyEnd'); role = (Get-DEHashPath -Object $ctx -Path 'device.role')
        os = "$(Get-DEHashPath -Object $Snapshot -Path 'device.osCaption') $(Get-DEHashPath -Object $Snapshot -Path 'device.osDisplayVersion') ($(Get-DEHashPath -Object $Snapshot -Path 'device.osBuild'))"
        bios = "$(Get-DEHashPath -Object $Snapshot -Path 'device.biosVersion') $(Get-DEHashPath -Object $Snapshot -Path 'device.biosDate')"
        cpu = (Get-DEHashPath -Object $Snapshot -Path 'device.cpu'); ramGB = (Get-DEHashPath -Object $Snapshot -Path 'device.ramGB')
        encryption = @{ osEncrypted = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.osEncrypted'); protectionOn = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.osProtectionOn'); recoveryProtectorIds = (Get-DEHashPath -Object $Snapshot -Path 'bitlocker.os.recoveryProtectorIds') }
        identity = @{ joinType = (Get-DEHashPath -Object $Snapshot -Path 'identity.joinType'); tenant = (Get-DEHashPath -Object $Snapshot -Path 'identity.dsreg.tenantName') }
        management = @{ mdmAuthority = (Get-DEHashPath -Object $Snapshot -Path 'mdm.authority'); jumpcloudRegistered = (Get-DEHashPath -Object $Snapshot -Path 'mdm.jumpcloud.registered') }
        agents = $(if ($sec) { $o = [ordered]@{}; foreach ($k in $sec.Keys) { if ($sec[$k].installed) { $o[$k] = @{ running = $sec[$k].running } } }; $o } else { @{} })
        applications = @(@(Get-DEHashPath -Object $Snapshot -Path 'apps') | Where-Object { $_ } | Select-Object -First 400 | ForEach-Object { "$($_.name) $($_.version)" })
        network = @{ gateway = (Get-DEHashPath -Object $Snapshot -Path 'network.gateway'); dns = (Get-DEHashPath -Object $Snapshot -Path 'network.dns') }
        readiness = $r.overall; areas = @($r.cards | ForEach-Object { @{ area = $_.title; state = $_.state } })
        exceptions = @(Get-DEExceptions | ForEach-Object { @{ target = $_.target; reason = $_.reason; approver = $_.approver; expiresOn = $_.expiresOn } })
        technician = $ctx['technician']; mode = $ctx['mode']; started = $ctx['started']; completed = (Get-Date).ToString('o')
    }
}

function ConvertTo-DEHtmlReport {
    param([Parameter(Mandatory = $true)]$Record, [switch]$ClientSafe, $ClientProfile, [array]$Gaps = @(), [array]$Evidence = @())
    $e = { param($s) [System.Net.WebUtility]::HtmlEncode("$s") }
    $names = Get-DEHashPath -Object $ClientProfile -Path 'clientSafe.serviceNames'
    $title = $(if ($ClientSafe) { 'Device handover summary' } else { 'Device provisioning report (internal)' })
    $areaRows = foreach ($a in @($Record.areas | Where-Object { $_ })) {
        $label = $a.area
        if ($ClientSafe) { $label = switch -Regex ($a.area) { 'Guardz|Blackpoint' { $(if ($names -and (Get-DEHashPath -Object $names -Path 'mdr')) { Get-DEHashPath -Object $names -Path 'mdr' } else { 'Managed detection and response' }) } 'SentinelOne' { $(if ($names -and (Get-DEHashPath -Object $names -Path 'edr')) { Get-DEHashPath -Object $names -Path 'edr' } else { 'Endpoint protection' }) } 'JumpCloud' { 'Device and sign-in management' } 'Backup' { 'Managed backup' } 'Browser security' { 'Safe browsing protection' } default { $a.area } } }
        $cls = ($a.state -replace '\s', '').ToLower()
        $st = $a.state; if ($ClientSafe -and $st -eq 'EXCEPTION') { $st = 'Agreed exception' }
        "<tr><td>$(& $e $label)</td><td class=`"s $cls`">$(& $e $st)</td></tr>"
    }
    $internal = ''
    if (-not $ClientSafe) {
        $gapRows = (@($Gaps) | Where-Object { $_ } | ForEach-Object { "<tr><td>$(& $e $_.id)</td><td>$(& $e $_.result)</td><td>$(& $e $_.detail)</td><td>$(& $e $_.fix)</td></tr>" }) -join ''
        $evRows = (@($Evidence) | Where-Object { $_ } | Select-Object -Last 300 | ForEach-Object { "<tr><td>$(& $e $_.timestamp)</td><td>$(& $e $_.step)</td><td class=`"s $(($_.result -replace '\s','').ToLower())`">$(& $e $_.result)</td><td>$(& $e $_.action)</td><td>$(& $e $_.verification)</td></tr>" }) -join ''
        $agents = ($Record.agents.Keys | ForEach-Object { "$_ (running: $($Record.agents[$_].running))" }) -join ', '
        $internal = @"
<h2>Identity and management</h2><table><tr><th>Join type</th><td>$(& $e $Record.identity.joinType)</td></tr><tr><th>Tenant</th><td>$(& $e $Record.identity.tenant)</td></tr><tr><th>MDM authority</th><td>$(& $e $Record.management.mdmAuthority)</td></tr><tr><th>JumpCloud registered</th><td>$(& $e $Record.management.jumpcloudRegistered)</td></tr><tr><th>Agents</th><td>$(& $e $agents)</td></tr><tr><th>BitLocker</th><td>encrypted $(& $e $Record.encryption.osEncrypted), protection $(& $e $Record.encryption.protectionOn), recovery protector ids $(& $e (@($Record.encryption.recoveryProtectorIds) -join ', '))</td></tr></table>
<h2>Open items</h2><table><tr><th>Item</th><th>State</th><th>Detail</th><th>Fix</th></tr>$gapRows</table>
<h2>Exceptions</h2><table><tr><th>Item</th><th>Reason</th><th>Approver</th><th>Expires</th></tr>$((@($Record.exceptions) | Where-Object { $_ } | ForEach-Object { "<tr><td>$(& $e $_.target)</td><td>$(& $e $_.reason)</td><td>$(& $e $_.approver)</td><td>$(& $e $_.expiresOn)</td></tr>" }) -join '')</table>
<h2>Evidence log</h2><table><tr><th>Time</th><th>Step</th><th>Result</th><th>Action</th><th>Verification</th></tr>$evRows</table>
"@
    }
    return @"
<!doctype html><html lang="en"><head><meta charset="utf-8"><title>$(& $e $title)</title>
<style>:root{--well:#050312;--paper:#f7f5f2;--mag:#D3126A;--ink:#1a1620;--muted:#6b6672}body{margin:0;font:14px/1.5 "Space Grotesk","Segoe UI",sans-serif;color:var(--ink);background:#fff}header{background:var(--well);color:var(--paper);padding:24px 32px;border-bottom:4px solid var(--mag)}header .b{color:var(--mag);font:700 11px Oxanium,"Space Grotesk",sans-serif;letter-spacing:.12em}header h1{margin:4px 0;font-size:22px}header p{margin:0;color:rgba(247,245,242,.7)}main{padding:20px 32px;max-width:1100px}h2{font-size:15px;margin:24px 0 8px}table{border-collapse:collapse;width:100%;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}th{color:var(--muted);font-weight:600;width:220px}.s{font-weight:700}.pass,.nochange,.ready{color:#0f8a5f}.warn,.planned,.inprogress{color:#a36b00}.fail,.blocked,.notready{color:var(--mag)}.exception,.agreedexception,.readywithexceptions{color:#6d4bd8}.notrun{color:var(--muted)}footer{padding:16px 32px;color:var(--muted);font-size:12px}@media print{header{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
<body><header><div class="b">DIGERATI EXPERTS</div><h1>$(& $e $title)</h1><p>$(& $e $Record.clientName) $(if ($Record.site) { "· $(& $e $Record.site)" }) · $(& $e $Record.hostname) · $(& $e $Record.completed)</p></header><main>
<h2>Device</h2><table><tr><th>Assigned user</th><td>$(& $e $Record.assignedUser)</td></tr><tr><th>Device</th><td>$(& $e $Record.manufacturer) $(& $e $Record.model), serial $(& $e $Record.serial)</td></tr><tr><th>Asset tag</th><td>$(& $e $Record.assetTag)</td></tr><tr><th>Operating system</th><td>$(& $e $Record.os)</td></tr><tr><th>Warranty</th><td>$(& $e $Record.warrantyEnd)</td></tr><tr><th>Overall readiness</th><td class="s $(($Record.readiness -replace '\s','').ToLower())">$(& $e $Record.readiness)</td></tr></table>
<h2>$(if ($ClientSafe) { 'Services in place' } else { 'Readiness by area' })</h2><table>$($areaRows -join '')</table>
$internal
</main><footer>$(if ($ClientSafe) { 'Prepared by Digerati Experts. Questions: support@digeratiexperts.com or portal.digeratiexperts.com.' } else { "Technician $(& $e $Record.technician) · mode $(& $e $Record.mode) · internal: contains technical detail; do not send to the client." })</footer></body></html>
"@
}

function Export-DEEvidenceBundle {
    <# Writes the bundle folder + zip: evidence.json, asset.json, gaps.json, report-internal.html, report-client.html, logs (redacted), manifest.sha256. #>
    param([Parameter(Mandatory = $true)]$Snapshot, $ClientProfile, [string]$OutDir)
    $de = Get-DEConsole
    $ctx = Get-DEContext
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    if (-not $OutDir) { $OutDir = Join-Path $de.Dirs.Evidence ("{0}-{1}-{2}" -f ($(if ($ctx['client']) { $ctx['client'] } else { 'unassigned' })), $env:COMPUTERNAME, $stamp) }
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
    $record = New-DEAssetRecord -Snapshot $Snapshot -ClientProfile $ClientProfile
    $gaps = Get-DEGapReport
    $evidence = @(Get-DEEvidence)
    Set-DEJsonFile -Path (Join-Path $OutDir 'evidence.json') -Object @{ generated = (Get-Date).ToString('o'); consoleVersion = $de.ConsoleVersion; context = $ctx; evidence = $evidence }
    Set-DEJsonFile -Path (Join-Path $OutDir 'asset.json') -Object $record
    Set-DEJsonFile -Path (Join-Path $OutDir 'gaps.json') -Object @{ gaps = $gaps }
    Set-DEJsonFile -Path (Join-Path $OutDir 'snapshot.json') -Object $Snapshot
    Set-Content -LiteralPath (Join-Path $OutDir 'report-internal.html') -Value (ConvertTo-DEHtmlReport -Record $record -ClientProfile $ClientProfile -Gaps $gaps -Evidence $evidence) -Encoding UTF8
    Set-Content -LiteralPath (Join-Path $OutDir 'report-client.html') -Value (ConvertTo-DEHtmlReport -Record $record -ClientProfile $ClientProfile -ClientSafe) -Encoding UTF8
    # PDF copies of both reports for email and the client file; skipped quietly when no Edge/Chrome is present.
    foreach ($r in @('report-client', 'report-internal')) { $null = Convert-DEHtmlToPdf -HtmlPath (Join-Path $OutDir "$r.html") -PdfPath (Join-Path $OutDir "$r.pdf") }
    if ($de.LogFile -and (Test-Path -LiteralPath $de.LogFile)) { (Get-Content -LiteralPath $de.LogFile | ForEach-Object { Protect-DEText $_ }) | Set-Content -LiteralPath (Join-Path $OutDir 'console.log') -Encoding UTF8 }
    $manifest = @(Get-ChildItem -LiteralPath $OutDir -File | Where-Object { $_ -and $_.Name -ne 'manifest.sha256' } | Sort-Object Name | ForEach-Object { "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant(), $_.Name })
    Set-Content -LiteralPath (Join-Path $OutDir 'manifest.sha256') -Value $manifest -Encoding ASCII
    $zip = "$OutDir.zip"
    if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
    Compress-Archive -Path (Join-Path $OutDir '*') -DestinationPath $zip
    $bundleHash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
    # final secret sweep: refuse to hand over a bundle that still contains a registered secret
    $leak = $false
    foreach ($f in Get-ChildItem -LiteralPath $OutDir -File) { $txt = Get-Content -LiteralPath $f.FullName -Raw -ErrorAction SilentlyContinue; foreach ($v in $de.Redactions) { if ($v -and $txt -and $txt.Contains($v)) { $leak = $true } } }
    if ($leak) { Remove-Item -LiteralPath $zip -Force; throw 'evidence bundle contained a registered secret and was withheld; report this as a console bug' }
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
    try {
        $uri = ([Uri](Resolve-Path -LiteralPath $HtmlPath).Path).AbsoluteUri
        $profileDir = Join-Path ([IO.Path]::GetTempPath()) ("de-pdf-{0}" -f ([guid]::NewGuid()))
        $argList = @('--headless=new', '--disable-gpu', '--no-first-run', "--user-data-dir=`"$profileDir`"", '--no-pdf-header-footer', "--print-to-pdf=`"$PdfPath`"", $uri)
        $p = Start-Process -FilePath $browser -ArgumentList $argList -PassThru -WindowStyle Hidden
        if (-not $p.WaitForExit($TimeoutSeconds * 1000)) { try { $p.Kill() } catch { } }
        Remove-Item -LiteralPath $profileDir -Recurse -Force -ErrorAction SilentlyContinue
        if (Test-Path -LiteralPath $PdfPath) { return $PdfPath }
    } catch { }
    return $null
}

function New-DEHubPayload {
    <# The Intelligence Hub device record: identity, mapping, onboarding state, controls, verification timestamps, evidence references, exceptions. No secrets. #>
    param([Parameter(Mandatory = $true)]$Record, [string]$BundleSha256 = '', [string]$BundlePath = '')
    $de = Get-DEConsole
    $controls = @(Get-DEEvidence | Group-Object step | ForEach-Object { $last = $_.Group | Sort-Object timestamp -Descending | Select-Object -First 1; @{ control = $_.Name; module = $last.module; result = $last.result; verifiedAt = $last.timestamp } })
    return [ordered]@{
        schema = 'de.techconsole.device/v1'; source = "DETechConsole/$($de.ConsoleVersion)"; sentAt = (Get-Date).ToString('o')
        client = $Record.client; site = $Record.site; device = @{ hostname = $Record.hostname; serial = $Record.serial; manufacturer = $Record.manufacturer; model = $Record.model; assetTag = $Record.assetTag; role = $Record.role; os = $Record.os }
        user = @{ assigned = $Record.assignedUser; localUserName = $Record.localUserName; jumpcloudUser = $Record.jumpcloudUser; email = $Record.email }
        onboarding = @{ mode = $Record.mode; readiness = $Record.readiness; areas = $Record.areas; started = $Record.started; completed = $Record.completed; technician = $Record.technician }
        controls = $controls; exceptions = $Record.exceptions
        evidence = @{ bundleSha256 = $BundleSha256; bundleName = $(if ($BundlePath) { Split-Path -Leaf $BundlePath } else { '' }) }
    }
}
function Send-DEHubPayload {
    <#
    POSTs the device record to the Hub integration endpoint. URL comes from the console settings
    (hub.endpoint), the bearer token from the runtime secret DE_HUB_TOKEN or the environment variable
    DE_HUB_TOKEN. Nothing is sent when either is missing; the payload is saved for manual upload instead.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)]$Payload, [string]$Endpoint)
    $de = Get-DEConsole
    $file = Join-Path $de.Dirs.Evidence ("hub-payload-{0}-{1}.json" -f $env:COMPUTERNAME, (Get-Date -Format 'yyyyMMdd-HHmmss'))
    Set-DEJsonFile -Path $file -Object $Payload
    if (-not $Endpoint) { $Endpoint = Get-DEState -Path 'settings.hub.endpoint' }
    if (-not $Endpoint) { Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'saved for manual upload (no Hub endpoint configured)' -Result 'WARN' -Verification $file -Remediation 'Set the Hub endpoint in Settings.' | Out-Null; return @{ sent = $false; file = $file } }
    if (-not ((Test-DESecret -Name 'DE_HUB_TOKEN') -or $env:DE_HUB_TOKEN)) { Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'saved for manual upload (no Hub token this session)' -Result 'WARN' -Verification $file | Out-Null; return @{ sent = $false; file = $file } }
    if (-not $PSCmdlet.ShouldProcess($Endpoint, 'POST device record')) { return @{ sent = $false; planned = $true; file = $file } }
    try {
        $resp = Invoke-DEJsonPost -Uri $Endpoint -Body $Payload -TokenSecret 'DE_HUB_TOKEN' -TokenEnv 'DE_HUB_TOKEN'
        Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken "sent to Hub" -Result 'PASS' -Verification "$Endpoint" | Out-Null
        return @{ sent = $true; file = $file; response = $resp }
    } catch { Add-DEEvidence -Step 'hub.push' -Module 'evidence' -Before 'payload ready' -ActionTaken 'send failed; saved for manual upload' -Result 'FAIL' -Verification $_.Exception.Message -Remediation $file | Out-Null; return @{ sent = $false; file = $file } }
}

Export-ModuleMember -Function Convert-DEHtmlToPdf, Get-DEReadiness, Get-DEGapReport, New-DEAssetRecord, ConvertTo-DEHtmlReport, Export-DEEvidenceBundle, New-DEHubPayload, Send-DEHubPayload
