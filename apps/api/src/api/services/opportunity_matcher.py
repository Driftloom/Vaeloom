"""
PIOS Opportunity Engine (ORBIT / Reverse LinkedIn) Matcher Core.
Implements the mathematical matching formula and explainability engine from PIOS Blueprint:
match_score = cosine_similarity * graph_proximity_score * recency_decay - gap_penalty
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from .capability_engine import capability_engine, ValidationTier, DecayStatus

logger = logging.getLogger(__name__)


@dataclass
class SkillMatchDetail:
    skill_name: str
    user_tier: str
    effective_confidence: float
    decay_status: str
    is_gap: bool = False
    remediation_path: str | None = None


@dataclass
class OpportunityMatchResult:
    opportunity_id: str
    title: str
    company_or_host: str
    opportunity_type: str  # job, hackathon, research, oss, cofounder
    match_score: float  # Normalized 0.0 to 1.0
    cosine_similarity: float
    graph_proximity_score: float
    recency_decay: float
    gap_penalty: float
    matching_skills: list[SkillMatchDetail]
    missing_skills: list[SkillMatchDetail]
    why_you_headline: str
    why_you_rationale: str
    development_action: str | None = None


class OpportunityMatcher:
    """Stateless, explainable matching core for PIOS Opportunity Engine."""

    @staticmethod
    def _cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0
        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))
        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0
        return max(0.0, min(1.0, dot_product / (norm_a * norm_b)))

    @staticmethod
    def _jaccard_keyword_similarity(user_skills: set[str], required_skills: set[str]) -> float:
        """Token/Jaccard similarity fallback for keyword-level scoring."""
        if not required_skills:
            return 0.8
        if not user_skills:
            return 0.0
        overlap = len(user_skills & required_skills)
        return overlap / len(required_skills)

    def calculate_match(
        self,
        opportunity: dict[str, Any],
        user_capabilities: list[dict[str, Any]],
        user_vector: list[float] | None = None,
        opportunity_vector: list[float] | None = None,
        connected_entities_count: int = 0,
    ) -> OpportunityMatchResult:
        """
        Execute matcher_core formula:
        match_score = cosine * proximity * recency - gap_penalty
        """
        opp_id = str(opportunity.get("id", "opp-unknown"))
        title = str(opportunity.get("title", "Opportunity"))
        host = str(opportunity.get("company", opportunity.get("host", "External")))
        opp_type = str(opportunity.get("type", "job"))
        required_skills_raw = opportunity.get("required_skills", [])
        required_skills = {s.lower().strip() for s in required_skills_raw if isinstance(s, str)}

        # Build user capability lookup
        user_caps_map: dict[str, dict[str, Any]] = {}
        for cap in user_capabilities:
            name = cap.get("name", "").lower().strip()
            if name:
                user_caps_map[name] = cap

        user_skills_set = set(user_caps_map.keys())

        # 1. Cosine similarity / Semantic match
        if user_vector and opportunity_vector and len(user_vector) == len(opportunity_vector):
            cosine_sim = self._cosine_similarity(user_vector, opportunity_vector)
        else:
            cosine_sim = self._jaccard_keyword_similarity(user_skills_set, required_skills)

        # 2. Graph proximity score (1.0 base + depth boost up to 0.3)
        proximity_boost = min(0.3, connected_entities_count * 0.03)
        graph_proximity = 1.0 + proximity_boost

        # 3. Recency decay calculation across matching skills
        matching_details: list[SkillMatchDetail] = []
        missing_details: list[SkillMatchDetail] = []
        decay_factors: list[float] = []

        for req in required_skills:
            if req in user_caps_map:
                u_cap = user_caps_map[req]
                eff_conf = float(u_cap.get("effective_confidence", u_cap.get("confidence", 0.8)))
                tier = str(u_cap.get("validation_tier", "V2"))
                decay_status = str(u_cap.get("decay_status", "fresh"))
                decay_fac = float(u_cap.get("decay_factor", 1.0))
                decay_factors.append(decay_fac)

                matching_details.append(
                    SkillMatchDetail(
                        skill_name=req.title(),
                        user_tier=tier,
                        effective_confidence=eff_conf,
                        decay_status=decay_status,
                        is_gap=False,
                    )
                )
            else:
                missing_details.append(
                    SkillMatchDetail(
                        skill_name=req.title(),
                        user_tier="V0",
                        effective_confidence=0.0,
                        decay_status="missing",
                        is_gap=True,
                        remediation_path=f"Build hands-on capstone project demonstrating {req.title()}",
                    )
                )

        avg_decay = (sum(decay_factors) / len(decay_factors)) if decay_factors else 0.85

        # 4. Gap penalty for missing hard requirements
        total_req = max(1, len(required_skills))
        missing_ratio = len(missing_details) / total_req
        gap_penalty = round(missing_ratio * 0.35, 4)

        # 5. Composite match score calculation
        # formula: (cosine * proximity * decay) - gap_penalty
        raw_score = (cosine_sim * graph_proximity * avg_decay) - gap_penalty
        match_score = round(max(0.0, min(1.0, raw_score)), 4)

        # 6. Generate "Why You" Natural-Language Explainability
        match_percentage = int(match_score * 100)
        if match_percentage >= 80:
            headline = f"High Match ({match_percentage}%): Strong alignment with your verified capabilities in {', '.join(d.skill_name for d in matching_details[:2])}."
        elif match_percentage >= 60:
            headline = f"Moderate Match ({match_percentage}%): Core competencies align, with addressable gap in {missing_details[0].skill_name if missing_details else 'specific areas'}."
        else:
            headline = f"Growth Match ({match_percentage}%): Requires closing key gaps in {', '.join(d.skill_name for d in missing_details[:2])}."

        matched_names = [m.skill_name for m in matching_details]
        why_you_rationale = (
            f"You were matched to '{title}' at {host} based on demonstrated evidence in "
            f"{', '.join(matched_names) if matched_names else 'your profile'}. "
            f"The Opportunity Engine calibrated your match with an average skill freshness of "
            f"{int(avg_decay * 100)}% and a graph proximity multiplier of {round(graph_proximity, 2)}x."
        )

        dev_action = None
        if missing_details:
            dev_action = f"To reach 95%+ readiness: {missing_details[0].remediation_path}."

        return OpportunityMatchResult(
            opportunity_id=opp_id,
            title=title,
            company_or_host=host,
            opportunity_type=opp_type,
            match_score=match_score,
            cosine_similarity=round(cosine_sim, 4),
            graph_proximity_score=round(graph_proximity, 4),
            recency_decay=round(avg_decay, 4),
            gap_penalty=gap_penalty,
            matching_skills=matching_details,
            missing_skills=missing_details,
            why_you_headline=headline,
            why_you_rationale=why_you_rationale,
            development_action=dev_action,
        )

    def rank_opportunities(
        self,
        opportunities: list[dict[str, Any]],
        user_capabilities: list[dict[str, Any]],
        top_k: int = 10,
    ) -> list[OpportunityMatchResult]:
        """Rank a batch of opportunities by match score."""
        results = [
            self.calculate_match(opp, user_capabilities)
            for opp in opportunities
        ]
        results.sort(key=lambda x: x.match_score, reverse=True)
        return results[:top_k]


# Global singleton
opportunity_matcher = OpportunityMatcher()
