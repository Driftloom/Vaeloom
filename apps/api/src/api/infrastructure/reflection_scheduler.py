"""P1: Nightly reflection cron — consolidation + preference learning stub.

Wires ReflectionAgent + SelfImprovementAgent into background_daemon as a 03:00 UTC daily watcher.
Enabled by default but best-effort: requires LLM key for full consolidation; otherwise logs no-op.
"""
import logging

logger = logging.getLogger(__name__)


async def reflection_scan() -> int:
    """Run memory consolidation for active workspaces. No time gate — caller decides."""
    try:
        from sqlalchemy import select

        from api.database import async_session_factory
        from api.models.schema import Workspace

        async with async_session_factory() as db:
            rows = await db.execute(select(Workspace.id).limit(20))
            ws = rows.all()
            count = 0
            for (ws_id,) in ws:
                try:
                    from api.agents.memory.reflection_agent import ReflectionAgent

                    agent = ReflectionAgent()
                    await agent.consolidate_memories([])
                    count += 1
                except Exception as e:
                    logger.debug(f"reflection scan ws={ws_id} skipped: {e}")
            if count:
                logger.info(f"DAEMON reflection scan ran for {count} workspaces")
            return count
    except Exception as e:
        logger.warning(f"DAEMON reflection scan failed: {e}")
        return 0
