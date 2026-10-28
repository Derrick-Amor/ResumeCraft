@echo off
chcp 65001 >nul
title ResumeCraft - font assets check
cd /d "%~dp0.."

set FONTDIR=src\assets\fonts
set LOG=docs\verify\font-check.log

if not exist "%LOG%" (
  if not exist "docs\verify" mkdir "docs\verify" >nul 2>nul
)

echo ResumeCraft - font assets check > "%LOG%"
echo time   : %DATE% %TIME% >> "%LOG%"
echo dir    : %CD%\%FONTDIR% >> "%LOG%"
echo. >> "%LOG%"

echo ============================================
echo  Font assets check
echo  %CD%\%FONTDIR%
echo ============================================
echo.

if not exist "%FONTDIR%" (
  echo [MISSING] folder not found: %FONTDIR%
  echo [MISSING] folder not found: %FONTDIR% >> "%LOG%"
  echo.
  pause
  exit /b 1
)

echo ---- tree ----
echo ---- tree ---- >> "%LOG%"
for /r "%FONTDIR%" %%f in (*) do (
  echo   %%~nxf  %%~zf bytes
  echo   %%~nxf  %%~zf bytes >> "%LOG%"
)
echo.

echo ---- expected 5 woff2 + 5 ttf + OFL.txt ----
echo ---- expected ---- >> "%LOG%"

set MISSING=0
for %%n in (rc-sans-400 rc-sans-500 rc-sans-700 rc-serif-400 rc-serif-600) do (
  if exist "%FONTDIR%\woff2\%%n.woff2" (
    echo   OK  woff2\%%n.woff2
    echo   OK  woff2\%%n.woff2 >> "%LOG%"
  ) else (
    echo   --  woff2\%%n.woff2  MISSING
    echo   --  woff2\%%n.woff2  MISSING >> "%LOG%"
    set MISSING=1
  )
  if exist "%FONTDIR%\ttf\%%n.ttf" (
    echo   OK  ttf\%%n.ttf
    echo   OK  ttf\%%n.ttf >> "%LOG%"
  ) else (
    echo   --  ttf\%%n.ttf  MISSING
    echo   --  ttf\%%n.ttf  MISSING >> "%LOG%"
    set MISSING=1
  )
)

if exist "%FONTDIR%\OFL.txt" (
  echo   OK  OFL.txt
  echo   OK  OFL.txt >> "%LOG%"
) else (
  echo   --  OFL.txt  MISSING
  echo   --  OFL.txt  MISSING >> "%LOG%"
  set MISSING=1
)

echo.
echo ---- sha256 (fill into docs/font-license.md section 5) ----
echo ---- sha256 ---- >> "%LOG%"
for /r "%FONTDIR%" %%f in (*.woff2 *.ttf) do (
  certutil -hashfile "%%f" SHA256 | findstr /v ":" | findstr /v "SHA256" | findstr /v "CertUtil" >> "%LOG%"
  echo   %%~nxf >> "%LOG%"
)

echo.
if "%MISSING%"=="1" (
  echo RESULT: INCOMPLETE - some files missing.
  echo RESULT: INCOMPLETE >> "%LOG%"
) else (
  echo RESULT: COMPLETE - all 11 files present.
  echo RESULT: COMPLETE >> "%LOG%"
)

echo.
echo Log written to %LOG%
echo Tell the assistant "font check done" and it will read the log.
echo.
pause >nul
