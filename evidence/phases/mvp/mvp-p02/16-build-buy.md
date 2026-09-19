# MVP-P02 — 16. Build-Buy Decision Matrix & Implications (WS-02.5)

> Research date: 2026-08-13 · Baseline: `master` @ `4aa6c71` · Constraint:
> **$0
> budget** (DEC-P01-08) — OSS + official free tiers only · **Refresh** of
> `05-build-buy-2026-08-07.md` (same workstream, re-verified 2026-08-13 against
> provider pricing changes); part of DEL-MVP-P02-05 (decision implications).
> Evidence labels: **[SOURCE_DERIVED]** = workspace doc (path cited) ·
> **[EXTERNAL_VERIFIED]** = web-fetched, URL + access date cited · **[UNKNOWN]**
> = unverifiable with $0
> tooling · **[NOT_EXECUTED]** = deferred, not run.

## 1. Decision matrix (six decision areas)

Decision values: **BUILD** = implement in-repo on OSS/free · **BUY** = use
managed free tier · **REUSE** = already in repo · Decision rule set carried from
prior run: buy only where $0 AND lawful AND materially de-risks; never buy
unlawful access; reference OSS only after license check; re-evaluate every gate
[SOURCE_DERIVED: `05-build-buy-2026-08-07.md` §2].

### (a) LLM + orchestration

| Option | Free-tier limits (verified) | Portability / exit | Privacy implication | Decision | Why / evidence |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Gemini 2.5 Flash / Flash-Lite (API free tier) | Flash-Lite 1,000 RPD / Flash 250 RPD free (reduced ~50–80% Dec-2025) | Standard REST; swap key per adapter | Free tier may train on inputs outside EEA/UK/CH | **REUSE (adapter) + BYOK** | Mock-LLM already in repo; adapter isolates provider [EXTERNAL_VERIFIED: ai.google.dev/gemini-api/docs/rate-limits, 2026-08-13] |
| Groq (free tier) | 30 RPM; ~14,400 RPD most models per one tracker, **1,000 RPD per another (2026 update)** ⚠ conflict | OpenAI-compatible | Inputs to public endpoints | **BUY (dev/test only)** | Cheap fast eval runs; conflict means verify at P12 [EXTERNAL_VERIFIED: freellm.net + awesome-free-llm-apis.github.io, 2026-08-13] |
| Mistral La Plateforme free | 1B tokens/mo (free tier) | REST | Free tier may train on inputs | Candidate fallback | [EXTERNAL_VERIFIED: docs.mistral.ai, 2026-08-13] |
| Anthropic API | No permanent free tier (~$5 trial credits) | — | — | **No** | Conflicts with $0 constraint [EXTERNAL_VERIFIED: docs.claude.com, 2026-08-13] |
| OpenAI | No usable free tier | — | — | **No** | Same [EXTERNAL_VERIFIED: platform.openai.com, 2026-08-13] |
| Ollama (local) | Free software; needs compute | Highest (local) | Data never leaves machine | **REUSE (fallback)** | $0, private; cohort scale headroom unknown [EXTERNAL_VERIFIED: ollama.com, 2026-08-13] |
| Cloudflare Workers AI | Free daily allocation (beta-moving) | Vendor-bound | Inputs to CF | Conditional BUY | Only if a deployment need appears at P12 [EXTERNAL_VERIFIED: developers.cloudflare.com, 2026-08-13] |

**Verdict (a): REUSE in-repo LLM service + BYOK adapters (Gemini free tier
primary, Groq dev-only, Ollama private fallback). Verify exact quotas at P12
(NOT_EXECUTED now).**

### (b) Retrieval / memory / vector store

| Option | Free-tier limits (verified) | Portability / exit | Privacy implication | Decision | Why / evidence |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| pgvector 0.8.1 (Postgres extension) | Unlimited (runs on any PG; self-host = $0); HNSW parallel builds, halfvec/sparsevec; 0.8.0 fixed filtered-recall flaw | Highest — plain PG, dump/restore | Data stays in own DB | **BUILD** | Free (PostgreSQL License); on Neon/Supabase/self-host; hybrid with FTS [EXTERNAL_VERIFIED: github.com/pgvector/pgvector, 2026-08-13] |
| sqlite-vec | Brute-force only; single-file; WASM/in-browser | Very high | Local | **BUILD (tests/dev)** | Apache-2.0; ideal for offline tests; not production-scale [EXTERNAL_VERIFIED: github.com/asg017/sqlite-vec, 2026-08-13] |
| Qdrant (self-host) | OSS self-host free; cloud hourly-billed | Self-host portable | Depends on hosting | **No (revisit P15)** | Adds infra; pgvector suffices at cohort scale [EXTERNAL_VERIFIED: qdrant.tech, 2026-08-13] |
| Upstash Vector | Free 10K vectors | Vendor-bound | Cloud | **No** | Tiny free cap; pgvector covers [EXTERNAL_VERIFIED: upstash.com, 2026-08-13] |

**Verdict (b): BUILD on Postgres pgvector (+pg_trgm FTS hybrid), sqlite-vec for
offline/test parity. Re-evaluate Qdrant only if scale breaks (P15).**

### (c) Serverless compute + database

| Option | Free-tier limits (verified) | Portability / exit | Privacy implication | Decision | Why / evidence |
| ------------------------ | --------------------------------------------------------------------------- | ------------------ | ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Neon (Postgres) free | 0.5 GB/project, 100 projects, 191.5 CU-h/mo, scale-to-zero (~5 min) | High (standard PG) | Cloud-hosted | **BUY (staging/cohort)** | PostgreSQL; free tier aligns with $0 + ASP-07 measured at P13 [EXTERNAL_VERIFIED: neon.com/pricing, 2026-08-13] |
| Supabase free | 500 MB DB, 2 projects, 50K MAU, 1 GB storage, pauses after 7-day inactivity | Medium (PG core) | Cloud-hosted | **BUY (alternative)** | Auth/file/realtime not needed now; pause behavior is a risk [EXTERNAL_VERIFIED: supabase.com/pricing, 2026-08-13] |
| Aiven free | 5 GB Postgres (largest free) | Medium | Cloud-hosted | Candidate | Biggest free storage [EXTERNAL_VERIFIED: aiven.io, 2026-08-13] |
| Render free | Expires after 30 days | — | — | **No** | Ephemeral — incompatible with a long-lived assistant [EXTERNAL_VERIFIED: render.com/docs/free, 2026-08-13] |
| Railway / Heroku free | Trial credits / discontinued | — | — | **No** | Heroku free gone; Railway credits finite [EXTERNAL_VERIFIED: railw.app, heroku.com, 2026-08-13] |
| Self-host Postgres (VPS) | $0 if infra exists; else cost | Highest | Fully local | **BUILD (preferred)** | Privacy-first default matches trust wedge (PS-03) |

**Verdict (c): BUILD on self-hosted Postgres (SQLite in tests — repo state
[SOURCE_DERIVED: AGENTS.md test-state]); Neon free as staging/cohort DB.
Supabase only if auth/real-time needs appear at P13.**

### (d) Queue / reminders / CRON

| Option | Free-tier limits (verified) | Portability / exit | Privacy implication | Decision | Why / evidence |
| -------------------------------- | ---------------------------------- | ------------------ | --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| BullMQ + Redis | BullMQ MIT; needs Redis | High (standard) | Depends on Redis host | **BUILD** | Already standard; OSS [EXTERNAL_VERIFIED: docs.bullmq.io, 2026-08-13] |
| Upstash Redis | Free 256 MB, 500K commands/mo | Vendor-bound | Cloud | **BUY (free tier)** | Fits cohort scale [EXTERNAL_VERIFIED: upstash.com, 2026-08-13] |
| Redis Cloud free | 30 MB, 100 ops/sec, 30 connections | Vendor-bound | Cloud | Fallback | Tight caps [EXTERNAL_VERIFIED: redis.com/pricing, 2026-08-13] |
| Valkey (self-host) | OSS fork of Redis | Highest | Local | **BUILD fallback** | Avoids Redis 7.4+ RSALv2/SSPLv1 licensing drift [EXTERNAL_VERIFIED: valkey.io, 2026-08-13] |
| Gmail API push (renewal + watch) | Free for consumer OAuth apps | — | — | **REUSE** | Prior-run design; push = future upgrade path [SOURCE_DERIVED: `02-platform-research-2026-08-07.md`, `05-build-buy-2026-08-07.md` §3] |

**Verdict (d): BUILD BullMQ; Redis via Upstash free tier in prod-cohort, Valkey
self-host fallback; in-process scheduler for MVP reminders (REUSE in-repo).**

### (e) Search

| Option | Free-tier limits (verified) | Portability / exit | Privacy implication | Decision | Why / evidence |
| --------------------------------- | ------------------------------------------------------------------------------------- | ------------------ | ------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Postgres FTS + pg_trgm (built-in) | Unlimited; hybrid vector+FTS | Highest | Local | **BUILD** | $0, no new infra; sufficient at MVP scale [SOURCE_DERIVED: repo state; EXTERNAL_VERIFIED: postgresql.org docs, 2026-08-13] |
| Meilisearch OSS | MIT core (enterprise BUSL); unlimited self-host; cloud free 100K docs/10K searches/mo | Good | Self-host local | **BUY later (P15)** | Nice typo-tolerance; unnecessary infra now [EXTERNAL_VERIFIED: meilisearch.com, 2026-08-13] |
| Typesense OSS | GPLv3 self-host free; cloud from ~$0.03/h | Good | Self-host local | Fallback (P15) | If FTS under-delivers [EXTERNAL_VERIFIED: typesense.org, 2026-08-13] |

**Verdict (e): BUILD on Postgres FTS+pg_trgm hybrid. Revisit Meilisearch/
Typesense only if search UX fails cohort eval (P13 gate).**

### (f) Eval datasets (deadline extraction + resume parsing)

| Option | License / size (verified) | Suitability | Decision | Why / evidence |
| ----------------------------------- | ----------------------------------------------- | ------------------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| datasetmaster/resumes (HuggingFace) | MIT, 4,817 resumes | Resume parsing evals | **BUY (dataset)** | License-clean [EXTERNAL_VERIFIED: huggingface.co/datasets/datasetmaster/resumes, 2026-08-13] |
| CareerCorpus | CC-BY-4.0, 302 resumes, dual-annotated | Resume parsing evals | **BUY (dataset)** | [EXTERNAL_VERIFIED: careercorpus.org / Mendeley, 2026-08-13] |
| JobHop v2 (aida-ugent) | CC BY 4.0, 355K career trajectories, ESCO-coded | Memory/career-trajectory evals | **BUY (dataset)** | Fresh (2025 arXiv preprint; indexed 2026-08-13) — reuse for memory eval [EXTERNAL_VERIFIED: huggingface.co/datasets/aida-ugent/JobHop-v2, 2026-08-13] |
| Kaggle resume datasets | CC BY-NC — non-commercial | ❌ | **Excluded** | License conflict with future commercialization [SOURCE_DERIVED: `05-build-buy-2026-08-07.md`] |
| Gmail deadline-extraction dataset | **None found** — no public labeled corpus | — | **BUILD synthetic + cohort labels** | [UNKNOWN] gap; consent-first cohort labels per DEC-P01-07; synthetic email fixtures in-repo [SOURCE_DERIVED: `03-data-feasibility.md`] |
| Faker-generated synthetic | MIT | Fixtures/tests | **BUILD** | In-repo convention [SOURCE_DERIVED: `05-build-buy-2026-08-07.md`] |

**Verdict (f): BUILD eval harness on MIT/CC-BY datasets + synthetic fixtures;
deadline-extraction corpus is a genuine gap — synthetic + consent-based labels
(BQ-06c threshold still open).**

## 2. Implications (DEL-MVP-P02-05 decision implications)

| # | Implication | Decision it feeds | Owner |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------- |
| I-1 | LLM provider is an adapter seam, not a dependency: BYOK free tiers + Ollama fallback keep $0 and privacy | DEC-P02-05 T1/T2; P12 impl | AI/ML Engineer |
| I-2 | Postgres (pgvector + FTS) is the single data plane: no new infra dollars, highest portability | P12 data layer | Data Architect |
| I-3 | Cohort-scale quota headroom (ASP-07) is the one measured risk — confirm Neon/Upstash caps at P13 | ASP-07 → P13 | Platform |
| I-4 | Free-tier LLM training on inputs conflicts with PS-03 privacy promise → user-facing privacy mode default (EEA/UK/CH-exempt caveat + local fallback) | P13 security review | Compliance Reviewer |
| I-5 | License hygiene for every vendored asset (MIT/CC-BY-4.0 only; exclude NC) | P12 vendoring gate | Security Architect |
| I-6 | Deadline-extraction eval corpus must be built (synthetic + cohort consent labels) before P13 accuracy gate (BQ-06c) | BQ-06c / DEC-P01-05 | AI/ML Engineer |

## 3. Residual risk & flagged conflicts

| Risk / conflict | Detail | Status |
| ----------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Free-tier quota drift | Groq RPD 14,400 vs 1,000 (sources conflict); Gemini caps cut Dec-2025 | [UNKNOWN] — re-verify at P12 (NOT_EXECUTED) |
| Proxycurl shutdown date | Prior-run docs conflict (2025-07-04 vs 2026-07-04) | [UNKNOWN] — legal-risk reference only; re-verify P13 (RISK-P02-08) |
| Redis licensing drift | Redis 7.4+ RSALv2/SSPLv1; Valkey fork exists | Mitigated via Valkey fallback [EXTERNAL_VERIFIED: valkey.io, 2026-08-13] |
| Supabase inactivity pause | 7-day pause kills long-lived reminders | Mitigated: Neon primary [EXTERNAL_VERIFIED: supabase.com/pricing, 2026-08-13] |
| Huntr free-cap conflict (100 vs 40) | Competitor-facing; irrelevant to build | Logged in `12-domain-competitor-analysis.md` UNK-2 |

## 4. Evidence links (accessed 2026-08-13)

| Claim | Source | Verified |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------- |
| Gemini free-tier RPD | https://ai.google.dev/gemini-api/docs/rate-limits | 2026-08-13 |
| Groq free tier (conflict noted) | https://freellm.net ; https://awesome-free-llm-apis.github.io | 2026-08-13 |
| Mistral free 1B tokens | https://docs.mistral.ai | 2026-08-13 |
| Anthropic/OpenAI no free API | https://docs.claude.com ; https://platform.openai.com | 2026-08-13 |
| Ollama local | https://ollama.com | 2026-08-13 |
| Cloudflare Workers AI allocation | https://developers.cloudflare.com | 2026-08-13 |
| pgvector 0.8.x | https://github.com/pgvector/pgvector | 2026-08-13 |
| sqlite-vec | https://github.com/asg017/sqlite-vec | 2026-08-13 |
| Neon / Supabase / Aiven / Render free tiers | https://neon.com/pricing ; https://supabase.com/pricing ; https://aiven.io ; https://render.com/docs/free | 2026-08-13 |
| Upstash Redis 256 MB / Vector 10K | https://upstash.com | 2026-08-13 |
| Redis Cloud 30 MB | https://redis.com/pricing | 2026-08-13 |
| Valkey fork | https://valkey.io | 2026-08-13 |
| BullMQ MIT | https://docs.bullmq.io | 2026-08-13 |
| Meilisearch / Typesense | https://meilisearch.com ; https://typesense.org | 2026-08-13 |
| datasetmaster/resumes (MIT) | https://huggingface.co/datasets/datasetmaster/resumes | 2026-08-13 |
| CareerCorpus (CC-BY-4.0) | https://careercorpus.org | 2026-08-13 |
| JobHop v2 (CC BY 4.0) | https://huggingface.co/datasets/aida-ugent/JobHop-v2 | 2026-08-13 |
