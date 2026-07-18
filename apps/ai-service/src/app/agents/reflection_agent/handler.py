"""
Reflection Agent — weekly/monthly summaries and self-improvement insights.
Suggest autonomy (weekly schedule). Privacy-aware; never exposes raw user data.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ReflectionAgent(BaseAgent):
    mission = "Weekly/monthly summaries and self-improvement insights"
    tools = [
        Tool(name="generate_weekly_digest", description="Generate a weekly summary of activity and progress"),
        Tool(name="monthly_review", description="Generate a comprehensive monthly review"),
        Tool(name="track_goals", description="Track progress toward career and personal goals"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["activity", "goals", "progress", "achievements", "timeline"],
        write_types=["reflections", "goals", "insights"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "reflection",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need activity data to generate insights.",
                "details": None,
                "proposals": [],
                "questions": [
                    "Would you like a weekly or monthly reflection?",
                    "What goals or areas would you like me to focus on?",
                ],
            },
        }

    async def generate_weekly_digest(
        self,
        activity_log: List[Dict[str, Any]],
        goals: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_digest(activity_log)
        try:
            activities_str = "; ".join([f"{a.get('action','action')} on {a.get('date','unknown')}" for a in activity_log[:30]])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a personal reflection coach. Generate a weekly digest highlighting progress and areas for growth. Return JSON with: week_summary, achievements, challenges, insights, next_week_focus, mood_trend."},
                {"role": "user", "content": f"Weekly activities:\n{activities_str}\nGoals: {', '.join(goals) if goals else 'Not specified'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "reflection",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Weekly digest generated",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Weekly digest failed: {e}")
            return self._fallback_digest(activity_log)

    async def monthly_review(
        self,
        monthly_data: Dict[str, Any],
        focus_areas: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_review(monthly_data)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a personal growth analyst. Create comprehensive monthly reviews. Return JSON with: executive_summary, key_achievements, growth_areas, patterns, goal_progress, next_month_plan, long_term_alignment."},
                {"role": "user", "content": f"Monthly data: applications={monthly_data.get('applications', 0)}, connections={monthly_data.get('connections', 0)}, skills_added={monthly_data.get('skills_added', 0)}\nFocus: {', '.join(focus_areas) if focus_areas else 'Overall'}"},
            ], temperature=0.5, max_tokens=1024)
            return {
                "agent_name": "reflection",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Monthly review complete",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Monthly review failed: {e}")
            return self._fallback_review(monthly_data)

    async def track_goals(
        self,
        goals: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_goals(goals)
        try:
            goals_str = "; ".join([f"{g.get('name','Goal')} (target: {g.get('target','N/A')}, progress: {g.get('progress',0)}%)" for g in goals])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a goal tracking coach. Analyze goal progress and provide motivational insights. Return JSON with: goal_status, completion_forecast, blockers, adjustments, motivation_tips."},
                {"role": "user", "content": f"Goals:\n{goals_str}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "reflection",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Goal tracking for {len(goals)} goals",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Goal tracking failed: {e}")
            return self._fallback_goals(goals)

    def _fallback_digest(self, activity_log: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "reflection",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Weekly digest",
                "details": {"activities_count": len(activity_log), "note": "Detailed digest requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_review(self, monthly_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "agent_name": "reflection",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Monthly review",
                "details": {"data_points": len(monthly_data), "note": "Detailed review requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_goals(self, goals: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "reflection",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Status of {len(goals)} goals",
                "details": {"goals_count": len(goals), "note": "Detailed tracking requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
