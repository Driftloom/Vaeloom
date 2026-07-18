"""
Organization Agent — categorize, deduplicate, and rename workspace documents.
Never auto-applies changes; always proposes for user approval.
"""
import logging
import re
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class RenameProposal(BaseModel):
    document_id: str
    current_name: str
    suggested_name: str
    suggested_folder: str
    confidence: float
    is_version_of: Optional[str] = None  # document_id of the parent version


class OrganizationAgent(BaseAgent):
    mission = "Organize, categorize, and deduplicate workspace documents"
    tools = [
        Tool(name="search_documents", description="Search workspace documents"),
        Tool(name="rename_file", description="Rename a file"),
        Tool(name="move_file", description="Move a file to a folder"),
        Tool(name="categorize_document", description="Assign category to document"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["document", "timeline"],
        write_types=["agent_actions"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "organization",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I'm not sure how to categorize this document.",
                "details": None,
                "proposals": [],
                "questions": ["What category would you like this document in?"],
            },
        }

    async def execute(self, documents: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Process a list of documents and generate rename/categorize proposals.
        Never auto-applies — all proposals require user approval.
        """
        proposals = []
        for doc in documents:
            category = self._classify_document(doc.get("filename", ""))
            new_name = self._suggest_filename(doc.get("filename", ""), category)
            confidence = 0.9 if category != "uncategorized" else 0.5

            version_parent = self._detect_version_chain(
                doc.get("filename", ""), documents
            )

            proposal = RenameProposal(
                document_id=doc.get("id", "unknown"),
                current_name=doc.get("filename", ""),
                suggested_name=new_name,
                suggested_folder=category,
                confidence=confidence,
                is_version_of=version_parent,
            )
            proposals.append(proposal)

        # If any proposal has low confidence, ask instead of guessing
        low_confidence = [p for p in proposals if p.confidence < 0.8]
        if low_confidence:
            return {
                "agent_name": "organization",
                "action": "ask_clarification",
                "confidence": min(p.confidence for p in proposals),
                "result": {
                    "summary": f"I need help categorizing {len(low_confidence)} document(s).",
                    "details": None,
                    "proposals": [p.model_dump() for p in proposals if p.confidence >= 0.8],
                    "questions": [
                        f"What category should '{p.current_name}' be in?"
                        for p in low_confidence
                    ],
                },
            }

        return {
            "agent_name": "organization",
            "action": "suggest",
            "confidence": min(p.confidence for p in proposals) if proposals else 1.0,
            "result": {
                "summary": f"Organized {len(proposals)} document(s).",
                "details": None,
                "proposals": [p.model_dump() for p in proposals],
                "questions": [],
            },
        }

    def _classify_document(self, filename: str) -> str:
        """Simple rule-based classification. Real impl uses LLM."""
        lower = filename.lower()
        if "resume" in lower or "cv" in lower:
            return "Resumes"
        if "transcript" in lower or "grade" in lower:
            return "Transcripts"
        if "cert" in lower or "diploma" in lower:
            return "Certificates"
        if "cover" in lower and "letter" in lower:
            return "Cover Letters"
        if "project" in lower or "portfolio" in lower:
            return "Projects"
        return "uncategorized"

    def _suggest_filename(self, filename: str, category: str) -> str:
        """Suggest a clean filename."""
        # Strip version suffixes like _v2, _final, _FINAL
        cleaned = re.sub(r"[_-]?(v\d+|final|draft|copy|new)(?=[_\-\.]|$)", "", filename, flags=re.IGNORECASE)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned or filename

    def _detect_version_chain(
        self, filename: str, all_docs: List[Dict[str, Any]]
    ) -> Optional[str]:
        """
        Detect if this file is a version of another file.
        e.g., Resume_v2_final_FINAL.pdf -> version of Resume.pdf
        """
        base = re.sub(
            r"[_-]?(v\d+|final|draft|copy|new|FINAL)(?=[_\-\.]|$)", "", filename, flags=re.IGNORECASE
        )
        base = re.sub(r"\s+", " ", base).strip()

        for doc in all_docs:
            other = doc.get("filename", "")
            if other == filename:
                continue
            other_base = re.sub(
                r"[_-]?(v\d+|final|draft|copy|new|FINAL)(?=[_\-\.]|$)", "", other, flags=re.IGNORECASE
            )
            other_base = re.sub(r"\s+", " ", other_base).strip()
            if base == other_base and len(other) < len(filename):
                return doc.get("id", None)
        return None
