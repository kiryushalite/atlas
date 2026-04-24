@echo off
setlocal
cd /d "%~dp0"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"

echo Starting Atlas desktop...
echo Keep this window open while Atlas is running.

npm.cmd run tauri dev

echo.
echo Atlas desktop stopped.
pause
