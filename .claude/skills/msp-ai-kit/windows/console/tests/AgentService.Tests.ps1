# Move 68: "Build the Windows service skeleton, with no actions yet" (#786).
#
# The skeleton is deliberately small, so the suite pins what it must never become before it grows:
#   - its state directory is SYSTEM and Administrators only, and the agent refuses to run on state anyone else can touch;
#   - it has no actions: no handler exists and every action is refused;
#   - it is outbound-only: no listener, socket, pipe, firewall rule or web call exists in the agent tree;
#   - the loop is idle, survives a bad pass, and stops promptly when told;
#   - the service host really works: built from source and run in --console mode it starts its child, hands it the stop
#     file, stops it on request and exits cleanly, restarts a child that dies (with back-off), and with its DEFAULT
#     execution policy (AllSigned) an unsigned script does not run.
# Installing the service is move 72; nothing here registers one.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

BeforeDiscovery {
    # the state directory is locked to SYSTEM and Administrators, so a NON-elevated administrator cannot read back what it just made:
    # those cases need an elevated session (CI's runner is one; the service runs as SYSTEM)
    $elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

Describe 'The DE Tech Agent service skeleton: no actions, locked-down state, a host that stops cleanly' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:AgentDir = Join-Path $script:Win 'agent'
        Import-Module (Join-Path $script:AgentDir 'DE.AgentService.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-agent-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        function script:Wait-DEFor { param([scriptblock]$Condition, [int]$Seconds = 30) $end = (Get-Date).AddSeconds($Seconds); while ((Get-Date) -lt $end) { if (& $Condition) { return $true }; Start-Sleep -Milliseconds 200 }; return [bool](& $Condition) }
    }
    AfterAll { Get-Process -Name 'DETechAgentHost' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue; Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'the state directory is SYSTEM and Administrators only' {
        It 'lays out its directories under the root, and defaults to ProgramData' {
            $p = Get-DEAgentPaths -Root (Join-Path $script:Work 'layout')
            $p.Trust | Should -Be (Join-Path $p.Root 'trust')
            $p.JobKeys | Should -Be (Join-Path $p.Root 'trust\job-keys.json')
            $p.Replay | Should -Be (Join-Path $p.Root 'state\nonces.txt')
            (Get-DEAgentPaths).Root | Should -Match 'DE\\TechAgent$'
            (Get-DEAgentPaths).Root | Should -Match ([regex]::Escape([Environment]::GetFolderPath('CommonApplicationData')))
        }
        It 'creates the state and leaves nobody else with any right' -Skip:(-not $elevated) {
            $root = Join-Path $script:Work 'state-a'
            $p = Initialize-DEAgentState -Root $root
            foreach ($d in @($p.Root, $p.Logs, $p.Trust, $p.Identity, $p.State)) { Test-Path -LiteralPath $d | Should -Be $true }
            (@(Test-DEAgentStateAcl -Root $root) -join '; ') | Should -BeNullOrEmpty
            $acl = (Get-Item -LiteralPath $root).GetAccessControl()
            $acl.AreAccessRulesProtected | Should -Be $true -Because 'it must not inherit permissions from its parent'
            $sids = @($acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier]) | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique)
            ($sids -join ',') | Should -Be 'S-1-5-18,S-1-5-32-544'
        }
        It 'notices when someone else is given a right, and repairs it on the next initialise' -Skip:(-not $elevated) {
            $root = Join-Path $script:Work 'state-b'
            $null = Initialize-DEAgentState -Root $root
            $acl = (Get-Item -LiteralPath $root).GetAccessControl()
            $users = New-Object Security.Principal.SecurityIdentifier 'S-1-5-32-545'
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($users, 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
            (Get-Item -LiteralPath $root).SetAccessControl($acl)
            (@(Test-DEAgentStateAcl -Root $root) -join '; ') | Should -Match 'S-1-5-32-545' -Because 'the Users group must not be able to read the agent state'
            $null = Initialize-DEAgentState -Root $root
            (@(Test-DEAgentStateAcl -Root $root) -join '; ') | Should -BeNullOrEmpty
        }
        It 'reports a missing directory rather than calling it safe' {
            (@(Test-DEAgentStateAcl -Root (Join-Path $script:Work 'never-made')) -join '; ') | Should -Match 'does not exist'
        }
    }

    Context 'there are no actions, and nothing listens' {
        It 'has no action handlers and refuses every action' {
            @(Get-DEAgentActionHandlers).Count | Should -Be 0
            $r = Invoke-DEAgentAction -ActionId 'net.time'
            $r.Ok | Should -Be $false
            $r.Code | Should -Be 'no_actions_implemented'
        }
        It 'the agent tree opens no listener, socket, pipe or firewall rule, and makes no web call (outbound-only)' {
            $files = @(Get-ChildItem -Path $script:AgentDir -File | Where-Object { $_.Extension -in @('.ps1', '.psm1') })
            $files.Count | Should -BeGreaterThan 1
            $bad = New-Object System.Collections.Generic.List[string]
            foreach ($f in $files) {
                $hit = Select-String -LiteralPath $f.FullName -Pattern 'TcpListener|HttpListener|UdpClient|System\.Net\.Sockets|NamedPipeServerStream|New-NetFirewallRule|netsh\b|Invoke-WebRequest|Invoke-RestMethod|Invoke-Expression|\biex\b' | Select-Object -First 1
                if ($hit) { $bad.Add("$($f.Name):$($hit.LineNumber)") }
            }
            ($bad -join ', ') | Should -BeNullOrEmpty
        }
    }

    Context 'the loop is idle, survives a bad pass, and stops promptly' {
        It 'reports unenrolled, then enrolled_idle once an identity exists, and runs no actions either way' -Skip:(-not $elevated) {
            $root = Join-Path $script:Work 'tick-a'
            $p = Initialize-DEAgentState -Root $root
            $t = Invoke-DEAgentTick -Root $root
            $t.State | Should -Be 'unenrolled'
            $t.ActionsRun | Should -Be 0
            Set-Content -LiteralPath (Join-Path $p.Identity 'device.json') -Value '{}'
            (Invoke-DEAgentTick -Root $root).State | Should -Be 'enrolled_idle'
        }
        It 'refuses to carry on when its state is not safe' -Skip:(-not $elevated) {
            $root = Join-Path $script:Work 'tick-b'
            $null = Initialize-DEAgentState -Root $root
            $acl = (Get-Item -LiteralPath $root).GetAccessControl()
            $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier 'S-1-1-0'), 'Read', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
            (Get-Item -LiteralPath $root).SetAccessControl($acl)
            $t = Invoke-DEAgentTick -Root $root
            $t.State | Should -Be 'state_unsafe'
            @($t.Problems).Count | Should -BeGreaterThan 0
            $t.ActionsRun | Should -Be 0
        }
        It 'runs the requested number of passes' -Skip:(-not $elevated) {
            $root = Join-Path $script:Work 'loop-a'
            $null = Initialize-DEAgentState -Root $root
            (Start-DEAgentLoop -Root $root -IntervalSeconds 0 -MaxTicks 3) | Should -Be 3
        }
        It 'one failing pass is logged and the loop carries on' {
            $script:Calls = 0
            $ticks = Start-DEAgentLoop -IntervalSeconds 0 -MaxTicks 4 -WarningAction SilentlyContinue -TickScript { $script:Calls++; if ($script:Calls -eq 2) { throw 'a bad pass' } }
            $ticks | Should -Be 4
            $script:Calls | Should -Be 4
        }
        It 'does not start when the stop file already exists, and stops within seconds when it appears mid-wait' {
            $stop = Join-Path $script:Work 'stop-early.txt'; Set-Content -LiteralPath $stop -Value 'stop'
            (Start-DEAgentLoop -StopFile $stop -IntervalSeconds 30 -TickScript { }) | Should -Be 0
            $stop2 = Join-Path $script:Work 'stop-late.txt'
            $sw = [Diagnostics.Stopwatch]::StartNew()
            $n = Start-DEAgentLoop -StopFile $stop2 -IntervalSeconds 30 -TickScript { Set-Content -LiteralPath $stop2 -Value 'stop' }
            $sw.Stop()
            $n | Should -Be 1
            $sw.Elapsed.TotalSeconds | Should -BeLessThan 5 -Because 'a 30 second interval must not delay a stop'
        }
    }

    Context 'the service host, built from source' {
        BeforeAll {
            $script:HostDir = Join-Path $script:Work 'host'
            $script:HostExe = New-DEAgentServiceHost -OutputPath (Join-Path $script:HostDir 'DETechAgentHost.exe')
            function script:Start-TestHost {
                param([string]$ScriptText, [string]$Policy = 'Bypass')
                Get-Process -Name 'DETechAgentHost' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
                Remove-Item -LiteralPath (Join-Path $script:HostDir 'agent.stop') -Force -ErrorAction SilentlyContinue
                $s = Join-Path $script:HostDir ('child-' + [guid]::NewGuid().ToString('N') + '.ps1')
                [IO.File]::WriteAllText($s, $ScriptText)
                Set-DEAgentHostConfig -HostDirectory $script:HostDir -Script $s -ExecutionPolicy $Policy
                return (Start-Process -FilePath $script:HostExe -ArgumentList '--console' -PassThru -WindowStyle Hidden)
            }
        }
        It 'builds an executable' {
            Test-Path -LiteralPath $script:HostExe | Should -Be $true
            (Get-Item -LiteralPath $script:HostExe).Length | Should -BeGreaterThan 2000
        }
        It 'writes AllSigned as the default execution policy, so a release build runs only signed scripts' {
            Set-DEAgentHostConfig -HostDirectory $script:HostDir -Script 'C:\x.ps1'
            (Get-Content -LiteralPath (Join-Path $script:HostDir 'agent-host.conf') -Raw) | Should -Match 'executionPolicy=AllSigned'
        }
        It 'starts its child with the stop file, stops it on request, and exits cleanly' {
            $marker = Join-Path $script:Work 'marker-a.txt'
            $child = "param([string]`$StopFile)`r`nSet-Content -LiteralPath '$marker' -Value ""`$PID|`$StopFile""`r`nwhile (-not (Test-Path -LiteralPath `$StopFile)) { Start-Sleep -Milliseconds 200 }`r`n"
            $h = Start-TestHost -ScriptText $child
            (Wait-DEFor { Test-Path -LiteralPath $marker } 40) | Should -Be $true -Because 'the host must start its child'
            $parts = (Get-Content -LiteralPath $marker -Raw).Trim() -split '\|'
            $parts[1] | Should -Be (Join-Path $script:HostDir 'agent.stop') -Because 'the child is told where the stop file is'
            $childPid = [int]$parts[0]
            Set-Content -LiteralPath (Join-Path $script:HostDir 'agent.stop') -Value 'stop'
            $h.WaitForExit(60000) | Should -Be $true -Because 'the host must exit when told to stop'
            $h.ExitCode | Should -Be 0
            (Wait-DEFor { -not (Get-Process -Id $childPid -ErrorAction SilentlyContinue) } 10) | Should -Be $true -Because 'the child must be gone too'
        }
        It 'restarts a child that dies, with a back-off, and stops cleanly' {
            $counter = Join-Path $script:Work 'starts.txt'
            Remove-Item -LiteralPath $counter -Force -ErrorAction SilentlyContinue
            $child = "param([string]`$StopFile)`r`nAdd-Content -LiteralPath '$counter' -Value (Get-Date).ToString('o')`r`nexit 3`r`n"
            $h = Start-TestHost -ScriptText $child
            (Wait-DEFor { (Test-Path -LiteralPath $counter) -and @(Get-Content -LiteralPath $counter).Count -ge 2 } 60) | Should -Be $true -Because 'a dead child is restarted'
            Set-Content -LiteralPath (Join-Path $script:HostDir 'agent.stop') -Value 'stop'
            $h.WaitForExit(60000) | Should -Be $true
            $stamps = @(Get-Content -LiteralPath $counter | ForEach-Object { [datetime]::Parse($_, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind) })
            ($stamps[1] - $stamps[0]).TotalSeconds | Should -BeGreaterThan 0.9 -Because 'the restart waits at least the first back-off'
        }
        It 'with its default AllSigned policy an unsigned script does not run' {
            $marker = Join-Path $script:Work 'marker-unsigned.txt'
            Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
            $child = "param([string]`$StopFile)`r`nSet-Content -LiteralPath '$marker' -Value 'ran'`r`n"
            $h = Start-TestHost -ScriptText $child -Policy 'AllSigned'
            Start-Sleep -Seconds 6
            Test-Path -LiteralPath $marker | Should -Be $false -Because 'AllSigned must refuse an unsigned script'
            Set-Content -LiteralPath (Join-Path $script:HostDir 'agent.stop') -Value 'stop'
            $h.WaitForExit(60000) | Should -Be $true
        }
    }
}
