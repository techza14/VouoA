@echo off
setlocal

for %%I in ("%~dp0..") do set "REPO_ROOT=%%~fI"
cd /d "%REPO_ROOT%"

set "OUT_DIR=%CD%\out"
set "STAGE_DIR=%CD%\build\crx_stage"
set "CRX_NAME=VouoA"
set "CRX_OUT=%OUT_DIR%\%CRX_NAME%.crx"
set "PEM_FILE="
set "BROWSER_EXE="

if not exist "%OUT_DIR%" mkdir "%OUT_DIR%"
if exist "%STAGE_DIR%" rmdir /s /q "%STAGE_DIR%"
mkdir "%STAGE_DIR%"

copy /y manifest.json "%STAGE_DIR%\manifest.json" >nul
copy /y background.js "%STAGE_DIR%\background.js" >nul
copy /y content.js "%STAGE_DIR%\content.js" >nul
copy /y content.css "%STAGE_DIR%\content.css" >nul
if exist "%CD%\icons" xcopy /e /i /y "%CD%\icons" "%STAGE_DIR%\icons" >nul

for %%F in ("%OUT_DIR%\*.pem") do (
  if not defined PEM_FILE set "PEM_FILE=%%~fF"
)

if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
)

if not defined BROWSER_EXE (
  echo Failed: Chrome/Edge not found for --pack-extension.
  exit /b 1
)

echo Using browser: "%BROWSER_EXE%"
if defined PEM_FILE (
  echo Using key: "%PEM_FILE%"
  "%BROWSER_EXE%" --pack-extension="%STAGE_DIR%" --pack-extension-key="%PEM_FILE%"
) else (
  echo No existing PEM found under out. A new key will be generated.
  "%BROWSER_EXE%" --pack-extension="%STAGE_DIR%"
)

if errorlevel 1 (
  echo Failed: browser pack-extension command returned an error.
  exit /b 1
)

if not exist "%CD%\build\crx_stage.crx" (
  echo Failed: expected CRX was not generated.
  exit /b 1
)

move /y "%CD%\build\crx_stage.crx" "%CRX_OUT%" >nul
if not defined PEM_FILE if exist "%CD%\build\crx_stage.pem" move /y "%CD%\build\crx_stage.pem" "%OUT_DIR%\crx_build_auto.pem" >nul

echo Built: "%CRX_OUT%"
exit /b 0
