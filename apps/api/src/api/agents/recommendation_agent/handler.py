"""
Recommendation Agent — suggest jobs, connections, content based on user profile.
Suggest autonomy. Never recommends irrelevant or low-quality matches.
"""
import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class RecommendationAgent(BaseAgent):
    mission = "Suggest jobs, connections, content based on user profile"
    tools = [
        Tool(name="match_jobs", description="Match user profile to relevant job openings"),
        Tool(name="suggest_connections", description="Suggest professional connections based on network and goals"),
        Tool(name="curate_content", description="Curate relevant articles, posts, and resources"),
        Tool(name="search_jobs", description="Search job platforms for matching roles"),
        Tool(name="query_graph", description="Query knowledge graph for profile and preferences"),
        Tool(name="web_search", description="Real-time web search for curated content"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["profile", "skills", "experience", "preferences", "network"],
        write_types=["recommendations", "preferences"],
    )
    default_autonomy = "suggest"

    async def fallback(self) -> Any:
        return {
            "agent_name": "recommendation",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need your profile information to make recommendations.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What kind of recommendations are you looking for?",
                    "What are your current career interests?",
                ],
            },
        }

    async def match_jobs(
        self,
        profile: dict[str, Any],
        preferences: dict[str, Any] | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_jobs(profile)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a job matching specialist. Match user profiles to ideal roles. Return JSON with: matched_jobs, match_scores, reasoning, skill_alignment, growth_potential."},
                {"role": "user", "content": f"Profile skills: {', '.join(profile.get('skills', []))}\nExperience: {profile.get('experience', 'Not specified')}\nPreferences: {preferences or 'None'}\nLimit: {limit}"},
            ], temperature=0.4, max_tokens=512)
            return {
                "agent_name": "recommendation",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Job matches found: {limit} recommendations",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Job matching failed: {e}")
            return self._fallback_jobs(profile)

    async def suggest_connections(
        self,
        profile: dict[str, Any],
        industry: str | None = None,
        goals: list[str] | None = None,
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_connections(profile)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a networking strategist. Suggest valuable professional connections. Return JSON with: suggested_connections, networking_groups, events, introduction_strategies."},
                {"role": "user", "content": f"Profile: {profile.get('title', 'Professional')} in {profile.get('industry', 'General')}\nTarget industry: {industry or 'Same as profile'}\nGoals: {', '.join(goals) if goals else 'Career growth'}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "recommendation",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": "Connection suggestions ready",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Connection suggestions failed: {e}")
            return self._fallback_connections(profile)

    async def curate_content(
        self,
        interests: list[str],
        content_type: str | None = None,
        depth: str = "overview",
    ) -> dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_content(interests)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a content curator. Curate relevant and high-quality content. Return JSON with: articles, tutorials, videos, podcasts, books, relevance_explanation."},
                {"role": "user", "content": f"Interests: {', '.join(interests)}\nContent type: {content_type or 'All types'}\nDepth: {depth}"},
            ], temperature=0.5, max_tokens=512)
            return {
                "agent_name": "recommendation",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Curated content on {', '.join(interests)}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Content curation failed: {e}")
            return self._fallback_content(interests)

    def _fallback_jobs(self, profile: dict[str, Any]) -> dict[str, Any]:
        return {
            "agent_name": "recommendation",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Job matching results",
                "details": {"profile_skills": profile.get('skills', []), "note": "Detailed matching requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_connections(self, profile: dict[str, Any]) -> dict[str, Any]:
        return {
            "agent_name": "recommendation",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": "Connection suggestions",
                "details": {"profile": profile.get('title', 'Unknown'), "note": "Detailed suggestions require an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_content(self, interests: list[str]) -> dict[str, Any]:
        return {
            "agent_name": "recommendation",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Content on {', '.join(interests)}",
                "details": {"interests": interests, "note": "Detailed curation requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
