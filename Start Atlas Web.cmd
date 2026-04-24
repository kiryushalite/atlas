@echo off
setlocal
cd /d "%~dp0"

echo Starting Atlas web server...
echo Keep the "Atlas Vite" window open while using Atlas in the browser.

start "Atlas Vite" cmd /k "cd /d ""%~dp0"" && npm.cmd run dev -- --port 1420"

powershell -NoProfile -ExecutionPolicy Bypass -Command "for ($i = 0; $i -lt 60; $i++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:1420/' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:1420/'; exit 0 } } catch {}; Start-Sleep -Seconds 1 }; exit 1"

if errorlevel 1 (
  echo Atlas did not answer at http://127.0.0.1:1420/
  echo Check the "Atlas Vite" window for errors.
  pause
)
