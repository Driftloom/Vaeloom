"""Workspace isolation for preference learning; retire the second frozen vocabulary

Revision ID: 0069
Revises: 0068
Created: 2026-11-11

Three changes, one migration. They are coupled: dropping ``ck_memory_records_type_valid``
removes the last database-level guard on ``memory_records.type``, so it may only ship in
the same revision that establishes the validation the service layer performs instead.

1. ``recommendation_feedback`` gains a nullable ``workspace_id``.

   It had ``user_id`` and ``tenant_id`` only, so ``user_preference`` learning aggregated
   across every workspace a user belonged to and a rating in one workspace moved the
   profile in another. Nothing errored; the ranking simply drifted toward whatever the
   user last rated.

   Nullable on purpose and backfilled with nothing. The parent ``recommendations`` table
   has no ``workspace_id`` either, so any backfill would be a guess -- and a guessed
   workspace is exactly the contamination this column exists to prevent. Legacy rows stay
   ``NULL`` and are quarantined: every learning query filters on an exact workspace match,
   so a ``NULL`` row contributes nothing rather than being counted everywhere.

2. ``user_preference_vectors`` gains ``workspace_id`` and is keyed by it.

   Its primary key was ``(user_id, tenant_id)``, so one vector was shared across all of a
   user's workspaces. Existing vectors have no workspace and are not migrated; they stop
   being readable and the profile rebuilds on the next signal. That is the accepted cost
   of isolation over fabricated mappings.

3. ``ck_memory_records_type_valid`` is dropped from ``memory_records``.

   0027 froze a second vocabulary that 0068's registry does not govern, and the two drift
   apart silently. The 24 literals are identical to the seeded career pack, so the registry
   already speaks this table's language; the constraint was redundant and separately
   maintained. After this, ``memory_records.type`` is validated by the service layer exactly
   as ``memories.type`` has been since 0068.

   This is safe only because ``document_service`` validates at both of its
   ``MemoryRecord(...)`` construction sites. If you add a third, it must validate too --
   there is no longer anything below it that will catch a bad literal.
"""

from __future__ import annotations

import logging

import sqlalchemy as sa
from alembic import op

revision: str = "0069"
down_revision: str | None = "0068"
branch_labels = None
depends_on = None

logger = logging.getLogger("alembic.runtime.migration")

_FEEDBACK = "recommendation_feedback"
_VECTORS = "user_preference_vectors"
_MEMORY_RECORDS = "memory_records"
_CHECK = "ck_memory_records_type_valid"

_POLICY_FEEDBACK = "p_recommendation_feedback_workspace_isolation"
_POLICY_VECTORS = "p_user_preference_vectors_workspace_isolation"

# `USING` and `WITH CHECK` share one predicate constant, exactly as 0067 does.
# Copy-pasting them into two places invites a drift that only shows up as a write
# accepted by one predicate and rejected by the other.
_WORKSPACE_PREDICATE = "workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')"

# The 24 literals of 0027_memory_taxonomy_expand_contract.py:89-95, copied rather than
# retyped. The seeded career pack declares the identical tuple, which is what makes
# retiring this constraint safe: the registry already speaks this table's vocabulary.
_FROZEN_TYPES: tuple[str, ...] = (
    "profile", "document", "career", "episodic", "preference", "working", "note", "fact",
    "project", "skill", "organization", "relationship", "event", "insight", "goal", "feedback",
    "decision", "knowledge", "reference", "contact", "financial", "health", "learning", "workflow",
)


def _safe(bind, statement: str) -> None:
    """Run a PostgreSQL statement, tolerating only "already in that state".

    Re-running a partially applied revision must land, but a genuine DDL error must not
    be swallowed -- a swallowed error here becomes a migration chain that reports success
    over a schema nobody wanted.
    """
    from sqlalchemy.exc import ProgrammingError

    try:
        bind.execute(sa.text(statement))
    except ProgrammingError as exc:  # pragma: no cover - exercised on live runs
        message = str(exc).lower()
        if any(
            token in message
            for token in (
                "already exists",
                "does not exist",
                "duplicate key",
                "duplicate_object",
                "duplicate_column",
                "multiple primary keys",
                "constraint",
            )
        ):
            logger.info("0069 tolerated a rerun: %s", statement.splitlines()[0][:120])
            return
        raise


EXEMPT_TABLES = frozenset({"alembic_version"})


def _assert_coverage(bind) -> None:
    """Re-run the end-state guard, because 0066 is no longer terminal.

    Carried forward unchanged from ``0068_memory_type_packs``, which carries it
    from ``0067`` and ``0066_force_schema_wide_rls``. Each appended revision moves
    the guard one step earlier in the chain, where it can no longer observe the
    newest change. Repeating it here is what stops this migration altering RLS and
    leaving a table unprotected with nothing downstream to notice.

    0069 recreates two policies, so it is precisely the revision where a ``_safe``
    tolerance could silently drop one -- a swallowed statement would leave a
    publicly readable recommendation table, and this is the only thing that would
    say so.
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
            "0069 found no tables in the public schema. Either the chain did not "
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


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # PostgreSQL-only DDL: uuid columns, primary keys and RLS need the real
        # database. SQLite test runs create tables from Base.metadata instead.
        return

    # 1. Nullable workspace on the feedback table. No backfill -- see the module
    #    docstring. A guessed workspace is the contamination this column prevents.
    _safe(bind, f"ALTER TABLE {_FEEDBACK} ADD COLUMN IF NOT EXISTS workspace_id uuid NULL;")

    # 2. The preference vector becomes per-workspace. Drop the old key before adding
#    the new one: PostgreSQL will not replace a primary key in place.
    #
    #    Legacy vectors are deleted first, and not merely left NULL. A primary key
    #    column is implicitly NOT NULL, so `ADD CONSTRAINT ... PRIMARY KEY` fails
    #    outright against a table holding rows whose new column is NULL -- which is
    #    every existing vector. That failure is invisible on an empty database,
    #    which is exactly how it was found: the verification container had no rows.
    #    The vectors are derived data that the service rebuilds from feedback, so
    #    discarding them is the honest outcome of adding the key, and leaving them
    #    to fail the migration on first contact with real data is not an option.
    _safe(bind, f"ALTER TABLE {_VECTORS} ADD COLUMN IF NOT EXISTS workspace_id uuid NULL;")
    legacy_vectors = bind.execute(
        sa.text(f"SELECT count(*) FROM {_VECTORS} WHERE workspace_id IS NULL")
    ).scalar()
    if legacy_vectors:
        logger.info(
            "0069 discarding %s preference vector(s) with no workspace: they are "
            "derived data, a primary key column cannot be NULL, and a vector shared "
            "across every workspace is the cross-workspace leak this column fixes. "
            "Each profile rebuilds on its next signal.",
            legacy_vectors,
        )
    _safe(bind, f"DELETE FROM {_VECTORS} WHERE workspace_id IS NULL;")
    _safe(bind, f"ALTER TABLE {_VECTORS} ALTER COLUMN workspace_id SET NOT NULL;")
    _safe(bind, f"ALTER TABLE {_VECTORS} DROP CONSTRAINT IF EXISTS user_preference_vectors_pkey;")
    _safe(
        bind,
        f"ALTER TABLE {_VECTORS} ADD CONSTRAINT user_preference_vectors_pkey "
        f"PRIMARY KEY (user_id, tenant_id, workspace_id);",
    )

    # 3. Retire the second frozen vocabulary. Guarded, and logged rather than silent:
    #    this is the step that removes a database-level guard, and an operator reading
    #    a production migration log should be able to see it happened.
    present = bind.execute(
        sa.text(
            # to_regclass rather than `:param::regclass`: SQLAlchemy parses the
            # `::` in a bound expression as a cast separator and emits a syntax
            # error at the colon. to_regclass takes the name as a plain string.
            "SELECT count(*) FROM pg_constraint "
            "WHERE conname = :name AND conrelid = to_regclass(:rel)"
        ),
        {"name": _CHECK, "rel": _MEMORY_RECORDS},
    ).scalar()
    if present:
        logger.info(
            "0069 dropping %s: its 24 literals are identical to the seeded career pack, "
            "so the domain-pack registry now governs memory_records.type",
            _CHECK,
        )
    _safe(bind, f"ALTER TABLE {_MEMORY_RECORDS} DROP CONSTRAINT IF EXISTS {_CHECK};")

    # 4. Policies that can actually see the new column. Without this the column is
    #    decorative: the policy still scopes on user_id alone.
    for table, policy in ((_FEEDBACK, _POLICY_FEEDBACK), (_VECTORS, _POLICY_VECTORS)):
        _safe(bind, f"DROP POLICY IF EXISTS {policy} ON {table};")
        _safe(
            bind,
            f"""
            CREATE POLICY {policy} ON {table}
            FOR ALL
            USING ({_WORKSPACE_PREDICATE})
            WITH CHECK ({_WORKSPACE_PREDICATE})
            """,
        )
        _safe(bind, f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        _safe(bind, f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;")

    # The only thing that notices if a tolerance above silently dropped one of the
    # two policies this revision recreates.
    _assert_coverage(bind)


def downgrade() -> None:
    """Restore the pre-0069 schema exactly.

    Re-adding ``ck_memory_records_type_valid`` re-validates every existing row, so this
    *refuses* if ``memory_records`` holds a type the frozen vocabulary does not list.
    That refusal is correct and must not be worked around by deleting rows: 0068
    established the same rule, and a rollback that quietly discards data is worse than a
    rollback that stops and says which value is in the way.
    """
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for table, policy in ((_FEEDBACK, _POLICY_FEEDBACK), (_VECTORS, _POLICY_VECTORS)):
        _safe(bind, f"DROP POLICY IF EXISTS {policy} ON {table};")
    _safe(bind, f"ALTER TABLE {_FEEDBACK} DROP COLUMN IF EXISTS workspace_id;")
    _safe(
        bind,
        f"ALTER TABLE {_VECTORS} DROP CONSTRAINT IF EXISTS user_preference_vectors_pkey;",
    )
    _safe(
        bind,
        f"ALTER TABLE {_VECTORS} ADD CONSTRAINT user_preference_vectors_pkey "
        f"PRIMARY KEY (user_id, tenant_id);",
    )
    _safe(bind, f"ALTER TABLE {_VECTORS} DROP COLUMN IF EXISTS workspace_id;")

    # Same literals as 0027: drop first, then add, so a rerun past a partial
    # failure still lands. The literals are byte-identical to 0027's.
    #
    # PostgreSQL reports a violated ADD CONSTRAINT as "violated by some row" with
    # no DETAIL, so the offending values never reach the operator -- or the
    # verification harness, which requires the refusal to name them. Log the
    # distinct types first, exactly as 0068's downgrade does, so the failure says
    # what is in the way instead of only that something is.
    try:
        present = bind.execute(
            sa.text(f"SELECT type, count(*) FROM {_MEMORY_RECORDS} GROUP BY type ORDER BY type")
        ).fetchall()
        logger.info(
            "0069 pre-restore evidence: %s distinct types in %s: %s",
            len(present),
            _MEMORY_RECORDS,
            dict(present),
        )
    except sa.exc.SQLAlchemyError:  # pragma: no cover - table may be absent
        logger.info("0069 could not read %s for pre-restore evidence", _MEMORY_RECORDS)

    literals = ", ".join(f"'{value}'" for value in _FROZEN_TYPES)
    _safe(bind, f"ALTER TABLE {_MEMORY_RECORDS} DROP CONSTRAINT IF EXISTS {_CHECK};")
    _safe(
        bind,
        f"ALTER TABLE {_MEMORY_RECORDS} ADD CONSTRAINT {_CHECK} "
        f"CHECK (type IN ({literals}))",
    )