# 02 — Database & Schema (Enterprise upgrade)

## Read first
`mvp/02-database-schema.md`. This assumes that schema is live with real production data — every change here must ship as a zero-downtime migration.

## Objective
Add tenant scoping across every table, and graduate the graph and vector stores from their MVP (single-Postgres-extension) form to dedicated, purpose-built engines.

## Requirements
- **Tenant scoping:** add `tenant_id` (nullable) to every table that currently has `workspace_id`; enforce at the query layer (not just the schema) that a tenant-scoped query can never cross tenant boundaries — this is the single highest-severity risk in the whole enterprise tier, treat every query path touching these tables as needing an explicit tenant-isolation test, not an assumed one.
- **Graph store migration:** stand up a dedicated Neo4j cluster; migrate the AGE-based graph projection to it with a dual-write period (write to both, verify parity, then cut over reads) rather than a hard cutover — the relational `entities`/`relationships` tables remain canonical throughout, unchanged.
- **Vector store migration:** same dual-write/parity/cutover pattern, migrating from pgvector to a dedicated vector DB (Qdrant) for the embedding volume and query latency enterprise scale requires.
- **Read replicas & partitioning:** add read replicas for the primary Postgres instance; partition high-volume tables (`agent_actions`, `memory_records`) by `workspace_id` or time range once volume data from production justifies it — don't partition speculatively before the data says so.

## Out of scope
Any change to what data is stored (the schema's meaning doesn't change, only its scale/isolation characteristics).

## Acceptance criteria
- [ ] A tenant-isolation test suite (adversarial: deliberately crafted queries attempting cross-tenant reads) passes with zero leakage across every tenant-scoped table.
- [ ] The Neo4j migration runs a dual-write parity check showing 100% agreement with the AGE projection before cutover.
- [ ] The vector DB migration shows equivalent or better retrieval quality (via the eval framework, `enterprise/10-evaluation-framework.md`) versus pgvector on the same golden queries.
- [ ] Read replica failover is tested and doesn't cause write-path errors.
