# Move 84 (issue 802): the dropship kit against real serial number samples. The samples are the shapes
# OEMs actually print on ship notices and chassis stickers (Dell service tag, Lenovo PF..., HP 5CD...,
# Surface 12-digit, ASUS/Dynabook alphanumerics) - format samples, not client devices. Each one must
# form a device key, sit in a valid order manifest, match the machine it was bought for, and survive the
# kit build byte for byte. Compatible with Pester 4.10 and 5.x.

Describe 'Dropship kit against real serial number samples' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $global:DETest = @{ Win = Split-Path -Parent $script:ConsoleRoot; Exe = (Get-Process -Id $PID).Path; Tmp = Join-Path ([IO.Path]::GetTempPath()) ("de-serials-{0}" -f ([guid]::NewGuid())) }
        # Format-realistic samples: maker as WMI reports it, serial as the ship notice prints it, the
        # device key every component must agree on, and the model name on the order.
        $global:DESerialSamples = @(
            [pscustomobject]@{ Maker = 'Dell Inc.'; Serial = '7XK2Q14'; Key = 'dell:7XK2Q14'; Model = 'Latitude 7450' }
            [pscustomobject]@{ Maker = 'LENOVO'; Serial = 'PF3ABC12'; Key = 'lenovo:PF3ABC12'; Model = 'ThinkPad X1 Carbon Gen 12' }
            [pscustomobject]@{ Maker = 'HP'; Serial = '5CD1234ABC'; Key = 'hp:5CD1234ABC'; Model = 'EliteBook 840 14 inch G10' }
            [pscustomobject]@{ Maker = 'Microsoft Corporation'; Serial = '012345678901'; Key = 'microsoft:012345678901'; Model = 'Surface Laptop 6' }
            [pscustomobject]@{ Maker = 'ASUSTeK COMPUTER INC.'; Serial = 'N1MUX0912345678'; Key = 'asus:N1MUX0912345678'; Model = 'ExpertBook B1' }
            [pscustomobject]@{ Maker = 'Dynabook'; Serial = '7B123456K'; Key = 'dynabook:7B123456K'; Model = 'Portege X40' }
        )
    }
    It 'forms the same device key from every real serial shape' {
        foreach ($s in $global:DESerialSamples) {
            ConvertTo-DEDeviceKey -Manufacturer $s.Maker -Serial $s.Serial | Should -Be $s.Key -Because "$($s.Maker) $($s.Serial) must key as $($s.Key)"
        }
    }
    It 'every sample sits in a valid order manifest that matches the machine it was bought for' {
        foreach ($s in $global:DESerialSamples) {
            $order = @{
                schema = 'de.techconsole.order/v1'; orderId = "DE-ORD-$($s.Serial)"; client = 'alamo'; bundle = 'proactive-business'
                addOns = @(); solutions = @()
                endUser = @{ displayName = 'Test User'; upn = 'test.user@alamo.example'; localUserName = 'test.user'; jumpcloudUser = 'test.user'; personClass = 'internal' }
                device = @{ manufacturer = $s.Maker; model = $s.Model; serial = $s.Serial; assetTag = 'ALAMO-0231'; hostname = 'ALAMO-LAP-0231'; role = 'laptop' }
                procurement = @{ distributor = 'Ingram Micro'; poNumber = 'PO-5512'; dropship = $true }
                technician = 'jrpetro'; created = '2026-09-28T00:00:00Z'
            }
            @(Test-DEContract -Name order -Object $order).Count | Should -Be 0 -Because "the order for $($s.Serial) must validate"
            $f = Join-Path $global:DETest.Tmp ("order-{0}.json" -f $s.Serial)
            Set-DEJsonFile -Path $f -Object $order
            $null = Import-DEOrderManifest -Path $f
            $m = Test-DEOrderMatch -Device @{ serial = $s.Serial; model = $s.Model }
            $m.Status | Should -Be 'PASS' -Because "the machine with serial $($s.Serial) is the one on the order"
        }
    }
    It 'stamps the serial from a sticker with spaces or lower case into the same device key' {
        # ship notices and stickers are typed by people; the key normalises, the order match trims
        ConvertTo-DEDeviceKey -Manufacturer 'Dell Inc.' -Serial ' 7xk2q14 ' | Should -Be 'dell:7XK2Q14'
        ConvertTo-DEDeviceKey -Manufacturer 'Dell Inc.' -Serial '7XK 2Q14' | Should -Be 'dell:7XK2Q14'
    }
    It 'builds a real kit whose order.json carries the sample serial exactly' {
        $s = $global:DESerialSamples[0]
        $out = Join-Path $global:DETest.Tmp 'kits'
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'packaging/New-DEDropshipKit.ps1') -Client alamo -Bundle proactive-it -OrderId 'T-84' -EndUserName 'Test User' -Manufacturer $s.Maker -Serial $s.Serial -Model $s.Model -OutDir $out 3>$null | Out-Null
        $LASTEXITCODE | Should -Be 0
        $kit = Join-Path $out 'DE-Dropship-T-84'
        Test-Path -LiteralPath $kit | Should -Be $true
        $order = Get-Content -LiteralPath (Join-Path $kit 'order.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $order.device.serial | Should -BeExactly $s.Serial
        $order.device.manufacturer | Should -Be $s.Maker
        # the device key the kit implies is the one the tool, rescue and Hub will agree on
        ConvertTo-DEDeviceKey -Manufacturer $order.device.manufacturer -Serial $order.device.serial | Should -Be $s.Key
        Test-Path -LiteralPath "$kit.zip" | Should -Be $true
        (Get-Content -LiteralPath "$kit.zip.sha256" -Raw) | Should -Match ('^[0-9a-f]{64}  DE-Dropship-T-84\.zip')
    }
}
