# Vaeloom Vault Sync — Windows PowerShell Automated Installer
param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\VaeloomSync",
    [switch]$SkipGitCheck
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "          Vaeloom Vault Git Sync Companion Installer      " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check Git prerequisite
if (-not $SkipGitCheck) {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Error "Git was not found on PATH. Git is required for vault synchronization. Please install Git for Windows (https://git-scm.com/) and rerun this script."
        exit 1
    }
    Write-Host "[OK] Git detected: $(git --version)" -ForegroundColor Green
}

# 2. Check Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js was not found on PATH. Node.js 18+ is required. Please install Node.js (https://nodejs.org/) and rerun this script."
    exit 1
}
Write-Host "[OK] Node.js detected: $(node --version)" -ForegroundColor Green

# 3. Create target directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
}

# 4. Copy/install companion files
Write-Host "Installing @vaeloom/vault-sync companion..." -ForegroundColor Yellow
$PacakgeRoot = Split-Path -Parent $PSScriptRoot
if (Test-Path "$PacakgeRoot\dist\src\cli.js") {
    Copy-Item -Recurse -Force "$PacakgeRoot\dist" "$InstallDir\dist"
    Copy-Item -Force "$PacakgeRoot\package.json" "$InstallDir\package.json"
} else {
    npm install -g @vaeloom/vault-sync
}

# 5. Create vaultsync.cmd wrapper for easy terminal access
$CmdWrapper = @"
@echo off
node "$InstallDir\dist\src\cli.js" %*
"@
Set-Content -Path "$InstallDir\vaultsync.cmd" -Value $CmdWrapper -Encoding ASCII

# 6. Add to user PATH if not present
$UserPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($UserPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$UserPath;$InstallDir", "User")
    Write-Host "[OK] Added $InstallDir to User PATH." -ForegroundColor Green
}

Write-Host ""
Write-Host "Vaeloom Vault Sync (vaultsync) installed successfully!" -ForegroundColor Green
Write-Host "Restart your terminal and run 'vaultsync status' to verify." -ForegroundColor Cyan
Write-Host "To initialize a vault: 'vaultsync init <path-to-markdown-vault>'" -ForegroundColor Yellow
