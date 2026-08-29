"""ZT-01 regression: when Temporal is explicitly enabled but unreachable, the client
must FAIL CLOSED (raise) — never return None and let callers silently run non-durably.
"""

import pytest

from api.temporal import client as temporal_client


@pytest.mark.asyncio
async def test_enabled_but_unreachable_raises_fail_closed(monkeypatch):
    monkeypatch.setattr(temporal_client.settings, "temporal_enabled", True)
    temporal_client._client = None

    # Force Client.connect to fail as if Temporal is down.
    import temporalio.client as _tc

    async def _boom(*args, **kwargs):
        raise RuntimeError("connection refused")

    monkeypatch.setattr(_tc.Client, "connect", _boom)

    with pytest.raises(temporal_client.TemporalUnavailableError):
        await temporal_client.get_temporal_client()


@pytest.mark.asyncio
async def test_disabled_returns_none_without_connecting(monkeypatch):
    monkeypatch.setattr(temporal_client.settings, "temporal_enabled", False)
    temporal_client._client = None

    import temporalio.client as _tc

    called = {"n": 0}

    async def _track(*args, **kwargs):
        called["n"] += 1
        raise RuntimeError("should not be called")

    monkeypatch.setattr(_tc.Client, "connect", _track)

    assert await temporal_client.get_temporal_client() is None
    assert called["n"] == 0
