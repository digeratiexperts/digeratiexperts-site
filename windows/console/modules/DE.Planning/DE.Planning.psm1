#Requires -Version 5.1
<#
.SYNOPSIS
    DE Tech Tool planning: ProActive Ecosystem tiers, provisioning variants (GCC High, Co-Managed), add-ons, the
    13 standalone solution families, dropship orders and the recommended mode.

.DESCRIPTION
    A plan is data (catalog\bundles.json) composed onto a client profile by New-DEComposedProfile.
    Select-DEPlanActions then trims the registered actions to that plan and adds the plan's gates and
    confirm-to-complete manual steps. Nothing here stores or reads a secret.
#>
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

$script:TierKeys = @('IT', 'Office', 'Business', 'Enterprise')

# ------------------------------------------------------------------ catalog
function Get-DEPlanCatalog {
    $path = Join-Path (Get-DEConsole).Root 'catalog\bundles.json'
    if (-not (Test-Path -LiteralPath $path)) { throw "DE Tech Tool bundle catalog missing: $path" }
    return (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
}

function Get-DEProActiveBundle {
    param([Parameter(Mandatory = $true)][ValidateSet('IT', 'Office', 'Business', 'Enterprise')][string]$Tier)
    $c = Get-DEPlanCatalog
    $p = $c.proactive.PSObject.Properties[$Tier]
    if (-not $p) { throw "unknown ProActive tier '$Tier'" }
    return $p.Value
}

function Get-DEStandaloneSolutions {
    $c = Get-DEPlanCatalog
    return @($c.standaloneSolutions.PSObject.Properties | ForEach-Object { $_.Value })
}

function Get-DEBundles {
    <# Every provisioning plan a technician can pick: the four ProActive tiers, then the variants. Each has id, name, tier. #>
    $c = Get-DEPlanCatalog
    $out = @()
    foreach ($prop in $c.proactive.PSObject.Properties) {
        $h = ConvertTo-DEHashtable $prop.Value
        $h['tierKey'] = $prop.Name; $h['tierId'] = $h['id']; $h['id'] = $h['bundleId']; $h['name'] = $h['label']
        $out += , $h
    }
    foreach ($v in @($c.variants | Where-Object { $null -ne $_ })) { $h = ConvertTo-DEHashtable $v; $h['name'] = $h['label']; $out += , $h }
    return $out
}

function Get-DEAddOns {
    return @(@((Get-DEPlanCatalog).addOns | Where-Object { $null -ne $_ }) | ForEach-Object { $h = ConvertTo-DEHashtable $_; $h['name'] = $h['label']; $h })
}

function Get-DESolutions {
    return @(Get-DEStandaloneSolutions | ForEach-Object { $h = ConvertTo-DEHashtable $_; $h['name'] = $h['label']; $h })
}

function Get-DEBundle {
    <#
    One plan by id with its "extends" chain resolved (a GCC High variant inherits its commercial tier).
    Accepts the bundle id (proactive-business), the tier key (Business) or the tier id (business).
    #>
    param([Parameter(Mandatory = $true)][string]$Id)
    $all = Get-DEBundles
    $b = @($all | Where-Object { $_['id'] -eq $Id -or $_['tierKey'] -eq $Id -or $_['tierId'] -eq $Id } | Select-Object -First 1)
    if (-not $b.Count) { throw "bundle '$Id' is not in catalog\bundles.json (known: $((@($all | ForEach-Object { $_['id'] })) -join ', '))" }
    $h = $b[0]
    if ($h['extends']) {
        $parent = Get-DEBundle -Id $h['extends']
        $name = $h['name']; $own = $h['id']
        $h = Merge-DEData -Base $parent -Override $h
        $h['id'] = $own; $h['name'] = $name
    }
    return $h
}

function Get-DESolution {
    param([Parameter(Mandatory = $true)][string]$Id)
    $s = @(Get-DESolutions | Where-Object { $_['id'] -eq $Id } | Select-Object -First 1)
    if (-not $s.Count) { throw "solution '$Id' is not in catalog\bundles.json (known: $((@(Get-DESolutions | ForEach-Object { $_['id'] })) -join ', '))" }
    return $s[0]
}

function Merge-DEData {
    <# Deep merge of plain data (hashtables / objects). Override wins; nested maps merge; lists replace. #>
    param($Base, $Override)
    $b = $(if ($null -eq $Base) { @{} } else { ConvertTo-DEHashtable $Base })
    $o = $(if ($null -eq $Override) { @{} } else { ConvertTo-DEHashtable $Override })
    $out = [ordered]@{}
    foreach ($k in $b.Keys) { $out[$k] = $b[$k] }
    foreach ($k in $o.Keys) {
        if ($out.Contains($k) -and $out[$k] -is [System.Collections.IDictionary] -and $o[$k] -is [System.Collections.IDictionary]) { $out[$k] = Merge-DEData -Base $out[$k] -Override $o[$k] }
        else { $out[$k] = $o[$k] }
    }
    return $out
}

# ------------------------------------------------------------------ composition
function New-DEComposedProfile {
    <#
    Client profile + bundle + add-ons + standalone solutions -> one profile with a .plan section:
      plan = @{ bundle; bundleName; addOns; solutions; managed; gcch; exclude[]; includeOnly[]; manualSteps[]; prerequisites[]; coManagedAreas[] }
    The client profile keeps its tenant ids, branding, sites and detection; the bundle sets components.
    Idempotent: composing an already composed profile gives the same plan.
    #>
    param(
        [Parameter(Mandatory = $true)]$ClientProfile,
        [string]$Bundle,
        [string[]]$AddOn = @(),
        [string[]]$Solution = @()
    )
    $p = ConvertTo-DEHashtable $ClientProfile
    # -Solution without -Bundle is a standalone purchase: the profile's default bundle must not override it
    $standaloneAsked = (@($Solution | Where-Object { $_ }).Count -gt 0) -and -not $Bundle
    if (-not $Bundle -and -not $standaloneAsked -and $p['plan'] -and $p['plan']['bundle']) { $Bundle = $p['plan']['bundle'] }
    if (-not $standaloneAsked -and -not @($AddOn | Where-Object { $_ }).Count -and $p['plan'] -and $p['plan']['addOns']) { $AddOn = @($p['plan']['addOns']) }
    if (-not @($Solution | Where-Object { $_ }).Count -and $p['plan'] -and $p['plan']['solutions']) { $Solution = @($p['plan']['solutions']) }
    $AddOn = @($AddOn | Where-Object { $_ }); $Solution = @($Solution | Where-Object { $_ })
    $plan = [ordered]@{ bundle = $null; bundleName = $null; addOns = $AddOn; solutions = $Solution; managed = $true; gcch = [bool]$p['gcch']; exclude = @(); includeOnly = @(); manualSteps = @(); prerequisites = @(); coManagedAreas = @() }
    $catalog = Get-DEPlanCatalog

    if ($Bundle) {
        $b = Get-DEBundle -Id $Bundle
        $plan.bundle = $b['id']; $plan.bundleName = $b['name']; $plan.managed = [bool]$b['managed']
        if ($b['profile']) { $p = Merge-DEData -Base $p -Override $b['profile'] }
        if ($b['plan'] -and $b['plan']['exclude']) { $plan.exclude += @($b['plan']['exclude']) }
        if ($b['plan'] -and $b['plan']['coManagedAreas']) {
            $areas = @(Get-DEHashPath -Object $p -Path 'coManaged.deOwns' | Where-Object { $null -ne $_ })
            if (-not $areas.Count) { $areas = @('identity', 'security', 'updates', 'support') }
            $map = ConvertTo-DEHashtable $catalog.coManagedAreas
            # a misspelled area would silently mean "no limit": refuse it and name the valid ones
            $unknown = @($areas | Where-Object { -not $map.Contains($_) })
            if ($unknown.Count) { throw "unknown co-managed area(s) in coManaged.deOwns: $($unknown -join ', ') (valid: $((@($map.Keys) | Sort-Object) -join ', '))" }
            $plan.coManagedAreas = $areas
            foreach ($a in $areas) { if ($map.Contains($a)) { $plan.includeOnly += @($map[$a]) } }
        }
        $allowed = @($b['addOns'] | Where-Object { $_ })
        foreach ($id in $AddOn) {
            $found = @(Get-DEAddOns | Where-Object { $_['id'] -eq $id })
            if (-not $found.Count) { throw "add-on '$id' is not in catalog\bundles.json" }
            $ao = $found[0]
            if ($allowed.Count -and $allowed -notcontains $id -and $id -notin @('ucaas', 'spend-card-controls', 'advanced-managed-workplace')) { Write-DELog -Level WARN -Message "add-on '$id' is not listed for $($b['name']); applied anyway" }
            if ($ao['profile']) { $p = Merge-DEData -Base $p -Override $ao['profile'] }
            foreach ($re in @($ao['plan']['reinclude'] | Where-Object { $_ })) { $plan.exclude = @($plan.exclude | Where-Object { $_ -ne $re }) }
            foreach ($m in @($ao['manualSteps'] | Where-Object { $_ })) { $plan.manualSteps += @{ key = "addon-$id-$($m['id'])"; title = $m['title']; source = $ao['name'] } }
        }
        # an add-on that deploys a second MDR agent appends, it does not replace
        $extra = @(Get-DEHashPath -Object $p -Path 'security.mdr.deployAdd' | Where-Object { $_ })
        if ($extra.Count) { $p['security']['mdr']['deploy'] = @(@($p['security']['mdr']['deploy']) + $extra | Select-Object -Unique); $p['security']['mdr'].Remove('deployAdd') }
    }

    if ($AddOn.Count -and -not $Bundle) { throw "add-ons ($($AddOn -join ', ')) belong to a ProActive plan; a standalone solution has none" }
    if ($Solution.Count) {
        $keepSupport = $false; $solutionScope = @()
        foreach ($id in $Solution) {
            $s = Get-DESolution -Id $id
            $solutionScope += @($s['includeOnly'] | Where-Object { $_ })
            if ($s['keepSupport']) { $keepSupport = $true }
            foreach ($m in @($s['manualSteps'] | Where-Object { $_ })) { $plan.manualSteps += @{ key = "$id-$($m['id'])"; title = $m['title']; source = $s['name'] } }
            foreach ($q in @($s['prerequisites'] | Where-Object { $_ })) { $plan.prerequisites += @{ key = "$id-$($q['id'])"; title = $q['title']; source = $s['name'] } }
        }
        if (-not $Bundle) {
            # standalone: only the solutions' own actions, without DE's managed-services model
            $plan.managed = $false
            $plan.includeOnly = @($solutionScope | Select-Object -Unique)
            if (-not $keepSupport) { $plan.exclude += @($catalog.standaloneExclude) }
            if (-not @($plan.includeOnly).Count) { $plan.includeOnly = @('^$') }   # manual-only solutions register no endpoint changes
        }
        # with a bundle, solutions add their steps and prerequisites only: they never narrow a ProActive plan and
        # never widen a co-managed one past the areas DE owns (includeOnly stays whatever the bundle set)
    }
    $plan.gcch = [bool]$p['gcch']
    $p['plan'] = $plan
    return $p
}

# ------------------------------------------------------------------ applying a plan to the registered actions
function Select-DEPlanActions {
    <# Called by Initialize-DEWorkflow after every module registered its actions. Returns the ids taken out of scope. #>
    param($ClientProfile, [string]$Mode)
    $plan = Get-DEHashPath -Object $ClientProfile -Path 'plan'
    $de = Get-DEConsole
    $out = @()
    if ($Mode -eq 'dropship') {
        # a dropship device is new: identity migration and Entra/MDM cleanup never apply to it
        $never = @((Get-DEPlanCatalog).modes.dropship.excludedActionIds | Where-Object { $_ })
        foreach ($id in @($de.Actions.Keys)) { if ($never -contains $id) { $de.Actions.Remove($id); $out += $id } }
    }
    if ($plan) {
        $includeOnly = @(Get-DEHashPath -Object $plan -Path 'includeOnly' | Where-Object { $null -ne $_ })
        $exclude = @(Get-DEHashPath -Object $plan -Path 'exclude' | Where-Object { $_ })
        foreach ($id in @($de.Actions.Keys)) {
            if ($id -like 'deprov.*' -or $id -like 'order.*' -or $id -like 'plan.*') { continue }
            $keep = $true
            if ($includeOnly.Count) { $keep = [bool](@($includeOnly | Where-Object { $id -match $_ }).Count) }
            if ($keep -and @($exclude | Where-Object { $id -match $_ }).Count) { $keep = $false }
            if (-not $keep) { $de.Actions.Remove($id); $out += $id }
        }
        # GCC High: no security agent installs until the provider is verified for the boundary
        if (Get-DEHashPath -Object $plan -Path 'gcch') {
            Register-DEGate -NoException -Id 'gate.gcch-verified' -Title 'Security providers verified for GCC High' -Module 'plan' -Check {
                if (Get-DEState -Path 'plan.confirmed.gcch-verified') { @{ Status = 'PASS'; Detail = 'verification recorded' } } else { @{ Status = 'BLOCKED'; Detail = 'GCCH: the commercial MDR/EDR packaging does not transfer automatically' } }
            } -Unblock 'Confirm with each provider that its agent and tenant are authorised for GCC High, then choose Confirm done on "GCC High providers verified".'
            foreach ($id in @($de.Actions.Keys | Where-Object { $_ -match '^security\.(guardz|sentinelone|blackpoint|pabx)$' })) { $a = $de.Actions[$id]; $a.Gates = @(@($a.Gates) + 'gate.gcch-verified' | Select-Object -Unique) }
            Register-DEPlanStep -Key 'gcch-verified' -Title 'GCC High providers verified for this client' -Source 'GCC High'
        }
        # prerequisites gate every endpoint change in the plan
        foreach ($q in @(Get-DEHashPath -Object $plan -Path 'prerequisites' | Where-Object { $_ })) {
            $key = $q['key']; $gid = "gate.prereq.$key"
            Register-DEGate -Id $gid -Title "Prerequisite: $($q['title'])" -Module 'plan' -Check ({
                    if (Get-DEState -Path "plan.confirmed.$key") { @{ Status = 'PASS'; Detail = 'confirmed' } } else { @{ Status = 'BLOCKED'; Detail = 'not confirmed yet' } }
                }.GetNewClosure()) -Unblock "Choose Confirm done on the prerequisite '$($q['title'])' once it is true."
            foreach ($id in @($de.Actions.Keys | Where-Object { $_ -notlike 'plan.*' -and $_ -notlike 'order.*' })) { $a = $de.Actions[$id]; if ($a.Apply) { $a.Gates = @(@($a.Gates) + $gid | Select-Object -Unique) } }
            Register-DEPlanStep -Key $key -Title $q['title'] -Source $q['source'] -Phase 0
        }
        foreach ($m in @(Get-DEHashPath -Object $plan -Path 'manualSteps' | Where-Object { $_ })) { Register-DEPlanStep -Key $m['key'] -Title $m['title'] -Source $m['source'] }
    }
    # an order belongs to one client's device: a leftover order for another client never adds its gates here
    $order = Get-DEOrder
    if ($order -and "$($order['client'])" -eq "$(Get-DEHashPath -Object $ClientProfile -Path 'id')") { Register-DEOrderActions -Mode $Mode }
    Set-DEStateValue -Path 'workflow.outOfPlan' -Value $out
    return $out
}

function Register-DEPlanStep {
    <# A confirm-to-complete step (things done in a portal, with a person, or off the device). #>
    param([Parameter(Mandatory = $true)][string]$Key, [Parameter(Mandatory = $true)][string]$Title, [string]$Source = 'plan', [int]$Phase = 15)
    $k = $Key
    Register-DEAction -Id "plan.$Key" -Module 'plan' -Title $Title -Phase $Phase `
        -Detect ({ @{ confirmed = [bool](Get-DEState -Path "plan.confirmed.$k") } }.GetNewClosure()) -Desired { @{ confirmed = $true } } `
        -ManualAction "$Source`: $Title. When it is done, choose Confirm done (DE Tech Tool records who and when)." -Description "plan step from $Source"
}

function Confirm-DEPlanStep {
    <# Records that a manual plan step or prerequisite is done: who, when, and an optional note. Never a secret. #>
    param([Parameter(Mandatory = $true)][string]$Key, [string]$Note = '')
    $Key = $Key -replace '^plan\.', ''
    # a note the redactor would change carries a credential shape: refuse it rather than store a redacted half-secret
    if ($Note -and (Protect-DEText $Note) -ne $Note) { throw 'that note looks like it contains a secret; it was not recorded' }
    $who = "$((Get-DEContext)['technician'])"
    Set-DEStateValue -Path "plan.confirmed.$Key" -Value @{ at = (Get-Date).ToString('o'); by = $who; note = (Protect-DEText $Note) }
    Reset-DEGateCache
    Add-DEEvidence -Step "plan.$Key" -Module 'plan' -Before 'not confirmed' -ActionTaken "confirmed by $who" -Result 'PASS' -Verification $(if ($Note) { Protect-DEText $Note } else { 'confirmed in DE Tech Tool' }) | Out-Null
}

# ------------------------------------------------------------------ dropship orders
function Import-DEOrderManifest {
    <#
    Loads a dropship order (no secrets): who the device is for, which bundle, and which exact device (serial,
    model) was ordered. DE Tech Tool refuses to provision a different machine against it.
    #>
    param([Parameter(Mandatory = $true)][string]$Path)
    $o = ConvertTo-DEHashtable (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
    if ("$($o['schema'])" -ne 'de.techconsole.order/v1') { throw "not a DE order manifest (schema '$($o['schema'])')" }
    $hits = @(Test-DEProfileHasSecrets -Profile $o)
    if ($hits.Count) { throw "order manifest contains secret-looking fields ($($hits -join ', ')); secrets are entered at run time, never shipped in an order" }
    foreach ($req in @('orderId', 'client')) { if (-not $o[$req]) { throw "order manifest is missing '$req'" } }
    Set-DEStateValue -Path 'order' -Value $o
    $ctx = @{ orderNumber = $o['orderId'] }
    $eu = $o['endUser']; $dev = $o['device']
    if ($eu) { foreach ($pair in @(@('endUser', 'displayName'), @('endUserEmail', 'upn'), @('localUserName', 'localUserName'), @('jumpcloudUser', 'jumpcloudUser'))) { if ($eu[$pair[1]]) { $ctx[$pair[0]] = $eu[$pair[1]] } } }
    if ($dev) { if ($dev['hostname']) { $ctx['desiredHostname'] = $dev['hostname'] }; if ($dev['assetTag']) { $ctx['assetTag'] = $dev['assetTag'] } }
    Set-DEContext -Values $ctx
    Add-DEEvidence -Step 'order.loaded' -Module 'order' -Before 'no order' -ActionTaken "order $($o['orderId']) loaded" -Result 'INFO' -Verification ("client {0}; bundle {1}; device {2} {3}" -f $o['client'], $o['bundle'], (Get-DEHashPath -Object $dev -Path 'model'), (Get-DEHashPath -Object $dev -Path 'serial')) | Out-Null
    return $o
}

function Get-DEOrder { return (Get-DEState -Path 'order') }

function Test-DEOrderMatch {
    <# Compares this device with the order: serial must match when the order names one; model must contain the ordered model. #>
    param($Device)
    $o = Get-DEOrder
    if (-not $o) { return @{ Status = 'WARN'; Detail = 'no order loaded' } }
    if (-not $Device) { $Device = Get-DEDeviceInventory }
    $want = Get-DEHashPath -Object $o -Path 'device'
    $wantSerial = "$(Get-DEHashPath -Object $want -Path 'serial')".Trim(); $haveSerial = "$(Get-DEHashPath -Object $Device -Path 'serial')".Trim()
    $wantModel = "$(Get-DEHashPath -Object $want -Path 'model')".Trim(); $haveModel = "$(Get-DEHashPath -Object $Device -Path 'model')".Trim()
    $issues = @()
    if ($wantSerial) { if (-not $haveSerial) { $issues += 'this device reports no serial number' } elseif ($wantSerial -ne $haveSerial) { $issues += "serial is $haveSerial, the order is for $wantSerial" } }
    if ($wantModel -and $haveModel -and $haveModel -notlike "*$wantModel*" -and $wantModel -notlike "*$haveModel*") { $issues += "model is '$haveModel', the order is for '$wantModel'" }
    if ($issues.Count) { return @{ Status = 'BLOCKED'; Detail = "wrong device for order $($o['orderId']): " + ($issues -join '; ') } }
    if (-not $wantSerial) { return @{ Status = 'WARN'; Detail = "order $($o['orderId']) names no serial; model checked only" } }
    return @{ Status = 'PASS'; Detail = "serial $haveSerial matches order $($o['orderId'])" }
}

function Register-DEOrderActions {
    param([string]$Mode)
    Register-DEGate -NoException -Id 'gate.order-match' -Title 'This is the device on the order' -Module 'order' -Check { Test-DEOrderMatch } `
        -Unblock 'Check the serial on the box against the order; if the distributor shipped a different unit, update the order manifest (serial) before provisioning.'
    Register-DEAction -Id 'order.verify-device' -Module 'order' -Title 'Device matches the dropship order (serial and model)' -Phase 0 `
        -Detect { $r = Test-DEOrderMatch; @{ matches = ($r.Status -eq 'PASS'); detail = $r.Detail } } -Desired { @{ matches = $true } } `
        -ManualAction 'Compare the serial on the chassis with the order; DE Tech Tool will not provision a different device against it.'
    Register-DEPlanStep -Key 'order-handoff' -Title 'End user signed in on the new device and confirmed it works' -Source 'Dropship handoff' -Phase 16
    if ($Mode -eq 'dropship') {
        $de = Get-DEConsole
        foreach ($id in @($de.Actions.Keys | Where-Object { $_ -notlike 'order.*' -and $_ -notlike 'plan.*' })) { $a = $de.Actions[$id]; if ($a.Apply) { $a.Gates = @(@($a.Gates) + 'gate.order-match' | Select-Object -Unique) } }
    }
}

# ------------------------------------------------------------------ recommendations
function Get-DERecommendedMode {
    <#
    Recommendation only; it never changes a machine. The technician remains the decision maker.
    Returns mode, reason (one line) and reasons (each finding).
    #>
    param($Snapshot, $ClientProfile)
    $result = { param($m, [string[]]$r) [pscustomobject]@{ mode = $m; reason = ($r -join '; '); reasons = $r } }
    if (Get-DEOrder) { return (& $result 'dropship' @("dropship order $((Get-DEOrder)['orderId']) is loaded for this device")) }
    if ("$(Get-DEHashPath -Object $ClientProfile -Path 'delivery.mode')" -eq 'dropship') { return (& $result 'dropship' @('client profile marks this device as a dropship / pre-provision build')) }
    if ("$(Get-DEHashPath -Object $ClientProfile -Path 'tier')" -eq 'Co-managed' -or "$(Get-DEHashPath -Object $ClientProfile -Path 'plan.bundle')" -eq 'co-managed') { return (& $result 'co-managed' @('the client profile is on the Co-Managed IT path')) }
    if (-not $Snapshot) { return (& $result 'audit' @('discovery has not run yet: audit first, change nothing')) }
    $join = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.joinType')"
    if (-not $join) { $join = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.dsreg.joinType')" }
    if (-not $join) { $join = "$(Get-DEHashPath -Object $Snapshot -Path 'joinType')" }
    $auth = "$(Get-DEHashPath -Object $Snapshot -Path 'mdm.authority')"
    $agents = Get-DEHashPath -Object $Snapshot -Path 'agents.agents'
    $has = { param($id) [bool](Get-DEHashPath -Object $agents -Path "$id.installed") }
    $jc = ($auth -eq 'jumpcloud') -or [bool](Get-DEHashPath -Object $Snapshot -Path 'mdm.jumpcloud.installed') -or [bool](Get-DEHashPath -Object $Snapshot -Path 'jumpcloud.installed')
    if ($jc -and (& $has 'sentinelone') -and (& $has 'guardz')) { return (& $result 'repair' @('the DE stack is already on this device (JumpCloud, SentinelOne, Guardz): check health and fix only what is missing')) }
    $why = @()
    if ($auth -match 'intune|dual|other') { $why += "another MDM manages this device ($auth)" }
    if ($join -match 'entra|azure|domain') { $why += "it is $join; audit identity state before any migration" }
    $foreignEdr = @(Get-DEHashPath -Object $Snapshot -Path 'agents.conflictingEdr' | Where-Object { $_ })
    if ($foreignEdr.Count) { $why += "another EDR is installed ($($foreignEdr -join ', '))" }
    if ($why.Count) { return (& $result 'takeover' $why) }
    if ($jc) { return (& $result 'repair' @('JumpCloud already appears present; verify and repair drift instead of treating the device as unknown')) }
    $profiles = @(Get-DEHashPath -Object $Snapshot -Path 'identity.profiles' | Where-Object { $_ })
    if ($join -match '^(local|workgroup|unknown)' -or -not $join) {
        if ($profiles.Count -le 2) { return (& $result 'new' @("no managed identity and $($profiles.Count) user profile(s): looks out of the box; confirm discovery, then provision")) }
        return (& $result 'audit' @("local device with $($profiles.Count) user profiles: someone has used it; audit before choosing"))
    }
    return (& $result 'audit' @("unfamiliar join state '$join'; audit before applying changes"))
}

function Get-DEExecutionPlan {
    <# What will run: client, tier, capabilities, the composed plan and the in-plan actions for the mode. #>
    param([Parameter(Mandatory = $true)]$ClientProfile, [string]$Mode = 'audit')
    $tier = "$(Get-DEHashPath -Object $ClientProfile -Path 'tier')"; if (-not $tier) { $tier = 'Office' }
    $capabilities = @()
    $standalone = (-not "$(Get-DEHashPath -Object $ClientProfile -Path 'plan.bundle')") -and @(Get-DEHashPath -Object $ClientProfile -Path 'plan.solutions' | Where-Object { $_ }).Count
    if ($standalone) { $capabilities = @(Get-DEHashPath -Object $ClientProfile -Path 'plan.solutions' | Where-Object { $_ }) }   # a standalone buyer gets the solutions, not a tier
    elseif ($script:TierKeys -contains $tier) { $capabilities = @((Get-DEProActiveBundle -Tier $tier).capabilities) }
    $actions = @(Get-DEActions -Mode $Mode | ForEach-Object {
            [pscustomobject]@{ id = $_.Id; module = $_.Module; title = $_.Title; phase = $_.Phase; destructive = $_.Destructive; requiresReboot = $_.RequiresReboot }
        })
    return [pscustomobject]@{
        product             = 'DE Tech Tool'
        client              = "$(Get-DEHashPath -Object $ClientProfile -Path 'id')"
        tier                = $tier
        mode                = $Mode
        bundle              = "$(Get-DEHashPath -Object $ClientProfile -Path 'plan.bundle')"
        bundleName          = "$(Get-DEHashPath -Object $ClientProfile -Path 'plan.bundleName')"
        solutions           = @(Get-DEHashPath -Object $ClientProfile -Path 'plan.solutions' | Where-Object { $_ })
        managed             = [bool](Get-DEHashPath -Object $ClientProfile -Path 'plan.managed')
        capabilities        = $capabilities
        standaloneSolutions = @(Get-DEStandaloneSolutions)
        actions             = $actions
    }
}

Export-ModuleMember -Function Get-DEPlanCatalog, Get-DEProActiveBundle, Get-DEStandaloneSolutions, Get-DEBundles, Get-DEBundle, Get-DEAddOns, Get-DESolutions, Get-DESolution, Merge-DEData, New-DEComposedProfile, Select-DEPlanActions, Register-DEPlanStep, Confirm-DEPlanStep, Import-DEOrderManifest, Get-DEOrder, Test-DEOrderMatch, Register-DEOrderActions, Get-DERecommendedMode, Get-DEExecutionPlan
