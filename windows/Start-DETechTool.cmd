@echo off
rem DE Tech Tool launcher. Double-click to open the console.
rem Requests elevation (identity, security and baseline work need it); the AI Toolkit and
rem audit pages also work unelevated if you decline.
rem   Start-DETechTool.cmd                          open the window
rem   Start-DETechTool.cmd -Resume               reopen after a restart at the queued step
rem   Start-DETechTool.cmd -Headless -Client alamo -Mode audit     RMM audit, evidence bundle, exit code
setlocal
set "CONSOLE=%~dp0console\DETechConsole.ps1"
if not exist "%CONSOLE%" ( echo DETechConsole.ps1 not found next to this launcher. & pause & exit /b 2 )
echo %* | findstr /i /c:"-Headless" >nul
if %errorlevel%==0 (
  powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%CONSOLE%" %*
  exit /b %ERRORLEVEL%
)
net session >nul 2>&1
if %errorlevel% neq 0 (
  powershell.exe -NoProfile -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -Sta -ExecutionPolicy Bypass -File \"%CONSOLE%\" %*'" 2>nul
  if %errorlevel% neq 0 powershell.exe -NoProfile -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
  exit /b 0
)
powershell.exe -NoProfile -NoLogo -Sta -ExecutionPolicy Bypass -File "%CONSOLE%" %*
endlocal & exit /b %ERRORLEVEL%
