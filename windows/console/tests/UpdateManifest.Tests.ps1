# Move 99 (issue 817): test the update flow against the signed manifest. The update path is
# packaging\Deploy-DETechConsole.ps1: sha256 of the package first, then Sign-DETechConsole.ps1 -Verify
# against integrity.json before anything installs. These tests prove the refusal paths: a wrong hash
# never extracts, a payload edited after packaging is refused even when its zip hash matches (the
# manifest is the second key), and a manifest-less package is refused when a signature is required.
# Every run installs at most into a temp folder. Compatible with Pester 4.10 and 5.x.

Describe 'Update flow against the signed manifest' {
    BeforeAll {
        . (Join-Path $PSScriptRoot 'TestHelpers.ps1')
        $null = Initialize-TestConsole
        $global:DETest = @{ Win = Split-Path -Parent $script:ConsoleRoot; Exe = (Get-Process -Id $PID).Path; Tmp = Join-Path ([IO.Path]::GetTempPath()) ("de-upd-{0}" -f ([guid]::NewGuid())) }
        New-Item -ItemType Directory -Path $global:DETest.Tmp -Force | Out-Null
        $out = Join-Path $global:DETest.Tmp 'release'
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'packaging/New-DEReleasePackage.ps1') -IssuedTo test-tech -SkipSigning -NoCommunity -Channel test -OutDir $out 3>$null | Out-Null
        if ($LASTEXITCODE) { throw "release build exit $LASTEXITCODE" }
        $global:DETest.Zip = @(Get-ChildItem -LiteralPath $out -Filter 'DE-TechTool*.zip')[0].FullName
        $ext = Join-Path $global:DETest.Tmp 'extracted'
        Expand-Archive -LiteralPath $global:DETest.Zip -DestinationPath $ext -Force
        $win = @(Get-ChildItem -LiteralPath $ext -Recurse -Filter 'DETechConsole.ps1' | Select-Object -First 1)
        $global:DETest.PkgWindows = Split-Path -Parent (Split-Path -Parent $win[0].FullName)
    }
    It 'an intact release verifies against its manifest' {
        Test-Path -LiteralPath (Join-Path $global:DETest.PkgWindows 'integrity.json') | Should -Be $true
        & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.PkgWindows 'packaging/Sign-DETechConsole.ps1') -Verify -Root $global:DETest.PkgWindows | Out-Null
        $LASTEXITCODE | Should -Be 0 -Because 'an untouched release must verify'
    }
    It 'refuses a package whose zip hash does not match, before extracting anything' {
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'packaging/Deploy-DETechConsole.ps1') -PackagePath $global:DETest.Zip -Sha256 ('0' * 64) -InstallDir (Join-Path $global:DETest.Tmp 'install-a') 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 3
        ($out -join "`n") | Should -Match 'sha256 mismatch'
        Test-Path -LiteralPath (Join-Path $global:DETest.Tmp 'install-a') | Should -Be $false
    }
    It 'refuses a payload edited after packaging even when its zip hash matches' {
        $copy = Join-Path $global:DETest.Tmp 'tampered'
        Copy-Item -LiteralPath (Split-Path -Parent $global:DETest.PkgWindows) -Destination $copy -Recurse -Force
        $win = @(Get-ChildItem -LiteralPath $copy -Recurse -Filter 'DETechConsole.ps1' | Select-Object -First 1)
        $tamperedWindows = Split-Path -Parent (Split-Path -Parent $win[0].FullName)
        Add-Content -LiteralPath (Join-Path $tamperedWindows 'console/modules/DE.Core/DE.Core.psm1') -Value '# edited after packaging'
        $zip = Join-Path $global:DETest.Tmp 'tampered.zip'
        Compress-Archive -Path (Join-Path $copy '*') -DestinationPath $zip -Force
        $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'packaging/Deploy-DETechConsole.ps1') -PackagePath $zip -Sha256 $hash -InstallDir (Join-Path $global:DETest.Tmp 'install-b') 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 3 -Because 'the manifest must catch what a matching zip hash cannot'
        ($out -join "`n") | Should -Match 'integrity'
        Test-Path -LiteralPath (Join-Path $global:DETest.Tmp 'install-b') | Should -Be $false
    }
    It 'refuses a manifest-less package when a signature is required' {
        $mini = Join-Path $global:DETest.Tmp 'mini'
        New-Item -ItemType Directory -Path (Join-Path $mini 'windows/console') -Force | Out-Null
        Copy-Item -LiteralPath (Join-Path $global:DETest.Win 'console/DETechConsole.ps1') -Destination (Join-Path $mini 'windows/console/DETechConsole.ps1')
        $zip = Join-Path $global:DETest.Tmp 'mini.zip'
        Compress-Archive -Path (Join-Path $mini '*') -DestinationPath $zip -Force
        $hash = (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $global:DETest.Win 'packaging/Deploy-DETechConsole.ps1') -PackagePath $zip -Sha256 $hash -RequireSignature -InstallDir (Join-Path $global:DETest.Tmp 'install-c') 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 3
        ($out -join "`n") | Should -Match 'no integrity.json'
        Test-Path -LiteralPath (Join-Path $global:DETest.Tmp 'install-c') | Should -Be $false
    }
    It 'a script added after packaging makes the copy tampered' {
        $copy = Join-Path $global:DETest.Tmp 'added'
        Copy-Item -LiteralPath (Split-Path -Parent $global:DETest.PkgWindows) -Destination $copy -Recurse -Force
        $win = @(Get-ChildItem -LiteralPath $copy -Recurse -Filter 'DETechConsole.ps1' | Select-Object -First 1)
        $addedWindows = Split-Path -Parent (Split-Path -Parent $win[0].FullName)
        New-Item -ItemType Directory -Path (Join-Path $addedWindows 'console/modules/DE.Sneaky') -Force | Out-Null
        Set-Content -LiteralPath (Join-Path $addedWindows 'console/modules/DE.Sneaky/DE.Sneaky.psm1') -Value 'function Get-DESneaky { }' -Encoding UTF8
        $r = Test-DEConsoleIntegrity -Root (Join-Path $addedWindows 'console')
        $r.status | Should -Be 'tampered'
        ($r.problems -join ' | ') | Should -Match 'not in integrity.json'
    }
}
