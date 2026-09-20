from typing import Optional
from vaeloom_agent_contracts import (
    AgentManifest,
    ToolInvocation,
    MemoryAccessType,
    MemoryScope,
    ApprovalStatus,
)


class PolicyViolationError(Exception):
    pass


class PolicyVerdict:
    def __init__(self, allowed: bool, reason: str = "", requires_approval: bool = False):
        self.allowed = allowed
        self.reason = reason
        self.requires_approval = requires_approval


class PolicyEngine:
    """Evaluates agent execution against declarative manifest rules."""

    def __init__(self, manifest: AgentManifest):
        self.manifest = manifest

    def authorize_tool(self, tool_name: str) -> PolicyVerdict:
        """Verifies if a tool is permitted and whether it requires human approval."""
        if tool_name not in self.manifest.tools:
            return PolicyVerdict(
                allowed=False,
                reason=f"Tool '{tool_name}' is not declared in manifest for agent '{self.manifest.agent_id}'"
            )
        
        requires_approval = tool_name in self.manifest.gated_tools
        return PolicyVerdict(allowed=True, requires_approval=requires_approval)

    def authorize_memory_access(self, scope_name: str, access_type: MemoryAccessType) -> PolicyVerdict:
        """Verifies if memory access to a specific scope is authorized."""
        if scope_name in self.manifest.memory_scopes.denied_scopes:
            return PolicyVerdict(
                allowed=False,
                reason=f"Memory scope '{scope_name}' is explicitly denied for agent '{self.manifest.agent_id}'"
            )
        
        if access_type == MemoryAccessType.READ:
            allowed = scope_name in self.manifest.memory_scopes.read_scopes or "*" in self.manifest.memory_scopes.read_scopes
            return PolicyVerdict(allowed=allowed, reason="" if allowed else f"Read access to scope '{scope_name}' not granted")
        elif access_type in (MemoryAccessType.WRITE, MemoryAccessType.DELETE):
            allowed = scope_name in self.manifest.memory_scopes.write_scopes or "*" in self.manifest.memory_scopes.write_scopes
            return PolicyVerdict(allowed=allowed, reason="" if allowed else f"Write access to scope '{scope_name}' not granted")
        
        return PolicyVerdict(allowed=False, reason="Unknown memory access type")

    def authorize_delegation(self, target_agent: str, current_depth: int) -> PolicyVerdict:
        """Verifies delegation permissions and call DAG depth limits."""
        if not self.manifest.delegation.can_delegate:
            return PolicyVerdict(allowed=False, reason=f"Agent '{self.manifest.agent_id}' is not authorized to delegate")
        
        if current_depth >= self.manifest.delegation.max_depth:
            return PolicyVerdict(
                allowed=False,
                reason=f"Delegation depth limit ({self.manifest.delegation.max_depth}) reached for agent '{self.manifest.agent_id}'"
            )
        
        if target_agent not in self.manifest.delegation.allowed_targets and "*" not in self.manifest.delegation.allowed_targets:
            return PolicyVerdict(
                allowed=False,
                reason=f"Delegation to target '{target_agent}' not in allowed list for agent '{self.manifest.agent_id}'"
            )
        
        return PolicyVerdict(allowed=True)

    def check_budget(self, current_tokens: int, current_steps: int, current_cost_usd: float) -> PolicyVerdict:
        """Enforces hard budget ceilings."""
        if current_tokens >= self.manifest.budget.max_tokens_per_turn:
            return PolicyVerdict(allowed=False, reason=f"Token budget ({self.manifest.budget.max_tokens_per_turn}) exceeded")
        if current_steps >= self.manifest.budget.max_steps_per_turn:
            return PolicyVerdict(allowed=False, reason=f"Step limit ({self.manifest.budget.max_steps_per_turn}) exceeded")
        if current_cost_usd >= self.manifest.budget.max_usd_per_turn:
            return PolicyVerdict(allowed=False, reason=f"USD cost ceiling (${self.manifest.budget.max_usd_per_turn}) exceeded")
        
        return PolicyVerdict(allowed=True)
