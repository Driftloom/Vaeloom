# Prompts

> **Purpose:** Source-of-truth prompt packages and runtime prompt references for
> Vaeloom. **Status:** Active **Owner:** Engineering Team **Last Updated:**
> 2026-08-11

## Prompt Packages

| Package | Location | Count | Role |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **66 Independent End-to-End Phase Prompts** | [`./vaeloom-66-independent-end-to-end-phase-prompts/`](./vaeloom-66-independent-end-to-end-phase-prompts/) | 66 files (3 tracks x 22 phases) | **Source of truth** for phase execution: MVP (`01-mvp/`), MVP-to-Enterprise continuation (`02-mvp-to-enterprise-continuation/`), Enterprise (`03-enterprise/`) |

The 66 phase prompts are the governing contract for how Vaeloom phases are
executed:

- Each prompt is standalone: source-corpus inspection, standards overlay,
 predecessor forensic audit, GO / CONDITIONAL GO / NO-GO, requirements and
 acceptance, tests and security, weighted gate, remediation loop, next-phase
 handoff, future-readiness.
- Phase execution evidence lives under [`../phases/`](../phases/) (e.g.
 `mvp-p00` … `mvp-p10` gate reports).
- Execution status per track is tracked in
 [`./vaeloom-66-independent-end-to-end-phase-prompts/EXECUTION-STATUS.md`](./vaeloom-66-independent-end-to-end-phase-prompts/EXECUTION-STATUS.md).
- Structural integrity is pinned by `SHA256SUMS.md` and `manifest.json` inside
 the package; re-verify with `VALIDATION-REPORT.md`.

## Runtime System Prompts

| Prompt | Location |
| -------------------- | ---------------------------------------------------------------------- |
| Agent system prompt | [`./agents/agent-system-prompt.md`](./agents/agent-system-prompt.md) |
| Memory system prompt | [`./memory/memory-system-prompt.md`](./memory/memory-system-prompt.md) |
| RAG pipeline prompt | [`./rag/rag-pipeline-prompt.md`](./rag/rag-pipeline-prompt.md) |
