"""Expand-contract memory taxonomy 6 -> 22: additive, no rewrite, provenance preserved

Revision ID: 0027
Revises: 0026
Create Date: 2026-09-01

CONT-P12 expand-contract: 6 canonical types (profile/document/career/episodic/preference/working)
+ 16 enterprise additive types (project/skill/organization/relationship/event/insight/goal/feedback/decision/knowledge/reference/contact/financial/health/learning/workflow)
= 22 total. Legacy 6 stay valid. No backfill guesses. taxonomy_version tracks migration wave.
No-op on SQLite (tests). Dual-write ledger via memory_versions provenance.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        # SQLite: add columns via ORM auto-create in tests; no-op here
        return
    # Add taxonomy_version to track expand-contract wave (default 1 = pre-expansion, 2 = expanded)
    op.execute("""
        ALTER TABLE memories
        ADD COLUMN IF NOT EXISTS taxonomy_version INTEGER DEFAULT 1
    """)
    op.execute("""
        ALTER TABLE memory_records
        ADD COLUMN IF NOT EXISTS taxonomy_version INTEGER DEFAULT 1
    """)
    # Add lineage JSON for model/prompt/tool/retrieval lineage per CONT-P12-R06
    op.execute("""
        ALTER TABLE memories
        ADD COLUMN IF NOT EXISTS lineage JSONB DEFAULT '{}'::jsonb
    """)
    op.execute("""
        ALTER TABLE memory_records
        ADD COLUMN IF NOT EXISTS lineage JSONB DEFAULT '{}'::jsonb
    """)
    # Add confidence/contradiction/correction flags per CONT-P12 task 4
    op.execute("""
        ALTER TABLE memories
        ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 1.0
    """)
    op.execute("""
        ALTER TABLE memories
        ADD COLUMN IF NOT EXISTS contradiction_flags JSONB DEFAULT '[]'::jsonb
    """)
    # Reconciliation ledger for expand-contract
    op.execute("""
        CREATE TABLE IF NOT EXISTS memory_taxonomy_ledger (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            memory_id UUID NOT NULL,
            from_type VARCHAR(50) NOT NULL,
            to_type VARCHAR(50) NOT NULL,
            taxonomy_version INTEGER NOT NULL,
            migration_wave VARCHAR(50) DEFAULT 'CONT-P12',
            checksum VARCHAR(64) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_taxonomy_ledger_memory ON memory_taxonomy_ledger(memory_id)")
    # Expand check constraint to 22 types (keep legacy valid) — drop old if exists
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE memories DROP CONSTRAINT IF EXISTS ck_memories_type_valid;
        EXCEPTION WHEN undefined_object THEN NULL; END $$;
    """)
    op.execute("""
        ALTER TABLE memories
        ADD CONSTRAINT ck_memories_type_valid
        CHECK (type IN (
            'profile','document','career','episodic','preference','working','note','fact',
            'project','skill','organization','relationship','event','insight','goal','feedback',
            'decision','knowledge','reference','contact','financial','health','learning','workflow'
        ))
    """)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE memory_records DROP CONSTRAINT IF EXISTS ck_memory_records_type_valid;
        EXCEPTION WHEN undefined_object THEN NULL; END $$;
    """)
    op.execute("""
        ALTER TABLE memory_records
        ADD CONSTRAINT ck_memory_records_type_valid
        CHECK (type IN (
            'profile','document','career','episodic','preference','working','note','fact',
            'project','skill','organization','relationship','event','insight','goal','feedback',
            'decision','knowledge','reference','contact','financial','health','learning','workflow'
        ))
    """)


def downgrade() -> None:
    if op.get_context().dialect.name != "postgresql":
        return
    op.execute("DROP TABLE IF EXISTS memory_taxonomy_ledger")
    op.execute("ALTER TABLE memories DROP COLUMN IF EXISTS taxonomy_version")
    op.execute("ALTER TABLE memory_records DROP COLUMN IF EXISTS taxonomy_version")
    op.execute("ALTER TABLE memories DROP COLUMN IF EXISTS lineage")
    op.execute("ALTER TABLE memory_records DROP COLUMN IF EXISTS lineage")
    op.execute("ALTER TABLE memories DROP COLUMN IF EXISTS confidence")
    op.execute("ALTER TABLE memories DROP COLUMN IF EXISTS contradiction_flags")
    op.execute("ALTER TABLE memories DROP CONSTRAINT IF EXISTS ck_memories_type_valid")
    op.execute("ALTER TABLE memory_records DROP CONSTRAINT IF EXISTS ck_memory_records_type_valid")
