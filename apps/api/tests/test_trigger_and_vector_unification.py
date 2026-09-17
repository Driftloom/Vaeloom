"""Tests for Trigger.dev durable execution client and VectorStore polymorphic consolidation."""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.infrastructure.vector_store import (
    FallbackVectorStore,
    VectorRecord,
    get_vector_store,
)
from api.trigger.client import (
    TASK_INGEST_DOCUMENT,
    TriggerClient,
    get_trigger_client,
    is_trigger_enabled,
    trigger_task,
)

pytestmark = pytest.mark.asyncio


# -----------------------------------------------------------------------------
# 1. Trigger.dev Client & Fallback Tests
# -----------------------------------------------------------------------------
async def test_is_trigger_enabled():
    with patch.dict("os.environ", {"TRIGGER_API_KEY": ""}, clear=False):
        assert not is_trigger_enabled()

    with patch.dict("os.environ", {"TRIGGER_API_KEY": "tr_dev_test_123", "BACKGROUND_ENGINE": "auto"}, clear=False):
        assert is_trigger_enabled()

    with patch.dict("os.environ", {"TRIGGER_API_KEY": "tr_dev_test_123", "BACKGROUND_ENGINE": "bullmq"}, clear=False):
        assert not is_trigger_enabled()


async def test_trigger_client_fallback_when_disabled():
    client = TriggerClient(api_key="")
    assert not client.enabled

    result = await client.trigger(
        task_name=TASK_INGEST_DOCUMENT,
        payload={"document_id": "doc-123", "workspace_id": "ws-456"},
    )
    assert result["status"] in ("enqueued", "accepted_inline")
    assert result["provider"] in ("native_redis", "inline_fallback")
    assert result["task"] == TASK_INGEST_DOCUMENT
    assert "run_id" in result


async def test_trigger_client_dispatch_when_enabled():
    client = TriggerClient(
        api_key="tr_dev_valid_token",
        api_url="https://api.trigger.dev",
        project_id="proj_xyz",
    )
    assert client.enabled

    mock_resp = MagicMock()
    mock_resp.is_success = True
    mock_resp.json.return_value = {"id": "run_9999", "status": "PENDING"}

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_post.return_value = mock_resp

        result = await client.trigger(
            task_name=TASK_INGEST_DOCUMENT,
            payload={"document_id": "doc-123"},
        )

        assert result["status"] == "dispatched"
        assert result["provider"] == "trigger.dev"
        assert result["run_id"] == "run_9999"
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        assert "tasks/vaeloom.ingest-document/trigger" in args[0]
        assert kwargs["headers"]["Authorization"] == "Bearer tr_dev_valid_token"


async def test_trigger_task_convenience_helper():
    with patch("api.trigger.client.get_trigger_client") as mock_get_client:
        mock_instance = MagicMock()
        mock_instance.trigger = AsyncMock(return_value={"status": "ok", "run_id": "r1"})
        mock_get_client.return_value = mock_instance

        res = await trigger_task("my.task", {"key": "val"})
        assert res["status"] == "ok"
        mock_instance.trigger.assert_called_once_with("my.task", {"key": "val"}, options=None)


# -----------------------------------------------------------------------------
# 2. VectorStore Polymorphic Consolidation Tests
# -----------------------------------------------------------------------------
async def test_get_vector_store_polymorphic_fallback_in_test():
    with patch.dict("os.environ", {"VECTOR_STORE": "fallback"}):
        vstore = get_vector_store()
        assert isinstance(vstore, FallbackVectorStore)


async def test_polymorphic_vector_store_operations():
    vstore = FallbackVectorStore()

    # Verify upsert accepts session parameter without error (kwargs compatibility)
    rec1 = VectorRecord(id="m1", vector=[1.0, 0.0], metadata={"workspace_id": "w1", "source_type": "memory"})
    rec2 = VectorRecord(id="m2", vector=[0.0, 1.0], metadata={"workspace_id": "w1", "source_type": "memory"})

    dummy_session = MagicMock()
    await vstore.upsert([rec1, rec2], session=dummy_session)

    # Search with session parameter
    results = await vstore.search([0.95, 0.05], limit=2, filters={"workspace_id": "w1"}, session=dummy_session)
    assert len(results) == 2
    assert results[0].id == "m1"

    # Delete with session parameter
    await vstore.delete(["m1"], session=dummy_session)
    remaining = await vstore.search([1.0, 0.0], limit=5, session=dummy_session)
    assert len(remaining) == 1
    assert remaining[0].id == "m2"
