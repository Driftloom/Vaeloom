from typing import AsyncGenerator

import jwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from .config import settings
from .database import get_db as _get_db
from .services.llm_service import LLMService, llm_service as _llm_service


async def get_settings() -> dict:
    return settings.model_dump()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async for session in _get_db():
        yield session


async def get_current_user(request: Request) -> dict | None:
    return getattr(request.state, "user", None)


async def get_tenant_id(request: Request) -> str | None:
    return getattr(request.state, "tenant_id", None)


async def get_llm_service() -> LLMService:
    return _llm_service


def require_role(role: str):
    async def role_checker(current_user: dict | None = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        user_roles = current_user.get("roles", []) or current_user.get("realm_access", {}).get("roles", [])
        if role not in user_roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {role}")
        return current_user
    return role_checker
