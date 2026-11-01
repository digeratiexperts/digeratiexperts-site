# Move 88 (issue 806): tests for the vendor warranty endpoint monitor. The monitor itself probes
# live endpoints, so the logic is tested offline through -ResponseDir fixtures: what counts as a
# change (marker gone, host redirect, content-type class change, 5xx, a page gone) versus a note
# (exact status flips, an endpoint that was already unreachable at record time). The cache policy
# half of the move lives in catalog/warranty.json (cacheDays) and is exercised in Functions.Tests.
# Compatible with Pester 4.10 and 5.x.

Describe 'Warranty endpoint monitor' {
    BeforeAll {
        $global:DETest = @{ Exe = (Get-Process -Id $PID).Path; Script = (Join-Path $PSScriptRoot 'Invoke-WarrantyEndpointCheck.ps1'); Tmp = Join-Path ([IO.Path]::GetTempPath()) ("de-wep-{0}" -f ([guid]::NewGuid())) }
        New-Item -ItemType Directory -Path $global:DETest.Tmp -Force | Out-Null
        $catalog = @'
{ "version": 1, "cacheDays": 7, "warnDays": 90, "vendors": [
  { "key": "lenovo", "name": "Lenovo", "match": "(?i)^lenovo", "method": "lenovo-support-site", "confirmed": true,
    "productsUrl": "https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId={serial}",
    "checkUrl": "https://pcsupport.lenovo.com/us/en/warrantylookup" },
  { "key": "hp", "name": "HP", "match": "(?i)^(hp|hewlett)", "method": "manual", "confirmed": true,
    "checkUrl": "https://support.hp.com/us-en/check-warranty" }
] }
'@
        Set-Content -LiteralPath (Join-Path $global:DETest.Tmp 'warranty.json') -Value $catalog -Encoding UTF8
        function Write-DEFixture([string]$Dir, [string]$Key, [int]$Status, [string]$ContentType, [string]$FinalUri, [string]$Body) {
            New-Item -ItemType Directory -Path $Dir -Force | Out-Null
            @{ status = $Status; contentType = $ContentType; finalUri = $FinalUri; body = $Body } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Dir ($Key + '.json')) -Encoding UTF8
        }
        $global:DEWriteFixture = ${function:Write-DEFixture}
        $good = Join-Path $global:DETest.Tmp 'good'
        & $global:DEWriteFixture $good 'lenovo.checkUrl' 200 'text/html; charset=utf-8' 'https://pcsupport.lenovo.com/us/en/warrantylookup' '<html>warranty</html>'
        & $global:DEWriteFixture $good 'lenovo.productsUrl' 200 'application/json; charset=utf-8' 'https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=PF3ABC12' '[{"Id":"x","Serial":"PF3ABC12"}]'
        & $global:DEWriteFixture $good 'hp.checkUrl' 200 'text/html' 'https://support.hp.com/us-en/check-warranty' '<html>hp</html>'
    }
    It 'passes when every endpoint matches what was pinned' {
        $snap = Join-Path $global:DETest.Tmp 'snap-good.json'
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir (Join-Path $global:DETest.Tmp 'good') -Update 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 0
        $out -join "`n" | Should -Match 'snapshot written'
        $out2 = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir (Join-Path $global:DETest.Tmp 'good') 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 0
        $out2 -join "`n" | Should -Match 'match the pinned snapshot'
    }
    It 'fails on a parser marker disappearing, a host redirect, a content-type change, 5xx and a gone page' {
        $bad = Join-Path $global:DETest.Tmp 'bad'
        & $global:DEWriteFixture $bad 'lenovo.checkUrl' 200 'text/html; charset=utf-8' 'https://pcsupport.lenovo.com/us/en/warrantylookup' '<html>no marker here</html>'
        & $global:DEWriteFixture $bad 'lenovo.productsUrl' 200 'text/html' 'https://evil.example/parked' '[{"Id":"x"}]'
        & $global:DEWriteFixture $bad 'hp.checkUrl' 404 'text/html' 'https://support.hp.com/us-en/check-warranty' ''
        $snap = Join-Path $global:DETest.Tmp 'snap-good.json'
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir $bad 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 1
        $all = $out -join "`n"
        $all | Should -Match "parser marker '.*' is gone"
        $all | Should -Match 'redirected to another host'
        $all | Should -Match 'content type changed'
        $all | Should -Match 'the page is gone'
    }
    It '-ReportOnly reports but never fails the run' {
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath (Join-Path $global:DETest.Tmp 'snap-good.json') -ResponseDir (Join-Path $global:DETest.Tmp 'bad') -ReportOnly 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 0
    }
    It 'a 5xx fails the run; a healthy status flip is only a note' {
        $mixed = Join-Path $global:DETest.Tmp 'mixed'
        & $global:DEWriteFixture $mixed 'lenovo.checkUrl' 200 'text/html' 'https://pcsupport.lenovo.com/us/en/warrantylookup' '<html>warranty</html>'
        & $global:DEWriteFixture $mixed 'lenovo.productsUrl' 200 'application/json' 'https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=PF3ABC12' '[{"Id":"x","Serial":"PF3ABC12"}]'
        & $global:DEWriteFixture $mixed 'hp.checkUrl' 200 'text/html' 'https://support.hp.com/us-en/check-warranty' '<html>hp</html>'
        $snap = Join-Path $global:DETest.Tmp 'snap-mixed.json'
        $null = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir $mixed -Update 2>&1 | ForEach-Object { "$_" }
        # a healthy flip (200 -> 403 bot wall) is a note, not a failure
        $flip = Join-Path $global:DETest.Tmp 'flip'
        & $global:DEWriteFixture $flip 'lenovo.checkUrl' 403 'text/html' 'https://pcsupport.lenovo.com/us/en/warrantylookup' ''
        & $global:DEWriteFixture $flip 'lenovo.productsUrl' 200 'application/json' 'https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=PF3ABC12' '[{"Id":"x","Serial":"PF3ABC12"}]'
        & $global:DEWriteFixture $flip 'hp.checkUrl' 200 'text/html' 'https://support.hp.com/us-en/check-warranty' '<html>hp</html>'
        $out = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir $flip 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 0
        ($out -join "`n") | Should -Match 'status 200 -> 403'
        # but a 5xx is breakage and fails
        $down = Join-Path $global:DETest.Tmp 'down'
        & $global:DEWriteFixture $down 'lenovo.checkUrl' 503 'text/html' 'https://pcsupport.lenovo.com/us/en/warrantylookup' ''
        & $global:DEWriteFixture $down 'lenovo.productsUrl' 200 'application/json' 'https://pcsupport.lenovo.com/us/en/api/v4/mse/getproducts?productId=PF3ABC12' '[{"Id":"x","Serial":"PF3ABC12"}]'
        & $global:DEWriteFixture $down 'hp.checkUrl' 200 'text/html' 'https://support.hp.com/us-en/check-warranty' '<html>hp</html>'
        $out2 = & $global:DETest.Exe -NoProfile -ExecutionPolicy Bypass -File $global:DETest.Script -CatalogPath (Join-Path $global:DETest.Tmp 'warranty.json') -SnapshotPath $snap -ResponseDir $down 2>&1 | ForEach-Object { "$_" }
        $LASTEXITCODE | Should -Be 1
        ($out2 -join "`n") | Should -Match 'answers 503'
    }
    It 'the real catalog and its pinned snapshot cover every vendor' {
        $win = Split-Path -Parent $PSScriptRoot
        $cat = Get-Content -LiteralPath (Join-Path (Join-Path (Join-Path $win 'console') 'catalog') 'warranty.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        $snap = Get-Content -LiteralPath (Join-Path (Join-Path (Join-Path $win 'console') 'catalog') 'warranty-endpoints.snapshot.json') -Raw -Encoding UTF8 | ConvertFrom-Json
        foreach ($v in @($cat.vendors | Where-Object { $null -ne $_ })) {
            "$($v.checkUrl)" | Should -Not -BeNullOrEmpty -Because "vendor $($v.key) has no check page to fall back on"
            @($snap.endpoints | Where-Object { $_.key -eq "$($v.key).checkUrl" }).Count | Should -Be 1 -Because "vendor $($v.key) is not in the pinned snapshot; run Invoke-WarrantyEndpointCheck.ps1 -Update"
        }
    }
}
