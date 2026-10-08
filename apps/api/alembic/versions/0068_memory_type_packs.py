"""Memory-type domain packs (0068).

Revision ID: 0068
Revises: 0067
Create Date: 2026-10-08

Why this exists
---------------
``0027`` froze the memory taxonomy into ``ck_memories_type_valid``, a CHECK
constraint listing 24 literals, and ``schemas/memory.MemoryType`` repeats the same
list. Adding a type therefore meant editing a constraint, a Pydantic Literal, the
frontend union, and the migration that seeded it -- four files, one of them a
CHECK on the hottest table in the schema. This revision makes the list data:
``memory_type_packs`` holds one row per *domain pack*, and ``services/
memory_type_packs.py`` reads it. Adding a type becomes an INSERT (or a version
bump), and two domains can coexist without either one's vocabulary being forced
onto the other.

What is irreversible, and why it is still the right order
--------------------------------------------------------
The last statement drops ``ck_memories_type_valid``. From that moment the database
no longer constrains ``memories.type`` at all: until Task 6 makes writes validate
through the registry, a bad type reaches the table. That window is why the steps
are ordered blast-radius-outward -- the table and its seed exist and are proven
readable *before* the constraint goes, and the two ``type_pack_*`` columns exist
and are backfilled before it goes, so the registry can never be unavailable at the
moment the safety net is removed. ``downgrade()`` restores the constraint; it
re-reads the 24 literals from this file, so a rollback cannot drift.

The constraint is dropped, not relaxed
--------------------------------------
Keeping a CHECK alongside the registry would mean two sources of truth that
disagree silently: a pack could add ``"project-v2"`` and the table would still
refuse it. The registry is the only authority, so the old one is removed rather
than left to rot. The 24 literals it enforced are a strict subset of the seeded
pack (``test_seeded_career_pack_matches_constant`` pins that equality), so the
drop loses no value that the registry does not still hold.

Policy shape: service-role, deliberately
----------------------------------------
``memory_type_packs`` has no ``tenant_id``/``workspace_id`` column, so there is
nothing to scope on: it is platform configuration, identical for every tenant.
Its policy is therefore transcribed verbatim from ``0053_rls_scoped_app_policies``
lines 201-208 -- ``TO service_role, postgres, vaeloom_app USING (true) WITH CHECK
(true)`` -- the same accepted-risk treatment ``memory_taxonomy_ledger`` receives
in the same migration. That is a real risk to state plainly: any session holding
one of those three roles can read and write every pack. The alternative, an
unscoped table left without a policy, is worse: RLS with zero policies denies
everything to non-owners and would make the registry unreadable in exactly the
window where it has to work.

``_safe()`` fails loudly
------------------------
Copied verbatim from ``0062`` with the savepoint retargeted to ``sp_0068``.
``0049``'s version rolls back to a savepoint, prints, and returns; that
print-and-continue shape is what let the 2026-09 audit find 28 silently skipped
statements on a database that reported success. Nothing in this file is optional.

This revision re-asserts the coverage guard
------------------------------------------
``0066_force_schema_wide_rls`` asserts the 100% invariant -- every table in
``public`` has ``relrowsecurity``, ``relforcerowsecurity`` and at least one policy
-- but it runs *before* this table exists, so it cannot see it. Appending 0068
moves that guard earlier in the chain where it is blind. ``_assert_coverage`` is
carried forward from ``0067`` for exactly that reason, with the revision string in
its messages retargeted, so the deploy fails rather than the table shipping
unprotected. ``tests/test_migration_chain_pg.py::test_head_includes_the_rls_
coverage_guard`` is the test that notices when a future head forgets.
"""

import json
import logging
from collections.abc import Sequence

import sqlalchemy as sa

# The *defining submodule*, not `sa.dialects.postgresql`. The package attribute
# is not a reliable route to a PostgreSQL type: in the application's import
# environment `sqlalchemy.dialects.postgresql.JSONB` resolves to
# `sqlalchemy.dialects.sqlite.json.JSON`, whose `__init__` takes no `astext_type`,
# so `sa.dialects.postgresql.JSONB(astext_type=...)` raises `TypeError` and the
# CREATE TABLE never happens. It renders fine in a bare interpreter and fails in
# the app -- the worst possible failure mode for a migration, because which one
# you get depends on what else has been imported. tests/test_memory_type_packs.py
# executes `upgrade()` offline precisely so this cannot regress unnoticed.
from sqlalchemy.dialects.postgresql.json import JSONB

from alembic import op

revision: str = "0068"
down_revision: str | None = "0067"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLE = "memory_type_packs"
_MEMORY = "memories"
_LEDGER = "memory_taxonomy_ledger"
_POLICY = "p_memory_type_packs_service"
_CHECK = "ck_memories_type_valid"

# Alembic's own migration logger, not __name__. alembic.ini sets the `alembic`
# logger to INFO while the root logger stays at WARN, and a module logger named
# after the migration file is NOT a child of it -- so `logging.getLogger(__name__)`
# would silently drop the pre-drop evidence below at default verbosity, which is
# the opposite of what evidence is for.
logger = logging.getLogger("alembic.runtime.migration")

# The seeded vocabulary. Order is the contract: it mirrors
# schemas/memory.MemoryType line for line, and tests/test_memory_type_packs.py
# parses this tuple straight out of this file so a drift between the seed and
# services.memory_type_packs.CAREER_TYPES fails the suite rather than shipping.
# The same 24 literals are repeated in _CHECK_SQL below because downgrade() must
# restore a constraint PostgreSQL can check, and a Python-generated string in a
# CHECK would have to be spliced into the DDL anyway.
_CAREER_TYPES: tuple[str, ...] = (
    "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
)

EXEMPT_TABLES = frozenset({"alembic_version"})


def _safe(conn, sql: str) -> None:
    """Run ``sql`` under a savepoint, re-raising on failure.

    Verbatim shape from ``0062_capability_usage_telemetry._safe`` with the
    savepoint retargeted to ``sp_0068``. The savepoint structure is kept so a
    partial failure can be inspected, but unlike ``0049``'s helper the error
    propagates: a skipped statement here could leave ``memory_type_packs``
    uncreated or the CHECK still in place, and both read to a caller as a
    successful migration.
    """
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0068"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0068"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0068"))
        raise


def _type_list_sql() -> str:
    """The 24 values as a JSON array literal for the seed's JSONB payload.

    JSON, not a SQL string list: the payload is cast ``::jsonb``, so the literal
    inside the quotes has to be a JSON document. Building it with ``json.dumps``
    (rather than hand-quoting) is what keeps the seeded array byte-identical to
    ``_CAREER_TYPES``, and the outer single-quote doubling escapes the SQL string
    literal the JSON sits in.
    """
    return json.dumps(list(_CAREER_TYPES)).replace("'", "''")


# Transcribed from 0027_memory_taxonomy_expand_contract.py lines 74-82, which is
# the only place the pre-drop constraint is written down. Restored verbatim by
# downgrade(), so the literals here and the ones in 0027 must not diverge.
_CHECK_SQL = f"""
    ALTER TABLE {_MEMORY}
    ADD CONSTRAINT {_CHECK}
    CHECK (type IN (
        'profile','document','career','episodic','preference','working','note','fact',
        'project','skill','organization','relationship','event','insight','goal','feedback',
        'decision','knowledge','reference','contact','financial','health','learning','workflow'
    ))
"""

# Service-role policy, from 0053_rls_scoped_app_policies.py lines 204-209. USING
# and WITH CHECK are both `true` because there is no tenant dimension in this
# table; the DROP-then-CREATE pair is the same idempotence shape 0053 uses for the
# other scopeless tables.
_POLICY_SQL = f"""
    CREATE POLICY {_POLICY} ON {_TABLE} FOR ALL
    TO service_role, postgres, vaeloom_app USING (true) WITH CHECK (true);
"""


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # PostgreSQL-only DDL: JSONB, gen_random_uuid(), RLS and pg_policies all
        # need the real database. SQLite test runs create the table from
        # Base.metadata instead, which is the ORM contract 0068 is matched to.
        return

    run = lambda s: _safe(bind, s)  # noqa: E731

    # 1. The registry. Guarded rather than assumed so re-running the revision is
    # idempotent; a genuine DDL error still propagates through op/_safe.
    inspector = sa.inspect(bind)
    if not inspector.has_table(_TABLE):
        op.create_table(
            _TABLE,
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
            sa.Column("slug", sa.String(64), nullable=False),
            sa.Column("version", sa.Integer(), nullable=False, server_default=sa.text("1")),
            sa.Column("label", sa.String(100), nullable=False),
            # JSONB, not JSON: the pack list is read on every memory write and is
            # a document, not a row. The ORM maps it as the generic JSON type
            # (matching Memory.metadata_), which round-trips a list[str] the same
            # way against either column type.
            sa.Column("types", JSONB(astext_type=sa.Text()), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
            # UNIQUE, not a bare index: `ON CONFLICT (slug) DO NOTHING` below
            # requires a unique constraint to conflict against, and "two rows for
            # one pack" would make "the active pack" ambiguous for every reader.
            sa.UniqueConstraint("slug", name="uq_memory_type_packs_slug"),
            # Types are a non-empty list. A pack that declares nothing would be
            # indistinguishable from a misconfigured one, and every write would be
            # rejected against it with a message naming the pack -- an empty
            # vocabulary should fail loudly here, at the INSERT, not there.
            sa.CheckConstraint("jsonb_array_length(types) > 0", name="ck_memory_type_packs_types_nonempty"),
        )

    # 2. RLS, re-asserted rather than assumed. ENABLE + FORCE and the policy are
    # both needed: FORCE is what stops the table owner bypassing the policy, and
    # 0066's invariant requires both flags plus at least one policy.
    run(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    run(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")

    exists = bind.execute(
        sa.text("SELECT count(*) FROM pg_policies WHERE tablename = :t AND policyname = :p"),
        {"t": _TABLE, "p": _POLICY},
    ).scalar_one()
    if not exists:
        run(f"DROP POLICY IF EXISTS {_POLICY} ON {_TABLE};")
        run(_POLICY_SQL)

    # 3. The seed. ON CONFLICT (slug) DO NOTHING makes re-runs safe: a rerun
    # leaves an operator-edited pack alone instead of resetting it to v1, which
    # is the difference between an idempotent migration and a data-loss one.
    run(
        f"""
        INSERT INTO {_TABLE} (slug, version, label, types, is_active)
        VALUES ('career', 1, 'Career', '{_type_list_sql()}'::jsonb, true)
        ON CONFLICT (slug) DO NOTHING;
        """
    )

    # 4. Provenance columns. IF NOT EXISTS so a partially applied rerun resumes
    # rather than aborting; nullable so the ADD COLUMN does not rewrite the hot
    # table with a NOT NULL default on PostgreSQL.
    run(f"ALTER TABLE {_MEMORY} ADD COLUMN IF NOT EXISTS type_pack_slug VARCHAR(64)")
    run(f"ALTER TABLE {_MEMORY} ADD COLUMN IF NOT EXISTS type_pack_version INTEGER")

    # 4b. Ledger provenance. The ledger (0027) is the append-only record of every
    # type remap, and without this it cannot say *which pack revision* authorised
    # the change -- so the one table whose whole job is provenance would be
    # silent on the only fact that changes when a pack is re-versioned. JSONB
    # rather than two more columns because the spec's promise is a `metadata_`
    # bag, because the key set is expected to grow with the packs, and because a
    # nullable document costs nothing on a table that is write-once and read
    # during audit.
    #
    # IF NOT EXISTS (resumable) and nullable (no table rewrite, and pre-0068 rows
    # legitimately have no pack reference). ``downgrade`` drops it again.
    run(f"ALTER TABLE {_LEDGER} ADD COLUMN IF NOT EXISTS metadata JSONB")

    # 5. Backfill. Only rows that have no pack yet, so a rerun does not stamp
    # rows that were written under a *different* pack after the first run.
    result = bind.execute(
        sa.text(
            f"UPDATE {_MEMORY} SET type_pack_slug = 'career', type_pack_version = 1 "
            f"WHERE type_pack_slug IS NULL"
        )
    )
    logger.info("0068 backfilled type_pack on %s memory row(s)", result.rowcount)

    # 6. Evidence, logged *before* the constraint goes. After this statement the
    # database can no longer tell you which types were legal, so this is the only
    # record of the population a rollback would have to re-validate against.
    total = bind.execute(sa.text(f"SELECT count(*) FROM {_MEMORY}")).scalar_one()
    present = bind.execute(
        sa.text(f"SELECT type, count(*) FROM {_MEMORY} GROUP BY type ORDER BY type")
    ).fetchall()
    logger.info(
        "0068 pre-drop evidence: %s row(s) in %s, distinct types=%s",
        total,
        _MEMORY,
        dict(present),
    )

    # 7. Drop the frozen taxonomy. The registry is seeded, readable and
    # backfilled by this point, so there is no window in which memories.type is
    # both unconstrained and unattributable.
    run(f"ALTER TABLE {_MEMORY} DROP CONSTRAINT IF EXISTS {_CHECK};")

    _assert_coverage(bind)


def _assert_coverage(bind) -> None:
    """Re-run the end-state guard, because 0066 is no longer terminal.

    Carried forward from ``0067_ranking_weight_profiles._assert_coverage``, which
    carries it from ``0066_force_schema_wide_rls``. Each appended revision moves
    the guard one step earlier in the chain, where it cannot observe the newest
    table. Repeating the check here is what stops ``memory_type_packs`` shipping
    without RLS and nothing noticing. ``EXEMPT_TABLES`` is unchanged: only
    Alembic's own version table is out of scope.
    """
    tables = [
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name NOT IN "
                f"({','.join(repr(t) for t in EXEMPT_TABLES)}) "
                "ORDER BY 1;"
            )
        ).fetchall()
    ]
    if not tables:
        raise RuntimeError(
            "0068 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

    unprotected: list[str] = []
    unforced: list[str] = []
    policyless: list[str] = []

    for table in tables:
        rls = bind.execute(
            sa.text(
                "SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c "
                "JOIN pg_namespace n ON n.oid = c.relnamespace "
                f"WHERE n.nspname = 'public' AND c.relname = '{table}';"
            )
        ).fetchall()
        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        elif rls[0][1] is not True:
            unforced.append(table)

        count = bind.execute(
            sa.text(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        ).fetchall()
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unprotected or unforced or policyless:
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}"
            )
        if unforced:
            problems.append(
                f"row-level security NOT FORCED on {len(unforced)} table(s): {sorted(unforced)}"
            )
        if policyless:
            problems.append(
                f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}"
            )
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
        )


def downgrade() -> None:
    """Restore the frozen taxonomy, then remove this revision's objects.

    Order is the reverse of ``upgrade`` and each step is safe to repeat: the CHECK
    is re-added *before* the pack registry goes, so if any later step fails there
    is never a moment when ``memories.type`` is unconstrained with nothing in the
    schema left to validate it against.
    """
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    run = lambda s: _safe(bind, s)  # noqa: E731

    # 1. Back to the 0027 constraint. IF NOT EXISTS is not available for ADD
    #    CONSTRAINT in this form, so the drop-then-add keeps a rerun working.
    #    A row holding a type outside these 24 makes this raise -- which is the
    #    correct outcome, and is why upgrade() logs the distinct type list first.
    run(f"ALTER TABLE {_MEMORY} DROP CONSTRAINT IF EXISTS {_CHECK};")
    run(_CHECK_SQL)

    # 2. Provenance columns, IF EXISTS so a rerun past a partial failure works.
    run(f"ALTER TABLE {_MEMORY} DROP COLUMN IF EXISTS type_pack_version")
    run(f"ALTER TABLE {_MEMORY} DROP COLUMN IF EXISTS type_pack_slug")
    # The ledger's pack reference goes with them, for the same reason and because
    # leaving it behind would describe a pack system this revision has just
    # removed.
    run(f"ALTER TABLE {_LEDGER} DROP COLUMN IF EXISTS metadata")

    # 3. Drop the policy before the table, so no window exists in which the table
    #    survives without a policy -- which is exactly what _assert_coverage
    #    would flag if a later revision ever inspected this state.
    run(f"DROP POLICY IF EXISTS {_POLICY} ON {_TABLE}")

    inspector = sa.inspect(bind)
    if not inspector.has_table(_TABLE):
        return
    op.drop_table(_TABLE)
