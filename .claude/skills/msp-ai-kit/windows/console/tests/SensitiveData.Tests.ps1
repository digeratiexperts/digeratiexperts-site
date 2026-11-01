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
            foreach ($f in @('assignedUser', 'localUserName', 'jumpcloudUser', 'email', 'technician', 'endUserEmail')) {
                Get-DEEvidenceFieldClass -Name $f | Should -Be 'personal' -Because "$f identifies a person"
            }
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
