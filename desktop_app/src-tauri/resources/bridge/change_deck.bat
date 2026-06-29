@echo off
cd /d "%~dp0"
anki_bridge_server.exe --host 127.0.0.1 --port 5051 --select-deck-on-start --reselect-deck
pause
