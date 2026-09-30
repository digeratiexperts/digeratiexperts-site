@echo off
rem MSP AI Kit launcher (kept for existing shortcuts). Opens DE Tech Tool at its
rem AI Toolkit page; with arguments it runs the AI-kit loader directly, for example:
rem   Start-MspAiKit.cmd -Action All -NonInteractive
rem   Start-MspAiKit.cmd -Action Update -WhatIf
setlocal
set "PS=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"
if exist "%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe" set "PS=%SystemRoot%\Sysnative\WindowsPowerShell\v1.0\powershell.exe"
if "%~1"=="" goto :window
"%PS%" -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%~dp0Install-MspAiKit.ps1" %*
exit /b %ERRORLEVEL%

:window
call "%~dp0Start-DETechTool.cmd" -Page AiToolkit
exit /b %ERRORLEVEL%
