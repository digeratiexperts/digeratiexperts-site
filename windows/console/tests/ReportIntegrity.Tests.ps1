# Report integrity: a failed control is never reported as passed. Checklist SECURITY item 152.
#   Invoke-Pester -Path .claude/skills/msp-ai-kit/windows/console/tests/ReportIntegrity.Tests.ps1
# The readiness roll-up and the client-safe report are the two places a FAIL can be softened into a
# pass: Get-DEReadiness decides the area and overall state, ConvertTo-DEHtmlReport turns that state
# into the client's words. Both are asserted against real evidence records, with the plan actions
# registered the way the console registers them, so the in-plan roll-up is exercised and not just the
# empty-plan fallback. The healthy cases are asserted too, so none of these checks are vacuous.

Describe 'Readiness never marks a failed control as passed' {
    BeforeEach {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $script:Dir = Initialize-TestConsole
        # The plan the run is judged against. Without these the roll-up has nothing in-plan to score.
        foreach ($a in @(
                @{ Id = 'security.guardz.agent'; Module = 'security'; Title = 'Guardz agent installed' },
                @{ Id = 'security.guardz.tenant'; Module = 'security'; Title = 'Guardz tenant configured' },
                @{ Id = 'ops.backup.job'; Module = 'ops'; Title = 'Backup job healthy' },
                @{ Id = 'plan.handoff'; Module = 'plan'; Title = 'Handoff confirmed' }
            )) {
            Register-DEAction -Id $a.Id -Module $a.Module -Title $a.Title -Detect { @() }
        }
    }

    It 'is NOT READY when a control has FAILED' {
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'security.guardz.tenant' -Module 'security' -Before '' -ActionTaken 'check' -Result 'FAIL' -Remediation 'enable the tenant'
        (Get-DEReadiness).overall | Should -Be 'NOT READY'
    }

    It 'is NOT READY when a control is BLOCKED' {
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'BLOCKED'
        (Get-DEReadiness).overall | Should -Be 'NOT READY'
    }

    It 'never shows an area as PASS when one of its controls failed' {
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'security.guardz.tenant' -Module 'security' -Before '' -ActionTaken 'check' -Result 'FAIL'
        (@(Get-DEReadiness).cards | Where-Object { $_.id -eq 'guardz' }).state | Should -Be 'FAIL'
    }

    It 'the latest evidence for a control wins, so a FAIL is not masked by an earlier PASS' {
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 're-check' -Result 'FAIL'
        (@(Get-DEReadiness).cards | Where-Object { $_.id -eq 'guardz' }).state | Should -Be 'FAIL'
        (Get-DEReadiness).overall | Should -Be 'NOT READY'
    }

    It 'a plan control that never ran is NOT RUN and NOT READY, never PASS' {
        $r = Get-DEReadiness
        (@($r.cards) | Where-Object { $_.id -eq 'guardz' }).state | Should -Be 'NOT RUN'
        $r.overall | Should -Be 'NOT RUN'
    }

    It 'WARN and PLANNED controls keep the run in progress rather than ready' {
        Add-DEEvidence -Step 'ops.backup.job' -Module 'ops' -Before '' -ActionTaken 'check' -Result 'WARN'
        Add-DEEvidence -Step 'plan.handoff' -Module 'plan' -Before '' -ActionTaken 'check' -Result 'PLANNED'
        (Get-DEReadiness).overall | Should -Be 'IN PROGRESS'
    }

    It 'a control outside the loaded plan is still scored, and cannot read as ready' {
        # Regression: the roll-up used to score only in-plan controls plus FAIL/BLOCKED anywhere, so an
        # unplanned WARN (an area card showing "Needs attention") still rolled up to READY.
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'security.guardz.unplanned' -Module 'security' -Before '' -ActionTaken 'check' -Result 'WARN'
        $r = Get-DEReadiness
        $r.overall | Should -Not -Be 'READY'
        (@($r.cards) | Where-Object { $_.id -eq 'guardz' }).state | Should -Be 'WARN'
    }

    It 'is READY only when every plan control passes' {
        Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'security.guardz.tenant' -Module 'security' -Before '' -ActionTaken 'check' -Result 'PASS'
        Add-DEEvidence -Step 'ops.backup.job' -Module 'ops' -Before '' -ActionTaken 'check' -Result 'NO CHANGE'
        Add-DEEvidence -Step 'plan.handoff' -Module 'plan' -Before '' -ActionTaken 'check' -Result 'PASS'
        (Get-DEReadiness).overall | Should -Be 'READY'
    }

    It 'no non-passing result can ever yield an overall READY' {
        # INFO is deliberately a no-op record (it scores as PASS), so it is not in this list.
        foreach ($res in @('FAIL', 'BLOCKED', 'WARN', 'PLANNED', 'SKIPPED', 'EXCEPTION')) {
            . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
            $null = Initialize-TestConsole
            Register-DEAction -Id 'security.guardz.agent' -Module 'security' -Title 'Guardz agent installed' -Detect { @() }
            Add-DEEvidence -Step 'security.guardz.agent' -Module 'security' -Before '' -ActionTaken 'check' -Result $res
            $r = Get-DEReadiness
            $r.overall | Should -Not -Be 'READY' -Because "a single '$res' control must not read as ready"
            (@($r.cards) | Where-Object { $_.id -eq 'guardz' }).state | Should -Not -Be 'PASS' -Because "a single '$res' control must not read as a passing area"
        }
    }

    It 'keeps a failed control visible in the gap report instead of dropping it' {
        Add-DEEvidence -Step 'security.guardz.tenant' -Module 'security' -Before '' -ActionTaken 'check' -Result 'FAIL' -Remediation 'enable the tenant'
        $gaps = @(Get-DEGapReport)
        $gaps.Count | Should -BeGreaterThan 0
        @($gaps | Where-Object { $_.id -eq 'security.guardz.tenant' })[0].result | Should -Be 'FAIL'
    }
}

Describe 'Client-safe report never renders a failed control as in place' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1'); $script:Dir = Initialize-TestConsole
        # The renderer is the surface a client sees: it maps a state to plain words, and that mapping is
        # where a FAIL could be softened. Each case renders a real report and asserts on the output pill.
        $script:Render = {
            param([string]$State)
            $record = [pscustomobject]@{
                clientName = 'Alamo'; site = 'HQ'; hostname = 'DE-TEST-01'; manufacturer = 'Dell'; model = 'Latitude'
                readiness = $(if ($State -in @('PASS', 'NO CHANGE')) { 'READY' } else { 'NOT READY' })
                areas     = @([pscustomobject]@{ area = 'Guardz'; state = $State })
            }
            ConvertTo-DEHtmlReport -Record $record -ClientSafe -ClientProfile @{} -Gaps @() -Evidence @()
        }
    }

    It 'renders FAIL as Not in place and never as In place' {
        $html = & $script:Render 'FAIL'
        $html | Should -Match '<span class="pill fail">Not in place</span>'
        $html | Should -Not -Match '<span class="pill pass">In place</span>'
    }

    It 'renders BLOCKED as Not in place and never as In place' {
        $html = & $script:Render 'BLOCKED'
        $html | Should -Match '<span class="pill blocked">Not in place</span>'
        $html | Should -Not -Match '<span class="pill pass">In place</span>'
    }

    It 'renders WARN as Needs attention, not as In place' {
        $html = & $script:Render 'WARN'
        $html | Should -Match '<span class="pill warn">Needs attention</span>'
        $html | Should -Not -Match '<span class="pill pass">In place</span>'
    }

    It 'renders a NOT READY run as Not ready yet and never as Ready' {
        $html = & $script:Render 'FAIL'
        $html | Should -Match 'class="big">Not ready yet<'
        $html | Should -Not -Match 'class="big">Ready<'
    }

    It 'renders PASS as In place so the checks above are not vacuous' {
        $html = & $script:Render 'PASS'
        $html | Should -Match '<span class="pill pass">In place</span>'
        $html | Should -Match 'class="big">Ready<'
    }
}
