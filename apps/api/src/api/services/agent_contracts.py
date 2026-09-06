"""Agent Contracts + Loop Policy — the enforceable runtime envelope.

Implements §3-4 (contract + harness envelope), §13-15 (loop bounds),
§21 (budgets), §26-27 (approval/autonomy), §52 (cycle detection), §58.

An agent is NEVER just `system prompt + tools`. Every execution resolves
a versioned AgentContract; the LoopController enforces iteration / tool /
sub-agent / token / cost / duration ceilings and detects delegation cycles.
Both are pure deterministic Python so they are unit-testable without LLMs.
"""

from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Literal

RiskClass = Literal["low", "medium", "high", "critical"]
Autonomy = Literal["OBSERVE", "SUGGEST", "PREPARE", "APPROVAL_REQUIRED", "LIMITED_AUTO", "AUTO"]


class ContractViolation(Exception):
    pass


@dataclass
class LoopPolicy:
    max_iterations: int = 8
    max_tool_calls: int = 12
    max_sub_agents: int = 3
    max_tokens: int = 12000
    max_cost_usd: float = 0.50
    max_duration_s: float = 120.0
    # condition names that stop/escalate the loop (evaluated by caller)
    success_conditions: list[str] = field(default_factory=lambda: ["task_complete"])
    failure_conditions: list[str] = field(default_factory=lambda: ["unrecoverable_tool_error"])
    escalation_conditions: list[str] = field(default_factory=lambda: ["low_confidence", "high_risk_action"])
    version: str = "v1.0"


@dataclass
class AgentContract:
    agent_id: str
    version: str
    mission: str
    responsibilities: list[str] = field(default_factory=list)
    non_responsibilities: list[str] = field(default_factory=list)
    allowed_tools: list[str] = field(default_factory=list)
    forbidden_tools: list[str] = field(default_factory=list)
    memory_read_scopes: list[str] = field(default_factory=list)
    memory_write_scopes: list[str] = field(default_factory=list)
    autonomy: Autonomy = "SUGGEST"
    risk_class: RiskClass = "low"
    approval_required_for: list[str] = field(default_factory=list)
    loop: LoopPolicy = field(default_factory=LoopPolicy)
    model_policy: str = "balanced"
    timeout_s: float = 60.0
    budget_usd: float = 0.50
    owner: str = "AI/ML Engineer"
    status: str = "active"  # DRAFT|LOCAL|EVALUATED|STAGING|CANARY|PRODUCTION|DEPRECATED

    # -- enforcement ---------------------------------------------------
    def can_use_tool(self, tool_name: str) -> bool:
        if tool_name in self.forbidden_tools:
            return False
        if tool_name.startswith("mcp__"):
            # MCP tools are never implicitly allowed — must be listed.
            return tool_name in self.allowed_tools
        return tool_name in self.allowed_tools

    def check_tool(self, tool_name: str) -> None:
        if not self.can_use_tool(tool_name):
            raise ContractViolation(f"agent '{self.agent_id}' may not call tool '{tool_name}'")

    def requires_approval(self, action_type: str) -> bool:
        if self.autonomy == "APPROVAL_REQUIRED":
            return True
        if self.risk_class in ("high", "critical"):
            return True
        return action_type in self.approval_required_for

    def can_write_memory(self, scope: str) -> bool:
        return scope in self.memory_write_scopes

    def check_memory_write(self, scope: str) -> None:
        if not self.can_write_memory(scope):
            raise ContractViolation(f"agent '{self.agent_id}' may not write memory scope '{scope}'")


@dataclass
class ExecutionEnvelope:
    """Runtime envelope for one agent execution (IDs + budgets + lineage)."""

    execution_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    tenant_id: str = ""
    workspace_id: str = ""
    user_id: str = ""
    parent_execution_id: str | None = None
    agent_id: str = ""
    agent_version: str = "v1.0"
    task_type: str = "general"
    trigger: str = "user"
    autonomy: Autonomy = "SUGGEST"
    budget_usd: float = 0.50
    timeout_s: float = 60.0
    spent_usd: float = 0.0
    started_at: float = field(default_factory=time.time)
    causation_id: str = ""
    correlation_id: str = ""
    event_depth: int = 0

    def child(self, agent_id: str, budget_share: float = 0.4) -> "ExecutionEnvelope":
        """Spawn a bounded child envelope — the child can never exceed its
        share of the parent's *remaining* budget (budget propagation, §21)."""
        remaining = max(0.0, self.budget_usd - self.spent_usd)
        return ExecutionEnvelope(
            tenant_id=self.tenant_id, workspace_id=self.workspace_id, user_id=self.user_id,
            parent_execution_id=self.execution_id, agent_id=agent_id,
            agent_version=self.agent_version, task_type=self.task_type,
            trigger=f"delegation:{self.agent_id}", autonomy=self.autonomy,
            budget_usd=round(remaining * budget_share, 6),
            timeout_s=min(self.timeout_s, 60.0),
            causation_id=self.execution_id, correlation_id=self.correlation_id or self.execution_id,
            event_depth=self.event_depth + 1,
        )

    def check_budget(self, additional: float = 0.0) -> bool:
        return (self.spent_usd + additional) <= self.budget_usd

    def check_timeout(self) -> bool:
        return (time.time() - self.started_at) <= self.timeout_s


class LoopController:
    """Bounded ReAct-style loop tracker with cycle detection (§52).

    Tracks iterations, tool calls, sub-agent spawns, tokens, cost, duration
    and the delegation chain (for A→B→A detection). The LLM loop calls
    `before_step()` / `record_*()`; any ceiling breach raises ContractViolation
    instead of looping forever.
    """

    def __init__(self, policy: LoopPolicy, envelope: ExecutionEnvelope | None = None):
        self.policy = policy
        self.envelope = envelope
        self.iterations = 0
        self.tool_calls = 0
        self.sub_agents = 0
        self.tokens = 0
        self.cost_usd = 0.0
        self.started_at = time.time()
        self.actions: list[str] = []  # tool/action fingerprints for cycle detection
        self.delegation_chain: list[str] = []

    def before_step(self, action_fingerprint: str = "") -> None:
        if self.iterations >= self.policy.max_iterations:
            raise ContractViolation(f"loop bound: max_iterations={self.policy.max_iterations}")
        if action_fingerprint and self.actions.count(action_fingerprint) >= 2:
            raise ContractViolation(f"loop detected: action repeated 3x: {action_fingerprint}")
        if time.time() - self.started_at > self.policy.max_duration_s:
            raise ContractViolation(f"loop bound: max_duration_s={self.policy.max_duration_s}")
        if self.cost_usd >= self.policy.max_cost_usd:
            raise ContractViolation(f"loop bound: max_cost_usd={self.policy.max_cost_usd}")
        if self.envelope and not self.envelope.check_budget():
            raise ContractViolation("execution budget exhausted")

    def commit_step(self, action_fingerprint: str = "") -> None:
        self.iterations += 1
        if action_fingerprint:
            self.actions.append(action_fingerprint)

    def record_tool_call(self, tool: str, cost_usd: float = 0.0, tokens: int = 0) -> None:
        if self.tool_calls >= self.policy.max_tool_calls:
            raise ContractViolation(f"loop bound: max_tool_calls={self.policy.max_tool_calls}")
        self.tool_calls += 1
        self.cost_usd += cost_usd
        self.tokens += tokens
        if self.envelope:
            self.envelope.spent_usd += cost_usd
        if self.tokens > self.policy.max_tokens:
            raise ContractViolation(f"loop bound: max_tokens={self.policy.max_tokens}")

    def record_delegation(self, agent_id: str) -> None:
        if self.sub_agents >= self.policy.max_sub_agents:
            raise ContractViolation(f"loop bound: max_sub_agents={self.policy.max_sub_agents}")
        if agent_id in self.delegation_chain:
            raise ContractViolation(f"delegation cycle: {'->'.join(self.delegation_chain + [agent_id])}")
        self.delegation_chain.append(agent_id)
        self.sub_agents += 1

    def snapshot(self) -> dict[str, Any]:
        return {
            "iterations": self.iterations, "tool_calls": self.tool_calls,
            "sub_agents": self.sub_agents, "tokens": self.tokens,
            "cost_usd": round(self.cost_usd, 6),
            "elapsed_s": round(time.time() - self.started_at, 2),
            "delegation_chain": list(self.delegation_chain),
        }


class AgentRegistry:
    """Centralized versioned agent-contract registry (§58)."""

    def __init__(self):
        self._contracts: dict[str, AgentContract] = {}

    def register(self, contract: AgentContract) -> None:
        self._contracts[contract.agent_id] = contract

    def get(self, agent_id: str) -> AgentContract | None:
        return self._contracts.get(agent_id)

    def require(self, agent_id: str) -> AgentContract:
        c = self.get(agent_id)
        if not c:
            raise ContractViolation(f"unknown agent '{agent_id}' — no contract registered")
        if c.status == "DEPRECATED":
            raise ContractViolation(f"agent '{agent_id}' is DEPRECATED")
        return c

    def list(self) -> list[dict[str, Any]]:
        return [
            {"agent_id": c.agent_id, "version": c.version, "status": c.status,
             "risk": c.risk_class, "autonomy": c.autonomy, "tools": len(c.allowed_tools)}
            for c in self._contracts.values()
        ]


agent_registry = AgentRegistry()

# Seed contracts for the 8 runtime agents (mirrors agent_runtime seed policies
# but with full contract fields: scopes, autonomy, loop, approvals).
_SEEDS: list[AgentContract] = [
    AgentContract(agent_id="memory", version="v1.0", mission="Extract/merge memory with provenance",
                  allowed_tools=["memory_create", "memory_update"], memory_read_scopes=["memory.read"],
                  memory_write_scopes=["memory.write"], autonomy="LIMITED_AUTO", risk_class="medium",
                  approval_required_for=["memory_merge"], loop=LoopPolicy(max_iterations=6, max_tool_calls=8)),
    AgentContract(agent_id="retrieval", version="v1.0", mission="Hybrid retrieval with provenance",
                  allowed_tools=["search_all", "search_memories", "kg_traverse"], memory_read_scopes=["memory.read"],
                  autonomy="AUTO", risk_class="low", loop=LoopPolicy(max_iterations=4, max_tool_calls=6)),
    AgentContract(agent_id="resume", version="v1.0", mission="Generate resume with provenance",
                  allowed_tools=["resume_generate", "ats_score"], memory_read_scopes=["memory.read"],
                  autonomy="SUGGEST", risk_class="low", loop=LoopPolicy(max_iterations=5, max_tool_calls=6)),
    AgentContract(agent_id="job_search", version="v1.0", mission="Fan-out Greenhouse/Lever dedup",
                  allowed_tools=["job_search", "browse_job_page"], memory_read_scopes=["memory.read"],
                  autonomy="AUTO", risk_class="low", loop=LoopPolicy(max_iterations=6, max_tool_calls=10)),
    AgentContract(agent_id="gmail", version="v1.0", mission="Classify draft-only NEVER send",
                  allowed_tools=["gmail_classify", "gmail_draft"],
                  forbidden_tools=["gmail_send", "email_send"],
                  memory_read_scopes=["memory.read"], autonomy="PREPARE", risk_class="high",
                  approval_required_for=["gmail_draft", "email_send"],
                  loop=LoopPolicy(max_iterations=4, max_tool_calls=5)),
    AgentContract(agent_id="scheduler", version="v1.0", mission="Schedule with conflict check",
                  allowed_tools=["schedule_create"], memory_read_scopes=["memory.read"],
                  autonomy="APPROVAL_REQUIRED", risk_class="medium",
                  approval_required_for=["schedule_create"], loop=LoopPolicy(max_iterations=4, max_tool_calls=5)),
    AgentContract(agent_id="github", version="v1.0", mission="GitHub least-privilege operations",
                  allowed_tools=["github_tools"], forbidden_tools=["repo_delete", "force_push"],
                  memory_read_scopes=["memory.read"], autonomy="APPROVAL_REQUIRED", risk_class="high",
                  approval_required_for=["create_github_issue", "create_github_pull_request"],
                  loop=LoopPolicy(max_iterations=6, max_tool_calls=8)),
    AgentContract(agent_id="research", version="v1.0", mission="Research with tool-data quarantine",
                  allowed_tools=["browse_job_page", "scrape_company_insights"], memory_read_scopes=["memory.read"],
                  autonomy="AUTO", risk_class="medium", loop=LoopPolicy(max_iterations=8, max_tool_calls=12)),
]
for _c in _SEEDS:
    agent_registry.register(_c)
