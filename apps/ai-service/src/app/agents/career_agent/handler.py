"""
Career Agent — guide users on career paths and skill development.
Read-only, full autonomy. Never fabricates career data.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class CareerPathResult:
    pass


class CareerAgent(BaseAgent):
    mission = "Guide users on career paths and skill development"
    tools = [
        Tool(name="analyze_career_path", description="Analyze possible career paths based on user profile"),
        Tool(name="identify_skill_gaps", description="Identify gaps between current skills and target role requirements"),
        Tool(name="recommend_courses", description="Recommend learning resources to close skill gaps"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["career", "skills", "education", "experience"],
        write_types=[],
    )
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return {
            "agent_name": "career",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to analyze your career path.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What is your current role or field of interest?",
                    "What career goals are you targeting?",
                ],
            },
        }

    async def analyze_career_path(
        self,
        current_role: str,
        skills: List[str],
        target_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_analysis(current_role, target_role)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a career development expert. Analyze career paths and provide structured guidance. Return JSON with fields: possible_paths, recommended_milestones, timeframe_estimate."},
                {"role": "user", "content": f"Current role: {current_role}\nSkills: {', '.join(skills)}\nTarget role: {target_role or 'Not specified'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "career",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Career path analysis for {current_role}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Career path analysis failed: {e}")
            return self._fallback_analysis(current_role, target_role)

    async def identify_skill_gaps(
        self,
        current_skills: List[str],
        target_role: str,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_gaps(current_skills, target_role)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a skills assessment expert. Identify skill gaps between current skills and target role requirements. Return JSON with: missing_skills, existing_skills, priority_gaps, recommended_resources."},
                {"role": "user", "content": f"Current skills: {', '.join(current_skills)}\nTarget role: {target_role}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "career",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Skill gap analysis for {target_role}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Skill gap identification failed: {e}")
            return self._fallback_gaps(current_skills, target_role)

    async def recommend_courses(
        self,
        skill_gaps: List[str],
        budget: Optional[str] = None,
        time_available: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_courses(skill_gaps)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a learning advisor. Recommend courses and resources to fill skill gaps. Return JSON with: course_recommendations, estimated_duration, cost_estimate, alternative_paths."},
                {"role": "user", "content": f"Skills to develop: {', '.join(skill_gaps)}\nBudget: {budget or 'Not specified'}\nTime available: {time_available or 'Not specified'}"},
            ], temperature=0.6, max_tokens=512)
            return {
                "agent_name": "career",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Course recommendations for {len(skill_gaps)} skill areas",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Course recommendation failed: {e}")
            return self._fallback_courses(skill_gaps)

    def _fallback_analysis(self, current_role: str, target_role: Optional[str]) -> Dict[str, Any]:
        return {
            "agent_name": "career",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Career analysis for {current_role}",
                "details": {
                    "current_role": current_role,
                    "target_role": target_role,
                    "note": "Detailed analysis requires an LLM API key. Showing basic structure.",
                },
                "proposals": [],
                "questions": ["Would you like to explore specific career paths in detail?"],
            },
        }

    def _fallback_gaps(self, current_skills: List[str], target_role: str) -> Dict[str, Any]:
        return {
            "agent_name": "career",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Skill gap analysis for {target_role}",
                "details": {
                    "current_skills": current_skills,
                    "target_role": target_role,
                    "note": "Detailed analysis requires an LLM API key.",
                },
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_courses(self, skill_gaps: List[str]) -> Dict[str, Any]:
        return {
            "agent_name": "career",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Course recommendations for {len(skill_gaps)} areas",
                "details": {"skill_gaps": skill_gaps, "note": "Detailed recommendations require an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
