@echo off
setlocal
cd /d "%~dp0"

where ffmpeg >nul 2>nul
if not %errorlevel%==0 (
  echo.
  echo   ffmpeg is not installed.
  echo.
  echo   Install it, then run this again:
  echo       winget install Gyan.FFmpeg
  echo.
  echo   Close and reopen this window afterwards so PATH updates.
  echo.
  pause
  exit /b 1
)

if "%~1"=="" (
  echo.
  echo   Drag a video file onto this .bat to shrink it for the web.
  echo   Or:  compress-video.bat media\ascii-magic.mp4
  echo.
  pause
  exit /b 1
)

set "IN=%~1"
set "OUT=%~dpn1-web.mp4"

echo.
echo   Compressing "%~nx1"
echo   1600px wide, 24fps, no audio - typically 10-20x smaller
echo.

ffmpeg -y -i "%IN%" -an -vf "scale=1600:-2,fps=24" -c:v libx264 -crf 30 ^
       -preset slow -pix_fmt yuv420p -movflags +faststart "%OUT%"

echo.
echo   Done:  %OUT%
echo   Point BACKGROUND in config.js at it, then delete the big original.
echo.
pause
endlocal
