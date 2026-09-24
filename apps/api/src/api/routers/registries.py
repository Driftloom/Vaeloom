"""Enterprise Dynamic Registries Router.

Admin & workspace CRUD endpoints for:
- Tool Registry
- Model & Provider Registry
- Policy Registry
- Prompt Versions
- Evaluation Records
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user, get_tenant_id
from ..models.registries import (
    EvaluationEntry,
    ModelProviderEntry,
    PolicyEntry,
    PromptVersionEntry,
    ToolRegistryEntry,
)
from ..schemas.registries import (
    EvaluationRecordCreate,
    EvaluationRecordResponse,
    ModelProviderCreate,
    ModelProviderResponse,
    ModelProviderUpdate,
    PolicyCreate,
    PolicyResponse,
    PromptVersionCreate,
    PromptVersionResponse,
    ToolRegistryCreate,
    ToolRegistryResponse,
    ToolRegistryUpdate,
)

router = APIRouter(prefix="/registries", tags=["Registries"])


# ── Tool Registry Endpoints ────────────────────────────────────────

@router.get("/tools", response_model=list[ToolRegistryResponse])
async def list_tools(
    workspace_id: uuid.UUID | None = Query(None),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.is_active == is_active)
    if workspace_id:
        stmt = stmt.where((ToolRegistryEntry.workspace_id == workspace_id) | (ToolRegistryEntry.workspace_id.is_(None)))
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/tools", response_model=ToolRegistryResponse, status_code=status.HTTP_201_CREATED)
async def register_tool(
    payload: ToolRegistryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID | None = Depends(get_tenant_id),
):
    entry = ToolRegistryEntry(
        **payload.model_dump(exclude_unset=True),
        tenant_id=tenant_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/tools/{tool_id}", response_model=ToolRegistryResponse)
async def get_tool(
    tool_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.tool_id == tool_id)
    res = await db.execute(stmt)
    entry = res.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found in registry")
    return entry


@router.put("/tools/{tool_id}", response_model=ToolRegistryResponse)
async def update_tool(
    tool_id: str,
    payload: ToolRegistryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ToolRegistryEntry).where(ToolRegistryEntry.tool_id == tool_id)
    res = await db.execute(stmt)
    entry = res.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Tool {tool_id} not found")
    
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
        
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Model Registry Endpoints ───────────────────────────────────────

@router.get("/models", response_model=list[ModelProviderResponse])
async def list_models(
    tier: str | None = Query(None),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ModelProviderEntry).where(ModelProviderEntry.is_active == is_active)
    if tier:
        stmt = stmt.where(ModelProviderEntry.tier == tier)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/models", response_model=ModelProviderResponse, status_code=status.HTTP_201_CREATED)
async def register_model(
    payload: ModelProviderCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID | None = Depends(get_tenant_id),
):
    entry = ModelProviderEntry(
        **payload.model_dump(exclude_unset=True),
        tenant_id=tenant_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.get("/models/{model_id}", response_model=ModelProviderResponse)
async def get_model(
    model_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ModelProviderEntry).where(ModelProviderEntry.model_id == model_id)
    res = await db.execute(stmt)
    entry = res.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    return entry


@router.put("/models/{model_id}", response_model=ModelProviderResponse)
async def update_model(
    model_id: str,
    payload: ModelProviderUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(ModelProviderEntry).where(ModelProviderEntry.model_id == model_id)
    res = await db.execute(stmt)
    entry = res.scalars().first()
    if not entry:
        raise HTTPException(status_code=404, detail=f"Model {model_id} not found")
    
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(entry, k, v)
        
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Policy Registry Endpoints ──────────────────────────────────────

@router.get("/policies", response_model=list[PolicyResponse])
async def list_policies(
    scope: str | None = Query(None),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(PolicyEntry).where(PolicyEntry.is_active == is_active)
    if scope:
        stmt = stmt.where(PolicyEntry.scope == scope)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/policies", response_model=PolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    payload: PolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID | None = Depends(get_tenant_id),
):
    entry = PolicyEntry(
        **payload.model_dump(exclude_unset=True),
        tenant_id=tenant_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Prompt Versions Endpoints ──────────────────────────────────────

@router.get("/prompts", response_model=list[PromptVersionResponse])
async def list_prompts(
    agent_scope: str | None = Query(None),
    is_active: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(PromptVersionEntry).where(PromptVersionEntry.is_active == is_active)
    if agent_scope:
        stmt = stmt.where(PromptVersionEntry.agent_scope == agent_scope)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/prompts", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_prompt_version(
    payload: PromptVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID | None = Depends(get_tenant_id),
):
    entry = PromptVersionEntry(
        **payload.model_dump(exclude_unset=True),
        tenant_id=tenant_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


# ── Evaluation Records Endpoints ───────────────────────────────────

@router.get("/evaluations", response_model=list[EvaluationRecordResponse])
async def list_evaluations(
    agent_name: str | None = Query(None),
    verdict: str | None = Query(None),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    stmt = select(EvaluationEntry).order_by(EvaluationEntry.created_at.desc()).limit(limit)
    if agent_name:
        stmt = stmt.where(EvaluationEntry.agent_name == agent_name)
    if verdict:
        stmt = stmt.where(EvaluationEntry.verdict == verdict)
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/evaluations", response_model=EvaluationRecordResponse, status_code=status.HTTP_201_CREATED)
async def record_evaluation(
    payload: EvaluationRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    tenant_id: uuid.UUID | None = Depends(get_tenant_id),
):
    entry = EvaluationEntry(
        **payload.model_dump(exclude_unset=True),
        tenant_id=tenant_id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry
