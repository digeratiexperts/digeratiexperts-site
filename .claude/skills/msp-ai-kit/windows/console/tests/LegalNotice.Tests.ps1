# Windows pre-logon notice: client profile -> Winlogon policy -> exact verification -> rollback.
# Pester 4.10 and 5.x. Registry operations are mocked so the contract runs on every CI OS.

Describe 'Windows pre-logon authorized-use notice' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $global:DELegalTest = @{
            Dir = Initialize-TestConsole
            Registry = @{}
            Path = 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System'
        }
    }

    BeforeEach {
        $global:DELegalTest.Registry = @{}
        Set-DEStateValue -Path 'logonNotice.previous' -Value $null

        Mock -ModuleName DE.Configure Get-DERegistryValue {
            if ($global:DELegalTest.Registry.ContainsKey($Name)) { return $global:DELegalTest.Registry[$Name] }
            return $null
        } -ParameterFilter { $Path -eq $global:DELegalTest.Path }

        Mock -ModuleName DE.Configure Set-DERegistryValue {
            $global:DELegalTest.Registry[$Name] = $Value
        } -ParameterFilter { $Path -eq $global:DELegalTest.Path }

        Mock -ModuleName DE.Configure Remove-ItemProperty {
            $null = $global:DELegalTest.Registry.Remove($Name)
        } -ParameterFilter { $Path -eq $global:DELegalTest.Path }

        Mock -ModuleName DE.Configure Backup-DERegistryKey {
            'C:\DE\backups\logon-notice.reg'
        }
    }

    It 'uses the DE standard by default and names the client without saying DE owns the machine' {
        $p = New-DEClientProfileTemplate -Id 'acme' -Name 'Acme Widgets'
        $d = Get-DELogonNoticeDesired -ClientProfile $p

        $d.enabled | Should -Be $true
        $d.mode | Should -Be 'default'
        $d.caption | Should -Be 'AUTHORIZED USE & SECURITY MONITORING NOTICE'
        $d.text | Should -Match 'authorized Acme Widgets business use'
        $d.text | Should -Match 'including Digerati Experts where applicable'
        $d.text | Should -Match 'Contact Acme Widgets or Digerati Experts'
        $d.text | Should -Not -Match 'owned by Digerati Experts'
    }

    It 'accepts an approved custom caption and body and normalizes line endings' {
        $p = New-DEClientProfileTemplate -Id 'custom' -Name 'Custom Client'
        $p.windows.logonNotice.mode = 'custom'
        $p.windows.logonNotice.caption = 'CUSTOM AUTHORIZED USE NOTICE'
        $p.windows.logonNotice.body = "Client-approved line one.`r`nClient-approved line two."

        $d = Get-DELogonNoticeDesired -ClientProfile $p
        $d.mode | Should -Be 'custom'
        $d.caption | Should -Be 'CUSTOM AUTHORIZED USE NOTICE'
        $d.text | Should -Be "Client-approved line one.`nClient-approved line two."
    }

    It 'refuses custom mode without a body rather than silently falling back' {
        $p = New-DEClientProfileTemplate -Id 'bad-custom' -Name 'Bad Custom'
        $p.windows.logonNotice.mode = 'custom'
        $p.windows.logonNotice.body = ''
        { Get-DELogonNoticeDesired -ClientProfile $p } | Should -Throw
    }

    It 'applies and verifies the notice, then restores the exact pre-DE values' {
        $p = New-DEClientProfileTemplate -Id 'acme' -Name 'Acme Widgets'
        $global:DELegalTest.Registry['LegalNoticeCaption'] = 'Old caption'
        $global:DELegalTest.Registry['LegalNoticeText'] = "Old body`r`nsecond line"

        Set-DELogonNotice -ClientProfile $p -Confirm:$false | Should -Match 'matches'
        (Get-DELogonNoticeState -ClientProfile $p).ok | Should -Be $true
        $global:DELegalTest.Registry['LegalNoticeCaption'] | Should -Be 'AUTHORIZED USE & SECURITY MONITORING NOTICE'
        $global:DELegalTest.Registry['LegalNoticeText'] | Should -Match 'Acme Widgets'

        # A second apply is idempotent and must not replace the original rollback snapshot with DE's own values.
        Set-DELogonNotice -ClientProfile $p -Confirm:$false | Should -Match 'matches'
        (Get-DEHashPath -Object (Get-DEState -Path 'logonNotice.previous') -Path 'caption.value') | Should -Be 'Old caption'

        $undo = Undo-DELogonNotice -Confirm:$false
        $undo.ok | Should -Be $true
        $global:DELegalTest.Registry['LegalNoticeCaption'] | Should -Be 'Old caption'
        (ConvertTo-DELogonNoticeText -Text $global:DELegalTest.Registry['LegalNoticeText']) | Should -Be "Old body`nsecond line"
        Get-DEState -Path 'logonNotice.previous' | Should -BeNullOrEmpty
    }

    It 'supports an explicit client disabled state and rolls that change back' {
        $p = New-DEClientProfileTemplate -Id 'exception' -Name 'Exception Client'
        $p.windows.logonNotice.mode = 'disabled'
        $global:DELegalTest.Registry['LegalNoticeCaption'] = 'Existing caption'
        $global:DELegalTest.Registry['LegalNoticeText'] = 'Existing body'

        Set-DELogonNotice -ClientProfile $p -Confirm:$false | Should -Match 'disabled'
        $global:DELegalTest.Registry.ContainsKey('LegalNoticeCaption') | Should -Be $false
        $global:DELegalTest.Registry.ContainsKey('LegalNoticeText') | Should -Be $false
        (Get-DELogonNoticeState -ClientProfile $p).ok | Should -Be $true

        (Undo-DELogonNotice -Confirm:$false).ok | Should -Be $true
        $global:DELegalTest.Registry['LegalNoticeCaption'] | Should -Be 'Existing caption'
        $global:DELegalTest.Registry['LegalNoticeText'] | Should -Be 'Existing body'
    }

    It 'registers as an elevated baseline action in normal provisioning modes' {
        $p = New-DEClientProfileTemplate -Id 'acme' -Name 'Acme Widgets'
        Register-DEBaselineActions -ClientProfile $p
        $a = Get-DEAction -Id 'baseline.logon-notice'
        $a | Should -Not -BeNullOrEmpty
        $a.Module | Should -Be 'baseline'
        $a.Phase | Should -Be 11
        $a.RequiresElevation | Should -Be $true
        @($a.Modes) | Should -Contain 'dropship'
        @($a.Modes) | Should -Contain 'takeover'
        @($a.Modes) | Should -Not -Contain 'audit'
    }
}
