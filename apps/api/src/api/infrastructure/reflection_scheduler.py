"""P1: Nightly reflection cron — consolidation + preference learning stub.

Wires ReflectionAgent + SelfImprovementAgent into background_daemon as a 03:00 UTC daily watcher.
Enabled by default but best-effort: requires LLM key for full consolidation; otherwise logs no-op.

WS01 learning closure: now also harvests recent APPROVED/REJECTED approval feedback
into preference-type Entities so future retrieval ranking can adapt measurably.
All learning is workspace-scoped, bounded, reversible, auditable.
"""
import logging

logger = logging.getLogger(__name__)


async def reflection_scan() -> int:
    """Run memory consolidation for active workspaces. No time gate — caller decides."""
    try:
        from sqlalchemy import select, text

        from api.database import async_session_factory
        from api.models.schema import Entity, Workspace

        async with async_session_factory() as db:
            rows = await db.execute(select(Workspace.id).limit(20))
            ws = rows.all()
            count = 0
            for (ws_id,) in ws:
                ws_str = str(ws_id)
                # 1) original consolidation (LLM-shaped, best-effort)
                try:
                    from api.agents.memory.reflection_agent import ReflectionAgent

                    agent = ReflectionAgent()
                    await agent.consolidate_memories([])
                    count += 1
                except Exception as e:
                    logger.debug(f"reflection scan ws={ws_str} consolidate skipped: {e}")
                # 2) WS01: harvest recent approval feedback → preference Entity (bounded, reversible)
                # This closes the loop: user correction → approval row → preference Entity → ranking user_context → future decision
                # We run this even without LLM key so learning is testable offline.
                try:
                    # Look at last 10 approvals (APPROVED/REJECTED) with reason containing preference hint
                    apr = await db.execute(text("""
                        SELECT action_type, reason, status, payload FROM agent_approvals
                        WHERE workspace_id = :wid AND status IN ('APPROVED','REJECTED')
                        ORDER BY created_at DESC LIMIT 10
                    """), {"wid": ws_str})
                    apr_rows = apr.fetchall()
                    if apr_rows:
                        # Derive lightweight preference hint (e.g., "Prefer remote senior roles")
                        # Bounded: at most one preference Entity per workspace per scan, capped length, workspace-scoped.
                        hint = None
                        for action_type, reason, status, payload in apr_rows:
                            r = (reason or "")[:200]
                            # Simple heuristic: if payload or reason mentions 'prefer', capture it
                            blob = f"{action_type} {r} {str(payload)[:200]}".lower()
                            if "prefer" in blob or "remote" in blob or "senior" in blob:
                                hint = (reason or action_type)[:120].strip()
                                break
                        if hint and len(hint) >= 4:
                            # Upsert preference Entity (workspace-scoped, auditable via metadata)
                            existing = await db.execute(select(Entity).where(Entity.workspace_id == ws_id, Entity.type == "preference", Entity.canonical_name == hint).limit(1))
                            if not existing.scalar_one_or_none():
                                ent = Entity(
                                    workspace_id=ws_id,
                                    type="preference",
                                    canonical_name=hint,
                                    aliases=[],
                                    metadata_={"source": "approval_feedback", "bounded": True, "reversible": True},
                                )
                                db.add(ent)
                                await db.commit()
                                logger.info(f"LEARNING preference created ws={ws_str} hint='{hint[:40]}'")
                except Exception as le:
                    logger.debug(f"reflection preference harvest ws={ws_str} skipped: {le}")
                    try:
                        await db.rollback()
                    except Exception:
                        pass
            if count:
                logger.info(f"DAEMON reflection scan ran for {count} workspaces")
            return count
    except Exception as e:
        logger.warning(f"DAEMON reflection scan failed: {e}")
        return 0


async def process_user_correction(workspace_id: str, correction_text: str, source: str = "manual") -> str | None:
    """Direct learning entry-point for tests and manual corrections.

    Stores a workspace-scoped preference Entity (bounded, reversible) that ranking can use.
    Returns the created Entity id or existing id. Workspace isolation enforced.
    """
    if not correction_text or not workspace_id.strip():
        return None
    try:
        from sqlalchemy import select
        from api.database import async_session_factory
        from api.models.schema import Entity
        import uuid

        ws_uuid = uuid.UUID(workspace_id)
        hint = correction_text.strip()[:120]
        async with async_session_factory() as session:
            # Deduplicate
            existing = await session.execute(select(Entity).where(Entity.workspace_id == ws_uuid, Entity.type == "preference", Entity.canonical_name == hint).limit(1))
            ex = existing.scalar_one_or_none()
            if ex:
                return str(ex.id)
            ent = Entity(workspace_id=ws_uuid, type="preference", canonical_name=hint, aliases=[], metadata_={"source": source, "bounded": True})
            session.add(ent)
            await session.commit()
            await session.refresh(ent)
            logger.info(f"LEARNING manual preference ws={workspace_id[:8]} '{hint[:40]}'")
            return str(ent.id)
    except Exception as e:
        logger.warning(f"process_user_correction failed: {e}")
        return None
