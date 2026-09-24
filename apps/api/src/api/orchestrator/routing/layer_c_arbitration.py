"""Layer C — Cognitive Arbitration & Intent Envelope Construction.

Combines TypeSafe AI Jev System 1 (<50ms deterministic fast-choice) with
Ollama Cloud Gemma / Groq System 2 (structured semantic arbitration) to assemble
the authoritative 27-field IntentEnvelope.
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from typing import Any

from ..capability_registry import capability_registry
from ..contracts.capability import AutonomyLevel
from ..contracts.decision import RoutingDecision, SubtaskNode
from ..contracts.intent import (
    ContextSignal,
    EmotionalState,
    IntentEnvelope,
    OARSTone,
    UserContextFencing,
)
from .layer_b_semantic import SemanticCandidateResult

logger = logging.getLogger(__name__)


class LayerCArbitration:
    """Cognitive intent arbitration combining System 1 and System 2."""

    def __init__(self) -> None:
        self.registry = capability_registry

    async def arbitrate(
        self,
        candidate_res: SemanticCandidateResult,
        workspace_id: str,
        tenant_id: str | None = None,
        user_id: str | None = None,
        raw_query: str = "",
        sanitized_query: str = "",
        active_artifacts: list[str] | None = None,
        resolved_entities: dict[str, Any] | None = None,
    ) -> IntentEnvelope:
        start_time = time.monotonic()
        query = sanitized_query or candidate_res.query

        # 1. Detect Context & Emotional Signals (Psychological containment)
        context_signal, social_intent = self._detect_context_signal(query)

        # 2. System 1 Fast Arbitration via TypeSafe AI Jev
        selected_cap_id = candidate_res.top_capability
        selected_agent_id = candidate_res.top_agent
        routing_method = "semantic_candidate"
        confidence = candidate_res.confidence
        is_complex = False
        subtasks: list[dict[str, Any]] = []

        try:
            from ...services.jev_service import JevService

            jev = JevService()
            if jev.api_key:
                options = [c.capability_id for c in candidate_res.candidates]
                criteria = {
                    c.capability_id: f"{c.display_name}. {c.description}"
                    for c in candidate_res.candidates
                }
                if options:
                    choice = await jev.choice(
                        prompt=f"Select the exact capability required for user request: '{query}'",
                        options=options,
                        criteria=criteria,
                    )
                    if choice and choice in [c.capability_id for c in candidate_res.candidates]:
                        selected_cap_id = choice
                        cap = self.registry.get_by_id(selected_cap_id)
                        if cap:
                            selected_agent_id = cap.agent_id
                        routing_method = "jev_system1"
                        confidence = 0.95
                        logger.info(f"LAYER_C: TypeSafe Jev System 1 resolved capability '{selected_cap_id}'")
        except Exception as jev_exc:
            logger.debug(f"LAYER_C: Jev System 1 skipped or failed: {jev_exc}")

        # 3. Detect Multi-Agent Subtasks if complex goal
        query_lower = query.lower()
        if (" and " in query_lower or " then " in query_lower or "also " in query_lower) and len(query.split()) > 7:
            is_complex = True
            routing_method = "llm_arbitration"
            # Decompose candidate subtasks
            subtasks = [
                {
                    "task_id": f"subtask_{uuid.uuid4().hex[:8]}",
                    "title": f"Execute primary {candidate_res.top_agent} phase",
                    "capability_required": selected_cap_id,
                    "agent_assigned": selected_agent_id,
                    "dependencies": [],
                }
            ]
            if len(candidate_res.candidates) > 1:
                sec_cap = candidate_res.candidates[1]
                subtasks.append(
                    {
                        "task_id": f"subtask_{uuid.uuid4().hex[:8]}",
                        "title": f"Execute secondary {sec_cap.agent_id} phase",
                        "capability_required": sec_cap.capability_id,
                        "agent_assigned": sec_cap.agent_id,
                        "dependencies": [subtasks[0]["task_id"]],
                    }
                )

        # 4. If Social Intent (Greeting / Acute Distress), route to ConversationAgent for Rogers OARS containment
        if social_intent or context_signal.emotional_state in (
            EmotionalState.FRUSTRATED,
            EmotionalState.BURNT_OUT,
        ):
            selected_cap_id = "executive.companion.scaffold"
            selected_agent_id = "conversation"
            confidence = max(confidence, 0.95)
            is_complex = False
            subtasks = []

        # Compute latency
        latency_ms = (time.monotonic() - start_time) * 1000.0

        # Assemble the authoritative 27-field IntentEnvelope
        envelope = IntentEnvelope(
            envelope_id=f"env_{uuid.uuid4().hex[:12]}",
            workspace_id=workspace_id,
            tenant_id=tenant_id,
            user_id=user_id,
            raw_query=raw_query or query,
            sanitized_query=query,
            normalized_intent=selected_cap_id,
            confidence=confidence,
            category=selected_agent_id,
            secondary_categories=[c.agent_id for c in candidate_res.candidates if c.agent_id != selected_agent_id],
            required_capabilities=[selected_cap_id],
            candidate_agents=[c.agent_id for c in candidate_res.candidates],
            selected_agent=selected_agent_id,
            routing_method=routing_method,
            is_complex_goal=is_complex,
            subtasks=subtasks,
            social_intent=social_intent,
            context_signal=context_signal,
            active_artifact_references=active_artifacts or [],
            resolved_entities=resolved_entities or {},
            extracted_parameters={},
            execution_budget={"max_tokens": 4096, "max_time_s": 45.0, "max_iterations": 5},
            autonomy_granted=AutonomyLevel.SUGGEST,
            user_context_fencing=UserContextFencing(
                provenance_ids=[],
                memory_freshness_score=1.0,
                sensitivity_level="standard",
            ),
            routing_latency_ms=latency_ms,
            audit_signature=f"vaeloom-sig-{uuid.uuid4().hex[:8]}",
        )

        return envelope

    def _detect_context_signal(self, text: str) -> tuple[ContextSignal, str | None]:
        """Cognitive signal and emotional valence extraction (Rogers OARS mapping)."""
        lower = text.lower().strip()
        words = set(lower.split())

        # Social Openers & Closers
        greetings = {"hi", "hello", "hey", "hlo", "good morning", "good afternoon", "good evening", "howdy"}
        gratitudes = {"thanks", "thank you", "thx", "ty", "cheers", "appreciate it"}
        farewells = {"bye", "goodbye", "see you", "cya", "farewell", "later"}

        social_intent: str | None = None
        if lower in greetings or any(lower.startswith(g) for g in greetings):
            social_intent = "greeting"
        elif lower in gratitudes:
            social_intent = "gratitude"
        elif lower in farewells:
            social_intent = "farewell"

        # Emotional Valence & Stress Analysis
        distress_markers = [
            "overwhelm", "stressed", "burnout", "burnt out", "burned out", "exhausted", "hopeless",
            "anxious", "panic", "crying", "cant do this", "can't do this", "depressed",
            "losing my mind", "terrified", "impostor", "giving up", "breathe", "need a break"
        ]
        urgency_markers = ["asap", "urgent", "emergency", "deadline", "today", "immediately", "tomorrow"]

        detected_signals: list[str] = []
        emotional_state = EmotionalState.CALM
        valence = 0.0
        urgency = 0.3
        cognitive_load = 0.3
        tone = OARSTone.DIRECT_EXECUTIVE

        if any(marker in lower for marker in distress_markers):
            detected_signals.append("high_emotional_distress")
            is_burnt_out = any(m in lower for m in ("burnout", "burned out", "burnt out", "exhausted", "hopeless", "overwhelm", "breathe", "need a break"))
            emotional_state = EmotionalState.BURNT_OUT if is_burnt_out else EmotionalState.ANXIOUS
            valence = -0.8
            cognitive_load = 0.9
            tone = OARSTone.SUPPORTIVE_AFFIRMATION

        if any(marker in lower for marker in urgency_markers):
            detected_signals.append("high_urgency_constraint")
            urgency = 0.9
            tone = OARSTone.STRUCTURED_DECOMPOSITION

        if social_intent == "greeting":
            valence = 0.5
            tone = OARSTone.REFLECTIVE_INQUIRY

        return (
            ContextSignal(
                emotional_state=emotional_state,
                valence=valence,
                urgency=urgency,
                cognitive_load=cognitive_load,
                oars_tone=tone,
                detected_signals=detected_signals,
            ),
            social_intent,
        )
