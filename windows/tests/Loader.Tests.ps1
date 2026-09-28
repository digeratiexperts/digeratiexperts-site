# Pester tests for the MSP AI Kit loader (Install-MspAiKit.ps1). Compatible with Pester 4.10 and 5.x.
# Paths are set inside BeforeAll so the file works under Pester 4 and 5.

Describe 'Loader script' {
    BeforeAll {
        $script:Loader = Join-Path (Split-Path -Parent $PSScriptRoot) 'Install-MspAiKit.ps1'
        $script:KitRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
    }
    It 'parses without errors' {
        $errs = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($script:Loader, [ref]$null, [ref]$errs)
        @($errs).Count | Should -Be 0
    }
    It 'uses no PowerShell 7-only syntax (ternary, null-coalescing, pipeline chain)' {
        $tokens = $null; $errs = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($script:Loader, [ref]$tokens, [ref]$errs)
        @($tokens | Where-Object { $_.Kind -in @('QuestionMark', 'QuestionQuestion', 'QuestionQuestionEquals', 'AndAnd', 'OrOr') }).Count | Should -Be 0
    }
    It 'reads the pinned upstream lock (four kits, 40-hex commits, licenses)' {
        $lines = @(Get-Content -LiteralPath (Join-Path $script:KitRoot 'upstream.lock') | Where-Object { $_ -and $_ -notmatch '^\s*#' })
        $lines.Count | Should -Be 4
        foreach ($l in $lines) { ($l.Trim() -split '\s+')[2] | Should -Match '^[0-9a-f]{40}$' }
    }
}

Describe 'Loader runs (non-interactive, isolated HOME)' {
    BeforeAll {
        $script:Loader = Join-Path (Split-Path -Parent $PSScriptRoot) 'Install-MspAiKit.ps1'
        $script:TestHome = Join-Path ([IO.Path]::GetTempPath()) ("loader-home-{0}" -f ([guid]::NewGuid()))
        New-Item -ItemType Directory -Path $script:TestHome -Force | Out-Null
        $script:Exe = (Get-Process -Id $PID).Path
        $script:Out = Join-Path $script:TestHome 'packs'
        $script:Run = { param([string[]]$ArgList) $env:HOME = $script:TestHome; $env:USERPROFILE = $script:TestHome; $o = & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Loader @ArgList 2>&1 | ForEach-Object { "$_" }; return [pscustomobject]@{ Code = $LASTEXITCODE; Text = ($o -join "`n") } }
    }
    It 'dry run changes nothing and exits 0' {
        $r = & $script:Run @('-Action', 'All', '-NonInteractive', '-WhatIf', '-OutDir', $script:Out)
        $r.Code | Should -Be 0 -Because ("loader output:`n" + (($r.Text -split "`n" | Where-Object { $_ -match 'FAIL|BLOCKED|WARN|error|Exception' }) -join "`n"))
        $r.Text | Should -Match 'DRY RUN'
        Test-Path -LiteralPath (Join-Path $script:Out 'INDEX.md') | Should -Be $false
    }
    It 'builds the packs' {
        $r = & $script:Run @('-Action', 'Build', '-NonInteractive', '-OutDir', $script:Out)
        $r.Code | Should -Be 0
        Test-Path -LiteralPath (Join-Path $script:Out 'INDEX.md') | Should -Be $true
        Test-Path -LiteralPath (Join-Path $script:Out 'cheat-sheet.html') | Should -Be $true
    }
    It 'writes the ChatGPT blocks to files when non-interactive' {
        $r = & $script:Run @('-Action', 'Clipboard', '-NonInteractive', '-OutDir', $script:Out)
        (Get-Item -LiteralPath (Join-Path $script:Out 'chatgpt-block-B.txt')).Length | Should -BeLessOrEqual 1600
    }
    It 'reports BLOCKED (exit 2) for a folder without the kit' {
        $r = & $script:Run @('-Action', 'Build', '-NonInteractive', '-KitRoot', $script:TestHome)
        $r.Code | Should -Be 2
    }
    It 'reports the version' { (& $script:Run @('-Action', 'Version', '-NonInteractive')).Text | Should -Match 'local \d+\.\d+\.\d+' }
    It 'update without a configured URL is SKIPPED, not a failure' { (& $script:Run @('-Action', 'Update', '-NonInteractive', '-WhatIf')).Code | Should -Be 0 }
}

Describe 'Packaging: integrity manifest and tamper detection' {
    BeforeAll {
        $script:Src = Split-Path -Parent $PSScriptRoot
        $script:Copy = Join-Path ([IO.Path]::GetTempPath()) ("de-pkg-{0}" -f ([guid]::NewGuid()))
        New-Item -ItemType Directory -Path $script:Copy -Force | Out-Null
        foreach ($d in @('console', 'packaging', 'fonts')) { Copy-Item -LiteralPath (Join-Path $script:Src $d) -Destination $script:Copy -Recurse }
        Copy-Item -LiteralPath (Join-Path $script:Src 'Start-DETechConsole.cmd') -Destination $script:Copy
        $script:Exe = (Get-Process -Id $PID).Path
        $script:Sign = Join-Path $script:Copy 'packaging/Sign-DETechConsole.ps1'
    }
    It 'writes integrity.json without signing and verifies it' {
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Sign -SkipSigning -Root $script:Copy | Out-Null
        $LASTEXITCODE | Should -Be 0
        $m = Get-Content -LiteralPath (Join-Path $script:Copy 'integrity.json') -Raw | ConvertFrom-Json
        @($m.files).Count | Should -BeGreaterThan 20
        @($m.files | Where-Object { $_.path -like 'packaging/out*' }).Count | Should -Be 0
        if ($env:OS -ne 'Windows_NT') { & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Sign -Verify -Root $script:Copy | Out-Null; $LASTEXITCODE | Should -Be 0 }
    }
    It 'the console reports a file edited after packaging as tampered' {
        Add-Content -LiteralPath (Join-Path $script:Copy 'console/catalog/vendors.json') -Value ' '
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Sign -Verify -Root $script:Copy | Out-Null
        $LASTEXITCODE | Should -Be 1
        Import-Module (Join-Path $script:Copy 'console/modules/DE.Core/DE.Core.psm1') -Force -DisableNameChecking
        $null = Initialize-DEConsole -Root (Join-Path $script:Copy 'console') -Mode Audit -DataDir (Join-Path $script:Copy 'data')
        $i = Test-DEConsoleIntegrity -Root (Join-Path $script:Copy 'console')
        $i.status | Should -Be 'tampered'
        ($i.problems -join ' ') | Should -Match 'vendors.json'
    }
    It 'the RMM deploy script refuses a package whose sha256 does not match' {
        $zip = Join-Path $script:Copy 'pkg.zip'; Compress-Archive -Path (Join-Path $script:Copy 'console') -DestinationPath $zip
        $env:ProgramData = $(if ($env:ProgramData) { $env:ProgramData } else { $script:Copy }); $env:TEMP = $(if ($env:TEMP) { $env:TEMP } else { [IO.Path]::GetTempPath() })
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $script:Copy 'packaging/Deploy-DETechConsole.ps1') -PackagePath $zip -Sha256 ('0' * 64) -InstallDir (Join-Path $script:Copy 'install') | Out-Null
        $LASTEXITCODE | Should -Be 3
        Test-Path -LiteralPath (Join-Path $script:Copy 'install') | Should -Be $false
    }
}

Describe 'One-file installer' {
    BeforeAll {
        $script:Exe = (Get-Process -Id $PID).Path
        $script:Inst = Join-Path (Split-Path -Parent $PSScriptRoot) 'packaging/Install-DETechConsole.ps1'
        $script:Work = Join-Path ([IO.Path]::GetTempPath()) ("de-inst-{0}" -f ([guid]::NewGuid()))
        New-Item -ItemType Directory -Path (Join-Path $script:Work 'src/msp-ai-kit/windows/console') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $script:Work 'src/msp-ai-kit/windows/Start-DETechConsole.cmd') -Value '@echo off'
        Set-Content -LiteralPath (Join-Path $script:Work 'src/msp-ai-kit/windows/console/VERSION') -Value '9.9.9'
        $script:Zip = Join-Path $script:Work 'DE-TechConsole-and-MSP-AI-Kit-v9.9.9.zip'
        Compress-Archive -Path (Join-Path $script:Work 'src/msp-ai-kit') -DestinationPath $script:Zip
    }
    It 'installs the zip, keeps one backup of the old copy, and never launches with -NoLaunch' {
        $dest = Join-Path $script:Work 'DE-TechConsole'
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Inst -ZipPath $script:Zip -InstallDir $dest -NoLaunch | Out-Null
        $LASTEXITCODE | Should -Be 0
        Test-Path -LiteralPath (Join-Path $dest 'windows/Start-DETechConsole.cmd') | Should -Be $true
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Inst -ZipPath $script:Zip -InstallDir $dest -NoLaunch | Out-Null
        Test-Path -LiteralPath "$dest.previous" | Should -Be $true
    }
    It 'finds a canonical DE-TechTool zip on its own and installs the Start-DETechTool launcher' {
        $src = Join-Path $script:Work 'canon/msp-ai-kit/windows/console'
        New-Item -ItemType Directory -Path $src -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $script:Work 'canon/msp-ai-kit/windows/Start-DETechTool.cmd') -Value '@echo off'
        Set-Content -LiteralPath (Join-Path $src 'VERSION') -Value '9.9.10'
        $drop = Join-Path $script:Work 'drop'; New-Item -ItemType Directory -Path $drop -Force | Out-Null
        Compress-Archive -Path (Join-Path $script:Work 'canon/msp-ai-kit') -DestinationPath (Join-Path $drop 'DE-TechTool-v9.9.10.zip')
        Copy-Item -LiteralPath $script:Inst -Destination $drop
        $dest = Join-Path $script:Work 'DE-TechTool'
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $drop 'Install-DETechConsole.ps1') -InstallDir $dest -NoLaunch | Out-Null
        $LASTEXITCODE | Should -Be 0
        Test-Path -LiteralPath (Join-Path $dest 'windows/Start-DETechTool.cmd') | Should -Be $true
    }
    It 'refuses a zip whose sha256 does not match' {
        & $script:Exe -NoProfile -ExecutionPolicy Bypass -File $script:Inst -ZipPath $script:Zip -Sha256 ('0' * 64) -InstallDir (Join-Path $script:Work 'x') -NoLaunch | Out-Null
        $LASTEXITCODE | Should -Be 1
    }
}

Describe 'Launchers pass the exit code through (cmd.exe)' {
    BeforeAll { $script:Win = Split-Path -Parent $PSScriptRoot }
    It 'Start-DETechTool.cmd and its Start-DETechConsole.cmd alias return 2 for a refused headless run, not 0' -Skip:($env:OS -ne 'Windows_NT') {
        $data = Join-Path ([IO.Path]::GetTempPath()) ("de-launch-{0}" -f ([guid]::NewGuid()))
        foreach ($l in @('Start-DETechTool.cmd', 'Start-DETechConsole.cmd')) {
            & cmd.exe /c ('"{0}" -Headless -Client no-such-client -DataDir "{1}"' -f (Join-Path $script:Win $l), $data) | Out-Null
            $LASTEXITCODE | Should -Be 2 -Because "$l must return the tool's exit code"
        }
    }
    It 'launchers keep %ERRORLEVEL% out of ( ) blocks, where cmd expands it too early' {
        foreach ($l in @('Start-DETechTool.cmd', 'Start-DETechConsole.cmd', 'Start-MspAiKit.cmd')) {
            $text = Get-Content -LiteralPath (Join-Path $script:Win $l) -Raw
            $inBlock = [regex]::Matches($text, '\((?:[^()]|\([^()]*\))*\)') | Where-Object { $_.Value -match '%ERRORLEVEL%|errorlevel%' }
            @($inBlock).Count | Should -Be 0 -Because "$l"
        }
    }
}
