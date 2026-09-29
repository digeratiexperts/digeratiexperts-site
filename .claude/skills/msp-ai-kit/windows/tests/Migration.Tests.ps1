# DE email migration engine (Gmail IMAP -> Microsoft 365). Graph and Exchange Online are mocked; the IMAP server is
# scripted. Compatible with Pester 4.10 and 5.x.
Describe 'DE email migration' {
    BeforeAll {
        # stand-ins with the real parameter names (always defined: a function wins over an installed cmdlet)
        function global:Invoke-MgGraphRequest { param([string]$Method, [string]$Uri, $Body, [hashtable]$Headers, [string]$ContentType, [string]$OutputType) throw 'not mocked' }
        function global:Get-MgContext { param() throw 'not mocked' }
        function global:Get-EXOMailbox { param([string]$Identity, [string[]]$Properties, $ResultSize, $RecipientTypeDetails) throw 'not mocked' }
        function global:Get-EXORecipient { param([string]$Identity) throw 'not mocked' }
        function global:Get-EXOMailboxPermission { param([string]$Identity) throw 'not mocked' }
        function global:Get-EXORecipientPermission { param([string]$Identity) throw 'not mocked' }
        function global:Get-MigrationEndpoint { param([string]$Identity) throw 'not mocked' }
        function global:Test-MigrationServerAvailability { param([switch]$IMAP, [string]$RemoteServer, [int]$Port, [string]$Security) throw 'not mocked' }
        function global:New-MigrationEndpoint { param([switch]$IMAP, [string]$Name, [string]$RemoteServer, [int]$Port, [string]$Security) throw 'not mocked' }
        function global:New-MigrationBatch { param([string]$Name, [string]$SourceEndpoint, [byte[]]$CSVData, [switch]$AutoStart, [string[]]$ExcludeFolders, [string[]]$NotificationEmails) throw 'not mocked' }
        function global:Get-MigrationBatch { param([string]$Identity) throw 'not mocked' }
        function global:Get-MigrationUser { param([string]$BatchId) throw 'not mocked' }
        function global:Get-MigrationUserStatistics { param([string]$Identity) throw 'not mocked' }
        function global:Start-MigrationBatch { param([string]$Identity) throw 'not mocked' }
        function global:Complete-MigrationBatch { param([string]$Identity) throw 'not mocked' }
        function global:Remove-MigrationBatch { param([string]$Identity) throw 'not mocked' }
        function global:Resolve-DnsName { param([string]$Name, [string]$Type, [switch]$DnsOnly, [string]$Server) throw 'not mocked' }
        function global:Get-MessageTraceV2 { param([string]$RecipientAddress, [string]$SenderAddress, $StartDate, $EndDate) throw 'not mocked' }
        $mod = @((Join-Path (Split-Path -Parent $PSScriptRoot) 'microsoft/DE-Microsoft-Admin/DE-Microsoft-Admin.psd1'), (Join-Path (Split-Path -Parent $PSScriptRoot) 'DE-Microsoft-Admin.psd1')) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
        Import-Module $mod -Force
        $global:MigT = @{ Dir = Join-Path ([IO.Path]::GetTempPath()) ("de-migration-" + [guid]::NewGuid().ToString('N')) }
        New-Item -ItemType Directory -Path $global:MigT.Dir -Force | Out-Null
        $null = Set-DEMsAuditPath -Path (Join-Path $global:MigT.Dir 'audit.jsonl')
        $null = Set-DEMigrationDirectory -Path (Join-Path $global:MigT.Dir 'projects')
        InModuleScope DE-Microsoft-Admin { $script:Ctx.TenantId = 'tenant-1' }
        function global:New-MigCred { param([string]$User, [string]$Pass) $s = New-Object Security.SecureString; foreach ($c in $Pass.ToCharArray()) { $s.AppendChar($c) }; New-Object Management.Automation.PSCredential($User, $s) }
        function global:Get-MigText { param($v) if ($v -is [datetime]) { $v.ToString('yyyy-MM-ddTHH:mm:ss', [Globalization.CultureInfo]::InvariantCulture) } else { "$v" } }
        function global:Get-MigThrown { param([scriptblock]$S) try { $null = & $S; '<none>' } catch { $_.Exception.Message } }
        # a tenant with alamo-industries.com verified, four licensed users and a user without a licence
        function global:Invoke-MigGraph {
            param($Method, $Uri, $Body)
            if ($Uri -like '*/domains?*') { return @{ value = @(@{ id = 'alamo-industries.com'; isVerified = $true }, @{ id = 'unverified.com'; isVerified = $false }) } }
            if ($Uri -match '/users/([^/?]+)\?') { $who = [uri]::UnescapeDataString($Matches[1]); if ($who -like 'nolicence*') { return @{ id = 'u-nl'; displayName = 'No Licence'; assignedLicenses = @() } }; if ($who -like '*@alamo-industries.com') { return @{ id = "id-$($who.Split('@')[0])"; displayName = $who.Split('@')[0]; assignedLicenses = @(@{ skuId = 'bp' }); accountEnabled = $false } }; throw 'Resource not found' }
            throw "unexpected Graph call $Method $Uri"
        }
    }
    AfterAll {
        Remove-Item -LiteralPath $global:MigT.Dir -Recurse -Force -ErrorAction SilentlyContinue; Remove-Module DE-Microsoft-Admin -Force -ErrorAction SilentlyContinue
        foreach ($f in 'Invoke-MgGraphRequest', 'Get-MgContext', 'Get-EXOMailbox', 'Get-EXORecipient', 'Get-EXOMailboxPermission', 'Get-EXORecipientPermission', 'Get-MigrationEndpoint', 'Test-MigrationServerAvailability', 'New-MigrationEndpoint', 'New-MigrationBatch', 'Get-MigrationBatch', 'Get-MigrationUser', 'Get-MigrationUserStatistics', 'Start-MigrationBatch', 'Complete-MigrationBatch', 'Remove-MigrationBatch', 'Resolve-DnsName', 'Get-MessageTraceV2', 'New-MigCred', 'Get-MigThrown', 'Get-MigText', 'Invoke-MigGraph') { Remove-Item -Path "Function:\$f" -ErrorAction SilentlyContinue }
    }

    Context 'Gmail IMAP preflight' {
        It 'signs in with the app password once (spaces removed), lists folders with counts and the mailbox size' {
            $server = @(
                '* OK Gimap ready',
                'a1 OK user@gmail.com authenticated (Success)',
                '* LIST (\HasNoChildren) "/" "INBOX"',
                '* LIST (\HasChildren \Noselect) "/" "[Gmail]"',
                '* LIST (\All \HasNoChildren) "/" "[Gmail]/All Mail"',
                '* LIST (\HasNoChildren) "/" "Re&AOc-us"',
                'a2 OK Success',
                '* STATUS "INBOX" (MESSAGES 120)', 'a3 OK Success',
                '* STATUS "[Gmail]/All Mail" (MESSAGES 4000)', 'a4 OK Success',
                '* STATUS "Re&AOc-us" (MESSAGES 7)', 'a5 OK Success',
                '* QUOTAROOT "INBOX" ""', '* QUOTA "" (STORAGE 2097152 15728640)', 'a6 OK Success',
                '* BYE LOGOUT Requested', 'a7 OK 73 good day (Success)'
            ) -join "`r`n"
            $reader = New-Object IO.StringReader($server); $writer = New-Object IO.StringWriter
            $r = & (Get-Module DE-Microsoft-Admin) { param($R, $W, $C) Invoke-DEImapConversation -Reader $R -Writer $W -Credential $C } $reader $writer (New-MigCred 'norma.alamo@gmail.com' 'abcd efgh ijkl mnop')
            $r.loginOk | Should -Be $true; $r.allMailCount | Should -Be 4000; $r.storageKB | Should -Be 2097152
            @($r.folders | Where-Object { $_.selectable }).Count | Should -Be 3
            (@($r.folders | Where-Object { $_.name -eq 'Reçus' })[0]).messages | Should -Be 7
            $sent = $writer.ToString() -split "`r`n"
            @($sent | Where-Object { $_ -match 'abcdefghijklmnop' }).Count | Should -Be 1
            $sent[0] | Should -Be 'a1 LOGIN "norma.alamo@gmail.com" "abcdefghijklmnop"'
            ($sent -join ' ') | Should -Not -Match 'STATUS "\[Gmail\]" '
        }
        It 'says an app password is needed when Google asks for one, and never returns the password' {
            $reader = New-Object IO.StringReader(("* OK Gimap ready", "a1 NO [ALERT] Application-specific password required: https://support.google.com/accounts/answer/185833 (Failure)") -join "`r`n")
            $r = & (Get-Module DE-Microsoft-Admin) { param($R, $W, $C) Invoke-DEImapConversation -Reader $R -Writer $W -Credential $C } $reader (New-Object IO.StringWriter) (New-MigCred 'helen@gmail.com' 'NormalPassword1')
            $r.loginOk | Should -Be $false; $r.reason | Should -Match 'app password'
            ($r | ConvertTo-Json -Depth 5) | Should -Not -Match 'NormalPassword1'
        }
        It 'decodes modified UTF-7 folder names' {
            InModuleScope DE-Microsoft-Admin { ConvertFrom-DEImapUtf7 'Re&AOc-us' } | Should -Be 'Reçus'
            InModuleScope DE-Microsoft-Admin { ConvertFrom-DEImapUtf7 'A&-B' } | Should -Be 'A&B'
        }
    }

    Context 'project, identity map, shared mailbox and batches' {
        It 'creates a project only for a verified domain and maps licensed user mailboxes' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { Invoke-MigGraph -Method $Method -Uri $Uri -Body $Body }
            Mock -ModuleName DE-Microsoft-Admin Get-EXOMailbox { [pscustomobject]@{ RecipientTypeDetails = 'UserMailbox'; PrimarySmtpAddress = $Identity } }
            (New-DEMigrationProject -ClientName 'Alamo Industries' -TargetDomain 'alamo-industires.com' -Confirm:$false).status | Should -Be 'Refused'
            $r = New-DEMigrationProject -ClientName 'Alamo Industries' -TargetDomain 'alamo-industries.com' -ProjectId 'alamo-mail' -Confirm:$false
            $r.status | Should -Be 'Succeeded'
            (Add-DEMigrationUser -ProjectId 'alamo-mail' -SourceAddress 'suzette.alamo@gmail.com' -DestinationAddress 'suzette@elsewhere.com' -Confirm:$false).status | Should -Be 'Refused'
            (Add-DEMigrationUser -ProjectId 'alamo-mail' -SourceAddress 'suzette.alamo@gmail.com' -DestinationAddress 'suzette@alamo-industries.com' -Devices 'ALAMO-LAP-1' -Confirm:$false).status | Should -Be 'Succeeded'
            (Add-DEMigrationUser -ProjectId 'alamo-mail' -SourceAddress 'helen.alamo@gmail.com' -DestinationAddress 'helen@alamo-industries.com' -Devices 'HelenU', 'equip.alamo' -Confirm:$false).status | Should -Be 'Succeeded'
            (Add-DEMigrationUser -ProjectId 'alamo-mail' -SourceAddress 'x.alamo@gmail.com' -DestinationAddress 'nolicence@alamo-industries.com' -Confirm:$false).message | Should -Match 'no licence'
            (Add-DEMigrationUser -ProjectId 'alamo-mail' -SourceAddress 'helen.alamo@gmail.com' -DestinationAddress 'helen2@alamo-industries.com' -Confirm:$false).status | Should -Be 'Refused'
            $p = Get-DEMigrationProject -ProjectId 'alamo-mail'
            @($p.users).Count | Should -Be 3; @($p.devices) | Should -Contain 'HelenU'; $p.stage | Should -Be 'Provisioning'
            $p.verification.'Inbound mail'.status | Should -Be 'Pending'
        }
        It 'proves the shared mailbox: Full Access and Send As for every member, and its own sign-in blocked' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            Mock -ModuleName DE-Microsoft-Admin Get-EXOMailbox { [pscustomobject]@{ RecipientTypeDetails = 'SharedMailbox'; ExternalDirectoryObjectId = 'shared-1' } }
            Mock -ModuleName DE-Microsoft-Admin Get-EXOMailboxPermission { @('norma', 'helen', 'suzette', 'mike') | ForEach-Object { [pscustomobject]@{ User = "$_@alamo-industries.com"; AccessRights = 'FullAccess'; Deny = $false } } }
            Mock -ModuleName DE-Microsoft-Admin Get-EXORecipientPermission { @('norma', 'helen', 'suzette') | ForEach-Object { [pscustomobject]@{ Trustee = "$_@alamo-industries.com"; AccessRights = 'SendAs'; AccessControlType = 'Allow' } } }
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ accountEnabled = $true } }
            $members = @('norma', 'helen', 'suzette', 'mike') | ForEach-Object { "$_@alamo-industries.com" }
            $r = Test-DEMigrationSharedMailbox -ProjectId 'alamo-mail' -Address 'office@alamo-industries.com' -Members $members
            $r.status | Should -Be 'Failed'; $r.message | Should -Match 'mike@alamo-industries.com has no Send As'; $r.message | Should -Match 'can sign in'
            (Get-DEMigrationProject -ProjectId 'alamo-mail').verification.'Shared mailbox'.status | Should -Be 'Fail'
            Mock -ModuleName DE-Microsoft-Admin Get-EXORecipientPermission { @('norma', 'helen', 'suzette', 'mike') | ForEach-Object { [pscustomobject]@{ Trustee = "$_@alamo-industries.com"; AccessRights = 'SendAs'; AccessControlType = 'Allow' } } }
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ accountEnabled = $false } }
            (Test-DEMigrationSharedMailbox -ProjectId 'alamo-mail' -Address 'office@alamo-industries.com' -Members $members).status | Should -Be 'Succeeded'
            (Get-DEMigrationProject -ProjectId 'alamo-mail').verification.'Shared mailbox'.status | Should -Be 'Pass'
        }
        It 'a production batch waits for a confirmed pilot; the CSV carries the app password to Exchange and nowhere else' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            $suz = New-MigCred 'suzette.alamo@gmail.com' 'wxyz wxyz wxyz wxyz'; $hel = New-MigCred 'helen.alamo@gmail.com' 'qrst qrst qrst qrst'
            (New-DEMigrationBatch -ProjectId 'alamo-mail' -Type Production -Credential $suz, $hel -Confirm:$false).message | Should -Match 'no confirmed pilot'
            (New-DEMigrationBatch -ProjectId 'alamo-mail' -Type Pilot -Credential $suz, $hel -Confirm:$false).message | Should -Match 'one mailbox'
            (New-DEMigrationBatch -ProjectId 'alamo-mail' -Type Pilot -Credential $suz -SkipPreflight -Confirm:$false).message | Should -Match 'no passing IMAP preflight'
            # record a passing preflight the way Test-DEGmailImapAccess does, then start the pilot
            InModuleScope DE-Microsoft-Admin { $p = Get-DEMigrationProject -ProjectId 'alamo-mail'; foreach ($u in @($p.users)) { $u.preflight = [pscustomobject]@{ ok = $true; allMailCount = 4000 } }; $null = Save-DEMigrationProject -Project $p }
            Mock -ModuleName DE-Microsoft-Admin Get-MigrationEndpoint { [pscustomobject]@{ Identity = 'DE-Gmail-IMAP' } }
            $global:MigT.Csv = $null
            Mock -ModuleName DE-Microsoft-Admin New-MigrationBatch { $global:MigT.Csv = [Text.Encoding]::UTF8.GetString($CSVData); $global:MigT.Exclude = $ExcludeFolders; [pscustomobject]@{ Identity = $Name } }
            $r = New-DEMigrationBatch -ProjectId 'alamo-mail' -Type Pilot -Credential $suz -SkipPreflight -Confirm:$false
            $r.status | Should -Be 'Succeeded'
            $global:MigT.Csv | Should -Match '^EmailAddress,UserName,Password\r\nsuzette@alamo-industries.com,suzette.alamo@gmail.com,wxyzwxyzwxyzwxyz\r\n$'
            @($global:MigT.Exclude) | Should -Contain '[Gmail]/Spam'; @($global:MigT.Exclude) | Should -Not -Contain '[Gmail]/All Mail'
            $state = Get-Content -LiteralPath (Join-Path (Join-Path $global:MigT.Dir 'projects') 'alamo-mail.json') -Raw
            $state | Should -Not -Match 'wxyz'
            (Get-Content -LiteralPath (Get-DEMsAuditPath) -Raw) | Should -Not -Match 'wxyz'
            (New-DEMigrationBatch -ProjectId 'alamo-mail' -Type Pilot -Credential $suz -SkipPreflight -Confirm:$false).message | Should -Match 'already in batch'
        }
        It 'status reads Exchange, the pilot is confirmed only after a clean sync, and the final delta waits for DNS' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            $global:MigT.Status = 'Syncing'
            Mock -ModuleName DE-Microsoft-Admin Get-MigrationBatch { [pscustomobject]@{ Identity = $Identity; Status = $global:MigT.Status } }
            Mock -ModuleName DE-Microsoft-Admin Get-MigrationUser { [pscustomobject]@{ Identity = 'suzette@alamo-industries.com'; Status = $global:MigT.Status; ErrorSummary = '' } }
            Mock -ModuleName DE-Microsoft-Admin Get-MigrationUserStatistics { [pscustomobject]@{ SyncedItemCount = 3980; SkippedItemCount = 2; TotalItemsInSourceMailboxCount = 4000; Error = $null } }
            (Confirm-DEMigrationPilot -ProjectId 'alamo-mail' -Technician 'jrpetro' -Note 'opened in Outlook' -Confirm:$false).status | Should -Be 'Refused'
            $global:MigT.Status = 'Synced'
            (Get-DEMigrationStatus -ProjectId 'alamo-mail').message | Should -Match '1 of 3 mailbox'
            $u = @((Get-DEMigrationProject -ProjectId 'alamo-mail').users | Where-Object { $_.destination -eq 'suzette@alamo-industries.com' })[0]
            $u.migration.synced | Should -Be 3980; $u.migration.skipped | Should -Be 2
            (Confirm-DEMigrationPilot -ProjectId 'alamo-mail' -Technician 'jrpetro' -Note 'opened in Outlook, folders and last week of mail present' -Confirm:$false).status | Should -Be 'Succeeded'
            $b = @((Get-DEMigrationProject -ProjectId 'alamo-mail').batches)[0]
            $b.confirmedBy | Should -Be 'jrpetro'
            (Complete-DEMigrationBatch -ProjectId 'alamo-mail' -BatchName $b.name -Confirm:$false).message | Should -Match 'MX does not point to Microsoft 365'
        }
    }

    Context 'contacts and calendar' {
        It 'imports Google CSV contacts (both header styles), splits multi-value cells and never adds a contact twice' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            $csv = Join-Path $global:MigT.Dir 'contacts.csv'
            [IO.File]::WriteAllText($csv, "First Name,Middle Name,Last Name,Organization Name,Organization Title,E-mail 1 - Label,E-mail 1 - Value,Phone 1 - Label,Phone 1 - Value,Phone 2 - Label,Phone 2 - Value,Address 1 - Label,Address 1 - Street,Address 1 - City,Address 1 - Region,Address 1 - Postal Code,Birthday,Notes`r`nMike,,Daniels,Alamo Industries,Owner,* Work,mike@alamo-industries.com ::: mike.alamo@gmail.com,Mobile,602-555-0101,Home,602-555-0102,Work,1 Main St,Phoenix,AZ,85001,1970-04-02,Boss`r`nNorma,,Ruiz,,,Home,norma@example.com,,,,,,,,,,,`r`n,,,,,,,,,,,,,,,,,`r`n", (New-Object Text.UTF8Encoding $true))
            $global:MigT.Posted = @()
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { if ($Method -eq 'POST') { $global:MigT.Posted += , ($Body | ConvertFrom-Json); return @{ id = 'c' } }; @{ value = @(@{ displayName = 'Norma Ruiz'; emailAddresses = @(@{ address = 'NORMA@example.com' }) }) } }
            $r = Import-DEMigrationContacts -ProjectId 'alamo-mail' -SourceAddress 'suzette.alamo@gmail.com' -Path $csv -Confirm:$false
            $r.status | Should -Be 'Succeeded'; $r.data.imported | Should -Be 1; $r.data.duplicates | Should -Be 1; $r.data.empty | Should -Be 1
            $m = $global:MigT.Posted[0]
            $m.displayName | Should -Be 'Mike Daniels'; @($m.emailAddresses).Count | Should -Be 2; $m.mobilePhone | Should -Be '602-555-0101'; @($m.homePhones)[0] | Should -Be '602-555-0102'
            $m.businessAddress.city | Should -Be 'Phoenix'; $m.companyName | Should -Be 'Alamo Industries'; (Get-MigText $m.birthday) | Should -Match '^1970-04-02T'
            $old = Join-Path $global:MigT.Dir 'old.csv'
            [IO.File]::WriteAllText($old, "Name,Given Name,Family Name,E-mail 1 - Type,E-mail 1 - Value,Phone 1 - Type,Phone 1 - Value,Organization 1 - Name`r`nHelen U,Helen,U,* Home,helen.alamo@gmail.com,Mobile,480-555-0100,Alamo`r`n")
            $row = @(Import-Csv -LiteralPath $old)[0]
            $c = & (Get-Module DE-Microsoft-Admin) { param($Row) ConvertFrom-DEGoogleContactRow -Row $Row } $row
            $c.displayName | Should -Be 'Helen U'; $c.companyName | Should -Be 'Alamo'; $c.mobilePhone | Should -Be '480-555-0100'
        }
        It 'imports calendar events without inviting anyone, keeps recurrence, removes deleted occurrences and never duplicates on a rerun' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            $ics = Join-Path $global:MigT.Dir 'cal.ics'
            $lines = @(
                'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
                'BEGIN:VEVENT', 'DTSTART;TZID=America/Phoenix:20260105T090000', 'DTEND;TZID=America/Phoenix:20260105T100000', 'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=10', 'EXDATE;TZID=America/Phoenix:20260107T090000', 'UID:weekly-1@google.com', 'SUMMARY:Staff meeting\, office', 'ATTENDEE;CN=Mike Daniels;ROLE=REQ-PARTICIPANT:mailto:mike.alamo@gmail.com', 'DESCRIPTION:Line one\nLine two', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P0DT0H10M0S', 'END:VALARM', 'END:VEVENT',
                'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20250704', 'DTEND;VALUE=DATE:20250705', 'UID:holiday-1@google.com', 'SUMMARY:Closed', 'TRANSP:TRANSPARENT', 'END:VEVENT',
                'BEGIN:VEVENT', 'DTSTART:20260310T160000Z', 'DTEND:20260310T170000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU;UNTIL=20261231T000000Z', 'UID:monthly-1@google.com', 'SUMMARY:Board review', 'END:VEVENT',
                'BEGIN:VEVENT', 'DTSTART:20260310T160000Z', 'DTEND:20260310T170000Z', 'RRULE:FREQ=HOURLY;INTERVAL=4', 'UID:odd-1@google.com', 'SUMMARY:Every four hours', 'END:VEVENT',
                'BEGIN:VEVENT', 'DTSTART:20260311T160000Z', 'DTEND:20260311T170000Z', 'RECURRENCE-ID;TZID=America/Phoenix:20260309T090000', 'UID:weekly-1@google.com', 'SUMMARY:Staff meeting moved', 'END:VEVENT',
                'BEGIN:VEVENT', 'DTSTART:20260312T160000Z', 'DTEND:20260312T170000Z', 'UID:gone-1@google.com', 'SUMMARY:Cancelled thing', 'STATUS:CANCELLED', 'END:VEVENT',
                'END:VCALENDAR')
            [IO.File]::WriteAllText($ics, ($lines -join "`r`n"))
            $global:MigT.Events = @(); $global:MigT.Deleted = @()
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest {
                if ($Method -eq 'POST') { $b = $Body | ConvertFrom-Json; $global:MigT.Events += , $b; return @{ id = "ev$($global:MigT.Events.Count)" } }
                if ($Method -eq 'DELETE') { $global:MigT.Deleted += , $Uri; return $null }
                if ($Uri -like '*instances*') { return @{ value = @(@{ id = 'inst-mon'; start = @{ dateTime = '2026-01-05T16:00:00.0000000' } }, @{ id = 'inst-wed'; start = @{ dateTime = '2026-01-07T16:00:00.0000000' } }) } }
                throw "unexpected $Method $Uri"
            }
            $r = Import-DEMigrationCalendar -ProjectId 'alamo-mail' -SourceAddress 'suzette.alamo@gmail.com' -Path $ics -Confirm:$false
            $r.status | Should -Be 'Succeeded'; $r.data.imported | Should -Be 3; @($r.data.skipped).Count | Should -Be 2
            ($r.data.skipped -join ' ') | Should -Match 'FREQ HOURLY'; ($r.data.skipped -join ' ') | Should -Match 'moved single occurrence'
            $weekly = $global:MigT.Events[0]
            $weekly.subject | Should -Be 'Staff meeting, office'; $weekly.start.timeZone | Should -Be 'America/Phoenix'; (Get-MigText $weekly.start.dateTime) | Should -Be '2026-01-05T09:00:00'
            $weekly.recurrence.pattern.type | Should -Be 'weekly'; @($weekly.recurrence.pattern.daysOfWeek) -join ',' | Should -Be 'monday,wednesday'; $weekly.recurrence.range.numberOfOccurrences | Should -Be 10
            $weekly.PSObject.Properties['attendees'] | Should -BeNullOrEmpty; $weekly.body.content | Should -Match 'Mike Daniels <mike.alamo@gmail.com>'
            $weekly.body.content | Should -Match "Line one`nLine two"
            @($global:MigT.Deleted).Count | Should -Be 1; @($global:MigT.Deleted)[0] | Should -Match '/users/id-suzette/events/inst-wed$'
            $holiday = $global:MigT.Events[1]; $holiday.isAllDay | Should -Be $true; $holiday.showAs | Should -Be 'free'; $holiday.isReminderOn | Should -Be $false
            $monthly = $global:MigT.Events[2]; $monthly.recurrence.pattern.type | Should -Be 'relativeMonthly'; $monthly.recurrence.pattern.index | Should -Be 'second'; (Get-MigText $monthly.recurrence.range.endDate) | Should -Match '^2026-12-31'
            $global:MigT.Events = @()
            (Import-DEMigrationCalendar -ProjectId 'alamo-mail' -SourceAddress 'suzette.alamo@gmail.com' -Path $ics -Confirm:$false).data.imported | Should -Be 0
            $global:MigT.Events.Count | Should -Be 0
        }
    }

    Context 'DNS, bounces, sign-off and the Hub record' {
        It 'compares live DNS with what Microsoft 365 expects and flags a Google MX left behind' {
            Mock -ModuleName DE-Microsoft-Admin Get-MgContext { @{ TenantId = 'tenant-1' } }
            Mock -ModuleName DE-Microsoft-Admin Invoke-MgGraphRequest { @{ value = @(@{ recordType = 'Mx'; supportedService = 'Email'; mailExchange = 'alamo-industries-com.mail.protection.outlook.com' }, @{ recordType = 'Txt'; supportedService = 'Email'; text = 'v=spf1 include:spf.protection.outlook.com -all' }, @{ recordType = 'CName'; supportedService = 'Email'; label = 'autodiscover.alamo-industries.com'; canonicalName = 'autodiscover.outlook.com' }) } }
            Mock -ModuleName DE-Microsoft-Admin Get-EXOMailbox { [pscustomobject]@{ ForwardingSmtpAddress = $null; ForwardingAddress = $null } }
            $global:MigT.Mx = @('alamo-industries-com.mail.protection.outlook.com', 'aspmx.l.google.com')
            Mock -ModuleName DE-Microsoft-Admin Resolve-DnsName {
                switch ($Type) {
                    'MX' { $global:MigT.Mx | ForEach-Object { [pscustomobject]@{ Type = 'MX'; NameExchange = $_ } } }
                    'TXT' { if ($Name -like '_dmarc*') { [pscustomobject]@{ Type = 'TXT'; Strings = @('v=DMARC1; p=none') } } else { [pscustomobject]@{ Type = 'TXT'; Strings = @('v=spf1 include:spf.protection.outlook.com -all') } } }
                    'CNAME' { if ($Name -like 'autodiscover*') { [pscustomobject]@{ Type = 'CNAME'; NameHost = 'autodiscover.outlook.com' } } }
                }
            }
            $r = Test-DEMigrationDns -ProjectId 'alamo-mail'
            $r.status | Should -Be 'Failed'; $r.message | Should -Match 'aspmx.l.google.com'
            $global:MigT.Mx = @('alamo-industries-com.mail.protection.outlook.com')
            $r = Test-DEMigrationDns -ProjectId 'alamo-mail'
            $r.status | Should -Be 'Succeeded'; $r.message | Should -Match 'DKIM'
            $p = Get-DEMigrationProject -ProjectId 'alamo-mail'
            $p.dns.mxOk | Should -Be $true; $p.verification.'DNS and forwarding'.status | Should -Be 'Pass'
        }
        It 'reads a bounce: an automatic forward, a client retrying an old message on HelenU, and a bounce of a bounce' {
            $fwd = Join-Path $global:MigT.Dir 'fwd.eml'
            [IO.File]::WriteAllText($fwd, (@('From: Mail Delivery Subsystem <mailer-daemon@googlemail.com>', 'To: helen.alamo@gmail.com', 'Date: Mon, 28 Sep 2026 15:00:00 +0000', 'Subject: Delivery Status Notification (Failure)', 'Content-Type: multipart/report; report-type=delivery-status; boundary="b"', '', '--b', 'Content-Type: message/delivery-status', '', 'Reporting-MTA: dns; googlemail.com', '', 'Final-Recipient: rfc822; helenu@alamo-industires.com', 'Action: failed', 'Status: 5.1.1', 'Diagnostic-Code: smtp; 550 5.1.1 The email account that you tried to reach does not exist.', '', '--b', 'Content-Type: message/rfc822', '', 'From: Vendor <billing@vendor.com>', 'To: helen.alamo@gmail.com', 'X-Forwarded-To: helenu@alamo-industires.com', 'X-Forwarded-For: helen.alamo@gmail.com helenu@alamo-industires.com', 'Date: Mon, 28 Sep 2026 14:59:00 +0000', 'Subject: Invoice 1042', '', 'body', '--b--') -join "`r`n"))
            $r = Invoke-DEBounceDiagnostic -ProjectId 'alamo-mail' -Path $fwd
            $r.data.cause | Should -Be 'AutomaticForward'; $r.data.smtpStatus | Should -Be '5.1.1'; $r.data.bouncedRecipient | Should -Be 'helenu@alamo-industires.com'; $r.message | Should -Match 'Forwarding'
            $retry = Join-Path $global:MigT.Dir 'retry.eml'
            [IO.File]::WriteAllText($retry, (@('From: MAILER-DAEMON@alamo-industries-com.mail.protection.outlook.com', 'Date: Tue, 29 Sep 2026 08:00:00 +0000', 'Subject: Undeliverable: Scan from copier', '', 'Final-Recipient: rfc822;old.office@gmail.com', 'Status: 5.7.57', '', 'Content-Type: text/rfc822-headers', '', 'Received: from equip.alamo (10.0.0.20) by smtp.gmail.com', 'From: scanner@alamo-industries.com', 'X-Mailer: Copier SMTP 2.1', 'Date: Fri, 25 Sep 2026 09:00:00 +0000', 'Subject: Scan from copier', '') -join "`r`n"))
            $r = Invoke-DEBounceDiagnostic -ProjectId 'alamo-mail' -Path $retry
            $r.data.cause | Should -Be 'RetryingClient'; @($r.data.matchedDevices) | Should -Contain 'equip.alamo'; $r.data.sendingClient | Should -Be 'Copier SMTP 2.1'; $r.data.meaning | Should -Match 'SMTP AUTH'
            $loop = Join-Path $global:MigT.Dir 'loop.eml'
            [IO.File]::WriteAllText($loop, (@('From: postmaster@alamo-industries.com', 'Date: Tue, 29 Sep 2026 09:00:00 +0000', 'Subject: Undeliverable: Undeliverable: hello', '', 'Status: 5.4.1', '', '----- Original message -----', 'From: MAILER-DAEMON@googlemail.com', 'Subject: Delivery Status Notification (Failure)', 'Date: Tue, 29 Sep 2026 08:59:00 +0000', '') -join "`r`n"))
            (Invoke-DEBounceDiagnostic -ProjectId 'alamo-mail' -Path $loop).data.cause | Should -Be 'NdrReprocessed'
            $p = Get-DEMigrationProject -ProjectId 'alamo-mail'
            @($p.bounce).Count | Should -Be 3; $p.verification.'Bounce diagnostic'.status | Should -Be 'Fail'
            foreach ($f in @($p.bounce)) { $null = Resolve-DEMigrationBounce -ProjectId 'alamo-mail' -FindingId $f.id -Resolution 'fixed at source' -Technician 'jrpetro' -Confirm:$false }
            (Get-DEMigrationProject -ProjectId 'alamo-mail').verification.'Bounce diagnostic'.status | Should -Be 'Pass'
        }
        It 'measured checks cannot be typed in, and a sign-off must match the checklist' {
            (Set-DEMigrationCheck -ProjectId 'alamo-mail' -Check 'Inbound mail' -Status Pass -Note 'looked fine' -Technician 'jrpetro' -Confirm:$false).status | Should -Be 'Refused'
            (Set-DEMigrationCheck -ProjectId 'alamo-mail' -Check 'Replies' -Status Pass -Note 'replied from Outlook to Gmail and back' -Technician 'jrpetro' -Confirm:$false).status | Should -Be 'Succeeded'
            $r = New-DEMigrationSignoff -ProjectId 'alamo-mail' -ApprovedBy 'Mike Daniels' -Decision Approved -Confirm:$false
            $r.status | Should -Be 'Refused'; $r.message | Should -Match 'Inbound mail \(Pending\)'
            (New-DEMigrationSignoff -ProjectId 'alamo-mail' -ApprovedBy 'Mike Daniels' -Decision ApprovedWithExceptions -Exceptions @{ 'Outlook mobile' = 'Monday' } -Confirm:$false).message | Should -Match 'need a reason for: Inbound mail'
            $open = InModuleScope DE-Microsoft-Admin { $p = Get-DEMigrationProject -ProjectId 'alamo-mail'; @($script:MigrationChecks.Keys | Where-Object { "$($p.verification.$_.status)" -notin @('Pass', 'NotApplicable') }) }
            $ex = @{}; foreach ($c in $open) { $ex[$c] = "done at the office visit ($c)" }
            $s = New-DEMigrationSignoff -ProjectId 'alamo-mail' -ApprovedBy 'Mike Daniels' -Decision ApprovedWithExceptions -Exceptions $ex -Confirm:$false
            $s.status | Should -Be 'Succeeded'; @($s.data.exceptions).Count | Should -Be $open.Count
            (Get-DEMigrationProject -ProjectId 'alamo-mail').stage | Should -Be 'SignedOff'
        }
        It 'refuses to save or export anything that looks like a credential, and exports the Hub record' {
            $p = Get-DEMigrationProject -ProjectId 'alamo-mail'
            $p | Add-Member -NotePropertyName appPassword -NotePropertyValue 'abcd' -Force
            (Get-MigThrown { & (Get-Module DE-Microsoft-Admin) { param($P) Save-DEMigrationProject -Project $P } $p }) | Should -Match 'credential-like fields at \$\.appPassword'
            $out = Join-Path $global:MigT.Dir 'hub-record.json'
            $r = Export-DEMigrationRecord -ProjectId 'alamo-mail' -Path $out
            $r.status | Should -Be 'Succeeded'
            $bytes = [IO.File]::ReadAllBytes($out); $bytes[0] | Should -Not -Be 0xEF
            $rec = Get-Content -LiteralPath $out -Raw | ConvertFrom-Json
            $rec.schema | Should -Be 'de.email-migration.record/v1'; @($rec.identityMap).Count | Should -Be 3; $rec.signoff.decision | Should -Be 'ApprovedWithExceptions'
            (Get-Content -LiteralPath $out -Raw) | Should -Not -Match 'wxyz|qrst|transactionIds'
        }
        It 'the PC scan runs anywhere and reports nothing when no mail app points at Gmail' {
            $r = Get-DEMailClientInventory -DeviceName 'TEST-PC'
            $r.status | Should -BeIn @('Succeeded', 'Partial'); $r.target | Should -Be 'TEST-PC'
        }
    }
    Context 'the next step and PC scans made on client PCs' {
        It 'reads the next step from what was recorded, with a command that names the project and never a password' {
            $dir = & (Get-Module DE-Microsoft-Admin) { $script:MigrationDir }
            $write = { param($o) [IO.File]::WriteAllText((Join-Path $dir 'next-mail.json'), ($o | ConvertTo-Json -Depth 20), (New-Object Text.UTF8Encoding $false)) }
            $chk = [pscustomobject]@{}; foreach ($c in @('Inbound mail', 'Replies', 'Bounce diagnostic')) { $chk | Add-Member -NotePropertyName $c -NotePropertyValue ([pscustomobject]@{ status = 'Pending'; detail = ''; by = ''; at = '' }) }
            $p = [pscustomobject]@{ projectId = 'next-mail'; client = 'Alamo'; targetDomain = 'alamo-industries.com'; sourceType = 'PersonalGmail'; mailPath = 'IMAP'; stage = 'Assessment'; updatedAt = $null; users = @(); sharedMailboxes = @(); devices = @(); batches = @(); dns = $null; bounce = @(); verification = $chk; signoff = $null; events = @() }
            & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Be 'Map each mailbox'
            $u = [pscustomobject]@{ source = 'helen.x@gmail.com'; destination = 'helen@alamo-industries.com'; devices = @('HELENU'); destinationReady = $false; destinationIssues = @('no licence'); preflight = $null; batch = $null; migration = $null; contacts = $null; calendar = $null; mfa = $null }
            $p.users = @($u); & $write $p; $n = Get-DEMigrationNextStep -ProjectId 'next-mail'; $n.step | Should -Be 'Get helen@alamo-industries.com ready'; $n.why | Should -Match 'no licence'
            $u.destinationReady = $true; & $write $p; $n = Get-DEMigrationNextStep -ProjectId 'next-mail'; $n.step | Should -Match 'IMAP preflight for helen.x@gmail.com'; $n.command | Should -Match 'Get-Credential helen.x@gmail.com'; $n.command | Should -Match '-ProjectId next-mail'
            $u.preflight = [pscustomobject]@{ ok = $true }; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Be 'Start the pilot'
            $p.batches = @([pscustomobject]@{ name = 'b1'; type = 'Pilot'; status = 'Synced'; confirmedBy = $null }); $u.batch = 'b1'; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail' -Technician 'jrpetro').command | Should -Match 'Confirm-DEMigrationPilot -ProjectId next-mail -Technician jrpetro'
            $p.batches[0].confirmedBy = 'jrpetro'; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Match '^Contacts and calendar'
            $u.contacts = [pscustomobject]@{ imported = 3 }; $u.calendar = [pscustomobject]@{ imported = 4 }; & $write $p; $n = Get-DEMigrationNextStep -ProjectId 'next-mail'; $n.step | Should -Be 'Scan each PC for Gmail'; $n.why | Should -Match 'HELENU'
            $p.devices = @([pscustomobject]@{ name = 'HELENU'; checkedAt = '2026-09-01T00:00:00Z'; gmailReferences = @() }); & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Be 'Point DNS to Microsoft 365'
            $p.dns = [pscustomobject]@{ mxOk = $true }; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').command | Should -Match 'Complete-DEMigrationBatch -ProjectId next-mail -BatchName b1'
            $p.batches[0].status = 'Completed'; & $write $p; $n = Get-DEMigrationNextStep -ProjectId 'next-mail'; $n.step | Should -Be 'Finish verification'
            $n.command | Should -Match 'Test-DEMigrationMailFlow -ProjectId next-mail'; $n.command | Should -Match "Set-DEMigrationCheck -ProjectId next-mail -Check 'Replies' -Status Pass -Note"; $n.command | Should -Match "'Bounce diagnostic' -Status NotApplicable"
            foreach ($c in @('Inbound mail', 'Replies', 'Bounce diagnostic')) { $p.verification.$c.status = 'Pass' }; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Be 'Client sign-off'
            $p.signoff = [pscustomobject]@{ decision = 'Approved' }; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').step | Should -Be 'Close the project'
            $p.stage = 'Closed'; & $write $p; (Get-DEMigrationNextStep -ProjectId 'next-mail').command | Should -Match 'Export-DEMigrationRecord'
        }
        It 'records a scan made on a client PC, keeps what was not checked, and refuses a file that is not a scan' {
            $bad = Join-Path $global:MigT.Dir 'not-a-scan.json'; [IO.File]::WriteAllText($bad, '{"operation":"Get-DEUser","target":"x"}')
            (Import-DEMailClientInventory -ProjectId 'next-mail' -Path $bad -Confirm:$false).status | Should -Be 'Refused'
            (Import-DEMailClientInventory -ProjectId 'next-mail' -Path (Join-Path $global:MigT.Dir 'missing.json') -Confirm:$false).status | Should -Be 'Refused'
            $scan = [pscustomobject]@{ product = 'DE Microsoft Admin'; operation = 'Get-DEMailClientInventory'; status = 'Partial'; target = 'FRONTDESK'; at = '2026-09-02T10:00:00Z'; message = '1 place(s)'
                data = @([pscustomobject]@{ account = 'suzette'; where = "Outlook 16.0 profile 'Outlook'"; what = 'IMAP Server=imap.gmail.com'; fix = 'remove this account' }); accounts = @('suzette', 'norma'); notChecked = @('Credential Manager for norma (encrypted for that account)') }
            $f = Join-Path $global:MigT.Dir 'FRONTDESK-gmail-scan.json'; $null = Export-DEResult -Result $scan -Path $f
            $r = Import-DEMailClientInventory -ProjectId 'next-mail' -Path $f -Confirm:$false
            $r.status | Should -Be 'Succeeded'; $r.message | Should -Match 'FRONTDESK recorded: 1 Gmail reference\(s\), 1 part\(s\) not checked'
            $d = @((Get-DEMigrationProject -ProjectId 'next-mail').devices | Where-Object { $_.name -eq 'FRONTDESK' })
            $d.Count | Should -Be 1; $d[0].source | Should -Be 'imported'; @($d[0].accounts) -join ',' | Should -Be 'suzette,norma'; @($d[0].gmailReferences).Count | Should -Be 1; @($d[0].notChecked).Count | Should -Be 1
            $null = Import-DEMailClientInventory -ProjectId 'next-mail' -Path $f -Confirm:$false
            @((Get-DEMigrationProject -ProjectId 'next-mail').devices | Where-Object { $_.name -eq 'FRONTDESK' }).Count | Should -Be 1
        }
        It 'the scan result lists the accounts it read and what it could not check' {
            $r = Get-DEMailClientInventory -DeviceName 'TEST-PC'
            $r.PSObject.Properties['accounts'] | Should -Not -BeNullOrEmpty; $r.PSObject.Properties['notChecked'] | Should -Not -BeNullOrEmpty
            @($r.accounts).Count | Should -Be 1
            if (@($r.notChecked).Count) { $r.status | Should -Be 'Partial' }
        }
    }
}
