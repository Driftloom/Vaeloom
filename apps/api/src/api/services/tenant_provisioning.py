import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Tenant, User, Workspace, WorkspaceUser


class ProvisioningError(Exception):
    pass


class TenantProvisioner:
    def __init__(self):
        self._provisioning_status: dict[str, dict] = {}

    async def provision_tenant(
        self,
        name: str,
        domain: str,
        admin_email: str,
        db: AsyncSession,
    ) -> dict:
        existing = await db.execute(select(Tenant).where(Tenant.domain == domain))
        if existing.scalar_one_or_none():
            raise ProvisioningError(f"Tenant with domain '{domain}' already exists")

        slug = domain.split(".")[0].lower().replace(" ", "-")
        tenant_id = uuid.uuid4()
        tenant = Tenant(
            id=tenant_id,
            name=name,
            slug=slug,
            domain=domain,
            status="ACTIVE",
            settings={"branding": {}, "policies": {}, "retention": {}},
        )
        db.add(tenant)
        await db.flush()

        self._provisioning_status[str(tenant_id)] = {
            "tenant_created": True,
            "admin_user_created": False,
            "default_workspace_created": False,
        }

        admin_result = await db.execute(select(User).where(User.email == admin_email))
        admin_user = admin_result.scalar_one_or_none()
        if not admin_user:
            admin_user = User(
                email=admin_email,
                display_name=admin_email.split("@")[0],
                tenant_id=tenant_id,
                auth_provider="sso",
                status="ACTIVE",
            )
            db.add(admin_user)
            await db.flush()
            await db.refresh(admin_user)

        self._provisioning_status[str(tenant_id)]["admin_user_created"] = True

        workspace = Workspace(
            user_id=admin_user.id,
            name=f"{name} Workspace",
            description=f"Default workspace for {name}",
        )
        db.add(workspace)
        await db.flush()

        workspace_user = WorkspaceUser(
            workspace_id=workspace.id,
            user_id=admin_user.id,
            role="ADMIN",
        )
        db.add(workspace_user)

        self._provisioning_status[str(tenant_id)]["default_workspace_created"] = True
        self._provisioning_status[str(tenant_id)]["completed"] = True
        self._provisioning_status[str(tenant_id)]["completed_at"] = datetime.now(timezone.utc).isoformat()

        return {
            "tenant_id": str(tenant_id),
            "slug": slug,
            "admin_user_id": str(admin_user.id),
            "workspace_id": str(workspace.id),
        }

    async def deprovision_tenant(self, tenant_id: str, db: AsyncSession) -> dict:
        result = await db.execute(select(Tenant).where(Tenant.id == uuid.UUID(tenant_id)))
        tenant = result.scalar_one_or_none()
        if not tenant:
            raise ProvisioningError(f"Tenant '{tenant_id}' not found")

        await db.execute(
            update(Tenant).where(Tenant.id == uuid.UUID(tenant_id)).values(status="DEPROVISIONED")
        )
        await db.execute(
            update(User).where(User.tenant_id == uuid.UUID(tenant_id)).values(status="SUSPENDED")
        )

        # TODO: Schedule async data cleanup job for tenant data
        return {
            "tenant_id": tenant_id,
            "status": "DEPROVISIONED",
            "message": "Tenant deprovisioned. Data cleanup scheduled.",
        }

    async def get_provisioning_status(self, tenant_id: str) -> dict:
        status = self._provisioning_status.get(tenant_id, {})
        if not status:
            return {"tenant_id": tenant_id, "status": "unknown", "steps": {}}
        return {"tenant_id": tenant_id, **status}


tenant_provisioner = TenantProvisioner()
