import uuid

import pytest
from sqlalchemy import select

from backend.models.schema import Tenant, User, Workspace, WorkspaceUser
from backend.services.tenant_provisioning import ProvisioningError, TenantProvisioner

pytestmark = pytest.mark.asyncio


class TestProvisionTenant:
    async def test_creates_tenant_admin_workspace(self, db_session):
        provisioner = TenantProvisioner()
        result = await provisioner.provision_tenant(
            name="Acme Corp",
            domain="acme.com",
            admin_email="admin@acme.com",
            db=db_session,
        )

        assert result["tenant_id"]
        assert result["slug"] == "acme"
        assert result["admin_user_id"]
        assert result["workspace_id"]

        tenant = (await db_session.execute(select(Tenant).where(Tenant.id == uuid.UUID(result["tenant_id"])))).scalar_one()
        assert tenant.name == "Acme Corp"
        assert tenant.domain == "acme.com"
        assert tenant.status == "ACTIVE"

        user = (await db_session.execute(select(User).where(User.id == uuid.UUID(result["admin_user_id"])))).scalar_one()
        assert user.email == "admin@acme.com"
        assert str(user.tenant_id) == result["tenant_id"]

        ws = (await db_session.execute(select(Workspace).where(Workspace.id == uuid.UUID(result["workspace_id"])))).scalar_one()
        assert ws.name == "Acme Corp Workspace"

        wu = (await db_session.execute(
            select(WorkspaceUser).where(
                WorkspaceUser.workspace_id == uuid.UUID(result["workspace_id"]),
                WorkspaceUser.user_id == uuid.UUID(result["admin_user_id"]),
            )
        )).scalar_one()
        assert wu.role == "ADMIN"

    async def test_rejects_duplicate_domain(self, db_session):
        provisioner = TenantProvisioner()
        await provisioner.provision_tenant(name="Acme", domain="acme.com", admin_email="a@acme.com", db=db_session)
        with pytest.raises(ProvisioningError, match="already exists"):
            await provisioner.provision_tenant(name="Acme 2", domain="acme.com", admin_email="b@acme.com", db=db_session)

    async def test_uses_existing_admin_user(self, db_session):
        existing_user = User(email="existing@co.com", display_name="Existing")
        db_session.add(existing_user)
        await db_session.flush()
        await db_session.refresh(existing_user)

        provisioner = TenantProvisioner()
        result = await provisioner.provision_tenant(
            name="Co", domain="co.com", admin_email="existing@co.com", db=db_session,
        )
        assert result["admin_user_id"] == str(existing_user.id)


class TestDeprovisionTenant:
    async def test_soft_deletes_tenant(self, db_session):
        provisioner = TenantProvisioner()
        result = await provisioner.provision_tenant(name="Test", domain="test.com", admin_email="admin@test.com", db=db_session)
        await db_session.commit()

        deprovisioner = TenantProvisioner()
        dep_result = await deprovisioner.deprovision_tenant(result["tenant_id"], db=db_session)
        assert dep_result["status"] == "DEPROVISIONED"

        tenant = (await db_session.execute(select(Tenant).where(Tenant.id == uuid.UUID(result["tenant_id"])))).scalar_one()
        assert tenant.status == "DEPROVISIONED"

    async def test_raises_on_missing_tenant(self, db_session):
        provisioner = TenantProvisioner()
        with pytest.raises(ProvisioningError, match="not found"):
            await provisioner.deprovision_tenant(str(uuid.uuid4()), db=db_session)


class TestGetProvisioningStatus:
    async def test_returns_status(self):
        provisioner = TenantProvisioner()
        tid = str(uuid.uuid4())
        provisioner._provisioning_status[tid] = {"tenant_created": True, "completed": True}
        status = await provisioner.get_provisioning_status(tid)
        assert status["tenant_id"] == tid
        assert status["completed"] is True

    async def test_returns_unknown_for_missing(self):
        provisioner = TenantProvisioner()
        status = await provisioner.get_provisioning_status(str(uuid.uuid4()))
        assert status["status"] == "unknown"
