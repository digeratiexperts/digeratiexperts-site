#requires -Version 7.0
[CmdletBinding()]
param(
    [string]$Repo = 'digeratiexperts/digeratiexperts-site',
    [int]$Issue = 215,
    [int]$PollSeconds = 15,
    [string]$AllowedRoot = (Join-Path $HOME 'DE\Repos'),
    [string]$StatePath = (Join-Path $HOME 'DE\.cursor-bridge-state.json'),
    [switch]$Once
)

$ErrorActionPreference = 'Stop'

function Require-Command {
    param([Parameter(Mandatory)][string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found in PATH."
    }
}

function Save-State {
    param([hashtable]$State)
    $dir = Split-Path -Parent $StatePath
    if ($dir -and -not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $State | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $StatePath -Encoding utf8
}

function Load-State {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return @{ processed = @{} }
    }
    $raw = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json -AsHashtable
    if (-not $raw.processed) { $raw.processed = @{} }
    return $raw
}

function Get-IssueComments {
    $json = & gh api --paginate --slurp "repos/$Repo/issues/$Issue/comments?per_page=100"
    if ($LASTEXITCODE -ne 0) { throw "gh api failed while reading issue comments." }
    $pages = $json | ConvertFrom-Json
    $all = @()
    foreach ($page in $pages) { foreach ($item in $page) { $all += $item } }
    return $all | Sort-Object id
}

function Parse-Bool {
    param([string]$Value, [bool]$Default = $false)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $Default }
    switch ($Value.Trim().ToLowerInvariant()) {
        'true' { return $true }
        'yes' { return $true }
        '1' { return $true }
        'false' { return $false }
        'no' { return $false }
        '0' { return $false }
        default { return $Default }
    }
}

function Parse-Task {
    param([Parameter(Mandatory)][string]$Body)
    $lines = $Body -split "`r?`n"
    if ($lines.Count -eq 0 -or $lines[0].Trim() -ne 'CURSOR_TASK_V1') { return $null }

    $fields = @{}
    $promptLines = New-Object System.Collections.Generic.List[string]
    $inPrompt = $false

    foreach ($line in $lines[1..($lines.Count - 1)]) {
        if ($line -eq 'PROMPT:') { $inPrompt = $true; continue }
        if ($line -eq 'END_TASK') { break }
        if ($inPrompt) { $promptLines.Add($line); continue }
        if ($line -match '^([A-Z_]+):\s*(.*)$') { $fields[$matches[1]] = $matches[2].Trim() }
    }

    if (-not $fields.TASK_ID) { throw 'Task is missing TASK_ID.' }
    if (-not $fields.WORKSPACE) { throw "Task $($fields.TASK_ID) is missing WORKSPACE." }
    if ($promptLines.Count -eq 0) { throw "Task $($fields.TASK_ID) has an empty PROMPT." }

    return @{
        TaskId      = [string]$fields.TASK_ID
        Repo        = [string]$fields.REPO
        Workspace   = [string]$fields.WORKSPACE
        Mode        = if ($fields.MODE) { [string]$fields.MODE } else { 'agent' }
        AllowWrite  = Parse-Bool $fields.ALLOW_WRITE $false
        AllowPush   = Parse-Bool $fields.ALLOW_PUSH $false
        AllowMerge  = Parse-Bool $fields.ALLOW_MERGE $false
        AllowDeploy = Parse-Bool $fields.ALLOW_DEPLOY $false
        Prompt      = ($promptLines -join "`n").Trim()
    }
}

function Resolve-SafeWorkspace {
    param([Parameter(Mandatory)][string]$Workspace)
    $root = [IO.Path]::GetFullPath($AllowedRoot).TrimEnd('\','/')
    $path = [IO.Path]::GetFullPath($Workspace).TrimEnd('\','/')
    $rootPrefix = $root + [IO.Path]::DirectorySeparatorChar

    if (-not $path.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase) -and
        -not $path.Equals($root, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Workspace is outside allowed root '$root': $path"
    }
    if (-not (Test-Path -LiteralPath $path)) { throw "Workspace does not exist: $path" }
    if (-not (Test-Path -LiteralPath (Join-Path $path '.git'))) { throw "Not a Git repo/worktree: $path" }
    return $path
}

function Post-Result {
    param(
        [string]$TaskId,
        [string]$Status,
        [string]$Head,
        [string]$WorktreeState,
        [string]$Tests,
        [string]$Summary
    )
    if ($Summary.Length -gt 14000) { $Summary = $Summary.Substring(0, 14000) + "`n...[truncated]" }
    $body = @"
CURSOR_RESULT_V1
TASK_ID: $TaskId
STATUS: $Status
HEAD: $Head
WORKTREE: $WorktreeState
TESTS: $Tests
SUMMARY:
$Summary
END_RESULT
"@
    & gh api "repos/$Repo/issues/$Issue/comments" -f "body=$body" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Failed to post result for $TaskId." }
}

function Invoke-CursorTask {
    param([Parameter(Mandatory)][hashtable]$Task)

    $workspace = Resolve-SafeWorkspace $Task.Workspace
    $mode = $Task.Mode.ToLowerInvariant()
    if (-not $Task.AllowWrite) { $mode = 'ask' }
    if ($mode -notin @('agent','ask','plan')) { $mode = 'agent' }

    $policy = @"
DE AGENT BUS EXECUTION POLICY
TASK_ID: $($Task.TaskId)
ALLOW_WRITE: $($Task.AllowWrite)
ALLOW_PUSH: $($Task.AllowPush)
ALLOW_MERGE: $($Task.AllowMerge)
ALLOW_DEPLOY: $($Task.AllowDeploy)

Hard rules:
- Work only inside the supplied workspace.
- Do not print, read, copy, or expose secrets, passwords, tokens, .env contents, or production credentials.
- Do not mutate production systems, production databases, live accounts, infrastructure, DNS, or deployed services.
- Do not delete destructive data or rewrite protected branch history.
- If ALLOW_WRITE=false, make no file changes.
- If ALLOW_PUSH=false, do not push or create/update remote branches/PRs.
- If ALLOW_MERGE=false, do not merge.
- If ALLOW_DEPLOY=false, do not deploy/restart/release.
- Preserve unrelated work. Do not stash/reset/overwrite another agent's changes.
- Before editing, inspect git status and current branch/worktree.
- At completion report exact HEAD, changed files, tests/typechecks/builds run, failures, and whether the worktree is clean.
- If the requested work conflicts with these gates, stop and report BLOCKED instead of bypassing them.

TASK:
$($Task.Prompt)
"@

    $agentArgs = @('-p', $policy, '--output-format', 'text', '--sandbox', 'enabled')
    if ($mode -eq 'ask') { $agentArgs += '--mode=ask' }
    if ($mode -eq 'plan') { $agentArgs += '--mode=plan' }

    Push-Location $workspace
    try {
        $beforeHead = (& git rev-parse HEAD 2>$null | Out-String).Trim()
        $beforeStatus = (& git status --porcelain 2>$null | Out-String).Trim()

        $output = (& agent @agentArgs 2>&1 | Out-String)
        $exitCode = $LASTEXITCODE

        $afterHead = (& git rev-parse HEAD 2>$null | Out-String).Trim()
        if (-not $afterHead) { $afterHead = 'n/a' }
        $afterStatus = (& git status --porcelain 2>$null | Out-String).Trim()
        $worktreeState = if ([string]::IsNullOrWhiteSpace($afterStatus)) { 'clean' } else { 'dirty' }

        $summary = @"
Cursor CLI exit code: $exitCode
Mode: $mode
Workspace: $workspace
HEAD before: $beforeHead
HEAD after: $afterHead
Worktree before:
$beforeStatus

Worktree after:
$afterStatus

Cursor output:
$output
"@
        return @{
            Status = if ($exitCode -eq 0) { 'completed' } else { 'failed' }
            Head = $afterHead
            Worktree = $worktreeState
            Tests = 'See Cursor output / task evidence'
            Summary = $summary
        }
    }
    finally { Pop-Location }
}

Require-Command gh
Require-Command agent

$login = (& gh api user --jq .login | Out-String).Trim()
if (-not $login) { throw 'Unable to determine authenticated GitHub identity.' }

Write-Host "DE Cursor Bridge"
Write-Host "GitHub identity : $login"
Write-Host "Bus             : $Repo issue #$Issue"
Write-Host "Allowed root    : $AllowedRoot"
Write-Host "State           : $StatePath"
Write-Host "Poll interval   : $PollSeconds sec"
Write-Host ""

$state = Load-State

do {
    try {
        $comments = Get-IssueComments
        foreach ($comment in $comments) {
            $id = [string]$comment.id
            $author = [string]$comment.user.login
            $body = [string]$comment.body

            if ($state.processed.ContainsKey($id)) { continue }
            if ($author -ne $login) { continue }
            if (-not $body.TrimStart().StartsWith('CURSOR_TASK_V1')) { continue }

            $state.processed[$id] = @{
                status = 'started'
                task_id = ''
                started_at = (Get-Date).ToString('o')
            }
            Save-State $state

            try {
                $task = Parse-Task $body
                if ($null -eq $task) { continue }
                $state.processed[$id].task_id = $task.TaskId
                Save-State $state

                Write-Host "[$(Get-Date -Format s)] Running $($task.TaskId)"
                $result = Invoke-CursorTask $task

                Post-Result -TaskId $task.TaskId -Status $result.Status -Head $result.Head `
                    -WorktreeState $result.Worktree -Tests $result.Tests -Summary $result.Summary

                $state.processed[$id].status = 'finished'
                $state.processed[$id].finished_at = (Get-Date).ToString('o')
                Save-State $state
                Write-Host "[$(Get-Date -Format s)] Finished $($task.TaskId): $($result.Status)"
            }
            catch {
                $message = $_.Exception.Message
                Write-Warning "Task comment $id failed: $message"
                try {
                    $taskId = if ($state.processed[$id].task_id) { $state.processed[$id].task_id } else { "comment-$id" }
                    Post-Result -TaskId $taskId -Status 'failed' -Head 'n/a' -WorktreeState 'n/a' `
                        -Tests 'not run' -Summary "Bridge error: $message"
                } catch {
                    Write-Warning "Could not post failure result: $($_.Exception.Message)"
                }
                $state.processed[$id].status = 'failed'
                $state.processed[$id].finished_at = (Get-Date).ToString('o')
                Save-State $state
            }
        }
    }
    catch { Write-Warning "Bridge polling error: $($_.Exception.Message)" }

    if (-not $Once) { Start-Sleep -Seconds $PollSeconds }
}
while (-not $Once)
