"""Migration 0011 — memory_type_packs table and type pack provenance columns on memories.

Ensures:
- memories table has type_pack_slug and type_pack_version columns.
- Existing memories rows are backfilled to slug='career', version=1 if NULL.
- memory_type_packs table exists and is seeded with the default 'career' pack.
"""
import json
import uuid

from sqlalchemy import inspect, text

from ..services.memory_type_packs import CAREER_PACK_SLUG, CAREER_TYPES

VERSION = "0011_memory_type_packs"


async def upgrade(conn) -> None:
    dialect = conn.dialect.name
    json_type = "TEXT" if dialect == "sqlite" else "JSONB"

    # 1. Ensure memory_type_packs table exists
    has_type_packs = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("memory_type_packs")
    )
    if not has_type_packs:
        await conn.execute(text(f"""
            CREATE TABLE memory_type_packs (
                id VARCHAR(36) PRIMARY KEY,
                slug VARCHAR(64) NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                label VARCHAR(100) NOT NULL,
                types {json_type} NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT 1,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT uq_memory_type_packs_slug UNIQUE (slug)
            )
        """))

    # Seed default career pack if not present
    res = await conn.execute(
        text("SELECT COUNT(*) FROM memory_type_packs WHERE slug = :slug"),
        {"slug": CAREER_PACK_SLUG},
    )
    if res.scalar() == 0:
        await conn.execute(
            text(
                "INSERT INTO memory_type_packs (id, slug, version, label, types, is_active) "
                "VALUES (:id, :slug, :version, :label, :types, :is_active)"
            ),
            {
                "id": str(uuid.uuid4()),
                "slug": CAREER_PACK_SLUG,
                "version": 1,
                "label": "Career Domain",
                "types": json.dumps(list(CAREER_TYPES)),
                "is_active": True,
            },
        )

    # 2. Ensure memories table has type_pack_slug and type_pack_version
    has_memories = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("memories")
    )
    if has_memories:
        columns = await conn.run_sync(
            lambda sync_conn: {c["name"] for c in inspect(sync_conn).get_columns("memories")}
        )
        if "type_pack_slug" not in columns:
            await conn.execute(text("ALTER TABLE memories ADD COLUMN type_pack_slug VARCHAR(64)"))
        if "type_pack_version" not in columns:
            await conn.execute(text("ALTER TABLE memories ADD COLUMN type_pack_version INTEGER"))

        await conn.execute(
            text(
                "UPDATE memories SET type_pack_slug = :slug, type_pack_version = 1 "
                "WHERE type_pack_slug IS NULL"
            ),
            {"slug": CAREER_PACK_SLUG},
        )


async def downgrade(conn) -> None:
    has_memories = await conn.run_sync(
        lambda sync_conn: inspect(sync_conn).has_table("memories")
    )
    if has_memories:
        columns = await conn.run_sync(
            lambda sync_conn: {c["name"] for c in inspect(sync_conn).get_columns("memories")}
        )
        for col in ("type_pack_version", "type_pack_slug"):
            if col in columns:
                try:
                    await conn.execute(text(f"ALTER TABLE memories DROP COLUMN {col}"))
                except Exception:
                    pass
    await conn.execute(text("DROP TABLE IF EXISTS memory_type_packs"))
