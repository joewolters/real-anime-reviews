@echo off
rem gate 20.5 -- Blake's double-click Mode-1 launcher, rebuilt: the first cut
rem shipped with bare-LF line endings (cmd mis-parsed it; the window flashed
rem and died). CRLF now, an npm presence check, and the window NEVER vanishes
rem silently -- every exit path ends at a visible pause.
rem gate v1.10.2R -- friendlier: greeting banner up top, a pre-flight port
rem check so double-click #2 opens the browser instead of crashing into an
rem npm ERR wall, a node_modules one-time-setup check, and the server itself
rem now opens the browser when it is ready (see scripts/mode1-server.js).
title Real Anime Reviews - Mode 1
cd /d "%~dp0"
echo.
echo  =====================================================
echo    Real Anime Reviews - Mode 1
echo  =====================================================
echo.
echo   Mode 1 is your admin tool for adding and editing anime.
echo   Your browser will open to the Mode 1 page by itself.
echo.
echo   Keep this window open while you work.
echo   Close this window when you are done to stop Mode 1.
echo.

rem -- Already running? (double-click #2) ------------------------------------
rem Identity-checked (adversarial fix): only a real Mode 1 answers /api/health
rem with "mode1" -- a stray app merely holding port 8888 no longer counts as
rem running. If curl is missing the check fails safe: we fall through and the
rem server's own friendly already-running handler takes over.
curl -s --max-time 2 "http://127.0.0.1:8888/api/health" 2>nul | findstr /c:"mode1" >nul
if not errorlevel 1 (
  echo   Mode 1 is already running -- opening your browser to it now.
  echo.
  echo   You can close this window. The other Mode 1 window is the one
  echo   keeping it running.
  echo.
  rem MODE1_NO_OPEN is the same off-switch the server honors (tests set it).
  if not defined MODE1_NO_OPEN start "" "http://localhost:8888/admin/new-anime"
  pause
  exit /b 0
)

rem -- One-time setup done? --------------------------------------------------
if not exist "node_modules\" (
  echo   Mode 1 needs a one-time setup that has not been done on this
  echo   computer yet ^(a folder called "node_modules" is missing^).
  echo.
  echo   Nothing is broken -- it just needs to be set up once.
  echo   Ask for help with that, then double-click this icon again.
  echo.
  pause
  exit /b 1
)

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
