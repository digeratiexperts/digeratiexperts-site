@echo off
rem DE Tech Tool launcher. Double-click to open the window.
rem Requests elevation (identity, security and baseline work need it); the AI Toolkit and
rem audit pages also work unelevated if you decline.
rem   Start-DETechTool.cmd                                           open the window
rem   Start-DETechTool.cmd -Resume                                   reopen after a restart at the queued step
rem   Start-DETechTool.cmd -Headless -Client alamo -Mode audit       RMM audit, evidence bundle, exit code
rem Exit codes pass through: 0 ready, 1 not ready or unfinished, 2 blocked or refused.
rem No %ERRORLEVEL% inside ( ) blocks: cmd expands those when it reads the block, which returned 0 for every run.
setlocal
set "CONSOLE=%~dp0console\DETechConsole.ps1"
if not exist "%CONSOLE%" goto :missing
rem Always 64-bit Windows PowerShell: a 32-bit RMM agent or cmd would otherwise start the SysWOW64 copy, which sees
rem WOW6432Node and SysWOW64 instead of the real registry and System32.
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
set "HEADLESS="
for %%A in (%*) do if /i "%%~A"=="-Headless" set "HEADLESS=1"
if defined HEADLESS goto :headless
rem fltmc needs administrator rights and, unlike net session, does not depend on the Server service
fltmc >nul 2>&1
if errorlevel 1 goto :elevate
"%PS%" -NoProfile -NoLogo -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b %ERRORLEVEL%

:headless
"%PS%" -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b %ERRORLEVEL%

:elevate
rem Ask for administrator rights once; open unelevated only when the prompt is declined. The path and arguments go
rem through environment variables so quotes, apostrophes and ampersands survive, and a mapped drive (invisible to the
rem elevated token) is turned into its UNC path.
set "DE_CONSOLE=%CONSOLE%"
set "DE_ARGS=%*"
set "DE_PS=%PS%"
"%PS%" -NoProfile -Command "$p = $env:DE_CONSOLE; $root = [IO.Path]::GetPathRoot($p); if ($root -match '^[A-Za-z]:') { $d = Get-PSDrive -Name $root.Substring(0,1) -ErrorAction SilentlyContinue; if ($d -and $d.DisplayRoot) { $p = $d.DisplayRoot.TrimEnd('\') + $p.Substring(2) } }; try { Start-Process -FilePath $env:DE_PS -Verb RunAs -ErrorAction Stop -ArgumentList ('-NoProfile -Sta -ExecutionPolicy Bypass -File \"' + $p + '\" ' + $env:DE_ARGS); exit 0 } catch { exit 1 }"
if not errorlevel 1 exit /b 0
"%PS%" -NoProfile -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b %ERRORLEVEL%

:missing
echo DETechConsole.ps1 not found next to this launcher.
pause
exit /b 2
