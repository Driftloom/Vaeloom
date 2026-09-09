"""
NotebookLM Integration Service for Vaeloom.
Provides async grounding and query access to NotebookLM / Gemini Notebooks,
with the PIOS Blueprint (610611eb-a7df-4315-b717-c7398df55441) as default.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import shutil
from typing import Any

logger = logging.getLogger(__name__)

# Default PIOS Blueprint Notebook ID
PIOS_NOTEBOOK_ID = "610611eb-a7df-4315-b717-c7398df55441"
PIOS_NOTEBOOK_TITLE = "PIOS: The Personal Intelligence Operating System Blueprint"


class NotebookLMService:
    """Service wrapping the NotebookLM CLI / API for agent grounding."""

    def __init__(self, default_notebook_id: str = PIOS_NOTEBOOK_ID):
        self.default_notebook_id = default_notebook_id

    def _get_executable(self) -> str:
        """Find notebooklm CLI binary on PATH or standard install locations."""
        exe = shutil.which("notebooklm")
        if exe:
            return exe

        # Check known Windows roaming path
        roaming = os.environ.get("APPDATA")
        if roaming:
            candidate = os.path.join(
                roaming, "Python", "Python314", "Scripts", "notebooklm.exe"
            )
            if os.path.exists(candidate):
                return candidate

        return "notebooklm"

    async def query(
        self,
        prompt: str,
        notebook_id: str | None = None,
        timeout: float = 60.0,
    ) -> dict[str, Any]:
        """
        Query a NotebookLM notebook with grounded citations.
        Returns a structured dictionary with answer, citations, and metadata.
        """
        target_notebook = notebook_id or self.default_notebook_id
        exe = self._get_executable()

        cmd = [
            exe,
            "ask",
            "-n",
            target_notebook,
            "--json",
            prompt,
        ]

        logger.info(
            "Executing NotebookLM query against notebook %s: '%s'",
            target_notebook,
            prompt[:60],
        )

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_bytes, stderr_bytes = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
            stderr = stderr_bytes.decode("utf-8", errors="replace").strip()

            if proc.returncode != 0:
                logger.warning(
                    "NotebookLM CLI exited with code %d: %s",
                    proc.returncode,
                    stderr or stdout,
                )
                return {
                    "success": False,
                    "notebook_id": target_notebook,
                    "answer": "",
                    "error": stderr or stdout or f"Exited with code {proc.returncode}",
                    "citations": [],
                }

            # Try parsing JSON output
            try:
                data = json.loads(stdout)
                return {
                    "success": True,
                    "notebook_id": target_notebook,
                    "answer": data.get("answer") or data.get("content") or stdout,
                    "citations": data.get("citations") or [],
                    "conversation_id": data.get("conversation_id"),
                    "raw": data,
                }
            except json.JSONDecodeError:
                # If CLI emitted plain text formatted answer
                cleaned_answer = stdout
                if "Answer:" in cleaned_answer:
                    cleaned_answer = cleaned_answer.split("Answer:", 1)[1].strip()
                return {
                    "success": True,
                    "notebook_id": target_notebook,
                    "answer": cleaned_answer,
                    "citations": [],
                    "raw": stdout,
                }

        except asyncio.TimeoutError:
            logger.error("NotebookLM query timed out after %.1fs", timeout)
            return {
                "success": False,
                "notebook_id": target_notebook,
                "answer": "",
                "error": f"Query timed out after {timeout}s",
                "citations": [],
            }
        except Exception as exc:
            logger.exception("Failed to execute NotebookLM query: %s", exc)
            return {
                "success": False,
                "notebook_id": target_notebook,
                "answer": "",
                "error": str(exc),
                "citations": [],
            }

    async def list_sources(
        self,
        notebook_id: str | None = None,
        timeout: float = 30.0,
    ) -> list[dict[str, Any]]:
        """List ingested sources in the notebook."""
        target_notebook = notebook_id or self.default_notebook_id
        exe = self._get_executable()

        cmd = [exe, "source", "list", "-n", target_notebook, "--json"]

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout_bytes, _ = await asyncio.wait_for(
                proc.communicate(), timeout=timeout
            )
            stdout = stdout_bytes.decode("utf-8", errors="replace").strip()
            data = json.loads(stdout)
            return data.get("sources", [])
        except Exception as exc:
            logger.warning("Failed to list NotebookLM sources: %s", exc)
            return []


# Global singleton
notebooklm_service = NotebookLMService()
