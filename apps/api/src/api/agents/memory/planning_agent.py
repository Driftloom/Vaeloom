import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class PlanningAgent(BaseAgent):
    mission = "Build learning and career roadmaps from user profiles and goals"
    tools = [
        Tool(name="build_roadmap", description="Build a structured learning or career roadmap from profile + goals"),
        Tool(name="suggest_milestones", description="Suggest milestones and checkpoints for a given roadmap"),
        Tool(name="recommend_resources", description="Recommend learning resources for a roadmap step"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["person", "skill", "experience", "education", "goal", "achievement", "certification"],
        write_types=["roadmaps", "plans", "recommendations"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "planning",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need profile information and goals to build a roadmap.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What are your career or learning goals?",
                    "What is your current skill level or background?",
                ],
            },
        }

    async def _llm_plan(self, system_prompt: str, user_content: str, temp: float = 0.4) -> dict[str, Any]:
        if not settings.llm_api_key:
            return {"summary": "Planning unavailable", "details": {"note": "Requires LLM API key"}}
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ], temperature=temp, max_tokens=1024)
            return {"summary": "Plan generated", "details": response["content"]}
        except Exception as e:
            logger.warning("PlanningAgent LLM call failed: %s", e)
            return {"summary": "Planning failed", "details": {"error": str(e)}}

    async def build_roadmap(self, profile: dict[str, Any], goals: list[str]) -> dict[str, Any]:
        profile_str = "; ".join(f"{k}: {v}" for k, v in profile.items())
        goals_str = "; ".join(goals)
        result = await self._llm_plan(
            "You are a career and learning roadmap builder. Create a structured roadmap based on the user's profile and goals. "
            "Return JSON with: roadmap_title, phases, estimated_duration, prerequisites, skill_gaps, milestones.",
            f"Profile: {profile_str}\nGoals: {goals_str}",
        )
        return {
            "agent_name": "planning",
            "action": "build_roadmap",
            "confidence": 0.85,
            "result": result,
        }

    async def suggest_milestones(self, roadmap: dict[str, Any], timeline_months: int = 12) -> dict[str, Any]:
        roadmap_str = str(roadmap)[:4000]
        result = await self._llm_plan(
            f"You are a milestone planner. Suggest specific, measurable milestones for the given roadmap within {timeline_months} months. "
            "Return JSON with: milestones, checkpoints, success_criteria, review_frequency.",
            f"Roadmap: {roadmap_str}\nTimeline: {timeline_months} months",
        )
        return {
            "agent_name": "planning",
            "action": "suggest_milestones",
            "confidence": 0.85,
            "result": result,
        }

    async def recommend_resources(self, topic: str, skill_level: str = "intermediate", format: str = "any") -> dict[str, Any]:
        result = await self._llm_plan(
            "You are a learning resource curator. Recommend high-quality learning resources for the given topic and skill level. "
            "Return JSON with: resources, difficulty, estimated_time, prerequisites, alternatives.",
            f"Topic: {topic}\nSkill level: {skill_level}\nFormat preference: {format}",
            temp=0.5,
        )
        return {
            "agent_name": "planning",
            "action": "recommend_resources",
            "confidence": 0.8,
            "result": result,
        }
