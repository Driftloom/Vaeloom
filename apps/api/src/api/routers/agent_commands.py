"""Dynamic Agent Commands & Slash Shortcuts API Router.

Exposes dynamically discovered agent slash commands, badges, icons, and trigger keywords
for consumption by frontend ChatWindow and command palettes.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query

from ..dependencies import get_current_user
from ..orchestrator.agent_discovery import dynamic_agent_registry
from ..orchestrator.card_registry import get_agent_card

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/commands", tags=["agents"])

# Semantic color palette mapping per agent
AGENT_COLOR_PALETTE: dict[str, str] = {
    "organization": "bg-warning",
    "memory": "bg-accent",
    "resume": "bg-sky-500",
    "ats": "bg-emerald-500",
    "job_search": "bg-blue-500",
    "application": "bg-pink-500",
    "gmail": "bg-rose-500",
    "scheduler": "bg-amber-600",
    "research": "bg-indigo-500",
    "career": "bg-violet-500",
    "learning": "bg-teal-500",
    "github": "bg-slate-700",
    "coding": "bg-cyan-500",
    "reminder": "bg-yellow-500",
    "analytics": "bg-orange-500",
    "recommendation": "bg-purple-500",
    "reflection": "bg-fuchsia-500",
    "security": "bg-red-600",
    "calendar": "bg-amber-500",
    "internship": "bg-lime-600",
    "document": "bg-blue-400",
    "pdf": "bg-red-500",
    "conversation": "bg-gray-500",
    "self_improvement": "bg-emerald-600",
    "qa": "bg-emerald-700",
}

# Default trigger aliases for core agents
CUSTOM_TRIGGERS: dict[str, str] = {
    "organization": "/organize",
    "memory": "/remember",
    "job_search": "/jobs",
    "application": "/apply",
    "gmail": "/email",
    "scheduler": "/schedule",
    "career": "/career",
    "learning": "/learn",
    "research": "/research",
    "analytics": "/analytics",
    "coding": "/code",
}


@router.get("", response_model=dict[str, Any])
async def get_agent_commands(
    workspace_id: str | None = Query(None, description="Optional workspace ID"),
    current_user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    """Return dynamically discovered slash commands and UI metadata for all active agents."""
    commands = []

    for agent_name in sorted(dynamic_agent_registry.keys()):
        # Retrieve declarative AgentCard for description
        card = get_agent_card(agent_name)
        desc = card.description if card else f"Interact with the {agent_name} agent"
        # Truncate long descriptions for UI slash popup
        short_desc = desc.split(".")[0] if "." in desc else desc
        if len(short_desc) > 60:
            short_desc = short_desc[:57] + "..."

        trigger = CUSTOM_TRIGGERS.get(agent_name, f"/{agent_name}")
        color = AGENT_COLOR_PALETTE.get(agent_name, "bg-primary")

        commands.append({
            "trigger": trigger,
            "agent": agent_name,
            "desc": short_desc,
            "color": color,
            "status": card.status if card else "ACTIVE",
            "tools_count": len(card.tools) if card else 0,
        })

    return {
        "workspace_id": workspace_id,
        "count": len(commands),
        "commands": commands,
    }
