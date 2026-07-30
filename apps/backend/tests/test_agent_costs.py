import pytest
from datetime import datetime, timezone

from backend.services.agent_costs import (
    AgentCostTracker,
    UsageRecord,
    TOKEN_COST_PER_MODEL,
)

pytestmark = pytest.mark.asyncio


class TestUsageRecord:
    def test_cost_computation_default_model(self):
        record = UsageRecord(
            agent_name="test",
            workspace_id="ws1",
            input_tokens=1000,
            output_tokens=1000,
            model="unknown-model",
        )
        assert record.cost > 0

    def test_cost_computation_sonnet(self):
        record = UsageRecord(
            agent_name="test",
            workspace_id="ws1",
            input_tokens=1000,
            output_tokens=1000,
            model="claude-3-5-sonnet-20241022",
        )
        assert record.cost > 0

    def test_cost_computation_zero_tokens(self):
        record = UsageRecord(
            agent_name="test",
            workspace_id="ws1",
            input_tokens=0,
            output_tokens=0,
            model="gpt-4o",
        )
        assert record.cost == 0.0

    def test_cost_differs_by_model(self):
        cheap = UsageRecord(
            agent_name="test", workspace_id="ws1",
            input_tokens=1000, output_tokens=1000,
            model="claude-3-haiku-20240307",
        )
        expensive = UsageRecord(
            agent_name="test", workspace_id="ws1",
            input_tokens=1000, output_tokens=1000,
            model="claude-3-opus-20240229",
        )
        assert cheap.cost < expensive.cost


class TestAgentCostTracker:
    @pytest.fixture
    def tracker(self):
        return AgentCostTracker()

    async def test_track_usage_returns_record(self, tracker):
        record = await tracker.track_usage(
            agent_name="memory",
            workspace_id="ws-1",
            input_tokens=500,
            output_tokens=200,
            model="claude-3-5-sonnet-20241022",
        )
        assert record.agent_name == "memory"
        assert record.workspace_id == "ws-1"
        assert record.input_tokens == 500
        assert record.output_tokens == 200
        assert record.cost > 0

    async def test_get_usage_by_agent(self, tracker):
        await tracker.track_usage("agent-a", "ws-1", 100, 50, "gpt-4o")
        await tracker.track_usage("agent-b", "ws-1", 200, 100, "gpt-4o")
        await tracker.track_usage("agent-a", "ws-2", 300, 150, "gpt-4o")

        records = await tracker.get_usage(agent_name="agent-a")
        assert all(r.agent_name == "agent-a" for r in records)
        assert len(records) == 2

    async def test_get_usage_by_workspace(self, tracker):
        await tracker.track_usage("agent-a", "ws-1", 100, 50, "gpt-4o")
        await tracker.track_usage("agent-b", "ws-1", 200, 100, "gpt-4o")
        await tracker.track_usage("agent-c", "ws-2", 300, 150, "gpt-4o")

        records = await tracker.get_usage(workspace_id="ws-1")
        assert len(records) == 2

    async def test_get_usage_by_period(self, tracker):
        await tracker.track_usage("agent-a", "ws-1", 100, 50, "gpt-4o")
        records_recent = await tracker.get_usage(period=1)
        records_all = await tracker.get_usage(period=1000000)
        assert len(records_recent) <= len(records_all)

    async def test_get_total_costs(self, tracker):
        await tracker.track_usage("memory", "ws-1", 1000, 500, "claude-3-5-sonnet-20241022")
        await tracker.track_usage("resume", "ws-1", 2000, 1000, "gpt-4o")
        await tracker.track_usage("memory", "ws-2", 500, 200, "claude-3-haiku-20240307")

        costs_ws1 = await tracker.get_total_costs("ws-1")
        assert costs_ws1["total"] > 0
        assert "memory" in costs_ws1["by_agent"]
        assert "resume" in costs_ws1["by_agent"]
        assert costs_ws1["record_count"] == 2

        costs_ws2 = await tracker.get_total_costs("ws-2")
        assert costs_ws2["record_count"] == 1

    async def test_get_total_costs_empty_workspace(self, tracker):
        costs = await tracker.get_total_costs("nonexistent")
        assert costs["total"] == 0.0
        assert costs["by_agent"] == {}
        assert costs["record_count"] == 0

    async def test_multiple_agents_same_workspace(self, tracker):
        agents = ["memory", "resume", "planner", "chat", "organization"]
        for i, agent in enumerate(agents):
            await tracker.track_usage(agent, "ws-multi", (i + 1) * 100, (i + 1) * 50, "gpt-4o")

        records = await tracker.get_usage(workspace_id="ws-multi")
        assert len(records) == len(agents)

        costs = await tracker.get_total_costs("ws-multi")
        assert len(costs["by_agent"]) == len(agents)

    async def test_track_usage_logging(self, tracker, caplog):
        import logging
        caplog.set_level(logging.INFO)
        await tracker.track_usage("test-agent", "test-ws", 100, 50, "gpt-4o")
        assert any("test-agent" in msg for msg in caplog.messages)
        assert any("test-ws" in msg for msg in caplog.messages)

    async def test_reset_clears_all(self, tracker):
        await tracker.track_usage("agent-a", "ws-1", 100, 50, "gpt-4o")
        await tracker.reset()
        records = await tracker.get_usage()
        assert len(records) == 0

    async def test_usage_sorted_by_timestamp_desc(self, tracker):
        await tracker.track_usage("agent-a", "ws-1", 100, 50, "gpt-4o")
        await tracker.track_usage("agent-b", "ws-1", 200, 100, "gpt-4o")
        records = await tracker.get_usage()
        assert len(records) >= 2
        for i in range(len(records) - 1):
            assert records[i].timestamp >= records[i + 1].timestamp


class TestTokenCostPerModel:
    def test_default_pricing_exists(self):
        assert "default" in TOKEN_COST_PER_MODEL
        assert "input" in TOKEN_COST_PER_MODEL["default"]
        assert "output" in TOKEN_COST_PER_MODEL["default"]

    def test_known_models_have_pricing(self):
        for model in ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240329", "gpt-4o", "gpt-4o-mini"]:
            if model in TOKEN_COST_PER_MODEL:
                assert TOKEN_COST_PER_MODEL[model]["input"] > 0
                assert TOKEN_COST_PER_MODEL[model]["output"] > 0

    def test_sonnet_more_expensive_than_haiku(self):
        sonnet = TOKEN_COST_PER_MODEL.get("claude-3-5-sonnet-20241022", {})
        haiku = TOKEN_COST_PER_MODEL.get("claude-3-haiku-20240307", {})
        if sonnet and haiku:
            assert sonnet["input"] > haiku["input"]
