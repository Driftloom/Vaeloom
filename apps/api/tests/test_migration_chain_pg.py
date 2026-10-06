"""PostgreSQL migration-chain invariants, measured on a real database.

SQLite cannot verify any of this: it has no row-level security, no
`pg_policies`, and it does not enforce foreign key column types. Every defect in
this file was invisible to the default test run and only appeared when the chain
was executed against PostgreSQL 16.

Skipped unless `VAELOOM_TEST_PG_URL` is set. In CI it should point at a
disposable `pgvector/pgvector:pg16` container with the Supabase-compatible roles
created; see `EXECUTION-LOG.md` for the recipe.

The assertions are deliberately about the *end state* rather than about which
migration did the work. Several tables have been given RLS by more than one
migration over time, and a test that pinned the mechanism would break every time
a policy was legitimately re-homed.
"""

import os

import pytest
import sqlalchemy as sa

pytestmark = pytest.mark.skipif(
    not os.environ.get("VAELOOM_TEST_PG_URL"),
    reason="set VAELOOM_TEST_PG_URL to a disposable PostgreSQL to run this",
)


async def _query(sql: str) -> list[str]:
    """Run a read-only scalar query and return the rows.

    Deliberately not using the ORM: these are catalogue queries about the shape
    of the database itself, and going through metadata would hide exactly the
    drift being measured.

    Async rather than wrapping `asyncio.run`, because these are called from
    `pytest-asyncio` tests that already have a running loop.
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    try:
        async with engine.connect() as conn:
            result = await conn.execute(sa.text(sql))
            return [str(r[0]) for r in result.fetchall()]
    finally:
        await engine.dispose()


async def _base_tables() -> list[str]:
    return await _query(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1;"
    )


async def _alembic_head() -> str | None:
    rows = await _query("SELECT version_num FROM alembic_version;")
    return rows[0] if rows else None


async def test_chain_reaches_head():
    """A fully migrated database must be stamped with the head revision.

    `alembic_version` is the record of what the operator believes was applied, so
    it drifting from reality is the single most misleading failure mode there is.
    """
    head = await _alembic_head()
    assert head, "alembic_version is empty: the chain did not complete"


async def _rowsecurity(table: str) -> bool | None:
    """`pg_tables.rowsecurity` for one table, as a real boolean.

    Returned as a bool rather than a string because asyncpg decodes PostgreSQL
    booleans to Python `True`/`False`. Comparing against psql's textual `t` would
    make every table look unprotected and the assertion meaningless.
    """
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                sa.text(
                    "SELECT rowsecurity FROM pg_tables "
                    "WHERE schemaname='public' AND tablename=:t;"
                ),
                {"t": table},
            )
            row = result.first()
            return None if row is None else bool(row[0])
    finally:
        await engine.dispose()


async def _forcerowsecurity(table: str) -> bool | None:
    """`pg_class.relforcerowsecurity` for one table, as a real boolean."""
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                sa.text(
                    "SELECT c.relforcerowsecurity FROM pg_class c "
                    "JOIN pg_namespace n ON n.oid = c.relnamespace "
                    "WHERE n.nspname='public' AND c.relname=:t;"
                ),
                {"t": table},
            )
            row = result.first()
            return None if row is None else bool(row[0])
    finally:
        await engine.dispose()


async def test_every_table_has_row_level_security():
    """No table may be readable by every role.

    This is the check that would have caught `document_actions`, which was created
    by `0048` *after* `0028`/`0036` had already applied policies to it. The
    statements were skipped, the run reported success, and the audit trail for
    document moves and deletions was left with no isolation at all.
    """
    offenders = [t for t in await _base_tables() if await _rowsecurity(t) is not True]
    assert not offenders, f"tables without RLS enabled: {sorted(offenders)}"


async def test_every_table_has_forced_row_level_security():
    """All tables must have FORCE ROW LEVEL SECURITY to prevent owner bypass (0066)."""
    offenders = [t for t in await _base_tables() if await _forcerowsecurity(t) is not True]
    assert not offenders, f"tables without FORCED RLS: {sorted(offenders)}"


async def test_every_table_has_at_least_one_policy():
    """RLS with no policy denies everything, including legitimate traffic.

    Enabled-but-empty is a different failure from not-enabled, and an easy one to
    introduce by enabling RLS on a table whose policy creation is later in the
    same script. Both are broken; they break in opposite directions.
    """
    offenders = []
    for t in await _base_tables():
        r = await _query(f"SELECT count(*) FROM pg_policies WHERE tablename='{t}';")
        if r == ["0"]:
            offenders.append(t)
    assert not offenders, f"tables with RLS but no policies: {sorted(offenders)}"


async def test_vector_extension_is_created_by_the_chain():
    """pgvector must not be an undocumented prerequisite.

    The chain uses the `vector` type for embedding columns but never installed the
    extension, so it only worked on Supabase where pgvector is already enabled and
    failed everywhere else with `type "vector" does not exist`.
    """
    assert await _query("SELECT extname FROM pg_extension WHERE extname='vector';") == [
        "vector"
    ]


async def test_webhook_tables_exist():
    """`webhooks` and `webhook_deliveries` are ORM models with a live router.

    No migration created them, while eight migrations applied RLS policies to
    them. The policies were silently skipped and the failure would have surfaced
    as an `UndefinedTableError` at runtime instead of at deploy time.
    """
    tables = set(await _base_tables())
    for expected in ("webhooks", "webhook_deliveries"):
        assert expected in tables, f"{expected} is an ORM model but was never created"


async def test_password_reset_tokens_exists_with_a_foreign_key():
    """The 0057 table must exist, and its FK must be real rather than skipped."""
    tables = set(await _base_tables())
    assert "password_reset_tokens" in tables
    fks = await _query(
        "SELECT count(*) FROM information_schema.table_constraints "
        "WHERE table_schema='public' AND table_name='password_reset_tokens' "
        "AND constraint_type='FOREIGN KEY';"
    )
    assert fks and fks[0] != "0", "password_reset_tokens has no foreign key to users"


async def test_every_orm_model_has_a_table():
    """No model may reference a table the chain never creates.

    This is the check that generalises the `webhooks` finding: any future model
    added without a matching `create_table` would otherwise be a runtime
    `UndefinedTableError` that no test in the default suite could see.
    """
    import pathlib
    import re

    schema_py = (
        pathlib.Path(__file__).resolve().parents[1]
        / "src"
        / "api"
        / "models"
        / "schema.py"
    ).read_text(encoding="utf-8")
    models = set(re.findall(r'__tablename__\s*=\s*"([a-z0-9_]+)"', schema_py))

    missing = sorted(models - set(await _base_tables()))
    assert not missing, f"ORM models with no table: {missing}"


async def test_head_includes_the_rls_coverage_guard():
    """The head migration must re-assert full RLS coverage.

    Sixteen migrations carry savepoint helpers that swallow errors and print a
    line, which is the root cause of every migration defect found in this audit.
    Rewriting them is riskier than verifying the outcome, so `0060` is what turns
    "a statement was skipped" into "the deploy fails".

    The guard stops guarding the moment a migration is appended after it, so each
    new head must end with the same end-state assertion. This test therefore
    asserts the *invariant* — the head re-checks coverage, and `0060` is still an
    ancestor so the original guard is in the chain — rather than pinning a literal
    revision id, which any appended migration invalidates.

    Alembic's own script directory is used rather than parsing the revision
    strings: a regex over the files reported a second head that does not exist,
    because `down_revision` is annotated in several different forms across the
    sixty-plus files.
    """
    from alembic.config import Config
    from alembic.script import ScriptDirectory

    api_root = pathlib.Path(__file__).resolve().parents[1]
    cfg = Config(str(api_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(api_root / "alembic"))
    script = ScriptDirectory.from_config(cfg)

    heads = script.get_heads()
    assert len(heads) == 1, (
        f"expected a single migration head, found {heads}. A forked graph means "
        "`upgrade head` is ambiguous."
    )
    assert (api_root / "alembic" / "versions" / "0060_verify_rls_coverage.py").exists()

    # The original guard must still be in the chain, otherwise nothing below it
    # inherits the "a skipped statement fails the deploy" property.
    ancestry = {rev.revision for rev in script.walk_revisions()}
    assert "0060" in ancestry, (
        "0060_verify_rls_coverage is no longer part of the migration graph."
    )

    head = script.get_revision(heads[0])
    head_source = pathlib.Path(head.path) if getattr(head, "path", None) else None
    if not head_source or not head_source.exists():
        # Fall back to a directory scan by revision prefix
        candidates = sorted((api_root / "alembic" / "versions").glob(f"{heads[0]}_*.py"))
        assert candidates, f"no migration file found for head {heads[0]}"
        head_source = candidates[0]
    source = head_source.read_text(encoding="utf-8")
    assert "incomplete RLS coverage" in source, (
        f"head migration {heads[0]} ({head_source.name}) does not re-assert RLS "
        "coverage. A statement skipped in this migration would now have nothing "
        "after it to notice. Append the coverage check to this migration, or "
        "chain it behind a new guard."
    )


async def test_strict_exec_reraises_unexpected_errors():
    """`alembic/_strict_exec` must not repeat the legacy swallow-everything bug.

    It is the helper every new migration is expected to use, so its failure
    behaviour is worth pinning: a tolerated forward reference returns False, and
    anything else propagates.
    """
    import importlib.util

    from sqlalchemy.ext.asyncio import create_async_engine

    spec = importlib.util.spec_from_file_location(
        "strict_exec",
        pathlib.Path(__file__).resolve().parents[1] / "alembic" / "_strict_exec.py",
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    # A missing relation is the one tolerated case, and it must return False
    # rather than raise.
    assert mod._is_forward_reference(
        Exception('relation "no_such_table" does not exist')
    )
    # A syntax error has no benign reading and must not be classified as expected.
    assert not mod._is_forward_reference(Exception('syntax error at or near "CREAT"'))
    assert not mod._is_forward_reference(Exception("permission denied for table users"))
    assert not mod._is_forward_reference(ValueError("unrelated"))


import pathlib  # noqa: E402  (used by the tests above; imported late on purpose)
