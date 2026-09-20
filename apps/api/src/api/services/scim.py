import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..models.schema import User


def _get_scim_token() -> str:
    return os.environ.get("SCIM_TOKEN", "")

SCHEMAS_USER = "urn:ietf:params:scim:schemas:core:2.0:User"
SCHEMAS_GROUP = "urn:ietf:params:scim:schemas:core:2.0:Group"
SCHEMAS_LIST_RESPONSE = "urn:ietf:params:scim:api:messages:2.0:ListResponse"
SCHEMAS_ERROR = "urn:ietf:params:scim:api:messages:2.0:Error"


class SCIMName(BaseModel):
    formatted: str | None = None
    familyName: str | None = None
    givenName: str | None = None


class SCIMMultiValuedAttribute(BaseModel):
    value: str
    type: str | None = None
    primary: bool | None = None


class SCIMUserRequest(BaseModel):
    schemas: list[str] = [SCHEMAS_USER]
    userName: str
    name: SCIMName | None = None
    emails: list[SCIMMultiValuedAttribute] | None = None
    active: bool = True
    groups: list[SCIMMultiValuedAttribute] | None = None
    externalId: str | None = None


class SCIMGroupRequest(BaseModel):
    schemas: list[str] = [SCHEMAS_GROUP]
    displayName: str
    members: list[SCIMMultiValuedAttribute] | None = None


class SCIMPatchOp(BaseModel):
    schemas: list[str] = ["urn:ietf:params:scim:api:messages:2.0:PatchOp"]
    Operations: list[dict[str, Any]] = []


router = APIRouter()


async def verify_scim_token(
    authorization: str | None = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.removeprefix("Bearer ").strip()

    # 1. Check per-tenant SCIM tokens (SHA-256 hashed)
    import hashlib
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    from ..models.schema import TenantScimToken
    res = await db.execute(
        select(TenantScimToken).where(
            TenantScimToken.token_hash == token_hash,
            TenantScimToken.revoked.is_(False),
        )
    )
    scim_token_rec = res.scalar_one_or_none()
    if scim_token_rec:
        return {"tenant_id": scim_token_rec.tenant_id}

    # 2. Fallback to global SCIM_TOKEN if configured
    global_scim = _get_scim_token()
    if global_scim and token == global_scim:
        return {"tenant_id": None}

    raise HTTPException(status_code=401, detail="Invalid SCIM token")


def _scim_user_response(user: User) -> dict:
    return {
        "schemas": [SCHEMAS_USER],
        "id": str(user.id),
        "userName": user.email,
        "name": {"formatted": user.display_name, "familyName": None, "givenName": None},
        "emails": [{"value": user.email, "type": "work", "primary": True}],
        "active": user.status == "ACTIVE",
        "meta": {
            "resourceType": "User",
            "created": user.created_at.isoformat() if user.created_at else None,
            "lastModified": user.updated_at.isoformat() if user.updated_at else None,
        },
    }


@router.post("/tokens", status_code=201)
async def create_tenant_scim_token(
    tenant_id: uuid.UUID = Query(...),
    name: str = Query("SCIM Token"),
    db: AsyncSession = Depends(get_db),
):
    import secrets
    import hashlib
    from ..models.schema import TenantScimToken
    raw_token = f"scim_{secrets.token_urlsafe(32)}"
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    scim_token = TenantScimToken(
        tenant_id=tenant_id,
        token_hash=token_hash,
        name=name,
    )
    db.add(scim_token)
    await db.commit()
    return {
        "id": str(scim_token.id),
        "tenant_id": str(tenant_id),
        "token": raw_token,
        "name": name,
    }


@router.post("/v2/Users", status_code=201)
async def create_scim_user(
    dto: SCIMUserRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User).where(User.email == dto.userName)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    existing = await db.execute(query)
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"User '{dto.userName}' already exists")

    display_name = dto.userName
    if dto.name and dto.name.formatted:
        display_name = dto.name.formatted

    user = User(
        email=dto.userName,
        display_name=display_name,
        status="ACTIVE" if dto.active else "INACTIVE",
        auth_provider="scim",
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return _scim_user_response(user)


@router.get("/v2/Users")
async def list_scim_users(
    filter: str | None = Query(None),
    startIndex: int = Query(1, ge=1),
    count: int = Query(100, ge=0, le=1000),
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User)
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    if filter and "userName" in filter and "eq" in filter:
        email = filter.split("eq")[-1].strip().strip('"').strip("'")
        query = query.where(User.email == email)
    query = query.offset(startIndex - 1).limit(count)
    result = await db.execute(query)
    users = result.scalars().all()
    total = len(users)

    return {
        "schemas": [SCHEMAS_LIST_RESPONSE],
        "totalResults": total,
        "startIndex": startIndex,
        "itemsPerPage": count,
        "Resources": [_scim_user_response(u) for u in users],
    }


@router.get("/v2/Users/{user_id}")
async def get_scim_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User).where(User.id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _scim_user_response(user)


@router.put("/v2/Users/{user_id}")
async def update_scim_user(
    user_id: str,
    dto: SCIMUserRequest,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User).where(User.id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    display_name = dto.userName
    if dto.name and dto.name.formatted:
        display_name = dto.name.formatted

    user.email = dto.userName
    user.display_name = display_name
    user.status = "ACTIVE" if dto.active else "INACTIVE"
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return _scim_user_response(user)


@router.patch("/v2/Users/{user_id}")
async def patch_scim_user(
    user_id: str,
    dto: SCIMPatchOp,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User).where(User.id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for op in dto.Operations:
        op_type = op.get("op", "").lower()
        path = op.get("path", "")
        value = op.get("value")

        if op_type == "replace":
            if path == "active" or (not path and isinstance(value, dict) and "active" in value):
                active = value if isinstance(value, bool) else value.get("active", user.status == "ACTIVE")
                user.status = "ACTIVE" if active else "INACTIVE"
            if path == "userName" or (not path and isinstance(value, dict) and "userName" in value):
                new_email = value if isinstance(value, str) else value.get("userName", user.email)
                user.email = new_email
            if path == "name.formatted" or (not path and isinstance(value, dict) and "name" in value):
                name_data = value.get("name", {})
                if isinstance(name_data, dict) and name_data.get("formatted"):
                    user.display_name = name_data["formatted"]
        elif op_type == "replace" and path == "active":
            user.status = "ACTIVE" if value else "INACTIVE"

    db.add(user)
    await db.flush()
    await db.refresh(user)
    return _scim_user_response(user)


@router.delete("/v2/Users/{user_id}", status_code=204)
async def delete_scim_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    auth: dict = Depends(verify_scim_token),
):
    tenant_id = auth.get("tenant_id")
    query = select(User).where(User.id == uuid.UUID(user_id))
    if tenant_id:
        query = query.where(User.tenant_id == tenant_id)
    result = await db.execute(query)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "INACTIVE"
    db.add(user)

