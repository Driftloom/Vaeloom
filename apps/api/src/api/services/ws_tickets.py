"""Single-use WebSocket handshake tickets (GAP-AUTH-01 / W2.1c).

Why
---
The browser `WebSocket` constructor cannot set an `Authorization` header, so a
cookie-authenticated socket has to authenticate some other way. The previous
solution passed the long-lived access JWT in the query string
(`/api/v1/realtime/ws?token=...`), which meant the credential had to stay
readable by JavaScript — defeating the HttpOnly migration — and query strings are
written to access logs, proxy logs and `Referer` headers, where they outlive the
session.

A ticket removes both problems. The client calls an ordinary authenticated
`POST` and receives a short-lived opaque value it cannot derive anything from.
The value carries no claims of its own: it is a random handle looked up
server-side, so a leaked ticket is useless without the store, and it stops
working the moment it is spent.

Properties
----------
opaque       random 256-bit value; not a JWT, not derived from the session
short-lived  60s default — only has to survive one handshake
single-use    redeemed atomically, then deleted; a replay is an attack signal
bound       carries the user id resolved at mint time, so a stolen ticket
             cannot be replayed against a different identity

The store is Redis when configured so any worker can redeem a ticket minted by
another, with an in-process fallback for single-worker local and test runs. That
mirrors `middleware/csrf.py`, which has the same constraint.
"""

from __future__ import annotations

import json
import logging
import os
import secrets
import time

logger = logging.getLogger(__name__)

TICKET_PREFIX = "ws_ticket:"
DEFAULT_TTL_SECONDS = 60

# Single-use must be enforced on redemption, not by relying on the TTL. A ticket
# is spent with a delete-if-exists so two racing handshakes cannot both win.
_redis_client = None
_redis_checked = False

# In-process fallback. Values are JSON blobs keyed by ticket, with an absolute
# expiry so eviction can be lazy.
_memory_store: dict[str, tuple[float, str]] = {}


def _get_redis():
    global _redis_client, _redis_checked
    if _redis_checked:
        return _redis_client
    _redis_checked = True
    redis_url = os.environ.get("REDIS_URL") or getattr(
        _settings(), "redis__url", ""
    )
    if not redis_url or redis_url == "redis://localhost:6379/0":
        if not os.environ.get("REDIS_URL"):
            return None
    try:
        import redis  # type: ignore

        client = redis.Redis.from_url(
            redis_url, decode_responses=True, socket_connect_timeout=1, socket_timeout=1
        )
        client.ping()
        _redis_client = client
        return _redis_client
    except Exception as exc:
        logger.debug("WS ticket Redis unavailable, using in-memory: %s", exc)
        return None


def _settings():
    from ..config import settings

    return settings


def _evict_memory(now: float) -> None:
    for key in [k for k, (exp, _) in _memory_store.items() if exp <= now]:
        del _memory_store[key]


def issue_ticket(user_id: str, workspace_id: str | None = None, ttl: int = DEFAULT_TTL_SECONDS) -> tuple[str, int]:
    """Mint a ticket for ``user_id``.

    Returns the ticket and its lifetime in seconds so the client can decide
    whether to fetch a fresh one before reconnecting.
    """
    ttl = max(int(ttl), 1)
    ticket = secrets.token_urlsafe(32)
    payload = json.dumps({"sub": user_id, "workspace_id": workspace_id})

    client = _get_redis()
    if client is not None:
        try:
            # `set(..., ex=ttl)` rather than the deprecated `setex`.
            client.set(f"{TICKET_PREFIX}{ticket}", payload, ex=ttl)
            return ticket, ttl
        except Exception as exc:
            logger.debug("WS ticket Redis set failed, fallback to memory: %s", exc)

    now = time.time()
    _evict_memory(now)
    _memory_store[ticket] = (now + ttl, payload)
    return ticket, ttl


def redeem_ticket(ticket: str) -> dict | None:
    """Consume a ticket and return its claims, or ``None`` if it is not valid.

    Redemption is destructive. A ticket that has already been spent is not merely
    rejected: the caller should treat it as a possible replay, which is why this
    returns ``None`` rather than a distinct "already used" signal that a client
    could probe.
    """
    if not ticket:
        return None

    client = _get_redis()
    if client is not None:
        try:
            # Del-if-exists makes the read-and-delete atomic, so two concurrent
            # handshakes presenting the same ticket cannot both succeed.
            raw = client.eval(
                "local v = redis.call('GET', KEYS[1]); if v then redis.call('DEL', KEYS[1]) end; return v",
                1,
                f"{TICKET_PREFIX}{ticket}",
            )
            if not raw:
                return None
            return json.loads(raw)
        except Exception as exc:
            logger.debug("WS ticket Redis redeem failed, fallback to memory: %s", exc)

    now = time.time()
    _evict_memory(now)
    entry = _memory_store.pop(ticket, None)
    if entry is None:
        return None
    expires_at, payload = entry
    if expires_at <= now:
        return None
    try:
        return json.loads(payload)
    except json.JSONDecodeError:
        return None


def reset_store() -> None:
    """Clear the in-process store. Test isolation only."""
    _memory_store.clear()
    global _redis_client, _redis_checked
    _redis_client = None
    _redis_checked = False
