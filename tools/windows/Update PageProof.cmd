@echo off
rem Double-click this to update PageProof. It runs update-pageproof.ps1 (in this same folder).
title PageProof update
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-pageproof.ps1"
echo.
pause
