import asyncio
import os

import pytest

from backend.infrastructure.agent_timeout import (
    AgentTimeout,
    AgentTimeoutError,
    timeout_for,
    with_timeout,
    get_timeout_seconds,
)

pytestmark = pytest.mark.asyncio


class TestAgentTimeoutDefaults:
    def test_default_timeout(self):
        assert get_timeout_seconds() == 120

    def test_default_timeout_from_env(self, monkeypatch):
        monkeypatch.setenv("AGENT_TIMEOUT_SECONDS", "60")
        assert get_timeout_seconds() == 60

    def test_timeout_for_known_agent(self):
        assert timeout_for("memory") == 300
        assert timeout_for("chat") == 60
        assert timeout_for("resume") == 180

    def test_timeout_for_unknown_agent(self):
        assert timeout_for("unknown") == get_timeout_seconds()

    def test_timeout_for_qa(self):
        assert timeout_for("qa") == 30


class TestAgentTimeout:
    async def test_execute_completes_within_timeout(self):
        timeout = AgentTimeout("test_agent", timeout=60)
        result = await timeout.execute(asyncio.sleep(0.01))
        assert result is None
        assert timeout.timed_out is False

    async def test_execute_returns_result(self):
        timeout = AgentTimeout("test_agent", timeout=60)

        async def work():
            return "done"

        result = await timeout.execute(work())
        assert result == "done"

    async def test_execute_times_out(self):
        timeout = AgentTimeout("test_agent", timeout=0.05)
        result = await timeout.execute(asyncio.sleep(10), partial_on_timeout="partial")
        assert result == "partial"
        assert timeout.timed_out is True

    async def test_context_manager_success(self):
        timeout = AgentTimeout("test_agent", timeout=60)
        async with timeout.run() as t:
            result = await asyncio.sleep(0.01)
        assert t.timed_out is False

    async def test_partial_result_on_timeout(self):
        timeout = AgentTimeout("test_agent", timeout=0.05)
        partial = {"partial": True, "data": "incomplete"}
        result = await timeout.execute(asyncio.sleep(10), partial_on_timeout=partial)
        assert result == partial
        assert timeout.partial_result == partial

    async def test_no_partial_result_if_completes(self):
        timeout = AgentTimeout("test_agent", timeout=60)
        await timeout.execute(asyncio.sleep(0.01))
        assert timeout.partial_result is None
        assert timeout.timed_out is False

    async def test_agent_name_in_logs(self, caplog):
        import logging
        caplog.set_level(logging.WARNING)
        timeout = AgentTimeout("my_special_agent", timeout=0.05)
        await timeout.execute(asyncio.sleep(10), partial_on_timeout=None)
        assert any("my_special_agent" in msg for msg in caplog.messages)

    async def test_very_low_timeout(self):
        timeout = AgentTimeout("fast_agent", timeout=0.01)
        result = await timeout.execute(asyncio.sleep(10), partial_on_timeout="timed_out")
        assert result == "timed_out"
        assert timeout.timed_out is True


class TestWithTimeout:
    async def test_with_timeout_success(self):
        result = await with_timeout("test_agent", asyncio.sleep(0.01))
        assert result is None

    async def test_with_timeout_returns_value(self):
        async def work():
            return "value"

        result = await with_timeout("test_agent", work())
        assert result == "value"

    async def test_with_timeout_partial_on_exceed(self):
        result = await with_timeout(
            "test_agent",
            asyncio.sleep(10),
            timeout=0.05,
            partial_on_timeout="partial_result",
        )
        assert result == "partial_result"

    async def test_with_timeout_custom_timeout(self):
        result = await with_timeout("test_agent", asyncio.sleep(0.01), timeout=30)
        assert result is None

    async def test_with_timeout_raises_on_bad_coro(self):
        with pytest.raises(RuntimeError):
            async def fail():
                raise RuntimeError("boom")
            await with_timeout("test_agent", fail())


class TestAgentTimeoutError:
    def test_error_message(self):
        err = AgentTimeoutError("test_agent", 120)
        assert "test_agent" in str(err)
        assert "120" in str(err)
        assert err.agent_name == "test_agent"
        assert err.timeout == 120
