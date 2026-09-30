#Requires -Version 5.1
<#
.SYNOPSIS
    Installs the Microsoft modules DE Microsoft Admin uses (only the Graph sub-modules it needs, not the whole SDK).
.EXAMPLE
    .\Install-DEMicrosoftDependencies.ps1                 # all users (elevated)
    .\Install-DEMicrosoftDependencies.ps1 -CurrentUser    # this user only
    .\Install-DEMicrosoftDependencies.ps1 -Only Graph     # skip Exchange and Azure
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param([switch]$CurrentUser, [ValidateSet('Graph', 'Exchange', 'Azure')][string[]]$Only = @('Graph', 'Exchange', 'Azure'))
Set-StrictMode -Version 1.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
$scope = $(if ($CurrentUser) { 'CurrentUser' } else { 'AllUsers' })
if ($scope -eq 'AllUsers' -and -not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Installing for all users needs an elevated PowerShell (or pass -CurrentUser).' }
$sets = @{
    Graph    = @(@{ Name = 'Microsoft.Graph.Authentication'; Min = '2.10.0' })   # Invoke-MgGraphRequest covers every endpoint the module uses
    Exchange = @(@{ Name = 'ExchangeOnlineManagement'; Min = '3.4.0' })
    Azure    = @(@{ Name = 'Az.Accounts'; Min = '2.13.0' }, @{ Name = 'Az.Resources'; Min = '6.12.0' })
}
if (-not (Get-PackageProvider -Name NuGet -ListAvailable -ErrorAction SilentlyContinue | Where-Object { $_.Version -ge [version]'2.8.5.201' })) { if ($PSCmdlet.ShouldProcess('NuGet provider', 'install')) { Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Scope $scope -Force | Out-Null } }
foreach ($set in $Only) {
    foreach ($m in $sets[$set]) {
        $have = Get-Module -ListAvailable -Name $m.Name | Sort-Object Version -Descending | Select-Object -First 1
        if ($have -and $have.Version -ge [version]$m.Min) { [pscustomobject]@{ module = $m.Name; action = 'present'; version = "$($have.Version)" }; continue }
        if (-not $PSCmdlet.ShouldProcess($m.Name, "install >= $($m.Min) for $scope")) { [pscustomobject]@{ module = $m.Name; action = 'planned' }; continue }
        Install-Module -Name $m.Name -MinimumVersion $m.Min -Scope $scope -Repository PSGallery -Force -AllowClobber
        [pscustomobject]@{ module = $m.Name; action = 'installed'; version = "$((Get-Module -ListAvailable -Name $m.Name | Sort-Object Version -Descending | Select-Object -First 1).Version)" }
    }
}
