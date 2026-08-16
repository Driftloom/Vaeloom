import uuid

from sqlalchemy import select

from ..models.schema import Permission, Workspace


class PermissionService:
    async def check(
        self,
        user_id: str,
        workspace_id: str,
        action: str | None = None,
        agent_name: str | None = None,
        db=None,
    ) -> bool:
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == uuid.UUID(workspace_id),
                Workspace.user_id == uuid.UUID(user_id),
            )
        )
        workspace = result.scalar_one_or_none()
        if not workspace:
            return False

        if agent_name:
            result = await db.execute(
                select(Permission).where(
                    Permission.workspace_id == uuid.UUID(workspace_id),
                    Permission.agent_name == agent_name,
                    Permission.action_type == (action or "read"),
                    Permission.revoked_at.is_(None),
                )
            )
            permission = result.scalar_one_or_none()
            if not permission:
                return False

        return True


permission_service = PermissionService()
