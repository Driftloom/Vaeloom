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
import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlsplit

import bcrypt
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# ---------------------------------------------------------------------------
# Import all models so they register with Base.metadata
# ---------------------------------------------------------------------------
from api.models.schema import (
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

DEMO_EMAIL = os.environ.get("DEMO_EMAIL", "demo@vaeloom.app").strip().lower()
# Local default, overridable per environment. The account only ever exists in a
# database this script seeds; see the non-local guard in seed().
DEMO_PASSWORD = os.environ.get("DEMO_PASSWORD", "demo1234")
# bcrypt is what AuthService.verify_password calls. A SHA-256 digest here (the
# previous value) could never be verified by the login path, so the documented
# demo credential was unusable on a seed.py-created database.
DEMO_PASSWORD_HASH = bcrypt.hashpw(DEMO_PASSWORD.encode(), bcrypt.gensalt()).decode()


LOCAL_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})


def _is_local_endpoint(h: str) -> bool:
    """Helper to check if a single host endpoint is local (loopback or unix socket)."""
    h = h.strip().lower()
    if not h:
        return False
    if h.startswith("/"):
        return True
    if h.startswith("[") and "]" in h:
        h = h[1 : h.index("]")]
    elif h.count(":") > 1:
        pass  # Bare IPv6 literal
    elif ":" in h:
        h = h.split(":", 1)[0]
    return h in LOCAL_HOSTS


def _query_values(query_dict: dict, key: str) -> list[str]:
    """Helper to read single- or multi-valued entries from SQLAlchemy URL.query."""
    val = query_dict.get(key)
    if val is None:
        return []
    if isinstance(val, (list, tuple)):
        return [str(v) for v in val]
    return [str(val)]


def get_non_local_endpoint(url: str, _depth: int = 0) -> str | None:
    """Returns None if local, or a safe description of the non-local target."""
    if _depth > 2:
        return "excessive dsn recursion"
    if not url or url.startswith("sqlite"):
        return None

    try:
        sa_url = make_url(url)
        if sa_url.get_backend_name() == "sqlite":
            return None
        authority_host = (sa_url.host or "").lower()
    except Exception:
        return "unparseable database url"

    if authority_host and authority_host not in LOCAL_HOSTS:
        return f"authority host '{authority_host}'"

    # Evaluate query parameters using SQLAlchemy URL.query (matching engine semantics)
    for dsn_val in _query_values(sa_url.query, "dsn"):
        nested = get_non_local_endpoint(dsn_val, _depth + 1)
        if nested:
            return f"dsn parameter ({nested})"

    query_hosts = []
    for host_val in _query_values(sa_url.query, "host"):
        for part in host_val.split(","):
            part = part.strip().lower()
            if part:
                query_hosts.append(part)

    for h in query_hosts:
        if not _is_local_endpoint(h):
            return f"query host '{h}'"

    if not authority_host and not query_hosts:
        pghost = os.environ.get("PGHOST", "").strip()
        if pghost:
            for part in pghost.split(","):
                if not _is_local_endpoint(part):
                    return f"PGHOST '{part.strip().lower()}'"

    return None


def is_local_database(url: str, _depth: int = 0) -> bool:
    """True for SQLite and loopback database targets.

    Mirrors the Alembic remote-DDL guard (`apps/api/alembic/env.py`): a seed run
    must not create a known-password demo account on a shared or cloud database.
    Evaluates the authority host, query host parameters, nested dsn parameters,
    and the PGHOST fallback.
    """
    return get_non_local_endpoint(url, _depth) is None


async def seed() -> None:
    db_url = (
        os.environ.get("DATABASE__URL")
        or os.environ.get("DATABASE_URL")
        or "sqlite+aiosqlite:///./dev.db"
    )
    non_local = get_non_local_endpoint(db_url)
    if non_local and os.environ.get("ALLOW_REMOTE_SEED", "").lower() not in (
        "1",
        "true",
        "yes",
    ):
        raise SystemExit(
            "REFUSED: seed.py creates the demo account with a documented default password. "
            f"Target database has non-local {non_local}. "
            "Point DATABASE__URL at SQLite/localhost, or set ALLOW_REMOTE_SEED=1 for a "
            "disposable environment and DEMO_PASSWORD=<unique value>."
        )
    engine = create_async_engine(db_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Create all tables (idempotent)
    from api.models.schema import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    print("Seeding Vaeloom database...")
    print(f"  Database: {db_url}")

    async with async_session() as db:
        # ─── Demo User ───
        result = await db.execute(
            text("SELECT id, password_hash, auth_provider FROM users WHERE email = :email"),
            {"email": DEMO_EMAIL},
        )
        row = result.fetchone()
        if row:
            user_id = row[0]
            password_hash = row[1]
            auth_provider = row[2]
            # Databases seeded before the bcrypt fix still hold a SHA-256 digest
            # that bcrypt.checkpw cannot parse; heal them on the next seed run,
            # but only for email-authenticated accounts (avoid attaching passwords to SAML/OAuth users).
            if auth_provider == "email" and not str(password_hash or "").startswith("$2"):
                await db.execute(
                    text("UPDATE users SET password_hash = :pw_hash WHERE id = :id"),
                    {"pw_hash": DEMO_PASSWORD_HASH, "id": str(user_id)},
                )
                print(f"  Repaired legacy password hash for {DEMO_EMAIL}")
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
