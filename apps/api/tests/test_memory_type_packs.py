"""Domain-pack registry: seed fidelity, write validation, pack isolation.

What is under test here
----------------------
Migration ``0068`` replaces the hard-coded memory taxonomy with a table of
*domain packs*. ``memory_type_packs`` holds one row per pack (``slug``,
``version``, ordered ``types``), and ``validate_memory_type`` answers "is this
memory type legal, and which pack does it belong to?". The pack slug and version
are the whole point of the registry, so they are returned rather than discarded.

The seed lives in the migration, which is PostgreSQL-only DDL and never runs
against the SQLite test database. Re-declaring the row inside this file would make
the assertion below tautological, so the fixture instead reads the 24 literals
*out of the migration source* and inserts them. The chain under test is then
migration literal -> table row -> ``CAREER_TYPES`` -> literal list pinned by
``test_career_types_matches_source_order``, and drift at any link fails here.
"""

import ast
import pathlib

import pytest
from sqlalchemy import select

from api.models.schema import MemoryTypePack
from api.services.memory_type_packs import (
    CAREER_PACK_SLUG,
    CAREER_TYPES,
    PackMatch,
    valid_types,
    validate_memory_type,
)

# Only the five tests below that touch `db_session` are async. This module carries
# no `pytestmark`: pyproject sets `asyncio_mode = "auto"`, so an explicit module
# mark here would land on the two sync constant checks and make pytest warn that
# they are async-marked but not async.

_MIGRATION = (
    pathlib.Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0068_memory_type_packs.py"
)


def _migration_seed_types() -> tuple[str, ...]:
    """Return the ``_CAREER_TYPES`` tuple literal declared in migration 0068.

    Parsed with :mod:`ast` rather than imported: the module name starts with a
    digit, and parsing has no side effects, so this cannot depend on Alembic
    context or on import order. ``AnnAssign`` as well as ``Assign`` is matched
    because the migration annotates the tuple.
    """
    tree = ast.parse(_MIGRATION.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            targets = [node.target]
            value = node.value
        elif isinstance(node, ast.Assign):
            targets = list(node.targets)
            value = node.value
        else:
            continue
        if any(isinstance(t, ast.Name) and t.id == "_CAREER_TYPES" for t in targets):
            return ast.literal_eval(value)
    raise AssertionError(
        f"{_MIGRATION.name} no longer declares _CAREER_TYPES; the seed fixture "
        "cannot verify the migration it is supposed to be checking"
    )


@pytest.fixture
async def seeded_packs(db_session):
    """Materialise the migration's own seed row inside the test database."""
    db_session.add(
        MemoryTypePack(
            slug=CAREER_PACK_SLUG,
            version=1,
            label="Career",
            types=list(_migration_seed_types()),
            is_active=True,
        )
    )
    await db_session.flush()
    return db_session


def test_career_types_has_exactly_24():
    assert len(CAREER_TYPES) == 24


def test_career_types_matches_source_order():
    """Pins the exact list. A count check would miss a silent rename."""
    assert CAREER_TYPES == (
        "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
        "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
        "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
    )


async def test_seeded_career_pack_matches_constant(seeded_packs):
    """The DB seed must equal CAREER_TYPES exactly -- this is the drift guard."""
    packs = (
        await seeded_packs.execute(
            select(MemoryTypePack).where(MemoryTypePack.slug == "career")
        )
    ).scalars().all()
    assert len(packs) == 1
    assert tuple(packs[0].types) == CAREER_TYPES
    assert packs[0].version == 1
    assert packs[0].is_active is True


async def test_validate_accepts_every_career_type(seeded_packs):
    """Every pack type resolves, and resolves to the pack it came from.

    The brief asserted ``validate_memory_type(db, t) == t``. That predates the
    ``PackMatch`` return contract Task 6 writes against, so the invariant checked
    here is the one that contract actually needs: nothing in the pack is rejected,
    and each value reports the slug/version the caller is about to persist.
    """
    for t in CAREER_TYPES:
        assert await validate_memory_type(seeded_packs, t) == PackMatch(CAREER_PACK_SLUG, 1)


async def test_validate_rejects_unknown_type_naming_the_pack(seeded_packs):
    with pytest.raises(ValueError) as exc:
        await validate_memory_type(seeded_packs, "not_a_type")
    msg = str(exc.value)
    assert "career" in msg, "error must name the pack"
    assert "not_a_type" in msg, "error must name the offending value"


async def test_validate_rejects_type_from_a_different_pack(seeded_packs):
    """Review Focus #5: a type valid elsewhere must be rejected here."""
    with pytest.raises(ValueError) as exc:
        await validate_memory_type(seeded_packs, "person")
    assert "career" in str(exc.value)


async def test_inactive_pack_types_are_not_valid(seeded_packs):
    pack = (
        await seeded_packs.execute(
            select(MemoryTypePack).where(MemoryTypePack.slug == CAREER_PACK_SLUG)
        )
    ).scalar_one()
    pack.is_active = False
    await seeded_packs.flush()
    assert "insight" not in await valid_types(seeded_packs)
