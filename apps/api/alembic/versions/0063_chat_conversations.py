"""Chat conversation persistence (0063).

Revision ID: 0063
Revises: 0062
Create Date: 2026-10-01

Why this exists
---------------
The entire chat transcript lived in the browser origin's localStorage: not shared
across devices, destroyed by a site-data clear, and holding resume PII
(salaries, job descriptions) in plaintext outside every access control the
backend has. Both tables here carry a real ``workspace_id`` UUID foreign key
precisely so row-level security has a column to key on - a chat table without one
would have to fall back to a blanket policy, which is the exposure documented in
``docs/security/RLS-SERVICE-POLICY-EXPOSURE.md``.

Why both USING and WITH CHECK
-----------------------------
Postgres ORs together the permissive policies that apply to a row, and ``USING``
governs only ``SELECT``/``UPDATE``/``DELETE``. A policy with ``USING`` alone
leaves ``INSERT`` unconstrained for that table, which for a transcript store is
how a row lands in somebody else's workspace. Both clauses get the same predicate.

Why the text-comparison predicate
---------------------------------
``0059`` already established the safer spelling for these two tables:

    workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')

Casting the column rather than the setting avoids a uuid parse error when the
session GUC holds anything other than a uuid, and ``NULLIF(..., '')`` means an
unset GUC reads as NULL instead of silently matching an empty-string row.

``strict_exec`` is used rather than a private ``_safe`` copy
-----------------------------------------------------------
``alembic/_strict_exec.py`` distinguishes the one genuinely expected failure (a
forward reference to a table a later migration creates) from every other error,
and re-raises the rest. The private swallowing helpers in 0047/0052/0053 are what
let the 2026-09 audit find 28 silently skipped statements on a database that
reported ``exit 0``.

This revision re-runs the coverage guard
----------------------------------------
``0060_verify_rls_coverage`` was deliberately terminal: it saw the finished
schema and raised if any table lacked RLS or a policy, which turned "a statement
was skipped" into "the deploy fails". ``0062`` already attached after it, and
``0063`` adds two more tables after that, so the guard can no longer see them.
``_assert_coverage`` at the end of ``upgrade`` repeats the same end-state check,
so the property the audit depended on survives this revision rather than being
silently lost.

The invariant test ``test_head_includes_the_rls_coverage_guard`` in
``tests/test_migration_chain_pg.py`` used to pin the head to the literal ``0060``,
which went stale as soon as any later revision landed. It now asserts the
*invariant* — whatever the head is, it re-checks RLS coverage — so adding a
revision no longer breaks the test.
"""

import importlib.util
import pathlib
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def _load_strict_exec():
    """Import `alembic/_strict_exec.py` by path.

    The directory is named `alembic` but is not an importable package — the
    installed Alembic distribution owns that name on sys.path, so
    `from alembic._strict_exec import strict_exec` resolves against the
    library and raises ModuleNotFoundError. Loading by file path is what
    tests/test_migration_chain_pg.py does for the same reason.
    """
    path = pathlib.Path(__file__).resolve().parent.parent / "_strict_exec.py"
    spec = importlib.util.spec_from_file_location("alembic_strict_exec", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.strict_exec


strict_exec = _load_strict_exec()

revision: str = "0063"
down_revision: Union[str, None] = "0062"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MIGRATION_ID = "0063"

TABLES = ("conversations", "chat_messages")


def _policy_name(table: str) -> str:
    return f"p_{table}_workspace"


_SCOPED_PREDICATE = """
                workspace_id::text = NULLIF(current_setting('app.workspace_id', true), '')
                OR tenant_id::text = NULLIF(current_setting('app.tenant_id', true), '')
"""


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"

    # Cross-db convention (0051): native UUID/JSONB on Postgres, String(36)/JSON
    # on SQLite, so the revision stays renderable on a dev database.
    uuid_col = sa.UUID(as_uuid=True) if is_pg else sa.String(36)
    json_col = postgresql.JSONB() if is_pg else sa.JSON()

    inspector = sa.inspect(bind)
    has_conversations = inspector.has_table("conversations")
    has_chat_messages = inspector.has_table("chat_messages")

    if not has_conversations:
        op.create_table(
            "conversations",
            sa.Column("id", uuid_col, primary_key=True),
            sa.Column(
                "workspace_id",
                uuid_col,
                sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("tenant_id", uuid_col, nullable=True),
            sa.Column("title", sa.String(length=200), nullable=True),
            sa.Column("agent_name", sa.String(length=100), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        )
        op.create_index(
            "idx_conversations_workspace_updated",
            "conversations",
            ["workspace_id", "updated_at"],
        )
    else:
        conv_indexes = [idx["name"] for idx in inspector.get_indexes("conversations")]
        if "idx_conversations_workspace_updated" not in conv_indexes:
            op.create_index(
                "idx_conversations_workspace_updated",
                "conversations",
                ["workspace_id", "updated_at"],
            )

    if not has_chat_messages:
        op.create_table(
            "chat_messages",
            sa.Column("id", uuid_col, primary_key=True),
            sa.Column(
                "conversation_id",
                uuid_col,
                sa.ForeignKey("conversations.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column(
                "workspace_id",
                uuid_col,
                sa.ForeignKey("workspaces.id", ondelete="CASCADE"),
                nullable=False,
            ),
            sa.Column("tenant_id", uuid_col, nullable=True),
            sa.Column("seq", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("client_id", sa.String(length=64), nullable=False),
            sa.Column("role", sa.String(length=20), nullable=False),
            sa.Column("text", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="complete"),
            sa.Column("agent_name", sa.String(length=100), nullable=True),
            sa.Column("confidence", sa.Float(), nullable=True),
            sa.Column("tool_calls", json_col, nullable=True),
            sa.Column("citations", json_col, nullable=True),
            sa.Column("proposals", json_col, nullable=True),
            sa.Column("questions", json_col, nullable=True),
            sa.Column("action_chips", json_col, nullable=True),
            sa.Column("attachments", json_col, nullable=True),
            sa.Column("plan", json_col, nullable=True),
            sa.Column("phases", json_col, nullable=True),
            sa.Column("error", json_col, nullable=True),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("highway", sa.String(length=50), nullable=True),
            sa.Column("s1_latency_ms", sa.Integer(), nullable=True),
            sa.Column("s2_latency_ms", sa.Integer(), nullable=True),
            sa.Column("workflow_id", sa.String(length=100), nullable=True),
            sa.Column("reply_to", sa.String(length=64), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.UniqueConstraint("conversation_id", "client_id", name="uq_chat_messages_conversation_client"),
        )
        op.create_index(
            "idx_chat_messages_conversation_created",
            "chat_messages",
            ["conversation_id", "created_at"],
        )
        op.create_index("idx_chat_messages_workspace_id", "chat_messages", ["workspace_id"])
    else:
        chat_indexes = [idx["name"] for idx in inspector.get_indexes("chat_messages")]
        if "idx_chat_messages_conversation_created" not in chat_indexes:
            op.create_index(
                "idx_chat_messages_conversation_created",
                "chat_messages",
                ["conversation_id", "created_at"],
            )
        if "idx_chat_messages_workspace_id" not in chat_indexes:
            op.create_index("idx_chat_messages_workspace_id", "chat_messages", ["workspace_id"])

    if not is_pg:
        # SQLite has no RLS. The suite relies on application-layer scoping; the
        # CI workflow runs this revision against real PostgreSQL.
        return

    for table in TABLES:
        policy = _policy_name(table)
        strict_exec(MIGRATION_ID, bind, f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;", context=f"RLS enable on {table}")
        strict_exec(MIGRATION_ID, bind, f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY;", context=f"RLS force on {table}")
        strict_exec(
            MIGRATION_ID,
            bind,
            f"""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE policyname = '{policy}' AND tablename = '{table}'
        ) THEN
            CREATE POLICY {policy} ON {table} FOR ALL
            TO vaeloom_app, service_role, postgres
            USING ({_SCOPED_PREDICATE})
            WITH CHECK ({_SCOPED_PREDICATE});
        END IF;
    END $$;
    """,
            context=f"RLS policy on {table}",
        )

    _assert_coverage(bind)


def _assert_coverage(bind) -> None:
    """Re-run the end-state coverage guard, because 0060 is no longer terminal.

    `0060_verify_rls_coverage` was written to be the last revision so it could see
    the finished schema and raise if any table lacked RLS or a policy. Attaching
    0063 after 0062 moves that guard earlier in the chain, where it cannot observe
    these two tables at all. Repeating the same end-state assertion here restores
    the property the audit depended on: a table this migration creates cannot end
    up unprotected with nothing after it to notice.
    """
    tables = [
        row[0]
        for row in bind.execute(
            sa.text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = 'public' AND table_type = 'BASE TABLE' "
                "AND table_name <> 'alembic_version' ORDER BY 1;"
            )
        ).fetchall()
    ]
    if not tables:
        raise RuntimeError(
            "0063 found no tables in the public schema. Either the chain did not "
            "run or it targeted a different database. Refusing to pass."
        )

    unprotected: list[str] = []
    policyless: list[str] = []
    for table in tables:
        rls = bind.execute(
            sa.text(
                "SELECT rowsecurity FROM pg_tables "
                f"WHERE schemaname = 'public' AND tablename = '{table}';"
            )
        ).fetchall()
        if not rls or rls[0][0] is not True:
            unprotected.append(table)
        count = bind.execute(
            sa.text(f"SELECT count(*) FROM pg_policies WHERE tablename = '{table}';")
        ).fetchall()
        if not count or count[0][0] == 0:
            policyless.append(table)

    if unprotected or policyless:
        problems = []
        if unprotected:
            problems.append(
                f"row-level security NOT enabled on {len(unprotected)} table(s): {sorted(unprotected)}"
            )
        if policyless:
            problems.append(f"no RLS policy on {len(policyless)} table(s): {sorted(policyless)}")
        raise RuntimeError(
            "Migration chain finished with incomplete RLS coverage.\n  - "
            + "\n  - ".join(problems)
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"DROP POLICY IF EXISTS {_policy_name(table)} ON {table};")

    # Guarded to mirror upgrade(): a table this revision never created must not
    # turn a downgrade into an UndefinedTableError.
    inspector = sa.inspect(bind)
    if inspector.has_table("chat_messages"):
        op.drop_index("idx_chat_messages_workspace_id", table_name="chat_messages")
        op.drop_index("idx_chat_messages_conversation_created", table_name="chat_messages")
        op.drop_table("chat_messages")
    if inspector.has_table("conversations"):
        op.drop_index("idx_conversations_workspace_updated", table_name="conversations")
        op.drop_table("conversations")
