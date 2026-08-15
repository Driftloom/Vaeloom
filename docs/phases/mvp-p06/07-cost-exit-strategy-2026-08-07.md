# MVP-P06 — 07. Cost / Operability / Exit Strategy (DEL-MVP-P06-05)

> Owner: FinOps Specialist · $0 hard cap (DEC-P01-07); BQ-P05-01 99%
> best-effort; BQ-P05-02 nearest region.

## 1. Cost envelope

| Item                | Cost basis                                                                                 | Notes                                     |
| ------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------- |
| Hosting (PaaS)      | free tier, nearest region (BQ-P05-02)                                                      | Render/Fly-class; flag DPDP residency P13 |
| Postgres + pgvector | free tier (Neon/Supabase-class)                                                            | include vector projection (no extra DB)   |
| Redis               | free tier (Upstash-class) or self-host                                                     | BullMQ-compatible worker                  |
| Object storage      | free tier (R2 10GB-class)                                                                  | MinIO in dev compose                      |
| Search              | Meilisearch self-host/free                                                                 | rebuildable projection                    |
| LLM                 | **local/free providers (BQ-P06-02)**; mock-first; paid keys only via approved micro-budget | RISK-P05-06; spend log                    |
| CI                  | GitHub Actions (free)                                                                      | 11 workflows                              |
| Gmail API           | quota-based, free                                                                          | polling MVP (DEC-P02-01)                  |

## 2. Spend governance

1. FinOps review at every gate; spend log entry per paid decision.
2. Circuit breaker + per-agent budgets (RISK-P05-06) to cap LLM burst.
3. Scale triggers measured (P15 load tests), never guessed; residual
   risk/headroom/cost documented per change (prompt §19).
4. Any scenario exceeding $0 requires approved change (P03 §7).

## 3. Operability

- Runbooks: 4 exist in `infra/ops/runbooks/` (service-down, high-latency,
  high-error-rate, pool-exhaustion) + DR/DEPLOYMENT docs; extend at P17.
- Observability: OTel traces + Prometheus metrics + structlog JSON (exists);
  dashboards/alerts at P17; no personal content in telemetry.
- Support model: MVP = founder; severity/escalation at P17; cohort channel (VB)
  for user issues.

## 4. Exit strategy

| Dependency        | Exit path                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| PaaS provider     | container images portable (Dockerfiles exist); deploy target is PaaS-agnostic                   |
| Postgres provider | managed-free → any Postgres; alembic migrations portable; backups exported                      |
| Redis             | BullMQ-compatible worker → any Redis; queue contract stable                                     |
| LLM provider      | llm_service provider abstraction (anthropic/openai/local/free); version registry; mock fallback |
| Embedding model   | projection rebuildable (ADR-024) — re-embed from relational rows on model change                |
| Meilisearch       | search = rebuildable projection; fallback relational retrieval                                  |
| Object storage    | S3 API standard; MinIO dev parity                                                               |

Provider-exit playbook recorded before adoption (per `04-version-policy.md` §3);
kill switches AUTO-01..03 (DEC-P02-05) bound automation blast radius.
