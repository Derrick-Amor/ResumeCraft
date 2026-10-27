@echo off
chcp 65001 >nul
title ResumeCraft - four quality gates
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0gate.ps1" %*
echo.
echo ----------------------------------------------
echo  Done. You can close this window, or tell the
echo  assistant "ran it" and it will read the log.
echo ----------------------------------------------
pause >nul
