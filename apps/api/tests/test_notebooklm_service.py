"""
Unit tests for NotebookLM Service and Agent Tool.
"""
from unittest.mock import AsyncMock, patch
import pytest

from api.services.notebooklm_service import (
    PIOS_NOTEBOOK_ID,
    NotebookLMService,
    notebooklm_service,
)
from api.tools.definitions import QUERY_NOTEBOOKLM
from api.tools.executor import execute_tool


@pytest.mark.asyncio
async def test_notebooklm_service_query_success():
    service = NotebookLMService()

    mock_json_output = (
        '{"answer": "PIOS is an always-on cognitive operating system.", '
        '"citations": [{"source_id": "src-1", "score": 0.99}], '
        '"conversation_id": "conv-123"}'
    )

    with patch("asyncio.create_subprocess_exec") as mock_exec:
        proc_mock = AsyncMock()
        proc_mock.returncode = 0
        proc_mock.communicate.return_value = (mock_json_output.encode("utf-8"), b"")
        mock_exec.return_value = proc_mock

        result = await service.query(prompt="Explain PIOS")
        assert result["success"] is True
        assert result["notebook_id"] == PIOS_NOTEBOOK_ID
        assert "cognitive operating system" in result["answer"]
        assert len(result["citations"]) == 1


@pytest.mark.asyncio
async def test_notebooklm_service_query_timeout():
    service = NotebookLMService()

    with patch("asyncio.create_subprocess_exec") as mock_exec:
        proc_mock = AsyncMock()
        proc_mock.communicate.side_effect = TimeoutError()
        mock_exec.return_value = proc_mock

        result = await service.query(prompt="Explain PIOS", timeout=0.01)
        assert result["success"] is False
        assert "timed out" in result["error"].lower()


@pytest.mark.asyncio
async def test_agent_tool_executor_query_notebooklm():
    mock_res = {
        "success": True,
        "notebook_id": PIOS_NOTEBOOK_ID,
        "answer": "Digital Twin is the core self-model in PIOS.",
        "citations": [{"source_id": "s-1"}],
    }

    with patch.object(notebooklm_service, "query", AsyncMock(return_value=mock_res)):
        res = await execute_tool(
            tool=QUERY_NOTEBOOKLM,
            params={"prompt": "What is Digital Twin?"},
            agent_id="test-agent",
            agent_scopes=["connector.read"],
            workspace_id="00000000-0000-0000-0000-000000000001",
        )

        assert res["status"] == "success"
        assert res["tool"] == "query_notebooklm"
        assert "Digital Twin" in res["result"]["answer"]
        assert res["result"]["notebook_id"] == PIOS_NOTEBOOK_ID
