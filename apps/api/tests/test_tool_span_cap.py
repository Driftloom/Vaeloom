"""Total span cap on execute_tool (Loop 4): retries can never push one tool
call past TOOL_MAX_SPAN_S, so a single call cannot eat the run budget."""
import time
import uuid

import pytest

from api.tools.definitions import ToolDefinition
from api.tools.executor import TOOL_DISPATCH, ToolExecutionError, _capped_backoff, execute_tool

pytestmark = pytest.mark.asyncio

WS_ID = str(uuid.uuid4())


class TestCappedBackoff:
    def test_no_clamp_when_time_remains(self):
        assert _capped_backoff(2.0, time.monotonic()) == 2.0

    def test_clamped_to_remaining_span(self, monkeypatch):
        import api.tools.executor as ex

        monkeypatch.setattr(ex, "TOOL_MAX_SPAN_S", 10.0)
        assert _capped_backoff(8.0, time.monotonic() - 9.5) == pytest.approx(0.5, abs=0.05)

    def test_never_negative(self, monkeypatch):
        import api.tools.executor as ex

        monkeypatch.setattr(ex, "TOOL_MAX_SPAN_S", 10.0)
        assert _capped_backoff(8.0, time.monotonic() - 60.0) == 0.0


class TestSpanCap:
    async def test_retries_abort_at_span(self, monkeypatch):
        import api.tools.executor as ex

        async def mock_check(*a):
            return True

        monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
        monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

        calls = 0

        async def failing_handler(params, ws_id):
            nonlocal calls
            calls += 1
            raise TimeoutError("slow backend")

        monkeypatch.setitem(TOOL_DISPATCH, "span_tool", failing_handler)
        monkeypatch.setattr(ex, "TOOL_MAX_SPAN_S", 0.4)

        tool = ToolDefinition(
            name="span_tool", description="", input_schema={}, output_schema={},
            required_scope="x", category="connector_read",
        )
        start = time.monotonic()
        with pytest.raises(ToolExecutionError, match="exceeded"):
            await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
        elapsed = time.monotonic() - start
        # 3 attempts x 5s connector timeout would take 15s+; the cap stops it fast.
        assert elapsed < 5.0
        assert calls < 3

    async def test_success_inside_span_unaffected(self, monkeypatch):
        async def mock_check(*a):
            return True

        monkeypatch.setattr("api.tools.executor.check_permission", mock_check)
        monkeypatch.setattr("api.tools.executor._audit_log", lambda *a: None)

        async def ok_handler(params, ws_id):
            return {"status": "success", "tool": "ok_tool", "result": "ok"}

        monkeypatch.setitem(TOOL_DISPATCH, "ok_tool", ok_handler)
        tool = ToolDefinition(
            name="ok_tool", description="", input_schema={}, output_schema={},
            required_scope="x", category="system",
        )
        result = await execute_tool(tool, {}, "agent-1", ["x"], WS_ID)
        assert result["status"] == "success"
