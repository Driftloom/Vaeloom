"""
Workspace Agent — analyzes workspace hierarchy, detects sprawl, and maintains organization hygiene.
Suggest autonomy: Proposes structural cleanups, directory consolidation, and permission checks.
"""
from __future__ import annotations

import logging
from typing import Any

from pydantic import BaseModel, Field

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class WorkspaceCleanupProposal(BaseModel):
    action: str = Field(..., description="Action type, e.g. 'archive', 'merge_folder', 'quarantine'")
    target_path: str = Field(..., description="Affected file path or folder")
    rationale: str = Field(..., description="Reason for the proposal")
    confidence: float = Field(0.85, ge=0.0, le=1.0)


class WorkspaceAgent(BaseAgent):
    mission = "Maintain workspace structure, detect sprawl, and propose organizational hygiene cleanups"
    tools = [
        Tool(name="list_workspace_folders", description="List all directory folders in the workspace"),
        Tool(name="create_workspace_folder", description="Create a new folder in the workspace"),
        Tool(name="search_documents", description="Search across workspace documents"),
        Tool(name="rename_file", description="Rename a document in the workspace"),
        Tool(name="move_file", description="Move a document to another folder"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["document", "project", "organization"],
        write_types=["agent_actions", "insight"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "workspace",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I'm ready to analyze your workspace structure and suggest organizational improvements.",
                "details": None,
                "proposals": [],
                "questions": [
                    "Would you like me to scan for orphaned documents or redundant folders?",
                    "Should I analyze file distribution across your projects?",
                ],
            },
        }

    async def analyze_workspace_structure(
        self,
        files: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Analyze folder distribution, unorganized items, and overall depth."""
        total_files = len(files)
        categories: dict[str, int] = {}
        unorganized: list[str] = []

        for f in files:
            path = f.get("path") or f.get("filename") or "untitled"
            parts = [p for p in path.split("/") if p]
            if len(parts) <= 1:
                unorganized.append(path)
            folder = parts[0] if len(parts) > 1 else "root"
            categories[folder] = categories.get(folder, 0) + 1

        return {
            "total_files": total_files,
            "folder_distribution": categories,
            "unorganized_count": len(unorganized),
            "unorganized_sample": unorganized[:5],
            "hygiene_score": max(0.2, min(1.0, 1.0 - (len(unorganized) / max(1, total_files)))),
        }

    async def detect_workspace_sprawl(
        self,
        files: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Identify redundant or duplicate files."""
        sprawl_items: list[dict[str, Any]] = []
        seen_names: dict[str, str] = {}

        for f in files:
            name = (f.get("filename") or f.get("path") or "").lower()
            fid = str(f.get("id") or name)
            # detect duplicate base name or copy markers
            if " copy" in name or "(1)" in name or " v2" in name:
                sprawl_items.append({
                    "id": fid,
                    "name": name,
                    "issue": "Potential duplicate or unmanaged revision",
                    "severity": "medium",
                })
            elif name in seen_names:
                sprawl_items.append({
                    "id": fid,
                    "name": name,
                    "duplicate_of": seen_names[name],
                    "issue": "Identical filename detected in workspace",
                    "severity": "high",
                })
            else:
                seen_names[name] = fid

        return sprawl_items

    async def process(self, request: Any, context: Any = None) -> dict[str, Any]:
        msg = getattr(request, "message", "") if hasattr(request, "message") else (request.get("message", "") if isinstance(request, dict) else "")

        ws_id = getattr(request, "workspace_id", None) if hasattr(request, "workspace_id") else (
            request.get("workspace_id") if isinstance(request, dict) else None
        )
        if not ws_id and context:
            ws_id = getattr(context, "workspace_id", None) or (context.get("workspace_id") if isinstance(context, dict) else None)

        workspace_files: list[dict[str, Any]] = []
        if ws_id:
            try:
                import uuid as _uuid
                from sqlalchemy import select
                from api.database import async_session_factory
                from api.models.schema import Document

                w_uuid = _uuid.UUID(str(ws_id))
                async with async_session_factory() as db:
                    stmt = select(Document).where(Document.workspace_id == w_uuid, Document.deleted_at.is_(None))
                    rows = (await db.execute(stmt)).scalars().all()
                    for r in rows:
                        workspace_files.append({
                            "id": str(r.id),
                            "filename": r.path.rsplit("/", 1)[-1] if r.path else "untitled",
                            "path": r.path,
                        })
            except Exception as ex:
                logger.warning("Failed to retrieve workspace files for WorkspaceAgent: %s", ex)

        if not workspace_files:
            return {
                "agent_name": "workspace",
                "action": "suggest",
                "confidence": 0.95,
                "result": {
                    "summary": "Workspace is clean and empty. No active documents or files found.",
                    "details": "Folder distribution: {'root': 0}",
                    "proposals": [],
                    "questions": ["Would you like to upload your initial project documents or create folders?"],
                },
            }

        structure = await self.analyze_workspace_structure(workspace_files)
        sprawl = await self.detect_workspace_sprawl(workspace_files)

        proposals = []
        for s in sprawl:
            proposals.append({
                "type": "cleanup_proposal",
                "target": s.get("name"),
                "action": "archive" if "copy" in s.get("name", "") else "review_duplicate",
                "rationale": s.get("issue"),
            })

        summary = (
            f"Workspace Analysis: {structure['total_files']} files analyzed. "
            f"Hygiene score: {int(structure['hygiene_score'] * 100)}%. "
            f"Detected {len(sprawl)} potential sprawl items requiring attention."
        )

        return {
            "agent_name": "workspace",
            "action": "suggest",
            "confidence": 0.92,
            "result": {
                "summary": summary,
                "details": f"Folder distribution: {structure['folder_distribution']}",
                "proposals": proposals,
                "questions": [
                    "Would you like me to archive redundant copy files automatically?"
                ] if sprawl else [],
            },
        }

    async def execute(self, request: Any, context: Any = None) -> Any:
        return await self.process(request, context)
