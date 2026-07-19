import uuid

from sqlalchemy import select

from ..models.schema import Workspace
from ..schemas.workspace import WorkspaceResponse


class WorkspaceService:
    async def create(self, user_id: str, name: str | None = None, db=None):
        workspace = Workspace(
            user_id=uuid.UUID(user_id),
            name=name or "New Workspace",
        )
        db.add(workspace)
        await db.flush()
        await db.refresh(workspace)
        return WorkspaceResponse.model_validate(workspace)

    async def list_for_user(self, user_id: str, db=None):
        result = await db.execute(
            select(Workspace).where(Workspace.user_id == uuid.UUID(user_id))
            .order_by(Workspace.created_at.desc())
        )
        workspaces = result.scalars().all()
        return [WorkspaceResponse.model_validate(w) for w in workspaces]

    async def find_by_id(self, workspace_id: str, user_id: str, db=None):
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == uuid.UUID(workspace_id),
                Workspace.user_id == uuid.UUID(user_id),
            )
        )
        workspace = result.scalar_one_or_none()
        return WorkspaceResponse.model_validate(workspace) if workspace else None

    async def update(self, workspace_id: str, user_id: str, data: dict, db=None):
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == uuid.UUID(workspace_id),
                Workspace.user_id == uuid.UUID(user_id),
            )
        )
        workspace = result.scalar_one_or_none()
        if not workspace:
            return None

        if "name" in data and data["name"] is not None:
            workspace.name = data["name"]
        if "description" in data:
            workspace.description = data.get("description")

        await db.flush()
        await db.refresh(workspace)
        return WorkspaceResponse.model_validate(workspace)

    async def delete(self, workspace_id: str, user_id: str, db=None):
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == uuid.UUID(workspace_id),
                Workspace.user_id == uuid.UUID(user_id),
            )
        )
        workspace = result.scalar_one_or_none()
        if not workspace:
            return False

        await db.delete(workspace)
        await db.flush()
        return True


workspace_service = WorkspaceService()
