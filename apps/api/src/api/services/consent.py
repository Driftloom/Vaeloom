import uuid
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user

CONSENT_SCOPES = {
    "data_processing": "Process my personal data for application functionality",
    "agent_access": "Allow agents to access my workspace data",
    "email_marketing": "Send marketing emails about new features",
}


class ConsentScope(StrEnum):
    data_processing = "data_processing"
    agent_access = "agent_access"
    email_marketing = "email_marketing"


class ConsentRecord(BaseModel):
    user_id: str
    tenant_id: str | None = None
    scope: ConsentScope
    granted_at: datetime | None = None
    revoked_at: datetime | None = None
    ip_address: str | None = None


class ConsentError(Exception):
    pass


class ConsentManager:
    async def record_consent(
        self,
        user_id: str,
        scope: ConsentScope,
        db: AsyncSession,
        tenant_id: str | None = None,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)

        await db.execute(
            text("""
                DELETE FROM consent_records
                WHERE user_id = :user_id AND scope = :scope
            """),
            {"user_id": user_id, "scope": scope.value},
        )

        record_id = str(uuid.uuid4())
        await db.execute(
            text("""
                INSERT INTO consent_records (id, user_id, tenant_id, scope, granted_at, ip_address)
                VALUES (:id, :user_id, :tenant_id, :scope, :granted_at, :ip_address)
            """),
            {
                "id": record_id,
                "user_id": user_id,
                "tenant_id": tenant_id,
                "scope": scope.value,
                "granted_at": now,
                "ip_address": ip_address,
            },
        )
        return {"id": record_id, "scope": scope.value, "granted_at": now.isoformat()}

    async def revoke_consent(
        self,
        user_id: str,
        scope: ConsentScope,
        db: AsyncSession,
    ) -> dict[str, Any]:
        now = datetime.now(UTC)
        await db.execute(
            text("""
                UPDATE consent_records
                SET revoked_at = :revoked_at
                WHERE user_id = :user_id AND scope = :scope AND revoked_at IS NULL
            """),
            {"user_id": user_id, "scope": scope.value, "revoked_at": now},
        )
        return {"scope": scope.value, "revoked_at": now.isoformat()}

    async def check_consent(
        self,
        user_id: str,
        scope: ConsentScope,
        db: AsyncSession,
    ) -> bool:
        result = await db.execute(
            text("""
                SELECT 1 FROM consent_records
                WHERE user_id = :user_id AND scope = :scope AND revoked_at IS NULL
                LIMIT 1
            """),
            {"user_id": user_id, "scope": scope.value},
        )
        return result.scalar_one_or_none() is not None

    async def list_consents(
        self,
        user_id: str,
        db: AsyncSession,
    ) -> list[dict[str, Any]]:
        result = await db.execute(
            text("""
                SELECT id, user_id, tenant_id, scope, granted_at, revoked_at, ip_address
                FROM consent_records
                WHERE user_id = :user_id
                ORDER BY granted_at DESC
            """),
            {"user_id": user_id},
        )
        rows = result.fetchall()
        return [
            {
                "id": r[0],
                "user_id": r[1],
                "tenant_id": r[2],
                "scope": r[3],
                "granted_at": r[4].isoformat() if hasattr(r[4], 'isoformat') else str(r[4]) if r[4] else None,
                "revoked_at": r[5].isoformat() if hasattr(r[5], 'isoformat') else str(r[5]) if r[5] else None,
                "ip_address": r[6],
            }
            for r in rows
        ]


consent_manager = ConsentManager()

router = APIRouter()


@router.get("/consent/scopes")
async def list_scopes():
    return {"scopes": [{"name": k, "description": v} for k, v in CONSENT_SCOPES.items()]}


class GrantConsentRequest(BaseModel):
    scope: ConsentScope


@router.post("/consent/grant")
async def grant_consent(
    dto: GrantConsentRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    tenant_id = current_user.get("tenant_id")
    ip = request.client.host if request.client else None
    result = await consent_manager.record_consent(
        user_id=user_id,
        scope=dto.scope,
        db=db,
        tenant_id=tenant_id,
        ip_address=ip,
    )
    return result


@router.post("/consent/revoke/{scope}")
async def revoke_consent(
    scope: ConsentScope,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    result = await consent_manager.revoke_consent(user_id=user_id, scope=scope, db=db)
    return result


@router.get("/consent/me")
async def my_consents(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    records = await consent_manager.list_consents(user_id=user_id, db=db)
    return {"items": records}


async def require_consent(
    scope: ConsentScope,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub")
    granted = await consent_manager.check_consent(user_id=user_id, scope=scope, db=db)
    if not granted:
        raise HTTPException(
            status_code=403,
            detail=f"Consent required for scope: {scope.value}",
        )
    return True
