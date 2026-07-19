"""
Drive Agent — list Drive files, download new/changed files, ingest content.
Integrates with real Google Drive API via DriveClient, falls back gracefully.
"""
import logging
from typing import Any, Dict, Optional

from backend.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class DriveAgent(BaseAgent):
    mission = "Sync Google Drive files, download new/changed content, and ingest into the knowledge base"
    tools = [
        Tool(name="list_drive_files", description="List recent files in Google Drive"),
        Tool(name="download_file", description="Download a file by its Drive file ID"),
        Tool(name="search_drive", description="Full-text search across Drive files"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["documents"],
        write_types=["documents", "episodic"],
    )
    default_autonomy = "suggest"

    def __init__(self):
        super().__init__()
        self._client = None

    async def _get_client(self):
        if self._client is None:
            from backend.clients.drive_client import DriveClient
            self._client = DriveClient()
        return self._client

    async def fallback(self) -> Any:
        return {
            "agent_name": "drive",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need access to your Google Drive to sync files.",
                "details": None,
                "proposals": [],
                "questions": ["Would you like to connect your Google Drive account?"],
            },
        }

    async def process(self, request: Any) -> Dict[str, Any]:
        client = await self._get_client()
        if not client._configured:
            return await self.fallback()

        files = await client.list_files(page_size=50)
        if files is None:
            return await self.fallback()

        ingested = []
        for f in files:
            ingested.append(await self._process_file(client, f))

        return {
            "agent_name": "drive",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": f"Scanned {len(files)} Drive files, ingested {len([i for i in ingested if i])}.",
                "details": ingested,
                "proposals": [],
                "questions": [],
            },
            "metadata": {"file_count": len(files), "ingested_count": len([i for i in ingested if i])},
        }

    async def _process_file(self, client: Any, file_meta: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        file_id = file_meta.get("id", "")
        name = file_meta.get("name", "")
        mime_type = file_meta.get("mimeType", "")

        if mime_type.startswith("application/vnd.google-apps."):
            content = await client.export_file(file_id)
        else:
            content = await client.download_file(file_id)

        if content is None:
            logger.warning(f"Could not download file: {name} ({file_id})")
            return None

        ingested = await self._ingest(file_meta, content)
        return {
            "file_id": file_id,
            "name": name,
            "mime_type": mime_type,
            "modified_time": file_meta.get("modifiedTime", ""),
            "size": file_meta.get("size", 0),
            "ingested": ingested.get("status") == "success" if ingested else False,
        }

    async def _ingest(self, file_meta: Dict[str, Any], content: bytes) -> Optional[Dict[str, Any]]:
        try:
            from backend.ingestion.pipeline import run_pipeline
            name = file_meta.get("name", "unknown")
            workspace_id = "drive_sync"
            return await run_pipeline(workspace_id=workspace_id, filename=name, content=content)
        except Exception as e:
            logger.warning(f"Ingestion failed for {file_meta.get('name', '?')}: {e}")
            return None
