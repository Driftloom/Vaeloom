"""
Database seed script for local development and manual QA.

Creates a demo user, workspace, sample documents, memory records,
entities, relationships, applications, schedule events, and agent actions.

Usage:
    cd apps/backend
    python -m scripts.seed

Or from project root:
    cd apps/backend && python scripts/seed.py

Requires: DATABASE__URL env var (defaults to sqlite+aiosqlite:///./dev.db)
"""

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Import all models so they register with Base.metadata
# ---------------------------------------------------------------------------
from backend.models.schema import (
    AgentAction,
    Application,
    Document,
    DocumentVersion,
    Entity,
    Memory,
    MemoryRecord,
    Relationship,
    ScheduleEvent,
    User,
    Workspace,
)


DEMO_EMAIL = "demo@vaeloom.app"
DEMO_PASSWORD = "demo1234"
# Simple hash for dev seed (not bcrypt — avoids extra dep in seed context)
DEMO_PASSWORD_HASH = hashlib.sha256(DEMO_PASSWORD.encode()).hexdigest()


async def seed() -> None:
    import os

    db_url = os.environ.get("DATABASE__URL", "sqlite+aiosqlite:///./dev.db")
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create all tables (idempotent)
    from backend.models.schema import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Seeding Vaeloom database...")
    print(f"  Database: {db_url}")

    async with async_session() as db:
        # ─── Demo User ───
        result = await db.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": DEMO_EMAIL}
        )
        row = result.fetchone()
        if row:
            user_id = row[0]
            print(f"  User already exists: {DEMO_EMAIL} ({user_id})")
        else:
            user_id = uuid.uuid4()
            await db.execute(
                text(
                    "INSERT INTO users (id, email, password_hash, display_name, auth_provider, status) "
                    "VALUES (:id, :email, :pw_hash, :name, :provider, :status)"
                ),
                {
                    "id": str(user_id),
                    "email": DEMO_EMAIL,
                    "pw_hash": DEMO_PASSWORD_HASH,
                    "name": "Demo User",
                    "provider": "email",
                    "status": "ACTIVE",
                },
            )
            print(f"  Created user: {DEMO_EMAIL} ({user_id})")

        # ─── Demo Workspace ───
        result = await db.execute(
            text("SELECT id FROM workspaces WHERE user_id = :uid AND name = :name"),
            {"uid": str(user_id), "name": "Demo Workspace"},
        )
        row = result.fetchone()
        if row:
            workspace_id = row[0]
            print(f"  Workspace already exists: Demo Workspace ({workspace_id})")
        else:
            workspace_id = uuid.uuid4()
            await db.execute(
                text(
                    "INSERT INTO workspaces (id, user_id, name, description) "
                    "VALUES (:id, :uid, :name, :desc)"
                ),
                {
                    "id": str(workspace_id),
                    "uid": str(user_id),
                    "name": "Demo Workspace",
                    "desc": "A sample workspace for local development and QA",
                },
            )
            print(f"  Created workspace: Demo Workspace ({workspace_id})")

        # ─── Sample Document ───
        doc_id = uuid.uuid4()
        await db.execute(
            text(
                "INSERT OR IGNORE INTO documents (id, workspace_id, path, type, raw_storage_key, summary) "
                "VALUES (:id, :wid, :path, :type, :key, :summary)"
            ),
            {
                "id": str(doc_id),
                "wid": str(workspace_id),
                "path": "/uploads/resume-v1.pdf",
                "type": "pdf",
                "key": "local/demo/resume-v1.pdf",
                "summary": "Software engineer resume with 3 years of experience in TypeScript, Python, and cloud infrastructure.",
            },
        )
        print(f"  Created document: /uploads/resume-v1.pdf")

        # ─── Document Version ───
        await db.execute(
            text(
                "INSERT OR IGNORE INTO document_versions "
                "(id, document_id, version_number, storage_key, size_bytes, checksum) "
                "VALUES (:id, :doc_id, :ver, :key, :size, :checksum)"
            ),
            {
                "id": str(uuid.uuid4()),
                "doc_id": str(doc_id),
                "ver": 1,
                "key": "local/demo/resume-v1.pdf",
                "size": 245000,
                "checksum": "sha256:demo-checksum-placeholder",
            },
        )
        print("  Created document version: v1")

        # ─── Memory Records (6 MVP types) ───
        memory_records = [
            ("profile", {"name": "Demo User", "email": DEMO_EMAIL, "title": "Software Engineer", "location": "San Francisco, CA", "skills": ["TypeScript", "Python", "PostgreSQL", "Docker", "AWS"], "yearsExperience": 3}, 0.95, 1.0),
            ("career", {"company": "TechCorp Inc.", "role": "Software Engineer", "startDate": "2023-06-01", "achievements": ["Led migration from monolith to microservices", "Reduced API latency by 40%", "Mentored 2 junior engineers"]}, 0.9, 0.8),
            ("document", {"documentId": str(doc_id), "extractedText": "Software Engineer with 3 years experience...", "sections": ["education", "experience", "skills", "projects"]}, 1.0, 0.7),
            ("episodic", {"event": "Applied to Senior Engineer position at StartupXYZ", "date": "2026-07-15", "outcome": "pending", "sentiment": "hopeful"}, 1.0, 0.6),
            ("preference", {"jobTypes": ["full-time", "remote"], "salaryRange": {"min": 120000, "max": 180000, "currency": "USD"}, "preferredIndustries": ["tech", "fintech", "healthtech"], "dealbreakers": ["no-remote", "relocation-required"]}, 0.85, 0.9),
            ("working", {"currentTask": "Preparing for TechCorp Q3 review", "context": "Need to compile performance metrics", "deadline": "2026-07-20"}, 1.0, 0.5),
        ]

        for mem_type, content, confidence, importance in memory_records:
            await db.execute(
                text(
                    "INSERT INTO memory_records (id, workspace_id, type, content, confidence, importance) "
                    "VALUES (:id, :wid, :type, :content, :conf, :imp)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "wid": str(workspace_id),
                    "type": mem_type,
                    "content": json.dumps(content),
                    "conf": confidence,
                    "imp": importance,
                },
            )
        print(f"  Created memory records: {len(memory_records)} (all 6 MVP types)")

        # ─── Entities (Knowledge Graph nodes) ───
        entities_data = [
            ("person", "Demo User", ["demo@vaeloom.app"]),
            ("company", "TechCorp Inc.", ["TechCorp", "TC"]),
            ("skill", "TypeScript", ["TS", "typescript"]),
            ("skill", "Python", ["python3", "py"]),
            ("company", "StartupXYZ", ["SXYZ"]),
        ]

        entity_ids = []
        for etype, name, aliases in entities_data:
            eid = uuid.uuid4()
            entity_ids.append(eid)
            await db.execute(
                text(
                    "INSERT INTO entities (id, workspace_id, type, canonical_name, aliases) "
                    "VALUES (:id, :wid, :type, :name, :aliases)"
                ),
                {
                    "id": str(eid),
                    "wid": str(workspace_id),
                    "type": etype,
                    "name": name,
                    "aliases": json.dumps(aliases),
                },
            )
        print(f"  Created entities: {len(entities_data)}")

        # ─── Relationships (Knowledge Graph edges) ───
        person, techcorp, typescript, python, startupxyz = entity_ids
        relationships = [
            (person, techcorp, "works_at", 0.95),
            (person, typescript, "has_skill", 0.9),
            (person, python, "has_skill", 0.85),
            (person, startupxyz, "applied_to", 1.0),
        ]

        for from_id, to_id, rel_type, conf in relationships:
            await db.execute(
                text(
                    "INSERT INTO relationships (id, workspace_id, from_entity_id, to_entity_id, relation_type, confidence) "
                    "VALUES (:id, :wid, :from_id, :to_id, :rel_type, :conf)"
                ),
                {
                    "id": str(uuid.uuid4()),
                    "wid": str(workspace_id),
                    "from_id": str(from_id),
                    "to_id": str(to_id),
                    "rel_type": rel_type,
                    "conf": conf,
                },
            )
        print(f"  Created relationships: {len(relationships)}")

        # ─── Sample Application ───
        await db.execute(
            text(
                "INSERT INTO applications (id, workspace_id, job_external_id, platform, status, cover_letter, submitted_at) "
                "VALUES (:id, :wid, :job_id, :platform, :status, :letter, :submitted)"
            ),
            {
                "id": str(uuid.uuid4()),
                "wid": str(workspace_id),
                "job_id": "linkedin-12345",
                "platform": "linkedin",
                "status": "SUBMITTED",
                "letter": "Dear Hiring Manager, I am excited to apply for the Senior Engineer position...",
                "submitted": datetime(2026, 7, 15, tzinfo=timezone.utc).isoformat(),
            },
        )
        print("  Created application: 1")

        # ─── Sample Schedule Event ───
        await db.execute(
            text(
                "INSERT INTO schedule_events (id, workspace_id, source, title, date, type) "
                "VALUES (:id, :wid, :source, :title, :date, :type)"
            ),
            {
                "id": str(uuid.uuid4()),
                "wid": str(workspace_id),
                "source": "agent_generated",
                "title": "Follow up on StartupXYZ application",
                "date": datetime(2026, 7, 22, tzinfo=timezone.utc).isoformat(),
                "type": "reminder",
            },
        )
        print("  Created schedule event: 1")

        # ─── Sample Agent Action (audit log entry) ───
        await db.execute(
            text(
                "INSERT INTO agent_actions (id, workspace_id, agent_name, action_type, input_ref, output_ref, status, duration_ms, tokens_used, cost) "
                "VALUES (:id, :wid, :agent, :action, :input_ref, :output_ref, :status, :duration, :tokens, :cost)"
            ),
            {
                "id": str(uuid.uuid4()),
                "wid": str(workspace_id),
                "agent": "resume_agent",
                "action": "generate_resume",
                "input_ref": f"document:{doc_id}",
                "output_ref": "resume:demo-v1",
                "status": "COMPLETED",
                "duration": 2340,
                "tokens": 1500,
                "cost": 0.003,
            },
        )
        print("  Created agent action (audit): 1")

        await db.commit()

    await engine.dispose()
    print("\nSeed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
