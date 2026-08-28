import json
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class FeatureFlagCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    enabled: bool = False
    rollout_percentage: int = Field(default=0, ge=0, le=100)
    category: str = "general"


class FeatureFlagUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    enabled: bool | None = None
    rollout_percentage: int | None = Field(default=None, ge=0, le=100)
    category: str | None = None


class FeatureFlagResponse(BaseModel):
    id: str
    workspace_id: str
    name: str
    description: str
    enabled: bool
    rollout_percentage: int
    category: str
    created_at: str
    updated_at: str


class FeatureFlagService:
    async def list_flags(self, workspace_id: str, db: AsyncSession) -> list[dict]:
        result = await db.execute(
            text("SELECT * FROM feature_flags WHERE workspace_id = :wid ORDER BY name"),
            {"wid": workspace_id},
        )
        rows = result.mappings().all()
        return [self._row_to_dict(r) for r in rows]

    async def get_flag(self, flag_id: str, db: AsyncSession) -> dict:
        result = await db.execute(
            text("SELECT * FROM feature_flags WHERE id = :id"),
            {"id": flag_id},
        )
        row = result.mappings().first()
        if not row:
            raise HTTPException(status_code=404, detail="Feature flag not found")
        return self._row_to_dict(row)

    async def create_flag(self, dto: FeatureFlagCreate, workspace_id: str, db: AsyncSession) -> dict:
        flag_id = str(uuid.uuid4())
        now = datetime.now(UTC).isoformat()
        await db.execute(
            text(
                "INSERT INTO feature_flags (id, workspace_id, name, description, enabled, rollout_percentage, category, created_at, updated_at) "
                "VALUES (:id, :wid, :name, :desc, :enabled, :rollout, :cat, :now, :now)"
            ),
            {
                "id": flag_id,
                "wid": workspace_id,
                "name": dto.name,
                "desc": dto.description,
                "enabled": int(dto.enabled),
                "rollout": dto.rollout_percentage,
                "cat": dto.category,
                "now": now,
            },
        )
        return await self.get_flag(flag_id, db)

    async def update_flag(self, flag_id: str, dto: FeatureFlagUpdate, db: AsyncSession) -> dict:
        existing = await self.get_flag(flag_id, db)
        updates = {k: v for k, v in dto.model_dump(exclude_unset=True).items() if v is not None}
        if not updates:
            return existing
        set_parts = []
        params: dict = {"id": flag_id}
        for key, val in updates.items():
            db_key = key
            if key == "enabled":
                val = int(val)
            set_parts.append(f"{db_key} = :{db_key}")
            params[db_key] = val
        set_parts.append("updated_at = :updated_at")
        params["updated_at"] = datetime.now(UTC).isoformat()
        await db.execute(
            text(f"UPDATE feature_flags SET {', '.join(set_parts)} WHERE id = :id"),
            params,
        )
        return await self.get_flag(flag_id, db)

    async def delete_flag(self, flag_id: str, db: AsyncSession) -> None:
        result = await db.execute(
            text("DELETE FROM feature_flags WHERE id = :id"),
            {"id": flag_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Feature flag not found")

    async def toggle_flag(self, flag_id: str, db: AsyncSession) -> dict:
        existing = await self.get_flag(flag_id, db)
        new_enabled = not existing["enabled"]
        new_rollout = 100 if new_enabled else 0
        await db.execute(
            text("UPDATE feature_flags SET enabled = :enabled, rollout_percentage = :rollout, updated_at = :now WHERE id = :id"),
            {"enabled": int(new_enabled), "rollout": new_rollout, "now": datetime.now(UTC).isoformat(), "id": flag_id},
        )
        return await self.get_flag(flag_id, db)

    def _row_to_dict(self, row) -> dict:
        return {
            "id": row["id"],
            "workspace_id": row["workspace_id"],
            "name": row["name"],
            "description": row["description"] or "",
            "enabled": bool(row["enabled"]),
            "rollout_percentage": row["rollout_percentage"],
            "category": row["category"] or "general",
            "created_at": str(row["created_at"]),
            "updated_at": str(row["updated_at"]),
        }


feature_flag_service = FeatureFlagService()
