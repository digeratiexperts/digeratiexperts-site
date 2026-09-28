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
echo %* | findstr /i /c:"-Headless" >nul
if not errorlevel 1 goto :headless
net session >nul 2>&1
if errorlevel 1 goto :elevate
powershell.exe -NoProfile -NoLogo -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b %ERRORLEVEL%

:headless
powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b %ERRORLEVEL%

:elevate
rem Ask for administrator rights once; open unelevated only when the prompt is declined.
powershell.exe -NoProfile -Command "try { Start-Process powershell.exe -Verb RunAs -ErrorAction Stop -ArgumentList '-NoProfile -Sta -ExecutionPolicy Bypass -File \"%CONSOLE%\" %*'; exit 0 } catch { exit 1 }"
if errorlevel 1 powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
exit /b 0

:missing
echo DETechConsole.ps1 not found next to this launcher.
pause
exit /b 2
