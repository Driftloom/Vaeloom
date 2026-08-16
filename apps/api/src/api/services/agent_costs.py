"""
Agent cost tracking — tracks token usage per agent per workspace.
Uses in-memory store with Redis-ready interface.
"""
import logging
import os
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import get_current_user, require_role

logger = logging.getLogger(__name__)

TOKEN_COST_PER_MODEL: dict[str, dict[str, float]] = {
    "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0},
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    "claude-3-opus-20240229": {"input": 15.0, "output": 75.0},
    "gpt-4o": {"input": 5.0, "output": 15.0},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "gpt-3.5-turbo": {"input": 0.5, "output": 1.5},
    "default": {"input": 3.0, "output": 15.0},
}


@dataclass
class UsageRecord:
    agent_name: str
    workspace_id: str
    input_tokens: int
    output_tokens: int
    model: str
    timestamp: float = 0.0
    cost: float = 0.0

    def __post_init__(self):
        if self.timestamp == 0.0:
            self.timestamp = time.time()
        if self.cost == 0.0:
            self.cost = self._compute_cost()

    def _compute_cost(self) -> float:
        pricing = TOKEN_COST_PER_MODEL.get(self.model, TOKEN_COST_PER_MODEL["default"])
        input_cost = (self.input_tokens / 1000) * pricing["input"] / 1000
        output_cost = (self.output_tokens / 1000) * pricing["output"] / 1000
        return round(input_cost + output_cost, 8)


class AgentCostTracker:
    """
    Tracks token usage and cost per agent per workspace.
    Uses in-memory dict — Redis-ready interface for future migration.
    """

    def __init__(self):
        self._records: dict[str, list[UsageRecord]] = defaultdict(list)
        self._lock: object = None

    async def track_usage(
        self,
        agent_name: str,
        workspace_id: str,
        input_tokens: int,
        output_tokens: int,
        model: str,
    ) -> UsageRecord:
        record = UsageRecord(
            agent_name=agent_name,
            workspace_id=workspace_id,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            model=model,
            timestamp=time.time(),
        )
        key = self._store_key(workspace_id)
        self._records[key].append(record)
        logger.info(
            "Tracked usage: agent=%s workspace=%s input=%d output=%d model=%s cost=%.8f",
            agent_name, workspace_id, input_tokens, output_tokens, model, record.cost,
        )
        return record

    async def get_usage(
        self,
        agent_name: Optional[str] = None,
        workspace_id: Optional[str] = None,
        period: Optional[int] = None,
    ) -> list[UsageRecord]:
        records: list[UsageRecord] = []
        for key, recs in self._records.items():
            if workspace_id and key != self._store_key(workspace_id):
                continue
            for r in recs:
                if agent_name and r.agent_name != agent_name:
                    continue
                if period is not None and (time.time() - r.timestamp) > period:
                    continue
                records.append(r)
        return sorted(records, key=lambda r: r.timestamp, reverse=True)

    async def get_total_costs(self, workspace_id: str) -> dict[str, float]:
        records = await self.get_usage(workspace_id=workspace_id)
        total = sum(r.cost for r in records)
        by_agent: dict[str, float] = defaultdict(float)
        for r in records:
            by_agent[r.agent_name] += r.cost
        return {"total": round(total, 6), "by_agent": {k: round(v, 6) for k, v in by_agent.items()}, "record_count": len(records)}

    def _store_key(self, workspace_id: str) -> str:
        return f"usage:{workspace_id}"

    async def reset(self) -> None:
        self._records.clear()


agent_cost_tracker = AgentCostTracker()

router = APIRouter()


@router.get("/admin/agents/usage")
async def get_agent_usage(
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    workspace_id: Optional[str] = Query(None, description="Filter by workspace ID"),
    period_hours: Optional[int] = Query(None, description="Time period in hours"),
    current_user: dict = Depends(require_role("admin")),
):
    period = period_hours * 3600 if period_hours else None
    records = await agent_cost_tracker.get_usage(
        agent_name=agent_name,
        workspace_id=workspace_id,
        period=period,
    )
    return {
        "records": [
            {
                "agent_name": r.agent_name,
                "workspace_id": r.workspace_id,
                "input_tokens": r.input_tokens,
                "output_tokens": r.output_tokens,
                "model": r.model,
                "cost": r.cost,
                "timestamp": datetime.fromtimestamp(r.timestamp, tz=timezone.utc).isoformat(),
            }
            for r in records
        ],
        "total": len(records),
    }


@router.get("/admin/agents/usage/costs")
async def get_agent_costs(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(require_role("admin")),
):
    costs = await agent_cost_tracker.get_total_costs(workspace_id)
    return costs
