# Target Architecture Gap Comparison: Monolith vs Frozen Enterprise Architecture

## 1. Executive Summary

This document provides a systematic comparison between the current state of the
Vaeloom repository and the frozen canonical architecture defined in
`vaeloom_final_enterprise_architecture.md`.

---

## 2. 20-Dimension Architecture Comparison Matrix

|  #  | Dimension              | Current Monolith Reality           | Frozen Enterprise Target                     | Gap Level | Target Action                    |
| :-: | :--------------------- | :--------------------------------- | :------------------------------------------- | :-------: | :------------------------------- |
| 01  | **Agent Contracts**    | Scattered in `api.schemas`         | `packages/agent-contracts` (Pure Pydantic)   |  **P1**   | Create pure contract package     |
| 02  | **Policy Engine**      | Hardcoded checks in `loop.py`      | `packages/agent-policy` (Declarative YAML)   |  **P1**   | Extract policy engine            |
| 03  | **Security & Fencing** | Embedded in API middleware         | `packages/agent-security` (SSRF/Fencing/PII) |  **P1**   | Extract security primitives      |
| 04  | **Agent Core Runtime** | Giant `loop.py` (3,238 lines)      | `packages/agent-common` (Modular ReAct)      |  **P1**   | Dissect `loop.py`                |
| 05  | **Two-Tier Memory**    | Mixed in `api.memory` & agents     | `packages/agent-memory` (Working + Semantic) |  **P1**   | Consolidate memory runtime       |
| 06  | **Tool Execution**     | Giant `executor.py` (3,442 lines)  | `packages/agent-tools` (Modular handlers)    |  **P1**   | Dissect `executor.py`            |
| 07  | **Delegation Router**  | Recursive call in `loop.py`        | `packages/agent-delegation` (DAG bounded)    |  **P1**   | Create delegation router         |
| 08  | **Observability**      | Fragmented in `infrastructure`     | `packages/agent-observability` (OTel/Audit)  |  **P2**   | Standardize observability        |
| 09  | **Agent Evals**        | Ad-hoc scripts                     | `packages/agent-evals` (Trajectory scoring)  |  **P2**   | Standardize eval harness         |
| 10  | **Domain Services**    | Embedded in `api.services`         | `packages/domain/` (7 deterministic pkgs)    |  **P1**   | Extract 7 domain services        |
| 11  | **Connectors**         | 3 duplicate directories            | `packages/connectors/` (9 unified pkgs)      |  **P1**   | Consolidate connectors           |
| 12  | **28 Domain Agents**   | Embedded in `api.agents`           | `agents/{id}/` (28 standalone packages)      |  **P1**   | Migrate 28 agents with YAML      |
| 13  | **Agent Manifests**    | 0/28 manifests                     | `agent.yaml` per agent (tools, scopes)       |  **P1**   | Author 28 manifests              |
| 14  | **Messages API**       | Polling loop in `api.workers`      | `runtimes/messages-api-worker/` (Daemon)     |  **P2**   | Decouple worker runtime          |
| 15  | **Temporal Workflows** | Monolithic in `api/temporal`       | `runtimes/temporal-workflows/` (Durable)     |  **P2**   | Isolate Temporal runtime         |
| 16  | **Agent SDK**          | Python class in `api.orchestrator` | `runtimes/agent-sdk/` (Clean developer SDK)  |  **P2**   | Publish clean SDK                |
| 17  | **Identity Boundary**  | Fallback in `context_loader.py`    | Strict `user_id` non-null validation         |  **P0**   | Remediate fallback vulnerability |
| 18  | **Agent DB Access**    | 28 direct SQL imports              | Zero direct SQL in agents (100% via service) |  **P0**   | Eliminate direct DB imports      |
| 19  | **Prompt Fencing**     | 0% fenced (raw f-strings)          | 100% fenced with XML boundary tags           |  **P1**   | Implement prompt fencing         |
| 20  | **Test Concurrency**   | xdist hangs under 16 workers       | Clean serial or file-grouped test runner     |  **P2**   | Document and stabilize runner    |
