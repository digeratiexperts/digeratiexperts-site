# Move 18: "Drift check: exported module functions against the docs" (#736).
#
# The docs tell operators which command to run; the modules decide what exists. Drift between them
# is a dead command in someone's hands. This check resolves every DE-named name the docs mention
# (Verb-DEName tokens across windows/**/*.md) against the real surface:
#
#   1. exported by a module  - defined in a .psm1 or a .ps1 it dot-sources, and covered by that
#      module's Export-ModuleMember patterns (DE.Core's *-DE* wildcard honoured), or
#   2. an artifact file      - a product .ps1/.psm1/.cmd/.bat basename (Start-DETechTool.cmd,
#      Install-DETechConsole.ps1, packaging\New-DEDropshipKit.ps1 ...), or
#   3. planned, allowlisted  - named by a doc whose move has not been built yet. The allowlist is a
#      ratchet: an entry that resolves as (1) or (2) must be removed, so the list cannot rot.
#
# Direction matters. Every export being documented would demand a 500-function reference the
# operator docs never promised - the failure mode this prevents is the opposite one: the docs
# telling a technician to run something that is not there (a rename, a removal, a plan that never
# got built). Each failure names the doc and the name, so the fix is obvious.
#
# The last Context proves the detector itself works: a name that resolves nowhere must be caught.
# Without that, a broken resolver would pass this file silently.

Describe 'Exported module functions and the docs do not drift apart' {
    BeforeAll {
        $script:Win = Split-Path -Parent $PSScriptRoot    # windows/
        $script:Kit = Split-Path -Parent $script:Win      # msp-ai-kit/

        # names whose docs entry is a plan that is not built yet: name -> who builds it
        $script:Planned = @{
            'Run-DEHubJobs' = 'moves 59-78 (E. Hub and call-home agent): the job-runner entry GO-LIVE.md orders; DE-HubWorker.ps1 carries the loop it will call'
        }

        function script:Get-DEExportSurface {
            <# Every name a module actually exposes: functions it defines (or dot-sources) that its
               Export-ModuleMember patterns cover. Returns @{ Name = module } for the whole tree. #>
            $surface = @{}
            $modules = @(Get-ChildItem -Path $script:Win -Recurse -Filter '*.psm1' -File | Where-Object { $_.FullName -notmatch '[\\/]tests[\\/]' })
            foreach ($m in $modules) {
                $text = [IO.File]::ReadAllText($m.FullName)
                $defined = @{}
                foreach ($fn in [regex]::Matches($text, '(?im)^\s*function\s+([A-Za-z][\w-]*)')) { $defined[$fn.Groups[1].Value] = $true }
                foreach ($dot in [regex]::Matches($text, '^\s*\.\s+\(Join-Path\s+\S+\s+''([^'']+)''\)', 'Multiline')) {
                    $child = Join-Path $m.DirectoryName $dot.Groups[1].Value
                    if (Test-Path -LiteralPath $child) {
                        foreach ($fn in [regex]::Matches([IO.File]::ReadAllText($child), '(?im)^\s*function\s+([A-Za-z][\w-]*)')) { $defined[$fn.Groups[1].Value] = $true }
                    }
                }
                $patterns = @()
                foreach ($em in [regex]::Matches($text, '(?im)^\s*Export-ModuleMember\s+-Function\s+')) {
                    # a trailing comma continues the statement onto the next line (PowerShell expression
                    # continuation), so collect lines until one does not end with a comma
                    $lines = $text.Substring($em.Index + $em.Length) -split "\r?\n"
                    $buf = @()
                    foreach ($ln in $lines) { $buf += $ln; if ($ln.TrimEnd() -notmatch ',$') { break } }
                    $patterns += @((($buf -join ' ') -split ',') | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
                }
                foreach ($name in $defined.Keys) {
                    $ok = $false
                    foreach ($p in $patterns) { if ($name -like $p) { $ok = $true; break } }
                    if ($ok -and -not $surface.ContainsKey($name)) { $surface[$name] = $m.Name }
                }
            }
            return $surface
        }

        function script:Get-DEArtifactNames {
            <# File basenames minus extension: the docs also name launchers and installers. #>
            $names = @{}
            foreach ($f in @(Get-ChildItem -Path $script:Win -Recurse -File | Where-Object { $_.FullName -notmatch '[\\/]tests[\\/]' -and $_.Extension -in @('.ps1', '.psm1', '.cmd', '.bat') })) {
                $names[$f.BaseName] = $f.Name
            }
            return $names
        }

        function script:Find-DEDocDeadNames {
            <# Every DE-named token in the docs that resolves nowhere. Returns name -> first doc. #>
            param([string[]]$SearchRoots = @($script:Win))
            $surface = Get-DEExportSurface
            $artifacts = Get-DEArtifactNames
            $dead = @{}
            foreach ($root in $SearchRoots) {
                foreach ($d in @(Get-ChildItem -Path $root -Recurse -Filter '*.md' -File)) {
                    $t = [IO.File]::ReadAllText($d.FullName)
                    foreach ($n in [regex]::Matches($t, '\b[A-Za-z]+-DE[A-Za-z]+\b')) {
                        $v = $n.Value
                        if ($surface.ContainsKey($v) -or $artifacts.ContainsKey($v) -or $script:Planned.ContainsKey($v)) { continue }
                        if (-not $dead.ContainsKey($v)) { $dead[$v] = $d.Name }
                    }
                }
            }
            return $dead
        }
    }

    Context 'every command the docs name is really there' {
        It 'no doc tells a technician to run a name that resolves nowhere' {
            $dead = Find-DEDocDeadNames
            $msg = ($dead.GetEnumerator() | Sort-Object Key | ForEach-Object { "$($_.Key) ($($_.Value))" }) -join '; '
            $dead.Count | Should -Be 0 -Because ("documented but missing from the product surface: " + $msg)
        }
    }

    Context 'the planned allowlist is a ratchet' {
        It 'every allowlisted name is still unbuilt (remove the entry once it exists)' {
            $surface = Get-DEExportSurface
            $artifacts = Get-DEArtifactNames
            $rotten = @($script:Planned.Keys | Where-Object { $surface.ContainsKey($_) -or $artifacts.ContainsKey($_) })
            ($rotten -join ', ') | Should -BeNullOrEmpty -Because 'these planned names now resolve; delete their allowlist entries so the list stays honest'
        }
        It 'every allowlisted name carries the move that will build it' {
            foreach ($k in $script:Planned.Keys) {
                "$($script:Planned[$k])" | Should -Not -BeNullOrEmpty -Because "the allowlist entry for $k must say who builds it"
            }
        }
    }

    Context 'the detector itself catches drift' {
        It 'a dead name in a doc is found, and a real one is not' {
            $probe = Join-Path ([IO.Path]::GetTempPath()) ("de-drift-probe-" + ([guid]::NewGuid().ToString('N')))
            New-Item -ItemType Directory -Path $probe -Force | Out-Null
            try {
                Set-Content -LiteralPath (Join-Path $probe 'fake-doc.md') -Value 'Run `Invoke-DEFrobnicate` and then `Write-DELog`.'
                $dead = Find-DEDocDeadNames -SearchRoots @($probe)
                $dead.ContainsKey('Invoke-DEFrobnicate') | Should -Be $true -Because 'a name that resolves nowhere must be reported'
                $dead.ContainsKey('Write-DELog') | Should -Be $false -Because 'a real exported function must not be reported'
            } finally { Remove-Item -LiteralPath $probe -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }
}
