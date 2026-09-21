"""Vaeloom Sovereign SQLite Memory Model Context Protocol (MCP) Server.

Provides sandboxed, read-only SQL inspection and querying tools for workspace databases,
knowledge memory tables, and relational profiles with zero external dependencies.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import re
import sqlite3
from pathlib import Path
from typing import Any

from mcp.server import MCPServer

logger = logging.getLogger("mcp.sqlite")

server = MCPServer("vaeloom-sqlite-memory-mcp")

# Sandboxed database directory strictly enforced
_ALLOWED_DIR = Path(os.environ.get("SQLITE_MCP_ALLOWED_DIR", "./data/sqlite_mcp")).resolve()
_ALLOWED_DIR.mkdir(parents=True, exist_ok=True)
_DEFAULT_DB_PATH = str(_ALLOWED_DIR / "memory.db")


def _sanitize_path(db_path: str) -> Path:
    """Resolve and sanitize database path strictly within allowed boundaries."""
    raw = (db_path or "").strip()
    if not raw:
        target = Path(_DEFAULT_DB_PATH).resolve()
    else:
        safe_name = Path(raw).name
        if not safe_name or safe_name in ("dev.db", "test.db", ".env", "alembic.ini", "main.py"):
            raise ValueError(f"Access denied: '{safe_name}' is a protected system file.")
        target = (_ALLOWED_DIR / safe_name).resolve()

    try:
        target.relative_to(_ALLOWED_DIR)
    except ValueError:
        raise ValueError("Access denied: path traversal outside allowed sandbox directory.")

    target.parent.mkdir(parents=True, exist_ok=True)
    return target


def _get_connection(db_path: str) -> sqlite3.Connection:
    target = _sanitize_path(db_path)
    if not target.exists():
        with sqlite3.connect(str(target)) as init_conn:
            init_conn.execute("VACUUM")
    # Enforce native read-only connection via SQLite URI mode=ro
    uri = f"file:{target.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


_DISALLOWED_SQL_PATTERNS = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|ATTACH|DETACH|VACUUM|PRAGMA\s+\w+\s*=)\b",
    re.IGNORECASE,
)


@server.tool(
    name="list_tables",
    description="List all tables in the SQLite database along with their approximate row counts.",
)
async def list_tables(db_path: str = "") -> str:
    """List tables in the database."""
    target_path = db_path or _DEFAULT_DB_PATH
    try:
        conn = _get_connection(target_path)
        cursor = conn.cursor()
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
        tables = [row["name"] for row in cursor.fetchall()]
        results = []
        for tbl in tables:
            try:
                clean_name = re.sub(r"[^a-zA-Z0-9_]", "", tbl)
                cursor.execute(f"SELECT COUNT(*) as count FROM \"{clean_name}\"")
                count = cursor.fetchone()["count"]
            except Exception:
                count = 0
            results.append({"table": tbl, "row_count": count})
        conn.close()
        return json.dumps({"database": str(_sanitize_path(target_path)), "tables": results}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Failed to list tables: {e}"})


@server.tool(
    name="describe_table",
    description="Describe schema, columns, and data types for a specific table using PRAGMA table_info.",
)
async def describe_table(table_name: str, db_path: str = "") -> str:
    """Describe columns for a table."""
    if not table_name or not re.match(r"^[a-zA-Z0-9_]+$", table_name):
        return json.dumps({"error": "Invalid or missing table_name."})
    target_path = db_path or _DEFAULT_DB_PATH
    try:
        conn = _get_connection(target_path)
        cursor = conn.cursor()
        cursor.execute(f'PRAGMA table_info("{table_name}")')
        columns = [
            {
                "cid": row["cid"],
                "name": row["name"],
                "type": row["type"],
                "notnull": bool(row["notnull"]),
                "dflt_value": row["dflt_value"],
                "pk": bool(row["pk"]),
            }
            for row in cursor.fetchall()
        ]
        conn.close()
        if not columns:
            return json.dumps({"error": f"Table '{table_name}' does not exist or has no columns."})
        return json.dumps({"table": table_name, "columns": columns}, indent=2)
    except Exception as e:
        return json.dumps({"error": f"Failed to describe table '{table_name}': {e}"})


@server.tool(
    name="query_sql",
    description=(
        "Execute a read-only SQL query (SELECT, EXPLAIN, PRAGMA) against the SQLite database. "
        "Returns up to 200 matching rows as JSON."
    ),
)
async def query_sql(query: str, db_path: str = "") -> str:
    """Execute read-only SQL query."""
    clean_query = (query or "").strip()
    if not clean_query:
        return json.dumps({"error": "Query cannot be empty."})

    if _DISALLOWED_SQL_PATTERNS.search(clean_query):
        return json.dumps(
            {"error": "Permission denied: only read-only queries (SELECT, EXPLAIN, PRAGMA) are permitted."}
        )

    target_path = db_path or _DEFAULT_DB_PATH
    try:
        conn = _get_connection(target_path)
        conn.execute("PRAGMA query_only = ON")
        cursor = conn.cursor()
        cursor.execute(clean_query)
        rows = cursor.fetchmany(200)
        col_names = [d[0] for d in cursor.description] if cursor.description else []
        records = [dict(zip(col_names, row)) for row in rows]
        conn.close()
        return json.dumps(
            {
                "rows_returned": len(records),
                "columns": col_names,
                "data": records,
            },
            indent=2,
            default=str,
        )
    except Exception as e:
        return json.dumps({"error": f"SQL Execution error: {e}"})


async def run_server() -> None:
    await server.run_stdio_async()


def main() -> None:
    global _DEFAULT_DB_PATH
    parser = argparse.ArgumentParser(description="Vaeloom SQLite Memory MCP Server")
    parser.add_argument(
        "--db-path",
        default=_DEFAULT_DB_PATH,
        help="Path to the SQLite database file",
    )
    args, _ = parser.parse_known_args()
    _DEFAULT_DB_PATH = args.db_path
    asyncio.run(run_server())


if __name__ == "__main__":
    main()
