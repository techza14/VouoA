@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content manifest.json | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  echo Failed: could not read version from manifest.json
  exit /b 1
)

set "PORTABLE_DIR=%CD%\out\VouoA_Desktop_Portable_%APP_VERSION%"
set "BRIDGE_DIR=%PORTABLE_DIR%\bridge"
set "DIST_EXE=%CD%\dist\anki_bridge_server.exe"
set "PORTABLE_EXE=%BRIDGE_DIR%\anki_bridge_server.exe"
set "BRIDGE_RES_DIR=%CD%\desktop_app\src-tauri\resources\bridge"

if not exist "%CD%\out" mkdir "%CD%\out"
if not exist "%PORTABLE_DIR%" mkdir "%PORTABLE_DIR%"
if not exist "%BRIDGE_DIR%" mkdir "%BRIDGE_DIR%"

if not exist "%BRIDGE_RES_DIR%" (
  echo Failed: bridge resources not found: "%BRIDGE_RES_DIR%"
  exit /b 1
)

python -m py_compile tools\anki_bridge_server.py
if errorlevel 1 exit /b 1

python -m PyInstaller --clean --noconfirm anki_bridge_server.spec
if errorlevel 1 exit /b 1

powershell -NoProfile -Command "$procs = Get-Process | Where-Object { $_.Path -eq '%PORTABLE_EXE%' }; if ($procs) { $procs | Stop-Process -Force -PassThru | Wait-Process }"

xcopy /e /i /y "%BRIDGE_RES_DIR%\*" "%BRIDGE_DIR%\" >nul
if errorlevel 1 (
  echo Failed: could not copy bridge resources into portable directory.
  exit /b 1
)

copy /y "%DIST_EXE%" "%PORTABLE_EXE%" >nul
if errorlevel 1 (
  echo Failed: could not copy bridge exe into portable directory.
  exit /b 1
)

powershell -NoProfile -Command "Start-Process -FilePath '%PORTABLE_EXE%' -ArgumentList '--host','0.0.0.0','--port','5051' -WindowStyle Hidden"
if errorlevel 1 (
  echo Failed: could not start portable bridge.
  exit /b 1
)

powershell -NoProfile -Command "$deadline = [DateTime]::UtcNow.AddSeconds(15); $ready = $false; while ([DateTime]::UtcNow -lt $deadline) { try { $response = Invoke-RestMethod -Uri 'http://127.0.0.1:5051/health' -TimeoutSec 2; if ($response) { $ready = $true; break } } catch {}; Start-Sleep -Milliseconds 300 }; if (-not $ready) { exit 1 }"
if errorlevel 1 (
  echo Failed: portable bridge did not become healthy within 15 seconds.
  exit /b 1
)

echo Updated portable bridge: "%PORTABLE_EXE%"
exit /b 0
