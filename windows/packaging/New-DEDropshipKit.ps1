<#
.SYNOPSIS
    Builds a preconfigured dropship kit: the device ships from the distributor straight to the end user, and the
    kit provisions it at first boot for that user, that client and that bundle, and only on the ordered unit.

.DESCRIPTION
    Output: <OutDir>\DE-Dropship-<OrderId>\ and a zip of it with a .sha256 file.
      order.json              the order (no secrets): client, bundle, add-ons, solutions, end user, device serial/model
      FirstBoot.cmd           double-click on the new device (asks for administrator rights)
      Invoke-DEFirstBoot.ps1  runs DE Tech Tool headless in dropship mode, then opens it on the workflow
      README.txt              the one-page card for whoever is at the device
      DE-TechTool\            DE Tech Tool, with the composed client profile (bundle applied, no secrets)
    First boot refuses to change anything if the serial number does not match the order (gate.order-match).
    Secrets (JumpCloud connect key, SentinelOne site token, Guardz org key, break-glass password) are never in
    the kit: they come from RMM secure variables (DE_SECRET_<NAME>), the DE vault, or the technician types them
    on the call when -PromptSecrets asks.

.EXAMPLE
    .\New-DEDropshipKit.ps1 -Client alamo -Bundle proactive-business -OrderId DE-ORD-2026-0142 `
        -EndUserName 'Suzette Thompson' -EndUserUpn sthompson@alamo.example -Serial 7XK2Q14 -Model 'Latitude 7450' `
        -Hostname ALAMO-LAP-0231 -AssetTag ALAMO-0231 -PoNumber PO-5512 -Distributor 'Ingram Micro'
    .\New-DEDropshipKit.ps1 -OrderFile .\order.json
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$OrderFile,
    [string]$Client,
    [string]$Bundle,
    [string[]]$AddOn = @(),
    [string[]]$Solution = @(),
    [string]$OrderId,
    [string]$EndUserName,
    [string]$EndUserUpn,
    [string]$LocalUserName,
    [string]$Serial,
    [string]$Model,
    [string]$Manufacturer,
    [string]$AssetTag,
    [string]$Hostname,
    [string]$PoNumber,
    [string]$Distributor,
    [string]$Technician = 'jrpetro',
    [string]$WindowsRoot,
    [string]$OutDir
)
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$here = $(if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path })   # $PSScriptRoot can be empty in param defaults on Windows PowerShell 5.1
if (-not $WindowsRoot) { $WindowsRoot = Split-Path -Parent $here }
if (-not $OutDir) { $OutDir = Join-Path (Join-Path $here 'out') 'dropship' }
$consoleRoot = Join-Path $WindowsRoot 'console'

Import-Module (Join-Path (Join-Path (Join-Path $consoleRoot 'modules') 'DE.Workflow') 'DE.Workflow.psm1') -Force -DisableNameChecking
Import-DEConsoleModules -Root $consoleRoot
$null = Initialize-DEConsole -Root $consoleRoot -Mode Audit -DataDir (Join-Path ([IO.Path]::GetTempPath()) "de-dropship-build-$PID")

if ($OrderFile) {
    $order = ConvertTo-DEHashtable (Get-Content -LiteralPath $OrderFile -Raw | ConvertFrom-Json)
} else {
    foreach ($req in @('Client', 'OrderId')) { if (-not (Get-Variable -Name $req -ValueOnly)) { throw "-$req is required (or pass -OrderFile)" } }
    if (-not $LocalUserName -and $EndUserName) { $LocalUserName = ConvertTo-DELocalUserName -DisplayOrPrincipal $EndUserName }
    $order = [ordered]@{
        schema = 'de.techconsole.order/v1'; orderId = $OrderId; client = $Client; bundle = $Bundle
        addOns = @($AddOn | Where-Object { $_ }); solutions = @($Solution | Where-Object { $_ })
        endUser = [ordered]@{ displayName = $EndUserName; upn = $EndUserUpn; localUserName = $LocalUserName; jumpcloudUser = $LocalUserName }
        device = [ordered]@{ manufacturer = $Manufacturer; model = $Model; serial = $Serial; assetTag = $AssetTag; hostname = $Hostname; role = 'laptop' }
        procurement = [ordered]@{ distributor = $Distributor; poNumber = $PoNumber; dropship = $true }
        technician = $Technician; created = (Get-Date).ToString('o')
    }
}
if ("$($order['schema'])" -ne 'de.techconsole.order/v1') { throw 'not a DE order manifest' }
$hits = @(Test-DEProfileHasSecrets -Profile $order); if ($hits.Count) { throw "the order contains secret-looking fields ($($hits -join ', ')); remove them" }
if (-not $order['device']['serial']) { Write-Warning 'No serial in the order: first boot can only check the model. Add the serial from the distributor''s ship notice for a real guard.' }

# The composed profile ships inside the kit so first boot needs nothing from DE's network to know the plan.
$composed = New-DEComposedProfile -ClientProfile (Get-DEClientProfile -Id $order['client']) -Bundle $order['bundle'] -AddOn @($order['addOns']) -Solution @($order['solutions'])
$hits = @(Test-DEProfileHasSecrets -Profile $composed); if ($hits.Count) { throw "the client profile contains secret-looking fields ($($hits -join ', ')); fix the profile first" }
$composed['plan'] = [ordered]@{ bundle = $order['bundle']; addOns = @($order['addOns']); solutions = @($order['solutions']) }

$kitName = "DE-Dropship-$($order['orderId'])"
$kit = Join-Path $OutDir $kitName
if (-not $PSCmdlet.ShouldProcess($kit, 'build dropship kit')) { return }
if (Test-Path -LiteralPath $kit) { Remove-Item -LiteralPath $kit -Recurse -Force }
New-Item -ItemType Directory -Path $kit -Force | Out-Null
$app = Join-Path $kit 'DE-TechTool'
New-Item -ItemType Directory -Path $app -Force | Out-Null
foreach ($item in Get-ChildItem -LiteralPath $WindowsRoot) {
    if ($item.Name -in @('tests', 'packaging')) { continue }
    Copy-Item -LiteralPath $item.FullName -Destination $app -Recurse -Force
}
$profileOut = Join-Path (Join-Path (Join-Path (Join-Path $app 'console') 'catalog') 'profiles') "$($order['client']).json"
$composed | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $profileOut -Encoding UTF8
$order | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $kit 'order.json') -Encoding UTF8

$firstBoot = @'
<#
.SYNOPSIS  DE dropship first boot: provisions this device for the order in order.json, then opens the console.
#>
param([switch]$AuditOnly)
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$console = Join-Path (Join-Path (Join-Path $here 'DE-TechTool') 'console') 'DETechConsole.ps1'
$order = Join-Path $here 'order.json'
if ($env:OS -eq 'Windows_NT') { Get-ChildItem -LiteralPath $here -Recurse -File | Unblock-File }
$args2 = @('-Headless', '-Order', $order, '-Technician', 'jrpetro', '-PromptSecrets')
if (-not $AuditOnly) { $args2 += @('-Apply', '-Mode', 'dropship') } else { $args2 += @('-Mode', 'audit') }
# a child process, so the tool's exit code comes back here and the result message below always shows
$out = @(& (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File $console @args2 2>&1 | ForEach-Object { Write-Host "$_"; "$_" })
$code = $LASTEXITCODE
# READY needs both exit 0 and the tool's own RESULT line: a run that stopped early is never reported as done
$result = @($out | Where-Object { $_ -like 'RESULT: *' } | Select-Object -Last 1)
if ($code -eq 0 -and -not ($result.Count -and $result[0] -match '^RESULT: READY')) { $code = 1 }
Write-Host ''
switch ($code) {
    0 { Write-Host 'READY. The device is provisioned for its user.' -ForegroundColor Green }
    1 { Write-Host 'NOT READY yet. DE Tech Tool lists what is left; a restart may be needed, then run FirstBoot again.' -ForegroundColor Yellow }
    default { Write-Host 'BLOCKED. Read the reason above (for example: this is not the device on the order, or a secret was not entered).' -ForegroundColor Red }
}
# Open DE Tech Tool on the workflow so the technician sees the next step.
if ($env:OS -eq 'Windows_NT') { Start-Process -FilePath (Join-Path $here 'DE-TechTool\Start-DETechTool.cmd') -ArgumentList '-Page', 'Workflow' | Out-Null }
exit $code
'@
[IO.File]::WriteAllText((Join-Path $kit 'Invoke-DEFirstBoot.ps1'), $firstBoot, (New-Object Text.UTF8Encoding $true))
$cmd = "@echo off`r`nrem DE dropship first boot: runs elevated`r`nnet session >nul 2>&1 || (powershell -NoProfile -Command `"Start-Process -Verb RunAs -FilePath '%~f0'`" & exit /b)`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -File `"%~dp0Invoke-DEFirstBoot.ps1`"`r`npause`r`n"
[IO.File]::WriteAllText((Join-Path $kit 'FirstBoot.cmd'), $cmd, [Text.Encoding]::ASCII)

$bundleName = $(if ($composed['plan'] -and $order['bundle']) { (Get-DEBundle -Id $order['bundle'])['name'] } elseif (@($order['solutions']).Count) { 'Standalone: ' + (@($order['solutions']) -join ', ') } else { 'client profile' })
$readme = @"
Digerati Experts - new device setup (order $($order['orderId']))

For: $($order['endUser']['displayName'])   Device: $($order['device']['manufacturer']) $($order['device']['model'])   Serial: $($order['device']['serial'])
Plan: $bundleName

1. Unbox and power on. Finish Windows setup with a temporary local account (DE will tell you the name).
2. Copy this folder to the device (USB or download), then double-click FirstBoot.cmd and choose Yes.
3. Keep the DE technician on the phone: they enter the security keys when asked. Nothing secret is in this folder.
4. The device restarts when needed; run FirstBoot.cmd again after a restart if DE Tech Tool asks.
5. When it says READY, sign in as yourself. DE confirms the handoff with you.

This folder only works on the device from this order. Questions: DE support.
"@
Set-Content -LiteralPath (Join-Path $kit 'README.txt') -Value $readme -Encoding UTF8

$zip = "$kit.zip"
if (Test-Path -LiteralPath $zip) { Remove-Item -LiteralPath $zip -Force }
Compress-Archive -Path (Join-Path $kit '*') -DestinationPath $zip
$hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
Set-Content -LiteralPath "$zip.sha256" -Value "$hash  $(Split-Path -Leaf $zip)" -Encoding ASCII
Write-Host "Dropship kit: $kit"
Write-Host "Zip: $zip (sha256 $hash)"
Write-Host "Plan: $bundleName for $($order['client']); first boot provisions only serial '$($order['device']['serial'])'."
[pscustomobject]@{ folder = $kit; zip = $zip; sha256 = $hash; orderId = $order['orderId'] }
