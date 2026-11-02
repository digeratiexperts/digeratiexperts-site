param([string]$StopFile, [string]$StateRoot, [int]$IntervalSeconds = 30)
# The script the DE Tech Agent service host supervises (move 68). It loads the agent modules that sit beside it and
# runs the idle loop until the host writes the stop file. The skeleton runs no actions.
$ErrorActionPreference = 'Stop'
Import-Module (Join-Path $PSScriptRoot 'DE.AgentService.psm1') -Force
$null = Initialize-DEAgentState -Root $StateRoot
$null = Start-DEAgentLoop -Root $StateRoot -StopFile $StopFile -IntervalSeconds $IntervalSeconds
