"""Single-use WebSocket handshake tickets (GAP-AUTH-01 / W2.1c).

The property that matters most is single-use. A ticket that could be redeemed
twice would let an attacker who observes one handshake replay it, and because the
previous design put a 30-day refresh-equivalent credential in the query string,
"observe once, use twice" is exactly the failure mode being closed. The negative
controls below are therefore the substance of this file; the positive ones only
exist so a store that simply rejects everything cannot pass.
"""

import pytest

from api.services import ws_tickets
from api.services.ws_tickets import (
    DEFAULT_TTL_SECONDS,
    issue_ticket,
    redeem_ticket,
    reset_store,
)


@pytest.fixture(autouse=True)
def _memory_store_only(monkeypatch):
    """Pin the in-process store and give each test an empty one.

    Without this the tests silently take a different code path depending on
    whether REDIS_URL happens to be set in the environment — they passed here
    only because the failure was an unbackdated in-memory entry that Redis had
    never received. A security test whose behaviour depends on ambient
    configuration is not a reliable gate, so the store is pinned and the Redis
    path gets its own explicit test below.
    """
    monkeypatch.setattr(ws_tickets, "_get_redis", lambda: None)
    reset_store()
    yield
    reset_store()


# ── single use ───────────────────────────────────────────────────────────────


def test_ticket_redeems_once():
    ticket, ttl = issue_ticket("user-1")
    assert ttl == DEFAULT_TTL_SECONDS

    claims = redeem_ticket(ticket)
    assert claims is not None
    assert claims["sub"] == "user-1"


def test_ticket_replay_is_rejected():
    """The core guarantee: a spent ticket is worthless."""
    ticket, _ = issue_ticket("user-1")
    assert redeem_ticket(ticket) is not None

    assert redeem_ticket(ticket) is None, "a second redemption must fail"
    assert redeem_ticket(ticket) is None, "and must keep failing"


def test_two_tickets_do_not_interfere():
    a, _ = issue_ticket("user-a")
    b, _ = issue_ticket("user-b")

    assert redeem_ticket(a)["sub"] == "user-a"
    assert redeem_ticket(b)["sub"] == "user-b"
    assert redeem_ticket(a) is None


# ── unknown input ────────────────────────────────────────────────────────────


def test_unknown_ticket_is_rejected():
    assert redeem_ticket("never-issued") is None


def test_empty_ticket_is_rejected():
    assert redeem_ticket("") is None
    assert redeem_ticket(None) is None


def test_malformed_store_value_does_not_crash():
    """A corrupt entry must fail closed rather than raise inside the handshake."""
    ws_tickets._memory_store["corrupt"] = (9_999_999_999.0, "not json")
    assert redeem_ticket("corrupt") is None


# ── opacity and binding ──────────────────────────────────────────────────────


def test_ticket_is_opaque_and_carries_no_claims():
    """A ticket must not be decodable.

    If it encoded the user id, a leaked ticket would both disclose the identity
    and invite offline forgery attempts. It has to be an unguessable random
    handle whose meaning lives only in the store.
    """
    ticket, _ = issue_ticket("user-secret-1234", workspace_id="ws-1")

    assert "user-secret-1234" not in ticket
    assert "ws-1" not in ticket
    # Not a JWT.
    assert ticket.count(".") != 2
    # And long enough to be unguessable.
    assert len(ticket) >= 32


def test_tickets_are_unique():
    tickets = {issue_ticket(f"user-{i}")[0] for i in range(200)}
    assert len(tickets) == 200, "ticket generation must not collide"


def test_ticket_is_bound_to_the_minted_identity():
    """A ticket cannot be re-pointed at another user.

    The claims are resolved when the ticket is minted, not when it is spent, so
    redeeming a stolen ticket yields the original identity rather than anything
    the holder supplies.
    """
    ticket, _ = issue_ticket("original-user")
    claims = redeem_ticket(ticket)

    assert claims["sub"] == "original-user"
    assert "original-user" in claims["sub"]


def test_workspace_is_carried_through():
    ticket, _ = issue_ticket("user-1", workspace_id="ws-abc")
    claims = redeem_ticket(ticket)
    assert claims["workspace_id"] == "ws-abc"


def test_missing_workspace_is_none():
    ticket, _ = issue_ticket("user-1")
    assert redeem_ticket(ticket)["workspace_id"] is None


# ── expiry ───────────────────────────────────────────────────────────────────


def test_expired_ticket_is_rejected():
    """A ticket that outlived its TTL must not authenticate anything."""
    ticket, _ = issue_ticket("user-1", ttl=1)
    # Backdate the stored expiry rather than sleeping: the test asserts the
    # expiry check, not the passage of time.
    expires_at, payload = ws_tickets._memory_store[ticket]
    ws_tickets._memory_store[ticket] = (0.0, payload)

    assert redeem_ticket(ticket) is None
    assert ws_tickets._memory_store.get(ticket) is None, "expired entry must be evicted"


def test_ttl_is_never_zero_or_negative():
    """A zero TTL would mint an already-dead ticket and look like a random failure."""
    assert issue_ticket("u", ttl=0)[1] >= 1
    assert issue_ticket("u", ttl=-99)[1] >= 1


# ── the Redis path, which is what production actually uses ──────────────────


def test_redis_store_also_enforces_single_use(monkeypatch):
    """The in-memory guarantees must hold for the store used in production.

    Single-use is enforced with a delete-if-exists rather than a read followed by
    a delete, so two handshakes racing on the same ticket cannot both win. If
    Redis is unavailable the test skips rather than silently passing against the
    fallback, because that would claim coverage that does not exist.
    """
    monkeypatch.undo()
    reset_store()
    client = ws_tickets._get_redis()
    if client is None:
        pytest.skip("Redis not configured; the in-memory path is covered above")

    try:
        ticket, _ = issue_ticket("redis-user", workspace_id="ws-redis")
        claims = redeem_ticket(ticket)
        assert claims is not None
        assert claims["sub"] == "redis-user"
        assert claims["workspace_id"] == "ws-redis"

        assert redeem_ticket(ticket) is None, "Redis must also destroy on redeem"
        assert redeem_ticket(ticket) is None
    finally:
        try:
            client.delete(f"{ws_tickets.TICKET_PREFIX}{ticket}")
        except Exception:
            pass
        reset_store()
