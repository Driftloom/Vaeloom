"""Regression: explicit DATABASE__URL env must win over checked-in .env files.

Zero-trust audit finding ZT-001: apps/api/.env (production Supabase URL) was
loaded with override=True, silently redirecting local/test runs to production.
"""
import importlib
import os
import sys

import pytest

import api.config as config_mod


def test_explicit_database_url_env_wins_over_dotenv(monkeypatch):
    sentinel = "sqlite+aiosqlite:///./zt-sentinel.db"
    monkeypatch.setenv("DATABASE__URL", sentinel)
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-for-ci-only-32-chars-long!!")
    monkeypatch.setenv("ENCRYPTION_KEY", "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=")
    reloaded = importlib.reload(config_mod)
    try:
        assert reloaded.settings.database__url == sentinel
    finally:
        importlib.reload(config_mod)


def test_dotenv_still_provides_fallback_when_env_unset(monkeypatch):
    monkeypatch.delenv("DATABASE__URL", raising=False)
    reloaded = importlib.reload(config_mod)
    try:
        # Falls back to a file/default value, never empty-crash at import.
        assert reloaded.settings.database__url
    finally:
        importlib.reload(config_mod)
