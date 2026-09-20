# Vaeloom Enterprise Multi-Agent Workspace Collaboration

This demo illustrates multi-agent orchestration within an enterprise engineering
workspace, replacing legacy consumer entertainment demos with platform-native
supervisor/worker coordination.

## Features

1. **Policy-Gated Delegation DAG**: Routes tasks from a supervisor agent to
   specialized domain agents (`coding-agent`, `slack-agent`, `memory-agent`)
   with maximum depth enforcement.
2. **Cycle Prevention**: Actively detects and rejects cyclic delegations before
   execution begins.
3. **Scoped Blackboard State**: Inter-agent communication without shared mutable
   state or direct database coupling; artifacts are recorded and passed by key
   with provenance.
4. **End-to-End Enterprise Flow**:
   - `coding-agent` reviews a pull request and inspects tests/allocations.
   - `slack-agent` drafts a concise deployment announcement.
   - `memory-agent` indexes new architectural decisions into long-term
     organizational memory.

## Running the Demo

```bash
# Direct Python execution:
python examples/enterprise-workspace/app.py

# Or via uv:
uv run --project apps/api python examples/enterprise-workspace/app.py
```

## Architecture Integration

- **Platform Delegation**:
  [`packages/agent-delegation`](../../packages/agent-delegation)
- **Policy Engine**: [`packages/agent-policy`](../../packages/agent-policy)
- **Contracts**: [`packages/agent-contracts`](../../packages/agent-contracts)
- **Domain Agents**: [`agents/coding-agent`](../../agents/coding-agent),
  [`agents/slack-agent`](../../agents/slack-agent),
  [`agents/memory-agent`](../../agents/memory-agent)
