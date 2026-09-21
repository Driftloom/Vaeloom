"""SQLite MCP sandbox guard tests (path containment + read-only)."""

import json

import pytest

import api.mcp_servers.sqlite_mcp as sqlite_mcp

pytestmark = pytest.mark.asyncio


@pytest.fixture()
def sandbox(tmp_path, monkeypatch):
    box = tmp_path / "box"
    box.mkdir()
    monkeypatch.setattr(sqlite_mcp, "_ALLOWED_DIR", box)
    return box


async def test_traversal_inputs_confined_to_sandbox(sandbox):
    # Basename confinement neutralizes traversal: nothing may resolve outside.
    for hostile in ("../../etc/passwd.db", "/etc/passwd.db", "sub/../evil.db"):
        target = sqlite_mcp._sanitize_path(hostile)
        assert target.parent == sandbox
        assert ".." not in target.parts


async def test_protected_system_files_denied(sandbox):
    for name in ("dev.db", ".env", "alembic.ini", "main.py"):
        with pytest.raises(ValueError, match="[Aa]ccess denied|protected"):
            sqlite_mcp._sanitize_path(name)


async def test_normal_name_confined_to_sandbox(sandbox):
    target = sqlite_mcp._sanitize_path("memory.db")
    assert target.parent == sandbox
    assert target.name == "memory.db"


async def test_query_sql_missing_table_returns_error_json(sandbox):
    out = json.loads(await sqlite_mcp.query_sql("SELECT * FROM nope", db_path="t.db"))
    assert "error" in out


async def test_query_sql_roundtrip_read(sandbox):
    import sqlite3

    db = sandbox / "r.db"
    conn = sqlite3.connect(str(db))
    conn.execute("CREATE TABLE t (id INTEGER PRIMARY KEY, v TEXT)")
    conn.execute("INSERT INTO t (v) VALUES ('hello')")
    conn.commit()
    conn.close()
    out = json.loads(await sqlite_mcp.query_sql("SELECT * FROM t", db_path="r.db"))
    assert out["rows_returned"] == 1
    assert out["data"][0]["v"] == "hello"
