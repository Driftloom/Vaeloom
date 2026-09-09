"""Learning admission gate — strict bounded boundary for Muse learning signals.

Bounded contract (aligned with existing Vaeloom architecture):
  INPUT SIGNAL -> VALIDATION -> TENANT/WORKSPACE BINDING -> LEARNING DECISION
    -> ADMISSION/SAFETY GATE -> PERSISTENCE -> FUTURE RETRIEVAL/BEHAVIORAL EFFECT

Learning here means ONLY scoped workspace memory (preference / skill / career /
education / experience Entities). It NEVER mutates system prompts, developer
policy, security policy, authorization, tool permissions, or tenant config —
those require the governed improvement_pipeline (explicit approval + rollback).

A learning candidate must pass, in order:
  schema validation + tenant binding + workspace binding + source validation
  + confidence threshold + deduplication(hint) + safety policy + scope policy.

Rejections fail closed with machine-readable reasons. Every decision carries
correlation / tenant / workspace / signal identity for observability.
"""

from __future__ import annotations

import re
import uuid
from typing import Any

# Sources actually produced by this repository. Anything else is untrusted.
ALLOWED_SOURCES = frozenset({
    "user_correction",      # explicit correction via consolidator
    "approval_feedback",    # APPROVED/REJECTED approval harvest
    "trajectory_feedback",  # improve_phase trajectory summary
    "llm_feedback",         # LLM-extracted entities from feedback
    "heuristic_preference", # regex preference extraction
    "heuristic_skill",      # regex skill extraction
    "manual",               # direct entry-point (tests / operator correction)
})

# Entity types learning is allowed to write. System/developer/policy/auth
# instruction types are NEVER writable through this gate.
ALLOWED_LEARN_TYPES = frozenset({
    "preference", "skill", "career", "education", "experience",
})

# Payload caps (bytes/chars). Oversized payloads are rejected, never truncated
# silently (truncation would corrupt attribution).
MAX_CORRECTION_CHARS = 500
MAX_FEEDBACK_CHARS = 4000
MAX_NAME_CHARS = 120
MAX_EVENT_ID_CHARS = 128
MAX_CORRELATION_CHARS = 128

# Instruction-override markers: a "preference" that smuggles system/developer
# instructions must never enter memory. Rejected at admission; retrieval path
# additionally quarantines at use (defense in depth).
_INSTRUCTION_MARKERS = (
    "ignore previous instructions",
    "ignore all previous instructions",
    "disregard policy",
    "disregard all policy",
    "you are now",
    "system:",
    "developer:",
    "delete files",
    "drop tables",
    "bypass approval",
    "disable auth",
)


def _looks_like_instruction(text: str) -> bool:
    low = (text or "").lower()
    return any(m in low for m in _INSTRUCTION_MARKERS)


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(value)) if value else None
    except Exception:
        return None


def validate_learning_signal(
    *,
    workspace_id: str | None,
    tenant_id: str | None = None,
    source: str = "trajectory_feedback",
    learn_type: str = "preference",
    name: str = "",
    event_id: str | None = None,
    correlation_id: str | None = None,
    is_novel: bool = True,
) -> tuple[bool, dict[str, Any]]:
    """Validate one learning candidate. Returns (accepted, decision).

    decision always contains: signal_id, correlation_id, tenant_id,
    workspace_id, source, learn_type, admission result + reason, and where
    applicable the admission score. Rejections fail closed — callers must not
    persist on accepted=False.
    """
    import uuid as _uuid

    signal_id = str(_uuid.uuid4())
    corr = (correlation_id or signal_id)[:MAX_CORRELATION_CHARS]

    def _reject(reason: str, extra: dict[str, Any] | None = None) -> tuple[bool, dict[str, Any]]:
        d: dict[str, Any] = {
            "signal_id": signal_id,
            "correlation_id": corr,
            "tenant_id": tenant_id,
            "workspace_id": workspace_id,
            "source": source,
            "learn_type": learn_type,
            "accepted": False,
            "reason": reason,
        }
        if extra:
            d.update(extra)
        return False, d

    # 1. schema validation: workspace binding is mandatory
    w_uuid = _parse_uuid(workspace_id)
    if w_uuid is None:
        return _reject("missing_or_invalid_workspace_id")
    # 2. tenant binding: when provided it must parse; tenant NEVER inferred
    #    from workspace here (resolution is the caller's job).
    if tenant_id is not None and _parse_uuid(tenant_id) is None:
        return _reject("missing_or_invalid_tenant_id")
    # 3. source validation
    if source not in ALLOWED_SOURCES:
        return _reject("unsupported_source")
    # 4. scope policy: only memory-scoped types; never policy/instruction types
    if learn_type not in ALLOWED_LEARN_TYPES:
        return _reject("unsupported_learning_type")
    # 5. payload caps
    clean_name = (name or "").strip()
    if not clean_name:
        return _reject("empty_name")
    if len(clean_name) > MAX_NAME_CHARS:
        return _reject("oversized_payload", {"detail": f"name>{MAX_NAME_CHARS}"})
    if event_id is not None and len(event_id) > MAX_EVENT_ID_CHARS:
        return _reject("oversized_payload", {"detail": "event_id too long"})
    # 6. safety policy: reject instruction-injection smuggling
    if _looks_like_instruction(clean_name):
        return _reject("untrusted_instruction")
    # 7. confidence threshold (shared admission formula; merges always pass)
    try:
        from api.agents.memory.consolidator import admission_score
    except Exception:  # pragma: no cover — consolidator always importable in prod
        admission_score = None  # type: ignore[assignment]
    if admission_score is not None:
        score, verdict = admission_score(source, is_novel=is_novel, name=clean_name)
    else:
        score, verdict = (1.0, "admitted") if not is_novel else (0.7, "admitted")
    if is_novel and verdict == "rejected-low-signal":
        return _reject("low_confidence", {"admission_score": score, "verdict": verdict})

    return True, {
        "signal_id": signal_id,
        "correlation_id": corr,
        "tenant_id": tenant_id,
        "workspace_id": str(w_uuid),
        "workspace_uuid": str(w_uuid),
        "source": source,
        "learn_type": learn_type,
        "name": clean_name,
        "accepted": True,
        "reason": "admitted" if is_novel else "merge-existing",
        "admission_score": score,
        "admission_verdict": verdict,
        "event_id": event_id,
    }


def validate_signal_texts(
    *,
    correction: str | None = None,
    feedback: str | None = None,
) -> tuple[bool, str]:
    """Validate raw input text sizes before extraction. Returns (ok, reason)."""
    if correction is not None and len(correction) > MAX_CORRECTION_CHARS:
        return False, "oversized_correction"
    if feedback is not None and len(feedback) > MAX_FEEDBACK_CHARS:
        return False, "oversized_feedback"
    return True, "ok"


# Re-export the injection predicate for callers that pre-screen raw text.
looks_like_instruction = _looks_like_instruction


async def verify_workspace_tenant(session: Any, workspace_uuid: uuid.UUID, tenant_id: str | None) -> tuple[bool, str]:
    """Verify a workspace belongs to the claiming tenant (fail-closed on PROVEN mismatch).

    Ownership chain: workspaces.user_id -> users.tenant_id. Also accepts the
    workspace owner user-id or a workspace member user-id as the binding
    (single-user deployments where tenant == user).
    - tenant_id None → (True, "no_tenant_binding"): workspace binding only.
    - workspace row missing or lookup error → (True, "unverified_owner"):
      cannot verify at this layer; the API boundary (_verify_workspace_access +
      TenantMiddleware) remains the authoritative ownership gate. Callers log it.
    - proven mismatch → (False, "foreign_workspace"): reject, never persist.
    """
    if not tenant_id:
        return True, "no_tenant_binding"
    try:
        from api.models.schema import User, Workspace, WorkspaceUser
        from sqlalchemy import select as _sel

        ws = await session.get(Workspace, workspace_uuid)
        if ws is None:
            return True, "unverified_owner"
        t = str(tenant_id)
        if str(getattr(ws, "user_id", "")) == t:
            return True, "owner_match"
        owner = await session.get(User, getattr(ws, "user_id", None))
        if owner is not None and getattr(owner, "tenant_id", None) is not None:
            if str(owner.tenant_id) == t:
                return True, "tenant_match"
        try:
            m = await session.execute(
                _sel(WorkspaceUser.user_id).where(WorkspaceUser.workspace_id == workspace_uuid)
            )
            if any(str(uid) == t for (uid,) in m.all()):
                return True, "member_match"
        except Exception:
            pass
        return False, "foreign_workspace"
    except Exception:
        return True, "unverified_owner"
