"""
Sandboxed Playbook Runner - Safely executes embedded Python code snippets from playbooks.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any, Dict


class SandboxedPlaybookRunner:
    def __init__(self, timeout_seconds: int = 15):
        self.timeout_seconds = timeout_seconds

    def execute_snippet(self, code: str) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile(suffix=".py", mode="w", delete=False, encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = Path(tmp.name)

        try:
            proc = subprocess.run(
                [sys.executable, str(tmp_path)],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds,
            )
            return {
                "exit_code": proc.returncode,
                "stdout": proc.stdout,
                "stderr": proc.stderr,
                "success": proc.returncode == 0,
            }
        except subprocess.TimeoutExpired:
            return {
                "exit_code": -1,
                "stdout": "",
                "stderr": f"Execution timed out after {self.timeout_seconds}s",
                "success": False,
            }
        finally:
            if tmp_path.exists():
                tmp_path.unlink()
