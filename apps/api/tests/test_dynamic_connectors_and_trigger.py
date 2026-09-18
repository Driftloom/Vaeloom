"""Tests for Dynamic MCP, Composio SaaS Gateway, and Trigger.dev Client."""
import os
import pytest

from api.config import settings
from api.mcp_servers.job_search_mcp import search_public_ats_jobs, fetch_job_details
from api.services.composio_service import composio_service, ComposioService
from api.trigger.client import is_trigger_enabled, TriggerClient, trigger_task


class TestJobSearchMcp:
    @pytest.mark.asyncio
    async def test_search_public_ats_jobs_validation(self):
        # Empty company should return JSON with error
        res = await search_public_ats_jobs("")
        assert "error" in res

    @pytest.mark.asyncio
    async def test_search_public_ats_jobs_live_or_fallback(self):
        # Valid company query
        res = await search_public_ats_jobs("figma", ats_provider="greenhouse")
        assert "figma" in res
        assert "greenhouse" in res
        assert "count" in res

    @pytest.mark.asyncio
    async def test_fetch_job_details_empty(self):
        res = await fetch_job_details("")
        assert "error" in res


class TestComposioService:
    def test_composio_disabled_without_key(self, monkeypatch):
        monkeypatch.delenv("COMPOSIO_API_KEY", raising=False)
        svc = ComposioService(api_key="")
        assert svc.is_enabled is False

        auth = svc.get_auth_url("slack", "test_workspace")
        assert auth["status"] == "error"

    def test_composio_enabled_with_key(self):
        svc = ComposioService(api_key="mock_composio_key")
        assert svc.is_enabled is True


class TestTriggerClient:
    def test_trigger_enabled_detection(self, monkeypatch):
        monkeypatch.setenv("TRIGGER_SECRET_KEY", "tr_dev_test123")
        monkeypatch.setenv("BACKGROUND_ENGINE", "trigger")
        assert is_trigger_enabled() is True

        monkeypatch.delenv("TRIGGER_SECRET_KEY", raising=False)
        monkeypatch.delenv("TRIGGER_API_KEY", raising=False)
        monkeypatch.setattr(settings, "trigger_api_key", "")
        monkeypatch.setattr(settings, "trigger_secret_key", "")
        assert is_trigger_enabled() is False

    @pytest.mark.asyncio
    async def test_trigger_fallback_dispatch(self, monkeypatch):
        monkeypatch.delenv("TRIGGER_SECRET_KEY", raising=False)
        monkeypatch.delenv("TRIGGER_API_KEY", raising=False)
        monkeypatch.setattr(settings, "trigger_api_key", "")
        monkeypatch.setattr(settings, "trigger_secret_key", "")
        client = TriggerClient(api_key="")

        # Without credentials, it gracefully dispatches to native fallback
        res = await client.trigger("example-task", {"msg": "hello"})
        assert res["status"] in ("enqueued", "accepted_inline")
        assert "run_id" in res
