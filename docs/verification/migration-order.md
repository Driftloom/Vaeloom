# Definitive Enterprise Migration Sequence: Phase 0 to Phase 17

**Strict Architectural Constraint**: Migration MUST follow the topological
dependency sequence below. No phase may begin until its predecessor packages
have passed Level 1/Level 2 verification. Agent 01 remains strictly frozen until
the Foundation passes all 40 verification criteria.

---

## 1. Topological Dependency Order

```text
PHASE 0: Repository Forensic Inventory & Baseline (CURRENT PHASE)
  ↓
PHASE 1: Canonical System Contracts (`packages/agent-contracts/`)
  ↓
PHASE 2: Identity / Tenant / Workspace Security (`packages/agent-security/`)
  ↓
PHASE 3: Policy Engine & Manifest Compiler (`packages/agent-policy/`)
  ↓
PHASE 4: Agent Common Primitives & ReAct Core (`packages/agent-common/`)
  ↓
PHASE 5: Two-Tier Memory Boundary (`packages/agent-memory/`)
  ↓
PHASE 6: Tool Registry, Executor & Sandbox (`packages/agent-tools/`)
  ↓
PHASE 7: Consolidated Connector Boundary (`packages/connectors/`)
  ↓
PHASE 8: Deterministic Domain Services (`packages/domain/`)
  ↓
PHASE 9: Policy-Constrained Delegation & Supervisor (`packages/agent-delegation/`)
  ↓
PHASE 10: Decoupled Runtimes (`runtimes/messages-api`, `runtimes/temporal`)
  ↓
PHASE 11: Enterprise Observability & Audit Trails (`packages/agent-observability/`)
  ↓
PHASE 12: Evaluation Harness & Trajectory Scoring (`packages/agent-evals/`)
  ↓
PHASE 13: FastAPI Monolith Refactoring & Gateway Migration (`apps/api/`)
  ↓
PHASE 14: 28 Domain Agents Standardization & `agent.yaml` Scaffolding (`agents/*`)
  ↓
PHASE 15: Web UI Next.js 15 Integration & SSE Streaming Client (`apps/web/`)
  ↓
PHASE 16: Infrastructure, Dockerization & CI/CD Pipelines
  ↓
PHASE 17: Full Monorepo Forensic Verification & Zero-Trust Audit
  ↓
FOUNDATION VERIFIED (`docs/verification/FOUNDATION-VERIFIED.md`)
  ↓
AGENT 01 (Career Agent) RE-ENTRY & VERIFICATION
```

---

## 2. Phase-by-Phase Execution Contracts

### PHASE 0: Repository Forensic Inventory & Baseline

- Audit all 7,081 files.
- Index all 28 domain agents, 54 tools, 63 database models, and 11 CI/CD
  workflows.
- Uncover all P0/P1 defects (28 direct DB imports, context loader fallback flaw,
  0 manifests).
- Generate 28 verification artifacts in `docs/verification/`.
- Status: **COMPLETE / DELIVERED**.

### PHASE 1: Canonical System Contracts (`packages/agent-contracts/`)

- Establish pure, zero-dependency Pydantic package.
- Define `AgentManifest`, `AgentCard`, `AgentRequest` (with non-null `user_id` &
  `tenant_id`), `AgentResponse`, `ToolDefinition`, `MemoryFact`,
  `ApprovalRequest`, `SSEEvent`.
- Prerequisite for all subsequent packages.

### PHASE 2: Identity / Tenant / Workspace Security (`packages/agent-security/`)

- Remediate `context_loader.py:88-96` arbitrary user selection vulnerability
  (`SEC-P0-02`).
- Extract URL guard SSRF protection, Presidio PII scrubbing, AES-256-GCM
  encryption, and token verification.
- Enforce mandatory tenant and workspace claim extraction.

### PHASE 3: Policy Engine & Manifest Compiler (`packages/agent-policy/`)

- Implement declarative policy engine compiling `agent.yaml`.
- Enforce tool allowlists, memory read/write scopes, delegation depth limits,
  and budget ceilings at runtime.

### PHASE 4: Agent Common Primitives & ReAct Core (`packages/agent-common/`)

- Extract core ReAct iteration loop, state machine, and context hydration out of
  `loop.py`.
- Establish clean base agent classes inheriting purely from canonical contracts.

### PHASE 5: Two-Tier Memory Boundary (`packages/agent-memory/`)

- Remediate direct database imports in memory agents (`SEC-P0-01`).
- Decouple Working Memory (Redis/Episodic) from Semantic Memory (PGVector/Entity
  Graph).
- Implement policy-mediated memory read/write interfaces.

### PHASE 6: Tool Registry, Executor & Sandbox (`packages/agent-tools/`)

- Dissect 3,442-line `executor.py` monolith into modular domain tool handlers.
- Wire approval interception gate for mutating tools (`_BASE_APPROVAL_GATED`).
- Enforce subprocess sandbox isolation for code execution tools.

### PHASE 7: Consolidated Connector Boundary (`packages/connectors/`)

- Eliminate triplicate connector code across `connectors/`, `integrations/`, and
  `apps/api/src/api/integrations/`.
- Consolidate 9 external connectors into `packages/connectors/`.

### PHASE 8: Deterministic Domain Services (`packages/domain/`)

- Extract ATS scoring (`semantic_ats.py`), resume building
  (`document_builder.py`), and salary estimation (`salary_service.py`) into pure
  Python packages under `packages/domain/`.

### PHASE 9: Policy-Constrained Delegation & Supervisor (`packages/agent-delegation/`)

- Implement acyclic delegation DAG router, call-depth limiters, and supervisor
  consensus loops.

### PHASE 10: Decoupled Runtimes (`runtimes/`)

- Decouple Messages API worker daemon into `runtimes/messages-api-worker/`.
- Isolate Temporal workflows and activities into `runtimes/temporal-workflows/`.
- Provide clean Python developer SDK in `runtimes/agent-sdk/`.

### PHASE 11: Enterprise Observability & Audit Trails (`packages/agent-observability/`)

- Centralize OpenTelemetry tracing, Prometheus `/metrics`, JSON structured
  logging, and immutable audit trails.

### PHASE 12: Evaluation Harness & Trajectory Scoring (`packages/agent-evals/`)

- Build automated evaluation harness for ReAct agent trajectory scoring, RLAIF,
  and regression testing.

### PHASE 13: FastAPI Monolith Refactoring & Gateway Migration (`apps/api/`)

- Strip monolithic orchestration out of `apps/api`. Convert FastAPI into a thin,
  secure API gateway.

### PHASE 14: 28 Domain Agents Standardization & Manifests (`agents/*`)

- Migrate all 28 domain agents into independent packages under
  `agents/{agent_id}/`.
- Author canonical `agent.yaml` manifests for every single agent.

### PHASE 15: Web UI Next.js 15 Integration & SSE Streaming Client (`apps/web/`)

- Connect Next.js 15 frontend to canonical SSE event streams and typed
  contracts.

### PHASE 16: Infrastructure, Dockerization & CI/CD Pipelines

- Update Dockerfiles, docker-compose, and GitHub Actions workflows to build and
  test all new packages.

### PHASE 17: Full Monorepo Forensic Verification & Zero-Trust Audit

- Execute complete automated test suite, AST dependency verification, and
  zero-trust security audit.
- Certify all 40 criteria in `FOUNDATION-VERIFIED.md`.
- Authorize Agent 01 re-entry.
