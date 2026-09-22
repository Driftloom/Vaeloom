"""DR multi-scope checks (Loop 3): offline-verifiable behavior.

Live PG/Redis/S3 scopes report "skipped" (never fail) when backends are
absent; the RLS-drift logic is proven with a scripted fake connection.
"""
import importlib.util
import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.asyncio


def _load_runner():
    path = Path(__file__).resolve().parent.parent / "scripts" / "dr_drill_runner.py"
    spec = importlib.util.spec_from_file_location("dr_drill_runner", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class TestHeadPin:
    def test_expected_head_matches_latest_migration(self):
        mod = _load_runner()
        versions = Path(__file__).resolve().parent.parent / "alembic" / "versions"
        revs = set()
        downs = set()
        for f in versions.glob("*.py"):
            src = f.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"^revision:\s*str\s*=\s*[\"']([^\"']+)[\"']", src, re.M)
            d = re.search(r"^down_revision.*?[\"']([^\"']+)[\"']", src, re.M)
            if m:
                revs.add(m.group(1))
            if d:
                downs.add(d.group(1))
        heads = revs - downs
        assert len(heads) == 1, f"migration chain must have one head: {heads}"
        assert mod.EXPECTED_ALEMBIC_HEAD in heads


class TestSkipPaths:
    async def test_rls_scope_skips_when_unreachable(self, monkeypatch):
        mod = _load_runner()
        monkeypatch.setattr(mod, "TARGET_URL", "postgresql://127.0.0.1:1/nope")
        out = await mod.scope_rls_policy_drift("postgresql://127.0.0.1:1/nope")
        assert out["scope"] == "rls-posture" and out["status"] == "skipped"

    async def test_redis_scope_skips_without_url(self, monkeypatch):
        mod = _load_runner()
        monkeypatch.delenv("REDIS__URL", raising=False)
        out = await mod.scope_redis_persistence()
        assert out == {"scope": "redis", "status": "skipped", "detail": "REDIS__URL unset"}

    async def test_storage_scope_skips_without_config(self, monkeypatch):
        mod = _load_runner()
        monkeypatch.delenv("STORAGE_ENDPOINT", raising=False)
        monkeypatch.delenv("STORAGE_BUCKET", raising=False)
        out = await mod.scope_object_storage()
        assert out["status"] == "skipped"


class TestRlsDriftLogic:
    def _fake_conn(self, forced, grants):
        class _FakeConn:
            async def fetch(self, sql):
                if "relforcerowsecurity" in sql:
                    return [{"relname": t} for t in forced]
                return grants

            async def close(self):
                return None

        return _FakeConn()

    async def test_passes_when_scoped(self, monkeypatch):
        mod = _load_runner()

        async def _connect(url):
            return self._fake_conn(list(mod.APP_ROLE_STRICT_TABLES), [])

        monkeypatch.setattr(mod.asyncpg, "connect", _connect)
        out = await mod.scope_rls_policy_drift("postgresql://x/y")
        assert out["status"] == "passed", out

    async def test_fails_on_open_grant(self, monkeypatch):
        mod = _load_runner()

        async def _connect(url):
            return self._fake_conn(
                list(mod.APP_ROLE_STRICT_TABLES),
                [{"tablename": "users", "policyname": "p_users_service"}],
            )

        monkeypatch.setattr(mod.asyncpg, "connect", _connect)
        out = await mod.scope_rls_policy_drift("postgresql://x/y")
        assert out["status"] == "failed"
        assert "users" in out["detail"]

    async def test_fails_on_missing_force(self, monkeypatch):
        mod = _load_runner()

        async def _connect(url):
            return self._fake_conn(["users"], [])

        monkeypatch.setattr(mod.asyncpg, "connect", _connect)
        out = await mod.scope_rls_policy_drift("postgresql://x/y")
        assert out["status"] == "failed"
        assert "missing-force" in out["detail"]
