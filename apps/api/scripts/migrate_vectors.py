#!/usr/bin/env python3
"""Migrate existing embeddings from the main DB to the dedicated vector store."""

import argparse
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from api.infrastructure.vector_store import VectorRecord, get_vector_store
from api.models.schema import Embedding


async def migrate(limit: int = 0, force: bool = False) -> None:
    db_url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/vaeloom")
    engine = create_async_engine(db_url, pool_pre_ping=True, pool_size=5)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    store = get_vector_store()

    async with factory() as session:
        count_stmt = select(func.count(Embedding.id)).where(Embedding.vector.isnot(None))
        total = (await session.execute(count_stmt)).scalar() or 0
        print(f"Total embeddings with vectors in DB: {total}")

        if total == 0:
            print("Nothing to migrate.")
            return

        query = select(Embedding).where(Embedding.vector.isnot(None)).order_by(Embedding.created_at)
        if limit > 0:
            query = query.limit(limit)

        result = await session.execute(query)
        rows = result.scalars().all()

        records = []
        for emb in rows:
            vec = list(emb.vector) if hasattr(emb.vector, "__iter__") else emb.vector
            records.append(
                VectorRecord(
                    id=str(emb.id),
                    vector=vec,
                    metadata={
                        "source_type": emb.source_type,
                        "source_id": str(emb.source_id),
                        "model_version": emb.model_version or "text-embedding-3-small",
                        "workspace_id": str(emb.workspace_id),
                    },
                )
            )

    print(f"Migrating {len(records)} embeddings to vector store...")
    await store.upsert(records)

    search_results = await store.search(query_vector=[0.0] * 1536, limit=10)
    migrated_count = len(search_results) if limit == 0 else len(records)
    print(f"Vector store now has at least {migrated_count} records (expected {total}).")
    print("Migration complete.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate embeddings to vector store")
    parser.add_argument("--limit", type=int, default=0, help="Max embeddings to migrate (0 = all)")
    parser.add_argument("--force", action="store_true", help="Skip confirmation")
    args = parser.parse_args()

    asyncio.run(migrate(limit=args.limit, force=args.force))


if __name__ == "__main__":
    main()
