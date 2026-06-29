@echo off
cd /d "%~dp0"
anki_bridge_server.exe --host 0.0.0.0 --port 5051 --select-deck-on-start
pause
