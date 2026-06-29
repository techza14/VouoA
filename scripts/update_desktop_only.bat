@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"

cd /d "%REPO_ROOT%"

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content manifest.json | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  echo Failed: could not read version from manifest.json
  exit /b 1
)

cd /d "%REPO_ROOT%\desktop_app"

call npm run build
if errorlevel 1 exit /b 1

cd /d "%REPO_ROOT%"

set "PORTABLE_DIR=%CD%\out\VouoA_Desktop_Portable_%APP_VERSION%"
set "SOURCE_EXE=%CD%\desktop_app\src-tauri\target\release\desktop_app.exe"
set "PORTABLE_EXE=%PORTABLE_DIR%\VouoA_Desktop.exe"

if not exist "%CD%\out" mkdir "%CD%\out"
if not exist "%PORTABLE_DIR%" mkdir "%PORTABLE_DIR%"

powershell -NoProfile -Command "$procs = Get-Process | Where-Object { $_.Path -eq '%PORTABLE_EXE%' }; if ($procs) { $procs | Stop-Process -Force -PassThru | Wait-Process }"

copy /y "%SOURCE_EXE%" "%PORTABLE_EXE%" >nul
if errorlevel 1 (
  echo Failed: could not copy desktop exe into portable directory.
  exit /b 1
)

powershell -NoProfile -Command "Start-Process -FilePath '%PORTABLE_EXE%'"

echo Updated portable desktop app: "%PORTABLE_EXE%"
exit /b 0
