<#
.SYNOPSIS
    Run the PostgreSQL migration verification against a disposable pgvector:pg16.

.DESCRIPTION
    Starts a throwaway PostgreSQL 16 container with pgvector, runs
    scripts/verify_pg_migrations.py against it, and tears the container AND its
    volume down afterwards.

    A surviving verification database is a trap: the next run would inherit the
    previous schema and silently prove nothing. Teardown happens in `finally`,
    so it runs whether the verification passed, failed, or the wrapper itself
    threw.

    The canonical script owns no Docker. This wrapper is only the local
    convenience; CI invokes the same Python script against its own service
    container.

.NOTES
    Default port is 5433. Host port 5432 is occupied by a native Windows
    PostgreSQL 18 service on this machine, and the verification connects as a
    superuser -- pointing it at the host's real instance would be a mistake.
#>
[CmdletBinding()]
param(
    [int]$Port = $(if ($env:VAELOOM_PG_VERIFY_PORT) { [int]$env:VAELOOM_PG_VERIFY_PORT } else { 5433 })
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ContainerName = 'vaeloom-pg-verify'
$Image         = 'pgvector/pgvector:pg16'
$Database      = 'vaeloom_test'
$Password      = 'vaeloom_verify_pw'

$repoRoot = Split-Path -Parent $PSScriptRoot
$script   = Join-Path $repoRoot 'scripts/verify_pg_migrations.py'

function Write-Fail {
    param([string]$Message)
    Write-Error $Message
    exit 1
}

if (-not (Test-Path -LiteralPath $script)) {
    Write-Fail "verification script not found at $script"
}

# --- Guard 1: a stale container from a crashed run -----------------------------
# We refuse rather than reuse it: reusing means verifying a schema this run did
# not create, which is exactly the false green this harness exists to prevent.
# We also do not delete it -- it may be someone else's in-flight run.
$stale = & docker ps -a --filter "name=^/$ContainerName\$" --format '{{.ID}}' 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'docker is not available. Start Docker Desktop and retry.'
}
if ($stale) {
    Write-Fail ("a container named '$ContainerName' already exists (id $($stale -join ',')). " +
        'It is left in place deliberately -- it may be another run in flight. ' +
        'Inspect it, then `docker rm -v -f ' + $ContainerName + '` if it is dead.')
}

# --- Guard 2: the port must be free --------------------------------------------
# Fail loudly and name the override, rather than starting a container that will
# fail obscurely half-way through a migration.
$bound = Test-NetConnection -ComputerName 127.0.0.1 -Port $Port -InformationLevel Quiet -WarningAction SilentlyContinue
if ($bound) {
    Write-Fail ("port $Port is already in use. Choose another with " +
        '$env:VAELOOM_PG_VERIFY_PORT=<port>, or pass -Port <port>. ' +
        'Host port 5432 is occupied by a local PostgreSQL service; the default of 5433 avoids it.')
}

Write-Host "starting $ContainerName on 127.0.0.1:$Port ..."
& docker run -d --name $ContainerName `
    -e "POSTGRES_PASSWORD=$Password" `
    -e "POSTGRES_DB=$Database" `
    -p "127.0.0.1:${Port}:5432" `
    $Image | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail 'docker run failed'
}

$scriptExit = 1
try {
    # --- Wait for readiness ------------------------------------------------------
    # Poll pg_isready rather than sleeping a fixed interval: a cold image can take
    # several seconds, and a fixed sleep either wastes time or races.
    $ready = $false
    for ($i = 0; $i -lt 60; $i++) {
        & docker exec $ContainerName pg_isready -U postgres -d $Database *> $null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) {
        Write-Host '--- container log ---'
        & docker logs $ContainerName
        Write-Fail "PostgreSQL did not become ready within 60s"
    }

    # --- Verify -----------------------------------------------------------------
    # Invoke through the project venv interpreter so the script's own sys.executable
    # (used for the pytest child) matches the environment running the tests.
    $python = Join-Path $repoRoot 'apps/api/.venv/Scripts/python.exe'
    if (-not (Test-Path -LiteralPath $python)) {
        $python = 'python'
    }

    $pgUrl = "postgresql://postgres:$Password@127.0.0.1:$Port/$Database"
    $env:VAELOOM_TARGET_URL       = $pgUrl
    $env:VAELOOM_TEST_PG_URL      = $pgUrl
    $env:DATABASE__URL            = $pgUrl
    $env:DATABASE_URL             = $pgUrl
    $env:DATABASE_MIGRATION__URL  = $pgUrl
    $env:VAELOOM_VERIFY_ACTIVE    = "1"
    & $python $script --pg-url $pgUrl --repo-root $repoRoot
    $scriptExit = $LASTEXITCODE
}
finally {
    # Scrub exported verification variables
    Remove-Item env:VAELOOM_TARGET_URL -ErrorAction SilentlyContinue
    Remove-Item env:VAELOOM_TEST_PG_URL -ErrorAction SilentlyContinue
    Remove-Item env:DATABASE__URL -ErrorAction SilentlyContinue
    Remove-Item env:DATABASE_URL -ErrorAction SilentlyContinue
    Remove-Item env:DATABASE_MIGRATION__URL -ErrorAction SilentlyContinue
    Remove-Item env:VAELOOM_VERIFY_ACTIVE -ErrorAction SilentlyContinue

    # Always remove container AND volume. A surviving verification database is a
    # trap: the next run would inherit its schema and prove nothing.
    Write-Host 'tearing down container and volume ...'
    & docker rm -f -v $ContainerName *> $null
}

if ($scriptExit -ne 0) {
    Write-Host "VERIFICATION FAILED (exit $scriptExit) -- see the output above" -ForegroundColor Red
}
else {
    Write-Host 'VERIFICATION PASSED' -ForegroundColor Green
}
exit $scriptExit
