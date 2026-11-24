"""Guards around the documented local/e2e test accounts.

Those accounts are deterministic fixtures, not secrets. What must stay true is
that neither seed path can create them on a shared database, that the fixture
password can be overridden per environment, and that the demo hash is stored in
a form the login path can actually verify.

The seed script and the e2e launcher are standalone files rather than package
modules, so they are loaded by path.
"""

import asyncio
import importlib.util
from pathlib import Path

import bcrypt
import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
SEED_PATH = REPO_ROOT / "apps" / "api" / "scripts" / "seed.py"
LAUNCHER_PATH = REPO_ROOT / "apps" / "web" / "e2e" / "api-launcher.py"

REMOTE_URL = "postgresql+asyncpg://u:p@db.example.com:5432/vaeloom"
SUPABASE_URL = (
    "postgresql+asyncpg://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
)


def _load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None, f"cannot load {path}"
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("sqlite+aiosqlite:///./dev.db", True),
        ("postgresql+asyncpg://vaeloom:vaeloom_dev@localhost:5432/vaeloom", True),
        ("postgresql+asyncpg://vaeloom:vaeloom_dev@127.0.0.1:5432/vaeloom", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=/var/run/postgresql", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=127.0.0.1&host=localhost", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=localhost,127.0.0.1", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=::1", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=[::1]:5432", True),
        (REMOTE_URL, False),
        (SUPABASE_URL, False),
        ("postgresql+asyncpg://user:pass@/dbname?host=remote.example:5432", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=127.0.0.1&host=remote.example", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=/var/run/postgresql,db.example.com", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=::ffff:192.0.2.10", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=[2001:db8::1]:5432", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=:5432", False),
        ("postgresql+asyncpg://localhost:p/ss@db.example.com:5432/vaeloom", False),
        ("postgresql+asyncpg://u@localhost/app?password=p#ss&host=remote.example:5432", False),
        (
            "postgresql+asyncpg:///vaeloom?dsn=postgresql%3A%2F%2Fu%3Ap%40db.example.com%3A5432%2Fvaeloom",
            False,
        ),
        (
            "postgresql+asyncpg:///vaeloom?dsn=postgresql%3A%2F%2Flocalhost%3A5432%2Fvaeloom",
            True,
        ),
    ],
)
def test_seed_guard_treats_only_local_targets_as_safe(monkeypatch, url: str, expected: bool):
    monkeypatch.delenv("PGHOST", raising=False)
    seed = _load(SEED_PATH, "vaeloom_seed_guard_predicate")
    assert seed.is_local_database(url) is expected


def test_seed_refuses_a_remote_database(monkeypatch):
    monkeypatch.setenv("DATABASE__URL", REMOTE_URL)
    monkeypatch.delenv("ALLOW_REMOTE_SEED", raising=False)
    seed = _load(SEED_PATH, "vaeloom_seed_refuses_remote")
    with pytest.raises(SystemExit) as excinfo:
        asyncio.run(seed.seed())
    assert "db.example.com" in str(excinfo.value)


def test_demo_password_hash_is_bcrypt_and_verifies(monkeypatch):
    monkeypatch.delenv("DEMO_PASSWORD", raising=False)
    seed = _load(SEED_PATH, "vaeloom_seed_hash_default")
    assert seed.DEMO_PASSWORD_HASH.startswith("$2")
    assert bcrypt.checkpw(b"demo1234", seed.DEMO_PASSWORD_HASH.encode())


def test_demo_password_can_be_overridden_per_environment(monkeypatch):
    monkeypatch.setenv("DEMO_PASSWORD", "EnvSpecificDemo!42")
    seed = _load(SEED_PATH, "vaeloom_seed_hash_override")
    assert bcrypt.checkpw(b"EnvSpecificDemo!42", seed.DEMO_PASSWORD_HASH.encode())


def test_demo_email_can_be_overridden_per_environment(monkeypatch):
    monkeypatch.setenv("DEMO_EMAIL", "custom-demo@vaeloom.app")
    seed = _load(SEED_PATH, "vaeloom_seed_email_override")
    assert seed.DEMO_EMAIL == "custom-demo@vaeloom.app"


def test_demo_email_normalization(monkeypatch):
    monkeypatch.setenv("DEMO_EMAIL", "  Demo@Vaeloom.App  ")
    seed = _load(SEED_PATH, "vaeloom_seed_email_norm")
    assert seed.DEMO_EMAIL == "demo@vaeloom.app"


def test_seed_guard_respects_pghost_fallback(monkeypatch):
    seed = _load(SEED_PATH, "vaeloom_seed_pghost_check")
    # When URL has no host, fallback to PGHOST
    url_no_host = "postgresql+asyncpg:///vaeloom"

    monkeypatch.delenv("PGHOST", raising=False)
    assert seed.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "localhost")
    assert seed.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "/var/run/postgresql")
    assert seed.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "db.example.com")
    assert seed.is_local_database(url_no_host) is False


def test_launcher_guard_respects_pghost_fallback(monkeypatch):
    launcher = _load(LAUNCHER_PATH, "vaeloom_launcher_pghost_check")
    url_no_host = "postgresql+asyncpg:///vaeloom"

    monkeypatch.delenv("PGHOST", raising=False)
    assert launcher.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "localhost")
    assert launcher.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "/var/run/postgresql")
    assert launcher.is_local_database(url_no_host) is True

    monkeypatch.setenv("PGHOST", "db.example.com")
    assert launcher.is_local_database(url_no_host) is False


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("sqlite+aiosqlite:///./e2e.db", True),
        ("postgresql+asyncpg://vaeloom:vaeloom_dev@localhost:5432/vaeloom", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=/var/run/postgresql", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=127.0.0.1&host=localhost", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=localhost,127.0.0.1", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=::1", True),
        ("postgresql+asyncpg://user:pass@/dbname?host=[::1]:5432", True),
        (REMOTE_URL, False),
        (SUPABASE_URL, False),
        ("postgresql+asyncpg://user:pass@/dbname?host=remote.example:5432", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=127.0.0.1&host=remote.example", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=/var/run/postgresql,db.example.com", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=::ffff:192.0.2.10", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=[2001:db8::1]:5432", False),
        ("postgresql+asyncpg://user:pass@/dbname?host=:5432", False),
        ("postgresql+asyncpg://localhost:p/ss@db.example.com:5432/vaeloom", False),
        ("postgresql+asyncpg://u@localhost/app?password=p#ss&host=remote.example:5432", False),
        (
            "postgresql+asyncpg:///vaeloom?dsn=postgresql%3A%2F%2Fu%3Ap%40db.example.com%3A5432%2Fvaeloom",
            False,
        ),
        (
            "postgresql+asyncpg:///vaeloom?dsn=postgresql%3A%2F%2Flocalhost%3A5432%2Fvaeloom",
            True,
        ),
    ],
)
def test_launcher_guard_treats_only_local_targets_as_safe(monkeypatch, url: str, expected: bool):
    monkeypatch.delenv("PGHOST", raising=False)
    launcher = _load(LAUNCHER_PATH, "vaeloom_e2e_launcher_predicate")
    assert launcher.is_local_database(url) is expected


def test_launcher_credentials_are_env_overridable(monkeypatch):
    monkeypatch.setenv("TEST_PASSWORD", "EnvSpecificE2E!42")
    monkeypatch.setenv("DEMO_PASSWORD", "EnvSpecificDemo!42")
    launcher = _load(LAUNCHER_PATH, "vaeloom_e2e_launcher_env")
    assert launcher.E2E_USERS[0][1] == "EnvSpecificE2E!42"
    assert launcher.E2E_USERS[1][1] == "EnvSpecificDemo!42"


def test_launcher_skips_seeding_on_remote_database_when_unauthorized(monkeypatch, capsys):
    monkeypatch.setenv("DATABASE__URL", REMOTE_URL)
    monkeypatch.delenv("ALLOW_REMOTE_SEED", raising=False)
    launcher = _load(LAUNCHER_PATH, "vaeloom_e2e_launcher_skip_remote")
    asyncio.run(launcher._seed_e2e_user())
    captured = capsys.readouterr()
    assert "refusing to seed e2e credentials into non-local database" in captured.out
    assert "ALLOW_REMOTE_SEED is unset" in captured.out


def test_launcher_skips_when_database_url_alias_is_remote(monkeypatch, capsys):
    monkeypatch.delenv("DATABASE__URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", REMOTE_URL)
    monkeypatch.delenv("ALLOW_REMOTE_SEED", raising=False)
    launcher = _load(LAUNCHER_PATH, "vaeloom_e2e_launcher_alias_remote")
    asyncio.run(launcher._seed_e2e_user())
    captured = capsys.readouterr()
    assert "refusing to seed e2e credentials into non-local database" in captured.out


def test_non_local_diagnostics_report_source():
    seed = _load(SEED_PATH, "vaeloom_seed_diagnostics")
    assert "authority host 'db.example.com'" in seed.get_non_local_endpoint(REMOTE_URL)
    assert "query host 'remote.example:5432'" in seed.get_non_local_endpoint(
        "postgresql+asyncpg:///db?host=remote.example:5432"
    )
    assert "dsn parameter" in seed.get_non_local_endpoint(
        "postgresql+asyncpg:///db?dsn=postgresql%3A%2F%2Fu%3Ap%40db.example.com%3A5432%2Fdb"
    )
