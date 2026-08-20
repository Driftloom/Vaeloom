import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..schemas.provider_key import (
    ProviderKeyCreate,
    ProviderKeyUpdate,
    ProviderKeyResponse,
    ProviderKeyListResponse,
    EffectiveKeyResponse,
    ValidateKeyResponse,
    ALLOWED_PROVIDERS,
)
from ..services.provider_key_service import provider_key_service

router = APIRouter()


@router.get("", response_model=ProviderKeyListResponse)
async def list_provider_keys(
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    keys = await provider_key_service.list_for_user(db, user_id, workspace_id)
    return ProviderKeyListResponse(
        keys=[ProviderKeyResponse.model_validate(k) for k in keys],
        total=len(keys),
    )


@router.get("/effective", response_model=EffectiveKeyResponse)
async def get_effective_key(
    provider: str = Query(..., min_length=1),
    workspace_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    provider = provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
    effective = await provider_key_service.resolve_effective(db, user_id, provider, workspace_id)
    return EffectiveKeyResponse(
        provider=provider,
        has_custom_key=effective["source"] in ("workspace", "user"),
        source=effective["source"],
        key_hint=effective["hint"],
        is_valid=effective["is_valid"],
        last_validated_at=effective["last_validated_at"],
    )


@router.post("", response_model=ProviderKeyResponse, status_code=201)
async def create_provider_key(
    dto: ProviderKeyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    provider = dto.provider.strip().lower()
    if provider not in ALLOWED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider '{provider}'")
    if not dto.api_key or len(dto.api_key.strip()) < 8:
        raise HTTPException(status_code=400, detail="API key too short")

    # Validate workspace ownership if provided
    ws_id = str(dto.workspace_id) if dto.workspace_id else None
    if ws_id:
        from ..models.schema import Workspace
        from sqlalchemy import select
        result = await db.execute(select(Workspace).where(Workspace.id == uuid.UUID(ws_id), Workspace.user_id == uuid.UUID(user_id)))
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Workspace not found or not owned by user")

    try:
        row = await provider_key_service.upsert(db, user_id, provider, dto.api_key.strip(), ws_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return ProviderKeyResponse.model_validate(row)


@router.delete("/{key_id}", status_code=204)
async def delete_provider_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    ok = await provider_key_service.delete(db, key_id, user_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Provider key not found")
    return None


@router.post("/{key_id}/validate", response_model=ValidateKeyResponse)
async def validate_provider_key(
    key_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    row = await provider_key_service.get_by_id(db, key_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Provider key not found")
    is_valid, msg, latency = await provider_key_service.validate(db, row)
    return ValidateKeyResponse(is_valid=is_valid, provider=row.provider, message=msg, latency_ms=latency)


@router.patch("/{key_id}", response_model=ProviderKeyResponse)
async def update_provider_key(
    key_id: uuid.UUID,
    body: ProviderKeyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    user_id = current_user.get("sub") or current_user.get("user_id")
    row = await provider_key_service.get_by_id(db, key_id, user_id)
    if not row:
        raise HTTPException(status_code=404, detail="Provider key not found")

    if body.is_active is not None:
        row = await provider_key_service.set_active(db, key_id, user_id, body.is_active)
        return ProviderKeyResponse.model_validate(row)

    if body.api_key:
        raw = body.api_key.strip()
        hint = f"...{raw[-4:]}" if len(raw) >= 4 else "...****"
        prefix = raw[:7] if len(raw) >= 7 else raw[:3]
        from ..services.encryption import encrypt_value
        row.encrypted_key = encrypt_value(raw)
        row.key_hint = hint
        row.key_prefix = prefix
        row.is_valid = None
        row.validation_error = None
        from datetime import datetime, timezone
        row.updated_at = datetime.now(timezone.utc)
        row.is_active = True
        await db.flush()
        await db.refresh(row)
        return ProviderKeyResponse.model_validate(row)

    raise HTTPException(status_code=400, detail="No updatable field provided (api_key or is_active)")
