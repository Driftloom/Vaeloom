"""Weight resolution for search ranking.

Precedence: per-user DB profile > ``RANKING_WEIGHTS`` env var > ``DEFAULT_WEIGHTS``.

Resolution is deliberately forgiving. The ``ranking_weight_profiles`` table is
created by a later migration; until then (and on any query failure) resolution
degrades to the env/default pair rather than raising, because a ranking outage
must never break the caller.

The learned tier is provisioned, not merely read
----------------------------------------------
Resolution is also where a profile row first comes into existence, because it is
the only path that always runs: the learner in ``record_feedback_signal``
deliberately refuses to create rows (see its docstring), so without a writer on
this side the DB tier is unreachable forever and every caller silently receives
env/default weights. The whole-branch review caught exactly that -- 0067 seeded
nothing, nothing inserted a row, and ``row is None -> _fallback_weights()`` was
the only reachable outcome. A learned feature that cannot activate is not a
learned feature.

The row is the caller's *own* profile, keyed ``(workspace_id, user_id)``, so
provisioning it invents nothing on anybody's behalf -- there is no workspace-wide
or shared row for it to collide with, and ``UNIQUE (workspace_id, user_id)``
makes a duplicate race between two concurrent rank calls a no-op rather than a
second profile.

It is seeded with the values the fallback was about to return, so the first
resolution returns exactly what the fallback would have and the second returns
exactly what the first did. ``RANKING_WEIGHTS`` therefore still governs until
the learner has something to say, and provisioning never changes a user's
ranking on its own.

The learning half at the bottom of this module follows the same rule from the
other direction: it reads and writes the profile table, but it is best-effort
and swallows its own failures, because failing to learn must never cost the
user a feedback write that already succeeded.
"""

import json
import logging
import os
import uuid

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

# Provisioning statement for a caller who has no profile yet.
#
# ON CONFLICT (workspace_id, user_id) DO NOTHING is what makes the write safe to
# place on the read path: two concurrent rank calls both observe zero rows and
# both try to provision, and the loser does nothing rather than raising
# UniqueViolation. It is not an error-swallowing clause -- the constraint is
# still there, it is just consulted instead of enforced.
#
# `tenant_id` is NOT NULL but unread (no policy or query in this module reads
# it), so it is derived rather than threaded through: `app_tenant_for_workspace`
# is the SECURITY DEFINER helper `database.scoped_session` already uses to scope
# a session to a workspace. It resolves from the workspace's owning user, and
# returns NULL for a workspace that has none -- which makes the INSERT fail the
# NOT NULL and be contained below. Failing to provision is not a ranking
# failure, so that is the correct outcome.
_BOOTSTRAP_SQL = f"""
    INSERT INTO {_PROFILES_TABLE} (
        id, tenant_id, workspace_id, user_id,
        relevance, recency, importance, user_preference, sample_size
    ) VALUES (
        :id,
        app_tenant_for_workspace(:workspace_id),
        :workspace_id, :user_id,
        :relevance, :recency, :importance, :user_preference, 0
    )
    ON CONFLICT (workspace_id, user_id) DO NOTHING
"""

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

    No profile is created *here*. Provisioning lives in ``effective_weights``
    (``provision_profile``), which is the path that always runs; doing it from
    the rating side instead would mean a user who never ranks never gets a
    profile, and the learner would only ever be able to update rows it had
    somehow obtained. The row is keyed ``(workspace_id, user_id)``, so the
    caller's own profile is the only thing this can ever address.

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


async def provision_profile(
    db: AsyncSession, workspace_id: str, user_id: str, weights: dict[str, float]
) -> bool:
    """Write the caller's own profile row if it is missing. Best-effort.

    Returns True when the row is (now) present. A failure is logged at debug and
    reported as False rather than raised: the caller already has the weights it
    was going to use, so the only consequence of not provisioning is that the
    next rank call tries again.

    The two failure modes worth naming, because both are contained here and
    neither is a ranking outage:

    * **RLS ``WITH CHECK`` (SQLSTATE 42501).** 0067's policy governs the write as
      well as the read, so provisioning only succeeds when the session already
      carries the workspace and user scope -- which it does on every path that
      resolved weights in the first place, because ``effective_weights`` refuses
      to look up a profile without a ``user_id`` and the rank path opens its
      session with that same ``user_id``.
    * **The table not existing.** A database that predates 0067 cannot be
      provisioned into. It also cannot be read from, so it is already on the
      fallback path before this is reached.

    ``weights`` is seeded verbatim rather than left to the column defaults so
    that provisioning is behaviour-preserving: with no ``RANKING_WEIGHTS`` set the
    defaults are what the columns already hold, and with it set the row starts
    from the env values instead of silently reverting the user to 0.4/0.3/0.2/0.1
    on their second rank call.
    """
    try:
        await db.execute(
            text(_BOOTSTRAP_SQL),
            {
                "id": str(uuid.uuid4()),
                "workspace_id": workspace_id,
                "user_id": user_id,
                **{key: float(weights[key]) for key in WEIGHT_KEYS},
            },
        )
        return True
    except Exception as exc:  # noqa: BLE001 - provisioning must never break ranking
        logger.debug(f"Ranking weight profile provisioning skipped: {exc}")
        return False


async def effective_weights(
    db: AsyncSession, workspace_id: str, user_id: str | None
) -> dict[str, float]:
    """Resolve the active weight set. Never raises.

    A DB failure is not a ranking failure: it is logged at debug and the
    env/default pair is returned instead. A *missing* row is not a failure at
    all -- it is the first rank call for this user in this workspace, so the
    row is provisioned (see the module docstring) and the fallback pair is
    returned unchanged.
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
        fallback = _fallback_weights()
        await provision_profile(db, workspace_id, user_id, fallback)
        return fallback

    try:
        return {key: float(row[key]) for key in WEIGHT_KEYS}
    except (KeyError, TypeError, ValueError) as exc:
        logger.debug(f"Ranking weight profile row unusable: {exc}")
        return _fallback_weights()
