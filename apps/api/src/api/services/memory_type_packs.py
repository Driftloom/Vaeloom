"""Memory-type domain packs: the registry that replaces the frozen taxonomy.

Migration ``0027`` froze the taxonomy into a CHECK constraint on ``memories`` and
migration ``0068`` created ``memory_type_packs`` to hold it as data. This module
is the only sanctioned reader of that table.

Two contracts matter to callers
-------------------------------
``validate_memory_type`` returns a :class:`PackMatch`, not a string. A caller that
wants to know which pack legalised a type -- to stamp ``type_pack_slug`` and
``type_pack_version`` on the row it is about to write -- must not have to
re-derive it from a hard-coded slug. Callers therefore write
``match.slug``/``match.version`` and never the literal ``"career"``.

Availability is a first-class case
----------------------------------
This registry is read on the write path. A database that predates 0068, or one
whose pack table has been emptied, must not turn into an outage on memory
creation, so an *unreadable* registry degrades to the built-in career pack and
logs at debug. An *empty* one does not: if the table is readable and holds no
active pack, that is an operator decision (every pack deactivated) and is
honoured, because silently resurrecting a deactivated taxonomy would make
``is_active`` a lie. The distinction is why the loader returns ``None`` for
"unavailable" and ``[]`` for "nothing active" -- collapsing them, which is what the
brief's single-return-value signature would force, would make test 7
(``test_inactive_pack_types_are_not_valid``) unpassable.

The probe runs inside a SAVEPOINT
---------------------------------
On PostgreSQL any error aborts the enclosing transaction until it is rolled back,
so a bare ``except`` around the SELECT would hand the caller a session that can no
longer commit -- the opposite of "must never break memory creation". The read is
therefore wrapped in ``db.begin_nested()``, the session-level analogue of the
savepoint helper every migration in this chain uses (``_safe`` in 0062/0067): a
failed probe rolls back to its own savepoint and leaves the caller's work intact.
"""

import logging
from typing import NamedTuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import MemoryTypePack

logger = logging.getLogger(__name__)

CAREER_PACK_SLUG = "career"

# The 24 types, in the exact order declared by ``schemas/memory.MemoryType``.
# Order is part of the contract: 0068 seeds the database from this list and
# Task 7 generates the frontend union from it, so a reordering is a visible
# change rather than a silent one.
CAREER_TYPES: tuple[str, ...] = (
    "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
)


class PackMatch(NamedTuple):
    """The pack that legalised a memory type, as persisted on the memory row."""

    slug: str
    version: int


def _invalid(value: str, slugs: tuple[str, ...]) -> ValueError:
    """Build the single rejection error, naming the value and the pack(s).

    Naming the packs is the point: the caller's fix is "use a type from one of
    these", which is only actionable if it knows what "these" are.
    """
    named = ", ".join(slugs) if slugs else "none (no active memory type pack is configured)"
    return ValueError(f"Invalid memory type {value!r}; valid types come from pack(s): {named}")


async def _active_packs_or_none(db: AsyncSession) -> list[MemoryTypePack] | None:
    """Active packs, or ``None`` when the registry could not be read at all.

    ``None`` and ``[]`` are deliberately different answers; see the module
    docstring. ``ORDER BY slug`` makes "the first active pack containing the
    value" deterministic once a second pack exists -- without it the winner would
    depend on the planner.

    Implemented as ``async`` rather than the ``def`` the interface list spells:
    it issues a query on an ``AsyncSession``, which has no synchronous execute
    path. A synchronous wrapper could only return an awaitable, which every
    caller would have to remember to await -- the opposite of the signature's
    intent.
    """
    try:
        async with db.begin_nested():
            result = await db.execute(
                select(MemoryTypePack)
                .where(MemoryTypePack.is_active.is_(True))
                .order_by(MemoryTypePack.slug)
            )
    except Exception:
        # Pre-migration database, a failed probe, a locked table. Debug, not
        # warning: the fallback below is the designed behaviour for this input,
        # so raising the log level on every call would turn a normal condition
        # into an alert that can never clear.
        logger.debug(
            "memory type pack registry unavailable; falling back to the built-in "
            "%r pack",
            CAREER_PACK_SLUG,
            exc_info=True,
        )
        return None
    return list(result.scalars().all())


async def load_active_packs(db: AsyncSession) -> list[MemoryTypePack]:
    """Every active pack, ordered by slug. Empty when none are, and empty on failure."""
    packs = await _active_packs_or_none(db)
    return packs if packs is not None else []


async def valid_types(db: AsyncSession) -> set[str]:
    """Union of the active packs' types; the built-in career set if unreadable."""
    packs = await _active_packs_or_none(db)
    if packs is None:
        return set(CAREER_TYPES)
    return {t for pack in packs for t in (pack.types or ())}


async def validate_memory_type(db: AsyncSession, value: str) -> PackMatch:
    """Return the pack that legalises ``value``, or raise ``ValueError``.

    Callers persist ``match.slug`` / ``match.version`` on the memory row so the
    row stays attributable to the pack revision it was written under.
    """
    packs = await _active_packs_or_none(db)
    if packs is None:
        if value in CAREER_TYPES:
            return PackMatch(CAREER_PACK_SLUG, 1)
        raise _invalid(value, (CAREER_PACK_SLUG,))

    for pack in packs:
        if value in (pack.types or ()):
            return PackMatch(pack.slug, pack.version)

    raise _invalid(value, tuple(pack.slug for pack in packs))
