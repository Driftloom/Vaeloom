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
import re
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
    assert not (await db_session.execute(
        select(RankingWeightProfile).where(RankingWeightProfile.workspace_id == ws_a)
    )).scalars().all(), "workspace A must see zero profiles"


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

        async def _resolve(workspace):
            """Run production effective_weights as the app role in one workspace."""
            engine = create_async_engine(_app_url().replace("postgresql://", "postgresql+asyncpg://"))
            try:
                async with engine.connect() as conn:
                    if workspace is not None:
                        await conn.execute(
                            text("SELECT set_config('app.workspace_id', :ws, false)"),
                            {"ws": str(workspace)},
                        )
                    # workspace=None deliberately leaves the GUC truly unset.
                    async with AsyncSession(bind=conn) as session:
                        return await effective_weights(session, str(workspace or ws_a), str(user))
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
async def test_with_check_rejects_insert_into_another_workspace():
    """The WITH CHECK clause is what makes the write path safe.

    USING alone governs only SELECT/UPDATE/DELETE, so without WITH CHECK a row
    can be inserted into somebody else's workspace and then simply never read
    back -- a silently wrong profile rather than a visible failure.

    The insert runs as the non-superuser app role; as a superuser it would
    bypass the policy entirely and prove nothing.
    """
    import asyncpg

    admin = await asyncpg.connect(PG_URL)
    ws_guc, ws_other, stray = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    try:
        await _require_table(admin)
        await admin.execute(GRANT_SQL.replace("GRANT SELECT ON", "GRANT SELECT, INSERT ON"))
    finally:
        await admin.close()

    app = await asyncpg.connect(_app_url())
    try:
        await app.execute("SELECT set_config('app.workspace_id', $1, false)", str(ws_guc))
        # Row is otherwise perfectly valid: correct columns, correct defaults,
        # correct NOT NULLs. Only the RLS WITH CHECK can reject it.
        with pytest.raises(Exception) as exc_info:
            await app.execute(
                f"INSERT INTO {TABLE} (id, tenant_id, workspace_id, user_id, relevance,"
                " recency, importance, user_preference, sample_size)"
                " VALUES ($1, $2, $3, $4, 0.4, 0.3, 0.2, 0.1, 1)",
                stray, uuid.uuid4(), ws_other, uuid.uuid4(),
            )
        assert re.search(
            r"(?i)(policy|permission|violates|row-level)", str(exc_info.value)
        ), f"insert failed for an unexpected reason: {exc_info.value}"
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
