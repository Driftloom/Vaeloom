"""
Analytics Agent — provide insights on user activity, job search metrics, platform usage.
Read-only. Never exposes individual user data in aggregate reports without anonymization.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class AnalyticsAgent(BaseAgent):
    mission = "Provide insights on user activity, job search metrics, platform usage"
    tools = [
        Tool(name="get_activity_trends", description="Get user activity trends over time"),
        Tool(name="analyze_applications", description="Analyze job application metrics and funnel"),
        Tool(name="generate_report", description="Generate analytics report on platform usage"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["analytics", "activity", "applications", "metrics"],
        write_types=[],
    )
    default_autonomy = "read_only"

    async def fallback(self) -> Any:
        return {
            "agent_name": "analytics",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need parameters to generate analytics.",
                "details": None,
                "proposals": [],
                "questions": [
                    "What metrics or trends would you like to analyze?",
                    "What time period should I look at?",
                ],
            },
        }

    async def get_activity_trends(
        self,
        metrics: List[str],
        period: str = "30d",
        granularity: str = "daily",
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_trends(metrics)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are an analytics expert analyzing user activity trends. Return JSON with: trend_summary, metrics_over_time, anomalies, growth_rates, recommendations."},
                {"role": "user", "content": f"Metrics: {', '.join(metrics)}\nPeriod: {period}\nGranularity: {granularity}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "analytics",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Activity trends for {', '.join(metrics)} ({period})",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Activity trends failed: {e}")
            return self._fallback_trends(metrics)

    async def analyze_applications(
        self,
        applications: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_applications(applications)
        try:
            apps_str = "; ".join([f"{a.get('role','Role')} at {a.get('company','Company')} - status: {a.get('status','applied')}" for a in applications[:20]])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a recruitment analytics specialist. Analyze job application funnels. Return JSON with: funnel_metrics, conversion_rates, bottlenecks, stage_durations, improvement_areas."},
                {"role": "user", "content": f"Applications ({len(applications)} total):\n{apps_str}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "analytics",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"Application analysis: {len(applications)} applications",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Application analysis failed: {e}")
            return self._fallback_applications(applications)

    async def generate_report(
        self,
        report_type: str,
        data_sources: List[str],
        period: str = "30d",
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_report(report_type)
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a business intelligence analyst. Generate comprehensive analytics reports. Return JSON with: executive_summary, key_metrics, trends, insights, recommendations, appendices."},
                {"role": "user", "content": f"Report type: {report_type}\nData sources: {', '.join(data_sources)}\nPeriod: {period}"},
            ], temperature=0.4, max_tokens=1024)
            return {
                "agent_name": "analytics",
                "action": "suggest",
                "confidence": 0.85,
                "result": {
                    "summary": f"{report_type} report generated",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Report generation failed: {e}")
            return self._fallback_report(report_type)

    def _fallback_trends(self, metrics: List[str]) -> Dict[str, Any]:
        return {
            "agent_name": "analytics",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Trends for {', '.join(metrics)}",
                "details": {"metrics": metrics, "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_applications(self, applications: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "analytics",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"Analysis of {len(applications)} applications",
                "details": {"count": len(applications), "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_report(self, report_type: str) -> Dict[str, Any]:
        return {
            "agent_name": "analytics",
            "action": "suggest",
            "confidence": 0.5,
            "result": {
                "summary": f"{report_type} report",
                "details": {"report_type": report_type, "note": "Detailed report generation requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
