"""
QA Agent — mandatory validation gate for all agent outputs.
Checks schema compliance, hallucination risk, confidence threshold, safety.
"""
import json
import logging
import re
from typing import Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class QAResult(BaseModel):
    passed: bool = Field(..., description="Whether the output passed QA")
    score: float = Field(..., ge=0.0, le=1.0, description="Quality score 0.0-1.0")
    issues: list[str] = Field(default_factory=list, description="List of issues found")
    suggestions: list[str] = Field(default_factory=list, description="Improvement suggestions")


class QAAgent:
    """
    Validates agent outputs before delivery to the user.
    Registered as mandatory middleware in the agent orchestrator.
    """

    MIN_CONFIDENCE = 0.5
    REQUIRED_KEYS = {"agent_name", "action", "confidence", "result"}
    RESULT_KEYS = {"summary", "details", "proposals", "questions"}

    HALLUCINATION_PATTERNS: list[re.Pattern] = [
        re.compile(r"\[unsourced\]", re.IGNORECASE),
        re.compile(r"I (don't|do not) have (access|information|data) on", re.IGNORECASE),
        re.compile(r"based on (limited|insufficient) (information|data)", re.IGNORECASE),
    ]

    PII_PATTERNS: list[re.Pattern] = [
        re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
        re.compile(r"\b(?:SSN|Social Security)[:\s]*\d{3}[- ]?\d{2}[- ]?\d{4}\b", re.IGNORECASE),
        re.compile(r"\bcredit card[:\s]*\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b", re.IGNORECASE),
    ]

    HAZARD_PATTERNS: list[re.Pattern] = [
        re.compile(r"\b(kill|hack into|illegal|terrorist|bomb|weapon)\b", re.IGNORECASE),
    ]

    async def validate_output(self, agent_name: str, input_data: Any, output_data: dict[str, Any]) -> QAResult:
        issues: list[str] = []
        suggestions: list[str] = []

        self._check_schema_compliance(output_data, issues, suggestions)
        self._check_result_structure(output_data, issues, suggestions)
        self._check_confidence_threshold(output_data, issues, suggestions)
        self._check_hallucination(output_data, issues, suggestions)
        self._check_pii(output_data, issues, suggestions)
        self._check_harmful_content(output_data, issues, suggestions)
        self._check_schema_match(input_data, output_data, issues, suggestions)

        score = self._compute_score(issues, len(issues))

        passed = len(issues) == 0

        if issues:
            logger.warning(
                "QA validation for agent '%s': %d issues, score=%.2f, passed=%s",
                agent_name, len(issues), score, passed,
            )

        return QAResult(passed=passed, score=score, issues=issues, suggestions=suggestions)

    def _check_schema_compliance(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        if not isinstance(output, dict):
            issues.append("Output is not a valid dictionary")
            suggestions.append("Agent must return a dictionary with agent_name, action, confidence, result")
            return
        missing = self.REQUIRED_KEYS - set(output.keys())
        if missing:
            issues.append(f"Missing required fields: {missing}")
            suggestions.append(f"Add missing fields: {missing}")

    def _check_result_structure(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        if not isinstance(output, dict):
            return
        result = output.get("result")
        if not isinstance(result, dict):
            return
        missing = self.RESULT_KEYS - set(result.keys())
        if missing:
            issues.append(f"Result missing expected keys: {missing}")
            suggestions.append(f"Include result keys: {missing}")

    def _check_confidence_threshold(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        if not isinstance(output, dict):
            return
        confidence = output.get("confidence", 1.0)
        if isinstance(confidence, (int, float)):
            if confidence < self.MIN_CONFIDENCE:
                issues.append(f"Confidence {confidence:.2f} is below threshold {self.MIN_CONFIDENCE}")
                suggestions.append("Improve agent certainty or reduce ambiguity in output")
            elif confidence < 0.7:
                issues.append(f"Confidence {confidence:.2f} is moderate — review recommended")
                suggestions.append("Consider gathering more evidence before responding")

    def _check_hallucination(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        output_str = json.dumps(output)
        for pattern in self.HALLUCINATION_PATTERNS:
            if pattern.search(output_str):
                issues.append(f"Potential hallucination detected: matches '{pattern.pattern}'")
                suggestions.append("Verify unsourced claims against known data")
                break

        result = output.get("result", {}) if isinstance(output, dict) else {}
        if isinstance(result, dict):
            details = result.get("details", "")
            if isinstance(details, str):
                fact_claims = re.findall(r"(?:\d{1,3}[,]\d{3}|\d+%)", details)
                if len(fact_claims) > 3:
                    suggestions.append("Verify numerical claims for accuracy")

    def _check_pii(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        output_str = json.dumps(output)
        for pattern in self.PII_PATTERNS:
            match = pattern.search(output_str)
            if match:
                issues.append(f"Potential PII leak: matched '{pattern.pattern}'")
                suggestions.append("Redact or anonymize personally identifiable information")

    def _check_harmful_content(self, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        output_str = json.dumps(output).lower()
        for pattern in self.HAZARD_PATTERNS:
            if pattern.search(output_str):
                issues.append(f"Harmful content flagged: matched '{pattern.pattern}'")
                suggestions.append("Review content for safety compliance")

    def _check_schema_match(self, input_data: Any, output: dict[str, Any], issues: list[str], suggestions: list[str]) -> None:
        if not isinstance(output, dict):
            return
        result = output.get("result", {})
        if not isinstance(result, dict):
            return
        if input_data and isinstance(input_data, dict):
            summary = result.get("summary", "")
            input_keys = set(input_data.keys())
            if input_keys and len(input_keys) > 1:
                key_overlap = sum(1 for k in input_keys if k.lower() in summary.lower())
                if key_overlap == 0 and len(summary) > 0:
                    suggestions.append("Output summary does not reference any input context")

    def _compute_score(self, issues: list[str], issue_count: int) -> float:
        if issue_count == 0:
            return 1.0
        penalty = min(issue_count * 0.15, 0.9)
        return round(max(0.1, 1.0 - penalty), 2)
