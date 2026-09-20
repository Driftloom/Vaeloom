# Vaeloom Monorepo Complete Change Plan: Phase 0 through Phase 17

## 1. Executive Summary

This document provides the definitive implementation plan for executing the
enterprise architecture migration across all 7,081 files in the Vaeloom
monorepo.

---

## 2. Monorepo Structural Changes Summary

```text
Current State                                      Target Enterprise State
-------------------------------------------------  --------------------------------------------------
apps/api/src/api/orchestrator/loop.py (3,238 lines) -> packages/agent-common/ + packages/agent-policy/
apps/api/src/api/tools/executor.py (3,442 lines)   -> packages/agent-tools/
apps/api/src/api/agents/* (28 embedded agents)    -> agents/{agent_id}/ (28 standalone packages)
apps/api/src/api/temporal/*                        -> runtimes/temporal-workflows/
apps/api/src/api/workers/                          -> runtimes/messages-api-worker/
apps/api/src/api/services/ (ATS, Resume, Salary)   -> packages/domain/ (7 pure packages)
connectors/ + integrations/ + api/integrations/    -> packages/connectors/ (9 consolidated packages)
api/schemas/* & scattered contracts                -> packages/agent-contracts/ (Pure Pydantic)
```

---

## 3. Strict Safety & Verification Rules

1. **No-Blind-Delete Rule**:
   - Never delete existing implementations in `apps/api` until the replacement
     package in `packages/` is scaffolded, verified, and passes 100% of unit
     tests.
2. **No-Blind-Rewrite Rule**:
   - Existing business logic (e.g. ATS algorithms, resume page-fit logic, 42 RLS
     policies) must be preserved with exact parity.
3. **Continuous Test Verification**:
   - Run the serial test suite
     (`uv run --project apps/api python -m pytest -q -o addopts=""`) after every
     phase to prevent regressions.
4. **Agent 01 Gate Lock**:
   - Agent 01 migration remains strictly frozen until Phase 17 certifies
     `FOUNDATION-VERIFIED.md`.
