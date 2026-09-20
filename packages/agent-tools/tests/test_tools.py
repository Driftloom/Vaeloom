import pytest
from uuid import uuid4
from datetime import datetime, timezone, timedelta
from vaeloom_agent_contracts import (
    AgentManifest,
    AgentCategory,
    AutonomyLevel,
    ToolDefinition,
    ToolRiskLevel,
    ToolInvocation,
)
from vaeloom_agent_policy import PolicyEngine
from vaeloom_agent_tools import (
    ToolRegistry,
    ToolDispatcher,
    SubprocessSandbox,
    ApprovalRequiredSignal,
)


@pytest.fixture
def policy():
    manifest = AgentManifest(
        agent_id="test-agent",
        name="Test Agent",
        version="1.0.0",
        description="test",
        category=AgentCategory.SYSTEM,
        tools=["echo_tool", "delete_tool"],
        gated_tools=["delete_tool"],
    )
    return PolicyEngine(manifest)


@pytest.mark.asyncio
async def test_tool_dispatch_success(policy):
    registry = ToolRegistry()
    
    async def echo_handler(params):
        return f"Echo: {params.get('msg')}"

    tool_def = ToolDefinition(name="echo_tool", description="Echoes message", risk_level=ToolRiskLevel.READ_ONLY)
    registry.register(tool_def, echo_handler)

    dispatcher = ToolDispatcher(registry)
    inv = ToolInvocation(
        call_id="call-1",
        tool_name="echo_tool",
        parameters={"msg": "Hello"},
        workspace_id=uuid4(),
        user_id=uuid4(),
    )
    res = await dispatcher.dispatch(policy, inv)
    assert res.success is True
    assert res.output == "Echo: Hello"


@pytest.mark.asyncio
async def test_tool_dispatch_approval_interception(policy):
    registry = ToolRegistry()
    
    async def delete_handler(params):
        return "Deleted"

    tool_def = ToolDefinition(name="delete_tool", description="Deletes resource", risk_level=ToolRiskLevel.MUTATION_GATED)
    registry.register(tool_def, delete_handler)

    dispatcher = ToolDispatcher(registry)
    inv = ToolInvocation(
        call_id="call-2",
        tool_name="delete_tool",
        parameters={"id": "123"},
        workspace_id=uuid4(),
        user_id=uuid4(),
    )

    # Unapproved invocation must raise ApprovalRequiredSignal
    with pytest.raises(ApprovalRequiredSignal) as exc_info:
        await dispatcher.dispatch(policy, inv, approved=False)
    
    assert exc_info.value.approval_request.action_name == "delete_tool"

    # Pre-approved invocation succeeds
    res = await dispatcher.dispatch(policy, inv, approved=True)
    assert res.success is True
    assert res.output == "Deleted"


@pytest.mark.asyncio
async def test_subprocess_sandbox():
    sandbox = SubprocessSandbox(timeout_seconds=5.0)
    code = "import sys; sys.stdout.write('Hello from isolated sandbox!')"
    result = await sandbox.execute_python(code)
    assert result["success"] is True
    assert "Hello from isolated sandbox!" in result["stdout"]
