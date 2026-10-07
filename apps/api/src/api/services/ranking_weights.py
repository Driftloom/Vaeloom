"""Weight resolution for search ranking.

Precedence: per-user DB profile > ``RANKING_WEIGHTS`` env var > ``DEFAULT_WEIGHTS``.

This module is deliberately pure logic. The ``ranking_weight_profiles`` table is
created by a later migration; until then (and on any query failure) resolution
degrades to the env/default pair rather than raising, because a ranking outage
must never break the caller.
"""

import json
import logging
import os

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# MUST stay in sync with DEFAULT_WEIGHTS in services/search_ranking.py.
# Copied as a literal rather than imported: search_ranking depends on this
# module's WEIGHT_KEYS, so importing back would be a circular import.
DEFAULT_WEIGHTS = {
    "relevance": 0.4,
    "recency": 0.3,
    "importance": 0.2,
    "user_preference": 0.1,
}

# Membership contract for any weight source: all four keys, or nothing.
WEIGHT_KEYS: tuple[str, ...] = ("relevance", "recency", "importance", "user_preference")

# Table the per-user profile is read from. The owning migration must create
# exactly this name; until it lands the SELECT raises and we fall through.
_PROFILES_TABLE = "ranking_weight_profiles"


def env_weights() -> dict[str, float] | None:
    """RANKING_WEIGHTS JSON, or None when unset/malformed/missing a key.

    Returning None (not a partial dict) is deliberate: a half-specified env var
    must fall through to DEFAULT_WEIGHTS rather than silently zeroing a weight.
    """
    raw = os.environ.get("RANKING_WEIGHTS", "")
    if not raw:
        return None
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, TypeError, ValueError):
        return None
    if not isinstance(parsed, dict):
        return None
    if not all(key in parsed for key in WEIGHT_KEYS):
        return None
    try:
        return {key: float(parsed[key]) for key in WEIGHT_KEYS}
    except (TypeError, ValueError):
        return None


def _fallback_weights() -> dict[str, float]:
    return env_weights() or dict(DEFAULT_WEIGHTS)


async def effective_weights(
    db: AsyncSession, workspace_id: str, user_id: str | None
) -> dict[str, float]:
    """Resolve the active weight set. Never raises.

    A DB failure is not a ranking failure: it is logged at debug and the
    env/default pair is returned instead.
    """
    if not user_id:
        return _fallback_weights()

    stmt = text(
        f"SELECT relevance, recency, importance, user_preference "  # noqa: S608 - fixed identifiers
        f"FROM {_PROFILES_TABLE} "
        f"WHERE workspace_id = :workspace_id AND user_id = :user_id "
        f"LIMIT 1"
    )
    try:
        result = await db.execute(
            stmt, {"workspace_id": workspace_id, "user_id": user_id}
        )
        # mappings() (not scalar_one_or_none) because this is a multi-column
        # select: scalar_* would hand back the first column's bare float.
        row = result.mappings().one_or_none()
    except Exception as exc:  # noqa: BLE001 - resolution must never propagate
        logger.debug(f"Ranking weight profile lookup failed: {exc}")
        return _fallback_weights()

    if row is None:
        return _fallback_weights()

    try:
        return {key: float(row[key]) for key in WEIGHT_KEYS}
    except (KeyError, TypeError, ValueError) as exc:
        logger.debug(f"Ranking weight profile row unusable: {exc}")
        return _fallback_weights()
