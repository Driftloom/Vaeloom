import logging
from typing import Any

from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service
from api.config import settings

logger = logging.getLogger(__name__)


class DocumentAgent(BaseAgent):
    mission = "General-purpose document Q&A: summarize, extract, and search within documents"
    tools = [
        Tool(name="summarize_document", description="Generate a concise summary of document content"),
        Tool(name="extract_from_document", description="Extract specific information from document content"),
        Tool(name="search_document", description="Search within document content for relevant passages"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["documents", "document_versions"],
        write_types=["document_summaries", "extractions"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "document",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need document content to process.",
                "details": None,
                "proposals": [],
                "questions": ["What document would you like me to analyze?"],
            },
        }

    async def _llm_process(self, system_prompt: str, user_content: str, temp: float = 0.3) -> dict[str, Any]:
        if not settings.llm_api_key:
            return {"summary": "LLM processing unavailable", "details": {"note": "Requires LLM API key"}}
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ], temperature=temp, max_tokens=1024)
            return {"summary": "Processing complete", "details": response["content"]}
        except Exception as e:
            logger.warning("DocumentAgent LLM call failed: %s", e)
            return {"summary": "Processing failed", "details": {"error": str(e)}}

    async def summarize_document(self, content: str, max_length: int = 200) -> dict[str, Any]:
        result = await self._llm_process(
            f"You are a document summarizer. Summarize the following content in at most {max_length} words. "
            "Return JSON with: summary, key_topics, key_points, document_type.",
            content[:8000],
        )
        return {
            "agent_name": "document",
            "action": "summarize",
            "confidence": 0.85,
            "result": result,
        }

    async def extract_from_document(self, content: str, extraction_goal: str) -> dict[str, Any]:
        result = await self._llm_process(
            "You are an information extraction specialist. Extract the requested information from the document. "
            "Return JSON with: extracted_data, confidence, source_passages, missing_fields.",
            f"Extraction goal: {extraction_goal}\n\nContent:\n{content[:8000]}",
        )
        return {
            "agent_name": "document",
            "action": "extract",
            "confidence": 0.85,
            "result": result,
        }

    async def search_document(self, content: str, query: str, top_k: int = 5) -> dict[str, Any]:
        result = await self._llm_process(
            f"You are a document search tool. Find the top {top_k} most relevant passages in the document for the query. "
            "Return JSON with: passages, relevance_scores, query_expansion, coverage_assessment.",
            f"Query: {query}\n\nContent:\n{content[:8000]}",
        )
        return {
            "agent_name": "document",
            "action": "search",
            "confidence": 0.85,
            "result": result,
        }
