import asyncio
import sys
import tempfile
import os
from typing import Any


class SandboxExecutionError(Exception):
    pass


class SubprocessSandbox:
    """Safely executes untrusted Python code in an isolated subprocess with strict timeouts."""

    def __init__(self, timeout_seconds: float = 10.0):
        self.timeout_seconds = timeout_seconds

    async def execute_python(self, code: str) -> dict[str, Any]:
        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as tmp:
            tmp.write(code)
            tmp_path = tmp.name

        try:
            cmd = [sys.executable, "-I", tmp_path]  # -I: isolated mode (no user site-packages, no env)
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=self.timeout_seconds)
                return {
                    "exit_code": proc.returncode,
                    "stdout": stdout.decode("utf-8", errors="replace"),
                    "stderr": stderr.decode("utf-8", errors="replace"),
                    "success": proc.returncode == 0,
                }
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                raise SandboxExecutionError(f"Execution timed out after {self.timeout_seconds} seconds")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
