from abc import ABC, abstractmethod
from typing import Any, AsyncGenerator, Optional
from vaeloom_agent_contracts import (
    AgentManifest,
    AgentRequest,
    AgentResponse,
    ToolInvocation,
    ToolResult,
)
from vaeloom_agent_policy import PolicyEngine, PolicyVerdict
from .context import AgentTurnContext
from .react_step import ReActStep
from .cancellation import CancellationToken


class BaseAgent(ABC):
    """Canonical base agent binding declarative manifest, zero-trust policy, and execution loop."""

    def __init__(self, manifest: AgentManifest):
        self.manifest = manifest
        self.policy = PolicyEngine(manifest)

    @abstractmethod
    async def run_step(self, context: AgentTurnContext, token: CancellationToken) -> ReActStep:
        """Executes a single ReAct step for this agent."""
        pass

    def validate_tool_call(self, tool_name: str) -> PolicyVerdict:
        """Checks tool authorization against the manifest policy."""
        return self.policy.authorize_tool(tool_name)
