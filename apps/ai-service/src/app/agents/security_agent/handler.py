"""
Security Agent — monitor for suspicious activity, PII leaks, access anomalies.
Full autonomy (monitoring only). Never logs sensitive data; alerts on findings.
"""
import logging
from typing import Any, Dict, List, Optional

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool
from app.services.llm_service import llm_service
from app.config import settings

logger = logging.getLogger(__name__)


class SecurityAgent(BaseAgent):
    mission = "Monitor for suspicious activity, PII leaks, access anomalies"
    tools = [
        Tool(name="monitor_activity", description="Monitor user activity for suspicious patterns"),
        Tool(name="scan_for_pii", description="Scan content for potential PII leaks"),
        Tool(name="analyze_access_logs", description="Analyze access logs for anomalies"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["activity", "access_logs", "security_events"],
        write_types=["security_alerts", "incidents"],
    )
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return {
            "agent_name": "security",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need data to perform security analysis.",
                "details": None,
                "proposals": [],
                "questions": ["What would you like me to scan or monitor?"],
            },
        }

    async def monitor_activity(
        self,
        recent_actions: List[Dict[str, Any]],
        thresholds: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_monitor(recent_actions)
        try:
            actions_str = "; ".join([f"{a.get('action','unknown')} by {a.get('user','unknown')} at {a.get('time','unknown')}" for a in recent_actions[:30]])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a security analyst monitoring user activity for suspicious patterns. Return JSON with: suspicious_events, risk_level, patterns_detected, recommended_actions, severity_scores."},
                {"role": "user", "content": f"Recent actions:\n{actions_str}\nThresholds: {thresholds or 'Default'}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "security",
                "action": "alert",
                "confidence": 0.9,
                "result": {
                    "summary": "Activity monitoring complete",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Activity monitoring failed: {e}")
            return self._fallback_monitor(recent_actions)

    async def scan_for_pii(
        self,
        content: str,
        content_type: str = "text",
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_pii()
        try:
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a data privacy expert. Scan content for PII and sensitive data exposure. Return JSON with: pii_found, risk_assessment, affected_types, redacted_preview, remediation_steps."},
                {"role": "user", "content": f"Content type: {content_type}\nContent length: {len(content)} chars\nFirst 2000 chars:\n{content[:2000]}"},
            ], temperature=0.2, max_tokens=512)
            return {
                "agent_name": "security",
                "action": "alert",
                "confidence": 0.9,
                "result": {
                    "summary": "PII scan completed",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"PII scan failed: {e}")
            return self._fallback_pii()

    async def analyze_access_logs(
        self,
        logs: List[Dict[str, Any]],
        baseline_period: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not settings.llm_api_key:
            return self._fallback_access(logs)
        try:
            logs_str = "; ".join([f"{l.get('user','unknown')} accessed {l.get('resource','unknown')} from {l.get('ip','unknown')} at {l.get('time','unknown')}" for l in logs[:30]])
            response = await llm_service.generate_completion([
                {"role": "system", "content": "You are a security operations analyst. Analyze access logs for anomalies and unauthorized access. Return JSON with: anomalies, unauthorized_attempts, geographic_patterns, time_based_patterns, recommendations."},
                {"role": "user", "content": f"Access logs:\n{logs_str}\nBaseline: {baseline_period or 'Previous 30 days'}"},
            ], temperature=0.3, max_tokens=512)
            return {
                "agent_name": "security",
                "action": "alert",
                "confidence": 0.9,
                "result": {
                    "summary": f"Access log analysis: {len(logs)} entries",
                    "details": response["content"],
                    "proposals": [],
                    "questions": [],
                },
            }
        except Exception as e:
            logger.warning(f"Access log analysis failed: {e}")
            return self._fallback_access(logs)

    def _fallback_monitor(self, actions: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "security",
            "action": "info",
            "confidence": 0.5,
            "result": {
                "summary": f"Monitored {len(actions)} actions",
                "details": {"actions_count": len(actions), "note": "Detailed monitoring requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_pii(self) -> Dict[str, Any]:
        return {
            "agent_name": "security",
            "action": "info",
            "confidence": 0.5,
            "result": {
                "summary": "PII scan",
                "details": {"note": "PII scanning requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }

    def _fallback_access(self, logs: List[Dict[str, Any]]) -> Dict[str, Any]:
        return {
            "agent_name": "security",
            "action": "info",
            "confidence": 0.5,
            "result": {
                "summary": f"Access log analysis of {len(logs)} entries",
                "details": {"entries": len(logs), "note": "Detailed analysis requires an LLM API key."},
                "proposals": [],
                "questions": [],
            },
        }
