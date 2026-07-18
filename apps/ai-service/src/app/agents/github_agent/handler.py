"""
GitHub Agent — analyze GitHub profiles and repositories for skill assessment.
Read-only, suggest autonomy. Respects rate limits and public data only.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class GitHubAgent(BaseAgent):
    mission = "Analyze GitHub profiles and repositories for skill assessment"
    tools = [
        Tool(name="analyze_profile", description="Analyze a GitHub user's profile for skills and activity"),
        Tool(name="get_repo_stats", description="Get statistics and analysis for a repository"),
        Tool(name="assess_skills", description="Assess technical skills based on GitHub activity"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["github", "skills", "repositories", "contributions"],
        write_types=[],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "github",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need a GitHub username or repository to analyze.",
                "details": None,
                "proposals": [],
                "questions": ["What GitHub username would you like me to analyze?"],
            },
        }

    async def analyze_profile(
        self,
        username: str,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_profile(username)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a GitHub profile analyst. Analyze developer profiles from available data. Return JSON with: skill_summary, top_languages, activity_level, open_source_contributions, profile_strength, recommendations."},
                {"role": "user", "content": f"GitHub username: {username}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Profile analysis for {username}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Profile analysis failed: {e}")
            return self._fallback_profile(username)

    async def get_repo_stats(
        self,
        repo_full_name: str,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_repo(repo_full_name)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a repository analyst. Analyze repositories for code quality, activity, and impact. Return JSON with: tech_stack, code_quality_indicators, activity_metrics, community_engagement, maintenance_health."},
                {"role": "user", "content": f"Repository: {repo_full_name}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Stats for {repo_full_name}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Repo stats failed: {e}")
            return self._fallback_repo(repo_full_name)

    async def assess_skills(
        self,
        username: str,
        target_role: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_skills(username)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a technical skills assessor. Evaluate developer skills based on GitHub activity. Return JSON with: technical_skills, proficiency_levels, experience_areas, growth_areas, role_fit."},
                {"role": "user", "content": f"GitHub username: {username}\nTarget role: {target_role or 'Not specified'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "github",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Skill assessment for {username}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Skill assessment failed: {e}")
            return self._fallback_skills(username)

    def _fallback_profile(self, username: str) -> Dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Profile analysis for {username}",
                "details": {"username": username, "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_repo(self, repo_full_name: str) -> Dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Stats for {repo_full_name}",
                "details": {"repository": repo_full_name, "note": "Detailed stats require an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_skills(self, username: str) -> Dict[str, Any]:
        return {
            "agent_name": "github",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Skill assessment for {username}",
                "details": {"username": username, "note": "Detailed assessment requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
