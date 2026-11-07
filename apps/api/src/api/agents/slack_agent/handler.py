"""
Slack Agent — Channel message dispatch, alerts, and team career update notifications.
Approval-gated for external message delivery.
"""
from __future__ import annotations

import logging
from typing import Any

from api.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class SlackAgent(BaseAgent):
    mission = "Coordinate Slack notifications, channel announcements, and team communication"
    tools = [
        Tool(name="send_slack_message", description="Send Slack alerts and notifications"),
    ]
    memory_scopes = MemoryScopes(
        read_types=["communications", "profile"],
        write_types=["communications", "episodic"],
    )
    default_autonomy = "suggest"

    def __init__(self, workspace_id: str | None = None) -> None:
        super().__init__()
        self.workspace_id = workspace_id

    async def fallback(self) -> dict[str, Any]:
        return {
            "agent_name": "slack",
            "action": "ask_clarification",
            "confidence": 0.0,
            "result": {
                "summary": "I need the destination channel and message text to send a Slack update.",
                "details": None,
                "proposals": [],
                "questions": ["Which Slack channel would you like to post to?"],
                "action_chips": ["📢 Announce to #general", "💼 Post to #career-updates", "❓ Ask Help"],
            },
        }

    async def execute(self, payload: dict[str, Any] | Any) -> dict[str, Any]:
        return await self.process(payload if isinstance(payload, dict) else {"message": str(payload)})

    async def process(self, request: dict[str, Any] | Any, context: Any = None) -> dict[str, Any]:
        msg = request.get("message", "") if isinstance(request, dict) else getattr(request, "message", str(request))
        ws_id = request.get("workspace_id") if isinstance(request, dict) else getattr(request, "workspace_id", self.workspace_id or "default")
        return await self.handle(msg, workspace_id=ws_id)

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
        logger.info("SlackAgent handling message: %s", message[:80])
        clean_msg = message.strip()

        # Parse channel mention or default to general
        channel = "#career-updates"
        if "#" in clean_msg:
            words = clean_msg.split()
            for w in words:
                if w.startswith("#"):
                    channel = w
                    break

        proposal = {
            "title": f"Post update to {channel}",
            "description": f"Draft update: {clean_msg[:120]}...",
            "channel": channel,
            "text": clean_msg,
            "requires_approval": True,
            "approval_type": "external_communication",
        }

        return {
            "agent_name": "slack",
            "action": "suggest",
            "confidence": 0.90,
            "result": {
                "summary": f"Prepared Slack message draft for {channel}. Human approval required prior to broadcast.",
                "details": f"Target Channel: {channel}\nMessage Length: {len(clean_msg)} characters",
                "proposals": [proposal],
                "questions": [],
                "action_chips": [f"🚀 Approve Broadcast to {channel}", "✏️ Edit Draft", "❌ Cancel"],
            },
        }
