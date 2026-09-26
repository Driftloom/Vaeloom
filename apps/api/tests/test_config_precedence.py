"""Configuration precedence: an explicit environment must never be overruled.

Two separate defects let a local run write to a shared database, and both are
covered here.

1. `Settings._resolve_from_secret_manager` assigned every managed secret over the
   top of the already-parsed settings via `object.__setattr__`. Setting
   `DATABASE__URL` to a local SQLite file had no effect when a secret manager was
   enabled, because the override happened after Pydantic read the environment.

2. `alembic/env.py` consulted `DATABASE_URL` (single underscore) before
   `DATABASE__URL`. Both are present in the local `.env`, so Alembic used the
   alias even when the canonical name had been pointed somewhere else. Since
   `command.upgrade` runs at boot, that is a write to a database the developer
   did not select.

These are regression tests for data safety, not for configuration convenience.
"""

import importlib
import os
import sys

import pytest

SQLITE = "sqlite+aiosqlite:///./precedence-test.db"
MANAGED = "postgresql+asyncpg://managed-host:5432/shared"


class _StubSecretManager:
    """Returns a distinct, recognisable value per managed key.

    A single shared value would make it impossible to tell which field was
    written, and an assertion like the one below would pass or fail for the
    wrong reason.
    """

    DEFAULTS = {
        "JWT_SECRET": "managed-jwt",
        "LLM_API_KEY": "managed-llm",
        "ENCRYPTION_KEY": "managed-encryption",
        "STORAGE_ACCESS_KEY": "managed-access",
        "STORAGE_SECRET_KEY": "managed-storage-key",
        "DATABASE_URL": MANAGED,
    }

    def __init__(self, overrides: dict | None = None):
        self.requested: list[str] = []
        self.values = {**self.DEFAULTS, **(overrides or {})}

    def get_secret(self, key: str):
        self.requested.append(key)
        return self.values.get(key)


def _fresh_settings(monkeypatch, **env):
    """Import a pristine `api.config` with a controlled environment.

    `api.config` calls `load_dotenv` at import time, which would re-inject the
    developer's real `.env` (containing live `DATABASE_URL` and friends) and
    decide the outcome of these assertions. `load_dotenv` is therefore stubbed
    out, and the env vars that matter are cleared before the import.
    """
    for key in (
        "VAELOOM_TARGET_URL",
        "DATABASE__URL",
        "DATABASE_URL",
        "DATABASE_MIGRATION__URL",
        "INFISICAL_ENABLED",
        "JWT_SECRET",
        "ENCRYPTION_KEY",
        "LLM_API_KEY",
        "STORAGE_ACCESS_KEY",
        "STORAGE_SECRET_KEY",
    ):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)

    import dotenv

    monkeypatch.setattr(dotenv, "load_dotenv", lambda *a, **k: False)

    for name in [n for n in list(sys.modules) if n.startswith("api.config")]:
        monkeypatch.delitem(sys.modules, name, raising=False)
    module = importlib.import_module("api.config")
    return module, module.settings



# â”€â”€ the secret manager must fill gaps, not overrule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def test_secret_manager_does_not_override_explicit_database_url(monkeypatch):
    module, settings = _fresh_settings(monkeypatch, DATABASE__URL=SQLITE)

    sm = _StubSecretManager()
    settings._resolve_from_secret_manager(sm)

    assert settings.database__url == SQLITE, (
        "an explicit DATABASE__URL must survive the secret manager; "
        f"got {settings.database__url!r}"
    )


def test_secret_manager_does_not_override_explicit_jwt_secret(monkeypatch):
    _, settings = _fresh_settings(monkeypatch, JWT_SECRET="x" * 48)

    settings._resolve_from_secret_manager(_StubSecretManager())

    assert settings.jwt_secret == "x" * 48


def test_secret_manager_still_fills_unset_values(monkeypatch):
    """The fix must not disable the secret manager entirely.

    A resolver that refuses to set anything would break every deployment that
    relies on it, trading one bug for a worse one.
    """
    _, settings = _fresh_settings(monkeypatch, JWT_SECRET="x" * 48)

    sm = _StubSecretManager()
    settings._resolve_from_secret_manager(sm)

    assert settings.database__url == MANAGED, "unset database__url should be filled"
    assert settings.storage_secret_key == "managed-storage-key"
    assert settings.jwt_secret == "x" * 48, "explicit value must still win"


def test_secret_manager_ignores_none_values(monkeypatch):
    _, settings = _fresh_settings(monkeypatch, DATABASE__URL=SQLITE)

    class _Empty:
        def get_secret(self, key):
            return None

    before = settings.database__url
    settings._resolve_from_secret_manager(_Empty())
    assert settings.database__url == before


# â”€â”€ alembic must prefer the canonical variable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


def test_alembic_prefers_canonical_database_url(monkeypatch):
    """`DATABASE__URL` must beat the `DATABASE_URL` alias.

    Checking the alias first is what let the `.env` value win over an
    operator's explicit choice, sending DDL to the wrong instance.
    """
    monkeypatch.setenv("DATABASE__URL", SQLITE)
    monkeypatch.setenv("DATABASE_URL", MANAGED)
    monkeypatch.delenv("VAELOOM_TARGET_URL", raising=False)

    env_py = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic", "env.py"
    )
    assert os.path.exists(env_py), f"alembic/env.py not found at {env_py}"

    source = open(env_py, encoding="utf-8").read()
    canonical = source.index('os.environ.get("DATABASE__URL")')
    alias = source.index('os.environ.get("DATABASE_URL")')
    assert canonical < alias, (
        "alembic/env.py checks DATABASE_URL before DATABASE__URL, so the alias "
        "silently wins"
    )


def test_alembic_target_url_still_wins(monkeypatch):
    """VAELOOM_TARGET_URL is the deliberate migrator override and stays first."""
    monkeypatch.setenv("VAELOOM_TARGET_URL", "postgresql+asyncpg://owner/owner")
    monkeypatch.setenv("DATABASE__URL", SQLITE)
    monkeypatch.setenv("DATABASE_URL", MANAGED)

    env_py = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "alembic", "env.py"
    )
    source = open(env_py, encoding="utf-8").read()
    assert source.index('os.environ.get("VAELOOM_TARGET_URL")') < source.index(
        'os.environ.get("DATABASE__URL")'
    )
