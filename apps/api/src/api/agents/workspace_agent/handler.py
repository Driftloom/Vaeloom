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
        Tool(name="analyze_workspace_structure", description="Analyze folder hierarchy and file distribution"),
        Tool(name="detect_workspace_sprawl", description="Identify orphaned, redundant, or stale files"),
        Tool(name="propose_workspace_cleanup", description="Generate actionable reorganization proposals"),
        Tool(name="audit_workspace_permissions", description="Review workspace membership and role hygiene"),
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

    async def process(self, request: Any) -> dict[str, Any]:
        msg = getattr(request, "message", "") if hasattr(request, "message") else (request.get("message", "") if isinstance(request, dict) else "")
        msg_lower = (msg or "").lower()

        sample_files = [
            {"id": "f1", "filename": "resume_2026.pdf", "path": "career/resume_2026.pdf"},
            {"id": "f2", "filename": "resume_2026 copy.pdf", "path": "root/resume_2026 copy.pdf"},
            {"id": "f3", "filename": "notes.txt", "path": "notes.txt"},
            {"id": "f4", "filename": "project_spec.md", "path": "projects/vaeloom/project_spec.md"},
        ]

        structure = await self.analyze_workspace_structure(sample_files)
        sprawl = await self.detect_workspace_sprawl(sample_files)

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
        return await self.process(request)
