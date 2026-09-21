import uuid
import logging
from typing import Any
from datetime import datetime, timezone

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException

from ..models.schema import Folder, Document

logger = logging.getLogger(__name__)

MAX_FOLDER_DEPTH = 10


class FolderService:
    async def create_folder(
        self,
        workspace_id: str | uuid.UUID,
        name: str,
        parent_id: str | uuid.UUID | None,
        user_id: str | uuid.UUID | None,
        db: AsyncSession,
    ) -> Folder:
        ws_id = uuid.UUID(str(workspace_id))
        clean_name = name.strip()
        if not clean_name:
            raise HTTPException(status_code=400, detail="Folder name cannot be empty")
        if "/" in clean_name or "\\" in clean_name:
            raise HTTPException(status_code=400, detail="Folder name cannot contain path separators")

        p_id = uuid.UUID(str(parent_id)) if parent_id else None

        if p_id:
            parent = await self.get_folder(p_id, ws_id, db)
            # Verify depth
            depth = await self._calculate_depth(p_id, db)
            if depth >= MAX_FOLDER_DEPTH:
                raise HTTPException(
                    status_code=400,
                    detail=f"Maximum folder nesting depth of {MAX_FOLDER_DEPTH} exceeded",
                )

            # Check duplicate name in same parent
            dup_stmt = select(Folder).where(
                Folder.workspace_id == ws_id,
                Folder.parent_id == p_id,
                Folder.name == clean_name,
            )
            dup = (await db.execute(dup_stmt)).scalar_one_or_none()
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail=f"Folder '{clean_name}' already exists in this directory",
                )
        else:
            # Check duplicate name in root
            dup_stmt = select(Folder).where(
                Folder.workspace_id == ws_id,
                Folder.parent_id.is_(None),
                Folder.name == clean_name,
            )
            dup = (await db.execute(dup_stmt)).scalar_one_or_none()
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail=f"Folder '{clean_name}' already exists at root",
                )

        u_id = uuid.UUID(str(user_id)) if user_id else None
        folder = Folder(
            id=uuid.uuid4(),
            workspace_id=ws_id,
            parent_id=p_id,
            name=clean_name,
            created_by=u_id,
        )
        db.add(folder)
        await db.commit()
        await db.refresh(folder)
        return folder

    async def get_folder(
        self,
        folder_id: str | uuid.UUID,
        workspace_id: str | uuid.UUID,
        db: AsyncSession,
    ) -> Folder:
        f_id = uuid.UUID(str(folder_id))
        ws_id = uuid.UUID(str(workspace_id))
        stmt = select(Folder).where(Folder.id == f_id, Folder.workspace_id == ws_id)
        folder = (await db.execute(stmt)).scalar_one_or_none()
        if not folder:
            raise HTTPException(status_code=404, detail="Folder not found")
        return folder

    async def list_folders(
        self,
        workspace_id: str | uuid.UUID,
        parent_id: str | uuid.UUID | None,
        db: AsyncSession,
    ) -> list[Folder]:
        ws_id = uuid.UUID(str(workspace_id))
        stmt = select(Folder).where(Folder.workspace_id == ws_id)
        if parent_id is not None:
            if str(parent_id).lower() == "root":
                stmt = stmt.where(Folder.parent_id.is_(None))
            else:
                stmt = stmt.where(Folder.parent_id == uuid.UUID(str(parent_id)))
        stmt = stmt.order_by(Folder.name.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_folder_tree(
        self,
        workspace_id: str | uuid.UUID,
        db: AsyncSession,
    ) -> list[dict[str, Any]]:
        ws_id = uuid.UUID(str(workspace_id))
        stmt = select(Folder).where(Folder.workspace_id == ws_id).order_by(Folder.name.asc())
        all_folders = list((await db.execute(stmt)).scalars().all())

        # Build adjacency list
        by_id: dict[uuid.UUID, dict[str, Any]] = {}
        roots: list[dict[str, Any]] = []

        for f in all_folders:
            by_id[f.id] = {
                "id": str(f.id),
                "workspace_id": str(f.workspace_id),
                "parent_id": str(f.parent_id) if f.parent_id else None,
                "name": f.name,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "children": [],
            }

        for f in all_folders:
            node = by_id[f.id]
            if f.parent_id and f.parent_id in by_id:
                by_id[f.parent_id]["children"].append(node)
            else:
                roots.append(node)

        return roots

    async def update_folder(
        self,
        folder_id: str | uuid.UUID,
        workspace_id: str | uuid.UUID,
        name: str | None,
        parent_id: str | uuid.UUID | None,
        db: AsyncSession,
    ) -> Folder:
        folder = await self.get_folder(folder_id, workspace_id, db)
        ws_id = uuid.UUID(str(workspace_id))

        if name is not None:
            clean_name = name.strip()
            if not clean_name:
                raise HTTPException(status_code=400, detail="Folder name cannot be empty")
            if "/" in clean_name or "\\" in clean_name:
                raise HTTPException(status_code=400, detail="Folder name cannot contain path separators")
            folder.name = clean_name

        if parent_id is not None:
            if str(parent_id).lower() in ("null", "none", ""):
                folder.parent_id = None
            else:
                target_p_id = uuid.UUID(str(parent_id))
                if target_p_id == folder.id:
                    raise HTTPException(status_code=400, detail="Folder cannot be its own parent")

                # Cycle check: target parent must not be a descendant of folder
                if await self._is_descendant(folder.id, target_p_id, db):
                    raise HTTPException(
                        status_code=400,
                        detail="Cannot move folder into one of its own subfolders (circular reference)",
                    )

                # Verify target parent exists in same workspace
                await self.get_folder(target_p_id, ws_id, db)
                folder.parent_id = target_p_id

        folder.updated_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(folder)
        return folder

    async def delete_folder(
        self,
        folder_id: str | uuid.UUID,
        workspace_id: str | uuid.UUID,
        db: AsyncSession,
    ) -> None:
        folder = await self.get_folder(folder_id, workspace_id, db)
        await db.delete(folder)
        await db.commit()

    async def _calculate_depth(self, folder_id: uuid.UUID, db: AsyncSession) -> int:
        depth = 1
        curr_id = folder_id
        while curr_id:
            stmt = select(Folder.parent_id).where(Folder.id == curr_id)
            parent_id = (await db.execute(stmt)).scalar_one_or_none()
            if not parent_id:
                break
            depth += 1
            curr_id = parent_id
            if depth > MAX_FOLDER_DEPTH:
                break
        return depth

    async def _is_descendant(
        self,
        ancestor_id: uuid.UUID,
        candidate_id: uuid.UUID,
        db: AsyncSession,
    ) -> bool:
        curr_id = candidate_id
        visited = set()
        while curr_id:
            if curr_id == ancestor_id:
                return True
            if curr_id in visited:
                break
            visited.add(curr_id)
            stmt = select(Folder.parent_id).where(Folder.id == curr_id)
            curr_id = (await db.execute(stmt)).scalar_one_or_none()
        return False


folder_service = FolderService()
