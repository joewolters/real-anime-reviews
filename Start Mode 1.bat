@echo off
rem gate 20.5 -- Blake's double-click Mode-1 launcher, rebuilt: the first cut
rem shipped with bare-LF line endings (cmd mis-parsed it; the window flashed
rem and died). CRLF now, an npm presence check, and the window NEVER vanishes
rem silently -- every exit path ends at a visible pause.
title Real Anime Reviews - Mode 1
cd /d "%~dp0"
echo.
echo   Starting Mode 1 (the admin edit server)...
echo   Keep this window open while you work. Close it to stop Mode 1.
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo   Could not find npm on this computer. Install Node.js, then try again.
  echo.
  pause
  exit /b 1
)
call npm run mode1
echo.
echo   Mode 1 stopped. If it stopped right away, the message above says why.
pause
