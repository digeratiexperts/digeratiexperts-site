<#
    DE email migration engine (dot-sourced by DE-Microsoft-Admin.psm1). MIGRATION-STANDARD.md is the contract.

    Gmail (consumer) -> Microsoft 365 over Exchange Online IMAP migration; contacts and calendars move separately
    (Google exports imported through Graph). A migration project is one JSON state file that never holds a credential:
    Gmail app passwords exist only as SecureStrings / PSCredentials for the length of one call, and the CSV Exchange
    needs is built in memory, handed over as bytes and wiped.
#>

$script:MigrationDir = $(if ($env:ProgramData) { Join-Path $env:ProgramData 'DE\MicrosoftAdmin\migrations' } else { Join-Path ([IO.Path]::GetTempPath()) 'de-migrations' })
$script:MigrationStages = @('Assessment', 'Provisioning', 'Preflight', 'Pilot', 'Batches', 'ContactsCalendar', 'Devices', 'DnsCutover', 'FinalDelta', 'Verification', 'SignedOff', 'Closed')
# The checks a client signs off. Automated ones are filled by the functions named; the rest are recorded by a technician.
$script:MigrationChecks = [ordered]@{
    'Inbound mail'       = 'Test-DEMigrationMailFlow'
    'Outbound mail'      = 'Test-DEMigrationMailFlow'
    'Replies'            = 'technician'
    'Attachments'        = 'technician'
    'Folders'            = 'Get-DEMigrationStatus'
    'Contacts'           = 'Import-DEMigrationContacts'
    'Calendar'           = 'Import-DEMigrationCalendar'
    'MFA'                = 'Test-DEMigrationMfa'
    'Outlook desktop'    = 'technician'
    'Outlook mobile'     = 'technician'
    'Shared mailbox'     = 'Test-DEMigrationSharedMailbox'
    'DNS and forwarding' = 'Test-DEMigrationDns'
    'Bounce diagnostic'  = 'Invoke-DEBounceDiagnostic'
}
$script:MigrationSecretKey = '(?i)(passw|secret|token|credential|app.?pass|client.?secret)'
$script:GmailExcludeDefault = @('[Gmail]/Spam', '[Gmail]/Trash', '[Gmail]/Important', '[Gmail]/Starred')

# ============================================================ project state
function Get-DEMigrationPath { param([Parameter(Mandatory = $true)][string]$ProjectId) if ($ProjectId -notmatch '^[A-Za-z0-9-]{1,64}$') { throw "not a project id: $ProjectId" }; return (Join-Path $script:MigrationDir "$ProjectId.json") }
function Set-DEMigrationDirectory { param([Parameter(Mandatory = $true)][string]$Path) $script:MigrationDir = $Path; return $Path }
function Find-DEMigrationSecret {
    <# Paths of keys in the state that look like they hold a credential. A project that has one is never written. #>
    param($Node, [string]$Path = '$')
    $hits = @()
    if ($Node -is [System.Collections.IDictionary]) { foreach ($k in @($Node.Keys)) { if ("$k" -match $script:MigrationSecretKey) { $hits += "$Path.$k" }; $hits += @(Find-DEMigrationSecret -Node $Node[$k] -Path "$Path.$k") } }
    elseif ($Node -is [System.Management.Automation.PSCustomObject]) { foreach ($p in $Node.PSObject.Properties) { if ($p.Name -match $script:MigrationSecretKey) { $hits += "$Path.$($p.Name)" }; $hits += @(Find-DEMigrationSecret -Node $p.Value -Path "$Path.$($p.Name)") } }
    elseif ($Node -is [securestring] -or $Node -is [pscredential]) { $hits += "$Path (a credential object)" }
    elseif ($Node -is [System.Collections.IEnumerable] -and -not ($Node -is [string])) { $i = 0; foreach ($e in $Node) { $hits += @(Find-DEMigrationSecret -Node $e -Path "$Path[$i]"); $i++ } }
    return $hits
}
function Find-DEMigrationHubRefusal {
    <# Paths the Intelligence Hub's techconsole intake refuses (its TECHCONSOLE_SECRET_KEY_RE on keys, a BitLocker recovery password shape anywhere). #>
    param($Node, [string]$Path = '$')
    $key = '(?i)(passw|secret|token|api.?key|recovery.?pass|recovery.?key|connect.?key|private.?key|mfa|seed|^tap$|^pin$)'
    $bl = '(?<!\d)\d{6}(-\d{6}){7}(?!\d)'
    if ($null -eq $Node) { return @() }
    if ($Node -is [string]) { if ($Node -match $bl) { return @($Path) }; return @() }
    if ($Node -is [System.Collections.IDictionary]) { return @(foreach ($k in @($Node.Keys)) { if ("$k" -match $key -or "$k" -match $bl) { "$Path.$k" } else { Find-DEMigrationHubRefusal -Node $Node[$k] -Path "$Path.$k" } }) }
    if ($Node -is [System.Collections.IEnumerable]) { $i = 0; return @(foreach ($e in $Node) { Find-DEMigrationHubRefusal -Node $e -Path "$Path[$i]"; $i++ }) }
    if ($Node -is [System.Management.Automation.PSCustomObject] -or ($Node -is [psobject] -and $Node.PSObject.BaseObject -is [System.Management.Automation.PSCustomObject])) { return @(foreach ($pp in $Node.PSObject.Properties) { if ($pp.Name -match $key -or $pp.Name -match $bl) { "$Path.$($pp.Name)" } else { Find-DEMigrationHubRefusal -Node $pp.Value -Path "$Path.$($pp.Name)" } }) }
    return @()
}
function Save-DEMigrationProject {
    param([Parameter(Mandatory = $true)]$Project, [string]$Entry)
    $hits = @(Find-DEMigrationSecret -Node $Project)
    if ($hits.Count) { throw "refusing to save migration project $($Project.projectId): credential-like fields at $($hits -join ', ')" }
    if ($Entry) { $Project.events = @(@($Project.events) + @([pscustomobject]@{ at = (Get-Date).ToUniversalTime().ToString('o'); by = "$env:USERDOMAIN\$env:USERNAME"; event = $Entry })) }
    $Project.updatedAt = (Get-Date).ToUniversalTime().ToString('o')
    $path = Get-DEMigrationPath -ProjectId $Project.projectId
    $dir = Split-Path -Parent $path; if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
    $tmp = "$path.tmp"
    [IO.File]::WriteAllText($tmp, (ConvertTo-Json -InputObject $Project -Depth 20), (New-Object Text.UTF8Encoding $false))
    Move-Item -LiteralPath $tmp -Destination $path -Force -WhatIf:$false
    return $Project
}
function Get-DEMigrationProject {
    <# One project by id, or every project in the migration folder. #>
    [CmdletBinding()] param([string]$ProjectId)
    if ($ProjectId) {
        $path = Get-DEMigrationPath -ProjectId $ProjectId
        if (-not (Test-Path -LiteralPath $path)) { throw "no migration project $ProjectId in $script:MigrationDir" }
        return (Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json)
    }
    if (-not (Test-Path -LiteralPath $script:MigrationDir)) { return @() }
    return @(Get-ChildItem -LiteralPath $script:MigrationDir -Filter '*.json' | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw -Encoding UTF8 | ConvertFrom-Json } | Sort-Object createdAt)
}
function Get-DEMigrationUser {
    param([Parameter(Mandatory = $true)]$Project, [Parameter(Mandatory = $true)][string]$SourceAddress)
    $u = @($Project.users | Where-Object { "$($_.source)" -ieq $SourceAddress })
    if (-not $u.Count) { throw "$SourceAddress is not in migration project $($Project.projectId); add it with Add-DEMigrationUser" }
    return $u[0]
}
function Set-DEMigrationCheckValue {
    param([Parameter(Mandatory = $true)]$Project, [Parameter(Mandatory = $true)][string]$Check, [Parameter(Mandatory = $true)][ValidateSet('Pass', 'Fail', 'NotApplicable', 'Pending')][string]$Status, [string]$Detail, [string]$By = "$env:USERDOMAIN\$env:USERNAME")
    if (-not $script:MigrationChecks.Contains($Check)) { throw "unknown check '$Check' (known: $($script:MigrationChecks.Keys -join ', '))" }
    $entry = [pscustomobject]@{ status = $Status; detail = $Detail; by = $By; at = (Get-Date).ToUniversalTime().ToString('o') }
    if ($Project.verification.PSObject.Properties[$Check]) { $Project.verification.$Check = $entry } else { $Project.verification | Add-Member -NotePropertyName $Check -NotePropertyValue $entry }
}
function Set-DEMigrationStage {
    param([Parameter(Mandatory = $true)]$Project, [Parameter(Mandatory = $true)][string]$Stage)
    # stages only move forward; a later step never pulls the project back
    if ([array]::IndexOf($script:MigrationStages, $Stage) -gt [array]::IndexOf($script:MigrationStages, "$($Project.stage)")) { $Project.stage = $Stage }
}

function Get-DEMigrationSourceType {
    <#
        PersonalGmail for @gmail.com / @googlemail.com; GoogleWorkspace when the domain's MX is Google's; OtherIMAP
        otherwise. The Google Workspace migration path is never offered for a consumer Gmail address.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$Address)
    $domain = ($Address -split '@')[-1].ToLowerInvariant()
    if ($domain -in @('gmail.com', 'googlemail.com')) { return [pscustomobject]@{ address = $Address; type = 'PersonalGmail'; evidence = "$domain is consumer Gmail"; mailPath = 'IMAP (imap.gmail.com:993, app password)'; contactsCalendar = 'separate export and import' } }
    $mx = @()
    if (Get-Command -Name 'Resolve-DnsName' -ErrorAction SilentlyContinue) { $mx = @(Resolve-DnsName -Name $domain -Type MX -DnsOnly -ErrorAction SilentlyContinue | Where-Object { $_.PSObject.Properties['NameExchange'] } | ForEach-Object { "$($_.NameExchange)".ToLowerInvariant() }) }
    if (@($mx | Where-Object { $_ -match '(^|\.)(google\.com|googlemail\.com)\.?$' }).Count) { return [pscustomobject]@{ address = $Address; type = 'GoogleWorkspace'; evidence = "MX: $($mx -join ', ')"; mailPath = 'Google Workspace migration (Exchange Online) or IMAP'; contactsCalendar = 'Workspace migration moves them' } }
    return [pscustomobject]@{ address = $Address; type = 'OtherIMAP'; evidence = $(if ($mx.Count) { "MX: $($mx -join ', ')" } else { 'no MX found (or Resolve-DnsName unavailable)' }); mailPath = 'IMAP'; contactsCalendar = 'separate export and import' }
}
function New-DEMigrationProject {
    <#
        Starts a migration project: client, destination domain (must be verified in the connected tenant), and the
        source type (consumer Gmail is always IMAP). Writes the state file and returns the project.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ClientName, [Parameter(Mandatory = $true)][string]$TargetDomain, [ValidateSet('PersonalGmail', 'GoogleWorkspace', 'OtherIMAP')][string]$SourceType = 'PersonalGmail', [string]$ProjectId, [string]$RequestedBy = "$env:USERDOMAIN\$env:USERNAME")
    $domain = $TargetDomain.ToLowerInvariant()
    $verified = @(Invoke-DEGraphRequest -Uri 'domains?$select=id,isVerified' -All | Where-Object { "$($_.id)" -ieq $domain -and $_.isVerified })
    if (-not $verified.Count) { return (New-DEResult -Operation 'New-DEMigrationProject' -Status Refused -Target $domain -Message "$domain is not a verified domain in tenant $($script:Ctx.TenantId): check the spelling against the tenant, never a screenshot") }
    if (-not $ProjectId) { $ProjectId = (($ClientName -replace '[^A-Za-z0-9]+', '-').Trim('-').ToLowerInvariant() + '-' + (Get-Date -Format 'yyyyMMdd')) }
    if (Test-Path -LiteralPath (Get-DEMigrationPath -ProjectId $ProjectId)) { return (New-DEResult -Operation 'New-DEMigrationProject' -Status Refused -Target $ProjectId -Message "project $ProjectId already exists; open it with Get-DEMigrationProject") }
    $verification = [pscustomobject]@{}
    $p = [pscustomobject][ordered]@{
        schema = 'de.email-migration.project/v1'; projectId = $ProjectId; client = $ClientName; tenantId = $script:Ctx.TenantId; targetDomain = $domain
        sourceType = $SourceType; mailPath = $(if ($SourceType -eq 'GoogleWorkspace') { 'GoogleWorkspace' } else { 'IMAP' }); stage = 'Assessment'
        requestedBy = $RequestedBy; createdAt = (Get-Date).ToUniversalTime().ToString('o'); updatedAt = $null
        users = @(); sharedMailboxes = @(); devices = @(); batches = @(); dns = $null; bounce = @(); verification = $verification; signoff = $null; events = @()
    }
    foreach ($c in $script:MigrationChecks.Keys) { Set-DEMigrationCheckValue -Project $p -Check $c -Status Pending -Detail "filled by $($script:MigrationChecks[$c])" }
    if (-not $PSCmdlet.ShouldProcess($ProjectId, 'create migration project')) { return (New-DEResult -Operation 'New-DEMigrationProject' -Status DryRun -Target $ProjectId -Message 'no change applied' -Data $p) }
    $null = Save-DEMigrationProject -Project $p -Entry "project created for $ClientName ($SourceType -> Microsoft 365, $domain)"
    return (New-DEResult -Operation 'New-DEMigrationProject' -Target $ProjectId -Message "project $ProjectId created; next: Add-DEMigrationUser for each mailbox" -Data $p)
}
function Add-DEMigrationUser {
    <#
        Maps one source address to its Microsoft 365 mailbox, checking the destination exists, is a licensed user
        mailbox on the project's domain, and that the source type matches the project. Devices (PC names, phones,
        scanners) the person sends mail from are recorded for the device and bounce checks.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$SourceAddress, [Parameter(Mandatory = $true)][string]$DestinationAddress, [string]$DisplayName, [string[]]$Devices = @())
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    foreach ($a in @($SourceAddress, $DestinationAddress)) { if ($a -notmatch '^[A-Za-z0-9._%+''-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$') { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status Refused -Target $SourceAddress -Message "'$a' is not an email address") } }
    if (($DestinationAddress -split '@')[1] -ine $p.targetDomain) { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status Refused -Target $SourceAddress -Message "$DestinationAddress is not on the project domain $($p.targetDomain)") }
    $src = Get-DEMigrationSourceType -Address $SourceAddress
    if ($src.type -ne $p.sourceType) { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status Refused -Target $SourceAddress -Message "$SourceAddress is $($src.type) ($($src.evidence)); this project is $($p.sourceType)") }
    if (@($p.users | Where-Object { "$($_.source)" -ieq $SourceAddress -or "$($_.destination)" -ieq $DestinationAddress }).Count) { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status Refused -Target $SourceAddress -Message 'that source or destination is already mapped in this project') }
    $user = $null; try { $user = Invoke-DEGraphRequest -Uri ('users/{0}?$select=id,displayName,userPrincipalName,accountEnabled,assignedLicenses,mail' -f [uri]::EscapeDataString($DestinationAddress)) } catch { $user = $null }
    if (-not $user) { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status Refused -Target $SourceAddress -Message "no Microsoft 365 user $DestinationAddress yet: create it (New-DEUser) and license it first") }
    $licensed = [bool]@($user.assignedLicenses).Count
    $mailbox = $null
    if (Get-Command -Name 'Get-EXOMailbox' -ErrorAction SilentlyContinue) { try { $mailbox = Get-EXOMailbox -Identity $DestinationAddress -Properties RecipientTypeDetails -ErrorAction Stop } catch { $mailbox = $null } }
    $issues = @(); if (-not $licensed) { $issues += 'no licence (no mailbox until one is assigned)' }; if ($mailbox -and "$($mailbox.RecipientTypeDetails)" -ne 'UserMailbox') { $issues += "destination is a $($mailbox.RecipientTypeDetails), not a user mailbox" }
    if (-not $mailbox -and (Get-Command -Name 'Get-EXOMailbox' -ErrorAction SilentlyContinue)) { $issues += 'no Exchange mailbox yet (licence it and wait for provisioning)' }
    $entry = [pscustomobject][ordered]@{
        source = $SourceAddress.ToLowerInvariant(); destination = $DestinationAddress.ToLowerInvariant(); displayName = $(if ($DisplayName) { $DisplayName } else { "$($user.displayName)" }); userId = $user.id
        sourceType = $src.type; devices = @($Devices | Where-Object { $_ }); destinationReady = (-not $issues.Count); destinationIssues = $issues
        preflight = $null; batch = $null; migration = $null; contacts = $null; calendar = $null; mfa = $null
    }
    if (-not $PSCmdlet.ShouldProcess($ProjectId, "map $SourceAddress -> $DestinationAddress")) { return (New-DEResult -Operation 'Add-DEMigrationUser' -Status DryRun -Target $SourceAddress -Message 'no change applied' -Data $entry) }
    $p.users = @(@($p.users) + @($entry)); $p.devices = @(@($p.devices) + @($Devices | Where-Object { $_ }) | Select-Object -Unique)
    Set-DEMigrationStage -Project $p -Stage 'Provisioning'
    $null = Save-DEMigrationProject -Project $p -Entry "mapped $SourceAddress -> $DestinationAddress$(if ($issues.Count) { " (not ready: $($issues -join '; '))" })"
    return (New-DEResult -Operation 'Add-DEMigrationUser' -Status $(if ($issues.Count) { 'Partial' } else { 'Succeeded' }) -Target $SourceAddress -Message $(if ($issues.Count) { "mapped, but the destination is not ready: $($issues -join '; ')" } else { "mapped to $DestinationAddress (licensed user mailbox)" }) -Data $entry)
}

# ============================================================ Gmail IMAP
function ConvertFrom-DEImapUtf7 {
    <# IMAP folder names use modified UTF-7 (RFC 3501): '&' + base64 of UTF-16BE with ',' for '/' + '-'. '&-' is '&'. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Name)
    return [regex]::Replace($Name, '&([A-Za-z0-9+,]*)-', {
            param($m) $b = $m.Groups[1].Value
            if (-not $b) { return '&' }
            $b = $b.Replace(',', '/'); while ($b.Length % 4) { $b += '=' }
            return [Text.Encoding]::BigEndianUnicode.GetString([Convert]::FromBase64String($b))
        })
}
function ConvertTo-DEImapQuoted { param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Value) return '"' + ($Value -replace '\\', '\\' -replace '"', '\"') + '"' }
function Read-DEImapResponse {
    <# Reads lines up to the tagged completion for -Tag, following {n} literals. Returns @{ status; text; lines }. #>
    param([Parameter(Mandatory = $true)][IO.TextReader]$Reader, [Parameter(Mandatory = $true)][string]$Tag)
    $lines = New-Object System.Collections.Generic.List[string]
    while ($true) {
        $line = $Reader.ReadLine()
        if ($null -eq $line) { throw 'the IMAP server closed the connection' }
        while ($line -match '\{(\d+)\}$') { $n = [int]$Matches[1]; $buf = New-Object char[] $n; $read = 0; while ($read -lt $n) { $r = $Reader.Read($buf, $read, $n - $read); if ($r -le 0) { throw 'IMAP literal cut short' }; $read += $r }; $line = $line.Substring(0, $line.LastIndexOf('{')) + '"' + (New-Object string (, $buf)) + '"' + $Reader.ReadLine() }
        if ($line.StartsWith("$Tag ")) { $rest = $line.Substring($Tag.Length + 1); $st = ($rest -split ' ', 2)[0]; return @{ status = $st; text = $rest; lines = $lines.ToArray() } }
        $lines.Add($line)
    }
}
function Invoke-DEImapConversation {
    <#
        The Gmail preflight over an already-open IMAP stream: LOGIN, LIST, STATUS per selectable folder, GETQUOTAROOT,
        LOGOUT. Separate from the socket so it can be tested with a scripted server. The password is sent once and never
        returned, logged or kept.
    #>
    param([Parameter(Mandatory = $true)][IO.TextReader]$Reader, [Parameter(Mandatory = $true)][IO.TextWriter]$Writer, [Parameter(Mandatory = $true)][pscredential]$Credential)
    $greet = $Reader.ReadLine()
    if ("$greet" -notmatch '^\* (OK|PREAUTH)') { return [pscustomobject]@{ loginOk = $false; reason = "unexpected IMAP greeting: $greet"; folders = @() } }
    $plain = $Credential.GetNetworkCredential().Password -replace '\s', ''   # Google shows app passwords in groups of four
    try { $Writer.Write("a1 LOGIN $(ConvertTo-DEImapQuoted $Credential.UserName) $(ConvertTo-DEImapQuoted $plain)" + "`r`n"); $Writer.Flush() } finally { $plain = $null }
    $login = Read-DEImapResponse -Reader $Reader -Tag 'a1'
    if ($login.status -ne 'OK') {
        $why = "$($login.text)"
        $reason = $(if ($why -match 'Application-specific password required|WEBLOGIN|app password') { 'Google needs an app password for this account: turn on 2-Step Verification, create an app password (Google Account > Security > App passwords) and use that' }
            elseif ($why -match 'AUTHENTICATIONFAILED|Invalid credentials') { 'Google refused the sign-in: check the address and the app password (a normal Gmail password does not work over IMAP)' }
            else { "sign-in refused: $why" })
        return [pscustomobject]@{ loginOk = $false; reason = $reason; folders = @() }
    }
    $Writer.Write('a2 LIST "" "*"' + "`r`n"); $Writer.Flush()
    $list = Read-DEImapResponse -Reader $Reader -Tag 'a2'
    $folders = New-Object System.Collections.Generic.List[object]
    foreach ($l in $list.lines) {
        if ($l -notmatch '^\* LIST \(([^)]*)\) (?:"[^"]*"|NIL) (.+)$') { continue }
        $flags = $Matches[1]; $raw = $Matches[2].Trim(); if ($raw.StartsWith('"')) { $raw = $raw.Substring(1, $raw.Length - 2) -replace '\\"', '"' -replace '\\\\', '\' }
        $folders.Add([pscustomobject]@{ name = (ConvertFrom-DEImapUtf7 $raw); raw = $raw; flags = $flags; selectable = ($flags -notmatch '\\Noselect'); messages = $null })
    }
    $t = 3
    foreach ($f in @($folders | Where-Object { $_.selectable })) {
        $tag = "a$t"; $t++
        $Writer.Write("$tag STATUS $(ConvertTo-DEImapQuoted $f.raw) (MESSAGES)" + "`r`n"); $Writer.Flush()
        $st = Read-DEImapResponse -Reader $Reader -Tag $tag
        $m = @($st.lines | Where-Object { $_ -match 'MESSAGES (\d+)' } | Select-Object -First 1)
        if ($m.Count -and $m[0] -match 'MESSAGES (\d+)') { $f.messages = [int]$Matches[1] }
    }
    $storageKB = $null; $limitKB = $null
    $tag = "a$t"; $t++
    $Writer.Write("$tag GETQUOTAROOT INBOX" + "`r`n"); $Writer.Flush()
    $q = Read-DEImapResponse -Reader $Reader -Tag $tag
    foreach ($l in $q.lines) { if ($l -match 'STORAGE (\d+) (\d+)') { $storageKB = [long]$Matches[1]; $limitKB = [long]$Matches[2] } }
    $Writer.Write("a$t LOGOUT" + "`r`n"); $Writer.Flush()
    $all = @($folders | Where-Object { $_.flags -match '\\All' }) | Select-Object -First 1
    return [pscustomobject]@{ loginOk = $true; reason = ''; folders = $folders.ToArray(); allMailCount = $(if ($all) { $all.messages } else { $null }); storageKB = $storageKB; limitKB = $limitKB }
}
function Test-DEGmailImapAccess {
    <#
        Preflight for one Gmail mailbox: signs in to imap.gmail.com:993 over TLS with the app password (runtime only),
        lists every folder with its message count and the mailbox size, then signs out. Nothing about the credential
        is kept. With -ProjectId the counts (never the credential) are recorded against the user, so the migration can
        be compared with the source afterwards.
    #>
    [CmdletBinding()]
    param([Parameter(Mandatory = $true)][pscredential]$Credential, [string]$ProjectId, [string]$Server = 'imap.gmail.com', [int]$Port = 993, [int]$TimeoutSeconds = 30)
    $tcp = New-Object Net.Sockets.TcpClient
    $ssl = $null
    try {
        $iar = $tcp.BeginConnect($Server, $Port, $null, $null)
        if (-not $iar.AsyncWaitHandle.WaitOne($TimeoutSeconds * 1000)) { throw "no answer from ${Server}:$Port within $TimeoutSeconds s (firewall or proxy?)" }
        $tcp.EndConnect($iar)
        $ssl = New-Object Net.Security.SslStream($tcp.GetStream(), $false)
        $ssl.ReadTimeout = $TimeoutSeconds * 1000; $ssl.WriteTimeout = $TimeoutSeconds * 1000
        $ssl.AuthenticateAsClient($Server, $null, [Security.Authentication.SslProtocols]::Tls12, $true)
        $enc = New-Object Text.UTF8Encoding $false
        $reader = New-Object IO.StreamReader($ssl, $enc); $writer = New-Object IO.StreamWriter($ssl, $enc); $writer.NewLine = "`r`n"
        $r = Invoke-DEImapConversation -Reader $reader -Writer $writer -Credential $Credential
    } catch { $r = [pscustomobject]@{ loginOk = $false; reason = "IMAP connection failed: $($_.Exception.Message)"; folders = @() } }
    finally { if ($ssl) { $ssl.Dispose() }; $tcp.Close() }
    $address = $Credential.UserName
    $summary = [pscustomobject][ordered]@{ at = (Get-Date).ToUniversalTime().ToString('o'); ok = [bool]$r.loginOk; reason = $r.reason; folders = @($r.folders | Where-Object { $_.selectable } | ForEach-Object { [pscustomobject]@{ name = $_.name; messages = $_.messages } }); allMailCount = $r.allMailCount; storageKB = $r.storageKB }
    if ($ProjectId) { $p = Get-DEMigrationProject -ProjectId $ProjectId; $u = Get-DEMigrationUser -Project $p -SourceAddress $address; $u.preflight = $summary; if ($r.loginOk) { Set-DEMigrationStage -Project $p -Stage 'Preflight' }; $null = Save-DEMigrationProject -Project $p -Entry "IMAP preflight $address : $(if ($r.loginOk) { "ok, $($summary.folders.Count) folders, All Mail $($r.allMailCount), $([math]::Round([double]$r.storageKB / 1024, 1)) MB" } else { $r.reason })" }
    $sizeNote = $(if ($r.storageKB) { "; $([math]::Round($r.storageKB / 1048576.0, 2)) GB used" } else { '' })
    return (New-DEResult -Operation 'Test-DEGmailImapAccess' -Status $(if ($r.loginOk) { 'Succeeded' } else { 'Failed' }) -Target $address -Message $(if ($r.loginOk) { "signed in; $($summary.folders.Count) folder(s); All Mail holds $($r.allMailCount) message(s)$sizeNote" } else { $r.reason }) -Data $summary)
}

# ============================================================ shared mailbox
function Test-DEMigrationSharedMailbox {
    <#
        Proves a shared mailbox is right: it exists as a SharedMailbox, every member has Full Access and Send As, and its
        own Entra account cannot sign in (nobody gets a shared-mailbox password). Records the result on the project's
        'Shared mailbox' check.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Address, [Parameter(Mandatory = $true)][string[]]$Members)
    Assert-DECommand 'Get-EXOMailbox' 'ExchangeOnlineManagement'
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $problems = @(); $mb = $null
    try { $mb = Get-EXOMailbox -Identity $Address -Properties RecipientTypeDetails, ExternalDirectoryObjectId -ErrorAction Stop } catch { $problems += "no mailbox $Address" }
    if ($mb) {
        if ("$($mb.RecipientTypeDetails)" -ne 'SharedMailbox') { $problems += "$Address is a $($mb.RecipientTypeDetails), not a shared mailbox" }
        Assert-DECommand 'Get-EXOMailboxPermission' 'ExchangeOnlineManagement'; Assert-DECommand 'Get-EXORecipientPermission' 'ExchangeOnlineManagement'
        $full = @(Get-EXOMailboxPermission -Identity $Address -ErrorAction Stop | Where-Object { "$($_.AccessRights)" -match 'FullAccess' -and -not $_.Deny } | ForEach-Object { "$($_.User)".ToLowerInvariant() })
        $sendAs = @(Get-EXORecipientPermission -Identity $Address -ErrorAction Stop | Where-Object { "$($_.AccessRights)" -match 'SendAs' -and "$($_.AccessControlType)" -ne 'Deny' } | ForEach-Object { "$($_.Trustee)".ToLowerInvariant() })
        foreach ($m in $Members) { $k = $m.ToLowerInvariant(); if ($full -notcontains $k) { $problems += "$m has no Full Access" }; if ($sendAs -notcontains $k) { $problems += "$m has no Send As" } }
        if ("$($mb.ExternalDirectoryObjectId)") { try { $acct = Invoke-DEGraphRequest -Uri ('users/{0}?$select=accountEnabled' -f $mb.ExternalDirectoryObjectId); if ($acct.accountEnabled) { $problems += "the shared mailbox's own account can sign in (block it: Set-DEUserAccountState -UserId $Address -Enabled `$false)" } } catch { $problems += "sign-in state of $Address not read: $($_.Exception.Message)" } }
    }
    $ok = (-not $problems.Count)
    $rec = [pscustomobject]@{ address = $Address.ToLowerInvariant(); members = @($Members | ForEach-Object { $_.ToLowerInvariant() }); verified = $ok; problems = $problems; checkedAt = (Get-Date).ToUniversalTime().ToString('o') }
    $p.sharedMailboxes = @(@($p.sharedMailboxes | Where-Object { "$($_.address)" -ine $Address }) + @($rec))
    $allOk = -not @($p.sharedMailboxes | Where-Object { -not $_.verified }).Count
    Set-DEMigrationCheckValue -Project $p -Check 'Shared mailbox' -Status $(if ($allOk) { 'Pass' } else { 'Fail' }) -Detail $(if ($allOk) { "verified: $(@($p.sharedMailboxes | ForEach-Object { $_.address }) -join ', ')" } else { ($problems -join '; ') })
    $null = Save-DEMigrationProject -Project $p -Entry "shared mailbox $Address : $(if ($ok) { 'verified' } else { $problems -join '; ' })"
    return (New-DEResult -Operation 'Test-DEMigrationSharedMailbox' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $Address -Message $(if ($ok) { "shared mailbox, $($Members.Count) member(s) with Full Access and Send As, its own sign-in blocked" } else { $problems -join '; ' }) -Data $rec)
}
function Set-DEMigrationSharedMailbox {
    <#
        Makes the project's shared mailbox exactly right and proves it: creates it if missing, grants each member Full
        Access and Send As (idempotent), blocks the mailbox account's own sign-in, then runs Test-DEMigrationSharedMailbox.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Address, [Parameter(Mandatory = $true)][string]$DisplayName, [Parameter(Mandatory = $true)][string[]]$Members, [switch]$DryRun)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    if (($Address -split '@')[1] -ine $p.targetDomain) { return (New-DEResult -Operation 'Set-DEMigrationSharedMailbox' -Status Refused -Target $Address -Message "$Address is not on the project domain $($p.targetDomain)") }
    Assert-DECommand 'Get-EXORecipient' 'ExchangeOnlineManagement'
    $steps = @()
    $exists = @(Get-EXORecipient -Identity $Address -ErrorAction SilentlyContinue)
    if (-not $exists.Count) { $steps += "create shared mailbox $Address" }
    foreach ($m in $Members) { $steps += "Full Access + Send As for $m" }
    $steps += 'block the mailbox account sign-in'
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Address, ($steps -join '; '))) { return (New-DEResult -Operation 'Set-DEMigrationSharedMailbox' -Status DryRun -Target $Address -Message "no change applied ($($steps -join '; '))") }
    if (-not $exists.Count) { $c = New-DESharedMailbox -DisplayName $DisplayName -Alias (($Address -split '@')[0] -replace '[^A-Za-z0-9._-]', '') -PrimarySmtpAddress $Address -Confirm:$false; if ($c.status -notin @('Succeeded')) { return $c } }
    Assert-DECommand 'Get-EXOMailboxPermission' 'ExchangeOnlineManagement'; Assert-DECommand 'Get-EXORecipientPermission' 'ExchangeOnlineManagement'
    $full = @(Get-EXOMailboxPermission -Identity $Address -ErrorAction SilentlyContinue | Where-Object { "$($_.AccessRights)" -match 'FullAccess' } | ForEach-Object { "$($_.User)".ToLowerInvariant() })
    $sendAs = @(Get-EXORecipientPermission -Identity $Address -ErrorAction SilentlyContinue | Where-Object { "$($_.AccessRights)" -match 'SendAs' } | ForEach-Object { "$($_.Trustee)".ToLowerInvariant() })
    foreach ($m in $Members) {
        if ($full -notcontains $m.ToLowerInvariant()) { $null = Set-DEMailboxPermission -MailboxId $Address -MemberId $m -Permission FullAccess -Confirm:$false }
        if ($sendAs -notcontains $m.ToLowerInvariant()) { $null = Set-DEMailboxPermission -MailboxId $Address -MemberId $m -Permission SendAs -Confirm:$false }
    }
    $mb = Get-EXOMailbox -Identity $Address -Properties ExternalDirectoryObjectId -ErrorAction Stop
    if ("$($mb.ExternalDirectoryObjectId)") { $null = Set-DEUserAccountState -UserId "$($mb.ExternalDirectoryObjectId)" -Enabled $false -Confirm:$false }
    return (Test-DEMigrationSharedMailbox -ProjectId $ProjectId -Address $Address -Members $Members)
}

# ============================================================ Exchange Online IMAP batches
function Get-DEMigrationEndpoint {
    <# The project's IMAP endpoint in Exchange Online (imap.gmail.com:993 SSL), created once after Exchange confirms it can reach Gmail. #>
    param([string]$Name = 'DE-Gmail-IMAP', [string]$Server = 'imap.gmail.com', [int]$Port = 993)
    Assert-DECommand 'Get-MigrationEndpoint' 'ExchangeOnlineManagement'
    $e = @(Get-MigrationEndpoint -Identity $Name -ErrorAction SilentlyContinue)
    if ($e.Count) { return $e[0] }
    $t = Test-MigrationServerAvailability -IMAP -RemoteServer $Server -Port $Port -Security Ssl -ErrorAction Stop
    if ("$($t.Result)" -ne 'Success') { throw "Exchange Online cannot reach ${Server}:$Port ($($t.Result): $($t.Message))" }
    return (New-MigrationEndpoint -IMAP -Name $Name -RemoteServer $Server -Port $Port -Security Ssl -ErrorAction Stop)
}
function ConvertTo-DECsvField { param([AllowEmptyString()][string]$Value) if ($Value -match '[",\r\n]') { return '"' + $Value.Replace('"', '""') + '"' }; return $Value }
function New-DEMigrationBatch {
    <#
        Starts an Exchange Online IMAP migration batch for mapped users. -Credential is one PSCredential per Gmail
        address (user name = the Gmail address, password = its app password); nothing else carries a password.

        Gates, in the standard's order:
          * every user is mapped, its destination is a licensed user mailbox, and its IMAP preflight passed (run now
            unless -SkipPreflight, which still needs a recorded passing preflight);
          * a Production batch needs a Pilot batch that finished with no failures and was confirmed by a technician
            (Confirm-DEMigrationPilot);
          * one user is never in two batches.
        The CSV Exchange requires (EmailAddress,UserName,Password) is built in memory, passed as bytes and wiped; the
        project records the batch, never the CSV. Gmail's Spam, Trash, Important and Starred are excluded by default;
        All Mail is kept because archived mail lives only there (the price is duplicates of labelled mail).
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param(
        [Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][ValidateSet('Pilot', 'Production')][string]$Type,
        [Parameter(Mandatory = $true)][pscredential[]]$Credential, [string[]]$ExcludeFolders = $script:GmailExcludeDefault, [string[]]$NotificationEmails = @(), [switch]$SkipPreflight, [switch]$DryRun
    )
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    if ($p.mailPath -ne 'IMAP') { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message 'this project is a Google Workspace migration, not IMAP') }
    $addresses = @($Credential | ForEach-Object { $_.UserName.ToLowerInvariant() })
    if (@($addresses | Select-Object -Unique).Count -ne $addresses.Count) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message 'the same address is listed twice') }
    if ($Type -eq 'Pilot' -and $addresses.Count -ne 1) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message 'a pilot is one mailbox') }
    if ($Type -eq 'Production') {
        $pilot = @($p.batches | Where-Object { $_.type -eq 'Pilot' -and $_.confirmedBy })
        if (-not $pilot.Count) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message 'no confirmed pilot yet: migrate one mailbox as a Pilot, check it in Outlook, then Confirm-DEMigrationPilot') }
    }
    $problems = @()
    foreach ($a in $addresses) {
        $u = @($p.users | Where-Object { "$($_.source)" -eq $a })
        if (-not $u.Count) { $problems += "$a is not mapped (Add-DEMigrationUser)"; continue }
        if (-not $u[0].destinationReady) { $problems += "$a -> $($u[0].destination) is not ready ($(@($u[0].destinationIssues) -join '; '))" }
        if ($u[0].batch) { $problems += "$a is already in batch $($u[0].batch)" }
        if ($SkipPreflight -and -not ($u[0].preflight -and $u[0].preflight.ok)) { $problems += "$a has no passing IMAP preflight on record" }
    }
    if ($problems.Count) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message ($problems -join '; ')) }
    if (-not $SkipPreflight) {
        foreach ($c in $Credential) { $t = Test-DEGmailImapAccess -Credential $c -ProjectId $ProjectId; if ($t.status -ne 'Succeeded') { $problems += "$($c.UserName): $($t.message)" } }
        if ($problems.Count) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status Refused -Target $ProjectId -Message "IMAP preflight failed: $($problems -join '; ')") }
        $p = Get-DEMigrationProject -ProjectId $ProjectId
    }
    $name = '{0}-{1}-{2}' -f $p.projectId, $Type.ToLowerInvariant(), (Get-Date -Format 'yyyyMMddHHmm'); if ($name.Length -gt 64) { $name = $name.Substring($name.Length - 64) }
    $plan = [pscustomobject]@{ batch = $name; type = $Type; users = $addresses; excludeFolders = $ExcludeFolders }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess("$($addresses -join ', ')", "start $Type IMAP migration batch $name")) { return (New-DEResult -Operation 'New-DEMigrationBatch' -Status DryRun -Target $ProjectId -Message 'no change applied' -Data $plan) }
    $ep = Get-DEMigrationEndpoint
    $sb = New-Object Text.StringBuilder; [void]$sb.Append("EmailAddress,UserName,Password`r`n")
    $bytes = $null
    try {
        foreach ($c in $Credential) { $u = @($p.users | Where-Object { "$($_.source)" -eq $c.UserName.ToLowerInvariant() })[0]; [void]$sb.Append((ConvertTo-DECsvField $u.destination) + ',' + (ConvertTo-DECsvField $c.UserName) + ',' + (ConvertTo-DECsvField ($c.GetNetworkCredential().Password -replace '\s', '')) + "`r`n") }
        $bytes = (New-Object Text.UTF8Encoding $false).GetBytes($sb.ToString())
        $bp = @{ Name = $name; SourceEndpoint = "$($ep.Identity)"; CSVData = $bytes; AutoStart = $true; ErrorAction = 'Stop' }
        if (@($ExcludeFolders | Where-Object { $_ }).Count) { $bp.ExcludeFolders = @($ExcludeFolders | Where-Object { $_ }) }
        if ($NotificationEmails.Count) { $bp.NotificationEmails = $NotificationEmails }
        $null = New-MigrationBatch @bp
    } finally { if ($bytes) { [Array]::Clear($bytes, 0, $bytes.Length) }; [void]$sb.Clear() }
    $rec = [pscustomobject]@{ name = $name; type = $Type; users = $addresses; excludeFolders = @($ExcludeFolders); startedAt = (Get-Date).ToUniversalTime().ToString('o'); status = 'Syncing'; completedAt = $null; confirmedBy = $null; confirmedAt = $null; failed = 0 }
    $p.batches = @(@($p.batches) + @($rec))
    foreach ($u in @($p.users | Where-Object { $addresses -contains "$($_.source)" })) { $u.batch = $name }
    Set-DEMigrationStage -Project $p -Stage $(if ($Type -eq 'Pilot') { 'Pilot' } else { 'Batches' })
    $null = Save-DEMigrationProject -Project $p -Entry "$Type batch $name started for $($addresses -join ', ')"
    return (New-DEResult -Operation 'New-DEMigrationBatch' -Target $name -Message "$Type batch started for $($addresses.Count) mailbox(es); follow it with Get-DEMigrationStatus -ProjectId $ProjectId" -Data $rec)
}
function Get-DEMigrationStatus {
    <#
        Reads every batch and user from Exchange Online (status, synced, skipped and total items, errors), stores the
        numbers on the project and sets the 'Folders' check: Pass when every mapped mailbox is Synced or Completed with
        no error, Fail when any failed.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId)
    Assert-DECommand 'Get-MigrationBatch' 'ExchangeOnlineManagement'
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $rows = @()
    foreach ($b in @($p.batches)) {
        $mb = $null; try { $mb = Get-MigrationBatch -Identity $b.name -ErrorAction Stop } catch { $b.status = 'Missing'; continue }
        $b.status = "$($mb.Status)"; if ("$($mb.Status)" -eq 'Completed' -and -not $b.completedAt) { $b.completedAt = (Get-Date).ToUniversalTime().ToString('o') }
        $failed = 0
        foreach ($mu in @(Get-MigrationUser -BatchId $b.name -ErrorAction SilentlyContinue)) {
            $addr = "$($mu.Identity)".ToLowerInvariant()
            $st = $null; try { $st = Get-MigrationUserStatistics -Identity $mu.Identity -ErrorAction Stop } catch { $st = $null }
            $row = [pscustomobject][ordered]@{ destination = $addr; status = "$($mu.Status)"; synced = $(if ($st) { [long]$st.SyncedItemCount } else { $null }); skipped = $(if ($st) { [long]$st.SkippedItemCount } else { $null }); sourceTotal = $(if ($st -and $st.PSObject.Properties['TotalItemsInSourceMailboxCount']) { $st.TotalItemsInSourceMailboxCount } else { $null }); error = $(if ($st -and "$($st.Error)") { "$($st.Error)" } elseif ("$($mu.ErrorSummary)") { "$($mu.ErrorSummary)" } else { '' }); at = (Get-Date).ToUniversalTime().ToString('o') }
            if ($row.status -match 'Failed') { $failed++ }
            $u = @($p.users | Where-Object { "$($_.destination)" -eq $addr }); if ($u.Count) { $u[0].migration = $row }
            $rows += $row
        }
        $b.failed = $failed
    }
    $users = @($p.users | Where-Object { $_.batch })
    $bad = @($users | Where-Object { $_.migration -and ("$($_.migration.status)" -match 'Failed' -or "$($_.migration.error)") })
    $done = @($users | Where-Object { $_.migration -and "$($_.migration.status)" -match '^(Synced|Completed)$' -and -not "$($_.migration.error)" })
    $allMapped = @($p.users).Count
    if ($bad.Count) { Set-DEMigrationCheckValue -Project $p -Check 'Folders' -Status Fail -Detail (($bad | ForEach-Object { "$($_.destination): $($_.migration.status) $($_.migration.error)" }) -join '; ') }
    elseif ($allMapped -and $done.Count -eq $allMapped) { Set-DEMigrationCheckValue -Project $p -Check 'Folders' -Status Pass -Detail (($done | ForEach-Object { "$($_.destination): $($_.migration.synced) synced, $($_.migration.skipped) skipped" }) -join '; ') }
    $null = Save-DEMigrationProject -Project $p
    return (New-DEResult -Operation 'Get-DEMigrationStatus' -Status $(if ($bad.Count) { 'Partial' } else { 'Succeeded' }) -Target $ProjectId -Message "$($done.Count) of $allMapped mailbox(es) synced; $($bad.Count) with errors; stage $($p.stage)" -Data $rows)
}
function Confirm-DEMigrationPilot {
    <# A technician confirms the pilot mailbox opened in Outlook with its folders and recent mail; Production batches wait for this. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Technician, [Parameter(Mandatory = $true)][string]$Note)
    $null = Get-DEMigrationStatus -ProjectId $ProjectId
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $pilot = @($p.batches | Where-Object { $_.type -eq 'Pilot' } | Select-Object -Last 1)
    if (-not $pilot.Count) { return (New-DEResult -Operation 'Confirm-DEMigrationPilot' -Status Refused -Target $ProjectId -Message 'no pilot batch yet') }
    $b = $pilot[0]
    if ($b.status -notmatch '^(Synced|Completed)$' -or [int]$b.failed -gt 0) { return (New-DEResult -Operation 'Confirm-DEMigrationPilot' -Status Refused -Target $b.name -Message "pilot is $($b.status) with $($b.failed) failure(s); it must finish its first sync cleanly") }
    if (-not $PSCmdlet.ShouldProcess($b.name, "confirm pilot as $Technician")) { return (New-DEResult -Operation 'Confirm-DEMigrationPilot' -Status DryRun -Target $b.name -Message 'no change applied') }
    $b.confirmedBy = $Technician; $b.confirmedAt = (Get-Date).ToUniversalTime().ToString('o'); $b | Add-Member -NotePropertyName note -NotePropertyValue $Note -Force
    $null = Save-DEMigrationProject -Project $p -Entry "pilot $($b.name) confirmed by $Technician : $Note"
    return (New-DEResult -Operation 'Confirm-DEMigrationPilot' -Target $b.name -Message "pilot confirmed by $Technician; Production batches can start" -Data $b)
}
function Complete-DEMigrationBatch {
    <#
        The final delta: one more incremental sync, then Exchange completes the batch (stops syncing from Gmail).
        Refused until the project's DNS check shows mail arriving at Microsoft 365 (Test-DEMigrationDns), so nothing
        sent to the old path is left behind.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$BatchName, [switch]$DryRun)
    Assert-DECommand 'Get-MigrationBatch' 'ExchangeOnlineManagement'
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $b = @($p.batches | Where-Object { $_.name -eq $BatchName }); if (-not $b.Count) { return (New-DEResult -Operation 'Complete-DEMigrationBatch' -Status Refused -Target $BatchName -Message "no batch $BatchName in project $ProjectId") }
    if (-not ($p.dns -and $p.dns.mxOk)) { return (New-DEResult -Operation 'Complete-DEMigrationBatch' -Status Refused -Target $BatchName -Message 'the domain MX does not point to Microsoft 365 yet (Test-DEMigrationDns): cut DNS over first, then run the final delta') }
    $mb = Get-MigrationBatch -Identity $BatchName -ErrorAction Stop
    if ("$($mb.Status)" -eq 'Completed') { return (New-DEResult -Operation 'Complete-DEMigrationBatch' -Target $BatchName -Message 'already completed; nothing changed') }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($BatchName, 'final incremental sync, then complete the batch (stops syncing from Gmail)')) { return (New-DEResult -Operation 'Complete-DEMigrationBatch' -Status DryRun -Target $BatchName -Message 'no change applied') }
    if ("$($mb.Status)" -match 'Stopped|Failed') { Start-MigrationBatch -Identity $BatchName -ErrorAction Stop }
    Complete-MigrationBatch -Identity $BatchName -Confirm:$false -ErrorAction Stop
    $b[0].status = 'Completing'
    Set-DEMigrationStage -Project $p -Stage 'FinalDelta'
    $null = Save-DEMigrationProject -Project $p -Entry "final delta and completion started for $BatchName"
    return (New-DEResult -Operation 'Complete-DEMigrationBatch' -Target $BatchName -Message 'final sync and completion started; Get-DEMigrationStatus shows Completed when Exchange finishes' -Data $b[0])
}

# ============================================================ contacts (Google Contacts CSV -> Outlook contacts)
function ConvertFrom-DEGoogleContactRow {
    <#
        One row of a Google Contacts export ("Google CSV", both the current 'First Name / E-mail 1 - Value' headers and
        the older 'Given Name / Organization 1 - Name' ones) as a Graph contact. Several values in one cell (' ::: ')
        are split. Returns $null for a row with no name, email or phone.
    #>
    param([Parameter(Mandatory = $true)]$Row)
    $get = { param([string[]]$Names) foreach ($n in $Names) { $pp = $Row.PSObject.Properties[$n]; if ($pp -and "$($pp.Value)".Trim()) { return "$($pp.Value)".Trim() } }; return '' }
    $split = { param([string]$v) @($v -split '\s*:::\s*' | Where-Object { $_ }) }
    $c = [ordered]@{}
    $given = & $get @('First Name', 'Given Name'); $middle = & $get @('Middle Name', 'Additional Name'); $family = & $get @('Last Name', 'Family Name')
    if ($given) { $c.givenName = $given }; if ($middle) { $c.middleName = $middle }; if ($family) { $c.surname = $family }
    $nick = & $get @('Nickname'); if ($nick) { $c.nickName = $nick }
    $org = & $get @('Organization Name', 'Organization 1 - Name'); $title = & $get @('Organization Title', 'Organization 1 - Title'); $dept = & $get @('Organization Department', 'Organization 1 - Department')
    if ($org) { $c.companyName = $org }; if ($title) { $c.jobTitle = $title }; if ($dept) { $c.department = $dept }
    $full = & $get @('Name', 'File As'); $display = $(if ($full) { $full } else { (@($given, $middle, $family) | Where-Object { $_ }) -join ' ' }); if (-not $display) { $display = $org }
    $emails = @(); $mobile = ''; $business = @(); $homePhones = @()
    for ($i = 1; $i -le 10; $i++) {
        foreach ($e in (& $split (& $get @("E-mail $i - Value")))) { if ($e -match '@' -and $emails.Count -lt 3 -and @($emails | Where-Object { $_.address -ieq $e }).Count -eq 0) { $emails += [ordered]@{ address = $e; name = $(if ($display) { $display } else { $e }) } } }
        $label = (& $get @("Phone $i - Label", "Phone $i - Type")).ToLowerInvariant()
        foreach ($ph in (& $split (& $get @("Phone $i - Value")))) {
            if ($label -match 'mobile|cell' -and -not $mobile) { $mobile = $ph } elseif ($label -match 'home') { $homePhones += $ph } elseif ($label -match 'work|business|main') { $business += $ph } elseif (-not $mobile) { $mobile = $ph } else { $business += $ph }
        }
    }
    if (-not $display) { $display = $(if ($emails.Count) { $emails[0].address } elseif ($mobile) { $mobile } else { '' }) }
    if (-not $display -and -not $emails.Count -and -not $mobile -and -not $business.Count -and -not $homePhones.Count) { return $null }
    $c.displayName = $display
    if ($emails.Count) { $c.emailAddresses = $emails }
    if ($mobile) { $c.mobilePhone = $mobile }; if ($business.Count) { $c.businessPhones = @($business | Select-Object -First 2) }; if ($homePhones.Count) { $c.homePhones = @($homePhones | Select-Object -First 2) }
    for ($i = 1; $i -le 3; $i++) {
        $street = & $get @("Address $i - Street"); $city = & $get @("Address $i - City"); $region = & $get @("Address $i - Region"); $zip = & $get @("Address $i - Postal Code"); $country = & $get @("Address $i - Country")
        if (-not ($street -or $city -or $zip)) { continue }
        $addr = [ordered]@{ street = $street; city = $city; state = $region; postalCode = $zip; countryOrRegion = $country }
        $label = (& $get @("Address $i - Label", "Address $i - Type")).ToLowerInvariant()
        if ($label -match 'work|business') { if (-not $c.Contains('businessAddress')) { $c.businessAddress = $addr } } elseif (-not $c.Contains('homeAddress')) { $c.homeAddress = $addr }
    }
    $site = & $get @('Website 1 - Value'); if ($site) { $c.businessHomePage = ((& $split $site) | Select-Object -First 1) }
    $notes = & $get @('Notes'); if ($notes) { $c.personalNotes = $notes }
    $bday = & $get @('Birthday'); $d = [datetime]::MinValue
    if ($bday -and [datetime]::TryParseExact($bday, [string[]]@('yyyy-MM-dd', 'MM/dd/yyyy', 'M/d/yyyy', '--MM-dd'), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::None, [ref]$d)) { $c.birthday = $d.ToString('yyyy-MM-dd') + 'T11:59:00Z' }
    return $c
}
function Import-DEMigrationContacts {
    <#
        Imports a Google Contacts export (contacts.google.com > Export > Google CSV) into the destination mailbox's
        Outlook contacts through Graph. Contacts already there (same email, or same name with no email) are skipped, so
        a rerun adds nothing twice. Needs Contacts.ReadWrite: delegated for your own mailbox, application permission (the
        app-only worker) for someone else's. Sets the project's 'Contacts' check when every mapped user is done.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$SourceAddress, [Parameter(Mandatory = $true)][string]$Path, [switch]$DryRun)
    if (-not (Test-Path -LiteralPath $Path)) { throw "no file $Path" }
    $p = Get-DEMigrationProject -ProjectId $ProjectId; $u = Get-DEMigrationUser -Project $p -SourceAddress $SourceAddress
    $rows = @(Import-Csv -LiteralPath $Path -Encoding UTF8)
    if ($rows.Count -and -not @($rows[0].PSObject.Properties | Where-Object { $_.Name -match '^(First Name|Given Name|Name|E-mail 1 - Value)$' }).Count) { return (New-DEResult -Operation 'Import-DEMigrationContacts' -Status Refused -Target $SourceAddress -Message "$Path is not a Google Contacts CSV (export as 'Google CSV')") }
    $want = @($rows | ForEach-Object { ConvertFrom-DEGoogleContactRow -Row $_ } | Where-Object { $_ })
    $uid = [uri]::EscapeDataString("$($u.userId)")
    $existing = @(Invoke-DEGraphRequest -Uri "users/$uid/contacts?`$select=displayName,emailAddresses&`$top=999" -All)
    $known = @{}; foreach ($e in $existing) { foreach ($a in @($e.emailAddresses)) { if ($a.address) { $known["e:$("$($a.address)".ToLowerInvariant())"] = $true } }; if ($e.displayName) { $known["n:$("$($e.displayName)".ToLowerInvariant())"] = $true } }
    $new = @(); $dupes = 0
    foreach ($c in $want) {
        $keys = @(@($c['emailAddresses']) | Where-Object { $_ } | ForEach-Object { "e:$("$($_.address)".ToLowerInvariant())" })
        if (-not $keys.Count) { $keys = @("n:$("$($c.displayName)".ToLowerInvariant())") }
        if (@($keys | Where-Object { $known.ContainsKey($_) }).Count) { $dupes++; continue }
        foreach ($k in $keys) { $known[$k] = $true }; $new += , $c
    }
    $hash = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($u.destination, "import $($new.Count) contact(s) ($dupes already there)")) { return (New-DEResult -Operation 'Import-DEMigrationContacts' -Status DryRun -Target $u.destination -Message "no change applied: $($rows.Count) row(s), $($new.Count) to import, $dupes already there, $($rows.Count - $want.Count) empty") }
    $ok = 0; $failed = @()
    foreach ($c in $new) { try { $null = Invoke-DEGraphRequest -Method POST -Uri "users/$uid/contacts" -Body $c; $ok++ } catch { $failed += "$($c.displayName): $($_.Exception.Message)" } }
    $u.contacts = [pscustomobject]@{ file = (Split-Path -Leaf $Path); sha256 = $hash; rows = $rows.Count; imported = $ok; duplicates = $dupes; empty = ($rows.Count - $want.Count); failed = $failed.Count; errors = @($failed | Select-Object -First 20); at = (Get-Date).ToUniversalTime().ToString('o') }
    $all = @($p.users); $doneAll = -not @($all | Where-Object { -not $_.contacts -or [int]$_.contacts.failed -gt 0 }).Count
    if ($failed.Count) { Set-DEMigrationCheckValue -Project $p -Check 'Contacts' -Status Fail -Detail "$($u.destination): $($failed.Count) contact(s) failed" }
    elseif ($doneAll) { Set-DEMigrationCheckValue -Project $p -Check 'Contacts' -Status Pass -Detail (($all | ForEach-Object { "$($_.destination): $($_.contacts.imported) imported, $($_.contacts.duplicates) already there" }) -join '; ') }
    Set-DEMigrationStage -Project $p -Stage 'ContactsCalendar'
    $null = Save-DEMigrationProject -Project $p -Entry "contacts for $($u.destination): $ok imported, $dupes already there, $($failed.Count) failed"
    return (New-DEResult -Operation 'Import-DEMigrationContacts' -Status $(if ($failed.Count) { 'Partial' } else { 'Succeeded' }) -Target $u.destination -Message "$ok contact(s) imported, $dupes already there, $($failed.Count) failed" -Data $u.contacts)
}

# ============================================================ calendar (Google Calendar ICS -> Outlook events)
function Read-DEIcsEvents {
    <#
        VEVENTs from an ICS file (Google Calendar > Settings > Import & export > Export): unfolded lines, unescaped
        text, parameters kept. Cancelled events are dropped; moved single occurrences (RECURRENCE-ID) are returned
        separately so they can be reported.
    #>
    param([Parameter(Mandatory = $true)][string]$Path)
    $raw = [IO.File]::ReadAllText($Path, [Text.Encoding]::UTF8) -replace "`r`n", "`n"
    $lines = ($raw -replace "`n[ `t]", '') -split "`n"
    $events = New-Object System.Collections.Generic.List[object]; $cur = $null; $depth = 0
    foreach ($l in $lines) {
        if ($l -eq 'BEGIN:VEVENT') { $cur = @{ props = @{}; exdates = @(); attendees = @() }; $depth = 0; continue }
        if ($null -eq $cur) { continue }
        if ($l -match '^BEGIN:') { $depth++; continue }
        if ($l -match '^END:VEVENT') { $events.Add($cur); $cur = $null; continue }
        if ($l -match '^END:') { $depth--; continue }
        if ($depth -gt 0) { continue }   # VALARM and friends
        if ($l -notmatch '^([A-Za-z-]+)((?:;[^:]*)?):(.*)$') { continue }
        $name = $Matches[1].ToUpperInvariant(); $params = @{}; $value = $Matches[3]
        foreach ($pp in @($Matches[2].TrimStart(';') -split ';' | Where-Object { $_ })) { $kv = $pp -split '=', 2; if ($kv.Count -eq 2) { $params[$kv[0].ToUpperInvariant()] = $kv[1].Trim('"') } }
        if ($name -eq 'EXDATE') { foreach ($x in ($value -split ',')) { $cur.exdates += , @{ value = $x; params = $params } }; continue }
        if ($name -eq 'ATTENDEE') { $who = ($value -replace '^(?i)mailto:', ''); if ($params['CN'] -and $params['CN'] -ne $who) { $who = "$($params['CN']) <$who>" }; $cur.attendees += $who; continue }
        if ($name -in @('SUMMARY', 'DESCRIPTION', 'LOCATION')) { $value = $value -replace '\\[nN]', "`n" -replace '\\,', ',' -replace '\;', ';' -replace '\\\\', '\' }
        $cur.props[$name] = @{ value = $value; params = $params }
    }
    return $events.ToArray()
}
function ConvertFrom-DEIcsDate {
    <# An ICS date or date-time as @{ dateTime = 'yyyy-MM-ddTHH:mm:ss'; timeZone; allDay; date }. #>
    param([Parameter(Mandatory = $true)][string]$Value, [hashtable]$Params = @{})
    $inv = [Globalization.CultureInfo]::InvariantCulture
    if ($Params['VALUE'] -eq 'DATE' -or $Value -match '^\d{8}$') { $d = [datetime]::ParseExact($Value.Substring(0, 8), 'yyyyMMdd', $inv); return @{ dateTime = $d.ToString('yyyy-MM-ddT00:00:00', $inv); timeZone = 'UTC'; allDay = $true; date = $d } }
    $utc = $Value.EndsWith('Z'); $d = [datetime]::ParseExact($Value.TrimEnd('Z'), 'yyyyMMddTHHmmss', $inv)
    $tz = $(if ($utc) { 'UTC' } elseif ($Params['TZID']) { $Params['TZID'] } else { 'UTC' })
    return @{ dateTime = $d.ToString('yyyy-MM-ddTHH:mm:ss', $inv); timeZone = $tz; allDay = $false; date = $d }
}
function ConvertFrom-DEIcsRRule {
    <#
        An RRULE as a Graph patternedRecurrence, or @{ unsupported = reason }. Covers DAILY, WEEKLY (BYDAY), MONTHLY
        (BYMONTHDAY, BYDAY with an ordinal or BYSETPOS), YEARLY (BYMONTH/BYMONTHDAY or ordinal BYDAY), INTERVAL, COUNT
        and UNTIL, which is what Google Calendar writes.
    #>
    param([Parameter(Mandatory = $true)][string]$RRule, [Parameter(Mandatory = $true)][datetime]$Start)
    $r = @{}; foreach ($part in ($RRule -split ';')) { $kv = $part -split '=', 2; if ($kv.Count -eq 2) { $r[$kv[0].ToUpperInvariant()] = $kv[1] } }
    $days = @{ MO = 'monday'; TU = 'tuesday'; WE = 'wednesday'; TH = 'thursday'; FR = 'friday'; SA = 'saturday'; SU = 'sunday' }
    $index = @{ '1' = 'first'; '2' = 'second'; '3' = 'third'; '4' = 'fourth'; '-1' = 'last' }
    foreach ($k in $r.Keys) { if ($k -notin @('FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS', 'WKST')) { return @{ unsupported = "RRULE part $k" } } }
    $interval = $(if ($r['INTERVAL']) { [int]$r['INTERVAL'] } else { 1 })
    $pattern = [ordered]@{ interval = $interval }
    $byday = @(); $ordinal = $null
    if ($r['BYDAY']) { foreach ($d in ($r['BYDAY'] -split ',')) { if ($d -notmatch '^([+-]?\d)?(MO|TU|WE|TH|FR|SA|SU)$') { return @{ unsupported = "BYDAY $d" } }; if ($Matches[1]) { $ordinal = "$([int]$Matches[1])" }; $byday += $days[$Matches[2]] } }
    if ($r['BYSETPOS']) { $ordinal = "$([int]$r['BYSETPOS'])" }
    if ($ordinal -and -not $index.ContainsKey($ordinal)) { return @{ unsupported = "ordinal $ordinal" } }
    switch ($r['FREQ']) {
        'DAILY' { $pattern.type = 'daily' }
        'WEEKLY' { $pattern.type = 'weekly'; $pattern.daysOfWeek = $(if ($byday.Count) { $byday } else { @($Start.DayOfWeek.ToString().ToLowerInvariant()) }); $pattern.firstDayOfWeek = $(if ($r['WKST']) { $days[$r['WKST']] } else { 'sunday' }) }
        'MONTHLY' {
            if ($ordinal -and $byday.Count) { $pattern.type = 'relativeMonthly'; $pattern.daysOfWeek = $byday; $pattern.index = $index[$ordinal] }
            elseif ($r['BYMONTHDAY'] -and $r['BYMONTHDAY'] -notmatch ',|-') { $pattern.type = 'absoluteMonthly'; $pattern.dayOfMonth = [int]$r['BYMONTHDAY'] }
            elseif (-not $r['BYMONTHDAY'] -and -not $byday.Count) { $pattern.type = 'absoluteMonthly'; $pattern.dayOfMonth = $Start.Day }
            else { return @{ unsupported = 'this monthly pattern' } }
        }
        'YEARLY' {
            $month = $(if ($r['BYMONTH']) { [int]$r['BYMONTH'] } else { $Start.Month })
            if ($ordinal -and $byday.Count) { $pattern.type = 'relativeYearly'; $pattern.daysOfWeek = $byday; $pattern.index = $index[$ordinal]; $pattern.month = $month }
            else { $pattern.type = 'absoluteYearly'; $pattern.month = $month; $pattern.dayOfMonth = $(if ($r['BYMONTHDAY']) { [int]$r['BYMONTHDAY'] } else { $Start.Day }) }
        }
        default { return @{ unsupported = "FREQ $($r['FREQ'])" } }
    }
    $range = [ordered]@{ startDate = $Start.ToString('yyyy-MM-dd', [Globalization.CultureInfo]::InvariantCulture) }
    if ($r['COUNT']) { $range.type = 'numbered'; $range.numberOfOccurrences = [int]$r['COUNT'] }
    elseif ($r['UNTIL']) { $range.type = 'endDate'; $range.endDate = [datetime]::ParseExact($r['UNTIL'].Substring(0, 8), 'yyyyMMdd', [Globalization.CultureInfo]::InvariantCulture).ToString('yyyy-MM-dd') }
    else { $range.type = 'noEnd' }
    return @{ pattern = $pattern; range = $range }
}
function Import-DEMigrationCalendar {
    <#
        Imports a Google Calendar export (.ics) into the destination mailbox through Graph. Attendees are written into
        the event notes, never added as attendees, so nobody receives an invitation. Recurring events keep their
        pattern, deleted occurrences (EXDATE) are removed after creation, reminders stay on only for future events, and
        each event carries a transactionId from its UID so a rerun never duplicates. Events with a pattern Outlook
        cannot express, and moved single occurrences, are listed as skipped with the reason. Needs Calendars.ReadWrite.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$SourceAddress, [Parameter(Mandatory = $true)][string]$Path, [string]$CalendarName, [switch]$DryRun)
    if (-not (Test-Path -LiteralPath $Path)) { throw "no file $Path" }
    $p = Get-DEMigrationProject -ProjectId $ProjectId; $u = Get-DEMigrationUser -Project $p -SourceAddress $SourceAddress
    $events = @(Read-DEIcsEvents -Path $Path)
    $uid = [uri]::EscapeDataString("$($u.userId)")
    $now = (Get-Date).ToUniversalTime()
    $plans = @(); $skipped = @()
    foreach ($e in $events) {
        $pr = $e.props
        if ($pr['STATUS'] -and $pr['STATUS'].value -eq 'CANCELLED') { continue }
        $summary = $(if ($pr['SUMMARY']) { $pr['SUMMARY'].value } else { '(no title)' })
        if ($pr['RECURRENCE-ID']) { $skipped += "$summary on $($pr['RECURRENCE-ID'].value): a moved single occurrence (the series is imported; move this one by hand)"; continue }
        if (-not $pr['DTSTART']) { $skipped += "${summary}: no start"; continue }
        $s = ConvertFrom-DEIcsDate -Value $pr['DTSTART'].value -Params $pr['DTSTART'].params
        if ($pr['DTEND']) { $en = ConvertFrom-DEIcsDate -Value $pr['DTEND'].value -Params $pr['DTEND'].params }
        elseif ($pr['DURATION'] -and $pr['DURATION'].value -match '^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$') { $span = New-TimeSpan -Days ([int]$Matches[1] * 7 + [int]$Matches[2]) -Hours ([int]$Matches[3]) -Minutes ([int]$Matches[4]) -Seconds ([int]$Matches[5]); $d2 = $s.date.Add($span); $en = @{ dateTime = $d2.ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture); timeZone = $s.timeZone; allDay = $s.allDay; date = $d2 } }
        else { $d2 = $(if ($s.allDay) { $s.date.AddDays(1) } else { $s.date.AddHours(1) }); $en = @{ dateTime = $d2.ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture); timeZone = $s.timeZone; allDay = $s.allDay; date = $d2 } }
        $notes = @(); if ($pr['DESCRIPTION']) { $notes += $pr['DESCRIPTION'].value }
        if (@($e.attendees).Count) { $notes += 'Attendees (not invited again): ' + (@($e.attendees) -join '; ') }
        $body = [ordered]@{ subject = $summary; start = @{ dateTime = $s.dateTime; timeZone = $s.timeZone }; end = @{ dateTime = $en.dateTime; timeZone = $en.timeZone }; isAllDay = [bool]$s.allDay }
        if ($pr['LOCATION']) { $body.location = @{ displayName = $pr['LOCATION'].value } }
        $recurring = [bool]$pr['RRULE']
        if ($recurring) { $rr = ConvertFrom-DEIcsRRule -RRule $pr['RRULE'].value -Start $s.date; if ($rr['unsupported']) { $skipped += "${summary}: $($rr['unsupported']) has no Outlook equivalent"; continue }; $body.recurrence = @{ pattern = $rr.pattern; range = $rr.range } }
        $future = $recurring -or ($en.date.ToUniversalTime() -gt $now)
        if (-not $future) { $body.isReminderOn = $false }
        if ($pr['TRANSP'] -and $pr['TRANSP'].value -eq 'TRANSPARENT') { $body.showAs = 'free' }
        $notes += 'Imported from Google Calendar by DE.'
        $body.body = @{ contentType = 'text'; content = ($notes -join "`n`n") }
        $key = "$(if ($pr['UID']) { $pr['UID'].value } else { $summary })|$($pr['DTSTART'].value)"
        $sha = [Security.Cryptography.SHA256]::Create(); try { $tid = 'de-ics-' + (-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($key)) | Select-Object -First 16 | ForEach-Object { $_.ToString('x2') })) } finally { $sha.Dispose() }
        $body.transactionId = $tid
        $plans += , @{ body = $body; exdates = @($e.exdates); summary = $summary; tid = $tid }
    }
    $prior = @(); if ($u.calendar -and $u.calendar.transactionIds) { $prior = @($u.calendar.transactionIds) }
    $todo = @($plans | Where-Object { $prior -notcontains $_.tid })
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($u.destination, "import $($todo.Count) event(s)$(if ($CalendarName) { " into calendar '$CalendarName'" })")) { return (New-DEResult -Operation 'Import-DEMigrationCalendar' -Status DryRun -Target $u.destination -Message "no change applied: $($events.Count) event(s) in the file, $($todo.Count) to import, $($plans.Count - $todo.Count) imported before, $($skipped.Count) skipped" -Data ([pscustomobject]@{ skipped = $skipped })) }
    $calPath = "users/$uid/events"
    if ($CalendarName) {
        $cal = @(Invoke-DEGraphRequest -Uri "users/$uid/calendars?`$select=id,name" -All | Where-Object { "$($_.name)" -eq $CalendarName })
        $calId = $(if ($cal.Count) { $cal[0].id } else { (Invoke-DEGraphRequest -Method POST -Uri "users/$uid/calendars" -Body @{ name = $CalendarName }).id })
        $calPath = "users/$uid/calendars/$calId/events"
    }
    $ok = 0; $failed = @(); $done = @($prior); $exRemoved = 0
    foreach ($pl in $todo) {
        try {
            $ev = Invoke-DEGraphRequest -Method POST -Uri $calPath -Body $pl.body; $ok++; $done += $pl.tid
            foreach ($x in $pl.exdates) {
                $xd = ConvertFrom-DEIcsDate -Value $x.value -Params $x.params
                $from = $xd.date.AddDays(-1).ToString('yyyy-MM-ddT00:00:00'); $to = $xd.date.AddDays(2).ToString('yyyy-MM-ddT00:00:00')
                # instances come back in UTC and the EXDATE is in the event's zone: take the occurrence nearest the
                # nominal time, within the widest zone offset (14 h); occurrences a day apart can never both qualify
                $near = $null; $best = [double]::MaxValue
                foreach ($in in @(Invoke-DEGraphRequest -Uri "users/$uid/events/$($ev.id)/instances?startDateTime=$from&endDateTime=$to&`$select=id,start" -All)) {
                    $at = [datetime]::Parse("$($in.start.dateTime)".Substring(0, 19), [Globalization.CultureInfo]::InvariantCulture)
                    $gap = [math]::Abs(($at - $xd.date).TotalHours); if ($gap -le 14 -and $gap -lt $best) { $best = $gap; $near = $in }
                }
                if ($near) { $null = Invoke-DEGraphRequest -Method DELETE -Uri "users/$uid/events/$($near.id)"; $exRemoved++ }
            }
        } catch { $failed += "$($pl.summary): $($_.Exception.Message)" }
    }
    $u.calendar = [pscustomobject]@{ file = (Split-Path -Leaf $Path); sha256 = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant(); events = $events.Count; imported = $ok; importedBefore = ($plans.Count - $todo.Count); deletedOccurrences = $exRemoved; skipped = @($skipped); failed = $failed.Count; errors = @($failed | Select-Object -First 20); transactionIds = @($done); calendar = $(if ($CalendarName) { $CalendarName } else { 'Calendar' }); at = (Get-Date).ToUniversalTime().ToString('o') }
    $all = @($p.users); $doneAll = -not @($all | Where-Object { -not $_.calendar -or [int]$_.calendar.failed -gt 0 }).Count
    if ($failed.Count) { Set-DEMigrationCheckValue -Project $p -Check 'Calendar' -Status Fail -Detail "$($u.destination): $($failed.Count) event(s) failed" }
    elseif ($doneAll) { Set-DEMigrationCheckValue -Project $p -Check 'Calendar' -Status Pass -Detail (($all | ForEach-Object { "$($_.destination): $([int]$_.calendar.imported + [int]$_.calendar.importedBefore) imported, $(@($_.calendar.skipped).Count) skipped" }) -join '; ') }
    Set-DEMigrationStage -Project $p -Stage 'ContactsCalendar'
    $null = Save-DEMigrationProject -Project $p -Entry "calendar for $($u.destination): $ok imported, $($skipped.Count) skipped, $($failed.Count) failed"
    return (New-DEResult -Operation 'Import-DEMigrationCalendar' -Status $(if ($failed.Count) { 'Partial' } else { 'Succeeded' }) -Target $u.destination -Message "$ok event(s) imported, $exRemoved deleted occurrence(s) removed, $($skipped.Count) skipped, $($failed.Count) failed" -Data $u.calendar)
}

# ============================================================ DNS, mail flow, MFA
function Test-DEMigrationDns {
    <#
        Compares the domain's live DNS with the records Microsoft 365 expects for it (Graph serviceConfigurationRecords):
        MX, SPF and autodiscover must match, and any other MX left in place (Google's, say) is a split delivery. DMARC and
        DKIM are reported. Destination mailboxes that still forward are listed. Sets the 'DNS and forwarding' check.
        -Server asks a specific resolver (for example 1.1.1.1) so a stale local cache cannot mislead.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [string]$Server)
    Assert-DECommand 'Resolve-DnsName' 'DnsClient (Windows)'
    $p = Get-DEMigrationProject -ProjectId $ProjectId; $domain = $p.targetDomain
    $expected = @(Invoke-DEGraphRequest -Uri "domains/$([uri]::EscapeDataString($domain))/serviceConfigurationRecords" -All | Where-Object { "$($_.supportedService)" -eq 'Email' })
    $q = { param($name, $type) $a = @{ Name = $name; Type = $type; DnsOnly = $true; ErrorAction = 'SilentlyContinue' }; if ($Server) { $a.Server = $Server }; @(Resolve-DnsName @a | Where-Object { "$($_.Type)" -eq $type -or ($type -eq 'CNAME' -and $_.PSObject.Properties['NameHost']) }) }
    $findings = @()
    $mxLive = @(& $q $domain 'MX' | Where-Object { $_.PSObject.Properties['NameExchange'] } | ForEach-Object { "$($_.NameExchange)".TrimEnd('.').ToLowerInvariant() })
    $mxWant = @($expected | Where-Object { "$($_.recordType)" -eq 'Mx' } | ForEach-Object { "$($_.mailExchange)".TrimEnd('.').ToLowerInvariant() })
    $mxOk = [bool]($mxWant.Count -and @($mxWant | Where-Object { $mxLive -contains $_ }).Count)
    $stray = @($mxLive | Where-Object { $mxWant -notcontains $_ })
    if (-not $mxOk) { $findings += "MX is $(if ($mxLive.Count) { $mxLive -join ', ' } else { 'missing' }); Microsoft 365 expects $($mxWant -join ', ')" }
    if ($stray.Count) { $findings += "other MX still published ($($stray -join ', ')): some senders will deliver there" }
    $txt = @(& $q $domain 'TXT' | ForEach-Object { (@($_.Strings) -join '') })
    $spf = @($txt | Where-Object { $_ -match '^v=spf1' })
    $spfOk = ($spf.Count -eq 1 -and $spf[0] -match 'include:spf\.protection\.outlook\.com')
    if ($spf.Count -gt 1) { $findings += "$($spf.Count) SPF records (only one is allowed; receivers fail all of them)" } elseif (-not $spfOk) { $findings += "SPF $(if ($spf.Count) { "'$($spf[0])'" } else { 'missing' }) does not include spf.protection.outlook.com" }
    $adWant = @($expected | Where-Object { "$($_.recordType)" -eq 'CName' -and "$($_.label)" -like 'autodiscover.*' } | ForEach-Object { "$($_.canonicalName)".TrimEnd('.').ToLowerInvariant() }) | Select-Object -First 1
    $adLive = @(& $q "autodiscover.$domain" 'CNAME' | ForEach-Object { "$($_.NameHost)".TrimEnd('.').ToLowerInvariant() }) | Select-Object -First 1
    $adOk = [bool]($adWant -and $adLive -eq $adWant)
    if (-not $adOk) { $findings += "autodiscover.$domain is $(if ($adLive) { $adLive } else { 'missing' }); Microsoft 365 expects $(if ($adWant) { $adWant } else { 'autodiscover.outlook.com' }) (Outlook setup depends on it)" }
    $dmarc = @(& $q "_dmarc.$domain" 'TXT' | ForEach-Object { (@($_.Strings) -join '') } | Where-Object { $_ -match '^v=DMARC1' }) | Select-Object -First 1
    $dkim = @('selector1', 'selector2' | Where-Object { @(& $q "$_._domainkey.$domain" 'CNAME').Count })
    $notes = @(); if (-not $dmarc) { $notes += 'no DMARC record (add v=DMARC1; p=none to start)' }; if ($dkim.Count -lt 2) { $notes += 'DKIM selector CNAMEs not both published (enable DKIM in Defender once they are)' }
    $forwarding = @()
    if (Get-Command -Name 'Get-EXOMailbox' -ErrorAction SilentlyContinue) { foreach ($u in @($p.users)) { try { $m = Get-EXOMailbox -Identity $u.destination -Properties ForwardingSmtpAddress, ForwardingAddress -ErrorAction Stop; if ("$($m.ForwardingSmtpAddress)$($m.ForwardingAddress)") { $forwarding += "$($u.destination) forwards to $($m.ForwardingSmtpAddress)$($m.ForwardingAddress)" } } catch { $notes += "forwarding of $($u.destination) not read" } } }
    $ok = $mxOk -and $spfOk -and $adOk -and -not $stray.Count
    $p.dns = [pscustomobject][ordered]@{ checkedAt = (Get-Date).ToUniversalTime().ToString('o'); resolver = $(if ($Server) { $Server } else { 'system' }); mxOk = $mxOk; spfOk = $spfOk; autodiscoverOk = $adOk; mx = $mxLive; strayMx = $stray; spf = @($spf); autodiscover = $adLive; dmarc = $dmarc; dkimSelectors = @($dkim); forwarding = $forwarding; findings = $findings; notes = $notes }
    Set-DEMigrationCheckValue -Project $p -Check 'DNS and forwarding' -Status $(if ($ok) { 'Pass' } else { 'Fail' }) -Detail $(if ($ok) { "MX, SPF and autodiscover point to Microsoft 365$(if ($forwarding.Count) { '; forwarding: ' + ($forwarding -join '; ') })" } else { $findings -join '; ' })
    if ($mxOk) { Set-DEMigrationStage -Project $p -Stage 'DnsCutover' }
    $null = Save-DEMigrationProject -Project $p -Entry "DNS check for $domain : $(if ($ok) { 'ready' } else { $findings -join '; ' })"
    return (New-DEResult -Operation 'Test-DEMigrationDns' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $domain -Message $(if ($ok) { "MX, SPF and autodiscover match Microsoft 365$(if ($notes.Count) { '; ' + ($notes -join '; ') })" } else { ($findings + $notes) -join '; ' }) -Data $p.dns)
}
function Test-DEMigrationMailFlow {
    <#
        Message trace for each migrated mailbox over the last -Hours (at most 10 days): delivered inbound mail and
        delivered outbound mail, plus anything that failed. Sets the 'Inbound mail' and 'Outbound mail' checks: Pass only
        when every mailbox has both, which means send a test message each way before running it.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [ValidateRange(1, 240)][int]$Hours = 24)
    $trace = $(if (Get-Command -Name 'Get-MessageTraceV2' -ErrorAction SilentlyContinue) { 'Get-MessageTraceV2' } else { 'Get-MessageTrace' })
    Assert-DECommand $trace 'ExchangeOnlineManagement'
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $end = (Get-Date).ToUniversalTime(); $start = $end.AddHours(-$Hours)
    $rows = @(); $noIn = @(); $noOut = @(); $failedAll = @()
    foreach ($u in @($p.users)) {
        $in = @(& $trace -RecipientAddress $u.destination -StartDate $start -EndDate $end -ErrorAction Stop)
        $out = @(& $trace -SenderAddress $u.destination -StartDate $start -EndDate $end -ErrorAction Stop)
        $inOk = @($in | Where-Object { "$($_.Status)" -eq 'Delivered' }).Count; $outOk = @($out | Where-Object { "$($_.Status)" -match '^(Delivered|Expanded)$' }).Count
        $failed = @(@($in) + @($out) | Where-Object { "$($_.Status)" -match 'Failed|FilteredAsSpam|Quarantined' } | ForEach-Object { "$($_.Received) $($_.SenderAddress) -> $($_.RecipientAddress): $($_.Status) '$($_.Subject)'" })
        if (-not $inOk) { $noIn += $u.destination }; if (-not $outOk) { $noOut += $u.destination }; $failedAll += $failed
        $rows += [pscustomobject]@{ mailbox = $u.destination; inboundDelivered = $inOk; outboundDelivered = $outOk; failed = $failed }
    }
    Set-DEMigrationCheckValue -Project $p -Check 'Inbound mail' -Status $(if ($noIn.Count) { 'Fail' } else { 'Pass' }) -Detail $(if ($noIn.Count) { "no delivered inbound mail in $Hours h for: $($noIn -join ', ')" } else { "every mailbox received mail in the last $Hours h" })
    Set-DEMigrationCheckValue -Project $p -Check 'Outbound mail' -Status $(if ($noOut.Count) { 'Fail' } else { 'Pass' }) -Detail $(if ($noOut.Count) { "no delivered outbound mail in $Hours h from: $($noOut -join ', ')" } else { "every mailbox sent mail in the last $Hours h" })
    Set-DEMigrationStage -Project $p -Stage 'Verification'
    $null = Save-DEMigrationProject -Project $p -Entry "mail flow ($trace, $Hours h): $($p.users.Count - $noIn.Count) receiving, $($p.users.Count - $noOut.Count) sending, $($failedAll.Count) failed message(s)"
    return (New-DEResult -Operation 'Test-DEMigrationMailFlow' -Status $(if ($noIn.Count -or $noOut.Count) { 'Failed' } else { 'Succeeded' }) -Target $ProjectId -Message "$(@($p.users).Count - $noIn.Count) of $(@($p.users).Count) receiving, $(@($p.users).Count - $noOut.Count) sending; $($failedAll.Count) failed or filtered message(s)" -Data $rows)
}
function Test-DEMigrationMfa {
    <# Every migrated user is registered for MFA (userRegistrationDetails). Sets the 'MFA' check. #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $missing = @()
    foreach ($u in @($p.users)) {
        $r = @((Get-DEMfaRegistration -UserPrincipalName $u.destination).data)
        $reg = [bool]($r.Count -and $r[0].mfaRegistered)
        $u.mfa = [pscustomobject]@{ registered = $reg; methods = $(if ($r.Count) { @($r[0].methods) } else { @() }); at = (Get-Date).ToUniversalTime().ToString('o') }
        if (-not $reg) { $missing += $u.destination }
    }
    Set-DEMigrationCheckValue -Project $p -Check 'MFA' -Status $(if ($missing.Count) { 'Fail' } else { 'Pass' }) -Detail $(if ($missing.Count) { "not registered: $($missing -join ', ')" } else { 'every user is registered for MFA' })
    $null = Save-DEMigrationProject -Project $p -Entry "MFA check: $(if ($missing.Count) { "missing for $($missing -join ', ')" } else { 'all registered' })"
    return (New-DEResult -Operation 'Test-DEMigrationMfa' -Status $(if ($missing.Count) { 'Failed' } else { 'Succeeded' }) -Target $ProjectId -Message $(if ($missing.Count) { "not registered for MFA: $($missing -join ', ')" } else { 'every migrated user is registered for MFA' }))
}

# ============================================================ devices and bounces
function Get-DEMailProfileTargets {
    <# The Windows accounts to scan: this account only, or with -AllProfiles every real profile (loaded hives under HKU,
       unloaded ones loaded from NTUSER.DAT and unloaded again by Close-DEMailProfileTargets). #>
    param([switch]$AllProfiles)
    $sid = ''; try { $me = [Security.Principal.WindowsIdentity]::GetCurrent(); if ($me.User) { $sid = $me.User.Value } } catch { }   # not Windows: no SID, no other profiles
    $mine = [pscustomobject]@{ name = $(if ($env:USERNAME) { $env:USERNAME } else { $env:USER }); sid = $sid; root = 'HKCU:'; appData = $env:APPDATA; current = $true }
    if (-not $AllProfiles) { return @{ targets = @($mine); loaded = @(); failed = @() } }
    $real = '^S-1-(5-21-\d+-\d+-\d+-\d+|12-1-\d+-\d+-\d+-\d+)$'
    $targets = @(); $loaded = @(); $failed = @()
    $present = @(Get-ChildItem -Path 'Registry::HKEY_USERS' -ErrorAction SilentlyContinue | ForEach-Object { $_.PSChildName } | Where-Object { $_ -match $real })
    foreach ($pl in @(Get-ChildItem -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList' -ErrorAction SilentlyContinue)) {
        $sid = $pl.PSChildName; if ($sid -notmatch $real) { continue }
        $dir = (Get-ItemProperty -LiteralPath $pl.PSPath -Name 'ProfileImagePath' -ErrorAction SilentlyContinue).ProfileImagePath
        if (-not $dir) { continue }
        $dir = [Environment]::ExpandEnvironmentVariables($dir); $name = Split-Path -Leaf $dir
        $isMe = ($sid -eq $mine.sid)
        if ($isMe) { $root = 'HKCU:' }
        elseif ($present -contains $sid) { $root = "Registry::HKEY_USERS\$sid" }
        else {
            $hive = Join-Path $dir 'NTUSER.DAT'; if (-not (Test-Path -LiteralPath $hive)) { continue }
            $mount = "DE_MIG_$($sid -replace '-', '_')"
            $null = & reg.exe load "HKU\$mount" $hive 2>&1
            if ($LASTEXITCODE -ne 0) { $failed += $name; continue }
            $loaded += $mount; $root = "Registry::HKEY_USERS\$mount"
        }
        $targets += [pscustomobject]@{ name = $name; sid = $sid; root = $root; appData = $(if ($isMe -and $env:APPDATA) { $env:APPDATA } else { Join-Path $dir 'AppData\Roaming' }); current = $isMe }
    }
    return @{ targets = $targets; loaded = $loaded; failed = $failed }
}
function Close-DEMailProfileTargets {
    param([Parameter(Mandatory = $true)]$Targets)
    foreach ($m in @($Targets.loaded)) { for ($i = 0; $i -lt 5; $i++) { [GC]::Collect(); [GC]::WaitForPendingFinalizers(); $null = & reg.exe unload "HKU\$m" 2>&1; if ($LASTEXITCODE -eq 0) { break }; Start-Sleep -Milliseconds 400 } }
}
function Get-DEMailClientInventory {
    <#
        Run on each PC the client uses: every place a Windows account on it still talks to Gmail. Outlook classic
        profiles (IMAP/SMTP servers and addresses), Windows Credential Manager entries, Thunderbird accounts, and
        scheduled tasks whose command lines mention Gmail's servers (scanners, scripts).
          default        this Windows account only (run it as the signed-in user)
          -AllProfiles   every profile on the PC (run elevated, as the technician, SYSTEM or RMM). Credential Manager
                         is encrypted per user, so for the other accounts it is listed as not checked, never as clean.
        With -ProjectId the findings are recorded under this device name. On a client PC without the project, save
        the result with Export-DEResult and record it on the admin PC with Import-DEMailClientInventory.
    #>
    [CmdletBinding()] param([string]$ProjectId, [string]$DeviceName = $env:COMPUTERNAME, [string]$Pattern = 'gmail\.com|googlemail\.com|imap\.gmail|smtp\.gmail', [switch]$AllProfiles)
    $found = New-Object System.Collections.Generic.List[object]
    $notChecked = New-Object System.Collections.Generic.List[string]
    $decode = { param($v) if ($v -is [byte[]]) { ([Text.Encoding]::Unicode.GetString($v)).TrimEnd([char]0) } else { "$v" } }
    $scope = Get-DEMailProfileTargets -AllProfiles:$AllProfiles
    foreach ($f in @($scope.failed)) { $notChecked.Add("$f (its registry hive could not be loaded; it is in use or damaged)") }
    try {
        foreach ($t in @($scope.targets)) {
            foreach ($ver in @('16.0', '15.0')) {
                $root = "$($t.root)\Software\Microsoft\Office\$ver\Outlook\Profiles"
                if (-not (Test-Path -LiteralPath $root)) { continue }
                foreach ($acct in @(Get-ChildItem -LiteralPath $root -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.PSPath -match '9375CFF0413111d3B88A00104B2A6676\\[0-9a-fA-F]{8}$' })) {
                    $props = Get-ItemProperty -LiteralPath $acct.PSPath -ErrorAction SilentlyContinue; if (-not $props) { continue }
                    $vals = @{}; foreach ($n in @('Account Name', 'Email', 'IMAP Server', 'SMTP Server', 'POP3 Server')) { if ($props.PSObject.Properties[$n]) { $vals[$n] = & $decode $props.$n } }
                    $text = ($vals.Values -join ' ')
                    if ($text -match $Pattern) { $profName = ($acct.PSPath -split '\\Profiles\\')[1].Split('\')[0]; $found.Add([pscustomobject]@{ account = $t.name; where = "Outlook $ver profile '$profName'"; what = (($vals.GetEnumerator() | Sort-Object Key | Where-Object { $_.Value } | ForEach-Object { "$($_.Key)=$($_.Value)" }) -join '; '); fix = 'remove this account from the Outlook profile (File > Account Settings) once the Microsoft 365 mailbox is added' }) }
                }
            }
            if ($t.current) {
                if (Get-Command -Name 'cmdkey.exe' -ErrorAction SilentlyContinue) {
                    foreach ($l in @(& cmdkey.exe /list 2>$null)) { if ("$l" -match '^\s*Target:\s*(.+)$' -and $Matches[1] -match $Pattern) { $found.Add([pscustomobject]@{ account = $t.name; where = 'Windows Credential Manager'; what = $Matches[1].Trim(); fix = "remove it: cmdkey /delete:`"$($Matches[1].Trim() -replace '^(LegacyGeneric|Domain):target=', '')`"" }) } }
                }
            }
            else { $notChecked.Add("Credential Manager for $($t.name) (encrypted for that account: sign in as $($t.name) and run the scan without -AllProfiles)") }
            $tb = $(if ($t.appData) { Join-Path $t.appData 'Thunderbird\Profiles' } else { $null })
            if ($tb -and (Test-Path -LiteralPath $tb)) {
                foreach ($pf in @(Get-ChildItem -LiteralPath $tb -Filter 'prefs.js' -Recurse -ErrorAction SilentlyContinue)) {
                    foreach ($l in @(Get-Content -LiteralPath $pf.FullName -Encoding UTF8 -ErrorAction SilentlyContinue | Where-Object { $_ -match '\.(hostname|useremail)",\s*"([^"]+)"' -and $_ -match $Pattern })) { $found.Add([pscustomobject]@{ account = $t.name; where = "Thunderbird ($($pf.Directory.Name))"; what = ($l -replace '^user_pref\(|\);$', ''); fix = 'remove or repoint this Thunderbird account' }) }
                }
            }
        }
    }
    finally { Close-DEMailProfileTargets -Targets $scope }
    if (Get-Command -Name 'Get-ScheduledTask' -ErrorAction SilentlyContinue) {
        foreach ($t in @(Get-ScheduledTask -ErrorAction SilentlyContinue)) { foreach ($a in @($t.Actions)) { $cmd = "$($a.Execute) $($a.Arguments)"; if ($cmd -match $Pattern) { $found.Add([pscustomobject]@{ account = '(this PC)'; where = "scheduled task $($t.TaskPath)$($t.TaskName)"; what = $cmd.Trim(); fix = 'repoint the script to smtp.office365.com (or SMTP relay) or retire it' }) } } }
    }
    $items = $found.ToArray(); $gaps = $notChecked.ToArray()
    $accounts = @($scope.targets | ForEach-Object { $_.name })
    if ($ProjectId) { $null = Add-DEMigrationDeviceRecord -ProjectId $ProjectId -DeviceName $DeviceName -Findings $items -Accounts $accounts -NotChecked $gaps -CheckedAt (Get-Date).ToUniversalTime().ToString('o') }
    $msg = $(if ($items.Count) { "$($items.Count) place(s) on $DeviceName still use Gmail: " + (($items | ForEach-Object { "$($_.where) [$($_.account)]" }) -join '; ') } else { "nothing on $DeviceName ($($accounts -join ', ')) still points at Gmail" })
    if ($gaps.Count) { $msg += ". Not checked: $($gaps -join '; ')" }
    $res = New-DEResult -Operation 'Get-DEMailClientInventory' -Status $(if ($items.Count -or $gaps.Count) { 'Partial' } else { 'Succeeded' }) -Target $DeviceName -Message $msg -Data $items
    $res | Add-Member -NotePropertyName accounts -NotePropertyValue $accounts
    $res | Add-Member -NotePropertyName notChecked -NotePropertyValue $gaps
    return $res
}
function Add-DEMigrationDeviceRecord {
    <# Records (or replaces) one device's scan on the project and moves it to the Devices stage. #>
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$DeviceName, [AllowEmptyCollection()][object[]]$Findings = @(), [string[]]$Accounts = @(), [string[]]$NotChecked = @(), [string]$CheckedAt, [string]$Source = 'scan')
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $rec = [pscustomobject][ordered]@{ name = $DeviceName; checkedAt = $(if ($CheckedAt) { $CheckedAt } else { (Get-Date).ToUniversalTime().ToString('o') }); accounts = @($Accounts); gmailReferences = @($Findings); notChecked = @($NotChecked); source = $Source }
    $p.devices = @(@($p.devices | Where-Object { -not ($_ -is [string] -and $_ -ieq $DeviceName) -and -not ($_.PSObject.Properties['name'] -and $_.name -ieq $DeviceName) }) + @($rec))
    Set-DEMigrationStage -Project $p -Stage 'Devices'
    $null = Save-DEMigrationProject -Project $p -Entry "device $DeviceName : $(@($Findings).Count) Gmail reference(s)$(if (@($NotChecked).Count) { ", $(@($NotChecked).Count) part(s) not checked" }) ($Source)"
    return $rec
}
function Import-DEMailClientInventory {
    <#
        Records a device scan made on a client PC (Get-DEMailClientInventory saved with Export-DEResult, or the DE Tech
        Tool's Migration page) on the project here. Refuses a file that is not a mail-client scan.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)] param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return (New-DEResult -Operation 'Import-DEMailClientInventory' -Status Refused -Target $Path -Message 'file not found') }
    try { $r = Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json } catch { return (New-DEResult -Operation 'Import-DEMailClientInventory' -Status Refused -Target $Path -Message "not JSON: $($_.Exception.Message)") }
    if (-not $r -or -not $r.PSObject.Properties['operation'] -or "$($r.operation)" -ne 'Get-DEMailClientInventory' -or -not "$($r.target)") { return (New-DEResult -Operation 'Import-DEMailClientInventory' -Status Refused -Target $Path -Message 'not a Get-DEMailClientInventory result') }
    $device = "$($r.target)"
    $items = @($r.data | Where-Object { $_ -and $_.PSObject.Properties['where'] })
    $gaps = @($(if ($r.PSObject.Properties['notChecked']) { $r.notChecked }) | Where-Object { $_ } | ForEach-Object { "$_" })
    $accounts = @($(if ($r.PSObject.Properties['accounts']) { $r.accounts } else { $items | ForEach-Object { $_.account } }) | ForEach-Object { "$_" } | Where-Object { $_ -and $_ -ne '(this PC)' } | Select-Object -Unique)
    if (-not $PSCmdlet.ShouldProcess($ProjectId, "record the scan of $device")) { return (New-DEResult -Operation 'Import-DEMailClientInventory' -Status DryRun -Target $device -Message 'no change applied') }
    $rec = Add-DEMigrationDeviceRecord -ProjectId $ProjectId -DeviceName $device -Findings $items -Accounts $accounts -NotChecked $gaps -CheckedAt "$($r.at)" -Source 'imported'
    return (New-DEResult -Operation 'Import-DEMailClientInventory' -Target $device -Message "$device recorded: $($items.Count) Gmail reference(s)$(if ($gaps.Count) { ", $($gaps.Count) part(s) not checked" })" -Data $rec)
}
function Get-DEMailHeaderBlock {
    <# Unfolded headers of the first header block in -Text as an ordered name -> list of values map. #>
    param([Parameter(Mandatory = $true)][AllowEmptyString()][string]$Text)
    $h = [ordered]@{}; $last = $null
    foreach ($l in ($Text -replace "`r`n", "`n" -split "`n")) {
        if ($l -eq '') { break }
        if ($l -match '^[ \t]' -and $last) { $vals = $h[$last]; $vals[$vals.Count - 1] = $vals[$vals.Count - 1] + ' ' + $l.Trim(); continue }
        if ($l -match '^([!-9;-~]+):\s*(.*)$') { $last = $Matches[1].ToLowerInvariant(); if (-not $h.Contains($last)) { $h[$last] = New-Object System.Collections.Generic.List[string] }; $h[$last].Add($Matches[2]) }
    }
    return $h
}
function Invoke-DEBounceDiagnostic {
    <#
        Reads a bounce (non-delivery report saved as .eml, or its full text) and says what is generating it:
          NdrReprocessed   the bounced message is itself a bounce: a rule, forward or client is resending NDRs
          AutomaticForward the original was auto-forwarded (X-Forwarded-*, Resent-*, Auto-Submitted, X-Gm-Original-To)
          RetryingClient   the original is more than a day older than the bounce: a device or app keeps retrying it
          NewMessage       a person or app is sending new mail to the dead address
        It reports the bounced recipient, the SMTP status and what it means, the sending client (X-Mailer, User-Agent,
        HELO names in Received) and any project device named in the headers, then what to change. With -MessageTrace
        (Exchange Online connected) it counts how often the same subject hit that recipient in 10 days. Deleted or
        archived mail is not treated as a cause: something active is sending. The finding is recorded open until
        Resolve-DEMigrationBounce closes it; the 'Bounce diagnostic' check passes when every finding is resolved.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Path, [switch]$MessageTrace)
    if (-not (Test-Path -LiteralPath $Path)) { throw "no file $Path" }
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $text = [IO.File]::ReadAllText($Path) -replace "`r`n", "`n"
    $outer = Get-DEMailHeaderBlock -Text $text
    $first = { param($h, $n) if ($h.Contains($n) -and $h[$n].Count) { "$($h[$n][0])" } else { '' } }
    $status = $(if ($text -match '(?im)^Status:\s*([245]\.\d{1,3}\.\d{1,3})') { $Matches[1] } elseif ($text -match '\b([45]\.\d{1,3}\.\d{1,3})\b') { $Matches[1] } else { '' })
    $diag = $(if ($text -match '(?im)^Diagnostic-Code:\s*(?:smtp;\s*)?(.+)$') { $Matches[1].Trim() } elseif ($text -match '(?im)The response (?:was|from the remote server was):\s*\n?\s*(.+)$') { $Matches[1].Trim() } else { '' })
    $recipient = $(if ($text -match '(?im)^Final-Recipient:\s*(?:rfc822;\s*)?(\S+)') { $Matches[1] } elseif ($text -match '(?im)^Original-Recipient:\s*(?:rfc822;\s*)?(\S+)') { $Matches[1] } elseif ($text -match "(?i)(?:wasn't delivered to|could not be delivered to|delivery to the following recipient[s]? failed[^\n]*\n\s*)\s*<?([A-Za-z0-9._%+'-]+@[A-Za-z0-9.-]+)") { $Matches[1] } else { '' })
    # the original message: after a message/rfc822 or text/rfc822-headers part, or Gmail's '----- Original message -----'
    $origText = ''
    if ($text -match '(?is)Content-Type:\s*(?:message/rfc822|text/rfc822-headers)[^\n]*\n(?:[^\n]+\n)*?\n(.*)$') { $origText = $Matches[1] }
    elseif ($text -match '(?is)-{3,}\s*Original message\s*-{3,}\s*\n(.*)$') { $origText = $Matches[1] }
    $orig = Get-DEMailHeaderBlock -Text $origText
    $origFrom = & $first $orig 'from'; $origTo = & $first $orig 'to'; $origSubject = & $first $orig 'subject'
    $ndrDate = [datetime]::MinValue; $origDate = [datetime]::MinValue
    $null = [datetime]::TryParse(((& $first $outer 'date') -replace '\s*\([^)]*\)\s*$', ''), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$ndrDate)
    $null = [datetime]::TryParse(((& $first $orig 'date') -replace '\s*\([^)]*\)\s*$', ''), [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::AdjustToUniversal, [ref]$origDate)
    $client = @((& $first $orig 'x-mailer'), (& $first $orig 'user-agent') | Where-Object { $_ }) -join '; '
    $helo = @(@($(if ($orig.Contains('received')) { $orig['received'] })) | ForEach-Object { if ($_ -match '(?i)\bfrom\s+(\S+)') { $Matches[1] } } | Where-Object { $_ } | Select-Object -Unique)
    $deviceNames = @(@($p.devices) | ForEach-Object { if ($_ -is [string]) { $_ } elseif ($_.PSObject.Properties['name']) { $_.name } } | Where-Object { $_ })
    foreach ($u in @($p.users)) { $deviceNames += @($u.devices) }
    $haystack = (@($(if ($orig.Contains('received')) { $orig['received'] })) + @($client) + @($helo)) -join ' '
    $devices = @($deviceNames | Select-Object -Unique | Where-Object { $haystack -match [regex]::Escape($_) })
    $cause = 'NewMessage'; $why = 'a person or app is sending new mail to this address'
    if ($origFrom -match '(?i)mailer-daemon|postmaster' -or $origSubject -match '(?i)^(delivery status notification|undeliverable|mail delivery (failed|subsystem)|returned mail)') { $cause = 'NdrReprocessed'; $why = 'the bounced message was itself a bounce: a filter, forward or client is resending non-delivery reports' }
    elseif ($orig.Contains('x-forwarded-to') -or $orig.Contains('x-forwarded-for') -or $orig.Contains('resent-from') -or $orig.Contains('resent-to') -or ((& $first $orig 'auto-submitted') -match '(?i)auto-') -or ($orig.Contains('x-gm-original-to') -and (& $first $orig 'x-gm-original-to') -notmatch [regex]::Escape($recipient))) { $cause = 'AutomaticForward'; $why = "the original was forwarded automatically$(if (& $first $orig 'x-forwarded-for') { " (X-Forwarded-For: $(& $first $orig 'x-forwarded-for'))" }): a Gmail forwarding address or filter, or a mailbox forwarding rule" }
    elseif ($ndrDate -ne [datetime]::MinValue -and $origDate -ne [datetime]::MinValue -and ($ndrDate - $origDate).TotalHours -gt 24) { $cause = 'RetryingClient'; $why = "the original is from $($origDate.ToString('u')), $([math]::Round(($ndrDate - $origDate).TotalHours)) h before the bounce: a device or app keeps retrying an old message" }
    $meaning = switch -Regex ($status) {
        '^5\.1\.1' { 'the recipient address does not exist (an old, mistyped or removed address)' }
        '^5\.1\.10' { 'the recipient is not in the Microsoft 365 tenant (MX moved before the mailbox or alias existed)' }
        '^5\.4\.1' { 'relay access denied: the receiving server does not accept mail for this address (often MX pointing to Microsoft 365 before the mailbox or alias exists)' }
        '^5\.7\.(1|26|509|23)' { 'rejected by policy or authentication (SPF, DKIM or DMARC failed, or the sender is blocked)' }
        '^5\.2\.2' { 'the recipient mailbox is full' }
        '^5\.7\.57' { 'SMTP AUTH client submission is not enabled for this mailbox or the client did not authenticate' }
        '^4\.' { 'temporary failure: the sender will retry (a retrying client shows up as repeated bounces)' }
        default { $(if ($status) { "SMTP status $status" } else { 'no SMTP status in the report' }) }
    }
    $fix = switch ($cause) {
        'NdrReprocessed' { 'Find the rule or forward that re-sends bounces: Gmail > Settings > Filters and Forwarding, Outlook rules, and any device listed; remove it before touching mail.' }
        'AutomaticForward' { "Gmail > Settings > Forwarding and POP/IMAP, and Filters: remove forwarding to $recipient (or fix the address). Check Microsoft 365 forwarding with Test-DEMigrationDns." }
        'RetryingClient' { "The client stuck retrying$(if ($client) { " ($client)" })$(if ($devices.Count) { " on $($devices -join ', ')" }): clear its Outbox and remove the old Gmail account from it (Get-DEMailClientInventory on that PC)." }
        default { "Tell the sender$(if ($origFrom) { " ($origFrom)" }) the new address, or add $recipient as an alias of the right Microsoft 365 mailbox (Set-DEMailboxAlias) if it should still receive mail." }
    }
    $repeats = $null
    if ($MessageTrace -and $recipient) {
        $trace = $(if (Get-Command -Name 'Get-MessageTraceV2' -ErrorAction SilentlyContinue) { 'Get-MessageTraceV2' } else { 'Get-MessageTrace' })
        if (Get-Command -Name $trace -ErrorAction SilentlyContinue) { $end = (Get-Date).ToUniversalTime(); $repeats = @(& $trace -RecipientAddress $recipient -StartDate $end.AddDays(-10) -EndDate $end -ErrorAction SilentlyContinue | Where-Object { -not $origSubject -or "$($_.Subject)" -eq $origSubject }).Count }
    }
    $finding = [pscustomobject][ordered]@{
        id = [guid]::NewGuid().ToString(); file = (Split-Path -Leaf $Path); at = (Get-Date).ToUniversalTime().ToString('o'); cause = $cause; why = $why
        bouncedRecipient = $recipient; smtpStatus = $status; meaning = $meaning; diagnostic = $diag; originalFrom = $origFrom; originalTo = $origTo; originalSubject = $origSubject
        originalDate = $(if ($origDate -ne [datetime]::MinValue) { $origDate.ToString('o') } else { $null }); bounceDate = $(if ($ndrDate -ne [datetime]::MinValue) { $ndrDate.ToString('o') } else { $null })
        sendingClient = $client; heloNames = $helo; matchedDevices = $devices; repeatsIn10Days = $repeats; fix = $fix; resolved = $false; resolution = $null; resolvedBy = $null
    }
    $p.bounce = @(@($p.bounce) + @($finding))
    Set-DEMigrationCheckValue -Project $p -Check 'Bounce diagnostic' -Status Fail -Detail "$(@($p.bounce | Where-Object { -not $_.resolved }).Count) open bounce finding(s); latest: $cause for $recipient"
    $null = Save-DEMigrationProject -Project $p -Entry "bounce $($finding.file): $cause ($status) for $recipient"
    return (New-DEResult -Operation 'Invoke-DEBounceDiagnostic' -Status Succeeded -Target $recipient -Message "$cause : $why. $meaning.$(if ($devices.Count) { " Devices in the headers: $($devices -join ', ')." }) Next: $fix" -Data $finding)
}
function Resolve-DEMigrationBounce {
    <# Closes a bounce finding with what was changed. The 'Bounce diagnostic' check passes once none are open. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$FindingId, [Parameter(Mandatory = $true)][string]$Resolution, [Parameter(Mandatory = $true)][string]$Technician)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $f = @($p.bounce | Where-Object { $_.id -eq $FindingId }); if (-not $f.Count) { return (New-DEResult -Operation 'Resolve-DEMigrationBounce' -Status Refused -Target $FindingId -Message 'no such bounce finding in this project') }
    if (-not $PSCmdlet.ShouldProcess($FindingId, "resolve: $Resolution")) { return (New-DEResult -Operation 'Resolve-DEMigrationBounce' -Status DryRun -Target $FindingId -Message 'no change applied') }
    $f[0].resolved = $true; $f[0].resolution = $Resolution; $f[0].resolvedBy = $Technician
    $open = @($p.bounce | Where-Object { -not $_.resolved })
    Set-DEMigrationCheckValue -Project $p -Check 'Bounce diagnostic' -Status $(if ($open.Count) { 'Fail' } else { 'Pass' }) -Detail $(if ($open.Count) { "$($open.Count) open bounce finding(s)" } else { "$(@($p.bounce).Count) bounce finding(s), all resolved" }) -By $Technician
    $null = Save-DEMigrationProject -Project $p -Entry "bounce $FindingId resolved by $Technician : $Resolution"
    return (New-DEResult -Operation 'Resolve-DEMigrationBounce' -Target $FindingId -Message "resolved; $($open.Count) finding(s) still open" -Data $f[0])
}

# ============================================================ verification, sign-off, close, Hub record
function Set-DEMigrationCheck {
    <#
        Records a check a technician verifies by hand (Replies, Attachments, Outlook desktop, Outlook mobile), or marks
        any check NotApplicable with a reason. Checks the tool measures (mail flow, DNS, folders, contacts, calendar,
        MFA, shared mailbox, bounces) can only be passed by running their test, never typed in.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Check, [Parameter(Mandatory = $true)][ValidateSet('Pass', 'Fail', 'NotApplicable')][string]$Status, [Parameter(Mandatory = $true)][string]$Note, [Parameter(Mandatory = $true)][string]$Technician)
    if (-not $script:MigrationChecks.Contains($Check)) { return (New-DEResult -Operation 'Set-DEMigrationCheck' -Status Refused -Target $Check -Message "unknown check (known: $($script:MigrationChecks.Keys -join ', '))") }
    if ($script:MigrationChecks[$Check] -ne 'technician' -and $Status -ne 'NotApplicable') { return (New-DEResult -Operation 'Set-DEMigrationCheck' -Status Refused -Target $Check -Message "'$Check' is measured by $($script:MigrationChecks[$Check]); run it (or mark the check NotApplicable with a reason)") }
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    if (-not $PSCmdlet.ShouldProcess($Check, "$Status ($Note)")) { return (New-DEResult -Operation 'Set-DEMigrationCheck' -Status DryRun -Target $Check -Message 'no change applied') }
    Set-DEMigrationCheckValue -Project $p -Check $Check -Status $Status -Detail $Note -By $Technician
    $null = Save-DEMigrationProject -Project $p -Entry "check '$Check' $Status by $Technician : $Note"
    return (New-DEResult -Operation 'Set-DEMigrationCheck' -Target $Check -Message "$Check : $Status" -Data $p.verification.$Check)
}
function New-DEMigrationSignoff {
    <#
        The client's decision, checked against the verification list. Approved needs every check Pass or NotApplicable.
        ApprovedWithExceptions needs a written reason for each check that is not (-Exceptions @{ 'Outlook mobile' = 'Mike
        sets up his phone Monday' }). Rejected is always recordable. The result lists exactly what was signed.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$ApprovedBy, [Parameter(Mandatory = $true)][ValidateSet('Approved', 'ApprovedWithExceptions', 'Rejected')][string]$Decision, [hashtable]$Exceptions = @{}, [string]$Note)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $open = @($script:MigrationChecks.Keys | Where-Object { "$($p.verification.$_.status)" -notin @('Pass', 'NotApplicable') })
    if ($Decision -eq 'Approved' -and $open.Count) { return (New-DEResult -Operation 'New-DEMigrationSignoff' -Status Refused -Target $ProjectId -Message "not every check passed: $(($open | ForEach-Object { "$_ ($($p.verification.$_.status))" }) -join ', '). Finish them, or sign ApprovedWithExceptions with a reason for each") }
    if ($Decision -eq 'ApprovedWithExceptions') { $noReason = @($open | Where-Object { -not "$($Exceptions[$_])".Trim() }); if ($noReason.Count) { return (New-DEResult -Operation 'New-DEMigrationSignoff' -Status Refused -Target $ProjectId -Message "exceptions need a reason for: $($noReason -join ', ')") } }
    $so = [pscustomobject][ordered]@{ decision = $Decision; approvedBy = $ApprovedBy; recordedBy = "$env:USERDOMAIN\$env:USERNAME"; at = (Get-Date).ToUniversalTime().ToString('o'); note = $Note; exceptions = @($open | Where-Object { $Exceptions.ContainsKey($_) } | ForEach-Object { [pscustomobject]@{ check = $_; status = "$($p.verification.$_.status)"; reason = "$($Exceptions[$_])" } }); checks = @($script:MigrationChecks.Keys | ForEach-Object { [pscustomobject]@{ check = $_; status = "$($p.verification.$_.status)"; detail = "$($p.verification.$_.detail)" } }) }
    if (-not $PSCmdlet.ShouldProcess($ProjectId, "record sign-off: $Decision by $ApprovedBy")) { return (New-DEResult -Operation 'New-DEMigrationSignoff' -Status DryRun -Target $ProjectId -Message 'no change applied' -Data $so) }
    $p.signoff = $so
    if ($Decision -ne 'Rejected') { Set-DEMigrationStage -Project $p -Stage 'SignedOff' }
    $null = Save-DEMigrationProject -Project $p -Entry "sign-off: $Decision by $ApprovedBy$(if ($so.exceptions.Count) { " with $($so.exceptions.Count) exception(s)" })"
    return (New-DEResult -Operation 'New-DEMigrationSignoff' -Target $ProjectId -Message "$Decision by $ApprovedBy$(if ($so.exceptions.Count) { "; exceptions: $(($so.exceptions | ForEach-Object { $_.check }) -join ', ')" })" -Data $so)
}
function Close-DEMigrationProject {
    <#
        After an approved sign-off: removes the completed migration batches from Exchange Online (which deletes the Gmail
        credentials Exchange kept for them) and closes the project. What only a person can do is returned as the closing
        list: revoke each Gmail app password, and keep or end the old Gmail access as the transition plan says.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$ProjectId, [switch]$DryRun)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    if (-not $p.signoff -or $p.signoff.decision -notin @('Approved', 'ApprovedWithExceptions')) { return (New-DEResult -Operation 'Close-DEMigrationProject' -Status Refused -Target $ProjectId -Message 'no approved client sign-off yet (New-DEMigrationSignoff)') }
    Assert-DECommand 'Get-MigrationBatch' 'ExchangeOnlineManagement'
    $open = @(); foreach ($b in @($p.batches)) { $mb = @(Get-MigrationBatch -Identity $b.name -ErrorAction SilentlyContinue); if ($mb.Count -and "$($mb[0].Status)" -ne 'Completed') { $open += "$($b.name) ($($mb[0].Status))" } }
    if ($open.Count) { return (New-DEResult -Operation 'Close-DEMigrationProject' -Status Refused -Target $ProjectId -Message "batches not completed: $($open -join ', ') (Complete-DEMigrationBatch)") }
    $todo = @($p.users | ForEach-Object { "revoke the app password in $($_.source) (Google Account > Security > App passwords)" }) + @('keep or end the old Gmail access as the transition plan says; do not delete source mail until the client agrees')
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($ProjectId, "remove $(@($p.batches).Count) completed batch(es) and their stored Gmail credentials from Exchange Online")) { return (New-DEResult -Operation 'Close-DEMigrationProject' -Status DryRun -Target $ProjectId -Message 'no change applied' -Data ([pscustomobject]@{ closingList = $todo })) }
    foreach ($b in @($p.batches)) { if (@(Get-MigrationBatch -Identity $b.name -ErrorAction SilentlyContinue).Count) { Remove-MigrationBatch -Identity $b.name -Confirm:$false -ErrorAction Stop }; $b.status = 'Removed' }
    Set-DEMigrationStage -Project $p -Stage 'Closed'
    $p | Add-Member -NotePropertyName closingList -NotePropertyValue $todo -Force
    $null = Save-DEMigrationProject -Project $p -Entry 'project closed; migration batches and their stored credentials removed from Exchange Online'
    return (New-DEResult -Operation 'Close-DEMigrationProject' -Target $ProjectId -Message "closed. Still to do by hand: $($todo -join '; ')" -Data ([pscustomobject]@{ closingList = $todo }))
}
function Get-DEMigrationNextStep {
    <#
        The next thing to do on a project, read from what has actually been recorded (not from the stage label), with
        the command that does it. The DE Tech Tool's Migration page shows the same answer.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [string]$Technician = $env:USERNAME)
    $p = Get-DEMigrationProject -ProjectId $ProjectId; $id = $p.projectId
    $users = @($p.users | Where-Object { $_ }); $batches = @($p.batches | Where-Object { $_ })
    $step = { param($s, $w, $c) [pscustomobject][ordered]@{ projectId = $id; step = $s; why = $w; command = $c } }
    if ("$($p.stage)" -eq 'Closed') { return (& $step 'Send the record to the Hub' 'The project is closed; its record is the lasting evidence.' "Export-DEMigrationRecord -ProjectId $id -Path .\$id-record.json") }
    if (-not $users.Count) { return (& $step 'Map each mailbox' 'No Gmail address is mapped to a Microsoft 365 mailbox yet.' "Add-DEMigrationUser -ProjectId $id -SourceAddress <name@gmail.com> -DestinationAddress <name@$($p.targetDomain)> -Devices <PC names>") }
    $notReady = @($users | Where-Object { -not $_.destinationReady })
    if ($notReady.Count) { $u = $notReady[0]; return (& $step "Get $($u.destination) ready" "$($u.destination): $(@($u.destinationIssues) -join '; '). Licence it in the Microsoft 365 admin centre, wait for the mailbox, then map it again." "Add-DEMigrationUser -ProjectId $id -SourceAddress $($u.source) -DestinationAddress $($u.destination)") }
    $noPre = @($users | Where-Object { -not ($_.preflight -and $_.preflight.ok) })
    if ($p.mailPath -eq 'IMAP' -and $noPre.Count) { $u = $noPre[0]; return (& $step "IMAP preflight for $($u.source)" "$($noPre.Count) Gmail account(s) have not passed the preflight$(if ($u.preflight -and $u.preflight.reason) { " (last: $($u.preflight.reason))" }). Use the Gmail app password; it stays in memory." "Test-DEGmailImapAccess -Credential (Get-Credential $($u.source)) -ProjectId $id") }
    $pilot = @($batches | Where-Object { $_.type -eq 'Pilot' })
    if (-not $pilot.Count) { return (& $step 'Start the pilot' 'One mailbox first; production batches are refused until a pilot is confirmed.' "New-DEMigrationBatch -ProjectId $id -Type Pilot -Credential (Get-Credential $($users[0].source))") }
    if (-not @($pilot | Where-Object { $_.confirmedBy }).Count) { return (& $step 'Confirm the pilot' 'Check the pilot mailbox in Outlook (folders, recent mail, attachments), then confirm it.' "Get-DEMigrationStatus -ProjectId $id; Confirm-DEMigrationPilot -ProjectId $id -Technician $Technician -Note '<what you checked>'") }
    $noBatch = @($users | Where-Object { -not $_.batch })
    if ($noBatch.Count) { return (& $step 'Move the remaining mailboxes' "$($noBatch.Count) mailbox(es) are not in a batch yet." "New-DEMigrationBatch -ProjectId $id -Type Production -Credential $((@($noBatch | ForEach-Object { "(Get-Credential $($_.source))" })) -join ', ')") }
    $noCC = @($users | Where-Object { -not $_.contacts -or -not $_.calendar })
    if ($noCC.Count) { $u = $noCC[0]; return (& $step "Contacts and calendar for $($u.source)" 'IMAP moves mail only. Import the Google Contacts CSV and the Google Calendar .ics for each person.' "Import-DEMigrationContacts -ProjectId $id -SourceAddress $($u.source) -Path .\contacts.csv; Import-DEMigrationCalendar -ProjectId $id -SourceAddress $($u.source) -Path .\calendar.ics") }
    $scanned = @($p.devices | Where-Object { $_ -isnot [string] -and $_.PSObject.Properties['checkedAt'] } | ForEach-Object { "$($_.name)" })
    $named = @(@($p.devices | Where-Object { $_ -is [string] }) + @($users | ForEach-Object { @($_.devices) }) | Where-Object { $_ } | Select-Object -Unique)
    $unscanned = @($named | Where-Object { $scanned -notcontains $_ })
    if ($unscanned.Count -or -not $scanned.Count) { return (& $step 'Scan each PC for Gmail' $(if ($unscanned.Count) { "Not scanned yet: $($unscanned -join ', '). Run the DE Tech Tool's Migration page on each PC, or the command, then import the file here." } else { 'No PC has been scanned. Run the DE Tech Tool''s Migration page on each PC the client uses.' }) "Get-DEMailClientInventory -AllProfiles -ProjectId $id") }
    if (-not ($p.dns -and $p.dns.mxOk)) { return (& $step 'Point DNS to Microsoft 365' $(if ($p.dns) { 'MX does not point to Microsoft 365 yet. Change MX, SPF and autodiscover at the DNS host, then check again.' } else { 'DNS has not been checked.' }) "Test-DEMigrationDns -ProjectId $id -Server 1.1.1.1") }
    $open = @($batches | Where-Object { "$($_.status)" -notin @('Completed', 'Completing', 'Removed') })
    if ($open.Count) { return (& $step 'Run the final delta' "DNS points to Microsoft 365. Complete $(@($open | ForEach-Object { $_.name }) -join ', ') to pick up the last mail." "Complete-DEMigrationBatch -ProjectId $id -BatchName $($open[0].name)") }
    $pending = @($script:MigrationChecks.Keys | Where-Object { $p.verification.PSObject.Properties[$_] -and "$($p.verification.$_.status)" -in @('Pending', 'Fail') })
    if ($pending.Count) {
        $shared = @($p.sharedMailboxes | Where-Object { $_ -and $_.PSObject.Properties['address'] })
        $openBounce = @($p.bounce | Where-Object { $_ -and -not $_.resolved })
        $cmds = @(foreach ($c in $pending) {
            switch ($script:MigrationChecks[$c]) {
                'Test-DEMigrationMailFlow' { "Test-DEMigrationMailFlow -ProjectId $id" }
                'Test-DEMigrationMfa' { "Test-DEMigrationMfa -ProjectId $id" }
                'Get-DEMigrationStatus' { "Get-DEMigrationStatus -ProjectId $id" }
                'Test-DEMigrationDns' { "Test-DEMigrationDns -ProjectId $id -Server 1.1.1.1" }
                'Test-DEMigrationSharedMailbox' { if ($shared.Count) { "Test-DEMigrationSharedMailbox -ProjectId $id -Address $($shared[0].address) -Members $(@($shared[0].members) -join ', ')" } else { "Set-DEMigrationSharedMailbox -ProjectId $id -Address <office@$($p.targetDomain)> -DisplayName <name> -Members <addresses>" } }
                'Import-DEMigrationContacts' { "Import-DEMigrationContacts -ProjectId $id -SourceAddress <name@gmail.com> -Path .\contacts.csv" }
                'Import-DEMigrationCalendar' { "Import-DEMigrationCalendar -ProjectId $id -SourceAddress <name@gmail.com> -Path .\calendar.ics" }
                'Invoke-DEBounceDiagnostic' { if ($openBounce.Count) { "Resolve-DEMigrationBounce -ProjectId $id -FindingId $($openBounce[0].id) -Resolution '<what was changed>' -Technician $Technician" } else { "Set-DEMigrationCheck -ProjectId $id -Check 'Bounce diagnostic' -Status NotApplicable -Note 'no bounces reported during the transition window' -Technician $Technician" } }
                default { "Set-DEMigrationCheck -ProjectId $id -Check '$c' -Status Pass -Note '<what you saw>' -Technician $Technician" }
            }
        })
        $cmd = (@($cmds | Select-Object -Unique) -join "`r`n")
        return (& $step 'Finish verification' "Not passed yet: $($pending -join ', ')." $cmd)
    }
    if (-not $p.signoff) { return (& $step 'Client sign-off' 'Every check passed or is not applicable.' "New-DEMigrationSignoff -ProjectId $id -ApprovedBy '<client name>' -Decision Approved") }
    return (& $step 'Close the project' 'Signed off. Closing removes the batches and the Gmail credentials Exchange stored; then revoke each app password in the Google account.' "Close-DEMigrationProject -ProjectId $id")
}
function Export-DEMigrationRecord {
    <#
        The project as the Intelligence Hub keeps it (MIGRATION-STANDARD.md, Required Hub records): client and tenant,
        source classification, identity map, devices, shared mailboxes, batches, contacts and calendar results, DNS,
        bounce findings, verification, sign-off and the event trail. Checked for credential-like fields before it is
        written; UTF-8 without a BOM.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$ProjectId, [Parameter(Mandatory = $true)][string]$Path)
    $p = Get-DEMigrationProject -ProjectId $ProjectId
    $rec = [pscustomobject][ordered]@{
        schema = 'de.email-migration.record/v1'; projectId = $p.projectId; client = $p.client; tenantId = $p.tenantId; targetDomain = $p.targetDomain; stage = $p.stage
        source = [pscustomobject]@{ type = $p.sourceType; mailPath = $p.mailPath }
        identityMap = @($p.users | ForEach-Object { [pscustomobject]@{ source = $_.source; destination = $_.destination; displayName = $_.displayName; devices = @($_.devices); preflight = $_.preflight; migration = $_.migration; contacts = $(if ($_.contacts) { $_.contacts | Select-Object file, rows, imported, duplicates, failed, at } else { $null }); calendar = $(if ($_.calendar) { $_.calendar | Select-Object file, events, imported, importedBefore, deletedOccurrences, skipped, failed, at } else { $null }); multiFactor = $_.mfa } })
        devices = @($p.devices | ForEach-Object { if ($_ -is [string]) { [pscustomobject]@{ name = $_; checkedAt = $null; accounts = @(); gmailReferences = @(); notChecked = @(); source = 'named' } } else { $_ } })
        sharedMailboxes = @($p.sharedMailboxes); batches = @($p.batches); dns = $p.dns; bounce = @($p.bounce)
        # checks as a list: the Hub refuses any key that looks like a secret (an 'MFA' key included), so check names are values
        checks = @($p.verification.PSObject.Properties | ForEach-Object { [pscustomobject][ordered]@{ check = $_.Name; status = "$($_.Value.status)"; detail = "$($_.Value.detail)"; by = "$($_.Value.by)"; at = $(if ($_.Value.at -is [datetime]) { $_.Value.at.ToUniversalTime().ToString('o', [Globalization.CultureInfo]::InvariantCulture) } elseif ($_.Value.at) { "$($_.Value.at)" } else { $null }) } })
        signoff = $p.signoff; events = @($p.events); exportedAt = (Get-Date).ToUniversalTime().ToString('o')
    }
    $hits = @(Find-DEMigrationSecret -Node $rec); if ($hits.Count) { throw "refusing to export: credential-like fields at $($hits -join ', ')" }
    $hubHits = @(Find-DEMigrationHubRefusal -Node $rec); if ($hubHits.Count) { throw "refusing to export: the Hub would refuse keys at $($hubHits -join ', ')" }
    $dir = Split-Path -Parent $Path; if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::WriteAllText($Path, (ConvertTo-Json -InputObject $rec -Depth 20), (New-Object Text.UTF8Encoding $false))
    return (New-DEResult -Operation 'Export-DEMigrationRecord' -Target $ProjectId -Message "Hub record written to $Path" -Data (Get-Item -LiteralPath $Path))
}
