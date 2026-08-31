# Temporal Enablement — P1c Readiness (2026-08-31)

**Status:** Ready to enable `temporal_enabled=true` behind flag after P0/P1b/P1c
**Requires:** `REDIS__URL`, Temporal cluster (`localhost:7233` or cloud), `TEMPORAL_TASK_QUEUE_*` workers

## What changed for readiness
- **Idempotency:** `tools/executor.py` LRU `workspace:tool:hash` + `IdempotencyRecord` table; deterministic workflow IDs `approval:{ws}:{id}` via `WorkflowIDReusePolicy.REJECT_DUPLICATE` (`services/approval.py:364`)
- **Concurrency:** `WorkspaceConcurrencyLimiter(10/50)` in `agent_observability.py` + gate in `router.py:400` protects PG pool 30
- **HNSW:** migration `0011` + new `0026` tsvector `GIN idx_documents_search_vector` — retrieval <100ms @100k vectors
- **Caching:** Anthropic `cache_control:ephemeral` on system prompt + `prompt-caching-2024-07-31` beta header in `llm_service.py:290`
- **Observability:** `vaeloom_rag/tool/embedding_latency` histograms + `loop.plan` OTel span + `agent_span` helper

## How to enable (staging)
```bash
TEMPORAL_ENABLED=true TEMPORAL_HOST=temporal:7233 REDIS__URL=redis://...
uv run --project apps/api python -m api.temporal.worker --queues approvals,ingest,agent,schedules
```

Verify: `POST /api/v1/approvals` → `Temporal Workflow ApprovalWorkflow started` log → signal on `/approve` works after worker up; fall-closed to DB when worker down.
