# DE.AgentService: the DE Tech Agent's Windows service skeleton, with NO actions (move 68).
#
# What exists after this move, and nothing more:
#   - a service host (a small ServiceBase executable, built by New-DEAgentServiceHost) that supervises ONE PowerShell
#     child running the agent loop, restarts it with back-off if it dies, and stops it with a stop FILE first and a kill
#     only after a grace period. The host opens no port and no pipe, reads one config file next to itself, and defaults to
#     the AllSigned execution policy, so an unsigned script does not run on a release build;
#   - the agent's state directory, created for SYSTEM and Administrators only (TB4), refused if anyone else has any right;
#   - a loop whose every pass is idle: it checks its own state is safe and reports 'unenrolled'. Invoke-DEAgentAction has no
#     handlers and refuses every action. Enrolment, jobs, heartbeat and evidence are other moves.
# The agent is outbound-only: nothing here listens, and the test suite scans for listeners. Installing the service is move 72.

$script:HostSource = @'
using System;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Threading;

namespace DE.TechAgent
{
    public class AgentHost : ServiceBase
    {
        public const string Name = "DETechAgent";
        Thread worker;
        volatile bool stopping;
        string baseDir;
        string stopFile;
        Process child;
        readonly object gate = new object();

        public AgentHost() { ServiceName = Name; CanStop = true; CanShutdown = true; }

        protected override void OnStart(string[] args) { Begin(); }
        protected override void OnStop() { End(); }
        protected override void OnShutdown() { End(); }

        public void Begin()
        {
            baseDir = AppDomain.CurrentDomain.BaseDirectory;
            stopFile = Path.Combine(baseDir, "agent.stop");
            try { File.Delete(stopFile); } catch (Exception) { }
            stopping = false;
            worker = new Thread(Loop);
            worker.IsBackground = true;
            worker.Start();
        }

        public void End()
        {
            stopping = true;
            try { File.WriteAllText(stopFile, "stop"); } catch (Exception) { }
            if (worker != null) worker.Join(35000);
            lock (gate) { if (child != null && !child.HasExited) { try { child.Kill(); } catch (Exception) { } } }
        }

        static string Setting(string[] lines, string key)
        {
            foreach (string raw in lines)
            {
                string line = raw.Trim();
                if (line.StartsWith("#") || line.Length == 0) continue;
                int eq = line.IndexOf('=');
                if (eq > 0 && line.Substring(0, eq).Trim().Equals(key, StringComparison.OrdinalIgnoreCase)) return line.Substring(eq + 1).Trim();
            }
            return null;
        }

        void Loop()
        {
            int backoff = 1000;
            while (!stopping)
            {
                string conf = Path.Combine(baseDir, "agent-host.conf");
                string script = null, policy = "AllSigned";
                if (File.Exists(conf))
                {
                    string[] lines = File.ReadAllLines(conf);
                    script = Setting(lines, "script");
                    string p = Setting(lines, "executionPolicy");
                    if (!string.IsNullOrEmpty(p)) policy = p;
                }
                if (string.IsNullOrEmpty(script) || !File.Exists(script)) { Thread.Sleep(5000); continue; }
                DateTime started = DateTime.UtcNow;
                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe",
                    "-NoProfile -NonInteractive -ExecutionPolicy " + policy + " -File \"" + script + "\" -StopFile \"" + stopFile + "\"");
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                try
                {
                    lock (gate) { child = Process.Start(psi); }
                    child.WaitForExit();
                }
                catch (Exception) { }
                if (stopping) break;
                if ((DateTime.UtcNow - started).TotalSeconds > 60) backoff = 1000; else backoff = Math.Min(backoff * 2, 60000);
                for (int waited = 0; waited < backoff && !stopping; waited += 250) Thread.Sleep(250);
            }
        }

        public static void Main(string[] args)
        {
            bool console = Environment.UserInteractive;
            foreach (string a in args) { if (a == "--console") console = true; }
            if (console)
            {
                AgentHost host = new AgentHost();
                host.Begin();
                while (!File.Exists(host.stopFile)) Thread.Sleep(200);
                host.End();
            }
            else ServiceBase.Run(new AgentHost());
        }
    }
}
'@

function New-DEAgentServiceHost {
    <# Compiles the service host to -OutputPath (an .exe). Returns the path. The host is the same code the service runs; --console runs it in the foreground for tests and rehearsals. #>
    param([Parameter(Mandatory = $true)][string]$OutputPath)
    $dir = Split-Path -Parent $OutputPath
    if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    Add-Type -TypeDefinition $script:HostSource -OutputAssembly $OutputPath -OutputType ConsoleApplication -ReferencedAssemblies 'System.ServiceProcess' -Language CSharp
    return $OutputPath
}

function Set-DEAgentHostConfig {
    <# Writes the one file the host reads: which script to supervise and under which execution policy (AllSigned unless a rehearsal says otherwise). #>
    param([Parameter(Mandatory = $true)][string]$HostDirectory, [Parameter(Mandatory = $true)][string]$Script, [ValidateSet('AllSigned', 'RemoteSigned', 'Bypass')][string]$ExecutionPolicy = 'AllSigned')
    $lines = @('# DE Tech Agent service host', "script=$Script", "executionPolicy=$ExecutionPolicy")
    [IO.File]::WriteAllText((Join-Path $HostDirectory 'agent-host.conf'), (($lines -join "`r`n") + "`r`n"), (New-Object Text.UTF8Encoding $false))
}

function Get-DEAgentPaths {
    <# Where the agent keeps its state. The default is under ProgramData, which the installer locks down (TB4). #>
    param([string]$Root)
    if (-not $Root) { $Root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'DE\TechAgent' }
    return [pscustomobject]@{
        Root = $Root; Logs = (Join-Path $Root 'logs'); Trust = (Join-Path $Root 'trust'); Identity = (Join-Path $Root 'identity')
        JobKeys = (Join-Path $Root 'trust\job-keys.json'); TimeFloor = (Join-Path $Root 'trust\time-floor.txt'); Replay = (Join-Path $Root 'state\nonces.txt'); State = (Join-Path $Root 'state')
    }
}

function Set-DEAgentStateAcl {
    # SYSTEM and Administrators, full control, inherited, and inheritance from the parent switched off
    param([string]$Path)
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    foreach ($sid in @('S-1-5-18', 'S-1-5-32-544')) {
        $id = New-Object Security.Principal.SecurityIdentifier $sid
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($id, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    (Get-Item -LiteralPath $Path).SetAccessControl($acl)
}

function Test-DEAgentStateAcl {
    <# Problems with who can touch the agent's state: inheritance still on, or any right for anyone but SYSTEM and Administrators. Empty means safe. #>
    param([Parameter(Mandatory = $true)][string]$Root)
    $problems = New-Object System.Collections.Generic.List[string]
    if (-not (Test-Path -LiteralPath $Root)) { $problems.Add('the state directory does not exist'); return $problems.ToArray() }
    $acl = (Get-Item -LiteralPath $Root).GetAccessControl()
    if (-not $acl.AreAccessRulesProtected) { $problems.Add('the directory still inherits permissions from its parent') }
    $allowed = @('S-1-5-18', 'S-1-5-32-544')
    foreach ($rule in $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])) {
        if ($allowed -notcontains $rule.IdentityReference.Value) { $problems.Add("$($rule.IdentityReference.Value) holds $($rule.FileSystemRights) ($($rule.AccessControlType))") }
    }
    return $problems.ToArray()
}

function Initialize-DEAgentState {
    <# Creates the state directories and locks the root to SYSTEM and Administrators. Throws if it cannot make them safe: an agent never runs with state anyone can read. Run it as SYSTEM or elevated: a non-elevated administrator is locked out of what it just made. #>
    param([string]$Root)
    $p = Get-DEAgentPaths -Root $Root
    foreach ($d in @($p.Root, $p.Logs, $p.Trust, $p.Identity, $p.State)) { if (-not (Test-Path -LiteralPath $d)) { New-Item -ItemType Directory -Path $d -Force | Out-Null } }
    Set-DEAgentStateAcl -Path $p.Root
    $bad = @(Test-DEAgentStateAcl -Root $p.Root)
    if ($bad.Count) { throw "the agent's state directory is not safe: $($bad -join '; ')" }
    return $p
}

function Get-DEAgentActionHandlers {
    <# The actions this agent can run. None, by design, until the moves that add them (and the threat model's checklist) are met. Emits nothing: callers wrap the call in @(). #>
    return @()
}

function Invoke-DEAgentAction {
    <# Refuses every action. There is no code path in this skeleton that runs one. #>
    param([Parameter(Mandatory = $true)][string]$ActionId)
    return [pscustomobject]@{ Ok = $false; Code = 'no_actions_implemented'; Why = "the agent skeleton has no handler for '$ActionId'" }
}

function Invoke-DEAgentTick {
    <# One pass of the loop. It checks its own state is safe and reports where the agent stands. It makes no network call and runs no action. #>
    param([string]$Root)
    $p = Get-DEAgentPaths -Root $Root
    $bad = @(Test-DEAgentStateAcl -Root $p.Root)
    if ($bad.Count) { return [pscustomobject]@{ State = 'state_unsafe'; Problems = $bad; ActionsRun = 0 } }
    $enrolled = Test-Path -LiteralPath (Join-Path $p.Identity 'device.json')
    return [pscustomobject]@{ State = $(if ($enrolled) { 'enrolled_idle' } else { 'unenrolled' }); Problems = @(); ActionsRun = 0 }
}

function Start-DEAgentLoop {
    <# The loop the service host supervises: tick, wait, until the stop file appears (or -MaxTicks, for tests). One bad pass is logged and the loop carries on. Returns the number of ticks. #>
    param([string]$Root, [string]$StopFile, [int]$IntervalSeconds = 30, [int]$MaxTicks = 0, [scriptblock]$TickScript)
    $ticks = 0
    while ($true) {
        if ($StopFile -and (Test-Path -LiteralPath $StopFile)) { break }
        try { if ($TickScript) { $null = & $TickScript } else { $null = Invoke-DEAgentTick -Root $Root } } catch { Write-Warning "agent tick failed: $($_.Exception.Message)" }
        $ticks++
        if ($MaxTicks -gt 0 -and $ticks -ge $MaxTicks) { break }
        for ($waited = 0.0; $waited -lt $IntervalSeconds; $waited += 0.25) {
            if ($StopFile -and (Test-Path -LiteralPath $StopFile)) { break }
            Start-Sleep -Milliseconds 250
        }
    }
    return $ticks
}

Export-ModuleMember -Function New-DEAgentServiceHost, Set-DEAgentHostConfig, Get-DEAgentPaths, Test-DEAgentStateAcl, Initialize-DEAgentState, Get-DEAgentActionHandlers, Invoke-DEAgentAction, Invoke-DEAgentTick, Start-DEAgentLoop
