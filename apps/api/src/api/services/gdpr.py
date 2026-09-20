import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..services.audit_service import audit_service

router = APIRouter()

ALLOWED_TABLES = frozenset({
    "users", "auth_sessions", "workspaces", "workspace_users",
    "memories", "agents", "integrations", "notifications",
    "events", "usage_records", "api_keys", "connectors",
    # Expanded 2026-08-22 F-09: user-tied tables for complete Art.20 portability
    "consent_records", "documents", "document_actions", "document_chunks",
    "memory_records", "entities", "relationships", "embeddings",
    "resumes", "applications", "schedule_events", "agent_executions",
    "agent_actions", "agent_approvals", "permissions", "subscriptions",
    "gmail_watches", "provider_keys", "memory_versions",
    "resume_artifacts", "resume_sources",
})

EXPORT_COLUMNS = {
    "users": "*",
    "auth_sessions": "*",
    "workspaces": "*",
    "workspace_users": "*",
    "memories": "*",
    "agents": "*",
    "integrations": "*",
    "notifications": "*",
    "events": "*",
    "usage_records": "*",
    "api_keys": "*",
    "connectors": "*",
    "consent_records": "*",
    "documents": "*",
    "document_actions": "*",
    "document_chunks": "*",
    "memory_records": "*",
    "entities": "*",
    "relationships": "*",
    "embeddings": "*",
    "resumes": "*",
    "applications": "*",
    "schedule_events": "*",
    "agent_executions": "*",
    "agent_actions": "*",
    "agent_approvals": "*",
    "permissions": "*",
    "subscriptions": "*",
    "gmail_watches": "*",
    "provider_keys": "*",
    "memory_versions": "*",
    "resume_artifacts": "*",
    "resume_sources": "*",
}

USER_TABLES = [
    ("users", "id"),
    ("auth_sessions", "user_id"),
    ("workspaces", "user_id"),
    ("workspace_users", "user_id"),
    ("memories", "user_id"),
    ("agents", "user_id"),
    ("integrations", "user_id"),
    ("notifications", "user_id"),
    ("events", "user_id"),
    ("usage_records", "user_id"),
    ("api_keys", "user_id"),
    ("connectors", "workspace_id"),
    # Expanded F-09: direct user_id or workspace subquery — ADVISORY excludes system tables without user tie
    # F-23 fix: embeddings before document_chunks so vectors derived from personal data are removed before chunk rows (SET NULL safe either way, but logical delete order)
    ("consent_records", "user_id"),
    ("documents", "workspace_id"),
    ("document_actions", "workspace_id"),
    ("embeddings", "workspace_id"),
    ("document_chunks", "workspace_id"),
    ("memory_records", "workspace_id"),
    ("entities", "workspace_id"),
    ("relationships", "workspace_id"),
    ("resumes", "workspace_id"),
    ("resume_artifacts", "workspace_id"),
    ("applications", "workspace_id"),
    ("schedule_events", "workspace_id"),
    ("agent_executions", "user_id"),
    ("agent_actions", "workspace_id"),
    ("agent_approvals", "workspace_id"),
    ("permissions", "workspace_id"),
    ("subscriptions", "user_id"),
    ("gmail_watches", "user_id"),
    ("provider_keys", "user_id"),
    ("memory_versions", "workspace_id"),
]


def _validate_table(table: str) -> str:
    if table not in ALLOWED_TABLES:
        raise ValueError(f"Invalid table name: {table}")
    return table


class DataExportResponse(BaseModel):
    user_id: str
    exported_at: datetime
    data: dict
    total_records: int


class TenantDataExportResponse(BaseModel):
    tenant_id: str
    tenant_name: str
    exported_at: datetime
    data: dict
    total_records: int



class GDPRService:
    async def export_user_data(self, user_id: str, db: AsyncSession) -> DataExportResponse:
        data = {}
        total_records = 0

        for table, fk_col in USER_TABLES:
            _validate_table(table)
            columns = EXPORT_COLUMNS.get(table, "*")
            if fk_col == "workspace_id":
                result = await db.execute(
                    text(f"SELECT {columns} FROM {table} WHERE {fk_col} IN (SELECT id FROM workspaces WHERE user_id = :uid)"),  # nosec B608
                    {"uid": user_id},
                )
            else:
                result = await db.execute(
                    text(f"SELECT {columns} FROM {table} WHERE {fk_col} = :uid"),  # nosec B608
                    {"uid": user_id},
                )
            rows = [dict(row._mapping) for row in result.fetchall()]
            if rows:
                serializable = []
                for r in rows:
                    serializable.append({k: str(v) if not isinstance(v, (str, int, float, bool, type(None), list, dict)) else v for k, v in r.items()})
                data[table] = serializable
                total_records += len(serializable)

        return DataExportResponse(
            user_id=user_id,
            exported_at=datetime.now(UTC),
            data=data,
            total_records=total_records,
        )

    async def delete_user_data(self, user_id: str, db: AsyncSession) -> dict:
        summary = {}

        for table, fk_col in USER_TABLES:
            _validate_table(table)

            if table == "users":
                result = await db.execute(
                    text("UPDATE users SET email = :anon_email, display_name = :anon_name, password_hash = NULL, avatar_url = NULL, status = 'ANONYMIZED' WHERE id = :uid"),  # nosec B608
                    {"uid": user_id, "anon_email": f"deleted-{uuid.uuid4()}@vaeloom.local", "anon_name": "Deleted User"},
                )
                summary[table] = result.rowcount
                continue

            if fk_col == "workspace_id":
                result = await db.execute(
                    text(f"DELETE FROM {table} WHERE {fk_col} IN (SELECT id FROM workspaces WHERE user_id = :uid)"),  # nosec B608
                    {"uid": user_id},
                )
            else:
                result = await db.execute(
                    text(f"DELETE FROM {table} WHERE {fk_col} = :uid"),  # nosec B608
                    {"uid": user_id},
                )
            summary[table] = result.rowcount

        return {"user_id": user_id, "action": "anonymized", "tables": summary}

    async def export_tenant_data(self, tenant_id: str, db: AsyncSession) -> TenantDataExportResponse:
        from ..models.schema import OnboardingState, Tenant, User, Workspace

        try:
            tid = uuid.UUID(tenant_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail=f"Invalid tenant UUID: {tenant_id}")

        res = await db.execute(select(Tenant).where(Tenant.id == tid))
        tenant = res.scalar_one_or_none()
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found")

        data: dict = {}
        total_records = 0

        # Tenant info
        data["tenant"] = {
            "id": str(tenant.id),
            "name": tenant.name,
            "slug": tenant.slug,
            "created_at": tenant.created_at.isoformat() if tenant.created_at else None,
        }
        total_records += 1

        # Users belonging to this tenant
        u_res = await db.execute(
            select(User).where(User.tenant_id == tid)
        )
        users = u_res.scalars().all()
        data["users"] = [
            {
                "id": str(u.id),
                "email": u.email,
                "display_name": u.display_name,
                "status": u.status,
                "auth_provider": u.auth_provider,
                "created_at": u.created_at.isoformat() if u.created_at else None,
            }
            for u in users
        ]
        total_records += len(users)

        user_ids = [u.id for u in users]
        if user_ids:
            # Workspaces of tenant users
            w_res = await db.execute(
                select(Workspace).where(Workspace.user_id.in_(user_ids))
            )
            workspaces = w_res.scalars().all()
            data["workspaces"] = [
                {
                    "id": str(w.id),
                    "name": w.name,
                    "user_id": str(w.user_id),
                    "created_at": w.created_at.isoformat() if w.created_at else None,
                }
                for w in workspaces
            ]
            total_records += len(workspaces)

            # Onboarding states
            o_res = await db.execute(
                select(OnboardingState).where(OnboardingState.user_id.in_(user_ids))
            )
            onboardings = o_res.scalars().all()
            data["onboarding_states"] = [
                {
                    "id": str(o.id),
                    "user_id": str(o.user_id),
                    "current_step": o.current_step,
                    "completed_steps": o.completed_steps,
                    "is_completed": o.is_completed,
                    "step_data": o.step_data,
                    "created_at": o.created_at.isoformat() if o.created_at else None,
                }
                for o in onboardings
            ]
            total_records += len(onboardings)
        else:
            data["workspaces"] = []
            data["onboarding_states"] = []

        return TenantDataExportResponse(
            tenant_id=str(tenant.id),
            tenant_name=tenant.name,
            exported_at=datetime.now(UTC),
            data=data,
            total_records=total_records,
        )


gdpr_service = GDPRService()


@router.get("/gdpr/export")
async def gdpr_export(
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    user_id = str(current_user.get("sub"))
    result = await gdpr_service.export_user_data(user_id, db)
    await audit_service.record_event(
        actor_id=user_id,
        action="gdpr.export",
        resource="gdpr",
        resource_id=user_id,
        tenant_id=current_user.get("tenant_id"),
        metadata={"total_records": result.total_records},
        db=db,
    )
    await db.commit()
    return result


@router.post("/gdpr/delete")
async def gdpr_delete(
    user_id: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    caller_id = str(current_user.get("sub"))
    target_id = user_id or caller_id
    if target_id != caller_id:
        user_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
        if "admin" not in user_roles:
            raise HTTPException(status_code=403, detail="Requires role: admin")
    result = await gdpr_service.delete_user_data(target_id, db)
    await audit_service.record_event(
        actor_id=caller_id,
        action="gdpr.delete",
        resource="gdpr",
        resource_id=target_id,
        tenant_id=current_user.get("tenant_id"),
        metadata=result,
        db=db,
    )
    await db.commit()
    return result


@router.post("/tenants/{tenant_id}/export", response_model=TenantDataExportResponse)
async def export_tenant_gdpr(
    tenant_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    caller_tenant_id = current_user.get("tenant_id")
    caller_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
    # ZERO-TRUST: Strict tenant boundary enforcement
    if "admin" not in caller_roles and (not caller_tenant_id or str(caller_tenant_id) != str(tenant_id)):
        raise HTTPException(
            status_code=403,
            detail="Cross-tenant violation: You do not have permission to export this tenant's data",
        )

    result = await gdpr_service.export_tenant_data(tenant_id, db)
    await audit_service.record_event(
        actor_id=str(current_user.get("sub")),
        action="tenant.export",
        resource="tenant",
        resource_id=tenant_id,
        tenant_id=tenant_id,
        metadata={"total_records": result.total_records},
        db=db,
    )
    await db.commit()
    return result

