from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..services.api_keys import APIKeyResponse, api_key_manager

router = APIRouter()


class CreateAPIKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    permissions: list[str] = Field(default_factory=list)
    expires_days: int | None = Field(None, ge=1, le=365)


class CreatedAPIKeyResponse(BaseModel):
    id: str
    name: str
    key: str
    key_prefix: str
    permissions: list[str]
    tenant_id: str | None = None
    user_id: str
    expires_at: datetime | None = None
    enabled: bool
    version: int
    created_at: datetime


class RotatedAPIKeyResponse(BaseModel):
    id: str
    key: str
    key_prefix: str
    version: int
    rotated_at: datetime | None = None


@router.get("", response_model=list[APIKeyResponse])
async def list_api_keys(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    keys = await api_key_manager.list_keys(user_id, db)
    return [
        APIKeyResponse(
            id=str(k.id),
            name=k.name,
            key_prefix=k.key_prefix,
            permissions=k.permissions or [],
            tenant_id=str(k.tenant_id) if k.tenant_id else None,
            user_id=str(k.user_id),
            expires_at=k.expires_at,
            last_used=k.last_used,
            enabled=k.enabled,
            version=k.version,
            rotated_at=k.rotated_at,
            created_at=k.created_at,
        )
        for k in keys
    ]


@router.post("", response_model=CreatedAPIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    req: CreateAPIKeyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    tenant_id = current_user.get("tenant_id")
    expires_at = (
        datetime.now(UTC) + timedelta(days=req.expires_days)
        if req.expires_days
        else None
    )

    raw, api_key = await api_key_manager.create_key(
        name=req.name,
        user_id=user_id,
        permissions=req.permissions,
        tenant_id=tenant_id,
        expires_at=expires_at,
        db=db,
    )
    await db.commit()

    return CreatedAPIKeyResponse(
        id=str(api_key.id),
        name=api_key.name,
        key=raw,
        key_prefix=api_key.key_prefix,
        permissions=api_key.permissions or [],
        tenant_id=str(api_key.tenant_id) if api_key.tenant_id else None,
        user_id=str(api_key.user_id),
        expires_at=api_key.expires_at,
        enabled=api_key.enabled,
        version=api_key.version,
        created_at=api_key.created_at,
    )


@router.post("/{key_id}/rotate", response_model=RotatedAPIKeyResponse)
async def rotate_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    key = await api_key_manager.get_key(key_id, db)
    if not key or str(key.user_id) != user_id:
        raise HTTPException(status_code=404, detail="API key not found")

    raw, rotated = await api_key_manager.rotate_key(key_id, db)
    await db.commit()

    return RotatedAPIKeyResponse(
        id=str(rotated.id),
        key=raw,
        key_prefix=rotated.key_prefix,
        version=rotated.version,
        rotated_at=rotated.rotated_at,
    )


@router.delete("/{key_id}")
async def revoke_api_key(
    key_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    key = await api_key_manager.get_key(key_id, db)
    if not key or str(key.user_id) != user_id:
        raise HTTPException(status_code=404, detail="API key not found")

    await api_key_manager.revoke_key(key_id, db)
    await db.commit()
    return {"status": "revoked"}
