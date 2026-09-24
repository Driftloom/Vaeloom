"""Enterprise Agent-to-Agent Hierarchy & Sub-Agent Orchestration Test Suite.

Verifies:
- Typed AgentMessage and AgentResponseEnvelope schemas
- Event bus pub/sub message delivery and request/response RPC
- Main-to-sub-agent delegation and lifecycle tracking
- Concurrent parallel sub-agent execution
- Zero-Trust Least-Privilege permission scoping (child <= parent)
- Partial failure resilience and aggregated responses
- Sub-agent timeout and cancellation
"""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from api.orchestrator.agent_bus import AgentEventBus
from api.orchestrator.contracts.agent_message import (
    AgentMessage,
    AgentResponseEnvelope,
    MessagePriority,
    MessageType,
    TaskStatus,
)
from api.orchestrator.sub_agent_manager import SubAgentManager

pytestmark = pytest.mark.asyncio


async def test_agent_message_contract():
    """Verify typed contract creation and serialization."""
    msg = AgentMessage(
        sender_agent="career_architect",
        recipient_agent="resume_tailor",
        message_type=MessageType.TASK_DELEGATION,
        priority=MessagePriority.HIGH,
        tenant_id="tenant-123",
        workspace_id="ws-456",
        payload={"job_title": "Staff Engineer"},
        permissions=["resume.write", "memory.read"],
    )
    assert msg.message_id
    assert msg.correlation_id
    assert msg.sender_agent == "career_architect"
    assert msg.recipient_agent == "resume_tailor"
    assert msg.permissions == ["resume.write", "memory.read"]

    json_str = msg.model_dump_json()
    assert "career_architect" in json_str


async def test_agent_bus_pub_sub():
    """Verify event bus topic subscription and publishing."""
    bus = AgentEventBus()
    received_messages = []

    async def _on_message(msg: AgentMessage):
        received_messages.append(msg)

    bus.subscribe("agent:memory", _on_message)

    msg = AgentMessage(
        sender_agent="supervisor",
        recipient_agent="memory",
        payload={"query": "user skills"},
    )
    await bus.publish(msg)
    # Allow background event processing
    await asyncio.sleep(0.05)

    assert len(received_messages) == 1
    assert received_messages[0].recipient_agent == "memory"
    assert received_messages[0].payload["query"] == "user skills"


async def test_sub_agent_manager_least_privilege():
    """Verify child agent permissions cannot exceed parent agent permissions."""
    mgr = SubAgentManager()

    # If parent has limited permissions, child only gets the intersection
    parent_perms = ["documents.read", "analytics.view"]
    effective = mgr.compute_least_privilege_permissions(parent_perms, "resume")

    # resume agent cannot have permissions not granted to parent
    for p in effective:
        assert p in parent_perms


async def test_sub_agent_manager_spawn_success():
    """Verify spawning sub-agent executes and returns successful envelope."""
    mgr = SubAgentManager()

    # Mock agent execution
    fake_handler = MagicMock()
    fake_instance = MagicMock()
    fake_instance.handle = AsyncMock(return_value={"tailored_resume": "Bullet points..."})
    fake_handler.return_value = fake_instance

    with patch("api.orchestrator.sub_agent_manager.dynamic_agent_registry.get", return_value=fake_handler):
        envelope = await mgr.spawn_sub_agent(
            parent_agent="career_architect",
            parent_run_id="run-main-001",
            sub_agent_name="resume",
            task_instruction="Tailor resume for Senior Backend role",
            parent_permissions=["resume.write"],
        )

        assert envelope.status == TaskStatus.SUCCESS
        assert envelope.source_agent == "resume"
        assert envelope.recipient_agent == "career_architect"
        assert "tailored_resume" in envelope.data
        assert envelope.execution_time_ms >= 0


async def test_sub_agent_manager_parallel_execution():
    """Verify concurrent execution of multiple sub-agents."""
    mgr = SubAgentManager()

    fake_resume = MagicMock()
    inst_resume = MagicMock()
    inst_resume.handle = AsyncMock(return_value={"tailored": True})
    fake_resume.return_value = inst_resume

    fake_ats = MagicMock()
    inst_ats = MagicMock()
    inst_ats.handle = AsyncMock(return_value={"ats_score": 92})
    fake_ats.return_value = inst_ats

    def _get_agent(name):
        if name == "resume":
            return fake_resume
        if name == "ats":
            return fake_ats
        return None

    with patch("api.orchestrator.sub_agent_manager.dynamic_agent_registry.get", side_effect=_get_agent):
        sub_tasks = [
            {"agent_name": "resume", "task": "Tailor resume"},
            {"agent_name": "ats", "task": "Calculate score"},
        ]
        composite = await mgr.spawn_sub_agents_parallel(
            parent_agent="supervisor",
            parent_run_id="parent-dag-999",
            sub_tasks=sub_tasks,
        )

        assert composite.status == TaskStatus.SUCCESS
        assert "resume" in composite.data
        assert "ats" in composite.data
        assert composite.data["resume"]["tailored"] is True
        assert composite.data["ats"]["ats_score"] == 92
        assert len(composite.sub_agent_results) == 2


async def test_sub_agent_manager_partial_failure_resilience():
    """Verify partial failure when 1 sub-agent succeeds and 1 fails."""
    mgr = SubAgentManager()

    fake_resume = MagicMock()
    inst_resume = MagicMock()
    inst_resume.handle = AsyncMock(return_value={"tailored": True})
    fake_resume.return_value = inst_resume

    fake_failing = MagicMock()
    inst_failing = MagicMock()
    inst_failing.handle = AsyncMock(side_effect=RuntimeError("Third-party provider timeout"))
    fake_failing.return_value = inst_failing

    def _get_agent(name):
        if name == "resume":
            return fake_resume
        if name == "gmail":
            return fake_failing
        return None

    with patch("api.orchestrator.sub_agent_manager.dynamic_agent_registry.get", side_effect=_get_agent):
        sub_tasks = [
            {"agent_name": "resume", "task": "Tailor resume"},
            {"agent_name": "gmail", "task": "Draft email"},
        ]
        composite = await mgr.spawn_sub_agents_parallel(
            parent_agent="supervisor",
            parent_run_id="parent-dag-888",
            sub_tasks=sub_tasks,
        )

        assert composite.status == TaskStatus.PARTIAL_SUCCESS
        assert composite.data["resume"]["tailored"] is True
        assert "error" in composite.data["gmail"]
        assert "Third-party provider timeout" in composite.data["gmail"]["error"]


async def test_sub_agent_timeout_handling():
    """Verify that a slow sub-agent is cancelled and reports TIMEOUT status."""
    mgr = SubAgentManager()

    fake_slow = MagicMock()
    inst_slow = MagicMock()

    async def _slow_handle(*args, **kwargs):
        await asyncio.sleep(5.0)
        return {"done": True}

    inst_slow.handle = _slow_handle
    fake_slow.return_value = inst_slow

    with patch("api.orchestrator.sub_agent_manager.dynamic_agent_registry.get", return_value=fake_slow):
        envelope = await mgr.spawn_sub_agent(
            parent_agent="supervisor",
            parent_run_id="run-slow-1",
            sub_agent_name="research",
            task_instruction="Long research",
            timeout_seconds=0.1,  # Short timeout
        )

        assert envelope.status == TaskStatus.TIMEOUT
        assert "timed out" in envelope.error_message


async def test_spawn_sub_agents_tool_execution():
    """Verify that spawn_sub_agents tool dispatches correctly through execute_tool."""
    from api.tools.definitions import ALL_TOOLS
    from api.tools.executor import execute_tool

    spawn_tool = ALL_TOOLS.get("spawn_sub_agents")
    assert spawn_tool is not None

    fake_handler = MagicMock()
    inst = MagicMock()
    inst.handle = AsyncMock(return_value={"summary": "Resume tailored perfectly"})
    fake_handler.return_value = inst

    with patch("api.orchestrator.sub_agent_manager.dynamic_agent_registry.get", return_value=fake_handler):
        result = await execute_tool(
            tool=spawn_tool,
            params={
                "tasks": [
                    {"agent_name": "resume", "instruction": "Tailor resume for Stripe"},
                ]
            },
            agent_id="supervisor",
            agent_scopes=["agent.spawn"],
            workspace_id="ws-test-123",
        )

        assert result["status"] == "success"
        assert result["count"] == 1
        assert len(result["results"]) == 1
        assert result["results"][0]["agent"] == "resume"
        assert "Resume tailored perfectly" in result["aggregated_summary"]

