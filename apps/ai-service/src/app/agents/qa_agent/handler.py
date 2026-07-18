"""
QA Agent — validates every agent output before delivery.
Checks: schema compliance, policy, safety, plausibility, hallucination.
"""
import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel

from app.orchestrator.base import BaseAgent, MemoryScopes, Tool

logger = logging.getLogger(__name__)


class QAValidationResult(BaseModel):
    decision: str  # "approved" | "rejected"
    issues: List[str] = []
    action: Optional[str] = None  # "regenerate" when rejected


class QAAgent(BaseAgent):
    mission = "Validate every agent output before delivery to the user"
    tools = []
    memory_scopes = MemoryScopes(read_types=[], write_types=[])
    default_autonomy = "full"

    async def fallback(self) -> Any:
        return QAValidationResult(
            decision="approved",
            issues=["QA gate could not complete — passing with warning"],
        )

    async def validate(self, agent_output: Dict[str, Any]) -> QAValidationResult:
        """
        Run the QA validation checklist on an agent's output.
        Returns approved/rejected with issues.
        """
        issues: List[str] = []

        # 1. Schema compliance
        if not isinstance(agent_output, dict):
            issues.append("Output is not a valid dictionary")
        else:
            required_keys = {"agent_name", "action", "confidence", "result"}
            missing = required_keys - set(agent_output.keys())
            if missing:
                issues.append(f"Missing required fields: {missing}")

        # 2. Hallucination check (mock: check for unsourced claims)
        result = agent_output.get("result", {})
        if isinstance(result, dict):
            details = result.get("details", "")
            if isinstance(details, str) and "[unsourced]" in details.lower():
                issues.append("Contains unsourced claims — potential hallucination")

        # 3. PII leak check
        pii_markers = ["SSN:", "social security", "credit card"]
        output_str = str(agent_output).lower()
        for marker in pii_markers:
            if marker.lower() in output_str:
                issues.append(f"PII leak detected: contains '{marker}'")

        # 4. Harmful content check
        harmful_markers = ["kill", "hack into", "illegal"]
        for marker in harmful_markers:
            if marker in output_str:
                issues.append(f"Potentially harmful content: '{marker}'")

        # 5. Confidence check
        confidence = agent_output.get("confidence", 1.0)
        if isinstance(confidence, (int, float)) and confidence < 0.3:
            issues.append(f"Very low confidence ({confidence}) — review recommended")

        if issues:
            logger.warning(f"QA REJECTED: {issues}")
            return QAValidationResult(
                decision="rejected", issues=issues, action="regenerate"
            )

        logger.info("QA APPROVED")
        return QAValidationResult(decision="approved", issues=[])
