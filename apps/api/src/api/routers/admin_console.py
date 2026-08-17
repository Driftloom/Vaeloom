from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, require_role
from ..services.tenant_provisioning import tenant_provisioner, ProvisioningError
from ..services.tenant_settings import TenantSettings, tenant_settings_manager, TenantSettingsError

router = APIRouter()


class TenantProvisionRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    domain: str = Field(..., min_length=1, max_length=255)
    admin_email: str = Field(..., min_length=5, max_length=320)


@router.get("/admin/users")
async def admin_list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: str | None = Query(None),
    tenant_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    from ..models.schema import User

    query = select(User)
    if status:
        query = query.where(User.status == status)
    if tenant_id:
        from uuid import UUID
        query = query.where(User.tenant_id == UUID(tenant_id))
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    users = result.scalars().all()
    return {
        "items": [
            {
                "id": str(u.id),
                "email": u.email,
                "display_name": u.display_name,
                "status": u.status,
                "auth_provider": u.auth_provider,
                "tenant_id": str(u.tenant_id) if u.tenant_id else None,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ],
        "total": len(users),
        "page": page,
        "page_size": page_size,
    }


@router.get("/admin/users/{user_id}")
async def admin_get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    from uuid import UUID
    from ..models.schema import User

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "status": user.status,
        "auth_provider": user.auth_provider,
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": user.updated_at.isoformat() if user.updated_at else None,
    }


@router.post("/admin/users/{user_id}/suspend")
async def admin_suspend_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    from uuid import UUID
    from ..models.schema import User

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "SUSPENDED"
    db.add(user)
    return {"status": "SUSPENDED", "user_id": user_id}


@router.post("/admin/users/{user_id}/activate")
async def admin_activate_user(
    user_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    from uuid import UUID
    from ..models.schema import User

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.status = "ACTIVE"
    db.add(user)
    return {"status": "ACTIVE", "user_id": user_id}


@router.post("/admin/tenants", status_code=201)
async def admin_provision_tenant(
    dto: TenantProvisionRequest,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    try:
        result = await tenant_provisioner.provision_tenant(
            name=dto.name, domain=dto.domain, admin_email=dto.admin_email, db=db,
        )
        return result
    except ProvisioningError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.delete("/admin/tenants/{tenant_id}")
async def admin_deprovision_tenant(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    try:
        result = await tenant_provisioner.deprovision_tenant(tenant_id=tenant_id, db=db)
        return result
    except ProvisioningError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/admin/tenants/{tenant_id}/status")
async def admin_provisioning_status(
    tenant_id: str,
    _admin=Depends(require_role("admin")),
):
    return await tenant_provisioner.get_provisioning_status(tenant_id)


@router.get("/admin/tenants/{tenant_id}/settings")
async def admin_get_tenant_settings(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    try:
        return await tenant_settings_manager.get_settings(tenant_id, db)
    except TenantSettingsError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/admin/tenants/{tenant_id}/settings")
async def admin_update_tenant_settings(
    tenant_id: str,
    body: TenantSettings,
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    try:
        return await tenant_settings_manager.update_settings(tenant_id, body, db)
    except TenantSettingsError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/admin/audit-log")
async def admin_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: str | None = Query(None),
    resource: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _admin=Depends(require_role("admin")),
):
    conditions: list[str] = []
    params: dict = {}
    if action:
        conditions.append("action = :action")
        params["action"] = action
    if resource:
        conditions.append("resource = :resource")
        params["resource"] = resource
    where = " AND ".join(conditions) if conditions else "TRUE"
    offset = (page - 1) * page_size

    count_result = await db.execute(
        text(f"SELECT COUNT(*) FROM audit_events WHERE {where}"), params
    )
    total = count_result.scalar_one() or 0

    rows_result = await db.execute(
        text(f"""
            SELECT id, actor_id, action, resource, resource_id,
                   tenant_id, metadata, created_at
            FROM audit_events
            WHERE {where}
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """),
        {**params, "limit": page_size, "offset": offset},
    )
    rows = rows_result.fetchall()
    items = []
    for r in rows:
        items.append({
            "id": r[0],
            "actor_id": r[1] or None,
            "action": r[2],
            "resource": r[3],
            "resource_id": r[4] or None,
            "tenant_id": r[5],
            "created_at": r[7].isoformat() if hasattr(r[7], 'isoformat') else str(r[7]) if r[7] else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
