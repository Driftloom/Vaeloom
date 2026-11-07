"""Crash-child helper for the Gate 2 resilience proof (test_muse_gate2_resilience).

The parent test starts this script as a REAL child process, waits for it to
commit durable rows to a throwaway SQLite file, then terminates it mid-run. The
parent then verifies that the durable side-effect record and the loop
checkpoint survived the death, and that the durable key still blocks a
duplicate side effect.

This file is a fixture, not a test: it is executed as a subprocess, never
imported by pytest (the name does not match ``test_*``).

Usage:
    python gate2_crash_child.py <db_path> <idem_key>
"""
from __future__ import annotations

import json
import sqlite3
import sys
import time

REQUEST_ID = "req-crash-1"
WORKSPACE_ID = "ws-crash"


def _create_schema(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tool_idempotency (
            id TEXT PRIMARY KEY,
            workspace_id TEXT,
            idem_key TEXT NOT NULL UNIQUE,
            tool_name TEXT,
            agent_id TEXT,
            request_id TEXT,
            status TEXT,
            result_json TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS loop_checkpoints (
            request_id TEXT PRIMARY KEY,
            state_json TEXT,
            state_version INTEGER
        )
        """
    )


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: gate2_crash_child.py <db_path> <idem_key>", flush=True)
        return 2

    db_path, idem_key = sys.argv[1], sys.argv[2]

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        _create_schema(conn)

        result_json = json.dumps({"status": "success"})
        state_json = json.dumps(
            {
                "status": "running",
                "state_version": 2,
                "completed_tool_calls": [
                    {"idem_key": idem_key, "tool": "move_file", "agent_id": "org"}
                ],
            }
        )
        conn.execute(
            "INSERT INTO tool_idempotency "
            "(id, workspace_id, idem_key, tool_name, agent_id, request_id, status, result_json) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("crash-child-1", WORKSPACE_ID, idem_key, "move_file", "org",
             REQUEST_ID, "succeeded", result_json),
        )
        conn.execute(
            "INSERT INTO loop_checkpoints (request_id, state_json, state_version) "
            "VALUES (?, ?, ?)",
            (REQUEST_ID, state_json, 2),
        )
        conn.commit()
    finally:
        conn.close()

    # Marker the parent waits for: the durable rows are committed and fsynced.
    print("durable rows committed", flush=True)

    # Stay alive so the parent can terminate this process mid-run: that is the
    # "real death" the resilience proof depends on.
    time.sleep(300)
    return 0


if __name__ == "__main__":
    sys.exit(main())
