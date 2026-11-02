# Move 59: "Finalise the de.techconsole.job/v1 contract and its device validators" (#777).
#
# The job envelope is the one thing the call-home agent will obey as SYSTEM, so this suite pins every
# line of its contract (AGENT-THREAT-MODEL.md T1, T6, E1 and section 7):
#   - the envelope is sealed: every field the signature must cover is required, nothing else is allowed in;
#   - the window is short and checked, the device and account must be this one;
#   - the kind allowlist (catalog/job-kinds.json) is the first of two keys: per kind, what is enabled, what
#     is denied, what may only be read, what is hands-on only while DE has one person (D5), the order rules;
#   - parameters are data: named, one level deep, scalars, no control characters;
#   - the signing input moves when any sealed field moves (signature verification itself is move 65).
# The last Context ties the policy to the real action registry, so a new action family, a destructive
# action without a hands-on rule, or an id the schema cannot carry fails here instead of in the field.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'The de.techconsole.job/v1 contract and its device validators' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $script:Now = [datetime]::SpecifyKind([datetime]'2026-11-01T12:05:00', 'Utc')

        function script:New-DETestJob {
            param([string]$Kind = 'audit', [string[]]$Actions = @('net.connectivity'), [hashtable]$Set = @{}, [string[]]$Drop = @())
            $j = [ordered]@{
                schema = 'de.techconsole.job/v1'; jobId = '0b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f'; kind = $Kind; accountId = '42'
                deviceKey = 'dell:ABC123'; client = 'alamo'; orderId = $null; mode = $null; actions = @($Actions); params = $null; approvals = $null
                issuedAt = '2026-11-01T12:00:00Z'; expiresAt = '2026-11-01T12:10:00Z'; nonce = 'AAAAAAAAAAAAAAAAAAAAAA'
                issuedBy = 'joe'; reason = 'ticket 1234'; catalogSha256 = ('a' * 64); profileSha256 = $null; keyId = 'job-2026-1'; signature = ('A' * 86)
            }
            foreach ($k in $Set.Keys) { $j[$k] = $Set[$k] }
            foreach ($d in $Drop) { $j.Remove($d) }
            return $j
        }
        function script:Get-DEEnabledPolicy {
            param([switch]$SecondApprover)
            $p = Get-DEJobKindPolicy
            foreach ($kp in $p.kinds.PSObject.Properties) { $kp.Value.enabled = $true }
            if ($SecondApprover) { $p.secondApproverExists = $true }
            return $p
        }
        function script:Test-DETestJob {
            param($Job, $Policy)
            if (-not $Policy) { $Policy = Get-DEEnabledPolicy }
            return (@(Test-DEJobEnvelope -Job $Job -DeviceKey 'dell:ABC123' -AccountId '42' -Now $script:Now -Policy $Policy) -join ' | ')
        }
    }

    Context 'a good envelope and the shipped state' {
        It 'an audit job inside its window, for this device, passes when its kind is enabled' {
            (Test-DETestJob (New-DETestJob)) | Should -BeNullOrEmpty
        }
        It 'every kind ships disabled, technician-confirmed, with no second approver (D2, D5)' {
            $p = Get-DEJobKindPolicy
            foreach ($kp in $p.kinds.PSObject.Properties) {
                [bool]$kp.Value.enabled | Should -Be $false -Because "$($kp.Name) must not be enabled by this change"
                [bool]$kp.Value.unattended | Should -Be $false -Because "$($kp.Name) starts technician-confirmed (D2)"
            }
            [bool]$p.secondApproverExists | Should -Be $false
            @($p.kinds.PSObject.Properties).Count | Should -Be 6
        }
        It 'with the shipped policy even a good job is refused, naming the rule' {
            $msg = Test-DETestJob (New-DETestJob) (Get-DEJobKindPolicy)
            $msg | Should -Match "audit' jobs are not enabled"
        }
    }

    Context 'the envelope is sealed' {
        It 'refuses a job missing <field>' -TestCases @(
            @{ field = 'schema' }
            @{ field = 'jobId' }
            @{ field = 'kind' }
            @{ field = 'accountId' }
            @{ field = 'deviceKey' }
            @{ field = 'issuedAt' }
            @{ field = 'expiresAt' }
            @{ field = 'nonce' }
            @{ field = 'catalogSha256' }
            @{ field = 'actions' }
            @{ field = 'issuedBy' }
            @{ field = 'reason' }
            @{ field = 'keyId' }
            @{ field = 'signature' }
        ) {
            param($field)
            $msg = Test-DETestJob (New-DETestJob -Drop @($field))
            $msg | Should -Match "${field}: required" -Because "$field is covered by the seal, so a job without it is refused"
        }
        It 'the schema requires exactly the sealed fields (a new required field must be added here on purpose)' {
            $req = @((Get-DEContractSchema -Name 'job').required | Sort-Object)
            ($req -join ',') | Should -Be (@('schema', 'jobId', 'kind', 'accountId', 'deviceKey', 'issuedAt', 'expiresAt', 'nonce', 'catalogSha256', 'actions', 'issuedBy', 'reason', 'keyId', 'signature' | Sort-Object) -join ',')
        }
        It 'refuses a field the contract does not define' {
            (Test-DETestJob (New-DETestJob -Set @{ script = 'Get-Process' })) | Should -Match 'script: not a field'
        }
        It 'refuses a secret-shaped key and a recovery-password-shaped value' {
            (Test-DETestJob (New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ apiKey = 'x' } } })) | Should -Match 'secrets never go in a job record'
            (Test-DETestJob (New-DETestJob -Set @{ reason = 'key 111111-222222-333333-444444-555555-666666-777777-888888' })) | Should -Match 'recovery-password-shaped'
        }
        It 'refuses a malformed signature, nonce, hash, id and account' {
            (Test-DETestJob (New-DETestJob -Set @{ signature = 'short' })) | Should -Match 'signature'
            (Test-DETestJob (New-DETestJob -Set @{ nonce = 'tiny' })) | Should -Match 'nonce'
            (Test-DETestJob (New-DETestJob -Set @{ catalogSha256 = 'not-a-hash' })) | Should -Match 'catalogSha256'
            (Test-DETestJob (New-DETestJob -Set @{ jobId = 'job-1' })) | Should -Match 'jobId'
            (Test-DETestJob (New-DETestJob -Set @{ accountId = 'alamo' })) | Should -Match 'accountId'
        }
    }

    Context 'the window is short and checked' {
        It 'refuses an expired job' {
            $j = New-DETestJob -Set @{ issuedAt = '2026-11-01T11:00:00Z'; expiresAt = '2026-11-01T11:10:00Z' }
            (Test-DETestJob $j) | Should -Match 'the job has expired'
        }
        It 'refuses a job issued in the future beyond the allowed clock skew, and accepts one inside it' {
            $far = New-DETestJob -Set @{ issuedAt = '2026-11-01T12:30:00Z'; expiresAt = '2026-11-01T12:40:00Z' }
            (Test-DETestJob $far) | Should -Match 'in the future'
            $near = New-DETestJob -Set @{ issuedAt = '2026-11-01T12:08:00Z'; expiresAt = '2026-11-01T12:18:00Z' }
            (Test-DETestJob $near) | Should -BeNullOrEmpty -Because 'three minutes of skew is inside the five allowed'
        }
        It 'refuses a window longer than 15 minutes, and one that ends before it starts' {
            (Test-DETestJob (New-DETestJob -Set @{ expiresAt = '2026-11-01T12:30:00Z' })) | Should -Match 'longer than the 900'
            (Test-DETestJob (New-DETestJob -Set @{ expiresAt = '2026-11-01T11:59:00Z' })) | Should -Match 'not after issuedAt'
        }
        It 'refuses a time that has the right shape but is not a real day' {
            (Test-DETestJob (New-DETestJob -Set @{ issuedAt = '2026-13-45T12:00:00Z' })) | Should -Match 'issuedAt: not a real UTC time'
        }
    }

    Context 'the job is for this device and this account' {
        It 'refuses another device' {
            (Test-DETestJob (New-DETestJob -Set @{ deviceKey = 'dell:OTHER99' })) | Should -Match "deviceKey: the job is for 'dell:OTHER99'"
        }
        It 'refuses another account' {
            (Test-DETestJob (New-DETestJob -Set @{ accountId = '43' })) | Should -Match 'accountId: the job is for account'
        }
        It 'does not infer anything from the client name' {
            (Test-DETestJob (New-DETestJob -Set @{ client = 'someone-else' })) | Should -BeNullOrEmpty -Because 'client is a label; the account and device keys are the binding'
        }
    }

    Context 'the kind allowlist is the first key (section 7)' {
        It '<kind> <action>: allowed=<allowed> readOnly=<ro> handsOnOnly=<hands>' -TestCases @(
            @{ kind = 'audit'; action = 'net.connectivity'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'audit'; action = 'deprov.data-preserved'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'audit'; action = 'identity.entra-leave'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'audit'; action = 'deprov.agents'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'audit'; action = 'rescue.handoff'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'maintenance'; action = 'maint.windows-update'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'maintenance'; action = 'apps.chrome'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'maintenance'; action = 'security.guardz'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'maintenance'; action = 'identity.migrate'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'maintenance'; action = 'apps.remove.chrome'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'maintenance'; action = 'baseline.logon-notice'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'maintenance'; action = 'order.verify-device'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'rescue'; action = 'rescue.handoff'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'rescue'; action = 'rescue.detect-stage'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'rescue'; action = 'identity.bitlocker'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'rescue'; action = 'jumpcloud.agent'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'provision'; action = 'jumpcloud.agent'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'provision'; action = 'identity.bitlocker-backup'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'provision'; action = 'identity.entra-leave'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'provision'; action = 'apps.remove.chrome'; allowed = $true; ro = $false; hands = $true }
            @{ kind = 'takeover'; action = 'identity.migrate'; allowed = $true; ro = $false; hands = $true }
            @{ kind = 'takeover'; action = 'identity.bitlocker'; allowed = $true; ro = $false; hands = $true }
            @{ kind = 'takeover'; action = 'net.connectivity'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'takeover'; action = 'deprov.agents'; allowed = $false; ro = $true; hands = $false }
            @{ kind = 'deprovision'; action = 'deprov.data-preserved'; allowed = $true; ro = $false; hands = $false }
            @{ kind = 'deprovision'; action = 'deprov.jumpcloud'; allowed = $true; ro = $false; hands = $true }
            @{ kind = 'deprovision'; action = 'net.connectivity'; allowed = $true; ro = $true; hands = $false }
            @{ kind = 'deprovision'; action = 'identity.hello'; allowed = $false; ro = $true; hands = $false }
        ) {
            param($kind, $action, $allowed, $ro, $hands)
            $d = Get-DEJobActionDecision -Kind $kind -ActionId $action
            $d.Allowed | Should -Be $allowed -Because $d.Why
            if ($allowed) {
                $d.ReadOnly | Should -Be $ro -Because "$kind may only read $action when ro is $ro"
                $d.HandsOnOnly | Should -Be $hands
            }
        }
        It 'an unknown kind, and a security removal in any kind, are refused (the global deny list)' {
            (Get-DEJobActionDecision -Kind 'nonsense' -ActionId 'net.time').Allowed | Should -Be $false
            foreach ($kind in @('audit', 'maintenance', 'provision', 'takeover', 'deprovision')) {
                (Get-DEJobActionDecision -Kind $kind -ActionId 'security.remove-guardz').Allowed | Should -Be $false -Because "$kind must never remove a security component"
            }
        }
        It 'deny wins over enable' {
            $p = Get-DEEnabledPolicy
            $p.kinds.audit.deny = @('net.time')
            (Get-DEJobActionDecision -Kind 'audit' -ActionId 'net.time' -Policy $p).Allowed | Should -Be $false
            (Get-DEJobActionDecision -Kind 'audit' -ActionId 'net.site' -Policy $p).Allowed | Should -Be $true
        }
        It 'a whole job is refused when any one of its actions is not allowed, naming it' {
            $msg = Test-DETestJob (New-DETestJob -Kind 'audit' -Actions @('net.connectivity', 'deprov.agents'))
            $msg | Should -Match "'deprov.agents' is denied for a audit job"
        }
        It 'refuses an empty job, a duplicate action and an oversized job' {
            (Test-DETestJob (New-DETestJob -Actions @())) | Should -Match 'no actions'
            (Test-DETestJob (New-DETestJob -Actions @('net.time', 'net.time'))) | Should -Match "'net.time' appears twice"
            $many = @(1..60 | ForEach-Object { "baseline.c$_" })
            (Test-DETestJob (New-DETestJob -Actions $many)) | Should -Match 'more than the 50'
        }
    }

    Context 'order rules and prerequisites' {
        It 'provision: the right order passes, jumpcloud before the reboot check does not' {
            $good = @('order.verify-device', 'net.connectivity', 'maint.pending-reboot', 'jumpcloud.agent', 'identity.bitlocker', 'baseline.fw-domain', 'apps.m365.readiness')
            (Test-DETestJob (New-DETestJob -Kind 'provision' -Actions $good)) | Should -BeNullOrEmpty
            $bad = @('jumpcloud.agent', 'maint.pending-reboot')
            (Test-DETestJob (New-DETestJob -Kind 'provision' -Actions $bad)) | Should -Match "'maint.pending-reboot' comes after 'jumpcloud.agent'"
        }
        It 'provision: nothing else runs before BitLocker is protected, and m365 readiness is last' {
            $early = @('baseline.fw-domain', 'identity.bitlocker')
            (Test-DETestJob (New-DETestJob -Kind 'provision' -Actions $early)) | Should -Match "'identity.bitlocker' comes after 'baseline.fw-domain'"
            $notLast = @('apps.m365.readiness', 'baseline.fw-domain')
            (Test-DETestJob (New-DETestJob -Kind 'provision' -Actions $notLast)) | Should -Match "'baseline.fw-domain' comes after 'apps.m365.readiness'"
        }
        It 'takeover: leaving Entra needs the BitLocker backup and the migration check first, in this job' {
            $none = @('identity.entra-leave')
            (Test-DETestJob (New-DETestJob -Kind 'takeover' -Actions $none)) | Should -Match "'identity.entra-leave' needs 'identity.bitlocker-backup' earlier"
            $wrong = @('identity.entra-leave', 'identity.bitlocker-backup', 'identity.verify-migration')
            $msg = Test-DETestJob (New-DETestJob -Kind 'takeover' -Actions $wrong)
            $msg | Should -Match "'identity.entra-leave' needs"
            $right = @('identity.bitlocker-backup', 'identity.migrate', 'identity.verify-migration', 'identity.entra-leave')
            (Test-DETestJob (New-DETestJob -Kind 'takeover' -Actions $right -Set @{ approvals = @('alice') }) (Get-DEEnabledPolicy -SecondApprover)) | Should -BeNullOrEmpty
        }
        It 'deprovision: nothing is removed before data is verified preserved' {
            $bad = @('deprov.agents')
            (Test-DETestJob (New-DETestJob -Kind 'deprovision' -Actions $bad)) | Should -Match "'deprov.agents' needs 'deprov.data-preserved' earlier"
            $backwards = @('deprov.agents', 'deprov.data-preserved')
            (Test-DETestJob (New-DETestJob -Kind 'deprovision' -Actions $backwards)) | Should -Match 'needs'
        }
    }

    Context 'destructive work is hands-on while DE has one person (D5)' {
        It 'refuses a destructive action as a job when there is no second approver' {
            $j = New-DETestJob -Kind 'deprovision' -Actions @('deprov.data-preserved', 'deprov.jumpcloud')
            (Test-DETestJob $j) | Should -Match "'deprov.jumpcloud' is destructive and DE has one person"
        }
        It 'with a second approver it still needs one who is not the issuer' {
            $p = Get-DEEnabledPolicy -SecondApprover
            $acts = @('deprov.data-preserved', 'deprov.jumpcloud')
            (Test-DETestJob (New-DETestJob -Kind 'deprovision' -Actions $acts) $p) | Should -Match 'needs a second approver different from issuedBy'
            (Test-DETestJob (New-DETestJob -Kind 'deprovision' -Actions $acts -Set @{ approvals = @('joe') }) $p) | Should -Match 'needs a second approver different from issuedBy'
            (Test-DETestJob (New-DETestJob -Kind 'deprovision' -Actions $acts -Set @{ approvals = @('alice') }) $p) | Should -BeNullOrEmpty
        }
        It 'a read-only detect inside a deprovision job needs no approval' {
            $j = New-DETestJob -Kind 'deprovision' -Actions @('deprov.data-preserved', 'net.connectivity')
            (Test-DETestJob $j) | Should -BeNullOrEmpty
        }
    }

    Context 'parameters are data' {
        It 'accepts named scalar values keyed by an action in the job' {
            $j = New-DETestJob -Kind 'maintenance' -Actions @('apps.chrome') -Set @{ params = @{ 'apps.chrome' = @{ channel = 'stable'; retries = 2; quiet = $true; note = $null } } }
            (Test-DETestJob $j) | Should -BeNullOrEmpty
        }
        It 'refuses parameters for an action that is not in the job' {
            $j = New-DETestJob -Set @{ params = @{ 'net.time' = @{ a = 1 } } }
            (Test-DETestJob $j) | Should -Match 'params.net.time: not an action in this job'
        }
        It 'refuses nested objects, arrays, bad names, long strings and control characters' {
            $nested = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ a = @{ b = 1 } } } }
            (Test-DETestJob $nested) | Should -Match 'must be a single value, not object'
            $arr = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ a = @(1, 2) } } }
            (Test-DETestJob $arr) | Should -Match 'must be a single value, not array'
            $name = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ 'a; Remove-Item' = 1 } } }
            (Test-DETestJob $name) | Should -Match 'not a valid parameter name'
            $long = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ a = ('x' * 300) } } }
            (Test-DETestJob $long) | Should -Match 'longer than 256'
            $ctl = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ a = "line1`nline2" } } }
            (Test-DETestJob $ctl) | Should -Match 'control characters are refused'
        }
        It 'a parameter value that looks like a command is only a value, never a refusal reason or a command' {
            $j = New-DETestJob -Set @{ params = @{ 'net.connectivity' = @{ target = 'a.example; Remove-Item C:\ -Recurse' } } }
            (Test-DETestJob $j) | Should -BeNullOrEmpty -Because 'parameters are structured values; the engine never splices them into command text (T6)'
        }
    }

    Context 'the signing input moves when any sealed field moves' {
        It 'leaves the signature out and does not depend on key order' {
            $a = New-DETestJob
            $b = [ordered]@{}
            foreach ($k in @($a.Keys | Sort-Object -Descending)) { $b[$k] = $a[$k] }
            (Get-DEJobSigningInput -Job $a) | Should -Be (Get-DEJobSigningInput -Job $b)
            (Get-DEJobSigningInput -Job $a) | Should -Not -Match 'signature'
            (Get-DEJobSigningInput -Job (New-DETestJob -Set @{ signature = ('B' * 86) })) | Should -Be (Get-DEJobSigningInput -Job $a)
        }
        It 'changes when <field> is edited' -TestCases @(
            @{ field = 'jobId'; value = '1b8f6d1e-3c4a-4d2b-9e7f-1a2b3c4d5e6f' }
            @{ field = 'kind'; value = 'maintenance' }
            @{ field = 'accountId'; value = '43' }
            @{ field = 'deviceKey'; value = 'dell:OTHER99' }
            @{ field = 'issuedAt'; value = '2026-11-01T12:00:01Z' }
            @{ field = 'expiresAt'; value = '2026-11-01T12:10:01Z' }
            @{ field = 'nonce'; value = 'BBBBBBBBBBBBBBBBBBBBBB' }
            @{ field = 'catalogSha256'; value = ('b' * 64) }
            @{ field = 'issuedBy'; value = 'someone' }
            @{ field = 'reason'; value = 'another reason' }
            @{ field = 'keyId'; value = 'job-2026-2' }
            @{ field = 'approvals'; value = @('alice') }
            @{ field = 'params'; value = @{ 'net.connectivity' = @{ a = 1 } } }
            @{ field = 'actions'; value = @('net.time') }
        ) {
            param($field, $value)
            $base = Get-DEJobSigningInput -Job (New-DETestJob)
            $edited = Get-DEJobSigningInput -Job (New-DETestJob -Set @{ $field = $value })
            $edited | Should -Not -Be $base -Because "an edit to $field after signing must break the seal"
        }
    }

    Context 'the policy matches the real action registry' {
        BeforeAll {
            $script:Registered = @{}
            $prof = Get-DEClientProfile -Id 'alamo'
            foreach ($mode in @('takeover', 'deprovision')) {
                $null = @(Initialize-DEWorkflow -ClientProfile $prof -Mode $mode)
                foreach ($a in @(Get-DEActions)) { if (-not $script:Registered.ContainsKey($a.Id)) { $script:Registered[$a.Id] = $a } }
            }
        }
        It 'the registry is really loaded (the other guards would pass on an empty one)' {
            $script:Registered.Count | Should -BeGreaterThan 90
        }
        It 'every registered action id fits the schema pattern the contract carries' {
            $pat = (Get-DEContractSchema -Name 'job').properties.actions.items.pattern
            $bad = @($script:Registered.Keys | Where-Object { $_ -cnotmatch $pat })
            ($bad -join ', ') | Should -BeNullOrEmpty -Because 'a registered action the contract cannot name can never be sent in a job'
        }
        It 'every registered family is a known family of the policy (a new family needs a section 7 decision)' {
            $p = Get-DEJobKindPolicy
            $fams = @($script:Registered.Keys | ForEach-Object { ($_ -split '\.')[0] } | Sort-Object -Unique)
            $unknown = @($fams | Where-Object { @($p.knownFamilies) -notcontains $_ })
            ($unknown -join ', ') | Should -BeNullOrEmpty
        }
        It 'every pattern in the policy points into a known family' {
            $p = Get-DEJobKindPolicy
            $bad = New-Object System.Collections.Generic.List[string]
            foreach ($kp in $p.kinds.PSObject.Properties) {
                foreach ($list in @('enable', 'deny', 'detectOnly', 'handsOnOnly')) {
                    foreach ($pat in @($kp.Value.$list)) {
                        if (@($p.knownFamilies) -notcontains (($pat -split '\.')[0])) { $bad.Add("$($kp.Name).${list}: $pat") }
                    }
                }
            }
            ($bad -join '; ') | Should -BeNullOrEmpty
        }
        It 'every registered Destructive action is hands-on only wherever a job could apply it' {
            $p = Get-DEEnabledPolicy
            $loose = New-Object System.Collections.Generic.List[string]
            foreach ($a in @($script:Registered.Values | Where-Object { $_.Destructive })) {
                foreach ($kp in $p.kinds.PSObject.Properties) {
                    $d = Get-DEJobActionDecision -Kind $kp.Name -ActionId $a.Id -Policy $p
                    if ($d.Allowed -and -not $d.ReadOnly -and -not $d.HandsOnOnly) { $loose.Add("$($kp.Name):$($a.Id)") }
                }
            }
            ($loose -join '; ') | Should -BeNullOrEmpty -Because 'D5: destructive jobs are not run through the agent while DE has one person'
        }
        It 'an audit job can read every registered action except the destructive deprovision four, and can apply none' {
            $p = Get-DEEnabledPolicy
            $denied = @($script:Registered.Keys | Where-Object { -not (Get-DEJobActionDecision -Kind 'audit' -ActionId $_ -Policy $p).Allowed } | Sort-Object)
            ($denied -join ',') | Should -Be 'deprov.agents,deprov.branding,deprov.breakglass,deprov.jumpcloud'
            $writes = @($script:Registered.Keys | Where-Object { $d = Get-DEJobActionDecision -Kind 'audit' -ActionId $_ -Policy $p; $d.Allowed -and -not $d.ReadOnly })
            $writes.Count | Should -Be 0 -Because 'an audit job changes nothing (E3)'
        }
        It 'no registered action is enabled for a kind and also on the global deny list' {
            $p = Get-DEJobKindPolicy
            $hit = @($script:Registered.Keys | Where-Object { $id = $_; @($p.globalDeny | Where-Object { $id -like $_ }).Count -gt 0 })
            ($hit -join ', ') | Should -BeNullOrEmpty -Because 'the global deny list names removals; no registered action is one, and one that appears must be reviewed'
        }
    }
}
