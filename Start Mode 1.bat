@echo off
rem gate 20 — Blake's double-click Mode-1 launcher (no VS Code, no typed commands).
rem Lives in the project root next to package.json; %~dp0 keeps it working from
rem a desktop SHORTCUT too (right-click this file -> Send to -> Desktop).
title Real Anime Reviews - Mode 1
cd /d "%~dp0"
echo.
echo   Starting Mode 1 (the admin edit server)...
echo   Keep this window open while you work. Close it to stop.
echo.
call npm run mode1
echo.
echo   Mode 1 stopped.
pause
