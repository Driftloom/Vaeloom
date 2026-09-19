# Phase Contracts & Prompts (Relocated to `specs/`)

> **NOTICE:** In accordance with the Vaeloom Documentation Architecture (Phase 5 Refactoring), authoritative phase engineering prompts and prompt specifications have been elevated from `docs/prompts/` to top-level authoritative specifications:

## New Canonical Locations

| Resource | New Location | Description |
| :--- | :--- | :--- |
| **66 Phase Prompts & Contracts** | [`../../specs/phase-contracts/`](../../specs/phase-contracts/) | Authoritative governing engineering contracts (3 tracks x 22 phases), integrity-pinned by `SHA256SUMS.md` |
| **Phase Execution Status** | [`../../specs/phase-contracts/EXECUTION-STATUS.md`](../../specs/phase-contracts/EXECUTION-STATUS.md) | Single live source of truth for phase progress |
| **Cross-Track Gate Policy** | [`../../specs/phase-contracts/05-cross-track-gate-policy.md`](../../specs/phase-contracts/05-cross-track-gate-policy.md) | Quality gate scoring policy (≥95/100 threshold) |
| **Standards Snapshot** | [`../../specs/phase-contracts/04-standards-snapshot.md`](../../specs/phase-contracts/04-standards-snapshot.md) | Normative compliance standards overlay |
| **Agent System Prompts** | [`../../specs/ai/prompts/`](../../specs/ai/prompts/) | Abstract prompt specifications for agents, memory, and RAG |
| **Phase Execution Evidence** | [`../../evidence/phases/`](../../evidence/phases/) | Immutable historical gate scorecards, test runs, and handoffs |
| **Runtime Code Prompts** | [`../../apps/api/src/api/prompts/`](../../apps/api/src/api/prompts/) | Dynamic system prompt templates loaded by `prompt_manager.py` |
