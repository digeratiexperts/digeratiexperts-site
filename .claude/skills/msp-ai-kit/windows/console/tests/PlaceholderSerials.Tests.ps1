# Move 85 (issue 803): the OEM placeholder-serial refusal, tested against a real serial list. The list
# is the two sides of the boundary: the placeholder strings OEMs actually leave in WMI when a board has
# no programmed serial (refused), and real serial shapes from the major makers (never refused - a
# refusal that catches a real serial locks a technician out of a good device).
# Compatible with Pester 4.10 and 5.x.

Describe 'OEM placeholder-serial refusal against a real serial list' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        # What OEMs put in Win32_BIOS.SerialNumber when nothing is programmed. Sources: the strings
        # themselves as reported by AMI/Award BIOS boards ("Default string", "To be filled by O.E.M."),
        # system builders ("System Serial Number"), and the generic words support sees in the field.
        $global:DEPlaceholders = @(
            'To be filled by O.E.M.', 'To Be Filled By O.E.M', 'to be filled by oem', '  To be filled by O.E.M.  ',
            'Default string', 'DefaultString', 'default string',
            'System Serial Number', 'system serial number', 'Serial Number', 'Chassis Serial Number',
            'None', 'none', 'NA', 'N/A', 'n/a', 'OEM', 'O.E.M.', 'Unknown', 'UNKNOWN',
            'INVALID', 'Invalid', 'Not Applicable', 'Not Provided', 'No Serial', 'No Serial Number',
            '0', '0000', '00000000', '000000000000'
        )
        # Real serial shapes by maker (format samples, not client devices): every one must stay usable.
        $global:DERealSerials = @(
            @{ Maker = 'Dell Inc.'; Serial = '7XK2Q14' }
            @{ Maker = 'LENOVO'; Serial = 'PF3ABC12' }
            @{ Maker = 'HP'; Serial = '5CD1234ABC' }
            @{ Maker = 'Microsoft Corporation'; Serial = '012345678901' }
            @{ Maker = 'ASUSTeK COMPUTER INC.'; Serial = 'N1MUX0912345678' }
            @{ Maker = 'Dynabook'; Serial = '7B123456K' }
            @{ Maker = 'Apple'; Serial = 'C02XK1YZJG5H' }
            @{ Maker = 'Acer'; Serial = 'NXK12AA00123456789' }
            @{ Maker = 'Getac'; Serial = 'GTC1234567' }
            @{ Maker = 'Contoso Ltd.'; Serial = 'A1' }
        )
    }
    It 'refuses every real OEM placeholder string, whatever its case or padding' {
        foreach ($p in $global:DEPlaceholders) {
            (Get-DEThrown { ConvertTo-DEDeviceKey -Manufacturer 'ASUSTeK COMPUTER INC.' -Serial $p }) | Should -Match 'placeholder' -Because "'$p' is an OEM placeholder and must be refused"
        }
    }
    It 'never refuses a real serial shape' {
        foreach ($r in $global:DERealSerials) {
            $key = ConvertTo-DEDeviceKey -Manufacturer $r.Maker -Serial $r.Serial
            $key | Should -Match '^[a-z0-9-]+:[A-Z0-9-]+$' -Because "$($r.Serial) is a real serial and must produce a device key"
        }
    }
    It 'a placeholder serial leaves the device record without a key but still valid and sendable' {
        $p = New-DEHubPayload -Record @{ client = 'alamo'; serial = 'To be filled by O.E.M.'; manufacturer = 'ASUSTeK COMPUTER INC.'; exceptions = @() }
        $p.deviceKey | Should -BeNullOrEmpty
        @(Test-DEContract -Name device -Object $p).Count | Should -Be 0
    }
    It 'the refusal message tells the technician what to do' {
        (Get-DEThrown { ConvertTo-DEDeviceKey -Manufacturer 'x' -Serial 'Default string' }) | Should -Match 'chassis sticker'
    }
}
