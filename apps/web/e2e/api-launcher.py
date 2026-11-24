"""E2E/dev API launcher.

Bootstraps missing SQLite tables (consent_records etc. — no model owns them)
and seeds the deterministic e2e user inside the app lifespan. The historical
prometheus-fastapi-instrumentator 7.1.0 / FastAPI 0.141 `_IncludedRouter`
monkeypatch was removed after bumping pfi to >=8.0.1 (fixed upstream in
v8.0.1, 2026-06-22). This file lives under apps/web/e2e so CI checkouts
include it.
"""

import os
import sqlite3
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

_api_src = str(Path(__file__).resolve().parents[2] / "apps" / "api" / "src")
if _api_src not in sys.path:
    sys.path.insert(0, _api_src)



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

    # Start every run from an empty database.
    #
    # `e2e.db` is a repo-root file that nothing deleted, so each run inherited the
    # previous run's rows. That was survivable while the suite wrote only isolated
    # fixtures; it stopped being survivable once chat history moved server-side.
    # Visual baselines stopped meaning anything first: the `memory` and `schedule`
    # @375 shots were rendering rows an earlier spec left behind, so the committed
    # pixels had baked another test's leakage into the expected image. Selectors
    # stopped being unique second, because the chat thread rail now accumulates a
    # thread per run. Both surface as product bugs and are not.
    #
    # The reset lives here rather than in a Playwright `globalSetup` hook because
    # this function is what opens the file, so it is the one place guaranteed to run
    # before anything reads it. The `-wal` and `-shm` sidecars go too: reattaching
    # them to a fresh database resurrects rows.
    for suffix in ("", "-wal", "-shm"):
        try:
            os.remove(path + suffix)
        except FileNotFoundError:
            pass
        except OSError:
            # A locked sidecar means another process still holds the database, which
            # is a real problem — but not one this function should mask by silently
            # running against a stale file.
            print(f"[api-launcher] could not remove {path + suffix}", flush=True)

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
# Defaults keep the zero-config local/CI path working. Every value can be
# overridden per environment, so a shared deployment never has to reuse the
# published fixture password.
E2E_USERS = [
    (
        os.environ.get("TEST_EMAIL", "audit@vaeloom.test").strip().lower(),
        os.environ.get("TEST_PASSWORD", "AuditPass123!"),
        "E2E Audit",
    ),
    (
        os.environ.get("DEMO_EMAIL", "demo@vaeloom.app").strip().lower(),
        os.environ.get("DEMO_PASSWORD", "demo1234"),
        "Demo User",
    ),
]


LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _is_local_endpoint(h: str) -> bool:
    """Helper to check if a single host endpoint is local (loopback or unix socket)."""
    h = h.strip().lower()
    if not h:
        return False
    if h.startswith("/"):
        return True
    if h.startswith("[") and "]" in h:
        h = h[1 : h.index("]")]
    elif h.count(":") > 1:
        pass  # Bare IPv6 literal
    elif ":" in h:
        h = h.split(":", 1)[0]
    return h in LOCAL_HOSTS


def _query_values(query_dict: dict, key: str) -> list[str]:
    """Helper to read single- or multi-valued entries from SQLAlchemy URL.query."""
    val = query_dict.get(key)
    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return [str(v) for v in val]
    return [str(val)]


def get_non_local_endpoint(url: str, _depth: int = 0) -> str | None:
    """Returns None if local, or a safe description of the non-local target."""
    if _depth > 2:
        return "excessive dsn recursion"
    if not url or url.startswith("sqlite"):
        return None

    try:
        from sqlalchemy.engine import make_url

        sa_url = make_url(url)
        if sa_url.get_backend_name() == "sqlite":
            return None
        authority_host = (sa_url.host or "").lower()
    except Exception:
        return "unparseable database url"

    if authority_host and authority_host not in LOCAL_HOSTS:
        return f"authority host '{authority_host}'"

    # Evaluate query parameters using SQLAlchemy URL.query (matching engine semantics)
    for dsn_val in _query_values(sa_url.query, "dsn"):
        nested = get_non_local_endpoint(dsn_val, _depth + 1)
        if nested:
            return f"dsn parameter ({nested})"

    query_hosts = []
    for host_val in _query_values(sa_url.query, "host"):
        for part in host_val.split(","):
            part = part.strip().lower()
            if part:
                query_hosts.append(part)

    for h in query_hosts:
        if not _is_local_endpoint(h):
            return f"query host '{h}'"

    if not authority_host and not query_hosts:
        pghost = os.environ.get("PGHOST", "").strip()
        if pghost:
            for part in pghost.split(","):
                if not _is_local_endpoint(part):
                    return f"PGHOST '{part.strip().lower()}'"

    return None


def is_local_database(url: str, _depth: int = 0) -> bool:
    """True for SQLite and loopback database targets.

    The accounts above carry documented default passwords. Seeding them into a
    shared or cloud database would publish working credentials, so this mirrors
    the Alembic remote-DDL guard (`apps/api/alembic/env.py`).
    Evaluates the authority host, query host parameters, nested dsn parameters,
    and the PGHOST fallback.
    """
    return get_non_local_endpoint(url, _depth) is None


async def _seed_memory_type_packs() -> None:
    from sqlalchemy import select

    from api.database import async_session_factory
    from api.models.schema import MemoryTypePack
    from api.services.memory_type_packs import CAREER_PACK_SLUG, CAREER_TYPES

    async with async_session_factory() as db:
        existing = await db.scalar(
            select(MemoryTypePack).where(MemoryTypePack.slug == CAREER_PACK_SLUG)
        )
        if existing is None:
            db.add(
                MemoryTypePack(
                    slug=CAREER_PACK_SLUG,
                    version=1,
                    label="Career",
                    types=list(CAREER_TYPES),
                    is_active=True,
                )
            )
            await db.commit()
            print(f"[api-launcher] seeded memory type pack {CAREER_PACK_SLUG}")


async def _seed_e2e_user() -> None:
    try:
        from api.config import settings

        settings_url = getattr(settings, "database__url", None)
    except Exception:
        settings_url = None

    db_url = (
        os.environ.get("DATABASE__URL")
        or os.environ.get("DATABASE_URL")
        or settings_url
        or "sqlite+aiosqlite:///./dev.db"
    )
    non_local = get_non_local_endpoint(db_url)
    allow_remote = os.environ.get("ALLOW_REMOTE_SEED", "").lower() in ("1", "true", "yes")
    if non_local and not allow_remote:
        print(
            "[api-launcher] refusing to seed e2e credentials into non-local database "
            f"({non_local}); skipping (ALLOW_REMOTE_SEED is unset)",
            flush=True,
        )
        return

    from fastapi import HTTPException

    from api.database import async_session_factory
    from api.services.auth_service import AuthService

    await _seed_memory_type_packs()

    async with async_session_factory() as db:
        for user_tuple in E2E_USERS:
            try:
                await AuthService().signup(*user_tuple, db=db)
                await db.commit()
                print(f"[api-launcher] seeded user {user_tuple[0]}")
            except HTTPException as exc:
                if exc.status_code == 409:
                    print(f"[api-launcher] user {user_tuple[0]} already present")
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

    # Repo-root `.env` and `apps/api/.env` are loaded by api.config via
    # load_dotenv(override=False) with explicit VAELOOM_TARGET_URL pointing at
    # Supabase Postgres. In SQLite mode that leaks the migration engine onto a
    # different database than the runtime engine, so create_all runs against
    # Postgres while runtime queries hit SQLite ("no such table" errors).
    # Force both runtime and migration URLs onto the SQLite target before importing api.
    _db_url = os.environ.get("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
    if _db_url.startswith("sqlite"):
        os.environ["DATABASE__URL"] = _db_url
        os.environ["DATABASE_URL"] = _db_url
        os.environ["VAELOOM_TARGET_URL"] = _db_url
        os.environ["DATABASE_MIGRATION__URL"] = _db_url

    ensure_sqlite_tables()

    from api.main import app  # noqa: E402  (path set up by caller)

    _wrap_lifespan_with_seeding(app)

    # Port is configurable because 8000 is not reliably free. On a machine where
    # another stack already answers there - a Docker container publishing 8000,
    # for instance - a hard-coded port makes this launcher fail with EADDRINUSE,
    # and the resulting Playwright failures look like application bugs because
    # the web app quietly proxies to whatever *is* on 8000.
    #
    # VAELOOM_E2E_API_PORT must match whatever the Next.js rewrite targets
    # (INTERNAL_API_URL, or NEXT_PUBLIC_API_URL in apps/web/.env.local).
    port = int(os.environ.get("VAELOOM_E2E_API_PORT", "8000"))
    host = os.environ.get("VAELOOM_E2E_API_HOST", "127.0.0.1")
    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    main()
