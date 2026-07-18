from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..services.llm_service import llm_service
from ..config import settings

router = APIRouter()


@router.get("")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_ok = False
    redis_ok = False
    llm_ok = False

    try:
        await db.execute(db.bind.dialect.do_ping or "SELECT 1")
        db_ok = True
    except Exception:
        db_ok = False

    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis__url, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        redis_ok = True
    except Exception:
        redis_ok = False

    try:
        llm_ok = await llm_service.check_health()
    except Exception:
        llm_ok = False

    overall = db_ok and llm_ok

    return {
        "status": "healthy" if overall else "degraded",
        "service": settings.service_name,
        "version": settings.service_version,
        "checks": {
            "database": "ok" if db_ok else "error",
            "redis": "ok" if redis_ok else "disabled",
            "llm_provider": "ok" if llm_ok else "error",
        },
    }
