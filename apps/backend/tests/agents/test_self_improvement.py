import pytest

pytestmark = pytest.mark.asyncio


class TestSelfImprovementAgent:
    async def _agent(self):
        from backend.agents.memory.self_improvement_agent import SelfImprovementAgent
        agent = SelfImprovementAgent()
        return agent

    async def test_fallback(self):
        agent = await self._agent()
        result = await agent.fallback()

        assert result["agent_name"] == "self_improvement"
        assert result["action"] == "ask_clarification"
        assert result["confidence"] == 0.0
        assert "questions" in result["result"]

    async def test_log_accuracy(self):
        agent = await self._agent()
        result = await agent.log_accuracy(
            extraction_type="skill",
            expected="Python",
            actual="Python",
            correct=True,
        )

        assert result["agent_name"] == "self_improvement"
        assert result["action"] == "log"
        assert result["result"]["details"]["correct"] is True
        assert result["result"]["details"]["extraction_type"] == "skill"

    async def test_log_accuracy_incorrect(self):
        agent = await self._agent()
        result = await agent.log_accuracy(
            extraction_type="person",
            expected="John Doe",
            actual="Jane Doe",
            correct=False,
        )

        assert result["result"]["details"]["correct"] is False

    async def test_adjust_confidence_sufficient_samples(self):
        agent = await self._agent()
        result = await agent.adjust_confidence(
            memory_type="skill",
            recent_accuracy=0.95,
            sample_size=50,
        )

        assert result["agent_name"] == "self_improvement"
        assert result["action"] == "adjust_confidence"
        details = result["result"]["details"]
        assert details["memory_type"] == "skill"
        assert details["recent_accuracy"] == 0.95
        assert details["sample_size"] == 50
        assert details["adjustment_factor"] > 0

    async def test_adjust_confidence_insufficient_samples(self):
        agent = await self._agent()
        result = await agent.adjust_confidence(
            memory_type="skill",
            recent_accuracy=0.5,
            sample_size=5,
        )

        details = result["result"]["details"]
        assert details["adjustment_factor"] == 0.0

    async def test_adjust_confidence_low_accuracy(self):
        agent = await self._agent()
        result = await agent.adjust_confidence(
            memory_type="entity",
            recent_accuracy=0.6,
            sample_size=100,
        )

        details = result["result"]["details"]
        assert details["adjustment_factor"] < 0

    async def test_adjust_confidence_high_accuracy(self):
        agent = await self._agent()
        result = await agent.adjust_confidence(
            memory_type="entity",
            recent_accuracy=0.98,
            sample_size=200,
        )

        details = result["result"]["details"]
        assert details["adjustment_factor"] > 0

    async def test_process_feedback(self):
        agent = await self._agent()
        result = await agent.process_feedback(
            feedback_text="The skill extraction missed my Python experience",
            memory_type="skill",
        )

        assert result["agent_name"] == "self_improvement"
        assert result["action"] == "analyze_feedback"
        assert "result" in result

    async def test_process_feedback_no_type(self):
        agent = await self._agent()
        result = await agent.process_feedback("Great extraction quality!")

        assert result["agent_name"] == "self_improvement"
        assert result["action"] == "analyze_feedback"
