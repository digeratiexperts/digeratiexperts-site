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
        app-only with a certificate from the machine store (no secret on disk).
      * Every operation returns one result object and appends one line to the audit log (operation, target,
        status, who, when; never data).
      * Destructive operations are ConfirmImpact High, verify their own effect, and refuse ambiguous targets.
      * Invoke-DEMicrosoftJob runs a Hub job only when it is signed, unexpired, not replayed, for the connected
        tenant, an allowlisted operation with allowlisted parameters, and (to change anything) approved.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:Ctx = [ordered]@{ TenantId = $null; Mode = $null; Account = $null; Scopes = @(); ConnectedAt = $null }
$script:AuditPath = $(if ($env:ProgramData) { Join-Path $env:ProgramData 'DE\MicrosoftAdmin\audit.jsonl' } else { Join-Path ([IO.Path]::GetTempPath()) 'de-microsoft-admin-audit.jsonl' })
$script:GraphRoot = 'https://graph.microsoft.com'
$script:RecoveryShape = '(?<!\d)\d{6}(-\d{6}){7}(?!\d)'

# Least-privilege scope sets (delegated). Combine with -Scenario A,B.
$script:ScopeSets = [ordered]@{
    Read      = @('User.Read.All', 'Group.Read.All', 'Directory.Read.All', 'Organization.Read.All', 'Policy.Read.All')
    Users     = @('User.ReadWrite.All')
    Groups    = @('GroupMember.ReadWrite.All')
    Intune    = @('DeviceManagementManagedDevices.Read.All', 'DeviceManagementConfiguration.Read.All', 'DeviceManagementManagedDevices.PrivilegedOperations.All')
    Autopilot = @('DeviceManagementServiceConfig.ReadWrite.All', 'DeviceManagementManagedDevices.ReadWrite.All')
    BitLocker = @('BitLockerKey.ReadBasic.All', 'Device.Read.All')
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
    return [pscustomobject][ordered]@{ product = 'DE Microsoft Admin'; version = '0.2.0'; operation = $Operation; status = $Status; target = $Target; tenant = $script:Ctx.TenantId; at = (Get-Date).ToUniversalTime().ToString('o'); message = $Message; data = $Data }
}
function Export-DEResult {
    <# Writes a result as UTF-8 JSON without a BOM (Node, Python and the Hub reject one). #>
    param([Parameter(Mandatory = $true)][object]$Result, [Parameter(Mandatory = $true)][string]$Path)
    $parent = Split-Path -Parent $Path; if ($parent -and -not (Test-Path -LiteralPath $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
    [IO.File]::WriteAllText($Path, ($Result | ConvertTo-Json -Depth 30), (New-Object Text.UTF8Encoding $false))
    return (Get-Item -LiteralPath $Path)
}

# ============================================================ connection
function Get-DEMsScopeSet { param([ValidateSet('Read', 'Users', 'Groups', 'Intune', 'Autopilot', 'BitLocker', 'Reports')][string[]]$Scenario = @('Read')) return @(@('Read') + @($Scenario) | Select-Object -Unique | ForEach-Object { $script:ScopeSets[$_] } | Select-Object -Unique) }
function Assert-DECommand { param([Parameter(Mandatory = $true)][string]$Name, [string]$Module) if (-not (Get-Command -Name $Name -ErrorAction SilentlyContinue)) { throw "'$Name' is not available. Install $(if ($Module) { $Module } else { 'its module' }) (Install-DEMicrosoftDependencies.ps1)." } }
function Connect-DEMicrosoft {
    <#
        Delegated: -TenantId and -Scenario (least-privilege scope sets). App-only (the Hub worker): -ClientId and
        -CertificateThumbprint of a certificate in the machine or user store; no client secret is ever accepted.
    #>
    [CmdletBinding(DefaultParameterSetName = 'Delegated')]
    param(
        [Parameter(Mandatory = $true)][string]$TenantId,
        [Parameter(ParameterSetName = 'Delegated')][ValidateSet('Read', 'Users', 'Groups', 'Intune', 'Autopilot', 'BitLocker', 'Reports')][string[]]$Scenario = @('Read'),
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][string]$ClientId,
        [Parameter(ParameterSetName = 'App', Mandatory = $true)][string]$CertificateThumbprint
    )
    Assert-DECommand 'Connect-MgGraph' 'Microsoft.Graph.Authentication'
    if ($PSCmdlet.ParameterSetName -eq 'App') {
        Connect-MgGraph -TenantId $TenantId -ClientId $ClientId -CertificateThumbprint $CertificateThumbprint -NoWelcome
        $script:Ctx.Mode = 'app'; $script:Ctx.Scopes = @()
    } else {
        $scopes = Get-DEMsScopeSet -Scenario $Scenario
        Connect-MgGraph -TenantId $TenantId -Scopes $scopes -NoWelcome
        $script:Ctx.Mode = 'delegated'; $script:Ctx.Scopes = $scopes
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
function Get-DELicenseInventory {
    [CmdletBinding()] param()
    $s = @(Invoke-DEGraphRequest -Uri 'subscribedSkus')
    $rows = @($s | ForEach-Object { [pscustomobject]@{ sku = $_.skuPartNumber; skuId = $_.skuId; enabled = [int]$_.prepaidUnits.enabled; consumed = [int]$_.consumedUnits; available = [int]$_.prepaidUnits.enabled - [int]$_.consumedUnits; suspended = [int]$_.prepaidUnits.suspended; warning = [int]$_.prepaidUnits.warning } })
    return (New-DEResult -Operation 'Get-DELicenseInventory' -Message "$($rows.Count) SKU(s); $(@($rows | Where-Object { $_.available -lt 1 -and $_.enabled -gt 0 }).Count) with none left" -Data $rows)
}
function Get-DEConditionalAccessPolicy {
    [CmdletBinding()] param([string]$PolicyId)
    $r = $(if ($PolicyId) { @(Invoke-DEGraphRequest -Uri "identity/conditionalAccess/policies/$PolicyId") } else { @(Invoke-DEGraphRequest -Uri 'identity/conditionalAccess/policies' -All) })
    return (New-DEResult -Operation 'Get-DEConditionalAccessPolicy' -Message "$($r.Count) polic(ies); $(@($r | Where-Object { $_.state -eq 'enabled' }).Count) enabled" -Data $r)
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
    $keys = @(Invoke-DEGraphRequest -Uri ('informationProtection/bitlocker/recoveryKeys?$filter=deviceId eq {0}' -f (ConvertTo-DEODataLiteral $DeviceId)) -All -Headers @{ 'ocp-client-name' = 'DE Microsoft Admin'; 'ocp-client-version' = '0.2.0' })
    $rows = @($keys | ForEach-Object { [pscustomobject]@{ keyId = "$($_.id)"; created = $_.createdDateTime; volumeType = "$($_.volumeType)" } })
    $want = "$KeyProtectorId".Trim('{', '}').ToLowerInvariant()
    $match = $(if ($want) { @($rows | Where-Object { $_.keyId.ToLowerInvariant() -eq $want }) } else { $rows })
    $ok = [bool]$match.Count
    $msg = $(if (-not $rows.Count) { 'no recovery key for this device in Entra ID' } elseif ($want -and -not $ok) { "Entra holds $($rows.Count) key(s) but not protector $KeyProtectorId" } else { "escrowed: $(@($match | ForEach-Object { $_.keyId }) -join ', ')" })
    return (New-DEResult -Operation 'Test-DEEntraBitLockerEscrow' -Status $(if ($ok) { 'Succeeded' } else { 'Failed' }) -Target $DeviceId -Message $msg -Data ([pscustomobject]@{ deviceId = $DeviceId; escrowed = $ok; keys = $rows }))
}

# ============================================================ Exchange Online
function Connect-DEExchange {
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$UserPrincipalName)
    Assert-DECommand 'Connect-ExchangeOnline' 'ExchangeOnlineManagement'
    Connect-ExchangeOnline -UserPrincipalName $UserPrincipalName -ShowBanner:$false -ErrorAction Stop | Out-Null
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

# ============================================================ Azure
function Connect-DEAzure {
    [CmdletBinding()] param([Parameter(Mandatory = $true)][string]$TenantId, [string]$SubscriptionId)
    Assert-DECommand 'Connect-AzAccount' 'Az.Accounts'
    Connect-AzAccount -Tenant $TenantId -ErrorAction Stop | Out-Null
    if ($SubscriptionId) { Set-AzContext -SubscriptionId $SubscriptionId -ErrorAction Stop | Out-Null }
    $c = Get-AzContext
    return (New-DEResult -Operation 'Connect-DEAzure' -Target "$($c.Subscription.Name)" -Data ([pscustomobject]@{ tenant = "$($c.Tenant.Id)"; subscription = "$($c.Subscription.Name)"; subscriptionId = "$($c.Subscription.Id)"; account = "$($c.Account.Id)" }))
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
    if ($e) { return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Status $(if ($e.Location -eq $Location) { 'Succeeded' } else { 'Refused' }) -Target $Name -Message $(if ($e.Location -eq $Location) { 'already exists; nothing changed' } else { "exists in $($e.Location), not $Location" })) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Name, "create resource group in $Location")) { return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Status DryRun -Target $Name -Message 'no change applied' -Data ([pscustomobject]@{ name = $Name; location = $Location; tags = $Tags })) }
    $r = New-AzResourceGroup -Name $Name -Location $Location -Tag $Tags -ErrorAction Stop
    return (New-DEResult -Operation 'New-DEAzureResourceGroup' -Target $Name -Message "created in $Location" -Data ($r | Select-Object ResourceGroupName, Location, ProvisioningState))
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
function Remove-DEAutopilotDevice {
    <#
        Deregisters a device from Autopilot by its exact serial (the takeover step before JumpCloud). Refuses a serial
        that matches nothing or more than one record. If Intune still holds the device, it refuses unless
        -RemoveIntuneRecord (which deletes that record first, as Microsoft requires). Waits until the identity is gone.
    #>
    [CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
    param([Parameter(Mandatory = $true)][string]$Serial, [switch]$RemoveIntuneRecord, [switch]$DryRun, [int]$WaitSeconds = 120)
    $all = @(Invoke-DEGraphRequest -Uri ('deviceManagement/windowsAutopilotDeviceIdentities?$filter=contains(serialNumber,{0})' -f (ConvertTo-DEODataLiteral $Serial)) -All)
    $exact = @($all | Where-Object { "$($_.serialNumber)".Trim() -ieq $Serial.Trim() })
    if ($exact.Count -ne 1) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status Refused -Target $Serial -Message "$($exact.Count) Autopilot record(s) with exactly this serial; nothing removed") }
    $ap = $exact[0]
    $md = @(Invoke-DEGraphRequest -Uri ('deviceManagement/managedDevices?$filter=serialNumber eq {0}&$select=id,deviceName,userPrincipalName' -f (ConvertTo-DEODataLiteral $Serial)) -All)
    if ($md.Count -and -not $RemoveIntuneRecord) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status Refused -Target $Serial -Message "Intune still manages this device as '$($md[0].deviceName)'; pass -RemoveIntuneRecord to delete that record first" -Data $md) }
    $plan = [pscustomobject]@{ serial = $Serial; autopilotId = $ap.id; intuneRecords = @($md | ForEach-Object { $_.id }) }
    if ($DryRun -or -not $PSCmdlet.ShouldProcess($Serial, "remove from Autopilot$(if ($md.Count) { " after deleting $($md.Count) Intune record(s)" })")) { return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status DryRun -Target $Serial -Message 'no change applied' -Data $plan) }
    foreach ($m in $md) { $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/managedDevices/$($m.id)" }
    $null = Invoke-DEGraphRequest -Method DELETE -Uri "deviceManagement/windowsAutopilotDeviceIdentities/$($ap.id)"
    $deadline = (Get-Date).AddSeconds($WaitSeconds); $gone = $false
    while ((Get-Date) -lt $deadline) { $left = @(Invoke-DEGraphRequest -Uri ('deviceManagement/windowsAutopilotDeviceIdentities?$filter=contains(serialNumber,{0})' -f (ConvertTo-DEODataLiteral $Serial)) -All | Where-Object { "$($_.serialNumber)".Trim() -ieq $Serial.Trim() }); if (-not $left.Count) { $gone = $true; break }; Start-Sleep -Seconds 10 }
    return (New-DEResult -Operation 'Remove-DEAutopilotDevice' -Status $(if ($gone) { 'Succeeded' } else { 'Partial' }) -Target $Serial -Message $(if ($gone) { 'removed from Autopilot (read back)' } else { "delete accepted but still listed after $WaitSeconds s; Autopilot can take up to 30 minutes" }) -Data $plan)
}

# ============================================================ signed Hub jobs
# Operations a Hub job may run. mutating = needs approvedBy and mode 'apply' to change anything.
$script:JobAllowlist = @{
    'Get-DETenantSummary' = $false; 'Get-DEUser' = $false; 'Get-DEGroup' = $false; 'Get-DELicenseInventory' = $false; 'Get-DEConditionalAccessPolicy' = $false; 'Get-DEMfaRegistration' = $false
    'Get-DEEntraDevice' = $false; 'Test-DEEntraBitLockerEscrow' = $false; 'Get-DEIntuneDevice' = $false; 'Get-DEIntuneCompliancePolicy' = $false; 'Get-DEIntuneConfigurationProfile' = $false
    'Get-DEAutopilotDevice' = $false; 'Get-DEAutopilotProfile' = $false; 'Get-DEMailbox' = $false; 'Get-DEAzureInventory' = $false
    'Set-DEUserAccountState' = $true; 'Add-DEGroupMember' = $true; 'Sync-DEIntuneDevice' = $true; 'Remove-DEAutopilotDevice' = $true; 'New-DESharedMailbox' = $true; 'Set-DEMailboxPermission' = $true; 'New-DEAzureResourceGroup' = $true
}
function ConvertTo-DEJsonText {
    <# A JSON string exactly as JavaScript's JSON.stringify writes it (only " \ and control characters escaped), so a Node signer and this module sign the same bytes. #>
    param([AllowEmptyString()][string]$Text)
    $sb = New-Object System.Text.StringBuilder; [void]$sb.Append('"')
    foreach ($ch in $Text.ToCharArray()) { $c = [int]$ch; switch ($c) { 34 { [void]$sb.Append('\"') } 92 { [void]$sb.Append('\\') } 8 { [void]$sb.Append('\b') } 12 { [void]$sb.Append('\f') } 10 { [void]$sb.Append('\n') } 13 { [void]$sb.Append('\r') } 9 { [void]$sb.Append('\t') } default { if ($c -lt 32) { [void]$sb.Append(('\u{0:x4}' -f $c)) } else { [void]$sb.Append($ch) } } } }
    [void]$sb.Append('"'); return $sb.ToString()
}
function ConvertTo-DEJobCanonical {
    <# Sorted-key compact JSON of the job without its signature: the bytes both sides sign. #>
    param([Parameter(Mandatory = $true)][AllowNull()]$Object)
    if ($null -eq $Object) { return 'null' }
    if ($Object -is [bool]) { if ($Object) { return 'true' } else { return 'false' } }
    if ($Object -is [int] -or $Object -is [long] -or $Object -is [double] -or $Object -is [decimal]) { return ([decimal]$Object).ToString([Globalization.CultureInfo]::InvariantCulture) }
    if ($Object -is [datetime]) { return (ConvertTo-DEJsonText $Object.ToUniversalTime().ToString('o')) }   # PowerShell 7.0-7.4 parsed a date: sign it as ISO 8601
    if ($Object -is [string]) { return (ConvertTo-DEJsonText $Object) }
    if ($Object -is [System.Collections.IDictionary]) { $keys = @($Object.Keys | ForEach-Object { "$_" } | Where-Object { $_ -ne 'signature' } | Sort-Object -CaseSensitive); return '{' + (($keys | ForEach-Object { (ConvertTo-DEJsonText $_) + ':' + (ConvertTo-DEJobCanonical $Object[$_]) }) -join ',') + '}' }
    if ($Object -is [pscustomobject]) { $keys = @($Object.PSObject.Properties | ForEach-Object { $_.Name } | Where-Object { $_ -ne 'signature' } | Sort-Object -CaseSensitive); return '{' + (($keys | ForEach-Object { (ConvertTo-DEJsonText $_) + ':' + (ConvertTo-DEJobCanonical $Object.$_) }) -join ',') + '}' }
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
    #>
    param([Parameter(Mandatory = $true)][string]$JobJson, [Parameter(Mandatory = $true)][securestring]$Secret, [string]$LedgerPath = (Join-Path (Split-Path -Parent $script:AuditPath) 'job-ledger.txt'))
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
    $dir = Split-Path -Parent $LedgerPath; if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [IO.File]::AppendAllText($LedgerPath, "$id`n", (New-Object Text.UTF8Encoding $false))   # recorded before running: a crash never allows a second run
    try { $r = & $cmd @params } catch { return (New-DEResult -Operation $op -Status Failed -Target "$id" -Message $_.Exception.Message -JobId $id) }
    Write-DEMsAudit -Operation 'Invoke-DEMicrosoftJob' -Status "$($r.status)" -Target $op -Message "job $id by $($job.requestedBy); approved by $($job.approvedBy); mode $($job.mode)" -JobId $id
    return $r
}

Export-ModuleMember -Function Set-DEMsAuditPath, Get-DEMsAuditPath, New-DEResult, Export-DEResult, Get-DEMsScopeSet, Connect-DEMicrosoft, Get-DEMsContext, ConvertTo-DEODataLiteral, Invoke-DEGraphRequest,
    Get-DETenantSummary, Get-DEUser, Set-DEUserAccountState, Get-DEGroup, Add-DEGroupMember, Get-DELicenseInventory, Get-DEConditionalAccessPolicy, Get-DEMfaRegistration,
    Get-DEEntraDevice, Test-DEEntraBitLockerEscrow, Connect-DEExchange, Get-DEMailbox, New-DESharedMailbox, Set-DEMailboxPermission, Connect-DEAzure, Get-DEAzureInventory, New-DEAzureResourceGroup,
    Get-DEIntuneDevice, Get-DEIntuneCompliancePolicy, Get-DEIntuneConfigurationProfile, Sync-DEIntuneDevice, Get-DEAutopilotDevice, Get-DEAutopilotProfile, Remove-DEAutopilotDevice,
    ConvertTo-DEJobCanonical, Get-DEJobSignature, New-DEMicrosoftJob, Invoke-DEMicrosoftJob
