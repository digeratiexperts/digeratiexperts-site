#Requires -Version 5.1
[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$WindowsRoot)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Native launcher compilation requires Windows.' }
$version = (Get-Content -LiteralPath (Join-Path $WindowsRoot 'console\VERSION') -Raw).Trim()
if ($version -notmatch '^\d{1,5}\.\d{1,5}\.\d{1,5}(\.\d{1,5})?$') { throw 'Invalid console version for native launcher.' }
foreach ($component in $version.Split('.')) { if ([int]$component -gt 65534) { throw 'Version component exceeds PE version range.' } }
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework C# compiler is missing.' }
$source = Join-Path $WindowsRoot 'packaging\DETechToolLauncher.cs'
if (-not (Test-Path -LiteralPath $source)) { throw 'Native launcher source is missing.' }
$temporary = Join-Path ([IO.Path]::GetTempPath()) ('de-launcher-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $temporary | Out-Null
try {
    $metadata = Join-Path $temporary 'Version.cs'
    [IO.File]::WriteAllText($metadata, ('using System.Reflection; [assembly: AssemblyTitle("DE Tech Tool")] [assembly: AssemblyCompany("Digerati Experts")] [assembly: AssemblyVersion("' + $version + '")] [assembly: AssemblyFileVersion("' + $version + '")]'))
    $output = Join-Path $WindowsRoot 'DE-TechTool.exe'
    & $compiler /nologo /target:winexe /platform:x64 /optimize+ /reference:System.Windows.Forms.dll "/out:$output" $source $metadata
    if ($LASTEXITCODE -ne 0) { throw "Native launcher compilation failed: $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $output)) { throw 'Native launcher executable was not created.' }
    Write-Output $output
} finally {
    Remove-Item -LiteralPath $temporary -Recurse -Force
}
