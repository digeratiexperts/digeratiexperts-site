<#
  setup-de-web-skills.ps1  (Digerati Experts)

  Installs the skills kept in "C:\Users\Joe\Documents\AI Website Skills" for
  Claude Code on this PC, optionally into this repository as project skills
  (so cloud sessions and every agent get them too), and sets KIE_AI_API_KEY
  for local sessions. Nothing here calls kie.ai.

  Run in PowerShell on the PC (one paste):

    powershell -ExecutionPolicy Bypass -File .\setup-de-web-skills.ps1 `
      -RepoPath "C:\path\to\digeratiexperts-site" -Push

  Parameters
    -SkillsSource  folder to read; default  %USERPROFILE%\Documents\AI Website Skills
    -RepoPath      a git checkout of digeratiexperts-site; when given, the skills are
                   also copied to <repo>\.claude\skills\ and .env gets the key
    -Push          with -RepoPath: commit the project skills on branch
                   joe/ai-website-skills and push it, so Claude can review and wire them
    -SkipKey       leave the KIE_AI_API_KEY variable alone

  What a "skill" is here: any folder containing SKILL.md (copied as-is), or a
  loose .md file at the top of the source folder (wrapped into <name>\SKILL.md
  with the frontmatter Claude Code expects). Personal skills live in
  %USERPROFILE%\.claude\skills and show up in every project on this PC.
#>
param(
  [string]$SkillsSource = (Join-Path $env:USERPROFILE "Documents\AI Website Skills"),
  [string]$RepoPath = "",
  [switch]$Push,
  [switch]$SkipKey
)

$ErrorActionPreference = "Stop"
function Say([string]$m) { Write-Host "[de-skills] $m" }
function SafeName([string]$s) { return (($s -replace '[^A-Za-z0-9._-]', '-') -replace '-+', '-').Trim('-').ToLower() }

if (-not (Test-Path -LiteralPath $SkillsSource)) { throw "Skills folder not found: $SkillsSource" }

# ---------------------------------------------------------------- 1. personal skills
$personal = Join-Path $env:USERPROFILE ".claude\skills"
New-Item -ItemType Directory -Force -Path $personal | Out-Null
$installed = @()

$skillDirs = Get-ChildItem -LiteralPath $SkillsSource -Recurse -Filter "SKILL.md" -File |
  ForEach-Object { $_.Directory } | Sort-Object FullName -Unique
foreach ($d in $skillDirs) {
  $name = SafeName $d.Name
  $dest = Join-Path $personal $name
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  Copy-Item -Path (Join-Path $d.FullName "*") -Destination $dest -Recurse -Force
  $installed += $name
  Say "skill folder  $($d.FullName)  ->  $dest"
}

$loose = Get-ChildItem -LiteralPath $SkillsSource -Filter "*.md" -File | Where-Object { $_.Name -ne "SKILL.md" }
foreach ($f in $loose) {
  $name = SafeName ([IO.Path]::GetFileNameWithoutExtension($f.Name))
  $dest = Join-Path $personal $name
  New-Item -ItemType Directory -Force -Path $dest | Out-Null
  $body = Get-Content -Raw -LiteralPath $f.FullName
  if ($body -notmatch '^\s*---\s*\r?\n') {
    $firstLine = ($body -split "`r?`n" | Where-Object { $_.Trim() -ne "" -and $_ -notmatch '^\s*#' } | Select-Object -First 1)
    if (-not $firstLine) { $firstLine = "Website skill $name" }
    $desc = ($firstLine.Trim() -replace '"', "'")
    if ($desc.Length -gt 200) { $desc = $desc.Substring(0, 200) }
    $body = "---`nname: $name`ndescription: `"$desc`"`n---`n`n" + $body
  }
  Set-Content -LiteralPath (Join-Path $dest "SKILL.md") -Value $body -Encoding UTF8
  $installed += $name
  Say "loose file    $($f.Name)  ->  $dest\SKILL.md (frontmatter added)"
}

$installed = $installed | Sort-Object -Unique
if ($installed.Count -eq 0) { Say "no SKILL.md folders or .md files found in $SkillsSource" }

# ---------------------------------------------------------------- 2. project skills
if ($RepoPath) {
  if (-not (Test-Path -LiteralPath (Join-Path $RepoPath ".git"))) { throw "Not a git checkout: $RepoPath" }
  $project = Join-Path $RepoPath ".claude\skills"
  New-Item -ItemType Directory -Force -Path $project | Out-Null
  $copied = @()
  foreach ($name in $installed) {
    $dest = Join-Path $project $name
    if (Test-Path -LiteralPath $dest) { Say "project skill already exists, left untouched: $name"; continue }
    Copy-Item -LiteralPath (Join-Path $personal $name) -Destination $dest -Recurse -Force
    $copied += $name
    Say "project skill $name  ->  $dest"
  }
  if ($Push -and $copied.Count -gt 0) {
    Push-Location $RepoPath
    try {
      git fetch origin main | Out-Null
      git checkout -B joe/ai-website-skills origin/main | Out-Null
      git add .claude/skills
      git commit -m "chore(claude): add Joe's AI Website Skills as project skills ($($copied -join ', '))" | Out-Null
      git push -u origin joe/ai-website-skills
      Say "pushed branch joe/ai-website-skills; tell Claude to review and wire the skills"
    } finally { Pop-Location }
  } elseif ($Push) {
    Say "nothing new to push (all skills already present in the repo)"
  }
}

# ---------------------------------------------------------------- 3. the key
if (-not $SkipKey) {
  $secure = Read-Host -Prompt "Paste your kie.ai API key (saved as the Windows user variable KIE_AI_API_KEY; leave empty to skip)" -AsSecureString
  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  if ($key) {
    [Environment]::SetEnvironmentVariable("KIE_AI_API_KEY", $key, "User")
    $env:KIE_AI_API_KEY = $key
    Say "KIE_AI_API_KEY saved for your Windows user (this window and every new terminal see it)"
    if ($RepoPath) {
      $envFile = Join-Path $RepoPath ".env"
      $lines = @()
      if (Test-Path -LiteralPath $envFile) {
        $lines = Get-Content -LiteralPath $envFile | Where-Object { $_ -notmatch '^\s*KIE_AI_API_KEY\s*=' }
      }
      $lines += "KIE_AI_API_KEY=$key"
      Set-Content -LiteralPath $envFile -Value $lines -Encoding ASCII
      Say ".env written in the repo checkout (git-ignored; never committed)"
    }
  } else {
    Say "key skipped"
  }
}

Say "done. Skills installed: $($installed -join ', ')"
Say "In Claude Code on this PC, type / to see them. Cloud sessions need the same variable and the kie.ai hosts in the cloud environment: claude.ai/code > cloud icon above the message box > gear on the environment."
