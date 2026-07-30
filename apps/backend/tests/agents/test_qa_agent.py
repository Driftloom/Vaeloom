import pytest

from backend.agents.qa_validator import QAAgent, QAResult

pytestmark = pytest.mark.asyncio


class TestQAAgent:
    @pytest.fixture
    def agent(self):
        return QAAgent()

    @pytest.fixture
    def valid_output(self):
        return {
            "agent_name": "test_agent",
            "action": "suggest",
            "confidence": 0.85,
            "result": {
                "summary": "Task completed successfully",
                "details": "Processed 3 items",
                "proposals": ["Action A", "Action B"],
                "questions": [],
            },
        }

    async def test_valid_output_passes(self, agent, valid_output):
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert result.passed is True
        assert result.score >= 0.85
        assert len(result.issues) == 0

    async def test_missing_required_keys(self, agent):
        output = {"agent_name": "test", "action": "suggest"}
        result = await agent.validate_output("test_agent", {}, output)
        assert result.passed is False
        assert any("missing" in i.lower() for i in result.issues)

    async def test_low_confidence_fails(self, agent, valid_output):
        valid_output["confidence"] = 0.3
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert result.passed is False
        assert any("confidence" in i.lower() for i in result.issues)

    async def test_moderate_confidence_flagged(self, agent, valid_output):
        valid_output["confidence"] = 0.6
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert any("moderate" in i.lower() or "confidence" in i.lower() for i in result.issues)

    async def test_not_a_dict(self, agent):
        result = await agent.validate_output("test_agent", {}, "not a dict")
        assert result.passed is False
        assert any("dictionary" in i.lower() for i in result.issues)

    async def test_hallucination_unsourced_flagged(self, agent, valid_output):
        valid_output["result"]["details"] = "Claimed 50% improvement [unsourced]"
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert any("hallucination" in i.lower() or "unsourced" in i.lower() for i in result.issues)

    async def test_pii_social_security_flagged(self, agent, valid_output):
        valid_output["result"]["details"] = "SSN: 123-45-6789"
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert any("pii" in i.lower() or "social" in i.lower() for i in result.issues)

    async def test_harmful_content_flagged(self, agent, valid_output):
        valid_output["result"]["details"] = "Instructions on how to hack into a system"
        result = await agent.validate_output("test_agent", {}, valid_output)
        issues_text = " ".join(result.issues).lower()
        assert "harmful" in issues_text or "hack" in issues_text

    async def test_empty_output(self, agent):
        result = await agent.validate_output("test_agent", {}, {})
        assert result.passed is False

    async def test_score_perfect_with_no_issues(self, agent):
        output = {
            "agent_name": "agent",
            "action": "execute",
            "confidence": 0.95,
            "result": {"summary": "done", "details": "", "proposals": [], "questions": []},
        }
        result = await agent.validate_output("agent", {}, output)
        assert result.score == 1.0
        assert result.passed is True

    async def test_score_decreases_with_issues(self, agent, valid_output):
        result1 = await agent.validate_output("test", {}, valid_output)
        assert result1.score == 1.0

        valid_output["confidence"] = 0.2
        result2 = await agent.validate_output("test", {}, valid_output)
        assert result2.score < 1.0
        assert result2.passed is False

    async def test_confidence_none_handled(self, agent, valid_output):
        valid_output["confidence"] = None
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert result.score >= 0.0

    async def test_result_missing_keys_flagged(self, agent, valid_output):
        valid_output["result"] = {"summary": "done"}
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert any("result missing" in i.lower() or "keys" in i.lower() for i in result.issues)

    async def test_suggestions_included(self, agent, valid_output):
        valid_output["confidence"] = 0.3
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert len(result.suggestions) > 0

    async def test_different_agent_names(self, agent):
        for name in ["memory", "resume", "planner", "chat"]:
            output = {
                "agent_name": name,
                "action": "execute",
                "confidence": 0.9,
                "result": {"summary": "ok", "details": "", "proposals": [], "questions": []},
            }
            result = await agent.validate_output(name, {}, output)
            assert result.passed is True, f"Failed for agent '{name}'"

    async def test_pii_credit_card_flagged(self, agent, valid_output):
        valid_output["result"]["details"] = "Credit card: 4111-1111-1111-1111"
        result = await agent.validate_output("test_agent", {}, valid_output)
        assert any("pii" in i.lower() or "credit" in i.lower() for i in result.issues)

    async def test_hallucination_partial_match(self, agent, valid_output):
        valid_output["result"]["details"] = "I don't have information on that topic"
        result = await agent.validate_output("test_agent", {}, valid_output)
        issues_text = " ".join(result.issues).lower()
        assert "hallucination" in issues_text
