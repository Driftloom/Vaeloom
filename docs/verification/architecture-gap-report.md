# Architecture Gap Report: Monolith vs Frozen Enterprise Architecture

## 1. Executive Summary

This report formalizes the architectural divergence between the current state of
the Vaeloom repository (pps/api monolith) and the frozen enterprise target
architecture specified in aeloom_final_enterprise_architecture.md.

---

## 2. Structural Layer Gap Matrix

| Architectural Layer          | Target Architecture Location                        | Current State Location                                          | Gap Classification     | Severity |
| :--------------------------- | :-------------------------------------------------- | :-------------------------------------------------------------- | :--------------------- | :------- |
| **Agent Contracts**          | packages/agent-contracts/                           | Scattered across pi.schemas.* and pi.agents.base                | **MISSING PACKAGE**    | P1       |
| **Policy Engine**            | packages/agent-policy/                              | Partially embedded in pi.orchestrator.loop and pi.services.rbac | **MISSING PACKAGE**    | P1       |
| **Security & Fencing**       | packages/agent-security/                            | Embedded in pi.middleware.* and pi.utils.*                      | **MISSING PACKAGE**    | P1       |
| **Agent Common Core**        | packages/agent-common/                              | Embedded in pi.agents.base and pi.orchestrator.*                | **MISSING PACKAGE**    | P1       |
| **Two-Tier Memory**          | packages/agent-memory/                              | Embedded in pi.memory.* and pi.agents.memory.*                  | **MISSING PACKAGE**    | P1       |
| **Tool Registry & Exec**     | packages/agent-tools/                               | Giant monolith pi.tools.executor (3,442 lines)                  | **MONOLITH COUPLING**  | P1       |
| **Delegation Router**        | packages/agent-delegation/                          | Implicit recursion inside pi.orchestrator.loop                  | **MISSING PACKAGE**    | P1       |
| **Observability & Audit**    | packages/agent-observability/                       | Partial in packages/observability and pi.utils.logging          | **FRAGMENTED**         | P2       |
| **Agent Evaluations**        | packages/agent-evals/                               | Ad-hoc evaluation scripts in pps/api/tests/evals                | **MISSING PACKAGE**    | P2       |
| **Deterministic Domain**     | packages/domain/ (7 services)                       | Mixed inside pps/api/src/api/services/                          | **MONOLITH COUPLING**  | P1       |
| **Consolidated Connectors**  | packages/connectors/ (9 conn)                       | Split between connectors/, integrations/, and pi/integrations/  | **TRIPLE DUPLICATION** | P1       |
| **28 Domain Agents**         | gents/{agent_id}/ (28 standalone)                   | Inside pps/api/src/api/agents/* without gent.yaml               | **MONOLITH COUPLING**  | P1       |
| **Messages API Runtime**     |
| untimes/messages-api-worker/ | Threaded polling loop inside pi.worker              | **COUPLING**                                                    | P2                     |
| **Temporal Workflows**       |
| untimes/temporal-workflows/  | Non-existent; relies on database transaction states | **UNIMPLEMENTED**                                               | P2                     |
| **Agent SDK**                |
| untimes/agent-sdk/           | Python base agent class inside pi.agents.base       | **COUPLING**                                                    | P2                     |

---

## 3. High-Risk Architectural Defect Summary

1. **Direct Database Coupling from Agents (SEC-P0-01)**:
   - AST analysis revealed 11 illegal direct SQL/DB imports in
     pps/api/src/api/agents/memory/consolidator.py, merge.py, and etrieval.py.
   - Bypasses service boundaries and leaks schema internals directly to agent
     reasoning nodes.
2. **Ambiguous User Identity Fallback (SEC-P0-02)**:
   - pps/api/src/api/orchestrator/context_loader.py:92 executes
     select(WorkspaceUser.user_id)...limit(1) if user_id is missing.
   - Allows multi-tenant identity spoofing or context bleeding between distinct
     users within a shared workspace.
3. **Absence of Declarative Agent Manifests (ARCH-P1-01)**:
   - Zero out of 28 agents possess an gent.yaml manifest.
   - Scopes, tools, memory access, and delegations are defined imperatively in
     Python code, making external security validation and zero-trust policy
     enforcement impossible.
4. **Tool Execution Monolith (ARCH-P1-02)**:
   - Single file pps/api/src/api/tools/executor.py spans 3,442 lines and
     executes all 48 tools in-process without sandboxing.
