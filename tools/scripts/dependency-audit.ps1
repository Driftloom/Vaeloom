#Requires -Version 7.0

<#
.SYNOPSIS
  Dependency audit script for Vaeloom.
  Runs pnpm audit, pip-audit (if Python available), and checks for outdated packages.
  Exits non-zero if any critical vulnerability is found.
#>

param(
  [switch]$SkipPnPm,
  [switch]$SkipPip,
  [switch]$SkipOutdated,
  [int]$ExitCode = 0
)

$ErrorActionPreference = 'Continue'
$results = @()
$criticalFound = $false

# ── Helper Functions ──────────────────────────────────────────────────────────

function Write-Section($title) {
  Write-Host "`n" + ("─" * 60) -ForegroundColor Cyan
  Write-Host "  $title" -ForegroundColor Cyan
  Write-Host ("─" * 60) -ForegroundColor Cyan
}

function Add-Result($check, $status, $detail) {
  $global:results += [PSCustomObject]@{
    Check  = $check
    Status = $status
    Detail = $detail
  }
}

# ── 1. pnpm audit ────────────────────────────────────────────────────────────

if (-not $SkipPnPm) {
  Write-Section "pnpm audit (high/critical severity)"

  $auditJson = & pnpm audit --audit-level=high --json 2>&1 | Out-String
  $exitCode = $LASTEXITCODE

  if ($auditJson -match '"advisories"') {
    try {
      $audit = $auditJson | ConvertFrom-Json -ErrorAction Stop
      $advisories = $audit.advisories.PSObject.Properties | ForEach-Object { $_.Value }
      if ($advisories.Count -gt 0) {
        Write-Host "Found $($advisories.Count) advisory(ies):" -ForegroundColor Yellow
        foreach ($adv in $advisories) {
          $severity = $adv.severity
          $color = if ($severity -eq 'critical') { 'Red' } elseif ($severity -eq 'high') { 'Yellow' } else { 'White' }
          Write-Host "  [$($severity.ToUpper())] $($adv.module_name)@$($adv.vulnerable_versions) - $($adv.title)" -ForegroundColor $color
          if ($severity -eq 'critical') { $global:criticalFound = $true }
        }
        Add-Result "pnpm audit" "WARN" "$($advisories.Count) vulnerabilities found"
      } else {
        Add-Result "pnpm audit" "PASS" "No vulnerabilities found"
      }
    } catch {
      Add-Result "pnpm audit" "ERROR" "Failed to parse audit JSON: $_"
    }
  } else {
    if ($exitCode -eq 0) {
      Add-Result "pnpm audit" "PASS" "No vulnerabilities found"
    } else {
      Add-Result "pnpm audit" "ERROR" "pnpm audit failed with exit code $exitCode"
    }
  }
}

# ── 2. pip-audit ─────────────────────────────────────────────────────────────

if (-not $SkipPip) {
  Write-Section "pip-audit (Python dependencies)"

  try {
    $pipVersion = & pip --version 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0) {
      $pipExitCode = 0
      $pipOutput = & pip-audit 2>&1 | Out-String
      $pipExitCode = $LASTEXITCODE

      if ($pipOutput -match 'No known vulnerabilities found') {
        Add-Result "pip-audit" "PASS" "No vulnerabilities found"
      } elseif ($pipOutput -match 'Found (\d+) known vulnerabilities') {
        $count = $matches[1]
        Write-Host "$pipOutput" -ForegroundColor Yellow
        if ($pipOutput -match 'critical') { $global:criticalFound = $true }
        Add-Result "pip-audit" "WARN" "$count vulnerabilities found"
      } else {
        Add-Result "pip-audit" "INFO" "No Python dependencies or pip-audit not configured"
      }
    } else {
      Add-Result "pip-audit" "SKIP" "Python/pip not available"
    }
  } catch {
    Add-Result "pip-audit" "SKIP" "pip-audit not installed: $_"
  }
}

# ── 3. Outdated packages ─────────────────────────────────────────────────────

if (-not $SkipOutdated) {
  Write-Section "Outdated package check"

  try {
    $outdatedJson = & pnpm outdated --format json 2>&1 | Out-String
    if ($LASTEXITCODE -eq 0 -or $LASTEXITCODE -eq 1) {
      $outdated = $outdatedJson | ConvertFrom-Json -ErrorAction SilentlyContinue
      if ($outdated.PSObject.Properties.Count -gt 0) {
        Write-Host "Outdated packages:" -ForegroundColor Yellow
        $table = @()
        foreach ($prop in $outdated.PSObject.Properties) {
          $table += [PSCustomObject]@{
            Package = $prop.Name
            Current = $prop.Value.current
            Latest  = $prop.Value.latest
            Type    = $prop.Value.type
          }
          Write-Host "  $($prop.Name): $($prop.Value.current) -> $($prop.Value.latest) ($($prop.Value.type))" -ForegroundColor Yellow
        }
        Add-Result "Outdated packages" "WARN" "$($table.Count) packages outdated"
      } else {
        Add-Result "Outdated packages" "PASS" "All packages up to date"
      }
    }
  } catch {
    Add-Result "Outdated packages" "INFO" "Could not check outdated packages: $_"
  }
}

# ── Summary ──────────────────────────────────────────────────────────────────

Write-Section "Dependency Audit Summary"

$table = $results | Format-Table -Property Check, Status, Detail -AutoSize -Wrap | Out-String
Write-Host $table

Write-Host "`nOverall: " -NoNewline
if ($global:criticalFound) {
  Write-Host "FAILED - Critical vulnerabilities found" -ForegroundColor Red
  $global:ExitCode = 1
} else {
  $hasWarnings = $results | Where-Object { $_.Status -eq 'WARN' }
  if ($hasWarnings) {
    Write-Host "PASSED WITH WARNINGS" -ForegroundColor Yellow
  } else {
    Write-Host "PASSED" -ForegroundColor Green
  }
  $global:ExitCode = 0
}

exit $global:ExitCode
