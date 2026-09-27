"""Migration 0057 must work against either shape of `users.id`.

This is the only test that can catch the defect. SQLite does not enforce foreign
key column types, so the SQLite suite cannot see a type mismatch at all. On
PostgreSQL a mismatch is fatal and takes the whole migration transaction with it,
which is how this was originally found.

Two shapes are covered, because both exist in the wild:

* `uuid`    - what `0001_initial_schema.py` declares, so any database built by
  this migration chain
* `varchar` - what the managed instance actually has, which is why applying 0057
  there failed with
  ``foreign key constraint "password_reset_tokens_user_id_fkey" cannot be implemented``

Each case builds a throwaway schema, so nothing real is touched, and `search_path`
makes the migration's own reflection see exactly the table the test created -
which is what makes the reflection testable at all.

Skipped unless `VAELOOM_TEST_PG_URL` is set, so the SQLite suite never gains a
dependency on a running database. The target must have the `vector` extension and
the `service_role` / `authenticated` / `vaeloom_app` roles, because 0057 also
creates an RLS policy; see `EXECUTION-LOG.md` for the container recipe.
"""

import importlib.util
import os
import pathlib

import pytest
import sqlalchemy as sa

pytestmark = pytest.mark.skipif(
    not os.environ.get("VAELOOM_TEST_PG_URL"),
    reason="set VAELOOM_TEST_PG_URL to a disposable PostgreSQL to run this",
)


def _load_migration():
    """Import 0057 as a module so `upgrade()` can be driven directly."""
    mig_path = (
        pathlib.Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "0057_password_reset_tokens.py"
    )
    spec = importlib.util.spec_from_file_location("mig0057", mig_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _ops_for(sync_conn):
    """An Alembic `Operations` proxy bound to this connection.

    The migration reaches for the module-level `op` global, so the test swaps it
    for the duration of the call.
    """
    from alembic.migration import MigrationContext
    from alembic.operations import Operations

    return Operations(MigrationContext.configure(sync_conn))


async def _in_throwaway_schema(scenario):
    """Run `scenario(sync_conn, schema)`, then drop the schema it created.

    The name is computed in exactly one place and handed to the scenario, so
    cleanup can never target a different schema than the one that was built.
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    schema = f"t0057_{os.getpid()}_{abs(hash(scenario)) % 100000}"

    def wrapper(sync_conn):
        sync_conn.execute(sa.text(f'CREATE SCHEMA "{schema}"'))
        try:
            sync_conn.execute(sa.text(f'SET LOCAL search_path TO "{schema}"'))
            return scenario(sync_conn, schema)
        finally:
            sync_conn.execute(sa.text(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE'))

    try:
        async with engine.begin() as conn:
            await conn.run_sync(wrapper)
    finally:
        await engine.dispose()


@pytest.mark.asyncio
@pytest.mark.parametrize("id_type", ["uuid", "varchar"])
async def test_0057_applies_against_either_users_id_type(id_type, monkeypatch):
    """The migration must build a valid FK regardless of how `users.id` is typed."""

    def scenario(sync_conn, schema):
        sync_conn.execute(
            sa.text(f'CREATE TABLE users (id {id_type} NOT NULL PRIMARY KEY)')
        )
        sync_conn.execute(sa.text(f'SET LOCAL search_path TO "{schema}"'))

        mig = _load_migration()
        monkeypatch.setattr(mig, "op", _ops_for(sync_conn))
        mig.upgrade()

        fk = sync_conn.execute(
            sa.text(
                "SELECT count(*) FROM information_schema.table_constraints "
                "WHERE table_schema=:s AND table_name='password_reset_tokens' "
                "AND constraint_type='FOREIGN KEY'"
            ),
            {"s": schema},
        ).scalar()
        assert fk == 1, "the foreign key must be created, not silently skipped"

        resolved = sync_conn.execute(
            sa.text(
                "SELECT udt_name FROM information_schema.columns "
                "WHERE table_schema=:s AND table_name='password_reset_tokens' "
                "AND column_name='user_id'"
            ),
            {"s": schema},
        ).scalar()
        expected = "uuid" if id_type == "uuid" else "varchar"
        assert resolved == expected, (
            f"user_id must take the type of users.id ({expected}), got {resolved}"
        )

    await _in_throwaway_schema(scenario)


@pytest.mark.asyncio
async def test_0057_reflects_the_referenced_column_type(monkeypatch):
    """`_users_id_type` must report the real column type, not a default.

    This is the specific helper whose first attempt returned a value that
    disagreed with PostgreSQL. Asserting it against a live database is the only
    way to know it agrees.
    """

    def scenario(sync_conn, schema):
        sync_conn.execute(
            sa.text("CREATE TABLE users (id VARCHAR(64) NOT NULL PRIMARY KEY)")
        )
        sync_conn.execute(sa.text(f'SET LOCAL search_path TO "{schema}"'))

        mig = _load_migration()
        monkeypatch.setattr(mig, "op", _ops_for(sync_conn))

        resolved = mig._users_id_type()
        assert resolved is not None
        assert not isinstance(resolved, sa.Uuid), (
            "with a VARCHAR users.id the helper must not return a UUID type"
        )
        assert "CHAR" in str(resolved).upper(), f"expected a character type, got {resolved!r}"

    await _in_throwaway_schema(scenario)


@pytest.mark.asyncio
async def test_0057_falls_back_when_users_is_absent(monkeypatch):
    """A missing `users` table must not raise a second, unrelated error.

    It cannot happen on a valid database, but if it ever did, the operator needs
    to see the real cause rather than a reflection failure.
    """

    def scenario(sync_conn, schema):
        mig = _load_migration()
        monkeypatch.setattr(mig, "op", _ops_for(sync_conn))
        assert mig._users_id_type() is not None, "the helper must always return a type"

    await _in_throwaway_schema(scenario)
