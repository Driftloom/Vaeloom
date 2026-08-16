import uuid
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import text


class IamService:
    async def create_user(self, dto, db=None) -> dict:
        user_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc)
        await db.execute(
            text("""
                INSERT INTO iam_users (id, email, display_name, tenant_id, active, created_at, updated_at)
                VALUES (:id, :email, :display_name, :tenant_id, TRUE, :now, :now)
            """),
            {
                "id": user_id,
                "email": dto.email,
                "display_name": dto.display_name,
                "tenant_id": dto.tenant_id,
                "now": now,
            },
        )

        if dto.role_ids:
            for role_id in dto.role_ids:
                await db.execute(
                    text("""
                        INSERT INTO iam_user_roles (user_id, role_id)
                        VALUES (:user_id, :role_id)
                        ON CONFLICT DO NOTHING
                    """),
                    {"user_id": user_id, "role_id": role_id},
                )

        return await self.get_user(user_id, db=db)

    async def list_users(self, page: int, page_size: int, tenant_id: str, db=None) -> tuple[list[dict], int]:
        offset = (page - 1) * page_size

        count_result = await db.execute(
            text("SELECT COUNT(*) FROM iam_users WHERE tenant_id = :tenant_id"),
            {"tenant_id": tenant_id},
        )
        total = count_result.scalar_one() or 0

        rows_result = await db.execute(
            text("""
                SELECT id, email, display_name, tenant_id, active, created_at, updated_at
                FROM iam_users
                WHERE tenant_id = :tenant_id
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {"tenant_id": tenant_id, "limit": page_size, "offset": offset},
        )
        rows = rows_result.fetchall()

        users = []
        for r in rows:
            users.append({
                "id": r[0],
                "email": r[1],
                "display_name": r[2],
                "tenant_id": r[3],
                "active": r[4],
                "created_at": r[5],
                "updated_at": r[6],
                "roles": await self._get_user_roles(r[0], db=db),
            })

        return users, total

    async def get_user(self, user_id: str, db=None) -> dict | None:
        result = await db.execute(
            text("""
                SELECT id, email, display_name, tenant_id, active, created_at, updated_at
                FROM iam_users WHERE id = :id
            """),
            {"id": user_id},
        )
        r = result.fetchone()
        if not r:
            return None

        roles = await self._get_user_roles(user_id, db=db)
        return {
            "id": r[0],
            "email": r[1],
            "display_name": r[2],
            "tenant_id": r[3],
            "active": r[4],
            "created_at": r[5],
            "updated_at": r[6],
            "roles": roles,
        }

    async def update_user(self, user_id: str, dto, db=None) -> dict | None:
        existing = await self.get_user(user_id, db=db)
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        sets = []
        params: dict = {"id": user_id}
        if dto.display_name is not None:
            sets.append("display_name = :display_name")
            params["display_name"] = dto.display_name
        if dto.email is not None:
            sets.append("email = :email")
            params["email"] = dto.email
        if dto.active is not None:
            sets.append("active = :active")
            params["active"] = dto.active

        if sets:
            sets.append("updated_at = :now")
            params["now"] = datetime.now(timezone.utc)
            await db.execute(
                text(f"UPDATE iam_users SET {', '.join(sets)} WHERE id = :id"),
                params,
            )

        return await self.get_user(user_id, db=db)

    async def deactivate_user(self, user_id: str, db=None):
        result = await db.execute(
            text("UPDATE iam_users SET active = FALSE, updated_at = :now WHERE id = :id"),
            {"id": user_id, "now": datetime.now(timezone.utc)},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")

    async def assign_roles(self, user_id: str, role_ids: list[str], db=None):
        existing = await self.get_user(user_id, db=db)
        if not existing:
            raise HTTPException(status_code=404, detail="User not found")

        for role_id in role_ids:
            await db.execute(
                text("""
                    INSERT INTO iam_user_roles (user_id, role_id)
                    VALUES (:user_id, :role_id)
                    ON CONFLICT DO NOTHING
                """),
                {"user_id": user_id, "role_id": role_id},
            )

    async def remove_role(self, user_id: str, role_id: str, db=None):
        result = await db.execute(
            text("DELETE FROM iam_user_roles WHERE user_id = :user_id AND role_id = :role_id"),
            {"user_id": user_id, "role_id": role_id},
        )
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Role assignment not found")

    async def get_permissions(self, user_id: str, db=None) -> list[str]:
        result = await db.execute(
            text("""
                SELECT DISTINCT j.value AS permission
                FROM iam_user_roles ur
                JOIN rbac_roles r ON r.id = ur.role_id
                CROSS JOIN json_each(r.permissions) j
                WHERE ur.user_id = :user_id
            """),
            {"user_id": user_id},
        )
        return [row[0] for row in result.fetchall()]

    async def _get_user_roles(self, user_id: str, db=None) -> list[dict]:
        result = await db.execute(
            text("""
                SELECT r.id, r.name
                FROM iam_user_roles ur
                JOIN rbac_roles r ON r.id = ur.role_id
                WHERE ur.user_id = :user_id
            """),
            {"user_id": user_id},
        )
        return [{"id": row[0], "name": row[1]} for row in result.fetchall()]


iam_service = IamService()
