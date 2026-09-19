# Vaeloom Historical Archive (`archive/`)

> **Role:** **Superseded monolithic baselines, historical point-in-time audits, and deprecated drafts.**  
> **Rule:** Documents in this directory are preserved strictly for Git lineage and audit history. They **must not** be treated as active system specifications or current architectural guides.

## Archive Collections

| Collection | Directory | Contents | Superseded By |
| :--- | :--- | :--- | :--- |
| **Pre-Modular Monoliths (July 2026)** | [`monoliths/`](./monoliths/) | Massive monolithic files compiled prior to modular directory breakdown (`vaeloom-complete-documentation.md`, `vaeloom-mvp-e2e.md`, `vaeloom-documentation-site.md`, `05-vaeloom-mvp-spec.md`, `vaeloom-enterprise-paper.md`) | Modular domain specifications in [`../specs/`](../specs/) and guides in [`../docs/`](../docs/) |
| **Historical Milestone Audits** | [`audits/`](./audits/) | 107 historical point-in-time audit reports, Gate 2/Gate 3 closure matrices, and zero-trust verification packages (`complete-e2e-zero-trust/`) | Living specifications in [`../specs/`](../specs/) and test suites in `apps/api/tests/` |
| **Historical Audit Reports** | [`audits/historical/`](./audits/historical/) | Quarantined early completion reports (`00-gap-analysis-report.md`, `00-documentation-completion-report.md`, `AUDIT-REPORT.md`, `MIGRATION-REPORT.md`) | [`../docs/DOCUMENTATION-MAP.md`](../docs/DOCUMENTATION-MAP.md) |
| **Dated Temporal Reports** | [`temporal/`](./temporal/) | 8 dated late-August 2026 LangGraph/Temporal closure and zero-trust audit files | [`../specs/temporal/catalog.md`](../specs/temporal/catalog.md) and [`../docs/temporal/runbook.md`](../docs/temporal/runbook.md) |
| **Legacy Connectors & Integrations** | [`connectors-mcp-ts/`](./connectors-mcp-ts/), [`integrations-legacy-ts/`](./integrations-legacy-ts/) | Deprecated TypeScript integration packages | Python FastMCP client in `apps/api/src/api/services/mcp_client_service.py` (ADR-036/037) |
