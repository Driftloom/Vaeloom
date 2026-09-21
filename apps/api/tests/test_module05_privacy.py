"""Test Suite: Module 05 Privacy, Redaction & Secret Scrubbing (M05-PRIV).
Verifies secret scrubbing, PII redaction, payload size restrictions, and fail-closed validation.
"""
import pytest
from api.logging import _redact
from api.temporal.validation import validate_no_secrets, validate_payload_size


def test_secret_scrubbing_in_payloads():
    """Verify sensitive authentication keys are redacted from logs and payloads."""
    raw_payload = {
        "workspace_id": "ws-123",
        "document_name": "quarterly_review.pdf",
        "api_key": "sk-live-1234567890abcdef",
        "nested": {
            "password": "SuperSecretPassword123!",
            "public_field": "hello-world",
        },
    }

    redacted = _redact(raw_payload)
    assert redacted["api_key"] == "[REDACTED]"
    assert redacted["nested"]["password"] == "[REDACTED]"
    assert redacted["nested"]["public_field"] == "hello-world"


def test_fail_closed_secret_rejection():
    """Verify validate_no_secrets raises ValueError if unscrubbed credentials are sent to background workflows."""
    leaked_payload = {
        "access_token": "bearer eyJhbGciOi...",
        "workspace_id": "ws-test",
    }
    with pytest.raises(ValueError) as exc:
        validate_no_secrets(leaked_payload)
    assert "access_token" in str(exc.value)


def test_payload_size_enforcement():
    """Verify oversized payloads exceed 20KB budget and are rejected fail-closed."""
    safe_payload = {"key": "x" * 100}
    validate_payload_size(safe_payload, limit_bytes=20 * 1024, label="test")

    oversized_payload = {"bloat": "x" * (25 * 1024)}
    with pytest.raises(ValueError) as exc:
        validate_payload_size(oversized_payload, limit_bytes=20 * 1024, label="test")
    assert "exceeds" in str(exc.value)
