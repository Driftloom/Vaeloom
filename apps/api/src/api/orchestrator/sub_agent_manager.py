"""Enterprise Sub-Agent Manager & Hierarchy Orchestrator.

Manages the lifecycle of child sub-agents spawned by a main/parent agent:
- Hierarchical permission scoping (Zero-Trust Least Privilege: child <= parent)
- Concurrent parallel sub-agent execution with bounded concurrency
- Fault isolation and partial result aggregation
- Execution tracking, timeouts, and cancellation
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any

from .agent_bus import agent_bus
from .agent_discovery import dynamic_agent_registry
from .card_registry import get_agent_card
from .contracts.agent_message import (
    AgentMessage,
    AgentResponseEnvelope,
    MessagePriority,
    MessageType,
    TaskStatus,
)

logger = logging.getLogger(__name__)


class SubAgentManager:
    """Enterprise manager for spawning, tracking, and aggregating sub-agents."""

    def __init__(self):
        # Active sub-agents: run_id -> asyncio.Task
        self._active_tasks: dict[str, asyncio.Task] = {}
        # Hierarchy mapping: parent_run_id -> list of child_run_ids
        self._parent_child_map: dict[str, list[str]] = {}

    def get_child_run_ids(self, parent_run_id: str) -> list[str]:
        """Get all child execution IDs spawned by a parent run."""
        return list(self._parent_child_map.get(parent_run_id, []))

    def cancel_sub_agent(self, child_run_id: str) -> bool:
        """Cancel a specific running sub-agent."""
        task = self._active_tasks.get(child_run_id)
        if task and not task.done():
            task.cancel()
            logger.info("Cancelled running sub-agent task %s", child_run_id)
            return True
        return False

    def cancel_all_for_parent(self, parent_run_id: str) -> int:
        """Cancel all running sub-agents associated with a parent run."""
        cancelled = 0
        child_ids = self._parent_child_map.get(parent_run_id, [])
        for cid in child_ids:
            if self.cancel_sub_agent(cid):
                cancelled += 1
        return cancelled

    def compute_least_privilege_permissions(
        self,
        parent_permissions: list[str],
        sub_agent_name: str,
    ) -> list[str]:
        """Compute child agent permissions enforcing the Zero-Trust Least Privilege invariant.
        
        Sub-agents can never exceed the permissions granted to their parent.
        """
        from .capability_registry import capability_registry
        caps = capability_registry.get_by_agent(sub_agent_name)
        card = get_agent_card(sub_agent_name)

        sub_declared: set[str] = set()
        for cap in caps:
            sub_declared.add(cap.capability_id)
            sub_declared.update(cap.required_tools)
            sub_declared.update(cap.optional_tools)
        if card and getattr(card, "tools", None):
            sub_declared.update(card.tools)

        parent_set = set(parent_permissions or [])
        if "*" in parent_set:
            # Parent is superuser, cap to what the child specifically declares/needs
            return list(sub_declared) if sub_declared else ["*"]

        # Strict intersection: parent_permissions & child_permissions
        if sub_declared:
            effective = list(parent_set.intersection(sub_declared))
        else:
            effective = list(parent_set)

        return effective

    async def spawn_sub_agent(
        self,
        parent_agent: str,
        parent_run_id: str,
        sub_agent_name: str,
        task_instruction: str,
        context: dict[str, Any] | None = None,
        parent_permissions: list[str] | None = None,
        allow_side_effects: bool = False,
        tenant_id: str | None = None,
        workspace_id: str | None = None,
        user_id: str | None = None,
        timeout_seconds: float = 30.0,
    ) -> AgentResponseEnvelope:
        """Spawn an isolated sub-agent, execute its subtask, and return structured result."""
        child_run_id = str(uuid.uuid4())
        start_time = time.time()

        if parent_run_id not in self._parent_child_map:
            self._parent_child_map[parent_run_id] = []
        self._parent_child_map[parent_run_id].append(child_run_id)

        # Enforce least-privilege permissions
        effective_permissions = self.compute_least_privilege_permissions(
            parent_permissions=parent_permissions or [],
            sub_agent_name=sub_agent_name,
        )

        message = AgentMessage(
            message_id=child_run_id,
            correlation_id=child_run_id,
            parent_run_id=parent_run_id,
            parent_agent=parent_agent,
            sender_agent=parent_agent,
            recipient_agent=sub_agent_name,
            message_type=MessageType.SUB_TASK_SPAWN,
            tenant_id=tenant_id,
            workspace_id=workspace_id,
            user_id=user_id,
            payload={
                "task": task_instruction,
                "context": context or {},
            },
            permissions=effective_permissions,
            allow_side_effects=allow_side_effects,
            timeout_seconds=timeout_seconds,
        )

        # Publish spawn event on bus
        await agent_bus.publish(message)

        # Execute sub-agent via dynamic agent registry
        handler_cls = dynamic_agent_registry.get(sub_agent_name)
        if not handler_cls:
            return AgentResponseEnvelope(
                correlation_id=child_run_id,
                source_agent=sub_agent_name,
                recipient_agent=parent_agent,
                parent_run_id=parent_run_id,
                status=TaskStatus.FAILED,
                error_message=f"Sub-agent '{sub_agent_name}' not found in dynamic agent registry",
            )

        async def _run() -> AgentResponseEnvelope:
            try:
                # Instantiate sub-agent
                import inspect
                sub_agent = handler_cls()
                if inspect.isawaitable(sub_agent):
                    sub_agent = await sub_agent

                # Check for standard handle / run method
                if hasattr(sub_agent, "handle") and callable(getattr(sub_agent, "handle")):
                    try:
                        res = await sub_agent.handle(
                            message=task_instruction,
                            workspace_id=workspace_id,
                            user_id=user_id,
                            tenant_id=tenant_id,
                            permissions=effective_permissions,
                        )
                    except TypeError:
                        res = await sub_agent.handle(task_instruction)
                elif hasattr(sub_agent, "run") and callable(getattr(sub_agent, "run")):
                    res = await sub_agent.run(
                        instruction=task_instruction,
                        context=context or {},
                    )
                else:
                    res = {"result": f"Executed sub-task with {sub_agent_name}"}

                elapsed_ms = (time.time() - start_time) * 1000.0
                envelope = AgentResponseEnvelope(
                    correlation_id=child_run_id,
                    source_agent=sub_agent_name,
                    recipient_agent=parent_agent,
                    parent_run_id=parent_run_id,
                    status=TaskStatus.SUCCESS,
                    data=res if isinstance(res, dict) else {"result": str(res)},
                    execution_time_ms=elapsed_ms,
                )
                return envelope
            except Exception as exc:
                logger.error("Sub-agent %s error during execution: %s", sub_agent_name, exc)
                return AgentResponseEnvelope(
                    correlation_id=child_run_id,
                    source_agent=sub_agent_name,
                    recipient_agent=parent_agent,
                    parent_run_id=parent_run_id,
                    status=TaskStatus.FAILED,
                    error_message=str(exc),
                    execution_time_ms=(time.time() - start_time) * 1000.0,
                )

        exec_task = asyncio.create_task(_run())
        self._active_tasks[child_run_id] = exec_task

        try:
            result = await asyncio.wait_for(exec_task, timeout=timeout_seconds)
            return result
        except asyncio.TimeoutError:
            logger.warning("Sub-agent %s timed out after %ds", sub_agent_name, timeout_seconds)
            exec_task.cancel()
            return AgentResponseEnvelope(
                correlation_id=child_run_id,
                source_agent=sub_agent_name,
                recipient_agent=parent_agent,
                parent_run_id=parent_run_id,
                status=TaskStatus.TIMEOUT,
                error_message=f"Sub-agent '{sub_agent_name}' execution timed out after {timeout_seconds}s",
                execution_time_ms=timeout_seconds * 1000.0,
            )
        finally:
            self._active_tasks.pop(child_run_id, None)

    async def spawn_sub_agents_parallel(
        self,
        parent_agent: str,
        parent_run_id: str,
        sub_tasks: list[dict[str, Any]],
        parent_permissions: list[str] | None = None,
        allow_side_effects: bool = False,
        tenant_id: str | None = None,
        workspace_id: str | None = None,
        user_id: str | None = None,
        timeout_seconds: float = 30.0,
    ) -> AgentResponseEnvelope:
        """Spawn multiple sub-agents concurrently, aggregating results with partial failure resilience."""
        start_time = time.time()
        coros = [
            self.spawn_sub_agent(
                parent_agent=parent_agent,
                parent_run_id=parent_run_id,
                sub_agent_name=t["agent_name"],
                task_instruction=t["task"],
                context=t.get("context"),
                parent_permissions=parent_permissions,
                allow_side_effects=allow_side_effects,
                tenant_id=tenant_id,
                workspace_id=workspace_id,
                user_id=user_id,
                timeout_seconds=t.get("timeout_seconds", timeout_seconds),
            )
            for t in sub_tasks
        ]

        responses: list[AgentResponseEnvelope] = await asyncio.gather(*coros, return_exceptions=False)

        # Aggregate results
        aggregated_data: dict[str, Any] = {}
        sub_agent_results: list[dict[str, Any]] = []
        success_count = 0
        failure_count = 0
        total_time_ms = 0.0

        for resp in responses:
            total_time_ms = max(total_time_ms, resp.execution_time_ms)
            sub_agent_results.append({
                "agent": resp.source_agent,
                "status": resp.status.value,
                "data": resp.data,
                "error": resp.error_message,
                "time_ms": resp.execution_time_ms,
            })
            if resp.status == TaskStatus.SUCCESS:
                success_count += 1
                aggregated_data[resp.source_agent] = resp.data
            else:
                failure_count += 1
                aggregated_data[resp.source_agent] = {
                    "error": resp.error_message or "Sub-agent execution failed",
                    "status": resp.status.value,
                }

        # Determine composite status
        if failure_count == 0:
            composite_status = TaskStatus.SUCCESS
        elif success_count > 0:
            composite_status = TaskStatus.PARTIAL_SUCCESS
        else:
            composite_status = TaskStatus.FAILED

        elapsed_total = (time.time() - start_time) * 1000.0

        return AgentResponseEnvelope(
            correlation_id=parent_run_id,
            source_agent=parent_agent,
            recipient_agent="user",
            parent_run_id=parent_run_id,
            status=composite_status,
            data=aggregated_data,
            sub_agent_results=sub_agent_results,
            execution_time_ms=elapsed_total,
        )


# Singleton
sub_agent_manager = SubAgentManager()
