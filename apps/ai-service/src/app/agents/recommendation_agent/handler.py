"""
Recommendation Agent — suggest jobs, connections, content based on user profile.
Suggest autonomy. Never recommends irrelevant or low-quality matches.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class RecommendationAgent(BaseAgent):
    mission = "Suggest jobs, connections, content based on user profile"
    tools = [
        Tool(name="match_jobs", description="Match user profile to relevant job openings"),
        Tool(name="suggest_connections", description="Suggest professional connections based on network and goals"),
        Tool(name="curate_content", description="Curate relevant articles, posts, and resources"),
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
        profile: Dict[str, Any],
        preferences: Optional[Dict[str, Any]] = None,
        limit: int = 10,
    ) -> Dict[str, Any]:
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
        profile: Dict[str, Any],
        industry: Optional[str] = None,
        goals: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
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
        interests: List[str],
        content_type: Optional[str] = None,
        depth: str = "overview",
    ) -> Dict[str, Any]:
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

    def _fallback_jobs(self, profile: Dict[str, Any]) -> Dict[str, Any]:
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

    def _fallback_connections(self, profile: Dict[str, Any]) -> Dict[str, Any]:
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

    def _fallback_content(self, interests: List[str]) -> Dict[str, Any]:
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
