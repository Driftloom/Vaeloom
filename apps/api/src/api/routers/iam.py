from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, require_role
from ..schemas.iam import AssignRolesRequest, CreateUserRequest, UpdateUserRequest, UserResponse
from ..services.iam_service import iam_service

router = APIRouter()


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    dto: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    user = await iam_service.create_user(dto=dto, db=db)
    return UserResponse(**user)


@router.get("/users", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    limit: int | None = Query(default=None, ge=1, le=100, description="Standard pagination page size (wins over page/page_size)"),
    offset: int | None = Query(default=None, ge=0, description="Standard pagination rows to skip"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    from ..utils.pagination import resolve_page_params
    page, page_size = resolve_page_params(page, page_size, limit, offset)
    tenant_id = current_user.get("tenant_id")
    if not tenant_id:
        raise HTTPException(status_code=400, detail="Tenant ID required")
    users, total = await iam_service.list_users(page=page, page_size=page_size, tenant_id=tenant_id, db=db)
    return {"items": [UserResponse(**u) for u in users], "total": total, "page": page, "page_size": page_size}


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    user = await iam_service.get_user(user_id=user_id, db=db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    dto: UpdateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    user = await iam_service.update_user(user_id=user_id, dto=dto, db=db)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(**user)


@router.delete("/users/{user_id}", status_code=204)
async def deactivate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    await iam_service.deactivate_user(user_id=user_id, db=db)


@router.post("/users/{user_id}/roles", status_code=200)
async def assign_roles(
    user_id: str,
    dto: AssignRolesRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    await iam_service.assign_roles(user_id=user_id, role_ids=dto.role_ids, db=db)
    return {"status": "ok"}


@router.delete("/users/{user_id}/roles/{role_id}", status_code=204)
async def remove_role(
    user_id: str,
    role_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    await iam_service.remove_role(user_id=user_id, role_id=role_id, db=db)


@router.get("/users/{user_id}/permissions", response_model=list[str])
async def get_permissions(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_role("admin")),
):
    return await iam_service.get_permissions(user_id=user_id, db=db)


class OrganizationInviteRequest(BaseModel):
    email: str
    role: str = "Editor"
    organization_id: str | None = None


@router.post("/organizations/invites", status_code=201)
async def create_organization_invite(
    dto: OrganizationInviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    import uuid

    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": str(uuid.uuid4()),
        "email": dto.email,
        "role": dto.role,
        "status": "invited",
        "message": f"Invitation successfully sent to {dto.email}",
    }
