import logging
from typing import Any

from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service
from api.config import settings

logger = logging.getLogger(__name__)


class SelfImprovementAgent(BaseAgent):
    mission = "Track accuracy metrics, learn from feedback, adjust extraction confidence scores"
    tools = [
        Tool(name="log_accuracy", description="Log accuracy metric for a prediction or extraction"),
        Tool(name="process_feedback", description="Process user feedback to adjust confidence scores"),
        Tool(name="adjust_confidence", description="Adjust extraction confidence score for a memory type based on learned patterns"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["accuracy_logs", "feedback", "memory_extractions"],
        write_types=["confidence_adjustments", "improvement_insights"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "self_improvement",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need data to evaluate or improve extraction accuracy.",
                "details": None,
                "proposals": [],
                "questions": ["What accuracy data or feedback would you like me to analyze?"],
            },
        }

    async def _llm_analyze(self, system_prompt: str, user_content: str, temp: float = 0.3) -> dict[str, Any]:
        if not settings.llm_api_key:
            return {"summary": "LLM analysis unavailable", "details": {"note": "Requires LLM API key"}}
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ], temperature=temp, max_tokens=512)
            return {"summary": "Analysis complete", "details": response["content"]}
        except Exception as e:
            logger.warning("SelfImprovementAgent LLM call failed: %s", e)
            return {"summary": "Analysis failed", "details": {"error": str(e)}}

    async def log_accuracy(self, extraction_type: str, expected: str, actual: str, correct: bool) -> dict[str, Any]:
        return {
            "agent_name": "self_improvement",
            "action": "log",
            "confidence": 1.0,
            "result": {
                "summary": f"Accuracy logged for {extraction_type}: {'correct' if correct else 'incorrect'}",
                "details": {"extraction_type": extraction_type, "expected": expected, "actual": actual, "correct": correct},
                "proposals": [],
                "questions": [],
            },
        }

    async def process_feedback(self, feedback_text: str, memory_type: str | None = None) -> dict[str, Any]:
        result = await self._llm_analyze(
            "You are a quality analyst. Analyze user feedback about memory extractions. "
            "Return JSON with: sentiment, inferred_accuracy_bias, suggested_confidence_adjustment, issues_detected.",
            f"Feedback: {feedback_text}\nMemory type: {memory_type or 'unspecified'}",
        )
        return {
            "agent_name": "self_improvement",
            "action": "analyze_feedback",
            "confidence": 0.8,
            "result": result,
        }

    async def adjust_confidence(self, memory_type: str, recent_accuracy: float, sample_size: int) -> dict[str, Any]:
        adjustment_factor = 0.0
        if sample_size >= 10:
            adjustment_factor = round((recent_accuracy - 0.85) * 0.5, 4)

        return {
            "agent_name": "self_improvement",
            "action": "adjust_confidence",
            "confidence": 0.9,
            "result": {
                "summary": f"Confidence adjustment for {memory_type}: {adjustment_factor:+.4f}",
                "details": {
                    "memory_type": memory_type,
                    "recent_accuracy": recent_accuracy,
                    "sample_size": sample_size,
                    "adjustment_factor": adjustment_factor,
                    "new_base_confidence": max(0.0, min(1.0, 0.85 + adjustment_factor)),
                },
                "proposals": [],
                "questions": [],
            },
        }
