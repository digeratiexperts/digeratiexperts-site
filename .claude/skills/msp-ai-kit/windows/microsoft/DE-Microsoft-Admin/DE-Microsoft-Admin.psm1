#Requires -Version 5.1
<#
.SYNOPSIS
    DE Microsoft Admin: Microsoft 365, Entra ID, Exchange Online, Intune, Autopilot and Azure administration for
    Digerati Experts, safe to run by a technician or by the Intelligence Hub through signed jobs.

.DESCRIPTION
    Rules this module keeps:
      * Read-only by default. Every change supports -WhatIf and -DryRun and returns the same result shape.
      * Nothing secret is written: no passwords, tokens, client secrets or BitLocker recovery keys (key IDs only).
      * Graph calls page through @odata.nextLink (no silent truncation at 999), retry throttling (429/503/504)
        with Retry-After, and use server-side $search/$filter instead of downloading whole directories.
      * Least privilege: Connect-DEMicrosoft asks only for the scopes a scenario needs. The Hub worker signs in
        app-only with a certificate from the machine store (no secret on disk), to Graph, and with the same app and
        certificate to Exchange Online and Azure when a job needs them.
      * Every operation returns one result object and appends one line to the audit log (operation, target,
        status, who, when; never data).
      * Destructive operations are ConfirmImpact High, verify their own effect, and refuse ambiguous targets.
      * Invoke-DEMicrosoftJob runs a Hub job only when it is signed, unexpired, not replayed, for the connected
        tenant, an allowlisted operation with allowlisted parameters, and (to change anything) approved.
      * Invoke-DEHubJobLoop claims the Hub's jobs, runs them through Invoke-DEMicrosoftJob and posts results with
        nothing secret in them; a result it could not post waits on disk for the next run.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

# ClientId and CertificateThumbprint are the app-only Graph sign-in (public identifiers, never a secret): the Hub
# worker signs in to Exchange Online and Azure with the same app and certificate.
$script:Ctx = [ordered]@{ TenantId = $null; Mode = $null; Account = $null; Scopes = @(); ConnectedAt = $null; ClientId = $null; CertificateThumbprint = $null }
# Exchange Online and Azure sessions opened through this module in this PowerShell session (Connect-DEExchange,
# Connect-DEAzure): $null, or mode (user, app, interactive, service-principal), target and tenant.
$script:ServiceSessions = @{ Exchange = $null; Azure = $null }
$script:AuditPath = $(if ($env:ProgramData) { Join-Path $env:ProgramData 'DE\MicrosoftAdmin\audit.jsonl' } else { Join-Path ([IO.Path]::GetTempPath()) 'de-microsoft-admin-audit.jsonl' })
$script:GraphRoot = 'https://graph.microsoft.com'
$script:RecoveryShape = '(?<!\d)\d{6}(-\d{6}){7}(?!\d)'

# Least-privilege scope sets (delegated). Combine with -Scenario A,B.
$script:ScopeSets = [ordered]@{
    Read      = @('User.Read.All', 'Group.Read.All', 'Directory.Read.All', 'Organization.Read.All', 'Policy.Read.All')
    Users     = @('User.ReadWrite.All')
    Groups    = @('GroupMember.ReadWrite.All', 'Group.ReadWrite.All')
    Policy    = @('Policy.ReadWrite.ConditionalAccess', 'Application.Read.All')
    Intune    = @('DeviceManagementManagedDevices.ReadWrite.All', 'DeviceManagementConfiguration.Read.All', 'DeviceManagementManagedDevices.PrivilegedOperations.All')
    Autopilot = @('DeviceManagementServiceConfig.ReadWrite.All', 'DeviceManagementManagedDevices.ReadWrite.All')
    BitLocker = @('BitLockerKey.ReadBasic.All', 'Device.Read.All')
    Migration = @('Contacts.ReadWrite', 'Calendars.ReadWrite', 'Domain.Read.All', 'UserAuthenticationMethod.Read.All', 'AuditLog.Read.All')
    Reports   = @('AuditLog.Read.All', 'Reports.Read.All')
}

# ============================================================ results and audit
function Set-DEMsAuditPath { param([Parameter(Mandatory = $true)][string]$Path) $script:AuditPath = $Path; return $Path }
function Get-DEMsAuditPath { return $script:AuditPath }
function Write-DEMsAudit {
    param([Parameter(Mandatory = $true)][string]$Operation, [Parameter(Mandatory = $true)][string]$Status, [string]$Target, [string]$Message, [string]$JobId)
    try {
        $dir = Split-Path -Parent $script:AuditPath; if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force -WhatIf:$false | Out-Null }
        $line = [ordered]@{ at = (Get-Date).ToUniversalTime().ToString('o'); operation = $Operation; status = $Status; target = $Target; tenant = $script:Ctx.TenantId; mode = $script:Ctx.Mode; actor = $script:Ctx.Account; operator = "$env:USERDOMAIN\$env:USERNAME"; jobId = $JobId; message = ($Message -replace $script:RecoveryShape, '[removed]') }
        [IO.File]::AppendAllText($script:AuditPath, ($line | ConvertTo-Json -Compress -Depth 4) + "`n", (New-Object Text.UTF8Encoding $false))
    } catch { Write-Verbose "audit not written: $($_.Exception.Message)" }
}
function New-DEResult {
    <# One result shape for every operation: Succeeded | DryRun | Failed | Refused | Partial. #>
    param([Parameter(Mandatory = $true)][string]$Operation, [ValidateSet('Succeeded', 'DryRun', 'Failed', 'Refused', 'Partial')][string]$Status = 'Succeeded', [object]$Data, [string]$Message = '', [string]$Target = '', [string]$JobId)
    Write-DEMsAudit -Operation $Operation -Status $Status -Target $Target -Message $Message -JobId $JobId
    return [pscustomobject][ordered]@{ product = 'DE Microsoft Admin'; version = '0.7.0'; operation = $Operation; status = $Status; target = $Target; tenant = $script:Ctx.TenantId; at = (Get-Date).ToUniversalTime().ToString('o'); message = $Message; data = $Data }
}
function Export-DEResult {
    <# Writes a result as UTF-8 JSON without a BOM (Node, Python and the Hub reject one). #>
    param([Parameter(Mandatory = $true)][object]$Result, [Parameter(Mandatory = $true)][string]$Path)
    $parent = Split-Path -Parent $Path; if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [IO.File]::WriteAllText($Path, ($Result | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding $false))
    return (Get-Item -LiteralPath $Path)
}

# ============================================================ connection
function Get-DEMsScopeSet { param([ValidateSet('Read', 'Users', 'Groups', 'Policy', 'Intune', 'Autopilot', 'BitLocker', 'Migration', 'Reports')][string[]]$Scenario = @('Read')) return @(@('Read') + @($Scenario) | Select-Object -Unique | ForEach-Object { $script:ScopeSets[$_] } | Select-Object -Unique) }
function Assert-DECommand { param([Parameter(Mandatory = $true)][string]$Name, [string]$Module) if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) { throw "'$Name' is not available. Install $(if ($Module) { $Module } else { 'its module' }) (Install-DEMicrosoftDependencies.ps1)." } }
function Connect-DEMicrosoft {
    <#
        Delegated: -TenantId and -Scenario (least-privilege scope sets). App-only (the Hub worker): -ClientId and
        -CertificateThumbprint of a certificate in the machine or user store; no client secret is ever accepted.
    #>
    [CmdletBinding(DefaultParameterSetName = 'Delegated')]
    param(
        [Parameter(Mandatory = $true)][string]$TenantId,
        [Parameter(ParameterSetName = 'Delegated')][ValidateSet('Read', 'Users', 'Groups', 'Policy', 'Intune', 'Autopilot', 'BitLocker', 'Migration', 'Reports')][string[]]$Scenario = @('Read'),
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][string]$ClientId,
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][string]$CertificateThumbprint
    )
    Assert-DECommand 'Connect-MgGraph' 'Microsoft.Graph.Authentication'
    if ($PSCmdlet.ParameterSetName -eq 'App') {
        Connect-MgGraph -TenantId $TenantId -ClientId $ClientId -CertificateThumbprint $CertificateThumbprint -NoWelcome
        $script:Ctx.Mode = 'app'; $script:Ctx.Scopes = @(); $script:Ctx.ClientId = $ClientId; $script:Ctx.CertificateThumbprint = $CertificateThumbprint
    } else {
        $scopes = Get-DEMsScopeSet -Scenario $Scenario
        Connect-MgGraph -TenantId $TenantId -Scopes $scopes -NoWelcome
        $script:Ctx.Mode = 'delegated'; $script:Ctx.Scopes = $scopes; $script:Ctx.ClientId = $null; $script:Ctx.CertificateThumbprint = $null
    }
    $mg = Get-MgContext
    $script:Ctx.TenantId = $(if ($mg -and $mg.TenantId) { "$($mg.TenantId)" } else { $TenantId }); $script:Ctx.Account = $(if ($mg) { "$($mg.Account)$(if (-not $mg.Account) { $mg.AppName })" } else { $null }); $script:Ctx.ConnectedAt = (Get-Date).ToUniversalTime().ToString('o')
    return (New-DEResult -Operation 'Connect-DEMicrosoft' -Target $script:Ctx.TenantId -Data ([pscustomobject]$script:Ctx))
}
function Get-DEMsContext { return [pscustomobject]$script:Ctx }

# ============================================================ Graph
function ConvertTo-DEODataLiteral {
    <# An OData string literal, quote-doubled and URL-escaped (so '&', '#' and '+' in a name cannot break the query). #>
    param([AllowEmptyString()][string]$Value)
    return "'" + [uri]::EscapeDataString(($Value -replace "'", "''")) + "'"
}
function Invoke-DEGraphRequest {
    <#
        One place for Graph: relative paths go to v1.0 (or beta with -Beta), -All follows @odata.nextLink, throttling
        and transient errors are retried with Retry-After, -Eventual adds ConsistencyLevel for $search/$count.
    #>
    param([ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')][string]$Method = 'GET', [Parameter(Mandatory = $true)][string]$Uri, [object]$Body, [switch]$All, [switch]$Beta, [switch]$Eventual, [hashtable]$Headers = @{}, [int]$MaxRetries = 4)
    if (-not (Get-MgContext)) { throw 'Microsoft Graph is not connected. Run Connect-DEMicrosoft first.' }
    $next = $(if ($Uri -match '^https://') { $Uri } else { "$script:GraphRoot/$(if ($Beta) { 'beta' } else { 'v1.0' })/$($Uri.TrimStart('/'))" })
    # (a local named $headers would BE $Headers: PowerShell variable names ignore case)
    $hdr = @{}; foreach ($k in $Headers.Keys) { $hdr[$k] = $Headers[$k] }; if ($Eventual) { $hdr['ConsistencyLevel'] = 'eventual' }
    $items = New-Object System.Collections.Generic.List[object]; $single = $null; $pages = 0
    while ($next) {
        $attempt = 0
        while ($true) {
            try {
                $p = @{ Method = $Method; Uri = $next; Headers = $hdr; ErrorAction = 'Stop' }
                if ($null -ne $Body) { $p.Body = ($Body | ConvertTo-Json -Depth 20 -Compress); $p.ContentType = 'application/json; charset=utf-8' }
                $r = Invoke-MgGraphRequest @p
                break
            } catch {
                $attempt++
                $msg = "$($_.Exception.Message)"
                $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch { $code = $null }
                if (-not $code -and $msg -match '\b(429|502|503|504)\b') { $code = [int]$Matches[1] }
                if ($attempt -gt $MaxRetries -or $code -notin @(429, 502, 503, 504)) { throw }
                $wait = [Math]::Min(60, [Math]::Pow(2, $attempt)); try { $ra = $_.Exception.Response.Headers.RetryAfter.Delta; if ($ra) { $wait = [Math]::Ceiling($ra.TotalSeconds) } } catch { }
                Start-Sleep -Seconds $wait
            }
        }
        $pages++
        $val = $(if ($r -is [System.Collections.IDictionary]) { if ($r.Contains('value')) { , $r['value'] } else { $null } } elseif ($r -and $r.PSObject.Properties['value']) { , $r.value } else { $null })
        if ($null -ne $val) { foreach ($i in @($val)) { $items.Add($i) } } else { $single = $r }
        $nl = $(if ($r -is [System.Collections.IDictionary]) { $r['@odata.nextLink'] } elseif ($r) { $r.'@odata.nextLink' } else { $null })
        $next = $(if ($All -and $nl) { "$nl" } else { $null })
        if ($pages -gt 500) { throw "stopped after 500 pages of $Uri" }
    }
    if ($null -ne $single -and $items.Count -eq 0) { return $single }
    return $items.ToArray()   # callers wrap in @(): a comma here would nest the list inside a one-item array
}

# ============================================================ tenant and Entra
function Get-DETenantSummary {
    [CmdletBinding()] param()
    $org = @(Invoke-DEGraphRequest -Uri 'organization?$select=id,displayName,verifiedDomains,countryLetterCode,createdDateTime')
    $skus = @(Invoke-DEGraphRequest -Uri 'subscribedSkus?$select=skuPartNumber,consumedUnits,prepaidUnits')
    $o = $org | Select-Object -First 1
    return (New-DEResult -Operation 'Get-DETenantSummary' -Target "$($o.displayName)" -Data ([pscustomobject]@{ id = $o.id; name = $o.displayName; country = $o.countryLetterCode; domains = @($o.verifiedDomains | ForEach-Object { [pscustomobject]@{ name = $_.name; default = [bool]$_.isDefault; initial = [bool]$_.isInitial } }); licenses = @($skus | ForEach-Object { [pscustomobject]@{ sku = $_.skuPartNumber; enabled = $_.prepaidUnits.enabled; consumed = $_.consumedUnits } }) }))
}
function Get-DEUser {
    <# -UserId (id or UPN) for one user; -Search uses Graph $search on displayName, mail and UPN (server side); otherwise every user, paged. #>
    [CmdletBinding()] param([string]$Search, [string]$UserId)
    $sel = 'id,displayName,userPrincipalName,accountEnabled,mail,jobTitle,department,userType,onPremisesSyncEnabled,createdDateTime'
    if ($UserId) { $items = @(Invoke-DEGraphRequest -Uri ('users/{0}?$select={1}' -f [uri]::EscapeDataString($UserId), $sel)) }
    elseif ($Search) { $q = [uri]::EscapeDataString(($Search -replace '"', '')); $items = @(Invoke-DEGraphRequest -Uri ('users?$search="displayName:{0}" OR "mail:{0}" OR "userPrincipalName:{0}"&$select={1}&$top=999' -f $q, $sel) -All -Eventual) }
    else { $items = @(Invoke-DEGraphRequest -Uri ('users?$select={0}&$top=999' -f $sel) -All) }
    return (New-DEResult -Operation 'Get-DEUser' -Target "$(if ($UserId) { $UserId } elseif ($Search) { "search:$Search" } else { 'all' })" -Message "$($items.Count) user(s)" -Data $items)
}
function Set-DEUserAccountState {
    <# Enables or blocks sign-in, then reads it back. Blocking also revokes sessions with -RevokeSessions. #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$UserId, [Parameter(Mandatory = $true)][bool]$Enabled, [switch]$RevokeSessions, [switch]$DryRun)
    $id = [uri]::EscapeDataString($UserId)
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($UserId, "set accountEnabled=$Enabled$(if ($RevokeSessions) { ' and revoke sessions' })")) { return (New-DEResult -Operation 'Set-DEUserAccountState' -Status DryRun -Target $UserId -Message 'no change applied' -Data ([pscustomobject]@{ userId = $UserId; enabled = $Enabled; revokeSessions = [bool]$RevokeSessions })) }
    $null = Invoke-DEGraphRequest -Method PATCH -Uri "users/$id" -Body @{ accountEnabled = $Enabled }
    if ($RevokeSessions -and -not $Enabled) { $null = Invoke-DEGraphRequest -Method POST -Uri "users/$id/revokeSignInSessions" }
    $v = Invoke-DEGraphRequest -Uri ('users/{0}?$select=id,userPrincipalName,accountEnabled' -f $id)
    $ok = ([bool]$v.accountEnabled -eq $Enabled)
    return (New-DEResult -Operation 'Set-DEUserAccountState' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $UserId -Message $(if ($ok) { "accountEnabled is $Enabled (read back)" } else { "read back accountEnabled=$($v.accountEnabled)" }) -Data $v)
}
function Get-DEGroup {
    [CmdletBinding()] param([string]$Search, [string]$GroupId)
    $sel = 'id,displayName,mail,mailEnabled,securityEnabled,groupTypes,membershipRule'
    if ($GroupId) { $items = @(Invoke-DEGraphRequest -Uri ('groups/{0}?$select={1}' -f $GroupId, $sel)) }
    elseif ($Search) { $items = @(Invoke-DEGraphRequest -Uri ('groups?$search="displayName:{0}"&$select={1}&$top=999' -f [uri]::EscapeDataString(($Search -replace '"', '')), $sel) -All -Eventual) }
    else { $items = @(Invoke-DEGraphRequest -Uri ('groups?$select={0}&$top=999' -f $sel) -All) }
    return (New-DEResult -Operation 'Get-DEGroup' -Target "$(if ($GroupId) { $GroupId } elseif ($Search) { "search:$Search" } else { 'all' })" -Message "$($items.Count) group(s)" -Data $items)
}
function Add-DEGroupMember {
    <# Idempotent: an existing member is Succeeded with nothing changed. Refuses dynamic groups (membership comes from the rule). #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$GroupId, [Parameter(Mandatory = $true)][string]$DirectoryObjectId, [switch]$DryRun)
    $g = Invoke-DEGraphRequest -Uri ('groups/{0}?$select=id,displayName,groupTypes' -f $GroupId)
    if (@($g.groupTypes) -contains 'DynamicMembership') { return (New-DEResult -Operation 'Add-DEGroupMember' -Status Refused -Target $GroupId -Message "$($g.displayName) is a dynamic group; change its rule instead") }
    $has = @(Invoke-DEGraphRequest -Uri ('groups/{0}/members?$filter=id eq {1}&$select=id&$count=true' -f $GroupId, (ConvertTo-DEODataLiteral $DirectoryObjectId)) -Eventual)
    if ($has.Count) { return (New-DEResult -Operation 'Add-DEGroupMember' -Target $GroupId -Message 'already a member; nothing changed' -Data ([pscustomobject]@{ groupId = $GroupId; memberId = $DirectoryObjectId; changed = $false })) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess("$($g.displayName)", "add member $DirectoryObjectId")) { return (New-DEResult -Operation 'Add-DEGroupMember' -Status DryRun -Target $GroupId -Message 'no change applied') }
    $null = Invoke-DEGraphRequest -Method POST -Uri "groups/$GroupId/members/`$ref" -Body @{ '@odata.id' = "$script:GraphRoot/v1.0/directoryObjects/$DirectoryObjectId" }
    return (New-DEResult -Operation 'Add-DEGroupMember' -Target $GroupId -Message "added to $($g.displayName)" -Data ([pscustomobject]@{ groupId = $GroupId; memberId = $DirectoryObjectId; changed = $true }))
}
function New-DETemporaryPassword {
    <# 16 characters from a cryptographic RNG, at least one of each class, built straight into a SecureString. #>
    param([ValidateRange(14, 64)][int]$Length = 16)
    $sets = @('ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#%^*-_=+?')
    $all = -join $sets
    $rng = New-Object Security.Cryptography.RNGCryptoServiceProvider
    try {
        $next = { param([int]$Max) $b = New-Object byte[] 4; $rng.GetBytes($b); [int]([BitConverter]::ToUInt32($b, 0) % [uint32]$Max) }
        $chars = New-Object System.Collections.Generic.List[char]
        foreach ($s in $sets) { $chars.Add($s[(& $next $s.Length)]) }
        while ($chars.Count -lt $Length) { $chars.Add($all[(& $next $all.Length)]) }
        for ($i = $chars.Count - 1; $i -gt 0; $i--) { $j = & $next ($i + 1); $t = $chars[$i]; $chars[$i] = $chars[$j]; $chars[$j] = $t }
        $ss = New-Object Security.SecureString; foreach ($c in $chars) { $ss.AppendChar($c) }; $chars.Clear(); $ss.MakeReadOnly()
        return $ss
    } finally { $rng.Dispose() }
}
function New-DEUser {
    <#
        Creates a cloud user. The UPN's domain must be verified in the tenant and the UPN must be free (an existing user
        is Refused, never a duplicate). The temporary password is generated here, never passed in and never written: it
        comes back once as a SecureString in data.temporaryPassword and must be changed at first sign-in. A Hub job gets
        the user but not the password (a SecureString serialises as its length): issue a Temporary Access Pass or reset
        it in the portal. Set -UsageLocation before assigning a licence.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$DisplayName, [Parameter(Mandatory = $true)][string]$UserPrincipalName, [string]$MailNickname,
        [string]$GivenName, [string]$Surname, [string]$JobTitle, [string]$Department, [ValidatePattern('^([A-Za-z]{2})?$')][string]$UsageLocation,
        [bool]$AccountEnabled = $true, [switch]$DryRun
    )
    if ($UserPrincipalName -notmatch '^[A-Za-z0-9._''-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$') { return (New-DEResult -Operation 'New-DEUser' -Status Refused -Target $UserPrincipalName -Message 'not a valid user principal name') }
    $domain = ($UserPrincipalName -split '@')[1]
    $verified = @(Invoke-DEGraphRequest -Uri 'domains?$select=id,isVerified' -All | Where-Object { "$($_.id)" -ieq $domain -and $_.isVerified })
    if (-not $verified.Count) { return (New-DEResult -Operation 'New-DEUser' -Status Refused -Target $UserPrincipalName -Message "$domain is not a verified domain in this tenant") }
    $existing = @(Invoke-DEGraphRequest -Uri ('users?$filter=userPrincipalName eq {0}&$select=id,displayName' -f (ConvertTo-DEODataLiteral $UserPrincipalName)))
    if ($existing.Count) { return (New-DEResult -Operation 'New-DEUser' -Status Refused -Target $UserPrincipalName -Message "already exists: $($existing[0].displayName) ($($existing[0].id))") }
    if (-not $MailNickname) { $MailNickname = (($UserPrincipalName -split '@')[0]) -replace '[^A-Za-z0-9._-]', '' }
    $body = [ordered]@{ accountEnabled = $AccountEnabled; displayName = $DisplayName; userPrincipalName = $UserPrincipalName; mailNickname = $MailNickname }
    foreach ($f in @(@('givenName', $GivenName), @('surname', $Surname), @('jobTitle', $JobTitle), @('department', $Department), @('usageLocation', $UsageLocation.ToUpperInvariant()))) { if ($f[1]) { $body[$f[0]] = $f[1] } }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($UserPrincipalName, 'create Entra user')) { return (New-DEResult -Operation 'New-DEUser' -Status DryRun -Target $UserPrincipalName -Message 'no change applied' -Data ([pscustomobject]$body)) }
    $pw = New-DETemporaryPassword
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($pw)
    try { $body['passwordProfile'] = @{ forceChangePasswordNextSignIn = $true; password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }; $created = Invoke-DEGraphRequest -Method POST -Uri 'users' -Body $body }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr); $body.Remove('passwordProfile') }
    $v = Invoke-DEGraphRequest -Uri ('users/{0}?$select=id,displayName,userPrincipalName,accountEnabled,usageLocation' -f $created.id)
    $note = $(if (-not $UsageLocation) { '; no usage location yet: set one before assigning a licence' } else { '' })
    return (New-DEResult -Operation 'New-DEUser' -Target $UserPrincipalName -Message "created $($v.userPrincipalName) (id $($v.id)); temporary password returned once as a SecureString, change required at first sign-in$note" -Data ([pscustomobject]@{ id = $v.id; userPrincipalName = $v.userPrincipalName; displayName = $v.displayName; accountEnabled = [bool]$v.accountEnabled; usageLocation = $v.usageLocation; temporaryPassword = $pw }))
}
function New-DEGroup {
    <#
        A security group or a Microsoft 365 group. Idempotent by mail nickname: the same group already there is Succeeded
        with nothing changed, a different one with that nickname is Refused. -Owner (UPNs or ids) are resolved first; a
        Microsoft 365 group made by an app-only session needs one.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][string]$DisplayName, [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._-]{1,64}$')][string]$MailNickname,
        [ValidateSet('Security', 'Microsoft365')][string]$Type = 'Security', [string]$Description, [string[]]$Owner = @(), [ValidateSet('Private', 'Public')][string]$Visibility = 'Private', [switch]$DryRun
    )
    $m365 = ($Type -eq 'Microsoft365')
    $existing = @(Invoke-DEGraphRequest -Uri ('groups?$filter=mailNickname eq {0}&$select=id,displayName,groupTypes,securityEnabled' -f (ConvertTo-DEODataLiteral $MailNickname)))
    if ($existing.Count) {
        $e = $existing[0]; $same = ("$($e.displayName)" -eq $DisplayName) -and ((@($e.groupTypes) -contains 'Unified') -eq $m365)
        return (New-DEResult -Operation 'New-DEGroup' -Status $(if ($same) { 'Succeeded' } else { 'Refused' }) -Target $MailNickname -Message $(if ($same) { "already exists (id $($e.id)); nothing changed" } else { "mail nickname $MailNickname is used by '$($e.displayName)' ($($e.id))" }) -Data $e)
    }
    $ownerIds = @()
    foreach ($o in @($Owner | Where-Object { $_ })) {
        try { $ownerIds += "$((Invoke-DEGraphRequest -Uri ('users/{0}?$select=id' -f [uri]::EscapeDataString($o))).id)" } catch { return (New-DEResult -Operation 'New-DEGroup' -Status Refused -Target $MailNickname -Message "owner '$o' not found") }
    }
    $body = [ordered]@{ displayName = $DisplayName; mailNickname = $MailNickname; mailEnabled = $m365; securityEnabled = (-not $m365); groupTypes = @($(if ($m365) { 'Unified' })) }
    if ($Description) { $body['description'] = $Description }
    if ($m365) { $body['visibility'] = $Visibility }
    if ($ownerIds.Count) { $body['owners@odata.bind'] = @($ownerIds | ForEach-Object { "$script:GraphRoot/v1.0/users/$_" }) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($DisplayName, "create $Type group")) { return (New-DEResult -Operation 'New-DEGroup' -Status DryRun -Target $MailNickname -Message 'no change applied' -Data ([pscustomobject]$body)) }
    $g = Invoke-DEGraphRequest -Method POST -Uri 'groups' -Body $body
    return (New-DEResult -Operation 'New-DEGroup' -Target $MailNickname -Message "created $Type group '$DisplayName' (id $($g.id))" -Data ([pscustomobject]@{ id = $g.id; displayName = $g.displayName; mailNickname = $MailNickname; type = $Type; owners = $ownerIds }))
}
function Get-DELicenseInventory {
    [CmdletBinding()] param()
    $s = @(Invoke-DEGraphRequest -Uri 'subscribedSkus')
    $rows = @($s | ForEach-Object { [pscustomobject]@{ sku = $_.skuPartNumber; skuId = $_.skuId; enabled = [int]$_.prepaidUnits.enabled; consumed = [int]$_.consumedUnits; available = [int]$_.prepaidUnits.enabled - [int]$_.consumedUnits; suspended = [int]$_.prepaidUnits.suspended; warning = [int]$_.prepaidUnits.warning } })
    return (New-DEResult -Operation 'Get-DELicenseInventory' -Message "$($rows.Count) SKU(s); $(@($rows | Where-Object { $_.available -lt 1 -and $_.enabled -gt 0 }).Count) with none left" -Data $rows)
}
function Get-DEConditionalAccessPolicy {
    [CmdletBinding()] param([string]$PolicyId)
    # @(...) outside, not $(...): $() unwraps a single item, and on Windows PowerShell 5.1 a lone object has no .Count
    $r = @(if ($PolicyId) { Invoke-DEGraphRequest -Uri "identity/conditionalAccess/policies/$PolicyId" } else { Invoke-DEGraphRequest -Uri 'identity/conditionalAccess/policies' -All })
    return (New-DEResult -Operation 'Get-DEConditionalAccessPolicy' -Message "$($r.Count) polic(ies); $(@($r | Where-Object { $_.state -eq 'enabled' }).Count) enabled" -Data $r)
}
function Set-DEConditionalAccessPolicyState {
    <#
        Turns a Conditional Access policy on, off, or to report-only, then reads it back. Enforcing a policy that targets
        all users with no excluded user or group is Refused (that is how tenants lock out their own break-glass account)
        unless -AllowNoExclusions. Going straight from off to enforced is allowed but called out: report-only first
        shows who it would block.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$PolicyId, [Parameter(Mandatory = $true)][ValidateSet('enabled', 'disabled', 'enabledForReportingButNotEnforced')][string]$State, [switch]$AllowNoExclusions, [switch]$DryRun)
    $id = [uri]::EscapeDataString($PolicyId)
    $p = Invoke-DEGraphRequest -Uri "identity/conditionalAccess/policies/$id"
    if ("$($p.state)" -eq $State) { return (New-DEResult -Operation 'Set-DEConditionalAccessPolicyState' -Target "$($p.displayName)" -Message "already $State; nothing changed" -Data ([pscustomobject]@{ id = $p.id; displayName = $p.displayName; state = $p.state })) }
    $note = ''
    if ($State -eq 'enabled') {
        $u = $p.conditions.users
        $all = @($u.includeUsers) -contains 'All'
        $excluded = @(@($u.excludeUsers) + @($u.excludeGroups) | Where-Object { $_ })
        if ($all -and -not $excluded.Count -and -not $AllowNoExclusions) { return (New-DEResult -Operation 'Set-DEConditionalAccessPolicyState' -Status Refused -Target "$($p.displayName)" -Message "'$($p.displayName)' applies to all users and excludes nobody: exclude the break-glass account first (or pass -AllowNoExclusions)") }
        if ("$($p.state)" -eq 'disabled') { $note = '; went from off straight to enforced (report-only first shows who it would block)' }
    }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess("$($p.displayName)", "set Conditional Access state $($p.state) -> $State")) { return (New-DEResult -Operation 'Set-DEConditionalAccessPolicyState' -Status DryRun -Target "$($p.displayName)" -Message "no change applied$note" -Data ([pscustomobject]@{ id = $p.id; from = $p.state; to = $State })) }
    $null = Invoke-DEGraphRequest -Method PATCH -Uri "identity/conditionalAccess/policies/$id" -Body @{ state = $State }
    $v = Invoke-DEGraphRequest -Uri "identity/conditionalAccess/policies/$id"
    $ok = ("$($v.state)" -eq $State)
    return (New-DEResult -Operation 'Set-DEConditionalAccessPolicyState' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target "$($p.displayName)" -Message $(if ($ok) { "state $($p.state) -> $State (read back)$note" } else { "read back state '$($v.state)'" }) -Data ([pscustomobject]@{ id = $v.id; displayName = $v.displayName; state = $v.state }))
}
function Get-DEMfaRegistration {
    <# Who can do MFA and passwordless (userRegistrationDetails). -UserPrincipalName narrows to one user. #>
    [CmdletBinding()] param([string]$UserPrincipalName)
    $uri = 'reports/authenticationMethods/userRegistrationDetails' + $(if ($UserPrincipalName) { '?$filter=userPrincipalName eq ' + (ConvertTo-DEODataLiteral $UserPrincipalName) } else { '' })
    $r = @(Invoke-DEGraphRequest -Uri $uri -All)
    return (New-DEResult -Operation 'Get-DEMfaRegistration' -Message "$($r.Count) user(s); $(@($r | Where-Object { -not $_.isMfaRegistered }).Count) without MFA" -Data @($r | ForEach-Object { [pscustomobject]@{ userPrincipalName = $_.userPrincipalName; mfaRegistered = [bool]$_.isMfaRegistered; mfaCapable = [bool]$_.isMfaCapable; passwordless = [bool]$_.isPasswordlessCapable; methods = @($_.methodsRegistered); isAdmin = [bool]$_.isAdmin } }))
}

# ============================================================ Entra devices and BitLocker escrow
function Get-DEEntraDevice {
    <# By the device ID that 'dsregcmd /status' shows (-DeviceId), or by name. #>
    [CmdletBinding()] param([string]$DeviceId, [string]$Name)
    if (-not $DeviceId -and -not $Name) { throw 'pass -DeviceId (from dsregcmd /status) or -Name' }
    $f = $(if ($DeviceId) { 'deviceId eq ' + (ConvertTo-DEODataLiteral $DeviceId) } else { 'displayName eq ' + (ConvertTo-DEODataLiteral $Name) })
    $r = @(Invoke-DEGraphRequest -Uri ('devices?$filter={0}&$select=id,deviceId,displayName,operatingSystem,trustType,accountEnabled,isManaged,isCompliant,approximateLastSignInDateTime' -f $f) -All)
    return (New-DEResult -Operation 'Get-DEEntraDevice' -Target "$(if ($DeviceId) { $DeviceId } else { $Name })" -Message "$($r.Count) device(s)" -Data $r)
}
function Test-DEEntraBitLockerEscrow {
    <#
        Proves a BitLocker recovery key for this device is escrowed in Entra ID before anything leaves Entra.
        Lists key IDs and dates only (BitLockerKey.ReadBasic.All): the key itself is never requested. With
        -KeyProtectorId (from manage-bde -protectors -get C: or Get-BitLockerVolume) it must be that exact key.
    #>
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$DeviceId, [string]$KeyProtectorId)
    # Graph requires ocp-client-name / ocp-client-version on BitLocker key reads (they go to the audit log)
    $keys = @(Invoke-DEGraphRequest -Uri ('informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq {0}' -f (ConvertTo-DEODataLiteral $DeviceId)) -All -Headers @{ 'ocp-client-name' = 'DE Microsoft Admin'; 'ocp-client-version' = '0.4.0' })
    $rows = @($keys | ForEach-Object { [pscustomobject]@{ keyId = "$($_.id)"; created = $_.createdDateTime; volumeType = "$($_.volumeType)" } })
    $want = "$KeyProtectorId".Trim('{', '}').ToLowerInvariant()
    # @(...) outside: $() would unwrap one match into a [pscustomobject], which has no .Count on Windows PowerShell 5.1
    # (the escrowed key would read as missing)
    $match = @(if ($want) { $rows | Where-Object { $_.keyId.ToLowerInvariant() -eq $want } } else { $rows | Where-Object { "$($_.volumeType)" -in @('1', 'operatingSystemVolume') } })   # a data or USB drive key is not the OS key
    $ok = $match.Count -gt 0
    $msg = $(if (-not $rows.Count) { 'no recovery key for this device in Entra ID' } elseif ($want -and -not $ok) { "Entra holds $($rows.Count) key(s) but not protector $KeyProtectorId" } else { "escrowed: $(@($match | ForEach-Object { $_.keyId }) -join ', ')" })
    return (New-DEResult -Operation 'Test-DEEntraBitLockerEscrow' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $DeviceId -Message $msg -Data ([pscustomobject]@{ deviceId = $DeviceId; escrowed = $ok; keys = $rows }))
}

# ============================================================ Exchange Online
function Connect-DEExchange {
    <#
        User sign-in: -UserPrincipalName (interactive, modern auth). App-only (the Hub worker, unattended): -AppId (or
        -ClientId) and -CertificateThumbprint of a certificate in the worker's store, and -Organization, the tenant's
        <name>.onmicrosoft.com domain. The app needs Exchange.ManageAsApp and an Exchange admin role on its service
        principal. No client secret, certificate file or password is ever accepted.
    #>
    [CmdletBinding(DefaultParameterSetName = 'User')]
    param(
        [Parameter(ParameterSetName = 'User', Mandatory = $true)][string]$UserPrincipalName,
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][Alias('ClientId')][string]$AppId,
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][string]$CertificateThumbprint,
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][ValidatePattern('^[A-Za-z0-9][A-Za-z0-9-]*\.onmicrosoft\.(com|us)$')][string]$Organization
    )
    Assert-DECommand 'Connect-ExchangeOnline' 'ExchangeOnlineManagement'
    if ($PSCmdlet.ParameterSetName -eq 'App') {
        Connect-ExchangeOnline -AppId $AppId -CertificateThumbprint $CertificateThumbprint -Organization $Organization -ShowBanner:$false -ErrorAction Stop | Out-Null
        $script:ServiceSessions.Exchange = [pscustomobject]@{ mode = 'app'; target = $Organization; tenant = $script:Ctx.TenantId }
        return (New-DEResult -Operation 'Connect-DEExchange' -Target $Organization -Data ([pscustomobject]@{ organization = $Organization; appId = $AppId; mode = 'app'; connected = $true }))
    }
    Connect-ExchangeOnline -UserPrincipalName $UserPrincipalName -ShowBanner:$false -ErrorAction Stop | Out-Null
    $script:ServiceSessions.Exchange = [pscustomobject]@{ mode = 'user'; target = $UserPrincipalName; tenant = $script:Ctx.TenantId }
    return (New-DEResult -Operation 'Connect-DEExchange' -Target $UserPrincipalName -Data ([pscustomobject]@{ userPrincipalName = $UserPrincipalName; connected = $true }))
}
function Get-DEMailbox {
    [CmdletBinding()] param([string]$Identity, [ValidateSet('All', 'UserMailbox', 'SharedMailbox', 'RoomMailbox', 'EquipmentMailbox')][string]$Type = 'All')
    Assert-DECommand 'Get-EXOMailbox' 'ExchangeOnlineManagement'
    $p = @{ ErrorAction = 'Stop'; Properties = @('DisplayName', 'PrimarySmtpAddress', 'RecipientTypeDetails', 'ForwardingSmtpAddress', 'HiddenFromAddressListsEnabled') }
    if ($Identity) { $p.Identity = $Identity } else { $p.ResultSize = 'Unlimited'; if ($Type -ne 'All') { $p.RecipientTypeDetails = $Type } }
    $items = @(Get-EXOMailbox @p | Select-Object DisplayName, PrimarySmtpAddress, RecipientTypeDetails, ForwardingSmtpAddress, HiddenFromAddressListsEnabled)
    return (New-DEResult -Operation 'Get-DEMailbox' -Target "$(if ($Identity) { $Identity } else { $Type })" -Message "$($items.Count) mailbox(es)" -Data $items)
}
function New-DESharedMailbox {
    <# Idempotent: an address that already exists is Refused with what it is, never a second mailbox. #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$DisplayName, [Parameter(Mandatory = $true)][string]$Alias, [Parameter(Mandatory = $true)][string]$PrimarySmtpAddress, [switch]$DryRun)
    Assert-DECommand 'Get-EXORecipient' 'ExchangeOnlineManagement'
    $existing = @(Get-EXORecipient -Identity $PrimarySmtpAddress -ErrorAction SilentlyContinue)
    if ($existing.Count) { return (New-DEResult -Operation 'New-DESharedMailbox' -Status Refused -Target $PrimarySmtpAddress -Message "address already used by $($existing[0].RecipientTypeDetails) '$($existing[0].DisplayName)'") }
    $payload = [pscustomobject]@{ displayName = $DisplayName; alias = $Alias; primarySmtpAddress = $PrimarySmtpAddress }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($PrimarySmtpAddress, 'create shared mailbox')) { return (New-DEResult -Operation 'New-DESharedMailbox' -Status DryRun -Target $PrimarySmtpAddress -Message 'no change applied' -Data $payload) }
    Assert-DECommand 'New-Mailbox' 'ExchangeOnlineManagement'
    $m = New-Mailbox -Shared -Name $DisplayName -DisplayName $DisplayName -Alias $Alias -PrimarySmtpAddress $PrimarySmtpAddress -ErrorAction Stop
    return (New-DEResult -Operation 'New-DESharedMailbox' -Target $PrimarySmtpAddress -Message 'created (shared mailboxes need no licence under 50 GB)' -Data ($m | Select-Object DisplayName, Alias, PrimarySmtpAddress, RecipientTypeDetails))
}
function Set-DEMailboxPermission {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$MailboxId, [Parameter(Mandatory = $true)][string]$MemberId, [ValidateSet('FullAccess', 'SendAs', 'SendOnBehalf')][string]$Permission = 'FullAccess', [bool]$AutoMapping = $true, [switch]$DryRun)
    $payload = [pscustomobject]@{ mailbox = $MailboxId; member = $MemberId; permission = $Permission; autoMapping = $AutoMapping }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($MailboxId, "grant $Permission to $MemberId")) { return (New-DEResult -Operation 'Set-DEMailboxPermission' -Status DryRun -Target $MailboxId -Message 'no change applied' -Data $payload) }
    switch ($Permission) {
        'FullAccess' { Assert-DECommand 'Add-MailboxPermission' 'ExchangeOnlineManagement'; $null = Add-MailboxPermission -Identity $MailboxId -User $MemberId -AccessRights FullAccess -InheritanceType All -AutoMapping $AutoMapping -ErrorAction Stop }
        'SendAs' { Assert-DECommand 'Add-RecipientPermission' 'ExchangeOnlineManagement'; $null = Add-RecipientPermission -Identity $MailboxId -Trustee $MemberId -AccessRights SendAs -Confirm:$false -ErrorAction Stop }
        'SendOnBehalf' { Assert-DECommand 'Set-Mailbox' 'ExchangeOnlineManagement'; $null = Set-Mailbox -Identity $MailboxId -GrantSendOnBehalfTo @{ Add = $MemberId } -ErrorAction Stop }
    }
    return (New-DEResult -Operation 'Set-DEMailboxPermission' -Target $MailboxId -Message "$Permission granted to $MemberId" -Data $payload)
}

function Get-DEAcceptedDomainName { Assert-DECommand 'Get-AcceptedDomain' 'ExchangeOnlineManagement'; return @(Get-AcceptedDomain -ErrorAction Stop | ForEach-Object { "$($_.DomainName)".ToLowerInvariant() }) }
function Set-DEMailboxAlias {
    <#
        Adds or removes a secondary SMTP address, then reads it back. Adding needs an accepted domain and an address no
        other recipient uses; removing the primary address is Refused. Already there / already gone is Succeeded with
        nothing changed.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Identity, [Parameter(Mandatory = $true)][string]$Address, [ValidateSet('Add', 'Remove')][string]$Action = 'Add', [switch]$DryRun)
    if ($Address -notmatch '^[A-Za-z0-9._%+''-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$') { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status Refused -Target $Identity -Message "'$Address' is not an email address") }
    Assert-DECommand 'Get-EXOMailbox' 'ExchangeOnlineManagement'
    $mb = Get-EXOMailbox -Identity $Identity -Properties EmailAddresses, PrimarySmtpAddress, ExternalDirectoryObjectId -ErrorAction Stop
    $has = [bool]@($mb.EmailAddresses | Where-Object { "$_" -ieq "smtp:$Address" }).Count
    if (($Action -eq 'Add') -eq $has) { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Target "$($mb.PrimarySmtpAddress)" -Message "$Address is $(if ($has) { 'already' } else { 'not' }) an address of this mailbox; nothing changed") }
    if ($Action -eq 'Remove' -and "$($mb.PrimarySmtpAddress)" -ieq $Address) { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status Refused -Target "$($mb.PrimarySmtpAddress)" -Message 'that is the primary address; set another primary first') }
    if ($Action -eq 'Add') {
        $dom = ($Address -split '@')[1].ToLowerInvariant()
        if ((Get-DEAcceptedDomainName) -notcontains $dom) { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status Refused -Target "$($mb.PrimarySmtpAddress)" -Message "$dom is not an accepted domain in Exchange Online") }
        Assert-DECommand 'Get-EXORecipient' 'ExchangeOnlineManagement'
        $other = @(Get-EXORecipient -Identity $Address -ErrorAction SilentlyContinue | Where-Object { "$($_.ExternalDirectoryObjectId)" -ne "$($mb.ExternalDirectoryObjectId)" })
        if ($other.Count) { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status Refused -Target "$($mb.PrimarySmtpAddress)" -Message "$Address already belongs to $($other[0].RecipientTypeDetails) '$($other[0].DisplayName)'") }
    }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess("$($mb.PrimarySmtpAddress)", "$Action address $Address")) { return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status DryRun -Target "$($mb.PrimarySmtpAddress)" -Message 'no change applied' -Data ([pscustomobject]@{ mailbox = "$($mb.PrimarySmtpAddress)"; action = $Action; address = $Address })) }
    Assert-DECommand 'Set-Mailbox' 'ExchangeOnlineManagement'
    $null = Set-Mailbox -Identity $Identity -EmailAddresses @{ $Action = "smtp:$Address" } -ErrorAction Stop
    $after = Get-EXOMailbox -Identity $Identity -Properties EmailAddresses -ErrorAction Stop
    $now = [bool]@($after.EmailAddresses | Where-Object { "$_" -ieq "smtp:$Address" }).Count
    $ok = ($now -eq ($Action -eq 'Add'))
    return (New-DEResult -Operation 'Set-DEMailboxAlias' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target "$($mb.PrimarySmtpAddress)" -Message $(if ($ok) { "$Action $Address (read back)" } else { "read back: $Address $(if ($now) { 'still present' } else { 'missing' })" }) -Data ([pscustomobject]@{ mailbox = "$($mb.PrimarySmtpAddress)"; addresses = @($after.EmailAddresses | ForEach-Object { "$_" }) }))
}
function Set-DEMailboxForwarding {
    <#
        Forwards a mailbox (-ForwardTo) or stops forwarding (-Disable), then reads it back. A copy stays in the mailbox
        unless -KeepCopy $false. Forwarding outside the tenant's accepted domains is Refused without -AllowExternal:
        it is the classic way mail is exfiltrated, and Microsoft's outbound spam policy blocks automatic external
        forwarding by default (allow it there for this mailbox too).
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$Identity, [string]$ForwardTo, [switch]$Disable, [bool]$KeepCopy = $true, [switch]$AllowExternal, [switch]$DryRun)
    if ([bool]$ForwardTo -eq [bool]$Disable) { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Status Refused -Target $Identity -Message 'pass exactly one of -ForwardTo or -Disable') }
    if ($ForwardTo -and $ForwardTo -notmatch '^[A-Za-z0-9._%+''-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$') { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Status Refused -Target $Identity -Message "'$ForwardTo' is not an email address") }
    Assert-DECommand 'Get-EXOMailbox' 'ExchangeOnlineManagement'
    $mb = Get-EXOMailbox -Identity $Identity -Properties PrimarySmtpAddress, ForwardingSmtpAddress, ForwardingAddress, DeliverToMailboxAndForward -ErrorAction Stop
    $current = ("$($mb.ForwardingSmtpAddress)" -replace '^smtp:', '')
    if ($Disable -and -not $current -and -not "$($mb.ForwardingAddress)") { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Target "$($mb.PrimarySmtpAddress)" -Message 'not forwarding; nothing changed') }
    if ($ForwardTo -and $current -ieq $ForwardTo -and [bool]$mb.DeliverToMailboxAndForward -eq $KeepCopy) { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Target "$($mb.PrimarySmtpAddress)" -Message "already forwarding to $ForwardTo; nothing changed") }
    $external = $false
    if ($ForwardTo) {
        $external = ((Get-DEAcceptedDomainName) -notcontains ($ForwardTo -split '@')[1].ToLowerInvariant())
        if ($external -and -not $AllowExternal) { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Status Refused -Target "$($mb.PrimarySmtpAddress)" -Message "$ForwardTo is outside this tenant: external forwarding is how mail is exfiltrated. Pass -AllowExternal if the client approved it, and allow it in the outbound spam policy for this mailbox") }
    }
    $what = $(if ($Disable) { 'stop forwarding' } else { "forward to $ForwardTo$(if ($external) { ' (EXTERNAL)' })$(if (-not $KeepCopy) { ' without keeping a copy' })" })
    if ($DryRun -or -not $PSCmdlet.ShouldProcess("$($mb.PrimarySmtpAddress)", $what)) { return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Status DryRun -Target "$($mb.PrimarySmtpAddress)" -Message "no change applied ($what)") }
    Assert-DECommand 'Set-Mailbox' 'ExchangeOnlineManagement'
    if ($Disable) { $null = Set-Mailbox -Identity $Identity -ForwardingSmtpAddress $null -ForwardingAddress $null -DeliverToMailboxAndForward $false -ErrorAction Stop }
    else { $null = Set-Mailbox -Identity $Identity -ForwardingSmtpAddress "smtp:$ForwardTo" -DeliverToMailboxAndForward $KeepCopy -ErrorAction Stop }
    $a = Get-EXOMailbox -Identity $Identity -Properties ForwardingSmtpAddress, ForwardingAddress, DeliverToMailboxAndForward -ErrorAction Stop
    $now = ("$($a.ForwardingSmtpAddress)" -replace '^smtp:', '')
    $ok = $(if ($Disable) { -not $now -and -not "$($a.ForwardingAddress)" } else { $now -ieq $ForwardTo })
    return (New-DEResult -Operation 'Set-DEMailboxForwarding' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target "$($mb.PrimarySmtpAddress)" -Message $(if ($ok) { "$what (read back)" } else { "read back forwarding '$now'" }) -Data ([pscustomobject]@{ mailbox = "$($mb.PrimarySmtpAddress)"; forwardingSmtpAddress = $now; keepCopy = [bool]$a.DeliverToMailboxAndForward; external = $external }))
}
function Get-DETransportRule {
    <# Mail flow rules, summarised, with the ones worth a look flagged: they redirect or copy mail, skip spam filtering (SCL -1) or delete messages. #>
    [CmdletBinding()] param()
    Assert-DECommand 'Get-TransportRule' 'ExchangeOnlineManagement'
    $rows = @(Get-TransportRule -ErrorAction Stop | ForEach-Object {
            $flags = @()
            if (@($_.RedirectMessageTo | Where-Object { $_ }).Count) { $flags += 'redirects mail' }
            if (@($_.BlindCopyTo | Where-Object { $_ }).Count -or @($_.AddToRecipients | Where-Object { $_ }).Count) { $flags += 'copies mail to others' }
            if ("$($_.SetSCL)" -eq '-1') { $flags += 'bypasses spam filtering' }
            if ($_.DeleteMessage -eq $true) { $flags += 'deletes messages' }
            [pscustomobject]@{ name = "$($_.Name)"; state = "$($_.State)"; mode = "$($_.Mode)"; priority = $_.Priority; description = "$($_.Description)"; flags = $flags }
        })
    $risky = @($rows | Where-Object { $_.flags.Count })
    return (New-DEResult -Operation 'Get-DETransportRule' -Message "$($rows.Count) rule(s); $($risky.Count) worth a look$(if ($risky.Count) { ': ' + (($risky | ForEach-Object { "$($_.name) ($($_.flags -join ', '))" }) -join '; ') })" -Data $rows)
}

# ============================================================ Azure
function Connect-DEAzure {
    <#
        Interactive: -TenantId (and -SubscriptionId). Service principal (the Hub worker, unattended): -ServicePrincipal
        with -ApplicationId (or -ClientId) and -CertificateThumbprint of a certificate in the worker's store, -TenantId,
        and optionally -SubscriptionId. The service principal needs an Azure RBAC role on the subscription(s). No
        client secret, certificate file or password is ever accepted.
    #>
    [CmdletBinding(DefaultParameterSetName = 'Interactive')]
    param(
        [Parameter(Mandatory = $true)][string]$TenantId,
        [string]$SubscriptionId,
        [Parameter(ParameterSetName = 'ServicePrincipal', Mandatory = $true)][switch]$ServicePrincipal,
        [Parameter(ParameterSetName = 'ServicePrincipal', Mandatory = $true)][Alias('ClientId', 'AppId')][string]$ApplicationId,
        [Parameter(ParameterSetName = 'ServicePrincipal', Mandatory = $true)][string]$CertificateThumbprint
    )
    Assert-DECommand 'Connect-AzAccount' 'Az.Accounts'
    if ($PSCmdlet.ParameterSetName -eq 'ServicePrincipal') {
        $p = @{ ServicePrincipal = $true; ApplicationId = $ApplicationId; CertificateThumbprint = $CertificateThumbprint; Tenant = $TenantId; ErrorAction = 'Stop' }
        if ($SubscriptionId) { $p['Subscription'] = $SubscriptionId }
        Connect-AzAccount @p | Out-Null
        $script:ServiceSessions.Azure = [pscustomobject]@{ mode = 'service-principal'; target = $(if ($SubscriptionId) { $SubscriptionId } else { $TenantId }); tenant = $TenantId }
    } else {
        Connect-AzAccount -Tenant $TenantId -ErrorAction Stop | Out-Null
        if ($SubscriptionId) { Set-AzContext -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null }
        $script:ServiceSessions.Azure = [pscustomobject]@{ mode = 'interactive'; target = $(if ($SubscriptionId) { $SubscriptionId } else { $TenantId }); tenant = $TenantId }
    }
    $c = Get-AzContext
    return (New-DEResult -Operation 'Connect-DEAzure' -Target "$($c.Subscription.Name)" -Data ([pscustomobject]@{ tenant = "$($c.Tenant.Id)"; subscription = "$($c.Subscription.Name)"; subscriptionId = "$($c.Subscription.Id)"; account = "$($c.Account.Id)" }))
}
function Get-DEAzureSubscription {
    [CmdletBinding()] param()
    Assert-DECommand 'Get-AzSubscription' 'Az.Accounts'
    $s = @(Get-AzSubscription -ErrorAction Stop | ForEach-Object { [pscustomobject]@{ name = "$($_.Name)"; id = "$($_.Id)"; state = "$($_.State)"; tenantId = "$($_.TenantId)" } })
    return (New-DEResult -Operation 'Get-DEAzureSubscription' -Message "$($s.Count) subscription(s); $(@($s | Where-Object { $_.state -ne 'Enabled' }).Count) not enabled" -Data $s)
}
function Get-DEAzureInventory {
    <# Resources summarised by type and resource group (the raw list is in data.resources). #>
    [CmdletBinding()] param([string]$ResourceGroupName)
    Assert-DECommand 'Get-AzResource' 'Az.Resources'
    $res = @($(if ($ResourceGroupName) { Get-AzResource -ResourceGroupName $ResourceGroupName } else { Get-AzResource }) | Select-Object Name, ResourceType, ResourceGroupName, Location, Tags)
    return (New-DEResult -Operation 'Get-DEAzureInventory' -Message "$($res.Count) resource(s)" -Data ([pscustomobject]@{ byType = @($res | Group-Object ResourceType | Sort-Object Count -Descending | ForEach-Object { [pscustomobject]@{ type = $_.Name; count = $_.Count } }); byGroup = @($res | Group-Object ResourceGroupName | ForEach-Object { [pscustomobject]@{ group = $_.Name; count = $_.Count } }); resources = $res }))
}
function New-DEAzureResourceGroup {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Name, [Parameter(Mandatory = $true)][string]$Location, [hashtable]$Tags = @{}, [switch]$DryRun)
    Assert-DECommand 'Get-AzResourceGroup' 'Az.Resources'
    $e = Get-AzResourceGroup -Name $Name -ErrorAction SilentlyContinue
    if ($e) { return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Status $(if (($e.Location -replace '\s') -eq ($Location -replace '\s')) { 'Succeeded' } else { 'Refused' }) -Target $Name -Message $(if (($e.Location -replace '\s') -eq ($Location -replace '\s')) { 'already exists; nothing changed' } else { "exists in $($e.Location), not $Location" })) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Name, "create resource group in $Location")) { return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Status DryRun -Target $Name -Message 'no change applied' -Data ([pscustomobject]@{ name = $Name; location = $Location; tags = $Tags })) }
    $r = New-AzResourceGroup -Name $Name -Location $Location -Tag $Tags -ErrorAction Stop
    return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Target $Name -Message "created in $Location" -Data ($r | Select-Object ResourceGroupName, Location, ProvisioningState))
}

function New-DEAzureResourceLock {
    <#
        A management lock on a resource group, or on one resource (-ResourceName with -ResourceType, e.g.
        Microsoft.Storage/storageAccounts). The same lock already there is Succeeded with nothing changed; a lock of
        that name at another level is Refused. ReadOnly also blocks routine operations (for example listing storage
        keys or scaling), so CanNotDelete is usually what a client wants.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$LockName, [ValidateSet('CanNotDelete', 'ReadOnly')][string]$LockLevel = 'CanNotDelete', [Parameter(Mandatory = $true)][string]$ResourceGroupName, [string]$ResourceName, [string]$ResourceType, [string]$Notes, [switch]$DryRun)
    if ($ResourceName -and -not $ResourceType) { return (New-DEResult -Operation 'New-DEAzureResourceLock' -Status Refused -Target $ResourceName -Message 'a lock on one resource needs -ResourceType (for example Microsoft.Storage/storageAccounts)') }
    Assert-DECommand 'Get-AzResourceLock' 'Az.Resources'
    $scope = @{ ResourceGroupName = $ResourceGroupName }; if ($ResourceName) { $scope.ResourceName = $ResourceName; $scope.ResourceType = $ResourceType }
    $target = $(if ($ResourceName) { "$ResourceGroupName/$ResourceName" } else { $ResourceGroupName })
    $e = @(Get-AzResourceLock @scope -LockName $LockName -ErrorAction SilentlyContinue)
    if ($e.Count) {
        $lvl = "$($e[0].Properties.level)"
        return (New-DEResult -Operation 'New-DEAzureResourceLock' -Status $(if ($lvl -eq $LockLevel) { 'Succeeded' } else { 'Refused' }) -Target $target -Message $(if ($lvl -eq $LockLevel) { "$LockLevel lock '$LockName' already there; nothing changed" } else { "lock '$LockName' exists at level $lvl, not $LockLevel" }))
    }
    $warn = $(if ($LockLevel -eq 'ReadOnly') { ' (ReadOnly also blocks routine operations such as listing keys and scaling)' } else { '' })
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($target, "add $LockLevel lock '$LockName'$warn")) { return (New-DEResult -Operation 'New-DEAzureResourceLock' -Status DryRun -Target $target -Message "no change applied$warn" -Data ([pscustomobject]@{ lock = $LockName; level = $LockLevel; scope = $target })) }
    Assert-DECommand 'New-AzResourceLock' 'Az.Resources'
    $p = @{ LockName = $LockName; LockLevel = $LockLevel; Force = $true; ErrorAction = 'Stop' } + $scope; if ($Notes) { $p.LockNotes = $Notes }
    $null = New-AzResourceLock @p
    $ok = [bool]@(Get-AzResourceLock @scope -LockName $LockName -ErrorAction SilentlyContinue).Count
    return (New-DEResult -Operation 'New-DEAzureResourceLock' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $target -Message $(if ($ok) { "$LockLevel lock '$LockName' added (read back)$warn" } else { 'lock not found after creating it' }) -Data ([pscustomobject]@{ lock = $LockName; level = $LockLevel; scope = $target }))
}

# ============================================================ Intune and Autopilot
function Get-DEIntuneDevice {
    <# -Serial and -UserPrincipalName filter on the server; -Search matches the device name. #>
    [CmdletBinding()] param([string]$Serial, [string]$UserPrincipalName, [string]$Search)
    $sel = 'id,deviceName,serialNumber,manufacturer,model,operatingSystem,osVersion,complianceState,managementAgent,userPrincipalName,lastSyncDateTime,azureADDeviceId,isEncrypted'
    $f = $(if ($Serial) { 'serialNumber eq ' + (ConvertTo-DEODataLiteral $Serial) } elseif ($UserPrincipalName) { 'userPrincipalName eq ' + (ConvertTo-DEODataLiteral $UserPrincipalName) } elseif ($Search) { "contains(deviceName,$(ConvertTo-DEODataLiteral $Search))" } else { $null })
    $uri = 'deviceManagement/managedDevices?$select=' + $sel + $(if ($f) { '&$filter=' + $f } else { '' })
    $r = @(Invoke-DEGraphRequest -Uri $uri -All)
    return (New-DEResult -Operation 'Get-DEIntuneDevice' -Target "$(if ($f) { $f } else { 'all' })" -Message "$($r.Count) device(s); $(@($r | Where-Object { $_.complianceState -ne 'compliant' }).Count) not compliant" -Data $r)
}
function Get-DEIntuneCompliancePolicy { [CmdletBinding()] param() $r = @(Invoke-DEGraphRequest -Uri 'deviceManagement/deviceCompliancePolicies' -All); return (New-DEResult -Operation 'Get-DEIntuneCompliancePolicy' -Message "$($r.Count) polic(ies)" -Data $r) }
function Get-DEIntuneConfigurationProfile {
    <# Classic profiles (deviceConfigurations) and Settings Catalog policies (configurationPolicies). #>
    [CmdletBinding()] param()
    $classic = @(Invoke-DEGraphRequest -Uri 'deviceManagement/deviceConfigurations?$select=id,displayName,lastModifiedDateTime' -All)
    $catalog = @(Invoke-DEGraphRequest -Uri 'deviceManagement/configurationPolicies?$select=id,name,platforms,technologies,lastModifiedDateTime' -All)
    return (New-DEResult -Operation 'Get-DEIntuneConfigurationProfile' -Message "$($classic.Count) classic, $($catalog.Count) settings catalog" -Data ([pscustomobject]@{ classic = $classic; settingsCatalog = $catalog }))
}
function Sync-DEIntuneDevice {
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$ManagedDeviceId, [switch]$DryRun)
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($ManagedDeviceId, 'request an Intune sync')) { return (New-DEResult -Operation 'Sync-DEIntuneDevice' -Status DryRun -Target $ManagedDeviceId -Message 'no change applied') }
    $null = Invoke-DEGraphRequest -Method POST -Uri "deviceManagement/managedDevices/$ManagedDeviceId/syncDevice"
    return (New-DEResult -Operation 'Sync-DEIntuneDevice' -Target $ManagedDeviceId -Message 'sync requested (the device checks in within minutes)')
}
function Invoke-DEIntuneDeviceAction {
    <#
        Sync, Restart, Lock, Retire, Wipe or FreshStart on one Intune device, looked up first. Retire, Wipe and FreshStart
        remove company data (Wipe resets the device), so they need -ConfirmDeviceName with the device's exact name: an
        id pasted from the wrong row cannot wipe the wrong laptop. Remote lock is not supported on Windows. The result
        carries Intune's own action state (pending until the device checks in).
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$ManagedDeviceId, [Parameter(Mandatory = $true)][ValidateSet('Sync', 'Restart', 'Lock', 'Retire', 'Wipe', 'FreshStart')][string]$Action, [string]$ConfirmDeviceName, [switch]$KeepEnrollmentData, [switch]$KeepUserData, [switch]$ProtectedWipe, [switch]$DryRun)
    $graphAction = @{ Sync = 'syncDevice'; Restart = 'rebootNow'; Lock = 'remoteLock'; Retire = 'retire'; Wipe = 'wipe'; FreshStart = 'cleanWindowsDevice' }[$Action]
    $id = [uri]::EscapeDataString($ManagedDeviceId)
    $d = Invoke-DEGraphRequest -Uri ('deviceManagement/managedDevices/{0}?$select=id,deviceName,serialNumber,operatingSystem,userPrincipalName,managementAgent' -f $id)
    $label = "$($d.deviceName) ($($d.serialNumber), $($d.userPrincipalName))"
    $windows = ("$($d.operatingSystem)" -like 'Windows*')
    if ($Action -eq 'Lock' -and $windows) { return (New-DEResult -Operation 'Invoke-DEIntuneDeviceAction' -Status Refused -Target "$($d.deviceName)" -Message 'Intune remote lock is not supported on Windows; use Restart, or disable the user and revoke sessions') }
    if ($Action -eq 'FreshStart' -and -not $windows) { return (New-DEResult -Operation 'Invoke-DEIntuneDeviceAction' -Status Refused -Target "$($d.deviceName)" -Message 'Fresh Start is Windows only') }
    if ($Action -in @('Retire', 'Wipe', 'FreshStart') -and "$ConfirmDeviceName" -cne "$($d.deviceName)") { return (New-DEResult -Operation 'Invoke-DEIntuneDeviceAction' -Status Refused -Target "$($d.deviceName)" -Message "$Action removes company data$(if ($Action -eq 'Wipe') { ' and resets the device' }): pass -ConfirmDeviceName '$($d.deviceName)' to confirm this is the device") }
    $body = $null
    if ($Action -eq 'Wipe') { $body = @{ keepEnrollmentData = [bool]$KeepEnrollmentData; keepUserData = [bool]$KeepUserData; useProtectedWipe = [bool]$ProtectedWipe } }
    elseif ($Action -eq 'FreshStart') { $body = @{ keepUserData = [bool]$KeepUserData } }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($label, "Intune $Action")) { return (New-DEResult -Operation 'Invoke-DEIntuneDeviceAction' -Status DryRun -Target "$($d.deviceName)" -Message "no change applied ($Action $label)" -Data ([pscustomobject]@{ id = $d.id; action = $graphAction; body = $body })) }
    $null = Invoke-DEGraphRequest -Method POST -Uri "deviceManagement/managedDevices/$id/$graphAction" -Body $body
    $state = 'requested'
    try { $s = @((Invoke-DEGraphRequest -Uri ('deviceManagement/managedDevices/{0}?$select=deviceActionResults' -f $id)).deviceActionResults | Where-Object { "$($_.actionName)" -ieq $graphAction }) | Select-Object -Last 1; if ($s) { $state = "$($s.actionState)" } } catch { Write-Verbose "action state not read yet: $($_.Exception.Message)" }
    return (New-DEResult -Operation 'Invoke-DEIntuneDeviceAction' -Target "$($d.deviceName)" -Message "$Action requested for $label; Intune reports: $state (the device acts when it next checks in)" -Data ([pscustomobject]@{ id = $d.id; deviceName = $d.deviceName; action = $graphAction; actionState = $state }))
}
function Get-DEAutopilotDevice {
    [CmdletBinding()] param([string]$Serial)
    $uri = 'deviceManagement/windowsAutopilotDeviceIdentities' + $(if ($Serial) { '?$filter=' + "contains(serialNumber,$(ConvertTo-DEODataLiteral $Serial))" } else { '' })
    $r = @(Invoke-DEGraphRequest -Uri $uri -All)
    return (New-DEResult -Operation 'Get-DEAutopilotDevice' -Target "$(if ($Serial) { $Serial } else { 'all' })" -Message "$($r.Count) device(s)" -Data @($r | ForEach-Object { [pscustomobject]@{ id = $_.id; serial = $_.serialNumber; manufacturer = $_.manufacturer; model = $_.model; groupTag = $_.groupTag; profileStatus = $_.deploymentProfileAssignmentStatus; managedDeviceId = $_.managedDeviceId; azureAdDeviceId = $_.azureActiveDirectoryDeviceId } }))
}
function Get-DEAutopilotProfile {
    <# Deployment profiles are only in Graph beta. #>
    [CmdletBinding()] param()
    $r = @(Invoke-DEGraphRequest -Uri 'deviceManagement/windowsAutopilotDeploymentProfiles?$select=id,displayName,description,deviceNameTemplate,lastModifiedDateTime' -All -Beta)
    return (New-DEResult -Operation 'Get-DEAutopilotProfile' -Message "$($r.Count) profile(s) (Graph beta)" -Data $r)
}
function Find-DEAutopilotBySerial {
    <# Autopilot identities whose serial is exactly -Serial (Graph's filter is 'contains', so near misses are dropped here). #>
    param([Parameter(Mandatory = $true)][string]$Serial)
    return @(Invoke-DEGraphRequest -Uri ('deviceManagement/windowsAutopilotDeviceIdentities?$filter=contains(serialNumber,{0})' -f (ConvertTo-DEODataLiteral $Serial)) -All | Where-Object { "$($_.serialNumber)".Trim() -ieq $Serial.Trim() })
}
function Set-DEAutopilotGroupTag {
    <#
        Sets the group tag (it drives dynamic groups and so profile assignment) on the Autopilot record with exactly this
        serial; none or several is Refused. Graph needs updateDeviceProperties (a PATCH is accepted and ignored). The
        change can take a few minutes to show: a read-back that still has the old tag is Partial, not Failed.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Serial, [Parameter(Mandatory = $true)][AllowEmptyString()][ValidatePattern('^[A-Za-z0-9 _.-]{0,200}$')][string]$GroupTag, [switch]$DryRun)
    $exact = @(Find-DEAutopilotBySerial -Serial $Serial)
    if ($exact.Count -ne 1) { return (New-DEResult -Operation 'Set-DEAutopilotGroupTag' -Status Refused -Target $Serial -Message "$($exact.Count) Autopilot record(s) with exactly this serial; nothing changed") }
    $ap = $exact[0]
    if ("$($ap.groupTag)" -ceq $GroupTag) { return (New-DEResult -Operation 'Set-DEAutopilotGroupTag' -Target $Serial -Message "group tag is already '$GroupTag'; nothing changed") }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Serial, "set Autopilot group tag '$($ap.groupTag)' -> '$GroupTag'")) { return (New-DEResult -Operation 'Set-DEAutopilotGroupTag' -Status DryRun -Target $Serial -Message 'no change applied' -Data ([pscustomobject]@{ id = $ap.id; from = "$($ap.groupTag)"; to = $GroupTag })) }
    $null = Invoke-DEGraphRequest -Method POST -Uri "deviceManagement/windowsAutopilotDeviceIdentities/$($ap.id)/updateDeviceProperties" -Body @{ groupTag = $GroupTag }
    $now = "$((Invoke-DEGraphRequest -Uri "deviceManagement/windowsAutopilotDeviceIdentities/$($ap.id)").groupTag)"
    $ok = ($now -ceq $GroupTag)
    return (New-DEResult -Operation 'Set-DEAutopilotGroupTag' -Status $(if ($ok) { 'Succeeded' } else { 'Partial' }) -Target $Serial -Message $(if ($ok) { "group tag '$($ap.groupTag)' -> '$GroupTag' (read back)" } else { "accepted; Autopilot still shows '$now' (it can take a few minutes)" }) -Data ([pscustomobject]@{ id = $ap.id; groupTag = $now }))
}
function Remove-DEAutopilotDevice {
    <#
        Deregisters a device from Autopilot by its exact serial (the takeover step before JumpCloud). Refuses a serial
        that matches nothing or more than one record. If Intune still holds the device, it refuses unless
        -RemoveIntuneRecord (which deletes that record first, as Microsoft requires). Waits until the identity is gone.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$Serial, [switch]$RemoveIntuneRecord, [switch]$DryRun, [int]$WaitSeconds = 120)
    $exact = @(Find-DEAutopilotBySerial -Serial $Serial)
    if ($exact.Count -ne 1) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status Refused -Target $Serial -Message "$($exact.Count) Autopilot record(s) with exactly this serial; nothing removed") }
    $ap = $exact[0]
    $md = @(Invoke-DEGraphRequest -Uri ('deviceManagement/managedDevices?$filter=serialNumber eq {0}&$select=id,deviceName,userPrincipalName' -f (ConvertTo-DEODataLiteral $Serial)) -All)
    # a generic serial ('Default string', 'System Serial Number') is shared by unrelated devices: only the Intune record this
    # Autopilot identity links to is this device, and several without a link are refused rather than all deleted
    if ("$($ap.managedDeviceId)" -and "$($ap.managedDeviceId)" -ne '00000000-0000-0000-0000-000000000000') { $md = @($md | Where-Object { "$($_.id)" -eq "$($ap.managedDeviceId)" }) }
    if ($md.Count -gt 1) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status Refused -Target $Serial -Message "$($md.Count) Intune records share serial $Serial and Autopilot links none of them; nothing removed" -Data $md) }
    if ($md.Count -and -not $RemoveIntuneRecord) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status Refused -Target $Serial -Message "Intune still manages this device as '$($md[0].deviceName)'; pass -RemoveIntuneRecord to delete that record first" -Data $md) }
    $plan = [pscustomobject]@{ serial = $Serial; autopilotId = $ap.id; intuneRecords = @($md | ForEach-Object { $_.id }) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Serial, "remove from Autopilot$(if ($md.Count) { " after deleting $($md.Count) Intune record(s)" })")) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status DryRun -Target $Serial -Message 'no change applied' -Data $plan) }
    foreach ($m in $md) { $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/managedDevices/$($m.id)" }
    $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/windowsAutopilotDeviceIdentities/$($ap.id)"
    $deadline = (Get-Date).AddSeconds($WaitSeconds); $gone = $false
    while ((Get-Date) -lt $deadline) { $left = @(Find-DEAutopilotBySerial -Serial $Serial); if (-not $left.Count) { $gone = $true; break }; Start-Sleep -Seconds 10 }
    return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status $(if ($gone) { 'Succeeded' } else { 'Partial' }) -Target $Serial -Message $(if ($gone) { 'removed from Autopilot (read back)' } else { "delete accepted but still listed after $WaitSeconds s; Autopilot can take up to 30 minutes" }) -Data $plan)
}

# Serials that firmware ships unfilled: shared by unrelated devices, so Autopilot cannot tell one from another.
$script:GenericSerials = @('default string', 'system serial number', 'to be filled by o.e.m.', 'not specified', 'none', '0', '0123456789', '123456789')
# Autopilot import errors a technician can act on (Graph importedWindowsAutopilotDeviceIdentityState.deviceErrorName).
$script:AutopilotImportErrors = @{
    ZtdDeviceAlreadyAssigned = 'the device is registered to another organization: its seller or previous owner must deregister it first'
    ZtdDeviceDuplicated      = 'the device is already registered in this tenant'
    ZtdDeviceAssignedToOtherTenant = 'the device is registered to another tenant: its seller or previous owner must deregister it first'
}
function Test-DEAutopilotHash {
    <# The hardware hash as Graph takes it: base64 of 100 bytes to 16 KB (OA3Tool and the MDM bridge give about 4 KB). Returns the reason it is not, or ''. #>
    param([AllowEmptyString()][string]$HardwareHash)
    $h = "$HardwareHash".Trim()
    if (-not $h) { return 'no hardware hash' }
    if ($h -notmatch '^[A-Za-z0-9+/]+={0,2}$' -or ($h.Length % 4) -ne 0) { return 'the hardware hash is not base64 (copy the "Hardware Hash" column whole)' }
    $n = [Convert]::FromBase64String($h).Length
    if ($n -lt 100 -or $n -gt 16384) { return "the hardware hash is $n bytes; a real one is about 4 KB" }
    return ''
}
function Import-DEAutopilotDevice {
    <#
        Registers one device in Autopilot from its hardware hash (DE Deploy's capture, Get-WindowsAutopilotInfo or the
        Intune CSV), with an optional group tag and assigned user, and waits for Intune to finish.
          * Refuses a hash that is not base64, a generic firmware serial, and an import of this serial already running.
          * A serial already registered with the same group tag (or none asked) is Succeeded with nothing changed; with a
            different tag it is Refused (Set-DEAutopilotGroupTag changes a tag).
          * A failed earlier import of this serial is removed before importing again.
          * Done when the import is complete and the device is listed in Autopilot (read back). Still processing at
            -WaitSeconds is Partial; an import Intune rejects is Failed with Intune's reason.
        The hash is sent to Graph only: it is never in the result, the audit log or the message.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param(
        [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9 ._/-]{1,64}$')][string]$Serial,
        [Parameter(Mandatory = $true)][string]$HardwareHash,
        [AllowEmptyString()][ValidatePattern('^[A-Za-z0-9 _.-]{0,200}$')][string]$GroupTag = '',
        [AllowEmptyString()][ValidatePattern('^$|^[A-Za-z0-9._''-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$')][string]$AssignedUser = '',
        [ValidateRange(0, 1800)][int]$WaitSeconds = 600,
        [switch]$DryRun
    )
    $op = 'Import-DEAutopilotDevice'; $Serial = $Serial.Trim()
    $bad = Test-DEAutopilotHash -HardwareHash $HardwareHash
    if ($bad) { return (New-DEResult -Operation $op -Status Refused -Target $Serial -Message "$bad; nothing imported") }
    if ($script:GenericSerials -contains $Serial.ToLowerInvariant()) { return (New-DEResult -Operation $op -Status Refused -Target $Serial -Message "'$Serial' is a placeholder firmware serial that other devices share; Autopilot needs the device's real serial (the maker can set it); nothing imported") }
    $plan = [ordered]@{ serial = $Serial; groupTag = $GroupTag; assignedUser = $AssignedUser; importId = $null; importStatus = $null; autopilotId = $null }
    $exact = @(Find-DEAutopilotBySerial -Serial $Serial)
    if ($exact.Count -gt 1) { return (New-DEResult -Operation $op -Status Refused -Target $Serial -Message "$($exact.Count) Autopilot records already have this serial; nothing imported") }
    if ($exact.Count -eq 1) {
        $plan.autopilotId = $exact[0].id; $have = "$($exact[0].groupTag)"
        if (-not $GroupTag -or $have -ceq $GroupTag) { return (New-DEResult -Operation $op -Target $Serial -Message "already registered in Autopilot$(if ($have) { " with group tag '$have'" }); nothing changed" -Data ([pscustomobject]$plan)) }
        return (New-DEResult -Operation $op -Status Refused -Target $Serial -Message "already registered with group tag '$have', not '$GroupTag'; nothing imported (Set-DEAutopilotGroupTag changes the tag)" -Data ([pscustomobject]$plan))
    }
    $earlier = @(Invoke-DEGraphRequest -Uri 'deviceManagement/importedWindowsAutopilotDeviceIdentities' -All | Where-Object { "$($_.serialNumber)".Trim() -ieq $Serial })
    $running = @($earlier | Where-Object { "$($_.state.deviceImportStatus)" -in @('unknown', 'pending', 'partial') })
    if ($running.Count) { return (New-DEResult -Operation $op -Status Refused -Target $Serial -Message "an import of this serial is already processing ($($running[0].state.deviceImportStatus)); nothing imported" -Data ([pscustomobject]$plan)) }
    $stale = @($earlier | Where-Object { "$($_.state.deviceImportStatus)" -in @('error', 'complete') })
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Serial, "import into Autopilot$(if ($GroupTag) { " with group tag '$GroupTag'" })$(if ($AssignedUser) { " for $AssignedUser" })")) {
        return (New-DEResult -Operation $op -Status DryRun -Target $Serial -Message "no change applied$(if ($stale.Count) { " ($($stale.Count) earlier import record(s) would be removed first)" })" -Data ([pscustomobject]$plan))
    }
    foreach ($s in $stale) { $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/importedWindowsAutopilotDeviceIdentities/$($s.id)" }
    $body = [ordered]@{ '@odata.type' = '#microsoft.graph.importedWindowsAutopilotDeviceIdentity'; serialNumber = $Serial; hardwareIdentifier = $HardwareHash.Trim(); groupTag = $GroupTag; assignedUserPrincipalName = $AssignedUser; productKey = '' }
    $created = Invoke-DEGraphRequest -Method POST -Uri 'deviceManagement/importedWindowsAutopilotDeviceIdentities' -Body $body
    $plan.importId = "$($created.id)"
    if (-not $plan.importId) { return (New-DEResult -Operation $op -Status Failed -Target $Serial -Message 'Graph accepted the import but returned no import id; check Intune (Devices > Windows > Enrollment > Devices) before trying again' -Data ([pscustomobject]$plan)) }
    $deadline = (Get-Date).AddSeconds($WaitSeconds); $state = $created.state
    while ("$($state.deviceImportStatus)" -notin @('complete', 'error') -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 10
        $state = (Invoke-DEGraphRequest -Uri "deviceManagement/importedWindowsAutopilotDeviceIdentities/$($plan.importId)").state
    }
    $plan.importStatus = "$($state.deviceImportStatus)"
    if ($plan.importStatus -eq 'error') {
        $name = "$($state.deviceErrorName)"; $why = $(if ($name -and $script:AutopilotImportErrors.ContainsKey($name)) { "$($script:AutopilotImportErrors[$name]) ($name)" } else { "Intune refused it ($name, code $($state.deviceErrorCode)); if the hash is at fault, capture it again from the device's own Windows" })
        return (New-DEResult -Operation $op -Status Failed -Target $Serial -Message "import failed: $why" -Data ([pscustomobject]$plan))
    }
    if ($plan.importStatus -ne 'complete') { return (New-DEResult -Operation $op -Status Partial -Target $Serial -Message "import accepted; Intune still shows '$($plan.importStatus)' after $WaitSeconds s (it can take 15 minutes): check with Get-DEAutopilotDevice" -Data ([pscustomobject]$plan)) }
    # the import record has done its job (Microsoft's own scripts remove it too); then ask Autopilot to list the device now
    try { $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/importedWindowsAutopilotDeviceIdentities/$($plan.importId)" } catch { Write-Verbose "import record left: $($_.Exception.Message)" }
    try { $null = Invoke-DEGraphRequest -Method POST -Uri 'deviceManagement/windowsAutopilotSettings/sync' } catch { Write-Verbose "sync not requested (Autopilot allows one every few minutes): $($_.Exception.Message)" }
    do {
        $now = @(Find-DEAutopilotBySerial -Serial $Serial)
        if ($now.Count) { $plan.autopilotId = $now[0].id; break }
        if ((Get-Date) -ge $deadline) { break }
        Start-Sleep -Seconds 10
    } while ($true)
    if (-not $plan.autopilotId) { return (New-DEResult -Operation $op -Status Partial -Target $Serial -Message 'import complete; Autopilot does not list the device yet (it can take 15 minutes): check with Get-DEAutopilotDevice' -Data ([pscustomobject]$plan)) }
    return (New-DEResult -Operation $op -Target $Serial -Message "registered in Autopilot (read back)$(if ($GroupTag) { " with group tag '$GroupTag'" }); a profile is assigned by the tag's group, usually within minutes" -Data ([pscustomobject]$plan))
}
function Import-DEAutopilotCsv {
    <#
        Imports every row of an Intune Autopilot CSV (DE Deploy's capture or Get-WindowsAutopilotInfo: Device Serial
        Number, Hardware Hash, and optional Group Tag and Assigned User) through Import-DEAutopilotDevice, one result per
        row. -GroupTag fills rows that have none. Not a Hub job: the Hub sends one device per job.
    #>
    [CmdletBinding(SupportsShouldProcess = $true)]
    param([Parameter(Mandatory = $true)][string]$Path, [AllowEmptyString()][string]$GroupTag = '', [ValidateRange(0, 1800)][int]$WaitSeconds = 600, [switch]$DryRun)
    if (-not (Test-Path -LiteralPath $Path)) { return (New-DEResult -Operation 'Import-DEAutopilotCsv' -Status Failed -Target $Path -Message 'file not found') }
    $rows = @(Import-Csv -LiteralPath $Path)
    $cols = @(if ($rows.Count) { $rows[0].PSObject.Properties.Name })
    if (-not $rows.Count -or $cols -notcontains 'Device Serial Number' -or $cols -notcontains 'Hardware Hash') { return (New-DEResult -Operation 'Import-DEAutopilotCsv' -Status Refused -Target $Path -Message 'not an Autopilot CSV: it needs "Device Serial Number" and "Hardware Hash" columns and at least one row') }
    foreach ($row in $rows) {
        $tag = $(if ($cols -contains 'Group Tag' -and "$($row.'Group Tag')") { "$($row.'Group Tag')" } else { $GroupTag })
        $user = $(if ($cols -contains 'Assigned User') { "$($row.'Assigned User')".Trim() } else { '' })
        $p = @{ Serial = "$($row.'Device Serial Number')".Trim(); HardwareHash = "$($row.'Hardware Hash')"; GroupTag = $tag; AssignedUser = $user; WaitSeconds = $WaitSeconds; DryRun = $DryRun }
        if ($WhatIfPreference) { $p['WhatIf'] = $true } else { $p['Confirm'] = $false }
        try { Import-DEAutopilotDevice @p } catch { New-DEResult -Operation 'Import-DEAutopilotDevice' -Status Refused -Target $p.Serial -Message "row not imported: $($_.Exception.Message -replace '[A-Za-z0-9+/]{200,}={0,2}', '[hash]')" }
    }
}

# ============================================================ signed Hub jobs
# Operations a Hub job may run. mutating = needs approvedBy and mode 'apply' to change anything.
$script:JobAllowlist = @{
    'Get-DETenantSummary' = $false; 'Get-DEUser' = $false; 'Get-DEGroup' = $false; 'Get-DELicenseInventory' = $false; 'Get-DEConditionalAccessPolicy' = $false; 'Get-DEMfaRegistration' = $false
    'Get-DEEntraDevice' = $false; 'Test-DEEntraBitLockerEscrow' = $false; 'Get-DEIntuneDevice' = $false; 'Get-DEIntuneCompliancePolicy' = $false; 'Get-DEIntuneConfigurationProfile' = $false
    'Get-DEAutopilotDevice' = $false; 'Get-DEAutopilotProfile' = $false; 'Get-DEMailbox' = $false; 'Get-DEAzureInventory' = $false; 'Get-DETransportRule' = $false; 'Get-DEAzureSubscription' = $false
    'Set-DEUserAccountState' = $true; 'Add-DEGroupMember' = $true; 'Sync-DEIntuneDevice' = $true; 'Remove-DEAutopilotDevice' = $true; 'New-DESharedMailbox' = $true; 'Set-DEMailboxPermission' = $true; 'New-DEAzureResourceGroup' = $true
    'New-DEUser' = $true; 'New-DEGroup' = $true; 'Set-DEConditionalAccessPolicyState' = $true; 'Set-DEMailboxAlias' = $true; 'Set-DEMailboxForwarding' = $true
    'Invoke-DEIntuneDeviceAction' = $true; 'Set-DEAutopilotGroupTag' = $true; 'New-DEAzureResourceLock' = $true; 'Import-DEAutopilotDevice' = $true
}
# The service an allowlisted operation signs in to besides Graph (every operation not listed here is Graph only).
# The Hub worker connects that service only when a job for it has verified (Invoke-DEMicrosoftJob -BeforeRun).
$script:JobService = @{
    'Get-DEMailbox' = 'Exchange'; 'New-DESharedMailbox' = 'Exchange'; 'Set-DEMailboxPermission' = 'Exchange'; 'Set-DEMailboxAlias' = 'Exchange'; 'Set-DEMailboxForwarding' = 'Exchange'; 'Get-DETransportRule' = 'Exchange'
    'Get-DEAzureSubscription' = 'Azure'; 'Get-DEAzureInventory' = 'Azure'; 'New-DEAzureResourceGroup' = 'Azure'; 'New-DEAzureResourceLock' = 'Azure'
}
function Get-DEJobService {
    <# Graph, Exchange or Azure: the service an allowlisted job operation needs. #>
    param([Parameter(Mandatory = $true)][string]$Operation)
    if ($script:JobService.ContainsKey($Operation)) { return $script:JobService[$Operation] }
    return 'Graph'
}
function ConvertTo-DEJsonText {
    <# A JSON string exactly as JavaScript's JSON.stringify writes it (only " \ and control characters escaped), so a Node signer and this module sign the same bytes. #>
    param([AllowEmptyString()][string]$Text)
    $sb = New-Object System.Text.StringBuilder; [void]$sb.Append('"')
    foreach ($ch in $Text.ToCharArray()) { $c = [int]$ch; switch ($c) { 34 { [void]$sb.Append('\"') } 92 { [void]$sb.Append('\\') } 8 { [void]$sb.Append('\b') } 12 { [void]$sb.Append('\f') } 10 { [void]$sb.Append('\n') } 13 { [void]$sb.Append('\r') } 9 { [void]$sb.Append('\t') } default { if ($c -lt 32) { [void]$sb.Append(('\u{0:x4}' -f $c)) } else { [void]$sb.Append($ch) } } } }
    [void]$sb.Append('"'); return $sb.ToString()
}
function ConvertTo-DEJsNumber {
    <# A number exactly as JavaScript writes it (JSON.stringify / Number.prototype.toString): shortest round-trip
       digits, plain notation from 1e-7 to 1e21, exponent 'e+N' / 'e-N' outside it, NaN and Infinity as null. #>
    param([Parameter(Mandatory = $true)][double]$Value)
    if ([double]::IsNaN($Value) -or [double]::IsInfinity($Value)) { return 'null' }
    if ($Value -eq 0) { return '0' }
    $inv = [Globalization.CultureInfo]::InvariantCulture
    $s = $Value.ToString('R', $inv)
    # .NET Framework 'R' can give 17 digits where 16 round-trip (JavaScript prints the shortest)
    $g16 = $Value.ToString('G16', $inv); if ([double]::Parse($g16, $inv) -eq $Value -and $g16.Length -lt $s.Length) { $s = $g16 }
    $neg = ''; if ($s.StartsWith('-')) { $neg = '-'; $s = $s.Substring(1) }
    $exp = 0; $i = $s.IndexOfAny([char[]]'Ee'); if ($i -ge 0) { $exp = [int]::Parse($s.Substring($i + 1), $inv); $s = $s.Substring(0, $i) }
    $dot = $s.IndexOf('.'); if ($dot -ge 0) { $exp += $dot; $s = $s.Remove($dot, 1) } else { $exp += $s.Length }
    $lead = $s.Length - $s.TrimStart('0').Length; $dg = $s.Trim('0'); $n = $exp - $lead; $k = $dg.Length
    if ($k -le $n -and $n -le 21) { return $neg + $dg + ('0' * ($n - $k)) }
    if (0 -lt $n -and $n -le 21) { return $neg + $dg.Substring(0, $n) + '.' + $dg.Substring($n) }
    if (-6 -lt $n -and $n -le 0) { return $neg + '0.' + ('0' * (-$n)) + $dg }
    $e = $n - 1; return $neg + $dg.Substring(0, 1) + $(if ($k -gt 1) { '.' + $dg.Substring(1) }) + 'e' + $(if ($e -ge 0) { "+$e" } else { "$e" })
}
function ConvertTo-DEJobCanonical {
    <# Sorted-key compact JSON of the job without its signature: the bytes both sides sign. #>
    param([Parameter(Mandatory = $true)][AllowNull()]$Object)
    if ($null -eq $Object) { return 'null' }
    if ($Object -is [bool]) { if ($Object) { return 'true' } else { return 'false' } }
    if ($Object -is [int] -or $Object -is [long] -or $Object -is [double] -or $Object -is [decimal] -or $Object -is [single] -or $Object -is [int16] -or $Object -is [byte]) { return (ConvertTo-DEJsNumber ([double]$Object)) }
    if ($Object -is [datetime]) { return (ConvertTo-DEJsonText $Object.ToUniversalTime().ToString('o')) }   # PowerShell 7.0-7.4 parsed a date: sign it as ISO 8601
    if ($Object -is [string]) { return (ConvertTo-DEJsonText $Object) }
    # keys in ordinal (UTF-16 code unit) order, as JavaScript's sort() does; Sort-Object is culture-aware and puts 'Owner' after 'environment'
    if ($Object -is [System.Collections.IDictionary]) { [string[]]$keys = @($Object.Keys | ForEach-Object { "$_" } | Where-Object { $_ -ne 'signature' }); [Array]::Sort($keys, [StringComparer]::Ordinal); return '{' + (($keys | ForEach-Object { (ConvertTo-DEJsonText $_) + ':' + (ConvertTo-DEJobCanonical $Object[$_]) }) -join ',') + '}' }
    # PSCustomObject, not [pscustomobject] (= PSObject): a nested array element arrives PSObject-wrapped
    if ($Object -is [System.Management.Automation.PSCustomObject]) { [string[]]$keys = @($Object.PSObject.Properties | ForEach-Object { $_.Name } | Where-Object { $_ -ne 'signature' }); [Array]::Sort($keys, [StringComparer]::Ordinal); return '{' + (($keys | ForEach-Object { (ConvertTo-DEJsonText $_) + ':' + (ConvertTo-DEJobCanonical $Object.$_) }) -join ',') + '}' }
    if ($Object -is [System.Collections.IEnumerable]) { return '[' + ((@($Object) | ForEach-Object { ConvertTo-DEJobCanonical $_ }) -join ',') + ']' }
    return (ConvertTo-DEJsonText "$Object")
}
function Get-DEJobSignature {
    param([Parameter(Mandatory = $true)]$Job, [Parameter(Mandatory = $true)][securestring]$Secret)
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secret)
    try { $key = [Text.Encoding]::UTF8.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $h = New-Object Security.Cryptography.HMACSHA256 (, $key)
    try { return (-join ($h.ComputeHash([Text.Encoding]::UTF8.GetBytes((ConvertTo-DEJobCanonical $Job))) | ForEach-Object { $_.ToString('x2') })) } finally { $h.Dispose(); [Array]::Clear($key, 0, $key.Length) }
}
function New-DEMicrosoftJob {
    <# Builds and signs a job (for the Hub, and for testing a worker). #>
    param([Parameter(Mandatory = $true)][string]$TenantId, [Parameter(Mandatory = $true)][string]$Operation, [hashtable]$Parameters = @{}, [ValidateSet('plan', 'apply')][string]$Mode = 'plan', [string]$ApprovedBy, [string]$RequestedBy, [int]$ValidMinutes = 30, [Parameter(Mandatory = $true)][securestring]$Secret)
    $job = [ordered]@{ schema = 'de.msadmin.job/v1'; jobId = [guid]::NewGuid().ToString(); tenantId = $TenantId; operation = $Operation; parameters = $Parameters; mode = $Mode; approvedBy = $ApprovedBy; requestedBy = $RequestedBy; issuedAt = (Get-Date).ToUniversalTime().ToString('o'); expiresAt = (Get-Date).ToUniversalTime().AddMinutes($ValidMinutes).ToString('o') }
    $job.signature = Get-DEJobSignature -Job $job -Secret $Secret
    return $job
}
function Invoke-DEMicrosoftJob {
    <#
        Runs one Hub job after every check passes: schema, HMAC signature (constant-time compare), issued/expiry window
        (at most 60 minutes, 5 minutes clock skew), replay ledger, connected tenant, allowlisted operation, only that
        operation's own parameters, and for changes mode 'apply' plus approvedBy. A 'plan' job runs a change as -DryRun.
        -BeforeRun (the Hub worker's lazy Exchange / Azure sign-in) is called only after every check has passed, with
        the service the operation needs (Graph, Exchange or Azure) and the operation. Text back means the job cannot
        run here: it is reported as Failed with that text, nothing runs, and the replay ledger is not written.
    #>
    param([Parameter(Mandatory = $true)][string]$JobJson, [Parameter(Mandatory = $true)][securestring]$Secret, [string]$LedgerPath = (Join-Path (Split-Path -Parent $script:AuditPath) 'job-ledger.txt'), [scriptblock]$BeforeRun)
    $refuse = { param($why, $id) return (New-DEResult -Operation 'Invoke-DEMicrosoftJob' -Status Refused -Target "$id" -Message $why -JobId "$id") }
    # PowerShell 7 turns ISO date strings into DateTime while parsing, which would change the signed bytes
    $cf = @{}; if ((Get-Command -Name ConvertFrom-Json).Parameters.ContainsKey('DateKind')) { $cf['DateKind'] = 'String' }
    try { $job = $JobJson | ConvertFrom-Json @cf } catch { return (& $refuse 'job is not JSON' $null) }
    $id = "$($job.jobId)"
    if ("$($job.schema)" -ne 'de.msadmin.job/v1' -or $id -notmatch '^[0-9a-fA-F-]{36}$') { return (& $refuse 'not a de.msadmin.job/v1 job' $id) }
    $sig = "$($job.signature)".ToLowerInvariant(); $want = Get-DEJobSignature -Job $job -Secret $Secret
    $diff = $sig.Length -bxor $want.Length; for ($i = 0; $i -lt [Math]::Min($sig.Length, $want.Length); $i++) { $diff = $diff -bor ([int][char]$sig[$i] -bxor [int][char]$want[$i]) }
    if ($diff -ne 0) { return (& $refuse 'signature does not verify' $id) }
    $now = (Get-Date).ToUniversalTime()
    try { $iss = ([datetime]$job.issuedAt).ToUniversalTime(); $exp = ([datetime]$job.expiresAt).ToUniversalTime() } catch { return (& $refuse 'issuedAt/expiresAt are not dates' $id) }
    if ($now -lt $iss.AddMinutes(-5) -or $now -gt $exp -or ($exp - $iss).TotalMinutes -gt 60) { return (& $refuse "outside its validity window ($($job.issuedAt) .. $($job.expiresAt))" $id) }
    if ((Test-Path -LiteralPath $LedgerPath) -and (@(Get-Content -LiteralPath $LedgerPath -Encoding UTF8) -contains $id)) { return (& $refuse 'already run (replay)' $id) }
    if (-not $script:Ctx.TenantId -or "$($job.tenantId)" -ne "$($script:Ctx.TenantId)") { return (& $refuse "for tenant $($job.tenantId), connected to $($script:Ctx.TenantId)" $id) }
    $op = "$($job.operation)"
    if (-not $script:JobAllowlist.ContainsKey($op)) { return (& $refuse "operation '$op' is not allowlisted" $id) }
    $cmd = Get-Command -Name $op -Module $MyInvocation.MyCommand.Module.Name -ErrorAction SilentlyContinue
    if (-not $cmd) { return (& $refuse "operation '$op' not found" $id) }
    $common = @([System.Management.Automation.PSCmdlet]::CommonParameters) + @([System.Management.Automation.PSCmdlet]::OptionalCommonParameters) + @('DryRun')
    $allowed = @($cmd.Parameters.Keys | Where-Object { $common -notcontains $_ })
    $params = @{}
    if ($job.parameters) { foreach ($p in $job.parameters.PSObject.Properties) { if ($allowed -notcontains $p.Name) { return (& $refuse "parameter '$($p.Name)' is not allowed for $op" $id) }; $params[$p.Name] = $p.Value } }
    $mutating = [bool]$script:JobAllowlist[$op]
    if ($mutating) {
        if ("$($job.mode)" -eq 'apply') { if (-not "$($job.approvedBy)") { return (& $refuse "$op changes the tenant: an apply job needs approvedBy" $id) }; $params['Confirm'] = $false }
        else { $params['DryRun'] = $true }
    }
    if ($BeforeRun) {
        $service = Get-DEJobService -Operation $op
        $notReady = "$(& $BeforeRun $service $op)".Trim()
        if ($notReady) { return (New-DEResult -Operation $op -Status Failed -Target "$id" -Message "not run: $notReady" -JobId $id) }
    }
    $dir = Split-Path -Parent $LedgerPath; if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::AppendAllText($LedgerPath, "$id`n", (New-Object Text.UTF8Encoding $false))   # recorded before running: a crash never allows a second run
    try { $r = & $cmd @params } catch { return (New-DEResult -Operation $op -Status Failed -Target "$id" -Message $_.Exception.Message -JobId $id) }
    Write-DEMsAudit -Operation 'Invoke-DEMicrosoftJob' -Status "$($r.status)" -Target $op -Message "job $id by $($job.requestedBy); approved by $($job.approvedBy); mode $($job.mode)" -JobId $id
    return $r
}

# email migration (Gmail IMAP -> Microsoft 365); MIGRATION-STANDARD.md is its contract
. (Join-Path $PSScriptRoot 'DE-Migration.ps1')

# the Intelligence Hub job loop (claim, verify, run, post); Intelligence-Hub docs/MSADMIN-JOBS.md is its contract
. (Join-Path $PSScriptRoot 'DE-HubWorker.ps1')

Export-ModuleMember -Function Set-DEMsAuditPath, Get-DEMsAuditPath, New-DEResult, Export-DEResult, Get-DEMsScopeSet, Connect-DEMicrosoft, Get-DEMsContext, ConvertTo-DEODataLiteral, Invoke-DEGraphRequest,
    Get-DETenantSummary, Get-DEUser, New-DEUser, Set-DEUserAccountState, Get-DEGroup, New-DEGroup, Add-DEGroupMember, Get-DELicenseInventory, Get-DEConditionalAccessPolicy, Set-DEConditionalAccessPolicyState, Get-DEMfaRegistration,
    Get-DEEntraDevice, Test-DEEntraBitLockerEscrow, Connect-DEExchange, Get-DEMailbox, New-DESharedMailbox, Set-DEMailboxPermission, Set-DEMailboxAlias, Set-DEMailboxForwarding, Get-DETransportRule,
    Connect-DEAzure, Get-DEAzureSubscription, Get-DEAzureInventory, New-DEAzureResourceGroup, New-DEAzureResourceLock,
    Get-DEIntuneDevice, Get-DEIntuneCompliancePolicy, Get-DEIntuneConfigurationProfile, Sync-DEIntuneDevice, Invoke-DEIntuneDeviceAction, Get-DEAutopilotDevice, Get-DEAutopilotProfile, Set-DEAutopilotGroupTag, Remove-DEAutopilotDevice, Import-DEAutopilotDevice, Import-DEAutopilotCsv,
    ConvertTo-DEJobCanonical, Get-DEJobSignature, New-DEMicrosoftJob, Invoke-DEMicrosoftJob, Invoke-DEHubJobLoop, ConvertTo-DEHubSafeResult,
    Get-DEMigrationProject, Get-DEMigrationSourceType, New-DEMigrationProject, Add-DEMigrationUser, Test-DEGmailImapAccess, Set-DEMigrationSharedMailbox, Test-DEMigrationSharedMailbox, New-DEMigrationBatch, Get-DEMigrationStatus, Confirm-DEMigrationPilot, Complete-DEMigrationBatch, Import-DEMigrationContacts, Import-DEMigrationCalendar, Test-DEMigrationDns, Test-DEMigrationMailFlow, Test-DEMigrationMfa, Get-DEMailClientInventory, Import-DEMailClientInventory, Get-DEMigrationNextStep, Invoke-DEBounceDiagnostic, Resolve-DEMigrationBounce, Set-DEMigrationCheck, New-DEMigrationSignoff, Close-DEMigrationProject, Export-DEMigrationRecord, Set-DEMigrationDirectory
