import time
import uuid
from collections.abc import AsyncGenerator
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.schema import Agent, AgentExecution, AgentSchedule
from ..schemas.agent import AgentCreate, AgentExecute, AgentUpdate
from ..utils.sanitize import sanitize_text
from .llm_service import llm_service


class AgentService:
    async def register_agent(self, dto: AgentCreate, tenant_id: str | None, user_id: str | None, db: AsyncSession) -> Agent:
        agent = Agent(
            name=sanitize_text(dto.name),
            description=sanitize_text(dto.description),
            category=sanitize_text(dto.category),
            config=dto.config or {},
            user_id=uuid.UUID(user_id) if user_id else None,
            tenant_id=uuid.UUID(tenant_id) if tenant_id else None,
            status="active",
        )
        db.add(agent)
        await db.flush()
        await db.refresh(agent)
        return agent

    async def list_agents(
        self, db: AsyncSession, page: int, page_size: int, tenant_id: str | None,
        category: str | None = None, active: bool | None = None, search: str | None = None,
    ) -> tuple[list[Agent], int]:
        status_filter = Agent.status == "active" if active is not False else Agent.status.in_(["active", "inactive", "IDLE"])
        stmt = select(Agent).where(status_filter)
        count_stmt = select(func.count(Agent.id)).where(status_filter)

        if tenant_id:
            stmt = stmt.where(Agent.tenant_id == uuid.UUID(tenant_id))
            count_stmt = count_stmt.where(Agent.tenant_id == uuid.UUID(tenant_id))
        if category:
            stmt = stmt.where(Agent.category == category)
            count_stmt = count_stmt.where(Agent.category == category)
        if search:
            search_filter = or_(
                Agent.name.ilike(f"%{search}%"),
                Agent.description.ilike(f"%{search}%"),
            )
            stmt = stmt.where(search_filter)
            count_stmt = count_stmt.where(search_filter)

        stmt = stmt.order_by(Agent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        agents = list(result.scalars().all())
        return agents, total

    async def get_agent(self, db: AsyncSession, agent_id: uuid.UUID, tenant_id: str | None) -> Agent | None:
        stmt = select(Agent).where(Agent.id == agent_id)
        if tenant_id:
            stmt = stmt.where(Agent.tenant_id == uuid.UUID(tenant_id))
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def update_agent(self, agent_id: uuid.UUID, dto: AgentUpdate, db: AsyncSession) -> Agent | None:
        agent = await self.get_agent(db, agent_id, None)
        if not agent:
            return None
        if dto.name is not None:
            agent.name = sanitize_text(dto.name)
        if dto.description is not None:
            agent.description = sanitize_text(dto.description)
        if dto.config is not None:
            agent.config = dto.config
        if dto.status is not None:
            agent.status = dto.status
        agent.updated_at = datetime.now(UTC)
        await db.flush()
        await db.refresh(agent)
        return agent

    async def deactivate_agent(self, agent_id: uuid.UUID, db: AsyncSession) -> bool:
        stmt = select(Agent).where(Agent.id == agent_id)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()
        if not agent:
            return False
        agent.status = "inactive"
        agent.updated_at = datetime.now(UTC)
        await db.flush()
        return True

    async def schedule_agent(self, agent_id: uuid.UUID, cron: str, input: dict | None, enabled: bool, db: AsyncSession) -> AgentSchedule:
        schedule = AgentSchedule(
            agent_id=agent_id,
            cron=cron,
            input=input or {},
            enabled=enabled,
        )
        db.add(schedule)
        await db.flush()
        await db.refresh(schedule)
        return schedule

    async def execute_agent(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID,
        dto: AgentExecute,
        tenant_id: str | None,
        user_id: str | None,
    ) -> AgentExecution:
        agent = await self.get_agent(db, agent_id, tenant_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found or inactive")

        execution = AgentExecution(
            id=uuid.uuid4(),
            agent_id=agent_id,
            status="running",
            input=dto.input,
            tenant_id=tenant_id,
            user_id=user_id,
            started_at=datetime.now(UTC),
        )
        db.add(execution)
        await db.flush()

        try:
            config = agent.config or {}
            system_prompt = config.get("system_prompt", f"You are {agent.name}, an AI agent.")
            tools = config.get("tools", [])

            messages = [{"role": "system", "content": system_prompt}]
            messages.append({"role": "user", "content": dto.input.get("text", str(dto.input))})

            start = time.monotonic()
            model = config.get("model")
            temperature = config.get("temperature", 0.7)
            # Resolve workspace_id for BYOK: prefer agent.workspace_id, then dto.input
            workspace_id_ctx = None
            if agent.workspace_id:
                workspace_id_ctx = str(agent.workspace_id)
            else:
                workspace_id_ctx = dto.input.get("workspace_id") or dto.input.get("workspaceId")

            if tools:
                response = await llm_service.generate_completion_with_tools(
                    messages=messages, tools=tools, model=model, temperature=temperature,
                    user_id=user_id, workspace_id=workspace_id_ctx, db=db
                )
            else:
                response = await llm_service.generate_completion(
                    messages=messages, model=model, temperature=temperature,
                    user_id=user_id, workspace_id=workspace_id_ctx, db=db,
                    agent_name=agent.name, task_type=config.get("task_type", "general")
                )

            duration = int((time.monotonic() - start) * 1000)
            usage = response.get("usage", {})
            input_tokens = usage.get("input_tokens", 0) or usage.get("prompt_tokens", 0)
            output_tokens = usage.get("output_tokens", 0) or usage.get("completion_tokens", 0)
            tokens_used = input_tokens + output_tokens

            input_cost_per_1k = config.get("input_cost_per_1k", 0.003)
            output_cost_per_1k = config.get("output_cost_per_1k", 0.015)
            cost = (input_tokens / 1000) * input_cost_per_1k + (output_tokens / 1000) * output_cost_per_1k

            execution.status = "completed"
            execution.output = {
                "content": response.get("content", ""),
                "finish_reason": response.get("finish_reason"),
                "tool_calls": response.get("tool_calls", []),
            }
            execution.tokens_used = tokens_used
            execution.cost = round(cost, 6)
            execution.duration_ms = duration
            execution.completed_at = datetime.now(UTC)

        except Exception as e:
            execution.status = "failed"
            execution.error = str(e)
            execution.completed_at = datetime.now(UTC)

        await db.flush()
        await db.refresh(execution)
        return execution

    async def execute_agent_stream(
        self,
        db: AsyncSession,
        agent_id: uuid.UUID,
        dto: AgentExecute,
        tenant_id: str | None,
        user_id: str | None,
    ) -> AsyncGenerator[dict[str, Any], None]:
        agent = await self.get_agent(db, agent_id, tenant_id)
        if not agent:
            raise ValueError(f"Agent {agent_id} not found or inactive")

        config = agent.config or {}
        system_prompt = config.get("system_prompt", f"You are {agent.name}, an AI agent.")

        messages = [{"role": "system", "content": system_prompt}]
        messages.append({"role": "user", "content": dto.input.get("text", str(dto.input))})

        model = config.get("model")
        temperature = config.get("temperature", 0.7)
        workspace_id_ctx = None
        if agent.workspace_id:
            workspace_id_ctx = str(agent.workspace_id)
        else:
            workspace_id_ctx = dto.input.get("workspace_id") or dto.input.get("workspaceId")

        full_content = ""
        async for chunk in llm_service.generate_completion_stream(
            messages=messages, model=model, temperature=temperature,
            user_id=user_id, workspace_id=workspace_id_ctx, db=db
        ):
            if chunk["type"] == "content":
                full_content += chunk["text"]
                yield {"type": "content", "text": chunk["text"]}
            elif chunk["type"] == "done":
                yield {"type": "done", "finish_reason": chunk.get("finish_reason")}

    async def list_executions(
        self, db: AsyncSession, agent_id: uuid.UUID, page: int, page_size: int,
        tenant_id: str | None, status: str | None = None,
    ) -> tuple[list[AgentExecution], int]:
        stmt = select(AgentExecution).where(AgentExecution.agent_id == agent_id)
        count_stmt = select(func.count(AgentExecution.id)).where(AgentExecution.agent_id == agent_id)

        if tenant_id:
            stmt = stmt.where(AgentExecution.tenant_id == tenant_id)
            count_stmt = count_stmt.where(AgentExecution.tenant_id == tenant_id)
        if status:
            stmt = stmt.where(AgentExecution.status == status)
            count_stmt = count_stmt.where(AgentExecution.status == status)

        stmt = stmt.order_by(AgentExecution.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        executions = list(result.scalars().all())
        return executions, total


agent_service = AgentService()
