# Move 72: "Build install, upgrade and uninstall for the agent, each signature-checked" (#790).
#
# DE.AgentInstall installs, upgrades and removes the DE Tech Agent (AGENT-THREAT-MODEL.md T3, D6). The service
# operations go through a controller, so this suite uses a recording fake and never installs a real service. It pins:
#   - nothing is installed from an unverified package: the manifest must match the hash from the signed release record,
#     every file must be listed, present and exactly the listed hash, extra files and paths that escape are refused,
#     code files must carry a valid Authenticode signature (unsigned only with the explicit rehearsal switch, and a
#     signature that is present but not valid is never excused);
#   - an upgrade must be strictly newer, is self-tested on the staged copy BEFORE the service is touched, and rolls back
#     when the new version is not healthy, keeping the previous one;
#   - an install that does not come up healthy removes itself; unsafe install directories are refused;
#   - uninstall removes the service and program and KEEPS the state unless told to purge it.
#
# Source stays ASCII (Windows PowerShell 5.1 reads a BOM-less script as ANSI).

Describe 'DE.AgentInstall: verified before installed, self-tested before swapped, rolled back when unhealthy' {
    BeforeAll {
        $script:Win = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
        Import-Module (Join-Path $script:Win 'agent\DE.AgentInstall.psm1') -Force
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ('de-install-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $script:Work -Force | Out-Null
        $script:Valid = { param($p) 'Valid' }

        function script:Get-Sha { param($p) return ((Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()) }
        function script:New-Pkg {
            param([string]$Version = '1.0.0', [hashtable]$Mutate = @{})
            $dir = Join-Path $script:Work ('pkg-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Set-Content -LiteralPath (Join-Path $dir 'DETechAgentHost.exe') -Value "host $Version"
            Set-Content -LiteralPath (Join-Path $dir 'DE.AgentService.psm1') -Value "# service $Version"
            $files = @('DETechAgentHost.exe', 'DE.AgentService.psm1') | ForEach-Object { [ordered]@{ path = $_; sha256 = (Get-Sha (Join-Path $dir $_)) } }
            $m = [ordered]@{ schema = 'de.techagent.package/v1'; version = $Version; host = 'DETechAgentHost.exe'; files = @($files) }
            foreach ($k in $Mutate.Keys) { $m[$k] = $Mutate[$k] }
            $mp = Join-Path $dir 'agent-manifest.json'
            [IO.File]::WriteAllText($mp, ($m | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding $false))
            return [pscustomobject]@{ Dir = $dir; Sha = (Get-Sha $mp); ManifestPath = $mp }
        }
        function script:Reseal { param($Pkg) $Pkg.Sha = Get-Sha $Pkg.ManifestPath }
        function script:New-FakeController {
            param([bool]$Exists = $false, [int]$FailStarts = 0)
            $s = [pscustomobject]@{ Exists = $Exists; Running = $false; Calls = (New-Object System.Collections.Generic.List[string]); FailStarts = $FailStarts; Binary = '' }
            $c = [pscustomobject]@{
                Exists    = { param($n) $s.Calls.Add("exists:$n"); $s.Exists }.GetNewClosure()
                Create    = { param($n, $b) $s.Calls.Add("create:$n"); $s.Exists = $true; $s.Binary = $b }.GetNewClosure()
                Start     = { param($n) $s.Calls.Add("start:$n"); if ($s.FailStarts -gt 0) { $s.FailStarts--; $s.Running = $false } else { $s.Running = $true } }.GetNewClosure()
                Stop      = { param($n) $s.Calls.Add("stop:$n"); $s.Running = $false }.GetNewClosure()
                Delete    = { param($n) $s.Calls.Add("delete:$n"); $s.Exists = $false }.GetNewClosure()
                IsRunning = { param($n) $s.Running }.GetNewClosure()
            }
            return [pscustomobject]@{ Controller = $c; State = $s }
        }
        function script:New-Dir { return (Join-Path $script:Work ('inst-' + [guid]::NewGuid().ToString('N'))) }
        function script:Install-Test { param($Pkg, $Dir, $Fake, $Sig = $script:Valid, [switch]$AllowUnsigned) return (Install-DEAgent -PackageDir $Pkg.Dir -InstallDir $Dir -ExpectedManifestSha256 $Pkg.Sha -Controller $Fake.Controller -SignatureCheck $Sig -AllowUnsigned:$AllowUnsigned -HealthAttempts 2 -HealthDelayMs 0) }
        function script:Update-Test { param($Pkg, $Dir, $Fake, $Self = { param($d) $true }, $Sig = $script:Valid) return (Update-DEAgent -PackageDir $Pkg.Dir -InstallDir $Dir -ExpectedManifestSha256 $Pkg.Sha -Controller $Fake.Controller -SignatureCheck $Sig -SelfTest $Self -HealthAttempts 2 -HealthDelayMs 0) }
    }
    AfterAll { Remove-Item -LiteralPath $script:Work -Recurse -Force -ErrorAction SilentlyContinue }

    Context 'a package is verified before anything is installed' {
        It 'accepts a package whose manifest matches the release record, with every file listed, present and exact' {
            $p = New-Pkg
            $v = Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $script:Valid
            $v.Ok | Should -Be $true -Because $v.Why
            $v.Version | Should -Be ([version]'1.0.0')
            $v.Host | Should -Be 'DETechAgentHost.exe'
        }
        It 'refuses a manifest that is not the one the release record names (manifest_mismatch), even if it was edited consistently' {
            $p = New-Pkg
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 ('0' * 64) -SignatureCheck $script:Valid).Code | Should -Be 'manifest_mismatch'
            $raw = Get-Content -LiteralPath $p.ManifestPath -Raw
            Set-Content -LiteralPath $p.ManifestPath -Value ($raw.Replace('1.0.0', '9.9.9'))
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $script:Valid).Code | Should -Be 'manifest_mismatch' -Because 'an attacker who edits the manifest cannot also change the anchor'
        }
        It 'refuses a changed file, a missing file and an extra file' {
            $a = New-Pkg; Set-Content -LiteralPath (Join-Path $a.Dir 'DE.AgentService.psm1') -Value '# tampered'
            (Test-DEAgentPackage -PackageDir $a.Dir -ExpectedManifestSha256 $a.Sha -SignatureCheck $script:Valid).Code | Should -Be 'file_changed'
            $b = New-Pkg; Remove-Item -LiteralPath (Join-Path $b.Dir 'DE.AgentService.psm1')
            (Test-DEAgentPackage -PackageDir $b.Dir -ExpectedManifestSha256 $b.Sha -SignatureCheck $script:Valid).Code | Should -Be 'file_missing'
            $c = New-Pkg; Set-Content -LiteralPath (Join-Path $c.Dir 'extra.ps1') -Value 'calc'
            (Test-DEAgentPackage -PackageDir $c.Dir -ExpectedManifestSha256 $c.Sha -SignatureCheck $script:Valid).Code | Should -Be 'file_unlisted'
        }
        It 'refuses a manifest path that leaves the package (relative, rooted or drive-qualified)' {
            foreach ($bad in @('..\evil.ps1', '\evil.ps1', 'C:\evil.ps1', 'sub\..\..\evil.ps1')) {
                $p = New-Pkg
                $m = Get-Content -LiteralPath $p.ManifestPath -Raw | ConvertFrom-Json
                $m.files = @($m.files) + @([pscustomobject]@{ path = $bad; sha256 = ('a' * 64) })
                [IO.File]::WriteAllText($p.ManifestPath, ($m | ConvertTo-Json -Depth 5)); Reseal $p
                (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $script:Valid).Code | Should -Be 'unsafe_path' -Because $bad
            }
        }
        It 'refuses a manifest that is not a package manifest, or whose host is not a package file' {
            $a = New-Pkg -Mutate @{ schema = 'something.else/v1' }
            (Test-DEAgentPackage -PackageDir $a.Dir -ExpectedManifestSha256 $a.Sha -SignatureCheck $script:Valid).Code | Should -Be 'manifest_invalid'
            $b = New-Pkg -Mutate @{ host = 'NotInPackage.exe' }
            (Test-DEAgentPackage -PackageDir $b.Dir -ExpectedManifestSha256 $b.Sha -SignatureCheck $script:Valid).Code | Should -Be 'manifest_invalid'
        }
        It 'refuses unsigned code by default, allows it only by name, and never excuses a signature that is not valid' {
            $p = New-Pkg
            $unsigned = { param($f) 'NotSigned' }
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $unsigned).Code | Should -Be 'unsigned'
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $unsigned -AllowUnsigned).Ok | Should -Be $true
            $bad = { param($f) 'HashMismatch' }
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $bad -AllowUnsigned).Code | Should -Be 'bad_signature' -Because 'a tampered signed file is not "merely unsigned"'
            $untrusted = { param($f) 'UnknownError' }
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $untrusted -AllowUnsigned).Code | Should -Be 'bad_signature'
        }
        It 'checks every code file, not just the first' {
            $p = New-Pkg
            $oneBad = { param($f) if ($f -like '*.psm1') { 'HashMismatch' } else { 'Valid' } }
            (Test-DEAgentPackage -PackageDir $p.Dir -ExpectedManifestSha256 $p.Sha -SignatureCheck $oneBad).Code | Should -Be 'bad_signature'
        }
    }

    Context 'install' {
        It 'installs a verified package: files copied, a service created for the host, started, and nothing else touched' {
            $p = New-Pkg; $dir = New-Dir; $fake = New-FakeController
            $r = Install-Test -Pkg $p -Dir $dir -Fake $fake
            $r.Ok | Should -Be $true -Because $r.Why
            $r.Code | Should -Be 'installed'
            (Get-DEInstalledAgentVersion -InstallDir $dir) | Should -Be ([version]'1.0.0')
            Test-Path -LiteralPath (Join-Path $dir 'DETechAgentHost.exe') | Should -Be $true
            $fake.State.Binary | Should -Be (Join-Path $dir 'DETechAgentHost.exe')
            ($fake.State.Calls -join ',') | Should -Be 'exists:DETechAgent,create:DETechAgent,start:DETechAgent'
        }
        It 'refuses an unverified package and leaves nothing behind' {
            $p = New-Pkg; Set-Content -LiteralPath (Join-Path $p.Dir 'DE.AgentService.psm1') -Value '# tampered'
            $dir = New-Dir; $fake = New-FakeController
            (Install-Test -Pkg $p -Dir $dir -Fake $fake).Code | Should -Be 'file_changed'
            Test-Path -LiteralPath $dir | Should -Be $false
            ($fake.State.Calls | Where-Object { $_ -notlike 'exists:*' }).Count | Should -Be 0 -Because 'the service manager was never asked to change anything'
        }
        It 'refuses to install over an existing install or service (use the upgrade)' {
            $p = New-Pkg; $dir = New-Dir
            $null = Install-Test -Pkg $p -Dir $dir -Fake (New-FakeController)
            (Install-Test -Pkg (New-Pkg) -Dir $dir -Fake (New-FakeController)).Code | Should -Be 'already_installed'
            (Install-Test -Pkg (New-Pkg) -Dir (New-Dir) -Fake (New-FakeController -Exists $true)).Code | Should -Be 'already_installed'
        }
        It 'removes itself again if the service does not come up healthy' {
            $p = New-Pkg; $dir = New-Dir; $fake = New-FakeController -FailStarts 5
            $r = Install-Test -Pkg $p -Dir $dir -Fake $fake
            $r.Code | Should -Be 'unhealthy'
            Test-Path -LiteralPath $dir | Should -Be $false
            $fake.State.Exists | Should -Be $false -Because 'the half-installed service was deleted'
        }
        It 'refuses an unsafe install directory' {
            $p = New-Pkg; $fake = New-FakeController
            foreach ($bad in @('C:\', 'relative\dir', 'C:\x\..\y', 'C:\ab')) { { Install-Test -Pkg $p -Dir $bad -Fake $fake } | Should -Throw -Because $bad }
        }
    }

    Context 'upgrade' {
        BeforeEach {
            $script:Dir = New-Dir; $script:Fake = New-FakeController
            $null = Install-Test -Pkg (New-Pkg -Version '1.0.0') -Dir $script:Dir -Fake $script:Fake
            $script:Fake.State.Calls.Clear()
        }
        It 'upgrades to a newer verified version: stopped, swapped, started, the previous version kept' {
            $r = Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $script:Dir -Fake $script:Fake
            $r.Ok | Should -Be $true -Because $r.Why
            (Get-DEInstalledAgentVersion -InstallDir $script:Dir) | Should -Be ([version]'1.1.0')
            (Get-DEInstalledAgentVersion -InstallDir "$($script:Dir).previous") | Should -Be ([version]'1.0.0')
            ($script:Fake.State.Calls -join ',') | Should -Be 'stop:DETechAgent,start:DETechAgent'
            $script:Fake.State.Running | Should -Be $true
        }
        It 'refuses the same version and an older one (not_newer), changing nothing' {
            (Update-Test -Pkg (New-Pkg -Version '1.0.0') -Dir $script:Dir -Fake $script:Fake).Code | Should -Be 'not_newer'
            (Update-Test -Pkg (New-Pkg -Version '0.9.0') -Dir $script:Dir -Fake $script:Fake).Code | Should -Be 'not_newer'
            (Get-DEInstalledAgentVersion -InstallDir $script:Dir) | Should -Be ([version]'1.0.0')
            $script:Fake.State.Calls.Count | Should -Be 0
        }
        It 'refuses an unverified upgrade without touching the service' {
            $p = New-Pkg -Version '1.1.0'; Set-Content -LiteralPath (Join-Path $p.Dir 'DE.AgentService.psm1') -Value '# tampered'
            (Update-Test -Pkg $p -Dir $script:Dir -Fake $script:Fake).Code | Should -Be 'file_changed'
            $script:Fake.State.Calls.Count | Should -Be 0
        }
        It 'a failed self-test leaves the service running and the install untouched, and removes the staged copy' {
            $r = Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $script:Dir -Fake $script:Fake -Self { param($d) $false }
            $r.Code | Should -Be 'self_test_failed'
            $script:Fake.State.Calls.Count | Should -Be 0 -Because 'the service must not even be stopped'
            (Get-DEInstalledAgentVersion -InstallDir $script:Dir) | Should -Be ([version]'1.0.0')
            Test-Path -LiteralPath "$($script:Dir).new" | Should -Be $false
        }
        It 'a self-test that throws counts as a failure' {
            (Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $script:Dir -Fake $script:Fake -Self { param($d) throw 'boom' }).Code | Should -Be 'self_test_failed'
        }
        It 'the self-test runs on the staged copy, not on the live install' {
            $script:Seen = $null
            $null = Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $script:Dir -Fake $script:Fake -Self { param($d) $script:Seen = $d; $true }
            $script:Seen | Should -Be "$($script:Dir).new"
        }
        It 'rolls back to the previous version when the new one is not healthy, and starts it again' {
            $script:Fake.State.FailStarts = 1
            $r = Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $script:Dir -Fake $script:Fake
            $r.Code | Should -Be 'unhealthy'
            (Get-DEInstalledAgentVersion -InstallDir $script:Dir) | Should -Be ([version]'1.0.0') -Because 'the working version is back'
            Test-Path -LiteralPath "$($script:Dir).failed" | Should -Be $true
            $script:Fake.State.Running | Should -Be $true
            ($script:Fake.State.Calls -join ',') | Should -Match 'stop:DETechAgent,start:DETechAgent,stop:DETechAgent,start:DETechAgent'
        }
        It 'refuses to upgrade what is not installed' {
            (Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir (New-Dir) -Fake $script:Fake).Code | Should -Be 'not_installed'
        }
    }

    Context 'uninstall' {
        It 'removes the service and the program (and the kept copies) and keeps the state' {
            $dir = New-Dir; $fake = New-FakeController
            $null = Install-Test -Pkg (New-Pkg -Version '1.0.0') -Dir $dir -Fake $fake
            $null = Update-Test -Pkg (New-Pkg -Version '1.1.0') -Dir $dir -Fake $fake
            $state = New-Dir; New-Item -ItemType Directory -Path $state -Force | Out-Null; Set-Content -LiteralPath (Join-Path $state 'device.json') -Value '{}'
            $r = Uninstall-DEAgent -InstallDir $dir -Controller $fake.Controller -StateRoot $state
            $r.StateKept | Should -Be $true
            $fake.State.Exists | Should -Be $false
            foreach ($d in @($dir, "$dir.previous")) { Test-Path -LiteralPath $d | Should -Be $false }
            Test-Path -LiteralPath (Join-Path $state 'device.json') | Should -Be $true -Because 'the state is the client''s record and survives'
        }
        It 'purges the state only when asked, and only with the state root named' {
            $dir = New-Dir; $fake = New-FakeController
            $null = Install-Test -Pkg (New-Pkg) -Dir $dir -Fake $fake
            $state = New-Dir; New-Item -ItemType Directory -Path $state -Force | Out-Null
            { Uninstall-DEAgent -InstallDir $dir -Controller $fake.Controller -PurgeState } | Should -Throw
            $r = Uninstall-DEAgent -InstallDir $dir -Controller $fake.Controller -StateRoot $state -PurgeState
            $r.StateKept | Should -Be $false
            Test-Path -LiteralPath $state | Should -Be $false
        }
        It 'tolerates a service that is already gone' {
            $dir = New-Dir; New-Item -ItemType Directory -Path $dir -Force | Out-Null
            (Uninstall-DEAgent -InstallDir $dir -Controller (New-FakeController).Controller).Ok | Should -Be $true
        }
        It 'refuses an unsafe install directory' {
            { Uninstall-DEAgent -InstallDir 'C:\' -Controller (New-FakeController).Controller } | Should -Throw
        }
    }

    Context 'the real controller' {
        It 'exposes the six operations, and asking about a service that does not exist is a safe read' {
            $c = New-DEAgentServiceController
            @($c.PSObject.Properties.Name | Sort-Object) -join ',' | Should -Be 'Create,Delete,Exists,IsRunning,Start,Stop'
            (& $c.Exists 'DE_NoSuchService_Test_72') | Should -Be $false
            (& $c.IsRunning 'DE_NoSuchService_Test_72') | Should -Be $false
        }
    }
}
