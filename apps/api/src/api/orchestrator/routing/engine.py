"""Unified Routing Engine — 6-Layer Orchestrator Pipeline.

Coordinates Layers A through E to transform an untrusted user request into
a verified, authorized IntentEnvelope and an ExecutionPlan.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from ..contracts.decision import ExecutionPlan
from ..contracts.intent import IntentEnvelope
from .layer_a_safety import LayerASafetyGate
from .layer_b_semantic import LayerBSemanticCandidates
from .layer_c_arbitration import LayerCArbitration
from .layer_d_policy import LayerDPolicyGate
from .layer_e_planner import LayerEPlanner

logger = logging.getLogger(__name__)


class RoutingEngine:
    """The authoritative 6-Layer Cognitive Routing Engine."""

    def __init__(self) -> None:
        self.layer_a = LayerASafetyGate()
        self.layer_b = LayerBSemanticCandidates()
        self.layer_c = LayerCArbitration()
        self.layer_d = LayerDPolicyGate()
        self.layer_e = LayerEPlanner()

    async def route(
        self,
        query: str,
        workspace_id: str,
        tenant_id: str | None = None,
        user_id: str | None = None,
        workspace_tier: str = "enterprise",
        active_artifacts: list[str] | None = None,
        resolved_entities: dict[str, Any] | None = None,
    ) -> tuple[IntentEnvelope, ExecutionPlan]:
        start_ts = time.monotonic()

        # ── Layer A: Security & IDOR Perimeter Pre-Screen ──────────────
        screen_res = self.layer_a.screen(
            raw_query=query,
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
        if not screen_res.passed:
            raise ValueError(f"Security pre-screen denied request: {screen_res.rejection_reason}")

        # ── Layer B: Cheap Semantic Candidate Generation ───────────────
        candidate_res = await self.layer_b.generate_candidates(
            query=screen_res.sanitized_query,
            top_k=5,
            mvp_only=(workspace_tier == "mvp"),
        )

        # ── Layer C: Cognitive Intent & Goal Arbitration ───────────────
        envelope = await self.layer_c.arbitrate(
            candidate_res=candidate_res,
            workspace_id=screen_res.workspace_id,
            tenant_id=screen_res.tenant_id,
            user_id=screen_res.user_id,
            raw_query=query,
            sanitized_query=screen_res.sanitized_query,
            active_artifacts=active_artifacts,
            resolved_entities=resolved_entities,
        )

        # ── Layer D: Deterministic Policy & Entitlement Gate ───────────
        policy_res = await self.layer_d.evaluate_policy(
            envelope=envelope,
            workspace_tier=workspace_tier,
        )

        # ── Layer E: Execution Planning & Supervisor DAG ───────────────
        execution_plan = self.layer_e.plan_execution(policy_res)

        total_latency = (time.monotonic() - start_ts) * 1000.0
        envelope.routing_latency_ms = round(total_latency, 2)
        logger.info(
            f"ROUTING_SUCCESS: intent={envelope.normalized_intent} "
            f"agent={envelope.selected_agent} method={envelope.routing_method} "
            f"latency={envelope.routing_latency_ms}ms"
        )

        return envelope, execution_plan


# Authoritative singleton
routing_engine = RoutingEngine()
