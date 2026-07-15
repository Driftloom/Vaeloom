# 16 — Deployment & Infrastructure (Enterprise upgrade)

## Read first
`mvp/16-deployment-infrastructure.md`.

## Objective
Migrate from MVP's PaaS deployment to Kubernetes, add multi-region support, disaster recovery, and chaos engineering — justified by real scale/compliance needs, not adopted speculatively.

## Requirements
- **Kubernetes migration:** move `apps/web`, `apps/api`, `apps/ai-service`, and the ingestion workers to a managed Kubernetes cluster — triggered by the multi-service, multi-tenant orchestration needs flagged (not assumed) in `mvp/16-deployment-infrastructure.md`. Document the specific scaling/orchestration need that justified the migration, don't migrate on schedule alone.
- **Multi-region:** deploy to multiple regions matching the data-residency requirements from `enterprise/15` — a tenant's traffic and data stay in their configured region.
- **Autoscaling:** real autoscaling policies (not the PaaS's basic default) tuned per-service — the `ai-service` and ingestion workers scale on queue depth/CPU, the API scales on request volume, independently of each other.
- **Disaster recovery:** a documented, tested DR runbook — defined RPO/RTO targets, automated backups for Postgres/Neo4j/Qdrant, and at least one full DR drill (restoring from backup into a clean environment) performed and timed before this is considered done.
- **Chaos engineering:** a basic chaos testing plan (e.g. randomly killing a service pod, simulating a database failover, injecting network latency) run against staging on a regular cadence, to verify the system degrades gracefully rather than catastrophically.

## Out of scope
Migrating away from the core managed-service choices (Postgres, Neo4j, Qdrant, Redis) — this upgrade is about how they're deployed and scaled, not which ones are used.

## Acceptance criteria
- [ ] The Kubernetes migration is complete with a documented justification for why it was needed now, not just "eventually."
- [ ] A tenant's data and request traffic are verifiably confined to their configured region.
- [ ] Autoscaling correctly responds to a simulated load spike on the AI service without over- or under-provisioning the unrelated API service.
- [ ] A full DR drill is performed, timed, and meets the documented RPO/RTO targets.
- [ ] At least one chaos test (pod kill, DB failover, or latency injection) is run against staging and the system's degraded behavior is observed and documented, not just assumed.
