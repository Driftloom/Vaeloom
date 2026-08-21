import asyncio
import contextlib
import json
import os
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PluginService:
    @staticmethod
    def _fix_json_fields(row_dict):
        if row_dict is None:
            return None
        for key in ('permissions', 'config_schema', 'output', 'capabilities', 'hooks', 'tags'):
            val = row_dict.get(key)
            if isinstance(val, str):
                with contextlib.suppress(json.JSONDecodeError, TypeError):
                    row_dict[key] = json.loads(val)
        return row_dict

    async def register(self, dto, tenant_id: str | None, db: AsyncSession):
        plugin_id = uuid.uuid4()
        now = datetime.now(UTC)
        permissions_json = json.dumps(dto.permissions.model_dump() if hasattr(dto.permissions, "model_dump") else dto.permissions)
        f"{{{','.join(f'\"{t}\"' for t in dto.tags)}}}" if dto.tags else "{}"
        f"{{{','.join(f'\"{c}\"' for c in dto.capabilities)}}}" if dto.capabilities else "{}"
        f"{{{','.join(f'\"{h}\"' for h in dto.hooks)}}}" if dto.hooks else "{}"

        stmt = text("""
            INSERT INTO plugins (id, name, version, author, description, license, status, permissions, capabilities, hooks, tags, entry_point, tenant_id, homepage, repository, icon, config_schema, code, min_app_version, created_at, updated_at)
            VALUES (:id, :name, :version, :author, :description, :license, 'REGISTERED', :permissions, :capabilities, :hooks, :tags, :entry_point, :tenant_id, :homepage, :repository, :icon, :config_schema, :code, :min_app_version, :created_at, :updated_at)
            RETURNING id, name, version, author, description, license, status, permissions, capabilities, hooks, tags, entry_point, tenant_id, homepage, repository, icon, config_schema, code, min_app_version, created_at, updated_at
        """)
        result = await db.execute(stmt, {
            "id": plugin_id,
            "name": dto.name,
            "version": dto.version,
            "author": dto.author,
            "description": dto.description,
            "license": dto.license,
            "min_app_version": dto.min_app_version,
            "permissions": permissions_json,
            "capabilities": dto.capabilities or [],
            "hooks": dto.hooks or [],
            "tags": dto.tags,
            "entry_point": dto.entry_point,
            "tenant_id": tenant_id,
            "homepage": dto.homepage,
            "repository": dto.repository,
            "icon": dto.icon,
            "config_schema": json.dumps(dto.config_schema) if dto.config_schema else None,
            "code": dto.code,
            "created_at": now,
            "updated_at": now,
        })
        row = result.mappings().first()
        return PluginService._fix_json_fields(dict(row)) if row else None

    async def list_plugins(self, page: int, page_size: int, status: str | None, tags: list[str] | None, search: str | None, tenant_id: str | None, db: AsyncSession):
        conditions = ["1=1"]
        params = {}

        if tenant_id:
            conditions.append("p.tenant_id = :tenant_id")
            params["tenant_id"] = tenant_id
        if status:
            conditions.append("p.status = :status")
            params["status"] = status
        if tags:
            conditions.append("p.tags && :tags")
            params["tags"] = tags
        if search:
            conditions.append("(p.name ILIKE :search OR p.description ILIKE :search OR p.author ILIKE :search)")
            params["search"] = f"%{search}%"

        where_clause = " AND ".join(conditions)

        count_sql = text(f"SELECT COUNT(*) FROM plugins p WHERE {where_clause}")
        count_result = await db.execute(count_sql, params)
        total = count_result.scalar_one()

        offset = (page - 1) * page_size
        data_sql = text(f"""
            SELECT p.id, p.name, p.version, p.author, p.description, p.license, p.status,
                   p.permissions, p.capabilities, p.hooks, p.tags, p.entry_point,
                   p.tenant_id, p.homepage, p.repository, p.icon, p.config_schema, p.code,
                   p.min_app_version, p.created_at, p.updated_at
            FROM plugins p
            WHERE {where_clause}
            ORDER BY p.created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        params["limit"] = page_size
        params["offset"] = offset
        data_result = await db.execute(data_sql, params)
        rows = data_result.mappings().all()
        return [PluginService._fix_json_fields(dict(r)) for r in rows], total

    async def get_plugin(self, plugin_id: uuid.UUID, db: AsyncSession):
        stmt = text("""
            SELECT id, name, version, author, description, license, status,
                   permissions, capabilities, hooks, tags, entry_point,
                   tenant_id, homepage, repository, icon, config_schema, code,
                   min_app_version, created_at, updated_at
            FROM plugins WHERE id = :id
        """)
        result = await db.execute(stmt, {"id": plugin_id})
        row = result.mappings().first()
        return PluginService._fix_json_fields(dict(row)) if row else None

    async def update_plugin(self, plugin_id: uuid.UUID, dto, db: AsyncSession):
        sets = []
        params = {"id": plugin_id}

        if dto.version is not None:
            sets.append("version = :version")
            params["version"] = dto.version
        if dto.description is not None:
            sets.append("description = :description")
            params["description"] = dto.description
        if dto.entry_point is not None:
            sets.append("entry_point = :entry_point")
            params["entry_point"] = dto.entry_point
        if dto.permissions is not None:
            sets.append("permissions = :permissions")
            perms = dto.permissions.model_dump() if hasattr(dto.permissions, "model_dump") else dto.permissions
            params["permissions"] = json.dumps(perms)
        if dto.capabilities is not None:
            sets.append("capabilities = :capabilities")
            params["capabilities"] = dto.capabilities
        if dto.hooks is not None:
            sets.append("hooks = :hooks")
            params["hooks"] = dto.hooks
        if dto.tags is not None:
            sets.append("tags = :tags")
            params["tags"] = dto.tags
        if dto.status is not None:
            sets.append("status = :status")
            params["status"] = dto.status.value if hasattr(dto.status, "value") else dto.status

        if not sets:
            return await self.get_plugin(plugin_id, db)

        sets.append("updated_at = :updated_at")
        params["updated_at"] = datetime.now(UTC)

        stmt = text(f"""
            UPDATE plugins SET {', '.join(sets)}
            WHERE id = :id
            RETURNING id, name, version, author, description, license, status,
                      permissions, capabilities, hooks, tags, entry_point,
                      tenant_id, homepage, repository, icon, config_schema, code,
                      min_app_version, created_at, updated_at
        """)
        result = await db.execute(stmt, params)
        row = result.mappings().first()
        return PluginService._fix_json_fields(dict(row)) if row else None

    async def delete_plugin(self, plugin_id: uuid.UUID, db: AsyncSession):
        stmt = text("DELETE FROM plugins WHERE id = :id")
        result = await db.execute(stmt, {"id": plugin_id})
        return result.rowcount > 0

    async def get_permissions(self, plugin_id: uuid.UUID, db: AsyncSession):
        stmt = text("SELECT permissions FROM plugins WHERE id = :id")
        result = await db.execute(stmt, {"id": plugin_id})
        row = result.mappings().first()
        if row is None:
            return None
        val = row["permissions"]
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                pass
        return val

    async def execute(self, plugin_id: uuid.UUID, dto, db: AsyncSession):
        plugin = await self.get_plugin(plugin_id, db)
        if not plugin:
            raise HTTPException(status_code=404, detail="Plugin not found")
        if plugin["status"] == "DISABLED":
            raise HTTPException(status_code=403, detail="Plugin is disabled")

        code = dto.code or plugin["code"]
        if not code:
            raise HTTPException(status_code=400, detail="No code to execute")

        execution_id = uuid.uuid4()
        permissions = plugin.get("permissions", {})
        sandbox_context = {
            "input": dto.input or {},
            "tenantId": plugin.get("tenant_id"),
            "pluginId": str(plugin_id),
            "permissions": permissions,
        }

        start = time.monotonic()
        status = "completed"
        output = None
        error_message = None
        timeout_ms = dto.timeout_ms or 5000

        try:
            sandbox_script = Path(__file__).resolve().parent / "plugin_sandbox.py"

            env = os.environ.copy()
            env["PLUGIN_CONTEXT"] = json.dumps(sandbox_context)
            env["PYTHONSAFEPATH"] = "1"
            for key in list(env):
                if key.upper() in ("HTTP_PROXY", "HTTPS_PROXY", "PYTHONPATH", "PYTHONHOME"):
                    del env[key]

            proc = await asyncio.create_subprocess_exec(
                sys.executable, str(sandbox_script),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    proc.communicate(code.encode("utf-8")),
                    timeout=timeout_ms / 1000,
                )
            except TimeoutError:
                proc.kill()
                await proc.wait()
                status = "failed"
                error_message = f"Execution timed out after {timeout_ms}ms"
            else:
                if proc.returncode != 0:
                    status = "failed"
                    error_message = (stderr.decode("utf-8").strip()
                                     or f"Process exited with code {proc.returncode}")
                else:
                    result_data = json.loads(stdout.decode("utf-8"))
                    if result_data.get("success"):
                        output = result_data.get("output")
                    else:
                        status = "failed"
                        error_message = result_data.get("error", "Unknown error")
        except Exception as e:
            status = "failed"
            error_message = f"{type(e).__name__}: {str(e)}"

        duration = int((time.monotonic() - start) * 1000)

        exec_stmt = text("""
            INSERT INTO plugin_executions (id, plugin_id, status, duration_ms, output, error_message, created_at)
            VALUES (:id, :plugin_id, :status, :duration_ms, :output, :error_message, :created_at)
            RETURNING id, plugin_id, status, duration_ms, output, error_message, created_at
        """)
        exec_result = await db.execute(exec_stmt, {
            "id": execution_id,
            "plugin_id": plugin_id,
            "status": status,
            "duration_ms": duration,
            "output": json.dumps(output) if output else None,
            "error_message": error_message,
            "created_at": datetime.now(UTC),
        })
        row = exec_result.mappings().first()
        return PluginService._fix_json_fields(dict(row)) if row else None

    async def list_executions(self, plugin_id: uuid.UUID, page: int, page_size: int, db: AsyncSession):
        offset = (page - 1) * page_size
        count_stmt = text("SELECT COUNT(*) FROM plugin_executions WHERE plugin_id = :plugin_id")
        count_result = await db.execute(count_stmt, {"plugin_id": plugin_id})
        total = count_result.scalar_one()

        stmt = text("""
            SELECT id, plugin_id, status, duration_ms, output, error_message, created_at
            FROM plugin_executions
            WHERE plugin_id = :plugin_id
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        """)
        result = await db.execute(stmt, {"plugin_id": plugin_id, "limit": page_size, "offset": offset})
        rows = result.mappings().all()
        return [PluginService._fix_json_fields(dict(r)) for r in rows], total


plugin_service = PluginService()
