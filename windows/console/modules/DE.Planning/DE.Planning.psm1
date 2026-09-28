#Requires -Version 5.1
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'

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

function Get-DERecommendedMode {
    <# Recommendation only; it never changes a machine. The technician remains the decision maker. #>
    param($Snapshot, $ClientProfile)
    $delivery = "$(Get-DEHashPath -Object $ClientProfile -Path 'delivery.mode')"
    if ($delivery -eq 'dropship') { return [pscustomobject]@{ mode='dropship'; reason='client profile marks this device as a dropship / pre-provision build' } }
    $join = "$(Get-DEHashPath -Object $Snapshot -Path 'identity.joinType')"
    if (-not $join) { $join = "$(Get-DEHashPath -Object $Snapshot -Path 'joinType')" }
    $jc = [bool](Get-DEHashPath -Object $Snapshot -Path 'jumpcloud.installed')
    if ($jc) { return [pscustomobject]@{ mode='repair'; reason='JumpCloud already appears present; verify and repair drift instead of treating the device as unknown' } }
    if ($join -match 'entra|azure') { return [pscustomobject]@{ mode='takeover'; reason="existing $join identity state should be audited before any migration" } }
    if ($join -match 'local|workgroup' -or -not $join) { return [pscustomobject]@{ mode='new'; reason='no existing managed identity was detected; use new-device provisioning after discovery is confirmed' } }
    return [pscustomobject]@{ mode='audit'; reason="unfamiliar join state '$join'; audit before applying changes" }
}

function Get-DEExecutionPlan {
    param([Parameter(Mandatory = $true)]$ClientProfile, [string]$Mode = 'audit')
    $tier = "$(Get-DEHashPath -Object $ClientProfile -Path 'tier')"; if (-not $tier) { $tier = 'Office' }
    $bundle = Get-DEProActiveBundle -Tier $tier
    $actions = @(Get-DEActions -Mode $Mode | ForEach-Object {
        [pscustomobject]@{ id=$_.Id; module=$_.Module; title=$_.Title; phase=$_.Phase; destructive=$_.Destructive; requiresReboot=$_.RequiresReboot }
    })
    return [pscustomobject]@{
        product = 'DE Tech Tool'
        client = "$(Get-DEHashPath -Object $ClientProfile -Path 'id')"
        tier = $tier
        mode = $Mode
        capabilities = @($bundle.capabilities)
        standaloneSolutions = @(Get-DEStandaloneSolutions)
        actions = $actions
    }
}

Export-ModuleMember -Function Get-DEPlanCatalog, Get-DEProActiveBundle, Get-DEStandaloneSolutions, Get-DERecommendedMode, Get-DEExecutionPlan
