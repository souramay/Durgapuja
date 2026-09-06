@echo off
setlocal
cd /d "%~dp0"

echo.
echo   Sharodiya - starting a local server
echo   ----------------------------------
echo   Opening http://localhost:3000
echo   Leave this window open. Press Ctrl+C to stop.
echo.

where node >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:3000"
  node server.js
  goto done
)

where python >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:3000"
  python -m http.server 3000
  goto done
)

where py >nul 2>nul
if %errorlevel%==0 (
  start "" "http://localhost:3000"
  py -m http.server 3000
  goto done
)

echo   Could not find Python or Node on this machine.
echo   Install either one, or deploy the folder to Vercel.
echo.
pause

:done
endlocal
