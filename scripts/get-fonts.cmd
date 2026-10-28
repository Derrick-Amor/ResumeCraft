@echo off
chcp 65001 >nul
title ResumeCraft - get fonts
cd /d "%~dp0.."

set PY=
where python >nul 2>nul && set PY=python
if not defined PY where py >nul 2>nul && set PY=py -3

if not defined PY (
  echo [ERROR] Python not found.
  echo.
  echo Please install Python 3.9+ from https://www.python.org/downloads/
  echo IMPORTANT: tick "Add python.exe to PATH" in the installer.
  echo.
  pause
  exit /b 1
)

echo ============================================
echo  ResumeCraft - download and subset fonts
echo  Python: %PY%
echo ============================================
echo.

%PY% "%~dp0get-fonts.py"

echo.
echo ----------------------------------------------
echo  Done. Log: docs\verify\font-fetch.log
echo ----------------------------------------------
pause >nul
