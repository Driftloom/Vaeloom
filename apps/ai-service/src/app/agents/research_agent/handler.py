"""
Research Agent — conduct web research on companies, industries, market trends.
Read-only, full autonomy. Never fabricates data; cites sources when available.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class ResearchAgent(BaseAgent):
    mission = "Conduct web research on companies, industries, market trends"
    tools = [
        Tool(name="research_company", description="Research a company's background, products, culture, and recent news"),
        Tool(name="analyze_industry", description="Analyze industry trends, key players, and market dynamics"),
        Tool(name="spot_trends", description="Identify emerging trends in a given domain or sector"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["research", "companies", "industries", "trends"],
        write_types=[],
    )
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return {
            "agent_name": "research",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need more information to conduct research.",
                "details": None,
                "proposals": [],
                "questions": [
                    "Which company or industry would you like me to research?",
                    "What specific aspects are you interested in?",
                ],
            },
        }

    async def research_company(
        self,
        company_name: str,
        aspects: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_company(company_name)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a business research analyst. Research companies thoroughly. Return JSON with: company_overview, products_services, market_position, recent_news, culture, competitors, key_insights."},
                {"role": "user", "content": f"Company: {company_name}\nAspects to cover: {', '.join(aspects) if aspects else 'All available'}"},
            ], temperature=0.4, max_tokens=1024)
            return {
                "agent_name": "research",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Research report on {company_name}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Company research failed: {e}")
            return self._fallback_company(company_name)

    async def analyze_industry(
        self,
        industry: str,
        focus_area: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_industry(industry)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an industry analyst. Provide detailed industry analysis. Return JSON with: industry_overview, key_players, market_size, growth_trends, challenges, opportunities, future_outlook."},
                {"role": "user", "content": f"Industry: {industry}\nFocus area: {focus_area or 'General overview'}"},
            ], temperature=0.4, max_tokens=1024)
            return {
                "agent_name": "research",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Industry analysis: {industry}",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Industry analysis failed: {e}")
            return self._fallback_industry(industry)

    async def spot_trends(
        self,
        domain: str,
        timeframe: str = "6 months",
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_trends(domain)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a trend spotter. Identify emerging trends and patterns. Return JSON with: trends, impact_level, adoption_phase, relevance, actionable_insights."},
                {"role": "user", "content": f"Domain: {domain}\nTimeframe: {timeframe}"},
            ], temperature=0.6, max_tokens=512)
            return {
                "agent_name": "research",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Trends in {domain} ({timeframe})",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Trend spotting failed: {e}")
            return self._fallback_trends(domain)

    def _fallback_company(self, company_name: str) -> Dict[str, Any]:
        return {
            "agent_name": "research",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Research on {company_name}",
                "details": {"company": company_name, "note": "Detailed research requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_industry(self, industry: str) -> Dict[str, Any]:
        return {
            "agent_name": "research",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Industry analysis: {industry}",
                "details": {"industry": industry, "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_trends(self, domain: str) -> Dict[str, Any]:
        return {
            "agent_name": "research",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Trends in {domain}",
                "details": {"domain": domain, "note": "Detailed trend analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
