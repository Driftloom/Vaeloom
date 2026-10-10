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

Why half this file executes the migration
-----------------------------------------
``upgrade()`` returns early off PostgreSQL, so **nothing else in this repository
ever runs it**. ``memory_type_packs`` in the SQLite suite comes from
``Base.metadata``, and the fixture above seeds it through the ORM from a Python
tuple that is equally valid however the migration would have rendered it. That is
how an invalid seed shipped through a green suite: the payload was a SQL string
list spliced inside a ``::jsonb`` cast, which is a syntax error, and no assertion
touched the SQL text at all.

So the ``test_emits_*`` tests below actually execute ``upgrade()``/``downgrade()``
against an offline Alembic context and assert on the SQL that comes out -- every
statement this migration can emit. It is not a full PostgreSQL parser and it does
not prove the DDL applies to a server (CI does that:
``.github/workflows/migration-chain.yml`` runs the chain up, down one revision,
and back up). Its job is narrower and it is the one that was missing: a
structural regression in the emitted SQL -- a wrong arity, a missing cast, a
dropped literal, a CHECK that no longer matches 0027 -- turns this file red
without a database.
"""

import ast
import importlib.util
import io
import json
import pathlib
import re
import uuid

import pytest
import sqlalchemy as sa
from sqlalchemy import select

from api.models.schema import MemoryTypePack
from api.services.memory_type_packs import (
    CAREER_PACK_SLUG,
    CAREER_TYPES,
    MemoryTypeRejected,
    PackMatch,
    valid_types,
    validate_memory_type,
)

# Only the tests that touch `db_session` are async. This module carries no
# `pytestmark`: pyproject sets `asyncio_mode = "auto"`, so an explicit module mark
# here would land on the sync checks and make pytest warn that they are
# async-marked but not async.

_MIGRATION = (
    pathlib.Path(__file__).resolve().parents[1]
    / "alembic"
    / "versions"
    / "0068_memory_type_packs.py"
)


def _load_migration_module():
    """Import 0068 itself, to exercise the function that builds the seed payload.

    Safe to execute: the module body only assigns revision strings and constants
    and defines functions -- no DDL runs at import. ``spec_from_file_location``
    is used because the filename starts with a digit and cannot be imported by
    name.
    """
    spec = importlib.util.spec_from_file_location("migration_0068", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


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
    """Materialise the migration's own seed row inside the test database.

    Replaces any row ``conftest`` already seeded. The whole point of this
    fixture is the migration-literal -> table-row link, so it must insert the
    types parsed out of ``0068`` rather than reuse the constant the rest of the
    suite gets; a delete-then-insert keeps that link honest while leaving the
    database in the state a migrated deployment is in.
    """
    existing = (
        await db_session.execute(
            select(MemoryTypePack).where(MemoryTypePack.slug == CAREER_PACK_SLUG)
        )
    ).scalar_one_or_none()
    if existing is not None:
        await db_session.delete(existing)
        await db_session.flush()
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

    # The literal PostgreSQL actually receives, not just the Python constant.
    # Asserting only the two constants above leaves the rendering step untested,
    # and an earlier draft of 0068 rendered this payload as a SQL string list
    # (`['profile', 'document', ...]`) where a JSON array was required -- all
    # seven other assertions in this module passed while the seed would have
    # failed at deploy. The `''` -> `'` step undoes the SQL string-literal
    # escaping `_type_list_sql` applies to the payload it embeds.
    payload = _load_migration_module()._type_list_sql().replace("''", "'")
    assert tuple(json.loads(payload)) == CAREER_TYPES


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


async def test_no_active_pack_warns_rather_than_falling_back_silently(seeded_packs, caplog):
    """Fix round 1, Important 2: the outage path must not be silent.

    Deactivating the only pack rejects every memory write. With no log line at
    all, that is a total outage with zero telemetry, and the first symptom a user
    reports is a validation error that names a pack which looks perfectly
    configured. The counterpart -- a registry that could not be *read* -- is
    routine degradation to the built-in pack and stays at debug; the two must not
    share a level or the routine case becomes an alert that can never clear.
    """
    import logging

    from api.services import memory_type_packs as mod

    pack = (
        await seeded_packs.execute(
            select(MemoryTypePack).where(MemoryTypePack.slug == CAREER_PACK_SLUG)
        )
    ).scalar_one()
    pack.is_active = False
    await seeded_packs.flush()

    with caplog.at_level(logging.DEBUG, logger=mod.__name__):
        assert await valid_types(seeded_packs) == set()
        with pytest.raises(ValueError):
            await validate_memory_type(seeded_packs, "profile")

    warnings = [r for r in caplog.records if r.levelno == logging.WARNING]
    assert warnings, "deactivating every pack must log at WARNING"
    assert "no active memory type pack" in warnings[0].getMessage()
    # Behaviour is unchanged by the logging: still no fallback to CAREER_TYPES.
    assert "insight" not in await valid_types(seeded_packs)


async def test_unreadable_registry_stays_at_debug(seeded_packs, caplog, monkeypatch):
    """Fix round 2: the fallback level is pinned, not merely intended.

    ``test_no_active_pack_warns_rather_than_falling_back_silently`` covers the
    warning side; this covers the other one. Until now the split between the two
    branches rested on code structure alone -- the ``except`` returns before the
    warning is reached -- so bumping the fallback from ``debug`` to ``warning``
    would have turned every pre-migration database and every transient probe
    failure into a permanent, unclearable warning, and nothing would fail. The
    distinction is a real contract: the fallback is *designed* behaviour, so it
    must stay below the operator-actionable threshold.

    The pack row is present, so the assertion is about an unreadable registry
    rather than an empty one -- ``execute`` is replaced with a raise, which is
    what a database predating 0068 actually looks like from inside the savepoint.
    """
    import logging

    from api.services import memory_type_packs as mod

    async def _unreadable(*args, **kwargs):
        raise sa.exc.OperationalError("SELECT memory_type_packs", {}, Exception("no such table"))

    monkeypatch.setattr(seeded_packs, "execute", _unreadable)

    with caplog.at_level(logging.DEBUG, logger=mod.__name__):
        # An unreadable registry must still not break memory creation.
        assert await valid_types(seeded_packs) == set(CAREER_TYPES)
        assert await validate_memory_type(seeded_packs, "insight") == PackMatch(
            CAREER_PACK_SLUG, 1
        )
        with pytest.raises(ValueError):
            await validate_memory_type(seeded_packs, "not_a_type")

    records = [r for r in caplog.records if r.name == mod.__name__]
    assert records, "an unreadable registry must still leave a log record"
    # The negative control itself: any level bump on either branch fails here.
    assert [r.levelno for r in records] == [logging.DEBUG] * len(records), (
        "the unavailable-registry fallback is routine degradation and must stay at "
        f"DEBUG; got {[r.levelname for r in records]}"
    )
    assert all("pack registry unavailable" in r.getMessage() for r in records), (
        f"unexpected debug record(s): {[r.getMessage() for r in records]}"
    )
    # ... and the two branches must stay distinct: this path must not emit the
    # operator-actionable warning, or the routine case alerts alongside the real one.
    assert not [
        r for r in records if "no active memory type pack" in r.getMessage()
    ]


# ---------------------------------------------------------------------------
# Write path: the pack is the guard, not Pydantic
#
# Migration 0068 dropped `ck_memories_type_valid`, so `validate_memory_type`
# inside `create_memory` is now the only thing standing between an agent or an
# API caller and a `memories.type` the taxonomy cannot represent. These tests
# exist to pin *who* rejects -- see `test_create_memory_rejects_unknown_type`.
# ---------------------------------------------------------------------------


def test_memory_create_no_longer_whitelists_types():
    """Pydantic must construct any non-empty string.

    If this fails, the whitelist moved back into the schema and the pack check
    became unreachable -- which is the drift this task exists to remove.
    """
    from api.schemas.memory import MemoryCreate

    dto = MemoryCreate(type="totally_invalid", title="t")
    assert dto.type == "totally_invalid"


def test_memory_create_still_rejects_a_blank_type():
    """The emptiness rule stays in the schema; only the whitelist leaves.

    Whitespace is not in any pack, so this is not a substitute for the pack
    check -- it is the cheap shape rule that keeps a blank string from reaching
    the database as a NOT NULL-but-meaningless value.
    """
    import pydantic

    from api.schemas.memory import MemoryCreate

    for blank in ("", "   ", "\t\n"):
        with pytest.raises(pydantic.ValidationError):
            MemoryCreate(type=blank, title="t")


def test_memory_create_rejects_an_over_long_type():
    """`max_length=50` matches `memories.type`'s column width."""
    import pydantic

    from api.schemas.memory import MemoryCreate

    MemoryCreate(type="x" * 50, title="t")
    with pytest.raises(pydantic.ValidationError):
        MemoryCreate(type="x" * 51, title="t")


async def test_create_memory_rejects_unknown_type(db_session):
    """The rejection is the *pack's*, proven three ways.

    1. The DTO is built **outside** the ``raises`` block. Pydantic rejecting it
       there would raise before the service was ever called, and the pack check
       would be dead code behind it.
    2. What surfaces is a bare ``ValueError`` carrying `_invalid()`'s wording --
       the offending value and the pack it should have come from. A Pydantic
       error would be a ``ValidationError`` with a field-location message.
    3. The negative control: adding a pack that *contains* the value makes the
       identical call succeed and stamps that pack's slug on the row. Without
       this, assertion 2 is satisfiable by any error that happens to mention
       the word "career"; with it, the rejection provably tracks pack contents.
    """
    import pydantic

    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService

    dto = MemoryCreate(type="totally_invalid", title="t")  # (1)

    with pytest.raises(ValueError) as exc:  # (2)
        await MemoryService().create_memory(db_session, dto, tenant_id=None, user_id=None)
    assert not isinstance(exc.value, pydantic.ValidationError), (
        "the write path must reject via the pack registry, not Pydantic; got "
        f"{type(exc.value).__name__}: {exc.value}"
    )
    msg = str(exc.value)
    assert "totally_invalid" in msg, msg
    assert CAREER_PACK_SLUG in msg, msg

    db_session.add(
        MemoryTypePack(
            slug="extra",
            version=7,
            label="Extra",
            types=["totally_invalid"],
            is_active=True,
        )
    )
    await db_session.flush()

    mem = await MemoryService().create_memory(  # (3)
        db_session, dto, tenant_id=None, user_id=None, workspace_id=str(uuid.uuid4())
    )
    assert mem.type == "totally_invalid"
    assert mem.type_pack_slug == "extra"
    assert mem.type_pack_version == 7


async def test_create_memory_records_pack_provenance(db_session):
    """The row is attributable to the pack revision it was written under."""
    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService

    mem = await MemoryService().create_memory(
        db_session,
        MemoryCreate(type="insight", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    assert mem.type_pack_slug == CAREER_PACK_SLUG
    assert mem.type_pack_version == 1


async def test_create_memory_takes_provenance_from_the_second_pack(seeded_packs):
    """Provenance follows the matching pack -- no hard-coded ``"career"`` here.

    The brief's line was ``memory.type_pack_slug = "career"``, which would pass
    every other test in this file and then silently mislabel every row once a
    second domain ships. This is the test that fails for that.
    """
    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService

    seeded_packs.add(
        MemoryTypePack(
            slug="medical",
            version=3,
            label="Medical",
            types=["diagnosis"],
            is_active=True,
        )
    )
    await seeded_packs.flush()

    mem = await MemoryService().create_memory(
        seeded_packs,
        MemoryCreate(type="diagnosis", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    assert mem.type_pack_slug == "medical"
    assert mem.type_pack_version == 3


def test_enterprise_memory_types_is_still_the_same_sixteen():
    """Pack-derived, but it must reproduce the literal 16 exactly.

    The constants are now computed from ``CAREER_TYPES`` so they cannot drift
    from the registry. Deriving them is only safe if the derivation is *equal* to
    what the hard-coded set said, and that equality is exactly what this asserts
    -- set equality, not a count, so a rename that kept the cardinality fails.
    """
    from api.schemas.memory import CANONICAL_6, ENTERPRISE_MEMORY_TYPES

    assert {
        "project", "skill", "organization", "relationship", "event", "insight",
        "goal", "feedback", "decision", "knowledge", "reference", "contact",
        "financial", "health", "learning", "workflow",
    } == ENTERPRISE_MEMORY_TYPES
    assert len(ENTERPRISE_MEMORY_TYPES) == 16
    assert {
        "profile", "document", "career", "episodic", "preference", "working",
    } == CANONICAL_6
    assert len(CANONICAL_6) == 6
    assert CANONICAL_6.isdisjoint(ENTERPRISE_MEMORY_TYPES)
    # "note" and "fact" are legacy aliases, not enterprise additions.
    assert {"note", "fact"}.isdisjoint(ENTERPRISE_MEMORY_TYPES)
    # And the three partitions still tile the pack exactly: nothing lost, nothing
    # double-counted.
    assert CANONICAL_6 | ENTERPRISE_MEMORY_TYPES | {"note", "fact"} == set(CAREER_TYPES)


async def test_malformed_registry_result_degrades_instead_of_raising(seeded_packs, monkeypatch):
    """The write path must not be an outage trigger, whatever the driver returns.

    Surfaced by `test_cont_p12_agent_model_retrieval`, whose session double is an
    `AsyncMock`: `await db.execute(...)` answers with a mock whose `.scalars()`
    is a *coroutine*, so `result.scalars().all()` raised `AttributeError`. That
    used to escape `_active_packs_or_none`, because the rows were materialised
    after the savepoint rather than inside it -- so the one input the module
    documents as "must never break memory creation" was the one input that broke
    it. An unreadable registry has to degrade to the built-in pack whatever shape
    the failure takes.
    """
    from api.services import memory_type_packs as mod

    class _NoScalars:
        def scalars(self):
            return self

        def all(self):
            raise AttributeError("no such thing")

    async def _weird_result(*args, **kwargs):
        return _NoScalars()

    monkeypatch.setattr(seeded_packs, "execute", _weird_result)

    assert await mod.valid_types(seeded_packs) == set(CAREER_TYPES)
    assert await validate_memory_type(seeded_packs, "insight") == PackMatch(
        CAREER_PACK_SLUG, 1
    )
    with pytest.raises(ValueError):
        await validate_memory_type(seeded_packs, "not_a_type")


# ---------------------------------------------------------------------------
# Update and supersede: the same guard, and the two ways it must not fire
# ---------------------------------------------------------------------------


async def test_update_memory_rejects_unknown_type(db_session):
    """0068 dropped the CHECK, so `update_memory` has to enforce the pack itself.

    The negative control is the part that makes it a pack check rather than a
    blanket refusal: the identical call with a pack member succeeds.
    """
    from api.schemas.memory import MemoryCreate, MemoryUpdate
    from api.services.memory_service import MemoryService

    mem = await MemoryService().create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )

    with pytest.raises(MemoryTypeRejected):
        await MemoryService().update_memory(
            db_session, mem.id, MemoryUpdate(type="totally_invalid"), tenant_id=None
        )

    updated = await MemoryService().update_memory(
        db_session, mem.id, MemoryUpdate(type="insight"), tenant_id=None
    )
    assert updated.type == "insight"
    # Provenance follows the type: a row whose type moved to another pack
    # revision must not keep the previous revision stamped on it.
    assert updated.type_pack_slug == CAREER_PACK_SLUG
    assert updated.type_pack_version == 1


async def test_update_memory_that_does_not_set_type_is_not_revalidated(db_session):
    """A patch that omits `type` must not read the registry at all.

    This is the `exclude_unset` half of the guard. Memories written before the
    registry existed carry types no pack offers, and refusing to edit *those*
    rows would not be validation -- it would make real data unpatchable and
    report it as a client error. The row here is inserted directly, the way such
    a row got there: bypassing the write path entirely.
    """
    from api.models.schema import Memory
    from api.schemas.memory import MemoryUpdate
    from api.services.memory_service import MemoryService

    legacy = Memory(
        id=uuid.uuid4(),
        type="pre_registry_type",
        status="active",
        title="Old",
        content_hash="pre-registry-hash",
        size=0,
        workspace_id=uuid.uuid4(),
    )
    db_session.add(legacy)
    await db_session.flush()

    # The type on its own is illegal -- that is the premise, not a typo.
    with pytest.raises(MemoryTypeRejected):
        await MemoryService().update_memory(
            db_session, legacy.id, MemoryUpdate(type="pre_registry_type"), tenant_id=None
        )

    updated = await MemoryService().update_memory(
        db_session, legacy.id, MemoryUpdate(title="New"), tenant_id=None
    )
    assert updated.title == "New"
    assert updated.type == "pre_registry_type"


async def test_supersede_rejects_unknown_type_and_supersede_keeps_legacy_types(db_session):
    """A supersede is a write: it validates a remapped type, inherits a legacy one."""
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    svc = MemoryService()
    mem = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )

    with pytest.raises(MemoryTypeRejected):
        await svc.supersede_memory(
            db_session,
            mem.id,
            MemorySupersedeRequest(reason="remap the type", type="totally_invalid"),
            tenant_id=None,
        )
    # The refusal happens before the status flip, so nothing is half-applied.
    await db_session.refresh(mem)
    assert mem.status == "active"

    # An inherited type is not re-validated: superseding a pre-registry row works.
    from api.models.schema import Memory

    legacy = Memory(
        id=uuid.uuid4(),
        type="pre_registry_type",
        status="active",
        title="Old",
        content="old body",
        content_hash="pre-registry-hash",
        size=8,
        workspace_id=uuid.uuid4(),
    )
    db_session.add(legacy)
    await db_session.flush()

    successor = await svc.supersede_memory(
        db_session,
        legacy.id,
        MemorySupersedeRequest(reason="correcting the wording"),
        tenant_id=None,
    )
    assert successor is not None
    assert successor.type == "pre_registry_type"


# ---------------------------------------------------------------------------
# Supersede carries provenance forward (whole-branch review, finding I5)
# ---------------------------------------------------------------------------


async def test_same_type_supersede_carries_the_predecessors_pack(db_session):
    """A supersede that does not change the type must not blank the provenance.

    0068 backfilled every existing row to ``career``/1, so that stamp is the only
    thing making an old row attributable to a pack revision. Superseding that row
    without remapping the type used to pass ``type_pack_slug=None`` -- so the
    successor was the one link in the chain with no attributable vocabulary, and
    the edit a user makes most often (correct the content, keep the type) silently
    destroyed the provenance the correction was supposed to inherit.

    ``update_memory`` on this same input re-stamps ``career``/1, which is what
    makes the divergence a bug rather than an asymmetry: two writers of one field
    disagreeing on identical input is unhandled, not decided.
    """
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    ws = str(uuid.uuid4())
    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=ws,
    )
    assert original.type_pack_slug == CAREER_PACK_SLUG
    assert original.type_pack_version == 1

    successor = await svc.supersede_memory(
        db_session,
        original.id,
        MemorySupersedeRequest(reason="fixed the wording"),
        tenant_id=None,
    )

    assert successor is not None
    assert successor.type == "note", "precondition: the type really was inherited"
    assert successor.type_pack_slug == CAREER_PACK_SLUG, (
        "an unchanged type must carry the predecessor's pack forward; blanking it "
        "makes the successor unattributable"
    )
    assert successor.type_pack_version == 1


async def test_same_type_supersede_with_an_explicitly_restated_type(db_session):
    """``dto.type`` equal to the old type is the same case and must behave the same.

    Separate from the test above because it is a different branch of the guard:
    the type is *supplied*, so the value is live input rather than an absence, and
    an implementation that only looked at "was `type` omitted" would handle one
    of these two and not the other. Both must keep the predecessor's stamp.
    """
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="insight", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )

    successor = await svc.supersede_memory(
        db_session,
        original.id,
        MemorySupersedeRequest(reason="reaffirmed", type="insight"),
        tenant_id=None,
    )

    assert successor.type_pack_slug == CAREER_PACK_SLUG
    assert successor.type_pack_version == 1


async def test_remapped_supersede_takes_the_new_packs_provenance(seeded_packs, db_session):
    """When the caller *does* remap the type, the new pack wins over the old one.

    The counterpart to the two inheritance tests: carrying the predecessor's stamp
    forward unconditionally would freeze every correction to the vocabulary it was
    written under, which is the opposite error.
    """
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    # A second, active pack at version 3, so "the new pack" is distinguishable
    # from both the predecessor's slug and the career version.
    db_session.add(
        MemoryTypePack(
            slug="clinical",
            version=3,
            label="Clinical",
            types=["diagnosis", "intake"],
            is_active=True,
        )
    )
    await db_session.flush()

    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )

    successor = await svc.supersede_memory(
        db_session,
        original.id,
        MemorySupersedeRequest(reason="this is a clinical intake now", type="intake"),
        tenant_id=None,
    )

    assert successor.type_pack_slug == "clinical"
    assert successor.type_pack_version == 3


async def test_supersede_of_a_row_with_no_provenance_adds_none(db_session):
    """Inheriting NULL stays NULL -- there is nothing to inherit from.

    A pre-0068 row has no pack stamp, and guessing one would attribute a type to
    a pack revision that never authorised it. Asserted because the alternative
    (defaulting to the built-in career pack, which is what the registry fallback
    uses) looks harmless and is exactly the fabricated provenance I3 is about.
    """
    from api.models.schema import Memory
    from api.schemas.memory import MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    legacy = Memory(
        id=uuid.uuid4(),
        type="pre_registry_type",
        status="active",
        title="Old",
        content="old body",
        content_hash="pre-registry-hash",
        size=8,
        workspace_id=uuid.uuid4(),
    )
    db_session.add(legacy)
    await db_session.flush()

    successor = await MemoryService().supersede_memory(
        db_session,
        legacy.id,
        MemorySupersedeRequest(reason="correcting the wording"),
        tenant_id=None,
    )

    assert successor.type_pack_slug is None
    assert successor.type_pack_version is None


# ---------------------------------------------------------------------------
# The ledger records which pack authorised the change (finding I3)
# ---------------------------------------------------------------------------


async def test_update_ledger_row_names_the_authorising_pack(db_session):
    """A taxonomy remap must record the pack revision that legalised it.

    Without this the ledger says *that* a type changed but not *what made it
    legal*, and the second half stops being recoverable the moment a pack is
    re-versioned -- at which point an append-only provenance table that cannot
    name the authority is indistinguishable from one that never checked. The spec
    promised this (``metadata_`` on ledger rows) and 0068 delivered nothing, so
    the promise was quietly dropped instead of being kept.
    """
    from api.models.schema import MemoryTaxonomyLedger
    from api.schemas.memory import MemoryCreate, MemoryUpdate
    from api.services.memory_service import MemoryService

    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    await svc.update_memory(
        db_session, original.id, MemoryUpdate(type="insight"), tenant_id=None
    )

    rows = (
        await db_session.execute(
            select(MemoryTaxonomyLedger).where(
                MemoryTaxonomyLedger.memory_id == original.id
            )
        )
    ).scalars().all()
    assert len(rows) == 1, "a type remap must produce exactly one ledger row"
    assert rows[0].metadata_ == {
        "type_pack_slug": CAREER_PACK_SLUG,
        "type_pack_version": 1,
    }, (
        "the ledger must name the pack and revision that authorised the remap; "
        f"got {rows[0].metadata_!r}"
    )


async def test_supersede_ledger_row_names_the_authorising_pack(db_session):
    """The second writer threads the same two facts.

    ``_record_taxonomy_change`` has two callers and only one of them passing the
    pack would leave the ledger's completeness dependent on which write path
    happened to be exercised.
    """
    from api.models.schema import MemoryTaxonomyLedger
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    await svc.supersede_memory(
        db_session,
        original.id,
        MemorySupersedeRequest(reason="remap", type="insight"),
        tenant_id=None,
    )

    rows = (
        await db_session.execute(
            select(MemoryTaxonomyLedger).where(
                MemoryTaxonomyLedger.memory_id == original.id
            )
        )
    ).scalars().all()
    assert len(rows) == 1
    assert rows[0].metadata_ == {
        "type_pack_slug": CAREER_PACK_SLUG,
        "type_pack_version": 1,
    }


async def test_ledger_pack_reference_comes_from_the_matching_pack(seeded_packs, db_session):
    """The recorded slug must be the pack that accepted the type, not a literal.

    Asserting ``career``/1 everywhere would pass with a hard-coded slug stamped
    into the ledger -- which is the failure this whole task is about, one column
    over. A second pack has to move the recorded slug with it.
    """
    from api.models.schema import MemoryTaxonomyLedger
    from api.schemas.memory import MemoryCreate, MemorySupersedeRequest
    from api.services.memory_service import MemoryService

    db_session.add(
        MemoryTypePack(
            slug="clinical",
            version=4,
            label="Clinical",
            types=["diagnosis", "intake"],
            is_active=True,
        )
    )
    await db_session.flush()

    svc = MemoryService()
    original = await svc.create_memory(
        db_session,
        MemoryCreate(type="note", title="t", content="body"),
        tenant_id=None,
        user_id=None,
        workspace_id=str(uuid.uuid4()),
    )
    await svc.supersede_memory(
        db_session,
        original.id,
        MemorySupersedeRequest(reason="remap", type="intake"),
        tenant_id=None,
    )

    row = (
        await db_session.execute(
            select(MemoryTaxonomyLedger).where(
                MemoryTaxonomyLedger.memory_id == original.id
            )
        )
    ).scalar_one()
    assert row.metadata_ == {"type_pack_slug": "clinical", "type_pack_version": 4}


def test_migration_adds_and_drops_the_ledger_metadata_column():
    """The column has to exist in the migration, or the ORM writes nothing.

    Both directions asserted: an ``ADD COLUMN`` in ``upgrade`` without a matching
    ``DROP COLUMN`` in ``downgrade`` would leave a column describing a pack system
    a rollback has just removed.
    """
    _, up = _render("upgrade", table_present=False)
    flat_up = [" ".join(s.split()) for s in up]
    assert _one(
        flat_up, "ALTER TABLE memory_taxonomy_ledger ADD COLUMN"
    ) == (
        "ALTER TABLE memory_taxonomy_ledger ADD COLUMN IF NOT EXISTS metadata JSONB"
    ), "upgrade must add a nullable JSONB metadata column to memory_taxonomy_ledger"

    _, down = _render("downgrade", table_present=True)
    flat_down = [" ".join(s.split()) for s in down]
    assert _one(
        flat_down, "ALTER TABLE memory_taxonomy_ledger DROP COLUMN"
    ) == "ALTER TABLE memory_taxonomy_ledger DROP COLUMN IF EXISTS metadata"


# ---------------------------------------------------------------------------
# Expand-contract provenance: the version follows the pack that accepted the type
# ---------------------------------------------------------------------------


async def test_taxonomy_version_follows_the_matching_pack(seeded_packs):
    """A second domain's type is stamped 2, not the 1 the fallback implied.

    ``taxonomy_version`` used to be derived from ``ENTERPRISE_MEMORY_TYPES``,
    which is computed from the *built-in fallback* vocabulary. A type a second
    pack contributes is in neither the canonical 6 nor the career remainder, so
    the old expression labelled it legacy-canonical (1) -- an expand-contract
    provenance claim about a type that did not exist when the taxonomy was
    frozen. Validation and stamping then answered from two different sources.

    The two career assertions are the regression guard: canonical 6 stays 1 and
    an enterprise addition stays 2, so this is a fix and not a remapping of the
    whole column.
    """
    from api.schemas.memory import MemoryCreate
    from api.services.memory_service import MemoryService

    seeded_packs.add(
        MemoryTypePack(
            slug="medical",
            version=3,
            label="Medical",
            types=["diagnosis", "profile"],
            is_active=True,
        )
    )
    await seeded_packs.flush()

    svc = MemoryService()

    async def stamp(memory_type: str) -> int:
        mem = await svc.create_memory(
            seeded_packs,
            MemoryCreate(type=memory_type, title="t", content="body"),
            tenant_id=None,
            user_id=None,
            workspace_id=str(uuid.uuid4()),
        )
        return mem.taxonomy_version

    # The failure this fixes: legal in the medical pack, stamped legacy.
    assert await stamp("diagnosis") == 2
    # Same type name, different pack -- still 2, because the answer now comes
    # from the pack that accepted it rather than from a career-only constant.
    assert await stamp("profile") == 1
    # Unchanged behaviour for the career pack itself.
    assert await stamp("insight") == 2


async def test_pack_match_carries_the_vocabulary_it_matched(seeded_packs):
    """`PackMatch.types` is what makes the derivation above possible.

    Identity stays (slug, version) -- `PackMatch(CAREER_PACK_SLUG, 1)` must keep
    equalling a real career match, which is why `types` is excluded from
    comparison -- while the vocabulary rides along for callers that need to ask
    whether a value is part of *this* pack's additive remainder.
    """
    match = await validate_memory_type(seeded_packs, "insight")
    assert match == PackMatch(CAREER_PACK_SLUG, 1)
    assert match.types == frozenset(CAREER_TYPES)
    assert "insight" in match.enterprise_types
    assert "profile" not in match.enterprise_types


# ---------------------------------------------------------------------------
# Offline rendering guard
#
# Everything above exercises the registry through the ORM. Everything below
# executes the migration itself and asserts on the SQL it emits. `upgrade()`
# returns early off PostgreSQL, so without these the migration's SQL is never
# validated by any test in this repository.
# ---------------------------------------------------------------------------


class _StubResult:
    """Just enough of a SQLAlchemy result for the migration's read queries."""

    def __init__(self, value=None, rows=()):
        self._value = value
        self._rows = rows
        self.rowcount = 0

    def scalar_one(self):
        return self._value

    def fetchall(self):
        return self._rows


class _StubBind:
    """Stands in for ``op.get_bind()`` offline: records SQL, answers queries.

    Answers come from ``_StubBind.catalogue`` so a test can hand ``upgrade()`` a
    database in a specific state -- protected, unprotected, or missing a table --
    and then assert on whether ``_assert_coverage`` noticed.
    """

    def __init__(self, catalogue=None):
        self.dialect = sa.dialects.postgresql.dialect()
        self.emitted: list[str] = []
        self.catalogue = (
            catalogue if catalogue is not None else {"tables": ["memories", "memory_type_packs"]}
        )

    def execute(self, statement, parameters=None):
        sql = str(statement)
        self.emitted.append(sql)
        flat = " ".join(sql.split())
        low = flat.lower()

        if "insert into memory_type_packs" in low:
            return _StubResult(rows=[])
        if low.startswith("update memories"):
            return _StubResult(rows=[])
        if "pg_policies" in low and "policyname" in low:
            # Policy-probe during upgrade: report absent so CREATE POLICY runs.
            return _StubResult(value=0)
        if "information_schema.tables" in low:
            return _StubResult(rows=[(t,) for t in self.catalogue["tables"]])
        if "relrowsecurity" in low:
            state = self._state_for(flat)
            return _StubResult(rows=[(state[0], state[1])])
        if "count(*) from pg_policies" in low:
            return _StubResult(rows=[(self._state_for(flat)[2],)])
        if "group by" in low:
            return _StubResult(value=2, rows=[("career", 1), ("insight", 1)])
        if "select count(*) from memories" in low:
            return _StubResult(value=2)
        return _StubResult()

    def _state_for(self, flat_sql: str) -> tuple[bool, bool, int]:
        """(rls_enabled, rls_forced, policy_count) for whichever table is asked about."""
        state = self.catalogue.get("state", {})
        for table, flags in state.items():
            if f"'{table}'" in flat_sql:
                return flags
        return (True, True, 1)


class _StubInspector:
    """``sa.inspect`` is impossible offline; answer from a flag the test sets."""

    present = False

    def has_table(self, name):
        return _StubInspector.present

    def get_indexes(self, name):
        return []


def _render(fn_name: str, *, table_present: bool, catalogue=None) -> tuple[str, list[str]]:
    """Execute 0068's ``upgrade()``/``downgrade()`` offline; return DDL + SQL.

    Two outputs because they arrive by different routes: ``op.create_table`` and
    ``op.drop_table`` go to the offline output buffer as real PostgreSQL-rendered
    DDL, while everything routed through ``_safe()`` or a bare ``bind.execute``
    reaches the stub bind as raw SQL text.
    """
    from alembic.config import Config
    from alembic.operations import Operations
    from alembic.runtime.environment import EnvironmentContext

    from alembic import op

    module = _load_migration_module()
    bind = _StubBind(catalogue)
    buffer = io.StringIO()
    env = EnvironmentContext(Config(), None, as_sql=True, output_buffer=buffer, literal_binds=True)
    env.configure(
        connection=None,
        dialect_name="postgresql",
        output_buffer=buffer,
        literal_binds=True,
    )

    real_get_bind = op.get_bind
    real_inspect = sa.inspect
    _StubInspector.present = table_present
    op.get_bind = lambda: bind
    sa.inspect = lambda obj: _StubInspector()
    try:
        # Offline mode: the Operations proxy has to be established by hand, since
        # `begin_transaction()` is a nullcontext when there is no connection.
        with Operations.context(env.get_context()):
            getattr(module, fn_name)()
    finally:
        op.get_bind = real_get_bind
        sa.inspect = real_inspect
    return buffer.getvalue(), bind.emitted


def _one(emitted: list[str], prefix: str) -> str:
    """The single statement starting with ``prefix`` -- exactly one must exist."""
    hits = [" ".join(sql.split()) for sql in emitted if " ".join(sql.split()).startswith(prefix)]
    assert len(hits) == 1, f"expected exactly one {prefix!r} statement, got {len(hits)}: {hits}"
    return hits[0]


def test_emits_create_table_with_the_agreed_shape():
    """The `op.create_table` DDL: columns, key, and both constraints."""
    ddl, _ = _render("upgrade", table_present=False)

    create = " ".join(ddl.split())
    assert create.startswith("CREATE TABLE memory_type_packs (")
    assert create.endswith(");"), f"statement is not a single terminated CREATE: {create!r}"
    for fragment in (
        "id UUID DEFAULT gen_random_uuid() NOT NULL",
        "slug VARCHAR(64) NOT NULL",
        "version INTEGER DEFAULT 1 NOT NULL",
        "label VARCHAR(100) NOT NULL",
        "types JSONB NOT NULL",
        "is_active BOOLEAN DEFAULT true NOT NULL",
        "created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL",
        "PRIMARY KEY (id)",
        "CONSTRAINT uq_memory_type_packs_slug UNIQUE (slug)",
        "CONSTRAINT ck_memory_type_packs_types_nonempty CHECK (jsonb_array_length(types) > 0)",
    ):
        assert fragment in create, f"missing from CREATE TABLE: {fragment!r}"

    # `ON CONFLICT (slug) DO NOTHING` in the seed depends on this being a real
    # unique constraint, not merely an index.
    assert "UNIQUE (slug)" in create


def _split_top_level(text: str) -> list[str]:
    """Split a SQL value list on commas that are not inside a single-quoted string.

    Counting commas in the seed is worthless without this: the JSON payload
    contains 23 of them, which is exactly why the arity has to be measured
    structurally instead of by ``str.count``.
    """
    parts: list[str] = []
    buf: list[str] = []
    in_quotes = False
    for ch in text:
        if ch == "'":
            in_quotes = not in_quotes
        if ch == "," and not in_quotes:
            parts.append("".join(buf).strip())
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf).strip())
    return parts


def test_emits_seed_statement_with_matching_arity():
    """The seed: one statement, five values for five columns, valid JSONB payload.

    Both halves of that matter. A *count* mismatch is the "INSERT has more
    expressions than target columns" failure the original defect would have
    produced at deploy, and it is invisible unless column count and value count
    are compared. Positional agreement matters just as much: the payload is the
    value for ``types``, the 4th column, so a reordering of the column list would
    write the vocabulary into ``label`` and every pack would read as unlabelled.
    """
    _, emitted = _render("upgrade", table_present=False)
    insert = _one(emitted, "INSERT INTO memory_type_packs")

    assert "INSERT INTO memory_type_packs (slug, version, label, types, is_active)" in insert
    assert "::jsonb" in insert, "the JSON payload must be cast to jsonb"
    assert "ON CONFLICT (slug) DO NOTHING" in insert, "a re-run must not error or reset the pack"

    start = insert.index("VALUES") + len("VALUES")
    value_list = insert[insert.index("(", start) + 1 : insert.index(")", start)]
    items = _split_top_level(value_list)

    columns = insert[insert.index("(") + 1 : insert.index(")", insert.index("("))].split(", ")
    assert len(items) == len(columns) == 5, f"arity mismatch: {columns!r} <- {items!r}"
    assert items[:3] == ["'career'", "1", "'Career'"]
    assert items[4] == "true"

    # `types` is the 4th column, so the payload must be the 4th value.
    payload = _load_migration_module()._type_list_sql()
    assert columns[3] == "types"
    assert items[3] == f"'{payload}'::jsonb", "the payload must be one quoted JSONB literal"

    # And that literal is a JSON document of exactly the pack, in order.
    json_blob = items[3][1 : items[3].index("'::jsonb")]
    assert tuple(json.loads(json_blob.replace("''", "'"))) == CAREER_TYPES
    assert len(json.loads(json_blob.replace("''", "'"))) == 24


def test_emits_rls_and_policy_with_service_role_shape():
    """Both RLS flags and the service-role policy, in the 0053 spelling."""
    _, emitted = _render("upgrade", table_present=False)
    flat = [" ".join(sql.split()) for sql in emitted]

    assert "ALTER TABLE memory_type_packs ENABLE ROW LEVEL SECURITY" in flat
    assert "ALTER TABLE memory_type_packs FORCE ROW LEVEL SECURITY" in flat, (
        "0066's invariant requires FORCE; without it the owner bypasses the policy"
    )

    policy = _one(flat, "CREATE POLICY")
    assert policy.startswith("CREATE POLICY p_memory_type_packs_service ON memory_type_packs")
    assert "FOR ALL" in policy
    for role in ("service_role", "postgres", "vaeloom_app"):
        assert role in policy, f"policy must grant {role}"
    assert "USING (true) WITH CHECK (true)" in policy
    # Every statement except the two catalogue reads and the backfill must sit
    # inside a savepoint, or a partial failure poisons the migration.
    assert flat.count("SAVEPOINT sp_0068") == flat.count("RELEASE SAVEPOINT sp_0068")


def test_emits_backfill_before_dropping_the_check():
    """Ordering is the blast-radius control: evidence and backfill precede the drop."""
    _, emitted = _render("upgrade", table_present=False)
    flat = [" ".join(sql.split()) for sql in emitted]

    add_cols = next(i for i, s in enumerate(flat) if "ADD COLUMN IF NOT EXISTS type_pack_slug" in s)
    add_ver = next(i for i, s in enumerate(flat) if "ADD COLUMN IF NOT EXISTS type_pack_version" in s)
    backfill = next(i for i, s in enumerate(flat) if s.startswith("UPDATE memories SET type_pack_slug"))
    evidence = next(i for i, s in enumerate(flat) if "SELECT type, count(*) FROM memories" in s)
    drop = next(i for i, s in enumerate(flat) if "DROP CONSTRAINT IF EXISTS ck_memories_type_valid" in s)

    assert add_cols < backfill < drop, "the provenance columns must exist before the CHECK goes"
    assert add_ver < backfill < drop
    assert evidence < drop, "the pre-drop evidence must be gathered before the CHECK goes"
    assert "WHERE type_pack_slug IS NULL" in flat[backfill], (
        "a re-run must not stamp rows written under a different pack"
    )


def test_downgrade_restores_the_check_constraint_from_0027():
    """The reverse path must re-add 0027's constraint verbatim, and drop in order."""
    source_0027 = (
        _MIGRATION.parents[0] / "0027_memory_taxonomy_expand_contract.py"
    ).read_text(encoding="utf-8")
    start = source_0027.index("ADD CONSTRAINT ck_memories_type_valid")
    original = tuple(re.findall(r"'([a-z_]+)'", source_0027[start : source_0027.index("))", start)]))

    _, emitted = _render("downgrade", table_present=True)
    flat = [" ".join(sql.split()) for sql in emitted]
    restored = _one(flat, "ALTER TABLE memories ADD CONSTRAINT")

    assert restored.startswith("ALTER TABLE memories ADD CONSTRAINT ck_memories_type_valid CHECK (")
    assert tuple(re.findall(r"'([a-z_]+)'", restored)) == original, (
        "the restored CHECK must be 0027's literal set, in 0027's order"
    )
    assert original == CAREER_TYPES

    add = next(i for i, s in enumerate(flat) if "ADD CONSTRAINT ck_memories_type_valid" in s)
    drop_cols = next(i for i, s in enumerate(flat) if "DROP COLUMN IF EXISTS type_pack_version" in s)
    drop_pol = next(i for i, s in enumerate(flat) if "DROP POLICY IF EXISTS p_memory_type_packs_service" in s)
    assert add < drop_cols < drop_pol, (
        "the CHECK comes back before this revision's objects go, or there is a "
        "window where memories.type is unconstrained and unvalidated"
    )


def test_downgrade_check_constraint_sql_semantics():
    """Verify the restored CHECK constraint syntax and membership boundary.

    Proves that the CHECK predicate restored by downgrade() enforces the exact
    membership boundary: all 24 canonical career types evaluate to valid, while any
    unregistered type (such as one valid only under a second domain pack) is rejected.
    """
    mod = _load_migration_module()
    check_sql = mod._CHECK_SQL
    assert "CHECK (type IN (" in check_sql
    types_in_sql = tuple(re.findall(r"'([a-z_]+)'", check_sql))
    assert types_in_sql == CAREER_TYPES

    non_career_candidates = ("custom_type", "finance_v2", "medical_record", "unregistered")
    for bad_type in non_career_candidates:
        assert bad_type not in types_in_sql


def test_assert_coverage_passes_when_every_table_is_protected():
    catalogue = {"tables": ["memories", "memory_taxonomy_ledger", "memory_type_packs"]}
    _, emitted = _render("upgrade", table_present=False, catalogue=catalogue)
    # upgrade() completes rather than raising: every table in the catalogue reports
    # RLS enabled, forced, and policed, so the guard passes. The parametrised
    # tests below are where it must fail.
    assert [s for s in emitted if "information_schema.tables" in s], (
        "0066 already ran; if 0068 stopped asserting coverage this query goes away"
    )
    probed = " ".join(
        s for s in emitted if "relrowsecurity" in s or "pg_policies where tablename" in s.lower()
    )
    for fragment in (
        "c.relrowsecurity",
        "c.relforcerowsecurity",
        "relname = 'memories'",
        "relname = 'memory_type_packs'",
        "count(*) FROM pg_policies WHERE tablename = 'memories'",
    ):
        assert fragment in probed, f"coverage probe lost: {fragment!r}"


@pytest.mark.parametrize(
    ("table", "state", "expected"),
    [
        ("memories", (False, True, 1), "NOT enabled"),
        ("memories", (True, False, 1), "NOT FORCED"),
        ("memory_type_packs", (True, True, 0), "no RLS policy"),
    ],
)
def test_assert_coverage_fails_when_a_table_is_unprotected(table, state, expected):
    """A skipped statement must fail the deploy, which is the guard's whole point.

    ``0066`` can no longer see ``memory_type_packs`` -- it runs before this
    revision creates the table -- so ``0068`` repeats the assertion. These are the
    three shapes of violation ``0066`` is written to catch, driven through the
    real ``_assert_coverage`` SQL.
    """
    catalogue = {
        "tables": ["memories", "memory_type_packs"],
        "state": {table: state},
    }
    module = _load_migration_module()
    with pytest.raises(RuntimeError, match="incomplete RLS coverage") as exc:
        module._assert_coverage(_StubBind(catalogue))
    assert expected in str(exc.value), str(exc.value)


# ---------------------------------------------------------------------------
# The drift guard: the frontend union is generated from the pack, and checked
#
# Everything above guards the backend registry. Nothing above could have caught
# the failure that actually happened: the TypeScript union was a *separate*
# hand-maintained list, so nothing in this repository ever compared the two.
# When the pack changed, the union did not, and the symptom was five of seven
# UI type filters quietly matching nothing while every test stayed green.
#
# So the check below is deliberately placed here, in the backend suite, reading
# the frontend's committed artefact off disk. It reads a file rather than
# calling the generator, because the artefact is what the web app actually
# compiles against -- verifying the generator would prove only that a generator
# is self-consistent, which is not the failure that occurred.
# ---------------------------------------------------------------------------

_REPO = pathlib.Path(__file__).resolve().parents[3]
_GENERATOR = _REPO / "scripts" / "gen_memory_type_union.py"
_GENERATED_UNION = _REPO / "packages" / "shared-types" / "src" / "types" / "memory.generated.ts"

# Only the union's own member lines, i.e. lines of the emitted
# `  | 'member'` form. Matching union members rather than every quoted word in
# the file is what keeps the header comment from being able to satisfy or break
# this check: the brief's own regex (`'([a-z_]+)'` over the whole text) would
# have counted an identifier mentioned in prose as a union member.
#
# The member body is `[^']+`, not `[a-z_]+`. Nothing in the domain constrains a
# pack member's characters -- there is no `pattern=` on `schemas/memory.py` -- so
# a character class narrower than "anything but a quote" turns a future
# digit-, hyphen- or capital-bearing member into a spurious `only-in-pack` alarm.
# That still fails loudly, which is the right *direction*, but a guard that cries
# wolf on a legitimate pack teaches people to ignore it.
#
# Two things this must not become:
#
# * `[^']+` will happily swallow a quote-free line that is not a member, so the
#   anchors stay anchored -- `^\s*\|\s*'...'`. Only a line that genuinely starts
#   with the union pipe counts, and no line of the emitted header does.
# * The trailing `;?` is load-bearing, not decoration: the last member is written
#   `| 'workflow';`, and a regex that forgot that silently reports the final
#   member as missing -- which this guard did, on its own first green run.
_UNION_MEMBER = re.compile(r"^\s*\|\s*'([^']+)'\s*;?\s*$", re.MULTILINE)


def _generated_members(text: str) -> list[str]:
    """The union members in the generated file, in the order they are written.

    Asserts non-empty on purpose. The obvious implementation of the guard --
    compare the parsed set to the pack -- treats "parsed nothing" as
    ``set()``, which is unequal to a 24-member pack and so does fail. It fails
    *incidentally*, and it fails with a message that blames drift: a file whose
    union got reformatted or truncated would report ``only-in-pack=[all 24]``,
    sending the reader to regenerate a file that regenerating cannot fix. Failing
    on the parse itself names the real cause.
    """
    members = _UNION_MEMBER.findall(text)
    assert members, (
        "no union members parsed out of the generated file. Expected lines of the "
        "form `  | 'member'`. This is not drift: the file was almost certainly "
        "reformatted (union collapsed onto one line, pipes dropped, quotes "
        "flipped) or truncated. Regenerate it with "
        "`python scripts/gen_memory_type_union.py`, and if that does not fix it, "
        "check `.prettierignore` still ignores `*.generated.ts`."
    )
    return members


def _generated_text() -> str:
    assert _GENERATED_UNION.exists(), (
        f"generated union file is missing at {_GENERATED_UNION}; run "
        "`python scripts/gen_memory_type_union.py`"
    )
    return _GENERATED_UNION.read_text(encoding="utf-8")


def test_generated_union_matches_career_pack():
    """The drift guard -- its absence is why frontend and backend diverged before.

    Set equality, and the failure message names *both* directions, because the
    two mean opposite things to whoever has to fix it: a member only in the pack
    is a type the UI cannot send or filter by (the original bug), while a member
    only in the generated file is a type the UI offers that the backend will
    reject on write. Reporting only the symmetric difference, or only the
    counts, makes the reader re-derive which side is wrong by hand.
    """
    found = set(_generated_members(_generated_text()))
    pack = set(CAREER_TYPES)
    assert found == pack, (
        "generated union drifted from the career pack: "
        f"only-in-generated={sorted(found - pack)} "
        f"only-in-pack={sorted(pack - found)}"
    )


def test_generated_union_preserves_the_pack_order():
    """A sorted union satisfies the set check above and still violates the contract.

    Migration 0068 seeds the pack table from this order, so order is not
    cosmetic. Without this test, "sort it for tidiness" would pass the drift
    guard, reorder every seeded database on the next migration run, and produce
    no test failure anywhere.
    """
    assert tuple(_generated_members(_generated_text())) == tuple(CAREER_TYPES)


def test_generator_check_mode_passes_on_the_committed_file_and_fails_on_drift(tmp_path):
    """``--check`` is only a gate if it is a *false* when the file is stale.

    Asserting the happy path alone would be satisfied by a script whose check
    always exits 0, which is the failure mode a freshness gate is least likely
    to be caught by -- so both directions are driven here. The drift is a
    renamed member rather than a deleted one, because that is the shape a real
    taxonomy change produces and the one a naive count check would miss.
    """
    import subprocess
    import sys

    # Happy path: the committed artefact, exactly as it sits in the tree.
    proc = subprocess.run(
        [sys.executable, str(_GENERATOR), "--check"],
        capture_output=True,
        text=True,
        cwd=str(_REPO),
    )
    assert proc.returncode == 0, f"--check rejected a fresh file: {proc.stdout}{proc.stderr}"

    # Negative path: the same bytes with one member renamed. Driven through the
    # real ``main()`` with ``OUTPUT`` repointed at a sandbox file, so proving the
    # failure cannot write a drifted artefact into the tree.
    drifted = tmp_path / "memory.generated.ts"
    drifted.write_bytes(
        _GENERATED_UNION.read_text(encoding="utf-8")
        .replace("'insight'", "'insite'", 1)
        .encode("utf-8")
    )
    proc = subprocess.run(
        [sys.executable, "-c", _CHECK_AGAINST, str(_GENERATOR), str(drifted)],
        capture_output=True,
        text=True,
        cwd=str(_REPO),
    )
    assert proc.returncode != 0, "--check accepted a drifted file; the CI gate is inert"
    assert "stale" in proc.stderr, f"a stale file must be named as such: {proc.stderr}"
    # And it must say what changed, not merely that something did.
    assert "-  | 'insite'" in proc.stderr and "+  | 'insight'" in proc.stderr, (
        f"the diff must name the drifted member: {proc.stderr}"
    )


# Imports the generator by path (it lives in scripts/, not an importable package)
# and repoints its OUTPUT, so the negative case above can never write into the
# tree. Kept as source rather than a fixture because it has to run in a child
# process: `--check` is CI's entry point, and testing it in-process would not be
# testing the thing CI runs.
_CHECK_AGAINST = """
import importlib.util, sys
spec = importlib.util.spec_from_file_location("gen_union", sys.argv[1])
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
from pathlib import Path
mod.OUTPUT = Path(sys.argv[2])
sys.exit(mod.main(["--check"]))
"""


def _load_generator():
    """Import the generator by path, in this process, as a plain import.

    ``importlib`` rather than ``sys.path`` surgery because the module is not on
    any import path and is not a package member. Returning a fresh module object
    each call keeps the two tests below independent: neither can leave a patched
    ``subprocess`` behind for the other.
    """
    spec = importlib.util.spec_from_file_location("gen_memory_type_union", _GENERATOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize(
    "member",
    ["skill_2", "job-search", "Profile", "TYPE_42_x", "9lives", "a-b-c-d"],
)
def test_generated_member_parse_accepts_any_character_shape(member):
    """A pack member is parsed by shape, not by a hand-written character class.

    Nothing in the domain constrains a member's characters -- there is no
    ``pattern=`` on ``schemas/memory.py`` -- so a future ``skill_2`` or
    ``job-search`` must read as a member. Under the old ``[a-z_]+`` class such a
    member simply did not match, and the guard reported it as missing from the
    *generated* file: drift pointing the wrong way, on a pack that was correct.
    """
    text = f"export type GeneratedMemoryType =\n  | '{member}'\n  | 'profile';\n"
    assert _generated_members(text) == [member, "profile"]


@pytest.mark.parametrize(
    ("case", "text"),
    [
        ("empty file", ""),
        (
            "header only, union absent",
            "/** GENERATED FILE -- DO NOT EDIT BY HAND. */\n"
            "export type GeneratedMemoryType = never;\n",
        ),
        (
            "union collapsed onto one line",
            "export type GeneratedMemoryType = 'profile' | 'document' | 'career';\n",
        ),
        (
            "pipes dropped, members on their own lines",
            "export type GeneratedMemoryType =\n  'profile'\n  'document';\n",
        ),
        (
            "members double-quoted by a reformatter",
            'export type GeneratedMemoryType =\n  | "profile"\n  | "document";\n',
        ),
    ],
)
def test_generated_member_parse_rejects_an_empty_or_unparseable_union(case, text):
    """An empty parse is a failure, never a silent "no drift".

    This is the negative control for the relaxed character class. ``[^']+`` is
    permissive by construction, so the only thing standing between "lenient" and
    "parses garbage into nothing" is that parsing nothing is itself an error. Both
    cases matter:

    * a truncated or collapsed union, and
    * a *quote-style* flip by a reformatter.

    The second is the one this task's Important finding is about. A reformat that
    changed ``'profile'`` to ``"profile"`` parses to nothing, and without this
    assertion that would read as ``set()`` -- which happens to differ from the
    pack and so still fails, but with a message blaming drift and pointing at a
    regeneration that cannot possibly help.
    """
    with pytest.raises(AssertionError, match="no union members"):
        _generated_members(text)


def test_version_guard_fires_only_when_run_as_a_script():
    """Minor 2: the interpreter self-guard must not run at import.

    It used to sit at module scope and ``raise SystemExit`` under any interpreter
    but the pinned 3.12, which contradicted this module's own docstring promise
    that ``render`` is importable without the API's dependency tree. That promise
    held only because the repo pins 3.12 -- so the bug was latent rather than
    live, and a latent bug in a docstring/contract mismatch is exactly the kind
    that becomes a real outage the first time someone runs tooling on 3.11.

    Both halves are pinned here, which is what makes the split a contract rather
    than a coincidence: importing under a wrong version must not re-exec, and
    running under a wrong version still must.
    """
    gen = _load_generator()
    assert gen.PINNED_PYTHON == (3, 12)

    # Importing is always safe, whatever the interpreter.
    for version in ((3, 12, 0), (3, 11, 0), (3, 14, 0)):
        assert gen._needs_reexec(version, "gen_memory_type_union") is False, version
    # Running under the pinned interpreter proceeds.
    assert gen._needs_reexec((3, 12, 9), "__main__") is False
    # Running under any other interpreter re-execs.
    assert gen._needs_reexec((3, 11, 0), "__main__") is True
    assert gen._needs_reexec((3, 14, 0), "__main__") is True


def test_generator_import_does_not_re_exec_or_exit():
    """The guard above is a unit test; this drives the real import on a *wrong* version.

    Without the ``sys.version_info`` patch this test is vacuous: the repo pins
    3.12, so the version guard does not fire and the test would pass against the
    old module-scope code unchanged -- a test that cannot fail is worse than no
    test, because it reads as coverage. ``sys.version_info`` is a plain tuple
    attribute and is assignable, so the wrong-interpreter case can actually be
    reproduced here rather than deferred to a machine that happens to run 3.11.

    Every import the module body performs is done *before* the patch, so the only
    code that observes the fake version is the version guard itself.
    """
    import subprocess
    import sys

    code = (
        # Pre-import everything the generator's module body needs, so the fake
        # version cannot break an unrelated import mid-module.
        "import importlib.util, subprocess, sys, argparse, difflib\n"
        "from pathlib import Path\n"
        "real_version = sys.version_info\n"
        "sys.version_info = (3, 11, 0)\n"
        "def _boom(*a, **k):\n"
        "    raise SystemExit(97)\n"
        "subprocess.call = _boom\n"
        "try:\n"
        "    spec = importlib.util.spec_from_file_location('g', sys.argv[1])\n"
        "    mod = importlib.util.module_from_spec(spec)\n"
        "    spec.loader.exec_module(mod)\n"
        "finally:\n"
        "    sys.version_info = real_version\n"
        # The guard must not have fired, so both of these must still work.
        "assert mod.render(['a', 'b']).endswith(\"| 'a'\\n  | 'b';\\n\")\n"
        "assert mod._needs_reexec((3, 11, 0), 'gen_memory_type_union') is False\n"
        "print('imported')\n"
    )
    proc = subprocess.run(
        [sys.executable, "-c", code, str(_GENERATOR)],
        capture_output=True,
        text=True,
        cwd=str(_REPO),
    )
    assert proc.returncode == 0, (
        f"importing the generator on a wrong interpreter re-execed or exited "
        f"(code {proc.returncode}; 97 is the stubbed re-exec): {proc.stdout}{proc.stderr}"
    )
    assert "imported" in proc.stdout

