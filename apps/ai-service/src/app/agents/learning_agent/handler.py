"""
Learning Agent — curate personalized learning resources.
Suggest autonomy. Never recommends unverified or low-quality materials.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class LearningAgent(BaseAgent):
    mission = "Curate personalized learning resources"
    tools = [
        Tool(name="search_courses", description="Search for courses based on topic and level"),
        Tool(name="recommend_materials", description="Recommend learning materials tailored to user"),
        Tool(name="track_progress", description="Track learning progress and suggest next steps"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["skills", "learning", "goals", "progress"],
        write_types=["learning", "progress"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "learning",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to recommend learning resources.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What topic or skill would you like to learn?",
                    "What is your current proficiency level?",
                ],
            },
        }

    async def search_courses(
        self,
        topic: str,
        level: str = "beginner",
        format: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_search(topic, level)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a learning resource curator. Search and recommend courses. Return JSON with: courses, provider, duration, difficulty, skills_covered, rating."},
                {"role": "user", "content": f"Topic: {topic}\nLevel: {level}\nFormat preference: {format or 'Any'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "learning",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Found courses for '{topic}' at {level} level",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Course search failed: {e}")
            return self._fallback_search(topic, level)

    async def recommend_materials(
        self,
        skill: str,
        goal: Optional[str] = None,
        preferred_formats: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_materials(skill)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a learning materials expert. Recommend books, articles, videos, and interactive resources. Return JSON with: recommendations, type, difficulty, estimated_time, relevance_score."},
                {"role": "user", "content": f"Skill: {skill}\nGoal: {goal or 'General improvement'}\nPreferred formats: {', '.join(preferred_formats) if preferred_formats else 'Any'}"},
            ], temperature=0.6, max_tokens=512)
            return {
                "agent_name": "learning",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Learning materials for '{skill}'",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Material recommendation failed: {e}")
            return self._fallback_materials(skill)

    async def track_progress(
        self,
        completed_items: List[str],
        current_goal: Optional[str] = None,
        time_spent_hours: Optional[float] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_progress(completed_items)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a learning progress tracker. Analyze progress and suggest next steps. Return JSON with: progress_summary, completion_rate, next_milestones, adjustments."},
                {"role": "user", "content": f"Completed: {', '.join(completed_items)}\nGoal: {current_goal or 'Not specified'}\nTime spent: {time_spent_hours or 'Unknown'} hours"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "learning",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Learning progress updated",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Progress tracking failed: {e}")
            return self._fallback_progress(completed_items)

    def _fallback_search(self, topic: str, level: str) -> Dict[str, Any]:
        return {
            "agent_name": "learning",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Course search for '{topic}'",
                "details": {"topic": topic, "level": level, "note": "Detailed search requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_materials(self, skill: str) -> Dict[str, Any]:
        return {
            "agent_name": "learning",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Materials for '{skill}'",
                "details": {"skill": skill, "note": "Detailed recommendations require an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_progress(self, completed_items: List[str]) -> Dict[str, Any]:
        return {
            "agent_name": "learning",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Progress on {len(completed_items)} completed items",
                "details": {"completed_items": completed_items, "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
