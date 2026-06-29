@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

call "%REPO_ROOT%\scripts\update_bridge_only.bat"
if errorlevel 1 exit /b 1

call "%REPO_ROOT%\scripts\update_desktop_only.bat"
if errorlevel 1 exit /b 1

echo Portable desktop and bridge both updated.
exit /b 0
