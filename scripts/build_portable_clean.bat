@echo off
setlocal EnableExtensions EnableDelayedExpansion

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

for /f "usebackq delims=" %%V in (`powershell -NoProfile -Command "(Get-Content manifest.json | ConvertFrom-Json).version"`) do set "APP_VERSION=%%V"
if not defined APP_VERSION (
  echo Failed: could not read version from manifest.json
  exit /b 1
)

set "OUT_DIR=%CD%\out"
set "BUILD_DIR=%CD%\build"
set "PORTABLE_NAME=VouoA_Desktop_Portable_%APP_VERSION%"
set "PORTABLE_DIR=%OUT_DIR%\%PORTABLE_NAME%"
set "PORTABLE_ZIP=%OUT_DIR%\%PORTABLE_NAME%.zip"
set "PORTABLE_ZIP_TMP=%BUILD_DIR%\%PORTABLE_NAME%.zip"
set "TARGET_ZIP=%PORTABLE_ZIP%"
set "DESKTOP_APP_DIR=%CD%\desktop_app"
set "DESKTOP_EXE_SOURCE="
set "BRIDGE_EXE_SOURCE=%CD%\dist\anki_bridge_server.exe"
set "BRIDGE_RES_DIR=%CD%\desktop_app\src-tauri\resources\bridge"
set "PORTABLE_DESKTOP_EXE=%PORTABLE_DIR%\VouoA_Desktop.exe"
set "PORTABLE_BRIDGE_EXE=%PORTABLE_DIR%\bridge\anki_bridge_server.exe"
set "FFMPEG_SOURCE="

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if not exist "%BUILD_DIR%" mkdir "%BUILD_DIR%"

echo [1/5] Checking Python bridge source...
python -m py_compile tools\anki_bridge_server.py
if errorlevel 1 exit /b 1

echo [2/5] Building bridge executable...
python -m PyInstaller --clean --noconfirm anki_bridge_server.spec
if errorlevel 1 exit /b 1

echo [3/5] Building desktop executable...
cd /d "%DESKTOP_APP_DIR%"
if not exist "node_modules\.bin\tauri.cmd" (
  echo Tauri CLI not found under desktop_app\node_modules. Running npm ci...
  call npm ci
  if errorlevel 1 exit /b 1
)
call node_modules\.bin\tauri.cmd build --no-bundle
if errorlevel 1 exit /b 1
cd /d "%REPO_ROOT%"

for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$candidates = @(); $preferred = Join-Path '%DESKTOP_APP_DIR%' 'src-tauri\\target\\release\\desktop_app.exe'; if (Test-Path $preferred) { $candidates += Get-Item $preferred }; $topLevel = Get-ChildItem -Path (Join-Path '%DESKTOP_APP_DIR%' 'src-tauri\\target\\release') -Filter *.exe -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending; if ($topLevel) { $candidates += $topLevel }; $choice = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($choice) { $choice.FullName }"`) do set "DESKTOP_EXE_SOURCE=%%P"

if not defined DESKTOP_EXE_SOURCE (
  echo Failed: desktop executable was not produced by the Tauri build.
  exit /b 1
)

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

if exist "%BRIDGE_RES_DIR%\ffmpeg.exe" (
  set "FFMPEG_SOURCE=%BRIDGE_RES_DIR%\ffmpeg.exe"
) else (
  for /f "usebackq delims=" %%F in (`powershell -NoProfile -Command "$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue; if ($ffmpeg) { $ffmpeg.Source }"`) do set "FFMPEG_SOURCE=%%F"
)

if not defined FFMPEG_SOURCE (
  echo Failed: ffmpeg.exe was not found.
  echo Put ffmpeg.exe in "%BRIDGE_RES_DIR%" or make ffmpeg available on PATH before packaging.
  exit /b 1
)

echo [4/5] Creating clean portable staging directory...
if exist "%PORTABLE_DESKTOP_EXE%" powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -eq '%PORTABLE_DESKTOP_EXE%' } | Stop-Process -Force"
if exist "%PORTABLE_BRIDGE_EXE%" powershell -NoProfile -Command "Get-Process | Where-Object { $_.Path -eq '%PORTABLE_BRIDGE_EXE%' } | Stop-Process -Force"
if exist "%PORTABLE_DIR%" rmdir /s /q "%PORTABLE_DIR%"
if exist "%PORTABLE_DIR%" (
  echo Failed: existing portable directory is still locked: "%PORTABLE_DIR%"
  exit /b 1
)
mkdir "%PORTABLE_DIR%"
mkdir "%PORTABLE_DIR%\bridge"

copy /y "%DESKTOP_EXE_SOURCE%" "%PORTABLE_DIR%\VouoA_Desktop.exe" >nul
if errorlevel 1 exit /b 1
copy /y "%BRIDGE_EXE_SOURCE%" "%PORTABLE_DIR%\bridge\anki_bridge_server.exe" >nul
if errorlevel 1 exit /b 1
copy /y "%FFMPEG_SOURCE%" "%PORTABLE_DIR%\bridge\ffmpeg.exe" >nul
if errorlevel 1 exit /b 1

if exist "%PORTABLE_DIR%\vouoa_desktop.log" del /f /q "%PORTABLE_DIR%\vouoa_desktop.log"
if exist "%PORTABLE_DIR%\bridge\anki_bridge.log" del /f /q "%PORTABLE_DIR%\bridge\anki_bridge.log"

echo [5/5] Creating release zip...
if exist "%PORTABLE_ZIP%" del /f /q "%PORTABLE_ZIP%"
if exist "%PORTABLE_ZIP%" (
  set "TARGET_ZIP=%OUT_DIR%\%PORTABLE_NAME%-new.zip"
  echo Existing release zip is locked. Writing a new file instead:
  echo "!TARGET_ZIP!"
)
if exist "%PORTABLE_ZIP_TMP%" del /f /q "%PORTABLE_ZIP_TMP%"
tar -a -cf "%PORTABLE_ZIP_TMP%" -C "%OUT_DIR%" "%PORTABLE_NAME%"
if errorlevel 1 exit /b 1
if exist "!TARGET_ZIP!" del /f /q "!TARGET_ZIP!"
if exist "!TARGET_ZIP!" (
  echo Failed: target release zip is still locked: "!TARGET_ZIP!"
  exit /b 1
)
move /y "%PORTABLE_ZIP_TMP%" "!TARGET_ZIP!" >nul
if errorlevel 1 (
  echo Failed: could not write release zip: "!TARGET_ZIP!"
  echo The target zip may still be locked by another process.
  exit /b 1
)

echo Done.
echo Portable directory: "%PORTABLE_DIR%"
echo Release zip: "!TARGET_ZIP!"
exit /b 0
