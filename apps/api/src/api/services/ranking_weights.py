"""Weight resolution for search ranking.

Precedence: per-user DB profile > ``RANKING_WEIGHTS`` env var > ``DEFAULT_WEIGHTS``.

Resolution is deliberately forgiving. The ``ranking_weight_profiles`` table is
created by a later migration; until then (and on any query failure) resolution
degrades to the env/default pair rather than raising, because a ranking outage
must never break the caller.

The learning half at the bottom of this module follows the same rule from the
other direction: it reads and writes the profile table, but it is best-effort
and swallows its own failures, because failing to learn must never cost the
user a feedback write that already succeeded.
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

# Table the feedback signal is aggregated from. Owned by 0002, not by this task.
_FEEDBACK_TABLE = "recommendation_feedback"

# ── learning arithmetic ──────────────────────────────────────────────────────
#
# At or below MIN_SAMPLES the weight does not move at all: a handful of ratings
# is noise, and letting it steer ranking means one enthusiastic click reorders
# somebody's results. The comparison in ``compute_user_preference`` is therefore
# ``<=``, not ``<``, so the weight starts moving on the 11th rating.
MIN_SAMPLES = 10

# Hard bounds on the learned weight. They are the *only* thing standing between
# the arithmetic and the per-column ``CHECK (... BETWEEN 0 AND 1)`` on the
# profile table, which rejects an out-of-range write with SQLSTATE 23514. Since
# 0.05..0.5 is strictly inside 0..1, clamping here makes that rejection
# unreachable for any input, adversarial included.
PREFERENCE_FLOOR = 0.05
PREFERENCE_CEILING = 0.5

# How far the weight is allowed to travel from its neutral value across the
# whole useful-rate range. 0.5 is the neutral rate, so the per-event step is
# PREFERENCE_SPAN * (rate - 0.5) * _PREFERENCE_BLEND.
PREFERENCE_SPAN = 0.3

# Fraction of the full step taken per observed signal.
#
# Settled at 0.5. The reason is the even-rate test: an exactly-even useful-rate
# must leave the weight *untouched*, because an even split of ratings is not
# evidence in either direction. A snap-to-absolute-target formula cannot
# express that -- its target depends only on the rate, so a rate of 0.5 pins
# every starting weight to the same constant and moves 0.2 to 0.125. Anchoring
# the step to the neutral rate instead (delta from ``current``, not from a
# fixed constant) makes the even-rate case a zero step for any ``current``
# already inside [PREFERENCE_FLOOR, PREFERENCE_CEILING] -- outside that band the
# clamp still normalises into it, which is the intended recovery, not a drift.
# 0.5 is then a plain readability/conservatism choice: at most +/-0.075 per
# signal, so a weight converges over a run of ratings rather than jumping on
# the first decisive one.
_PREFERENCE_BLEND = 0.5


def compute_user_preference(useful_count: int, total_count: int, current: float) -> float:
    """Move ``user_preference`` by useful-rate, one bounded step per signal.

    Returns ``current`` unchanged at or below ``MIN_SAMPLES``.

    Whenever it moves, the result is guaranteed to lie in
    ``[PREFERENCE_FLOOR, PREFERENCE_CEILING]``, which is strictly inside the
    table's ``CHECK (... BETWEEN 0 AND 1)``. That holds for every input,
    including the adversarial extremes (all-useful, all-unhelpful), so the
    database can never reject the write with SQLSTATE 23514.
    """
    if total_count <= MIN_SAMPLES:
        return current

    useful_rate = useful_count / total_count
    step = PREFERENCE_SPAN * (useful_rate - 0.5) * _PREFERENCE_BLEND
    moved = current + step
    return max(PREFERENCE_FLOOR, min(PREFERENCE_CEILING, moved))


async def record_feedback_signal(
    db: AsyncSession, *, user_id: str, workspace_id: str | None, useful: bool
) -> None:
    """Fold one recommendation rating into the caller's learned weight.

    Best-effort by contract: a failure here is logged at debug and swallowed,
    because the user's feedback row is already written and losing it over a
    weight update would be a strictly worse outcome than not learning.

    The RLS session GUCs are set before any statement touching the profile,
    because ``ranking_weight_profiles`` has FORCE RLS with a ``WITH CHECK``
    clause, and PostgreSQL consults ``WITH CHECK`` on UPDATE. Without
    ``app.workspace_id`` (or workspace membership) the write is refused with
    SQLSTATE 42501 -- which, being swallowed here, would read as "learning is
    silently broken" rather than as a permission error.

    No profile is created. A rating from a user who has never ranked must not
    invent a workspace-wide profile that then outranks nobody's real one.

    ``recommendation_feedback`` has no ``workspace_id`` column (0002), so the
    aggregate is scoped by ``user_id`` alone. That cross-workspace imprecision
    is inherent to the schema, not an oversight here: the profile is still
    located by ``(workspace_id, user_id)``.
    """
    if not user_id or not workspace_id:
        return

    try:
        # Lazy import: middleware.tenant pulls in api.database at call time, and
        # this module is imported by the search ranker. Same convention as
        # memory_service.create_memory.
        from ..middleware.tenant import set_rls_session_vars

        await set_rls_session_vars(db, workspace_id=workspace_id, user_id=user_id)

        profile = (
            await db.execute(
                text(
                    f"SELECT id, user_preference FROM {_PROFILES_TABLE} "  # noqa: S608 - fixed identifiers
                    f"WHERE workspace_id = :workspace_id AND user_id = :user_id "
                    f"LIMIT 1"
                ),
                {"workspace_id": workspace_id, "user_id": user_id},
            )
        ).mappings().one_or_none()

        if profile is None:
            return

        counts = (
            await db.execute(
                text(
                    f"SELECT count(*) AS total, "  # noqa: S608 - fixed identifiers
                    f"COALESCE(SUM(CASE WHEN useful THEN 1 ELSE 0 END), 0) AS useful_count "
                    f"FROM {_FEEDBACK_TABLE} WHERE user_id = :user_id"
                ),
                {"user_id": user_id},
            )
        ).mappings().one_or_none()

        total = int(counts["total"]) if counts else 0
        useful_count = int(counts["useful_count"]) if counts else 0

        weight = compute_user_preference(
            useful_count, total, float(profile["user_preference"])
        )

        await db.execute(
            text(
                f"UPDATE {_PROFILES_TABLE} "  # noqa: S608 - fixed identifiers
                f"SET user_preference = :weight, sample_size = :sample_size, "
                f"updated_at = CURRENT_TIMESTAMP "
                f"WHERE workspace_id = :workspace_id AND user_id = :user_id"
            ),
            {
                "weight": weight,
                "sample_size": total,
                "workspace_id": workspace_id,
                "user_id": user_id,
            },
        )
    except Exception as exc:  # noqa: BLE001 - learning must never break the write
        logger.debug(f"Ranking weight learning skipped: {exc}")
        return None

    return None


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
