import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..config import settings

router = APIRouter()


async def _check_db(db: AsyncSession) -> dict:
    start = time.monotonic()
    try:
        await db.execute(text("SELECT 1"))
        latency = (time.monotonic() - start) * 1000
        return {"status": "ok", "latency_ms": round(latency, 2)}
    except Exception as e:
        latency = (time.monotonic() - start) * 1000
        return {"status": "down", "latency_ms": round(latency, 2), "error": str(e)}


async def _check_redis() -> dict:
    start = time.monotonic()
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis__url, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        latency = (time.monotonic() - start) * 1000
        return {"status": "ok", "latency_ms": round(latency, 2)}
    except Exception:
        latency = (time.monotonic() - start) * 1000
        return {"status": "degraded", "latency_ms": round(latency, 2)}


async def _check_infisical() -> dict:
    if not settings.encryption_key:
        return {"status": "degraded", "latency_ms": 0}
    start = time.monotonic()
    try:
        from ..infrastructure.secrets import SecretManager
        sm = SecretManager()
        _ = sm.get_secret("JWT_SECRET")
        latency = (time.monotonic() - start) * 1000
        return {"status": "ok", "latency_ms": round(latency, 2)}
    except Exception:
        latency = (time.monotonic() - start) * 1000
        return {"status": "down", "latency_ms": round(latency, 2)}


@router.get("")
async def liveness():
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.service_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/ready")
async def readiness(db: AsyncSession = Depends(get_db)):
    db_check = await _check_db(db)
    redis_check = await _check_redis()

    dependencies = {
        "database": db_check,
        "redis": redis_check,
    }

    all_ok = all(d["status"] == "ok" for d in dependencies.values())

    return {
        "status": "ok" if all_ok else "degraded",
        "service": settings.service_name,
        "version": settings.service_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": dependencies,
    }


@router.get("/startup")
async def startup(db: AsyncSession = Depends(get_db)):
    db_check = await _check_db(db)
    redis_check = await _check_redis()
    infisical_check = await _check_infisical()

    dependencies = {
        "database": db_check,
        "redis": redis_check,
        "infisical": infisical_check,
    }

    all_ready = all(d["status"] in ("ok", "degraded") for d in dependencies.values())
    critical_ok = dependencies["database"]["status"] == "ok"

    overall = "ok" if (all_ready and critical_ok) else "degraded"

    return {
        "status": overall,
        "service": settings.service_name,
        "version": settings.service_version,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": dependencies,
    }
