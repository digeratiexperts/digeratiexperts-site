# Section H. Sensitive data (moves 91, 92, 94, 95, 96; 93 waits on Joe's retention periods).
#
# The evidence record carries three kinds of identifying data and they need different handling: a
# serial names a device and the Hub needs it, a user name names a person and the Hub does not, and a
# file path names a person only through its segments. This file pins the classification (move 91)
# and the redaction at the Hub boundary built on it (move 92).

Describe 'Evidence fields are classified before anything is withheld' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
    }

    Context 'move 91: the classification covers what the record actually carries' {
        It 'names every device field the Hub needs' {
            foreach ($f in @('serial', 'model', 'assetTag', 'hostname', 'manufacturer', 'deviceKey')) {
                Get-DEEvidenceFieldClass -Name $f | Should -Be 'device' -Because "$f identifies the device"
            }
        }
        It 'names every personal field the Hub does not need' {
            foreach ($f in @('assignedUser', 'localUserName', 'jumpcloudUser', 'email', 'endUserEmail')) {
                Get-DEEvidenceFieldClass -Name $f | Should -Be 'personal' -Because "$f identifies a person"
            }
        }
        It 'keeps the technician name, because it is ours and is recorded on purpose' {
            # the build is watermarked with who it was issued to, so a leaked copy names its source
            # the first time it runs with a network. Redacting it would break that. Section H is
            # about the CLIENT's device data, not DE's own accountability record.
            Get-DEEvidenceFieldClass -Name 'technician' | Should -Be 'operational'
            Get-DEEvidenceFieldClass -Name 'issuedTo' | Should -Be 'operational'
        }
        It 'names every path field, which leaks a user name through its segments' {
            foreach ($f in @('profilePath', 'profileDir', 'homeDir', 'documentsPath', 'folder', 'userProfile')) {
                Get-DEEvidenceFieldClass -Name $f | Should -Be 'path' -Because "$f is a filesystem path"
            }
        }
        It 'is case-insensitive, because the record is built from JSON and case is not guaranteed' {
            Get-DEEvidenceFieldClass -Name 'LOCALUSERNAME' | Should -Be 'personal'
            Get-DEEvidenceFieldClass -Name 'ProfilePath' | Should -Be 'path'
        }
        It 'defaults an unknown field to operational, so nothing is hidden by accident' {
            # the safe direction: an unclassified field is NOT redacted, so a miss is visible in the
            # output rather than silently dropping data someone needed
            Get-DEEvidenceFieldClass -Name 'someFutureField' | Should -Be 'operational'
            Get-DEEvidenceFieldClass -Name '' | Should -Be 'operational'
        }
        It 'no field name is classified twice' {
            $t = Get-DEEvidenceFieldClasses
            $all = @()
            foreach ($k in @('device', 'personal', 'path', 'operational')) { $all += @($t[$k]) }
            ($all.Count) | Should -Be (@($all | Select-Object -Unique).Count) -Because 'a name in two classes would redact unpredictably'
        }
        It 'the real record fields are all classified, not guessed at' {
            # the field names that actually appear on a device record, taken from New-DEAssetRecord
            # and New-DEHubPayload. Every one must resolve to a class.
            $record = New-DEAssetRecord -Snapshot @{ device = @{ hostname = 'ALAMO-LAP-0231'; serial = 'PF3ABC12'; manufacturer = 'Dell'; model = 'Latitude 7450' } } -ClientProfile (Get-DEClientProfile -Id 'alamo')
            foreach ($k in @($record.Keys)) {
                $c = Get-DEEvidenceFieldClass -Name $k
                $c | Should -BeIn @('device', 'personal', 'path', 'operational') -Because "$k must have a class"
            }
        }
    }
}

Describe 'What identifies a person never reaches the Hub' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $global:SecH = @{
            Record = New-DEAssetRecord -Snapshot @{
                device    = @{ hostname = 'ALAMO-LAP-0231'; serial = 'PF3ABC12'; manufacturer = 'Dell'; model = 'Latitude 7450' }
                profiles  = @{ list = @(@{ path = 'C:\Users\jpetrovich\Documents'; name = 'jpetrovich' }) }
            } -ClientProfile (Get-DEClientProfile -Id 'alamo')
        }
    }

    Context 'move 92: the Hub payload carries no user name and no profile path' {
        BeforeAll {
            $global:SecH.Payload = New-DEHubPayload -Record $global:SecH.Record -BundleSha256 ('a' * 64) -BundlePath 'C:\evidence\bundle.zip'
            $global:SecH.Json = ($global:SecH.Payload | ConvertTo-Json -Depth 12)
        }
        It 'no user name appears anywhere in the payload' {
            foreach ($who in @('jpetrovich', 'joe', 'sthompson')) {
                $global:SecH.Json | Should -Not -Match ([regex]::Escape($who)) -Because "$who is a person, and the Hub manages devices"
            }
        }
        It 'the user block is withheld rather than sent' {
            $global:SecH.Payload.user.assigned | Should -Be '[REDACTED]'
            $global:SecH.Payload.user.localUserName | Should -Be '[REDACTED]'
            $global:SecH.Payload.user.email | Should -Be '[REDACTED]'
        }
        It 'no profile path survives - only the leaf name does' {
            $global:SecH.Json | Should -Not -Match 'C:\\Users\\' -Because 'the directory chain is what names the person'
            $global:SecH.Json | Should -Not -Match 'Users\\jpetrovich'
        }
        It 'a path in free text is scrubbed too, not just keyed fields' {
            Protect-DEPathText 'see C:\Users\jpetrovich\Documents\q3-report.docx for detail' | Should -Be 'see <path>\q3-report.docx for detail'
            Protect-DEPathText 'profile at \\server\share\jpetrovich\desktop' | Should -Not -Match 'jpetrovich'
        }
        It 'the leaf name survives, because it is the useful part' {
            Protect-DEPathText 'C:\Users\jpetrovich\Documents\recovery-key.txt' | Should -Match 'recovery-key\.txt'
        }
        It 'the device still gets through - the Hub must be able to name the machine' {
            $global:SecH.Payload.device.serial | Should -Be 'PF3ABC12'
            $global:SecH.Payload.deviceKey | Should -Match 'PF3ABC12' -Because 'deviceKey is the shared identity across tool, rescue and Hub'
            $global:SecH.Payload.device.hostname | Should -Be 'ALAMO-LAP-0231'
        }
        It 'the results still get through - withholding a verdict would be worse than showing it' {
            $global:SecH.Payload.onboarding.readiness | Should -Not -BeNullOrEmpty
            $global:SecH.Json | Should -Match 'readiness'
        }
        It 'the technician name survives, as the leak-tracing record it is meant to be' {
            $global:SecH.Json | Should -Match 'technician'
        }
        It 'the payload still validates against the device contract' {
            # the schema requires only schema, source, sentAt and device; the user block is optional
            # and nullable, so withholding must not break validation
            $global:SecH.Payload.schema | Should -Be 'de.techconsole.device/v1'
            $global:SecH.Payload.source | Should -Not -BeNullOrEmpty
            $global:SecH.Payload.sentAt | Should -Not -BeNullOrEmpty
            $global:SecH.Payload.device | Should -Not -BeNullOrEmpty
        }
    }
}
