"""WebSocket handshake behaviour with single-use tickets (GAP-AUTH-01 / W2.1c).

These drive the real ASGI app over a real WebSocket, because the bug they exist to
prevent cannot be seen any other way. The ticket path originally redeemed
correctly and then disconnected on every connection, because the handler
registered the socket directly on a connection that had never been accepted, and
`socket.accept()` had been skipped. Every store-level test still passed: the
ticket was minted, single-use, opaque and expiring. Only actually opening the
socket showed it was unusable.

`client.websocket_connect` is used rather than a live server so the failure mode
is raised synchronously and the test stays fast and deterministic.
"""

import pytest
from starlette.testclient import TestClient

from api.services import ws_tickets

UID = "11111111-1111-1111-1111-111111111111"
WID = "22222222-2222-2222-2222-222222222222"


@pytest.fixture
def ws_client():
    from api.main import app

    return TestClient(app)


@pytest.fixture(autouse=True)
def _clean(monkeypatch):
    """Pin the in-process store so Redis availability cannot change the result."""
    monkeypatch.setattr(ws_tickets, "_get_redis", lambda: None)
    ws_tickets.reset_store()
    yield
    ws_tickets.reset_store()


# ── happy path ───────────────────────────────────────────────────────────────


def test_valid_ticket_opens_the_socket(ws_client):
    """Regression guard: a redeemed ticket must yield a usable connection.

    The failure this catches is silent — the ticket is consumed and the socket
    closes with a policy violation, which looks identical to a rejected ticket.
    """
    ticket, _ = ws_tickets.issue_ticket(UID, workspace_id=WID)

    with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
        ack = ws.receive_json()

    assert ack["event"] == "CONNECTED"
    assert ack["user_id"] == UID
    assert ack["workspace_id"] == WID


def test_ticket_without_workspace_still_connects(ws_client):
    """Workspace is optional; a server-assigned one must not break the socket."""
    ticket, _ = ws_tickets.issue_ticket(UID)

    with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
        assert ws.receive_json()["event"] == "CONNECTED"


# ── single use ───────────────────────────────────────────────────────────────


def test_ticket_cannot_be_replayed(ws_client):
    """A spent ticket must not open a second connection."""
    ticket, _ = ws_tickets.issue_ticket(UID, workspace_id=WID)

    with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
        ws.receive_json()

    with pytest.raises(Exception):
        with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
            ws.receive_json()


def test_each_ticket_is_independent(ws_client):
    """Redeeming one ticket must not consume another."""
    first, _ = ws_tickets.issue_ticket(UID, workspace_id=WID)
    second, _ = ws_tickets.issue_ticket(UID, workspace_id=WID)

    with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={first}") as ws:
        ws.receive_json()

    with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={second}") as ws:
        assert ws.receive_json()["event"] == "CONNECTED"


# ── rejection ────────────────────────────────────────────────────────────────


def test_unknown_ticket_is_rejected(ws_client):
    with pytest.raises(Exception):
        with ws_client.websocket_connect("/api/v1/realtime/ws?ticket=not-a-real-ticket") as ws:
            ws.receive_json()


def test_ticket_claiming_a_malformed_workspace_is_rejected(ws_client):
    """A non-UUID workspace cannot be parsed at handshake time.

    The mint endpoint now rejects this with 422; this asserts the socket side so
    a hand-built or legacy ticket still cannot produce a half-open connection.
    """
    ticket, _ = ws_tickets.issue_ticket(UID, workspace_id="not-a-uuid")

    with pytest.raises(Exception):
        with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
            ws.receive_json()


def test_ticket_with_non_uuid_subject_is_rejected(ws_client):
    """Identity must be a UUID too, or connection registration is meaningless."""
    ticket, _ = ws_tickets.issue_ticket("user-1234")

    with pytest.raises(Exception):
        with ws_client.websocket_connect(f"/api/v1/realtime/ws?ticket={ticket}") as ws:
            ws.receive_json()


def test_query_token_path_still_works_for_non_browser_clients(ws_client):
    """The SDK/CLI `?token=` path is retained; a garbage token is still refused."""
    with pytest.raises(Exception):
        with ws_client.websocket_connect("/api/v1/realtime/ws?token=garbage") as ws:
            ws.receive_json()
