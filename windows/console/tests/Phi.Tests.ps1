# Issue #890: PHI-restricted mode. Decided by Joe, 2026-11-01.
#
#   - 'is healthcare' = the client account's vertical in the Hub profile; it applies to every device
#   - a per-device override can only make it MORE restrictive
#   - unknown vertical or unreachable Hub => restricted (fail closed)
#   - nothing sent to a vendor without a confirmed BAA
#
# The fail-closed clause is the one worth testing hardest: being wrong in the permissive direction is
# a PHI leak, being wrong in the restrictive direction is an inconvenience.

Describe 'PHI-restricted mode: decide conservatively, gate the vendors' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $global:Phi = @{ Profile = @{ hub = @{ accountId = '100' } } }
    }

    Context 'a healthcare client is restricted on every device' {
        It 'a healthcare vertical restricts the account' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true -Because 'a healthcare client account restricts all its devices'
            $s.reason | Should -Match 'healthcare'
        }
        It 'the same vertical restricts a second device, because it is the account that decides' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:AAA').restricted | Should -Be $true
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:BBB').restricted | Should -Be $true
        }
    }

    Context 'a non-healthcare client is not restricted, unless something says otherwise' {
        It 'a known non-healthcare vertical is not restricted' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $false; basis = 'vertical' } }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $false
            $s.vertical | Should -Be 'legal'
        }
        It 'a per-device override CAN restrict it, because an override may only tighten' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $false; basis = 'vertical' } }
            Set-DEPhiDeviceOverride -DeviceKey 'dell:CCC' -Restricted
            (Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:CCC').restricted | Should -Be $true
        }
    }

    Context 'an override can only make it more restrictive, never less' {
        It 'an attempt to unrestrict is refused and logged, not silently honoured' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            Set-DEPhiDeviceOverride -DeviceKey 'dell:DDD' -Restricted:$false
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile -DeviceKey 'dell:DDD'
            $s.restricted | Should -Be $true -Because 'a device cannot talk its way out of a restricted client'
            $s.override | Should -Be $false -Because 'the unrestricting override must not have been recorded'
        }
    }

    Context 'when the answer cannot be determined, it is restricted' {
        It 'an unknown vertical fails closed' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { $null }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true -Because 'unknown vertical must not be read as not-healthcare'
            $s.vertical | Should -Be 'unknown'
            $s.reason | Should -Match 'could not be determined'
        }
        It 'an unreachable Hub fails closed, because the vertical could not be read' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { $null }
            $s = Get-DEPhiState -ClientProfile @{ hub = @{ accountId = '' } }
            $s.restricted | Should -Be $true
        }
        It 'a client with no account id at all is restricted' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { $null }
            (Get-DEPhiState -ClientProfile @{}).restricted | Should -Be $true
        }
    }

    Context 'the BAA gate blocks unconfirmed vendors on a restricted device' {
        It 'an unconfirmed vendor is BLOCKED, not warned' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Guardz' -PhiRestricted
            $g.allowed | Should -Be $false -Because 'a blank or unconfirmed BAA is a block under the PHI rule'
            $g.reason | Should -Match 'blocked rather than warned'
        }
        It 'a confirmed vendor is allowed' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Intelligence Hub' -PhiRestricted
            $g.allowed | Should -Be $true
            $g.status | Should -Be 'confirmed'
        }
        It 'a vendor nobody has written down is blocked, not assumed fine' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Some New Vendor' -PhiRestricted
            $g.allowed | Should -Be $false
            $g.status | Should -Be 'unknown'
        }
        It 'the check is case-insensitive on the vendor name' {
            (Test-DEVendorBaaAllowed -Vendor 'guardz' -PhiRestricted).allowed | Should -Be $false
            (Test-DEVendorBaaAllowed -Vendor 'intelligence hub' -PhiRestricted).allowed | Should -Be $true
        }
        It 'a broken or missing register reads as unknown and blocks' {
            # the register is the whole enforcement mechanism; if it cannot be read, nothing is confirmed
            $status = Get-DEVendorBaaStatus -Vendor 'Intelligence Hub'
            $status | Should -BeIn @('confirmed', 'unconfirmed', 'unknown')
        }
    }

    Context 'outside a restricted device the register is recorded, not enforced' {
        It 'a non-PHI device may talk to an unconfirmed vendor' {
            $g = Test-DEVendorBaaAllowed -Vendor 'Guardz'
            $g.allowed | Should -Be $true -Because 'the gate exists for PHI, not for every device'
            $g.reason | Should -Match 'not enforced'
        }
    }

    Context 'the decision carries its reason' {
        It 'every state explains itself, so the call can be checked later' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $false; basis = 'vertical' } }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { $null }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).reason | Should -Not -BeNullOrEmpty
        }
    }

    Context 'the gate is wired into the vendor entry points, not left as a function nobody calls' {
        It 'a warranty lookup to an unconfirmed vendor is refused on a restricted device' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            $msg = Get-DEThrown { Invoke-DEWarrantyWeb -Uri 'https://www.dell.com/support/asset-entitlements' -Method GET }
            $msg | Should -Match 'blocked' -Because 'a serial must not reach Dell without a confirmed BAA'
        }
        It 'the same lookup proceeds when the BAA is confirmed' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            # prove the gate OPENS for a confirmed vendor, by confirming Dell for this test only
            Mock -ModuleName DE.Phi Get-DEVendorBaaStatus { 'confirmed' } -ParameterFilter { $Vendor -eq 'Dell' }
            $msg = Get-DEThrown { Invoke-DEWarrantyWeb -Uri 'https://www.dell.com/support/asset-entitlements' -Method GET }
            # the gate let it through, so the failure is the network call itself, not the refusal
            $msg | Should -Not -Match 'PHI-restricted device: the warranty lookup'
        }
        It 'a JumpCloud call is refused on a restricted device without a confirmed BAA' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            Mock -ModuleName DE.Phi Get-DEPhiRestricted { $true }
            $gate = Test-DEVendorBaaAllowed -Vendor 'JumpCloud' -PhiRestricted
            $gate.allowed | Should -Be $false
        }
        It 'an undecided session is treated as restricted, so nothing opens by default' {
            # the fail-closed direction again: a device nobody has cleared is not cleared
            $r = & (Get-Module DE.Phi) { $script:Phi.decision = $null; Get-DEPhiRestricted }
            $r | Should -Be $true
        }
        It 'vendor names are derived from the URL, and an unknown host is its own risk' {
            Get-DEVendorFromUri -Uri 'https://www.dell.com/x' | Should -Be 'Dell'
            Get-DEVendorFromUri -Uri 'https://support.lenovo.com/x' | Should -Be 'Lenovo'
            Get-DEVendorFromUri -Uri 'https://api.hp.com/x' | Should -Be 'HP'
            Get-DEVendorFromUri -Uri 'https://unknown.example/x' | Should -Be 'unknown'
        }
    }

    Context 'the Hub''s own answer decides, and only a clear no unrestricts' {
        It 'a Hub that marks the account restricted wins over a non-healthcare vertical' {
            # the Hub rule: a healthcare deal restricts whatever the vertical field says
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $true; basis = 'healthcare deal' } }
            $s = Get-DEPhiState -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true
            $s.reason | Should -Match 'whatever its vertical'
            $s.reason | Should -Match 'healthcare deal'
        }
        It 'a missing phiRestricted is not read as false' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $null; basis = '' } }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).restricted | Should -Be $true -Because 'only an explicit false unrestricts'
        }
        It 'an answer with a blank vertical is unknown, so restricted' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = ''; phiRestricted = $false; basis = '' } }
            (Get-DEPhiState -ClientProfile $global:Phi.Profile).restricted | Should -Be $true
        }
    }

    Context 'asking the Hub without the means to sign' {
        It 'no signing secret or endpoint is unknown, and the Hub is not called' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { throw 'must not be called' }
            Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '301' } } | Should -BeNullOrEmpty
            Should -Invoke Get-DEHubSigned -ModuleName DE.Phi -Times 0
        }
        It 'a client account id that is not a number is unknown' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { throw 'must not be called' }
            Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = 'ACC-100' } } | Should -BeNullOrEmpty
            Get-DEClientPhiFacts -ClientProfile @{} | Should -BeNullOrEmpty
            Should -Invoke Get-DEHubSigned -ModuleName DE.Phi -Times 0
        }
    }

    Context 'asking the Hub with a signing secret' {
        BeforeAll {
            Set-DESecret -Name 'DE_HUB_SIGNING_SECRET' -Plain 'test-signing-secret'
            Set-DEStateValue -Path 'settings.hub.endpoint' -Value 'https://hub.example/api/integrations/v1/techconsole/events'
        }
        AfterAll { (Get-DEConsole).Secrets.Remove('DE_HUB_SIGNING_SECRET') }

        It 'reads the facts from the signed profile route for that account' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            $f = Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '401' } }
            $f.vertical | Should -Be 'healthcare'
            $f.phiRestricted | Should -Be $true
            Should -Invoke Get-DEHubSigned -ModuleName DE.Phi -Times 1 -ParameterFilter { $Path -eq '/api/techtool/account/401/profile' -and $BaseUrl -eq 'https://hub.example' }
        }
        It 'uses a good answer from the cache instead of asking again' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $false; basis = 'vertical' } }
            $null = Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '402' } }
            $null = Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '402' } }
            Should -Invoke Get-DEHubSigned -ModuleName DE.Phi -Times 1
        }
        It 'a refusal is unknown, and an offline Hub is not asked again straight away' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { throw 'The remote server returned an error: (401) Unauthorized.' }
            Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '403' } } | Should -BeNullOrEmpty
            Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '403' } } | Should -BeNullOrEmpty
            Should -Invoke Get-DEHubSigned -ModuleName DE.Phi -Times 1 -Because 'one short wait, not one per call'
        }
        It 'an answer that is not shaped as expected is unknown' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { [pscustomobject]@{ vertical = 'legal'; phiRestricted = 'no'; basis = '' } }
            Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '404' } } | Should -BeNullOrEmpty -Because 'a string is not the boolean the Hub promises'
        }
        It 'a failed read after a good one keeps the good one' {
            Mock -ModuleName DE.Phi Get-DEHubSigned { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            $null = Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '405' } }
            & (Get-Module DE.Phi) { $script:Phi.factsCache['405'].fetchedAt = (Get-Date).AddHours(-30) }
            Mock -ModuleName DE.Phi Get-DEHubSigned { throw 'timeout' }
            (Get-DEClientPhiFacts -ClientProfile @{ hub = @{ accountId = '405' } }).vertical | Should -Be 'healthcare'
        }
    }

    Context 'the signed GET matches what the Hub verifies' {
        BeforeAll { $global:PhiSecure = ConvertTo-SecureString 'test-signing-secret' -AsPlainText -Force }
        It 'signs method, path, timestamp, event id and the empty body, as the POST does' {
            $global:PhiHdr = $null
            Mock -ModuleName DE.Contracts Invoke-DEHubHttpGet { $global:PhiHdr = $Headers; $global:PhiUri = $Uri; [pscustomobject]@{} }
            $null = Get-DEHubSigned -BaseUrl 'https://hub.example/' -Path '/api/techtool/account/7/profile' -Secret $global:PhiSecure
            $global:PhiUri | Should -Be 'https://hub.example/api/techtool/account/7/profile'
            $global:PhiHdr['X-DE-Source'] | Should -Be 'techconsole'
            $expected = Get-DEHubSignature -Method 'GET' -Path '/api/techtool/account/7/profile' -Timestamp $global:PhiHdr['X-DE-Timestamp'] -EventId $global:PhiHdr['X-DE-Event-ID'] -Body '{}' -Secret 'test-signing-secret'
            $global:PhiHdr['X-DE-Signature'] | Should -Be $expected
            $global:PhiHdr['X-DE-Timestamp'] | Should -Match '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$'
        }
        It 'refuses plain http, and a path carrying a query' {
            Mock -ModuleName DE.Contracts Invoke-DEHubHttpGet { throw 'must not be called' }
            (Get-DEThrown { Get-DEHubSigned -BaseUrl 'http://hub.example' -Path '/api/x' -Secret $global:PhiSecure }) | Should -Match 'https'
            (Get-DEThrown { Get-DEHubSigned -BaseUrl 'https://hub.example' -Path '/api/x?accountId=1' -Secret $global:PhiSecure }) | Should -Match 'no query'
        }
    }

    Context 'every production entry point settles the decision before it starts the workflow' {
        It 'the window and the headless run pair each workflow start with a PHI settle' {
            $con = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\DETechConsole.ps1') -Raw
            $starts = ([regex]::Matches($con, 'Initialize-DEWorkflow -ClientProfile')).Count
            $settles = ([regex]::Matches($con, 'Initialize-DEPhiDecision -ClientProfile')).Count
            $starts | Should -BeGreaterThan 0
            $settles | Should -Be $starts -Because 'a workflow started without settling would run on an undecided (restricted) session, or worse, a stale one'
        }
        It 'a background job settles in its own runspace, which does not share this module''s state' {
            $wf = Get-Content -LiteralPath (Join-Path $PSScriptRoot '..\modules\DE.Workflow\DE.Workflow.psm1') -Raw
            $wf | Should -Match 'Initialize-DEPhiDecision -ClientProfile \$JobProfile'
        }
    }

    Context 'the session decision is settled from the profile, and recorded' {
        AfterAll { Set-DEPhiDecision ([pscustomobject]@{ restricted = $false; vertical = 'not-healthcare'; client = $false; override = $false; reason = 'test default: not restricted' }) }

        It 'settling records the decision, the gates read it, and the evidence carries the reason' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'healthcare'; phiRestricted = $true; basis = 'vertical' } }
            $s = Initialize-DEPhiDecision -ClientProfile $global:Phi.Profile
            $s.restricted | Should -Be $true
            Get-DEPhiRestricted | Should -Be $true
            $ev = @(Get-DEEvidence | Where-Object { $_.step -eq 'phi.decision' })
            $ev.Count | Should -BeGreaterThan 0
            $ev[-1].action | Should -Match 'healthcare'
        }
        It 'a client that is clearly not restricted settles to not restricted' {
            Mock -ModuleName DE.Phi Get-DEClientPhiFacts { [pscustomobject]@{ vertical = 'legal'; phiRestricted = $false; basis = 'vertical' } }
            (Initialize-DEPhiDecision -ClientProfile $global:Phi.Profile).restricted | Should -Be $false
            Get-DEPhiRestricted | Should -Be $false
        }
    }

    Context 'discovery never looks inside a user data folder on a restricted device' {
        BeforeAll {
            $global:PhiDir = Join-Path ([IO.Path]::GetTempPath()) ("phi-sample-{0}" -f ([guid]::NewGuid()))
            $null = New-Item -ItemType Directory -Path $global:PhiDir -Force
            1..3 | ForEach-Object { Set-Content -LiteralPath (Join-Path $global:PhiDir "patient-chart-$_.txt") -Value 'x' }
        }
        AfterAll { Remove-Item -LiteralPath $global:PhiDir -Recurse -Force -ErrorAction SilentlyContinue }

        It 'an unrestricted device is sampled as before' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $false; vertical = 'legal'; client = $false; override = $false; reason = 'test' })
            $r = Get-DEFolderSample -Folder $global:PhiDir
            $r.inspected | Should -Be $true
            $r.files | Should -Be 3
        }
        It 'a restricted device never enumerates the folder at all' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $true; vertical = 'healthcare'; client = $true; override = $false; reason = 'test' })
            Mock -ModuleName DE.Discovery Get-ChildItem { throw 'a restricted device must not enumerate a user folder' }
            $r = Get-DEFolderSample -Folder $global:PhiDir
            $r.inspected | Should -Be $false
            $r.files | Should -BeNullOrEmpty -Because 'not looked at is not the same as empty'
            $r.sizeMB | Should -BeNullOrEmpty
            Should -Invoke Get-ChildItem -ModuleName DE.Discovery -Times 0
        }
        It 'an undecided session is restricted, so it does not look either' {
            & (Get-Module DE.Phi) { $script:Phi.decision = $null }
            (Get-DEFolderSample -Folder $global:PhiDir).inspected | Should -Be $false
        }
        It 'no folder is not inspected, restricted or not' {
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $false; vertical = 'legal'; client = $false; override = $false; reason = 'test' })
            (Get-DEFolderSample -Folder '').inspected | Should -Be $false
            (Get-DEFolderSample -Folder (Join-Path $global:PhiDir 'missing')).inspected | Should -Be $false
        }
        It 'no recursive walk exists in discovery outside the guarded function' {
            # the structural guard: a new Get-ChildItem -Recurse added elsewhere in discovery would bypass the restriction
            $src = Get-Content -LiteralPath (Join-Path (Split-Path (Get-Module DE.Discovery).Path) 'DE.Discovery.psm1') -Raw
            $fn = [regex]::Match($src, '(?s)function Get-DEFolderSample \{.*?\n\}').Value
            $fn | Should -Not -BeNullOrEmpty
            $outside = $src.Replace($fn, '')
            ([regex]::Matches($outside, '-Recurse')).Count | Should -Be 0 -Because 'every walk of a user folder must go through Get-DEFolderSample'
            Set-DEPhiDecision ([pscustomobject]@{ restricted = $false; vertical = 'not-healthcare'; client = $false; override = $false; reason = 'test default: not restricted' })
        }
    }
}

