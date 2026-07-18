import uuid
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.agent import Agent
from ..models.execution import AgentExecution
from ..schemas.agent import AgentExecute
from .llm_service import llm_service, LLMProviderError


class AgentService:
    async def list_agents(
        self, db: AsyncSession, page: int, page_size: int, tenant_id: str | None, category: str | None = None
    ) -> tuple[list[Agent], int]:
        stmt = select(Agent).where(Agent.status == "active")
        count_stmt = select(func.count(Agent.id)).where(Agent.status == "active")

        if tenant_id:
            stmt = stmt.where(Agent.tenant_id == tenant_id)
            count_stmt = count_stmt.where(Agent.tenant_id == tenant_id)
        if category:
            stmt = stmt.where(Agent.category == category)
            count_stmt = count_stmt.where(Agent.category == category)

        stmt = stmt.order_by(Agent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        agents = list(result.scalars().all())
        return agents, total

    async def get_agent(self, db: AsyncSession, agent_id: uuid.UUID, tenant_id: str | None) -> Agent | None:
        stmt = select(Agent).where(Agent.id == agent_id, Agent.status == "active")
        if tenant_id:
            stmt = stmt.where(Agent.tenant_id == tenant_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

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
            started_at=datetime.now(timezone.utc),
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

            if tools:
                response = await llm_service.generate_completion_with_tools(
                    messages=messages, tools=tools, model=model, temperature=temperature
                )
            else:
                response = await llm_service.generate_completion(
                    messages=messages, model=model, temperature=temperature
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
            execution.completed_at = datetime.now(timezone.utc)

        except Exception as e:
            execution.status = "failed"
            execution.error = str(e)
            execution.completed_at = datetime.now(timezone.utc)

        await db.flush()
        return execution

    async def list_executions(
        self, db: AsyncSession, agent_id: uuid.UUID, page: int, page_size: int, tenant_id: str | None
    ) -> tuple[list[AgentExecution], int]:
        stmt = select(AgentExecution).where(AgentExecution.agent_id == agent_id)
        count_stmt = select(func.count(AgentExecution.id)).where(AgentExecution.agent_id == agent_id)

        if tenant_id:
            stmt = stmt.where(AgentExecution.tenant_id == tenant_id)
            count_stmt = count_stmt.where(AgentExecution.tenant_id == tenant_id)

        stmt = stmt.order_by(AgentExecution.created_at.desc()).offset((page - 1) * page_size).limit(page_size)

        total_result = await db.execute(count_stmt)
        total = total_result.scalar_one()

        result = await db.execute(stmt)
        executions = list(result.scalars().all())
        return executions, total


agent_service = AgentService()
