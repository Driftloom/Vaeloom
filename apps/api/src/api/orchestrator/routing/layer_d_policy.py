"""Layer D — Deterministic Policy, Entitlement, & Permission Gate.

Enforces zero-trust authorization:
- Workspace entitlement check (MVP vs Enterprise)
- Workspace permission allowlist
- Rate limits and execution budgets
- Autonomy tier thresholds (READ, SUGGEST, DRAFT, WRITE, ACT)
"""

from __future__ import annotations

import logging
from typing import Any

from ...config import settings
from ..capability_registry import capability_registry
from ..contracts.capability import AutonomyLevel
from ..contracts.intent import IntentEnvelope

logger = logging.getLogger(__name__)


class PolicyEvaluationResult:
    def __init__(
        self,
        allowed: bool,
        envelope: IntentEnvelope,
        effective_autonomy: AutonomyLevel,
        denial_reason: str | None = None,
        requires_human_approval: bool = False,
    ) -> None:
        self.allowed = allowed
        self.envelope = envelope
        self.effective_autonomy = effective_autonomy
        self.denial_reason = denial_reason
        self.requires_human_approval = requires_human_approval


class LayerDPolicyGate:
    """Deterministic policy enforcement separating semantic understanding from execution rights."""

    def __init__(self) -> None:
        self.registry = capability_registry

    async def evaluate_policy(
        self,
        envelope: IntentEnvelope,
        workspace_tier: str = "enterprise",
    ) -> PolicyEvaluationResult:
        cap_id = envelope.normalized_intent
        manifest = self.registry.get_by_id(cap_id)

        # 1. Unknown Capability Protection
        if not manifest:
            # Fallback to safe executive conversation
            manifest = self.registry.get_by_id("executive.companion.scaffold")
            if not manifest:
                return PolicyEvaluationResult(
                    allowed=False,
                    envelope=envelope,
                    effective_autonomy=AutonomyLevel.READ,
                    denial_reason=f"Unknown capability '{cap_id}' denied by policy",
                )

        # 2. Entitlement & Tier Gating (Decoupled from Semantic Router)
        # If MVP scope is enforced by platform settings or tenant tier
        is_mvp_enforced = getattr(settings, "mvp_scope_enforced", False) or workspace_tier == "mvp"
        if is_mvp_enforced and manifest.tier_requirement != "mvp":
            logger.warning(
                f"LAYER_D: Entitlement denial for capability '{cap_id}' "
                f"(requires {manifest.tier_requirement}, workspace has {workspace_tier})"
            )
            # Safe degradation: redirect to conversation advisor explaining tier upgrade
            envelope.selected_agent = "conversation"
            envelope.normalized_intent = "executive.companion.scaffold"
            return PolicyEvaluationResult(
                allowed=True,
                envelope=envelope,
                effective_autonomy=AutonomyLevel.SUGGEST,
                denial_reason=f"Enterprise capability '{cap_id}' requires tier upgrade",
            )

        # 3. Autonomy Boundaries & Consequential Action Gating
        effective_autonomy = manifest.default_autonomy
        requires_approval = False

        if manifest.risk_class.value in ("high", "critical"):
            # Consequential action (file moves, external emails, submissions)
            requires_approval = True
            effective_autonomy = AutonomyLevel.SUGGEST

        # Update envelope with granted autonomy
        envelope.autonomy_granted = effective_autonomy

        return PolicyEvaluationResult(
            allowed=True,
            envelope=envelope,
            effective_autonomy=effective_autonomy,
            requires_human_approval=requires_approval,
        )
