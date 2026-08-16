# MVP-P06 — 07. Cost & Exit Strategy (DEL-MVP-P06-05) — Re-Run 2026-08-15

> DEL-MVP-P06-05. Cost guardrails, deployment framework, provider exit
> playbooks, and operability strategy for the Vaeloom MVP. Baseline: repo
> `master` @ `e48f547`. Constraints: $0 budget (DEC-P01-08); nearest-region
> (DEC-P05-02); 99% best-effort, no SLA (DEC-P05-01).

## 1. Cost Guardrails

| Category      | Strategy                                                      | Enforcement                                            | Current State          |
| ------------- | ------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| LLM spend     | Circuit breaker + agent_limits/agent_costs tables + spend log | `services/agent_costs.py`, `middleware/rate_limit.py`  | IMPLEMENTED_UNVERIFIED |
| Storage       | MinIO/S3 bucket quotas; 100-user cap                          | Infra config                                           | ACTIVE (MinIO)         |
| Compute       | PaaS free tier; auto-sleep on idle                            | Deferred to P16                                        | NOT_DEPLOYED           |
| Network       | CDN for static assets; API rate limiting                      | CloudFront/CD CDN (enterprise); Redis rate-limit (MVP) | ACTIVE (Redis)         |
| Observability | OTel sampling; log level control                              | `OTEL_SDK_DISABLED` for dev; structured logs           | ACTIVE                 |

### 1a. LLM Cost Model (DEC-P06-02)

| Provider       | Model                      | Input Cost      | Output Cost     | Free Tier | When to Use                                  |
| -------------- | -------------------------- | --------------- | --------------- | --------- | -------------------------------------------- |
| Ollama (local) | llama3.1-8b, mistral-7b    | $0 (compute)    | $0 (compute)    | Unlimited | PRIMARY — development, testing, cohort trial |
| Anthropic      | claude-3-5-sonnet-20241022 | $3/1M input     | $15/1M output   | None      | FALLBACK — complex reasoning tasks           |
| OpenAI         | gpt-4o-mini                | $0.15/1M input  | $0.60/1M output | None      | FALLBACK — cost-sensitive tasks              |
| OpenAI         | text-embedding-3-small     | $0.02/1M tokens | —               | None      | Embeddings (1536 dims)                       |

**Cost estimates for 100-user cohort:**

- Daily active users: ~20 (20% DAU/MAU)
- Queries per user per day: ~10
- Total daily queries: ~200
- Average tokens per query: 2000 input, 500 output
- Monthly cost (Anthropic fallback): ~$5-15
- Monthly cost (Ollama primary): $0 (host compute only)

### 1b. Storage Cost Model

| Component          | Per-User Storage | 100-User Total | Free Tier            |
| ------------------ | ---------------- | -------------- | -------------------- |
| Documents (PDFs)   | ~50MB            | 5GB            | MinIO: unlimited     |
| Embeddings (1536d) | ~10MB            | 1GB            | pgvector: local      |
| Knowledge graph    | ~5MB             | 500MB          | PostgreSQL: local    |
| Cache (Redis)      | ~1MB             | 100MB          | Redis: local         |
| **Total**          | **~66MB**        | **~6.6GB**     | **$0 (self-hosted)** |

## 2. Deployment Framework (PaaS-First Intent)

| Decision                       | Status              | Phase                                                         |
| ------------------------------ | ------------------- | ------------------------------------------------------------- |
| Concrete PaaS selection        | DEFERRED            | P16/P19 (measured need + $0 availability)                     |
| PaaS-first architecture intent | ADOPTED             | ADR-026                                                       |
| AWS/k8s infrastructure         | ENTERPRISE-FUTURE   | Out-of-MVP; `infra/kubernetes/` + `infra/terraform/`          |
| Docker Compose dev             | ACTIVE              | `docker-compose.yml`                                          |
| Docker Compose prod            | ACTIVE (with fixes) | `docker-compose.prod.yml` (Q&A-2: fixing mounts/healthchecks) |

### 2a. PaaS Decision Framework (for P16)

| Criterion                     | Weight | Render       | Fly.io      | Railway     | AWS Free Tier  |
| ----------------------------- | ------ | ------------ | ----------- | ----------- | -------------- |
| Free tier availability        | 30%    | ✅ Web+DB    | ✅ VM+DB    | ✅ Web+DB   | ⚠️ 12mo free   |
| Nearest-region latency        | 25%    | ✅ Singapore | ⚠️ No India | ⚠️ No India | ✅ Mumbai      |
| PostgreSQL + pgvector support | 20%    | ✅ Native    | ✅ Native   | ✅ Native   | ✅ RDS         |
| Docker deployment support     | 15%    | ✅ Native    | ✅ Native   | ✅ Native   | ✅ ECS/Fargate |
| Exit/lock-in risk             | 10%    | Low          | Moderate    | Moderate    | Low            |
| **Weighted Score**            |        | **4.35**     | **3.85**    | **3.65**    | **3.95**       |

### 2b. Candidate PaaS Options (Detailed)

1. **Render** (RECOMMENDED for MVP)
   - Free tier: 750 hours/month web, 90 days DB
   - PostgreSQL with pgvector: `render.com/docs/extensions`
   - Nearest region: Singapore (200ms from India)
   - Exit: pg_dump + redeploy; low lock-in
   - Monthly cost at 100 users: $0 (within free tier)

2. **Fly.io**
   - Free tier: 3 shared VMs, 160GB bandwidth
   - PostgreSQL: Fly Postgres (not free)
   - Nearest region: Singapore (but no India)
   - Exit: fly export + redeploy; moderate lock-in
   - Monthly cost at 100 users: ~$5-10 (Postgres not free)

3. **Railway**
   - Free tier: $5 credit/month
   - PostgreSQL: included in credit
   - Nearest region: US/EU only
   - Exit: railway export; moderate lock-in
   - Monthly cost at 100 users: ~$5-15

4. **AWS Free Tier**
   - Free tier: 12 months (EC2 t2.micro, RDS db.t2.micro)
   - PostgreSQL: RDS with pgvector
   - Nearest region: Mumbai
   - Exit: existing IaC; low lock-in
   - Monthly cost at 100 users: $0 (within 12mo free tier)

## 3. Provider Exit Playbooks (with Commands)

### 3a. LLM Provider Exit (Anthropic/OpenAI → Ollama/Other)

**Trigger:** Cost > $10/month (§5 load trigger) or provider policy change.

| Step                        | Command                                                                           | Effort      | Verification                           |
| --------------------------- | --------------------------------------------------------------------------------- | ----------- | -------------------------------------- |
| 1. Identify raw httpx calls | `rg -n "anthropic\|openai\|llm_service" apps/backend/src/`                        | 15min       | Found in `services/llm_service.py`     |
| 2. Update config defaults   | Edit `backend/config.py` — change `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`      | 30min       | Config reads correctly                 |
| 3. Set Ollama as primary    | `export LLM_BASE_URL=http://localhost:11434`                                      | 5min        | `curl http://localhost:11434/api/tags` |
| 4. Run eval suite           | `cd apps/backend && python -m pytest tests/ -q`                                   | 2-5hr       | All tests pass                         |
| 5. Verify embedding dims    | `python -c "from backend.config import settings; print(settings.EMBEDDING_DIMS)"` | 5min        | Check 1536 vs local dims               |
| **Total**                   |                                                                                   | **< 1 day** |                                        |

**Risk:** Embedding dimension change (1536 → local model dims) cascades to
schema. Mitigation: ADR-024 rebuild; flag P07/P12.

### 3b. Database Exit (PostgreSQL → Other)

**Trigger:** Cost > $20/month or residency requirement change.

| Step                         | Command                                                          | Effort       | Verification         |
| ---------------------------- | ---------------------------------------------------------------- | ------------ | -------------------- |
| 1. Dump full database        | `pg_dump -U vaeloom -d vaeloom -Fc -f vaeloom_backup.dump`       | 1hr          | File size check      |
| 2. Verify dump integrity     | `pg_restore --list vaeloom_backup.dump`                          | 15min        | No errors            |
| 3. Import to target DB       | `pg_restore -U target -d target_db vaeloom_backup.dump`          | 1-4hr        | Table count matches  |
| 4. Verify pgvector extension | `psql -c "SELECT * FROM pg_extension WHERE extname = 'vector';"` | 5min         | Extension exists     |
| 5. Run full test suite       | `cd apps/backend && python -m pytest tests/ -q`                  | 2-5hr        | All tests pass       |
| 6. Verify RLS policies       | `psql -c "SELECT * FROM pg_policies;"`                           | 15min        | All policies present |
| **Total**                    |                                                                  | **< 2 days** |                      |

**Risk:** pgvector-specific syntax; Apache AGE (unused in code). Mitigation:
pgvector is PG extension; AGE not used.

### 3c. Object Storage Exit (MinIO → S3/GCS)

**Trigger:** Storage > 10GB or S3 features needed.

| Step                   | Command                                                                            | Effort      | Verification       |
| ---------------------- | ---------------------------------------------------------------------------------- | ----------- | ------------------ |
| 1. Install mc client   | `curl -O https://dl.min.io/client/mc/release/linux-amd64/mc && chmod +x mc`        | 15min       | `./mc --version`   |
| 2. Configure endpoints | `./mc alias set vaeloom $STORAGE_ENDPOINT $STORAGE_ACCESS_KEY $STORAGE_SECRET_KEY` | 5min        | `./mc ls vaeloom/` |
| 3. Mirror to S3        | `./mc mirror vaeloom/ s3://vaeloom-bucket/`                                        | 1-4hr       | File count matches |
| 4. Update env vars     | `export STORAGE_ENDPOINT=https://s3.amazonaws.com`                                 | 5min        | Backend connects   |
| 5. Run tests           | `cd apps/backend && python -m pytest tests/ -q`                                    | 2hr         | All tests pass     |
| **Total**              |                                                                                    | **< 1 day** |                    |

### 3d. Search Exit (SQL ILIKE → Meilisearch/ES)

**Trigger:** Search latency > 500ms or full-text features needed.

| Step                     | Command                                                                                                                         | Effort       | Verification                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| 1. Install Meilisearch   | `curl -L https://install.meilisearch.com \| sh`                                                                                 | 15min        | `./meilisearch --version`           |
| 2. Start instance        | `./meilisearch --master-key $MEILI_MASTER_KEY`                                                                                  | 5min         | `curl http://localhost:7700/health` |
| 3. Create index          | `curl -X POST 'http://localhost:7700/indexes' -H 'Content-Type: application/json' -d '{"uid": "memories", "primaryKey": "id"}'` | 15min        | Index created                       |
| 4. Import data           | `curl -X POST 'http://localhost:7700/indexes/memories/documents' -H 'Content-Type: application/json' -d @memories.json`         | 1-2hr        | Document count matches              |
| 5. Update search service | Edit `services/search_service.py` — replace ILIKE with Meilisearch client                                                       | 1-2hr        | Search returns results              |
| 6. Run tests             | `cd apps/backend && python -m pytest tests/ -q`                                                                                 | 2hr          | All tests pass                      |
| **Total**                |                                                                                                                                 | **< 2 days** |                                     |

**Current state:** `infrastructure/search.py` has dead code for Meilisearch +
PostgresFTS fallback; actual = SQL ILIKE.

### 3e. Cache Exit (Redis → In-Memory)

**Trigger:** Redis unavailable or memory constraint.

| Step                      | Command                                           | Effort       | Verification         |
| ------------------------- | ------------------------------------------------- | ------------ | -------------------- |
| 1. Set REDIS__URL empty   | `export REDIS__URL=""`                            | 5min         | Backend starts       |
| 2. Verify fallback active | `rg "in.memory\|InMemoryCache" apps/backend/src/` | 15min        | Fallback class found |
| 3. Run tests              | `cd apps/backend && python -m pytest tests/ -q`   | 2hr          | All tests pass       |
| **Total**                 |                                                   | **< 1 hour** |                      |

### 3f. Queue Exit (Redis → Other)

**Current state:** BullMQ TS package has no consumers; Python worker not
deployed. Queue layer is not running. No exit needed.

## 4. Operability

| Capability         | Current                                       | Target                                  | Verification Command                                      |
| ------------------ | --------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Health checks      | `/health`, `/health/ready`, `/health/startup` | PASS (FIXING compose healthcheck paths) | `curl http://localhost:8000/health`                       |
| Graceful shutdown  | `async_engine.dispose()` in lifespan          | PASS                                    | `docker stop backend` + logs                              |
| Rate limiting      | Redis sliding window + in-memory fallback     | PASS                                    | `ab -n 200 -c 10 http://localhost:8000/api/v1/health`     |
| Circuit breaker    | agent_limits table (IMPLEMENTED_UNVERIFIED)   | Verify P11                              | `rg "circuit" apps/backend/src/`                          |
| Dead letter queue  | `dead_letter_events` table                    | PASS (schema exists)                    | `psql -c "SELECT COUNT(*) FROM dead_letter_events;"`      |
| Correlation IDs    | CorrelationIDMiddleware                       | PASS                                    | `curl -I http://localhost:8000/health` → X-Correlation-ID |
| Structured logging | structlog + JSON/pretty formatters            | PASS                                    | `docker logs backend` → JSON output                       |

## 5. Load Triggers (with Specific Thresholds)

| Trigger            | Threshold      | Measurement                     | Action                             | Phase   |
| ------------------ | -------------- | ------------------------------- | ---------------------------------- | ------- |
| User count         | > 50 users     | `SELECT COUNT(*) FROM users`    | Evaluate PaaS scaling              | P15/P16 |
| Daily active users | > 20 DAU       | `agent_costs` table queries/day | Add caching, optimize queries      | P15     |
| p95 API latency    | > 500ms        | OTel traces p95                 | Add caching, optimize queries      | P15     |
| p95 API latency    | > 2s           | OTel traces p95                 | Scale compute, review architecture | P15     |
| Storage per user   | > 50MB         | `pg_stat_user_tables` row count | Evaluate cleanup/archival          | P15     |
| Total storage      | > 10GB         | `pg_database_size('vaeloom')`   | Evaluate cleanup/archival          | P15     |
| LLM spend          | > $10/month    | `agent_costs` table total_cost  | Review provider, add limits        | P15     |
| LLM spend          | > $50/month    | `agent_costs` table total_cost  | Switch to Ollama primary           | P15     |
| Redis memory       | > 100MB        | `redis-cli info memory`         | Evaluate eviction policy           | P15     |
| Connection pool    | > 80% utilized | PgBouncer stats                 | Add PgBouncer instances            | P15     |

## 6. Gaps

| Gap                       | Risk                      | Owner    | Phase   | Remediation              |
| ------------------------- | ------------------------- | -------- | ------- | ------------------------ |
| No concrete PaaS selected | Deployment target unclear | Platform | P16/P19 | Decision at P16          |
| No auto-sleep/idle        | $0 budget at risk         | Platform | P16     | PaaS built-in            |
| No cost dashboard         | Spend visibility          | FinOps   | P17     | Grafana/OTel             |
| No load testing results   | Capacity unknown          | QA       | P15     | k6/locust tests          |
| Prometheus COMMENTED OUT  | No metrics endpoint       | SRE      | P17     | Uncomment in main.py:135 |

## 7. Evidence (EVD)

| ID              | Claim                      | Requirement | Type   | Location                       | Result | Date       | Verified by |
| --------------- | -------------------------- | ----------- | ------ | ------------------------------ | ------ | ---------- | ----------- |
| EVD-MVP-P06-015 | Cost guardrails documented | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §1  | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-016 | Exit playbooks with cmds   | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §3  | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-017 | PaaS framework defined     | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §2  | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-022 | Cost model with numbers    | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §1a | PASS   | 2026-08-15 | Agent F     |
| EVD-MVP-P06-023 | Load triggers with metrics | MVP-P06-R05 | DESIGN | `07-cost-exit-strategy.md` §5  | PASS   | 2026-08-15 | Agent F     |
