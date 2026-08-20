"""
LLM response validator — validates LLM outputs for correctness, schema, safety.
"""
import json
import logging
import re
from typing import Any
from pydantic import BaseModel, Field

from api.infrastructure.agent_eval import detect_adversarial_prompt

logger = logging.getLogger(__name__)

INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?previous\s+(instructions|directions|prompts)", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"forget\s+everything", re.IGNORECASE),
    re.compile(r"\[\[SYSTEM\]\]", re.IGNORECASE),
    re.compile(r"<system>", re.IGNORECASE),
    re.compile(r"you\s+are\s+(now\s+)?(a\s+)?(free|unbound|unrestricted)", re.IGNORECASE),
    re.compile(r"(?:your\s+)?new\s+(prompt|instructions)\s*(?:\:|is)", re.IGNORECASE),
]

HARMFUL_PATTERNS: list[re.Pattern] = [
    re.compile(r"\b(kill|murder|suicide|bomb|weapon\s+assembly|terrorist)\b", re.IGNORECASE),
    re.compile(r"\b(how\s+to\s+build\s+a|instructions\s+for\s+making)\s+(bomb|weapon|drug)", re.IGNORECASE),
    re.compile(r"\b(child\s+(porn|exploit|abuse))\b", re.IGNORECASE),
]


class ValidationResult(BaseModel):
    valid: bool = Field(..., description="Whether validation passed")
    errors: list[str] = Field(default_factory=list, description="Validation errors")
    warnings: list[str] = Field(default_factory=list, description="Validation warnings")


class LLMResponseValidator:
    """
    Validates LLM output for correctness, schema compliance, confidence, and safety.
    """

    async def validate(self, output: Any) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []

        # Adversarial prompt detection (enhanced from eval module)
        text = str(output) if not isinstance(output, dict) else output.get("content", str(output))
        adversarial = detect_adversarial_prompt(text)
        for detection in adversarial:
            if detection["severity"] == "critical":
                errors.append(f"Adversarial prompt detected: {detection['category']}")
            else:
                warnings.append(f"Suspicious pattern: {detection['category']}")

        if isinstance(output, str):
            json_errors = self._check_is_json(output)
            errors.extend(json_errors)
        elif isinstance(output, dict):
            self._check_confidence(output, errors, warnings)
            self._check_fields(output, errors, warnings)

        safety_errors = await self.validate_safety(output)
        errors.extend(safety_errors)

        return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    def validate_json(self, output: str) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        try:
            json.loads(output)
        except json.JSONDecodeError as e:
            errors.append(f"Invalid JSON: {e}")
        return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    def validate_schema(self, output: Any, schema: dict[str, Any]) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        if not isinstance(output, dict):
            errors.append("Output must be a dict for schema validation")
            return ValidationResult(valid=False, errors=errors, warnings=warnings)
        required = schema.get("required", [])
        for field in required:
            if field not in output:
                errors.append(f"Missing required field: {field}")
        properties = schema.get("properties", {})
        for key, value in output.items():
            if key in properties:
                expected_type = properties[key].get("type")
                if expected_type and not self._type_matches(value, expected_type):
                    warnings.append(f"Field '{key}' expected type '{expected_type}', got {type(value).__name__}")
        return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    def validate_confidence(self, output: Any, threshold: float = 0.5) -> ValidationResult:
        errors: list[str] = []
        warnings: list[str] = []
        if isinstance(output, dict):
            confidence = output.get("confidence", 1.0)
            if isinstance(confidence, (int, float)):
                if confidence < threshold:
                    errors.append(f"Confidence {confidence:.2f} is below threshold {threshold}")
            else:
                warnings.append("Confidence field is not numeric")
        return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    async def validate_safety(self, output: Any) -> list[str]:
        errors: list[str] = []
        output_str = str(output)
        for pattern in INJECTION_PATTERNS:
            if pattern.search(output_str):
                errors.append(f"Prompt injection detected: matched '{pattern.pattern}'")
        for pattern in HARMFUL_PATTERNS:
            if pattern.search(output_str):
                errors.append(f"Harmful content detected: matched '{pattern.pattern}'")
        return errors

    def validate_safety_sync(self, output: Any) -> list[str]:
        output_str = str(output)
        errors: list[str] = []
        for pattern in INJECTION_PATTERNS:
            if pattern.search(output_str):
                errors.append(f"Prompt injection detected: matched '{pattern.pattern}'")
        for pattern in HARMFUL_PATTERNS:
            if pattern.search(output_str):
                errors.append(f"Harmful content detected: matched '{pattern.pattern}'")
        return errors

    def _check_is_json(self, output: str) -> list[str]:
        try:
            json.loads(output)
            return []
        except json.JSONDecodeError as e:
            return [f"Invalid JSON response: {e}"]

    def _check_confidence(self, output: dict, errors: list[str], warnings: list[str]) -> None:
        confidence = output.get("confidence", 1.0)
        if isinstance(confidence, (int, float)):
            if confidence < 0.5:
                errors.append(f"Low confidence: {confidence:.2f}")
            elif confidence < 0.7:
                warnings.append(f"Moderate confidence: {confidence:.2f}")
        else:
            warnings.append("Non-numeric confidence value")

    def _check_fields(self, output: dict, errors: list[str], warnings: list[str]) -> None:
        if "result" in output and not isinstance(output["result"], dict):
            errors.append("'result' field must be a dict")
        if "action" in output and output["action"] == "error":
            warnings.append("Output indicates an error action")

    def _type_matches(self, value: Any, expected_type: str) -> bool:
        type_map = {
            "string": str,
            "number": (int, float),
            "boolean": bool,
            "array": list,
            "object": dict,
            "integer": int,
        }
        py_type = type_map.get(expected_type)
        if py_type is None:
            return True
        return isinstance(value, py_type)
