"""Per-user learned ranking weights (0067).

Revision ID: 0067
Revises: 0066
Create Date: 2026-10-08

Why this exists
---------------
``services/ranking_weights.py`` resolves the active ranking weight set with the
precedence ``per-user DB profile > RANKING_WEIGHTS env > DEFAULT_WEIGHTS``. Until
this revision the DB tier had no table to read, so every query raised, every
lookup was caught, and every caller silently received the env/default pair. This
revision creates that table so the learned tier can actually apply.

The table name is a hard contract, not a style choice: ``ranking_weights``
hard-codes ``_PROFILES_TABLE = "ranking_weight_profiles"`` and interpolates it
into a ``text()`` statement. A different spelling here would not raise -- the
lookup would keep raising, be caught, and degrade to defaults, which reads as
"learning is disabled" rather than "the table name drifted".

Why the (workspace_id, user_id) UNIQUE constraint is load-bearing
------------------------------------------------------------------
``ranking_weights.effective_weights`` calls ``.mappings().one_or_none()``. That
raises ``MultipleResultsFound`` if the profile is not unique, and the raise is
swallowed by the surrounding ``except Exception`` into a fallback to
env/default. So the failure mode for a missing constraint is *silent weight
reversion*, not an error. The constraint is the only thing standing between a
duplicate-write bug and every workspace silently losing its learned weights.
``effective_weights`` also carries ``LIMIT 1``, which keeps the read
deterministic, but a constraint is what stops the duplicate from existing.

Isolation rests entirely on the policy below
--------------------------------------------
The read does **not** filter on ``tenant_id``. It filters on ``workspace_id`` and
``user_id`` only, so the RLS policy is the whole isolation story. The predicate's
*structure* is transcribed from ``0062_capability_usage_telemetry`` (which created
the workspace-scoped ``workspace_capabilities`` table) with the table reference
substituted -- it is deliberately the *member-aware* form, not the bare
``workspace_id = current_setting(...)`` form: it resolves the caller's workspace
either from the ``app.workspace_id`` GUC or, failing that, from membership of the
row's workspace via ``workspaces.user_id`` / ``workspace_users``. Writing a fifth
variant of that structure would be the mistake; copying the established one is
the point.

Its *spelling* is not copied, and that is a deliberate correction. 0062 casts the
session setting (``... , '')::uuid``); 0063:24-32 calls the column-cast form
(``workspace_id::text = NULLIF(current_setting(...), '')``) "the safer spelling"
and 0063 exists precisely because a non-uuid GUC raises ``invalid input syntax``
*inside policy evaluation*, which runs on every read -- so one malformed
``app.workspace_id`` turns every profile read into a 500 rather than a permission
denial. The column-cast form yields NULL instead, and NULL fails closed. See the
comment on ``_PREDICATE``.

``USING`` and ``WITH CHECK`` share one predicate constant
---------------------------------------------------------
They must be the same predicate, and ``_PREDICATE`` exists so they are the same by
construction. Copy-pasting them into both clauses is what invites a one-clause
edit that leaves INSERT governed by different scope than SELECT -- and this file's
own history is the argument against it: duplicated RLS predicate variants are
what have drifted from one another in this schema.

Writers must satisfy ``WITH CHECK`` (constraint on downstream work)
-------------------------------------------------------------------
PostgreSQL consults ``WITH CHECK`` -- and only ``WITH CHECK`` -- when evaluating
an INSERT. That is why it is here. The consequence is that **every writer must
either set the ``app.workspace_id`` session GUC to the target workspace, or be a
member of that workspace** (via ``workspaces.user_id`` or ``workspace_users``)
before inserting a profile. A writer that connects without those GUCs does not
get a silent write: the insert is rejected with SQLSTATE 42501. The learning code
that populates this table must therefore run inside a scoped session; see the
Task 2 report for the carry-forward note.

Weights are bounded, not merely precise
---------------------------------------
The four weight columns are ``NUMERIC(5,4)``, whose ceiling alone is 9.9999 -- wide
enough to store a nonsensical score. Each carries a ``CHECK (... BETWEEN 0 AND 1)``
so an out-of-range weight is refused as a constraint violation rather than
surfacing later as a broken ranking. Table CHECKs are evaluated independently of
RLS, so they bind every writer including the table owner.

``_safe()`` fails loudly
------------------------
Copied verbatim from ``0062`` with the savepoint retargeted to ``sp_0067``.
``0049``'s version rolls back to a savepoint, prints, and returns; that
print-and-continue shape is what let the 2026-09 audit find 28 silently skipped
statements on a database that reported success. Nothing in this file is optional.

This revision re-asserts the coverage guard
------------------------------------------
``0060_verify_rls_coverage`` was written to be terminal and ``0066`` re-asserted
the stricter schema-wide form (ENABLE + FORCE + at least one policy, for *every*
public table). Appending 0067 moves that guard one step earlier in the chain,
where it cannot see this table at all. ``_assert_coverage`` at the end of
``upgrade`` repeats the same end-state check so a statement skipped here fails
the deploy instead of being noticed by nobody.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0067"
down_revision: str | None = "0066"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Mirrors ranking_weights._PROFILES_TABLE verbatim. If you change one, change the
# other, or the learned tier degrades to defaults without raising.
_TABLE = "ranking_weight_profiles"

_POLICY = "p_ranking_weight_profiles_workspace_isolation"
_INDEX = "idx_ranking_weight_profiles_workspace_id"
_UNIQUE = "uq_ranking_weight_profiles_workspace_user"

EXEMPT_TABLES = frozenset({"alembic_version"})


def _safe(conn, sql: str) -> None:
    """Run ``sql`` under a savepoint, re-raising on failure.

    Verbatim shape from ``0062_capability_usage_telemetry._safe`` with the
    savepoint retargeted to ``sp_0067``. The savepoint structure is kept so a
    partial failure can be inspected, but unlike ``0049``'s helper the error
    propagates: a skipped statement here would leave a table whose only purpose
    is to be read, silently absent, and every caller would read that as "no
    learned weights" rather than "the migration failed".
    """
    is_pg = op.get_context().dialect.name == "postgresql"
    if not is_pg:
        return
    conn.execute(sa.text("SAVEPOINT sp_0067"))
    try:
        conn.execute(sa.text(sql))
        conn.execute(sa.text("RELEASE SAVEPOINT sp_0067"))
    except Exception:
        conn.execute(sa.text("ROLLBACK TO SAVEPOINT sp_0067"))
        raise


# Transcribed from 0062:137-155 (workspace_capabilities -> ranking_weight_profiles)
# with two corrections.
#
# 1. COLUMN-cast, not setting-cast.
#    0062 spells the GUC comparison
#        workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid
#    Casting the *setting* raises ``invalid input syntax for type uuid`` from
#    *inside policy evaluation* whenever the session GUC holds anything other
#    than a uuid -- and policy evaluation runs on every read, so one malformed
#    ``app.workspace_id`` turns every profile read into a 500 rather than a
#    permission denial. 0063:24-32 documents the column-cast form
#    (``workspace_id::text = NULLIF(current_setting(...), '')``) as "the safer
#    spelling" precisely because a bad GUC then yields NULL, the predicate
#    evaluates false, and the read fails *closed*. Adopted deliberately, as a
#    documented departure from the original instruction to copy 0062.
#    Only the GUC comparisons change; ``w.id = {_TABLE}.workspace_id`` stays a
#    uuid-to-uuid column comparison, which cannot raise, so the member-aware
#    half behaves exactly as before.
#
# 2. One source of truth.
#    USING and WITH CHECK must be the same predicate. Copy-pasting them invites
#    a one-clause edit to desynchronise the two, which would leave INSERT
#    governed by different scope than SELECT -- in the one migration whose own
#    docstring says duplicated RLS variants are what have drifted in the past.
#    Both clauses interpolate this single constant.
_PREDICATE = f"""
        workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
        OR EXISTS (
            SELECT 1 FROM workspaces w
            WHERE w.id = {_TABLE}.workspace_id
            AND (
                w.user_id::text = NULLIF(current_setting('app.user_id', true), '')
                OR EXISTS (
                    SELECT 1 FROM workspace_users wu
                    WHERE wu.workspace_id = w.id
                    AND wu.user_id::text = NULLIF(current_setting('app.user_id', true), '')
                )
            )
        )
"""

_POLICY_SQL = f"""
    CREATE POLICY {_POLICY} ON {_TABLE}
    FOR ALL
    USING ({_PREDICATE})
    WITH CHECK ({_PREDICATE})
"""


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # PostgreSQL-only DDL: uuid columns, server_default now(), and RLS all
        # need the real database. SQLite test runs create the table from
        # Base.metadata instead, which is the ORM contract 0067 is matched to.
        return

    inspector = sa.inspect(bind)

    # Guarded rather than assumed, so re-running the revision is idempotent --
    # but a genuine DDL error still propagates through _safe/op below.
    if not inspector.has_table(_TABLE):
        op.create_table(
            _TABLE,
            sa.Column("id", sa.UUID(as_uuid=True), primary_key=True),
            sa.Column("tenant_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column("workspace_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column("user_id", sa.UUID(as_uuid=True), nullable=False),
            sa.Column(
                "relevance",
                sa.Numeric(5, 4),
                nullable=False,
                server_default=sa.text("0.4"),
            ),
            sa.Column(
                "recency",
                sa.Numeric(5, 4),
                nullable=False,
                server_default=sa.text("0.3"),
            ),
            sa.Column(
                "importance",
                sa.Numeric(5, 4),
                nullable=False,
                server_default=sa.text("0.2"),
            ),
            sa.Column(
                "user_preference",
                sa.Numeric(5, 4),
                nullable=False,
                server_default=sa.text("0.1"),
            ),
            sa.Column(
                "sample_size",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("0"),
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("now()"),
            ),
            sa.UniqueConstraint("workspace_id", "user_id", name=_UNIQUE),
            # Weights are ratios, so 0..1 is the whole legal domain. NUMERIC(5,4)
            # alone permits up to 9.9999, which would let a bad learner write a
            # nonsensical weight that only surfaces as a NumericValueOutOfRange
            # error at deploy time rather than as a bounded score. These are
            # table CHECKs, not RLS, so they hold for every writer including the
            # owner -- FORCE RLS does not apply to constraint checking.
            # downgrade() needs no matching DROP: dropping the table drops the
            # constraints with it.
            sa.CheckConstraint(
                "relevance BETWEEN 0 AND 1",
                name="ck_ranking_weight_profiles_relevance",
            ),
            sa.CheckConstraint(
                "recency BETWEEN 0 AND 1",
                name="ck_ranking_weight_profiles_recency",
            ),
            sa.CheckConstraint(
                "importance BETWEEN 0 AND 1",
                name="ck_ranking_weight_profiles_importance",
            ),
            sa.CheckConstraint(
                "user_preference BETWEEN 0 AND 1",
                name="ck_ranking_weight_profiles_user_preference",
            ),
        )

    existing_indexes = {i["name"] for i in inspector.get_indexes(_TABLE)}
    if _INDEX not in existing_indexes:
        op.create_index(_INDEX, _TABLE, ["workspace_id"])

    run = lambda s: _safe(bind, s)  # noqa: E731
    run(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    run(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")

    # Same idempotence guard as 0062:128-134. CREATE POLICY has no IF NOT EXISTS,
    # so re-running must not be an error, but this is a *skip the known-good
    # case* check, not a swallow: an unexpected failure still raises via _safe.
    exists = bind.execute(
        sa.text(
            "SELECT count(*) FROM pg_policies WHERE tablename = :t AND policyname = :p"
        ),
        {"t": _TABLE, "p": _POLICY},
    ).scalar_one()
    if not exists:
        run(_POLICY_SQL)

    _assert_coverage(bind)


def _assert_coverage(bind) -> None:
    """Re-run the end-state guard, because 0066 is no longer terminal.

    Transcribed from ``0066_force_schema_wide_rls._assert_schema_wide_coverage``.
    Appending 0067 after 0066 moves the guard earlier in the chain, where it
    cannot observe this table. Repeating the check restores the property the audit
    depended on: a table this revision creates cannot end up unprotected with
    nothing after it to notice.
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
            "0067 found no tables in the public schema. Either the chain did not "
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
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    _safe(bind, f"DROP POLICY IF EXISTS {_POLICY} ON {_TABLE}")

    inspector = sa.inspect(bind)
    if not inspector.has_table(_TABLE):
        return

    existing_indexes = {i["name"] for i in inspector.get_indexes(_TABLE)}
    if _INDEX in existing_indexes:
        op.drop_index(_INDEX, table_name=_TABLE)
    op.drop_table(_TABLE)
