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


async def test_downgrade_check_constraint_rejects_unregistered_memory_type():
    """0068's downgrade restores 0027's CHECK constraint; it must fail on non-career types.

    The reverse migration re-applies:
        ALTER TABLE memories ADD CONSTRAINT ck_memories_type_valid CHECK (type IN (...))

    If `memories` contains any row with a type outside the 24 canonical career types
    (such as a row written under a domain pack), this ALTER TABLE must fail loudly,
    naming `ck_memories_type_valid`. This tests the fail-closed data safety boundary
    where `ADD CONSTRAINT` re-validates live rows.
    """
    import importlib.util
    import uuid

    api_root = pathlib.Path(__file__).resolve().parents[1]
    rev_0068_path = api_root / "alembic" / "versions" / "0068_memory_type_packs.py"
    if not rev_0068_path.exists():
        pytest.skip("0068_memory_type_packs.py does not exist")

    spec = importlib.util.spec_from_file_location("rev_0068", rev_0068_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    test_id = str(uuid.uuid4())
    try:
        async with engine.connect() as conn:
            # Insert a memory row with an invalid type outside the 24 career types
            await conn.execute(
                sa.text(
                    "INSERT INTO memories (id, type, status, title, content_hash, size, metadata, tags) "
                    "VALUES (:id, 'custom_unregistered_domain_type', 'active', 'test', 'hash123', 10, '{}'::jsonb, '{}');"
                ),
                {"id": test_id},
            )
            await conn.commit()

            # Attempting to apply the downgrade CHECK constraint must fail
            with pytest.raises(Exception) as exc_info:
                await conn.execute(sa.text(mod._CHECK_SQL))
                await conn.commit()

            err_msg = str(exc_info.value).lower()
            assert "ck_memories_type_valid" in err_msg, (
                f"expected 'ck_memories_type_valid' in error, got: {err_msg}"
            )
    finally:
        async with engine.connect() as conn:
            await conn.execute(
                sa.text("DELETE FROM memories WHERE id = :id;"),
                {"id": test_id},
            )
            await conn.commit()


async def test_downgrade_check_constraint_accepts_canonical_career_type():
    """Positive control: the restored CHECK constraint succeeds when rows match canonical types."""
    import importlib.util
    import uuid

    api_root = pathlib.Path(__file__).resolve().parents[1]
    rev_0068_path = api_root / "alembic" / "versions" / "0068_memory_type_packs.py"
    if not rev_0068_path.exists():
        pytest.skip("0068_memory_type_packs.py does not exist")

    spec = importlib.util.spec_from_file_location("rev_0068", rev_0068_path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(os.environ["VAELOOM_TEST_PG_URL"])
    test_id = str(uuid.uuid4())
    try:
        async with engine.connect() as conn:
            await conn.execute(
                sa.text(
                    "INSERT INTO memories (id, type, status, title, content_hash, size, metadata, tags) "
                    "VALUES (:id, 'document', 'active', 'valid test', 'hash123', 10, '{}'::jsonb, '{}');"
                ),
                {"id": test_id},
            )
            await conn.commit()

            # Applying the downgrade CHECK constraint must succeed
            await conn.execute(sa.text(mod._CHECK_SQL))
            await conn.commit()

            # Clean up the constraint so we leave the table at HEAD state
            await conn.execute(
                sa.text("ALTER TABLE memories DROP CONSTRAINT IF EXISTS ck_memories_type_valid;")
            )
            await conn.commit()
    finally:
        async with engine.connect() as conn:
            await conn.execute(
                sa.text("DELETE FROM memories WHERE id = :id;"),
                {"id": test_id},
            )
            await conn.commit()


import pathlib  # noqa: E402  (used by the tests above; imported late on purpose)




# ---------------------------------------------------------------------------
# 0069 -- workspace isolation for preference learning, and the retirement of the
# second frozen vocabulary.
#
# These run only against a live PostgreSQL applied to head. They are the only
# thing that proves the column exists, that the primary key actually changed,
# and that the policies can SEE the new column -- an RLS policy still scoping on
# user_id alone would leave the column decorative.
# ---------------------------------------------------------------------------


def _rev_0069_path() -> pathlib.Path:
    return (
        pathlib.Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "0069_memory_workspace_isolation.py"
    )


async def test_0069_adds_a_nullable_workspace_to_recommendation_feedback():
    nullable = await _query(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_name='recommendation_feedback' AND column_name='workspace_id';"
    )
    assert nullable == ["YES"], (
        "workspace_id must be nullable so legacy rows are quarantined rather than "
        f"backfilled with a guess; got {nullable}"
    )


async def test_0069_user_preference_vectors_is_keyed_by_workspace():
    keys = await _query(
        "SELECT a.attname FROM pg_index i "
        "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
        "WHERE i.indrelid = 'user_preference_vectors'::regclass AND i.indisprimary "
        "ORDER BY array_position(i.indkey, a.attnum);"
    )
    assert keys == ["user_id", "tenant_id", "workspace_id"], (
        f"preference vectors must be per-workspace; primary key is {keys}"
    )


async def test_0069_retires_the_second_frozen_vocabulary():
    rows = await _query(
        "SELECT conname FROM pg_constraint "
        "WHERE conrelid='memory_records'::regclass "
        "AND conname='ck_memory_records_type_valid';"
    )
    assert rows == [], (
        "memory_records must be governed by the domain-pack registry, not a second "
        f"frozen vocabulary; still present: {rows}"
    )


async def test_0069_policies_can_see_the_new_column():
    # The whole point of the column. A policy scoping on user_id alone lets a rating
    # in one workspace move the profile in another while looking perfectly correct.
    for table in ("recommendation_feedback", "user_preference_vectors"):
        defs = await _query(
            "SELECT coalesce(string_agg(pg_get_expr(pol.polqual, pol.polrelid), ' '), '') "
            "FROM pg_policy pol WHERE pol.polrelid = "
            f"'{table}'::regclass AND pol.polname LIKE '%workspace%';"
        )
        assert defs, f"{table} has no workspace-scoped policy"
        assert "app.workspace_id" in defs[0], (
            f"{table} policy does not read app.workspace_id: {defs[0][:200]}"
        )


async def test_0069_replaces_the_user_tenant_policies_rather_than_adding_to_them():
    """PostgreSQL ORs PERMISSIVE policies, so adding beside is widening.

    The pre-0069 predicate is `user_id = me AND tenant_id = mine`. A workspace
    policy left alongside it produces
        (user_id = me AND tenant_id = mine) OR (workspace_id = my_workspace)
    which lets any workspace member read and update every other member's rows,
    and -- because user_id is whatever the caller supplies on INSERT -- file a
    rating in someone else's name. Exactly one policy per table must remain.
    """
    for table, superseded in (
        ("recommendation_feedback", "p_recommendation_feedback_user_tenant"),
        ("user_preference_vectors", "p_user_preference_vectors_user_tenant"),
    ):
        remaining = await _query(
            "SELECT policyname FROM pg_policies "
            f"WHERE tablename = '{table}' AND policyname = '{superseded}';"
        )
        assert remaining == [], (
            f"{table} still carries the pre-0069 policy {superseded!r}. Permissive "
            "policies are ORed, so it ORs with the workspace policy and grants "
            "every workspace member access to every other member's rows."
        )


async def test_0069_policy_scopes_on_user_as_well_as_workspace():
    """Workspace alone answers 'whose workspace', not 'whose row'."""
    for table in ("recommendation_feedback", "user_preference_vectors"):
        defs = await _query(
            "SELECT coalesce(string_agg(pg_get_expr(pol.polqual, pol.polrelid), ' '), '') "
            "FROM pg_policy pol WHERE pol.polrelid = "
            f"'{table}'::regclass AND pol.polname LIKE '%workspace%';"
        )
        assert defs, f"{table} has no workspace-scoped policy"
        assert "app.user_id" in defs[0], (
            f"{table} workspace policy does not read app.user_id, so any member "
            f"of the workspace can reach every other member's rows: {defs[0][:200]}"
        )


async def test_0069_keeps_rls_enabled_and_forced_on_every_touched_table():
    for table in ("recommendation_feedback", "user_preference_vectors"):
        # _query projects a single column, so concatenate in SQL rather than
        # selecting two booleans and comparing to a tuple the helper cannot return.
        state = await _query(
            "SELECT relrowsecurity::text || '|' || relforcerowsecurity::text "
            f"FROM pg_class WHERE relname='{table}';"
        )
        # Normalised: PostgreSQL renders booleans lowercase as `true`, and
        # pinning the exact spelling would make this a test of formatting.
        assert [value.lower() for value in state] == ["true|true"], (
            f"{table} must keep RLS enabled AND forced; got {state}"
        )


def test_0069_downgrade_restores_the_identical_24_literals():
    # Byte-identical to 0027, or the two vocabularies drift the moment someone
    # edits one of them.
    import importlib.util
    import sys

    spec = importlib.util.spec_from_file_location("rev_0069", _rev_0069_path())
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)

    source_0027 = (
        pathlib.Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "0027_memory_taxonomy_expand_contract.py"
    ).read_text(encoding="utf-8")
    block = source_0027.split("ADD CONSTRAINT ck_memory_records_type_valid")[1]
    literals = [
        token.strip().strip("',")
        for token in block.split("CHECK (type IN (")[1].split(")")[0].replace("\n", " ").split(",")
    ]
    literals = [value for value in literals if value]
    assert tuple(literals) == module._FROZEN_TYPES, (
        f"0069 restores {len(module._FROZEN_TYPES)} literals, 0027 declares "
        f"{len(literals)}; symmetric difference: {set(literals) ^ set(module._FROZEN_TYPES)}"
    )


async def test_0069_leaves_no_workspace_less_preference_vector():
    """The end state the upgrade must reach.

    This asserts the RESULT, not the mechanism. The previous version of this test
    made the same assertion without ever inserting a legacy vector or running
    `upgrade()`, so it was true by construction on a container that started empty
    -- and the evidence file reported it as covering the PK/NULL defect. The
    upgrade-ordering proof belongs to `test_0069_discards_legacy_vectors_before_
    taking_the_key`, which exercises the real path.
    """
    rows = await _query(
        "SELECT count(*) FROM user_preference_vectors WHERE workspace_id IS NULL;"
    )
    assert rows == ["0"], (
        "no vector may remain workspace-less: the primary key rejects NULL, so a "
        f"surviving row means the key was never taken; found {rows}"
    )


def test_0069_discards_legacy_vectors_before_taking_the_key():
    """A primary key column cannot be NULL, and every legacy vector is NULL.

    With no rows, `ADD CONSTRAINT ... PRIMARY KEY (user_id, tenant_id,
    workspace_id)` succeeds and the migration only fails later against real data.
    The upgrade must therefore clear legacy vectors *before* taking the key.

    Order is asserted on the source rather than by running a downgrade/upgrade
    cycle: the destructive path is the rollback proof the harness already owns,
    and duplicating it here would double the cost of every CI run for the same
    guarantee. What is asserted here is the thing that actually broke -- the
    DELETE precedes the ADD CONSTRAINT, and the column is set NOT NULL between
    them.
    """
    import ast

    tree = ast.parse(pathlib.Path(__file__).resolve().parents[1].joinpath(
        "alembic", "versions", "0069_memory_workspace_isolation.py"
    ).read_text(encoding="utf-8"))

    upgrade = next(
        node for node in ast.walk(tree)
        if isinstance(node, ast.FunctionDef) and node.name == "upgrade"
    )
    # _safe(bind, sql): the SQL is the SECOND argument, and it is usually an
    # f-string, so unparse rather than reading .value off a Constant.
    statements = [
        ast.unparse(node.args[1])
        for node in ast.walk(upgrade)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "_safe"
        and len(node.args) > 1
    ]
    joined = "\n".join(statements)

    # The SQL is written as f-strings, so ast.unparse leaves the placeholders in
    # (DELETE FROM {_VECTORS} ...). Match the fragments that are literal in the
    # source; the identifiers they omit are constants defined in the same module.
    delete_at = joined.find("WHERE workspace_id IS NULL")
    notnull_at = joined.find("ALTER COLUMN workspace_id SET NOT NULL")
    pk_at = joined.find("PRIMARY KEY (user_id, tenant_id, workspace_id)")

    assert -1 not in (delete_at, notnull_at, pk_at), f"0069 upgrade lost a step:\n{joined}"
    assert delete_at < notnull_at < pk_at, (
        "legacy vectors must be deleted, then the column set NOT NULL, and only "
        f"then the primary key taken -- otherwise the key cannot be created. "
        f"delete={delete_at} notnull={notnull_at} pk={pk_at}"
    )


async def test_0069_workspace_on_preference_vectors_is_not_null():
    nullable = await _query(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_name='user_preference_vectors' AND column_name='workspace_id';"
    )
    assert nullable == ["NO"], (
        "workspace_id is part of the primary key and must be NOT NULL, otherwise "
        f"vectors can be written that the key cannot represent; got {nullable}"
    )
