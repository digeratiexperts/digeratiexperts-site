@echo off
rem MSP AI Kit launcher (kept for existing shortcuts). Opens DE Tech Tool at its
rem AI Toolkit page; with arguments it runs the AI-kit loader directly, for example:
rem   Start-MspAiKit.cmd -Action All -NonInteractive
rem   Start-MspAiKit.cmd -Action Update -WhatIf
setlocal
if "%~1"=="" goto :window
powershell.exe -NoProfile -NoLogo -ExecutionPolicy Bypass -File "%~dp0Install-MspAiKit.ps1" %*
exit /b %ERRORLEVEL%

:window
call "%~dp0Start-DETechTool.cmd" -Page AiToolkit
exit /b %ERRORLEVEL%
