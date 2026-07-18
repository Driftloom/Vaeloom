"""Tests for QA Agent."""
import pytest
from app.agents.qa_agent.handler import QAAgent


@pytest.mark.asyncio
async def test_approves_valid_output():
    qa = QAAgent()
    valid_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.9,
        "result": {"summary": "Generated resume.", "details": {}, "proposals": [], "questions": []},
    }
    result = await qa.validate(valid_output)
    assert result.decision == "approved"
    assert len(result.issues) == 0


@pytest.mark.asyncio
async def test_rejects_missing_fields():
    qa = QAAgent()
    invalid_output = {"agent_name": "resume"}  # Missing action, confidence, result
    result = await qa.validate(invalid_output)
    assert result.decision == "rejected"
    assert any("Missing" in issue for issue in result.issues)


@pytest.mark.asyncio
async def test_rejects_pii_leak():
    qa = QAAgent()
    pii_output = {
        "agent_name": "resume",
        "action": "suggest",
        "confidence": 0.9,
        "result": {"summary": "Your SSN: 123-45-6789", "details": "", "proposals": [], "questions": []},
    }
    result = await qa.validate(pii_output)
    assert result.decision == "rejected"
    assert any("PII" in issue for issue in result.issues)


@pytest.mark.asyncio
async def test_rejects_harmful_content():
    qa = QAAgent()
    harmful_output = {
        "agent_name": "gmail",
        "action": "suggest",
        "confidence": 0.9,
        "result": {"summary": "Here's how to hack into the system", "details": "", "proposals": [], "questions": []},
    }
    result = await qa.validate(harmful_output)
    assert result.decision == "rejected"
    assert any("harmful" in issue.lower() for issue in result.issues)


@pytest.mark.asyncio
async def test_flags_low_confidence():
    qa = QAAgent()
    low_conf = {
        "agent_name": "memory",
        "action": "suggest",
        "confidence": 0.2,
        "result": {"summary": "Maybe this?", "details": "", "proposals": [], "questions": []},
    }
    result = await qa.validate(low_conf)
    assert result.decision == "rejected"
    assert any("confidence" in issue.lower() for issue in result.issues)
