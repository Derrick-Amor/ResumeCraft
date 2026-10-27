# ResumeCraft - run the four quality gates, write a log file.
# ASCII only on purpose: PowerShell 5.1 reads BOM-less .ps1 as ANSI,
# any non-ASCII character here would turn into mojibake.
#
# Usage:
#   gate.cmd                              -> four gates only
#   gate.cmd src/layout/measure           -> four gates + card acceptance
#
# The optional argument is forwarded to `pnpm test -- <filter>`, which is the
# per-card acceptance command written in docs/plan/TASKS.md. Kept as a
# parameter instead of hardcoding a card, so the script stays generic.
param([string]$Card = '')

$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host '  ResumeCraft - four quality gates' -ForegroundColor Cyan
Write-Host ('  cwd: ' + $root) -ForegroundColor DarkGray
Write-Host '==============================================' -ForegroundColor Cyan

if (-not (Test-Path (Join-Path $root 'package.json'))) {
    Write-Host '[ERROR] package.json not found here.' -ForegroundColor Red
    exit 1
}

# ---- locate pnpm ----
$pnpmExe = 'pnpm'
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    if (Get-Command corepack -ErrorAction SilentlyContinue) {
        $pnpmExe = 'corepack pnpm'
        Write-Host '[info] pnpm shim not found, falling back to: corepack pnpm' -ForegroundColor Yellow
    } else {
        Write-Host '[ERROR] neither pnpm nor corepack is on PATH.' -ForegroundColor Red
        Write-Host '        Run "corepack enable" once in an admin terminal, then retry.' -ForegroundColor Yellow
        exit 1
    }
}

# ---- log file ----
$logDir = Join-Path $root 'docs\verify'
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$log = Join-Path $logDir 'gate-latest.log'
if (Test-Path $log) { Remove-Item $log -Force }

function Add-Log([string]$text) {
    Add-Content -Path $log -Value $text -Encoding UTF8
}

Add-Log 'ResumeCraft - four quality gates'
Add-Log ('time    : ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))
Add-Log ('cwd     : ' + $root)
Add-Log ('pnpm    : ' + $pnpmExe)
Add-Log ''

$names = @('lint', 'type-check', 'test', 'build')
$failedAt = ''
$i = 0

foreach ($name in $names) {
    $i = $i + 1
    $head = '===== [' + $i + '/4] ' + $pnpmExe + ' ' + $name + ' ====='
    Write-Host ''
    Write-Host $head -ForegroundColor Cyan
    Write-Host '  running, please wait ...' -ForegroundColor DarkGray
    Add-Log $head

    $cmdLine = $pnpmExe + ' ' + $name + ' 2>&1'
    $output = cmd /c $cmdLine
    $code = $LASTEXITCODE

    if ($output) {
        foreach ($line in $output) {
            Write-Host $line
            Add-Log ([string]$line)
        }
    }

    Add-Log ('exit code: ' + $code)
    Add-Log ''

    if ($code -ne 0) {
        $failedAt = $name
        break
    }
}

# ---- optional: per-card acceptance command ----
if ($failedAt -eq '' -and $Card -ne '') {
    $head = '===== [card] ' + $pnpmExe + ' test -- ' + $Card + ' ====='
    Write-Host ''
    Write-Host $head -ForegroundColor Cyan
    Write-Host '  running, please wait ...' -ForegroundColor DarkGray
    Add-Log $head

    $cardLine = $pnpmExe + ' test -- ' + $Card + ' 2>&1'
    $cardOut = cmd /c $cardLine
    $cardCode = $LASTEXITCODE

    if ($cardOut) {
        foreach ($line in $cardOut) {
            Write-Host $line
            Add-Log ([string]$line)
        }
    }

    Add-Log ('exit code: ' + $cardCode)
    Add-Log ''

    if ($cardCode -ne 0) {
        $failedAt = 'card acceptance (' + $Card + ')'
    }
}

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
if ($failedAt -eq '') {
    Write-Host '  RESULT: ALL GATES GREEN' -ForegroundColor Green
    Add-Log 'RESULT: ALL GATES GREEN'
} else {
    Write-Host ('  RESULT: FAILED at "' + $failedAt + '"') -ForegroundColor Red
    Add-Log ('RESULT: FAILED at "' + $failedAt + '"')
}
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ('log written to: ' + $log) -ForegroundColor DarkGray
Write-Host ''
