# ADR-044: Zero-Trust P1 Hardening (Hybrid RAG, Model Routing, Observability, Concurrency)

- **Status:** Accepted (2026-08-31)
- **Deciders:** Zero-Trust Audit Team
- **Context:** Audit `docs/Audits/Agentic-AI-Zero-Trust-E2E-Audit.md` found P1 gaps: hybrid-lite retrieval, under-wired model routing, missing histograms, no workspace limiter, prompt caching off, reflection not scheduled.
- **Decision:** Ship P1b+P1c as incremental, backward-compat hardening (no topology rewrite):
  - `loop.py` tsvector BM25 hybrid (Postgres) + weighted rerank; `llm_service.py` task_type auto-infer + Anthropic prompt-caching `cache_control:ephemeral`; `agent_observability.py` histograms + `WorkspaceConcurrencyLimiter(10/50)` + `agent_span` OTel wrapper; `router.py` workspace limiter gate + OTel span; `reflection_scheduler.py` 03:00 UTC watcher; `tests/eval/golden_retrieval.json` + nightly gate; `background_daemon` watcher registry; `executor` LRU idempotency.
- **Consequences:** Recall @k ↑30% expected (measure via `tests/eval`), routing `gmail→mini` saves ~23x on classify, cache 75% on ReAct repeats, concurrency bounded per workspace/global, nightly consolidation.
- **Alternatives:** Qdrant migration deferred until pgvector bottleneck proven; full handler-site task_type threading deferred to generic infer.
