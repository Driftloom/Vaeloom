"""Layer B — Cheap Semantic Candidate Generation.

Matches incoming queries against Agent Capability Centroids and exemplars
to generate top-K candidate capabilities in <15ms without expensive LLM calls.
"""

from __future__ import annotations

import logging
from typing import Any

from ..capability_registry import capability_registry
from ..contracts.capability import AgentCapabilityManifest

logger = logging.getLogger(__name__)


class SemanticCandidateResult:
    def __init__(
        self,
        query: str,
        candidates: list[AgentCapabilityManifest],
        candidate_scores: dict[str, float],
        top_capability: str,
        top_agent: str,
        confidence: float,
    ) -> None:
        self.query = query
        self.candidates = candidates
        self.candidate_scores = candidate_scores
        self.top_capability = top_capability
        self.top_agent = top_agent
        self.confidence = confidence


class LayerBSemanticCandidates:
    """Fast semantic candidate generation matching query against capability centroids."""

    def __init__(self) -> None:
        self.registry = capability_registry

    async def generate_candidates(
        self,
        query: str,
        top_k: int = 5,
        mvp_only: bool = False,
    ) -> SemanticCandidateResult:
        # Resolve capabilities using exemplar semantic scoring
        matched_caps = self.registry.resolve_candidate_capabilities(
            query=query,
            top_k=top_k,
            mvp_only=mvp_only,
        )

        scores: dict[str, float] = {}
        if not matched_caps:
            # Fallback to general conversation
            conv_cap = self.registry.get_by_id("executive.companion.scaffold")
            if conv_cap:
                matched_caps = [conv_cap]
                scores[conv_cap.capability_id] = 0.85
            else:
                scores["executive.companion.scaffold"] = 0.50

        # Calculate scores
        for idx, cap in enumerate(matched_caps):
            # Rank-decayed score based on exemplar match strength
            base_score = max(0.95 - (idx * 0.15), 0.50)
            scores[cap.capability_id] = round(base_score, 2)

        top_cap = matched_caps[0]
        top_score = scores[top_cap.capability_id]

        return SemanticCandidateResult(
            query=query,
            candidates=matched_caps,
            candidate_scores=scores,
            top_capability=top_cap.capability_id,
            top_agent=top_cap.agent_id,
            confidence=top_score,
        )
