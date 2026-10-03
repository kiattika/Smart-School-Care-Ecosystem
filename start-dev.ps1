<#
.SYNOPSIS
    Start local dev environment for Smart School Care Ecosystem
    (Firebase Emulator Suite + Vite dev server)

.NOTES
    - Run from the project root, or edit $ProjectPath below.
    - If script execution is blocked, run once:
        Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
    - Stop the system with Ctrl+C in the emulator window ONLY.
      Do not use kill-port -- it skips --export-on-exit and data will be lost.
#>

$ErrorActionPreference = "Stop"

# ----- Adjust path if needed -----
$ProjectPath  = "E:\myproject\smart-school-care-ecosystem"
$EmulatorData = "./emulator-data"

# ----- Check project folder exists -----
if (-not (Test-Path $ProjectPath)) {
    Write-Host "Project folder not found: $ProjectPath" -ForegroundColor Red
    exit 1
}

Write-Host "==> Starting Firebase Emulator Suite in a new window..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ProjectPath'; firebase emulators:start --import=$EmulatorData --export-on-exit=$EmulatorData"
)

Write-Host "==> Waiting for emulator to be ready (about 8 seconds)..." -ForegroundColor Cyan
Start-Sleep -Seconds 8

Write-Host "==> Starting Vite dev server in a new window..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$ProjectPath'; npm run dev"
)

Write-Host ""
Write-Host "==> All services started:" -ForegroundColor Green
Write-Host "    Emulator UI : http://localhost:4000"
Write-Host "    Vite App    : http://localhost:5173"
Write-Host ""
Write-Host "NOTE: Always stop with Ctrl+C in the emulator window before closing it." -ForegroundColor Yellow
