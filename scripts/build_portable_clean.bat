@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content manifest.json | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  echo Failed: could not read version from manifest.json
  exit /b 1
)

set "OUT_DIR=%CD%\out"
set "BUILD_DIR=%CD%\build"
set "STAGE_DIR=%BUILD_DIR%\portable_clean_stage"
set "PORTABLE_NAME=VouoA_Desktop_Portable_%APP_VERSION%"
set "PORTABLE_DIR=%OUT_DIR%\%PORTABLE_NAME%"
set "PORTABLE_ZIP=%OUT_DIR%\%PORTABLE_NAME%.zip"
set "DESKTOP_EXE_SOURCE=%CD%\desktop_app\src-tauri\target\release\desktop_app.exe"
set "BRIDGE_EXE_SOURCE=%CD%\dist\anki_bridge_server.exe"
set "BRIDGE_RES_DIR=%CD%\desktop_app\src-tauri\resources\bridge"
set "PORTABLE_DESKTOP_EXE=%PORTABLE_DIR%\desktop_app.exe"
set "PORTABLE_BRIDGE_EXE=%PORTABLE_DIR%\bridge\anki_bridge_server.exe"

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

echo [1/5] Checking Python bridge source...
python -m py_compile tools\anki_bridge_server.py
if errorlevel 1 exit /b 1

echo [2/5] Building bridge executable...
python -m PyInstaller --clean --noconfirm anki_bridge_server.spec
if errorlevel 1 exit /b 1

echo [3/5] Building desktop executable...
cd /d "%CD%\desktop_app"
call npm run build
if errorlevel 1 exit /b 1
cd /d "%REPO_ROOT%"

if not exist "%DESKTOP_EXE_SOURCE%" (
  echo Failed: desktop executable not found: "%DESKTOP_EXE_SOURCE%"
  exit /b 1
)

if not exist "%BRIDGE_EXE_SOURCE%" (
  echo Failed: bridge executable not found: "%BRIDGE_EXE_SOURCE%"
  exit /b 1
)

if not exist "%BRIDGE_RES_DIR%" (
  echo Failed: bridge resources not found: "%BRIDGE_RES_DIR%"
  exit /b 1
)

echo [4/5] Creating clean portable staging directory...
if exist "%PORTABLE_DESKTOP_EXE%" powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -eq '%PORTABLE_DESKTOP_EXE%' } | Stop-Process -Force"
if exist "%PORTABLE_BRIDGE_EXE%" powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -eq '%PORTABLE_BRIDGE_EXE%' } | Stop-Process -Force"
if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%PORTABLE_DIR%" (
  echo Failed: existing portable directory is still locked: "%PORTABLE_DIR%"
  exit /b 1
)
mkdir "%STAGE_DIR%"
mkdir "%STAGE_DIR%\bridge"

copy /y "%DESKTOP_EXE_SOURCE%" "%STAGE_DIR%\desktop_app.exe" >nul
copy /y "%BRIDGE_EXE_SOURCE%" "%STAGE_DIR%\bridge\anki_bridge_server.exe" >nul
copy /y "%BRIDGE_RES_DIR%\anki_bridge_config.json" "%STAGE_DIR%\bridge\anki_bridge_config.json" >nul
copy /y "%BRIDGE_RES_DIR%\change_deck.bat" "%STAGE_DIR%\bridge\change_deck.bat" >nul
copy /y "%BRIDGE_RES_DIR%\ffmpeg.exe" "%STAGE_DIR%\bridge\ffmpeg.exe" >nul
copy /y "%BRIDGE_RES_DIR%\README.txt" "%STAGE_DIR%\bridge\README.txt" >nul
copy /y "%BRIDGE_RES_DIR%\start.bat" "%STAGE_DIR%\bridge\start.bat" >nul

if exist "%STAGE_DIR%\vouoa_desktop.log" del /f /q "%STAGE_DIR%\vouoa_desktop.log"
if exist "%STAGE_DIR%\bridge\anki_bridge.log" del /f /q "%STAGE_DIR%\bridge\anki_bridge.log"

move /y "%STAGE_DIR%" "%PORTABLE_DIR%" >nul

echo [5/5] Creating release zip...
if exist "%PORTABLE_ZIP%" del /f /q "%PORTABLE_ZIP%"
tar -a -cf "%PORTABLE_ZIP%" -C "%OUT_DIR%" "%PORTABLE_NAME%"
if errorlevel 1 exit /b 1

echo Done.
echo Portable directory: "%PORTABLE_DIR%"
echo Release zip: "%PORTABLE_ZIP%"
exit /b 0
