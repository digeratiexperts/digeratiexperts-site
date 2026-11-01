# Move 89 (issue 807): the "refuse a device other than the ordered one" path with a wrong serial, at
# the gate level. The order match and the headless exit-2 path are covered in Console.Tests; what was
# missing is the refusal itself as a control: the gate fails closed on realistic wrong serials, the
# detail names both serials so the technician can see what happened, no approval can open the gate,
# and every apply in a dropship plan carries it. Compatible with Pester 4.10 and 5.x.

Describe 'Refuse a device other than the ordered one (wrong serial)' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $order = @{
            schema = 'de.techconsole.order/v1'; orderId = 'DE-ORD-2026-0890'; client = 'alamo'; bundle = 'proactive-business'
            addOns = @(); solutions = @()
            endUser = @{ displayName = 'Test User'; upn = 'test.user@alamo.example'; localUserName = 'test.user'; jumpcloudUser = 'test.user'; personClass = 'internal' }
            device = @{ manufacturer = 'Dell Inc.'; model = 'Latitude 7450'; serial = '7XK2Q14'; assetTag = 'ALAMO-0231'; hostname = 'ALAMO-LAP-0231'; role = 'laptop' }
            procurement = @{ distributor = 'Ingram Micro'; poNumber = 'PO-5512'; dropship = $true }
            technician = 'jrpetro'; created = '2026-09-28T00:00:00Z'
        }
        $f = Join-Path $global:DETest.Dir 'order.json'
        Set-DEJsonFile -Path $f -Object $order
        $null = Import-DEOrderManifest -Path $f
    }
    It 'a wrong serial is BLOCKED and the detail names both serials' {
        $m = Test-DEOrderMatch -Device @{ serial = '7XK2Q15'; model = 'Latitude 7450' }
        $m.Status | Should -Be 'BLOCKED'
        $m.Detail | Should -Match '7XK2Q15'
        $m.Detail | Should -Match '7XK2Q14'
        $m.Detail | Should -Match 'wrong device for order DE-ORD-2026-0890'
    }
    It 'a neighbouring unit of the same model is refused, and the ordered one passes' {
        foreach ($wrong in @('7XK2Q15', '7XK2Q1A', '8XK2Q14', '7XK2Q140')) {
            (Test-DEOrderMatch -Device @{ serial = $wrong; model = 'Latitude 7450' }).Status | Should -Be 'BLOCKED' -Because "serial $wrong is not the one on the order"
        }
        (Test-DEOrderMatch -Device @{ serial = '7XK2Q14'; model = 'Dell Latitude 7450' }).Status | Should -Be 'PASS'
    }
    It 'the order-match gate fails closed while the wrong machine is on the bench' {
        Mock -ModuleName DE.Planning Get-DEDeviceInventory { @{ serial = '7XK2Q15'; model = 'Latitude 7450' } }
        $null = @(Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'dropship')
        $g = Test-DEGate -Id 'gate.order-match' -Refresh
        $g.Status | Should -Be 'BLOCKED'
        $g.Unblock | Should -Not -BeNullOrEmpty -Because 'the technician needs to be told how to clear it'
        (Test-DEGatesSatisfied -Ids @('gate.order-match')).Ok | Should -Be $false
    }
    It 'the gate opens only for the ordered device' {
        Mock -ModuleName DE.Planning Get-DEDeviceInventory { @{ serial = '7XK2Q15'; model = 'Latitude 7450' } }
        Reset-DEGateCache
        (Test-DEGate -Id 'gate.order-match').Status | Should -Be 'BLOCKED'
        # the machine on the bench turns out to be the ordered one
        Mock -ModuleName DE.Planning Get-DEDeviceInventory { @{ serial = '7XK2Q14'; model = 'Dell Latitude 7450' } }
        Reset-DEGateCache
        (Test-DEGate -Id 'gate.order-match').Status | Should -Be 'PASS'
        (Test-DEGatesSatisfied -Ids @('gate.order-match')).Ok | Should -Be $true
    }
    It 'no approval can open the safety gate' {
        $null = @(Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'dropship')
        (Get-DEThrown { Add-DEException -Target 'gate.order-match' -Reason 'override' -Approver 'someone' -ExpiresOn (Get-Date).AddDays(1) }) | Should -Match 'safety gate'
        Reset-DEGateCache
        (Test-DEGate -Id 'gate.order-match').Status | Should -Not -Be 'EXCEPTION'
    }
    It 'every apply in a dropship plan carries the order-match gate' {
        $null = @(Initialize-DEWorkflow -ClientProfile (Get-DEClientProfile -Id 'alamo') -Mode 'dropship')
        $ungated = @(Get-DEActions -Mode 'dropship' | Where-Object { $_.Apply -and $_.Id -notlike 'order.*' -and $_.Id -notlike 'plan.*' } | Where-Object { @($_.Gates) -notcontains 'gate.order-match' })
        $ungated.Count | Should -Be 0 -Because ("ungated: " + (($ungated | ForEach-Object { $_.Id }) -join ', '))
    }
}
