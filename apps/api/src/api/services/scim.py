import os
import uuid
from typing import Any

from fastapi import APIRouter, Depends, FastAPI, HTTPException, Header, Query
from pydantic import BaseModel
from sqlalchemy import select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
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


async def verify_scim_token(authorization: str | None = Header(None)):
    scim_token = _get_scim_token()
    if not scim_token:
        raise HTTPException(status_code=500, detail="SCIM not configured: SCIM_TOKEN env var not set")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    token = authorization.removeprefix("Bearer ")
    if token != scim_token:
        raise HTTPException(status_code=401, detail="Invalid SCIM token")
    return True


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


@router.post("/scim/v2/Users", status_code=201)
async def create_scim_user(
    dto: SCIMUserRequest,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    existing = await db.execute(select(User).where(User.email == dto.userName))
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
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return _scim_user_response(user)


@router.get("/scim/v2/Users")
async def list_scim_users(
    filter: str | None = Query(None),
    startIndex: int = Query(1, ge=1),
    count: int = Query(100, ge=0, le=1000),
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    query = select(User)
    if filter:
        if "userName" in filter and "eq" in filter:
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


@router.get("/scim/v2/Users/{user_id}")
async def get_scim_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _scim_user_response(user)


@router.put("/scim/v2/Users/{user_id}")
async def update_scim_user(
    user_id: str,
    dto: SCIMUserRequest,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
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


@router.patch("/scim/v2/Users/{user_id}")
async def patch_scim_user(
    user_id: str,
    dto: SCIMPatchOp,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
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


@router.delete("/scim/v2/Users/{user_id}", status_code=204)
async def delete_scim_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _auth=Depends(verify_scim_token),
):
    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "INACTIVE"
    db.add(user)
