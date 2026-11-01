# Move 83 (issue 801): the device record carries the Zoho Desk ticket ID, so the Hub record and the
# evidence behind it link back to the ticket. The ticket is work context like client and site; it is
# never a secret, and a value that is not ticket-shaped is left out rather than sent or fatal.
# Compatible with Pester 4.10 and 5.x.

Describe 'Desk ticket on the device record' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DETest = @{ Dir = Initialize-TestConsole }
        $global:DERecord = @{ client = 'alamo'; serial = 'PF3ABC12'; manufacturer = 'LENOVO'; exceptions = @() }
    }
    It 'carries the ticket passed to the payload builder and the record still validates' {
        $p = New-DEHubPayload -Record $global:DERecord -DeskTicketId 'DESK-1042'
        $p.deskTicketId | Should -Be 'DESK-1042'
        @(Test-DEContract -Name device -Object $p).Count | Should -Be 0
    }
    It 'accepts the ticket numbers Zoho Desk issues' {
        (New-DEHubPayload -Record $global:DERecord -DeskTicketId '34567890123').deskTicketId | Should -Be '34567890123'
    }
    It 'falls back to the ticket saved for this engagement' {
        Set-DEStateValue -Path 'work.deskTicketId' -Value 'DESK-2207'
        (New-DEHubPayload -Record $global:DERecord).deskTicketId | Should -Be 'DESK-2207'
        # the parameter wins over the saved value
        (New-DEHubPayload -Record $global:DERecord -DeskTicketId 'DESK-9').deskTicketId | Should -Be 'DESK-9'
    }
    It 'omits the ticket cleanly when there is none and the record still validates' {
        Set-DEStateValue -Path 'work.deskTicketId' -Value $null
        $p = New-DEHubPayload -Record $global:DERecord
        $p.deskTicketId | Should -BeNullOrEmpty
        @(Test-DEContract -Name device -Object $p).Count | Should -Be 0
    }
    It 'leaves out a value that is not ticket-shaped, including a recovery-password-shaped one, and never throws' {
        foreach ($bad in @('111111-222222-333333-444444-555555-666666-000011-719873', 'password=hunter2', ('a' * 64), 'two words')) {
            $p = New-DEHubPayload -Record $global:DERecord -DeskTicketId $bad
            $p.deskTicketId | Should -BeNullOrEmpty
            @(Test-DEContract -Name device -Object $p).Count | Should -Be 0
        }
    }
    It 'a bad saved ticket does not break the payload either' {
        Set-DEStateValue -Path 'work.deskTicketId' -Value 'not a ticket id!'
        $p = New-DEHubPayload -Record $global:DERecord
        $p.deskTicketId | Should -BeNullOrEmpty
        Set-DEStateValue -Path 'work.deskTicketId' -Value $null
    }
}
