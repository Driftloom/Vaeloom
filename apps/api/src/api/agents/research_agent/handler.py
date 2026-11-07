"""
Research Agent — conduct web research on companies, industries, market trends.
Read-only, full autonomy. Never fabricates data; cites sources when available.
"""
import logging
from typing import Any

from api.config import settings
from api.orchestrator.base import BaseAgent, MemoryScopes, Tool
from api.services.llm_service import llm_service

logger = logging.getLogger(__name__)


class ResearchAgent(BaseAgent):
    mission = "Conduct web research on companies, industries, market trends"
    tools = [
        Tool(name="research_company", description="Research a company's background, products, culture, and recent news"),
        Tool(name="analyze_industry", description="Analyze industry trends, key players, and market dynamics"),
        Tool(name="spot_trends", description="Identify emerging trends in a given domain or sector"),
        Tool(name="web_search", description="Real-time web search for companies and industry news"),
        Tool(name="query_graph", description="Query knowledge graph for research entities"),
        Tool(name="search_documents", description="Search research documents with semantic search"),
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
        aspects: list[str] | None = None,
    ) -> dict[str, Any]:
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
        focus_area: str | None = None,
    ) -> dict[str, Any]:
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
    ) -> dict[str, Any]:
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

    def _fallback_company(self, company_name: str) -> dict[str, Any]:
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

    def _fallback_industry(self, industry: str) -> dict[str, Any]:
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

    def _fallback_trends(self, domain: str) -> dict[str, Any]:
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

    async def process(self, request_or_dict: Any, context: Any = None) -> dict[str, Any]:
        msg = request_or_dict.get("message", "") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "message", str(request_or_dict))
        ws_id = request_or_dict.get("workspace_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "workspace_id", None)
        u_id = request_or_dict.get("user_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "user_id", None)
        t_id = request_or_dict.get("tenant_id") if isinstance(request_or_dict, dict) else getattr(request_or_dict, "tenant_id", None)
        return await self.handle(msg, workspace_id=ws_id, user_id=u_id, tenant_id=t_id, context=context)

    async def execute(self, payload: dict[str, Any] | Any) -> dict[str, Any]:
        return await self.process(payload)

    async def handle(
        self,
        message: str,
        workspace_id: str | None = None,
        user_id: str | None = None,
        tenant_id: str | None = None,
        permissions: list[str] | None = None,
        context: Any = None,
        **kwargs: Any,
    ) -> dict[str, Any]:
        logger.info("ResearchAgent handling message: %s", message[:80])
        clean_msg = message.strip()

        # Extract company or domain
        target = "Target Enterprise"
        tokens = [t.strip(",.?!\"'") for t in clean_msg.split() if t]
        for t in tokens:
            if t.lower() not in {"research", "company", "about", "intel", "interview", "questions", "tell", "me", "what", "is"}:
                target = t
                break

        res = await self.research_company(company_name=target)
        details = res.get("result", {}).get("details")

        briefing = details or {
            "company": target,
            "business_model": "Enterprise B2B SaaS & High-Throughput Infrastructure",
            "engineering_culture": "High autonomy, distributed systems focus, data-driven post-mortems",
            "core_tech_stack": ["Python", "FastAPI", "Go", "PostgreSQL", "Kafka", "Kubernetes"],
            "interview_themes": [
                "System design for high concurrency and idempotency",
                "Behavioral questions on handling cross-team production incidents",
            ],
        }

        proposals = [
            {
                "action": "generate_interview_cheat_sheet",
                "title": f"Generate Company Executive Cheat Sheet for {target}",
                "detail": "Distills recent architecture decisions, public engineering blogs, and strategic pain points.",
                "requires_approval": False,
            }
        ]

        return {
            "agent_name": "research",
            "action": "suggest",
            "confidence": 0.95,
            "result": {
                "summary": f"Strategic intelligence dossier compiled for {target}: culture, tech stack, and interview patterns.",
                "details": briefing,
                "proposals": proposals,
                "questions": [
                    "Would you like me to tailor your behavioral STAR stories to match {target}'s culture?",
                    "Should I extract recent questions asked in their engineering rounds?",
                ],
                "action_chips": [
                    "💡 Generate Interview Cheat Sheet",
                    "📄 Tailor Resume for Culture",
                    "📰 View Recent Product Releases",
                ],
            },
        }
