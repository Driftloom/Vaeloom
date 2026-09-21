"""Test Suite: Module 05 Background Processing & Workflows (M05-BG).
Verifies Temporal workflow state transitions, activity execution, and worker resilience.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, patch

from api.temporal.workflows import IngestInput, IngestResult, IngestDocumentWorkflow


@pytest.mark.asyncio
async def test_background_state_transitions():
    """Verify IngestDocumentWorkflow state progression through parsing, extraction, memory, and indexing."""
    wf = IngestDocumentWorkflow()
    assert wf.getStatus()["status"] == "running"
    assert wf.getStatus()["step"] == "queued"

    ws_id = str(uuid.uuid4())
    doc_id = str(uuid.uuid4())
    inp = IngestInput(workspace_id=ws_id, document_id=doc_id, content_hash="hash123")

    mock_parsed = {"parsed_ref": f"parse:{doc_id}:abc", "content_hash": "abc"}
    mock_extracted = {"entities": [{"name": "AI Agent", "type": "concept"}]}
    mock_written = {"memories_created": 1}

    mock_wf = AsyncMock()
    mock_wf.execute_activity.side_effect = [
        {"enabled": True},  # check_kill_switch
        mock_parsed,         # parse_document
        mock_extracted,      # extract_entities
        mock_written,        # write_memory
        {"indexed": True},   # index_graph
        {"recorded": True},  # record_workflow_metric
    ]

    with patch("temporalio.workflow.execute_activity", mock_wf.execute_activity):
        res = await wf.run(inp)
        assert res.status == "completed"
        assert res.document_id == doc_id
        assert res.memories_created == 1
        assert wf.getStatus()["status"] == "completed"
        assert wf.getStatus()["step"] == "completed"


@pytest.mark.asyncio
async def test_background_workflow_kill_switch():
    """Verify workflow terminates immediately if agent kill switch is engaged."""
    wf = IngestDocumentWorkflow()
    inp = IngestInput(workspace_id=str(uuid.uuid4()), document_id=str(uuid.uuid4()), content_hash="hash123")

    mock_wf = AsyncMock()
    mock_wf.execute_activity.side_effect = [
        {"enabled": False},  # check_kill_switch engaged!
    ]

    with patch("temporalio.workflow.execute_activity", mock_wf.execute_activity):
        res = await wf.run(inp)
        assert res.status == "cancelled"
        assert "killed by kill-switch" in (res.error or "")
        assert wf.getStatus()["status"] == "cancelled"
