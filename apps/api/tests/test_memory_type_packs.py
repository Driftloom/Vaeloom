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

