import logging
from typing import Any

from backend.orchestrator.base import BaseAgent, MemoryScopes, Tool
from backend.services.llm_service import llm_service
from backend.config import settings

logger = logging.getLogger(__name__)


class ReflectionAgent(BaseAgent):
    mission = "Background job that consolidates memories, detects duplicates, and infers new connections"
    tools = [
        Tool(name="consolidate_memories", description="Merge related memories into consolidated entries"),
        Tool(name="detect_duplicates", description="Find duplicate or near-duplicate memory records"),
        Tool(name="infer_connections", description="Infer new connections between existing memory records"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["memory", "memory_records", "entities", "relationships"],
        write_types=["memory", "memory_records", "connections", "consolidation_logs"],
    )
    default_autonomy = "full"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "reflection",
            "action": "idle",
            "confidence": 1.0,
            "result": {
                "summary": "Reflection agent is idle. No consolidation or connection work pending.",
                "details": None,
                "proposals": [],
                "questions": [],
            },
        }

    async def _llm_reflect(self, system_prompt: str, user_content: str, temp: float = 0.2) -> dict[str, Any]:
        if not settings.llm_api_key:
            return {"summary": "Reflection unavailable", "details": {"note": "Requires LLM API key"}}
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ], temperature=temp, max_tokens=1024)
            return {"summary": "Reflection complete", "details": response["content"]}
        except Exception as e:
            logger.warning("ReflectionAgent LLM call failed: %s", e)
            return {"summary": "Reflection failed", "details": {"error": str(e)}}

    async def consolidate_memories(self, memories: list[dict[str, Any]], merge_strategy: str = "smart") -> dict[str, Any]:
        mem_str = "; ".join([f"{m.get('id','?')}: {m.get('title','')} ({m.get('type','')})" for m in memories[:20]])
        result = await self._llm_reflect(
            f"You are a memory consolidation agent. Analyze the following memories and propose a consolidation strategy ({merge_strategy}). "
            "Return JSON with: consolidation_plan, merged_entries, rationale, conflict_resolution, preserved_details.",
            f"Memories ({len(memories)} total):\n{mem_str}",
        )
        return {
            "agent_name": "reflection",
            "action": "consolidate",
            "confidence": 0.8,
            "result": result,
        }

    async def detect_duplicates(self, memories: list[dict[str, Any]], threshold: float = 0.85) -> dict[str, Any]:
        mem_str = "; ".join([f"{m.get('id','?')}: {m.get('title','')} ({m.get('type','')})" for m in memories[:20]])
        result = await self._llm_reflect(
            f"You are a duplicate detection agent. Find duplicate or near-duplicate memories with similarity above {threshold}. "
            "Return JSON with: duplicate_groups, similarity_scores, recommended_actions, confidence_levels.",
            f"Memories ({len(memories)} total):\n{mem_str}",
        )
        return {
            "agent_name": "reflection",
            "action": "detect_duplicates",
            "confidence": 0.85,
            "result": result,
        }

    async def infer_connections(self, memories: list[dict[str, Any]], connection_types: list[str] | None = None) -> dict[str, Any]:
        mem_str = "; ".join([f"{m.get('id','?')}: {m.get('title','')} ({m.get('type','')})" for m in memories[:15]])
        types_str = ", ".join(connection_types) if connection_types else "all relevant"
        result = await self._llm_reflect(
            f"You are a knowledge graph inference agent. Infer new connections between these memory records. "
            f"Connection types to consider: {types_str}. "
            "Return JSON with: new_connections, relationship_type, strength, evidence, confidence.",
            f"Memories ({len(memories)} total):\n{mem_str}",
        )
        return {
            "agent_name": "reflection",
            "action": "infer_connections",
            "confidence": 0.75,
            "result": result,
        }
