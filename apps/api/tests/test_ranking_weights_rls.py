"""Isolation and contract tests for ranking_weight_profiles (migration 0067).

Two parts.

**Unit part** runs on the default SQLite suite via the real ``db_session``
fixture, so the ORM model in ``api.models.schema`` must exist and must match the
migration. It covers the ORM roundtrip, the per-user scoping, cross-workspace
invisibility, the ``(workspace_id, user_id)`` uniqueness invariant, and the
column-name contract with ``services.ranking_weights``.

**Live-Postgres part** is skipped unless a PG URL is configured, and is the only
place ``effective_weights``' raw ``text()`` lookup is proven end-to-end against a
real ``uuid`` column with the real RLS policy in force. On SQLite the uuid
columns are emulated by the ``MockUUID`` decorator in ``conftest.py``, which is
faithful enough for the ORM path but is not the production mechanism.

Why uniqueness is tested rather than assumed
--------------------------------------------
``effective_weights`` reads with ``.mappings().one_or_none()`` inside a bare
``except Exception`` that degrades to env/default weights. A second profile row
for the same ``(workspace_id, user_id)`` therefore does not raise out of the
resolver -- it silently reverts every workspace's ranking to the defaults. The
UNIQUE constraint is the only thing that converts that bug into a loud failure.

Run:
    cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights_rls.py -q -o addopts=""

Live PostgreSQL:
    $env:VAELOOM_TEST_PG_URL="postgresql://user:pw@localhost:5432/vaeloom_rls_proof"
    cd apps/api && .venv/Scripts/python.exe -m pytest tests/test_ranking_weights_rls.py -q -o addopts=""
"""

import os
import pathlib
import uuid

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine

from api.models.schema import RankingWeightProfile
from api.services.ranking_weights import DEFAULT_WEIGHTS, WEIGHT_KEYS, effective_weights

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------- unit (SQLite)


async def test_profile_roundtrips_through_session(db_session):
    ws, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(
        RankingWeightProfile(
            tenant_id=tenant, workspace_id=ws, user_id=user,
            relevance=0.4, recency=0.3, importance=0.2, user_preference=0.25,
            sample_size=12,
        )
    )
    await db_session.flush()

    row = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalar_one()
    assert row.user_preference == 0.25

    out = await effective_weights(db_session, str(ws), str(user))
    assert out["user_preference"] == 0.25
    assert out["user_preference"] != DEFAULT_WEIGHTS["user_preference"], (
        "the DB profile must win over DEFAULT_WEIGHTS, otherwise this test is "
        "passing through the resolver's bare-except fallback"
    )


async def test_two_users_same_workspace_do_not_share_weights(db_session):
    ws, tenant = uuid.uuid4(), uuid.uuid4()
    a, b = uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=a,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.45, sample_size=30,
    ))
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=b,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.05, sample_size=30,
    ))
    await db_session.flush()

    out_a = await effective_weights(db_session, str(ws), str(a))
    out_b = await effective_weights(db_session, str(ws), str(b))
    assert out_a["user_preference"] == 0.45
    assert out_b["user_preference"] == 0.05, "user A's learned weight must not affect user B"


async def test_other_workspace_profile_not_returned(db_session):
    ws_a, ws_b, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws_b, user_id=user,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.45, sample_size=30,
    ))
    await db_session.flush()

    out = await effective_weights(db_session, str(ws_a), str(user))
    assert out["user_preference"] != 0.45, "must not read another workspace's profile"

    # The above also holds if the lookup raised and fell back, so assert the
    # scoping directly as well: workspace B's row must be reachable by
    # workspace B and by nobody else. Without this the assertion above can pass
    # simply because the table is broken.
    scoped = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws_b)
    )).scalars().all()
    assert len(scoped) == 1, "workspace B must see its own profile"

    # NOTE: workspace A is NOT expected to be empty. Since the whole-branch
    # review's I1 fix, `effective_weights` provisions the caller's own row on
    # first resolution, so resolving for workspace A legitimately leaves one row
    # there -- the caller's, freshly written by this very call. The property
    # under test is that it is *not* workspace B's seeded row, which is a
    # stronger and more meaningful assertion than an empty count: it fails if
    # the lookup ever crosses workspaces, and it also fails if provisioning
    # silently stops happening.
    in_a = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws_a)
    )).scalars().all()
    assert all(row.user_preference != 0.45 for row in in_a), (
        "workspace A must not contain workspace B's seeded profile"
    )
    assert [row.id for row in in_a] != [row.id for row in scoped], (
        "workspace A's rows and workspace B's rows must be distinct rows"
    )


async def test_other_user_profile_not_returned(db_session):
    ws, tenant = uuid.uuid4(), uuid.uuid4()
    owner, other = uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=owner,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.45, sample_size=30,
    ))
    await db_session.flush()

    out = await effective_weights(db_session, str(ws), str(other))
    assert out["user_preference"] != 0.45, (
        "one user's learned weights must not be served to another user in the "
        "same workspace"
    )


async def test_duplicate_profile_for_same_workspace_and_user_is_rejected(db_session):
    """The constraint is what stops a silent revert to default weights.

    Without it, the resolver's ``one_or_none()`` raises ``MultipleResultsFound``
    inside its ``except Exception``, so the defect presents as "learning stopped
    working" rather than as an error.
    """
    ws, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=user,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.25, sample_size=5,
    ))
    await db_session.flush()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=user,
        relevance=0.4, recency=0.3, importance=0.2, user_preference=0.99, sample_size=5,
    ))
    with pytest.raises(IntegrityError):
        await db_session.flush()


async def test_table_exposes_exactly_the_columns_the_resolver_selects(db_session):
    """Lock the cross-task contract with ``services.ranking_weights``.

    That module hard-codes the table name and interpolates it into a raw
    ``text()`` statement selecting four columns by name. A rename or drop here
    does not fail loudly -- the lookup raises, is swallowed, and every caller
    reads it as "no learned weights". This asserts the names that statement
    depends on, so a drift fails in this suite instead.
    """
    from api.services import ranking_weights as rw

    def _columns(sync_conn):
        insp = inspect(sync_conn)
        assert insp.has_table(rw._PROFILES_TABLE), (
            f"ranking_weights reads {rw._PROFILES_TABLE!r} but no such table exists"
        )
        return {c["name"] for c in insp.get_columns(rw._PROFILES_TABLE)}

    async with db_session.bind.connect() as conn:
        cols = await conn.run_sync(_columns)

    missing = sorted(set(WEIGHT_KEYS) - cols)
    assert not missing, (
        f"ranking_weights.effective_weights selects {list(WEIGHT_KEYS)} but the "
        f"table is missing {missing}"
    )


async def test_defaults_match_the_migration_server_defaults(db_session):
    """A row written with no weights must land on 0.4 / 0.3 / 0.2 / 0.1.

    Asserting what the ORM actually persisted, rather than the values passed to
    the constructor, keeps the test honest about which side supplied the number,
    because on PostgreSQL the server default is what a raw INSERT receives.
    """
    ws, user, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    db_session.add(RankingWeightProfile(
        tenant_id=tenant, workspace_id=ws, user_id=user,
    ))
    await db_session.flush()
    await db_session.commit()

    row = (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws)
    )).scalar_one()
    assert float(row.relevance) == 0.4
    assert float(row.recency) == 0.3
    assert float(row.importance) == 0.2
    assert float(row.user_preference) == 0.1
    assert row.sample_size == 0


# ------------------------------------------- migration guards (run always)
#
# The three properties below are only observable by executing raw DDL against a
# PostgreSQL parser, which the default SQLite suite cannot do. They are asserted
# against the migration's own module-level constants instead of against its raw
# source text, which is strictly stronger: the constants are what actually gets
# sent to the server, so comments cannot make them pass, and the USING/WITH CHECK
# check compares the *interpolated* SQL rather than counting placeholders.
#
# Each is a genuine revert-and-red: restoring the pre-fix spelling makes the
# corresponding assertion fail (confirmed by execution, see the report).


def _load_migration():
    """Import 0067 as a module so its constants can be inspected directly."""
    import importlib.util

    path = (
        pathlib.Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "0067_ranking_weight_profiles.py"
    )
    assert path.exists(), f"migration 0067 not found at {path}"
    spec = importlib.util.spec_from_file_location("migration_0067_under_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


async def test_policy_clauses_share_one_predicate():
    """USING and WITH CHECK must carry the identical predicate.

    When the predicate was duplicated, editing one clause could silently leave
    INSERT governed by different scope than SELECT -- invisible-instead-of-rejected,
    in the one migration whose docstring says duplicated RLS variants are what
    have drifted before.
    """
    mod = _load_migration()
    assert hasattr(mod, "_PREDICATE"), (
        "migration 0067 must define a single _PREDICATE constant; the policy "
        "otherwise duplicates the predicate across USING and WITH CHECK"
    )
    policy_sql = mod._POLICY_SQL
    predicate = mod._PREDICATE

    assert policy_sql.count("CREATE POLICY") == 1, "expected exactly one CREATE POLICY"
    assert f"USING ({predicate})" in policy_sql, (
        "the USING clause does not carry _PREDICATE verbatim"
    )
    assert f"WITH CHECK ({predicate})" in policy_sql, (
        "the WITH CHECK clause does not carry _PREDICATE verbatim"
    )
    # Exactly one body per clause: a third, divergent copy would push the count
    # above two, and a single shared constant keeps it at precisely two.
    assert policy_sql.count(predicate) == 2, (
        f"expected the predicate body exactly twice (one per clause), found "
        f"{policy_sql.count(predicate)}"
    )


async def test_policy_uses_column_cast_not_setting_cast():
    """A GUC comparison must never cast the setting to uuid.

    ``NULLIF(current_setting('app.workspace_id', true), '')::uuid`` raises
    ``invalid input syntax for type uuid`` from inside policy evaluation when the
    GUC is not a uuid, and policy evaluation runs on every read -- so a single
    malformed session GUC turns every profile read into a 500 rather than a
    permission denial. The column-cast form yields NULL instead and fails closed.
    """
    mod = _load_migration()
    # Fall back to the whole CREATE POLICY body when there is no single
    # predicate constant, so this test reports the setting-cast problem rather
    # than an AttributeError -- the point is to name the defect precisely.
    predicate = getattr(mod, "_PREDICATE", None) or mod._POLICY_SQL

    assert (
        "workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')" in predicate
    ), "the policy must use the column-cast form for the workspace GUC"
    assert (
        "w.user_id::text = NULLIF(current_setting('app.user_id', true), '')" in predicate
    ), "the policy must use the column-cast form for the user GUC"
    assert ")::uuid" not in predicate, (
        "found a cast-to-uuid of a session GUC in the policy predicate; a "
        "non-uuid GUC would raise inside policy evaluation instead of failing closed"
    )
    # The member-aware half must survive the rewrite: uuid-to-uuid column
    # comparison, which cannot raise.
    assert "WHERE w.id = ranking_weight_profiles.workspace_id" in predicate
    assert "FROM workspace_users wu" in predicate


async def test_policy_constrains_the_user_not_only_the_workspace():
    """The spec asks for a workspace predicate *plus* a user-scope predicate.

    0062's shape -- which this policy is transcribed from -- is workspace-only,
    because ``workspace_capabilities`` has no per-user dimension. This table's
    unit *is* one user's profile, so workspace scope alone would let any member
    of a workspace read every co-member's learned weights. The resolver filters
    ``user_id`` in its own WHERE, which is why nothing leaks today and also why
    nothing would catch it: the application filtering a column is not an
    isolation property, it is an assumption about a query that has not been
    written yet. RLS is the last line of defence; the finding is that this one
    was missing its second lock.
    """
    mod = _load_migration()
    predicate = getattr(mod, "_PREDICATE", None) or mod._POLICY_SQL
    flat = " ".join(predicate.split())

    assert "user_id::text = NULLIF(current_setting('app.user_id', true), '')" in flat, (
        "the policy must constrain rows by app.user_id, not by workspace alone"
    )


async def test_user_predicate_guards_the_whole_workspace_group():
    """SQL binds AND tighter than OR, so the grouping is load-bearing.

    Written flat as ``user = GUC AND workspace = GUC OR EXISTS(...)``, the
    predicate parses as ``user AND (workspace OR EXISTS)`` only by accident of
    where the parens happen to fall; written as ``workspace OR (EXISTS AND
    user)`` -- the natural way to bolt a clause onto the end -- it parses as
    ``workspace OR (...)``, leaving the bare-GUC workspace branch entirely
    unconstrained by ``user_id``. That is the exact hole the previous test
    closes, reintroduced by a change that still *contains* the right substring.

    So this asserts the shape, not the presence: the workspace group must be
    wrapped, and the user comparison must sit outside it.
    """
    mod = _load_migration()
    predicate = getattr(mod, "_PREDICATE", None) or mod._POLICY_SQL
    flat = " ".join(predicate.split())

    user_clause = "user_id::text = NULLIF(current_setting('app.user_id', true), '')"
    workspace_clause = (
        "workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')"
    )
    assert flat.startswith(user_clause + " AND ("), (
        "the predicate must open with the user comparison and parenthesise the "
        f"workspace group, got: {flat[:120]!r}"
    )
    assert workspace_clause in flat, "the workspace comparison must survive"
    # Three ANDs in total: the one joining the user clause to the group, the one
    # inside the `workspaces` EXISTS, and the one inside `workspace_users`. A
    # fourth means a clause was added to only one branch of the OR -- which is
    # how the two branches of a membership predicate drift apart in the first
    # place, and is the shape the migration docstring warns about. Deliberately
    # a magic number: the failure it causes is a conscious edit to this test, not
    # a silent divergence.
    assert flat.count(" AND ") == 3, (
        f"unexpected AND structure in the predicate: {flat!r}"
    )


async def test_weight_columns_are_bounded_to_zero_and_one():
    """NUMERIC(5,4) alone allows up to 9.9999.

    Without a CHECK, an out-of-range weight is caught only by the column's own
    precision limit, and a merely-wrong one (e.g. 3.0) is stored happily as a
    nonsensical score. These constraints are declared inside ``upgrade()``, so
    unlike the policy there is no module constant to inspect; the named
    constraint strings are unique to the DDL and appear in no comment.
    """
    src = _load_migration().__file__
    source = pathlib.Path(src).read_text(encoding="utf-8")
    for column in ("relevance", "recency", "importance", "user_preference"):
        assert f'name="ck_ranking_weight_profiles_{column}"' in source, (
            f"{column} has no named CHECK constraint in migration 0067"
        )
        assert f'"{column} BETWEEN 0 AND 1"' in source, (
            f"{column}'s CHECK constraint does not bound it to 0..1"
        )


# ------------------------------------------------------- live PostgreSQL (RLS)

# tests/test_rls_live_pg.py and test_migration_chain_pg.py both use
# VAELOOM_TEST_PG_URL; the brief for this task named TEST_PG_URL. Both are
# accepted so neither spelling silently skips the proof.
PG_URL = (os.environ.get("VAELOOM_TEST_PG_URL") or os.environ.get("TEST_PG_URL") or "").replace(
    "postgresql+asyncpg://", "postgresql://"
)

requires_pg = pytest.mark.skipif(
    not PG_URL,
    reason="set VAELOOM_TEST_PG_URL (or TEST_PG_URL) to a disposable PostgreSQL",
)

APP_ROLE = "vaeloom_app"
APP_PASSWORD = "vaeloom_app_rls_pw"
TABLE = "ranking_weight_profiles"

# Isolation (and the read itself) must not depend on tenant_id: effective_weights
# filters on workspace_id and user_id only, so the policy is the whole story.
GRANT_SQL = f"""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '{APP_ROLE}') THEN
            CREATE ROLE {APP_ROLE} LOGIN PASSWORD '{APP_PASSWORD}';
        END IF;
    END $$;
    GRANT USAGE ON SCHEMA public TO {APP_ROLE};
    GRANT SELECT ON {TABLE} TO {APP_ROLE};
"""


def _app_url() -> str:
    """Same database, but as the non-superuser app role.

    Superusers bypass RLS entirely, so the proof traffic must not run as one
    (mirrors production, where the app connects as vaeloom_app per 0005).
    """
    from urllib.parse import urlsplit, urlunsplit

    parts = urlsplit(PG_URL)
    netloc = f"{APP_ROLE}:{APP_PASSWORD}@{parts.hostname or 'localhost'}"
    if parts.port:
        netloc += f":{parts.port}"
    return urlunsplit((parts.scheme, netloc, parts.path, parts.query, ""))


async def _require_table(admin) -> None:
    if not await admin.fetchval(f"SELECT to_regclass('public.{TABLE}') IS NOT NULL"):
        pytest.skip(f"{TABLE} does not exist; apply the migration chain first")


@requires_pg
async def test_profile_row_invisible_from_other_workspace_guc():
    """Set app.workspace_id to B; assert B's profile is served and A's is not.

    This is the load-bearing isolation proof for this table, and the only test
    that runs ``effective_weights``' real ``text()`` statement against a real
    ``uuid`` column with the real policy active. SQLite cannot stand in: its uuid
    columns are emulated by ``conftest.MockUUID``, and it has no RLS at all.

    Both GUCs are set on every resolve, because 0067's policy constrains rows by
    ``app.user_id`` as well as ``app.workspace_id``. That matches production,
    where ``_assemble_rag_context`` opens its session through
    ``scoped_session(workspace_id=..., user_id=user_id)`` with the same
    ``user_id`` it then hands to ``effective_weights`` -- so the session GUC, the
    policy's user predicate and the resolver's WHERE are one identity. Setting
    the workspace GUC alone would leave the user GUC unset, the predicate
    NULL-compares false, and every assertion here would "pass" against a policy
    that returned nothing at all -- which is why the third case below pins the
    unset-GUC degradation explicitly.
    """
    import asyncpg

    admin = await asyncpg.connect(PG_URL)
    ws_a, ws_b = uuid.uuid4(), uuid.uuid4()
    user, tenant = uuid.uuid4(), uuid.uuid4()
    ids: list[uuid.UUID] = []
    try:
        await _require_table(admin)
        await admin.execute(GRANT_SQL)

        # Seeded as superuser so the inserts are not themselves RLS-gated; the
        # read below is what must be filtered.
        for ws, pref in ((ws_a, 0.45), (ws_b, 0.25)):
            pid = uuid.uuid4()
            ids.append(pid)
            await admin.execute(
                f"INSERT INTO {TABLE} (id, tenant_id, workspace_id, user_id, relevance,"
                " recency, importance, user_preference, sample_size)"
                " VALUES ($1, $2, $3, $4, 0.4, 0.3, 0.2, $5, 30)",
                pid, tenant, ws, user, pref,
            )

        async def _resolve(workspace, resolve_user=user, set_user_guc=True):
            """Run production effective_weights as the app role in one workspace."""
            engine = create_async_engine(_app_url().replace("postgresql://", "postgresql+asyncpg://"))
            try:
                async with engine.connect() as conn:
                    if workspace is not None:
                        await conn.execute(
                            text("SELECT set_config('app.workspace_id', :ws, false)"),
                            {"ws": str(workspace)},
                        )
                    if set_user_guc and resolve_user is not None:
                        await conn.execute(
                            text("SELECT set_config('app.user_id', :u, false)"),
                            {"u": str(resolve_user)},
                        )
                    # workspace=None deliberately leaves the GUC truly unset.
                    async with AsyncSession(bind=conn) as session:
                        return await effective_weights(
                            session, str(workspace or ws_a), str(resolve_user or user)
                        )
            finally:
                await engine.dispose()

        # 1. Workspace B's GUC serves B's profile, never A's.
        out_b = await _resolve(ws_b)
        assert out_b["user_preference"] == 0.25, "workspace B must see its own profile"
        assert out_b["user_preference"] != 0.45, (
            "workspace B must never be served workspace A's learned weights"
        )

        # 2. Workspace A's GUC serves A's profile, never B's.
        out_a = await _resolve(ws_a)
        assert out_a["user_preference"] == 0.45
        assert out_a["user_preference"] != 0.25

        # 3. Unset GUC is fail-closed: the policy yields no row, so resolution
        #    degrades to DEFAULT_WEIGHTS rather than leaking either profile.
        out_none = await _resolve(None)
        assert out_none["user_preference"] == DEFAULT_WEIGHTS["user_preference"], (
            "with app.workspace_id unset the policy must return no row; a "
            "non-default weight here means the predicate is not fail-closed"
        )
    finally:
        for pid in ids:
            await admin.execute(f"DELETE FROM {TABLE} WHERE id = $1", pid)
        await admin.close()


@requires_pg
async def test_same_workspace_different_user_sees_nothing():
    """The negative control for the added user predicate.

    Right workspace, right membership, wrong user. This is the case the
    workspace-only predicate would have *passed* and the user predicate closes:
    without it, any member of a workspace can SELECT every co-member's learned
    profile, and the only thing standing between that and a read is
    ``effective_weights``' own ``AND user_id = :user_id`` -- the application
    filter, not the isolation boundary. The data is four floats; what it encodes
    is how strongly a named colleague's ranking is tuned, and a second query
    written against this table tomorrow would not carry that filter.

    Read as the *owner* first, so a zero-row result cannot be confused with "the
    row was never there" or "the policy is broken for everybody".
    """
    import asyncpg

    admin = await asyncpg.connect(PG_URL)
    ws = uuid.uuid4()
    owner, stranger, tenant = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    pid = uuid.uuid4()
    try:
        await _require_table(admin)
        await admin.execute(GRANT_SQL)
        await admin.execute(
            f"INSERT INTO {TABLE} (id, tenant_id, workspace_id, user_id, relevance,"
            " recency, importance, user_preference, sample_size)"
            " VALUES ($1, $2, $3, $4, 0.4, 0.3, 0.2, 0.45, 30)",
            pid, tenant, ws, owner,
        )

        async def _resolve_for(resolve_user):
            engine = create_async_engine(_app_url().replace("postgresql://", "postgresql+asyncpg://"))
            try:
                async with engine.connect() as conn:
                    # The stranger's GUCs, in the owner's workspace. Every
                    # workspace-scope branch of the predicate is satisfied; only
                    # the user comparison can deny the row.
                    await conn.execute(
                        text("SELECT set_config('app.workspace_id', :ws, false)"),
                        {"ws": str(ws)},
                    )
                    await conn.execute(
                        text("SELECT set_config('app.user_id', :u, false)"),
                        {"u": str(resolve_user)},
                    )
                    async with AsyncSession(bind=conn) as session:
                        return await effective_weights(session, str(ws), str(resolve_user))
            finally:
                await engine.dispose()

        # Control: the owner, in their own workspace, sees their own row. Without
        # this, "zero rows" would be consistent with a table nobody can read.
        as_owner = await _resolve_for(owner)
        assert as_owner["user_preference"] == 0.45, (
            "precondition: the owner must be able to read their own profile, "
            "otherwise the assertion below proves nothing"
        )

        # The stranger, same workspace GUC, is denied. Because the resolver also
        # filters on user_id, the expected answer is indistinguishable from "no
        # row exists" -- so the denial is proved structurally as well, by
        # counting the rows the *policy* returns for the stranger.
        as_stranger = await _resolve_for(stranger)
        assert as_stranger["user_preference"] == DEFAULT_WEIGHTS["user_preference"], (
            "a different user in the same workspace must resolve to the default "
            "weights; a non-default here means the row leaked"
        )

        # ...and the structural proof: as the stranger, a SELECT that filters on
        # nothing at all still returns zero rows. That query cannot be rescued by
        # the resolver's own WHERE clause, so it can only be the policy denying.
        engine = create_async_engine(_app_url().replace("postgresql://", "postgresql+asyncpg://"))
        try:
            async with engine.connect() as conn:
                await conn.execute(
                    text("SELECT set_config('app.workspace_id', :ws, false)"), {"ws": str(ws)}
                )
                await conn.execute(
                    text("SELECT set_config('app.user_id', :u, false)"), {"u": str(stranger)}
                )
                visible = await conn.scalar(
                    text(f"SELECT count(*) FROM {TABLE}")
                )
                assert int(visible) == 0, (
                    "the policy must hide every ranking_weight_profiles row from a "
                    f"user who owns none of them; the stranger still saw {visible}"
                )
        finally:
            await engine.dispose()
    finally:
        await admin.execute(f"DELETE FROM {TABLE} WHERE id = $1", pid)
        await admin.close()


@requires_pg
async def test_with_check_rejects_insert_into_another_workspace():
    """The WITH CHECK clause is what makes the write path safe.

    USING alone governs only SELECT/UPDATE/DELETE, so without WITH CHECK a row
    can be inserted into somebody else's workspace and then simply never read
    back -- a silently wrong profile rather than a visible failure.

    ``app.user_id`` is set to the *inserted row's own* user, so the policy's
    user predicate passes and the workspace comparison is the only clause that
    can fail. Setting only the workspace GUC would make the insert doubly
    invalid and would prove less: the denial could be entirely the user clause,
    leaving the cross-workspace hole untested.

    The insert runs as the non-superuser app role; as a superuser it would
    bypass the policy entirely and prove nothing.

    The rejection is asserted by SQLSTATE ``42501``
    (``insufficient_privilege``) specifically, not by matching message text. A
    broader ``policy|permission|violates`` pattern would also be satisfied by a
    not-null violation (23502) or a CHECK-constraint violation (23514) -- and
    since this table now carries CHECK bounds on the weight columns, a
    mis-specified weight would satisfy such a pattern. That is precisely the
    "passing for the wrong reason" failure this assertion has to exclude.
    """
    import asyncpg
    from asyncpg import exceptions as pg_exceptions

    admin = await asyncpg.connect(PG_URL)
    ws_guc, ws_other, stray, stray_user = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    try:
        await _require_table(admin)
        await admin.execute(GRANT_SQL.replace("GRANT SELECT ON", "GRANT SELECT, INSERT ON"))
    finally:
        await admin.close()

    app = await asyncpg.connect(_app_url())
    try:
        await app.execute("SELECT set_config('app.workspace_id', $1, false)", str(ws_guc))
        await app.execute("SELECT set_config('app.user_id', $1, false)", str(stray_user))
        # Row is otherwise perfectly valid: correct columns, every weight inside
        # 0..1 so the CHECK bounds pass, correct NOT NULLs, and a user_id that
        # matches the caller's own GUC. Only the cross-workspace WITH CHECK can
        # reject it.
        with pytest.raises(pg_exceptions.InsufficientPrivilegeError) as exc_info:
            await app.execute(
                f"INSERT INTO {TABLE} (id, tenant_id, workspace_id, user_id, relevance,"
                " recency, importance, user_preference, sample_size)"
                " VALUES ($1, $2, $3, $4, 0.4, 0.3, 0.2, 0.1, 1)",
                stray, uuid.uuid4(), ws_other, stray_user,
            )
        assert exc_info.value.sqlstate == "42501", (
            "expected an RLS permission denial (SQLSTATE 42501); got "
            f"{exc_info.value.sqlstate}: {exc_info.value}"
        )
    finally:
        await app.close()

    # Confirm the rejected row really is absent, read back as superuser.
    admin = await asyncpg.connect(PG_URL)
    try:
        assert await admin.fetchval(f"SELECT count(*) FROM {TABLE} WHERE id = $1", stray) == 0, (
            "a rejected insert must leave no row behind"
        )
    finally:
        await admin.close()


@requires_pg
async def test_insert_into_the_callers_own_profile_succeeds():
    """The positive control for the same policy.

    The paired negative control above is only meaningful next to this one. A
    predicate that denied *everything* would pass that test perfectly, so
    "provisioning is refused" is indistinguishable from "this table is
    unwritable" without proof that the legitimate write still lands.

    This is the exact shape ``ranking_weights.provision_profile`` issues: the
    caller's own workspace, the caller's own user, both GUCs set. If the added
    user predicate over-tightened -- or if the caller could not satisfy it --
    this is where it shows, as SQLSTATE 42501.
    """
    import asyncpg

    admin = await asyncpg.connect(PG_URL)
    ws, user, tenant, pid = uuid.uuid4(), uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    try:
        await _require_table(admin)
        await admin.execute(GRANT_SQL.replace("GRANT SELECT ON", "GRANT SELECT, INSERT ON"))
    finally:
        await admin.close()

    app = await asyncpg.connect(_app_url())
    try:
        await app.execute("SELECT set_config('app.workspace_id', $1, false)", str(ws))
        await app.execute("SELECT set_config('app.user_id', $1, false)", str(user))
        await app.execute(
            f"INSERT INTO {TABLE} (id, tenant_id, workspace_id, user_id, relevance,"
            " recency, importance, user_preference, sample_size)"
            " VALUES ($1, $2, $3, $4, 0.4, 0.3, 0.2, 0.1, 0)",
            pid, tenant, ws, user,
        )
    finally:
        await app.close()

    admin = await asyncpg.connect(PG_URL)
    try:
        assert await admin.fetchval(f"SELECT count(*) FROM {TABLE} WHERE id = $1", pid) == 1, (
            "a caller must be able to write their own profile; if this fails the "
            "policy is over-tight and provisioning is impossible"
        )
    finally:
        await admin.execute(f"DELETE FROM {TABLE} WHERE id = $1", pid)
        await admin.close()


@requires_pg
async def test_policy_is_forced_so_the_owner_cannot_bypass_it():
    """ENABLE without FORCE exempts the table owner from the policy.

    That is the bypass 0065 was written to close, so the invariant is asserted
    rather than assumed for this table.
    """
    import asyncpg

    admin = await asyncpg.connect(PG_URL)
    try:
        await _require_table(admin)
        row = await admin.fetchrow(
            "SELECT c.relrowsecurity, c.relforcerowsecurity FROM pg_class c "
            "JOIN pg_namespace n ON n.oid = c.relnamespace "
            "WHERE n.nspname='public' AND c.relname=$1",
            TABLE,
        )
        assert row["relrowsecurity"] is True, f"{TABLE} does not have RLS enabled"
        assert row["relforcerowsecurity"] is True, (
            f"{TABLE} does not have FORCE ROW LEVEL SECURITY; a table-owner "
            "connection bypasses the policy"
        )
        policies = await admin.fetch("SELECT policyname FROM pg_policies WHERE tablename=$1", TABLE)
        assert [p["policyname"] for p in policies] == [
            "p_ranking_weight_profiles_workspace_isolation"
        ], f"unexpected policies on {TABLE}: {[p['policyname'] for p in policies]}"
    finally:
        await admin.close()
