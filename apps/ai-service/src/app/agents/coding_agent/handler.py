"""
Coding Agent — assist with coding challenges, technical interview prep.
Suggest autonomy. Never runs untrusted code; provides educational solutions.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class CodingAgent(BaseAgent):
    mission = "Assist with coding challenges, technical interview prep"
    tools = [
        Tool(name="solve_challenge", description="Solve a coding challenge with explanation"),
        Tool(name="review_code", description="Review code for correctness, style, and optimization"),
        Tool(name="generate_practice", description="Generate practice problems for interview prep"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["coding", "challenges", "skills", "progress"],
        write_types=["coding", "progress"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "coding",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more details to help with coding.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What coding challenge or problem are you working on?",
                    "What programming language are you using?",
                ],
            },
        }

    async def solve_challenge(
        self,
        problem_statement: str,
        language: str = "python",
        constraints: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_challenge(problem_statement)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a coding interview expert. Solve challenges with clear explanations. Return JSON with: approach, solution_code, time_complexity, space_complexity, edge_cases, explanation."},
                {"role": "user", "content": f"Problem: {problem_statement}\nLanguage: {language}\nConstraints: {', '.join(constraints) if constraints else 'None specified'}"},
            ], temperature=0.4, max_tokens=1024)
            return {
                "agent_name": "coding",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Coding challenge solution",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Challenge solving failed: {e}")
            return self._fallback_challenge(problem_statement)

    async def review_code(
        self,
        code_snippet: str,
        language: str = "python",
        focus: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_review(code_snippet)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a senior code reviewer. Review code for quality, security, and performance. Return JSON with: issues, suggestions, best_practices, security_concerns, optimizations."},
                {"role": "user", "content": f"Code:\n```{language}\n{code_snippet}\n```\nFocus: {focus or 'General review'}"},
            ], temperature=0.3, max_tokens=1024)
            return {
                "agent_name": "coding",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Code review complete",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Code review failed: {e}")
            return self._fallback_review(code_snippet)

    async def generate_practice(
        self,
        topics: List[str],
        difficulty: str = "medium",
        language: str = "python",
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_practice(topics)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a coding interview coach. Generate practice problems. Return JSON with: problems, difficulty_level, topics_covered, estimated_time, solution_hints, follow_up_questions."},
                {"role": "user", "content": f"Topics: {', '.join(topics)}\nDifficulty: {difficulty}\nLanguage: {language}"},
            ], temperature=0.6, max_tokens=1024)
            return {
                "agent_name": "coding",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Practice problems on {', '.join(topics)}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Practice generation failed: {e}")
            return self._fallback_practice(topics)

    def _fallback_challenge(self, problem: str) -> Dict[str, Any]:
        return {
            "agent_name": "coding",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Challenge solution",
                "details": {"problem": problem, "note": "Detailed solution requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_review(self, code: str) -> Dict[str, Any]:
        return {
            "agent_name": "coding",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Code review",
                "details": {"code_preview": code[:100], "note": "Detailed review requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_practice(self, topics: List[str]) -> Dict[str, Any]:
        return {
            "agent_name": "coding",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Practice on {', '.join(topics)}",
                "details": {"topics": topics, "note": "Detailed practice generation requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
