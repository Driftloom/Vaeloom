# MVP-P06 — 07. Cost & Exit Strategy (DEL-MVP-P06-05) — Re-Run 2026-08-15

> DEL-MVP-P06-05. Cost guardrails, deployment framework, provider exit
> playbooks, and operability strategy for the Vaeloom MVP. Baseline: repo
> `master` @ `e48f547`. Constraints: $0 budget (DEC-P01-08); nearest-region
> (DEC-P05-02); 99% best-effort, no SLA (DEC-P05-01).

## 1. Cost Guardrails

| Category      | Strategy                                                      | Enforcement                                           |
| ------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| LLM spend     | Circuit breaker + agent_limits/agent_costs tables + spend log | `services/agent_costs.py`, `middleware/rate_limit.py` |
| Storage       | MinIO/S3 bucket quotas; 100-user cap                          | Infra config                                          |
| Compute       | PaaS free tier; auto-sleep on idle                            | Deferred to P16                                       |
| Network       | CDN for static assets; API rate limiting                      | CloudFront/CDN (enterprise); Redis rate-limit (MVP)   |
| Observability | OTel sampling; log level control                              | `OTEL_SDK_DISABLED` for dev; structured logs          |

**LLM Cost Strategy (DEC-P06-02):**

- **Primary:** Free/local providers preferred (Ollama, local embeddings)
- **Fallback:** Anthropic (claude-3-5-sonnet) + OpenAI (text-embedding-3-small)
  via approved micro-budget only
- **Tests/CI:** mock_llm fixture; never hit real APIs
- **Monitoring:** `agent_costs` table tracks per-agent spend; `agent_limits`
  table enforces rate limits

## 2. Deployment Framework (PaaS-First Intent)

| Decision                       | Status              | Phase                                                         |
| ------------------------------ | ------------------- | ------------------------------------------------------------- |
| Concrete PaaS selection        | DEFERRED            | P16/P19 (measured need + $0 availability)                     |
| PaaS-first architecture intent | ADOPTED             | ADR-026                                                       |
| AWS/k8s infrastructure         | ENTERPRISE-FUTURE   | Out-of-MVP; `infra/kubernetes/` + `infra/terraform/`          |
| Docker Compose dev             | ACTIVE              | `docker-compose.yml`                                          |
| Docker Compose prod            | ACTIVE (with fixes) | `docker-compose.prod.yml` (Q&A-2: fixing mounts/healthchecks) |

**PaaS Decision Framework (for P16):**

| Criterion                     | Weight | Notes                                 |
| ----------------------------- | ------ | ------------------------------------- |
| Free tier availability        | 30%    | $0 budget (DEC-P01-08)                |
| Nearest-region latency        | 25%    | India 18+; DPDP residency (BQ-P05-02) |
| PostgreSQL + pgvector support | 20%    | Must support pgvector extension       |
| Docker deployment support     | 15%    | Existing Dockerfiles                  |
| Exit/lock-in risk             | 10%    | Data egress + migration complexity    |

**Candidate PaaS options:**

1. **Render** — Free tier for web services; PostgreSQL with pgvector;
   nearest-region; low lock-in
2. **Fly.io** — Free tier; PostgreSQL (Fly Postgres); global edge; moderate
   lock-in
3. **Railway** — Free tier; PostgreSQL; simple; moderate lock-in
4. **AWS free tier** — Matches existing infra; higher ops burden; low lock-in
   (existing IaC)

## 3. Provider Exit Playbooks

### 3a. LLM Provider Exit

| Step      | Action                                                | Effort      |
| --------- | ----------------------------------------------------- | ----------- |
| 1         | Identify raw httpx calls in `services/llm_service.py` | —           |
| 2         | Swap API URL + auth header in `config.py` defaults    | 1 hour      |
| 3         | Update `LLM_PROVIDER` env + `LLM_API_KEY`             | —           |
| 4         | Run eval suite (P12) to validate quality              | 1 day       |
| **Total** | —                                                     | **< 1 day** |

**Risk:** Embedding dimension change (1536 → local model dims) cascades to
schema. Mitigation: ADR-024 rebuild; flag P07/P12.

### 3b. Database Exit (PostgreSQL)

| Step      | Action                                 | Effort       |
| --------- | -------------------------------------- | ------------ |
| 1         | `pg_dump` — standard SQL dump          | 1 hour       |
| 2         | Import to target DB                    | 1–4 hours    |
| 3         | Verify pgvector extension availability | —            |
| 4         | Run full test suite                    | 1 day        |
| **Total** | —                                      | **< 2 days** |

**Risk:** pgvector-specific syntax; Apache AGE (unused in code). Mitigation:
pgvector is PG extension; AGE not used.

### 3c. Object Storage Exit (MinIO → S3/GCS)

| Step      | Action                                         | Effort      |
| --------- | ---------------------------------------------- | ----------- |
| 1         | Change `STORAGE_ENDPOINT` + credentials in env | —           |
| 2         | boto3 compatible; no code changes              | —           |
| 3         | Migrate data (if MinIO → S3: `mc mirror`)      | 1–4 hours   |
| **Total** | —                                              | **< 1 day** |

### 3d. Search Exit (SQL ILIKE → Meilisearch/ES)

| Step      | Action                                                 | Effort       |
| --------- | ------------------------------------------------------ | ------------ |
| 1         | Install search engine (Meilisearch or ES)              | 1 hour       |
| 2         | Create index from existing data                        | 1–2 hours    |
| 3         | Update `services/search_service.py` to use real engine | 1 day        |
| 4         | Update `get_search_index()` to return real engine      | 1 hour       |
| **Total** | —                                                      | **< 2 days** |

**Current state:** `infrastructure/search.py` has dead code for Meilisearch +
PostgresFTS fallback; actual = SQL ILIKE.

### 3e. Cache Exit (Redis → In-Memory)

| Step      | Action                                                   | Effort       |
| --------- | -------------------------------------------------------- | ------------ |
| 1         | Set `REDIS__URL` empty                                   | —            |
| 2         | In-memory fallback already exists for rate-limit + cache | —            |
| 3         | Performance degradation expected; no code changes        | —            |
| **Total** | —                                                        | **< 1 hour** |

### 3f. Queue Exit (Redis → other)

| Step      | Action                                                         | Effort |
| --------- | -------------------------------------------------------------- | ------ |
| 1         | BullMQ TS package has no consumers; Python worker not deployed | —      |
| 2         | No queue exit needed — queue layer is not running              | —      |
| **Total** | —                                                              | **0**  |

## 4. Operability

| Capability         | Current                                       | Target                                  |
| ------------------ | --------------------------------------------- | --------------------------------------- |
| Health checks      | `/health`, `/health/ready`, `/health/startup` | PASS (FIXING compose healthcheck paths) |
| Graceful shutdown  | `async_engine.dispose()` in lifespan          | PASS                                    |
| Rate limiting      | Redis sliding window + in-memory fallback     | PASS                                    |
| Circuit breaker    | agent_limits table (IMPLEMENTED_UNVERIFIED)   | Verify P11                              |
| Dead letter queue  | `dead_letter_events` table                    | PASS (schema exists)                    |
| Correlation IDs    | CorrelationIDMiddleware                       | PASS                                    |
| Structured logging | structlog + JSON/pretty formatters            | PASS                                    |

## 5. Load Triggers

| Trigger               | Threshold    | Action                             | Phase   |
| --------------------- | ------------ | ---------------------------------- | ------- |
| 100 users             | Cohort limit | Evaluate PaaS scaling              | P15/P16 |
| p95 latency > 500ms   | Performance  | Add caching, optimize queries      | P15     |
| p95 latency > 2s      | Critical     | Scale compute, review architecture | P15     |
| Storage > 10GB        | Per-user     | Evaluate cleanup/archival          | P15     |
| LLM spend > $10/month | Budget       | Review provider, add limits        | P15     |

## 6. Gaps

| Gap                       | Risk                      | Owner    | Phase       |
| ------------------------- | ------------------------- | -------- | ----------- |
| No concrete PaaS selected | Deployment target unclear | Platform | P16/P19     |
| Docker prod compose bugs  | Broken deployments        | Platform | P06 (Q&A-2) |
| No auto-sleep/idle        | $0 budget at risk         | Platform | P16         |
| No cost dashboard         | Spend visibility          | FinOps   | P17         |
| No load testing results   | Capacity unknown          | QA       | P15         |

## 7. Evidence (EVD)

| ID              | Claim                      | Requirement | Type   | Location                      | Result | Date       | Verified by |
| --------------- | -------------------------- | ----------- | ------ | ----------------------------- | ------ | ---------- | ----------- |
| EVD-MVP-P06-015 | Cost guardrails documented | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §1 | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-016 | Exit playbooks defined     | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §3 | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-017 | PaaS framework defined     | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §2 | PASS   | 2026-08-15 | Agent F     |
