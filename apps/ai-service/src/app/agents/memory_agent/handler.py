"""
Memory Agent — extract structured entities from user documents.
Upgraded from Phase 4 modules to full specialist agent with handler.
"""
import logging
from typing import Any, Dict, List

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from .extraction import extract, ExtractedFacts
from .merge import merge_check, MergeResult
from .retrieval import retrieve, RetrievedMemory

logger = logging.getLogger(__name__)


class MemoryAgentHandler(BaseAgent):
    mission = "Extract structured entities from user documents"
    tools = [
        Tool(name="search_documents", description="Search workspace documents"),
        Tool(name="create_entity", description="Create knowledge graph entity"),
        Tool(name="merge_entities", description="Merge duplicate entities"),
        Tool(name="query_graph", description="Query knowledge graph"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["profile", "document"],
        write_types=["profile", "document"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "memory",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more context to extract entities from this content.",
                "details": None,
                "proposals": [],
                "questions": ["Could you provide more details about this document?"],
            },
        }

    async def execute(
        self,
        content: str,
        source_type: str,
        source_id: str,
        workspace_id: str,
    ) -> Dict[str, Any]:
        """
        Full Memory Agent flow:
        1. Extract entities/relationships from content
        2. Check for duplicates via merge_check
        3. Return results for knowledge graph update
        """
        # 1. Extract facts
        facts: ExtractedFacts = await extract(content, source_type, source_id, workspace_id)

        # 2. Check each entity for merge candidates
        merge_results: List[Dict[str, Any]] = []
        for entity in facts.entities:
            result: MergeResult = await merge_check(
                entity.name, entity.aliases, workspace_id
            )
            merge_results.append({
                "entity": entity.name,
                "action": result.action,
                "target_id": result.target_id,
                "confidence": result.confidence,
            })

        return {
            "agent_name": "memory",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": f"Extracted {len(facts.entities)} entities and {len(facts.relationships)} relationships.",
                "details": {
                    "entities": [e.model_dump() for e in facts.entities],
                    "relationships": [r.model_dump() for r in facts.relationships],
                    "merge_decisions": merge_results,
                },
                "proposals": [],
                "questions": [],
            },
        }
