# CONT-P01 — 01 Problem Statement — Enterprise-Readiness Evidence

**Deliverable:** `DEL-CONT-P01-01` `problem statement` | **Owner:** Product
Manager | **Reviewed:** UX Researcher, Domain Specialist | **Date:** 2026-08-28
| **Commit:** `78c2d71`

## 1. Method & Evidence Sources

- **Users/buyer evidence triangulated:** `User-Personas.md` 3 primary +4
  secondary, `User-Research.md` student 18-24 wedge, `User-Journey.md` 7
  stages + Day1 vs Month6, `01-mvp-spec:82` problem resumption,
  `vaeloom-mvp-e2e-enterprise-hardened.md` corrections,
  `docs/phases/mvp-p00..p21 93 passed` real E2E `test_product_closure_e2e 10`
  (A-J) `docker temporal 1251`.
- **MVP limits measured (not inferred):**
  `k6 20 RPS p95 120ms <200 headroom 60%`, `94.2% --cov` retained, `42/42 RLS`
  `787053a`, `LangGraph +0.71s at 50VU 0%` (`hardening 27`), `queue-worker`
  legacy `events` only, `standardize_docs 200 M` mojibake.
- **Trust tests:** `test_J cross-ws 404`, `F-SEC-01 direct-client history`
  internal-only, `RAG rag_status empty/unavailable/timeout` never fabricated,
  `approval forged→pending`.
- **No anecdotal override:** Design-partner evidence plan deferred to
  `03-value-risk` (measured outcomes > anecdotes per overlay 146).

## 2. Falsifiable Problem Statements (evidence-linked)

| ID    | Problem (as observed → impact if unsolved)                                                                                                                        | Evidence                                                                                                 | Falsifiable?                                                                                                                        | Must be false to proceed to enterprise                                                                                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PS-01 | Students (18-24) lose Hackathon yr1 → not on yr3 resume → missed internships (stale resume)                                                                       | `01-mvp-spec:82` + `test_B future retrieval` `POST /memories Profile React` search finds                 | **Yes:** Count resumes stale after 6 months `Maturity R-05`                                                                         | MVP already solves via 6 memories compounding, but enterprise needs 22 without overwriting provenance — false if 6→22 migration not validated          |
| PS-02 | Gmail deadlines (Interview/Placement) buried → missed opportunities                                                                                               | `06-paper 857` + `Connectors gmail 3 mock`                                                               | **Yes:** `Enterprise audit §19 timeout` vs `hardening §27`                                                                          | False if RAG proves `retrieve_context never fabricated` at `test_C` — verified, but enterprise needs tenant cells to not leak deadlines across tenants |
| PS-03 | MVP tenant is single pooled `workspace` — enterprise buyer (university/bootcamp/company provisioning populations) cannot isolate cohorts without leakage          | `06:329 enterprise employee vs student vs admin` + `AGENTS.md 42/42 RLS` `Multi-Tenancy.md` tenant cells | **Yes:** `test_J cross-ws 404` at `workspace` level, but `tenant_id` cell + `regional residency` `DPDP` not yet per-tenant (`U-04`) | Must be false to cutover — blocked until `CONT-P07 tenant-data-memory-knowledge migration`                                                             |
| PS-04 | 8-agent MVP cannot cover career/research/coding/learning 28-agent enterprise needs without silent permission expansion                                            | `AGENT_REGISTRY 22` `MVP_CANONICAL 11`                                                                   | **Yes:** `graph agent_node stub` `nodes:204` heuristic only — `CONT-P12` shadow evidence required before action authority           | Must be false to launch enterprise — needs shadow→eval                                                                                                 |
| PS-05 | Migration divergence (old/new) could duplicate `scheduled_jobs last_run_at` vs `Temporal Sched jitter 60s` or `sched_job:{id}:{slot} SETNX` vs `REJECT_DUPLICATE` | `migration.md 45` `temporal/schedules.py 65`                                                             | **Yes:** `migration gate §43` still `⬜` (shadow parity 7d not met, `bull:wait` still 2 files)                                      | Must be false to retire legacy (`CONT-P21`)                                                                                                            |
| PS-06 | Unbounded dual-run estate if every wave does dual-write permanently                                                                                               | `track fixed decision` PaaS→K8s requires measured justification                                          | **Yes:** `22 backlog quarterly 2026-11-22` `commit plan 280 commits`                                                                | Must stay bounded per-wave flags `LANGGRAPH_ENABLED=false` precedent                                                                                   |

**Continuation justification rule §6:**
`CONT must be justified by measured MVP limits OR validated buyers` —
**justified by limits:** MVP `20 RPS headroom 60%` ok for wedge (500 tenant/50k
platform `NFR`), but enterprise needs
`Tenant cells + residency + 22 memories + 28 agents + compliance (GDPR India DPDP FERPA COPPA EU AI)`
— evidence above.

## 3. Current Journeys (falsifiable, from evidence)

| Journey                                                                                                                      | Evidence                          | Pain Unconfirmed?                                                                                   | Action                                               |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Student drag `Resume_draft_v3.pdf` → Organize proposes rename → Memory extracts React 0.9 → Resume folds → Dashboard + Graph | `03-agent-workflow:58` + `test_B` | Even if pain true, enterprise `22 types` not proven                                                 | Validate via `CONT-P12` eval 12 cases `mvp-p12 88.4` |
| User `find me backend internships` → Job Search 8 → ATS 78% +2 edits → picks 3/8 → Application tailors                       | `03:105`                          | Anecdotal without buyer — measure trust failure scenarios (wrong memory, overreach) per overlay 143 | `CONT-P03` delta requirements                        |

## 4. Non-Goals at this Discovery Phase

See `05-non-goals-research-backlog.md` for approved non-goals (big-bang, silent
permission, unverified dual writes, all-tenant cutover).

---

_Trace: `01 INT-05:82 + INT-11 hardening 27 + test_product_closure_e2e 10` →
`CONT-P01-R01` → `DEL-CONT-P01-01 v1.0` → `EVD-CONT-P01-001`._
