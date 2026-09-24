"""Registry Seeder Service.

Seeds standard tools from definitions.py, models from model_router.py,
and default enterprise policies into PostgreSQL registries on boot or on-demand.
"""
from __future__ import annotations

import logging
from typing import Any
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.registries import ModelProviderEntry, PolicyEntry, ToolRegistryEntry
from ..services.model_router import MODEL_CATALOG
from ..tools.definitions import ALL_TOOLS

logger = logging.getLogger(__name__)


async def seed_registries(db: AsyncSession) -> dict[str, int]:
    """Sync built-in tools and models into database registries."""
    stats = {"tools": 0, "models": 0, "policies": 0}

    # 1. Seed Tools
    for name, tool_def in ALL_TOOLS.items():
        existing = await db.execute(
            select(ToolRegistryEntry).where(
                ToolRegistryEntry.tool_id == name,
                ToolRegistryEntry.workspace_id.is_(None),
            )
        )
        if existing.scalars().first() is None:
            # Map category to risk class
            risk = "LOW"
            side_effects = False
            if "write" in tool_def.category or "execute" in tool_def.name or "send" in tool_def.name:
                risk = "MEDIUM"
                side_effects = True
            if "delete" in tool_def.name or "restore" in tool_def.name:
                risk = "HIGH"
                side_effects = True

            entry = ToolRegistryEntry(
                tool_id=name,
                name=name.replace("_", " ").title(),
                version="1.0.0",
                description=tool_def.description,
                category=tool_def.category,
                input_schema=tool_def.input_schema,
                output_schema=tool_def.output_schema,
                required_permissions=[tool_def.required_scope] if tool_def.required_scope else [],
                data_scopes=[tool_def.category],
                risk_level=risk,
                side_effects=side_effects,
                idempotent=not side_effects,
                timeout_seconds=30,
                retry_policy={"max_retries": 2, "backoff": "exponential"},
                is_active=True,
                tenant_scope=False,
                workspace_scope=False,
            )
            db.add(entry)
            stats["tools"] += 1

    # 2. Seed Models
    for model_name, config in MODEL_CATALOG.items():
        existing = await db.execute(
            select(ModelProviderEntry).where(
                ModelProviderEntry.model_id == model_name,
                ModelProviderEntry.workspace_id.is_(None),
            )
        )
        if existing.scalars().first() is None:
            entry = ModelProviderEntry(
                model_id=model_name,
                name=model_name,
                provider=config.provider,
                version="latest",
                tier=config.tier,
                context_window=config.max_tokens,
                cost_per_1k_input=config.cost_per_1k_input,
                cost_per_1k_output=config.cost_per_1k_output,
                capabilities={"tool_calling": True, "structured_output": True},
                is_active=True,
                is_default=(model_name == "gpt-4o-mini"),
                health_status="healthy",
            )
            db.add(entry)
            stats["models"] += 1

    # 3. Seed Default Policies
    default_policies = [
        {
            "policy_id": "tool_side_effect_approval",
            "name": "Side-Effect Tool Approval Requirement",
            "scope": "tool",
            "target": "*",
            "rules": {"require_hitl_for_side_effects": True, "exempt_scopes": ["memory.read"]},
            "risk_threshold": "HIGH",
            "requires_approval": True,
        },
        {
            "policy_id": "model_spend_ceiling",
            "name": "Default Model Spend Ceilings",
            "scope": "model",
            "target": "*",
            "rules": {"max_cost_per_run_usd": 1.0, "max_tokens_per_run": 16000},
            "risk_threshold": "MEDIUM",
            "requires_approval": False,
        },
    ]
    for p in default_policies:
        existing = await db.execute(
            select(PolicyEntry).where(
                PolicyEntry.policy_id == p["policy_id"],
                PolicyEntry.workspace_id.is_(None),
            )
        )
        if existing.scalars().first() is None:
            entry = PolicyEntry(
                policy_id=p["policy_id"],
                name=p["name"],
                scope=p["scope"],
                target=p["target"],
                rules=p["rules"],
                risk_threshold=p["risk_threshold"],
                requires_approval=p["requires_approval"],
                is_active=True,
                version=1,
            )
            db.add(entry)
            stats["policies"] += 1

    if stats["tools"] > 0 or stats["models"] > 0 or stats["policies"] > 0:
        await db.commit()
        logger.info(
            "Registries seeded: %d tools, %d models, %d policies",
            stats["tools"], stats["models"], stats["policies"]
        )

    return stats
