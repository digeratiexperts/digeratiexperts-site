@echo off
rem Compatibility alias for Start-DETechTool.cmd (older shortcuts, RMM scripts and packages call this name).
rem It passes every argument through and returns the same exit code.
call "%~dp0Start-DETechTool.cmd" %*
exit /b %ERRORLEVEL%
