@echo off
rem Digerati Experts MSP AI Kit - Windows launcher.
rem Double-click for the DE window (falls back to a text menu), or pass loader options straight through:
rem   Start-MspAiKit.cmd -Action All -NonInteractive
rem   Start-MspAiKit.cmd -Action Build -Set sla.confirmed=true -WhatIf
rem Runs Windows PowerShell 5.1 (the DE default for endpoint tooling) with the
rem execution policy bypassed for this process only; nothing is changed machine-wide.
setlocal
set "LOADER=%~dp0Install-MspAiKit.ps1"
if not exist "%LOADER%" (
  echo Install-MspAiKit.ps1 was not found next to this launcher.
  pause
  exit /b 2
)
powershell.exe -NoProfile -NoLogo -Sta -ExecutionPolicy Bypass -File "%LOADER%" %*
set "RC=%ERRORLEVEL%"
if "%~1"=="" (
  echo.
  echo Exit code %RC%  (0 ok, 1 failed, 2 blocked or bad input)
  pause
)
endlocal & exit /b %RC%
