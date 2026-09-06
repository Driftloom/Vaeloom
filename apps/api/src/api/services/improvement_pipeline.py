"""Controlled self-improvement pipeline (Phase B §16).

No automatic production self-modification. Every optimization beyond
personalization/memory-learning moves through:

OBSERVE -> GENERATE CANDIDATE -> OFFLINE EVALUATE -> SAFETY EVALUATE ->
COMPARE BASELINE -> SHADOW/CANARY -> APPROVE -> DEPLOY -> MONITOR -> ROLLBACK

Personalization (user preferences) and memory learning (entity extraction)
remain automatic — they write scoped workspace memory, never code, prompts,
policies, or routing. Prompt/policy/model/tool optimization produces a
CANDIDATE that requires an explicit approval record before deploy, and every
deploy records a rollback pointer.
"""
from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

ImprovementKind = Literal[
    "personalization", "memory_learning", "feedback_learning",
    "prompt_optimization", "policy_optimization", "tool_optimization",
    "model_optimization", "autonomous",
]

# Kinds allowed to apply automatically (scoped memory writes only).
AUTO_APPLY_KINDS: frozenset = frozenset({"personalization", "memory_learning"})

PIPELINE_STAGES = (
    "observed", "candidate", "offline_evaluated", "safety_evaluated",
    "baseline_compared", "shadow", "approved", "deployed", "monitoring", "rolled_back",
)


@dataclass
class ImprovementCandidate:
    kind: ImprovementKind
    summary: str
    payload: dict[str, Any] = field(default_factory=dict)
    baseline: dict[str, Any] = field(default_factory=dict)
    evaluation: dict[str, Any] = field(default_factory=dict)
    safety: dict[str, Any] = field(default_factory=dict)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    stage: str = "candidate"
    created_at: float = field(default_factory=time.time)
    approved_by: str | None = None
    rollback_pointer: str | None = None

    @property
    def fingerprint(self) -> str:
        raw = json.dumps({"kind": self.kind, "payload": self.payload}, sort_keys=True, default=str)
        return hashlib.sha256(raw.encode()).hexdigest()[:16]


def classify_kind(kind: str) -> ImprovementKind:
    if kind in ("personalization", "memory_learning", "feedback_learning",
                "prompt_optimization", "policy_optimization", "tool_optimization",
                "model_optimization", "autonomous"):
        return kind  # type: ignore[return-value]
    raise ValueError(f"unknown improvement kind: {kind}")


def may_auto_apply(kind: ImprovementKind) -> bool:
    """Only scoped memory learning may apply without approval."""
    if kind == "autonomous":
        return False
    return kind in AUTO_APPLY_KINDS


def advance_stage(candidate: ImprovementCandidate, stage: str, *, approved_by: str | None = None) -> ImprovementCandidate:
    if stage not in PIPELINE_STAGES:
        raise ValueError(f"unknown pipeline stage: {stage}")
    current_idx = PIPELINE_STAGES.index(candidate.stage) if candidate.stage in PIPELINE_STAGES else -1
    # 'candidate' initial stage maps to index 1; allow forward-only movement.
    target_idx = PIPELINE_STAGES.index(stage)
    if target_idx < current_idx:
        raise ValueError(f"pipeline cannot move backwards: {candidate.stage} -> {stage}")
    if stage in ("approved", "deployed") and candidate.kind not in AUTO_APPLY_KINDS and not approved_by:
        raise ValueError(f"kind '{candidate.kind}' requires explicit approval before {stage}")
    candidate.stage = stage
    if approved_by:
        candidate.approved_by = approved_by
    return candidate


def deploy_guard(candidate: ImprovementCandidate) -> tuple[bool, str]:
    """Final gate before production effect. Returns (allowed, reason)."""
    if candidate.kind in AUTO_APPLY_KINDS:
        return True, "auto-apply kind (scoped memory only)"
    if candidate.stage not in ("approved", "deployed", "monitoring") or not candidate.approved_by:
        return False, "candidate lacks explicit approval"
    if not candidate.rollback_pointer:
        return False, "candidate lacks rollback pointer"
    safety_ok = bool(candidate.safety.get("passed", False))
    if not safety_ok:
        return False, "safety evaluation did not pass"
    return True, "approved with rollback"
