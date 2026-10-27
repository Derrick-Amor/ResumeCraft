@echo off
chcp 65001 >nul
title ResumeCraft - git commit
cd /d "%~dp0.."

where git >nul 2>nul
if errorlevel 1 (
  echo [ERROR] git not found on PATH.
  echo Install Git for Windows, or commit manually.
  pause
  exit /b 1
)

if not exist ".git" (
  echo [ERROR] .git not found in %CD%
  pause
  exit /b 1
)

echo ============================================
echo  Repo : %CD%
echo  Branch:
git branch --show-current
echo ============================================
echo.

echo ---- changed files ----
git status --short
echo.

set DIRTY=
for /f %%i in ('git status --porcelain') do set DIRTY=1
if not defined DIRTY (
  echo Nothing to commit. Working tree is clean.
  echo.
  pause
  exit /b 0
)

echo ---- staging ----
git add -A
if errorlevel 1 (
  echo [ERROR] git add failed.
  pause
  exit /b 1
)

echo ---- committing ----
git commit -F "%~dp0commit-message.txt"
if errorlevel 1 (
  echo.
  echo [ERROR] commit failed. Read the message above.
  pause
  exit /b 1
)

echo.
echo ---- last commit ----
git log --oneline -1
echo.

set PUSH=
set /p PUSH=Push to origin now? [y/N] 
if /i "%PUSH%"=="y" (
  echo ---- pushing ----
  git push
  if errorlevel 1 (
    echo.
    echo [WARN] push failed. Commit is safe locally; push can be retried later.
  )
)

echo.
echo ============================================
echo  Done.
echo ============================================
pause >nul
