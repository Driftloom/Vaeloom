"""E2E/dev API launcher.

Works around a known upstream incompatibility between
prometheus-fastapi-instrumentator 7.1.0 and FastAPI >= 0.141
(`_IncludedRouter has no attribute 'path'`) WITHOUT touching backend source.

Patches the instrumentator's route-name helper defensively, then imports the
real application. This file lives under apps/web/e2e so CI checkouts include
it. Backend owners should fix the root cause (pin FastAPI < 0.141 or upgrade
prometheus-fastapi-instrumentator) and delete this shim.
"""

import os
import sqlite3

import prometheus_fastapi_instrumentator.routing as _prouting


def _safe_get_route_name(request):  # type: ignore[no-untyped-def]
    try:
        return _prouting.get_route_name.__wrapped_original__(request)  # type: ignore[attr-defined]
    except Exception:
        return "unknown"


# Wrap whatever implementation exists at import time.
_original_get_route_name = _prouting.get_route_name


def _patched_get_route_name(request):  # type: ignore[no-untyped-def]
    try:
        return _original_get_route_name(request)
    except Exception:
        return "unknown"


_prouting.get_route_name = _patched_get_route_name


# ── Raw-SQL table bootstrap ──────────────────────────────────────────────────
# Three tables are queried by raw SQL but owned by NO SQLAlchemy model and by
# no migration that runs on SQLite:
#   • consent_records  — ConsentRecord is a Pydantic model (services/consent.py)
#   • scheduled_jobs   — created only by alembic 0002, which never runs outside
#                        apps/api CWD ("No 'script_location'" fallback)
#   • job_executions   — same alembic-only origin
# PostgreSQL deployments get all three via alembic; SQLite dev/e2e DBs need
# them created explicitly or /consent/me and /scheduler/jobs return 500s.
_DDL = [
    """
    CREATE TABLE IF NOT EXISTS consent_records (
        id TEXT PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        tenant_id VARCHAR(255),
        scope VARCHAR(50) NOT NULL,
        granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        revoked_at TIMESTAMP,
        ip_address VARCHAR(64)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
        id TEXT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) NOT NULL,
        cron VARCHAR(100) NOT NULL,
        method VARCHAR(10),
        url VARCHAR(1000),
        event VARCHAR(255),
        payload TEXT,
        headers TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        last_run_at TIMESTAMP,
        next_run_at TIMESTAMP,
        tenant_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS job_executions (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES scheduled_jobs(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        status_code INTEGER,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
]


def ensure_sqlite_tables() -> None:
    url = os.environ.get("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
    if not url.startswith("sqlite"):
        return
    path = url.split("///", 1)[-1]
    conn = sqlite3.connect(path)
    try:
        for ddl in _DDL:
            conn.execute(ddl)
        conn.commit()
    finally:
        conn.close()


# ── E2E user seeding ─────────────────────────────────────────────────────────
# A fresh checkout has no dev.db; Playwright specs log in as this account.
# Runs INSIDE the wrapped lifespan so /health only turns OK once the user
# exists — no race between Playwright readiness and the first login.
E2E_USER = ("audit@vaeloom.test", "AuditPass123!", "E2E Audit")


async def _seed_e2e_user() -> None:
    from fastapi import HTTPException

    from api.database import async_session_factory
    from api.services.auth_service import AuthService

    async with async_session_factory() as db:
        try:
            await AuthService().signup(*E2E_USER, db=db)
            await db.commit()
            print(f"[api-launcher] seeded e2e user {E2E_USER[0]}")
        except HTTPException as exc:
            if exc.status_code == 409:
                print(f"[api-launcher] e2e user {E2E_USER[0]} already present")
            else:
                raise


def _wrap_lifespan_with_seeding(app) -> None:
    from contextlib import asynccontextmanager

    original = app.router.lifespan_context

    @asynccontextmanager
    async def seeded_lifespan(inner_app):
        async with original(inner_app):
            try:
                await _seed_e2e_user()
            except Exception as exc:  # noqa: BLE001 — never block dev boot
                print(f"[api-launcher] e2e seeding skipped: {exc}")
            yield

    app.router.lifespan_context = seeded_lifespan


def main() -> None:
    import uvicorn

    ensure_sqlite_tables()

    from api.main import app  # noqa: E402  (path set up by caller)

    _wrap_lifespan_with_seeding(app)

    uvicorn.run(app, host="0.0.0.0", port=8000)


if __name__ == "__main__":
    main()
