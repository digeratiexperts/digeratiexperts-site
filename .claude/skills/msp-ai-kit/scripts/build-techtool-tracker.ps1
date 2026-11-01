<#
.SYNOPSIS
    Regenerate windows/DE-TECH-TOOL-TRACKER.md from the [TECHTOOL-nnn] GitHub issues.

.DESCRIPTION
    The tracker is a projection of the issues, never the other way round. Every title,
    owner, section, note and checkbox state is read back from GitHub, so the markdown and
    the issue tracker cannot drift apart.

        open issue    -> - [ ]
        closed issue  -> - [x]

    So the way to tick a box is to close its issue. The tracker's own copy is then just a
    readable index in plan order.

    Requires the GitHub CLI (`gh`) authenticated to digeratiexperts/digeratiexperts-site.

.PARAMETER Repo
    owner/name. Defaults to digeratiexperts/digeratiexperts-site.

.PARAMETER OutFile
    Where to write. Defaults to windows/DE-TECH-TOOL-TRACKER.md next to this script's kit.

.EXAMPLE
    powershell -File scripts/build-techtool-tracker.ps1

.EXAMPLE
    powershell -File scripts/build-techtool-tracker.ps1 -WhatIf
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$Repo = 'digeratiexperts/digeratiexperts-site',
    [string]$OutFile = ''
)

$ErrorActionPreference = 'Stop'

if (-not $OutFile) {
    $Kit = Split-Path -Parent $PSScriptRoot
    $OutFile = Join-Path (Join-Path $Kit 'windows') 'DE-TECH-TOOL-TRACKER.md'
}

# Pull every tracker issue back so the markdown cannot drift from GitHub.
# NB: pass the JSON to ConvertFrom-Json with -InputObject and flatten by hand.
# Piping it, or piping through Out-String (which wraps at console width and corrupts the
# JSON), both mis-count under Windows PowerShell 5.1.
$raw = gh issue list --repo $Repo --label 'de-tech-tool' --state all --limit 300 --json number,title,body,state
if (-not $raw) { throw "gh issue list returned nothing for $Repo; is 'gh' authenticated?" }
$parsed = ConvertFrom-Json -InputObject ($raw -join "`n")
$issues = @()
foreach ($i in $parsed) { $issues += ,$i }
Write-Host ('fetched ' + $issues.Count + ' issues')

$rows = foreach ($i in $issues) {
    # an [ACTIVE] claim prefix is the documented concurrency lock (see the legend below), so a claimed
    # issue keeps its tracker row while it is being worked: match it past, not around
    if ($i.title -notmatch '^(?:\[ACTIVE\]\s*)?\[TECHTOOL-(\d{3})\]\s*(.*)$') { continue }
    # capture these before any further -match call overwrites $Matches
    $n = [int]$Matches[1]
    $text = $Matches[2].Trim()
    $owner = 'agent'; $section = ''; $note = ''
    if ($i.body -match '(?m)^\*\*Owner:\*\*\s*(.+?)\s*$') { $owner = $Matches[1].Trim() }
    if ($i.body -match '(?m)^\*\*Section:\*\*\s*(.+?)\s*$') { $section = $Matches[1].Trim() }
    if ($i.body -match '(?m)^Note:\s*(.+?)\s*$') { $note = $Matches[1].Trim() }
    [pscustomobject]@{
        N      = $n
        Text   = $text
        Owner  = $owner
        Section = $section
        Note   = $note
        Issue  = [int]$i.number
        Done   = ($i.state -eq 'CLOSED')
    }
}

$rows = @($rows | Sort-Object N)
if ($rows.Count -ne 104) { throw ('expected 104 tracker issues, got ' + $rows.Count) }
for ($k = 0; $k -lt 104; $k++) {
    if ($rows[$k].N -ne ($k + 1)) { throw ('move numbering gap at index ' + $k + ' (got ' + $rows[$k].N + ')') }
}

$order = @(
    'Start here (highest leverage)',
    'A. Quality and trust (11-24)',
    'B. Real-device validation (25-38)',
    'C. Installer integrity (39-48)',
    'D. Signing and release (49-58)',
    'E. Hub and call-home agent (59-78)',
    'F. Remote assist (79-82)',
    'G. Client and dropship workflows (83-90)',
    'H. Sensitive data (91-96)',
    'I. Supportability and docs (97-104)'
)

$sb = New-Object System.Text.StringBuilder
function Add-Line([string]$l) { [void]$script:sb.AppendLine($l) }

Add-Line '# DE Tech Tool - 104-move tracker'
Add-Line ''
Add-Line 'Status board for the sequenced 104-move plan for **DE Tech Tool** (the `windows/` tree in this repo). Every move below is a GitHub issue; this file is the index that keeps them in plan order.'
Add-Line ''
Add-Line '> **[DE-TECH-TOOL-ARCHITECTURE.md](DE-TECH-TOOL-ARCHITECTURE.md) stays the live done/open board for the roadmap** (move 103). This tracker is the execution checklist underneath it.'
Add-Line ''
Add-Line '## How to use it'
Add-Line ''
Add-Line '- **Pick work from the top.** Moves 1-10 are ordered by leverage and several gate later sections; the sections after that are not a strict sequence within themselves.'
Add-Line '- **Closing the issue ticks the box.** This file is generated from GitHub: an open issue renders `- [ ]`, a closed one `- [x]`. Never edit a checkbox by hand - close (or reopen) the issue and re-run the generator.'
Add-Line '- **The issue carries the detail**, the PR links and the decisions. Do not add detail to this file.'
Add-Line '- **Ownership is fixed at capture.** `Joe` marks the moves that need Joe''s decision, access or hardware. Everything else an agent can do unaided.'
Add-Line '- **These are backlog items, not work locks.** They carry the `backlog` label and a `[TECHTOOL-nnn]` title prefix. Under `docs/ACTIVE-WORK-COORDINATION.md`, an open issue is a concurrency lock only once someone claims it and prefixes its title `[ACTIVE]`.'
Add-Line ''
Add-Line '## Legend'
Add-Line ''
Add-Line '| Marker | Meaning |'
Add-Line '|---|---|'
Add-Line '| `- [ ]` | Open |'
Add-Line '| `- [x]` | Done (its issue is closed) |'
Add-Line '| `Joe` | Needs Joe: a decision, account access, or physical hardware |'
Add-Line '| `agent` | Any DE AI agent can complete it unaided |'
Add-Line '| `agent + Joe` | Agent writes it, Joe runs it |'
Add-Line '| *note* | Blocking or overlap detail captured when the plan was written |'
Add-Line ''
Add-Line '## Plan documents'
Add-Line ''
Add-Line 'Written while working through the plan. Each gates a section of it:'
Add-Line ''
Add-Line '| Document | Move | What it governs |'
Add-Line '|---|---|---|'
Add-Line '| [AUDIT-MODE-CHECKLIST.md](AUDIT-MODE-CHECKLIST.md) | 5 | Validating on a real DE Windows laptop in audit mode (roadmap step 3). Feeds move 25. |'
Add-Line '| [INSTALLER-TRUST-POLICY.md](INSTALLER-TRUST-POLICY.md) | 6 | Trust rules for every installer the tool downloads or runs. Gates all of section C. |'
Add-Line '| [AGENT-THREAT-MODEL.md](AGENT-THREAT-MODEL.md) | 73 | STRIDE threat model and the per-job-type enable/deny rules for the call-home agent. Gates all of section E. |'
Add-Line ''
Add-Line '## Blocked and gated moves'
Add-Line ''
Add-Line 'These are the dependencies worth knowing before picking anything up:'
Add-Line ''
Add-Line '| Move | Blocked by | Why |'
Add-Line '|---|---|---|'
Add-Line '| 49-58 (D. Signing and release) | **7** | No signing until the code-signing certificate exists. It is the longest lead item - order it first. |'
Add-Line '| 41 | **48** | Cannot implement the no-hash policy before Joe decides the outcome. |'
Add-Line '| 79-82 (F. Remote assist) | **8** | No adapter work until JumpCloud Remote Assist access and licensing are confirmed. |'
Add-Line '| 93 | **9** | Retention cannot be applied until DE sets the retention periods (G8). |'
Add-Line '| 39-48 (C. Installer integrity) | **6** | Hash work starts only after the installer-trust policy is confirmed in writing. |'
Add-Line '| 25 | **5** | The real-laptop run follows the audit-mode checklist. |'
Add-Line '| 59-78 (E. Hub and call-home agent) | **73** | No job type is enabled before the agent threat model exists. |'
Add-Line '| 19 / 104 | each other | Both retire compatibility names/aliases. Keep one canonical issue and cross-link. |'
Add-Line ''
Add-Line '## Summary'
Add-Line ''
Add-Line '| Section | Moves | Done | Open | Needs Joe |'
Add-Line '|---|---|---|---|---|'

foreach ($sec in $order) {
    $g = @($rows | Where-Object { $_.Section -eq $sec })
    $done = @($g | Where-Object { $_.Done }).Count
    $joe = @($g | Where-Object { $_.Owner -like '*Joe*' }).Count
    Add-Line ('| ' + $sec + ' | ' + $g.Count + ' | ' + $done + ' | ' + ($g.Count - $done) + ' | ' + $joe + ' |')
}
$allDone = @($rows | Where-Object { $_.Done }).Count
$allJoe = @($rows | Where-Object { $_.Owner -like '*Joe*' }).Count
Add-Line ('| **Total** | **' + $rows.Count + '** | **' + $allDone + '** | **' + ($rows.Count - $allDone) + '** | **' + $allJoe + '** |')
Add-Line ''
Add-Line '## The moves'
Add-Line ''

foreach ($sec in $order) {
    Add-Line ('### ' + $sec)
    Add-Line ''
    foreach ($r in @($rows | Where-Object { $_.Section -eq $sec })) {
        $box = if ($r.Done) { 'x' } else { ' ' }
        $ownerTag = if ($r.Owner -like '*Joe*') { '**' + $r.Owner + '**' } else { '`' + $r.Owner + '`' }
        $url = 'https://github.com/' + $Repo + '/issues/' + $r.Issue
        Add-Line ('- [' + $box + '] **' + $r.N + '** ' + $r.Text + ' ' + $ownerTag + ' - [#' + $r.Issue + '](' + $url + ')')
        if ($r.Note) { Add-Line ('  - *' + $r.Note + '*') }
    }
    Add-Line ''
}

Add-Line '---'
Add-Line ''
Add-Line ('Generated by `scripts/build-techtool-tracker.ps1` from the `[TECHTOOL-nnn]` issues on https://github.com/' + $Repo + '. Close an issue to tick its box, then re-run the generator.')

$content = $sb.ToString()
if ($PSCmdlet.ShouldProcess($OutFile, 'write tracker')) {
    Set-Content -Path $OutFile -Value $content -Encoding utf8
    Write-Host ('wrote ' + $OutFile)
} else {
    Write-Host $content
}
