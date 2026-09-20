import time
from uuid import uuid4
from typing import Any
from vaeloom_agent_contracts import (
    ToolInvocation,
    ToolResult,
    ApprovalRequest,
    ApprovalStatus,
)
from vaeloom_agent_policy import PolicyEngine
from .registry import ToolRegistry


class ApprovalRequiredSignal(Exception):
    def __init__(self, approval_request: ApprovalRequest):
        self.approval_request = approval_request


class ToolDispatcher:
    """Dispatches tool calls through PolicyEngine and intercepts approval-gated mutations."""

    def __init__(self, registry: ToolRegistry):
        self.registry = registry

    async def dispatch(
        self,
        policy: PolicyEngine,
        invocation: ToolInvocation,
        approved: bool = False,
    ) -> ToolResult:
        start_time = time.time()
        tool_def = self.registry.get_definition(invocation.tool_name)
        if not tool_def:
            return ToolResult(
                call_id=invocation.call_id,
                tool_name=invocation.tool_name,
                success=False,
                output=None,
                error_message=f"Tool '{invocation.tool_name}' not found in registry",
            )

        verdict = policy.authorize_tool(invocation.tool_name)
        if not verdict.allowed:
            return ToolResult(
                call_id=invocation.call_id,
                tool_name=invocation.tool_name,
                success=False,
                output=None,
                error_message=f"Policy violation: {verdict.reason}",
            )

        if verdict.requires_approval and not approved:
            app_req = ApprovalRequest(
                workspace_id=invocation.workspace_id,
                tenant_id=invocation.workspace_id,
                requested_by_agent=policy.manifest.agent_id,
                action_name=invocation.tool_name,
                parameters=invocation.parameters,
                summary=f"Agent '{policy.manifest.agent_id}' requested execution of gated tool '{invocation.tool_name}'",
                nonce=str(uuid4()),
                expires_at=time.time() + 1800,  # 30 min TTL
            )
            raise ApprovalRequiredSignal(app_req)

        handler = self.registry.get_handler(invocation.tool_name)
        try:
            output = await handler(invocation.parameters)
            return ToolResult(
                call_id=invocation.call_id,
                tool_name=invocation.tool_name,
                success=True,
                output=output,
                execution_time_ms=(time.time() - start_time) * 1000,
            )
        except Exception as e:
            return ToolResult(
                call_id=invocation.call_id,
                tool_name=invocation.tool_name,
                success=False,
                output=None,
                error_message=str(e),
                execution_time_ms=(time.time() - start_time) * 1000,
            )
