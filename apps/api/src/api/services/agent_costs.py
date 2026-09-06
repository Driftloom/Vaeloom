"""
Agent cost tracking — tracks token usage per agent per workspace.
Uses in-memory store with Redis-ready interface.
"""
import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..dependencies import require_role

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


class BudgetExceededError(Exception):
    """Raised when a workspace exceeds its configured LLM spend budget."""


@dataclass
class WorkspaceBudget:
    workspace_id: str
    limit_usd: float
    period_seconds: int = 86400  # daily window by default
    created_at: float = 0.0

    def __post_init__(self):
        if self.created_at == 0.0:
            self.created_at = time.time()


class AgentCostTracker:
    """
    Tracks token usage and cost per agent per workspace.
    Uses in-memory dict — Redis-ready interface for future migration.
    """

    def __init__(self):
        self._records: dict[str, list[UsageRecord]] = defaultdict(list)
        self._budgets: dict[str, WorkspaceBudget] = {}
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
        agent_name: str | None = None,
        workspace_id: str | None = None,
        period: int | None = None,
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
        self._budgets.clear()

    # ── Spend budgets (Wave 1, 2026-09-06) ──────────────────────────
    # In-memory budget store, same Redis-ready pattern as usage records.
    # No budget configured (explicit or via settings default) = unlimited.

    async def set_budget(
        self, workspace_id: str, limit_usd: float, period_seconds: int = 86400
    ) -> WorkspaceBudget:
        if limit_usd < 0:
            raise ValueError("limit_usd must be >= 0")
        budget = WorkspaceBudget(
            workspace_id=workspace_id, limit_usd=limit_usd, period_seconds=period_seconds
        )
        self._budgets[self._budget_key(workspace_id)] = budget
        logger.info("Set spend budget: workspace=%s limit_usd=%.4f period_s=%d", workspace_id, limit_usd, period_seconds)
        return budget

    async def get_budget(self, workspace_id: str) -> WorkspaceBudget | None:
        return self._budgets.get(self._budget_key(workspace_id))

    async def clear_budget(self, workspace_id: str) -> bool:
        return self._budgets.pop(self._budget_key(workspace_id), None) is not None

    def _budget_key(self, workspace_id: str) -> str:
        return f"budget:{workspace_id}"

    async def _spent_in_period(self, workspace_id: str, period_seconds: int) -> float:
        records = await self.get_usage(workspace_id=workspace_id, period=period_seconds)
        return round(sum(r.cost for r in records), 8)

    async def effective_limit_usd(self, workspace_id: str) -> float:
        """Explicit workspace budget wins; else global settings default; 0 = unlimited."""
        budget = await self.get_budget(workspace_id)
        if budget is not None:
            return budget.limit_usd
        try:
            from ..config import settings

            return float(getattr(settings, "agent_default_daily_budget_usd", 0.0) or 0.0)
        except Exception:
            return 0.0

    async def check_budget(self, workspace_id: str) -> dict:
        """Return {allowed, spent_usd, limit_usd, remaining_usd}. No limit → allowed."""
        limit = await self.effective_limit_usd(workspace_id)
        if limit <= 0:
            return {"allowed": True, "spent_usd": 0.0, "limit_usd": 0.0, "remaining_usd": None}
        budget = await self.get_budget(workspace_id)
        period = budget.period_seconds if budget else 86400
        spent = await self._spent_in_period(workspace_id, period)
        allowed = spent < limit
        if not allowed:
            logger.warning("Spend budget exceeded: workspace=%s spent=%.6f limit=%.4f", workspace_id, spent, limit)
        return {
            "allowed": allowed,
            "spent_usd": spent,
            "limit_usd": limit,
            "remaining_usd": round(max(limit - spent, 0.0), 8),
        }


agent_cost_tracker = AgentCostTracker()

router = APIRouter()


@router.get("/admin/agents/usage")
async def get_agent_usage(
    agent_name: str | None = Query(None, description="Filter by agent name"),
    workspace_id: str | None = Query(None, description="Filter by workspace ID"),
    period_hours: int | None = Query(None, description="Time period in hours"),
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
                "timestamp": datetime.fromtimestamp(r.timestamp, tz=UTC).isoformat(),
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


class BudgetSetRequest(BaseModel):
    workspace_id: str = Field(..., description="Workspace ID")
    limit_usd: float = Field(..., ge=0, description="Max LLM spend in USD per period")
    period_hours: float = Field(24.0, gt=0, description="Budget window in hours")


@router.put("/admin/agents/usage/budgets")
async def set_agent_budget(
    body: BudgetSetRequest,
    current_user: dict = Depends(require_role("admin")),
):
    budget = await agent_cost_tracker.set_budget(
        body.workspace_id, body.limit_usd, int(body.period_hours * 3600)
    )
    status = await agent_cost_tracker.check_budget(body.workspace_id)
    return {
        "workspace_id": budget.workspace_id,
        "limit_usd": budget.limit_usd,
        "period_hours": body.period_hours,
        **status,
    }


@router.get("/admin/agents/usage/budgets")
async def get_agent_budget(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(require_role("admin")),
):
    budget = await agent_cost_tracker.get_budget(workspace_id)
    status = await agent_cost_tracker.check_budget(workspace_id)
    return {
        "workspace_id": workspace_id,
        "configured": budget is not None,
        "limit_usd": budget.limit_usd if budget else 0.0,
        "period_seconds": budget.period_seconds if budget else 86400,
        **status,
    }


@router.delete("/admin/agents/usage/budgets")
async def clear_agent_budget(
    workspace_id: str = Query(..., description="Workspace ID"),
    current_user: dict = Depends(require_role("admin")),
):
    cleared = await agent_cost_tracker.clear_budget(workspace_id)
    return {"workspace_id": workspace_id, "cleared": cleared}
