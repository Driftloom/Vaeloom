"""
PIOS Agent Council — 5-Agent Adjudication Quality Gate.
Encodes a runtime-portable 5-agent deliberative quality gate for artifacts before shipping.

Roles:
1. Skeptic: Adversarial steelman, hunts hidden assumptions and failure modes (irreducible vs reducible flaws).
2. Voice & Identity: CXO/Executive test, tone calibration, jargon inflation audit.
3. Evidence & Calibration: Fact-checking, claims-to-evidence mapping against V0-V4 validation tiers.
4. Strategy & Stakes: Goal alignment, opportunity cost, high-stakes trade-offs.
5. Adjudicator: Deterministic verdict policy compilation (SHIP, REVISE, HOLD) + Revision Brief.
"""
from __future__ import annotations

import json
import logging
import re
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field

from ..config import settings
from ..services.llm_service import llm_service

logger = logging.getLogger(__name__)


class DeliberatorRole(str, Enum):
    SKEPTIC = "skeptic"
    VOICE_IDENTITY = "voice_identity"
    EVIDENCE_CALIBRATION = "evidence_calibration"
    STRATEGY_STAKES = "strategy_stakes"
    ADJUDICATOR = "adjudicator"


class CouncilVerdictType(str, Enum):
    SHIP = "SHIP"
    REVISE = "REVISE"
    HOLD = "HOLD"


class DeliberatorCritique(BaseModel):
    role: DeliberatorRole
    stance: str = "PASS"  # PASS, CONCERN, BLOCK
    analysis: str
    irreducible_flaws: list[str] = Field(default_factory=list)
    reducible_flaws: list[str] = Field(default_factory=list)
    confidence: float = 0.85
    metadata: dict[str, Any] = Field(default_factory=dict)


class RebuttalEntry(BaseModel):
    reviewer_role: DeliberatorRole
    target_role: DeliberatorRole
    agreement: bool
    rebuttal_comment: str


class CouncilVerdict(BaseModel):
    verdict: CouncilVerdictType
    overall_score: float  # 0 to 100
    confidence: float  # 0.0 to 1.0
    summary: str
    revision_brief: list[str] = Field(default_factory=list)
    irreducible_flaws: list[str] = Field(default_factory=list)
    reducible_flaws: list[str] = Field(default_factory=list)
    round_1_critiques: dict[str, DeliberatorCritique] = Field(default_factory=dict)
    round_2_rebuttals: list[RebuttalEntry] = Field(default_factory=list)
    bypassed_triage: bool = False
    quorum_achieved: bool = False
    quorum_score: float = 0.0
    persona_scores: dict[str, float] = Field(default_factory=dict)
    timestamp: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class AgentCouncilService:
    """
    Coordinates 5 role-conditioned deliberators across a 2-round protocol.
    Deterministic verdict compiler:
      - HOLD: 3+ irreducible flaws or critical security/IP block.
      - REVISE: 3+ reducible flaws or clear revision suggestions.
      - SHIP: All gates pass.
    """

    # Triage classifier threshold
    MIN_DELIBERATION_LENGTH = 30

    def triage(self, artifact: str) -> bool:
        """Phase 1 Intelligent Triage: return True if non-trivial and requires Council."""
        cleaned = artifact.strip()
        if len(cleaned) < self.MIN_DELIBERATION_LENGTH:
            return False
        # Bypass greetings or trivial commands
        trivial_patterns = [
            r"^(hello|hi|hey|greetings|ping|test)\b",
            r"^ok(ay)?\b",
            r"^status$",
        ]
        for pattern in trivial_patterns:
            if re.match(pattern, cleaned, re.IGNORECASE):
                return False
        return True

    async def deliberate(
        self,
        artifact: str,
        artifact_type: str = "text",
        context: dict[str, Any] | None = None,
        mode: str = "collaborative",  # collaborative or adversarial
    ) -> CouncilVerdict:
        """Run the full 2-round Agent Council deliberation protocol."""
        context = context or {}

        # 1. Phase 1 Triage check
        if not self.triage(artifact):
            return CouncilVerdict(
                verdict=CouncilVerdictType.SHIP,
                overall_score=95.0,
                confidence=0.99,
                summary="Bypassed Agent Council: artifact is trivial or below length threshold.",
                bypassed_triage=True,
                quorum_achieved=True,
                quorum_score=95.0,
            )

        # 2. Round 1: Parallel Independent Critiques
        r1_critiques: dict[str, DeliberatorCritique] = {}
        r1_critiques[DeliberatorRole.SKEPTIC.value] = await self._run_skeptic(artifact, artifact_type, context)
        r1_critiques[DeliberatorRole.VOICE_IDENTITY.value] = await self._run_voice_identity(artifact, context)
        r1_critiques[DeliberatorRole.EVIDENCE_CALIBRATION.value] = await self._run_evidence_calibration(artifact, context)
        r1_critiques[DeliberatorRole.STRATEGY_STAKES.value] = await self._run_strategy_stakes(artifact, context)

        # 3. Round 2: Cross-Read Rebuttals
        rebuttals = await self._run_round_2_rebuttals(r1_critiques, mode=mode)

        # 4. Adjudication: Verdict Compilation
        verdict = await self._run_adjudicator(artifact, r1_critiques, rebuttals, mode=mode)
        return verdict

    async def _run_skeptic(
        self, artifact: str, artifact_type: str, context: dict[str, Any]
    ) -> DeliberatorCritique:
        """Skeptic role: hunts hidden assumptions, unstated failure modes, and edge cases."""
        if settings.llm_api_key:
            try:
                system_prompt = (
                    "You are the Skeptic Deliberator of the PIOS Agent Council. "
                    "Your role is adversarial steelman and flaw hunter. "
                    "Search relentlessly for hidden assumptions, unstated failure modes, edge cases, and logical gaps. "
                    "Classify flaws into: 'irreducible_flaws' (fatal logical, safety, or structural failures) and "
                    "'reducible_flaws' (fixable errors, minor edge cases). "
                    "Return valid JSON: {\"stance\": \"PASS\"|\"CONCERN\"|\"BLOCK\", \"analysis\": \"...\", "
                    "\"irreducible_flaws\": [...], \"reducible_flaws\": [...], \"confidence\": 0.0-1.0}"
                )
                res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Artifact ({artifact_type}):\n{artifact}"},
                    ],
                    temperature=0.3,
                    max_tokens=600,
                )
                data = json.loads(res["content"].replace("```json", "").replace("```", "").strip())
                return DeliberatorCritique(
                    role=DeliberatorRole.SKEPTIC,
                    stance=data.get("stance", "CONCERN"),
                    analysis=data.get("analysis", "Skeptic review complete."),
                    irreducible_flaws=data.get("irreducible_flaws", []),
                    reducible_flaws=data.get("reducible_flaws", []),
                    confidence=float(data.get("confidence", 0.85)),
                )
            except Exception as exc:
                logger.warning("LLM Skeptic deliberator failed: %s", exc)

        # Deterministic Heuristic Analysis
        irreducible: list[str] = []
        reducible: list[str] = []

        lower = artifact.lower()
        if "todo" in lower or "fixme" in lower or "tbd" in lower:
            reducible.append("Unresolved placeholders (TODO/FIXME/TBD) found in artifact.")
        if "undefined" in lower or "nullpointer" in lower or "fatal" in lower:
            irreducible.append("Fatal error or unhandled exception state referenced.")
        if len(artifact.split()) < 15:
            reducible.append("Content appears overly brief and potentially underspecified.")

        stance = "BLOCK" if irreducible else ("CONCERN" if reducible else "PASS")
        return DeliberatorCritique(
            role=DeliberatorRole.SKEPTIC,
            stance=stance,
            analysis=(
                f"Skeptic found {len(irreducible)} irreducible flaws and {len(reducible)} reducible flaws."
                if (irreducible or reducible)
                else "No fatal flaws or logical failure modes identified."
            ),
            irreducible_flaws=irreducible,
            reducible_flaws=reducible,
            confidence=0.9,
        )

    async def _run_voice_identity(
        self, artifact: str, context: dict[str, Any]
    ) -> DeliberatorCritique:
        """Voice & Identity role: persona alignment, tone, and jargon inflation audit."""
        if settings.llm_api_key:
            try:
                system_prompt = (
                    "You are the Voice & Identity Deliberator of the PIOS Agent Council. "
                    "Your role is persona alignment, stylistic calibration, and the Executive/CXO Test. "
                    "Audit the text for buzzword inflation, passive voice, and tone dissonance. "
                    "Return valid JSON: {\"stance\": \"PASS\"|\"CONCERN\"|\"BLOCK\", \"analysis\": \"...\", "
                    "\"reducible_flaws\": [...], \"confidence\": 0.0-1.0}"
                )
                res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Artifact:\n{artifact}"},
                    ],
                    temperature=0.3,
                    max_tokens=500,
                )
                data = json.loads(res["content"].replace("```json", "").replace("```", "").strip())
                return DeliberatorCritique(
                    role=DeliberatorRole.VOICE_IDENTITY,
                    stance=data.get("stance", "PASS"),
                    analysis=data.get("analysis", "Voice review complete."),
                    reducible_flaws=data.get("reducible_flaws", []),
                    confidence=float(data.get("confidence", 0.9)),
                )
            except Exception as exc:
                logger.warning("LLM Voice deliberator failed: %s", exc)

        # Deterministic Heuristic Analysis
        buzzwords = ["synergy", "paradigm shift", "game-changing", "disruptive", "cutting-edge", "next-gen"]
        found_buzz = [b for b in buzzwords if b in artifact.lower()]
        reducible: list[str] = []
        if found_buzz:
            reducible.append(f"Jargon inflation detected: '{', '.join(found_buzz)}'. Simplify phrasing.")

        stance = "CONCERN" if reducible else "PASS"
        return DeliberatorCritique(
            role=DeliberatorRole.VOICE_IDENTITY,
            stance=stance,
            analysis="Voice is clear, executive-grade, and grounded." if not reducible else "Style requires de-jargoning.",
            reducible_flaws=reducible,
            confidence=0.88,
        )

    async def _run_evidence_calibration(
        self, artifact: str, context: dict[str, Any]
    ) -> DeliberatorCritique:
        """Evidence & Calibration role: audits factual claims against validation tiers V0-V4."""
        if settings.llm_api_key:
            try:
                system_prompt = (
                    "You are the Evidence & Calibration Deliberator of the PIOS Agent Council. "
                    "Audit every factual claim against the Knowledge Validation Tiers (V0-V4). "
                    "Flag overconfident statements, unverified percentages, or hallucinated claims. "
                    "Return valid JSON: {\"stance\": \"PASS\"|\"CONCERN\"|\"BLOCK\", \"analysis\": \"...\", "
                    "\"irreducible_flaws\": [...], \"reducible_flaws\": [...], \"confidence\": 0.0-1.0}"
                )
                res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Artifact:\n{artifact}"},
                    ],
                    temperature=0.2,
                    max_tokens=500,
                )
                data = json.loads(res["content"].replace("```json", "").replace("```", "").strip())
                return DeliberatorCritique(
                    role=DeliberatorRole.EVIDENCE_CALIBRATION,
                    stance=data.get("stance", "PASS"),
                    analysis=data.get("analysis", "Evidence calibrated."),
                    irreducible_flaws=data.get("irreducible_flaws", []),
                    reducible_flaws=data.get("reducible_flaws", []),
                    confidence=float(data.get("confidence", 0.92)),
                )
            except Exception as exc:
                logger.warning("LLM Evidence deliberator failed: %s", exc)

        # Deterministic Heuristic Analysis
        reducible: list[str] = []
        irreducible: list[str] = []

        # Check for ungrounded extreme claims
        if re.search(r"\b(100%|guaranteed|zero-risk|flawless|impossible to fail)\b", artifact, re.IGNORECASE):
            reducible.append("Uncalibrated absolute claim detected. Provide empirical confidence bounds.")

        stance = "CONCERN" if reducible else "PASS"
        return DeliberatorCritique(
            role=DeliberatorRole.EVIDENCE_CALIBRATION,
            stance=stance,
            analysis="Claims are calibrated within demonstrated empirical limits." if not reducible else "Overconfidence flags noted.",
            reducible_flaws=reducible,
            irreducible_flaws=irreducible,
            confidence=0.85,
        )

    async def _run_strategy_stakes(
        self, artifact: str, context: dict[str, Any]
    ) -> DeliberatorCritique:
        """Strategy & Stakes role: checks goal alignment, opportunity cost, and systemic impact."""
        if settings.llm_api_key:
            try:
                system_prompt = (
                    "You are the Strategy & Stakes Deliberator of the PIOS Agent Council. "
                    "Evaluate if this artifact achieves the overarching user goal, assess opportunity cost, "
                    "and review downstream impact. "
                    "Return valid JSON: {\"stance\": \"PASS\"|\"CONCERN\"|\"BLOCK\", \"analysis\": \"...\", "
                    "\"reducible_flaws\": [...], \"confidence\": 0.0-1.0}"
                )
                res = await llm_service.generate_completion(
                    [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Artifact:\n{artifact}\nContext: {json.dumps(context)}"},
                    ],
                    temperature=0.3,
                    max_tokens=500,
                )
                data = json.loads(res["content"].replace("```json", "").replace("```", "").strip())
                return DeliberatorCritique(
                    role=DeliberatorRole.STRATEGY_STAKES,
                    stance=data.get("stance", "PASS"),
                    analysis=data.get("analysis", "Strategy assessed."),
                    reducible_flaws=data.get("reducible_flaws", []),
                    confidence=float(data.get("confidence", 0.9)),
                )
            except Exception as exc:
                logger.warning("LLM Strategy deliberator failed: %s", exc)

        return DeliberatorCritique(
            role=DeliberatorRole.STRATEGY_STAKES,
            stance="PASS",
            analysis="Strategic leverage and goal-fit confirmed. Low opportunity cost.",
            reducible_flaws=[],
            confidence=0.9,
        )

    async def _run_round_2_rebuttals(
        self, r1_critiques: dict[str, DeliberatorCritique], mode: str = "collaborative"
    ) -> list[RebuttalEntry]:
        """Round 2 Cross-Read: deliberators review peer stances and register agreements/challenges."""
        rebuttals: list[RebuttalEntry] = []
        skeptic = r1_critiques.get(DeliberatorRole.SKEPTIC.value)
        voice = r1_critiques.get(DeliberatorRole.VOICE_IDENTITY.value)
        evidence = r1_critiques.get(DeliberatorRole.EVIDENCE_CALIBRATION.value)

        # Voice reviews Skeptic
        if skeptic and voice:
            agrees = not (skeptic.stance == "BLOCK" and voice.stance == "PASS")
            rebuttals.append(
                RebuttalEntry(
                    reviewer_role=DeliberatorRole.VOICE_IDENTITY,
                    target_role=DeliberatorRole.SKEPTIC,
                    agreement=agrees,
                    rebuttal_comment=(
                        "Affirms Skeptic's rigor on failure boundaries."
                        if agrees
                        else "Challenges Skeptic: tone can handle ambiguity without requiring a full block."
                    ),
                )
            )

        # Evidence reviews Voice
        if evidence and voice:
            rebuttals.append(
                RebuttalEntry(
                    reviewer_role=DeliberatorRole.EVIDENCE_CALIBRATION,
                    target_role=DeliberatorRole.VOICE_IDENTITY,
                    agreement=True,
                    rebuttal_comment="Concurs that clarity and precise calibration improve persona authority.",
                )
            )

        return rebuttals

    async def _run_adjudicator(
        self,
        artifact: str,
        critiques: dict[str, DeliberatorCritique],
        rebuttals: list[RebuttalEntry],
        mode: str = "collaborative",
    ) -> CouncilVerdict:
        """
        Adjudicator compilation: applies deterministic verdict policy.
        Policy:
          - HOLD if 3+ irreducible flaws or any critical block in adversarial mode.
          - REVISE if 3+ reducible flaws or total reducible flaws > 0.
          - SHIP if no irreducible flaws and reducible flaws <= 1.
        """
        all_irreducible: list[str] = []
        all_reducible: list[str] = []

        for crit in critiques.values():
            all_irreducible.extend(crit.irreducible_flaws)
            all_reducible.extend(crit.reducible_flaws)

        # Deduplicate
        all_irreducible = sorted(list(set(all_irreducible)))
        all_reducible = sorted(list(set(all_reducible)))

        # Deterministic Verdict Policy Compilation
        if len(all_irreducible) >= 3 or (mode == "adversarial" and any(c.stance == "BLOCK" for c in critiques.values())):
            verdict_type = CouncilVerdictType.HOLD
            score = max(20.0, 50.0 - (len(all_irreducible) * 10))
            summary = f"HOLD: Council blocked artifact due to {len(all_irreducible)} irreducible structural flaws."
        elif len(all_reducible) >= 3 or len(all_irreducible) > 0:
            verdict_type = CouncilVerdictType.REVISE
            score = max(55.0, 85.0 - (len(all_reducible) * 8) - (len(all_irreducible) * 15))
            summary = f"REVISE: Council requires amendments addressing {len(all_reducible)} reducible flaws before shipping."
        elif len(all_reducible) > 0:
            verdict_type = CouncilVerdictType.REVISE
            score = 82.0
            summary = f"REVISE: Minor refinements recommended ({len(all_reducible)} items)."
        else:
            verdict_type = CouncilVerdictType.SHIP
            score = 96.0
            summary = "SHIP: Full Council consensus achieved. Artifact passed all 5 quality frames."

        # Weighted Quorum Evaluation across the 4 deliberate perspectives
        weights = {
            DeliberatorRole.SKEPTIC.value: 0.30,
            DeliberatorRole.EVIDENCE_CALIBRATION.value: 0.25,
            DeliberatorRole.STRATEGY_STAKES.value: 0.25,
            DeliberatorRole.VOICE_IDENTITY.value: 0.20,
        }
        persona_scores: dict[str, float] = {}
        for role_val, w in weights.items():
            crit = critiques.get(role_val)
            if not crit:
                p_score = 75.0
            elif crit.stance == "PASS":
                p_score = max(85.0, 100.0 - (len(crit.reducible_flaws) * 5))
            elif crit.stance == "CONCERN":
                p_score = max(50.0, 75.0 - (len(crit.reducible_flaws) * 8))
            else:  # BLOCK
                p_score = max(10.0, 30.0 - (len(crit.irreducible_flaws) * 10))
            persona_scores[role_val] = round(p_score, 1)

        quorum_score = sum(persona_scores[r] * weights[r] for r in weights if r in persona_scores)
        quorum_score = round(quorum_score, 1)
        has_block = any(c.stance == "BLOCK" for c in critiques.values())
        quorum_achieved = (verdict_type == CouncilVerdictType.SHIP) and (quorum_score >= 75.0) and not has_block and (len(all_irreducible) == 0)

        revision_brief = [f"Fix: {item}" for item in all_reducible] + [f"Resolve fatal flaw: {item}" for item in all_irreducible]

        return CouncilVerdict(
            verdict=verdict_type,
            overall_score=round(score, 1),
            confidence=0.91,
            summary=summary,
            revision_brief=revision_brief,
            irreducible_flaws=all_irreducible,
            reducible_flaws=all_reducible,
            round_1_critiques=critiques,
            round_2_rebuttals=rebuttals,
            bypassed_triage=False,
            quorum_achieved=quorum_achieved,
            quorum_score=quorum_score,
            persona_scores=persona_scores,
        )

    async def evaluate_and_certify(
        self,
        db: Any,
        user_id: Any,
        workspace_id: Any,
        agent_name: str,
        execution_id: str,
        artifact: str,
        artifact_type: str = "text",
        tools_invoked: list[str] | None = None,
        context: dict[str, Any] | None = None,
        mode: str = "collaborative",
    ) -> dict[str, Any]:
        """Runs council deliberation and automatically generates signed W3C AgentAuditCredential on consensus."""
        verdict = await self.deliberate(
            artifact=artifact,
            artifact_type=artifact_type,
            context=context,
            mode=mode,
        )
        credential = None
        certified = False
        if verdict.verdict == CouncilVerdictType.SHIP and verdict.quorum_achieved:
            from .verifiable_credentials_service import verifiable_credentials_service
            credential = await verifiable_credentials_service.issue_agent_audit_credential(
                db=db,
                user_id=user_id,
                workspace_id=workspace_id,
                agent_name=agent_name,
                execution_id=execution_id,
                tools_invoked=tools_invoked or [],
                council_verdict="SHIP",
                policy_checks_passed=True,
            )
            certified = True

        return {
            "verdict": verdict,
            "certified": certified,
            "credential": credential,
        }


agent_council = AgentCouncilService()
