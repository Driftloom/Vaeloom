import uuid

from sqlalchemy import or_, select

from ..models.schema import Workspace, WorkspaceUser
from ..schemas.workspace import WorkspaceResponse
from ..utils.sanitize import sanitize_text


class WorkspaceService:
    async def create(self, user_id: str, name: str | None = None, db=None):
        workspace = Workspace(
            user_id=uuid.UUID(user_id),
            name=sanitize_text(name) or "New Workspace",
        )
        db.add(workspace)
        await db.flush()
        await db.refresh(workspace)
        return WorkspaceResponse.model_validate(workspace)

    async def list_for_user(self, user_id: str, db=None, limit: int | None = None, offset: int = 0):
        items, _ = await self.list_and_count_for_user(user_id=user_id, db=db, limit=limit, offset=offset)
        return items

    async def list_and_count_for_user(self, user_id: str, db=None, limit: int | None = None, offset: int = 0):
        from sqlalchemy import func
        uid = uuid.UUID(user_id)
        member_subquery = select(WorkspaceUser.workspace_id).where(WorkspaceUser.user_id == uid)
        base = (
            select(Workspace)
            .where(or_(Workspace.user_id == uid, Workspace.id.in_(member_subquery)))
            .distinct()
        )
        count_stmt = select(func.count()).select_from(base.subquery())
        total_res = await db.execute(count_stmt)
        total = total_res.scalar() or 0

        paged_query = base.order_by(Workspace.created_at.desc())
        if offset:
            paged_query = paged_query.offset(offset)
        if limit is not None:
            paged_query = paged_query.limit(limit)

        result = await db.execute(paged_query)
        workspaces = result.scalars().all()
        return [WorkspaceResponse.model_validate(w) for w in workspaces], total

    async def find_by_id(self, workspace_id: str, user_id: str, db=None):
        wid = uuid.UUID(workspace_id)
        uid = uuid.UUID(user_id)
        member_subquery = select(WorkspaceUser.workspace_id).where(
            WorkspaceUser.workspace_id == wid,
            WorkspaceUser.user_id == uid,
        )
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == wid,
                or_(Workspace.user_id == uid, Workspace.id.in_(member_subquery)),
            )
        )
        workspace = result.scalar_one_or_none()
        return WorkspaceResponse.model_validate(workspace) if workspace else None

    async def update(self, workspace_id: str, user_id: str, data: dict, db=None):
        wid = uuid.UUID(workspace_id)
        uid = uuid.UUID(user_id)
        admin_subquery = select(WorkspaceUser.workspace_id).where(
            WorkspaceUser.workspace_id == wid,
            WorkspaceUser.user_id == uid,
            WorkspaceUser.role.in_(["ADMIN", "OWNER"]),
        )
        result = await db.execute(
            select(Workspace).where(
                Workspace.id == wid,
                or_(Workspace.user_id == uid, Workspace.id.in_(admin_subquery)),
            )
        )
        workspace = result.scalar_one_or_none()
        if not workspace:
            return None

        if "name" in data and data["name"] is not None:
            workspace.name = sanitize_text(data["name"])
        if "description" in data:
            workspace.description = sanitize_text(data.get("description"))

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

